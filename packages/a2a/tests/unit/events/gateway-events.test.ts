import { describe, it, expect } from 'vitest';
import {
  GatewayEventType,
  createGatewayEvent,
  isCircuitBreakerEvent,
  isAgentFailureEvent,
  isFallbackEvent,
  isUnhealthyEvent,
  isRecoveryEvent,
  type GatewayEvent,
  type CircuitBreakerState,
} from '../../../src/events/gateway-events.js';

describe('Gateway Events', () => {
  describe('createGatewayEvent', () => {
    it('should create circuit breaker opened event', () => {
      const event = createGatewayEvent(
        GatewayEventType.CIRCUIT_BREAKER_OPENED,
        {
          agent_id: 'test-agent',
          data: {
            reason: 'Failure threshold reached',
            previous_state: 'closed',
            new_state: 'open',
          },
        }
      );

      expect(event.type).toBe(GatewayEventType.CIRCUIT_BREAKER_OPENED);
      expect(event.agent_id).toBe('test-agent');
      expect(event.data.reason).toBe('Failure threshold reached');
      expect(event.timestamp).toBeDefined();
    });

    it('should create agent failure event', () => {
      const event = createGatewayEvent(
        GatewayEventType.AGENT_FAILURE,
        {
          agent_id: 'test-agent',
          request_id: 'req-123',
          data: {
            error: { code: 'AGENT_EXECUTION_FAILED', message: 'Agent failed' },
          },
        }
      );

      expect(event.type).toBe(GatewayEventType.AGENT_FAILURE);
      expect(event.agent_id).toBe('test-agent');
      expect(event.request_id).toBe('req-123');
      expect(event.data.error.code).toBe('AGENT_EXECUTION_FAILED');
    });

    it('should create fallback triggered event', () => {
      const event = createGatewayEvent(
        GatewayEventType.FALLBACK_TRIGGERED,
        {
          agent_id: 'test-agent',
          data: {
            reason: 'Primary agent failed',
            metadata: { fallback_count: 2 },
          },
        }
      );

      expect(event.type).toBe(GatewayEventType.FALLBACK_TRIGGERED);
      expect(event.data.reason).toBe('Primary agent failed');
      expect(event.data.metadata.fallback_count).toBe(2);
    });

    it('should create trust revoked event', () => {
      const event = createGatewayEvent(
        GatewayEventType.AGENT_TRUST_REVOKED,
        {
          agent_id: 'test-agent',
          data: {
            reason: 'Too many trust violations',
            previous_trust_level: 'trusted',
          },
        }
      );

      expect(event.type).toBe(GatewayEventType.AGENT_TRUST_REVOKED);
      expect(event.data.reason).toBe('Too many trust violations');
    });

    it('should create agent recovered event', () => {
      const event = createGatewayEvent(
        GatewayEventType.AGENT_RECOVERED,
        {
          agent_id: 'test-agent',
          data: {
            duration_ms: 5000,
            previous_state: 'unhealthy',
          },
        }
      );

      expect(event.type).toBe(GatewayEventType.AGENT_RECOVERED);
      expect(event.data.duration_ms).toBe(5000);
    });
  });

  describe('isCircuitBreakerEvent', () => {
    it('should return true for circuit breaker opened event', () => {
      const event: GatewayEvent = {
        type: GatewayEventType.CIRCUIT_BREAKER_OPENED,
        timestamp: new Date().toISOString(),
        agent_id: 'test-agent',
        data: {},
      };

      expect(isCircuitBreakerEvent(event)).toBe(true);
    });

    it('should return true for circuit breaker closed event', () => {
      const event: GatewayEvent = {
        type: GatewayEventType.CIRCUIT_BREAKER_CLOSED,
        timestamp: new Date().toISOString(),
        agent_id: 'test-agent',
        data: {},
      };

      expect(isCircuitBreakerEvent(event)).toBe(true);
    });

    it('should return true for circuit breaker half-open event', () => {
      const event: GatewayEvent = {
        type: GatewayEventType.CIRCUIT_BREAKER_HALF_OPEN,
        timestamp: new Date().toISOString(),
        agent_id: 'test-agent',
        data: {},
      };

      expect(isCircuitBreakerEvent(event)).toBe(true);
    });

    it('should return false for non-circuit breaker event', () => {
      const event: GatewayEvent = {
        type: GatewayEventType.AGENT_FAILURE,
        timestamp: new Date().toISOString(),
        agent_id: 'test-agent',
        data: {},
      };

      expect(isCircuitBreakerEvent(event)).toBe(false);
    });
  });

  describe('isAgentFailureEvent', () => {
    it('should return true for agent failure event', () => {
      const event: GatewayEvent = {
        type: GatewayEventType.AGENT_FAILURE,
        timestamp: new Date().toISOString(),
        agent_id: 'test-agent',
        data: {},
      };

      expect(isAgentFailureEvent(event)).toBe(true);
    });

    it('should return true for agent timeout event', () => {
      const event: GatewayEvent = {
        type: GatewayEventType.AGENT_TIMEOUT,
        timestamp: new Date().toISOString(),
        agent_id: 'test-agent',
        request_id: 'req-123',
        data: {},
      };

      expect(isAgentFailureEvent(event)).toBe(true);
    });

    it('should return true for agent unavailable event', () => {
      const event: GatewayEvent = {
        type: GatewayEventType.AGENT_UNAVAILABLE,
        timestamp: new Date().toISOString(),
        agent_id: 'test-agent',
        data: {},
      };

      expect(isAgentFailureEvent(event)).toBe(true);
    });

    it('should return false for non-failure event', () => {
      const event: GatewayEvent = {
        type: GatewayEventType.AGENT_RECOVERED,
        timestamp: new Date().toISOString(),
        agent_id: 'test-agent',
        data: {},
      };

      expect(isAgentFailureEvent(event)).toBe(false);
    });
  });

  describe('isFallbackEvent', () => {
    it('should return true for fallback triggered event', () => {
      const event: GatewayEvent = {
        type: GatewayEventType.FALLBACK_TRIGGERED,
        timestamp: new Date().toISOString(),
        agent_id: 'test-agent',
        data: {},
      };

      expect(isFallbackEvent(event)).toBe(true);
    });

    it('should return true for fallback failed event', () => {
      const event: GatewayEvent = {
        type: GatewayEventType.FALLBACK_FAILED,
        timestamp: new Date().toISOString(),
        agent_id: 'test-agent',
        data: {},
      };

      expect(isFallbackEvent(event)).toBe(true);
    });

    it('should return false for non-fallback event', () => {
      const event: GatewayEvent = {
        type: GatewayEventType.AGENT_FAILURE,
        timestamp: new Date().toISOString(),
        agent_id: 'test-agent',
        data: {},
      };

      expect(isFallbackEvent(event)).toBe(false);
    });
  });

  describe('isUnhealthyEvent', () => {
    it('should return true for agent placed on probation event', () => {
      const event: GatewayEvent = {
        type: GatewayEventType.AGENT_PLACED_ON_PROBATION,
        timestamp: new Date().toISOString(),
        agent_id: 'test-agent',
        data: {},
      };

      expect(isUnhealthyEvent(event)).toBe(true);
    });

    it('should return true for trust revoked event', () => {
      const event: GatewayEvent = {
        type: GatewayEventType.AGENT_TRUST_REVOKED,
        timestamp: new Date().toISOString(),
        agent_id: 'test-agent',
        data: {},
      };

      expect(isUnhealthyEvent(event)).toBe(true);
    });

    it('should return false for healthy event', () => {
      const event: GatewayEvent = {
        type: GatewayEventType.AGENT_HEALTHY,
        timestamp: new Date().toISOString(),
        agent_id: 'test-agent',
        data: {},
      };

      expect(isUnhealthyEvent(event)).toBe(false);
    });
  });

  describe('isRecoveryEvent', () => {
    it('should return true for agent recovered event', () => {
      const event: GatewayEvent = {
        type: GatewayEventType.AGENT_RECOVERED,
        timestamp: new Date().toISOString(),
        agent_id: 'test-agent',
        data: {},
      };

      expect(isRecoveryEvent(event)).toBe(true);
    });

    it('should return true for agent healthy event', () => {
      const event: GatewayEvent = {
        type: GatewayEventType.AGENT_HEALTHY,
        timestamp: new Date().toISOString(),
        agent_id: 'test-agent',
        data: {},
      };

      expect(isRecoveryEvent(event)).toBe(true);
    });

    it('should return true for circuit breaker closed event', () => {
      const event: GatewayEvent = {
        type: GatewayEventType.CIRCUIT_BREAKER_CLOSED,
        timestamp: new Date().toISOString(),
        agent_id: 'test-agent',
        data: {},
      };

      expect(isRecoveryEvent(event)).toBe(true);
    });

    it('should return false for non-recovery event', () => {
      const event: GatewayEvent = {
        type: GatewayEventType.AGENT_FAILURE,
        timestamp: new Date().toISOString(),
        agent_id: 'test-agent',
        data: {},
      };

      expect(isRecoveryEvent(event)).toBe(false);
    });
  });

  describe('Event type constants', () => {
    it('should have all circuit breaker event types', () => {
      expect(GatewayEventType.CIRCUIT_BREAKER_OPENED).toBe('gateway.circuit_breaker.opened');
      expect(GatewayEventType.CIRCUIT_BREAKER_CLOSED).toBe('gateway.circuit_breaker.closed');
      expect(GatewayEventType.CIRCUIT_BREAKER_HALF_OPEN).toBe('gateway.circuit_breaker.half_open');
    });

    it('should have all agent failure event types', () => {
      expect(GatewayEventType.AGENT_FAILURE).toBe('gateway.agent.failure');
      expect(GatewayEventType.AGENT_TIMEOUT).toBe('gateway.agent.timeout');
      expect(GatewayEventType.AGENT_UNAVAILABLE).toBe('gateway.agent.unavailable');
    });

    it('should have all fallback event types', () => {
      expect(GatewayEventType.FALLBACK_TRIGGERED).toBe('gateway.fallback.triggered');
      expect(GatewayEventType.FALLBACK_FAILED).toBe('gateway.fallback.failed');
    });

    it('should have all trust event types', () => {
      expect(GatewayEventType.AGENT_TRUST_REVOKED).toBe('gateway.agent.trust_revoked');
      expect(GatewayEventType.AGENT_PLACED_ON_PROBATION).toBe('gateway.agent.placed_on_probation');
    });

    it('should have all recovery event types', () => {
      expect(GatewayEventType.AGENT_RECOVERED).toBe('gateway.agent.recovered');
      expect(GatewayEventType.AGENT_HEALTHY).toBe('gateway.agent.healthy');
    });
  });
});
