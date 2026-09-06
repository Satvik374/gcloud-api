from typing import List, Optional, Union, Dict, Any
from pydantic import BaseModel, Field

# ----------------- Developer Portal Schemas -----------------

class ApiKeyCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="Label/name for the API key")
    expires_in_days: Optional[int] = Field(None, ge=1, le=365, description="Optional key expiration in days")

class ApiKeyResponse(BaseModel):
    id: str
    name: str
    masked_key: str
    created_at: str
    expires_at: Optional[str] = None
    is_active: bool
    request_count: int
    total_tokens: int
    last_used_at: Optional[str] = None

class ApiKeyCreateResponse(ApiKeyResponse):
    secret_key: str = Field(..., description="The full plaintext secret key. Only revealed once upon creation.")

class RequestLogResponse(BaseModel):
    id: str
    key_id: Optional[str]
    key_name: Optional[str]
    endpoint: str
    model: str
    status_code: int
    latency_ms: float
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    is_stream: bool
    error_message: Optional[str] = None
    created_at: str

class AnalyticsSummary(BaseModel):
    total_requests: int
    total_tokens: int
    avg_latency_ms: float
    success_rate: float
    active_keys_count: int
    model_breakdown: Dict[str, int]
    recent_logs: List[RequestLogResponse]

class GcpStatusResponse(BaseModel):
    adc_connected: bool
    project_id: str
    region: str
    token_valid: bool
    token_expires_at: Optional[str] = None
    account_or_email: Optional[str] = None
    message: str

class ModelCatalogItem(BaseModel):
    id: str
    name: str
    publisher: str = "Google"
    context_window: int
    max_output_tokens: int
    modalities: List[str]
    description: str
    recommended_use: str
    is_default: bool = False

# ----------------- OpenAI Compatibility Schemas -----------------

class ChatMessagePart(BaseModel):
    type: str
    text: Optional[str] = None
    image_url: Optional[Dict[str, Any]] = None

class ChatMessage(BaseModel):
    role: str
    content: Union[str, List[Dict[str, Any]], List[ChatMessagePart]]
    name: Optional[str] = None

class ChatCompletionRequest(BaseModel):
    model: str
    messages: List[ChatMessage]
    temperature: Optional[float] = Field(1.0, ge=0.0, le=2.0)
    top_p: Optional[float] = Field(None, ge=0.0, le=1.0)
    max_tokens: Optional[int] = Field(None, alias="max_completion_tokens")
    stream: Optional[bool] = False
    stop: Optional[Union[str, List[str]]] = None
    presence_penalty: Optional[float] = 0.0
    frequency_penalty: Optional[float] = 0.0
    user: Optional[str] = None

    class Config:
        populate_by_name = True
        extra = "allow"

class ChatResponseMessage(BaseModel):
    role: str = "assistant"
    content: Optional[str] = None

class ChatCompletionChoice(BaseModel):
    index: int
    message: ChatResponseMessage
    finish_reason: Optional[str] = "stop"

class CompletionUsage(BaseModel):
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0

class ChatCompletionResponse(BaseModel):
    id: str
    object: str = "chat.completion"
    created: int
    model: str
    choices: List[ChatCompletionChoice]
    usage: CompletionUsage

class ChatCompletionChunkDelta(BaseModel):
    role: Optional[str] = None
    content: Optional[str] = None

class ChatCompletionChunkChoice(BaseModel):
    index: int = 0
    delta: ChatCompletionChunkDelta
    finish_reason: Optional[str] = None

class ChatCompletionChunk(BaseModel):
    id: str
    object: str = "chat.completion.chunk"
    created: int
    model: str
    choices: List[ChatCompletionChunkChoice]
    usage: Optional[CompletionUsage] = None

class OpenAIModelItem(BaseModel):
    id: str
    object: str = "model"
    created: int = 1715000000
    owned_by: str = "google"

class OpenAIModelListResponse(BaseModel):
    object: str = "list"
    data: List[OpenAIModelItem]


# ----------------- Anthropic Messages Compatibility Schemas -----------------

class AnthropicMessageParam(BaseModel):
    role: str
    content: Union[str, List[Dict[str, Any]]]

    class Config:
        extra = "allow"

class AnthropicTool(BaseModel):
    name: str
    description: Optional[str] = None
    input_schema: Optional[Dict[str, Any]] = None

    class Config:
        extra = "allow"

class AnthropicMessageRequest(BaseModel):
    model: str
    messages: List[AnthropicMessageParam]
    system: Optional[Union[str, List[Dict[str, Any]]]] = None
    max_tokens: Optional[int] = Field(default=4096)
    temperature: Optional[float] = None
    top_p: Optional[float] = None
    top_k: Optional[int] = None
    stream: Optional[bool] = False
    stop_sequences: Optional[List[str]] = None
    tools: Optional[List[Dict[str, Any]]] = None
    tool_choice: Optional[Dict[str, Any]] = None
    metadata: Optional[Dict[str, Any]] = None

    class Config:
        extra = "allow"

class AnthropicUsage(BaseModel):
    input_tokens: int = 0
    output_tokens: int = 0

class AnthropicMessageResponse(BaseModel):
    id: str
    type: str = "message"
    role: str = "assistant"
    model: str
    content: List[Dict[str, Any]]
    stop_reason: Optional[str] = "end_turn"
    stop_sequence: Optional[str] = None
    usage: AnthropicUsage

class AnthropicCountTokensRequest(BaseModel):
    model: Optional[str] = "gemini-2.5-flash"
    messages: List[AnthropicMessageParam]
    system: Optional[Union[str, List[Dict[str, Any]]]] = None

    class Config:
        extra = "allow"

class AnthropicCountTokensResponse(BaseModel):
    input_tokens: int
