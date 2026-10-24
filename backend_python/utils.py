import uuid
import datetime

def generate_cuid() -> str:
    """Generate a unique CUID-style ID for database records."""
    return "cmm" + uuid.uuid4().hex[:20]

def current_iso_time() -> str:
    """Return the current UTC time in ISO 8601 format."""
    return datetime.datetime.now(datetime.UTC).isoformat().replace("+00:00", "Z")
