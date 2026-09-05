import React, { useState } from 'react';
import { 
  Cpu, 
  Copy, 
  Check, 
  ArrowRight, 
  FileText, 
  Zap, 
  Eye, 
  Mic 
} from 'lucide-react';
import { ModelCatalogItem } from '../types';

interface ModelCatalogProps {
  models: ModelCatalogItem[];
  onSelectModel: (modelId: string) => void;
}

export const ModelCatalog: React.FC<ModelCatalogProps> = ({
  models,
  onSelectModel,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getModalityIcon = (mod: string) => {
    switch (mod.toLowerCase()) {
      case 'vision': return <Eye className="w-3 h-3 text-slate-600" />;
      case 'audio': return <Mic className="w-3 h-3 text-slate-600" />;
      default: return <FileText className="w-3 h-3 text-slate-600" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 tracking-tight flex items-center gap-2">
            <Cpu className="w-4 h-4 text-slate-700" />
            Supported Gemini Models
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Frontier Google Gemini models available via your local ADC gateway. Pass any of these Model IDs into standard OpenAI SDK requests.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <span className="px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg font-medium">
            {models.length} Models Available
          </span>
          <span className="px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg font-medium">
            Multimodal & SSE
          </span>
        </div>
      </div>

      {/* Model Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {models.map((model) => (
          <div
            key={model.id}
            className="bg-white rounded-xl border border-slate-200 p-6 flex flex-col justify-between shadow-xs hover:border-slate-300 transition-all"
          >
            <div>
              {/* Header row: Model Name and Badge */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                    {model.name}
                    {model.is_default && (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                        Default
                      </span>
                    )}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-mono text-slate-600 bg-slate-50 px-2 py-0.5 rounded border border-slate-200 flex items-center gap-1.5 font-medium">
                      {model.id}
                      <button
                        onClick={() => handleCopy(model.id)}
                        className="hover:text-slate-900 text-slate-400 transition-colors"
                        title="Copy Model ID"
                      >
                        {copiedId === model.id ? (
                          <Check className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </span>
                  </div>
                </div>

                <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                  <Zap className="w-4 h-4 text-slate-700" />
                </div>
              </div>

              {/* Description */}
              <p className="text-xs text-slate-600 mt-2.5 leading-relaxed">
                {model.description}
              </p>

              {/* Specs Metric Row */}
              <div className="grid grid-cols-2 gap-3 my-4 p-3 bg-slate-50/70 rounded-lg border border-slate-200/80 text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-medium">
                    Context Window
                  </span>
                  <span className="font-mono text-slate-900 font-semibold tabular-nums">
                    {(model.context_window / 1000).toLocaleString()}k tokens
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-medium">
                    Max Output
                  </span>
                  <span className="font-mono text-slate-900 font-semibold tabular-nums">
                    {model.max_output_tokens.toLocaleString()} tokens
                  </span>
                </div>
              </div>

              {/* Modalities */}
              <div className="mb-4">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-medium mb-1.5">
                  Supported Modalities
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {model.modalities.map((mod) => (
                    <span
                      key={mod}
                      className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-white text-slate-700 border border-slate-200"
                    >
                      {getModalityIcon(mod)}
                      {mod}
                    </span>
                  ))}
                </div>
              </div>

              {/* Recommended Use */}
              <div className="text-xs text-slate-500 mb-4">
                <span className="font-medium text-slate-700">Best for: </span>
                {model.recommended_use}
              </div>
            </div>

            {/* Action Footer */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[11px] text-slate-400 font-mono">
                Publisher: {model.publisher}
              </span>
              <button
                onClick={() => onSelectModel(model.id)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-slate-900 hover:text-slate-700 transition-colors"
              >
                <span>Launch in Playground</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
