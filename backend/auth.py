import re
import uuid
from datetime import datetime, timezone
from functools import wraps
from flask import session, request, jsonify, g
from werkzeug.security import generate_password_hash, check_password_hash
from backend.database import db
from backend.config import Config

EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def normalize_email(email: str) -> str:
    return email.strip().lower()


def sanitize_user(user: dict) -> dict:
    """Strip password hash and sensitive internal fields before returning."""
    if not user:
        return {}
    return {
        "id": user.get("id"),
        "name": user.get("name"),
        "email": user.get("email"),
        "role": user.get("role", "user"),
        "created_at": user.get("created_at"),
        "is_active": user.get("is_active", True),
    }


def seed_admin_user():
    """Seed default development admin user if no admin exists yet."""
    admin = db.users.find_one({"role": "admin"})
    if not admin:
        hashed_password = generate_password_hash(Config.ADMIN_PASSWORD)
        admin_doc = {
            "id": "admin-seed-id",
            "name": "System Administrator",
            "email": normalize_email(Config.ADMIN_EMAIL),
            "password_hash": hashed_password,
            "role": "admin",
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
            {"$set": {"password_hash": hashed_password, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        print(f"[PowerWise Auth] Synchronized admin user password for {admin.get('email')}")


def get_current_user():
    """Retrieve the logged-in user from session, or return None."""
    user_id = session.get("user_id")
    if not user_id:
        # Also check Authorization header for Bearer token or Dev token if provided
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


def role_required(required_role: str):
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
            if user.get("role") != required_role:
                return (
                    jsonify(
                        {
                            "error": {
                                "code": "FORBIDDEN",
                                "message": f"Requires {required_role} privileges.",
                            }
                        }
                    ),
                    403,
                )
            g.current_user = user
            return f(*args, **kwargs)

        return decorated_function

    return decorator
