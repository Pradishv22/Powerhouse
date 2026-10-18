import uuid
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, g
from backend.database import db
from backend.auth import login_required, normalize_role, ROLE_ADMIN, ROLE_ANALYST
from backend.audit import log_audit_event

appliance_bp = Blueprint("appliances", __name__, url_prefix="/api/v1/appliances")


def calculate_energy(wattage_w: float, daily_hours: float, quantity: int = 1, tariff: float = 8.0):
    daily_kwh = (wattage_w * daily_hours * quantity) / 1000.0
    monthly_kwh = daily_kwh * 30.0
    cost_inr = monthly_kwh * tariff
    return {
        "daily_kwh": round(daily_kwh, 3),
        "monthly_kwh": round(monthly_kwh, 2),
        "estimated_monthly_cost": round(cost_inr, 2),
    }


DEFAULT_SAMPLE_APPLIANCES = [
    {"name": "Air conditioner", "category": "Cooling", "wattage_w": 1500, "daily_usage_hours": 6, "quantity": 1},
    {"name": "Refrigerator", "category": "Kitchen", "wattage_w": 200, "daily_usage_hours": 24, "quantity": 1},
    {"name": "Television", "category": "Entertainment", "wattage_w": 120, "daily_usage_hours": 5, "quantity": 1},
    {"name": "Washing machine", "category": "Laundry", "wattage_w": 500, "daily_usage_hours": 1, "quantity": 1},
    {"name": "Lights and fans", "category": "Lighting", "wattage_w": 300, "daily_usage_hours": 8, "quantity": 1},
    {"name": "Water heater", "category": "Heating", "wattage_w": 2000, "daily_usage_hours": 1, "quantity": 1},
]


@appliance_bp.route("", methods=["GET"])
@login_required
def list_appliances():
    user = g.current_user
    user_id = user["id"]
    role = normalize_role(user.get("role"))
    tariff = float(request.args.get("tariff", 8.0))

    # Admin can inspect another user's appliances if target_user is explicitly requested
    target_user_id = request.args.get("user_id")
    if target_user_id and role == ROLE_ADMIN:
        effective_owner = target_user_id
    else:
        effective_owner = user_id

    appliances = db.appliances.find({"owner_id": effective_owner})

    # If the user has no appliances yet, seed standard defaults for their personal account
    if not appliances:
        for sample in DEFAULT_SAMPLE_APPLIANCES:
            doc = {
                "id": str(uuid.uuid4()),
                "owner_id": effective_owner,
                "name": sample["name"],
                "category": sample["category"],
                "wattage_w": sample["wattage_w"],
                "daily_usage_hours": sample["daily_usage_hours"],
                "quantity": sample["quantity"],
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
            db.appliances.insert_one(doc)
        appliances = db.appliances.find({"owner_id": effective_owner})

    # Enrich with calculated metrics
    enriched = []
    total_monthly = 0.0
    for a in appliances:
        metrics = calculate_energy(
            float(a.get("wattage_w", 0)),
            float(a.get("daily_usage_hours", 0)),
            int(a.get("quantity", 1)),
            tariff,
        )
        total_monthly += metrics["monthly_kwh"]
        enriched.append({**a, **metrics})

    # Calculate percentage share
    for a in enriched:
        a["share_percent"] = (
            round((a["monthly_kwh"] / total_monthly) * 100.0, 1) if total_monthly > 0 else 0.0
        )

    return jsonify(
        {
            "appliances": enriched,
            "total_monthly_kwh": round(total_monthly, 2),
            "total_estimated_monthly_cost": round(total_monthly * tariff, 2),
            "tariff": tariff,
        }
    )


@appliance_bp.route("/<appliance_id>", methods=["GET"])
@login_required
def get_appliance(appliance_id):
    """Retrieve single appliance with strict ownership enforcement."""
    appliance = db.appliances.find_one({"id": appliance_id})
    role = normalize_role(g.current_user.get("role"))

    # Return 404 to avoid leaking existence of private records belonging to other users
    if not appliance or (appliance.get("owner_id") != g.current_user["id"] and role != ROLE_ADMIN):
        return jsonify({"error": {"code": "NOT_FOUND", "message": "Appliance not found."}}), 404

    tariff = float(request.args.get("tariff", 8.0))
    metrics = calculate_energy(
        float(appliance.get("wattage_w", 0)),
        float(appliance.get("daily_usage_hours", 0)),
        int(appliance.get("quantity", 1)),
        tariff,
    )
    return jsonify({**appliance, **metrics})


@appliance_bp.route("", methods=["POST"])
@login_required
def create_appliance():
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    category = (data.get("category") or "Other").strip()
    try:
        wattage_w = float(data.get("wattage_w") or data.get("watts") or 0)
        daily_usage_hours = float(data.get("daily_usage_hours") or data.get("hours") or 0)
        quantity = int(data.get("quantity") or 1)
    except (ValueError, TypeError):
        return (
            jsonify(
                {
                    "error": {
                        "code": "VALIDATION_ERROR",
                        "message": "Wattage and hours must be valid numbers.",
                    }
                }
            ),
            400,
        )

    if not name:
        return (
            jsonify({"error": {"code": "VALIDATION_ERROR", "message": "Appliance name is required."}}),
            400,
        )
    if len(name) > 100:
        return (
            jsonify({"error": {"code": "VALIDATION_ERROR", "message": "Appliance name must be under 100 characters."}}),
            400,
        )
    if wattage_w <= 0 or wattage_w > 10000:
        return (
            jsonify(
                {
                    "error": {
                        "code": "VALIDATION_ERROR",
                        "message": "Wattage must be between 1 and 10,000 W.",
                    }
                }
            ),
            400,
        )
    if daily_usage_hours < 0 or daily_usage_hours > 24:
        return (
            jsonify(
                {
                    "error": {
                        "code": "VALIDATION_ERROR",
                        "message": "Daily usage must be between 0 and 24 hours.",
                    }
                }
            ),
            400,
        )
    if quantity <= 0 or quantity > 100:
        quantity = 1

    appliance_id = str(uuid.uuid4())
    doc = {
        "id": appliance_id,
        "owner_id": g.current_user["id"],
        "name": name,
        "category": category,
        "wattage_w": wattage_w,
        "daily_usage_hours": daily_usage_hours,
        "quantity": quantity,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    db.appliances.insert_one(doc)

    log_audit_event(
        event_type="APPLIANCE_CREATED",
        status="SUCCESS",
        details={"appliance_id": appliance_id, "name": name, "wattage_w": wattage_w},
        user_id=g.current_user["id"],
        user_email=g.current_user.get("email"),
    )

    metrics = calculate_energy(wattage_w, daily_usage_hours, quantity)
    return jsonify({**doc, **metrics}), 201


@appliance_bp.route("/<appliance_id>", methods=["PATCH"])
@login_required
def update_appliance(appliance_id):
    appliance = db.appliances.find_one({"id": appliance_id})
    role = normalize_role(g.current_user.get("role"))

    # Deny without revealing existence to unauthorized users
    if not appliance or (appliance.get("owner_id") != g.current_user["id"] and role != ROLE_ADMIN):
        return jsonify({"error": {"code": "NOT_FOUND", "message": "Appliance not found."}}), 404

    data = request.get_json(silent=True) or {}
    updates = {}
    try:
        if "name" in data:
            name = str(data["name"]).strip()
            if not name:
                return jsonify({"error": {"code": "VALIDATION_ERROR", "message": "Appliance name cannot be empty."}}), 400
            if len(name) > 100:
                return jsonify({"error": {"code": "VALIDATION_ERROR", "message": "Appliance name must be under 100 characters."}}), 400
            updates["name"] = name
        if "category" in data:
            category = str(data["category"]).strip()
            if not category:
                return jsonify({"error": {"code": "VALIDATION_ERROR", "message": "Category cannot be empty."}}), 400
            updates["category"] = category
        if "wattage_w" in data or "watts" in data:
            val = float(data.get("wattage_w", data.get("watts")))
            if val <= 0 or val > 10000:
                return jsonify({"error": {"code": "VALIDATION_ERROR", "message": "Wattage must be 1-10,000 W."}}), 400
            updates["wattage_w"] = val
        if "daily_usage_hours" in data or "hours" in data:
            val = float(data.get("daily_usage_hours", data.get("hours")))
            if val < 0 or val > 24:
                return jsonify({"error": {"code": "VALIDATION_ERROR", "message": "Daily usage must be 0-24 hrs."}}), 400
            updates["daily_usage_hours"] = val
        if "quantity" in data:
            quantity = int(data["quantity"])
            if quantity <= 0 or quantity > 100:
                return jsonify({"error": {"code": "VALIDATION_ERROR", "message": "Quantity must be between 1 and 100."}}), 400
            updates["quantity"] = quantity
    except (TypeError, ValueError):
        return jsonify({"error": {"code": "VALIDATION_ERROR", "message": "Appliance values must be valid numbers."}}), 400

    if updates:
        db.appliances.update_one({"id": appliance_id}, {"$set": updates})

    updated = db.appliances.find_one({"id": appliance_id})
    metrics = calculate_energy(
        float(updated.get("wattage_w", 0)),
        float(updated.get("daily_usage_hours", 0)),
        int(updated.get("quantity", 1)),
    )
    return jsonify({**updated, **metrics})


@appliance_bp.route("/<appliance_id>", methods=["DELETE"])
@login_required
def delete_appliance(appliance_id):
    appliance = db.appliances.find_one({"id": appliance_id})
    role = normalize_role(g.current_user.get("role"))

    # Deny without revealing existence
    if not appliance or (appliance.get("owner_id") != g.current_user["id"] and role != ROLE_ADMIN):
        return jsonify({"error": {"code": "NOT_FOUND", "message": "Appliance not found."}}), 404

    db.appliances.delete_one({"id": appliance_id})
    return jsonify({"message": "Appliance deleted successfully.", "id": appliance_id})
