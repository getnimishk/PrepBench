export interface LLMProfile {
  key: string;
  label: string;
  adapter: string;
  capabilities: string[];
  is_local: boolean | null;
  requires_api_key: boolean;
  base_url: string | null;
  default_models: Record<string, string>;
  setup_guide: string | null;
}

export interface LLMProvider {
  id: number;
  name: string;
  profile_key: string;
  profile_label: string | null;
  adapter: string | null;
  base_url: string | null;
  effective_base_url: string | null;
  is_local: boolean;
  capabilities: string[];

  /** The key itself is never sent to the browser -- only whether one exists. */
  has_api_key: boolean;
  api_key_hint: string | null;
  api_key_is_from_env: boolean;

  default_text_model: string | null;
  default_audio_model: string | null;
  default_embedding_model: string | null;

  is_enabled: boolean;
  last_verified_at: string | null;
  last_verify_error: string | null;
  last_latency_ms: number | null;
}

export interface LLMProviderCreate {
  name: string;
  profile_key: string;
  base_url?: string | null;
  api_key?: string | null;
  default_text_model?: string | null;
  default_audio_model?: string | null;
  default_embedding_model?: string | null;
  is_enabled?: boolean;
}

export type LLMProviderUpdate = Partial<LLMProviderCreate>;

export type VerifyReadiness = 'ready' | 'slow' | 'unreachable' | 'error';

export interface LLMVerifyResult {
  ok: boolean;
  readiness: VerifyReadiness;
  message: string;
  latency_ms: number | null;
  detected_models: string[];
  resolved_model: string | null;
  returned_valid_json: boolean | null;
}

export interface LLMTaskBinding {
  task: string;
  label: string;
  capability: string;
  bound_provider_id: number | null;
  bound_model: string | null;
  resolved_provider_id: number | null;
  resolved_provider_name: string | null;
  resolved_model: string | null;
  is_available: boolean;
  unavailable_reason: string | null;
  cloud_timeout_seconds: number;
  local_timeout_seconds: number;
}

export interface DetectedRunner {
  profile_key: string;
  label: string;
  base_url: string;
  models: string[];
  already_configured: boolean;
}

export interface LLMModelList {
  models: string[];
  error: string | null;
}

/** Human labels for the capability strings the API returns. */
export const CAPABILITY_LABELS: Record<string, string> = {
  text_json: 'Text',
  audio_json: 'Audio',
  embedding: 'Embeddings',
  transcription: 'Transcription',
};
