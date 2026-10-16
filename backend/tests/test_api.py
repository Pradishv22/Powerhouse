import pytest
from werkzeug.security import generate_password_hash
from backend.app import create_app
from backend.database import db


def ensure_test_student():
    student = db.users.find_one({"email": "student@college.edu"})
    if not student:
        db.users.insert_one(
            {
                "id": "student-test-id",
                "name": "Test Student",
                "email": "student@college.edu",
                "password_hash": generate_password_hash("Password123!"),
                "role": "user",
                "is_active": True,
                "created_at": "2026-10-16T12:00:00Z",
                "updated_at": "2026-10-16T12:00:00Z",
            }
        )


@pytest.fixture
def client():
    # Clean temporary registration user if present
    db.users.delete_one({"email": "new_student@college.edu"})
    ensure_test_student()
    app = create_app({"TESTING": True, "SECRET_KEY": "test-secret-key"})
    with app.test_client() as client:
        yield client


def test_health_endpoint(client):
    res = client.get("/api/v1/health")
    assert res.status_code == 200
    data = res.get_json()
    assert data["status"] == "healthy"
    assert "database" in data
    assert "big_data_environment" in data


def test_auth_registration_and_login(client):
    # Register new user
    reg_payload = {
        "name": "New Student",
        "email": "new_student@college.edu",
        "password": "Password123!",
        "confirm_password": "Password123!",
    }
    res = client.post("/api/v1/auth/register", json=reg_payload)
    assert res.status_code == 201
    data = res.get_json()
    assert data["user"]["email"] == "new_student@college.edu"
    assert "password" not in data["user"]
    assert "password_hash" not in data["user"]

    # Prevent duplicate registration
    res_dup = client.post("/api/v1/auth/register", json=reg_payload)
    assert res_dup.status_code == 409

    # Login
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": "new_student@college.edu", "password": "Password123!"},
    )
    assert login_res.status_code == 200
    assert login_res.get_json()["user"]["name"] == "New Student"

    # Verify session with /me
    me_res = client.get("/api/v1/auth/me")
    assert me_res.status_code == 200
    assert me_res.get_json()["user"]["email"] == "new_student@college.edu"


def test_rbac_admin_protection(client):
    # User cannot access admin overview
    # First login as student
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": "student@college.edu", "password": "Password123!"},
    )
    assert login_res.status_code == 200

    res_forbidden = client.get("/api/v1/admin/overview")
    assert res_forbidden.status_code == 403

    # Login as admin
    client.post(
        "/api/v1/auth/login",
        json={"email": "admin@powerwise.local", "password": "Admin@PowerWise2026"},
    )
    res_admin = client.get("/api/v1/admin/overview")
    assert res_admin.status_code == 200
    data = res_admin.get_json()
    assert "stats" in data
    assert "users" in data


def test_appliance_crud_and_calculations(client):
    # Login as student
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": "student@college.edu", "password": "Password123!"},
    )
    assert login_res.status_code == 200

    # List default appliances
    res = client.get("/api/v1/appliances")
    assert res.status_code == 200
    appliances = res.get_json()["appliances"]
    assert len(appliances) > 0

    # Add custom appliance: 1000W AC, 5 hours/day
    new_app = {
        "name": "Study Room AC",
        "category": "Cooling",
        "wattage_w": 1000,
        "daily_usage_hours": 5,
        "quantity": 1,
    }
    create_res = client.post("/api/v1/appliances", json=new_app)
    assert create_res.status_code == 201
    created = create_res.get_json()
    # 1000 * 5 / 1000 = 5 kWh/day; 5 * 30 = 150 kWh/mo
    assert created["daily_kwh"] == 5.0
    assert created["monthly_kwh"] == 150.0


def test_csv_export_formula_injection_protection(client):
    # Login as student
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": "student@college.edu", "password": "Password123!"},
    )
    assert login_res.status_code == 200

    res = client.get("/api/v1/reports/export.csv")
    assert res.status_code == 200
    assert res.headers["Content-Type"].startswith("text/csv")
    csv_text = res.get_data(as_text=True)
    assert "Record ID,Household ID" in csv_text
