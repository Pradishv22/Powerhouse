# PowerWise — Smart Electricity Consumption Analyzer Using Big Data Technologies

PowerWise is an academic and production-ready electricity consumption analytics platform that demonstrates Big Data essentials: **HDFS Distributed Storage**, **Hadoop Streaming MapReduce**, **Apache Spark / PySpark DataFrame Aggregations**, and **PySpark MLlib K-means Clustering** combined with a React TanStack dashboard.

---

## 1. Project Structure

```
PowerWise/
├── frontend/               # React 19 + TanStack Router/Start + Tailwind CSS + Recharts
│   ├── src/
│   │   ├── components/     # AppShell, UI components, UI kit
│   │   ├── routes/         # /, /analytics, /appliances, /big-data, /clustering,
│   │   │                   # /bill-estimator, /recommendations, /reports, /login, /register, /admin
│   │   ├── services/       # Centralized REST API client (api.ts)
│   │   └── lib/            # AuthContext and utilities
│   └── package.json
│
├── backend/                # Python 3.12 Flask REST API
│   ├── app.py              # Application factory & CORS
│   ├── config.py           # Environment settings
│   ├── database.py         # MongoDB connector with automatic local JSON fallback
│   ├── auth.py             # Password hashing, sessions, & RBAC decorators
│   ├── routes/             # Auth, Appliances, Datasets, Analytics, Reports, Admin, Health
│   └── tests/              # Pytest backend test suite
│
├── bigdata/                # Real, explainable Big Data processing scripts
│   ├── mapreduce/
│   │   ├── mapper.py       # Hadoop Streaming mapper (household_id -> energy_kwh)
│   │   ├── reducer.py      # Hadoop Streaming reducer (aggregates totals per household)
│   │   ├── test_input.csv  # Verified sample input
│   │   └── expected_output.txt
│   └── spark/
│       ├── spark_analytics.py   # PySpark DataFrame transformations and aggregation
│       └── spark_clustering.py  # PySpark MLlib KMeans clustering (k=3)
│
├── data/                   # Canonical sample datasets & data dictionary
│   ├── sample_electricity_records.csv
│   └── DATA_DICTIONARY.md
│
├── docs/                   # College presentation & viva documentation
│   ├── ARCHITECTURE.md     # Deep architecture, data flow & security design
│   ├── VIVA_GUIDE.md       # Q&A for college viva voce and lab exams
│   └── API.md              # REST API schema documentation
│
├── spec.md                 # Product & Engineering Specification
└── README.md
```

---

## 2. Quick Start Guide

### Prerequisites
- **Node.js**: v18+ (tested on Node v25)
- **Python**: 3.10+ (tested on Python 3.12)
- *(Optional)*: MongoDB, Hadoop, Apache Spark (the application runs smoothly with explainable local demo fallbacks if these are not installed).

---

### Step 1: Start the Python Flask Backend

1. Navigate to workspace root:
   ```powershell
   cd c:\Users\Pradish\OneDrive\Desktop\PowerWise
   ```
2. Install Python dependencies:
   ```powershell
   python -m pip install flask flask-cors pymongo pytest python-dotenv werkzeug
   ```
3. Run the Flask API server:
   ```powershell
   python -m backend.app
   ```
   *The server runs on `http://localhost:5000` with the API at `/api/v1`.*

---

### Step 2: Start the React Frontend

1. Navigate to the `frontend` folder:
   ```powershell
   cd frontend
   ```
2. Install dependencies (if not already done):
   ```powershell
   npm install
   ```
3. Start the development server:
   ```powershell
   npm run dev
   ```
   *Open `http://localhost:5173` or `http://localhost:3000` in your web browser.*

---

## 3. Demo Credentials (Viva & Classroom Testing)

PowerWise enforces **mandatory authentication** and **Role-Based Access Control (RBAC)**:

| Role | Email | Password | Permissions |
| :--- | :--- | :--- | :--- |
| **User (Student)** | `student@college.edu` | `Password123!` | Dashboard, personal appliances, reports, datasets, personal jobs |
| **Admin** | `admin@powerwise.local` | `Admin@PowerWise2026` | All user features + `/admin` system health, all jobs, user metrics |

*(You can also register a new account on the `/register` page).*

---

## 4. Running the Tests

### Frontend Tests (Vitest)
```powershell
cd frontend
npm test
```
*Executes all route matching and energy formula vitest suites.*

### Frontend Code Quality (ESLint)
```powershell
cd frontend
npm run lint
```
*Validates code against TypeScript and React linting rules.*

### Frontend Production Build
```powershell
cd frontend
npm run build
```
*Compiles the production SSR and client Nitro bundle.*

### Backend Tests (Pytest)
```powershell
python -m pytest backend/tests -v
```
*Tests health, registration, duplicate checks, RBAC admin protection, appliance CRUD, and formula-injection prevention.*

### Local MapReduce Verification
```powershell
Get-Content bigdata/mapreduce/test_input.csv | python bigdata/mapreduce/mapper.py | Sort-Object | python bigdata/mapreduce/reducer.py
```
*Matches `bigdata/mapreduce/expected_output.txt` exactly.*

---

## 5. College Viva Key Concepts

Read [`docs/VIVA_GUIDE.md`](file:///c:/Users/Pradish/OneDrive/Desktop/PowerWise/docs/VIVA_GUIDE.md) and [`docs/ARCHITECTURE.md`](file:///c:/Users/Pradish/OneDrive/Desktop/PowerWise/docs/ARCHITECTURE.md) for full explanations of:
- **HDFS**: Block partitioning (128 MB), NameNode vs DataNode, replication factor 3.
- **MapReduce**: Streaming mapper emitting `(household_id \t kWh)`, shuffle & sort, streaming reducer.
- **Spark vs MapReduce**: In-memory DataFrames vs disk-based key-value processing.
- **K-Means MLlib**: Clustering on `[avg_daily_kwh, monthly_kwh]`, fixed seed 42, centroid sorting into Low/Medium/High.
- **Security**: Password hashing, HttpOnly cookies, RBAC ownership checks, CSV formula-injection prevention.
