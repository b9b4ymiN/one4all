import { describe, it, expect, beforeEach, vi } from 'vitest';
import { A2AGatewayStateMachine } from '../../../src/gateway/gateway-state-machine.js';
import { GatewayEventType, createGatewayEvent } from '../../../src/events/gateway-events.js';
import type { A2AGatewayState, AgentHealth, EscalationPolicy } from '../../../src/gateway/gateway-state-machine.js';

describe('A2AGatewayStateMachine', () => {
  let stateMachine: A2AGatewayStateMachine;

  beforeEach(() => {
    stateMachine = new A2AGatewayStateMachine();
  });

  describe('initial state', () => {
    it('should start in NORMAL state', () => {
      expect(stateMachine.getState()).toBe('NORMAL');
    });

    it('should have empty agent health tracking', () => {
      const summary = stateMachine.getHealthSummary();
      expect(summary.totalAgents).toBe(0);
      expect(summary.healthyAgents).toBe(0);
      expect(summary.unhealthyAgents).toBe(0);
    });

    it('should accept requests in NORMAL state', () => {
      expect(stateMachine.canAcceptRequests()).toBe(true);
    });
  });

  describe('state transitions', () => {
    it('should transition from NORMAL to DEGRADED on circuit breaker open', () => {
      const event = createGatewayEvent(
        GatewayEventType.CIRCUIT_BREAKER_OPENED,
        {
          agent_id: 'test-agent',
          data: { reason: 'Failure threshold', previous_state: 'closed', new_state: 'open' },
        }
      );

      stateMachine.handleEvent(event);

      expect(stateMachine.getState()).toBe('DEGRADED');
    });

    it('should transition from DEGRADED to NORMAL on agent recovery', () => {
      // First transition to DEGRADED
      stateMachine.handleEvent(createGatewayEvent(
        GatewayEventType.CIRCUIT_BREAKER_OPENED,
        { agent_id: 'test-agent', data: {} }
      ));

      expect(stateMachine.getState()).toBe('DEGRADED');

      // Then recover
      stateMachine.handleEvent(createGatewayEvent(
        GatewayEventType.AGENT_RECOVERED,
        { agent_id: 'test-agent', data: { previous_state: 'unhealthy' } }
      ));

      expect(stateMachine.getState()).toBe('NORMAL');
    });

    it('should transition from DEGRADED to FALLBACK on multiple agent failures', () => {
      // First transition to DEGRADED
      stateMachine.handleEvent(createGatewayEvent(
        GatewayEventType.CIRCUIT_BREAKER_OPENED,
        { agent_id: 'agent-1', data: {} }
      ));

      expect(stateMachine.getState()).toBe('DEGRADED');

      // Multiple agent failures trigger fallback
      stateMachine.handleEvent(createGatewayEvent(
        GatewayEventType.AGENT_FAILURE,
        { agent_id: 'agent-2', data: {} }
      ));

      stateMachine.handleEvent(createGatewayEvent(
        GatewayEventType.AGENT_FAILURE,
        { agent_id: 'agent-3', data: {} }
      ));

      expect(stateMachine.getState()).toBe('FALLBACK');
    });

    it('should transition from FALLBACK to CRITICAL on fallback failure', () => {
      // Transition to FALLBACK
      stateMachine.handleEvent(createGatewayEvent(
        GatewayEventType.CIRCUIT_BREAKER_OPENED,
        { agent_id: 'agent-1', data: {} }
      ));
      stateMachine.handleEvent(createGatewayEvent(
        GatewayEventType.AGENT_FAILURE,
        { agent_id: 'agent-2', data: {} }
      ));

      expect(stateMachine.getState()).toBe('FALLBACK');

      // Fallback failure triggers CRITICAL
      stateMachine.handleEvent(createGatewayEvent(
        GatewayEventType.FALLBACK_FAILED,
        { agent_id: 'agent-1', data: { error: { code: 'ALL_FALLBACKS_FAILED', message: 'All failed' } } }
      ));

      expect(stateMachine.getState()).toBe('CRITICAL');
    });

    it('should not accept requests in CRITICAL state', () => {
      // Trigger path to CRITICAL
      stateMachine.handleEvent(createGatewayEvent(
        GatewayEventType.CIRCUIT_BREAKER_OPENED,
        { agent_id: 'agent-1', data: {} }
      ));
      stateMachine.handleEvent(createGatewayEvent(
        GatewayEventType.AGENT_FAILURE,
        { agent_id: 'agent-2', data: {} }
      ));
      stateMachine.handleEvent(createGatewayEvent(
        GatewayEventType.FALLBACK_FAILED,
        { agent_id: 'agent-1', data: {} }
      ));

      expect(stateMachine.getState()).toBe('CRITICAL');
      expect(stateMachine.canAcceptRequests()).toBe(false);
    });

    it('should transition from CRITICAL to NORMAL on manual recovery', () => {
      // Get to CRITICAL
      stateMachine.handleEvent(createGatewayEvent(
        GatewayEventType.CIRCUIT_BREAKER_OPENED,
        { agent_id: 'agent-1', data: {} }
      ));
      stateMachine.handleEvent(createGatewayEvent(
        GatewayEventType.AGENT_FAILURE,
        { agent_id: 'agent-2', data: {} }
      ));
      stateMachine.handleEvent(createGatewayEvent(
        GatewayEventType.FALLBACK_FAILED,
        { agent_id: 'agent-1', data: {} }
      ));

      expect(stateMachine.getState()).toBe('CRITICAL');

      // Manual recovery event
      stateMachine.manualRecovery();

      expect(stateMachine.getState()).toBe('NORMAL');
    });
  });

  describe('agent health tracking', () => {
    it('should track agent as healthy on update', () => {
      stateMachine.updateAgentHealth('agent-1', true);

      const health = stateMachine.getAgentState('agent-1');
      expect(health?.healthy).toBe(true);
      expect(health?.failureCount).toBe(0);
    });

    it('should track agent as unhealthy on failure', () => {
      stateMachine.updateAgentHealth('agent-1', false);

      const health = stateMachine.getAgentState('agent-1');
      expect(health?.healthy).toBe(false);
      expect(health?.failureCount).toBe(1);
    });

    it('should increment failure count on repeated failures', () => {
      stateMachine.updateAgentHealth('agent-1', false);
      stateMachine.updateAgentHealth('agent-1', false);
      stateMachine.updateAgentHealth('agent-1', false);

      const health = stateMachine.getAgentState('agent-1');
      expect(health?.failureCount).toBe(3);
    });

    it('should reset failure count on successful health update', () => {
      stateMachine.updateAgentHealth('agent-1', false);
      stateMachine.updateAgentHealth('agent-1', false);
      expect(stateMachine.getAgentState('agent-1')?.failureCount).toBe(2);

      stateMachine.updateAgentHealth('agent-1', true);

      const health = stateMachine.getAgentState('agent-1');
      expect(health?.healthy).toBe(true);
      expect(health?.failureCount).toBe(0);
    });

    it('should return undefined for unknown agent', () => {
      const health = stateMachine.getAgentState('unknown-agent');
      expect(health).toBeUndefined();
    });

    it('should provide health summary', () => {
      stateMachine.updateAgentHealth('agent-1', true);
      stateMachine.updateAgentHealth('agent-2', true);
      stateMachine.updateAgentHealth('agent-3', false);
      stateMachine.updateAgentHealth('agent-4', false);

      const summary = stateMachine.getHealthSummary();
      expect(summary.totalAgents).toBe(4);
      expect(summary.healthyAgents).toBe(2);
      expect(summary.unhealthyAgents).toBe(2);
    });
  });

  describe('escalation policies', () => {
    it('should return NORMAL escalation policy', () => {
      const policy = stateMachine.getEscalationPolicy();

      expect(policy.currentState).toBe('NORMAL');
      expect(policy.conditions[0].trigger).toBe('Circuit breaker opens');
      expect(policy.conditions[0].nextState).toBe('DEGRADED');
    });

    it('should return DEGRADED escalation policy', () => {
      stateMachine.handleEvent(createGatewayEvent(
        GatewayEventType.CIRCUIT_BREAKER_OPENED,
        { agent_id: 'agent-1', data: {} }
      ));

      const policy = stateMachine.getEscalationPolicy();

      expect(policy.currentState).toBe('DEGRADED');
      expect(policy.conditions.some(c => c.trigger === 'Agent recovery' && c.nextState === 'NORMAL')).toBe(true);
      expect(policy.conditions.some(c => c.trigger === 'Multiple agent failures' && c.nextState === 'FALLBACK')).toBe(true);
    });

    it('should return FALLBACK escalation policy', () => {
      stateMachine.handleEvent(createGatewayEvent(
        GatewayEventType.CIRCUIT_BREAKER_OPENED,
        { agent_id: 'agent-1', data: {} }
      ));
      stateMachine.handleEvent(createGatewayEvent(
        GatewayEventType.AGENT_FAILURE,
        { agent_id: 'agent-2', data: {} }
      ));

      const policy = stateMachine.getEscalationPolicy();

      expect(policy.currentState).toBe('FALLBACK');
      expect(policy.conditions.some(c => c.trigger === 'All fallbacks failed' && c.nextState === 'CRITICAL')).toBe(true);
    });

    it('should return CRITICAL escalation policy', () => {
      stateMachine.handleEvent(createGatewayEvent(
        GatewayEventType.CIRCUIT_BREAKER_OPENED,
        { agent_id: 'agent-1', data: {} }
      ));
      stateMachine.handleEvent(createGatewayEvent(
        GatewayEventType.AGENT_FAILURE,
        { agent_id: 'agent-2', data: {} }
      ));
      stateMachine.handleEvent(createGatewayEvent(
        GatewayEventType.FALLBACK_FAILED,
        { agent_id: 'agent-1', data: {} }
      ));

      const policy = stateMachine.getEscalationPolicy();

      expect(policy.currentState).toBe('CRITICAL');
      expect(policy.conditions[0].trigger).toBe('Manual intervention');
      expect(policy.conditions[0].nextState).toBe('NORMAL');
    });
  });

  describe('event emission', () => {
    it('should emit state_transition event on state change', () => {
      const callback = vi.fn();
      stateMachine.on('state_transition', callback);

      stateMachine.handleEvent(createGatewayEvent(
        GatewayEventType.CIRCUIT_BREAKER_OPENED,
        { agent_id: 'agent-1', data: {} }
      ));

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'NORMAL',
          to: 'DEGRADED',
          reason: expect.stringContaining('Circuit breaker opened'),
        })
      );
    });

    it('should emit kernel_event for gateway events', async () => {
      const callback = vi.fn();
      stateMachine.on('kernel_event', callback);

      await stateMachine.handleEvent(createGatewayEvent(
        GatewayEventType.AGENT_FAILURE,
        { agent_id: 'agent-1', request_id: 'req-123', data: {} }
      ));

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'a2a-gateway',
          event_type: GatewayEventType.AGENT_FAILURE,
          agent_id: 'agent-1',
        })
      );
    });
  });

  describe('getState', () => {
    it('should return current state', () => {
      expect(stateMachine.getState()).toBe('NORMAL');

      stateMachine.handleEvent(createGatewayEvent(
        GatewayEventType.CIRCUIT_BREAKER_OPENED,
        { agent_id: 'agent-1', data: {} }
      ));

      expect(stateMachine.getState()).toBe('DEGRADED');
    });
  });

  describe('getTransitionHistory', () => {
    it('should track state transitions', () => {
      stateMachine.handleEvent(createGatewayEvent(
        GatewayEventType.CIRCUIT_BREAKER_OPENED,
        { agent_id: 'agent-1', data: {} }
      ));

      const history = stateMachine.getTransitionHistory();

      expect(history).toHaveLength(1);
      expect(history[0]).toEqual(
        expect.objectContaining({
          from: 'NORMAL',
          to: 'DEGRADED',
        })
      );
    });

    it('should maintain order of transitions', () => {
      stateMachine.handleEvent(createGatewayEvent(
        GatewayEventType.CIRCUIT_BREAKER_OPENED,
        { agent_id: 'agent-1', data: {} }
      ));
      stateMachine.handleEvent(createGatewayEvent(
        GatewayEventType.AGENT_RECOVERED,
        { agent_id: 'agent-1', data: {} }
      ));

      const history = stateMachine.getTransitionHistory();

      expect(history).toHaveLength(2);
      expect(history[0].to).toBe('DEGRADED');
      expect(history[1].to).toBe('NORMAL');
    });
  });
});
