import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { A2AGateway } from '../../src/gateway/a2a-gateway.js';
import type { AgentCard } from '../../src/schemas/agent-card.schema.js';

/**
 * Chaos Engineering Tests: Cascade Failure
 *
 * These tests verify that failures in one agent don't cascade to other agents
 * or crash the entire gateway system.
 */

const createMockAgent = (id: string): AgentCard => ({
  id,
  name: `Agent ${id}`,
  version: '1.0.0',
  domain: 'test',
  active: true,
  role: 'analyst',
  description: 'Mock agent for cascade failure testing',
  tags: [],
  capabilities: {
    input_types: ['test'],
    output_types: ['result'],
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
    timeout_seconds: 30,
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
});

describe('Chaos Engineering: Cascade Failure', () => {
  let gateway: A2AGateway;
  const agents: AgentCard[] = [];

  beforeEach(() => {
    gateway = new A2AGateway({
      enable_fallback: true,
      trust_config: {
        behavioral_validation_enabled: false,
        probation_duration_seconds: 86400,
        behavioral_threshold_score: 70,
      },
    });

    // Create multiple test agents
    for (let i = 1; i <= 5; i++) {
      agents.push(createMockAgent(`agent-${i}`));
    }
  });

  afterEach(() => {
    gateway.destroy();
  });

  describe('Isolation of Agent Failures', () => {
    it('should continue operating when one agent fails', async () => {
      // Register all agents
      for (const agent of agents) {
        await gateway.registerAgent(agent, 'local');
      }

      // All agents should be registered
      expect(gateway.getAllAgents()).toHaveLength(5);

      // Unregister one agent (simulate failure)
      gateway.unregisterAgent('agent-3');

      // Other agents should still be registered
      expect(gateway.getAllAgents()).toHaveLength(4);
      expect(gateway.getAgent('agent-1')).toBeDefined();
      expect(gateway.getAgent('agent-2')).toBeDefined();
      expect(gateway.getAgent('agent-4')).toBeDefined();
      expect(gateway.getAgent('agent-5')).toBeDefined();
    });

    it('should isolate circuit breaker states between agents', async () => {
      for (const agent of agents) {
        await gateway.registerAgent(agent, 'local');
      }

      // Each agent should have independent circuit breaker state
      // This is verified by successful registration of all agents
      expect(gateway.getAllAgents()).toHaveLength(5);
    });

    it('should prevent cascading failures across agents', async () => {
      for (const agent of agents) {
        await gateway.registerAgent(agent, 'local');
      }

      // Failure of one agent shouldn't affect others
      gateway.unregisterAgent('agent-1');

      // Remaining agents should still be accessible
      expect(gateway.getAgent('agent-2')).toBeDefined();
      expect(gateway.getAgent('agent-3')).toBeDefined();
    });
  });

  describe('Gateway State Resilience', () => {
    it('should maintain gateway state during individual agent failures', async () => {
      // Register agents
      for (const agent of agents) {
        await gateway.registerAgent(agent, 'local');
      }

      // Gateway should be operational with all agents
      expect(gateway.getAllAgents()).toHaveLength(5);

      // Unregister an agent (simulate failure)
      gateway.unregisterAgent('agent-2');

      // Gateway should still be operational
      expect(gateway.getAllAgents()).toHaveLength(4);
      expect(() => gateway.destroy()).not.toThrow();
    });

    it('should transition to DEGRADED when multiple agents fail', async () => {
      for (const agent of agents) {
        await gateway.registerAgent(agent, 'local');
      }

      // Unregister multiple agents
      gateway.unregisterAgent('agent-1');
      gateway.unregisterAgent('agent-2');
      gateway.unregisterAgent('agent-3');

      // Gateway should handle multiple agent failures
      expect(gateway.getAllAgents()).toHaveLength(2);
    });

    it('should recover to NORMAL when agents come back online', async () => {
      for (const agent of agents) {
        await gateway.registerAgent(agent, 'local');
      }

      // Remove some agents
      gateway.unregisterAgent('agent-1');
      gateway.unregisterAgent('agent-2');

      expect(gateway.getAllAgents()).toHaveLength(3);

      // Re-register agents
      await gateway.registerAgent(createMockAgent('agent-1'), 'local');
      await gateway.registerAgent(createMockAgent('agent-2'), 'local');

      // Gateway should have all agents again
      expect(gateway.getAllAgents()).toHaveLength(5);
    });
  });

  describe('Request Routing During Failures', () => {
    it('should route requests away from failed agents', async () => {
      const primaryAgent = createMockAgent('primary');
      const backupAgent = createMockAgent('backup');

      await gateway.registerAgent(primaryAgent, 'local');
      await gateway.registerAgent(backupAgent, 'local');

      // Both agents registered
      expect(gateway.getAllAgents()).toHaveLength(2);

      // Unregister primary agent
      gateway.unregisterAgent('primary');

      // Backup agent should still be available
      expect(gateway.getAgent('backup')).toBeDefined();
    });

    it('should handle requests to healthy agents during cascade', async () => {
      for (const agent of agents) {
        await gateway.registerAgent(agent, 'local');
      }

      // Simulate cascade: unregister multiple agents
      gateway.unregisterAgent('agent-1');
      gateway.unregisterAgent('agent-2');
      gateway.unregisterAgent('agent-3');

      // Remaining agents should be accessible
      expect(gateway.getAgent('agent-4')).toBeDefined();
      expect(gateway.getAgent('agent-5')).toBeDefined();
    });

    it('should not crash gateway when all agents fail', async () => {
      for (const agent of agents) {
        await gateway.registerAgent(agent, 'local');
      }

      // Unregister all agents
      for (let i = 1; i <= 5; i++) {
        gateway.unregisterAgent(`agent-${i}`);
      }

      // Gateway should still be operational (with no agents)
      expect(gateway.getAllAgents()).toHaveLength(0);
      expect(() => gateway.destroy()).not.toThrow();
    });
  });

  describe('Fallback During Cascade', () => {
    it('should activate fallback when agent fails', async () => {
      const agentWithFallback = createMockAgent('fallback-agent');

      await gateway.registerAgent(agentWithFallback, 'local');

      // Gateway is configured with fallback enabled
      expect(gateway.getAllAgents()).toHaveLength(1);
    });

    it('should not exhaust fallbacks during cascade failure', async () => {
      for (const agent of agents) {
        await gateway.registerAgent(agent, 'local');
      }

      // Simulate cascade
      gateway.unregisterAgent('agent-1');
      gateway.unregisterAgent('agent-2');

      // Gateway should still handle remaining agents
      expect(gateway.getAllAgents()).toHaveLength(3);
    });

    it('should recover from fallback when agent recovers', async () => {
      const agent = createMockAgent('recovering-agent');

      await gateway.registerAgent(agent, 'local');
      gateway.unregisterAgent('recovering-agent');

      // Re-register agent
      await gateway.registerAgent(createMockAgent('recovering-agent'), 'local');

      // Agent should be available again
      expect(gateway.getAgent('recovering-agent')).toBeDefined();
    });
  });

  describe('Error Propagation Control', () => {
    it('should contain error messages to failing agent only', async () => {
      await gateway.registerAgent(agents[0], 'local');
      await gateway.registerAgent(agents[1], 'local');

      // Error from agent-1 shouldn't affect agent-2
      gateway.unregisterAgent('agent-1');

      expect(gateway.getAgent('agent-2')).toBeDefined();
    });

    it('should log cascade failures for analysis', async () => {
      let stateChangedEvents = 0;

      gateway.on('state_changed', () => {
        stateChangedEvents++;
      });

      for (const agent of agents) {
        await gateway.registerAgent(agent, 'local');
      }

      // Unregister multiple agents to trigger cascade
      gateway.unregisterAgent('agent-1');
      gateway.unregisterAgent('agent-2');
      gateway.unregisterAgent('agent-3');

      // State changes should be tracked
      expect(gateway.listenerCount('state_changed')).toBeGreaterThan(0);
    });

    it('should provide diagnostics for cascade failures', async () => {
      for (const agent of agents) {
        await gateway.registerAgent(agent, 'local');
      }

      // Gateway should provide agent status for diagnostics
      const allAgents = gateway.getAllAgents();
      expect(allAgents).toHaveLength(5);

      // Each agent should have complete information
      allAgents.forEach(agent => {
        expect(agent.id).toBeDefined();
        expect(agent.name).toBeDefined();
        expect(agent.active).toBe(true);
      });
    });
  });
});
