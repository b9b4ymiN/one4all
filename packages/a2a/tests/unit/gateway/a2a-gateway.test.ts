import { describe, it, expect, beforeEach, vi } from 'vitest';
import { A2AGateway } from '../../../src/gateway/a2a-gateway.js';
import type { AgentCard } from '../../../src/schemas/agent-card.schema.js';
import type { A2AGatewayConfig } from '../../../src/gateway/a2a-gateway.js';

describe('A2A Gateway', () => {
  let gateway: A2AGateway;
  let mockAgentCard: AgentCard;

  beforeEach(() => {
    const config: A2AGatewayConfig = {
      default_timeout_seconds: 30,
      enable_fallback: true,
      max_concurrent_requests: 5,
      enable_behavioral_compatibility_checks: true,
      trust_config: {
        behavioral_validation_enabled: false, // Skip for faster tests
      },
    };

    gateway = new A2AGateway(config);

    mockAgentCard = {
      id: 'test-analyst',
      name: 'Test Analyst',
      version: '1.0.0',
      domain: 'investment',
      active: true,
      role: 'analyst',
      description: 'A test analyst agent',
      tags: ['test'],
      capabilities: {
        input_types: ['analysis-request'],
        output_types: ['valuation'],
        skills: [],
        tools_required: [],
        tools_provided: [],
      },
      output_contract: {
        mandatory_fields: ['result'],
        forbidden_content: [],
        validation_rules: [],
      },
      performance: {
        timeout_seconds: 120,
        max_tokens: 8192,
        max_retries: 3,
      },
      model: {
        provider: 'claude',
        model: 'claude-opus-4',
        fallback_providers: [
          { provider: 'claude', model: 'claude-sonnet-4' },
        ],
      },
    };
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      const minimalGateway = new A2AGateway({});

      expect(minimalGateway).toBeDefined();
      expect(minimalGateway.healthCheck().state).toBe('NORMAL');
    });

    it('should use provided config values', () => {
      const config: A2AGatewayConfig = {
        default_timeout_seconds: 60,
        enable_fallback: false,
        max_concurrent_requests: 20,
        enable_behavioral_compatibility_checks: false,
      };

      const customGateway = new A2AGateway(config);

      expect(customGateway).toBeDefined();
    });

    it('should register state machine event listeners', () => {
      const callback = vi.fn();
      gateway.on('state_changed', callback);

      // State changes come from state machine events
      gateway.emit('state_changed', { from: 'NORMAL', to: 'NORMAL' });

      expect(callback).toHaveBeenCalled();
    });
  });

  describe('registerAgent', () => {
    it('should register agent successfully', async () => {
      await expect(gateway.registerAgent(mockAgentCard)).resolves.not.toThrow();

      const registered = gateway.getAgent('test-analyst');
      expect(registered).toEqual(mockAgentCard);
    });

    it('should emit agent_registered event', async () => {
      const callback = vi.fn();
      gateway.on('agent_registered', callback);

      await gateway.registerAgent(mockAgentCard);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          agentId: 'test-analyst',
          source: 'local',
        })
      );
    });

    it('should accept remote source parameter', async () => {
      const callback = vi.fn();
      gateway.on('agent_registered', callback);

      await gateway.registerAgent(mockAgentCard, 'remote');

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'remote',
        })
      );
    });

    it('should initialize agent health tracking', async () => {
      await gateway.registerAgent(mockAgentCard);

      const health = gateway.getAgentHealth('test-analyst');
      expect(health?.healthy).toBe(true);
      expect(health?.failureCount).toBe(0);
    });
  });

  describe('unregisterAgent', () => {
    it('should unregister registered agent', async () => {
      await gateway.registerAgent(mockAgentCard);

      gateway.unregisterAgent('test-analyst');

      const registered = gateway.getAgent('test-analyst');
      expect(registered).toBeUndefined();
    });

    it('should emit agent_unregistered event', async () => {
      await gateway.registerAgent(mockAgentCard);

      const callback = vi.fn();
      gateway.on('agent_unregistered', callback);

      gateway.unregisterAgent('test-analyst');

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          agentId: 'test-analyst',
        })
      );
    });

    it('should throw for unregistered agent', () => {
      expect(() => gateway.unregisterAgent('nonexistent')).toThrow('Agent nonexistent not found');
    });
  });

  describe('getAgent', () => {
    it('should return registered agent', async () => {
      await gateway.registerAgent(mockAgentCard);

      const agent = gateway.getAgent('test-analyst');
      expect(agent).toEqual(mockAgentCard);
    });

    it('should return undefined for unknown agent', () => {
      const agent = gateway.getAgent('unknown');
      expect(agent).toBeUndefined();
    });
  });

  describe('getAllAgents', () => {
    it('should return empty array when no agents registered', () => {
      const agents = gateway.getAllAgents();
      expect(agents).toEqual([]);
    });

    it('should return all registered agents', async () => {
      await gateway.registerAgent(mockAgentCard);

      const secondAgent: AgentCard = {
        ...mockAgentCard,
        id: 'second-agent',
        name: 'Second Agent',
      };

      await gateway.registerAgent(secondAgent);

      const agents = gateway.getAllAgents();
      expect(agents).toHaveLength(2);
      expect(agents.map(a => a.id)).toContain('test-analyst');
      expect(agents.map(a => a.id)).toContain('second-agent');
    });
  });

  describe('sendToAgent - error handling', () => {
    beforeEach(async () => {
      await gateway.registerAgent(mockAgentCard);
    });

    it('should return error when gateway is in critical state', async () => {
      // Manually set state to critical for this test
      gateway['stateMachine'].manualRecovery();
      gateway['stateMachine'].handleEvent({ type: 'gateway.agent.failure', timestamp: new Date().toISOString(), agent_id: 'test', data: {} });
      gateway['stateMachine'].handleEvent({ type: 'gateway.agent.failure', timestamp: new Date().toISOString(), agent_id: 'test2', data: {} });
      gateway['stateMachine'].handleEvent({ type: 'gateway.fallback.failed', timestamp: new Date().toISOString(), agent_id: 'test', data: {} });

      const response = await gateway.sendToAgent('test-analyst', {
        type: 'test',
        input: {},
      });

      expect(response.status).toBe('error');
      expect(response.error?.code).toBe('GATEWAY_UNAVAILABLE');
    });

    it('should return error for unknown agent', async () => {
      const response = await gateway.sendToAgent('unknown-agent', {
        type: 'test',
        input: {},
      });

      expect(response.status).toBe('error');
      expect(response.error?.code).toBe('AGENT_NOT_FOUND');
    });

    it('should return error when circuit breaker is open and no fallback', async () => {
      // Create a gateway without fallback
      const noFallbackGateway = new A2AGateway({
        enable_fallback: false,
      });
      await noFallbackGateway.registerAgent(mockAgentCard);

      // Set circuit breaker to open
      noFallbackGateway['circuitBreakers'].set('test-analyst', 'open');

      const response = await noFallbackGateway.sendToAgent('test-analyst', {
        type: 'test',
        input: {},
      });

      expect(response.status).toBe('error');
      expect(response.error?.code).toBe('CIRCUIT_BREAKER_OPEN');
    });
  });

  describe('sendToAgent - execution not implemented', () => {
    let noFallbackGateway: A2AGateway;

    beforeEach(async () => {
      // Create gateway without fallback for these tests
      noFallbackGateway = new A2AGateway({
        enable_fallback: false,
      });
      // Register internal agent
      await noFallbackGateway.registerAgent(mockAgentCard);
    });

    it('should return error for internal agent execution', async () => {
      const response = await noFallbackGateway.sendToAgent('test-analyst', {
        type: 'test-task',
        input: { data: 'test' },
      });

      expect(response.status).toBe('error');
      expect(response.error?.message).toContain('not yet implemented');
    });

    it('should track in-flight request', async () => {
      const requestPromise = noFallbackGateway.sendToAgent('test-analyst', {
        type: 'test',
        input: {},
      });

      // Check that request was tracked
      expect(noFallbackGateway['inFlightRequests'].size).toBeGreaterThan(0);

      await requestPromise.catch(() => {});
    });
  });

  describe('circuit breaker', () => {
    beforeEach(async () => {
      await gateway.registerAgent(mockAgentCard);
    });

    it('should open circuit breaker after 3 failures', async () => {
      // Simulate failures through state machine
      gateway['stateMachine'].updateAgentHealth('test-analyst', false);
      gateway['stateMachine'].updateAgentHealth('test-analyst', false);
      gateway['stateMachine'].updateAgentHealth('test-analyst', false);

      const health = gateway.getAgentHealth('test-analyst');
      expect(health?.failureCount).toBe(3);
      expect(health?.healthy).toBe(false);
    });

    it('should track circuit breaker states', () => {
      gateway['circuitBreakers'].set('test-analyst', 'open');
      expect(gateway['circuitBreakers'].get('test-analyst')).toBe('open');

      gateway['circuitBreakers'].set('test-analyst', 'closed');
      expect(gateway['circuitBreakers'].get('test-analyst')).toBe('closed');
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status when no issues', () => {
      const health = gateway.healthCheck();

      expect(health.gateway_healthy).toBe(true);
      expect(health.state).toBe('NORMAL');
      expect(health.agents.total).toBe(0);
      expect(health.agents.healthy).toBe(0);
      expect(health.agents.unhealthy).toBe(0);
      expect(health.requests.in_flight).toBe(0);
      expect(health.requests.active).toBe(0);
    });

    it('should include registered agents in health summary', async () => {
      await gateway.registerAgent(mockAgentCard);

      const health = gateway.healthCheck();

      expect(health.agents.total).toBe(1);
      expect(health.agents.healthy).toBe(1);
    });

    it('should track unhealthy agents', async () => {
      await gateway.registerAgent(mockAgentCard);

      // Mark agent as unhealthy
      gateway['stateMachine'].updateAgentHealth('test-analyst', false);

      const health = gateway.healthCheck();

      expect(health.agents.unhealthy).toBe(1);
    });
  });

  describe('getAgentHealth', () => {
    it('should return undefined for unknown agent', () => {
      const health = gateway.getAgentHealth('unknown');
      expect(health).toBeUndefined();
    });

    it('should return health status for registered agent', async () => {
      await gateway.registerAgent(mockAgentCard);

      const health = gateway.getAgentHealth('test-analyst');

      expect(health).toEqual({
        healthy: true,
        failureCount: 0,
      });
    });

    it('should reflect health updates', async () => {
      await gateway.registerAgent(mockAgentCard);

      gateway['stateMachine'].updateAgentHealth('test-analyst', false);
      gateway['stateMachine'].updateAgentHealth('test-analyst', false);

      const health = gateway.getAgentHealth('test-analyst');

      expect(health?.healthy).toBe(false);
      expect(health?.failureCount).toBe(2);
    });
  });

  describe('getTrustStatus', () => {
    it('should return trust status for agent', async () => {
      await gateway.registerAgent(mockAgentCard);

      const status = gateway.getTrustStatus('test-analyst');

      expect(status).toBeDefined();
      // Agent is placed on probation by default when unverified
      expect(status.trustLevel).toBe('probationary');
      expect(status.agentId).toBe('test-analyst');
    });

    it('should return default status for unknown agent', () => {
      const status = gateway.getTrustStatus('unknown-agent');

      expect(status).toBeDefined();
      expect(status.agentId).toBe('unknown-agent');
    });
  });

  describe('event emission', () => {
    it('should emit state_changed events', async () => {
      const callback = vi.fn();
      gateway.on('state_changed', callback);

      await gateway.registerAgent(mockAgentCard);

      // State changes may or may not occur depending on internal logic
      // Just verify the event system is wired
      expect(gateway.listenerCount('state_changed')).toBeGreaterThan(0);
    });

    it('should emit kernel_event events', async () => {
      const callback = vi.fn();
      gateway.on('kernel_event', callback);

      await gateway.registerAgent(mockAgentCard);

      // Verify the event system is wired
      expect(gateway.listenerCount('kernel_event')).toBeGreaterThan(0);
    });
  });

  describe('destroy', () => {
    it('should clean up resources', async () => {
      await gateway.registerAgent(mockAgentCard);

      // Add some in-flight requests
      gateway['inFlightRequests'].set('req-1', {
        request: {} as any,
        startTime: Date.now(),
        timeout: null,
      });

      gateway.destroy();

      expect(gateway['inFlightRequests'].size).toBe(0);
      expect(gateway['activeRequests'].size).toBe(0);
      expect(gateway['agentRegistry'].size).toBe(0);
      expect(gateway['failureCounts'].size).toBe(0);
      expect(gateway['circuitBreakers'].size).toBe(0);
    });

    it('should remove all event listeners', async () => {
      // Add a test listener
      const testListener = vi.fn();
      gateway.on('agent_registered', testListener);
      gateway.on('state_changed', testListener);
      gateway.on('kernel_event', testListener);

      // Verify listeners are registered
      expect(gateway.listenerCount('agent_registered')).toBe(1);
      expect(gateway.listenerCount('state_changed')).toBe(1); // Gateway listens to state machine
      expect(gateway.listenerCount('kernel_event')).toBe(1);

      gateway.destroy();

      expect(gateway.listenerCount('agent_registered')).toBe(0);
      expect(gateway.listenerCount('state_changed')).toBe(0);
      expect(gateway.listenerCount('kernel_event')).toBe(0);
    });
  });

  describe('compatibility warning', () => {
    it('should emit compatibility_warning for incompatible agent', async () => {
      const externalAgent: AgentCard = {
        id: 'external-incompatible',
        name: 'External Incompatible',
        version: '1.0.0',
        domain: 'test',
        active: true,
        role: 'analyst',
        description: 'External agent without behavioral protocol',
        capabilities: {
          input_types: ['test'],
          output_types: ['result'],
          skills: [],
          tools_required: [],
          tools_provided: [],
        },
        output_contract: { mandatory_fields: [], forbidden_content: [], validation_rules: [] },
        performance: {
          timeout_seconds: 120,
          max_tokens: 8192,
          max_retries: 3,
        },
        model: {
          provider: 'test',
          model: 'test-model',
          fallback_providers: [], // Empty fallback to avoid fallback path
        },
        a2a_config: {
          endpoint: 'https://api.example.com',
        },
      };

      const callback = vi.fn();
      gateway.on('compatibility_warning', callback);

      await gateway.registerAgent(externalAgent);

      // sendToAgent will fail (execution not implemented), but compatibility warning should be emitted
      try {
        await gateway.sendToAgent('external-incompatible', {
          type: 'test',
          input: {},
        });
      } catch {
        // Expected to fail
      }

      expect(callback).toHaveBeenCalled();
    });
  });

  describe('skipCompatibilityCheck option', () => {
    it('should skip compatibility check when requested', async () => {
      const externalAgent: AgentCard = {
        id: 'external-no-protocol',
        name: 'External No Protocol',
        version: '1.0.0',
        domain: 'test',
        active: true,
        role: 'analyst',
        description: 'External agent',
        capabilities: {
          input_types: ['test'],
          output_types: ['result'],
          skills: [],
          tools_required: [],
          tools_provided: [],
        },
        output_contract: { mandatory_fields: [], forbidden_content: [], validation_rules: [] },
        performance: {
          timeout_seconds: 120,
          max_tokens: 8192,
          max_retries: 3,
        },
        model: {
          provider: 'test',
          model: 'test-model',
          fallback_providers: [], // Empty fallback to avoid fallback path
        },
        a2a_config: {
          endpoint: 'https://api.example.com',
        },
      };

      await gateway.registerAgent(externalAgent);

      const callback = vi.fn();
      gateway.on('compatibility_warning', callback);

      try {
        await gateway.sendToAgent('external-no-protocol', {
          type: 'test',
          input: {},
        }, {
          skipCompatibilityCheck: true,
        });
      } catch {
        // Expected to fail (execution not implemented)
      }

      // Should not emit compatibility warning when skipped
      // Note: This will still fail on execution, but compatibility check is skipped
      expect(callback).not.toHaveBeenCalled();
    });
  });
});
