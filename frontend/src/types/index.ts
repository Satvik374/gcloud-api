export interface ApiKeyItem {
  id: string;
  name: string;
  masked_key: string;
  created_at: string;
  expires_at: string | null;
  is_active: boolean;
  request_count: number;
  total_tokens: number;
  last_used_at: string | null;
}

export interface ApiKeyCreatedResponse extends ApiKeyItem {
  secret_key: string;
}

export interface GcpStatus {
  adc_connected: boolean;
  project_id: string;
  region: string;
  token_valid: boolean;
  token_expires_at: string | null;
  account_or_email: string | null;
  message: string;
}

export interface ModelCatalogItem {
  id: string;
  name: string;
  publisher: string;
  context_window: number;
  max_output_tokens: number;
  modalities: string[];
  description: string;
  recommended_use: string;
  is_default: boolean;
}

export interface RequestLogItem {
  id: string;
  key_id: string | null;
  key_name: string | null;
  endpoint: string;
  model: string;
  status_code: number;
  latency_ms: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  is_stream: boolean;
  error_message: string | null;
  created_at: string;
}

export interface AnalyticsSummary {
  total_requests: number;
  total_tokens: number;
  avg_latency_ms: number;
  success_rate: number;
  active_keys_count: number;
  model_breakdown: Record<string, number>;
  recent_logs: RequestLogItem[];
}
