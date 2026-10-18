# PowerWise — College Viva & Examination Guide

This comprehensive guide contains essential questions, concepts, and architectural explanations for college viva voce, project evaluations, and lab exams for:

**PowerWise — Smart Electricity Consumption Analyzer Using Big Data Technologies**

---

## 1. Project Fundamentals & The 5 Vs of Big Data

### Q1: What is PowerWise and what problem does it solve?
**Answer:** PowerWise is an academic and production-ready electricity consumption analytics platform designed to process historical household smart-meter readings. It computes energy costs, highlights high-draw appliances, groups household consumption patterns using K-means clustering, and demonstrates how Big Data frameworks (HDFS, MapReduce, Apache Spark) manage large-scale energy datasets.

### Q2: How does PowerWise align with the 5 Vs of Big Data?
**Answer:**
1. **Volume**: Smart-meter infrastructure logs readings across thousands of homes at regular intervals (e.g., hourly readings yield millions of rows annually). Traditional single-node databases struggle with aggregation at this scale; distributed systems like HDFS, MapReduce, and Spark are designed for scalable batch processing.
2. **Velocity**: While PowerWise is currently configured for historical batch datasets, smart meters in real-world grids emit telemetry continuously. PowerWise processes these batches efficiently using MapReduce key-value streaming and Spark in-memory transformations.
3. **Variety**: Consumption records arrive with structured and semi-structured fields: household IDs, ISO timestamps, appliance categories, wattage, and operating hours.
4. **Veracity**: Raw sensor data frequently contains anomalies, null values, or negative power readings. PowerWise enforces schema validation (via Python and PySpark `StructType`) and strips dirty records before analysis.
5. **Value**: The raw power measurements are converted into actionable intelligence: peak-load detection, appliance breakdown, tariff cost projections, and cluster grouping for energy efficiency recommendations.

### Q3: Is PowerWise a real-time IoT or smart-meter streaming project?
**Answer:** No. PowerWise is explicitly a **historical data analytics platform**. It processes validated batch datasets (CSVs) using distributed processing abstractions. It does not claim live hardware sensor streaming unless such hardware is physically connected.

---

## 2. End-to-End Data Flow Pipeline

### Q4: Explain the complete PowerWise data pipeline.
**Answer:**
```
+---------------------------+
| Electricity CSV Datasets  |  Raw smart-meter readings (timestamps, kWh, appliances)
+-------------+-------------+
              |
              v
+---------------------------+
| Schema & Data Validation  |  Validates ranges (0-24 hrs, positive kWh), strips malformed rows
+-------------+-------------+
              |
              v
+---------------------------+
| Storage Tier              |  MongoDB (when available) OR Local JSON Fallback / HDFS
+-------------+-------------+
              |
              v
+---------------------------+
| Distributed Big Data      |  - Hadoop Streaming MapReduce (mapper.py | sort | reducer.py)
| Processing Engines        |  - Apache Spark / PySpark DataFrames (aggregations)
|                           |  - PySpark MLlib K-means (k=3 clustering with centroids)
+-------------+-------------+
              |
              v
+---------------------------+
| Flask REST API (/api/v1)  |  Session & RBAC authentication, CRUD, telemetry endpoints
+-------------+-------------+
              |
              v
+---------------------------+
| React Dashboard & Reports |  Interactive Recharts visualizer, What-If Estimator, Tableau CSV
+---------------------------+
```

---

## 3. Hadoop HDFS Distributed Storage

### Q5: What is HDFS and how is it utilized in PowerWise?
**Answer:**
- **HDFS (Hadoop Distributed File System)** stores massive files by splitting them into fixed-size blocks (default 128 MB) and distributing them across DataNodes with a replication factor (default 3) for fault tolerance.
- **In PowerWise:** When a Hadoop cluster is configured (`HDFS_NAMENODE_URL`), datasets are stored on HDFS. When Hadoop is not installed on the local computer, the system truthfully displays: `HDFS unavailable — using local dataset storage`.

### Q6: What are NameNode and DataNodes?
**Answer:**
- **NameNode (Master Node):** Maintains the metadata directory tree, maps file paths to block IDs, and tracks which DataNodes hold replicas of each block.
- **DataNode (Worker Node):** Stores the actual block bytes on local disks and periodically sends heartbeats and block reports to the NameNode.

---

## 4. Hadoop MapReduce Architecture

### Q7: How does MapReduce aggregate energy consumption in PowerWise?
**Answer:**
1. **Mapper (`bigdata/mapreduce/mapper.py`):** Reads CSV records from standard input (`stdin`), extracts the grouping key (`household_id`) and the metric (`energy_kwh`), and emits:
   `household_id \t energy_kwh`
   *Key concept:* The mapper does no aggregation; its sole responsibility is key extraction in parallel.
2. **Shuffle & Sort:** Hadoop's framework automatically sorts and groups emitted keys so all values for `Household_A` arrive together at the reducer.
3. **Reducer (`bigdata/mapreduce/reducer.py`):** Reads the sorted stream and computes a running total per household. Because records arrive pre-sorted by key, the Reducer does not need to load the entire dataset into RAM, making it scalable to gigabytes of data.

### Q8: How can you verify MapReduce locally without a Hadoop cluster?
**Answer:**
Using PowerShell pipes to simulate the Hadoop Streaming lifecycle:
```powershell
Get-Content bigdata/mapreduce/test_input.csv | python bigdata/mapreduce/mapper.py | Sort-Object | python bigdata/mapreduce/reducer.py
```
This produces identical output to `bigdata/mapreduce/expected_output.txt`.

---

## 5. Apache Spark & PySpark Analytics

### Q9: Why is Apache Spark faster than Hadoop MapReduce?
**Answer:**
| Feature | Hadoop MapReduce | Apache Spark / PySpark |
| :--- | :--- | :--- |
| **Storage Medium** | Disk-based (writes intermediate state to disk) | In-Memory (uses Resilient Distributed Datasets / DataFrames) |
| **Speed** | Slower for iterative algorithms | Up to 100x faster for repeated aggregations and ML |
| **Data Abstraction** | Key-Value pairs (`Mapper` & `Reducer`) | Structured DataFrames with Catalyst Optimizer |
| **Machine Learning** | Requires Apache Mahout | Native `pyspark.ml` library (e.g. `KMeans`, `StandardScaler`) |

### Q10: How does PowerWise handle machines where Apache Spark is not installed?
**Answer:**
PowerWise incorporates **graceful, explainable local fallback**:
- If `pyspark` is present, it uses Spark DataFrames and MLlib.
- If `pyspark` is absent, it executes equivalent clean Python streams and truthfully reports `execution_mode: "Local demo (PySpark not installed)"`. It never falsifies execution status.

---

## 6. Machine Learning: PySpark MLlib K-Means Clustering

### Q11: Why use K-means clustering for electricity analysis?
**Answer:**
K-means is an **unsupervised machine learning algorithm** used to discover natural grouping patterns among households without needing pre-labeled training data.

### Q12: What features are assembled for clustering?
**Answer:**
1. **Average Daily Consumption (kWh/day)**: Reflects appliance intensity and household size.
2. **Monthly Consumption (kWh/month)**: Reflects billing bracket.
3. **Peak-to-Average Ratio**: Identifies whether usage spikes during peak grid hours.

### Q13: Why are raw cluster indices (0, 1, 2) not labeled "Wasteful"?
**Answer:**
- In K-means, cluster indices `0, 1, 2` are arbitrary geometric centroids determined by initial random seeds (fixed seed `42` in PowerWise for reproducibility).
- PowerWise sorts cluster centroids by average consumption before mapping them to human-readable tiers: **Low**, **Medium**, and **High**.
- High consumption does not necessarily mean "wasteful" — it may reflect a larger family, necessary heating/cooling, or essential medical appliances.

---

## 7. Security, REST APIs, and Role-Based Access Control (RBAC)

### Q14: How is Role-Based Access Control (RBAC) enforced?
**Answer:**
PowerWise enforces two distinct roles on the backend:
1. **User**: Can access their personal dashboard, calculate appliance costs, upload datasets, and run personal jobs. Cannot access other users' data or the administrative panel.
2. **Admin**: Has all user permissions plus `/admin` to monitor registered users, system health, and global analytics queues.
- **Backend Ownership Enforcement:** Every data mutation checks `owner_id == g.current_user["id"]`. A regular user cannot read or delete another user's appliance by guessing the ID.

### Q15: How are passwords secured?
**Answer:** Passwords are hashed using Werkzeug's secure hashing algorithms (`generate_password_hash`, PBKDF2/scrypt). Raw passwords are never stored in plaintext or logged.

### Q16: What is CSV Formula Injection and how is it prevented?
**Answer:**
If an uploaded dataset contains fields starting with characters like `=`, `+`, `-`, or `@`, spreadsheet software (Excel, LibreOffice) might interpret them as executable macros or DDE commands. PowerWise prevents this during export by prefixing operator characters with a single quote (`'`).

### Q17: What are the mathematical formulas for energy calculations?
**Answer:**
- $\text{Daily Energy (kWh)} = \frac{\text{Wattage (W)} \times \text{Hours/Day} \times \text{Quantity}}{1000}$
- $\text{Monthly Energy (kWh)} = \text{Daily Energy} \times 30$
- $\text{Estimated Cost (₹)} = \text{Monthly Energy (kWh)} \times \text{Tariff Rate (₹/kWh)}$
- $\text{Bill Estimator}: \text{Cost} = \text{Units (kWh)} \times \text{Rate (₹/kWh)}$ (with explanation that actual utility bills may include tiered slabs, fixed charges, and taxes).
