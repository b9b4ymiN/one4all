/**
 * Fallback Manager - Handles adapter failures and graceful fallbacks
 *
 * Provides circuit breaker pattern, fallback chains, and health tracking
 * for AI adapters to ensure resilience and reliability.
 */

import type { Adapter, AdapterConfig, AgentResult, HealthStatus } from '../types/adapter.types';

export type AdapterErrorType = 'timeout' | 'rate_limit' | 'api_error' | 'network_error' | 'unknown';

export interface AdapterError {
  type: AdapterErrorType;
  message: string;
  originalError?: Error;
  adapterName: string;
  timestamp: Date;
}

export interface AdapterHealth {
  adapter: Adapter;
  healthy: boolean;
  consecutiveFailures: number;
  lastFailure?: AdapterError;
  lastSuccess?: Date;
  circuitBreakerOpen: boolean;
  circuitBreakerOpenedAt?: Date;
  averageLatencyMs: number;
  totalRequests: number;
  successfulRequests: number;
}

export interface FallbackChain {
  primary: Adapter;
  fallbacks: Adapter[];
  maxRetriesPerAdapter: number;
  retryDelayMs: number;
  circuitBreakerThreshold: number;
  circuitBreakerTimeoutMs: number;
}

export interface FallbackConfig {
  chains: Map<string, FallbackChain>;
  enableCircuitBreaker: boolean;
  enableLogging: boolean;
  defaultMaxRetries: number;
  defaultRetryDelayMs: number;
  defaultCircuitBreakerThreshold: number;
  defaultCircuitBreakerTimeoutMs: number;
}

export interface FallbackResult {
  success: boolean;
  result?: AgentResult;
  adapterUsed?: string;
  fallbacksAttempted: string[];
  errors: AdapterError[];
  totalDurationMs: number;
}

const DEFAULT_CONFIG: Partial<FallbackConfig> = {
  enableCircuitBreaker: true,
  enableLogging: true,
  defaultMaxRetries: 2,
  defaultRetryDelayMs: 1000,
  defaultCircuitBreakerThreshold: 3,
  defaultCircuitBreakerTimeoutMs: 60000,
};

export class FallbackManager {
  private config: FallbackConfig;
  private adapterHealth: Map<string, AdapterHealth>;
  private activeFallbacks: Map<string, Set<string>>;

  constructor(config: Partial<FallbackConfig> = {}) {
    this.config = {
      chains: new Map(),
      enableCircuitBreaker: true,
      enableLogging: true,
      defaultMaxRetries: 2,
      defaultRetryDelayMs: 1000,
      defaultCircuitBreakerThreshold: 3,
      defaultCircuitBreakerTimeoutMs: 60000,
      ...config,
    } as FallbackConfig;
    this.adapterHealth = new Map();
    this.activeFallbacks = new Map();
  }

  /**
   * Register a fallback chain for a given agent/task type
   */
  registerFallbackChain(name: string, chain: FallbackChain): void {
    this.config.chains.set(name, chain);

    // Initialize health tracking for all adapters in the chain
    const adapters = [chain.primary, ...chain.fallbacks];
    for (const adapter of adapters) {
      const adapterName = adapter.getName();
      if (!this.adapterHealth.has(adapterName)) {
        this.adapterHealth.set(adapterName, {
          adapter,
          healthy: true,
          consecutiveFailures: 0,
          circuitBreakerOpen: false,
          averageLatencyMs: 0,
          totalRequests: 0,
          successfulRequests: 0,
        });
      }
    }
  }

  /**
   * Execute a request with fallback support
   */
  async executeWithFallback(
    chainName: string,
    prompt: string,
    config: AdapterConfig
  ): Promise<FallbackResult> {
    const startTime = Date.now();
    const chain = this.config.chains.get(chainName);

    if (!chain) {
      return {
        success: false,
        fallbacksAttempted: [],
        errors: [{
          type: 'unknown',
          message: `No fallback chain found: ${chainName}`,
          adapterName: 'fallback-manager',
          timestamp: new Date(),
        }],
        totalDurationMs: 0,
      };
    }

    const result: FallbackResult = {
      success: false,
      fallbacksAttempted: [],
      errors: [],
      totalDurationMs: 0,
    };

    const adaptersToTry = this.getAdaptersInOrder(chain);

    // Track skipped adapters (those with open circuit breakers)
    const allAdapters = [chain.primary, ...chain.fallbacks];
    for (const adapter of allAdapters) {
      const health = this.adapterHealth.get(adapter.getName());
      if (health && health.circuitBreakerOpen) {
        result.fallbacksAttempted.push(adapter.getName());
        result.errors.push({
          type: 'unknown',
          message: 'Circuit breaker is open',
          adapterName: adapter.getName(),
          timestamp: new Date(),
        });
      }
    }

    const maxRetries = chain.maxRetriesPerAdapter ?? this.config.defaultMaxRetries;

    for (const adapter of adaptersToTry) {
      const adapterName = adapter.getName();
      const health = this.adapterHealth.get(adapterName)!;

      // Skip if circuit breaker is open
      if (this.isCircuitBreakerOpen(health, chain)) {
        result.fallbacksAttempted.push(adapterName);
        result.errors.push({
          type: 'unknown',
          message: 'Circuit breaker is open',
          adapterName,
          timestamp: new Date(),
        });
        continue;
      }

      // Try adapter with retries
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const attemptResult = await this.executeAdapter(adapter, prompt, config, attempt, result.fallbacksAttempted);

          if (attemptResult.success) {
            this.recordSuccess(health, attemptResult);
            result.success = true;
            result.result = attemptResult;
            result.adapterUsed = adapterName;
            result.totalDurationMs = Date.now() - startTime;

            this.logInfo(`Request succeeded using ${adapterName}`, {
              chainName,
              attempts: attempt + 1,
              fallbacksUsed: result.fallbacksAttempted,
            });

            return result;
          } else {
            const error: AdapterError = {
              type: this.classifyError(attemptResult.error || 'unknown'),
              message: attemptResult.error || 'Unknown error',
              adapterName,
              timestamp: new Date(),
            };
            result.errors.push(error);
            this.recordFailure(health, error, chain);

            // Don't retry on certain error types
            if (error.type === 'rate_limit' || error.type === 'api_error') {
              break;
            }

            // Wait before retry
            if (attempt < maxRetries) {
              await this.delay(chain.retryDelayMs ?? this.config.defaultRetryDelayMs);
            }
          }
        } catch (err) {
          const error: AdapterError = {
            type: this.classifyError(err),
            message: err instanceof Error ? err.message : String(err),
            originalError: err instanceof Error ? err : undefined,
            adapterName,
            timestamp: new Date(),
          };
          result.errors.push(error);
          this.recordFailure(health, error, chain);

          this.logError(`Adapter ${adapterName} threw exception`, error);
        }
      }

      // Track that we tried this adapter
      if (!result.fallbacksAttempted.includes(adapterName)) {
        result.fallbacksAttempted.push(adapterName);
      }
    }

    result.totalDurationMs = Date.now() - startTime;
    this.logError('All adapters in fallback chain failed', {
      chainName,
      fallbacksAttempted: result.fallbacksAttempted,
      errors: result.errors,
    });

    return result;
  }

  /**
   * Get adapters in order (primary first, then fallbacks, skipping unhealthy ones)
   */
  private getAdaptersInOrder(chain: FallbackChain): Adapter[] {
    const adapters: Adapter[] = [];

    // Always include primary adapter (unless circuit breaker is open)
    // The retry logic will handle failures
    const primaryHealth = this.adapterHealth.get(chain.primary.getName());
    if (primaryHealth && !this.isCircuitBreakerOpen(primaryHealth, chain)) {
      adapters.push(chain.primary);
    }

    // Add fallbacks (unless circuit breaker is open)
    for (const fallback of chain.fallbacks) {
      const health = this.adapterHealth.get(fallback.getName());
      if (health && !this.isCircuitBreakerOpen(health, chain)) {
        adapters.push(fallback);
      }
    }

    return adapters;
  }

  /**
   * Execute a single adapter
   */
  private async executeAdapter(
    adapter: Adapter,
    prompt: string,
    config: AdapterConfig,
    attempt: number,
    previousAttempts: string[]
  ): Promise<AgentResult> {
    const adapterName = adapter.getName();

    // Track active fallback
    const key = `${adapter.getName()}_${Date.now()}`;
    this.activeFallbacks.set(key, new Set(previousAttempts));

    try {
      const result = await adapter.run(prompt, config);
      this.activeFallbacks.delete(key);
      return result;
    } catch (err) {
      this.activeFallbacks.delete(key);
      throw err;
    }
  }

  /**
   * Check if circuit breaker is open for an adapter
   */
  private isCircuitBreakerOpen(health: AdapterHealth, chain: FallbackChain): boolean {
    if (!this.config.enableCircuitBreaker) {
      return false;
    }

    if (!health.circuitBreakerOpen) {
      return false;
    }

    // Check if circuit breaker timeout has passed
    if (health.circuitBreakerOpenedAt) {
      const timeout = chain.circuitBreakerTimeoutMs ?? this.config.defaultCircuitBreakerTimeoutMs;
      const timeSinceOpen = Date.now() - health.circuitBreakerOpenedAt.getTime();

      if (timeSinceOpen > timeout) {
        // Reset circuit breaker
        health.circuitBreakerOpen = false;
        health.consecutiveFailures = 0;
        delete health.circuitBreakerOpenedAt;
        this.logInfo(`Circuit breaker reset for ${health.adapter.getName()}`);
        return false;
      }
    }

    return true;
  }

  /**
   * Record a successful request
   */
  private recordSuccess(health: AdapterHealth, result: AgentResult): void {
    health.healthy = true;
    health.consecutiveFailures = 0;
    health.lastSuccess = new Date();
    health.totalRequests++;
    health.successfulRequests++;

    if (result.timing?.durationMs) {
      const currentAvg = health.averageLatencyMs;
      const totalRequests = health.totalRequests;
      health.averageLatencyMs = (currentAvg * (totalRequests - 1) + result.timing.durationMs) / totalRequests;
    }
  }

  /**
   * Record a failed request
   */
  private recordFailure(health: AdapterHealth, error: AdapterError, chain: FallbackChain): void {
    health.consecutiveFailures++;
    health.lastFailure = error;
    health.totalRequests++;
    health.healthy = false; // Mark as unhealthy on any failure

    const threshold = chain.circuitBreakerThreshold ?? this.config.defaultCircuitBreakerThreshold;

    if (health.consecutiveFailures >= threshold) {
      health.circuitBreakerOpen = true;
      health.circuitBreakerOpenedAt = new Date();
      this.logWarn(`Circuit breaker opened for ${health.adapter.getName()} after ${health.consecutiveFailures} failures`);
    }
  }

  /**
   * Classify an error into a type
   */
  private classifyError(error: unknown): AdapterErrorType {
    // Extract message from Error object or use string directly
    const message = error instanceof Error ? error.message : String(error);
    const messageLower = message.toLowerCase();

    if (messageLower.includes('timeout') || messageLower.includes('timed out')) {
      return 'timeout';
    }
    if (messageLower.includes('rate limit') || messageLower.includes('429')) {
      return 'rate_limit';
    }
    if (messageLower.includes('network') || messageLower.includes('econnrefused') || messageLower.includes('enotfound')) {
      return 'network_error';
    }
    if (messageLower.includes('api') || messageLower.includes('400') || messageLower.includes('500')) {
      return 'api_error';
    }

    return 'unknown';
  }

  /**
   * Get health status for all adapters
   */
  getAllHealthStatus(): Map<string, AdapterHealth> {
    return new Map(this.adapterHealth);
  }

  /**
   * Get health status for a specific adapter
   */
  getAdapterHealth(adapterName: string): AdapterHealth | undefined {
    return this.adapterHealth.get(adapterName);
  }

  /**
   * Manually reset circuit breaker for an adapter
   */
  resetCircuitBreaker(adapterName: string): boolean {
    const health = this.adapterHealth.get(adapterName);
    if (!health) {
      return false;
    }

    health.circuitBreakerOpen = false;
    health.consecutiveFailures = 0;
    delete health.circuitBreakerOpenedAt;
    health.healthy = true;

    this.logInfo(`Circuit breaker manually reset for ${adapterName}`);
    return true;
  }

  /**
   * Get statistics for a fallback chain
   */
  getChainStatistics(chainName: string): {
    totalAdapters: number;
    healthyAdapters: number;
    adaptersWithOpenCircuitBreakers: number;
    averageLatencyMs: number;
  } | null {
    const chain = this.config.chains.get(chainName);
    if (!chain) {
      return null;
    }

    const adapters = [chain.primary, ...chain.fallbacks];
    let healthyCount = 0;
    let openCircuitBreakers = 0;
    let totalLatency = 0;
    let latencyCount = 0;

    for (const adapter of adapters) {
      const health = this.adapterHealth.get(adapter.getName());
      if (health) {
        if (health.healthy && !health.circuitBreakerOpen) {
          healthyCount++;
        }
        if (health.circuitBreakerOpen) {
          openCircuitBreakers++;
        }
        if (health.totalRequests > 0) {
          totalLatency += health.averageLatencyMs;
          latencyCount++;
        }
      }
    }

    return {
      totalAdapters: adapters.length,
      healthyAdapters: healthyCount,
      adaptersWithOpenCircuitBreakers: openCircuitBreakers,
      averageLatencyMs: latencyCount > 0 ? totalLatency / latencyCount : 0,
    };
  }

  /**
   * Check health of all adapters in a chain
   */
  async checkChainHealth(chainName: string): Promise<Map<string, HealthStatus>> {
    const results = new Map<string, HealthStatus>();
    const chain = this.config.chains.get(chainName);

    if (!chain) {
      return results;
    }

    const adapters = [chain.primary, ...chain.fallbacks];

    for (const adapter of adapters) {
      try {
        const status = await adapter.healthCheck();
        results.set(adapter.getName(), status);

        // Update internal health tracking
        const health = this.adapterHealth.get(adapter.getName());
        if (health) {
          health.healthy = status.healthy;
          if (status.latencyMs) {
            health.averageLatencyMs = status.latencyMs;
          }
        }
      } catch (err) {
        results.set(adapter.getName(), {
          healthy: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return results;
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Logging helpers
   */
  private logInfo(message: string, metadata?: Record<string, unknown>): void {
    if (this.config.enableLogging) {
      console.log(`[FallbackManager] ${message}`, metadata || '');
    }
  }

  private logWarn(message: string, metadata?: Record<string, unknown>): void {
    if (this.config.enableLogging) {
      console.warn(`[FallbackManager] ${message}`, metadata || '');
    }
  }

  private logError(message: string, error?: AdapterError | Record<string, unknown>): void {
    if (this.config.enableLogging) {
      console.error(`[FallbackManager] ${message}`, error || '');
    }
  }

  /**
   * Create a fallback chain from adapter names
   */
  createFallbackChain(
    name: string,
    primary: Adapter,
    fallbacks: Adapter[],
    config?: Partial<FallbackChain>
  ): void {
    const chain: FallbackChain = {
      primary,
      fallbacks,
      maxRetriesPerAdapter: config?.maxRetriesPerAdapter ?? this.config.defaultMaxRetries,
      retryDelayMs: config?.retryDelayMs ?? this.config.defaultRetryDelayMs,
      circuitBreakerThreshold: config?.circuitBreakerThreshold ?? this.config.defaultCircuitBreakerThreshold,
      circuitBreakerTimeoutMs: config?.circuitBreakerTimeoutMs ?? this.config.defaultCircuitBreakerTimeoutMs,
    };

    this.registerFallbackChain(name, chain);
  }

  /**
   * Get active fallbacks for monitoring
   */
  getActiveFallbacks(): Map<string, Set<string>> {
    return new Map(this.activeFallbacks);
  }

  /**
   * Clear circuit breaker state for all adapters
   */
  clearAllCircuitBreakers(): void {
    for (const health of this.adapterHealth.values()) {
      health.circuitBreakerOpen = false;
      health.consecutiveFailures = 0;
      delete health.circuitBreakerOpenedAt;
      health.healthy = true;
    }
    this.logInfo('All circuit breakers cleared');
  }

  /**
   * Get configuration
   */
  getConfig(): FallbackConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<FallbackConfig>): void {
    this.config = { ...this.config, ...updates };
  }
}

/**
 * Create a fallback manager with default configuration
 */
export function createFallbackManager(config?: Partial<FallbackConfig>): FallbackManager {
  return new FallbackManager(config);
}
