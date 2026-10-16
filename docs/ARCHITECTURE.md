# PowerWise — System Architecture & Engineering Design

## 1. High-Level Architecture Overview

PowerWise is designed as a modular, layered analytics platform combining modern web interfaces with scalable Big Data batch processing pipelines.

```
+------------------------------------------------------------------+
|                    CLIENT LAYER (Browser)                        |
|   React 19 + TanStack Router + Tailwind CSS + Recharts           |
|   - Mandatory Session Auth & RBAC State Protection               |
|   - Dynamic Aggregation & KPI Dashboards                         |
|   - Interactive What-If Bill Estimator                           |
|   - Tableau-Ready Sanitized CSV Export                           |
+---------------------------------+--------------------------------+
                                  |
                   HTTPS / JSON REST API (/api/v1)
                   (Session Cookies: HttpOnly, SameSite=Lax)
                                  |
+---------------------------------v--------------------------------+
|                    APPLICATION & API LAYER                       |
|   Python 3.12 + Flask API                                        |
|   - Blueprint Routing (/auth, /appliances, /datasets, etc.)      |
|   - Password Hashing (Werkzeug PBKDF2/scrypt)                    |
|   - Role-Based Access Control (Admin vs Regular User)            |
|   - Deterministic Energy Formulas                                |
|   - CSV Ingestion, Parsing & Validation Engine                   |
+-------------------+------------------------------+---------------+
                    |                              |
                    v                              v
+-------------------+--------------+   +-----------+---------------+
|          STORAGE LAYER           |   |     BIG DATA ENGINE       |
|  - MongoDB (when available)      |   |  - Hadoop Streaming       |
|  - Local Persistent JSON Storage |   |    (mapper.py / reducer.py|
|    (zero-setup fallback)         |   |  - Apache Spark / PySpark |
|  - Uploaded Canonical CSV Store  |   |    (DataFrame aggregation)|
|  - HDFS Connector (when env      |   |  - PySpark MLlib          |
|    configured)                   |   |    (KMeans k=3 clustering)|
+----------------------------------+   +---------------------------+
```

---

## 2. Security and RBAC Model

1. **Mandatory Server Authentication**:
   - Every protected route requires a verified session cookie or Bearer token.
   - Passwords are encrypted before database insertion using standard secure hashing (Werkzeug).
   - Sensitive fields (`password_hash`, internal sessions) are filtered from all API responses.

2. **Role-Based Access Control (RBAC)**:
   - **User**: Can view dashboards, calculate appliance footprints, upload datasets, and run personal processing jobs. Cannot access other users' data or the administrative panel.
   - **Admin**: Has full access, including system health telemetry, user management, and global job queues via `/admin`.
   - Ownership checks are enforced on the backend by verifying `owner_id == g.current_user["id"]`.

3. **CSV Formula Injection Prevention**:
   - When generating CSV exports for spreadsheet applications or Tableau, cells starting with arithmetic operators (`=`, `+`, `-`, `@`) are prepended with an apostrophe `'` to prevent remote command execution or macro exploitation.

---

## 3. Big Data Processing Strategy

1. **MapReduce Aggregation**:
   - `bigdata/mapreduce/mapper.py` reads streaming stdin records and emits `(household_id \t energy_kwh)`.
   - `bigdata/mapreduce/reducer.py` computes total energy consumption without loading all records into memory.
   - Runnable locally via UNIX/PowerShell pipes (`mapper.py | sort | reducer.py`) or on Hadoop Streaming clusters.

2. **Apache Spark & PySpark**:
   - Enforces explicit `StructType` schemas on CSV files.
   - Cleans dirty records (negative values, missing timestamps) and reports rejected row counts.
   - Performs distributed in-memory aggregations across executors and only returns compact JSON aggregates to the API.

3. **K-Means Clustering**:
   - Aggregates historical readings into a household feature vector: `[Average Daily kWh, Monthly kWh]`.
   - Uses PySpark MLlib `KMeans` with a fixed random seed (42).
   - Dynamically sorts arbitrary cluster centroids into explainable tiers: **Low**, **Medium**, and **High**.

4. **Truthful Execution & Status Mode**:
   - If Hadoop or PySpark is not installed on the host machine, the engine executes clean, documented local Python streams and tags results as `Local demo (PySpark not installed)`.
   - HDFS status explicitly shows `HDFS unavailable — using local dataset storage` when Hadoop is not running.
