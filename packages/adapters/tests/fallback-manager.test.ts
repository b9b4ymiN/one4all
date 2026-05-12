/**
 * Fallback Manager Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  FallbackManager,
  createFallbackManager,
  type Adapter,
  type AdapterConfig,
  type AgentResult,
  type HealthStatus,
  type FallbackChain,
  type AdapterError,
} from '../src/fallback';

// Mock adapter for testing
class MockAdapter implements Adapter {
  private name: string;
  private shouldFail: boolean;
  private failType: 'timeout' | 'rate_limit' | 'api_error' | 'network_error';
  private latencyMs: number;

  constructor(
    name: string,
    options: {
      shouldFail?: boolean;
      failType?: 'timeout' | 'rate_limit' | 'api_error' | 'network_error';
      latencyMs?: number;
    } = {}
  ) {
    this.name = name;
    this.shouldFail = options.shouldFail ?? false;
    this.failType = options.failType ?? 'api_error';
    this.latencyMs = options.latencyMs ?? 100;
  }

  setShouldFail(shouldFail: boolean): void {
    this.shouldFail = shouldFail;
  }

  setFailType(type: 'timeout' | 'rate_limit' | 'api_error' | 'network_error'): void {
    this.failType = type;
  }

  setLatency(latencyMs: number): void {
    this.latencyMs = latencyMs;
  }

  async run(prompt: string, config: AdapterConfig): Promise<AgentResult> {
    if (this.shouldFail) {
      return {
        success: false,
        content: '',
        model: this.name,
        error: this.getErrorMessage(),
      };
    }

    // Simulate latency
    await new Promise(resolve => setTimeout(resolve, this.latencyMs));

    return {
      success: true,
      content: `Mock response from ${this.name}`,
      model: this.name,
      tokensUsed: { input: 10, output: 20, total: 30 },
      cost: 0.001,
      timing: {
        startedAt: Date.now(),
        completedAt: Date.now(),
        durationMs: this.latencyMs,
      },
    };
  }

  async healthCheck(): Promise<HealthStatus> {
    if (this.shouldFail) {
      return {
        healthy: false,
        error: this.getErrorMessage(),
        latencyMs: this.latencyMs,
      };
    }
    return {
      healthy: true,
      latencyMs: this.latencyMs,
    };
  }

  estimateTokens(prompt: string): number {
    return prompt.length / 4;
  }

  estimateCost(inputTokens: number, outputTokens: number): number {
    return (inputTokens * 0.00001 + outputTokens * 0.00002);
  }

  getName(): string {
    return this.name;
  }

  private getErrorMessage(): string {
    switch (this.failType) {
      case 'timeout':
        return 'Request timed out';
      case 'rate_limit':
        return 'Rate limit exceeded (429)';
      case 'network_error':
        return 'Network error: ECONNREFUSED';
      case 'api_error':
      default:
        return 'API error (500)';
    }
  }
}

describe('FallbackManager', () => {
  let fallbackManager: FallbackManager;
  let primaryAdapter: MockAdapter;
  let fallbackAdapter1: MockAdapter;
  let fallbackAdapter2: MockAdapter;

  beforeEach(() => {
    fallbackManager = new FallbackManager({ enableLogging: false });
    primaryAdapter = new MockAdapter('claude', { latencyMs: 50 });
    fallbackAdapter1 = new MockAdapter('gemini', { latencyMs: 75 });
    fallbackAdapter2 = new MockAdapter('zai', { latencyMs: 100 });
  });

  afterEach(() => {
    fallbackManager.clearAllCircuitBreakers();
  });

  describe('Fallback Chain Registration', () => {
    it('should register a fallback chain', () => {
      fallbackManager.registerFallbackChain('test-chain', {
        primary: primaryAdapter,
        fallbacks: [fallbackAdapter1, fallbackAdapter2],
        maxRetriesPerAdapter: 2,
        retryDelayMs: 100,
        circuitBreakerThreshold: 3,
        circuitBreakerTimeoutMs: 60000,
      });

      const health = fallbackManager.getAdapterHealth('claude');
      expect(health).toBeDefined();
      expect(health?.adapter.getName()).toBe('claude');
      expect(health?.healthy).toBe(true);
    });

    it('should create a fallback chain using helper method', () => {
      fallbackManager.createFallbackChain(
        'test-chain',
        primaryAdapter,
        [fallbackAdapter1, fallbackAdapter2],
        { maxRetriesPerAdapter: 1 }
      );

      const stats = fallbackManager.getChainStatistics('test-chain');
      expect(stats).toBeDefined();
      expect(stats?.totalAdapters).toBe(3);
      expect(stats?.healthyAdapters).toBe(3);
    });

    it('should track health for all adapters in chain', () => {
      fallbackManager.createFallbackChain(
        'test-chain',
        primaryAdapter,
        [fallbackAdapter1, fallbackAdapter2]
      );

      const allHealth = fallbackManager.getAllHealthStatus();
      expect(allHealth.size).toBe(3);
      expect(allHealth.has('claude')).toBe(true);
      expect(allHealth.has('gemini')).toBe(true);
      expect(allHealth.has('zai')).toBe(true);
    });
  });

  describe('Primary Adapter Success', () => {
    it('should execute successfully with primary adapter', async () => {
      fallbackManager.createFallbackChain('test-chain', primaryAdapter, [fallbackAdapter1]);

      const result = await fallbackManager.executeWithFallback('test-chain', 'Test prompt', {});

      expect(result.success).toBe(true);
      expect(result.adapterUsed).toBe('claude');
      expect(result.result?.content).toContain('Mock response from claude');
      expect(result.fallbacksAttempted).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should record success metrics', async () => {
      fallbackManager.createFallbackChain('test-chain', primaryAdapter, [fallbackAdapter1]);

      await fallbackManager.executeWithFallback('test-chain', 'Test prompt', {});

      const health = fallbackManager.getAdapterHealth('claude');
      expect(health?.successfulRequests).toBe(1);
      expect(health?.totalRequests).toBe(1);
      expect(health?.consecutiveFailures).toBe(0);
      expect(health?.averageLatencyMs).toBeGreaterThan(0);
    });
  });

  describe('Fallback to Secondary Adapter', () => {
    it('should fall back to secondary adapter when primary fails', async () => {
      primaryAdapter.setShouldFail(true);
      fallbackManager.createFallbackChain('test-chain', primaryAdapter, [fallbackAdapter1]);

      const result = await fallbackManager.executeWithFallback('test-chain', 'Test prompt', {});

      expect(result.success).toBe(true);
      expect(result.adapterUsed).toBe('gemini');
      expect(result.fallbacksAttempted).toContain('claude');
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should try multiple fallbacks in order', async () => {
      primaryAdapter.setShouldFail(true);
      fallbackAdapter1.setShouldFail(true);
      fallbackManager.createFallbackChain('test-chain', primaryAdapter, [fallbackAdapter1, fallbackAdapter2]);

      const result = await fallbackManager.executeWithFallback('test-chain', 'Test prompt', {});

      expect(result.success).toBe(true);
      expect(result.adapterUsed).toBe('zai');
      expect(result.fallbacksAttempted).toEqual(['claude', 'gemini']);
      expect(result.errors.length).toBe(2);
    });

    it('should fail when all adapters fail', async () => {
      primaryAdapter.setShouldFail(true);
      fallbackAdapter1.setShouldFail(true);
      fallbackAdapter2.setShouldFail(true);
      fallbackManager.createFallbackChain('test-chain', primaryAdapter, [fallbackAdapter1, fallbackAdapter2]);

      const result = await fallbackManager.executeWithFallback('test-chain', 'Test prompt', {});

      expect(result.success).toBe(false);
      expect(result.adapterUsed).toBeUndefined();
      expect(result.fallbacksAttempted).toEqual(['claude', 'gemini', 'zai']);
      expect(result.errors.length).toBe(3);
    });
  });

  describe('Retry Logic', () => {
    it('should retry the same adapter before falling back', async () => {
      let attemptCount = 0;
      primaryAdapter.setShouldFail(true);
      primaryAdapter.setFailType('timeout'); // Use a retryable error type
      fallbackManager.createFallbackChain('test-chain', primaryAdapter, [fallbackAdapter1], {
        maxRetriesPerAdapter: 2,
        retryDelayMs: 10,
      });

      // Make adapter succeed on second attempt
      const originalRun = primaryAdapter.run.bind(primaryAdapter);
      primaryAdapter.run = async (prompt, config) => {
        attemptCount++;
        if (attemptCount === 2) {
          primaryAdapter.setShouldFail(false);
        }
        return originalRun(prompt, config);
      };

      const result = await fallbackManager.executeWithFallback('test-chain', 'Test prompt', {});

      expect(result.success).toBe(true);
      expect(result.adapterUsed).toBe('claude');
      expect(attemptCount).toBe(2);
      expect(result.fallbacksAttempted).toHaveLength(0);
    });

    it('should not retry on rate limit errors', async () => {
      primaryAdapter.setShouldFail(true);
      primaryAdapter.setFailType('rate_limit');
      fallbackManager.createFallbackChain('test-chain', primaryAdapter, [fallbackAdapter1], {
        maxRetriesPerAdapter: 2,
        retryDelayMs: 10,
      });

      const result = await fallbackManager.executeWithFallback('test-chain', 'Test prompt', {});

      // Should immediately fall back instead of retrying
      expect(result.success).toBe(true);
      expect(result.adapterUsed).toBe('gemini');
      expect(result.fallbacksAttempted).toContain('claude');
    });
  });

  describe('Circuit Breaker', () => {
    it('should open circuit breaker after threshold failures', async () => {
      fallbackManager.createFallbackChain('test-chain', primaryAdapter, [fallbackAdapter1], {
        circuitBreakerThreshold: 3,
        circuitBreakerTimeoutMs: 10000,
      });

      primaryAdapter.setShouldFail(true);

      // Fail 3 times to open circuit breaker
      for (let i = 0; i < 3; i++) {
        await fallbackManager.executeWithFallback('test-chain', 'Test prompt', {});
      }

      const health = fallbackManager.getAdapterHealth('claude');
      expect(health?.circuitBreakerOpen).toBe(true);
      expect(health?.consecutiveFailures).toBe(3);
    });

    it('should skip adapters with open circuit breaker', async () => {
      fallbackManager.createFallbackChain('test-chain', primaryAdapter, [fallbackAdapter1], {
        circuitBreakerThreshold: 2,
        circuitBreakerTimeoutMs: 10000,
      });

      // Open circuit breaker for primary
      primaryAdapter.setShouldFail(true);
      for (let i = 0; i < 2; i++) {
        await fallbackManager.executeWithFallback('test-chain', 'Test prompt', {});
      }

      // Next request should skip primary and use fallback
      const result = await fallbackManager.executeWithFallback('test-chain', 'Test prompt', {});

      expect(result.success).toBe(true);
      expect(result.adapterUsed).toBe('gemini');
      expect(result.fallbacksAttempted).toContain('claude');
    });

    it('should reset circuit breaker after timeout', async () => {
      fallbackManager.createFallbackChain('test-chain', primaryAdapter, [fallbackAdapter1], {
        circuitBreakerThreshold: 2,
        circuitBreakerTimeoutMs: 100, // 100ms timeout
      });

      // Open circuit breaker
      primaryAdapter.setShouldFail(true);
      for (let i = 0; i < 2; i++) {
        await fallbackManager.executeWithFallback('test-chain', 'Test prompt', {});
      }

      expect(fallbackManager.getAdapterHealth('claude')?.circuitBreakerOpen).toBe(true);

      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 150));

      // Circuit breaker should be reset
      primaryAdapter.setShouldFail(false);
      const result = await fallbackManager.executeWithFallback('test-chain', 'Test prompt', {});

      expect(result.success).toBe(true);
      expect(result.adapterUsed).toBe('claude');
      expect(fallbackManager.getAdapterHealth('claude')?.circuitBreakerOpen).toBe(false);
    });

    it('should allow manual circuit breaker reset', () => {
      fallbackManager.createFallbackChain('test-chain', primaryAdapter, [fallbackAdapter1], {
        circuitBreakerThreshold: 2,
      });

      // Manually open circuit breaker
      const health = fallbackManager.getAdapterHealth('claude');
      health!.circuitBreakerOpen = true;
      health!.consecutiveFailures = 5;

      expect(fallbackManager.getAdapterHealth('claude')?.circuitBreakerOpen).toBe(true);

      // Reset
      const reset = fallbackManager.resetCircuitBreaker('claude');
      expect(reset).toBe(true);
      expect(fallbackManager.getAdapterHealth('claude')?.circuitBreakerOpen).toBe(false);
      expect(fallbackManager.getAdapterHealth('claude')?.consecutiveFailures).toBe(0);
    });
  });

  describe('Health Status and Statistics', () => {
    it('should return health status for all adapters', async () => {
      fallbackManager.createFallbackChain('test-chain', primaryAdapter, [fallbackAdapter1, fallbackAdapter2]);

      const healthMap = fallbackManager.getAllHealthStatus();
      expect(healthMap.size).toBe(3);
    });

    it('should check health of all adapters in chain', async () => {
      fallbackManager.createFallbackChain('test-chain', primaryAdapter, [fallbackAdapter1, fallbackAdapter2]);

      const healthResults = await fallbackManager.checkChainHealth('test-chain');

      expect(healthResults.size).toBe(3);
      expect(healthResults.get('claude')?.healthy).toBe(true);
      expect(healthResults.get('gemini')?.healthy).toBe(true);
      expect(healthResults.get('zai')?.healthy).toBe(true);
    });

    it('should provide chain statistics', () => {
      fallbackManager.createFallbackChain('test-chain', primaryAdapter, [fallbackAdapter1, fallbackAdapter2]);

      const stats = fallbackManager.getChainStatistics('test-chain');

      expect(stats).toBeDefined();
      expect(stats?.totalAdapters).toBe(3);
      expect(stats?.healthyAdapters).toBe(3);
      expect(stats?.adaptersWithOpenCircuitBreakers).toBe(0);
    });

    it('should update health status after failures', async () => {
      fallbackManager.createFallbackChain('test-chain', primaryAdapter, [fallbackAdapter1]);

      primaryAdapter.setShouldFail(true);
      await fallbackManager.executeWithFallback('test-chain', 'Test prompt', {});

      const health = fallbackManager.getAdapterHealth('claude');
      expect(health?.healthy).toBe(false);
      expect(health?.consecutiveFailures).toBeGreaterThan(0);
      expect(health?.lastFailure).toBeDefined();
    });
  });

  describe('Error Classification', () => {
    it('should classify timeout errors correctly', async () => {
      primaryAdapter.setShouldFail(true);
      primaryAdapter.setFailType('timeout');
      fallbackManager.createFallbackChain('test-chain', primaryAdapter, [fallbackAdapter1]);

      const result = await fallbackManager.executeWithFallback('test-chain', 'Test prompt', {});

      expect(result.success).toBe(true); // Fallback succeeded
      expect(result.errors[0].type).toBe('timeout');
    });

    it('should classify rate limit errors correctly', async () => {
      primaryAdapter.setShouldFail(true);
      primaryAdapter.setFailType('rate_limit');
      fallbackManager.createFallbackChain('test-chain', primaryAdapter, [fallbackAdapter1]);

      const result = await fallbackManager.executeWithFallback('test-chain', 'Test prompt', {});

      expect(result.errors[0].type).toBe('rate_limit');
    });

    it('should classify network errors correctly', async () => {
      primaryAdapter.setShouldFail(true);
      primaryAdapter.setFailType('network_error');
      fallbackManager.createFallbackChain('test-chain', primaryAdapter, [fallbackAdapter1]);

      const result = await fallbackManager.executeWithFallback('test-chain', 'Test prompt', {});

      expect(result.errors[0].type).toBe('network_error');
    });
  });

  describe('Configuration', () => {
    it('should use default configuration', () => {
      const manager = createFallbackManager();
      const config = manager.getConfig();

      expect(config.enableCircuitBreaker).toBe(true);
      expect(config.defaultMaxRetries).toBe(2);
      expect(config.defaultRetryDelayMs).toBe(1000);
      expect(config.defaultCircuitBreakerThreshold).toBe(3);
    });

    it('should allow custom configuration', () => {
      const manager = new FallbackManager({
        enableCircuitBreaker: false,
        defaultMaxRetries: 5,
        defaultRetryDelayMs: 500,
      });

      const config = manager.getConfig();
      expect(config.enableCircuitBreaker).toBe(false);
      expect(config.defaultMaxRetries).toBe(5);
      expect(config.defaultRetryDelayMs).toBe(500);
    });

    it('should allow configuration updates', () => {
      fallbackManager.updateConfig({ enableCircuitBreaker: false });

      const config = fallbackManager.getConfig();
      expect(config.enableCircuitBreaker).toBe(false);
    });
  });

  describe('Non-existent Chain', () => {
    it('should return failure for non-existent chain', async () => {
      const result = await fallbackManager.executeWithFallback('non-existent', 'Test prompt', {});

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('No fallback chain found');
    });

    it('should return null statistics for non-existent chain', () => {
      const stats = fallbackManager.getChainStatistics('non-existent');
      expect(stats).toBeNull();
    });
  });
});
