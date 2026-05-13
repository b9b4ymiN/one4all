import { describe, it, expect } from 'vitest';
import {
  InteractionMode,
  hasBehavioralProtocolSupport,
  getSupportedInteractionModes,
  canParticipateInDebates,
  canHandleChallenges,
  canSubmitEvidence,
  getBehavioralCompatibilityScore,
  ChallengeRequestSchema,
  ChallengeResponseSchema,
  DebateRequestSchema,
  DebateResponseSchema,
  EvidenceSubmissionSchema,
} from '../../../src/protocols/behavioral-protocol.js';
import type { AgentCard } from '../../../src/schemas/agent-card.schema.js';

describe('Behavioral Protocol', () => {
  describe('InteractionMode enum', () => {
    it('should have all interaction modes', () => {
      expect(InteractionMode.REQUEST_RESPONSE).toBe('request_response');
      expect(InteractionMode.CHALLENGE_RESPONSE).toBe('challenge_response');
      expect(InteractionMode.DEBATE).toBe('debate');
      expect(InteractionMode.COLLABORATIVE).toBe('collaborative');
      expect(InteractionMode.ADVERSARIAL).toBe('adversarial');
    });
  });

  describe('hasBehavioralProtocolSupport', () => {
    it('should return false when no behavioral protocol exists', () => {
      const card: AgentCard = {
        id: 'simple-agent',
        name: 'Simple',
        version: '1.0.0',
        domain: 'test',
        active: true,
        role: 'analyst',
        description: 'Test',
        capabilities: { input_types: [], output_types: [], skills: [], tools_required: [], tools_provided: [] },
        output_contract: { mandatory_fields: [], forbidden_content: [], validation_rules: [] },
      };

      expect(hasBehavioralProtocolSupport(card)).toBe(false);
    });

    it('should return true when challenge response is implemented', () => {
      const card: AgentCard = {
        id: 'challenger-agent',
        name: 'Challenger',
        version: '1.0.0',
        domain: 'test',
        active: true,
        role: 'analyst',
        description: 'Test',
        capabilities: { input_types: [], output_types: [], skills: [], tools_required: [], tools_provided: [] },
        output_contract: { mandatory_fields: [], forbidden_content: [], validation_rules: [] },
        a2a_config: {
          behavioral_protocol: {
            implements_challenge_response: true,
            implements_evidence_submission: false,
            implements_debate_protocol: false,
            supported_interaction_modes: ['request_response', 'challenge_response'],
          },
        },
      };

      expect(hasBehavioralProtocolSupport(card)).toBe(true);
    });

    it('should return true when evidence submission is implemented', () => {
      const card: AgentCard = {
        id: 'evidence-agent',
        name: 'Evidence',
        version: '1.0.0',
        domain: 'test',
        active: true,
        role: 'analyst',
        description: 'Test',
        capabilities: { input_types: [], output_types: [], skills: [], tools_required: [], tools_provided: [] },
        output_contract: { mandatory_fields: [], forbidden_content: [], validation_rules: [] },
        a2a_config: {
          behavioral_protocol: {
            implements_challenge_response: false,
            implements_evidence_submission: true,
            implements_debate_protocol: false,
            supported_interaction_modes: ['request_response'],
          },
        },
      };

      expect(hasBehavioralProtocolSupport(card)).toBe(true);
    });

    it('should return true when debate protocol is implemented', () => {
      const card: AgentCard = {
        id: 'debater-agent',
        name: 'Debater',
        version: '1.0.0',
        domain: 'test',
        active: true,
        role: 'analyst',
        description: 'Test',
        capabilities: { input_types: [], output_types: [], skills: [], tools_required: [], tools_provided: [] },
        output_contract: { mandatory_fields: [], forbidden_content: [], validation_rules: [] },
        a2a_config: {
          behavioral_protocol: {
            implements_challenge_response: false,
            implements_evidence_submission: false,
            implements_debate_protocol: true,
            supported_interaction_modes: ['debate'],
          },
        },
      };

      expect(hasBehavioralProtocolSupport(card)).toBe(true);
    });
  });

  describe('getSupportedInteractionModes', () => {
    it('should return default mode when no protocol defined', () => {
      const card: AgentCard = {
        id: 'simple-agent',
        name: 'Simple',
        version: '1.0.0',
        domain: 'test',
        active: true,
        role: 'analyst',
        description: 'Test',
        capabilities: { input_types: [], output_types: [], skills: [], tools_required: [], tools_provided: [] },
        output_contract: { mandatory_fields: [], forbidden_content: [], validation_rules: [] },
      };

      const modes = getSupportedInteractionModes(card);
      expect(modes).toEqual([InteractionMode.REQUEST_RESPONSE]);
    });

    it('should return declared modes from protocol', () => {
      const card: AgentCard = {
        id: 'multi-mode-agent',
        name: 'Multi Mode',
        version: '1.0.0',
        domain: 'test',
        active: true,
        role: 'analyst',
        description: 'Test',
        capabilities: { input_types: [], output_types: [], skills: [], tools_required: [], tools_provided: [] },
        output_contract: { mandatory_fields: [], forbidden_content: [], validation_rules: [] },
        a2a_config: {
          behavioral_protocol: {
            implements_challenge_response: true,
            implements_evidence_submission: true,
            implements_debate_protocol: true,
            supported_interaction_modes: ['request_response', 'challenge_response', 'debate', 'collaborative'],
          },
        },
      };

      const modes = getSupportedInteractionModes(card);
      expect(modes).toHaveLength(4);
      expect(modes).toContain(InteractionMode.REQUEST_RESPONSE);
      expect(modes).toContain(InteractionMode.CHALLENGE_RESPONSE);
      expect(modes).toContain(InteractionMode.DEBATE);
      expect(modes).toContain(InteractionMode.COLLABORATIVE);
    });
  });

  describe('canParticipateInDebates', () => {
    it('should return true when debate protocol is implemented', () => {
      const card: AgentCard = {
        id: 'debater',
        name: 'Debater',
        version: '1.0.0',
        domain: 'test',
        active: true,
        role: 'analyst',
        description: 'Test',
        capabilities: { input_types: [], output_types: [], skills: [], tools_required: [], tools_provided: [] },
        output_contract: { mandatory_fields: [], forbidden_content: [], validation_rules: [] },
        a2a_config: {
          behavioral_protocol: {
            implements_challenge_response: true,
            implements_evidence_submission: true,
            implements_debate_protocol: true,
            supported_interaction_modes: ['debate'],
          },
        },
      };

      expect(canParticipateInDebates(card)).toBe(true);
    });

    it('should return false when debate protocol is not implemented', () => {
      const card: AgentCard = {
        id: 'non-debater',
        name: 'Non Debater',
        version: '1.0.0',
        domain: 'test',
        active: true,
        role: 'analyst',
        description: 'Test',
        capabilities: { input_types: [], output_types: [], skills: [], tools_required: [], tools_provided: [] },
        output_contract: { mandatory_fields: [], forbidden_content: [], validation_rules: [] },
      };

      expect(canParticipateInDebates(card)).toBe(false);
    });
  });

  describe('canHandleChallenges', () => {
    it('should return true when challenge response is implemented', () => {
      const card: AgentCard = {
        id: 'challenger',
        name: 'Challenger',
        version: '1.0.0',
        domain: 'test',
        active: true,
        role: 'analyst',
        description: 'Test',
        capabilities: { input_types: [], output_types: [], skills: [], tools_required: [], tools_provided: [] },
        output_contract: { mandatory_fields: [], forbidden_content: [], validation_rules: [] },
        a2a_config: {
          behavioral_protocol: {
            implements_challenge_response: true,
            implements_evidence_submission: false,
            implements_debate_protocol: false,
            supported_interaction_modes: ['challenge_response'],
          },
        },
      };

      expect(canHandleChallenges(card)).toBe(true);
    });

    it('should return false when challenge response is not implemented', () => {
      const card: AgentCard = {
        id: 'non-challenger',
        name: 'Non Challenger',
        version: '1.0.0',
        domain: 'test',
        active: true,
        role: 'analyst',
        description: 'Test',
        capabilities: { input_types: [], output_types: [], skills: [], tools_required: [], tools_provided: [] },
        output_contract: { mandatory_fields: [], forbidden_content: [], validation_rules: [] },
      };

      expect(canHandleChallenges(card)).toBe(false);
    });
  });

  describe('canSubmitEvidence', () => {
    it('should return true when evidence submission is implemented', () => {
      const card: AgentCard = {
        id: 'evidence-submitter',
        name: 'Evidence Submitter',
        version: '1.0.0',
        domain: 'test',
        active: true,
        role: 'analyst',
        description: 'Test',
        capabilities: { input_types: [], output_types: [], skills: [], tools_required: [], tools_provided: [] },
        output_contract: { mandatory_fields: [], forbidden_content: [], validation_rules: [] },
        a2a_config: {
          behavioral_protocol: {
            implements_challenge_response: true,
            implements_evidence_submission: true,
            implements_debate_protocol: false,
            supported_interaction_modes: ['request_response'],
          },
        },
      };

      expect(canSubmitEvidence(card)).toBe(true);
    });

    it('should return false when evidence submission is not implemented', () => {
      const card: AgentCard = {
        id: 'non-evidence',
        name: 'Non Evidence',
        version: '1.0.0',
        domain: 'test',
        active: true,
        role: 'analyst',
        description: 'Test',
        capabilities: { input_types: [], output_types: [], skills: [], tools_required: [], tools_provided: [] },
        output_contract: { mandatory_fields: [], forbidden_content: [], validation_rules: [] },
      };

      expect(canSubmitEvidence(card)).toBe(false);
    });
  });

  describe('getBehavioralCompatibilityScore', () => {
    it('should return 0 for agent without behavioral protocol', () => {
      const card: AgentCard = {
        id: 'simple',
        name: 'Simple',
        version: '1.0.0',
        domain: 'test',
        active: true,
        role: 'analyst',
        description: 'Test',
        capabilities: { input_types: [], output_types: [], skills: [], tools_required: [], tools_provided: [] },
        output_contract: { mandatory_fields: [], forbidden_content: [], validation_rules: [] },
      };

      const result = getBehavioralCompatibilityScore(card);
      expect(result.score).toBe(0);
      expect(result.details.challengeSupport).toBe(false);
      expect(result.details.debateSupport).toBe(false);
      expect(result.details.evidenceSupport).toBe(false);
      expect(result.details.modeCount).toBe(1);
    });

    it('should return high score for fully compatible agent', () => {
      const card: AgentCard = {
        id: 'fully-compatible',
        name: 'Fully Compatible',
        version: '1.0.0',
        domain: 'test',
        active: true,
        role: 'analyst',
        description: 'Test',
        capabilities: { input_types: [], output_types: [], skills: [], tools_required: [], tools_provided: [] },
        output_contract: { mandatory_fields: [], forbidden_content: [], validation_rules: [] },
        a2a_config: {
          behavioral_protocol: {
            implements_challenge_response: true,
            implements_evidence_submission: true,
            implements_debate_protocol: true,
            supported_interaction_modes: ['request_response', 'challenge_response', 'debate', 'collaborative', 'adversarial'],
          },
        },
      };

      const result = getBehavioralCompatibilityScore(card);
      expect(result.score).toBeGreaterThan(0.8);
      expect(result.details.challengeSupport).toBe(true);
      expect(result.details.debateSupport).toBe(true);
      expect(result.details.evidenceSupport).toBe(true);
      expect(result.details.modeCount).toBe(5);
    });

    it('should return moderate score for partially compatible agent', () => {
      const card: AgentCard = {
        id: 'partial',
        name: 'Partial',
        version: '1.0.0',
        domain: 'test',
        active: true,
        role: 'analyst',
        description: 'Test',
        capabilities: { input_types: [], output_types: [], skills: [], tools_required: [], tools_provided: [] },
        output_contract: { mandatory_fields: [], forbidden_content: [], validation_rules: [] },
        a2a_config: {
          behavioral_protocol: {
            implements_challenge_response: true,
            implements_evidence_submission: false,
            implements_debate_protocol: true,
            supported_interaction_modes: ['request_response', 'challenge_response'],
          },
        },
      };

      const result = getBehavioralCompatibilityScore(card);
      expect(result.score).toBeGreaterThan(0.5);
      expect(result.score).toBeLessThan(0.8);
      expect(result.details.challengeSupport).toBe(true);
      expect(result.details.debateSupport).toBe(true);
      expect(result.details.evidenceSupport).toBe(false);
    });
  });

  describe('Schema validation', () => {
    describe('ChallengeRequestSchema', () => {
      it('should validate valid challenge request', () => {
        const request = {
          request_id: 'req-1',
          agent_id: 'agent-1',
          challenge: {
            type: 'assumption' as const,
            content: 'Your assumption about X is incorrect',
          },
          requires_evidence: true,
          confidence_threshold: 0.8,
        };

        const result = ChallengeRequestSchema.safeParse(request);
        expect(result.success).toBe(true);
      });

      it('should reject invalid challenge type', () => {
        const request = {
          request_id: 'req-1',
          agent_id: 'agent-1',
          challenge: {
            type: 'invalid_type',
            content: 'Test',
          },
        };

        const result = ChallengeRequestSchema.safeParse(request);
        expect(result.success).toBe(false);
      });
    });

    describe('ChallengeResponseSchema', () => {
      it('should validate valid challenge response with acceptance', () => {
        const response = {
          request_id: 'req-1',
          agent_id: 'agent-1',
          response: {
            accepts: true,
            reasoning: 'You are correct, I will revise',
            evidence: [
              {
                type: 'fact',
                source: 'https://example.com',
                source_tier: 'tier_1' as const,
                content: { data: 'value' },
              },
            ],
            confidence: 0.9,
          },
        };

        const result = ChallengeResponseSchema.safeParse(response);
        expect(result.success).toBe(true);
      });

      it('should validate valid challenge response with rejection', () => {
        const response = {
          request_id: 'req-1',
          agent_id: 'agent-1',
          response: {
            accepts: false,
            reasoning: 'I stand by my assumption',
            counter_argument: 'The data supports my position',
            confidence: 0.85,
          },
        };

        const result = ChallengeResponseSchema.safeParse(response);
        expect(result.success).toBe(true);
      });
    });

    describe('DebateRequestSchema', () => {
      it('should validate valid debate request', () => {
        const request = {
          request_id: 'req-1',
          agent_id: 'agent-1',
          debate: {
            topic: 'Market outlook for 2026',
            position: 'Bullish',
            opposing_arguments: ['Bear case 1', 'Bear case 2'],
            constitution_rules: ['Be respectful', 'Cite sources'],
          },
          max_rounds: 3,
          current_round: 1,
        };

        const result = DebateRequestSchema.safeParse(request);
        expect(result.success).toBe(true);
      });

      it('should use default values for optional fields', () => {
        const request = {
          request_id: 'req-1',
          agent_id: 'agent-1',
          debate: {
            topic: 'Test topic',
            position: 'Test position',
            opposing_arguments: [],
          },
        };

        const result = DebateRequestSchema.safeParse(request);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.max_rounds).toBe(3);
          expect(result.data.current_round).toBe(1);
        }
      });
    });

    describe('DebateResponseSchema', () => {
      it('should validate valid debate response', () => {
        const response = {
          request_id: 'req-1',
          agent_id: 'agent-1',
          response: {
            argument: 'Here is my argument',
            supporting_evidence: [
              {
                claim: 'Market will grow',
                source: 'https://example.com',
                source_tier: 'tier_1' as const,
              },
            ],
            weaknesses_in_opposing: ['Weakness 1', 'Weakness 2'],
            confidence: 0.8,
            round_complete: true,
          },
          round: 1,
        };

        const result = DebateResponseSchema.safeParse(response);
        expect(result.success).toBe(true);
      });
    });

    describe('EvidenceSubmissionSchema', () => {
      it('should validate valid evidence submission', () => {
        const submission = {
          claim: 'The market will grow 10% in 2026',
          evidence: [
            {
              type: 'FACT' as const,
              content: { data: 'Historical trend' },
              source: 'https://example.com/data',
              source_tier: 'tier_1' as const,
              section: 'Market Analysis',
              confidence: 'high' as const,
            },
            {
              type: 'DERIVED' as const,
              content: { calculation: 'CAGR projection' },
              source: 'Internal analysis',
              source_tier: 'tier_2' as const,
              confidence: 'medium' as const,
            },
          ],
          data_gaps: [
            {
              requested: 'Q4 2025 earnings',
              not_found_in: ['Source A', 'Source B'],
              impact: 'Unable to verify short-term trend',
              suggested_alternative: 'Use Q3 data as proxy',
            },
          ],
        };

        const result = EvidenceSubmissionSchema.safeParse(submission);
        expect(result.success).toBe(true);
      });

      it('should accept evidence without data_gaps', () => {
        const submission = {
          claim: 'Simple claim',
          evidence: [
            {
              type: 'FACT' as const,
              content: 'Fact content',
              source: 'https://example.com',
              source_tier: 'tier_1' as const,
            },
          ],
        };

        const result = EvidenceSubmissionSchema.safeParse(submission);
        expect(result.success).toBe(true);
      });
    });
  });
});
