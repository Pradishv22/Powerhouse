PowerWise — Product & Engineering Specification
Project: PowerWise — Smart Electricity Consumption Analyzer Using Big Data Technologies
Purpose: Upgrade the existing Lovable-generated frontend into a functional, explainable college project that demonstrates Big Data Essentials concepts.
Target tool: Google Antigravity (work from the existing extracted Lovable project; do not regenerate from scratch).
Priority: Working end-to-end flows, mandatory login, understandable code, truthful Big Data implementation, and a polished demo.
1. Instructions to Antigravity
1. Inspect the existing repository first. Read package.json, src/routes, src/components/AppShell.tsx, src/data/mockData.ts, src/services/api.ts, src/utils, and the existing tests before editing.
2. Preserve the existing visual design and working pages. The project currently uses React, TypeScript, Vite, TanStack Start/Router, Tailwind CSS, shadcn-style UI components, Recharts, and Lucide React. Continue using these technologies unless a concrete compatibility issue requires a change.
3. Do not replace the project with a new starter, do not convert it to a different router, and do not remove existing functionality just to simplify implementation.
4. Add features incrementally. Keep components, functions, and naming beginner-friendly. Avoid unnecessary abstractions, microservices, Redux, Kubernetes, and other infrastructure not needed for this project.
5. Login is mandatory. Protect the application pages and implement real server-side authentication if a backend is created. Do not implement fake authentication that only hides pages in the browser.
6. Do not claim Hadoop, MapReduce, Spark, PySpark, or K-means has run when the result is only hardcoded sample data. Every result must be labelled Demo, Processing, Completed, or Failed based on its actual source/status.
7. Before completion, run the available lint, test, and build commands; fix errors introduced by the changes. Report any command that could not be run and why.
2. Product Goal
PowerWise helps a household or an administrator understand electricity consumption records, estimate electricity expenditure, compare appliance usage, discover consumption patterns, and produce energy-saving insights.
The academic focus is to demonstrate:
- Big Data fundamentals and a data-processing pipeline.
- HDFS as a distributed storage concept and, where the environment supports it, actual HDFS storage.
- MapReduce using mapper/reducer logic, preferably with a runnable Hadoop Streaming job.
- Apache Spark / PySpark for actual aggregation and data processing.
- K-means clustering for grouping household consumption patterns.
- Visual analytics in the PowerWise dashboard and exportable data suitable for Tableau.
This is a historical-data analytics application, not a live smart-meter or IoT product. Do not imply live meter connectivity.
3. Existing Frontend — Keep and Upgrade
The existing frontend already includes these routes/pages:
- / — Dashboard
- /analytics — Consumption Analytics
- /appliances — Appliance Analysis
- /big-data — Big Data Processing
- /clustering — Consumption Clustering
- /bill-estimator — Bill Estimator
- /recommendations — Energy-Saving Recommendations
- /reports — Reports
Preserve the existing page structure, charts, responsive shell, visual language, and reusable UI components. Improve and connect them rather than rebuilding unnecessarily.
The repository currently appears to use TypeScript/TSX, TanStack Router/Start, Vite, Tailwind CSS, Recharts, Lucide React, and a local mock data module. Use the installed dependencies where possible.
4. Recommended Architecture
Use a simple layered architecture:
Browser
  React + existing TanStack routes + Recharts
              |
              | HTTPS / JSON REST API
              v
Python Flask API
  Authentication + validation + business logic
       |              |                 |
       v              v                 v
  MongoDB         Analytics service    CSV import/export
  (app records)   (Python / PySpark)   (validated files)
                         |
                 +-------+--------+
                 |                |
              PySpark         Hadoop/HDFS
          aggregation +       historical file
          K-means MLlib       storage (when available)
Important implementation choice: Flask is the planned backend because it is straightforward to explain and integrates naturally with Python data-processing libraries. Use MongoDB for application records if it is available and configured. Use environment variables for connection strings and secrets. Do not hardcode credentials.
Execution environments: Hadoop/HDFS and Spark may not be installed on a normal student laptop. Implement real runnable scripts and a clear adapter/status model. If a service is unavailable, show a clear unavailable status and allow a clearly labelled local-demo analytics mode. Never report a demo-mode result as a real distributed job.
5. Mandatory Authentication and RBAC
5.1 Authentication
Login is required before users can access the dashboard or any analytics page.
Implement:
- /login page with email and password.
- /register page with name, email, password, and password confirmation.
- Logout action in the application shell/profile menu.
- Session persistence across page refreshes.
- A protected-route mechanism that redirects unauthenticated users to /login and returns them to their intended page after login.
- Clear validation and error messages without leaking sensitive information.
- Password hashing on the server using a standard secure password-hashing library (e.g. Werkzeug password hashing or Argon2/bcrypt).
- Server-managed session cookies using HttpOnly, SameSite, and Secure in production. Do not store raw passwords or long-lived auth tokens in localStorage.
- Login rate limiting or a simple brute-force protection strategy if feasible.
- Environment variables for SECRET_KEY, database URI, and other secrets. Provide .env.example with placeholders only.
If no backend has been configured yet, create a clearly identified development-only mock auth mode that is disabled by default in production. Do not present it as secure real authentication.
5.2 RBAC (Role-Based Access Control)
Use only two roles; avoid unnecessary role complexity:
User
- View the dashboard, analytics, appliances, estimator, recommendations, and reports.
- Manage their own appliances and uploaded consumption datasets.
- Run permitted analysis jobs on datasets they own.
- View and export their own reports.
Admin
- All user permissions.
- View a minimal administration page with user count, dataset/job status, and system health.
- View job metadata and failure status across users, but do not expose passwords or session secrets.
- Manage demo datasets and review failed jobs.
Enforce role and ownership checks on the backend, not just by hiding frontend navigation. Every appliance, dataset, report, and analysis job must be associated with an owner or have an explicit shared-demo designation. A user must never read or modify another user's private records by changing an ID in the URL/API request.
Seed no universal production admin password. If a development admin seed is provided, require environment variables and document that it is for local development only.
6. Core Functional Requirements
6.1 Dashboard
Keep the existing KPI cards and charts. All metrics must be computed from the current user's selected dataset or clearly labelled sample data.
Display:
- Total consumption (kWh).
- Estimated electricity cost (₹).
- Average daily consumption.
- Highest-consumption appliance.
- Period-over-period change.
- Number of households/records in the selected dataset where applicable.
- Daily/monthly charts and appliance breakdown.
- Dataset and analytics status indicators.
Do not hardcode contradictory numbers across cards and charts. Use a single aggregation/data service to produce dashboard metrics.
6.2 Consumption Analytics
- Filters for date range and aggregation period (daily, weekly, monthly).
- Total, average, minimum, maximum, and period comparison.
- Appliance and household filters where data supports them.
- Empty/loading/error states.
- Filters must update charts and summary metrics together.
- Validate date ranges and explain when no data matches the selected range.
6.3 Appliance Management
Fields:
- Appliance name and category.
- Rated wattage (positive number).
- Average daily usage hours (0–24).
- Optional quantity.
Formulas:
Daily energy (kWh) = wattage (W) × daily usage hours × quantity / 1000
Monthly energy (kWh) = daily energy × number of days in selected period
Estimated cost (₹) = energy (kWh) × user-selected tariff (₹/kWh)
- Create, read, update, and delete appliances owned by the logged-in user.
- Confirm before deletion.
- Validate numeric values and show helpful messages.
- Ensure all derived values update immediately after a successful operation.
- If actual measured consumption exists, distinguish it from estimated consumption derived from wattage and usage hours.
6.4 Bill Estimator
- Inputs: consumption in kWh and tariff per kWh.
- Show estimated monthly, daily-average, and annualized cost.
- Formula: estimated energy charge = units × tariff.
- Label the result as an estimate; explain that real tariffs may include slabs, fixed charges, taxes, and subsidies.
- Do not imply the calculator is an official utility bill.
6.5 Recommendations
Use explainable, rule-based recommendations for the first version. Each recommendation should show:
- Trigger/reason (e.g. an appliance contributes a high share of total estimated consumption).
- Recommended action.
- Estimated potential saving, clearly marked as an estimate.
- Difficulty and impact level.
Do not invent precise savings percentages without a stated assumption. Make the rule/assumption visible in a details tooltip or explanation.
6.6 Reports and CSV
- Generate report summaries from the selected dataset and date range.
- CSV export must contain the data currently selected by the user, not an unrelated hardcoded array.
- Sanitize exported fields to reduce CSV formula-injection risk (cells beginning with =, +, -, or @).
- Provide a clear success/error message for import/export.
- Keep output compatible with later Tableau analysis.
7. Big Data Dataset Contract
Support CSV import for historical electricity records. Validate file size, extension/content, required headers, row count, and numeric ranges. Reject malformed records with a downloadable or visible error summary. Do not execute arbitrary uploaded content.
Recommended canonical fields:
record_id, household_id, timestamp, appliance_name, category,
wattage_w, usage_hours, energy_kwh, tariff_per_kwh
Rules:
- household_id is a pseudonymous identifier, not a real person's name or address.
- timestamp must be parseable and normalized consistently.
- wattage_w must be greater than zero when supplied.
- usage_hours must be between 0 and 24 for a daily record.
- If energy_kwh is missing but wattage and usage hours exist, calculate it using wattage_w × usage_hours / 1000 and mark it as calculated.
- Do not silently accept negative or impossible readings.
- Store dataset owner, filename, row count, upload timestamp, processing status, and validation summary.
Provide a small sample CSV and a data dictionary for demonstrations. Label synthetic/sample data clearly.
8. MapReduce — Actual Explainable Implementation
Provide a simple mapper and reducer that can be run locally using standard input/output and used with Hadoop Streaming when Hadoop is configured.
Recommended first job: total energy consumption by household or appliance.
Mapper concept:
- Read each validated CSV row.
- Emit a key (e.g. household ID) and numeric energy value.
Reducer concept:
- Read grouped keys and values.
- Sum values for each key.
- Emit aggregated totals.
Requirements:
- Include comments explaining each step in simple terms.
- Provide a small test input and expected output.
- Handle header rows and invalid rows safely; report skipped records to stderr/logs, not into the result stream.
- Document the command to run locally and the Hadoop Streaming command for a configured Hadoop environment.
- Do not describe a local Python run as a distributed Hadoop run. UI must show which execution mode was used.
9. PySpark Analytics
Provide a Python analytics module that can run with PySpark when installed/configured.
Required operations:
1. Read validated CSV data.
2. Apply an explicit schema or validate columns and data types.
3. Remove/reject invalid rows with counts reported.
4. Calculate daily, monthly, appliance-wise, and household-wise energy totals.
5. Return compact JSON-compatible aggregates for the API/dashboard.
6. Include a small test dataset and documented run command.
Avoid collecting a massive raw dataset to the driver. Aggregate in Spark first, and only return appropriately sized summaries to the Flask API.
The frontend must show job states: Queued, Running, Completed, Failed, or Unavailable. Store job metadata including job ID, requesting user, dataset ID, operation, execution mode, start/end time, status, and a safe error summary. Never expose internal secrets or stack traces to ordinary users.
If Spark is unavailable, provide a small local Python fallback only for demonstration-sized files. Clearly identify the execution mode as Local demo, not Spark.
10. K-means Clustering
Use actual pyspark.ml.clustering.KMeans when Spark MLlib is configured. Cluster households using numeric, explainable features such as:
- Average daily kWh.
- Monthly kWh.
- Peak-to-average consumption ratio, if valid data exists.
Implementation rules:
- Aggregate data to one row per household before clustering.
- Scale/normalize features if their ranges differ materially.
- Set a fixed random seed for repeatable classroom demonstrations.
- Validate that there are enough valid households for the selected k.
- Return cluster assignments and cluster-centroid summaries.
- Explain that cluster IDs (0, 1, 2, etc.) are arbitrary; assign human-readable labels such as low/medium/high only after sorting clusters by a stated consumption metric.
- Do not label a household wasteful solely because it belongs to the high-consumption cluster.
- Display the algorithm, features, number of records, cluster count, execution mode, and run status.
If PySpark is not available, use a clearly labelled simulated example or a small, documented local fallback. Never present simulated clusters as a real trained model result.
11. HDFS and Processing Status
- Provide a Big Data page explaining the pipeline: CSV ingestion → validation → HDFS (when available) → MapReduce/PySpark → aggregated API results → charts/reports.
- If configured, use HDFS paths with safe generated dataset identifiers; never use unsanitized user filenames directly as paths.
- If HDFS is not configured, show HDFS unavailable — using local dataset storage and explain this in the interface.
- Distinguish the concepts of HDFS storage, Hadoop MapReduce execution, Spark processing, and frontend visualization.
- Do not show fake storage capacity, distributed worker counts, completed job counts, or live system metrics. Unknown values should display Not configured or —.
12. Backend API Contract
Use versioned REST endpoints under /api/v1. Return consistent JSON and HTTP status codes. Suggested endpoints:
Authentication
- POST /api/v1/auth/register
- POST /api/v1/auth/login
- POST /api/v1/auth/logout
- GET /api/v1/auth/me
Appliances
- GET /api/v1/appliances
- POST /api/v1/appliances
- GET /api/v1/appliances/<id>
- PATCH /api/v1/appliances/<id>
- DELETE /api/v1/appliances/<id>
Datasets and analytics
- POST /api/v1/datasets — upload and validate CSV.
- GET /api/v1/datasets — list only accessible datasets.
- GET /api/v1/datasets/<id> — metadata and validation report.
- GET /api/v1/analytics/summary
- GET /api/v1/analytics/consumption
- POST /api/v1/analytics/jobs — start an allowed processing job.
- GET /api/v1/analytics/jobs/<job_id> — job status/result metadata.
- GET /api/v1/reports/export.csv
Admin and health
- GET /api/v1/admin/overview — admin only.
- GET /api/v1/health — non-sensitive service status.
The exact routes may be adjusted to match the final code, but keep the API documented and consistent. Every endpoint that returns private data must enforce authentication, role, and ownership checks on the server.
Use a consistent error shape, for example:
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Usage hours must be between 0 and 24."
  }
}
Do not return secrets, password hashes, raw stack traces, or another user's data.
13. Suggested Backend Data Models
Use simple models/collections with timestamps and ownership fields.
User
- id, name, normalized email, password_hash, role, created_at, updated_at, is_active.
Appliance
- id, owner_id, name, category, wattage_w, daily_usage_hours, quantity, created_at, updated_at.
Dataset
- id, owner_id, filename, storage_mode, row_count, validation_summary, status, created_at.
AnalysisJob
- id, owner_id, dataset_id, operation, engine, execution_mode, status, started_at, completed_at, result_summary, safe_error_message.
ConsumptionRecord (optional if records are stored in MongoDB rather than only as files)
- id, owner_id, dataset_id, household_id, timestamp, appliance_name, energy_kwh, source.
Never store passwords in plain text. Avoid duplicating all raw CSV rows in MongoDB if they can remain in file storage and be processed by Spark.
14. Security and Reliability
- Validate all input on both client and server.
- Restrict upload size and allowed CSV structure.
- Use secure password hashing and session handling.
- Apply backend authorization checks to every private resource.
- Configure CORS to trusted frontend origins only.
- Use CSRF protection when cookie-based authentication requires it.
- Use environment variables for secrets and database credentials.
- Do not commit .env files or credentials.
- Sanitize user-controlled text in UI and exports.
- Add sensible request timeouts and avoid running expensive jobs synchronously inside a web request. For a student-scale implementation, a simple background worker/process abstraction is acceptable; document its limitations.
- Log operational details without passwords, session cookies, tokens, or private raw data.
15. Beginner-Friendly Code and Viva Explainability
This is a college project. Every important module must be explainable in plain language.
Requirements:
- Keep functions short and use meaningful names.
- Add concise comments to non-obvious calculations and processing steps.
- Include docs/ARCHITECTURE.md describing the architecture and data flow.
- Include docs/VIVA_GUIDE.md with simple explanations of the stack, authentication, RBAC, HDFS, MapReduce, Spark, PySpark, K-means, and the limitations of the implementation.
- Include docs/API.md listing endpoints, inputs, outputs, and example requests.
- Include a dataset data dictionary and a sample CSV.
- Include a README.md with setup, environment variables, frontend/backend startup, tests, and troubleshooting.
- Explain which components are truly implemented, which require Hadoop/Spark configuration, and which are demo fallbacks.
Do not add fake AI claims. This project uses deterministic energy formulas, data aggregation, and K-means clustering; it does not need a generative AI model.
16. Testing and Acceptance Criteria
The upgrade is complete only when the following are verified or clearly reported as blocked by missing environment services:
Frontend
- All existing routes still render.
- Login/register pages work with the configured backend.
- Unauthenticated users cannot access protected routes.
- Logout ends the session.
- Navigation and mobile layout work.
- Dashboard charts and KPI values derive from the same selected dataset.
- Appliance add/edit/delete and bill estimation validations work.
- Date filters change the displayed analytics.
- CSV export exports the selected records and is safely formatted.
- Loading, empty, unavailable, and error states are visible and truthful.
Backend/security
- Registration rejects duplicate emails.
- Passwords are hashed.
- Login/logout/session persistence work.
- User role and record ownership are enforced server-side.
- A user cannot access another user's appliance, dataset, report, or job by guessing an ID.
- Invalid CSVs are rejected with useful validation details.
- API returns consistent error codes and status codes.
Big Data
- Mapper/reducer can be run against sample input and match documented expected output.
- PySpark aggregation script runs when Spark is installed and configured.
- K-means validates its input and reports the chosen features and cluster count.
- Demo fallback is explicitly distinguished from actual Hadoop/Spark execution.
- Tableau-ready CSV output has a documented schema.
Project quality
- Run npm run lint, npm test, and npm run build if those scripts exist.
- Add Python tests for energy formulas, CSV validation, mapper/reducer logic, API authorization, and aggregation where practical.
- Do not claim tests passed unless they were actually run. Summarize the commands and results.
17. Implementation Order
Implement in this order to minimize breakage:
1. Audit the existing code and create a brief change plan.
2. Preserve and verify the existing frontend build.
3. Add login/register UI and protected frontend routing.
4. Implement Flask authentication, session handling, and RBAC.
5. Connect the existing frontend to the API through a centralized service module.
6. Implement user-owned appliance CRUD and calculations.
7. Implement dataset upload, validation, metadata, and CSV export.
8. Implement and test the local MapReduce mapper/reducer.
9. Implement PySpark aggregations and actual K-means with clear service-availability handling.
10. Connect analytics and clustering pages to API results and job statuses.
11. Add admin overview, documentation, and tests.
12. Run lint/tests/build, fix regressions, and produce a final status report.
Do not attempt to install or configure a full Hadoop cluster automatically if the environment does not support it. Provide reproducible instructions and a truthful unavailable state instead.
18. Final Delivery Requirements
Work directly in the existing Lovable-generated repository. Do not return a separate replacement frontend or overwrite the original design without reason.
At the end, report:
- Files created or modified.
- Features that are fully working.
- Features requiring local environment configuration.
- Exact commands to run frontend and backend.
- Environment variables needed (names only; no real secrets).
- Tests actually executed and their results.
- Which Big Data operations ran locally, which ran through Hadoop/Spark, and which remain simulated/unavailable.
- Any known limitations.
Definition of success: PowerWise has mandatory login, server-enforced User/Admin roles, functional electricity analytics, explainable Big Data processing, truthful job statuses, and documentation that allows a student to explain how each part works without claiming features that are not imp