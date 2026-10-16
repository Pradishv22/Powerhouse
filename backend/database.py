import json
import os
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from backend.config import Config

# Try importing pymongo
try:
    from pymongo import MongoClient
    from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError
    PYMONGO_AVAILABLE = True
except ImportError:
    PYMONGO_AVAILABLE = False


class LocalCollection:
    """Thread-safe file-backed collection that mimics PyMongo collection methods."""
    def __init__(self, name: str, filepath: Path, lock: threading.Lock):
        self.name = name
        self.filepath = filepath
        self.lock = lock

    def _read_all(self):
        with self.lock:
            if not self.filepath.exists():
                return []
            try:
                with open(self.filepath, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                return []

    def _write_all(self, items):
        with self.lock:
            self.filepath.parent.mkdir(parents=True, exist_ok=True)
            with open(self.filepath, "w", encoding="utf-8") as f:
                json.dump(items, f, indent=2, default=str)

    def find_one(self, query):
        items = self._read_all()
        for item in items:
            match = True
            for k, v in query.items():
                if item.get(k) != v:
                    match = False
                    break
            if match:
                return dict(item)
        return None

    def find(self, query=None):
        items = self._read_all()
        if not query:
            return [dict(i) for i in items]
        result = []
        for item in items:
            match = True
            for k, v in query.items():
                if item.get(k) != v:
                    match = False
                    break
            if match:
                result.append(dict(item))
        return result

    def insert_one(self, doc):
        items = self._read_all()
        doc_copy = dict(doc)
        if "id" not in doc_copy and "_id" not in doc_copy:
            doc_copy["id"] = str(uuid.uuid4())
        elif "_id" in doc_copy and "id" not in doc_copy:
            doc_copy["id"] = str(doc_copy["_id"])
        items.append(doc_copy)
        self._write_all(items)
        return type("InsertResult", (), {"inserted_id": doc_copy.get("id")})

    def update_one(self, query, update):
        items = self._read_all()
        set_fields = update.get("$set", {})
        updated = False
        for item in items:
            match = True
            for k, v in query.items():
                if item.get(k) != v:
                    match = False
                    break
            if match:
                item.update(set_fields)
                item["updated_at"] = datetime.now(timezone.utc).isoformat()
                updated = True
                break
        if updated:
            self._write_all(items)
        return type("UpdateResult", (), {"matched_count": 1 if updated else 0, "modified_count": 1 if updated else 0})

    def delete_one(self, query):
        items = self._read_all()
        initial_len = len(items)
        filtered = []
        deleted = False
        for item in items:
            if not deleted:
                match = True
                for k, v in query.items():
                    if item.get(k) != v:
                        match = False
                        break
                if match:
                    deleted = True
                    continue
            filtered.append(item)
        if deleted:
            self._write_all(filtered)
        return type("DeleteResult", (), {"deleted_count": 1 if deleted else 0})

    def count_documents(self, query=None):
        return len(self.find(query))


class DatabaseManager:
    def __init__(self):
        self.mode = "local"  # 'mongodb' or 'local'
        self.client = None
        self.db = None
        self._lock = threading.Lock()
        self.local_storage_dir = Path(__file__).resolve().parent / "storage"
        self.local_storage_dir.mkdir(parents=True, exist_ok=True)
        self._init_connection()

    def _init_connection(self):
        if PYMONGO_AVAILABLE and Config.MONGO_URI:
            try:
                # Attempt short-timeout ping to check if MongoDB is alive
                client = MongoClient(Config.MONGO_URI, serverSelectionTimeoutMS=1000)
                client.admin.command("ping")
                self.client = client
                self.db = client[Config.DATABASE_NAME]
                self.mode = "mongodb"
                print(f"[PowerWise DB] Connected to MongoDB at {Config.MONGO_URI}")
                return
            except (ConnectionFailure, ServerSelectionTimeoutError, Exception) as e:
                print(f"[PowerWise DB] MongoDB not reachable ({e}). Falling back to local file storage.")
        
        self.mode = "local"
        print(f"[PowerWise DB] Using local persistent JSON storage in {self.local_storage_dir}")

    def get_collection(self, name: str):
        if self.mode == "mongodb" and self.db is not None:
            return self.db[name]
        return LocalCollection(name, self.local_storage_dir / f"{name}.json", self._lock)

    @property
    def users(self):
        return self.get_collection("users")

    @property
    def appliances(self):
        return self.get_collection("appliances")

    @property
    def datasets(self):
        return self.get_collection("datasets")

    @property
    def jobs(self):
        return self.get_collection("jobs")

    @property
    def audit_logs(self):
        return self.get_collection("audit_logs")


# Global singleton instance
db = DatabaseManager()
