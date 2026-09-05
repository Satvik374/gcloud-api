#!/usr/bin/env python3
"""
Google Cloud Gemini API Gateway & Developer Portal Runner
Launches the full-stack server powering local ADC authentication,
OpenAI-compatible endpoints (/v1), and the Developer Portal dashboard.
"""

import os
import sys
import argparse
import subprocess
from pathlib import Path

# Add backend to sys.path
backend_dir = Path(__file__).resolve().parent / "backend"
sys.path.insert(0, str(backend_dir))

def main():
    parser = argparse.ArgumentParser(description="Start the Gemini API Gateway & Developer Portal")
    parser.add_argument("--host", default="0.0.0.0", help="Host address to bind to (default: 0.0.0.0)")
    parser.add_argument("--port", type=int, default=8000, help="Port to listen on (default: 8000)")
    parser.add_argument("--reload", action="store_true", help="Enable auto-reload for development")
    args = parser.parse_args()

    # Pre-flight ADC check
    try:
        import google.auth
        creds, proj = google.auth.default()
        gcp_info = f"Project: {proj}"
    except Exception as e:
        gcp_info = f"ADC Warning: {e}"

    # Ensure UTF-8 output on Windows consoles
    if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
        try:
            sys.stdout.reconfigure(encoding='utf-8')
        except Exception:
            pass

    print("""
  =============================================================
     * GOOGLE CLOUD GEMINI API GATEWAY & DEVELOPER PORTAL *
  =============================================================
  - Status:               Running
  - Google Cloud:         {gcp_info}
  - Developer Portal UI:  http://localhost:{port}/
  - OpenAI Base URL:      http://localhost:{port}/v1
  - Health Check:         http://localhost:{port}/health
  - Interactive Docs:     http://localhost:{port}/docs
  =============================================================
    """.format(gcp_info=gcp_info, port=args.port))


    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=args.host,
        port=args.port,
        reload=args.reload,
        app_dir=str(backend_dir)
    )

if __name__ == "__main__":
    main()
