import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TrustVerifier } from '../../../src/trust/trust-verifier.js';
import type { AgentCard } from '../../../src/schemas/agent-card.schema.js';
import type { TrustVerificationConfig, ValidationResult, TrustVerificationResult } from '../../../src/trust/trust-verifier.js';

describe('TrustVerifier', () => {
  let verifier: TrustVerifier;
  let mockAgentCard: AgentCard;

  beforeEach(() => {
    const config: Partial<TrustVerificationConfig> = {
      enable_behavioral_validation: true,
      probation_period_days: 7,
      behavioral_threshold_score: 70,
      max_violations_before_revocation: 3,
    };

    verifier = new TrustVerifier(config);

    mockAgentCard = {
      id: 'test-analyst',
      name: 'Test Analyst',
      version: '1.0.0',
      domain: 'investment',
      active: true,
      role: 'analyst',
      description: 'A test analyst agent',
      capabilities: {
        input_types: ['analysis-request'],
        output_types: ['analysis-result'],
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
    };
  });

  describe('verifyAgentTrust', () => {
    it('should allow unverified agent with self-attested trust', async () => {
      const result = await verifier.verifyAgentTrust(mockAgentCard);

      expect(result.allowed).toBe(true);
      expect(result.trustLevel).toBe('unverified');
      expect(result.requiresProbation).toBe(true);
    });

    it('should allow probationary agent passing initial tests', async () => {
      mockAgentCard.trust = {
        trust_level: 'probationary',
        verification_status: 'in_progress',
        verification_method: 'behavioral_validation',
        behavioral_score: 75,
        last_verified_at: new Date().toISOString(),
      };

      const result = await verifier.verifyAgentTrust(mockAgentCard);

      expect(result.allowed).toBe(true);
      expect(result.trustLevel).toBe('probationary');
    });

    it('should allow trusted agent with proven history', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 10);

      mockAgentCard.trust = {
        trust_level: 'trusted',
        verification_status: 'verified',
        verification_method: 'behavioral_validation',
        behavioral_score: 85,
        last_verified_at: pastDate.toISOString(),
      };

      const result = await verifier.verifyAgentTrust(mockAgentCard);

      expect(result.allowed).toBe(true);
      expect(result.trustLevel).toBe('trusted');
      expect(result.requiresProbation).toBe(false);
    });

    it('should allow certified agent with external audit', async () => {
      mockAgentCard.trust = {
        trust_level: 'certified',
        verification_status: 'verified',
        verification_method: 'certified_authority',
        audit_report_url: 'https://example.com/audit.pdf',
        behavioral_score: 95,
        last_verified_at: new Date().toISOString(),
      };

      const result = await verifier.verifyAgentTrust(mockAgentCard);

      expect(result.allowed).toBe(true);
      expect(result.trustLevel).toBe('certified');
    });

    it('should reject revoked agent', async () => {
      mockAgentCard.trust = {
        trust_level: 'probationary',
        verification_status: 'revoked',
        verification_method: 'behavioral_validation',
      };

      const result = await verifier.verifyAgentTrust(mockAgentCard);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('revoked');
    });

    it('should reject agent with too many trust violations', async () => {
      mockAgentCard.trust = {
        trust_level: 'probationary',
        verification_status: 'in_progress',
        behavioral_score: 40,
      };

      // Simulate previous violations
      for (let i = 0; i < 3; i++) {
        verifier.recordTrustViolation('test-analyst', 'Test violation');
      }

      const result = await verifier.verifyAgentTrust(mockAgentCard);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('trust violations');
    });

    it('should reject agent with expired probation', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 15);

      mockAgentCard.trust = {
        trust_level: 'probationary',
        verification_status: 'in_progress',
        probation_expires_at: pastDate.toISOString(),
        behavioral_score: 75,
      };

      const result = await verifier.verifyAgentTrust(mockAgentCard);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('probation expired');
    });
  });

  describe('validateBehavior', () => {
    it('should pass validation for compliant response', async () => {
      const response = {
        output: { result: 42, confidence: 0.95 },
        latency_ms: 150,
        satisfies_contract: true,
      };

      const result = await verifier.validateBehavior(mockAgentCard, response);

      expect(result.valid).toBe(true);
      expect(result.behavioral_score).toBeGreaterThan(70);
    });

    it('should fail validation for slow response', async () => {
      // Create a card with a 1 second timeout for this test
      const fastTimeoutCard = {
        ...mockAgentCard,
        performance: {
          timeout_seconds: 1,
          max_tokens: 8192,
          max_retries: 3,
        },
      };

      const response = {
        output: { result: 42 },
        latency_ms: 5000,
        satisfies_contract: true,
      };

      const result = await verifier.validateBehavior(fastTimeoutCard, response);

      expect(result.valid).toBe(false);
      expect(result.violations).toContain('response_time_threshold_exceeded');
    });

    it('should fail validation for contract violation', async () => {
      const response = {
        output: { wrong_field: 'value' },
        latency_ms: 100,
        satisfies_contract: false,
      };

      const result = await verifier.validateBehavior(mockAgentCard, response);

      expect(result.valid).toBe(false);
      expect(result.violations).toContain('output_contract_violation');
    });
  });

  describe('recordInteraction', () => {
    it('should record successful interaction', () => {
      const request = { task: { type: 'test' } } as any;
      const response = { status: 'success' } as any;

      verifier.recordInteraction('test-agent', request, response);

      const status = verifier.getTrustStatus('test-agent');
      expect(status.totalInteractions).toBe(1);
      expect(status.successfulInteractions).toBe(1);
      expect(status.failedInteractions).toBe(0);
    });

    it('should record failed interaction', () => {
      const request = { task: { type: 'test' } } as any;
      const response = { status: 'error', error: { code: 'TEST_ERROR' } } as any;

      verifier.recordInteraction('test-agent', request, response);

      const status = verifier.getTrustStatus('test-agent');
      expect(status.totalInteractions).toBe(1);
      expect(status.successfulInteractions).toBe(0);
      expect(status.failedInteractions).toBe(1);
    });
  });

  describe('recordTrustViolation', () => {
    it('should track violations per agent', () => {
      verifier.recordTrustViolation('test-agent', 'Contract violation');
      verifier.recordTrustViolation('test-agent', 'Timeout violation');

      const status = verifier.getTrustStatus('test-agent');
      expect(status.trustViolations).toBe(2);
    });

    it('should revoke trust after threshold violations', () => {
      const violationCallback = vi.fn();
      verifier.on('trust_revoked', violationCallback);

      // Record threshold violations
      for (let i = 0; i < 3; i++) {
        verifier.recordTrustViolation('test-agent', `Violation ${i}`);
      }

      expect(violationCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          agentId: 'test-agent',
          reason: expect.stringContaining('trust violations'),
        })
      );
    });
  });

  describe('placeOnProbation', () => {
    it('should place agent on probation', () => {
      const callback = vi.fn();
      verifier.on('probation_started', callback);

      const expiresAt = verifier.placeOnProbation('test-agent', 7, 'Testing behavior');

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          agentId: 'test-agent',
          duration: 7,
        })
      );

      const status = verifier.getTrustStatus('test-agent');
      expect(status.trustLevel).toBe('probationary');
    });
  });

  describe('elevateTrustLevel', () => {
    it('should elevate from probationary to trusted', () => {
      const callback = vi.fn();
      verifier.on('trust_elevated', callback);

      verifier.elevateTrustLevel('test-agent', 'trusted', 'Behavioral validation passed');

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          agentId: 'test-agent',
          newLevel: 'trusted',
          previousLevel: 'unverified',
        })
      );

      const status = verifier.getTrustStatus('test-agent');
      expect(status.trustLevel).toBe('trusted');
    });

    it('should elevate from trusted to certified with audit', () => {
      const callback = vi.fn();
      verifier.on('trust_elevated', callback);

      verifier.elevateTrustLevel('test-agent', 'certified', 'External audit passed');

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          agentId: 'test-agent',
          newLevel: 'certified',
          requiresAudit: true,
        })
      );
    });
  });

  describe('getTrustStatus', () => {
    it('should return status for agent with interactions', () => {
      verifier.recordInteraction('test-agent', {} as any, { status: 'success' } as any);
      verifier.recordInteraction('test-agent', {} as any, { status: 'error' } as any);

      const status = verifier.getTrustStatus('test-agent');

      expect(status).toEqual(
        expect.objectContaining({
          trustLevel: 'unverified',
          totalInteractions: 2,
          successfulInteractions: 1,
          failedInteractions: 1,
          behavioralScore: 50,
        })
      );
    });

    it('should return default status for unknown agent', () => {
      const status = verifier.getTrustStatus('unknown-agent');

      expect(status).toEqual(
        expect.objectContaining({
          trustLevel: 'unverified',
          totalInteractions: 0,
          behavioralScore: 0,
        })
      );
    });
  });
});
