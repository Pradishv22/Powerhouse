import os
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
    
    # Admin seed (only for development/testing if configured)
    ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@powerwise.local")
    ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "Admin@PowerWise2026")
    
    # HDFS & Spark paths / config
    HDFS_NAMENODE_URL = os.getenv("HDFS_NAMENODE_URL", "")
    SPARK_MASTER = os.getenv("SPARK_MASTER", "local[*]")
    
    # Maximum upload size: 16 MB
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024
