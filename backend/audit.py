import uuid
from datetime import datetime, timezone
from flask import request
from backend.database import db

SENSITIVE_KEYS = {"password", "password_hash", "confirm_password", "token", "secret", "file_content", "content"}


def sanitize_audit_details(details: dict) -> dict:
    """Recursively strip passwords, tokens, secrets, or large blobs from audit log payloads."""
    if not isinstance(details, dict):
        return {}

    sanitized = {}
    for k, v in details.items():
        key_lower = str(k).lower()
        if any(sens in key_lower for sens in SENSITIVE_KEYS):
            sanitized[k] = "[REDACTED]"
        elif isinstance(v, dict):
            sanitized[k] = sanitize_audit_details(v)
        elif isinstance(v, (str, int, float, bool)) or v is None:
            # Truncate strings longer than 200 chars to avoid large blobs
            if isinstance(v, str) and len(v) > 200:
                sanitized[k] = v[:200] + "... [TRUNCATED]"
            else:
                sanitized[k] = v
        elif isinstance(v, (list, tuple)):
            sanitized[k] = [
                str(item)[:100] for item in v[:20]
            ]  # cap list at 20 items
        else:
            sanitized[k] = str(v)[:100]
    return sanitized


def log_audit_event(
    event_type: str,
    status: str = "SUCCESS",
    details: dict = None,
    user_id: str = None,
    user_email: str = None,
) -> dict:
    """
    Record an immutable audit event in the database.
    Never stores plaintext passwords, tokens, or raw dataset contents.
    """
    ip_address = "127.0.0.1"
    try:
        if request:
            ip_address = request.headers.get("X-Forwarded-For", request.remote_addr or "127.0.0.1")
            if "," in ip_address:
                ip_address = ip_address.split(",")[0].strip()
    except RuntimeError:
        # Request context not active (e.g. background job or test fixture)
        pass

    event_doc = {
        "id": f"audit-{uuid.uuid4().hex[:12]}",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "event_type": event_type,
        "status": status,
        "user_id": user_id or "anonymous",
        "user_email": user_email or "unknown",
        "ip_address": ip_address,
        "details": sanitize_audit_details(details or {}),
    }

    try:
        db.audit_logs.insert_one(event_doc)
    except Exception as e:
        print(f"[PowerWise Audit ERROR] Failed to record audit log: {e}")

    return event_doc
