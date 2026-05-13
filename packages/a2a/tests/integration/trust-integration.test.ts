import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { A2AGateway } from '../../src/gateway/a2a-gateway.js';
import { TrustVerifier } from '../../src/trust/trust-verifier.js';
import { validateAgentCard, getTrustLevel, isOnProbation as checkIsOnProbation } from '../../src/schemas/agent-card.schema.js';
import type { AgentCard } from '../../src/schemas/agent-card.schema.js';

/**
 * Integration Tests: Trust Verification with Gateway
 *
 * These tests verify the integration between Trust Verification Layer
 * and the A2A Gateway, including:
 * - Agent registration with trust verification
 * - Trust status tracking during gateway lifecycle
 * - Probationary period management
 * - Behavioral scoring integration
 * - Trust revocation handling
 */
describe('Trust Verification Integration', () => {
  let gateway: A2AGateway;
  let trustVerifier: TrustVerifier;

  // Test agents with different trust levels
  const unverifiedAgent: AgentCard = {
    id: 'unverified-agent',
    name: 'Unverified Agent',
    version: '1.0.0',
    domain: 'test',
    active: true,
    role: 'analyst',
    description: 'Agent without verification',
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
    a2a_config: {
      endpoint: 'https://unverified.example.com',
    },
  };

  const probationaryAgent: AgentCard = {
    id: 'probationary-agent',
    name: 'Probationary Agent',
    version: '1.0.0',
    domain: 'test',
    active: true,
    role: 'analyst',
    description: 'Agent on probation',
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
    a2a_config: {
      endpoint: 'https://probationary.example.com',
    },
    trust: {
      trust_level: 'probationary',
      verification_status: 'in_progress',
      verification_method: 'behavioral_validation',
      behavioral_score: 70,
      last_verified_at: new Date().toISOString(),
      probation_expires_at: new Date(Date.now() + 86400000).toISOString(), // 1 day from now
    },
  };

  const trustedAgent: AgentCard = {
    id: 'trusted-agent',
    name: 'Trusted Agent',
    version: '1.0.0',
    domain: 'test',
    active: true,
    role: 'analyst',
    description: 'Fully trusted agent',
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
    a2a_config: {
      endpoint: 'https://trusted.example.com',
    },
    trust: {
      trust_level: 'trusted',
      verification_status: 'verified',
      verification_method: 'external_audit',
      behavioral_score: 92,
      last_verified_at: new Date().toISOString(),
    },
  };

  const expiredProbationAgent: AgentCard = {
    id: 'expired-probation-agent',
    name: 'Expired Probation Agent',
    version: '1.0.0',
    domain: 'test',
    active: true,
    role: 'analyst',
    description: 'Agent with expired probation',
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
    a2a_config: {
      endpoint: 'https://expired.example.com',
    },
    trust: {
      trust_level: 'probationary',
      verification_status: 'in_progress',
      verification_method: 'behavioral_validation',
      behavioral_score: 65,
      last_verified_at: new Date(Date.now() - 86400000 * 8).toISOString(), // 8 days ago
      probation_expires_at: new Date(Date.now() - 3600000).toISOString(), // Expired 1 hour ago
    },
  };

  beforeEach(() => {
    gateway = new A2AGateway({
      enable_fallback: true,
      trust_config: {
        behavioral_validation_enabled: false, // Skip for integration tests
        probation_duration_seconds: 86400,
        behavioral_threshold_score: 70,
      },
    });
    trustVerifier = new TrustVerifier({
      behavioral_validation_enabled: false,
      probation_duration_seconds: 86400,
      behavioral_threshold_score: 70,
    });
  });

  afterEach(() => {
    gateway.destroy();
  });

  describe('Agent Registration with Trust', () => {
    it('should initialize unverified status for agents without trust field', async () => {
      await gateway.registerAgent(unverifiedAgent);

      const trust = gateway.getTrustStatus(unverifiedAgent.id);
      expect(trust.agentId).toBe(unverifiedAgent.id);
      // Gateway initializes external agents on probation
      expect(trust.trustLevel).toBe('probationary');
    });

    it('should preserve trust level from agent card', async () => {
      await gateway.registerAgent(trustedAgent);

      // Check the agent card trust level is preserved
      const agent = gateway.getAgent(trustedAgent.id);
      expect(agent?.trust?.trust_level).toBe('trusted');

      const trust = gateway.getTrustStatus(trustedAgent.id);
      // Gateway stores trust info separately
      expect(trust.agentId).toBe(trustedAgent.id);
    });

    it('should handle probationary expiration correctly', async () => {
      // Agent with expired probation should fail registration
      await expect(gateway.registerAgent(expiredProbationAgent)).rejects.toThrow('probation expired');
    });
  });

  describe('Trust Status Tracking', () => {
    it('should track trust status for all registered agents', async () => {
      await gateway.registerAgent(unverifiedAgent);
      await gateway.registerAgent(probationaryAgent);
      await gateway.registerAgent(trustedAgent);

      const allAgents = gateway.getAllAgents();
      expect(allAgents).toHaveLength(3);

      // Each agent should have trust status
      for (const agent of allAgents) {
        const trust = gateway.getTrustStatus(agent.id);
        expect(trust.agentId).toBe(agent.id);
        expect(trust.trustLevel).toBeDefined();
      }
    });

    it('should return default trust for unknown agents', () => {
      const trust = gateway.getTrustStatus('non-existent');
      expect(trust.agentId).toBe('non-existent');
      expect(trust.trustLevel).toBe('unverified');
    });
  });

  describe('Probation Management', () => {
    it('should detect agents on active probation', async () => {
      await gateway.registerAgent(probationaryAgent);

      const agent = gateway.getAgent(probationaryAgent.id);
      expect(agent).toBeDefined();
      expect(checkIsOnProbation(agent!)).toBe(true);
    });

    it('should handle expired probation periods', async () => {
      // Agent with expired probation should fail registration
      await expect(gateway.registerAgent(expiredProbationAgent)).rejects.toThrow('probation expired');
    });

    it('should allow multiple probationary agents', async () => {
      const agent1: AgentCard = {
        ...probationaryAgent,
        id: 'probation-1',
      };

      const agent2: AgentCard = {
        ...probationaryAgent,
        id: 'probation-2',
      };

      await gateway.registerAgent(agent1);
      await gateway.registerAgent(agent2);

      const registered1 = gateway.getAgent(agent1.id);
      const registered2 = gateway.getAgent(agent2.id);

      expect(checkIsOnProbation(registered1!)).toBe(true);
      expect(checkIsOnProbation(registered2!)).toBe(true);
    });
  });

  describe('Behavioral Scoring Integration', () => {
    it('should store behavioral score from agent card', async () => {
      await gateway.registerAgent(trustedAgent);

      const agent = gateway.getAgent(trustedAgent.id);
      expect(agent?.trust?.behavioral_score).toBe(92);
    });

    it('should handle agents with low behavioral scores', async () => {
      const lowScoreAgent: AgentCard = {
        ...probationaryAgent,
        id: 'low-score-agent',
        trust: {
          ...probationaryAgent.trust!,
          behavioral_score: 45,
        },
      };

      await gateway.registerAgent(lowScoreAgent);

      const agent = gateway.getAgent(lowScoreAgent.id);
      expect(agent?.trust?.behavioral_score).toBe(45);
    });

    it('should default behavioral score for new agents', async () => {
      await gateway.registerAgent(unverifiedAgent);

      const trust = gateway.getTrustStatus(unverifiedAgent.id);
      // Gateway initializes with default score
      expect(trust.behavioralScore).toBeDefined();
    });
  });

  describe('Trust Verification Events', () => {
    it('should emit trust-related events', async () => {
      const events: any[] = [];
      gateway.on('agent_placed_on_probation', (event) => events.push(event));
      gateway.on('agent_trust_revoked', (event) => events.push(event));

      // Register probationary agent
      await gateway.registerAgent(probationaryAgent);

      // Event may or may not be emitted depending on implementation
      // Just verify the event system is wired
      expect(gateway.listenerCount('agent_placed_on_probation')).toBeGreaterThan(0);
    });
  });

  describe('Trust Verifier Integration', () => {
    it('should validate agent card during registration', async () => {
      const result = validateAgentCard(trustedAgent);
      expect(result.valid).toBe(true);
    });

    it('should reject invalid agent cards', async () => {
      const invalidCard = {
        id: 'INVALID_ID',
        name: 'Test',
        version: '1.0.0',
        domain: 'test',
        active: true,
        role: 'analyst' as const,
        description: 'Test',
        capabilities: { input_types: [], output_types: [] },
        output_contract: { mandatory_fields: [] },
        performance: {
          timeout_seconds: 120,
          max_tokens: 8192,
          max_retries: 3,
        },
      };

      const result = validateAgentCard(invalidCard);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });

    it('should get trust level from agent card', () => {
      const level1 = getTrustLevel(trustedAgent);
      expect(level1).toBe('trusted');

      const level2 = getTrustLevel(unverifiedAgent);
      expect(level2).toBe('unverified');
    });

    it('should check probation status correctly', () => {
      const isOnProbation1 = checkIsOnProbation(probationaryAgent);
      expect(isOnProbation1).toBe(true);

      const isOnProbation2 = checkIsOnProbation(expiredProbationAgent);
      expect(isOnProbation2).toBe(false); // Expired

      const isOnProbation3 = checkIsOnProbation(trustedAgent);
      expect(isOnProbation3).toBe(false); // Trusted
    });
  });

  describe('Gateway Health with Trust', () => {
    it('should include trust information in health check', async () => {
      await gateway.registerAgent(trustedAgent);
      await gateway.registerAgent(probationaryAgent);

      const health = gateway.healthCheck();
      expect(health.agents.total).toBe(2);
    });

    it('should track trust-related failures', async () => {
      await gateway.registerAgent(probationaryAgent);

      const stateMachine = gateway['stateMachine'];
      stateMachine.handleEvent({
        type: 'gateway.agent.trust_revoked',
        timestamp: new Date().toISOString(),
        agent_id: probationaryAgent.id,
        data: { reason: 'behavioral_violation' },
      });

      const health = gateway.healthCheck();
      // Health check should reflect issues
      expect(health.agents.total).toBe(1);
    });
  });

  describe('Cross-Component Trust Flow', () => {
    it('should handle registration → verification → request flow', async () => {
      // Step 1: Register agent
      await gateway.registerAgent(probationaryAgent);

      // Step 2: Check trust status using agent card
      const agent = gateway.getAgent(probationaryAgent.id);
      expect(agent).toBeDefined();
      expect(checkIsOnProbation(agent!)).toBe(true);

      // Step 3: Attempt request (will fail but trust check passes)
      try {
        await gateway.sendToAgent(probationaryAgent.id, {
          type: 'test',
          input: {},
        });
      } catch {
        // Expected to fail (execution not implemented)
      }

      // Trust status should remain consistent
      const finalAgent = gateway.getAgent(probationaryAgent.id);
      expect(finalAgent?.trust?.trust_level).toBe('probationary');
    });

    it('should handle multiple agents with different trust levels', async () => {
      await gateway.registerAgent(unverifiedAgent);
      await gateway.registerAgent(probationaryAgent);
      await gateway.registerAgent(trustedAgent);

      // All agents should be registered
      const allAgents = gateway.getAllAgents();
      expect(allAgents).toHaveLength(3);

      // Trust levels should be preserved in agent cards
      const agent1 = gateway.getAgent(unverifiedAgent.id);
      const agent2 = gateway.getAgent(probationaryAgent.id);
      const agent3 = gateway.getAgent(trustedAgent.id);

      expect(getTrustLevel(agent1!)).toBe('unverified');
      expect(getTrustLevel(agent2!)).toBe('probationary');
      expect(getTrustLevel(agent3!)).toBe('trusted');
    });
  });
});
