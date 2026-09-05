import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database import Base

def utc_now():
    return datetime.now(timezone.utc)

class ApiKey(Base):
    __tablename__ = "api_keys"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(100), nullable=False)
    key_hash = Column(String(64), unique=True, index=True, nullable=False)
    key_prefix = Column(String(20), nullable=False)
    key_suffix = Column(String(10), nullable=False)
    created_at = Column(DateTime, default=utc_now, nullable=False)
    expires_at = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    request_count = Column(Integer, default=0, nullable=False)
    total_tokens = Column(Integer, default=0, nullable=False)
    last_used_at = Column(DateTime, nullable=True)

    # Relationships
    logs = relationship("RequestLog", back_populates="api_key", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "masked_key": f"{self.key_prefix}••••••••{self.key_suffix}",
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "is_active": self.is_active,
            "request_count": self.request_count,
            "total_tokens": self.total_tokens,
            "last_used_at": self.last_used_at.isoformat() if self.last_used_at else None,
        }

class RequestLog(Base):
    __tablename__ = "request_logs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    key_id = Column(String(36), ForeignKey("api_keys.id", ondelete="SET NULL"), nullable=True)
    key_name = Column(String(100), nullable=True)
    endpoint = Column(String(100), nullable=False)
    model = Column(String(100), nullable=False)
    status_code = Column(Integer, nullable=False)
    latency_ms = Column(Float, nullable=False)
    prompt_tokens = Column(Integer, default=0, nullable=False)
    completion_tokens = Column(Integer, default=0, nullable=False)
    total_tokens = Column(Integer, default=0, nullable=False)
    is_stream = Column(Boolean, default=False, nullable=False)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now, nullable=False)

    # Relationships
    api_key = relationship("ApiKey", back_populates="logs")

    def to_dict(self):
        return {
            "id": self.id,
            "key_id": self.key_id,
            "key_name": self.key_name,
            "endpoint": self.endpoint,
            "model": self.model,
            "status_code": self.status_code,
            "latency_ms": round(self.latency_ms, 2),
            "prompt_tokens": self.prompt_tokens,
            "completion_tokens": self.completion_tokens,
            "total_tokens": self.total_tokens,
            "is_stream": self.is_stream,
            "error_message": self.error_message,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
