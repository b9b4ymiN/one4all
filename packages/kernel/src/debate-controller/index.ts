/**
 * Debate Controller Module
 *
 * Coordinates analyst discussions during the DEBATING state.
 * Enforces constitution rules, tracks conviction levels,
 * and manages debate phases.
 */

export { DebateController, createDebateController } from './debate-controller.js';

// Export enums as values
export { DebatePhase, ConvictionLevel } from './types.js';

export type {
  AnalystPosition,
  DebateContribution,
  ModerationAction,
  DebateConfig,
  DebateSession,
  DebatePhaseTransition,
  DebateResult,
  DebateSynthesisInput,
  ContributionCheckResult,
  PhaseTransitionResult,
} from './types.js';
