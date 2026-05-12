/**
 * Health Monitor
 *
 * Main health monitoring class that coordinates health checks,
 * latency tracking, and circuit breaking
 */

import type {
  Provider,
  HealthStatus,
  HealthCheckResult,
  HealthCheckOptions,
  HealthMonitorConfig,
  ProviderHealthState,
  LatencyMeasurement,
} from './types.js';
import { CircuitBreakerRegistry } from './circuit-breaker.js';
import { getHealthCheckFn } from './provider-checks.js';

/**
 * Default configuration
 */
const DEFAULT_CONFIG: HealthMonitorConfig = {
  checkInterval: 60000, // 1 minute
  circuitBreaker: {
    failureThreshold: 5,
    successThreshold: 2,
    timeout: 30000, // 30 seconds
    rollingWindow: 300000, // 5 minutes
  },
  latencyHistorySize: 100,
  offlineThreshold: 10000, // 10 seconds
  criticalThreshold: 30000, // 30 seconds
};

/**
 * Health Monitor class
 */
export class HealthMonitor {
  private config: HealthMonitorConfig;
  private circuitBreakers: CircuitBreakerRegistry;
  private healthStates: Map<Provider, ProviderHealthState> = new Map();
  private checkInterval?: NodeJS.Timeout;
  private isRunning: boolean = false;

  constructor(config: Partial<HealthMonitorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.circuitBreakers = new CircuitBreakerRegistry(this.config.circuitBreaker);

    // Initialize health states for all providers
    this.initializeHealthStates();
  }

  /**
   * Initialize health states for all providers
   */
  private initializeHealthStates(): void {
    const providers: Provider[] = ['claude', 'gemini', 'zai', 'codex', 'python', 'mock'];

    for (const provider of providers) {
      this.healthStates.set(provider, {
        provider,
        status: 'offline' as HealthStatus,
        circuitBreaker: this.circuitBreakers.getBreaker(provider).getState(),
        recentLatencies: [],
        averageLatency: 0,
        lastCheckTime: new Date(),
        consecutiveFailures: 0,
        consecutiveSuccesses: 0,
      });
    }
  }

  /**
   * Perform health check for a single provider
   */
  async checkProvider(provider: Provider, options: HealthCheckOptions = {}): Promise<HealthCheckResult> {
    // Check circuit breaker first
    if (!this.circuitBreakers.allowRequest(provider)) {
      const state = this.healthStates.get(provider);
      return {
        provider,
        status: 'offline' as HealthStatus,
        error: 'Circuit breaker is open',
        timestamp: new Date(),
      };
    }

    const checkFn = getHealthCheckFn(provider);
    const result = await checkFn(options);

    // Update circuit breaker
    if (result.status === 'online') {
      this.circuitBreakers.recordSuccess(provider);
    } else if (result.status === 'offline') {
      this.circuitBreakers.recordFailure(provider);
    }

    // Update health state
    this.updateHealthState(provider, result);

    return result;
  }

  /**
   * Perform health checks for all providers
   */
  async checkAll(options: HealthCheckOptions = {}): Promise<Map<Provider, HealthCheckResult>> {
    const results = new Map<Provider, HealthCheckResult>();
    const providers: Provider[] = ['claude', 'gemini', 'zai', 'codex', 'python', 'mock'];

    // Run checks in parallel
    const checks = providers.map(async (provider) => {
      const result = await this.checkProvider(provider, options);
      results.set(provider, result);
    });

    await Promise.all(checks);

    return results;
  }

  /**
   * Update health state for a provider
   */
  private updateHealthState(provider: Provider, result: HealthCheckResult): void {
    const state = this.healthStates.get(provider);
    if (!state) return;

    // Update status
    state.status = result.status;
    state.lastCheckTime = result.timestamp;

    // Update circuit breaker state
    state.circuitBreaker = this.circuitBreakers.getBreaker(provider).getState();

    // Update latency tracking
    if (result.latency !== undefined) {
      const measurement: LatencyMeasurement = {
        provider,
        latency: result.latency,
        timestamp: result.timestamp,
      };

      state.recentLatencies.push(measurement);

      // Keep only the last N measurements
      if (state.recentLatencies.length > this.config.latencyHistorySize) {
        state.recentLatencies.shift();
      }

      // Calculate average latency
      const total = state.recentLatencies.reduce((sum, m) => sum + m.latency, 0);
      state.averageLatency = total / state.recentLatencies.length;
    }

    // Update consecutive counters
    if (result.status === 'online') {
      state.consecutiveSuccesses++;
      state.consecutiveFailures = 0;
    } else if (result.status === 'offline') {
      state.consecutiveFailures++;
      state.consecutiveSuccesses = 0;
    }

    this.healthStates.set(provider, state);
  }

  /**
   * Get health state for a provider
   */
  getHealthState(provider: Provider): ProviderHealthState | undefined {
    return this.healthStates.get(provider);
  }

  /**
   * Get all health states
   */
  getAllHealthStates(): Map<Provider, ProviderHealthState> {
    return new Map(this.healthStates);
  }

  /**
   * Get all online providers
   */
  getOnlineProviders(): Provider[] {
    const online: Provider[] = [];
    for (const [provider, state] of this.healthStates.entries()) {
      if (state.status === 'online') {
        online.push(provider);
      }
    }
    return online;
  }

  /**
   * Get all offline providers
   */
  getOfflineProviders(): Provider[] {
    const offline: Provider[] = [];
    for (const [provider, state] of this.healthStates.entries()) {
      if (state.status === 'offline') {
        offline.push(provider);
      }
    }
    return offline;
  }

  /**
   * Start periodic health checks
   */
  start(): void {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.checkInterval = setInterval(async () => {
      await this.checkAll();
    }, this.config.checkInterval);
  }

  /**
   * Stop periodic health checks
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = undefined;
    }
  }

  /**
   * Check if health monitor is running
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Get formatted health status for CLI output
   */
  getFormattedHealthStatus(): Array<{
    name: string;
    status: HealthStatus;
    latency?: number;
    details?: string;
  }> {
    const results: Array<{
      name: string;
      status: HealthStatus;
      latency?: number;
      details?: string;
    }> = [];

    for (const [provider, state] of this.healthStates.entries()) {
      let details: string | undefined;

      // Add latency if available
      let latency: number | undefined;
      if (state.averageLatency > 0) {
        latency = Math.round(state.averageLatency);
      }

      // Add circuit breaker status if open
      const cbState = state.circuitBreaker;
      if (cbState.state === 'open') {
        details = details ? `${details} | circuit breaker open` : 'circuit breaker open';
      }

      const providerName = provider === 'python' ? 'python-quant' : `${provider}-api`;

      results.push({
        name: providerName,
        status: state.status,
        latency,
        details,
      });
    }

    return results;
  }

  /**
   * Reset all health states
   */
  reset(): void {
    this.circuitBreakers.resetAll();
    this.initializeHealthStates();
  }

  /**
   * Manually open circuit breaker for a provider
   */
  openCircuitBreaker(provider: Provider): void {
    this.circuitBreakers.getBreaker(provider).manualOpen();
    const state = this.healthStates.get(provider);
    if (state) {
      state.circuitBreaker = this.circuitBreakers.getBreaker(provider).getState();
      state.status = 'offline' as HealthStatus;
    }
  }

  /**
   * Manually close circuit breaker for a provider
   */
  closeCircuitBreaker(provider: Provider): void {
    this.circuitBreakers.getBreaker(provider).manualClose();
    const state = this.healthStates.get(provider);
    if (state) {
      state.circuitBreaker = this.circuitBreakers.getBreaker(provider).getState();
    }
  }
}

/**
 * Create a health monitor with default configuration
 */
export function createHealthMonitor(
  config?: Partial<HealthMonitorConfig>
): HealthMonitor {
  return new HealthMonitor(config);
}

/**
 * Singleton health monitor instance
 */
let singletonInstance: HealthMonitor | null = null;

/**
 * Get or create the singleton health monitor
 */
export function getHealthMonitor(
  config?: Partial<HealthMonitorConfig>
): HealthMonitor {
  if (!singletonInstance) {
    singletonInstance = new HealthMonitor(config);
  }
  return singletonInstance;
}
