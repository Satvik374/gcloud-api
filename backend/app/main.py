import os
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database import init_db
from app.routers import gateway, portal
from app.services.adc_service import adc_manager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: initialize database tables
    init_db()
    # Check ADC
    status = adc_manager.get_status()
    print(f"==================================================")
    print(f"  {settings.APP_NAME} v{settings.VERSION}")
    print(f"  GCP Project ID: {status['project_id']}")
    print(f"  GCP Region:     {status['region']}")
    print(f"  ADC Status:     {status['message']}")
    print(f"  Base URL:       {settings.BASE_URL}")
    print(f"==================================================")
    yield
    # Shutdown logic if any

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.VERSION,
    description="Full-stack API Gateway & Developer Portal for Google Cloud Gemini Models via ADC",
    lifespan=lifespan
)

# Configure CORS
origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Routers
app.include_router(gateway.router)
app.include_router(gateway.anthropic_router)
app.include_router(portal.router)

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": settings.VERSION,
        "gcp_status": adc_manager.get_status()
    }

# Mount frontend build if available
frontend_dist_dir = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
if frontend_dist_dir.exists() and (frontend_dist_dir / "index.html").exists():
    app.mount("/assets", StaticFiles(directory=str(frontend_dist_dir / "assets")), name="static_assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        target_file = frontend_dist_dir / full_path
        if target_file.exists() and target_file.is_file():
            return FileResponse(target_file)
        return FileResponse(frontend_dist_dir / "index.html")
else:
    @app.get("/")
    async def root():
        return {
            "message": "Google Cloud Gemini API Gateway is active!",
            "developer_portal_api": "/api",
            "openai_compat_base_url": settings.BASE_URL,
            "docs": "/docs",
            "health": "/health"
        }
