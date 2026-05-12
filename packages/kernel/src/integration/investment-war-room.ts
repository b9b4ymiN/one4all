/**
 * Investment War Room Integration
 *
 * Wires together Evidence Controller, Debate Controller,
 * Synthesis Engine, and Report Generator for full workflow
 */

import type { Brief, Mission, MissionState } from '../state-machine/types.js';
import type { EvidencePack, EvidenceController } from '../evidence-controller/index.js';
import type { DebateConfig, DebateSession, DebateResult } from '../debate-controller/index.js';
import type { SynthesisInput, SynthesisOutput } from '../synthesis/index.js';
import type { InvestmentReport, ReportFormat } from '../report/index.js';

import { EvidenceController, createEvidenceController } from '../evidence-controller/index.js';
import { DebateController, createDebateController, DebatePhase } from '../debate-controller/index.js';
import { SynthesisEngine } from '../synthesis/index.js';
import { ReportGenerator } from '../report/index.js';

/**
 * Investment War Room configuration
 */
export interface InvestmentWarRoomConfig {
  domain: string;
  participants: string[];
  evidence_sources: string[];
  debate_config: Partial<DebateConfig>;
  report_format: ReportFormat;
}

/**
 * Analysis workflow result
 */
export interface AnalysisResult {
  success: boolean;
  mission: Mission;
  evidence_pack?: EvidencePack;
  debate_result?: DebateResult;
  synthesis?: SynthesisOutput;
  report?: InvestmentReport;
  errors: string[];
  warnings: string[];
}

/**
 * Investment War Room Orchestrator
 *
 * Coordinates the full investment analysis workflow:
 * 1. Evidence gathering and scoring
 * 2. Multi-analyst debate with constitution enforcement
 * 3. Synthesis of conflicting views
 * 4. Report generation
 */
export class InvestmentWarRoom {
  private evidenceController: EvidenceController;
  private debateController: DebateController;
  private synthesisEngine: SynthesisEngine;
  private reportGenerator: ReportGenerator;
  private config: InvestmentWarRoomConfig;

  constructor(config: InvestmentWarRoomConfig) {
    this.config = config;

    // Initialize controllers
    this.evidenceController = createEvidenceController({
      domain: config.domain,
      enableSourceTiering: true,
      enableScoring: true,
    });

    this.debateController = createDebateController({
      enabled: true,
    });

    this.synthesisEngine = new SynthesisEngine({
      consensus_threshold: 0.6,
    });

    this.reportGenerator = new ReportGenerator({
      default_format: config.report_format,
    });
  }

  /**
   * Execute full analysis workflow
   */
  async executeAnalysis(mission: Mission): Promise<AnalysisResult> {
    const result: AnalysisResult = {
      success: false,
      mission,
      errors: [],
      warnings: [],
    };

    try {
      // Step 1: Build Evidence Pack
      const evidenceResult = await this.buildEvidencePack(mission);
      result.evidence_pack = evidenceResult.evidence_pack;
      result.warnings.push(...evidenceResult.warnings);

      if (!evidenceResult.success) {
        result.errors.push(...evidenceResult.errors);
        return result;
      }

      // Step 2: Run Debate
      const debateResult = await this.runDebate(mission, evidenceResult.evidence_pack!);
      result.debate_result = debateResult.debate_result;
      result.warnings.push(...debateResult.warnings);

      if (!debateResult.success) {
        result.errors.push(...debateResult.errors);
        return result;
      }

      // Step 3: Synthesize
      const synthesisResult = await this.synthesizeResults(mission, debateResult.debate_result!);
      result.synthesis = synthesisResult.synthesis;
      result.warnings.push(...synthesisResult.warnings);

      if (!synthesisResult.success) {
        result.errors.push(...synthesisResult.errors);
        return result;
      }

      // Step 4: Generate Report
      const reportResult = await this.generateReport(mission, synthesisResult.synthesis!);
      result.report = reportResult.report;
      result.warnings.push(...reportResult.warnings);

      if (!reportResult.success) {
        result.errors.push(...reportResult.errors);
        return result;
      }

      result.success = true;
      return result;
    } catch (error) {
      result.errors.push(`Unexpected error: ${error instanceof Error ? error.message : String(error)}`);
      return result;
    }
  }

  /**
   * Step 1: Build Evidence Pack
   */
  private async buildEvidencePack(mission: Mission): Promise<{
    success: boolean;
    evidence_pack?: EvidencePack;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const packResult = await this.evidenceController.buildPack({
        mission_id: mission.id,
        domain: this.config.domain,
        sources: this.config.evidence_sources,
        max_sources_per_tier: 10,
        require_tier_1_for_key_claims: true,
      });

      if (!packResult.pack) {
        errors.push('Failed to build evidence pack');
        return { success: false, errors, warnings };
      }

      warnings.push(...packResult.warnings);
      return {
        success: true,
        evidence_pack: packResult.pack,
        errors,
        warnings,
      };
    } catch (error) {
      errors.push(`Evidence pack build failed: ${error instanceof Error ? error.message : String(error)}`);
      return { success: false, errors, warnings };
    }
  }

  /**
   * Step 2: Run Debate
   */
  private async runDebate(mission: Mission, evidencePack: EvidencePack): Promise<{
    success: boolean;
    debate_result?: DebateResult;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Create debate session
      const debateConfig: DebateConfig = {
        mission_id: mission.id,
        domain: this.config.domain,
        participating_analysts: this.config.participants,
        ...this.config.debate_config,
      };

      const session = this.debateController.createDebate(debateConfig);

      // Initialize positions based on evidence pack
      const initialPositions = this.config.participants.map(analystId => ({
        analyst_id: analystId,
        stance: this.assignInitialStance(analystId),
        thesis_summary: `Initial position based on ${evidencePack.items.length} evidence items`,
        conviction_score: 50,
      }));

      this.debateController.initializePositions(session.id, initialPositions);

      // Run debate phases
      await this.runDebatePhases(session, evidencePack);

      // Complete debate
      const debateResult = this.debateController.completeDebate(session.id);

      warnings.push(...debateResult.failed_analysts.map(a => `Analyst ${a} failed during debate`));

      return {
        success: debateResult.success,
        debate_result: debateResult,
        errors,
        warnings,
      };
    } catch (error) {
      errors.push(`Debate failed: ${error instanceof Error ? error.message : String(error)}`);
      return { success: false, errors, warnings };
    }
  }

  /**
   * Run debate phases with evidence context
   */
  private async runDebatePhases(session: DebateSession, evidencePack: EvidencePack): Promise<void> {
    // Opening Statements
    this.debateController.transitionPhase(session.id, DebatePhase.OPENING_STATEMENTS, 'Begin opening statements');

    for (const analystId of this.config.participants) {
      const topEvidence = evidencePack.items.slice(0, 3).map(e => e.content).join('; ');
      await this.debateController.submitContribution(
        session.id,
        analystId,
        `Opening statement based on evidence: ${topEvidence}`,
        70
      );
    }

    // Rebuttal rounds
    for (let round = 0; round < 2; round++) {
      this.debateController.transitionPhase(session.id, DebatePhase.REBUTTAL, `Round ${round + 1}`);

      for (const analystId of this.config.participants) {
        const otherAnalysts = this.config.participants.filter(a => a !== analystId);
        await this.debateController.submitContribution(
          session.id,
          analystId,
          `Rebuttal to ${otherAnalysts[0]}`,
          65,
          otherAnalysts.slice(0, 1)
        );
      }
    }

    // Closing Arguments
    this.debateController.transitionPhase(session.id, DebatePhase.CLOSING_ARGUMENTS, 'Final statements');

    for (const analystId of this.config.participants) {
      await this.debateController.submitContribution(
        session.id,
        analystId,
        'Closing argument and final conviction',
        75
      );
    }
  }

  /**
   * Assign initial stance to analyst
   */
  private assignInitialStance(analystId: string): 'bullish' | 'bearish' | 'neutral' {
    const bullish = ['damodaran-valuation', 'leveraged-franchise', 'allocator-steward'];
    const bearish = ['downside-protection', 'michael-burry', 'seth-klarman'];

    if (bullish.includes(analystId)) return 'bullish';
    if (bearish.includes(analystId)) return 'bearish';
    return 'neutral';
  }

  /**
   * Step 3: Synthesize Results
   */
  private async synthesizeResults(mission: Mission, debateResult: DebateResult): Promise<{
    success: boolean;
    synthesis?: SynthesisOutput;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const synthesisInput: SynthesisInput = {
        mission_id: mission.id,
        domain: this.config.domain,
        analyst_outputs: debateResult.positions.map(p => ({
          analyst_id: p.analyst_id,
          stance: p.stance,
          conviction_score: p.conviction_score,
          thesis_summary: p.thesis_summary,
          key_arguments: p.key_arguments,
          fair_value_estimate: 100, // Would be extracted from actual output
          what_would_change_my_mind: 'Data gaps identified',
        })),
        debate_summary: debateResult.synthesis_input,
        evidence_summary: {
          total_items: debateResult.total_contributions,
          tier_1_count: debateResult.total_contributions, // Placeholder
          average_score: 0.7,
        },
      };

      const synthesis = await this.synthesisEngine.synthesize(synthesisInput);

      return {
        success: true,
        synthesis,
        errors,
        warnings,
      };
    } catch (error) {
      errors.push(`Synthesis failed: ${error instanceof Error ? error.message : String(error)}`);
      return { success: false, errors, warnings };
    }
  }

  /**
   * Step 4: Generate Report
   */
  private async generateReport(mission: Mission, synthesis: SynthesisOutput): Promise<{
    success: boolean;
    report?: InvestmentReport;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const report = await this.reportGenerator.generate({
        mission_id: mission.id,
        brief: mission.state.brief!,
        synthesis,
        format: this.config.report_format,
      });

      return {
        success: true,
        report,
        errors,
        warnings,
      };
    } catch (error) {
      errors.push(`Report generation failed: ${error instanceof Error ? error.message : String(error)}`);
      return { success: false, errors, warnings };
    }
  }

  /**
   * Get evidence pack for a mission
   */
  getEvidencePack(missionId: string): EvidencePack | undefined {
    return this.evidenceController.getPack(missionId);
  }

  /**
   * Get debate session for a mission
   */
  getDebateSession(missionId: string): DebateSession | undefined {
    return this.debateController.getDebateSession(missionId);
  }

  /**
   * Get debate statistics
   */
  getDebateStats(missionId: string) {
    return this.debateController.getDebateStats(missionId);
  }

  /**
   * Clear all sessions
   */
  clear(): void {
    this.evidenceController.clearAllPacks();
    this.debateController.clear();
  }
}

/**
 * Create an Investment War Room orchestrator
 */
export function createInvestmentWarRoom(config: InvestmentWarRoomConfig): InvestmentWarRoom {
  return new InvestmentWarRoom(config);
}
