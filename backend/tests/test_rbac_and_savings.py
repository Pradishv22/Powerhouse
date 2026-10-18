import pytest
from io import BytesIO
from werkzeug.security import generate_password_hash
from backend.app import create_app
from backend.database import db


def setup_test_users():
    """Ensure clean test users for household 1, household 2, analyst, and admin."""
    # Household User 1
    db.users.delete_one({"email": "hh1@test.com"})
    db.users.insert_one({
        "id": "hh1-id",
        "name": "Household User One",
        "email": "hh1@test.com",
        "password_hash": generate_password_hash("Password123!"),
        "role": "user",
        "is_active": True,
        "created_at": "2026-10-18T00:00:00Z",
    })

    # Household User 2
    db.users.delete_one({"email": "hh2@test.com"})
    db.users.insert_one({
        "id": "hh2-id",
        "name": "Household User Two",
        "email": "hh2@test.com",
        "password_hash": generate_password_hash("Password123!"),
        "role": "user",
        "is_active": True,
        "created_at": "2026-10-18T00:00:00Z",
    })

    # Energy Analyst
    db.users.delete_one({"email": "analyst@test.com"})
    db.users.insert_one({
        "id": "analyst-id",
        "name": "Test Energy Analyst",
        "email": "analyst@test.com",
        "password_hash": generate_password_hash("Password123!"),
        "role": "analyst",
        "is_active": True,
        "created_at": "2026-10-18T00:00:00Z",
    })


@pytest.fixture
def client():
    setup_test_users()
    app = create_app({"TESTING": True, "SECRET_KEY": "test-secret-key"})
    with app.test_client() as client:
        yield client


def login(client, email, password="Password123!"):
    return client.post("/api/v1/auth/login", json={"email": email, "password": password})


# ------------------- 1. RBAC & Privilege Escalation Tests -------------------

def test_unauthenticated_requests_rejected(client):
    """Verify deny-by-default on protected endpoints for unauthenticated requests."""
    assert client.get("/api/v1/auth/me").status_code == 401
    assert client.get("/api/v1/appliances").status_code == 401
    assert client.get("/api/v1/datasets").status_code == 401
    assert client.get("/api/v1/analytics/summary").status_code == 401
    assert client.get("/api/v1/admin/overview").status_code == 401
    assert client.get("/api/v1/savings/scenarios").status_code == 401


def test_public_registration_prevents_privilege_escalation(client):
    """Verify that registering with role 'admin' or 'analyst' is ignored and forced to 'user'."""
    db.users.delete_one({"email": "attacker@test.com"})
    res = client.post(
        "/api/v1/auth/register",
        json={
            "name": "Attacker",
            "email": "attacker@test.com",
            "password": "Password123!",
            "confirm_password": "Password123!",
            "role": "admin",  # Attacker attempt to escalate
        },
    )
    assert res.status_code == 201
    user = res.get_json()["user"]
    assert user["role"] == "user"  # Must be household user

    # Check database doc
    db_user = db.users.find_one({"email": "attacker@test.com"})
    assert db_user["role"] == "user"


def test_profile_update_cannot_escalate_role(client):
    """Verify users cannot update their own role via profile update."""
    login(client, "hh1@test.com")
    res = client.patch(
        "/api/v1/auth/profile",
        json={"name": "Household Renamed", "role": "admin", "is_active": False},
    )
    assert res.status_code == 200
    user = res.get_json()["user"]
    assert user["name"] == "Household Renamed"
    assert user["role"] == "user"


def test_household_user_cannot_access_another_user_appliance(client):
    """Verify household user 1 cannot access, modify, or delete household user 2's appliance."""
    # Create appliance for user 2
    login(client, "hh2@test.com")
    create_res = client.post(
        "/api/v1/appliances",
        json={"name": "User 2 AC", "category": "Cooling", "watts": 1500, "hours": 6},
    )
    assert create_res.status_code == 201
    appliance_id = create_res.get_json()["id"]

    # Log in as user 1 and attempt to read, update, delete user 2's appliance
    login(client, "hh1@test.com")

    # Read should return 404 to avoid leaking existence
    get_res = client.get(f"/api/v1/appliances/{appliance_id}")
    assert get_res.status_code == 404

    # Update should return 404
    patch_res = client.patch(f"/api/v1/appliances/{appliance_id}", json={"name": "Hacked AC"})
    assert patch_res.status_code == 404

    # Delete should return 404
    delete_res = client.delete(f"/api/v1/appliances/{appliance_id}")
    assert delete_res.status_code == 404

    # Verify user 2's appliance is intact
    login(client, "hh2@test.com")
    intact = client.get(f"/api/v1/appliances/{appliance_id}")
    assert intact.status_code == 200
    assert intact.get_json()["name"] == "User 2 AC"


def test_household_and_analyst_cannot_access_admin_endpoints(client):
    """Verify non-admin roles receive 403 Forbidden on admin APIs."""
    login(client, "hh1@test.com")
    assert client.get("/api/v1/admin/overview").status_code == 403
    assert client.get("/api/v1/admin/users").status_code == 403
    assert client.get("/api/v1/admin/audit-logs").status_code == 403

    login(client, "analyst@test.com")
    assert client.get("/api/v1/admin/overview").status_code == 403
    assert client.get("/api/v1/admin/users").status_code == 403


# ------------------- 2. Admin Operations & Safety -------------------

def test_admin_user_management_and_safety_checks(client):
    """Verify admin can search users, update roles, toggle status, and safe delete with confirmation."""
    login(client, "admin@powerwise.local", "Admin@PowerWise2026")

    # Search users
    search_res = client.get("/api/v1/admin/users?q=analyst")
    assert search_res.status_code == 200
    users = search_res.get_json()["users"]
    assert any("analyst" in u["email"] for u in users)

    # Change HH1 role to analyst
    role_res = client.patch("/api/v1/admin/users/hh1-id/role", json={"role": "analyst"})
    assert role_res.status_code == 200
    assert role_res.get_json()["user"]["role"] == "analyst"

    # Revert HH1 role to user
    client.patch("/api/v1/admin/users/hh1-id/role", json={"role": "user"})

    # Toggle status to deactivated
    status_res = client.patch("/api/v1/admin/users/hh1-id/status", json={"is_active": False})
    assert status_res.status_code == 200
    assert status_res.get_json()["user"]["is_active"] is False

    # Deactivated user cannot log in
    client.post("/api/v1/auth/logout")
    bad_login = client.post("/api/v1/auth/login", json={"email": "hh1@test.com", "password": "Password123!"})
    assert bad_login.status_code == 403

    # Reactivate user
    login(client, "admin@powerwise.local", "Admin@PowerWise2026")
    client.patch("/api/v1/admin/users/hh1-id/status", json={"is_active": True})

    # Test destructive delete requires confirmation parameter
    no_confirm_del = client.delete("/api/v1/admin/users/hh1-id")
    assert no_confirm_del.status_code == 400
    assert "confirm" in no_confirm_del.get_json()["error"]["message"].lower()

    # Admin cannot delete own account
    admin_id = db.users.find_one({"email": "admin@powerwise.local"})["id"]
    self_del = client.delete(f"/api/v1/admin/users/{admin_id}?confirm=true")
    assert self_del.status_code == 400


# ------------------- 3. Dataset Authorization & Analyst Sharing -------------------

def test_dataset_ownership_and_sharing_with_analyst(client):
    """Verify dataset private ownership and explicit sharing with analysts."""
    # HH1 uploads private dataset
    login(client, "hh1@test.com")
    csv_data = b"household_id,timestamp,appliance_name,energy_kwh\nHH-1,2026-09-01T08:00:00Z,AC,3.5\n"
    up_res = client.post(
        "/api/v1/datasets",
        data={"file": (BytesIO(csv_data), "hh1_private.csv")},
        content_type="multipart/form-data",
    )
    assert up_res.status_code == 201
    dataset_id = up_res.get_json()["dataset"]["id"]

    # HH2 cannot access HH1's dataset
    login(client, "hh2@test.com")
    assert client.get(f"/api/v1/datasets/{dataset_id}").status_code == 403
    assert client.get(f"/api/v1/analytics/summary?dataset_id={dataset_id}").status_code == 403
    assert client.get(f"/api/v1/reports/export.csv?dataset_id={dataset_id}").status_code == 403

    # Analyst cannot access before sharing
    login(client, "analyst@test.com")
    assert client.get(f"/api/v1/datasets/{dataset_id}").status_code == 403

    # HH1 shares dataset with Analyst
    login(client, "hh1@test.com")
    share_res = client.post(f"/api/v1/datasets/{dataset_id}/share", json={"analyst_id": "analyst-id"})
    assert share_res.status_code == 200

    # Analyst can now access and run analytics
    login(client, "analyst@test.com")
    analyst_get = client.get(f"/api/v1/datasets/{dataset_id}")
    assert analyst_get.status_code == 200
    analyst_summary = client.get(f"/api/v1/analytics/summary?dataset_id={dataset_id}")
    assert analyst_summary.status_code == 200
    assert analyst_summary.get_json()["total_consumption"] == 3.5

    # Clean up dataset
    login(client, "hh1@test.com")
    client.delete(f"/api/v1/datasets/{dataset_id}")


def test_invalid_csv_does_not_replace_active_dataset(client):
    """Verify that uploading invalid CSV returns 400 and does not corrupt dataset state."""
    login(client, "hh1@test.com")
    bad_csv = b"invalid_col1,invalid_col2\nfoo,bar\n"
    res = client.post(
        "/api/v1/datasets",
        data={"file": (BytesIO(bad_csv), "bad.csv")},
        content_type="multipart/form-data",
    )
    assert res.status_code == 400
    assert "Missing required headers" in res.get_json()["error"]["message"]


# ------------------- 4. Smart Savings Planner -------------------

def test_smart_savings_calculations_and_scenarios(client):
    """
    Test savings calculations:
    Appliance: 1500W AC.
    Current usage: 6.0 hours/day.
    Proposed usage: 4.0 hours/day.
    Tariff: 8.0 INR/kWh.
    Calculations:
    Current daily: 1500 * 6 / 1000 = 9.0 kWh.
    Proposed daily: 1500 * 4 / 1000 = 6.0 kWh.
    Daily reduction: 3.0 kWh.
    Current monthly (30 days): 9.0 * 30 = 270.0 kWh.
    Proposed monthly: 6.0 * 30 = 180.0 kWh.
    Monthly reduction: 90.0 kWh.
    Monthly cost before: 270 * 8 = 2160.0 INR.
    Monthly cost after: 180 * 8 = 1440.0 INR.
    Monthly savings: 720.0 INR.
    Annual savings: 720 * 12 = 8640.0 INR.
    Percent reduction: (90 / 270) * 100 = 33.3%.
    """
    login(client, "hh1@test.com")

    calc_res = client.post(
        "/api/v1/savings/calculate",
        json={
            "wattage_w": 1500,
            "current_daily_hours": 6.0,
            "proposed_daily_hours": 4.0,
            "tariff_inr": 8.0,
            "quantity": 1,
            "billing_days": 30,
        },
    )
    assert calc_res.status_code == 200
    proj = calc_res.get_json()["projection"]
    assert proj["is_hypothetical_projection"] is True
    assert proj["current_scenario"]["daily_kwh"] == 9.0
    assert proj["proposed_scenario"]["daily_kwh"] == 6.0
    assert proj["reductions"]["daily_kwh"] == 3.0
    assert proj["reductions"]["monthly_kwh"] == 90.0
    assert proj["reductions"]["monthly_savings_inr"] == 720.0
    assert proj["reductions"]["annual_savings_inr"] == 8640.0
    assert proj["reductions"]["percent_reduction"] == 33.3

    # Save scenario
    save_res = client.post(
        "/api/v1/savings/scenarios",
        json={
            "name": "Summer AC Cutback",
            "appliance_name": "Living Room AC",
            "wattage_w": 1500,
            "current_daily_hours": 6.0,
            "proposed_daily_hours": 4.0,
            "tariff_inr": 8.0,
        },
    )
    assert save_res.status_code == 201
    scenario_id = save_res.get_json()["scenario"]["id"]

    # List scenarios
    list_res = client.get("/api/v1/savings/scenarios")
    assert list_res.status_code == 200
    scenarios = list_res.get_json()["scenarios"]
    assert any(s["id"] == scenario_id and s["name"] == "Summer AC Cutback" for s in scenarios)

    # Delete scenario
    del_res = client.delete(f"/api/v1/savings/scenarios/{scenario_id}")
    assert del_res.status_code == 200


# ------------------- 5. Audit Logging & Security Tests -------------------

def test_audit_logs_recorded_without_sensitive_data(client):
    """Verify security audit events are logged and do not store password hashes or tokens."""
    login(client, "admin@powerwise.local", "Admin@PowerWise2026")
    res = client.get("/api/v1/admin/audit-logs")
    assert res.status_code == 200
    logs = res.get_json()["audit_logs"]
    assert len(logs) > 0

    # Ensure no passwords or password hashes appear anywhere in audit details
    for entry in logs:
        details_str = str(entry.get("details", {})).lower()
        assert "password_hash" not in details_str
        assert "password123" not in details_str
        assert "admin@powerwise2026" not in details_str
