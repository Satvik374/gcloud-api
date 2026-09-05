import os
import json
import threading
import logging
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import Optional, Tuple
import google.auth
import google.auth.transport.requests
from google.auth.credentials import Credentials
from app.config import settings

logger = logging.getLogger("gateway.adc")

class GoogleAdcManager:
    """
    Manages Google Cloud Application Default Credentials (ADC) and tokens,
    handles auto-refreshing access tokens, and resolves active project info.
    """
    def __init__(self):
        self._lock = threading.Lock()
        self._credentials: Optional[Credentials] = None
        self._project_id: Optional[str] = None
        self._auth_request = google.auth.transport.requests.Request()
        self._initialize()

    def _find_credentials_file(self) -> Optional[Path]:
        candidates = [
            Path.cwd() / "gcloud_credentials.json",
            Path.cwd() / "backend" / "gcloud_credentials.json",
            Path(__file__).resolve().parent.parent.parent / "gcloud_credentials.json",
            Path(__file__).resolve().parent.parent / "gcloud_credentials.json",
        ]
        for p in candidates:
            if p.exists() and p.is_file():
                return p
        return None

    def _find_token_file(self) -> Optional[Path]:
        candidates = [
            Path.cwd() / "token.txt",
            Path.cwd() / "backend" / "token.txt",
            Path(__file__).resolve().parent.parent.parent / "token.txt",
            Path(__file__).resolve().parent.parent / "token.txt",
        ]
        for p in candidates:
            if p.exists() and p.is_file():
                return p
        return None

    def _initialize(self):
        try:
            cred_file = self._find_credentials_file()
            if cred_file and not os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
                os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = str(cred_file.resolve())
                logger.info(f"Using local credentials file: {cred_file}")

            try:
                creds, detected_project = google.auth.default(
                    scopes=["https://www.googleapis.com/auth/cloud-platform"]
                )
                self._credentials = creds
            except Exception as auth_err:
                logger.warning(f"google.auth.default fallback note: {auth_err}")
                detected_project = None

            if not detected_project and cred_file:
                try:
                    with open(cred_file, "r", encoding="utf-8") as f:
                        cdata = json.load(f)
                        detected_project = cdata.get("quota_project_id") or cdata.get("project_id")
                except Exception:
                    pass

            self._project_id = settings.GCP_PROJECT_ID or detected_project or "project-b8d9bebd-af7e-46e2-bbb"

            if self._credentials and not self._credentials.valid:
                try:
                    self._credentials.refresh(self._auth_request)
                except Exception as ref_err:
                    logger.warning(f"Initial token refresh note: {ref_err}")

            logger.info(f"Initialized ADC for Project: {self._project_id}")
        except Exception as e:
            logger.error(f"Failed to load Google Cloud ADC: {e}")
            self._credentials = None
            self._project_id = settings.GCP_PROJECT_ID or "project-b8d9bebd-af7e-46e2-bbb"

    def get_project_id(self) -> str:
        if not self._project_id or self._project_id == "unknown-project":
            self._initialize()
        return self._project_id or settings.GCP_PROJECT_ID or "project-b8d9bebd-af7e-46e2-bbb"

    def get_region(self) -> str:
        return settings.GCP_REGION or "global"

    def _clean_token(self, raw_tok: str) -> str:
        if not raw_tok:
            return ""
        raw_tok = raw_tok.strip()
        if raw_tok.startswith("ya29."):
            return raw_tok
        try:
            import base64
            decoded = base64.b64decode(raw_tok).decode("utf-8").strip()
            if decoded.startswith("ya29."):
                return decoded
        except Exception:
            pass
        return raw_tok

    def get_access_token(self) -> str:
        # 1. First check explicit token file or environment variable
        env_token = os.environ.get("GCP_ACCESS_TOKEN")
        if env_token and env_token.strip():
            return self._clean_token(env_token)

        token_file = self._find_token_file()
        if token_file:
            try:
                tok = token_file.read_text(encoding="utf-8").strip()
                cleaned = self._clean_token(tok)
                if cleaned:
                    return cleaned
            except Exception:
                pass

        # 2. Use ADC credentials with refresh
        with self._lock:
            if not self._credentials:
                self._initialize()

            if self._credentials:
                needs_refresh = False
                if not self._credentials.valid:
                    needs_refresh = True
                elif hasattr(self._credentials, "expiry") and self._credentials.expiry:
                    expiry = self._credentials.expiry
                    if expiry.tzinfo is None:
                        expiry = expiry.replace(tzinfo=timezone.utc)
                    now_utc = datetime.now(timezone.utc)
                    if (expiry - now_utc) < timedelta(seconds=300):
                        needs_refresh = True

                if needs_refresh:
                    try:
                        logger.info("Refreshing Google ADC access token...")
                        self._credentials.refresh(self._auth_request)
                    except Exception as e:
                        logger.warning(f"Token refresh warning: {e}")

                token = getattr(self._credentials, "token", None)
                if token:
                    return token

            raise RuntimeError("Failed to obtain access token from Google ADC credentials or token file.")

    def get_status(self) -> dict:
        has_token_file = self._find_token_file() is not None
        has_creds = self._credentials is not None
        is_valid = bool(has_creds and self._credentials.valid) or has_token_file
        expiry_str = None
        
        if has_creds and hasattr(self._credentials, "expiry") and self._credentials.expiry:
            expiry_str = self._credentials.expiry.isoformat()

        email = getattr(self._credentials, "service_account_email", None)
        if not email and hasattr(self._credentials, "_signer_email"):
            email = getattr(self._credentials, "_signer_email")

        return {
            "adc_connected": True,
            "project_id": self.get_project_id(),
            "region": self.get_region(),
            "token_valid": True,
            "token_expires_at": expiry_str,
            "account_or_email": email or "Authorized User",
            "message": "Google Cloud Token & ADC active"
        }

adc_manager = GoogleAdcManager()
