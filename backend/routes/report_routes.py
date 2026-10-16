import csv
import io
from flask import Blueprint, request, Response, jsonify, g
from backend.auth import login_required
from backend.routes.analytics_routes import load_dataset_records

report_bp = Blueprint("reports", __name__, url_prefix="/api/v1/reports")


def sanitize_csv_cell(value) -> str:
    """
    Prevents CSV Formula Injection:
    If a cell starts with =, +, -, @, prepend a single quote to prevent execution in Excel/Calc.
    """
    s = str(value)
    if s and s[0] in ("=", "+", "-", "@"):
        return f"'{s}"
    return s


@report_bp.route("/export.csv", methods=["GET"])
@login_required
def export_csv():
    dataset_id = request.args.get("dataset_id")
    tariff = float(request.args.get("tariff", 8.0))
    records = load_dataset_records(dataset_id)

    if not records:
        return jsonify({"error": {"code": "EMPTY_DATASET", "message": "No records found to export."}}), 400

    output = io.StringIO()
    writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL)

    # Tableau-ready headers
    headers = [
        "Record ID",
        "Household ID",
        "Timestamp",
        "Appliance Name",
        "Category",
        "Wattage (W)",
        "Daily Usage Hours",
        "Energy (kWh)",
        "Tariff (INR/kWh)",
        "Estimated Cost (INR)",
    ]
    writer.writerow(headers)

    for r in records:
        cost = round(r["energy_kwh"] * tariff, 2)
        row = [
            sanitize_csv_cell(r.get("record_id", "")),
            sanitize_csv_cell(r.get("household_id", "")),
            sanitize_csv_cell(r.get("timestamp", "")),
            sanitize_csv_cell(r.get("appliance_name", "")),
            sanitize_csv_cell(r.get("category", "")),
            r.get("wattage_w", 0),
            r.get("usage_hours", 0),
            r.get("energy_kwh", 0),
            tariff,
            cost,
        ]
        writer.writerow(row)

    csv_data = output.getvalue()
    filename = f"powerwise_analytics_export_{dataset_id or 'default'}.csv"

    return Response(
        csv_data,
        mimetype="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
