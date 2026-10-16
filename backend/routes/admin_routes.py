from flask import Blueprint, jsonify
from backend.database import db
from backend.auth import role_required

admin_bp = Blueprint("admin", __name__, url_prefix="/api/v1/admin")


@admin_bp.route("/overview", methods=["GET"])
@role_required("admin")
def admin_overview():
    total_users = db.users.count_documents()
    total_appliances = db.appliances.count_documents()
    total_datasets = db.datasets.count_documents()
    total_jobs = db.jobs.count_documents()

    # Get recent jobs (redacting secrets)
    recent_jobs = db.jobs.find()[-10:] if hasattr(db.jobs, "find") else []
    # Reverse to show newest first
    recent_jobs = list(reversed(recent_jobs))

    # User breakdown (excluding password hashes)
    all_users = db.users.find()
    sanitized_users = [
        {
            "id": u.get("id"),
            "name": u.get("name"),
            "email": u.get("email"),
            "role": u.get("role", "user"),
            "created_at": u.get("created_at"),
            "is_active": u.get("is_active", True),
        }
        for u in all_users
    ]

    return jsonify({
        "stats": {
            "total_users": total_users,
            "total_appliances": total_appliances,
            "total_datasets": total_datasets,
            "total_jobs": total_jobs,
        },
        "users": sanitized_users,
        "recent_jobs": recent_jobs,
        "database_mode": db.mode,
    })
