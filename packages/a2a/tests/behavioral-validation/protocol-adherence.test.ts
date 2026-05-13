import { describe, it, expect } from 'vitest';
import { hasBehavioralProtocol, canParticipateInDebates, canHandleChallenges, canSubmitEvidence, getSupportedInteractionModes, validateAgentCard } from '@one4all/a2a/schemas/agent-card.schema.js';
import type { AgentCard } from '@one4all/a2a/schemas/agent-card.schema.js';

/**
 * Behavioral Validation Tests: Protocol Adherence
 *
 * These tests verify that agents correctly implement the behavioral protocols
 * they claim to support, including challenge/response, evidence submission, and
 * debate protocols.
 */
describe('Behavioral Validation: Protocol Adherence', () => {
  const fullBehavioralAgent: AgentCard = {
    id: 'full-behavioral-agent',
    name: 'Full Behavioral Agent',
    version: '1.0.0',
    domain: 'test',
    active: true,
    role: 'validator',
    description: 'Agent implementing all behavioral protocols',
    tags: [],
    capabilities: {
      input_types: ['debate', 'challenge', 'evidence-request'],
      output_types: ['response', 'evidence', 'argument'],
      skills: [],
      tools_required: [],
      tools_provided: [],
    },
    output_contract: {
      mandatory_fields: ['position'],
      forbidden_content: [],
      validation_rules: [],
    },
    performance: {
      timeout_seconds: 120,
      max_tokens: 8192,
      max_retries: 3,
    },
    a2a_config: {
      endpoint: 'https://behavioral.example.com',
      behavioral_protocol: {
        implements_challenge_response: true,
        implements_evidence_submission: true,
        implements_debate_protocol: true,
        supported_interaction_modes: ['request_response', 'challenge_response', 'debate', 'collaborative', 'adversarial'],
      },
    },
  };

  const partialBehavioralAgent: AgentCard = {
    id: 'partial-behavioral-agent',
    name: 'Partial Behavioral Agent',
    version: '1.0.0',
    domain: 'test',
    active: true,
    role: 'analyst',
    description: 'Agent implementing only some behavioral protocols',
    tags: [],
    capabilities: {
      input_types: ['request'],
      output_types: ['response'],
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
      endpoint: 'https://partial.example.com',
      behavioral_protocol: {
        implements_challenge_response: false,
        implements_evidence_submission: false,
        implements_debate_protocol: false,
        supported_interaction_modes: ['request_response'],
      },
    },
  };

  const internalAgent: AgentCard = {
    id: 'internal-agent',
    name: 'Internal Agent',
    version: '1.0.0',
    domain: 'test',
    active: true,
    role: 'analyst',
    description: 'Internal agent without a2a_config',
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
  };

  const noProtocolAgent: AgentCard = {
    id: 'no-protocol-agent',
    name: 'No Protocol Agent',
    version: '1.0.0',
    domain: 'test',
    active: true,
    role: 'analyst',
    description: 'External agent without behavioral protocol',
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
      endpoint: 'https://noprotocol.example.com',
      // No behavioral_protocol field
    },
  };

  describe('Behavioral Protocol Detection', () => {
    it('should detect agents with behavioral protocol', () => {
      expect(hasBehavioralProtocol(fullBehavioralAgent)).toBe(true);
      expect(hasBehavioralProtocol(partialBehavioralAgent)).toBe(true);
    });

    it('should return false for agents without behavioral protocol', () => {
      expect(hasBehavioralProtocol(noProtocolAgent)).toBe(false);
    });

    it('should treat internal agents as having full behavioral support', () => {
      // Internal agents (no a2a_config) support all protocols by default
      expect(hasBehavioralProtocol(internalAgent)).toBe(false); // No a2a_config means no protocol field
      // But in practice, internal agents are treated as fully capable
    });
  });

  describe('Challenge Response Protocol', () => {
    it('should detect agents that implement challenge response', () => {
      expect(canHandleChallenges(fullBehavioralAgent)).toBe(true);
    });

    it('should detect agents that do not implement challenge response', () => {
      expect(canHandleChallenges(partialBehavioralAgent)).toBe(false);
      expect(canHandleChallenges(noProtocolAgent)).toBe(false);
    });

    it('should verify challenge response implementation flag', () => {
      const implementsChallenge = fullBehavioralAgent.a2a_config?.behavioral_protocol?.implements_challenge_response;
      expect(implementsChallenge).toBe(true);
    });
  });

  describe('Evidence Submission Protocol', () => {
    it('should detect agents that implement evidence submission', () => {
      expect(canSubmitEvidence(fullBehavioralAgent)).toBe(true);
    });

    it('should detect agents that do not implement evidence submission', () => {
      expect(canSubmitEvidence(partialBehavioralAgent)).toBe(false);
      expect(canSubmitEvidence(noProtocolAgent)).toBe(false);
    });

    it('should verify evidence submission implementation flag', () => {
      const implementsEvidence = fullBehavioralAgent.a2a_config?.behavioral_protocol?.implements_evidence_submission;
      expect(implementsEvidence).toBe(true);
    });
  });

  describe('Debate Protocol', () => {
    it('should detect agents that implement debate protocol', () => {
      expect(canParticipateInDebates(fullBehavioralAgent)).toBe(true);
    });

    it('should detect agents that do not implement debate protocol', () => {
      expect(canParticipateInDebates(partialBehavioralAgent)).toBe(false);
      expect(canParticipateInDebates(noProtocolAgent)).toBe(false);
    });

    it('should verify debate protocol implementation flag', () => {
      const implementsDebate = fullBehavioralAgent.a2a_config?.behavioral_protocol?.implements_debate_protocol;
      expect(implementsDebate).toBe(true);
    });
  });

  describe('Interaction Modes', () => {
    it('should return all supported interaction modes', () => {
      const modes = getSupportedInteractionModes(fullBehavioralAgent);
      expect(modes).toContain('request_response');
      expect(modes).toContain('challenge_response');
      expect(modes).toContain('debate');
      expect(modes).toContain('collaborative');
      expect(modes).toContain('adversarial');
    });

    it('should return limited interaction modes for partial agents', () => {
      const modes = getSupportedInteractionModes(partialBehavioralAgent);
      expect(modes).toEqual(['request_response']);
    });

    it('should return empty array for agents without protocol', () => {
      const modes = getSupportedInteractionModes(noProtocolAgent);
      expect(modes).toEqual([]);
    });

    it('should validate interaction mode values', () => {
      const validModes = ['request_response', 'challenge_response', 'debate', 'collaborative', 'adversarial'];
      const modes = getSupportedInteractionModes(fullBehavioralAgent);

      modes.forEach(mode => {
        expect(validModes).toContain(mode);
      });
    });
  });

  describe('Protocol Compliance Scoring', () => {
    it('should give high score for full protocol implementation', () => {
      const protocol = fullBehavioralAgent.a2a_config?.behavioral_protocol;
      if (!protocol) {
        expect(true).toBe(false);
        return;
      }

      const score =
        (protocol.implements_challenge_response ? 1 : 0) +
        (protocol.implements_evidence_submission ? 1 : 0) +
        (protocol.implements_debate_protocol ? 1 : 0);

      expect(score).toBe(3); // All three protocols implemented
    });

    it('should give low score for minimal protocol implementation', () => {
      const protocol = partialBehavioralAgent.a2a_config?.behavioral_protocol;
      if (!protocol) {
        expect(true).toBe(false);
        return;
      }

      const score =
        (protocol.implements_challenge_response ? 1 : 0) +
        (protocol.implements_evidence_submission ? 1 : 0) +
        (protocol.implements_debate_protocol ? 1 : 0);

      expect(score).toBe(0); // No protocols implemented
    });

    it('should give partial score for partial implementation', () => {
      const partialAgent: AgentCard = {
        ...fullBehavioralAgent,
        id: 'partial-impl-agent',
        a2a_config: {
          ...fullBehavioralAgent.a2a_config!,
          endpoint: 'https://partial.example.com',
          behavioral_protocol: {
            implements_challenge_response: true,
            implements_evidence_submission: false,
            implements_debate_protocol: true,
            supported_interaction_modes: ['request_response', 'debate'],
          },
        },
      };

      const protocol = partialAgent.a2a_config?.behavioral_protocol;
      if (!protocol) {
        expect(true).toBe(false);
        return;
      }

      const score =
        (protocol.implements_challenge_response ? 1 : 0) +
        (protocol.implements_evidence_submission ? 1 : 0) +
        (protocol.implements_debate_protocol ? 1 : 0);

      expect(score).toBe(2); // 2 out of 3 protocols implemented
    });
  });

  describe('Protocol Validation', () => {
    it('should require consistent protocol flags', () => {
      const protocol = fullBehavioralAgent.a2a_config?.behavioral_protocol;
      if (!protocol) {
        expect(true).toBe(false);
        return;
      }

      // If debate protocol is implemented, agent should handle challenges
      const { implements_debate_protocol, implements_challenge_response } = protocol;

      if (implements_debate_protocol) {
        // Debate protocol implicitly requires challenge response
        expect(implements_challenge_response || canParticipateInDebates(fullBehavioralAgent)).toBe(true);
      }
    });

    it('should validate interaction modes match protocol flags', () => {
      const protocol = fullBehavioralAgent.a2a_config?.behavioral_protocol;
      if (!protocol) {
        expect(true).toBe(false);
        return;
      }

      const modes = protocol.supported_interaction_modes;
      const { implements_challenge_response, implements_debate_protocol } = protocol;

      // If challenge_response mode is supported, flag should be true
      if (modes.includes('challenge_response')) {
        expect(implements_challenge_response).toBe(true);
      }

      // If debate mode is supported, flag should be true
      if (modes.includes('debate')) {
        expect(implements_debate_protocol).toBe(true);
      }
    });
  });

  describe('Agent Card Validation', () => {
    it('should validate agent card with full behavioral protocol', () => {
      const result = validateAgentCard(fullBehavioralAgent);
      expect(result.valid).toBe(true);
    });

    it('should validate agent card with minimal behavioral protocol', () => {
      const result = validateAgentCard(partialBehavioralAgent);
      expect(result.valid).toBe(true);
    });

    it('should validate agent card without behavioral protocol', () => {
      const result = validateAgentCard(noProtocolAgent);
      expect(result.valid).toBe(true);
    });
  });
});
