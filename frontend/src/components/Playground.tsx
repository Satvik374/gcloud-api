import React, { useState } from 'react';
import { 
  Play, 
  Sparkles, 
  Check, 
  Copy, 
  Clock, 
  Zap, 
  AlertCircle 
} from 'lucide-react';
import { ModelCatalogItem, ApiKeyItem } from '../types';

interface PlaygroundProps {
  models: ModelCatalogItem[];
  apiKeys: ApiKeyItem[];
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  activeSecretKey: string;
  setActiveSecretKey: (key: string) => void;
  baseUrl: string;
}

export const Playground: React.FC<PlaygroundProps> = ({
  models,
  apiKeys,
  selectedModel,
  setSelectedModel,
  activeSecretKey,
  setActiveSecretKey,
  baseUrl,
}) => {
  const [systemPrompt, setSystemPrompt] = useState('You are an expert Google Gemini AI assistant acting through an OpenAI-compatible Gateway.');
  const [userPrompt, setUserPrompt] = useState('Explain why Google Gemini 2.5 Flash is ideal for low-latency agentic workflows in 3 bullet points.');
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(1000);
  const [isStreaming, setIsStreaming] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [responseContent, setResponseContent] = useState('');
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [tokenStats, setTokenStats] = useState<{ prompt: number; completion: number; total: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [rawResponse, setRawResponse] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);

  const handleSend = async () => {
    if (!activeSecretKey.trim()) {
      setErrorMsg('Please select or paste an active API Key (e.g. sk-gem-live-...) to authenticate.');
      return;
    }

    if (!userPrompt.trim()) return;

    setIsLoading(true);
    setErrorMsg(null);
    setResponseContent('');
    setRawResponse(null);
    setTokenStats(null);
    setLatencyMs(null);

    const startTime = performance.now();

    const payload = {
      model: selectedModel || 'gemini-2.5-flash',
      messages: [
        ...(systemPrompt.trim() ? [{ role: 'system', content: systemPrompt.trim() }] : []),
        { role: 'user', content: userPrompt.trim() },
      ],
      temperature,
      max_tokens: maxTokens,
      stream: isStreaming,
    };

    try {
      const response = await fetch('/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${activeSecretKey.trim()}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => null);
        throw new Error(errJson?.error?.message || `Request failed with status ${response.status}`);
      }

      if (isStreaming && response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = '';
        let streamDone = false;

        while (!streamDone) {
          const { value, done } = await reader.read();
          if (done) break;

          const textChunk = decoder.decode(value, { stream: true });
          const lines = textChunk.split('\n');

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data:')) continue;
            const dataStr = trimmed.replace(/^data:\s*/, '');

            if (dataStr === '[DONE]') {
              streamDone = true;
              break;
            }

            try {
              const parsed = JSON.parse(dataStr);
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) {
                accumulated += delta;
                setResponseContent(accumulated);
              }
              if (parsed.usage) {
                setTokenStats({
                  prompt: parsed.usage.prompt_tokens,
                  completion: parsed.usage.completion_tokens,
                  total: parsed.usage.total_tokens,
                });
              }
            } catch (e) {
              // Ignore partial JSON
            }
          }
        }
        setLatencyMs(Math.round(performance.now() - startTime));
      } else {
        const data = await response.json();
        setRawResponse(JSON.stringify(data, null, 2));
        setResponseContent(data.choices?.[0]?.message?.content || '');
        if (data.usage) {
          setTokenStats({
            prompt: data.usage.prompt_tokens,
            completion: data.usage.completion_tokens,
            total: data.usage.total_tokens,
          });
        }
        setLatencyMs(Math.round(performance.now() - startTime));
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred during generation');
    } finally {
      setIsLoading(false);
    }
  };

  const copyResponse = () => {
    navigator.clipboard.writeText(responseContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
        <h2 className="text-lg font-semibold text-slate-900 tracking-tight flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-slate-700" />
          Interactive API Playground
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Test chat completions and real-time streaming directly through your local ADC gateway.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Form Controls & Prompts (6 cols) */}
        <div className="lg:col-span-6 space-y-4">
          {/* Key & Model Selector */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-medium uppercase tracking-wider text-slate-500 mb-1.5">
                  Gemini Model
                </label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                >
                  {models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.id})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium uppercase tracking-wider text-slate-500 mb-1.5">
                  Authorization Key
                </label>
                <input
                  type="text"
                  placeholder="Paste sk-gem-live-..."
                  value={activeSecretKey}
                  onChange={(e) => setActiveSecretKey(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                />
              </div>
            </div>

            {/* Hyperparameters row */}
            <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <div className="flex justify-between mb-1 text-slate-500 text-[11px]">
                  <span>Temperature</span>
                  <span className="font-mono text-slate-900 font-medium">{temperature}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  className="w-full accent-slate-900 h-1 bg-slate-200 rounded-lg cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1 text-slate-500 text-[11px]">
                  <span>Max Tokens</span>
                  <span className="font-mono text-slate-900 font-medium">{maxTokens}</span>
                </div>
                <input
                  type="number"
                  min="50"
                  max="8192"
                  step="50"
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(parseInt(e.target.value, 10))}
                  className="w-full px-2.5 py-1 bg-white border border-slate-300 rounded-md text-xs text-slate-900"
                />
              </div>

              <div className="flex items-center justify-between sm:justify-center gap-2 pt-2 sm:pt-0">
                <span className="text-slate-600 text-xs">Stream SSE:</span>
                <button
                  type="button"
                  onClick={() => setIsStreaming(!isStreaming)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-150 ease-in-out ${
                    isStreaming ? 'bg-slate-900' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-150 ease-in-out ${
                      isStreaming ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* System Prompt Input */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <label className="block text-[11px] font-medium uppercase tracking-wider text-slate-500 mb-1.5">
              System Instruction
            </label>
            <textarea
              rows={2}
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="e.g. You are a helpful technical assistant..."
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 resize-none font-sans"
            />
          </div>

          {/* User Prompt Input */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <label className="block text-[11px] font-medium uppercase tracking-wider text-slate-500 mb-1.5">
              User Message
            </label>
            <textarea
              rows={4}
              value={userPrompt}
              onChange={(e) => setUserPrompt(e.target.value)}
              placeholder="Enter your query prompt..."
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 resize-none font-sans"
            />

            <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
              <span className="text-[11px] text-slate-400 font-mono">
                POST /v1/chat/completions
              </span>
              <button
                onClick={handleSend}
                disabled={isLoading || !userPrompt.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs disabled:opacity-50 shadow-xs transition-colors cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3 h-3 fill-current" />
                    <span>Run Query</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Output Paper (6 cols) */}
        <div className="lg:col-span-6 flex flex-col">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex-1 flex flex-col min-h-[520px]">
            {/* Output Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                  Model Output
                </span>
                {isStreaming && isLoading && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 font-medium bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                    Streaming
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {rawResponse && (
                  <button
                    onClick={() => setShowRaw(!showRaw)}
                    className={`text-[11px] px-2 py-0.5 rounded border transition-colors ${
                      showRaw ? 'bg-slate-900 text-white border-slate-900' : 'text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    Raw JSON
                  </button>
                )}
                {responseContent && (
                  <button
                    onClick={copyResponse}
                    className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded transition-colors"
                    title="Copy output"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>
            </div>

            {/* Output Content Area */}
            <div className="flex-1 overflow-y-auto pr-1 bg-slate-50/70 border border-slate-200/80 rounded-lg p-3.5">
              {errorMsg ? (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              ) : showRaw && rawResponse ? (
                <pre className="text-xs font-mono text-slate-800 bg-white p-3 rounded border border-slate-200 overflow-x-auto whitespace-pre-wrap">
                  {rawResponse}
                </pre>
              ) : responseContent ? (
                <div className="text-xs text-slate-900 leading-relaxed whitespace-pre-wrap font-sans">
                  {responseContent}
                  {isLoading && <span className="inline-block w-1.5 h-3.5 ml-0.5 bg-slate-900 animate-pulse" />}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 text-xs">
                  <Zap className="w-7 h-7 text-slate-300 mb-2" />
                  <span>Output response will stream here</span>
                </div>
              )}
            </div>

            {/* Output Footer with Latency and Token counts */}
            {(latencyMs !== null || tokenStats) && (
              <div className="pt-3 border-t border-slate-100 mt-3 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                {latencyMs !== null && (
                  <span className="flex items-center gap-1 text-slate-700 font-medium">
                    <Clock className="w-3 h-3 text-slate-400" />
                    {latencyMs} ms
                  </span>
                )}
                {tokenStats && (
                  <span className="text-slate-600 tabular-nums">
                    {tokenStats.prompt} in / {tokenStats.completion} out ({tokenStats.total} total)
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
