/**
 * Debate Controller Module
 *
 * Coordinates analyst discussions during the DEBATING state.
 * Enforces constitution rules, tracks conviction levels,
 * and manages debate phases.
 */

export { DebateController, createDebateController } from './debate-controller.js';

// Export DebateExecutor and its types
export { DebateExecutor, createDebateExecutor } from './debate-executor.js';
export type { LLMAdapter, RoundResult, DebateExecutionResult } from './debate-executor.js';

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
