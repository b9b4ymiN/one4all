/**
 * Debate Controller Types
 *
 * Defines all types for the debate system that coordinates
 * analyst discussions during the DEBATING state
 */

/**
 * Debate phases
 */
export enum DebatePhase {
  INITIALIZATION = "INITIALIZATION",
  OPENING_STATEMENTS = "OPENING_STATEMENTS",
  REBUTTAL = "REBUTTAL",
  CROSS_EXAMINATION = "CROSS_EXAMINATION",
  CLOSING_ARGUMENTS = "CLOSING_ARGUMENTS",
  CONVERGENCE = "CONVERGENCE",
  COMPLETED = "COMPLETED",
}

/**
 * Conviction level for an analyst's position
 */
export enum ConvictionLevel {
  VERY_LOW = "VERY_LOW",    // 0-20%
  LOW = "LOW",              // 20-40%
  MODERATE = "MODERATE",    // 40-60%
  HIGH = "HIGH",            // 60-80%
  VERY_HIGH = "VERY_HIGH",  // 80-100%
}

/**
 * Analyst position in a debate
 */
export interface AnalystPosition {
  analyst_id: string;
  stance: "bullish" | "bearish" | "neutral";
  conviction: ConvictionLevel;
  conviction_score: number; // 0-100
  key_arguments: string[];
  evidence_references: string[];
  thesis_summary: string;
}

/**
 * Single debate contribution from an analyst
 */
export interface DebateContribution {
  id: string;
  debate_id: string;
  analyst_id: string;
  phase: DebatePhase;
  content: string;
  timestamp: Date;
  conviction_score: number;
  referenced_analysts?: string[]; // Analysts being responded to
  constitution_violations?: string[]; // Any constitution rule violations
}

/**
 * Debate moderation action
 */
export interface ModerationAction {
  type: "warning" | "rejection" | "retry_required" | "block";
  analyst_id: string;
  reason: string;
  rule_id?: string;
  timestamp: Date;
}

/**
 * Debate configuration
 */
export interface DebateConfig {
  mission_id: string;
  domain: string;
  participating_analysts: string[];
  max_rounds: number;
  max_contributions_per_round: number;
  convergence_threshold: number; // Conviction score difference for convergence
  timeout_ms: number;
  constitution_strict: boolean;
}

/**
 * Active debate session
 */
export interface DebateSession {
  id: string;
  mission_id: string;
  config: DebateConfig;
  current_phase: DebatePhase;
  current_round: number;
  started_at: Date;
  phase_history: DebatePhaseTransition[];
  positions: Map<string, AnalystPosition>;
  contributions: DebateContribution[];
  moderation_actions: ModerationAction[];
  converged: boolean;
  convergence_summary?: string;
  completed_at?: Date;
}

/**
 * Phase transition record
 */
export interface DebatePhaseTransition {
  from: DebatePhase;
  to: DebatePhase;
  timestamp: Date;
  reason: string;
}

/**
 * Debate result
 */
export interface DebateResult {
  success: boolean;
  debate_id: string;
  final_phase: DebatePhase;
  total_rounds: number;
  total_contributions: number;
  positions: AnalystPosition[];
  convergence_summary?: string;
  failed_analysts: string[];
  constitution_violations: number;
  synthesis_input: DebateSynthesisInput;
}

/**
 * Input for synthesis engine after debate
 */
export interface DebateSynthesisInput {
  mission_id: string;
  debate_id: string;
  final_positions: AnalystPosition[];
  key_consensus_points: string[];
  key_disagreements: Array<{
    topic: string;
    bullish_view: string;
    bearish_view: string;
  }>;
  conviction_distribution: {
    average: number;
    min: number;
    max: number;
    analyst_scores: Array<{ analyst: string; score: number }>;
  };
  total_contributions: number;
}

/**
 * Constitution check result for a contribution
 */
export interface ContributionCheckResult {
  approved: boolean;
  violations: Array<{
    rule_id: string;
    description: string;
    enforcement: string;
  }>;
  warnings: string[];
  retry_required: boolean;
}

/**
 * Phase transition validation result
 */
export interface PhaseTransitionResult {
  allowed: boolean;
  next_phase?: DebatePhase;
  reason?: string;
  requirements_met?: string[];
  requirements_missing?: string[];
}
