/**
 * @one4all/shared
 *
 * Shared types, schemas, and constants for the one4all system
 */

// Mission states
export const MissionStates = {
  DRAFT: 'DRAFT',
  PLANNING: 'PLANNING',
  RESEARCHING: 'RESEARCHING',
  ANALYZING: 'ANALYZING',
  CROSS_QA: 'CROSS_QA',
  DEBATING: 'DEBATING',
  SYNTHESIZING: 'SYNTHESIZING',
  DECIDED: 'DECIDED',
  JOURNALED: 'JOURNALED',
  FAILED: 'FAILED',
  HUMAN_REVIEW: 'HUMAN_REVIEW',
} as const;

export type MissionState = (typeof MissionStates)[keyof typeof MissionStates];

// Evidence tiers
export const EvidenceTiers = {
  TIER_1: 1, // Official sources (SEC, company filings)
  TIER_2: 2, // Reputable third parties (annual reports, analyst research)
  TIER_3: 3, // Management claims, press releases
} as const;

// Enforcement levels
export const EnforcementLevels = {
  BLOCK_MISSION: 'BLOCK_MISSION',
  INSERT_HUMAN_REVIEW: 'INSERT_HUMAN_REVIEW',
  WARN_AND_FLAG: 'WARN_AND_FLAG',
  REJECT_OUTPUT: 'REJECT_OUTPUT',
} as const;

export type EnforcementLevel =
  (typeof EnforcementLevels)[keyof typeof EnforcementLevels];

// Agent schemas
export * from './schemas/agents';
