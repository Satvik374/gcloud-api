import React, { useState } from 'react';
import { 
  Key, 
  Plus, 
  Copy, 
  Check, 
  Trash2, 
  Ban, 
  ShieldAlert, 
  CheckCircle2, 
  Clock, 
  Sparkles,
  Terminal,
  Activity,
  Globe
} from 'lucide-react';
import { ApiKeyItem, ApiKeyCreatedResponse } from '../types';

interface KeyManagerProps {
  keys: ApiKeyItem[];
  onRefreshKeys: () => void;
  onSelectKeyForPlayground: (key: string) => void;
}

export const KeyManager: React.FC<KeyManagerProps> = ({
  keys,
  onRefreshKeys,
  onSelectKeyForPlayground,
}) => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [expiresDays, setExpiresDays] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdKey, setCreatedKey] = useState<ApiKeyCreatedResponse | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyName.trim()) return;

    setIsSubmitting(true);
    setActionError(null);
    try {
      const res = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: keyName.trim(),
          expires_in_days: expiresDays ? parseInt(expiresDays, 10) : null,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to create key');
      }

      const data: ApiKeyCreatedResponse = await res.json();
      setCreatedKey(data);
      setKeyName('');
      setExpiresDays('');
      setIsCreateModalOpen(false);
      onRefreshKeys();
    } catch (err: any) {
      setActionError(err.message || 'Error generating API key');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevokeKey = async (id: string) => {
    if (!confirm('Are you sure you want to revoke this API key? Applications using it will immediately be rejected.')) {
      return;
    }
    try {
      const res = await fetch(`/api/keys/${id}/revoke`, { method: 'POST' });
      if (res.ok) {
        onRefreshKeys();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteKey = async (id: string) => {
    if (!confirm('Are you sure you want to delete this API key record?')) {
      return;
    }
    try {
      const res = await fetch(`/api/keys/${id}`, { method: 'DELETE' });
      if (res.ok) {
        onRefreshKeys();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 tracking-tight flex items-center gap-2">
            <Key className="w-4 h-4 text-slate-700" />
            API Key Management
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Generate and manage custom API keys. Every key automatically works for both <strong>OpenAI</strong> and <strong>Anthropic / Claude Code</strong> endpoints.
          </p>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium shadow-xs transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Generate New Key</span>
        </button>
      </div>

      {/* Secret Key Revealed Once Modal */}
      {createdKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-xl p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-2 text-slate-900 mb-2">
              <Sparkles className="w-5 h-5 text-amber-600" />
              <h3 className="text-base font-semibold text-slate-900">Save Your Secret Key</h3>
            </div>
            
            <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-lg mb-3 text-xs text-amber-800 flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                <strong>Crucial:</strong> Copy this API key right now. For security purposes, it is stored hashed and will <strong>never</strong> be displayed again.
              </span>
            </div>

            <div className="p-2.5 bg-emerald-50 border border-emerald-200/80 rounded-lg mb-4 text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                <strong>Automatic Dual Support:</strong> This key automatically authenticates both <strong>OpenAI</strong> (Bearer) and <strong>Anthropic / Claude Code</strong> (x-api-key) endpoints!
              </span>
            </div>

            <div className="mb-3">
              <label className="block text-[11px] font-medium uppercase tracking-wider text-slate-500 mb-1">Key Name</label>
              <div className="text-xs font-medium text-slate-900">{createdKey.name}</div>
            </div>

            <div className="mb-5">
              <label className="block text-[11px] font-medium uppercase tracking-wider text-slate-500 mb-1">Secret Key</label>
              <div className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <code className="text-xs font-mono text-slate-900 break-all flex-1 select-all font-medium">
                  {createdKey.secret_key}
                </code>
                <button
                  onClick={() => copyToClipboard(createdKey.secret_key)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 rounded-md text-xs font-medium border border-slate-200 transition-colors shadow-xs"
                >
                  {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-600" />}
                  <span>{copiedKey ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  onSelectKeyForPlayground(createdKey.secret_key);
                  setCreatedKey(null);
                }}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200/80 text-slate-700 text-xs font-medium rounded-lg transition-colors"
              >
                Test in Playground
              </button>
              <button
                onClick={() => setCreatedKey(null)}
                className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg transition-colors shadow-xs"
              >
                I Have Saved It
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Key Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-6 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900 mb-1">Create API Key</h3>
            <p className="text-xs text-slate-500 mb-4">
              Enter a descriptive label to identify the client application using this key.
            </p>

            <form onSubmit={handleCreateKey} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Key Label / Application Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Production Backend, Cursor IDE"
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Expiration (Optional)
                </label>
                <select
                  value={expiresDays}
                  onChange={(e) => setExpiresDays(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-colors"
                >
                  <option value="">Never Expires</option>
                  <option value="7">7 Days</option>
                  <option value="30">30 Days</option>
                  <option value="90">90 Days</option>
                  <option value="365">1 Year</option>
                </select>
              </div>

              {actionError && (
                <p className="text-xs text-rose-600">{actionError}</p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !keyName.trim()}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors shadow-xs"
                >
                  {isSubmitting ? 'Generating...' : 'Create Key'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Overview KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500 block mb-1">
              Active API Keys
            </span>
            <div className="text-2xl font-bold font-mono text-slate-900">
              {keys.filter(k => k.is_active).length} <span className="text-xs font-sans font-normal text-slate-400">/ {keys.length} total</span>
            </div>
            <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1 mt-1">
              <CheckCircle2 className="w-3 h-3" /> All active keys ready for auth
            </span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center">
            <Key className="w-5 h-5 text-slate-700" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500 block mb-1">
              Proxied Traffic Handled
            </span>
            <div className="text-2xl font-bold font-mono text-slate-900">
              {keys.reduce((sum, k) => sum + k.request_count, 0).toLocaleString()} <span className="text-xs font-sans font-normal text-slate-400">requests</span>
            </div>
            <span className="text-[11px] text-slate-500 font-mono mt-1 block">
              {keys.reduce((sum, k) => sum + k.total_tokens, 0).toLocaleString()} tokens consumed
            </span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center">
            <Activity className="w-5 h-5 text-slate-700" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500 block mb-1">
              Gateway Target
            </span>
            <div className="text-sm font-semibold font-mono text-slate-900 truncate max-w-[280px]">
              /v1/chat/completions
            </div>
            <span className="text-[11px] text-slate-500 flex items-center gap-1 mt-1">
              <Globe className="w-3 h-3 text-slate-400" /> Drop-in OpenAI provider
            </span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center">
            <Globe className="w-5 h-5 text-slate-700" />
          </div>
        </div>
      </div>

      {/* Keys Table Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-8 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-900 text-xs tracking-tight">Active API Keys</span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-mono">
              {keys.length}
            </span>
          </div>
          <button
            onClick={onRefreshKeys}
            className="text-xs text-slate-500 hover:text-slate-900 transition-colors"
          >
            Refresh
          </button>
        </div>

        {keys.length === 0 ? (
          <div className="p-12 text-center">
            <Key className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs text-slate-700 font-medium">No API keys created yet</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Generate an API key to begin routing requests through your gateway.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-slate-500 font-medium uppercase tracking-wider border-b border-slate-200 text-[11px]">
                <tr>
                  <th className="px-8 py-3.5">Label</th>
                  <th className="px-8 py-3.5">Key Token</th>
                  <th className="px-8 py-3.5">Status</th>
                  <th className="px-8 py-3.5">Requests</th>
                  <th className="px-8 py-3.5">Tokens</th>
                  <th className="px-8 py-3.5">Created</th>
                  <th className="px-8 py-3.5">Last Used</th>
                  <th className="px-8 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {keys.map((k) => (
                  <tr key={k.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-8 py-4 font-medium text-slate-900">
                      {k.name}
                    </td>
                    <td className="px-8 py-4 font-mono text-slate-700">
                      <span className="bg-slate-50 px-2 py-1 rounded border border-slate-200 font-medium">
                        {k.masked_key}
                      </span>
                    </td>
                    <td className="px-8 py-4">
                      {k.is_active ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200">
                          <Ban className="w-3 h-3" />
                          Revoked
                        </span>
                      )}
                    </td>
                    <td className="px-8 py-4 font-mono text-slate-700 tabular-nums">
                      {k.request_count.toLocaleString()}
                    </td>
                    <td className="px-8 py-4 font-mono text-slate-700 tabular-nums">
                      {k.total_tokens.toLocaleString()}
                    </td>
                    <td className="px-8 py-4 text-slate-500">
                      {k.created_at ? new Date(k.created_at).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-8 py-4 text-slate-500">
                      {k.last_used_at ? new Date(k.last_used_at).toLocaleTimeString() : 'Never'}
                    </td>
                    <td className="px-8 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => onSelectKeyForPlayground(k.masked_key)}
                          title="Open Key in Playground"
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md transition-colors"
                        >
                          <Terminal className="w-3 h-3 text-slate-500" />
                          <span>Test</span>
                        </button>
                        {k.is_active && (
                          <button
                            onClick={() => handleRevokeKey(k.id)}
                            title="Revoke Key"
                            className="p-1.5 text-slate-400 hover:text-amber-700 hover:bg-slate-100 rounded transition-colors"
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteKey(k.id)}
                          title="Delete Key"
                          className="p-1.5 text-slate-400 hover:text-rose-700 hover:bg-slate-100 rounded transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
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
