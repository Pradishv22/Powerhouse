import uuid
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, g
from backend.database import db
from backend.auth import login_required, normalize_role, ROLE_ADMIN
from backend.audit import log_audit_event

savings_bp = Blueprint("savings", __name__, url_prefix="/api/v1/savings")


def compute_savings_projection(
    wattage_w: float,
    current_hours: float,
    proposed_hours: float,
    tariff_inr: float = 8.0,
    fixed_charges_inr: float = 0.0,
    quantity: int = 1,
    billing_days: int = 30,
) -> dict:
    """
    Computes accurate energy reduction and rupee savings:
    kWh = watts * hours * quantity / 1000.
    Distinguishes measured historical consumption from hypothetical future projections.
    """
    current_daily_kwh = (wattage_w * current_hours * quantity) / 1000.0
    proposed_daily_kwh = (wattage_w * proposed_hours * quantity) / 1000.0
    daily_kwh_reduction = max(0.0, current_daily_kwh - proposed_daily_kwh)

    current_monthly_kwh = current_daily_kwh * billing_days
    proposed_monthly_kwh = proposed_daily_kwh * billing_days
    monthly_kwh_reduction = max(0.0, current_monthly_kwh - proposed_monthly_kwh)

    current_cost_inr = (current_monthly_kwh * tariff_inr) + fixed_charges_inr
    proposed_cost_inr = (proposed_monthly_kwh * tariff_inr) + fixed_charges_inr
    monthly_savings_inr = max(0.0, current_cost_inr - proposed_cost_inr)
    annual_savings_inr = monthly_savings_inr * 12.0

    percent_reduction = (
        round((monthly_kwh_reduction / current_monthly_kwh) * 100.0, 1)
        if current_monthly_kwh > 0
        else 0.0
    )

    return {
        "is_hypothetical_projection": True,
        "disclaimer": (
            "Simulated projection based on hypothetical usage reduction. "
            "Actual savings will vary with seasonal temperatures, meter billing cycles, and DISCOM slab rates."
        ),
        "assumptions": {
            "billing_days": billing_days,
            "tariff_inr_per_kwh": tariff_inr,
            "fixed_charges_inr": fixed_charges_inr,
            "formula": "Energy (kWh) = Wattage (W) × Daily Hours (h) × Quantity ÷ 1000",
        },
        "current_scenario": {
            "daily_hours": round(current_hours, 2),
            "daily_kwh": round(current_daily_kwh, 3),
            "monthly_kwh": round(current_monthly_kwh, 2),
            "monthly_cost_inr": round(current_cost_inr, 2),
        },
        "proposed_scenario": {
            "daily_hours": round(proposed_hours, 2),
            "daily_kwh": round(proposed_daily_kwh, 3),
            "monthly_kwh": round(proposed_monthly_kwh, 2),
            "monthly_cost_inr": round(proposed_cost_inr, 2),
        },
        "reductions": {
            "daily_kwh": round(daily_kwh_reduction, 3),
            "monthly_kwh": round(monthly_kwh_reduction, 2),
            "monthly_savings_inr": round(monthly_savings_inr, 2),
            "annual_savings_inr": round(annual_savings_inr, 2),
            "percent_reduction": percent_reduction,
        },
    }


@savings_bp.route("/calculate", methods=["POST"])
@login_required
def calculate_savings():
    data = request.get_json(silent=True) or {}
    try:
        wattage_w = float(data.get("wattage_w") or data.get("watts") or 0)
        current_hours = float(data.get("current_daily_hours") or data.get("current_hours") or 0)
        proposed_hours = float(data.get("proposed_daily_hours") or data.get("proposed_hours") or 0)
        tariff_inr = float(data.get("tariff_inr") or data.get("tariff") or 8.0)
        fixed_charges_inr = float(data.get("fixed_charges_inr") or 0.0)
        quantity = int(data.get("quantity") or 1)
        billing_days = int(data.get("billing_days") or 30)
    except (ValueError, TypeError):
        return (
            jsonify({"error": {"code": "VALIDATION_ERROR", "message": "All parameters must be valid numbers."}}),
            400,
        )

    if wattage_w <= 0 or wattage_w > 15000:
        return (
            jsonify({"error": {"code": "VALIDATION_ERROR", "message": "Wattage must be between 1 and 15,000 W."}}),
            400,
        )
    if current_hours < 0 or current_hours > 24:
        return (
            jsonify({"error": {"code": "VALIDATION_ERROR", "message": "Current daily hours must be between 0 and 24."}}),
            400,
        )
    if proposed_hours < 0 or proposed_hours > 24:
        return (
            jsonify({"error": {"code": "VALIDATION_ERROR", "message": "Proposed daily hours must be between 0 and 24."}}),
            400,
        )
    if tariff_inr <= 0 or tariff_inr > 100:
        return (
            jsonify({"error": {"code": "VALIDATION_ERROR", "message": "Tariff must be between ₹0.1 and ₹100 per kWh."}}),
            400,
        )
    if quantity <= 0 or quantity > 100:
        quantity = 1
    if billing_days <= 0 or billing_days > 365:
        billing_days = 30

    projection = compute_savings_projection(
        wattage_w=wattage_w,
        current_hours=current_hours,
        proposed_hours=proposed_hours,
        tariff_inr=tariff_inr,
        fixed_charges_inr=fixed_charges_inr,
        quantity=quantity,
        billing_days=billing_days,
    )

    return jsonify({"projection": projection})


@savings_bp.route("/scenarios", methods=["GET"])
@login_required
def list_scenarios():
    user_id = g.current_user["id"]
    scenarios = db.savings_scenarios.find({"owner_id": user_id})
    return jsonify({"scenarios": scenarios})


@savings_bp.route("/scenarios", methods=["POST"])
@login_required
def save_scenario():
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    appliance_name = (data.get("appliance_name") or "Custom Appliance").strip()

    if not name:
        return jsonify({"error": {"code": "VALIDATION_ERROR", "message": "Scenario name is required."}}), 400

    try:
        wattage_w = float(data.get("wattage_w") or 0)
        current_hours = float(data.get("current_daily_hours") or 0)
        proposed_hours = float(data.get("proposed_daily_hours") or 0)
        tariff_inr = float(data.get("tariff_inr") or 8.0)
        fixed_charges_inr = float(data.get("fixed_charges_inr") or 0.0)
        quantity = int(data.get("quantity") or 1)
    except (ValueError, TypeError):
        return jsonify({"error": {"code": "VALIDATION_ERROR", "message": "Invalid scenario numeric fields."}}), 400

    projection = compute_savings_projection(
        wattage_w=wattage_w,
        current_hours=current_hours,
        proposed_hours=proposed_hours,
        tariff_inr=tariff_inr,
        fixed_charges_inr=fixed_charges_inr,
        quantity=quantity,
    )

    scenario_id = f"scen-{uuid.uuid4().hex[:8]}"
    doc = {
        "id": scenario_id,
        "owner_id": g.current_user["id"],
        "name": name,
        "appliance_name": appliance_name,
        "inputs": {
            "wattage_w": wattage_w,
            "current_daily_hours": current_hours,
            "proposed_daily_hours": proposed_hours,
            "tariff_inr": tariff_inr,
            "fixed_charges_inr": fixed_charges_inr,
            "quantity": quantity,
        },
        "projection": projection,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    db.savings_scenarios.insert_one(doc)

    log_audit_event(
        event_type="SAVINGS_SCENARIO_SAVED",
        status="SUCCESS",
        details={
            "scenario_id": scenario_id,
            "name": name,
            "appliance_name": appliance_name,
            "monthly_savings_inr": projection["reductions"]["monthly_savings_inr"],
        },
        user_id=g.current_user["id"],
        user_email=g.current_user.get("email"),
    )

    return jsonify({"message": "Scenario saved successfully.", "scenario": doc}), 201


@savings_bp.route("/scenarios/<scenario_id>", methods=["DELETE"])
@login_required
def delete_scenario(scenario_id):
    scenario = db.savings_scenarios.find_one({"id": scenario_id})
    role = normalize_role(g.current_user.get("role"))

    if not scenario or (scenario.get("owner_id") != g.current_user["id"] and role != ROLE_ADMIN):
        return jsonify({"error": {"code": "NOT_FOUND", "message": "Scenario not found."}}), 404

    db.savings_scenarios.delete_one({"id": scenario_id})
    return jsonify({"message": "Scenario deleted successfully.", "id": scenario_id})
