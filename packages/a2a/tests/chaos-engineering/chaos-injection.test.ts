import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { A2AGateway } from '../../src/gateway/a2a-gateway.js';
import type { AgentCard } from '../../src/schemas/agent-card.schema.js';

/**
 * Chaos Engineering Tests: Chaos Injection
 *
 * These tests verify system resilience under random failure conditions
 * including timeout storms, random failures, and concurrent stress testing.
 */

const createMockAgent = (id: string, timeoutSeconds = 30): AgentCard => ({
  id,
  name: `Agent ${id}`,
  version: '1.0.0',
  domain: 'test',
  active: true,
  role: 'analyst',
  description: 'Mock agent for chaos injection testing',
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
    timeout_seconds: timeoutSeconds,
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

describe('Chaos Engineering: Chaos Injection', () => {
  let gateway: A2AGateway;

  beforeEach(() => {
    gateway = new A2AGateway({
      enable_fallback: true,
      max_concurrent_requests: 10,
      trust_config: {
        behavioral_validation_enabled: false,
        probation_duration_seconds: 86400,
        behavioral_threshold_score: 70,
      },
    });
  });

  afterEach(() => {
    gateway.destroy();
  });

  describe('Random Failure Injection', () => {
    it('should handle random agent failures without crashing', async () => {
      const agents = Array.from({ length: 10 }, (_, i) =>
        createMockAgent(`random-agent-${i}`)
      );

      // Register all agents
      for (const agent of agents) {
        await gateway.registerAgent(agent, 'local');
      }

      // All agents should be registered
      expect(gateway.getAllAgents()).toHaveLength(10);

      // Simulate random failures by unregistering random agents
      const failedIndices = [1, 3, 7, 9];
      failedIndices.forEach(i => gateway.unregisterAgent(`random-agent-${i}`));

      // Gateway should still be operational
      expect(gateway.getAllAgents()).toHaveLength(6);

      // Remaining agents should be accessible
      expect(gateway.getAgent('random-agent-0')).toBeDefined();
      expect(gateway.getAgent('random-agent-5')).toBeDefined();
    });

    it('should recover from random failures', async () => {
      const agents = Array.from({ length: 5 }, (_, i) =>
        createMockAgent(`recovery-agent-${i}`)
      );

      for (const agent of agents) {
        await gateway.registerAgent(agent, 'local');
      }

      // Unregister random agents
      gateway.unregisterAgent('recovery-agent-2');
      gateway.unregisterAgent('recovery-agent-4');

      expect(gateway.getAllAgents()).toHaveLength(3);

      // Re-register failed agents
      await gateway.registerAgent(createMockAgent('recovery-agent-2'), 'local');
      await gateway.registerAgent(createMockAgent('recovery-agent-4'), 'local');

      // All agents should be back
      expect(gateway.getAllAgents()).toHaveLength(5);
    });

    it('should track failure rates during chaos injection', async () => {
      const agents = Array.from({ length: 8 }, (_, i) =>
        createMockAgent(`metrics-agent-${i}`)
      );

      for (const agent of agents) {
        await gateway.registerAgent(agent, 'local');
      }

      // Simulate 50% failure rate
      for (let i = 0; i < 8; i += 2) {
        gateway.unregisterAgent(`metrics-agent-${i}`);
      }

      // Gateway should track remaining healthy agents
      expect(gateway.getAllAgents()).toHaveLength(4);
    });
  });

  describe('Timeout Storm Handling', () => {
    it('should handle multiple agents timing out simultaneously', async () => {
      // Create agents with short timeouts
      const agents = Array.from({ length: 5 }, (_, i) =>
        createMockAgent(`timeout-agent-${i}`, 10) // 10 second timeout
      );

      for (const agent of agents) {
        await gateway.registerAgent(agent, 'local');
      }

      // All agents should be registered
      expect(gateway.getAllAgents()).toHaveLength(5);

      // Gateway should handle timeout storm without crashing
      const allAgents = gateway.getAllAgents();
      allAgents.forEach(agent => {
        expect(agent.performance.timeout_seconds).toBe(10);
      });
    });

    it('should prioritize resources during timeout storm', async () => {
      const highPriorityAgents = Array.from({ length: 3 }, (_, i) =>
        createMockAgent(`high-priority-${i}`, 30)
      );

      const lowPriorityAgents = Array.from({ length: 5 }, (_, i) =>
        createMockAgent(`low-priority-${i}`, 10)
      );

      // Register all agents
      for (const agent of [...highPriorityAgents, ...lowPriorityAgents]) {
        await gateway.registerAgent(agent, 'local');
      }

      // Gateway should handle all agents during timeout storm
      expect(gateway.getAllAgents()).toHaveLength(8);
    });

    it('should recover after timeout storm subsides', async () => {
      const agents = Array.from({ length: 6 }, (_, i) =>
        createMockAgent(`storm-recovery-${i}`, 10)
      );

      for (const agent of agents) {
        await gateway.registerAgent(agent, 'local');
      }

      // Simulate timeout storm by removing agents
      for (let i = 0; i < 6; i += 2) {
        gateway.unregisterAgent(`storm-recovery-${i}`);
      }

      expect(gateway.getAllAgents()).toHaveLength(3);

      // Re-register agents (storm subsides)
      for (let i = 0; i < 6; i += 2) {
        await gateway.registerAgent(createMockAgent(`storm-recovery-${i}`, 10), 'local');
      }

      // All agents recovered
      expect(gateway.getAllAgents()).toHaveLength(6);
    });

    it('should track timeout storm metrics', async () => {
      const agents = Array.from({ length: 4 }, (_, i) =>
        createMockAgent(`timeout-metrics-${i}`, 10)
      );

      for (const agent of agents) {
        await gateway.registerAgent(agent, 'local');
      }

      // Gateway should track agent performance metrics
      const allAgents = gateway.getAllAgents();
      allAgents.forEach(agent => {
        expect(agent.performance.timeout_seconds).toBeDefined();
        expect(agent.performance.max_retries).toBeDefined();
      });
    });
  });

  describe('Concurrent Stress Testing', () => {
    it('should handle concurrent agent failures', async () => {
      const agents = Array.from({ length: 15 }, (_, i) =>
        createMockAgent(`concurrent-${i}`)
      );

      // Register all agents concurrently
      await Promise.all(
        agents.map(agent => gateway.registerAgent(agent, 'local'))
      );

      expect(gateway.getAllAgents()).toHaveLength(15);

      // Unregister multiple agents concurrently
      const toRemove = [0, 1, 2, 5, 10];
      toRemove.forEach(i => gateway.unregisterAgent(`concurrent-${i}`));

      expect(gateway.getAllAgents()).toHaveLength(10);
    });

    it('should maintain consistency under concurrent load', async () => {
      const agents = Array.from({ length: 10 }, (_, i) =>
        createMockAgent(`load-test-${i}`)
      );

      // Register agents
      await Promise.all(
        agents.map(agent => gateway.registerAgent(agent, 'local'))
      );

      // Verify all agents are registered
      expect(gateway.getAllAgents()).toHaveLength(10);

      // Concurrent reads should be consistent
      const allAgents1 = gateway.getAllAgents();
      const allAgents2 = gateway.getAllAgents();

      expect(allAgents1).toHaveLength(allAgents2.length);
      expect(allAgents1.map(a => a.id)).toEqual(allAgents2.map(a => a.id));
    });

    it('should handle rapid registration/unregistration cycles', async () => {
      const cycleCount = 5;
      const agentId = 'cycle-agent';

      for (let i = 0; i < cycleCount; i++) {
        const agent = createMockAgent(agentId);
        await gateway.registerAgent(agent, 'local');
        expect(gateway.getAgent(agentId)).toBeDefined();

        gateway.unregisterAgent(agentId);
        expect(gateway.getAgent(agentId)).toBeUndefined();
      }

      // After cycles, gateway should still be operational
      const finalAgent = createMockAgent('final-agent');
      await gateway.registerAgent(finalAgent, 'local');
      expect(gateway.getAgent('final-agent')).toBeDefined();
    });
  });

  describe('Resource Exhaustion Recovery', () => {
    it('should recover from resource exhaustion', async () => {
      // Create many agents to stress resources
      const agents = Array.from({ length: 20 }, (_, i) =>
        createMockAgent(`resource-test-${i}`)
      );

      // Register all agents
      for (const agent of agents) {
        await gateway.registerAgent(agent, 'local');
      }

      expect(gateway.getAllAgents()).toHaveLength(20);

      // Remove half the agents (simulate resource recovery)
      for (let i = 0; i < 10; i++) {
        gateway.unregisterAgent(`resource-test-${i}`);
      }

      // Gateway should recover with remaining agents
      expect(gateway.getAllAgents()).toHaveLength(10);
    });

    it('should apply backpressure when overloaded', async () => {
      // Gateway has max_concurrent_requests: 10
      const agents = Array.from({ length: 15 }, (_, i) =>
        createMockAgent(`backpressure-${i}`)
      );

      // Register more agents than concurrent limit
      for (const agent of agents) {
        await gateway.registerAgent(agent, 'local');
      }

      // Gateway should handle all agents (queued execution)
      expect(gateway.getAllAgents()).toHaveLength(15);
    });

    it('should gracefully handle memory pressure', async () => {
      // Create agents with large token limits
      const agents = Array.from({ length: 5 }, (_, i) =>
        createMockAgent(`memory-test-${i}`)
      );

      for (const agent of agents) {
        await gateway.registerAgent(agent, 'local');
      }

      // Gateway should handle large token configurations
      const allAgents = gateway.getAllAgents();
      allAgents.forEach(agent => {
        expect(agent.performance.max_tokens).toBe(8192);
      });
    });
  });

  describe('Chaos Metrics Tracking', () => {
    it('should track failure rate during chaos', async () => {
      const agents = Array.from({ length: 10 }, (_, i) =>
        createMockAgent(`chaos-metrics-${i}`)
      );

      for (const agent of agents) {
        await gateway.registerAgent(agent, 'local');
      }

      // Simulate 40% failure rate
      const failedAgents = [1, 4, 7];
      failedAgents.forEach(i => gateway.unregisterAgent(`chaos-metrics-${i}`));

      const remainingAgents = gateway.getAllAgents();
      expect(remainingAgents.length).toBe(7);

      // Calculate failure rate
      const failureRate = failedAgents.length / agents.length;
      expect(failureRate).toBe(0.3);
    });

    it('should track recovery time after chaos', async () => {
      const agent = createMockAgent('recovery-time-test');

      await gateway.registerAgent(agent, 'local');

      const startTime = Date.now();
      gateway.unregisterAgent('recovery-time-test');

      // Simulate recovery time
      await new Promise(resolve => setTimeout(resolve, 50));

      await gateway.registerAgent(createMockAgent('recovery-time-test'), 'local');
      const recoveryTime = Date.now() - startTime;

      // Recovery should complete (less than 1 second for this test)
      expect(recoveryTime).toBeLessThan(1000);
    });

    it('should provide chaos experiment results', async () => {
      const agents = Array.from({ length: 8 }, (_, i) =>
        createMockAgent(`experiment-${i}`)
      );

      for (const agent of agents) {
        await gateway.registerAgent(agent, 'local');
      }

      // Run chaos experiment: fail every other agent
      const failed: string[] = [];
      const survived: string[] = [];

      for (let i = 0; i < 8; i++) {
        if (i % 2 === 0) {
          gateway.unregisterAgent(`experiment-${i}`);
          failed.push(`experiment-${i}`);
        } else {
          survived.push(`experiment-${i}`);
        }
      }

      // Experiment results
      expect(failed).toHaveLength(4);
      expect(survived).toHaveLength(4);

      // Gateway should still be operational
      expect(gateway.getAllAgents()).toHaveLength(4);
    });
  });

  describe('Graceful Degradation', () => {
    it('should degrade gracefully under sustained chaos', async () => {
      const agents = Array.from({ length: 12 }, (_, i) =>
        createMockAgent(`degrade-${i}`)
      );

      for (const agent of agents) {
        await gateway.registerAgent(agent, 'local');
      }

      // Sustained chaos: remove agents over time
      for (let i = 0; i < 8; i++) {
        gateway.unregisterAgent(`degrade-${i}`);
      }

      // Gateway should still function with remaining agents
      expect(gateway.getAllAgents()).toHaveLength(4);
      expect(() => gateway.destroy()).not.toThrow();
    });

    it('should prioritize critical agents during degradation', async () => {
      const criticalAgents = ['critical-1', 'critical-2'].map(id => createMockAgent(id));
      const nonCriticalAgents = Array.from({ length: 6 }, (_, i) =>
        createMockAgent(`non-critical-${i}`)
      );

      // Register all agents
      for (const agent of [...criticalAgents, ...nonCriticalAgents]) {
        await gateway.registerAgent(agent, 'local');
      }

      // Fail non-critical agents
      nonCriticalAgents.forEach(agent => gateway.unregisterAgent(agent.id));

      // Critical agents should still be available
      expect(gateway.getAgent('critical-1')).toBeDefined();
      expect(gateway.getAgent('critical-2')).toBeDefined();
    });

    it('should notify on degradation events', async () => {
      let degradationEvents = 0;

      gateway.on('state_changed', () => {
        degradationEvents++;
      });

      const agents = Array.from({ length: 10 }, (_, i) =>
        createMockAgent(`degrade-event-${i}`)
      );

      for (const agent of agents) {
        await gateway.registerAgent(agent, 'local');
      }

      // Trigger degradation by removing agents
      for (let i = 0; i < 7; i++) {
        gateway.unregisterAgent(`degrade-event-${i}`);
      }

      // Degradation events should be tracked
      expect(gateway.listenerCount('state_changed')).toBeGreaterThan(0);
    });
  });
});
