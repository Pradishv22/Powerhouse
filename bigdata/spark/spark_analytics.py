"""
PowerWise Apache Spark / PySpark Analytics Job
Purpose: Demonstrates distributed electricity consumption analytics using Apache Spark DataFrames.

Features for College Viva:
1. Explicit StructType Schema enforcement.
2. In-memory DataFrame transformations and filtering.
3. Grouping and aggregation (by household, appliance, day, month).
4. Aggregates data on Spark cluster before returning compact summaries to driver/API.
5. Includes a graceful local fallback so the script can be tested even if PySpark is not installed on the machine.
"""

import sys
import json
from pathlib import Path

def run_spark_analytics(csv_path: str):
    """
    Executes PySpark aggregations if PySpark is installed.
    Otherwise, executes the clean local equivalent and reports execution mode.
    """
    try:
        from pyspark.sql import SparkSession
        from pyspark.sql.types import StructType, StructField, StringType, DoubleType
        import pyspark.sql.functions as F

        print("[Spark Analytics] Initializing SparkSession...")
        spark = SparkSession.builder \
            .appName("PowerWiseElectricityAnalytics") \
            .master("local[*]") \
            .getOrCreate()

        schema = StructType([
            StructField("record_id", StringType(), True),
            StructField("household_id", StringType(), False),
            StructField("timestamp", StringType(), False),
            StructField("appliance_name", StringType(), True),
            StructField("category", StringType(), True),
            StructField("wattage_w", DoubleType(), True),
            StructField("usage_hours", DoubleType(), True),
            StructField("energy_kwh", DoubleType(), True),
            StructField("tariff_per_kwh", DoubleType(), True),
        ])

        df = spark.read.csv(csv_path, header=True, schema=schema)
        initial_count = df.count()

        # Data Cleaning: filter out negative or null energy readings
        clean_df = df.filter((df.energy_kwh.isNotNull()) & (df.energy_kwh >= 0))
        cleaned_count = clean_df.count()

        # Aggregation 1: Household Totals
        hh_df = clean_df.groupBy("household_id") \
            .agg(F.round(F.sum("energy_kwh"), 2).alias("total_kwh")) \
            .orderBy("household_id")
        household_totals = {row["household_id"]: row["total_kwh"] for row in hh_df.collect()}

        # Aggregation 2: Appliance Totals
        app_df = clean_df.groupBy("appliance_name") \
            .agg(F.round(F.sum("energy_kwh"), 2).alias("total_kwh")) \
            .orderBy(F.desc("total_kwh"))
        appliance_totals = {row["appliance_name"]: row["total_kwh"] for row in app_df.collect()}

        # Extract date from timestamp (YYYY-MM-DD)
        dated_df = clean_df.withColumn("date", F.substring("timestamp", 1, 10))

        # Aggregation 3: Daily Totals
        daily_df = dated_df.groupBy("date") \
            .agg(F.round(F.sum("energy_kwh"), 2).alias("daily_kwh")) \
            .orderBy("date")
        daily_totals = [{"date": row["date"], "kwh": row["daily_kwh"]} for row in daily_df.collect()]

        spark.stop()

        return {
            "execution_mode": "Apache Spark (PySpark DataFrame)",
            "initial_rows": initial_count,
            "cleaned_rows": cleaned_count,
            "invalid_rows_removed": initial_count - cleaned_count,
            "household_totals": household_totals,
            "appliance_totals": appliance_totals,
            "daily_totals": daily_totals,
        }

    except ImportError:
        # Local Python fallback when PySpark is not installed
        import csv
        with open(csv_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            rows = list(reader)

        hh_totals = {}
        app_totals = {}
        daily_totals_map = {}

        for r in rows:
            try:
                kwh = float(r.get("energy_kwh") or 0)
                hh = r.get("household_id", "Unknown")
                app = r.get("appliance_name", "General")
                date = (r.get("timestamp") or "")[:10]

                hh_totals[hh] = round(hh_totals.get(hh, 0.0) + kwh, 2)
                app_totals[app] = round(app_totals.get(app, 0.0) + kwh, 2)
                daily_totals_map[date] = round(daily_totals_map.get(date, 0.0) + kwh, 2)
            except ValueError:
                continue

        return {
            "execution_mode": "Local demo (PySpark not installed)",
            "initial_rows": len(rows),
            "cleaned_rows": len(rows),
            "invalid_rows_removed": 0,
            "household_totals": hh_totals,
            "appliance_totals": app_totals,
            "daily_totals": [{"date": k, "kwh": v} for k, v in sorted(daily_totals_map.items())],
        }

if __name__ == "__main__":
    csv_file = sys.argv[1] if len(sys.argv) > 1 else str(Path(__file__).resolve().parent.parent.parent / "data" / "sample_electricity_records.csv")
    result = run_spark_analytics(csv_file)
    print(json.dumps(result, indent=2))
