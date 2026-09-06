import React, { useState } from 'react';
import { 
  Key, 
  Cpu, 
  Terminal, 
  Code2, 
  Activity, 
  Check, 
  Copy, 
  Cloud 
} from 'lucide-react';
import { GcpStatus } from '../types';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  gcpStatus: GcpStatus | null;
  baseUrl: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  gcpStatus,
  baseUrl,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopyBaseUrl = () => {
    navigator.clipboard.writeText(baseUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const navItems = [
    { id: 'keys', label: 'API Keys', icon: Key },
    { id: 'models', label: 'Model Catalog', icon: Cpu },
    { id: 'playground', label: 'Playground', icon: Terminal },
    { id: 'docs', label: 'Integration Docs', icon: Code2 },
    { id: 'analytics', label: 'Logs & Metrics', icon: Activity },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 transition-colors">
      <div className="max-w-[1820px] mx-auto px-6 sm:px-10 lg:px-12">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Label */}
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center shadow-xs">
              <Cloud className="w-4 h-4 text-white" />
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="font-semibold text-base text-slate-900 tracking-tight">
                Gemini Gateway
              </span>
              <span className="text-[11px] font-medium tracking-wide text-slate-500 hidden sm:inline">
                OpenAI & Anthropic Gateway
              </span>
            </div>
          </div>

          {/* Segmented Tab Navigation */}
          <nav className="hidden md:flex items-center bg-slate-100/90 p-1 rounded-lg border border-slate-200/60">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-white text-slate-900 shadow-xs border border-slate-200/70 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-slate-900' : 'text-slate-500'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Status Actions */}
          <div className="flex items-center space-x-3">
            {/* Base URL Pill */}
            <div className="hidden lg:flex items-center bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1 text-xs text-slate-700 font-mono">
              <span className="text-slate-400 select-none mr-1.5 font-sans">URL:</span>
              <span className="font-medium text-slate-900 mr-2">{baseUrl}</span>
              <button
                onClick={handleCopyBaseUrl}
                title="Copy Base URL"
                className="p-1 hover:bg-slate-200/70 rounded text-slate-500 hover:text-slate-800 transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* ADC Status Pill */}
            <div className="flex items-center space-x-2 px-2.5 py-1 rounded-md bg-slate-50 border border-slate-200 text-xs">
              <span className="relative flex h-2 w-2">
                {gcpStatus?.adc_connected ? (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </>
                ) : (
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                )}
              </span>
              <span className="font-mono text-slate-700 text-[11px]">
                {gcpStatus?.adc_connected ? (
                  <span className="text-slate-700">
                    ADC: <strong className="text-slate-900 font-medium">{gcpStatus.project_id || 'Active'}</strong>
                  </span>
                ) : (
                  <span className="text-rose-600 font-medium">ADC Offline</span>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Row */}
        <div className="md:hidden flex items-center justify-around py-2 border-t border-slate-100">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex flex-col items-center py-1 px-2 text-xs font-medium ${
                  isActive ? 'text-slate-900 font-semibold' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Icon className="w-4 h-4 mb-0.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
