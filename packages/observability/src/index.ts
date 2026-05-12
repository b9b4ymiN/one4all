/**
 * @one4all/observability
 *
 * Logging, tracing, auditing, and validation for the one4all system
 */

export { StructuredLogger } from './logger/structured-logger';
export { MissionTracer } from './tracer/mission-tracer';
export { EvidenceAuditor } from './auditor/evidence-auditor';
export { OutputValidator, PrebuiltSchemas, createValidatorWithDefaults } from './validator/output-validator';
export { ReplayStorage, createReplayStorage } from './replay/replay-storage';
export { HealthMonitor, createHealthMonitor, getHealthMonitor } from './health-monitor/health-monitor.js';
export { CircuitBreaker, CircuitBreakerRegistry } from './health-monitor/circuit-breaker.js';

// Re-export types for convenience
export type { LogContext, LogEntry, LogLevel, LoggerConfig } from './logger/structured-logger';
export type { TraceEvent, TraceEventType, MissionTrace, TraceFilter, TracerConfig } from './tracer/mission-tracer';
export type { Evidence, EvidenceScore, AuditReport, AuditorConfig } from './auditor/evidence-auditor';
export type {
  ValidationResult,
  ValidatorConfig,
  AgentOutput,
  DecisionOutput,
  ResearchOutput,
  DebateOutput,
  ValidationErrorType,
} from './validator/output-validator';
export type { ReplayEvent, ReplayEventType, ReplaySession, ReplayStorageConfig } from './replay/replay-storage';
export type {
  HealthStatus,
  CircuitState,
  Provider,
  HealthCheckResult,
  LatencyMeasurement,
  CircuitBreakerConfig,
  CircuitBreakerState,
  ProviderHealthState,
  HealthCheckOptions,
  HealthMonitorConfig,
  HealthCheckFn,
} from './health-monitor/types.js';
