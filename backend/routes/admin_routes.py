from pathlib import Path
from flask import Blueprint, jsonify, request, g
from backend.database import db
from backend.auth import (
    role_required,
    sanitize_user,
    normalize_role,
    VALID_ROLES,
    ROLE_ADMIN,
    ROLE_ANALYST,
    ROLE_HOUSEHOLD,
)
from backend.audit import log_audit_event
from backend.config import Config

admin_bp = Blueprint("admin", __name__, url_prefix="/api/v1/admin")


@admin_bp.route("/overview", methods=["GET"])
@role_required("admin")
def admin_overview():
    all_users = db.users.find()
    total_users = len(all_users)
    active_users = sum(1 for u in all_users if u.get("is_active", True))
    deactivated_users = total_users - active_users

    # Role breakdown
    roles_count = {"household": 0, "analyst": 0, "admin": 0}
    for u in all_users:
        r = normalize_role(u.get("role", ROLE_HOUSEHOLD))
        if r in ("user", "household"):
            roles_count["household"] += 1
        elif r == ROLE_ANALYST:
            roles_count["analyst"] += 1
        elif r == ROLE_ADMIN:
            roles_count["admin"] += 1

    total_appliances = db.appliances.count_documents()
    all_datasets = db.datasets.find()
    total_datasets = len(all_datasets)
    demo_datasets = sum(1 for d in all_datasets if d.get("is_demo", False))
    user_datasets = total_datasets - demo_datasets

    all_jobs = db.jobs.find()
    total_jobs = len(all_jobs)
    completed_jobs = sum(1 for j in all_jobs if j.get("status") == "Completed")
    failed_jobs = sum(1 for j in all_jobs if j.get("status") == "Failed")

    # Recent jobs (newest first, cap at 10)
    recent_jobs = list(reversed(all_jobs))[:10]

    # Recent audit logs (newest first, cap at 15)
    all_audit_logs = db.audit_logs.find()
    recent_audit = list(reversed(all_audit_logs))[:15]

    return jsonify({
        "stats": {
            "total_users": total_users,
            "active_users": active_users,
            "deactivated_users": deactivated_users,
            "users_by_role": roles_count,
            "total_appliances": total_appliances,
            "total_datasets": total_datasets,
            "demo_datasets": demo_datasets,
            "user_datasets": user_datasets,
            "total_jobs": total_jobs,
            "completed_jobs": completed_jobs,
            "failed_jobs": failed_jobs,
        },
        "users": [sanitize_user(u) for u in all_users],
        "recent_jobs": recent_jobs,
        "recent_audit_logs": recent_audit,
        "database_mode": db.mode,
    })


@admin_bp.route("/users", methods=["GET"])
@role_required("admin")
def list_users():
    """Search and filter users by name, email, role, or active status."""
    q = (request.args.get("q") or "").strip().lower()
    role_filter = request.args.get("role")
    status_filter = request.args.get("status")

    users = db.users.find()
    filtered = []
    for u in users:
        # Search query matching
        if q:
            name_match = q in (u.get("name") or "").lower()
            email_match = q in (u.get("email") or "").lower()
            if not (name_match or email_match):
                continue

        # Role filter
        if role_filter:
            norm_filter = normalize_role(role_filter)
            user_norm_role = normalize_role(u.get("role", ROLE_HOUSEHOLD))
            if user_norm_role != norm_filter:
                continue

        # Status filter
        if status_filter is not None and status_filter != "":
            is_active = status_filter.lower() in ("true", "1", "active")
            if bool(u.get("is_active", True)) != is_active:
                continue

        filtered.append(sanitize_user(u))

    return jsonify({"users": filtered, "total": len(filtered)})


@admin_bp.route("/users/<user_id>/role", methods=["PATCH"])
@role_required("admin")
def update_user_role(user_id):
    """Assign or revoke roles with server-side authorization."""
    target_user = db.users.find_one({"id": user_id})
    if not target_user:
        return jsonify({"error": {"code": "NOT_FOUND", "message": "User not found."}}), 404

    data = request.get_json(silent=True) or {}
    new_role_raw = data.get("role")
    if not new_role_raw:
        return jsonify({"error": {"code": "VALIDATION_ERROR", "message": "Role is required."}}), 400

    new_role = normalize_role(new_role_raw)
    if new_role not in (ROLE_HOUSEHOLD, ROLE_ANALYST, ROLE_ADMIN):
        return (
            jsonify(
                {
                    "error": {
                        "code": "VALIDATION_ERROR",
                        "message": f"Invalid role '{new_role_raw}'. Supported: household, analyst, admin.",
                    }
                }
            ),
            400,
        )

    # Prevent demoting the only remaining admin
    current_admin_id = g.current_user["id"]
    if target_user["id"] == current_admin_id and new_role != ROLE_ADMIN:
        admin_count = sum(1 for u in db.users.find({"role": ROLE_ADMIN}) if u.get("is_active", True))
        if admin_count <= 1:
            return (
                jsonify(
                    {
                        "error": {
                            "code": "OPERATION_FORBIDDEN",
                            "message": "Cannot demote the only active administrator in the system.",
                        }
                    }
                ),
                400,
            )

    old_role = target_user.get("role")
    db.users.update_one({"id": user_id}, {"$set": {"role": new_role}})

    log_audit_event(
        event_type="ROLE_CHANGE",
        status="SUCCESS",
        details={
            "target_user_id": user_id,
            "target_user_email": target_user.get("email"),
            "old_role": old_role,
            "new_role": new_role,
        },
        user_id=g.current_user["id"],
        user_email=g.current_user.get("email"),
    )

    updated = db.users.find_one({"id": user_id})
    return jsonify({
        "message": f"Role updated from {old_role} to {new_role}.",
        "user": sanitize_user(updated),
    })


@admin_bp.route("/users/<user_id>/status", methods=["PATCH"])
@role_required("admin")
def toggle_user_status(user_id):
    """Activate or deactivate user account with server-side authorization."""
    target_user = db.users.find_one({"id": user_id})
    if not target_user:
        return jsonify({"error": {"code": "NOT_FOUND", "message": "User not found."}}), 404

    data = request.get_json(silent=True) or {}
    if "is_active" not in data:
        return jsonify({"error": {"code": "VALIDATION_ERROR", "message": "'is_active' boolean is required."}}), 400

    new_status = bool(data["is_active"])

    # Prevent self-deactivation by admin
    if target_user["id"] == g.current_user["id"] and not new_status:
        return (
            jsonify(
                {
                    "error": {
                        "code": "OPERATION_FORBIDDEN",
                        "message": "Administrators cannot deactivate their own account.",
                    }
                }
            ),
            400,
        )

    db.users.update_one({"id": user_id}, {"$set": {"is_active": new_status}})

    log_audit_event(
        event_type="ACCOUNT_STATUS_CHANGE",
        status="SUCCESS",
        details={
            "target_user_id": user_id,
            "target_user_email": target_user.get("email"),
            "is_active": new_status,
        },
        user_id=g.current_user["id"],
        user_email=g.current_user.get("email"),
    )

    updated = db.users.find_one({"id": user_id})
    return jsonify({
        "message": f"User account {'activated' if new_status else 'deactivated'} successfully.",
        "user": sanitize_user(updated),
    })


@admin_bp.route("/users/<user_id>", methods=["DELETE"])
@role_required("admin")
def delete_user(user_id):
    """
    Destructive administrative action to delete a user.
    Requires explicit confirmation flag (?confirm=true or {"confirm": true}).
    Prevents self-deletion and cleans up associated resources.
    """
    confirm = request.args.get("confirm", "").lower() == "true"
    if not confirm:
        data = request.get_json(silent=True) or {}
        confirm = bool(data.get("confirm", False))

    if not confirm:
        return (
            jsonify(
                {
                    "error": {
                        "code": "CONFIRMATION_REQUIRED",
                        "message": "Destructive deletion requires explicit confirmation parameter 'confirm=true'.",
                    }
                }
            ),
            400,
        )

    target_user = db.users.find_one({"id": user_id})
    if not target_user:
        return jsonify({"error": {"code": "NOT_FOUND", "message": "User not found."}}), 404

    if target_user["id"] == g.current_user["id"]:
        return (
            jsonify(
                {
                    "error": {
                        "code": "OPERATION_FORBIDDEN",
                        "message": "Administrators cannot delete their own account.",
                    }
                }
            ),
            400,
        )

    # Clean up user's datasets safely
    user_datasets = db.datasets.find({"owner_id": user_id})
    upload_root = Config.UPLOAD_FOLDER.resolve()
    for ds in user_datasets:
        if not ds.get("is_demo", False):
            saved_path = Path(ds.get("saved_path", ""))
            try:
                if saved_path and saved_path.resolve().is_relative_to(upload_root) and saved_path.exists():
                    saved_path.unlink()
            except Exception:
                pass
            db.datasets.delete_one({"id": ds["id"]})

    # Clean up appliances
    user_appliances = db.appliances.find({"owner_id": user_id})
    for app in user_appliances:
        db.appliances.delete_one({"id": app["id"]})

    # Delete user
    db.users.delete_one({"id": user_id})

    log_audit_event(
        event_type="USER_DELETED",
        status="SUCCESS",
        details={
            "deleted_user_id": user_id,
            "deleted_user_email": target_user.get("email"),
        },
        user_id=g.current_user["id"],
        user_email=g.current_user.get("email"),
    )

    return jsonify({"message": f"User {target_user.get('email')} and associated records deleted successfully."})


@admin_bp.route("/audit-logs", methods=["GET"])
@role_required("admin")
def get_audit_logs():
    """Retrieve audit history. Excludes passwords/tokens. Restricted to administrators."""
    event_type = request.args.get("event_type")
    user_id = request.args.get("user_id")
    limit = min(int(request.args.get("limit", 100)), 200)

    query = {}
    if event_type:
        query["event_type"] = event_type
    if user_id:
        query["user_id"] = user_id

    logs = db.audit_logs.find(query)
    # Sort newest first
    logs = list(reversed(logs))[:limit]

    return jsonify({"audit_logs": logs, "count": len(logs)})
