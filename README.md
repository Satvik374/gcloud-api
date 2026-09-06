# Google Cloud Gemini API Gateway & Developer Portal

A production-ready, full-stack API Gateway and Developer Portal application that acts as an API provider for Google Cloud Gemini models (`gemini-2.5-flash`, `gemini-2.5-pro`, `gemini-2.5-flash-lite`, `gemini-3.8-flash`), using local Google Cloud Application Default Credentials (ADC).

The gateway is a **100% drop-in replacement for OpenAI's API format** (`/v1/chat/completions` and `/v1/models`), allowing you to connect OpenAI SDKs, LangChain, Cursor AI, LiteLLM, or custom applications directly to Google Vertex AI Gemini models without exposing Google Cloud service account keys.

---

## Architecture Diagram

```
+-----------------------------------------------------------------------------------------+
|                                    CLIENT APPLICATIONS                                  |
|   (OpenAI Python SDK, LangChain, Cursor, cURL, Next.js, OpenAI Node SDK, Playground)   |
+-----------------------------------------------------------------------------------------+
                                         │
                       Bearer sk-gem-live-xyz (Custom API Key)
                                         ▼
+-----------------------------------------------------------------------------------------+
|                               FASTAPI API GATEWAY (Port 8000)                           |
|                                                                                         |
|  [Auth Middleware] ──► Hash key (SHA-256) ──► Verify against SQLite (ApiKeys Table)    |
|                                                                                         |
|  [Routes]                                                                               |
|   • GET  /v1/models             ──► Standard OpenAI model list schema                   |
|   • POST /v1/chat/completions   ──► Translates OpenAI payload to Gemini format          |
|                                     (Messages -> contents/parts, system_instruction)    |
|                                                                                         |
|  [Google ADC Token Manager]                                                             |
|   • Detects & refreshes token automatically via local `google.auth.default()`           |
|   • Cached in-memory with automatic proactive refresh 5 mins before expiry              |
|                                                                                         |
|  [Streaming Engine]                                                                     |
|   • Proxies Vertex AI SSE chunks (`streamGenerateContent?alt=sse`)                     |
|   • Formats real-time chunks as standard OpenAI `chat.completion.chunk` SSE             |
|                                                                                         |
|  [Telemetry & Logging]                                                                  |
|   • Tracks latency, prompt/completion tokens, status code in `request_logs`             |
+-----------------------------------------------------------------------------------------+
                    │                                                   ▲
        Bearer $(ADC Access Token)                                      │
                    ▼                                                   │
+---------------------------------------------------+       +-----------------------+
|             GOOGLE VERTEX AI / GEMINI API         |       |    DEVELOPER PORTAL   |
|  (us-central1-aiplatform.googleapis.com)          |       |   (React / Tailwind)  |
|  Models: gemini-2.5-flash, gemini-2.5-pro, etc.   |       |  • API Key Generator  |
+---------------------------------------------------+       |  • Model Catalog      |
                                                            |  • Interactive Tester |
                                                            |  • Code Snippets Docs |
                                                            |  • Analytics & Logs   |
                                                            +-----------------------+
```

---

## Directory Structure

```
gcloud API/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── config.py            # Configuration & GCP project/region auto-discovery
│   │   ├── database.py          # SQLAlchemy SQLite connection & session maker
│   │   ├── main.py              # FastAPI app, CORS, routes, static SPA server
│   │   ├── models.py            # ORM models (ApiKey, RequestLog)
│   │   ├── schemas.py           # Pydantic validation schemas (OpenAI & Portal)
│   │   ├── routers/
│   │   │   ├── gateway.py       # /v1/chat/completions & /v1/models (OpenAI drop-in)
│   │   │   └── portal.py        # /api/keys, /api/models, /api/analytics, /api/gcp
│   │   └── services/
│   │       ├── adc_service.py   # Thread-safe Google ADC Token Manager with auto-refresh
│   │       ├── gemini_client.py # Translation engine (OpenAI <-> Gemini) & SSE streaming
│   │       └── key_service.py   # Cryptographic key hashing (SHA-256) & telemetry
│   ├── .env.example             # Environment template
│   ├── .env                     # Local settings
│   └── requirements.txt         # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.tsx       # Brand, live ADC status badge, copy Base URL
│   │   │   ├── KeyManager.tsx   # One-time secret reveal modal, revocation, key list
│   │   │   ├── ModelCatalog.tsx # Gemini models table, context window limits, chips
│   │   │   ├── Playground.tsx   # Live prompt runner with real-time SSE stream & latency
│   │   │   ├── CodeDocs.tsx     # Integration snippets (Python, JS, cURL, fetch)
│   │   │   └── Analytics.tsx    # Telemetry stat cards & recent request logs table
│   │   ├── types/index.ts       # TypeScript interfaces
│   │   ├── App.tsx              # Main dashboard view coordinator
│   │   ├── index.css            # Tailwind directives, dark mode glassmorphism
│   │   └── main.tsx
│   ├── package.json
│   ├── vite.config.ts           # Bundler config with proxy to backend
│   └── tailwind.config.js       # Custom dark theme color tokens
├── start_gateway.py             # Single-command runner for the entire stack
└── README.md
```

---

## Database Schema (SQLite via SQLAlchemy)

### 1. `api_keys` Table
Stores custom client API keys. Plaintext keys are **never stored** in the database; only SHA-256 hashes are persisted.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | String(36) | Primary Key (UUID4) |
| `name` | String(100) | Label (e.g. "Cursor IDE", "Production Backend") |
| `key_hash` | String(64) | SHA-256 hash of the secret key (indexed, unique) |
| `key_prefix` | String(20) | Prefix (e.g. `sk-gem-live-`) |
| `key_suffix` | String(10) | Last 4 characters for identification |
| `created_at` | DateTime | Timestamp of creation (UTC) |
| `expires_at` | DateTime | Optional expiration timestamp |
| `is_active` | Boolean | Whether key is active or revoked |
| `request_count`| Integer | Total proxied requests made |
| `total_tokens` | Integer | Cumulative tokens consumed |
| `last_used_at` | DateTime | Timestamp of most recent request |

### 2. `request_logs` Table
Tracks every proxied completion request for real-time telemetry and auditing.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | String(36) | Primary Key (UUID4) |
| `key_id` | String(36) | Foreign Key to `api_keys.id` |
| `key_name` | String(100)| Cached name of the API key |
| `endpoint` | String(100)| Request endpoint (`/v1/chat/completions`) |
| `model` | String(100)| Model requested (e.g. `gemini-2.5-flash`) |
| `status_code` | Integer | HTTP response status (200, 401, 500) |
| `latency_ms` | Float | Roundtrip response time in milliseconds |
| `prompt_tokens` | Integer | Tokens in prompt |
| `completion_tokens` | Integer | Tokens generated |
| `total_tokens` | Integer | Sum of prompt and completion tokens |
| `is_stream` | Boolean | True if requested via SSE stream |
| `error_message`| Text | Error details if request failed |
| `created_at` | DateTime | Timestamp of request (UTC) |

---

## Prerequisites: Google Cloud ADC Setup

1. **Install Google Cloud SDK:**
   Verify `gcloud` is installed:
   ```bash
   gcloud --version
   ```

2. **Authenticate with Application Default Credentials (ADC):**
   Run the following command in your terminal and sign in with your Google Cloud account:
   ```bash
   gcloud auth application-default login
   ```
   This generates the credentials file locally (e.g. at `%APPDATA%\gcloud\application_default_credentials.json` on Windows or `~/.config/gcloud/application_default_credentials.json` on macOS/Linux).

3. **Set Active Project:**
   ```bash
   gcloud config set project YOUR_GCP_PROJECT_ID
   ```
   Ensure the Vertex AI API is enabled:
   ```bash
   gcloud services enable aiplatform.googleapis.com
   ```

---

## Quick Start Guide

### Step 1: Install Dependencies
1. **Python Dependencies:**
   ```bash
   pip install -r backend/requirements.txt
   ```

2. **Frontend Dependencies & Build:**
   ```bash
   cd frontend
   npm install
   npm run build
   cd ..
   ```

### Step 2: Start the Server
Run the unified launcher:
```bash
python start_gateway.py
```

The gateway will start on **`http://localhost:8000`**:
- **Developer Portal Dashboard:** `http://localhost:8000/`
- **OpenAI Compatible Base URL:** `http://localhost:8000/v1`
- **Swagger Interactive API Docs:** `http://localhost:8000/docs`
- **Health Check Endpoint:** `http://localhost:8000/health`

---

## Verification & Usage Examples

### 1. Generate an API Key
Open `http://localhost:8000/` in your browser and click **"Generate New Key"**, or generate via API:
```bash
curl -X POST "http://localhost:8000/api/keys" \
  -H "Content-Type: application/json" \
  -d '{"name": "CLI Test Key"}'
```
*Response:*
```json
{
  "id": "18ac89f8-b391-4475-8167-27bba096ba18",
  "name": "CLI Test Key",
  "secret_key": "sk-gem-live-XXXXXXXXXXXXXXX",
  "masked_key": "sk-gem-live-••••••••XXXX",
  "is_active": true
}
```

---

### 2. Test Non-Streaming Chat Completion via cURL
```bash
curl -X POST "http://localhost:8000/v1/chat/completions" \
  -H "Authorization: Bearer sk-gem-live-YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini-2.5-flash",
    "messages": [
      {"role": "system", "content": "You are a concise assistant."},
      {"role": "user", "content": "Hello! What is your name?"}
    ],
    "temperature": 0.5
  }'
```

---

### 3. Test Real-Time SSE Streaming via cURL
```bash
curl -N -X POST "http://localhost:8000/v1/chat/completions" \
  -H "Authorization: Bearer sk-gem-live-YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini-2.5-flash",
    "messages": [
      {"role": "user", "content": "Count from 1 to 5"}
    ],
    "stream": true
  }'
```

---

### 4. Integration with Official OpenAI Python SDK
Simply point `base_url` to `http://localhost:8000/v1`:

```python
from openai import OpenAI

# Drop-in replacement!
client = OpenAI(
    base_url="http://localhost:8000/v1",
    api_key="sk-gem-live-YOUR_KEY"
)

# Standard non-streaming
response = client.chat.completions.create(
    model="gemini-2.5-flash",
    messages=[
        {"role": "system", "content": "You are a code tutor."},
        {"role": "user", "content": "Write a Python fibonacci generator."}
    ]
)
print(response.choices[0].message.content)

# Real-time streaming
stream = client.chat.completions.create(
    model="gemini-2.5-pro",
    messages=[{"role": "user", "content": "Explain gravity to a 5-year-old."}],
    stream=True
)
for chunk in stream:
    token = chunk.choices[0].delta.content or ""
    print(token, end="", flush=True)
```

---

### 5. Integration with Official OpenAI Node / TypeScript SDK
```typescript
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "http://localhost:8000/v1",
  apiKey: "sk-gem-live-YOUR_KEY",
});

async function main() {
  const stream = await client.chat.completions.create({
    model: "gemini-2.5-flash",
    messages: [{ role: "user", content: "Write a haiku about APIs." }],
    stream: true,
  });

  for await (const chunk of stream) {
    process.stdout.write(chunk.choices[0]?.delta?.content || "");
  }
}

main();
```

---

### 6. Cursor AI / IDE Integration
1. Open **Cursor Settings** > **Models**.
2. Enable custom OpenAI API Key.
3. Set **Override OpenAI Base URL** to:
   ```
   http://localhost:8000/v1
   ```
4. Enter your generated `sk-gem-live-...` key.
5. Add model `gemini-2.5-flash` or `gemini-2.5-pro`.

---

### 7. Claude Code CLI Integration
Claude Code communicates via the Anthropic Messages API. Point Claude Code to this gateway using your generated key:

**Windows PowerShell:**
```powershell
$env:ANTHROPIC_BASE_URL = "http://localhost:8000"
$env:ANTHROPIC_AUTH_TOKEN = "sk-gem-live-YOUR_KEY"
$env:ANTHROPIC_API_KEY = "sk-gem-live-YOUR_KEY"

# Start Claude Code
claude
```

**macOS / Linux (Bash / Zsh):**
```bash
export ANTHROPIC_BASE_URL="http://localhost:8000"
export ANTHROPIC_AUTH_TOKEN="sk-gem-live-YOUR_KEY"
export ANTHROPIC_API_KEY="sk-gem-live-YOUR_KEY"

# Start Claude Code
claude
```

*Every key automatically authorizes both OpenAI and Anthropic endpoints. Claude model names (`claude-3-7-sonnet`, `claude-3-5-sonnet`, `claude-3-5-haiku`) automatically route to the corresponding Gemini model!*

---

### 8. Official Anthropic Python & Node.js SDKs

**Python (`anthropic`):**
```python
import anthropic

client = anthropic.Anthropic(
    base_url="http://localhost:8000",
    api_key="sk-gem-live-YOUR_KEY"
)

message = client.messages.create(
    model="claude-3-5-sonnet-20241022",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Hello from Anthropic SDK!"}]
)
print(message.content[0].text)
```

**Node.js (`@anthropic-ai/sdk`):**
```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  baseURL: "http://localhost:8000",
  apiKey: "sk-gem-live-YOUR_KEY",
});

const response = await client.messages.create({
  model: "claude-3-5-sonnet-20241022",
  max_tokens: 1024,
  messages: [{ role: "user", content: "Hello from Anthropic SDK!" }],
});
console.log(response.content[0].text);
```

---

## Supported Gemini & Claude Model Aliases

| Model ID | Context Window | Max Output | Modalities | Best For |
| :--- | :--- | :--- | :--- | :--- |
| **`gemini-2.5-flash`** | 1,048,576 | 8,192 | Text, Code, Vision, Audio | High-speed interactive chat, agent loops, reasoning |
| **`gemini-2.5-pro`** | 2,097,152 | 8,192 | Text, Code, Vision, Audio, Video | Deep reasoning, large codebases, complex analysis |
| **`gemini-2.5-flash-lite`** | 1,048,576 | 8,192 | Text, Code, Vision | Lowest latency, high-throughput extraction |
| **`gemini-3.8-flash`** | 1,048,576 | 8,192 | Text, Code, Vision, Audio | Frontier reasoning & multimodal capabilities |

*Aliases supported automatically:* `gemini-1.5-flash`, `gemini-1.5-pro`, `gpt-4o`, `gpt-4o-mini`, `gpt-3.5-turbo`.

---

## Security Highlights
- **No Stored GCP Keys:** The gateway directly accesses the local workstation's ADC token cache via Google's official library.
- **SHA-256 Key Hashing:** Custom API keys (`sk-gem-...`) are hashed before being stored in SQLite. Only the hash is verified on incoming requests.
- **Proactive Token Refresh:** ADC access tokens are automatically refreshed 5 minutes before expiration in a thread-safe manner.
- **Granular Revocation:** Compromised keys can be revoked immediately from the Developer Portal with instant enforcement.
