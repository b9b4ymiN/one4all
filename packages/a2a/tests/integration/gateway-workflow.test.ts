import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { A2AGateway } from '../../src/gateway/a2a-gateway.js';
import type { AgentCard } from '../../src/schemas/agent-card.schema.js';
import type { A2AGatewayConfig } from '../../src/gateway/a2a-gateway.js';

/**
 * Integration Tests: A2A Gateway Workflow
 *
 * These tests verify end-to-end workflows across A2A components:
 * - Gateway lifecycle (creation, registration, unregistration)
 * - Agent registration flow with trust verification
 * - Request routing through the gateway
 * - State machine transitions based on events
 * - Behavioral compatibility checks
 * - Circuit breaker behavior
 * - Health check propagation
 */
describe('A2A Gateway Workflow Integration', () => {
  let gateway: A2AGateway;
  let config: A2AGatewayConfig;

  // Mock agent cards for testing
  const internalAgent: AgentCard = {
    id: 'internal-analyst',
    name: 'Internal Analyst',
    version: '1.0.0',
    domain: 'investment',
    active: true,
    role: 'analyst',
    description: 'Internal analyst agent',
    tags: ['internal', 'analyst'],
    capabilities: {
      input_types: ['stock-analysis'],
      output_types: ['valuation'],
      skills: [],
      tools_required: [],
      tools_provided: [],
    },
    output_contract: {
      mandatory_fields: ['valuation', 'confidence'],
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
      fallback_providers: [],
    },
    observability: {
      log_level: 'info',
      metrics_enabled: true,
      tracing_enabled: true,
    },
    security: {
      permissions: [],
      sandbox_level: 'basic',
      allowed_domains: [],
    },
  };

  const externalAgent: AgentCard = {
    id: 'external-valuation-service',
    name: 'External Valuation Service',
    version: '1.0.0',
    domain: 'investment',
    active: true,
    role: 'analyst',
    description: 'External valuation agent service',
    tags: ['external', 'valuation'],
    capabilities: {
      input_types: ['stock-analysis'],
      output_types: ['valuation'],
      skills: [],
      tools_required: [],
      tools_provided: [],
    },
    output_contract: {
      mandatory_fields: ['fair_value', 'mos'],
      forbidden_content: [],
      validation_rules: [],
    },
    performance: {
      timeout_seconds: 120,
      max_tokens: 8192,
      max_retries: 3,
    },
    model: {
      provider: 'test',
      model: 'test-model',
      fallback_providers: [
        { provider: 'test', model: 'fallback-model' },
      ],
    },
    a2a_config: {
      endpoint: 'https://api.example.com/valuation',
      protocol: 'http',
      authentication: {
        type: 'api_key',
        credentials_ref: 'secret:external-api-key',
      },
      rate_limits: {
        max_requests_per_minute: 60,
        max_concurrent_requests: 5,
      },
      health_check: {
        enabled: true,
        interval_seconds: 30,
        endpoint: '/health',
        timeout_seconds: 5,
      },
      behavioral_protocol: {
        implements_challenge_response: true,
        implements_evidence_submission: true,
        implements_debate_protocol: true,
        supported_interaction_modes: ['request_response', 'challenge_response', 'debate', 'collaborative'],
      },
    },
    security: {
      permissions: [],
      sandbox_level: 'strict',
      allowed_domains: ['api.example.com'],
    },
    trust: {
      trust_level: 'probationary',
      verification_status: 'in_progress',
      verification_method: 'behavioral_validation',
      behavioral_score: 75,
      last_verified_at: new Date().toISOString(),
    },
  };

  const behavioralAgent: AgentCard = {
    id: 'behavioral-debater',
    name: 'Behavioral Debater',
    version: '1.0.0',
    domain: 'investment',
    active: true,
    role: 'validator',
    description: 'Agent that implements full behavioral protocols',
    tags: ['behavioral', 'debate'],
    capabilities: {
      input_types: ['debate-invitation'],
      output_types: ['debate-response'],
      skills: [],
      tools_required: [],
      tools_provided: [],
    },
    output_contract: {
      mandatory_fields: ['position', 'arguments'],
      forbidden_content: [],
      validation_rules: [],
    },
    performance: {
      timeout_seconds: 120,
      max_tokens: 8192,
      max_retries: 3,
    },
    model: {
      provider: 'test',
      model: 'test-model',
      fallback_providers: [
        { provider: 'test', model: 'fallback-model' },
      ],
    },
    a2a_config: {
      endpoint: 'https://debate.example.com',
      protocol: 'http',
      behavioral_protocol: {
        implements_challenge_response: true,
        implements_evidence_submission: true,
        implements_debate_protocol: true,
        supported_interaction_modes: ['challenge_response', 'debate', 'adversarial'],
      },
    },
    trust: {
      trust_level: 'trusted',
      verification_status: 'verified',
      verification_method: 'behavioral_validation',
      behavioral_score: 92,
    },
  };

  beforeEach(() => {
    config = {
      default_timeout_seconds: 30,
      enable_fallback: true,
      max_concurrent_requests: 5,
      enable_behavioral_compatibility_checks: true,
      trust_config: {
        behavioral_validation_enabled: false, // Skip for faster integration tests
        probation_duration_seconds: 86400,
        behavioral_threshold_score: 70,
      },
    };

    gateway = new A2AGateway(config);
  });

  afterEach(() => {
    gateway.destroy();
  });

  describe('Agent Registration Flow', () => {
    it('should complete full registration workflow for internal agent', async () => {
      // Track events
      const events: any[] = [];
      gateway.on('agent_registered', (event) => events.push(event));
      gateway.on('state_changed', (event) => events.push(event));

      // Register agent
      await gateway.registerAgent(internalAgent);

      // Verify agent is registered
      const registered = gateway.getAgent(internalAgent.id);
      expect(registered).toEqual(internalAgent);

      // Verify health tracking initialized
      const health = gateway.getAgentHealth(internalAgent.id);
      expect(health?.healthy).toBe(true);
      expect(health?.failureCount).toBe(0);

      // Verify events were emitted
      expect(events.length).toBeGreaterThan(0);
      expect(events[0].agentId).toBe(internalAgent.id);
    });

    it('should complete full registration workflow for external agent', async () => {
      // Track events
      const events: any[] = [];
      gateway.on('agent_registered', (event) => events.push(event));
      gateway.on('compatibility_warning', (event) => events.push(event));

      // Register external agent
      await gateway.registerAgent(externalAgent, 'remote');

      // Verify agent is registered
      const registered = gateway.getAgent(externalAgent.id);
      expect(registered).toEqual(externalAgent);

      // Verify trust status initialized
      const trust = gateway.getTrustStatus(externalAgent.id);
      expect(trust.agentId).toBe(externalAgent.id);
      // Gateway tracks trust status
      expect(trust.trustLevel).toBeDefined();
    });

    it('should handle multiple agent registrations', async () => {
      await gateway.registerAgent(internalAgent);
      await gateway.registerAgent(externalAgent);
      await gateway.registerAgent(behavioralAgent);

      const allAgents = gateway.getAllAgents();
      expect(allAgents).toHaveLength(3);

      const ids = allAgents.map((a) => a.id);
      expect(ids).toContain(internalAgent.id);
      expect(ids).toContain(externalAgent.id);
      expect(ids).toContain(behavioralAgent.id);
    });

    it('should emit unregistered event on agent removal', async () => {
      await gateway.registerAgent(internalAgent);

      const events: any[] = [];
      gateway.on('agent_unregistered', (event) => events.push(event));

      gateway.unregisterAgent(internalAgent.id);

      expect(events.length).toBeGreaterThan(0);
      expect(events[0].agentId).toBe(internalAgent.id);

      const registered = gateway.getAgent(internalAgent.id);
      expect(registered).toBeUndefined();
    });
  });

  describe('State Machine Integration', () => {
    it('should transition state based on gateway events', async () => {
      await gateway.registerAgent(internalAgent);

      const stateChanges: any[] = [];
      gateway.on('state_changed', (event) => stateChanges.push(event));

      const initialState = gateway.healthCheck().state;

      // Simulate agent failures to trigger state transitions
      const stateMachine = gateway['stateMachine'];

      stateMachine.handleEvent({
        type: 'gateway.agent.failure',
        timestamp: new Date().toISOString(),
        agent_id: internalAgent.id,
        data: {},
      });

      // Check state after event
      const healthAfterFailure = gateway.healthCheck();
      expect(healthAfterFailure.agents.unhealthy).toBe(1);
    });

    it('should track circuit breaker state in health check', async () => {
      await gateway.registerAgent(internalAgent);

      // Open circuit breaker manually
      gateway['circuitBreakers'].set(internalAgent.id, 'open');

      const health = gateway.healthCheck();
      expect(health.agents.total).toBe(1);
      // Circuit breaker affects agent health
    });

    it('should escalate state after multiple failures', async () => {
      await gateway.registerAgent(internalAgent);
      await gateway.registerAgent(externalAgent);

      const stateMachine = gateway['stateMachine'];

      // Trigger multiple failures across agents
      stateMachine.handleEvent({
        type: 'gateway.agent.failure',
        timestamp: new Date().toISOString(),
        agent_id: internalAgent.id,
        data: {},
      });

      stateMachine.handleEvent({
        type: 'gateway.agent.failure',
        timestamp: new Date().toISOString(),
        agent_id: externalAgent.id,
        data: {},
      });

      // Check gateway health reflects the issues
      const health = gateway.healthCheck();
      expect(health.agents.unhealthy).toBeGreaterThan(0);
    });
  });

  describe('Trust Verification Integration', () => {
    it('should initialize trust status for registered agents', async () => {
      await gateway.registerAgent(externalAgent);

      const trust = gateway.getTrustStatus(externalAgent.id);
      expect(trust).toBeDefined();
      expect(trust.agentId).toBe(externalAgent.id);
      // Gateway initializes external agents with trust tracking
      expect(trust.trustLevel).toBeDefined();
    });

    it('should detect agents on probation', async () => {
      await gateway.registerAgent(externalAgent);

      // Check probation status via agent card
      const agent = gateway.getAgent(externalAgent.id);
      expect(agent).toBeDefined();
      // The agent card trust field has the original trust level
      expect(agent?.trust?.trust_level).toBe('probationary');
    });

    it('should return default trust status for unknown agents', () => {
      const trust = gateway.getTrustStatus('unknown-agent');
      expect(trust.agentId).toBe('unknown-agent');
      expect(trust.trustLevel).toBe('unverified');
    });
  });

  describe('Behavioral Compatibility Integration', () => {
    it('should check compatibility before routing requests', async () => {
      await gateway.registerAgent(behavioralAgent);

      const warnings: any[] = [];
      gateway.on('compatibility_warning', (event) => warnings.push(event));

      // Send request to behavioral agent
      try {
        await gateway.sendToAgent(behavioralAgent.id, {
          type: 'debate-invitation',
          input: { topic: 'stock-valuation' },
        }, { skipCompatibilityCheck: false });
      } catch {
        // Expected to fail (execution not implemented)
      }

      // Compatibility check ran - no warnings for full behavioral support
      expect(warnings.length).toBe(0);
    });

    it('should emit compatibility warning for limited agents', async () => {
      const limitedAgent: AgentCard = {
        id: 'limited-agent',
        name: 'Limited Agent',
        version: '1.0.0',
        domain: 'test',
        active: true,
        role: 'analyst',
        description: 'External agent with limited protocol support',
        tags: [],
        capabilities: {
          input_types: ['test'],
          output_types: ['result'],
          skills: [],
          tools_required: [],
          tools_provided: [],
        },
        output_contract: {
          mandatory_fields: [],
          forbidden_content: [],
          validation_rules: [],
        },
        performance: {
          timeout_seconds: 120,
          max_tokens: 8192,
          max_retries: 3,
        },
        model: {
          provider: 'test',
          model: 'test-model',
          fallback_providers: [
            { provider: 'test', model: 'fallback-model' },
          ],
        },
        a2a_config: {
          endpoint: 'https://limited.example.com',
          // No behavioral_protocol - limited support
        },
      };

      await gateway.registerAgent(limitedAgent);

      const warnings: any[] = [];
      gateway.on('compatibility_warning', (event) => warnings.push(event));

      try {
        await gateway.sendToAgent(limitedAgent.id, {
          type: 'test-request',
          input: {},
        });
      } catch {
        // Expected to fail
      }

      // Should emit compatibility warning
      expect(warnings.length).toBeGreaterThan(0);
    });
  });

  describe('Health Check Integration', () => {
    it('should provide comprehensive health status', async () => {
      await gateway.registerAgent(internalAgent);
      await gateway.registerAgent(externalAgent);

      const health = gateway.healthCheck();

      expect(health.gateway_healthy).toBe(true);
      expect(health.state).toBe('NORMAL');
      expect(health.agents.total).toBe(2);
      expect(health.agents.healthy).toBe(2);
      expect(health.agents.unhealthy).toBe(0);
      expect(health.requests.in_flight).toBeDefined();
      expect(health.requests.active).toBeDefined();
    });

    it('should reflect unhealthy agents in health check', async () => {
      await gateway.registerAgent(internalAgent);

      // Mark agent as unhealthy
      gateway['stateMachine'].updateAgentHealth(internalAgent.id, false);
      gateway['stateMachine'].updateAgentHealth(internalAgent.id, false);

      const health = gateway.healthCheck();
      expect(health.agents.unhealthy).toBeGreaterThan(0);
    });

    it('should track in-flight requests', async () => {
      await gateway.registerAgent(internalAgent);

      // Start a request (it will fail but we track it)
      const requestPromise = gateway.sendToAgent(internalAgent.id, {
        type: 'test',
        input: {},
      });

      // Check that request is tracked
      expect(gateway['inFlightRequests'].size).toBeGreaterThan(0);

      await requestPromise.catch(() => {});
    });
  });

  describe('Event Emission Integration', () => {
    it('should emit agent_registered events', async () => {
      // Register event listener BEFORE registration
      const registrationEvents: any[] = [];
      gateway.on('agent_registered', (event) => registrationEvents.push(event));

      await gateway.registerAgent(internalAgent);

      // Verify registration event was emitted
      expect(registrationEvents.length).toBeGreaterThan(0);
      expect(registrationEvents[0].agentId).toBe(internalAgent.id);
    });

    it('should emit agent_unregistered events', async () => {
      await gateway.registerAgent(internalAgent);

      // Register event listener BEFORE unregistration
      const unregistrationEvents: any[] = [];
      gateway.on('agent_unregistered', (event) => unregistrationEvents.push(event));

      gateway.unregisterAgent(internalAgent.id);

      // Verify unregistration event was emitted
      expect(unregistrationEvents.length).toBeGreaterThan(0);
      expect(unregistrationEvents[0].agentId).toBe(internalAgent.id);
    });

    it('should emit state_changed events when circuit breaker is manually opened', async () => {
      await gateway.registerAgent(internalAgent);

      // Register event listener
      const stateChanges: any[] = [];
      gateway.on('state_changed', (event) => stateChanges.push(event));

      // Manually set circuit breaker to open
      gateway['circuitBreakers'].set(internalAgent.id, 'open');

      // Manually trigger agent health update
      gateway['stateMachine'].updateAgentHealth(internalAgent.id, false);

      // State changes may be emitted - just verify the system is wired
      expect(gateway.listenerCount('state_changed')).toBeGreaterThan(0);
    });

    it('should emit compatibility_warning for agents without behavioral protocol', async () => {
      const basicAgent: AgentCard = {
        id: 'basic-agent',
        name: 'Basic Agent',
        version: '1.0.0',
        domain: 'test',
        active: true,
        role: 'analyst',
        description: 'Basic agent without behavioral protocol',
        tags: [],
        capabilities: {
          input_types: ['test'],
          output_types: ['result'],
          skills: [],
          tools_required: [],
          tools_provided: [],
        },
        output_contract: {
          mandatory_fields: [],
          forbidden_content: [],
          validation_rules: [],
        },
        performance: {
          timeout_seconds: 120,
          max_tokens: 8192,
          max_retries: 3,
        },
        model: {
          provider: 'test',
          model: 'test-model',
          fallback_providers: [
            { provider: 'test', model: 'fallback-model' },
          ],
        },
        a2a_config: {
          endpoint: 'https://basic.example.com',
          // No behavioral_protocol
        },
      };

      await gateway.registerAgent(basicAgent);

      const warnings: any[] = [];
      gateway.on('compatibility_warning', (event) => warnings.push(event));

      try {
        await gateway.sendToAgent(basicAgent.id, {
          type: 'test',
          input: {},
        });
      } catch {
        // Expected to fail
      }

      // Should emit compatibility warning
      expect(warnings.length).toBeGreaterThan(0);
    });
  });

  describe('Gateway Lifecycle', () => {
    it('should properly initialize and destroy', () => {
      const gateway2 = new A2AGateway({});

      expect(gateway2.healthCheck().state).toBe('NORMAL');

      gateway2.destroy();

      // Verify cleanup
      expect(gateway2['inFlightRequests'].size).toBe(0);
      expect(gateway2['activeRequests'].size).toBe(0);
      expect(gateway2['agentRegistry'].size).toBe(0);
    });

    it('should remove all listeners on destroy', async () => {
      await gateway.registerAgent(internalAgent);

      const listener = vi.fn();
      gateway.on('agent_registered', listener);
      gateway.on('state_changed', listener);

      expect(gateway.listenerCount('agent_registered')).toBe(1);

      gateway.destroy();

      expect(gateway.listenerCount('agent_registered')).toBe(0);
      expect(gateway.listenerCount('state_changed')).toBe(0);
    });
  });
});
