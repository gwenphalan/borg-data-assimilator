export interface RateLimitsConfig {
  rpm: number;
  tpm: number;
  rpd: number;
  inference_rpm?: number;
}

export interface ModelRequestConfig {
  temperature: number;
  maxOutputTokens: number;
  topP: number;
}

export interface ModelConfig {
  endpoint: string;
  inference_prompt_file?: string;
  request: ModelRequestConfig;
  rate_limits: RateLimitsConfig;
}

export interface GoogleAIStudioConfig {
  default_model_id: string;
  models: Record<string, ModelConfig>;
  apiKey?: string;
  // If you decide to handle API key for Google via schema, add it here (e.g., apiKey?: string)
}

export interface OpenRouterModelConfig {
  api_key: string; // This will be populated from env or yml
  endpoint: string;
}

export interface OpenRouterConfig {
  free_models?: Record<string, OpenRouterModelConfig>;
}

export interface TogetherAIChatConfig {
  api_key: string; // This will be populated from env or yml
  endpoint: string;
}

export interface TogetherAIConfig {
  chat?: TogetherAIChatConfig;
}

export interface ProvidersConfig {
  google_ai_studio: GoogleAIStudioConfig;
  openrouter?: OpenRouterConfig;
  together_ai?: TogetherAIConfig;
}

export interface LoggingConfig {
  level: string;
  file: string;
  inferred_data_file_pattern: string;
}

export interface BatchProcessingConfig {
  sorter_batch_size: number;
  converter_batch_size: number;
  inference_batch_size: number;
}

export interface AppConfig {
  logging: LoggingConfig;
  batch_processing: BatchProcessingConfig;
  providers: ProvidersConfig;
} 