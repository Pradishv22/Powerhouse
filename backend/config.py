import os
import re
from pathlib import Path
from dotenv import load_dotenv

# Load .env if present in root or backend folder
env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "powerwise-secret-key-change-in-prod-2026")
    MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/powerwise")
    DATABASE_NAME = os.getenv("DATABASE_NAME", "powerwise")
    DATA_DIR = Path(__file__).resolve().parent.parent / "data"
    UPLOAD_FOLDER = DATA_DIR / "uploads"

    # Session cookie settings
    SESSION_COOKIE_NAME = "powerwise_session"
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"
    SESSION_COOKIE_SECURE = os.getenv("SESSION_COOKIE_SECURE", "false").lower() == "true"

    # Development Admin Seed Credentials
    ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@powerwise.local")
    ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "Admin@PowerWise2026")

    # Allowed CORS Origins for frontend development & production
    DEFAULT_CORS_ORIGINS = (
        "http://localhost:8080,http://127.0.0.1:8080,"
        "http://localhost:5173,http://127.0.0.1:5173,"
        "http://localhost:3000,http://127.0.0.1:3000,"
        "http://localhost:4173,http://127.0.0.1:4173"
    )
    EXPLICIT_CORS_ORIGINS = [
        o.strip()
        for o in os.getenv("CORS_ORIGINS", DEFAULT_CORS_ORIGINS).split(",")
        if o.strip()
    ]
    # Regex matching localhost, 127.0.0.1, and RFC1918 private network IPs on any port
    LAN_CORS_REGEX = re.compile(
        r"^https?://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?$"
    )
    # Combined origins for flask-cors (explicit origins + private LAN regex)
    CORS_ORIGINS = EXPLICIT_CORS_ORIGINS + [LAN_CORS_REGEX]

    # HDFS & Spark paths / config
    HDFS_NAMENODE_URL = os.getenv("HDFS_NAMENODE_URL", "")
    SPARK_MASTER = os.getenv("SPARK_MASTER", "local[*]")

    # Maximum upload size: 16 MB
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024
