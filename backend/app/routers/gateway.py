import time
import json
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Header, Request, status
from fastapi.responses import StreamingResponse, JSONResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ApiKey
from app.schemas import (
    ChatCompletionRequest,
    ChatCompletionResponse,
    OpenAIModelListResponse,
    OpenAIModelItem,
    AnthropicMessageRequest,
    AnthropicMessageResponse,
    AnthropicCountTokensRequest,
    AnthropicCountTokensResponse
)
from app.services.key_service import KeyService
from app.services.gemini_client import gemini_client, AVAILABLE_MODELS

logger = logging.getLogger("gateway.router")

router = APIRouter(prefix="/v1", tags=["OpenAI & Anthropic Gateway"])
anthropic_router = APIRouter(tags=["Anthropic Compatible Gateway"])

def authenticate_api_key(
    authorization: Optional[str] = Header(None),
    x_api_key: Optional[str] = Header(None, alias="x-api-key"),
    anthropic_auth_token: Optional[str] = Header(None, alias="anthropic-auth-token"),
    db: Session = Depends(get_db)
) -> ApiKey:
    """
    Validates API Key from multiple headers for OpenAI & Anthropic compatibility:
    1. x-api-key: sk-gem-live-... (Anthropic standard)
    2. anthropic-auth-token: sk-gem-live-... (Anthropic proxy token)
    3. Authorization: Bearer sk-gem-live-... (OpenAI standard)
    All keys generated in the portal work automatically across both APIs.
    """
    raw_key: Optional[str] = None

    # 1. Anthropic standard x-api-key
    if x_api_key and x_api_key.strip():
        raw_key = x_api_key.strip()

    # 2. Anthropic proxy token
    elif anthropic_auth_token and anthropic_auth_token.strip():
        raw_key = anthropic_auth_token.strip()

    # 3. Standard Authorization header (Bearer or direct token)
    elif authorization and authorization.strip():
        auth_val = authorization.strip()
        parts = auth_val.split(" ")
        if len(parts) == 2 and parts[0].lower() == "bearer":
            raw_key = parts[1].strip()
        elif len(parts) == 1:
            raw_key = parts[0].strip()

    if not raw_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error": {
                    "message": "Missing API Key. Pass your key via 'Authorization: Bearer sk-gem-...' or 'x-api-key: sk-gem-...'",
                    "type": "authentication_error",
                    "code": "missing_api_key"
                }
            }
        )

    key_obj = KeyService.verify_api_key(db, raw_key)
    if not key_obj:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error": {
                    "message": "Invalid, expired, or revoked API key.",
                    "type": "authentication_error",
                    "code": "invalid_api_key"
                }
            }
        )

    return key_obj

@router.get("/models", response_model=OpenAIModelListResponse)
async def list_models(
    api_key: ApiKey = Depends(authenticate_api_key)
):
    """
    Lists available Gemini models formatted in OpenAI standard schema.
    """
    model_items = [
        OpenAIModelItem(id=m["id"], owned_by="google")
        for m in AVAILABLE_MODELS
    ]
    return OpenAIModelListResponse(data=model_items)

@router.post("/chat/completions")
async def create_chat_completion(
    request: ChatCompletionRequest,
    req_http: Request,
    api_key: ApiKey = Depends(authenticate_api_key),
    db: Session = Depends(get_db)
):
    """
    OpenAI-compatible chat completions proxy endpoint.
    Translates payload to Vertex AI Gemini format, executes using ADC, and logs telemetry.
    Supports both non-streaming JSON and streaming Server-Sent Events (SSE).
    """
    start_time = time.time()
    endpoint = "/v1/chat/completions"

    # Handle streaming request
    if request.stream:
        async def stream_wrapper():
            tokens_accumulated = 0
            has_error = False
            err_msg = None
            try:
                async for chunk in gemini_client.stream_completion(request):
                    yield chunk
            except Exception as e:
                has_error = True
                err_msg = str(e)
                logger.error(f"Streaming error: {e}")
                err_payload = {
                    "error": {
                        "message": f"Gateway error: {str(e)}",
                        "type": "internal_server_error",
                        "code": 500
                    }
                }
                yield f"data: {json.dumps(err_payload)}\n\n"
                yield "data: [DONE]\n\n"
            finally:
                latency = (time.time() - start_time) * 1000.0
                status_code = 500 if has_error else 200
                KeyService.record_key_usage(db, api_key.id, 0, 0)
                KeyService.log_request(
                    db=db,
                    key_id=api_key.id,
                    key_name=api_key.name,
                    endpoint=endpoint,
                    model=request.model,
                    status_code=status_code,
                    latency_ms=latency,
                    prompt_tokens=0,
                    completion_tokens=0,
                    is_stream=True,
                    error_message=err_msg
                )

        return StreamingResponse(
            stream_wrapper(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no"
            }
        )

    # Handle standard non-streaming request
    try:
        completion_response, tokens = await gemini_client.generate_completion(request)
        latency = (time.time() - start_time) * 1000.0

        # Update key usage and telemetry logs
        KeyService.record_key_usage(
            db, api_key.id,
            prompt_tokens=tokens["prompt_tokens"],
            completion_tokens=tokens["completion_tokens"]
        )
        KeyService.log_request(
            db=db,
            key_id=api_key.id,
            key_name=api_key.name,
            endpoint=endpoint,
            model=request.model,
            status_code=200,
            latency_ms=latency,
            prompt_tokens=tokens["prompt_tokens"],
            completion_tokens=tokens["completion_tokens"],
            is_stream=False
        )

        return completion_response

    except Exception as e:
        latency = (time.time() - start_time) * 1000.0
        error_msg = str(e)
        logger.error(f"Completion error: {error_msg}")

        KeyService.log_request(
            db=db,
            key_id=api_key.id,
            key_name=api_key.name,
            endpoint=endpoint,
            model=request.model,
            status_code=500,
            latency_ms=latency,
            prompt_tokens=0,
            completion_tokens=0,
            is_stream=False,
            error_message=error_msg
        )

        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": {
                    "message": f"Gemini Gateway Error: {error_msg}",
                    "type": "api_error",
                    "code": "upstream_error"
                }
            }
        )


# ----------------- Anthropic Messages API Endpoints -----------------

@router.post("/messages")
@anthropic_router.post("/messages")
@anthropic_router.post("/v1/messages")
@anthropic_router.post("/v1/v1/messages")
async def create_anthropic_message(
    request: AnthropicMessageRequest,
    req_http: Request,
    api_key: ApiKey = Depends(authenticate_api_key),
    db: Session = Depends(get_db)
):
    """
    Anthropic-compatible Messages API proxy endpoint.
    Translates Anthropic payload to Vertex AI Gemini format, executes using ADC, and logs telemetry.
    Supports both non-streaming JSON and streaming Server-Sent Events (SSE).
    """
    start_time = time.time()
    endpoint = "/v1/messages"

    # Handle streaming request
    if request.stream:
        async def stream_wrapper():
            has_error = False
            err_msg = None
            try:
                async for chunk in gemini_client.stream_anthropic_completion(request):
                    yield chunk
            except Exception as e:
                has_error = True
                err_msg = str(e)
                logger.error(f"Anthropic streaming error: {e}")
                err_payload = {
                    "type": "error",
                    "error": {
                        "type": "api_error",
                        "message": f"Gateway error: {str(e)}"
                    }
                }
                yield f"event: error\ndata: {json.dumps(err_payload)}\n\n"
            finally:
                latency = (time.time() - start_time) * 1000.0
                status_code = 500 if has_error else 200
                KeyService.record_key_usage(db, api_key.id, 0, 0)
                KeyService.log_request(
                    db=db,
                    key_id=api_key.id,
                    key_name=api_key.name,
                    endpoint=endpoint,
                    model=request.model,
                    status_code=status_code,
                    latency_ms=latency,
                    prompt_tokens=0,
                    completion_tokens=0,
                    is_stream=True,
                    error_message=err_msg
                )

        return StreamingResponse(
            stream_wrapper(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "anthropic-version": "2023-06-01",
                "X-Accel-Buffering": "no"
            }
        )

    # Handle standard non-streaming request
    try:
        completion_response, tokens = await gemini_client.generate_anthropic_completion(request)
        latency = (time.time() - start_time) * 1000.0

        KeyService.record_key_usage(
            db, api_key.id,
            prompt_tokens=tokens["prompt_tokens"],
            completion_tokens=tokens["completion_tokens"]
        )
        KeyService.log_request(
            db=db,
            key_id=api_key.id,
            key_name=api_key.name,
            endpoint=endpoint,
            model=request.model,
            status_code=200,
            latency_ms=latency,
            prompt_tokens=tokens["prompt_tokens"],
            completion_tokens=tokens["completion_tokens"],
            is_stream=False
        )

        return JSONResponse(
            status_code=200,
            content=completion_response.model_dump(),
            headers={"anthropic-version": "2023-06-01"}
        )

    except Exception as e:
        latency = (time.time() - start_time) * 1000.0
        error_msg = str(e)
        logger.error(f"Anthropic message error: {error_msg}")

        KeyService.log_request(
            db=db,
            key_id=api_key.id,
            key_name=api_key.name,
            endpoint=endpoint,
            model=request.model,
            status_code=500,
            latency_ms=latency,
            prompt_tokens=0,
            completion_tokens=0,
            is_stream=False,
            error_message=error_msg
        )

        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "type": "error",
                "error": {
                    "type": "api_error",
                    "message": f"Gemini Gateway Error: {error_msg}"
                }
            },
            headers={"anthropic-version": "2023-06-01"}
        )

@router.post("/messages/count_tokens")
@anthropic_router.post("/messages/count_tokens")
@anthropic_router.post("/v1/messages/count_tokens")
async def count_anthropic_tokens(
    request: AnthropicCountTokensRequest,
    api_key: ApiKey = Depends(authenticate_api_key)
):
    """
    Anthropic token count approximation endpoint.
    """
    total_chars = 0
    if request.system:
        if isinstance(request.system, str):
            total_chars += len(request.system)
        elif isinstance(request.system, list):
            for b in request.system:
                if isinstance(b, dict) and "text" in b:
                    total_chars += len(b["text"])
    for m in request.messages:
        if isinstance(m.content, str):
            total_chars += len(m.content)
        elif isinstance(m.content, list):
            for b in m.content:
                if isinstance(b, dict) and "text" in b:
                    total_chars += len(b.get("text", ""))
    tokens = max(1, total_chars // 4)
    return {"input_tokens": tokens}
