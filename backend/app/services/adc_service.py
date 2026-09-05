import threading
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Tuple
import google.auth
import google.auth.transport.requests
from google.auth.credentials import Credentials
from app.config import settings

logger = logging.getLogger("gateway.adc")

class GoogleAdcManager:
    """
    Manages Google Cloud Application Default Credentials (ADC),
    handles auto-refreshing access tokens, and resolves active project info.
    """
    def __init__(self):
        self._lock = threading.Lock()
        self._credentials: Optional[Credentials] = None
        self._project_id: Optional[str] = None
        self._auth_request = google.auth.transport.requests.Request()
        self._initialize()

    def _initialize(self):
        try:
            creds, detected_project = google.auth.default(
                scopes=["https://www.googleapis.com/auth/cloud-platform"]
            )
            self._credentials = creds
            self._project_id = settings.GCP_PROJECT_ID or detected_project
            logger.info(f"Initialized ADC for Project: {self._project_id}")
        except Exception as e:
            logger.error(f"Failed to load Google Cloud ADC: {e}")
            self._credentials = None
            self._project_id = settings.GCP_PROJECT_ID or "unknown-project"

    def get_project_id(self) -> str:
        if not self._project_id:
            self._initialize()
        return self._project_id or settings.GCP_PROJECT_ID or "unknown-project"

    def get_region(self) -> str:
        return settings.GCP_REGION or "global"

    def get_access_token(self) -> str:
        """
        Returns a valid OAuth 2.0 access token using ADC.
        Refreshes proactively if the token is expired or close to expiry.
        """
        with self._lock:
            if not self._credentials:
                self._initialize()
            
            if not self._credentials:
                raise RuntimeError(
                    "Google Cloud Application Default Credentials (ADC) are not configured. "
                    "Run 'gcloud auth application-default login' on your machine."
                )

            # Check if token needs refresh
            needs_refresh = False
            if not self._credentials.valid:
                needs_refresh = True
            elif hasattr(self._credentials, "expiry") and self._credentials.expiry:
                # Refresh if expiring within 300 seconds (5 mins)
                # Note: creds.expiry can be naive or aware UTC
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
                    logger.error(f"Failed to refresh Google ADC token: {e}")
                    raise RuntimeError(f"Failed to refresh Google ADC token: {str(e)}")

            token = getattr(self._credentials, "token", None)
            if not token:
                raise RuntimeError("Failed to obtain access token from Google ADC credentials.")
            return token

    def get_status(self) -> dict:
        """
        Returns diagnostic and status information about the current ADC state.
        """
        has_creds = self._credentials is not None
        is_valid = bool(has_creds and self._credentials.valid)
        expiry_str = None
        
        if has_creds and hasattr(self._credentials, "expiry") and self._credentials.expiry:
            expiry_str = self._credentials.expiry.isoformat()

        # Try to extract service account email or client email if available
        email = getattr(self._credentials, "service_account_email", None)
        if not email and hasattr(self._credentials, "_signer_email"):
            email = getattr(self._credentials, "_signer_email")

        msg = "ADC loaded and active" if is_valid or has_creds else "ADC not detected. Run 'gcloud auth application-default login'"

        return {
            "adc_connected": has_creds,
            "project_id": self.get_project_id(),
            "region": self.get_region(),
            "token_valid": is_valid or has_creds,
            "token_expires_at": expiry_str,
            "account_or_email": email,
            "message": msg
        }

adc_manager = GoogleAdcManager()
