/**
 * Mock Adapter - Base class for all mock adapters
 * Returns simulated responses without calling real APIs
 */

import type {
  Adapter,
  AdapterConfig,
  AgentResult,
  HealthStatus,
  AdapterType,
} from '../types/adapter.types';

export abstract class BaseMockAdapter implements Adapter {
  protected abstract readonly adapterType: AdapterType;
  protected abstract readonly defaultModel: string;

  abstract run(prompt: string, config: AdapterConfig): Promise<AgentResult>;

  async healthCheck(): Promise<HealthStatus> {
    return {
      healthy: true,
      latencyMs: Math.random() * 50,
      metadata: {
        adapter: this.adapterType,
        model: this.defaultModel,
        mock: true,
      },
    };
  }

  estimateTokens(prompt: string): number {
    // Rough estimate: ~4 characters per token
    return Math.ceil(prompt.length / 4);
  }

  estimateCost(inputTokens: number, outputTokens: number): number {
    // Mock pricing - always returns 0 for mocks
    return 0;
  }

  getName(): string {
    return `Mock${this.adapterType.charAt(0).toUpperCase() + this.adapterType.slice(1)}Adapter`;
  }

  protected createMockResult(
    content: string,
    inputTokens: number,
    outputTokens: number,
    metadata?: Record<string, unknown>
  ): AgentResult {
    const now = Date.now();
    const durationMs = Math.random() * 500 + 100; // 100-600ms simulated latency

    return {
      success: true,
      content,
      model: this.defaultModel,
      tokensUsed: {
        input: inputTokens,
        output: outputTokens,
        total: inputTokens + outputTokens,
      },
      cost: 0,
      timing: {
        startedAt: now - durationMs,
        completedAt: now,
        durationMs,
      },
      metadata: {
        ...metadata,
        mock: true,
        adapter: this.adapterType,
      },
    };
  }
}
