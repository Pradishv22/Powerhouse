from flask import Blueprint, jsonify
from backend.database import db
from backend.config import Config

health_bp = Blueprint("health", __name__, url_prefix="/api/v1")


@health_bp.route("/health", methods=["GET"])
def health_check():
    # Truthfully detect PySpark availability
    has_spark = False
    try:
        import pyspark
        has_spark = True
    except ImportError:
        has_spark = False

    hdfs_status = "Configured" if Config.HDFS_NAMENODE_URL else "HDFS unavailable — using local dataset storage"

    return jsonify({
        "status": "healthy",
        "service": "PowerWise Backend API",
        "version": "1.0.0",
        "database": {
            "mode": db.mode,
            "status": "connected" if db.mode == "mongodb" else "local_file_fallback",
        },
        "big_data_environment": {
            "pyspark_available": has_spark,
            "spark_master": Config.SPARK_MASTER if has_spark else "Not running (Local fallback mode active)",
            "hdfs_status": hdfs_status,
        },
    })
