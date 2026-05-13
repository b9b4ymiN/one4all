import { describe, it, expect } from 'vitest';
import { AgentCardSchema, validateAgentCard, isExternalAgent, hasBehavioralProtocol, getTrustLevel, isOnProbation } from '../../../src/schemas/agent-card.schema.js';
import type { AgentCard } from '../../../src/schemas/agent-card.schema.js';

describe('AgentCard Schema', () => {
  describe('validation', () => {
    it('should validate a complete internal agent card', () => {
      const validCard = {
        id: 'test-agent',
        name: 'Test Agent',
        version: '1.0.0',
        domain: 'test-domain',
        active: true,
        role: 'analyst' as const,
        description: 'A test agent for validation',
        tags: ['test', 'validation'],
        capabilities: {
          input_types: ['analysis-request'],
          output_types: ['analysis-result'],
          skills: [],
          tools_required: [],
          tools_provided: [],
        },
        model: {
          provider: 'claude',
          model: 'claude-opus-4',
          fallback_providers: [],
        },
        output_contract: {
          mandatory_fields: ['result', 'confidence'],
          forbidden_content: [],
          validation_rules: [],
        },
        performance: {
          timeout_seconds: 120,
          max_tokens: 8192,
          max_retries: 3,
        },
        observability: {
          log_level: 'info' as const,
          metrics_enabled: true,
          tracing_enabled: true,
        },
        security: {
          permissions: [],
          sandbox_level: 'basic' as const,
          allowed_domains: [],
        },
      };

      const result = AgentCardSchema.safeParse(validCard);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe('test-agent');
      }
    });

    it('should validate a complete external agent card with behavioral protocol', () => {
      const validExternalCard = {
        id: 'external-analyst',
        name: 'External Analyst',
        version: '1.0.0',
        domain: 'investment',
        active: true,
        role: 'analyst' as const,
        description: 'External analyst agent with behavioral protocol support',
        capabilities: {
          input_types: ['stock-analysis'],
          output_types: ['valuation'],
          skills: [],
        },
        output_contract: {
          mandatory_fields: ['fair_value', 'mos'],
        },
        a2a_config: {
          endpoint: 'https://api.example.com/agent',
          protocol: 'http' as const,
          authentication: {
            type: 'api_key' as const,
            credentials_ref: 'secret:external-analyst-key',
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
          permissions: ['network'],
          sandbox_level: 'strict' as const,
          allowed_domains: ['api.example.com'],
        },
        trust: {
          trust_level: 'trusted' as const,
          verification_status: 'verified' as const,
          verification_method: 'external_audit' as const,
          behavioral_score: 85,
          last_verified_at: '2026-05-13T00:00:00Z',
        },
      };

      const result = AgentCardSchema.safeParse(validExternalCard);
      expect(result.success).toBe(true);
    });

    it('should reject invalid agent ID', () => {
      const invalidCard = {
        id: 'Invalid_ID_With_Uppercase',
        name: 'Invalid Agent',
        version: '1.0.0',
        domain: 'test',
        active: true,
        role: 'analyst' as const,
        description: 'This should fail',
        capabilities: {
          input_types: [],
          output_types: [],
        },
        output_contract: {
          mandatory_fields: [],
        },
      };

      const result = AgentCardSchema.safeParse(invalidCard);
      expect(result.success).toBe(false);
    });

    it('should reject invalid version format', () => {
      const invalidCard = {
        id: 'test-agent',
        name: 'Test Agent',
        version: '1.0', // Missing patch version
        domain: 'test',
        active: true,
        role: 'analyst' as const,
        description: 'Test',
        capabilities: { input_types: [], output_types: [] },
        output_contract: { mandatory_fields: [] },
      };

      const result = AgentCardSchema.safeParse(invalidCard);
      expect(result.success).toBe(false);
    });

    it('should reject invalid endpoint URL', () => {
      const invalidCard = {
        id: 'test-agent',
        name: 'Test Agent',
        version: '1.0.0',
        domain: 'test',
        active: true,
        role: 'analyst' as const,
        description: 'Test',
        capabilities: { input_types: [], output_types: [] },
        output_contract: { mandatory_fields: [] },
        a2a_config: {
          endpoint: 'not-a-valid-url',
        },
      };

      const result = AgentCardSchema.safeParse(invalidCard);
      expect(result.success).toBe(false);
    });
  });

  describe('validateAgentCard helper', () => {
    it('should return valid result for valid card', () => {
      const validCard = {
        id: 'test-agent',
        name: 'Test Agent',
        version: '1.0.0',
        domain: 'test',
        active: true,
        role: 'analyst' as const,
        description: 'Test agent',
        capabilities: { input_types: [], output_types: [] },
        output_contract: { mandatory_fields: [] },
      };

      const result = validateAgentCard(validCard);
      expect(result.valid).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.id).toBe('test-agent');
    });

    it('should return invalid result with errors for invalid card', () => {
      const invalidCard = {
        id: 'INVALID_ID',
        name: 'T', // Too short
        version: '1.0.0',
        domain: 'test',
        active: true,
        role: 'analyst' as const,
        description: 'Test',
        capabilities: { input_types: [], output_types: [] },
        output_contract: { mandatory_fields: [] },
      };

      const result = validateAgentCard(invalidCard);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });
  });

  describe('isExternalAgent', () => {
    it('should return true for external agent with endpoint', () => {
      const card: AgentCard = {
        id: 'external-agent',
        name: 'External',
        version: '1.0.0',
        domain: 'test',
        active: true,
        role: 'analyst',
        description: 'Test',
        tags: [],
        capabilities: { input_types: [], output_types: [], skills: [], tools_required: [], tools_provided: [] },
        output_contract: { mandatory_fields: [], forbidden_content: [], validation_rules: [] },
        a2a_config: {
          endpoint: 'https://example.com/agent',
        },
      };

      expect(isExternalAgent(card)).toBe(true);
    });

    it('should return false for internal agent without endpoint', () => {
      const card: AgentCard = {
        id: 'internal-agent',
        name: 'Internal',
        version: '1.0.0',
        domain: 'test',
        active: true,
        role: 'analyst',
        description: 'Test',
        tags: [],
        capabilities: { input_types: [], output_types: [], skills: [], tools_required: [], tools_provided: [] },
        output_contract: { mandatory_fields: [], forbidden_content: [], validation_rules: [] },
      };

      expect(isExternalAgent(card)).toBe(false);
    });
  });

  describe('hasBehavioralProtocol', () => {
    it('should return true when behavioral_protocol is present', () => {
      const card: AgentCard = {
        id: 'behavioral-agent',
        name: 'Behavioral',
        version: '1.0.0',
        domain: 'test',
        active: true,
        role: 'analyst',
        description: 'Test',
        tags: [],
        capabilities: { input_types: [], output_types: [], skills: [], tools_required: [], tools_provided: [] },
        output_contract: { mandatory_fields: [], forbidden_content: [], validation_rules: [] },
        a2a_config: {
          behavioral_protocol: {
            implements_challenge_response: true,
            implements_evidence_submission: false,
            implements_debate_protocol: false,
            supported_interaction_modes: ['request_response'],
          },
        },
      };

      expect(hasBehavioralProtocol(card)).toBe(true);
    });

    it('should return false when behavioral_protocol is absent', () => {
      const card: AgentCard = {
        id: 'simple-agent',
        name: 'Simple',
        version: '1.0.0',
        domain: 'test',
        active: true,
        role: 'analyst',
        description: 'Test',
        tags: [],
        capabilities: { input_types: [], output_types: [], skills: [], tools_required: [], tools_provided: [] },
        output_contract: { mandatory_fields: [], forbidden_content: [], validation_rules: [] },
      };

      expect(hasBehavioralProtocol(card)).toBe(false);
    });
  });

  describe('getTrustLevel', () => {
    it('should return trust_level from card', () => {
      const card: AgentCard = {
        id: 'trusted-agent',
        name: 'Trusted',
        version: '1.0.0',
        domain: 'test',
        active: true,
        role: 'analyst',
        description: 'Test',
        tags: [],
        capabilities: { input_types: [], output_types: [], skills: [], tools_required: [], tools_provided: [] },
        output_contract: { mandatory_fields: [], forbidden_content: [], validation_rules: [] },
        trust: {
          trust_level: 'trusted',
          verification_status: 'verified',
        },
      };

      expect(getTrustLevel(card)).toBe('trusted');
    });

    it('should return unverified when trust is not set', () => {
      const card: AgentCard = {
        id: 'unverified-agent',
        name: 'Unverified',
        version: '1.0.0',
        domain: 'test',
        active: true,
        role: 'analyst',
        description: 'Test',
        tags: [],
        capabilities: { input_types: [], output_types: [], skills: [], tools_required: [], tools_provided: [] },
        output_contract: { mandatory_fields: [], forbidden_content: [], validation_rules: [] },
      };

      expect(getTrustLevel(card)).toBe('unverified');
    });
  });

  describe('isOnProbation', () => {
    it('should return true when trust_level is probationary', () => {
      const card: AgentCard = {
        id: 'probationary-agent',
        name: 'Probationary',
        version: '1.0.0',
        domain: 'test',
        active: true,
        role: 'analyst',
        description: 'Test',
        tags: [],
        capabilities: { input_types: [], output_types: [], skills: [], tools_required: [], tools_provided: [] },
        output_contract: { mandatory_fields: [], forbidden_content: [], validation_rules: [] },
        trust: {
          trust_level: 'probationary',
          verification_status: 'in_progress',
        },
      };

      expect(isOnProbation(card)).toBe(true);
    });

    it('should return false when trust_level is trusted', () => {
      const card: AgentCard = {
        id: 'trusted-agent',
        name: 'Trusted',
        version: '1.0.0',
        domain: 'test',
        active: true,
        role: 'analyst',
        description: 'Test',
        tags: [],
        capabilities: { input_types: [], output_types: [], skills: [], tools_required: [], tools_provided: [] },
        output_contract: { mandatory_fields: [], forbidden_content: [], validation_rules: [] },
        trust: {
          trust_level: 'trusted',
          verification_status: 'verified',
        },
      };

      expect(isOnProbation(card)).toBe(false);
    });

    it('should return false when probation has expired', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      const card: AgentCard = {
        id: 'expired-probation-agent',
        name: 'Expired Probation',
        version: '1.0.0',
        domain: 'test',
        active: true,
        role: 'analyst',
        description: 'Test',
        tags: [],
        capabilities: { input_types: [], output_types: [], skills: [], tools_required: [], tools_provided: [] },
        output_contract: { mandatory_fields: [], forbidden_content: [], validation_rules: [] },
        trust: {
          trust_level: 'probationary',
          verification_status: 'in_progress',
          probation_expires_at: pastDate.toISOString(),
        },
      };

      expect(isOnProbation(card)).toBe(false);
    });
  });
});
