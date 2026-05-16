import { z } from 'zod';
import type { AgentCard } from '../schemas/agent-card.schema.js';

/**
 * Behavioral interaction modes
 *
 * These modes define how agents can interact with each other.
 * External agents must declare which modes they support in their Agent Card.
 */
export enum InteractionMode {
  REQUEST_RESPONSE = 'request_response',
  CHALLENGE_RESPONSE = 'challenge_response',
  DEBATE = 'debate',
  COLLABORATIVE = 'collaborative',
  ADVERSARIAL = 'adversarial',
}

/**
 * Challenge request format
 *
 * Used when one agent challenges another agent's claim or reasoning.
 * This is the heart of the debate protocol in one4all.
 */
export const ChallengeRequestSchema = z.object({
  request_id: z.string(),
  agent_id: z.string(),
  challenge: z.object({
    type: z.enum(['assumption', 'reasoning', 'evidence', 'conclusion']),
    content: z.string(),
    context: z.any().optional(),
  }),
  requires_evidence: z.boolean().default(true),
  confidence_threshold: z.number().min(0).max(1).optional(),
});

export type ChallengeRequest = z.infer<typeof ChallengeRequestSchema>;

/**
 * Challenge response format
 *
 * The challenged agent responds with either acceptance (with reasoning/evidence)
 * or rejection (with counter-argument).
 */
export const ChallengeResponseSchema = z.object({
  request_id: z.string(),
  agent_id: z.string(),
  response: z.object({
    accepts: z.boolean(),
    reasoning: z.string(),
    evidence: z.array(z.object({
      type: z.string(),
      source: z.string(),
      source_tier: z.enum(['tier_1', 'tier_2', 'tier_3', 'unverified']),
      content: z.any(),
    })).optional(),
    counter_argument: z.string().optional(),
    confidence: z.number().min(0).max(1).optional(),
  }),
});

export type ChallengeResponse = z.infer<typeof ChallengeResponseSchema>;

/**
 * Debate request format
 *
 * Initiates a structured debate between agents with specific rules.
 */
export const DebateRequestSchema = z.object({
  request_id: z.string(),
  agent_id: z.string(),
  debate: z.object({
    topic: z.string(),
    position: z.string(),
    opposing_arguments: z.array(z.string()),
    context: z.any().optional(),
    constitution_rules: z.array(z.string()).optional(),
  }),
  max_rounds: z.number().min(1).max(10).default(3),
  current_round: z.number().default(1),
});

export type DebateRequest = z.infer<typeof DebateRequestSchema>;

/**
 * Debate response format
 *
 * Agent responds with its argument and supporting evidence.
 */
export const DebateResponseSchema = z.object({
  request_id: z.string(),
  agent_id: z.string(),
  response: z.object({
    argument: z.string(),
    supporting_evidence: z.array(z.object({
      claim: z.string(),
      source: z.string(),
      source_tier: z.enum(['tier_1', 'tier_2', 'tier_3', 'unverified']),
    })).optional(),
    weaknesses_in_opposing: z.array(z.string()).optional(),
    confidence: z.number().min(0).max(1).optional(),
    round_complete: z.boolean(),
    requests_evidence: z.array(z.string()).optional(),
  }),
  round: z.number(),
});

export type DebateResponse = z.infer<typeof DebateResponseSchema>;

/**
 * Evidence submission format
 *
 * Agents submit evidence to support their claims.
 */
export const EvidenceSubmissionSchema = z.object({
  claim: z.string(),
  evidence: z.array(z.object({
    type: z.enum(['FACT', 'DERIVED', 'ASSUMPTION', 'ESTIMATE', 'UNVERIFIED', 'MANAGEMENT_CLAIM']),
    content: z.any(),
    source: z.string(),
    source_tier: z.enum(['tier_1', 'tier_2', 'tier_3', 'unverified']),
    section: z.string().optional(),
    confidence: z.enum(['high', 'medium', 'low']).optional(),
  })),
  data_gaps: z.array(z.object({
    requested: z.string(),
    not_found_in: z.array(z.string()),
    impact: z.string(),
    suggested_alternative: z.string().optional(),
  })).optional(),
});

export type EvidenceSubmission = z.infer<typeof EvidenceSubmissionSchema>;

/**
 * Behavioral protocol interface
 *
 * External agents MUST implement this interface to be compatible with one4all's
 * internal agent interactions (challenges, debates, evidence submission).
 *
 * This implements the Senior AI Harness Engineer principle:
 * "Explicit control over clever prompts" - we define explicit protocols.
 */
export interface BehavioralProtocol {
  /**
   * Handle challenge from another agent
   *
   * The challenged agent must respond with evidence or counter-argument.
   */
  handleChallenge(request: ChallengeRequest): Promise<ChallengeResponse>;

  /**
   * Handle debate with another agent
   *
   * The agent participates in structured debate with rules.
   */
  handleDebate(request: DebateRequest): Promise<DebateResponse>;

  /**
   * Submit evidence for a claim
   *
   * Agents provide evidence to support their claims.
   */
  submitEvidence(submission: EvidenceSubmission): Promise<{
    accepted: boolean;
    reason?: string;
  }>;

  /**
   * Get supported interaction modes
   *
   * Returns the modes this agent can participate in.
   */
  getSupportedModes(): InteractionMode[];
}

/**
 * Check if agent card declares behavioral protocol support
 */
export function hasBehavioralProtocolSupport(card: AgentCard): boolean {
  const protocol = card.a2a_config?.behavioral_protocol;
  if (!protocol) return false;

  // Must support at least challenge_response or debate to be considered
  // behaviorally compatible
  return protocol.implements_challenge_response ||
         protocol.implements_evidence_submission ||
         protocol.implements_debate_protocol;
}

/**
 * Get interaction modes from agent card
 */
export function getSupportedInteractionModes(card: AgentCard): InteractionMode[] {
  const modes = card.a2a_config?.behavioral_protocol?.supported_interaction_modes;
  if (!modes) return [InteractionMode.REQUEST_RESPONSE];
  return modes as InteractionMode[];
}

/**
 * Check if agent can participate in debates
 */
export function canParticipateInDebates(card: AgentCard): boolean {
  return card.a2a_config?.behavioral_protocol?.implements_debate_protocol === true;
}

/**
 * Check if agent can handle challenges
 */
export function canHandleChallenges(card: AgentCard): boolean {
  return card.a2a_config?.behavioral_protocol?.implements_challenge_response === true;
}

/**
 * Check if agent can submit evidence
 */
export function canSubmitEvidence(card: AgentCard): boolean {
  return card.a2a_config?.behavioral_protocol?.implements_evidence_submission === true;
}

/**
 * Get behavioral compatibility score
 *
 * Returns a score (0-1) indicating how compatible an external agent is
 * with one4all's behavioral protocols.
 */
export function getBehavioralCompatibilityScore(card: AgentCard): {
  score: number;
  details: {
    challengeSupport: boolean;
    debateSupport: boolean;
    evidenceSupport: boolean;
    modeCount: number;
  };
} {
  const protocol = card.a2a_config?.behavioral_protocol;
  if (!protocol) {
    return {
      score: 0,
      details: {
        challengeSupport: false,
        debateSupport: false,
        evidenceSupport: false,
        modeCount: 1, // Only request_response
      },
    };
  }

  let score = 0;
  const details = {
    challengeSupport: protocol.implements_challenge_response,
    debateSupport: protocol.implements_debate_protocol,
    evidenceSupport: protocol.implements_evidence_submission,
    modeCount: protocol.supported_interaction_modes.length,
  };

  // Score calculation
  if (details.challengeSupport) score += 0.3;
  if (details.debateSupport) score += 0.3;
  if (details.evidenceSupport) score += 0.2;

  // Mode diversity bonus
  score += Math.min(0.2, (details.modeCount - 1) * 0.05);

  return { score: Math.min(1, score), details };
}
