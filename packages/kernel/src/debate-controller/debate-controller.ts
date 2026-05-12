/**
 * Debate Controller
 *
 * Coordinates analyst discussions during the DEBATING state.
 * Enforces constitution rules, tracks conviction levels,
 * and manages debate phases.
 */

import type {
  DebateSession,
  DebateConfig,
  DebatePhaseTransition,
  AnalystPosition,
  DebateContribution,
  ModerationAction,
  DebateResult,
  DebateSynthesisInput,
  ContributionCheckResult,
  PhaseTransitionResult,
} from './types.js';
import {
  DebatePhase,
  ConvictionLevel,
} from './types.js';
import {
  ConstitutionEnforcer,
  type RuleContext,
  type OutputCheckResult,
} from '../constitution-enforcer/index.js';

/**
 * Default debate configuration
 */
const DEFAULT_DEBATE_CONFIG: Partial<DebateConfig> = {
  max_rounds: 3,
  max_contributions_per_round: 5,
  convergence_threshold: 30, // Conviction scores within 30 points
  timeout_ms: 300000, // 5 minutes
  constitution_strict: true,
};

/**
 * Conviction level thresholds
 */
const CONVICTION_THRESHOLDS: Record<ConvictionLevel, { min: number; max: number }> = {
  VERY_LOW: { min: 0, max: 20 },
  LOW: { min: 20, max: 40 },
  MODERATE: { min: 40, max: 60 },
  HIGH: { min: 60, max: 80 },
  VERY_HIGH: { min: 80, max: 100 },
};

/**
 * Debate Controller class
 */
export class DebateController {
  private debates: Map<string, DebateSession> = new Map();
  private constitutionEnforcer: ConstitutionEnforcer;
  private enabled: boolean;

  constructor(options: {
    constitutionEnforcer?: ConstitutionEnforcer;
    enabled?: boolean;
  } = {}) {
    this.constitutionEnforcer = options.constitutionEnforcer ?? new ConstitutionEnforcer();
    this.enabled = options.enabled ?? true;
  }

  /**
   * Create a new debate session
   */
  createDebate(config: DebateConfig): DebateSession {
    const mergedConfig = { ...DEFAULT_DEBATE_CONFIG, ...config } as DebateConfig;

    const session: DebateSession = {
      id: this.generateDebateId(),
      mission_id: config.mission_id,
      config: mergedConfig,
      current_phase: DebatePhase.INITIALIZATION,
      current_round: 0,
      started_at: new Date(),
      phase_history: [],
      positions: new Map(),
      contributions: [],
      moderation_actions: [],
      converged: false,
    };

    this.debates.set(session.id, session);
    return session;
  }

  /**
   * Initialize analyst positions for the debate
   */
  initializePositions(
    debateId: string,
    initialPositions: Array<{
      analyst_id: string;
      stance: 'bullish' | 'bearish' | 'neutral';
      thesis_summary: string;
      conviction_score?: number;
    }>
  ): void {
    const session = this.getDebateSession(debateId);
    if (!session) {
      throw new Error(`Debate session not found: ${debateId}`);
    }

    for (const pos of initialPositions) {
      const conviction = this.determineConvictionLevel(
        pos.conviction_score ?? 50
      );

      const position: AnalystPosition = {
        analyst_id: pos.analyst_id,
        stance: pos.stance,
        conviction,
        conviction_score: pos.conviction_score ?? 50,
        key_arguments: [],
        evidence_references: [],
        thesis_summary: pos.thesis_summary,
      };

      session.positions.set(pos.analyst_id, position);
    }

    // Transition to opening statements
    this.transitionPhase(debateId, DebatePhase.OPENING_STATEMENTS, 'Positions initialized');
  }

  /**
   * Submit a contribution to the debate
   */
  async submitContribution(
    debateId: string,
    analystId: string,
    content: string,
    convictionScore: number,
    referencedAnalysts?: string[]
  ): Promise<{
    approved: boolean;
    contribution?: DebateContribution;
    violations: string[];
    warnings: string[];
  }> {
    const session = this.getDebateSession(debateId);
    if (!session) {
      throw new Error(`Debate session not found: ${debateId}`);
    }

    // Check constitution rules
    const checkResult = await this.checkConstitutionRules(
      session,
      analystId,
      content
    );

    if (!checkResult.approved && session.config.constitution_strict) {
      // Record moderation action
      const action: ModerationAction = {
        type: checkResult.retry_required ? 'retry_required' : 'rejection',
        analyst_id: analystId,
        reason: checkResult.violations.map(v => v.description).join('; '),
        rule_id: checkResult.violations[0]?.rule_id,
        timestamp: new Date(),
      };
      session.moderation_actions.push(action);

      return {
        approved: false,
        violations: checkResult.violations.map(v => v.description),
        warnings: checkResult.warnings,
      };
    }

    // Create contribution
    const contribution: DebateContribution = {
      id: this.generateContributionId(),
      debate_id: debateId,
      analyst_id: analystId,
      phase: session.current_phase,
      content,
      timestamp: new Date(),
      conviction_score: convictionScore,
      referenced_analysts: referencedAnalysts,
      constitution_violations: checkResult.violations.map(v => v.rule_id),
    };

    session.contributions.push(contribution);

    // Update analyst position
    this.updateAnalystPosition(session, analystId, content, convictionScore);

    return {
      approved: true,
      contribution,
      violations: checkResult.violations.map(v => v.description),
      warnings: checkResult.warnings,
    };
  }

  /**
   * Transition to the next debate phase
   */
  transitionPhase(
    debateId: string,
    targetPhase: DebatePhase,
    reason: string
  ): PhaseTransitionResult {
    const session = this.getDebateSession(debateId);
    if (!session) {
      throw new Error(`Debate session not found: ${debateId}`);
    }

    // Validate transition
    const validation = this.validatePhaseTransition(session, targetPhase);
    if (!validation.allowed) {
      return validation;
    }

    // Record transition
    const transition: DebatePhaseTransition = {
      from: session.current_phase,
      to: targetPhase,
      timestamp: new Date(),
      reason,
    };

    session.phase_history.push(transition);
    session.current_phase = targetPhase;

    // Special handling for phase changes
    if (targetPhase === DebatePhase.REBUTTAL && session.current_round === 0) {
      session.current_round = 1;
    } else if (
      targetPhase === DebatePhase.OPENING_STATEMENTS &&
      session.current_round > 0
    ) {
      session.current_round++;
    }

    // Check for convergence
    this.checkConvergence(session);

    return validation;
  }

  /**
   * Check if debate has converged
   */
  checkConvergence(session: DebateSession): boolean {
    if (session.positions.size < 2) {
      return false;
    }

    const positions = Array.from(session.positions.values());
    const scores = positions.map(p => p.conviction_score);

    const minScore = Math.min(...scores);
    const maxScore = Math.max(...scores);

    // Check if scores are within convergence threshold
    const converged = maxScore - minScore <= session.config.convergence_threshold;

    if (converged && session.current_phase === DebatePhase.CLOSING_ARGUMENTS) {
      session.converged = true;
      session.current_phase = DebatePhase.CONVERGENCE;
      return true;
    }

    return converged;
  }

  /**
   * Complete the debate and generate results
   */
  completeDebate(debateId: string): DebateResult {
    const session = this.getDebateSession(debateId);
    if (!session) {
      throw new Error(`Debate session not found: ${debateId}`);
    }

    session.completed_at = new Date();
    session.current_phase = DebatePhase.COMPLETED;

    const positions = Array.from(session.positions.values());

    // Get failed analysts
    const failedAnalysts = new Set<string>();
    for (const action of session.moderation_actions) {
      if (action.type === 'rejection' || action.type === 'block') {
        failedAnalysts.add(action.analyst_id);
      }
    }

    // Count constitution violations
    const constitutionViolations = session.moderation_actions.filter(
      a => a.type !== 'warning'
    ).length;

    // Generate synthesis input
    const synthesisInput = this.generateSynthesisInput(session);

    return {
      success: failedAnalysts.size === 0,
      debate_id: session.id,
      final_phase: session.phase_history[session.phase_history.length - 1]?.to ?? session.current_phase,
      total_rounds: session.current_round + 1,
      total_contributions: session.contributions.length,
      positions,
      convergence_summary: session.convergence_summary,
      failed_analysts: Array.from(failedAnalysts),
      constitution_violations: constitutionViolations,
      synthesis_input: synthesisInput,
    };
  }

  /**
   * Get debate session by ID
   */
  getDebateSession(debateId: string): DebateSession | undefined {
    return this.debates.get(debateId);
  }

  /**
   * Get all active debates for a mission
   */
  getMissionDebates(missionId: string): DebateSession[] {
    return Array.from(this.debates.values()).filter(
      d => d.mission_id === missionId && !d.completed_at
    );
  }

  /**
   * Get debate statistics
   */
  getDebateStats(debateId: string): {
    total_contributions: number;
    contributions_by_phase: Record<string, number>;
    contributions_by_analyst: Record<string, number>;
    average_conviction: number;
    conviction_range: { min: number; max: number };
    moderation_actions: number;
  } | null {
    const session = this.getDebateSession(debateId);
    if (!session) {
      return null;
    }

    const contributionsByPhase: Record<string, number> = {};
    const contributionsByAnalyst: Record<string, number> = {};

    let totalConviction = 0;
    let minConviction = 100;
    let maxConviction = 0;

    for (const contribution of session.contributions) {
      contributionsByPhase[contribution.phase] =
        (contributionsByPhase[contribution.phase] ?? 0) + 1;
      contributionsByAnalyst[contribution.analyst_id] =
        (contributionsByAnalyst[contribution.analyst_id] ?? 0) + 1;

      totalConviction += contribution.conviction_score;
      minConviction = Math.min(minConviction, contribution.conviction_score);
      maxConviction = Math.max(maxConviction, contribution.conviction_score);
    }

    return {
      total_contributions: session.contributions.length,
      contributions_by_phase: contributionsByPhase,
      contributions_by_analyst: contributionsByAnalyst,
      average_conviction: session.contributions.length > 0
        ? totalConviction / session.contributions.length
        : 0,
      conviction_range: { min: minConviction, max: maxConviction },
      moderation_actions: session.moderation_actions.length,
    };
  }

  /**
   * Validate a phase transition
   */
  private validatePhaseTransition(
    session: DebateSession,
    targetPhase: DebatePhase
  ): PhaseTransitionResult {
    const currentPhase = session.current_phase;

    // Define valid transitions
    const validTransitions: Record<DebatePhase, DebatePhase[]> = {
      [DebatePhase.INITIALIZATION]: [DebatePhase.OPENING_STATEMENTS],
      [DebatePhase.OPENING_STATEMENTS]: [
        DebatePhase.REBUTTAL,
        DebatePhase.CLOSING_ARGUMENTS,
      ],
      [DebatePhase.REBUTTAL]: [
        DebatePhase.CROSS_EXAMINATION,
        DebatePhase.CLOSING_ARGUMENTS,
      ],
      [DebatePhase.CROSS_EXAMINATION]: [
        DebatePhase.REBUTTAL,
        DebatePhase.CLOSING_ARGUMENTS,
      ],
      [DebatePhase.CLOSING_ARGUMENTS]: [
        DebatePhase.CONVERGENCE,
        DebatePhase.COMPLETED,
      ],
      [DebatePhase.CONVERGENCE]: [DebatePhase.COMPLETED],
      [DebatePhase.COMPLETED]: [],
    };

    const allowedTargets = validTransitions[currentPhase] ?? [];

    if (!allowedTargets.includes(targetPhase)) {
      return {
        allowed: false,
        reason: `Cannot transition from ${currentPhase} to ${targetPhase}`,
      };
    }

    // Check round limits
    if (targetPhase === DebatePhase.REBUTTAL) {
      if (session.current_round >= session.config.max_rounds) {
        return {
          allowed: false,
          reason: 'Maximum rounds reached',
          requirements_missing: ['Round limit'],
        };
      }
    }

    return {
      allowed: true,
      next_phase: targetPhase,
      requirements_met: ['Phase transition valid'],
    };
  }

  /**
   * Check contribution against constitution rules
   */
  private async checkConstitutionRules(
    session: DebateSession,
    analystId: string,
    content: string
  ): Promise<ContributionCheckResult> {
    if (!this.enabled) {
      return {
        approved: true,
        violations: [],
        warnings: [],
        retry_required: false,
      };
    }

    const context: RuleContext = {
      agent_id: analystId,
      mission_id: session.mission_id,
      output: {
        debate_phase: session.current_phase,
        contribution: content,
      },
    };

    const result: OutputCheckResult = await this.constitutionEnforcer.checkViolations(
      session.config.domain,
      analystId,
      context
    );

    return {
      approved: result.approved,
      violations: result.violations.map(v => ({
        rule_id: v.rule_id,
        description: v.description,
        enforcement: v.severity,
      })),
      warnings: result.warnings,
      retry_required: result.retry_required,
    };
  }

  /**
   * Update analyst position based on contribution
   */
  private updateAnalystPosition(
    session: DebateSession,
    analystId: string,
    content: string,
    convictionScore: number
  ): void {
    const position = session.positions.get(analystId);
    if (!position) {
      return;
    }

    // Update conviction
    position.conviction_score = convictionScore;
    position.conviction = this.determineConvictionLevel(convictionScore);

    // Add to key arguments (simplified - in real implementation, use NLP)
    const sentences = content.split('.').filter(s => s.trim().length > 0);
    if (sentences.length > 0) {
      position.key_arguments.push(...sentences.slice(0, 2));
    }
  }

  /**
   * Determine conviction level from score
   */
  private determineConvictionLevel(score: number): ConvictionLevel {
    for (const [level, thresholds] of Object.entries(CONVICTION_THRESHOLDS)) {
      // For very_high, include the max value
      if (level === 'VERY_HIGH' && score >= thresholds.min && score <= thresholds.max) {
        return level as ConvictionLevel;
      }
      // For other levels, upper bound is exclusive
      if (score >= thresholds.min && score < thresholds.max) {
        return level as ConvictionLevel;
      }
    }
    return ConvictionLevel.MODERATE;
  }

  /**
   * Generate synthesis input from completed debate
   */
  private generateSynthesisInput(session: DebateSession): DebateSynthesisInput {
    const positions = Array.from(session.positions.values());

    // Find consensus and disagreements
    const bullishPositions = positions.filter(p => p.stance === 'bullish');
    const bearishPositions = positions.filter(p => p.stance === 'bearish');

    const keyDisagreements: Array<{
      topic: string;
      bullish_view: string;
      bearish_view: string;
    }> = [];

    // Simplified disagreement extraction
    if (bullishPositions.length > 0 && bearishPositions.length > 0) {
      const bullishArgs = bullishPositions.flatMap(p => p.key_arguments);
      const bearishArgs = bearishPositions.flatMap(p => p.key_arguments);

      // Pair up opposing arguments (simplified)
      const maxPairs = Math.min(bullishArgs.length, bearishArgs.length);
      for (let i = 0; i < maxPairs; i++) {
        keyDisagreements.push({
          topic: `Argument ${i + 1}`,
          bullish_view: bullishArgs[i],
          bearish_view: bearishArgs[i],
        });
      }
    }

    // Calculate conviction distribution
    const scores = positions.map(p => p.conviction_score);
    const convictionDistribution = {
      average: scores.reduce((a, b) => a + b, 0) / scores.length,
      min: Math.min(...scores),
      max: Math.max(...scores),
      analyst_scores: positions.map(p => ({
        analyst: p.analyst_id,
        score: p.conviction_score,
      })),
    };

    return {
      mission_id: session.mission_id,
      debate_id: session.id,
      final_positions: positions,
      key_consensus_points: [], // Would be derived from actual analysis
      key_disagreements: keyDisagreements,
      conviction_distribution: convictionDistribution,
      total_contributions: session.contributions.length,
    };
  }

  /**
   * Generate a unique debate ID
   */
  private generateDebateId(): string {
    return `debate-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Generate a unique contribution ID
   */
  private generateContributionId(): string {
    return `contrib-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Clear all debate sessions
   */
  clear(): void {
    this.debates.clear();
  }

  /**
   * Check if controller is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Enable or disable the controller
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }
}

/**
 * Create a debate controller instance
 */
export function createDebateController(options?: {
  constitutionEnforcer?: ConstitutionEnforcer;
  enabled?: boolean;
}): DebateController {
  return new DebateController(options);
}
