# PowerWise — Upgrade Audit & Verification Report

**Date of Audit:** October 17, 2026  
**System Platform:** Windows (Node.js v25.8.2, Python 3.12.0)  
**Project:** PowerWise — Smart Electricity Consumption Analyzer Using Big Data Technologies  

---

## 1. Executive Summary

This autonomous audit and upgrade was executed to resolve an API connection error, eliminate college-domain email restrictions, remove developer shortcuts and demo banners from the login view, connect all frontend routes to the Flask REST backend, and verify the Big Data syllabus pipelines (HDFS, MapReduce, Apache Spark, K-Means clustering).

All unit tests, lint checks, production builds, and Big Data verification scripts passed with 100% success.

---

## 2. Root Cause Analysis of the API Connection Error

### Observed Error
`Unable to reach PowerWise API at http://192.168.31.104:5000/api/v1`

### Root Causes Identified
1. **Flask-CORS Origin Whitelist Mismatch:**
   - In `backend/config.py`, `DEFAULT_CORS_ORIGINS` originally contained only `http://localhost:8080`, `http://127.0.0.1:8080`, `http://localhost:5173`, etc.
   - When Vite started, it bound to both `localhost:8080` and the local network interface `http://192.168.31.104:8080`.
   - Accessing the application via the network interface sent an `Origin: http://192.168.31.104:8080` header.
   - Because `192.168.31.104:8080` was not in Flask's `CORS_ORIGINS`, Flask-CORS responded to the browser's preflight `OPTIONS` request without the requisite `Access-Control-Allow-Origin: http://192.168.31.104:8080` and `Access-Control-Allow-Credentials: true` headers.
   - The browser's security model immediately blocked the subsequent request with `TypeError: Failed to fetch`.
2. **Brittle Hostname Resolution:**
   - In `frontend/src/services/api.ts`, `resolveDefaultApiBase()` mapped `window.location.hostname` directly to port 5000 without prioritizing `localhost` for same-machine development or attempting candidate fallback across localhost, 127.0.0.1, and LAN addresses upon encountering a connection failure.
3. **Environment Storage Incompatibility:**
   - Direct access to `window.localStorage` in test or SSR environments threw `TypeError: Cannot read properties of undefined` when `localStorage` was unconfigured in Node.js.

### Remediation Applied
- Added dynamic regex matching in `backend/config.py` and `backend/app.py` supporting `localhost`, `127.0.0.1`, and RFC1918 private network IPs (`192.168.*`, `10.*`, `172.16-31.*`) on any port.
- Updated `frontend/src/services/api.ts` with local storage URL override, localhost default for local development, and automatic candidate URL recovery.
- Wrapped all `localStorage` access in safe helper functions (`safeGetStorage`, `safeSetStorage`, `safeRemoveStorage`) that gracefully handle SSR and headless testing environments.

---

## 3. Login and Registration Page Redesign

### College Email Restriction Removal
- Standard email format validation (`^[^\s@]+@[^\s@]+\.[^\s@]+$`) is now enforced on both frontend and backend.
- Users can register with standard Gmail, Outlook, Yahoo, personal domain, or corporate emails.
- Removed `name@college.edu` placeholders and restrictions across the UI.

### Elimination of Public Demo / Viva Elements
- Completely removed the "Viva Demo Credentials" box and auto-fill buttons (`student@college.edu`, `admin@powerwise.local`) from `frontend/src/routes/login.tsx`.
- Removed displayed passwords and sample credentials from the public screen.
- Maintained the underlying Admin role, admin server authorization, and the `/admin` telemetry view.
- Development testing accounts are maintained exclusively via documented backend seeding (`backend/auth.py`).

### User Interface Modernization
- **Branding:** Centered PowerWise icon badge with energy amber styling and hover micro-interaction.
- **Headings:** Modern "Welcome back" heading with explanatory subtitle.
- **Form Controls:** Clean input fields with inline icons (Mail, Lock).
- **Show/Hide Password:** Interactive eye toggle (`Eye` / `EyeOff` from `lucide-react`) on both Login and Register views.
- **Loading State:** Disabled button with animated `Loader2` spinner during API roundtrips.
- **Inline Validation:** Clean, accessible alert banners for validation and server feedback.

---

## 4. End-to-End API Integration Status

| Route | Endpoint(s) | Real API Action | Fallback Strategy |
| :--- | :--- | :--- | :--- |
| **Login** | `POST /api/v1/auth/login` | Authenticates user, sets cookie & returns token | Clear error message on failure |
| **Register** | `POST /api/v1/auth/register` | Inserts user, hashes password, starts session | 409 Conflict check for duplicates |
| **Me / Auth Guard** | `GET /api/v1/auth/me` | Validates session on page load & refresh | Redirects unauthenticated users to `/login` |
| **Dashboard** | `GET /api/v1/analytics/summary` | Real KPI metrics (kWh, cost, efficiency) | Local calculation fallback |
| **Analytics** | `GET /api/v1/analytics/consumption` | Dynamic daily, weekly, monthly series & matrix | Canonical dataset fallback |
| **Appliances** | `GET, POST, DELETE /api/v1/appliances` | Full CRUD with ownership checks | Default appliances initialized for new users |
| **Big Data Pipeline**| `POST /api/v1/datasets`, `POST /api/v1/analytics/jobs` | File upload & MapReduce / Spark job runs | Truthful execution status display |
| **Clustering** | `GET /api/v1/analytics/clusters` | K-means results with centroids & sorted tiers | Seed 42 deterministic calculation |
| **Bill Estimator** | Client-side reactive | Energy formula $\text{kWh} \times \text{Rate}$ | Disclaimer on fixed charges/slabs |
| **Reports** | `GET /api/v1/reports/export.csv` | Sanitized CSV download preventing formula injection | In-browser CSV generator fallback |
| **Admin** | `GET /api/v1/admin/overview`, `/health` | Live telemetry, user list, job records | Forbidden (403) for regular users |

---

## 5. Big Data Syllabus Verification

### A. Hadoop Streaming MapReduce
- **Mapper (`bigdata/mapreduce/mapper.py`):** Emits `household_id \t energy_kwh`.
- **Reducer (`bigdata/mapreduce/reducer.py`):** Aggregates streaming totals per key without buffering whole datasets in RAM.
- **Local Test Output:**
  ```powershell
  Get-Content bigdata/mapreduce/test_input.csv | python bigdata/mapreduce/mapper.py | Sort-Object | python bigdata/mapreduce/reducer.py
  ```
  Matches `bigdata/mapreduce/expected_output.txt`:
  ```
  Household_A	3.60
  Household_B	6.80
  Household_C	0.50
  ```
- **Status:** Implemented and tested.

### B. Apache Spark & PySpark Aggregation
- **Script:** `bigdata/spark/spark_analytics.py`
- **Features:** Explicit `StructType` schema, data cleaning (filtering negative energy), DataFrame groupBy aggregations.
- **Execution Mode:** Auto-detects PySpark; if PySpark is absent, executes equivalent clean Python streams and truthfully reports `Local demo (PySpark not installed)`.
- **Status:** Implemented and tested.

### C. PySpark MLlib K-Means Clustering
- **Script:** `bigdata/spark/spark_clustering.py`
- **Features:** Feature assembly on `[avg_daily, monthly]`, fixed seed 42, centroid sorting into `Low`, `Medium`, `High`.
- **Status:** Implemented and tested.

### D. HDFS Distributed Storage
- **Configuration:** `HDFS_NAMENODE_URL` in `backend/config.py`.
- **Telemetry:** Displays actual cluster availability. When Hadoop is not present, reports `HDFS unavailable — using local dataset storage`.
- **Status:** Implemented and tested.

---

## 6. Verification Test Results

### Backend Pytest Suite
Command: `python -m pytest backend/tests -v`
```
backend/tests/test_api.py::test_health_endpoint PASSED                   [ 12%]
backend/tests/test_api.py::test_cors_lan_preflight PASSED                [ 25%]
backend/tests/test_api.py::test_personal_email_registration_and_login PASSED [ 37%]
backend/tests/test_api.py::test_auth_validation_failures PASSED          [ 50%]
backend/tests/test_api.py::test_rbac_admin_protection PASSED             [ 62%]
backend/tests/test_api.py::test_appliance_crud_and_calculations PASSED   [ 75%]
backend/tests/test_api.py::test_analytics_and_clustering PASSED          [ 87%]
backend/tests/test_api.py::test_csv_export_formula_injection_protection PASSED [100%]

============================== 8 passed in 3.39s ==============================
```

### Frontend Vitest Suite
Command: `npm test`
```
 ✓ src/utils/energyCalculations.test.ts (5 tests)
 ✓ src/test/app-routing.test.tsx (1 test)
 ✓ src/test/auth-routes.test.tsx (3 tests)

 Test Files  3 passed (3)
      Tests  9 passed (9)
```

### Frontend Code Quality (ESLint)
Command: `npm run lint`
```
✖ 9 problems (0 errors, 9 warnings)
```
*(0 errors, only Fast Refresh component export warnings).*

### Frontend Production Build
Command: `npm run build`
```
✓ built in 503ms
[nitro] √ Generated public .output/public
✓ built in 687ms
[nitro] √ You can preview this build using npx vite preview
```
*(Exit code 0).*

---

## 7. Modified & Created Files Summary

1. `backend/config.py`: Added RFC1918 private network regex and expanded allowed dev ports for Flask CORS.
2. `backend/tests/test_api.py`: Added personal email registration/login tests, LAN CORS preflight tests, validation edge case tests, clustering and analytics checks (8 passing tests).
3. `frontend/src/services/api.ts`: Added local storage configuration override, safe storage wrappers, candidate URL fallback recovery, and dynamic CSV export URL resolver.
4. `frontend/src/routes/login.tsx`: Redesigned login view removing demo buttons and college email restrictions; added password show/hide, loading states, and inline error handling.
5. `frontend/src/routes/register.tsx`: Updated registration view to accept all standard email domains; added password show/hide toggles.
6. `frontend/src/routes/analytics.tsx`: Connected time series and household/appliance matrix charts to live backend API.
7. `docs/API.md`: Updated API schemas and examples to reflect standard personal email support.
8. `docs/VIVA_GUIDE.md`: Comprehensive expansion covering 5 Vs of Big Data, complete data pipeline, HDFS, MapReduce, PySpark, K-means centroids, and security.
9. `README.md`: Updated with verified ports, LAN support, test execution instructions, and credential documentation.
10. `docs/UPGRADE_AUDIT_REPORT.md`: This comprehensive audit and verification report.
