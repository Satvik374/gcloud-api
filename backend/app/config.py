import os
from pathlib import Path
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

# Load .env file from backend directory if present
env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

class Settings(BaseSettings):
    APP_NAME: str = "Gemini API Gateway"
    VERSION: str = "1.0.0"
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))
    BASE_URL: str = os.getenv("BASE_URL", "http://localhost:8000/v1")
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./gateway.db")
    
    # GCP configuration
    GCP_PROJECT_ID: str = os.getenv("GCP_PROJECT_ID", "")
    GCP_REGION: str = os.getenv("GCP_REGION", "global")
    
    CORS_ORIGINS: str = os.getenv("CORS_ORIGINS", "*")

    class Config:
        case_sensitive = True

settings = Settings()
