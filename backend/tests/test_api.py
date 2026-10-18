import pytest
from io import BytesIO
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
    # Clean temporary registration users if present
    db.users.delete_one({"email": "new_student@college.edu"})
    db.users.delete_one({"email": "alex.dev@gmail.com"})
    db.users.delete_one({"email": "sarah.personal@outlook.com"})
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


def test_cors_lan_preflight(client):
    """Verify that LAN IP origins like 192.168.x.x receive CORS headers."""
    res = client.options(
        "/api/v1/auth/login",
        headers={
            "Origin": "http://192.168.31.104:8080",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "Content-Type",
        },
    )
    assert res.status_code == 200
    assert res.headers.get("Access-Control-Allow-Origin") == "http://192.168.31.104:8080"
    assert res.headers.get("Access-Control-Allow-Credentials") == "true"


def test_personal_email_registration_and_login(client):
    """Verify normal personal emails (Gmail, Outlook, Yahoo) register and log in smoothly without college restriction."""
    # Register with standard Gmail
    reg_payload = {
        "name": "Alex Developer",
        "email": "alex.dev@gmail.com",
        "password": "SecurePassword123!",
        "confirm_password": "SecurePassword123!",
    }
    res = client.post("/api/v1/auth/register", json=reg_payload)
    assert res.status_code == 201
    data = res.get_json()
    assert data["user"]["email"] == "alex.dev@gmail.com"
    assert "password_hash" not in data["user"]
    assert "token" in data

    # Prevent duplicate registration
    res_dup = client.post("/api/v1/auth/register", json=reg_payload)
    assert res_dup.status_code == 409

    # Login with personal email
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": "alex.dev@gmail.com", "password": "SecurePassword123!"},
    )
    assert login_res.status_code == 200
    assert login_res.get_json()["user"]["name"] == "Alex Developer"

    # Verify session with /me
    me_res = client.get("/api/v1/auth/me")
    assert me_res.status_code == 200
    assert me_res.get_json()["user"]["email"] == "alex.dev@gmail.com"

    # Logout
    logout_res = client.post("/api/v1/auth/logout")
    assert logout_res.status_code == 200

    # /me should now fail after logout
    me_after = client.get("/api/v1/auth/me")
    assert me_after.status_code == 401


def test_auth_validation_failures(client):
    """Test validation edge cases: invalid email format, short password, mismatched confirmation."""
    # Invalid email
    res1 = client.post(
        "/api/v1/auth/register",
        json={"name": "Test", "email": "not-an-email", "password": "Password123!", "confirm_password": "Password123!"},
    )
    assert res1.status_code == 400

    # Short password
    res2 = client.post(
        "/api/v1/auth/register",
        json={"name": "Test", "email": "valid@domain.com", "password": "123", "confirm_password": "123"},
    )
    assert res2.status_code == 400

    # Mismatched passwords
    res3 = client.post(
        "/api/v1/auth/register",
        json={"name": "Test", "email": "valid@domain.com", "password": "Password123!", "confirm_password": "Different!"},
    )
    assert res3.status_code == 400

    # Invalid login password
    res_bad_pw = client.post(
        "/api/v1/auth/login",
        json={"email": "student@college.edu", "password": "WrongPassword!"},
    )
    assert res_bad_pw.status_code == 401


def test_rbac_admin_protection(client):
    # User cannot access admin overview
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

    appliance_id = created["id"]
    update_res = client.patch(
        f"/api/v1/appliances/{appliance_id}",
        json={"name": "Updated Study AC", "wattage_w": 1200, "daily_usage_hours": 4, "quantity": 2},
    )
    assert update_res.status_code == 200
    assert update_res.get_json()["monthly_kwh"] == 288.0

    # A fresh request proves the local JSON/Mongo storage update persisted.
    persisted = client.get("/api/v1/appliances").get_json()["appliances"]
    assert any(a["id"] == appliance_id and a["name"] == "Updated Study AC" for a in persisted)

    delete_res = client.delete(f"/api/v1/appliances/{appliance_id}")
    assert delete_res.status_code == 200
    after_delete = client.get("/api/v1/appliances").get_json()["appliances"]
    assert all(a["id"] != appliance_id for a in after_delete)


def test_dataset_crud_persists_and_removes_uploaded_file(client):
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": "student@college.edu", "password": "Password123!"},
    )
    assert login_res.status_code == 200

    csv = b"household_id,timestamp,appliance_name,energy_kwh\nH-1,2026-01-01T00:00:00Z,AC,2.5\n"
    upload_res = client.post(
        "/api/v1/datasets",
        data={"file": (BytesIO(csv), "usage.csv")},
        content_type="multipart/form-data",
    )
    assert upload_res.status_code == 201
    dataset = upload_res.get_json()["dataset"]
    dataset_id = dataset["id"]

    get_res = client.get(f"/api/v1/datasets/{dataset_id}")
    assert get_res.status_code == 200
    assert get_res.get_json()["dataset"]["row_count"] == 1

    rename_res = client.patch(f"/api/v1/datasets/{dataset_id}", json={"filename": "renamed-usage.csv"})
    assert rename_res.status_code == 200
    assert rename_res.get_json()["dataset"]["filename"] == "renamed-usage.csv"

    # Listing anew verifies the name was persisted, not only returned optimistically.
    listed = client.get("/api/v1/datasets").get_json()["datasets"]
    assert any(d["id"] == dataset_id and d["filename"] == "renamed-usage.csv" for d in listed)

    saved_path = dataset["saved_path"]
    assert __import__("os").path.exists(saved_path)
    delete_res = client.delete(f"/api/v1/datasets/{dataset_id}")
    assert delete_res.status_code == 200
    assert client.get(f"/api/v1/datasets/{dataset_id}").status_code == 404
    assert not __import__("os").path.exists(saved_path)


def test_analytics_and_clustering(client):
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": "student@college.edu", "password": "Password123!"},
    )
    assert login_res.status_code == 200

    # Summary
    summary_res = client.get("/api/v1/analytics/summary?tariff=8")
    assert summary_res.status_code == 200
    summary = summary_res.get_json()
    assert "total_consumption" in summary
    assert "avg_daily" in summary

    # Clusters
    cluster_res = client.get("/api/v1/analytics/clusters")
    assert cluster_res.status_code == 200
    clusters = cluster_res.get_json()
    assert "clusters" in clusters
    assert clusters["k"] == 3


def test_csv_export_formula_injection_protection(client):
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
