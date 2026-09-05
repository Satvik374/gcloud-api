import React, { useState } from 'react';
import { 
  Activity, 
  Clock, 
  Zap, 
  CheckCircle2, 
  RefreshCw, 
  Radio
} from 'lucide-react';
import { AnalyticsSummary } from '../types';

interface AnalyticsProps {
  analytics: AnalyticsSummary | null;
  onRefresh: () => void;
}

export const Analytics: React.FC<AnalyticsProps> = ({
  analytics,
  onRefresh,
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    onRefresh();
    setTimeout(() => setIsRefreshing(false), 800);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 tracking-tight flex items-center gap-2">
            <Activity className="w-4 h-4 text-slate-700" />
            Gateway Telemetry & Logs
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Real-time proxy telemetry, token usage consumption, latency benchmarks, and request logs.
          </p>
        </div>
        <button
          onClick={handleManualRefresh}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-medium transition-colors shadow-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-slate-900' : 'text-slate-500'}`} />
          <span>Refresh Telemetry</span>
        </button>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Requests */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-[11px] mb-2 font-medium">
            <span className="uppercase tracking-wider">Total Requests</span>
            <Activity className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {analytics ? analytics.total_requests.toLocaleString() : '0'}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Total calls proxied
          </div>
        </div>

        {/* Total Tokens */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-[11px] mb-2 font-medium">
            <span className="uppercase tracking-wider">Tokens Processed</span>
            <Zap className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {analytics ? analytics.total_tokens.toLocaleString() : '0'}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Prompt & completion tokens
          </div>
        </div>

        {/* Avg Latency */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-[11px] mb-2 font-medium">
            <span className="uppercase tracking-wider">Avg Latency</span>
            <Clock className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {analytics ? `${analytics.avg_latency_ms} ms` : '0 ms'}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Vertex AI roundtrip duration
          </div>
        </div>

        {/* Success Rate */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-[11px] mb-2 font-medium">
            <span className="uppercase tracking-wider">Success Rate</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {analytics ? `${analytics.success_rate}%` : '100%'}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            2xx successful responses
          </div>
        </div>
      </div>

      {/* Model Breakdown */}
      {analytics && Object.keys(analytics.model_breakdown).length > 0 && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
          <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider mb-3">
            Traffic Distribution by Model
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {Object.entries(analytics.model_breakdown).map(([modelName, count]) => {
              const pct = analytics.total_requests > 0 ? Math.round((count / analytics.total_requests) * 100) : 0;
              return (
                <div key={modelName} className="p-3.5 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex justify-between items-center text-xs mb-1.5">
                    <span className="font-mono text-slate-900 font-medium">{modelName}</span>
                    <span className="text-slate-500 font-mono text-[11px]">{count} reqs ({pct}%)</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-slate-900 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Request Logs Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-8 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-900 text-xs tracking-tight">Recent Proxied Requests</span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-mono">
              {analytics?.recent_logs.length || 0}
            </span>
          </div>
        </div>

        {!analytics || analytics.recent_logs.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-xs">
            No requests logged yet. Run a prompt in the Playground or make a request via cURL/SDK.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-slate-500 font-medium uppercase tracking-wider border-b border-slate-200 text-[11px]">
                <tr>
                  <th className="px-8 py-3.5">Time</th>
                  <th className="px-8 py-3.5">Model</th>
                  <th className="px-8 py-3.5">Key Label</th>
                  <th className="px-8 py-3.5">Status</th>
                  <th className="px-8 py-3.5">Type</th>
                  <th className="px-8 py-3.5">Latency</th>
                  <th className="px-8 py-3.5">Tokens (P/C)</th>
                  <th className="px-8 py-3.5">Endpoint</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {analytics.recent_logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-8 py-3.5 text-slate-500 font-sans">
                      {log.created_at ? new Date(log.created_at).toLocaleTimeString() : '-'}
                    </td>
                    <td className="px-8 py-3.5 text-slate-900 font-medium">
                      {log.model}
                    </td>
                    <td className="px-8 py-3.5 text-slate-600 font-sans">
                      {log.key_name || 'Anonymous'}
                    </td>
                    <td className="px-8 py-3.5">
                      {log.status_code >= 200 && log.status_code < 300 ? (
                        <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 font-sans">
                          {log.status_code} OK
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded font-medium bg-rose-50 text-rose-700 border border-rose-200 font-sans">
                          {log.status_code} Error
                        </span>
                      )}
                    </td>
                    <td className="px-8 py-3.5 font-sans">
                      {log.is_stream ? (
                        <span className="text-[11px] text-slate-700 font-medium flex items-center gap-1">
                          <Radio className="w-3 h-3 text-slate-500" /> SSE
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400">JSON</span>
                      )}
                    </td>
                    <td className="px-8 py-3.5 text-slate-700 tabular-nums">
                      {log.latency_ms} ms
                    </td>
                    <td className="px-8 py-3.5 text-slate-600 tabular-nums">
                      {log.prompt_tokens} / {log.completion_tokens}
                    </td>
                    <td className="px-8 py-3.5 text-slate-400 font-sans text-[11px]">
                      {log.endpoint}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
