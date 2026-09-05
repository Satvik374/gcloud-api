import secrets
import hashlib
from datetime import datetime, timezone, timedelta
from typing import Optional, Tuple, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models import ApiKey, RequestLog
from app.schemas import ApiKeyCreate

def hash_api_key(raw_key: str) -> str:
    """Hashes a raw API key using SHA-256."""
    return hashlib.sha256(raw_key.strip().encode("utf-8")).hexdigest()

def generate_secret_key() -> str:
    """Generates a cryptographically secure API key with prefix sk-gem-live-."""
    random_part = secrets.token_urlsafe(28).replace("-", "").replace("_", "")[:32]
    return f"sk-gem-live-{random_part}"

class KeyService:
    @staticmethod
    def create_api_key(db: Session, key_in: ApiKeyCreate) -> Tuple[ApiKey, str]:
        raw_key = generate_secret_key()
        key_hash = hash_api_key(raw_key)
        prefix = raw_key[:12] # sk-gem-live-
        suffix = raw_key[-4:]  # last 4 chars

        expires_at = None
        if key_in.expires_in_days:
            expires_at = datetime.now(timezone.utc) + timedelta(days=key_in.expires_in_days)

        api_key = ApiKey(
            name=key_in.name,
            key_hash=key_hash,
            key_prefix=prefix,
            key_suffix=suffix,
            expires_at=expires_at,
            is_active=True
        )
        db.add(api_key)
        db.commit()
        db.refresh(api_key)
        return api_key, raw_key

    @staticmethod
    def verify_api_key(db: Session, raw_key: str) -> Optional[ApiKey]:
        """
        Validates Bearer token by computing hash and checking active/expiry status.
        """
        if not raw_key or not raw_key.startswith("sk-gem-"):
            return None

        h = hash_api_key(raw_key)
        key = db.query(ApiKey).filter(ApiKey.key_hash == h, ApiKey.is_active == True).first()
        if not key:
            return None

        # Check expiration
        if key.expires_at:
            now = datetime.now(timezone.utc)
            exp = key.expires_at
            if exp.tzinfo is None:
                exp = exp.replace(tzinfo=timezone.utc)
            if now > exp:
                return None

        return key

    @staticmethod
    def record_key_usage(db: Session, key_id: str, prompt_tokens: int, completion_tokens: int):
        """Updates key counters and last used timestamp."""
        try:
            key = db.query(ApiKey).filter(ApiKey.id == key_id).first()
            if key:
                key.request_count += 1
                key.total_tokens += (prompt_tokens + completion_tokens)
                key.last_used_at = datetime.now(timezone.utc)
                db.commit()
        except Exception:
            db.rollback()

    @staticmethod
    def list_keys(db: Session) -> List[ApiKey]:
        return db.query(ApiKey).order_by(ApiKey.created_at.desc()).all()

    @staticmethod
    def revoke_key(db: Session, key_id: str) -> bool:
        key = db.query(ApiKey).filter(ApiKey.id == key_id).first()
        if key:
            key.is_active = False
            db.commit()
            return True
        return False

    @staticmethod
    def delete_key(db: Session, key_id: str) -> bool:
        key = db.query(ApiKey).filter(ApiKey.id == key_id).first()
        if key:
            db.delete(key)
            db.commit()
            return True
        return False

    @staticmethod
    def log_request(
        db: Session,
        key_id: Optional[str],
        key_name: Optional[str],
        endpoint: str,
        model: str,
        status_code: int,
        latency_ms: float,
        prompt_tokens: int = 0,
        completion_tokens: int = 0,
        is_stream: bool = False,
        error_message: Optional[str] = None
    ) -> RequestLog:
        log = RequestLog(
            key_id=key_id,
            key_name=key_name,
            endpoint=endpoint,
            model=model,
            status_code=status_code,
            latency_ms=latency_ms,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=prompt_tokens + completion_tokens,
            is_stream=is_stream,
            error_message=error_message
        )
        db.add(log)
        db.commit()
        return log

    @staticmethod
    def get_analytics(db: Session) -> Dict[str, Any]:
        total_reqs = db.query(func.count(RequestLog.id)).scalar() or 0
        total_tokens = db.query(func.sum(RequestLog.total_tokens)).scalar() or 0
        avg_latency = db.query(func.avg(RequestLog.latency_ms)).scalar() or 0.0
        
        success_reqs = db.query(func.count(RequestLog.id)).filter(
            RequestLog.status_code >= 200, RequestLog.status_code < 300
        ).scalar() or 0
        
        success_rate = (success_reqs / total_reqs * 100.0) if total_reqs > 0 else 100.0
        active_keys = db.query(func.count(ApiKey.id)).filter(ApiKey.is_active == True).scalar() or 0

        # Model breakdown
        breakdown_rows = db.query(RequestLog.model, func.count(RequestLog.id)).group_by(RequestLog.model).all()
        model_breakdown = {row[0]: row[1] for row in breakdown_rows}

        recent_logs = db.query(RequestLog).order_by(RequestLog.created_at.desc()).limit(50).all()

        return {
            "total_requests": total_reqs,
            "total_tokens": int(total_tokens),
            "avg_latency_ms": round(float(avg_latency), 2),
            "success_rate": round(float(success_rate), 1),
            "active_keys_count": active_keys,
            "model_breakdown": model_breakdown,
            "recent_logs": [log.to_dict() for log in recent_logs]
        }
