/**
 * Health Monitor Types
 *
 * Types for health checking, latency tracking, and circuit breaking
 */

/**
 * Health status for a provider
 */
export enum HealthStatus {
  ONLINE = 'online',
  DEGRADED = 'degraded',
  OFFLINE = 'offline',
}

/**
 * Circuit breaker states
 */
export enum CircuitState {
  CLOSED = 'closed',      // Normal operation
  OPEN = 'open',          // Circuit is open, blocking requests
  HALF_OPEN = 'half_open', // Testing if service has recovered
}

/**
 * Provider identifier
 */
export type Provider = 'claude' | 'gemini' | 'zai' | 'codex' | 'python' | 'mock';

/**
 * Health check result
 */
export interface HealthCheckResult {
  provider: Provider;
  status: HealthStatus;
  latency?: number;
  details?: string;
  version?: string;
  authValid?: boolean;
  error?: string;
  timestamp: Date;
}

/**
 * Latency measurement
 */
export interface LatencyMeasurement {
  provider: Provider;
  latency: number;
  timestamp: Date;
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  failureThreshold: number;    // Failures before opening
  successThreshold: number;    // Successes before closing
  timeout: number;             // Milliseconds to wait before half-open
  rollingWindow: number;       // Milliseconds for rolling window
}

/**
 * Circuit breaker state
 */
export interface CircuitBreakerState {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureTime?: Date;
  lastSuccessTime?: Date;
  openedAt?: Date;
}

/**
 * Provider health state
 */
export interface ProviderHealthState {
  provider: Provider;
  status: HealthStatus;
  circuitBreaker: CircuitBreakerState;
  recentLatencies: LatencyMeasurement[];
  averageLatency: number;
  lastCheckTime: Date;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
}

/**
 * Health check options
 */
export interface HealthCheckOptions {
  timeout?: number;
  skipCache?: boolean;
}

/**
 * Health monitor configuration
 */
export interface HealthMonitorConfig {
  checkInterval: number;           // Milliseconds between health checks
  circuitBreaker: CircuitBreakerConfig;
  latencyHistorySize: number;      // Number of latency measurements to keep
  offlineThreshold: number;        // Latency threshold for degraded status (ms)
  criticalThreshold: number;       // Latency threshold for offline status (ms)
}

/**
 * Health check function type
 */
export type HealthCheckFn = (options: HealthCheckOptions) => Promise<HealthCheckResult>;
