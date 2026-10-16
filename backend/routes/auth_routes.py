import uuid
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, session, g
from werkzeug.security import generate_password_hash, check_password_hash
from backend.database import db
from backend.auth import (
    normalize_email,
    sanitize_user,
    EMAIL_REGEX,
    login_required,
    get_current_user,
)

auth_bp = Blueprint("auth", __name__, url_prefix="/api/v1/auth")


@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    email = normalize_email(data.get("email") or "")
    password = data.get("password") or ""
    confirm_password = data.get("confirm_password") or ""
    role = data.get("role", "user")

    if not name:
        return (
            jsonify({"error": {"code": "VALIDATION_ERROR", "message": "Name is required."}}),
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

    # Only allow user role from public register (admin can only be created by admin or seed)
    if role != "admin":
        role = "user"

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
        return (
            jsonify(
                {
                    "error": {
                        "code": "ACCOUNT_DISABLED",
                        "message": "Account has been deactivated.",
                    }
                }
            ),
            403,
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
    session.clear()
    return jsonify({"message": "Logged out successfully."})


@auth_bp.route("/me", methods=["GET"])
@login_required
def me():
    return jsonify({"user": sanitize_user(g.current_user)})
