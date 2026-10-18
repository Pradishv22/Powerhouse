import re
import uuid
from datetime import datetime, timezone
from functools import wraps
from flask import session, request, jsonify, g
from werkzeug.security import generate_password_hash, check_password_hash
from backend.database import db
from backend.config import Config
from backend.audit import log_audit_event

EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

# Standardized Role Definitions
ROLE_HOUSEHOLD = "user"  # Canonical role in database for household users
ROLE_ANALYST = "analyst"  # Energy Analyst
ROLE_ADMIN = "admin"  # Administrator
VALID_ROLES = [ROLE_HOUSEHOLD, "household", ROLE_ANALYST, ROLE_ADMIN]


def normalize_role(role: str) -> str:
    """Normalize user roles, treating 'household' and 'user' as synonyms."""
    if not role:
        return ROLE_HOUSEHOLD
    r = role.strip().lower()
    if r in ("household", "user"):
        return ROLE_HOUSEHOLD
    if r in (ROLE_ANALYST, ROLE_ADMIN):
        return r
    return ROLE_HOUSEHOLD


def normalize_email(email: str) -> str:
    return email.strip().lower()


def sanitize_user(user: dict) -> dict:
    """Strip password hash and sensitive internal fields before returning to client."""
    if not user:
        return {}
    role = normalize_role(user.get("role", ROLE_HOUSEHOLD))
    return {
        "id": user.get("id"),
        "name": user.get("name"),
        "email": user.get("email"),
        "role": role,
        "created_at": user.get("created_at"),
        "is_active": user.get("is_active", True),
    }


def seed_admin_user():
    """Seed default development admin and analyst users if they do not exist yet."""
    # 1. Seed or synchronize admin user
    admin = db.users.find_one({"role": "admin"})
    if not admin:
        hashed_password = generate_password_hash(Config.ADMIN_PASSWORD)
        admin_doc = {
            "id": "admin-seed-id",
            "name": "System Administrator",
            "email": normalize_email(Config.ADMIN_EMAIL),
            "password_hash": hashed_password,
            "role": ROLE_ADMIN,
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        db.users.insert_one(admin_doc)
        print(f"[PowerWise Auth] Seeded admin user: {Config.ADMIN_EMAIL}")
    elif not check_password_hash(admin.get("password_hash", ""), Config.ADMIN_PASSWORD):
        hashed_password = generate_password_hash(Config.ADMIN_PASSWORD)
        db.users.update_one(
            {"id": admin["id"]},
            {
                "$set": {
                    "password_hash": hashed_password,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
            },
        )
        print(f"[PowerWise Auth] Synchronized admin user password for {admin.get('email')}")

    # 2. Seed development analyst user if not present
    analyst_email = normalize_email("analyst@powerwise.local")
    analyst = db.users.find_one({"email": analyst_email})
    if not analyst:
        hashed_password = generate_password_hash("Analyst@PowerWise2026")
        analyst_doc = {
            "id": "analyst-seed-id",
            "name": "Energy Analyst",
            "email": analyst_email,
            "password_hash": hashed_password,
            "role": ROLE_ANALYST,
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        db.users.insert_one(analyst_doc)
        print(f"[PowerWise Auth] Seeded analyst user: {analyst_email}")


# Alias for backward compatibility
seed_initial_users = seed_admin_user


def get_current_user():
    """Retrieve the logged-in user from session or Bearer authorization header."""
    user_id = session.get("user_id")
    if not user_id:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            user_id = auth_header[7:].strip()

    if not user_id:
        return None

    user = db.users.find_one({"id": user_id})
    if user and user.get("is_active", True):
        return user
    return None


def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user = get_current_user()
        if not user:
            return (
                jsonify(
                    {
                        "error": {
                            "code": "UNAUTHORIZED",
                            "message": "Authentication is required to access this resource.",
                        }
                    }
                ),
                401,
            )
        g.current_user = user
        return f(*args, **kwargs)

    return decorated_function


def role_required(*allowed_roles):
    """
    Decorator to restrict route to one or more allowed roles.
    Example: @role_required('admin') or @role_required('admin', 'analyst')
    Deny by default for any unauthenticated or unauthorized request.
    """
    normalized_allowed = [normalize_role(r) for r in allowed_roles]

    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            user = get_current_user()
            if not user:
                return (
                    jsonify(
                        {
                            "error": {
                                "code": "UNAUTHORIZED",
                                "message": "Authentication required.",
                            }
                        }
                    ),
                    401,
                )

            user_role = normalize_role(user.get("role", ROLE_HOUSEHOLD))
            if user_role not in normalized_allowed:
                log_audit_event(
                    event_type="PERMISSION_DENIED",
                    status="FAILED",
                    details={
                        "path": request.path,
                        "method": request.method,
                        "required_roles": normalized_allowed,
                        "user_role": user_role,
                    },
                    user_id=user.get("id"),
                    user_email=user.get("email"),
                )
                return (
                    jsonify(
                        {
                            "error": {
                                "code": "FORBIDDEN",
                                "message": f"Access denied. Requires one of {normalized_allowed} privileges.",
                            }
                        }
                    ),
                    403,
                )
            g.current_user = user
            return f(*args, **kwargs)

        return decorated_function

    return decorator
