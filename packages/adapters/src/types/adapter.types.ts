/**
 * Adapter interface and types for AI backends
 */

export interface AdapterConfig {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
  apiKey?: string;
  baseURL?: string;
  [key: string]: unknown;
}

export interface AgentResult {
  success: boolean;
  content: string;
  model: string;
  tokensUsed?: {
    input: number;
    output: number;
    total: number;
  };
  cost?: number;
  timing?: {
    startedAt: number;
    completedAt: number;
    durationMs: number;
  };
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface HealthStatus {
  healthy: boolean;
  latencyMs?: number;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface Adapter {
  /**
   * Run the adapter with the given prompt and config
   */
  run(prompt: string, config: AdapterConfig): Promise<AgentResult>;

  /**
   * Check if the adapter/backend is healthy
   */
  healthCheck(): Promise<HealthStatus>;

  /**
   * Estimate token count for a prompt
   */
  estimateTokens(prompt: string): number;

  /**
   * Estimate cost in USD for given token usage
   */
  estimateCost(inputTokens: number, outputTokens: number): number;

  /**
   * Get adapter name
   */
  getName(): string;
}

export type AdapterType = 'claude' | 'gemini' | 'zai' | 'codex' | 'python' | 'human' | 'mock';
