/**
 * Gateway Event Types
 *
 * These events are emitted by the A2A Gateway and propagate to the kernel state machine
 * to enable proper handling of agent failures, circuit breaker states, and escalations.
 *
 * This implements the Senior AI Harness Engineer principle:
 * "Observable by default" - all state changes emit events.
 */

/**
 * Gateway event types
 *
 * Categories:
 * - Circuit breaker events: State changes for circuit breakers
 * - Agent failure events: Individual agent failures
 * - Fallback events: Fallback activation and results
 * - Trust events: Trust verification changes
 * - Recovery events: Agent recovery detection
 */
export enum GatewayEventType {
  // Circuit breaker events
  CIRCUIT_BREAKER_OPENED = 'gateway.circuit_breaker.opened',
  CIRCUIT_BREAKER_CLOSED = 'gateway.circuit_breaker.closed',
  CIRCUIT_BREAKER_HALF_OPEN = 'gateway.circuit_breaker.half_open',

  // Agent failure events
  AGENT_FAILURE = 'gateway.agent.failure',
  AGENT_TIMEOUT = 'gateway.agent.timeout',
  AGENT_ERROR = 'gateway.agent.error',
  AGENT_UNAVAILABLE = 'gateway.agent.unavailable',

  // Fallback events
  FALLBACK_TRIGGERED = 'gateway.fallback.triggered',
  FALLBACK_SUCCESS = 'gateway.fallback.success',
  FALLBACK_FAILED = 'gateway.fallback.failed',

  // Trust events
  AGENT_TRUST_REVOKED = 'gateway.agent.trust_revoked',
  AGENT_PLACED_ON_PROBATION = 'gateway.agent.placed_on_probation',

  // Recovery events
  AGENT_RECOVERED = 'gateway.agent.recovered',
  AGENT_HEALTHY = 'gateway.agent.healthy',
}

/**
 * Gateway event payload
 *
 * All events follow this structure for consistent handling
 */
export interface GatewayEvent {
  type: GatewayEventType;
  timestamp: string;
  agent_id?: string;
  request_id?: string;
  data: {
    reason?: string;
    previous_state?: string;
    new_state?: string;
    error?: {
      code: string;
      message: string;
    };
    metadata?: Record<string, any>;
  };
}

/**
 * Create a gateway event
 */
export function createGatewayEvent(
  type: GatewayEventType,
  data: Omit<GatewayEvent, 'type' | 'timestamp'>
): GatewayEvent {
  return {
    type,
    timestamp: new Date().toISOString(),
    ...data,
  };
}

/**
 * Circuit breaker states
 */
export enum CircuitBreakerState {
  OPEN = 'open',
  CLOSED = 'closed',
  HALF_OPEN = 'half_open',
}

/**
 * Check if event is a circuit breaker event
 */
export function isCircuitBreakerEvent(event: GatewayEvent): boolean {
  return [
    GatewayEventType.CIRCUIT_BREAKER_OPENED,
    GatewayEventType.CIRCUIT_BREAKER_CLOSED,
    GatewayEventType.CIRCUIT_BREAKER_HALF_OPEN,
  ].includes(event.type);
}

/**
 * Check if event is an agent failure event
 */
export function isAgentFailureEvent(event: GatewayEvent): boolean {
  return [
    GatewayEventType.AGENT_FAILURE,
    GatewayEventType.AGENT_TIMEOUT,
    GatewayEventType.AGENT_ERROR,
    GatewayEventType.AGENT_UNAVAILABLE,
  ].includes(event.type);
}

/**
 * Check if event is a fallback event
 */
export function isFallbackEvent(event: GatewayEvent): boolean {
  return [
    GatewayEventType.FALLBACK_TRIGGERED,
    GatewayEventType.FALLBACK_SUCCESS,
    GatewayEventType.FALLBACK_FAILED,
  ].includes(event.type);
}

/**
 * Check if event indicates agent is unhealthy
 */
export function isUnhealthyEvent(event: GatewayEvent): boolean {
  return isAgentFailureEvent(event) ||
    event.type === GatewayEventType.AGENT_TRUST_REVOKED ||
    event.type === GatewayEventType.AGENT_PLACED_ON_PROBATION;
}

/**
 * Check if event indicates agent recovery
 */
export function isRecoveryEvent(event: GatewayEvent): boolean {
  return [
    GatewayEventType.AGENT_RECOVERED,
    GatewayEventType.AGENT_HEALTHY,
    GatewayEventType.CIRCUIT_BREAKER_CLOSED,
  ].includes(event.type);
}
