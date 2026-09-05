import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { KeyManager } from './components/KeyManager';
import { ModelCatalog } from './components/ModelCatalog';
import { Playground } from './components/Playground';
import { CodeDocs } from './components/CodeDocs';
import { Analytics } from './components/Analytics';
import { 
  ApiKeyItem, 
  GcpStatus, 
  ModelCatalogItem, 
  AnalyticsSummary 
} from './types';
import { Cloud, ShieldAlert } from 'lucide-react';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('keys');
  const [gcpStatus, setGcpStatus] = useState<GcpStatus | null>(null);
  const [models, setModels] = useState<ModelCatalogItem[]>([]);
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>('gemini-2.5-flash');
  const [activeSecretKey, setActiveSecretKey] = useState<string>('');

  const baseUrl = `${window.location.origin}/v1`;

  const fetchGcpStatus = async () => {
    try {
      const res = await fetch('/api/gcp/status');
      if (res.ok) {
        const data: GcpStatus = await res.json();
        setGcpStatus(data);
      }
    } catch (e) {
      console.error('Failed to fetch GCP status', e);
    }
  };

  const fetchModels = async () => {
    try {
      const res = await fetch('/api/models');
      if (res.ok) {
        const data: ModelCatalogItem[] = await res.json();
        setModels(data);
        if (data.length > 0 && !selectedModel) {
          setSelectedModel(data[0].id);
        }
      }
    } catch (e) {
      console.error('Failed to fetch models', e);
    }
  };

  const fetchKeys = async () => {
    try {
      const res = await fetch('/api/keys');
      if (res.ok) {
        const data: ApiKeyItem[] = await res.json();
        setKeys(data);
      }
    } catch (e) {
      console.error('Failed to fetch keys', e);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const res = await fetch('/api/analytics');
      if (res.ok) {
        const data: AnalyticsSummary = await res.json();
        setAnalytics(data);
      }
    } catch (e) {
      console.error('Failed to fetch analytics', e);
    }
  };

  useEffect(() => {
    fetchGcpStatus();
    fetchModels();
    fetchKeys();
    fetchAnalytics();

    const interval = setInterval(() => {
      fetchAnalytics();
      fetchGcpStatus();
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  const handleLaunchInPlayground = (modelId: string) => {
    setSelectedModel(modelId);
    setActiveTab('playground');
  };

  const handleSelectKeyForPlayground = (key: string) => {
    setActiveSecretKey(key);
    setActiveTab('playground');
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F9FA] text-slate-900 selection:bg-slate-900 selection:text-white">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        gcpStatus={gcpStatus}
        baseUrl={baseUrl}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-[1820px] w-full mx-auto px-6 sm:px-10 lg:px-12 py-8">
        {/* ADC Diagnostic Alert if not connected */}
        {gcpStatus && !gcpStatus.adc_connected && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
              <span>
                <strong>Application Default Credentials (ADC) Missing:</strong> Run{' '}
                <code className="bg-white px-2 py-0.5 rounded font-mono text-rose-900 border border-rose-200 font-medium">
                  gcloud auth application-default login
                </code>{' '}
                on your local machine to establish access.
              </span>
            </div>
            <button
              onClick={fetchGcpStatus}
              className="px-3 py-1 bg-white hover:bg-rose-100 text-rose-800 border border-rose-200 rounded-md font-medium transition-colors shadow-xs"
            >
              Verify
            </button>
          </div>
        )}

        {/* Tab Views */}
        {activeTab === 'keys' && (
          <KeyManager
            keys={keys}
            onRefreshKeys={fetchKeys}
            onSelectKeyForPlayground={handleSelectKeyForPlayground}
          />
        )}

        {activeTab === 'models' && (
          <ModelCatalog
            models={models}
            onSelectModel={handleLaunchInPlayground}
          />
        )}

        {activeTab === 'playground' && (
          <Playground
            models={models}
            apiKeys={keys}
            selectedModel={selectedModel}
            setSelectedModel={setSelectedModel}
            activeSecretKey={activeSecretKey}
            setActiveSecretKey={setActiveSecretKey}
            baseUrl={baseUrl}
          />
        )}

        {activeTab === 'docs' && (
          <CodeDocs
            baseUrl={baseUrl}
            apiKeys={keys}
            activeSecretKey={activeSecretKey}
          />
        )}

        {activeTab === 'analytics' && (
          <Analytics
            analytics={analytics}
            onRefresh={fetchAnalytics}
          />
        )}
      </main>

      {/* Formal Minimalist Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 text-xs text-slate-500">
        <div className="max-w-[1820px] mx-auto px-6 sm:px-10 lg:px-12 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-slate-600">
            <Cloud className="w-4 h-4 text-slate-700" />
            <span className="font-medium text-slate-800">Google Cloud Gemini Gateway</span>
            <span className="text-slate-300">•</span>
            <span className="font-mono text-slate-500">Project: {gcpStatus?.project_id || 'detecting...'}</span>
          </div>
          <div className="flex items-center gap-4 text-slate-500 text-[11px]">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              OpenAI Drop-In (/v1)
            </span>
            <span>Region: <strong className="text-slate-700 font-medium">{gcpStatus?.region || 'global'}</strong></span>
          </div>
        </div>
      </footer>
    </div>
  );
};
