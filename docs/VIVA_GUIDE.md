# PowerWise — College Viva & Examination Guide

This guide contains essential questions, concepts, and architectural explanations commonly asked during college viva voce and project presentations for **PowerWise — Smart Electricity Consumption Analyzer Using Big Data Technologies**.

---

## 1. Project Overview & Fundamentals

### Q1: What is PowerWise and what problem does it solve?
**Answer:** PowerWise is an electricity consumption analytics application designed to process historical household smart-meter readings. It computes energy costs, highlights high-draw appliances, groups household consumption patterns using K-means clustering, and demonstrates how Big Data frameworks (HDFS, MapReduce, Apache Spark) manage large-scale energy datasets.

### Q2: Is PowerWise a real-time IoT or smart-meter streaming project?
**Answer:** No. PowerWise is explicitly a **historical data analytics platform**. It processes validated batch datasets (CSVs) using distributed processing abstractions. It does not imply live hardware meter connectivity.

---

## 2. Big Data Architecture & Core Concepts

### Q3: What is HDFS and how is it used in PowerWise?
**Answer:**
- **HDFS (Hadoop Distributed File System)** stores large files by splitting them into fixed-size blocks (default 128 MB) and distributing them across DataNodes with a replication factor (default 3) for fault tolerance.
- **In PowerWise:** When a Hadoop cluster is configured, uploaded smart-meter datasets are stored on HDFS with a unique identifier. When Hadoop is not installed on the student laptop, the system truthfully displays: `HDFS unavailable — using local dataset storage`.

### Q4: How does MapReduce work in PowerWise?
**Answer:**
- **Mapper (`bigdata/mapreduce/mapper.py`):** Reads streaming CSV lines from `stdin`, extracts the grouping key (`household_id`) and metric (`energy_kwh`), and emits:
  `household_id \t energy_kwh`
- **Shuffle & Sort:** The Hadoop framework automatically groups and sorts all emitted keys so that identical household IDs reach the reducer in consecutive order.
- **Reducer (`bigdata/mapreduce/reducer.py`):** Reads the sorted stream and computes a running total per household. Because records arrive sorted, the Reducer does not store all records in memory, making it highly memory-efficient.

### Q5: How can you run the MapReduce job without Hadoop?
**Answer:**
Using standard input/output redirection in any terminal or PowerShell:
```powershell
Get-Content bigdata/mapreduce/test_input.csv | python bigdata/mapreduce/mapper.py | Sort-Object | python bigdata/mapreduce/reducer.py
```
This demonstrates the mathematical correctness of the algorithm locally.

### Q6: What is the difference between Hadoop MapReduce and Apache Spark?
**Answer:**
| Feature | Hadoop MapReduce | Apache Spark / PySpark |
| :--- | :--- | :--- |
| **Storage Medium** | Disk-based (writes intermediate state to disk) | In-Memory (uses Resilient Distributed Datasets / DataFrames) |
| **Speed** | Slower for iterative algorithms | Up to 100x faster for repeated aggregations and ML |
| **Data Abstraction** | Key-Value pairs (`Mapper` & `Reducer`) | Structured DataFrames with SQL expressions and Catalyst Optimizer |
| **Machine Learning** | Requires Apache Mahout | Native `pyspark.ml` library (e.g. `KMeans`, `StandardScaler`) |

---

## 3. Machine Learning: K-Means Clustering

### Q7: Why do we use K-means clustering in PowerWise?
**Answer:**
K-means is an **unsupervised machine learning algorithm** used to group households with similar consumption behaviors without requiring pre-labeled training data. It discovers natural usage patterns across the grid.

### Q8: What features are used for clustering?
**Answer:**
1. **Average Daily Consumption (kWh/day)**: Reflects general appliance intensity and household size.
2. **Estimated Monthly Consumption (kWh/month)**: Reflects billing bracket.
3. **Peak-to-Average Ratio**: Reflects whether usage spikes during peak hours.

### Q9: Why are raw cluster numbers (0, 1, 2) not labeled "Wasteful"?
**Answer:**
- In K-means, cluster indices `0, 1, 2` are arbitrary geometric centroids determined by initial random seeds.
- PowerWise sorts cluster centroids by average consumption before mapping them to intuitive labels: **Low**, **Medium**, and **High**.
- Believing a high-consumption household is automatically "wasteful" is an engineering fallacy; high consumption may simply reflect more occupants, medical equipment, or essential temperature control.

---

## 4. Application Engineering, Security & RBAC

### Q10: How is Role-Based Access Control (RBAC) implemented?
**Answer:**
PowerWise enforces two distinct roles on the backend:
1. **User**: Can access their personal dashboard, manage their own appliances, upload datasets, and run jobs on their own datasets.
2. **Admin**: Has all user permissions, plus access to `/admin` to monitor registered users, system health, database mode, and global job queues.
- **Backend Enforcement:** The server verifies `owner_id == g.current_user["id"]` on every mutation or read. A regular user cannot read or delete another user's appliance simply by changing the ID in an API call.

### Q11: What is CSV Formula Injection and how is it prevented?
**Answer:**
If an uploaded dataset contains fields starting with characters like `=`, `+`, `-`, or `@`, spreadsheet software (Excel, LibreOffice) might interpret them as executable formulas or DDE macro commands. PowerWise prevents this during export by sanitizing cells and prefixing operator characters with a single quote (`'`).

### Q12: How are energy calculations performed?
**Answer:**
- $\text{Daily Energy (kWh)} = \frac{\text{Wattage (W)} \times \text{Hours/Day} \times \text{Quantity}}{1000}$
- $\text{Monthly Energy (kWh)} = \text{Daily Energy} \times 30$
- $\text{Estimated Cost (₹)} = \text{Monthly Energy (kWh)} \times \text{Tariff Rate (₹/kWh)}$
- $\text{Bill Estimator}: \text{Cost} = \text{Units (kWh)} \times \text{Rate (₹/kWh)}$ (with disclaimer on fixed charges, slabs, and taxes).
