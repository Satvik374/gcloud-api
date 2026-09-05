import json
import time
import uuid
import re
import base64
import logging
from typing import Dict, Any, List, Optional, AsyncGenerator, Tuple
import httpx
from app.services.adc_service import adc_manager
from app.schemas import (
    ChatCompletionRequest,
    ChatCompletionResponse,
    ChatCompletionChoice,
    ChatResponseMessage,
    CompletionUsage,
    ChatMessage
)

logger = logging.getLogger("gateway.gemini")

# Model mappings & aliases
MODEL_ALIASES = {
    "gemini-1.5-flash": "gemini-2.5-flash",
    "gemini-1.5-pro": "gemini-2.5-pro",
    "gemini-flash": "gemini-2.5-flash",
    "gemini-pro": "gemini-2.5-pro",
    "gpt-4o": "gemini-2.5-flash",
    "gpt-4o-mini": "gemini-2.5-flash-lite",
    "gpt-3.5-turbo": "gemini-2.5-flash-lite",
}

AVAILABLE_MODELS = [
    {
        "id": "gemini-2.5-flash",
        "name": "Gemini 2.5 Flash",
        "context_window": 1048576,
        "max_output_tokens": 8192,
        "modalities": ["Text", "Code", "Vision", "Audio"],
        "description": "High-frequency, multimodal model offering blazing speed and advanced reasoning capabilities.",
        "recommended_use": "General chat, agents, real-time interactive apps, summarization",
        "is_default": True
    },
    {
        "id": "gemini-2.5-pro",
        "name": "Gemini 2.5 Pro",
        "context_window": 2097152,
        "max_output_tokens": 8192,
        "modalities": ["Text", "Code", "Vision", "Audio", "Video"],
        "description": "Flagship frontier model designed for complex multi-step reasoning, coding, and massive context.",
        "recommended_use": "Complex analysis, large codebase debugging, legal/document processing",
        "is_default": False
    },
    {
        "id": "gemini-2.5-flash-lite",
        "name": "Gemini 2.5 Flash-Lite",
        "context_window": 1048576,
        "max_output_tokens": 8192,
        "modalities": ["Text", "Code", "Vision"],
        "description": "Ultra lightweight and cost-optimized model delivering ultra-low time-to-first-token.",
        "recommended_use": "High-throughput classification, simple extraction, edge tasks",
        "is_default": False
    },
    {
        "id": "gemini-3.8-flash",
        "name": "Gemini 3.8 Flash",
        "context_window": 1048576,
        "max_output_tokens": 8192,
        "modalities": ["Text", "Code", "Vision", "Audio"],
        "description": "Latest generation high-performance flash model with cutting-edge reasoning.",
        "recommended_use": "State-of-the-art multimodal reasoning, high-throughput agents",
        "is_default": False
    }
]

def resolve_model_name(requested_model: str) -> str:
    """Translates client model names and OpenAI aliases to Vertex AI model names."""
    clean_name = requested_model.lower().strip()
    if clean_name in MODEL_ALIASES:
        return MODEL_ALIASES[clean_name]
    return requested_model

def map_finish_reason(reason: Optional[str]) -> str:
    if not reason:
        return "stop"
    r = reason.upper()
    if r == "STOP":
        return "stop"
    elif r in ("MAX_TOKENS", "LENGTH"):
        return "length"
    elif r in ("SAFETY", "RECITATION"):
        return "content_filter"
    return "stop"

def transform_messages_to_gemini(messages: List[ChatMessage]) -> Tuple[Optional[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Transforms OpenAI messages format to Google Vertex AI Gemini contents format.
    Extracts system prompt to system_instruction if present.
    """
    system_instruction = None
    system_parts = []
    contents = []

    for msg in messages:
        role = msg.role.lower()
        content = msg.content

        # Handle system / developer instructions
        if role in ("system", "developer"):
            if isinstance(content, str):
                system_parts.append({"text": content})
            elif isinstance(content, list):
                for p in content:
                    if isinstance(p, dict) and p.get("type") == "text":
                        system_parts.append({"text": p.get("text", "")})
            continue

        # Map role
        gemini_role = "user" if role == "user" else "model"

        parts = []
        if isinstance(content, str):
            parts.append({"text": content})
        elif isinstance(content, list):
            for part in content:
                if isinstance(part, dict):
                    part_type = part.get("type")
                    if part_type == "text":
                        parts.append({"text": part.get("text", "")})
                    elif part_type == "image_url":
                        image_info = part.get("image_url", {})
                        url = image_info.get("url", "")
                        # Check for base64 data url
                        data_match = re.match(r"^data:(image\/[a-zA-Z]+);base64,(.+)$", url)
                        if data_match:
                            mime_type, b64_data = data_match.groups()
                            parts.append({
                                "inlineData": {
                                    "mimeType": mime_type,
                                    "data": b64_data
                                }
                            })
                        else:
                            # Direct image URL - note that Vertex AI Gemini prefers inlineData or GCS URIs
                            parts.append({"text": f"[Image URL: {url}]"})
        
        if parts:
            contents.append({
                "role": gemini_role,
                "parts": parts
            })

    if system_parts:
        system_instruction = {"parts": system_parts}

    return system_instruction, contents

def build_gemini_payload(req: ChatCompletionRequest) -> Dict[str, Any]:
    system_instruction, contents = transform_messages_to_gemini(req.messages)

    payload: Dict[str, Any] = {
        "contents": contents
    }

    if system_instruction:
        payload["system_instruction"] = system_instruction

    generation_config: Dict[str, Any] = {}
    if req.temperature is not None:
        generation_config["temperature"] = req.temperature
    if req.top_p is not None:
        generation_config["topP"] = req.top_p
    if req.max_tokens is not None:
        generation_config["maxOutputTokens"] = req.max_tokens
    if req.stop:
        if isinstance(req.stop, str):
            generation_config["stopSequences"] = [req.stop]
        elif isinstance(req.stop, list):
            generation_config["stopSequences"] = req.stop[:5]

    if generation_config:
        payload["generationConfig"] = generation_config

    return payload

class GeminiProxyClient:
    def __init__(self):
        self._client: Optional[httpx.AsyncClient] = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(timeout=120.0)
        return self._client

    def _get_endpoint_url(self, model: str, stream: bool = False, region: Optional[str] = None) -> str:
        project_id = adc_manager.get_project_id()
        reg = region or adc_manager.get_region()
        action = "streamGenerateContent?alt=sse" if stream else "generateContent"
        if reg == "global":
            host = "aiplatform.googleapis.com"
        else:
            host = f"{reg}-aiplatform.googleapis.com"
        return f"https://{host}/v1/projects/{project_id}/locations/{reg}/publishers/google/models/{model}:{action}"

    async def generate_completion(
        self,
        request: ChatCompletionRequest
    ) -> Tuple[ChatCompletionResponse, Dict[str, int]]:
        """Handles non-streaming chat completion request with region fallback."""
        model = resolve_model_name(request.model)
        primary_region = adc_manager.get_region()
        fallback_region = "us-central1" if primary_region == "global" else "global"

        token = adc_manager.get_access_token()
        payload = build_gemini_payload(request)

        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }

        async with httpx.AsyncClient(timeout=120.0) as client:
            url = self._get_endpoint_url(model, stream=False, region=primary_region)
            response = await client.post(url, json=payload, headers=headers)
            
            # If 404 in primary region, try fallback region (e.g. global <-> us-central1)
            if response.status_code == 404:
                fallback_url = self._get_endpoint_url(model, stream=False, region=fallback_region)
                fb_response = await client.post(fallback_url, json=payload, headers=headers)
                if fb_response.status_code == 200:
                    response = fb_response
            
            if response.status_code != 200:
                error_data = {}
                try:
                    error_data = response.json()
                except Exception:
                    error_data = {"error": response.text}
                logger.error(f"Vertex AI error: {response.status_code} - {error_data}")
                raise RuntimeError(f"Vertex AI error ({response.status_code}): {json.dumps(error_data)}")

            data = response.json()

        
        # Extract content & finish reason
        assistant_text = ""
        finish_reason = "stop"
        candidates = data.get("candidates", [])
        if candidates:
            first_candidate = candidates[0]
            finish_reason = map_finish_reason(first_candidate.get("finishReason"))
            content_obj = first_candidate.get("content", {})
            parts = content_obj.get("parts", [])
            for p in parts:
                if "text" in p:
                    assistant_text += p["text"]

        # Usage metadata
        usage_meta = data.get("usageMetadata", {})
        prompt_tokens = usage_meta.get("promptTokenCount", 0)
        completion_tokens = usage_meta.get("candidatesTokenCount", 0)
        total_tokens = usage_meta.get("totalTokenCount", prompt_tokens + completion_tokens)

        created_ts = int(time.time())
        completion_id = f"chatcmpl-{uuid.uuid4().hex[:24]}"

        result = ChatCompletionResponse(
            id=completion_id,
            object="chat.completion",
            created=created_ts,
            model=request.model,
            choices=[
                ChatCompletionChoice(
                    index=0,
                    message=ChatResponseMessage(
                        role="assistant",
                        content=assistant_text
                    ),
                    finish_reason=finish_reason
                )
            ],
            usage=CompletionUsage(
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                total_tokens=total_tokens
            )
        )

        tokens_info = {
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "total_tokens": total_tokens
        }

        return result, tokens_info

    async def stream_completion(
        self,
        request: ChatCompletionRequest
    ) -> AsyncGenerator[str, None]:
        """
        Proxies SSE stream from Vertex AI and yields OpenAI-formatted SSE chunks:
        data: {"id":"chatcmpl-...","object":"chat.completion.chunk",...}\n\n
        data: [DONE]\n\n
        """
        model = resolve_model_name(request.model)
        primary_region = adc_manager.get_region()
        fallback_region = "us-central1" if primary_region == "global" else "global"

        token = adc_manager.get_access_token()
        payload = build_gemini_payload(request)

        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }

        completion_id = f"chatcmpl-{uuid.uuid4().hex[:24]}"
        created_ts = int(time.time())

        # First chunk establishes the assistant role
        first_chunk = {
            "id": completion_id,
            "object": "chat.completion.chunk",
            "created": created_ts,
            "model": request.model,
            "choices": [
                {
                    "index": 0,
                    "delta": {"role": "assistant", "content": ""},
                    "finish_reason": None
                }
            ]
        }
        yield f"data: {json.dumps(first_chunk)}\n\n"

        total_prompt_tokens = 0
        total_completion_tokens = 0

        async with httpx.AsyncClient(timeout=120.0) as client:
            url = self._get_endpoint_url(model, stream=True, region=primary_region)
            stream_ctx = client.stream("POST", url, json=payload, headers=headers)
            resp = await stream_ctx.__aenter__()

            # If 404 in primary region, try fallback region
            if resp.status_code == 404:
                await stream_ctx.__aexit__(None, None, None)
                fallback_url = self._get_endpoint_url(model, stream=True, region=fallback_region)
                stream_ctx = client.stream("POST", fallback_url, json=payload, headers=headers)
                resp = await stream_ctx.__aenter__()

            try:
                if resp.status_code != 200:
                    body = await resp.aread()
                    err_str = body.decode("utf-8", errors="replace")
                    logger.error(f"Vertex AI Stream error: {resp.status_code} - {err_str}")
                    err_chunk = {
                        "error": {
                            "message": f"Vertex AI Error: {err_str}",
                            "type": "upstream_error",
                            "code": resp.status_code
                        }
                    }
                    yield f"data: {json.dumps(err_chunk)}\n\n"
                    yield "data: [DONE]\n\n"
                    return

                buffer = ""
                async for chunk in resp.aiter_text():
                    buffer += chunk
                    while "\n" in buffer:
                        line, buffer = buffer.split("\n", 1)
                        line = line.strip()
                        if not line or not line.startswith("data:"):
                            continue
                        
                        raw_data = line[5:].strip()
                        if not raw_data:
                            continue

                        try:
                            parsed = json.loads(raw_data)
                            
                            # Check usage
                            usage_meta = parsed.get("usageMetadata", {})
                            if usage_meta:
                                total_prompt_tokens = usage_meta.get("promptTokenCount", total_prompt_tokens)
                                total_completion_tokens = usage_meta.get("candidatesTokenCount", total_completion_tokens)

                            candidates = parsed.get("candidates", [])
                            if candidates:
                                cand = candidates[0]
                                content = cand.get("content", {})
                                parts = content.get("parts", [])
                                text_piece = "".join(p.get("text", "") for p in parts if "text" in p)
                                finish_r = cand.get("finishReason")
                                
                                mapped_finish = map_finish_reason(finish_r) if finish_r else None

                                if text_piece or mapped_finish:
                                    sse_chunk = {
                                        "id": completion_id,
                                        "object": "chat.completion.chunk",
                                        "created": created_ts,
                                        "model": request.model,
                                        "choices": [
                                            {
                                                "index": 0,
                                                "delta": {"content": text_piece} if text_piece else {},
                                                "finish_reason": mapped_finish
                                            }
                                        ]
                                    }
                                    yield f"data: {json.dumps(sse_chunk)}\n\n"

                        except json.JSONDecodeError:
                            continue
            finally:
                await stream_ctx.__aexit__(None, None, None)

        # Final chunk with usage stats if available
        if total_prompt_tokens or total_completion_tokens:
            final_usage_chunk = {
                "id": completion_id,
                "object": "chat.completion.chunk",
                "created": created_ts,
                "model": request.model,
                "choices": [],
                "usage": {
                    "prompt_tokens": total_prompt_tokens,
                    "completion_tokens": total_completion_tokens,
                    "total_tokens": total_prompt_tokens + total_completion_tokens
                }
            }
            yield f"data: {json.dumps(final_usage_chunk)}\n\n"

        yield "data: [DONE]\n\n"

gemini_client = GeminiProxyClient()
