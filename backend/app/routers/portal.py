import logging
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import (
    ApiKeyCreate,
    ApiKeyResponse,
    ApiKeyCreateResponse,
    GcpStatusResponse,
    ModelCatalogItem,
    AnalyticsSummary
)
from app.services.adc_service import adc_manager
from app.services.key_service import KeyService
from app.services.gemini_client import AVAILABLE_MODELS

logger = logging.getLogger("gateway.portal")

router = APIRouter(prefix="/api", tags=["Developer Portal"])

@router.get("/gcp/status", response_model=GcpStatusResponse)
async def get_gcp_status():
    """
    Returns current Google Cloud ADC status, active project ID, and region.
    """
    status_info = adc_manager.get_status()
    return GcpStatusResponse(**status_info)

@router.get("/models", response_model=List[ModelCatalogItem])
async def get_catalog_models():
    """
    Returns rich catalog of available Gemini models with context windows and capabilities.
    """
    return [ModelCatalogItem(**m) for m in AVAILABLE_MODELS]

@router.get("/keys", response_model=List[ApiKeyResponse])
async def list_api_keys(db: Session = Depends(get_db)):
    """
    Returns all generated API keys with masked secrets.
    """
    keys = KeyService.list_keys(db)
    return [ApiKeyResponse(**k.to_dict()) for k in keys]

@router.post("/keys", response_model=ApiKeyCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_api_key(key_in: ApiKeyCreate, db: Session = Depends(get_db)):
    """
    Generates a new custom API key.
    The secret key is revealed once in the response.
    """
    api_key, raw_secret = KeyService.create_api_key(db, key_in)
    data = api_key.to_dict()
    data["secret_key"] = raw_secret
    return ApiKeyCreateResponse(**data)

@router.post("/keys/{key_id}/revoke", response_model=dict)
async def revoke_api_key(key_id: str, db: Session = Depends(get_db)):
    """
    Revokes an active API key so it can no longer be used for proxy requests.
    """
    success = KeyService.revoke_key(db, key_id)
    if not success:
        raise HTTPException(status_code=404, detail="API key not found")
    return {"message": "API key successfully revoked", "key_id": key_id}

@router.delete("/keys/{key_id}", response_model=dict)
async def delete_api_key(key_id: str, db: Session = Depends(get_db)):
    """
    Permanently removes an API key from the database.
    """
    success = KeyService.delete_key(db, key_id)
    if not success:
        raise HTTPException(status_code=404, detail="API key not found")
    return {"message": "API key permanently deleted", "key_id": key_id}

@router.get("/analytics", response_model=AnalyticsSummary)
async def get_analytics(db: Session = Depends(get_db)):
    """
    Aggregates request volume, average latency, success rates, and recent proxy logs.
    """
    stats = KeyService.get_analytics(db)
    return AnalyticsSummary(**stats)
