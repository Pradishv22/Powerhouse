# PowerWise REST API Documentation

Base URL: `/api/v1`  
Protocol: `HTTPS / JSON`  
Session Handling: `HttpOnly`, `SameSite=Lax` signed cookies or `Authorization: Bearer <token>`

---

## 1. Authentication Endpoints

### `POST /api/v1/auth/register`
Creates a new standard user account.
- **Request Body**:
  ```json
  {
    "name": "Alex Kumar",
    "email": "alex@college.edu",
    "password": "Password123!",
    "confirm_password": "Password123!"
  }
  ```
- **Response** (`201 Created`):
  ```json
  {
    "message": "Registration successful.",
    "user": {
      "id": "uuid-v4",
      "name": "Alex Kumar",
      "email": "alex@college.edu",
      "role": "user",
      "created_at": "2026-10-16T15:00:00Z",
      "is_active": true
    },
    "token": "uuid-v4"
  }
  ```

### `POST /api/v1/auth/login`
Authenticates a user and establishes an HTTP session.
- **Request Body**:
  ```json
  {
    "email": "alex@college.edu",
    "password": "Password123!"
  }
  ```
- **Response** (`200 OK`):
  ```json
  {
    "message": "Login successful.",
    "user": {
      "id": "uuid-v4",
      "name": "Alex Kumar",
      "email": "alex@college.edu",
      "role": "user"
    },
    "token": "uuid-v4"
  }
  ```

### `POST /api/v1/auth/logout`
Terminates the current session.
- **Response** (`200 OK`): `{"message": "Logged out successfully."}`

### `GET /api/v1/auth/me`
Returns current authenticated user details. Requires session.

---

## 2. Appliance Management

### `GET /api/v1/appliances`
Lists all appliances owned by the authenticated user.
- **Query Params**: `tariff` (float, default: `8.0`)
- **Response** (`200 OK`):
  ```json
  {
    "appliances": [
      {
        "id": "app-01",
        "name": "Air conditioner",
        "category": "Cooling",
        "wattage_w": 1500.0,
        "daily_usage_hours": 6.0,
        "quantity": 1,
        "daily_kwh": 9.0,
        "monthly_kwh": 270.0,
        "estimated_monthly_cost": 2160.0,
        "share_percent": 38.5
      }
    ],
    "total_monthly_kwh": 701.0,
    "total_estimated_monthly_cost": 5608.0,
    "tariff": 8.0
  }
  ```

### `POST /api/v1/appliances`
Adds a new appliance owned by the user.
- **Request Body**:
  ```json
  {
    "name": "Water heater",
    "category": "Heating",
    "wattage_w": 2000,
    "daily_usage_hours": 1.5,
    "quantity": 1
  }
  ```

### `DELETE /api/v1/appliances/<id>`
Deletes user-owned appliance. Returns 403 if appliance belongs to another user.

---

## 3. Datasets & Big Data Analytics

### `POST /api/v1/datasets`
Multipart form upload of canonical electricity CSV.
- **Form Data**: `file`: CSV file
- **Validation**: Checks headers, numeric bounds (0-24 hours), non-negative energy.

### `GET /api/v1/analytics/summary`
Unified KPI dashboard metrics computed from selected dataset.
- **Query Params**: `dataset_id`, `tariff`
- **Response**:
  ```json
  {
    "total_consumption": 2450.0,
    "expenditure": 19600.0,
    "avg_daily": 81.7,
    "highest_appliance": "Air conditioner",
    "period_change": -4.2,
    "households": 5,
    "potential_savings": 15,
    "efficiency_score": 78,
    "execution_mode": "Local demo (Flask Analytics Engine)"
  }
  ```

### `POST /api/v1/analytics/jobs`
Triggers a MapReduce aggregation or PySpark MLlib K-means clustering job.
- **Request Body**:
  ```json
  {
    "dataset_id": "demo-dataset-default",
    "operation": "clustering",
    "engine": "pyspark"
  }
  ```
- **Response**:
  ```json
  {
    "message": "Job completed successfully.",
    "job": {
      "id": "job-8f2a1b4c",
      "operation": "K-means Clustering",
      "execution_mode": "Local demo (PySpark not installed)",
      "status": "Completed",
      "started_at": "2026-10-16T15:20:00Z"
    }
  }
  ```

### `GET /api/v1/reports/export.csv`
Downloads Tableau-ready CSV export with formula injection prevention.

---

## 4. Administration & Health

### `GET /api/v1/admin/overview`
Requires `role: admin`. Returns system-wide telemetry, user count, dataset storage statistics, and job queues.

### `GET /api/v1/health`
Public health status reporting database mode, PySpark availability, and HDFS connectivity status.
