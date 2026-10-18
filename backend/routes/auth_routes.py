import uuid
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, session, g
from werkzeug.security import generate_password_hash, check_password_hash
from backend.database import db
from backend.auth import (
    normalize_email,
    sanitize_user,
    EMAIL_REGEX,
    ROLE_HOUSEHOLD,
    login_required,
    get_current_user,
)
from backend.audit import log_audit_event

auth_bp = Blueprint("auth", __name__, url_prefix="/api/v1/auth")


@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    email = normalize_email(data.get("email") or "")
    password = data.get("password") or ""
    confirm_password = data.get("confirm_password") or ""

    if not name:
        return (
            jsonify({"error": {"code": "VALIDATION_ERROR", "message": "Name is required."}}),
            400,
        )
    if len(name) > 100:
        return (
            jsonify({"error": {"code": "VALIDATION_ERROR", "message": "Name must be under 100 characters."}}),
            400,
        )
    if not EMAIL_REGEX.match(email):
        return (
            jsonify({"error": {"code": "VALIDATION_ERROR", "message": "A valid email is required."}}),
            400,
        )
    if len(password) < 6:
        return (
            jsonify(
                {
                    "error": {
                        "code": "VALIDATION_ERROR",
                        "message": "Password must be at least 6 characters long.",
                    }
                }
            ),
            400,
        )
    if password != confirm_password:
        return (
            jsonify(
                {
                    "error": {
                        "code": "VALIDATION_ERROR",
                        "message": "Passwords do not match.",
                    }
                }
            ),
            400,
        )

    # Check for existing email
    existing_user = db.users.find_one({"email": email})
    if existing_user:
        return (
            jsonify(
                {
                    "error": {
                        "code": "CONFLICT",
                        "message": "An account with this email already exists.",
                    }
                }
            ),
            409,
        )

    # SECURE RBAC: Public registration ALWAYS assigns the household user role.
    # Administrative or Analyst roles can only be granted by an authenticated administrator.
    role = ROLE_HOUSEHOLD

    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "name": name,
        "email": email,
        "password_hash": generate_password_hash(password),
        "role": role,
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    db.users.insert_one(user_doc)

    log_audit_event(
        event_type="REGISTER",
        status="SUCCESS",
        details={"name": name, "assigned_role": role},
        user_id=user_id,
        user_email=email,
    )

    # Establish session
    session["user_id"] = user_id
    session.permanent = True

    return (
        jsonify(
            {
                "message": "Registration successful.",
                "user": sanitize_user(user_doc),
                "token": user_id,  # Provided for environments where cookies are cross-domain
            }
        ),
        201,
    )


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    email = normalize_email(data.get("email") or "")
    password = data.get("password") or ""

    if not email or not password:
        return (
            jsonify(
                {
                    "error": {
                        "code": "VALIDATION_ERROR",
                        "message": "Email and password are required.",
                    }
                }
            ),
            400,
        )

    user = db.users.find_one({"email": email})
    if not user or not check_password_hash(user.get("password_hash", ""), password):
        log_audit_event(
            event_type="LOGIN_FAILURE",
            status="FAILED",
            details={"reason": "INVALID_CREDENTIALS", "attempted_email": email},
            user_id=user.get("id") if user else None,
            user_email=email,
        )
        return (
            jsonify(
                {
                    "error": {
                        "code": "INVALID_CREDENTIALS",
                        "message": "Invalid email or password.",
                    }
                }
            ),
            401,
        )

    if not user.get("is_active", True):
        log_audit_event(
            event_type="LOGIN_FAILURE",
            status="FAILED",
            details={"reason": "ACCOUNT_DISABLED"},
            user_id=user["id"],
            user_email=email,
        )
        return (
            jsonify(
                {
                    "error": {
                        "code": "ACCOUNT_DISABLED",
                        "message": "Account has been deactivated. Please contact an administrator.",
                    }
                }
            ),
            403,
        )

    log_audit_event(
        event_type="LOGIN_SUCCESS",
        status="SUCCESS",
        details={"role": user.get("role")},
        user_id=user["id"],
        user_email=email,
    )

    # Establish session
    session["user_id"] = user["id"]
    session.permanent = True

    return jsonify(
        {
            "message": "Login successful.",
            "user": sanitize_user(user),
            "token": user["id"],
        }
    )


@auth_bp.route("/logout", methods=["POST"])
def logout():
    curr = get_current_user()
    if curr:
        log_audit_event(
            event_type="LOGOUT",
            status="SUCCESS",
            user_id=curr.get("id"),
            user_email=curr.get("email"),
        )
    session.clear()
    return jsonify({"message": "Logged out successfully."})


@auth_bp.route("/me", methods=["GET"])
@login_required
def me():
    return jsonify({"user": sanitize_user(g.current_user)})


@auth_bp.route("/profile", methods=["PATCH"])
@login_required
def update_profile():
    """Allow user to update safe profile details (e.g. name). Role and status cannot be escalated."""
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()

    if not name:
        return (
            jsonify({"error": {"code": "VALIDATION_ERROR", "message": "Name cannot be empty."}}),
            400,
        )
    if len(name) > 100:
        return (
            jsonify({"error": {"code": "VALIDATION_ERROR", "message": "Name must be under 100 characters."}}),
            400,
        )

    user_id = g.current_user["id"]
    db.users.update_one(
        {"id": user_id},
        {
            "$set": {
                "name": name,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
        },
    )

    log_audit_event(
        event_type="PROFILE_UPDATED",
        status="SUCCESS",
        details={"new_name": name},
        user_id=user_id,
        user_email=g.current_user.get("email"),
    )

    updated_user = db.users.find_one({"id": user_id})
    return jsonify({"message": "Profile updated successfully.", "user": sanitize_user(updated_user)})


@auth_bp.route("/change-password", methods=["POST"])
@login_required
def change_password():
    """Allow user to securely change their password by verifying their current password."""
    data = request.get_json(silent=True) or {}
    current_password = data.get("current_password") or ""
    new_password = data.get("new_password") or ""
    confirm_new_password = data.get("confirm_new_password") or ""

    user_id = g.current_user["id"]
    user = db.users.find_one({"id": user_id})

    if not check_password_hash(user.get("password_hash", ""), current_password):
        log_audit_event(
            event_type="PASSWORD_CHANGE_FAILED",
            status="FAILED",
            details={"reason": "INCORRECT_CURRENT_PASSWORD"},
            user_id=user_id,
            user_email=user.get("email"),
        )
        return (
            jsonify({"error": {"code": "INVALID_CREDENTIALS", "message": "Current password does not match."}}),
            401,
        )

    if len(new_password) < 6:
        return (
            jsonify({"error": {"code": "VALIDATION_ERROR", "message": "New password must be at least 6 characters."}}),
            400,
        )

    if new_password != confirm_new_password:
        return (
            jsonify({"error": {"code": "VALIDATION_ERROR", "message": "New passwords do not match."}}),
            400,
        )

    new_hash = generate_password_hash(new_password)
    db.users.update_one(
        {"id": user_id},
        {
            "$set": {
                "password_hash": new_hash,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
        },
    )

    log_audit_event(
        event_type="PASSWORD_CHANGED",
        status="SUCCESS",
        user_id=user_id,
        user_email=user.get("email"),
    )

    return jsonify({"message": "Password changed successfully."})
