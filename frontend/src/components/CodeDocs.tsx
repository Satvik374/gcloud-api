import React, { useState } from 'react';
import { 
  Code2, 
  Copy, 
  Check, 
  Terminal, 
  FileCode, 
  CheckCircle2,
  Globe,
  Layers,
  ShieldCheck
} from 'lucide-react';
import { ApiKeyItem } from '../types';

interface CodeDocsProps {
  baseUrl: string;
  apiKeys: ApiKeyItem[];
  activeSecretKey: string;
}

export const CodeDocs: React.FC<CodeDocsProps> = ({
  baseUrl,
  apiKeys,
  activeSecretKey,
}) => {
  const [selectedLang, setSelectedLang] = useState<'python-sdk' | 'python-requests' | 'js-sdk' | 'js-fetch' | 'curl'>('python-sdk');
  const [copied, setCopied] = useState(false);

  // Key to display in snippets
  const activeKeyDisplay = activeSecretKey.trim() || (apiKeys.length > 0 ? `${apiKeys[0].masked_key}` : 'sk-gem-live-YOUR_API_KEY');

  const languages = [
    { id: 'python-sdk', label: 'Python (OpenAI SDK)', icon: FileCode },
    { id: 'js-sdk', label: 'Node / JS (OpenAI SDK)', icon: FileCode },
    { id: 'curl', label: 'cURL', icon: Terminal },
    { id: 'python-requests', label: 'Python (requests)', icon: FileCode },
    { id: 'js-fetch', label: 'JavaScript (fetch)', icon: FileCode },
  ];

  const getCodeSnippet = (): string => {
    switch (selectedLang) {
      case 'python-sdk':
        return `# pip install openai
from openai import OpenAI

client = OpenAI(
    base_url="${baseUrl}",
    api_key="${activeKeyDisplay}"
)

# Standard non-streaming completion
response = client.chat.completions.create(
    model="gemini-2.5-flash",
    messages=[
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Explain quantum computing in one sentence."}
    ],
    temperature=0.7,
    max_tokens=200
)

print(response.choices[0].message.content)

# Real-time streaming
stream = client.chat.completions.create(
    model="gemini-2.5-flash",
    messages=[{"role": "user", "content": "Count from 1 to 5"}],
    stream=True
)

for chunk in stream:
    content = chunk.choices[0].delta.content or ""
    print(content, end="", flush=True)
`;

      case 'js-sdk':
        return `// npm install openai
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "${baseUrl}",
  apiKey: "${activeKeyDisplay}",
});

async function main() {
  const completion = await client.chat.completions.create({
    model: "gemini-2.5-flash",
    messages: [
      { role: "system", content: "You are a concise engineering assistant." },
      { role: "user", content: "What is an event-driven architecture?" },
    ],
    stream: true,
  });

  for await (const chunk of completion) {
    process.stdout.write(chunk.choices[0]?.delta?.content || "");
  }
}

main();
`;

      case 'curl':
        return `# Standard non-streaming request
curl -X POST "${baseUrl}/chat/completions" \\
  -H "Authorization: Bearer ${activeKeyDisplay}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "gemini-2.5-flash",
    "messages": [
      {"role": "user", "content": "Hello Gemini via ADC Gateway!"}
    ]
  }'

# Real-time streaming SSE request
curl -N -X POST "${baseUrl}/chat/completions" \\
  -H "Authorization: Bearer ${activeKeyDisplay}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "gemini-2.5-flash",
    "messages": [
      {"role": "user", "content": "Write a haiku about code."}
    ],
    "stream": true
  }'
`;

      case 'python-requests':
        return `import requests

url = "${baseUrl}/chat/completions"
headers = {
    "Authorization": "Bearer ${activeKeyDisplay}",
    "Content-Type": "application/json"
}
payload = {
    "model": "gemini-2.5-flash",
    "messages": [
        {"role": "user", "content": "Summarize Google Gemini multimodal features."}
    ],
    "temperature": 0.5
}

response = requests.post(url, json=payload, headers=headers)
data = response.json()
print("Gemini Response:", data["choices"][0]["message"]["content"])
`;

      case 'js-fetch':
        return `// Native Fetch with SSE Stream Reader
async function streamGemini() {
  const response = await fetch("${baseUrl}/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": "Bearer ${activeKeyDisplay}",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gemini-2.5-flash",
      messages: [{ role: "user", content: "Count down from 5 to 1" }],
      stream: true,
    }),
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split("\\n");

    for (const line of lines) {
      if (line.startsWith("data: ") && !line.includes("[DONE]")) {
        const json = JSON.parse(line.substring(6));
        const token = json.choices[0]?.delta?.content || "";
        process.stdout.write(token);
      }
    }
  }
}

streamGemini();
`;
      default:
        return '';
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(getCodeSnippet());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 tracking-tight flex items-center gap-2">
            <Code2 className="w-4 h-4 text-slate-700" />
            Integration Guide & SDK Snippets
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Your Gemini Gateway provides a 100% drop-in replacement for OpenAI SDKs, LangChain, and IDE extensions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-700">
            Base URL: <strong className="text-slate-900">{baseUrl}</strong>
          </span>
        </div>
      </div>

      {/* Main Documentation 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column (5 cols): Integration Architecture & Guides */}
        <div className="lg:col-span-5 space-y-4">
          {/* Quick Setup Card */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3 text-xs">
            <h3 className="font-semibold text-slate-900 text-xs flex items-center gap-2">
              <Globe className="w-4 h-4 text-slate-700" />
              Connection Specifications
            </h3>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 font-mono space-y-2">
              <div>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-sans">OpenAI Base URL</span>
                <span className="text-xs text-slate-900 font-medium select-all">{baseUrl}</span>
              </div>
              <div className="pt-2 border-t border-slate-200/60">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-sans">HTTP Auth Header</span>
                <span className="text-xs text-slate-900 font-medium">Authorization: Bearer &lt;YOUR_API_KEY&gt;</span>
              </div>
            </div>
          </div>

          {/* IDEs: Cursor & VS Code */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs text-xs">
            <h4 className="font-semibold text-slate-900 mb-1.5 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              Cursor IDE & VS Code
            </h4>
            <p className="text-slate-600 leading-relaxed">
              Open <strong>Cursor Settings &gt; Models &gt; OpenAI API Key</strong>. Override the Base URL with <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-slate-900">{baseUrl}</code> and enter your gateway key. Then add <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-900">gemini-2.5-flash</code> as model.
            </p>
          </div>

          {/* Frameworks: LangChain & LlamaIndex */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs text-xs">
            <h4 className="font-semibold text-slate-900 mb-1.5 flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600 shrink-0" />
              LangChain & LlamaIndex
            </h4>
            <p className="text-slate-600 leading-relaxed">
              Initialize with standard OpenAI classes: <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-900">ChatOpenAI(base_url="{baseUrl}", api_key="...")</code>. All tool calling, prompts, and agent chains route directly to Gemini.
            </p>
          </div>

          {/* Security: ADC */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs text-xs">
            <h4 className="font-semibold text-slate-900 mb-1.5 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              Zero-Exposure ADC Security
            </h4>
            <p className="text-slate-600 leading-relaxed">
              Never bundle service account JSON files or sensitive cloud keys into applications. The gateway runs locally, automatically signing requests using your local machine credentials.
            </p>
          </div>
        </div>

        {/* Right Column (7 cols): Interactive Code Terminal & Endpoints */}
        <div className="lg:col-span-7 flex flex-col space-y-4">
          {/* Code Snippet Card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col flex-1">
            {/* Language Tabs */}
            <div className="flex flex-wrap items-center justify-between border-b border-slate-200 bg-slate-50/70 px-4 py-2.5 gap-2">
              <div className="flex flex-wrap items-center gap-1">
                {languages.map((lang) => (
                  <button
                    key={lang.id}
                    onClick={() => setSelectedLang(lang.id as any)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                      selectedLang === lang.id
                        ? 'bg-white text-slate-900 shadow-xs border border-slate-200 font-semibold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                    }`}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>

              <button
                onClick={handleCopyCode}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 text-xs font-medium transition-colors shadow-xs"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                <span>{copied ? 'Copied' : 'Copy Snippet'}</span>
              </button>
            </div>

            {/* Code Content Editor Frame */}
            <div className="p-5 bg-slate-950 flex-1 overflow-x-auto min-h-[280px] max-h-[420px]">
              <pre className="text-xs font-mono text-slate-200 leading-relaxed">
                <code>{getCodeSnippet()}</code>
              </pre>
            </div>
          </div>

          {/* Endpoints Reference Strip */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
            <span className="text-[11px] font-semibold text-slate-900 uppercase tracking-wider block mb-2">
              Gateway Endpoints Reference
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                <span className="font-mono text-slate-900 font-semibold text-[11px] block">POST /v1/chat/completions</span>
                <span className="text-slate-500 text-[11px]">Chat completions & streaming SSE</span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                <span className="font-mono text-slate-900 font-semibold text-[11px] block">GET /v1/models</span>
                <span className="text-slate-500 text-[11px]">OpenAI model list schema</span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                <span className="font-mono text-slate-900 font-semibold text-[11px] block">GET /health</span>
                <span className="text-slate-500 text-[11px]">ADC status & health checks</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
