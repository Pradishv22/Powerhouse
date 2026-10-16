import uuid
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, g
from backend.database import db
from backend.auth import login_required

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
    user_id = g.current_user["id"]
    tariff = float(request.args.get("tariff", 8.0))

    appliances = db.appliances.find({"owner_id": user_id})

    # If the new user has no appliances yet, seed standard defaults for them
    if not appliances:
        for sample in DEFAULT_SAMPLE_APPLIANCES:
            doc = {
                "id": str(uuid.uuid4()),
                "owner_id": user_id,
                "name": sample["name"],
                "category": sample["category"],
                "wattage_w": sample["wattage_w"],
                "daily_usage_hours": sample["daily_usage_hours"],
                "quantity": sample["quantity"],
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
            db.appliances.insert_one(doc)
        appliances = db.appliances.find({"owner_id": user_id})

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
    if daily_usage_hours <= 0 or daily_usage_hours > 24:
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
    if quantity <= 0:
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

    metrics = calculate_energy(wattage_w, daily_usage_hours, quantity)
    return jsonify({**doc, **metrics}), 201


@appliance_bp.route("/<appliance_id>", methods=["PATCH"])
@login_required
def update_appliance(appliance_id):
    appliance = db.appliances.find_one({"id": appliance_id})
    if not appliance:
        return jsonify({"error": {"code": "NOT_FOUND", "message": "Appliance not found."}}), 404

    # Enforce ownership: only owner or admin can update
    if appliance.get("owner_id") != g.current_user["id"] and g.current_user.get("role") != "admin":
        return jsonify({"error": {"code": "FORBIDDEN", "message": "Cannot modify another user's appliance."}}), 403

    data = request.get_json(silent=True) or {}
    updates = {}
    if "name" in data and data["name"].strip():
        updates["name"] = data["name"].strip()
    if "category" in data and data["category"].strip():
        updates["category"] = data["category"].strip()
    if "wattage_w" in data or "watts" in data:
        val = float(data.get("wattage_w", data.get("watts", 0)))
        if val <= 0 or val > 10000:
            return jsonify({"error": {"code": "VALIDATION_ERROR", "message": "Wattage must be 1-10000W."}}), 400
        updates["wattage_w"] = val
    if "daily_usage_hours" in data or "hours" in data:
        val = float(data.get("daily_usage_hours", data.get("hours", 0)))
        if val <= 0 or val > 24:
            return jsonify({"error": {"code": "VALIDATION_ERROR", "message": "Daily usage must be 0-24 hrs."}}), 400
        updates["daily_usage_hours"] = val
    if "quantity" in data:
        updates["quantity"] = max(1, int(data["quantity"]))

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
    if not appliance:
        return jsonify({"error": {"code": "NOT_FOUND", "message": "Appliance not found."}}), 404

    if appliance.get("owner_id") != g.current_user["id"] and g.current_user.get("role") != "admin":
        return jsonify({"error": {"code": "FORBIDDEN", "message": "Cannot delete another user's appliance."}}), 403

    db.appliances.delete_one({"id": appliance_id})
    return jsonify({"message": "Appliance deleted successfully.", "id": appliance_id})
