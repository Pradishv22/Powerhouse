import csv
import io
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from flask import Blueprint, request, jsonify, g
from backend.database import db
from backend.auth import login_required
from backend.config import Config

dataset_bp = Blueprint("datasets", __name__, url_prefix="/api/v1/datasets")

CANONICAL_HEADERS = [
    "record_id",
    "household_id",
    "timestamp",
    "appliance_name",
    "category",
    "wattage_w",
    "usage_hours",
    "energy_kwh",
    "tariff_per_kwh",
]


def validate_and_parse_csv(csv_content: str):
    """
    Validates CSV against the Big Data contract:
    - Checks required canonical columns
    - Validates types, bounds (hours 0-24, positive watts, non-negative energy)
    - Auto-calculates energy_kwh from watts * hours / 1000 if omitted
    - Rejects or collects malformed rows with line numbers and reasons
    """
    f = io.StringIO(csv_content)
    reader = csv.DictReader(f)
    if not reader.fieldnames:
        return {"valid": False, "error": "CSV file is empty or missing headers."}

    # Normalize header names (lowercase, stripped)
    headers = [h.strip().lower() for h in reader.fieldnames if h]
    required = {"household_id", "timestamp"}
    if not required.issubset(set(headers)):
        missing = list(required - set(headers))
        return {
            "valid": False,
            "error": f"Missing required headers: {', '.join(missing)}. Found: {', '.join(headers)}",
        }

    valid_rows = []
    errors = []
    line_number = 1
    calculated_count = 0

    for row in reader:
        line_number += 1
        # Normalize keys
        clean_row = {k.strip().lower(): (v.strip() if v else "") for k, v in row.items() if k}

        rec_id = clean_row.get("record_id") or f"REC-{uuid.uuid4().hex[:8]}"
        hh_id = clean_row.get("household_id")
        ts = clean_row.get("timestamp")
        app_name = clean_row.get("appliance_name") or "General"
        cat = clean_row.get("category") or "Other"

        if not hh_id:
            errors.append({"line": line_number, "reason": "Missing household_id."})
            continue
        if not ts:
            errors.append({"line": line_number, "reason": "Missing timestamp."})
            continue

        # Parse numeric fields
        try:
            wattage_str = clean_row.get("wattage_w")
            wattage = float(wattage_str) if wattage_str else 0.0
            if wattage < 0:
                errors.append({"line": line_number, "reason": "Wattage cannot be negative."})
                continue
        except ValueError:
            errors.append({"line": line_number, "reason": f"Invalid wattage '{clean_row.get('wattage_w')}'."})
            continue

        try:
            usage_str = clean_row.get("usage_hours")
            usage_hours = float(usage_str) if usage_str else 0.0
            if usage_hours < 0 or usage_hours > 24:
                errors.append({"line": line_number, "reason": "Usage hours must be between 0 and 24."})
                continue
        except ValueError:
            errors.append({"line": line_number, "reason": f"Invalid usage hours '{clean_row.get('usage_hours')}'."})
            continue

        is_calculated = False
        try:
            energy_str = clean_row.get("energy_kwh")
            if energy_str != "" and energy_str is not None:
                energy_kwh = float(energy_str)
                if energy_kwh < 0:
                    errors.append({"line": line_number, "reason": "Energy kWh cannot be negative."})
                    continue
            else:
                if wattage > 0 and usage_hours > 0:
                    energy_kwh = round((wattage * usage_hours) / 1000.0, 4)
                    is_calculated = True
                    calculated_count += 1
                else:
                    errors.append({"line": line_number, "reason": "Either energy_kwh or (wattage and usage_hours) must be provided."})
                    continue
        except ValueError:
            errors.append({"line": line_number, "reason": f"Invalid energy_kwh '{clean_row.get('energy_kwh')}'."})
            continue

        try:
            tariff_str = clean_row.get("tariff_per_kwh")
            tariff = float(tariff_str) if tariff_str else 8.0
            if tariff < 0:
                tariff = 8.0
        except ValueError:
            tariff = 8.0

        valid_rows.append({
            "record_id": rec_id,
            "household_id": hh_id,
            "timestamp": ts,
            "appliance_name": app_name,
            "category": cat,
            "wattage_w": wattage,
            "usage_hours": usage_hours,
            "energy_kwh": round(energy_kwh, 3),
            "tariff_per_kwh": tariff,
            "calculated": is_calculated,
        })

    return {
        "valid": True,
        "total_rows": line_number - 1,
        "valid_rows_count": len(valid_rows),
        "error_rows_count": len(errors),
        "calculated_energy_count": calculated_count,
        "errors": errors[:50],  # cap at first 50 errors
        "rows": valid_rows,
    }


def seed_default_demo_dataset():
    """Ensure the sample electricity records are registered as a shared demo dataset."""
    sample_file = Config.DATA_DIR / "sample_electricity_records.csv"
    if not sample_file.exists():
        return

    existing = db.datasets.find_one({"is_demo": True})
    if not existing:
        with open(sample_file, "r", encoding="utf-8") as f:
            content = f.read()
        res = validate_and_parse_csv(content)
        dataset_doc = {
            "id": "demo-dataset-default",
            "owner_id": "system",
            "filename": "sample_electricity_records.csv",
            "storage_mode": "local_csv",
            "is_demo": True,
            "row_count": res.get("valid_rows_count", 0),
            "status": "Ready",
            "validation_summary": {
                "total_rows": res.get("total_rows", 0),
                "valid_rows": res.get("valid_rows_count", 0),
                "error_rows": res.get("error_rows_count", 0),
                "calculated_energy_count": res.get("calculated_energy_count", 0),
            },
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        db.datasets.insert_one(dataset_doc)
        print("[PowerWise Datasets] Seeded default demo dataset.")


@dataset_bp.route("", methods=["GET"])
@login_required
def list_datasets():
    seed_default_demo_dataset()
    user_id = g.current_user["id"]
    is_admin = g.current_user.get("role") == "admin"

    # Admin sees all; regular user sees owned + shared demo datasets
    all_datasets = db.datasets.find()
    accessible = []
    for d in all_datasets:
        if is_admin or d.get("owner_id") == user_id or d.get("is_demo", False):
            accessible.append(d)

    return jsonify({"datasets": accessible})


@dataset_bp.route("", methods=["POST"])
@login_required
def upload_dataset():
    if "file" not in request.files:
        return jsonify({"error": {"code": "VALIDATION_ERROR", "message": "No file uploaded. Key 'file' is required."}}), 400

    file = request.files["file"]
    if not file.filename:
        return jsonify({"error": {"code": "VALIDATION_ERROR", "message": "Empty filename."}}), 400

    if not file.filename.lower().endswith(".csv"):
        return jsonify({"error": {"code": "VALIDATION_ERROR", "message": "Only CSV files are permitted."}}), 400

    try:
        content = file.read().decode("utf-8")
    except UnicodeDecodeError:
        return jsonify({"error": {"code": "VALIDATION_ERROR", "message": "CSV must be UTF-8 encoded."}}), 400

    validation = validate_and_parse_csv(content)
    if not validation["valid"]:
        return jsonify({"error": {"code": "VALIDATION_ERROR", "message": validation["error"]}}), 400

    if validation["valid_rows_count"] == 0:
        return jsonify({
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "CSV contains no valid electricity records.",
                "details": validation["errors"],
            }
        }), 400

    # Save CSV to uploads folder safely
    dataset_id = str(uuid.uuid4())
    upload_dir = Config.UPLOAD_FOLDER
    upload_dir.mkdir(parents=True, exist_ok=True)
    saved_filename = f"{dataset_id}.csv"
    saved_path = upload_dir / saved_filename

    with open(saved_path, "w", encoding="utf-8") as out:
        out.write(content)

    doc = {
        "id": dataset_id,
        "owner_id": g.current_user["id"],
        "filename": os.path.basename(file.filename),
        "saved_path": str(saved_path),
        "storage_mode": "local_csv",  # or 'hdfs' if HDFS configured
        "row_count": validation["valid_rows_count"],
        "status": "Ready",
        "validation_summary": {
            "total_rows": validation["total_rows"],
            "valid_rows": validation["valid_rows_count"],
            "error_rows": validation["error_rows_count"],
            "calculated_energy_count": validation["calculated_energy_count"],
            "sample_errors": validation["errors"],
        },
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    db.datasets.insert_one(doc)

    return jsonify({
        "message": "Dataset uploaded and validated successfully.",
        "dataset": doc,
    }), 201


@dataset_bp.route("/<dataset_id>", methods=["GET"])
@login_required
def get_dataset(dataset_id):
    dataset = db.datasets.find_one({"id": dataset_id})
    if not dataset:
        return jsonify({"error": {"code": "NOT_FOUND", "message": "Dataset not found."}}), 404

    # Ownership check
    if (
        dataset.get("owner_id") != g.current_user["id"]
        and not dataset.get("is_demo", False)
        and g.current_user.get("role") != "admin"
    ):
        return jsonify({"error": {"code": "FORBIDDEN", "message": "Access denied to this dataset."}}), 403

    return jsonify({"dataset": dataset})


def _get_owned_dataset_or_error(dataset_id):
    dataset = db.datasets.find_one({"id": dataset_id})
    if not dataset:
        return None, (jsonify({"error": {"code": "NOT_FOUND", "message": "Dataset not found."}}), 404)
    if dataset.get("owner_id") != g.current_user["id"] and g.current_user.get("role") != "admin":
        return None, (jsonify({"error": {"code": "FORBIDDEN", "message": "Cannot modify another user's dataset."}}), 403)
    if dataset.get("is_demo", False):
        return None, (jsonify({"error": {"code": "FORBIDDEN", "message": "The shared demo dataset cannot be changed."}}), 403)
    return dataset, None


@dataset_bp.route("/<dataset_id>", methods=["PATCH"])
@login_required
def update_dataset(dataset_id):
    dataset, error = _get_owned_dataset_or_error(dataset_id)
    if error:
        return error
    data = request.get_json(silent=True) or {}
    if set(data) - {"filename"}:
        return jsonify({"error": {"code": "VALIDATION_ERROR", "message": "Only the dataset filename can be changed."}}), 400
    filename = str(data.get("filename", "")).strip()
    if not filename or filename != os.path.basename(filename) or not filename.lower().endswith(".csv"):
        return jsonify({"error": {"code": "VALIDATION_ERROR", "message": "Filename must be a CSV filename without a path."}}), 400
    db.datasets.update_one({"id": dataset["id"]}, {"$set": {"filename": filename}})
    return jsonify({"dataset": db.datasets.find_one({"id": dataset["id"]})})


@dataset_bp.route("/<dataset_id>", methods=["DELETE"])
@login_required
def delete_dataset(dataset_id):
    dataset, error = _get_owned_dataset_or_error(dataset_id)
    if error:
        return error
    saved_path = Path(dataset.get("saved_path", ""))
    upload_root = Config.UPLOAD_FOLDER.resolve()
    try:
        if saved_path and saved_path.resolve().is_relative_to(upload_root) and saved_path.exists():
            saved_path.unlink()
    except (OSError, ValueError):
        return jsonify({"error": {"code": "STORAGE_ERROR", "message": "Dataset metadata was retained because its file could not be removed."}}), 500
    db.datasets.delete_one({"id": dataset["id"]})
    return jsonify({"message": "Dataset deleted successfully.", "id": dataset["id"]})
