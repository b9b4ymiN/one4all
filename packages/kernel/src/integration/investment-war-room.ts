/**
 * Investment War Room Integration
 *
 * Wires together Evidence Controller, Debate Controller,
 * Synthesis Engine, and Report Generator for full workflow
 */

import type { Brief, Mission, MissionState } from '../state-machine/types.js';
import type {
  EvidencePack,
  EvidenceControllerConfig,
} from '../evidence-controller/index.js';
import type {
  DebateConfig,
  DebateSession,
  DebateResult,
} from '../debate-controller/index.js';
import type {
  SynthesisInput,
  SynthesisOutput,
  SynthesisConfig,
  AnalystOutput,
} from '../synthesis/index.js';
import type {
  InvestmentReport,
  ReportFormat,
  ReportGeneratorOptions,
} from '../report/index.js';

import { createEvidenceController } from '../evidence-controller/index.js';
import { createDebateController, DebatePhase } from '../debate-controller/index.js';
import { SynthesisEngine } from '../synthesis/index.js';
import { ReportGenerator } from '../report/index.js';

/**
 * Investment War Room configuration
 */
export interface InvestmentWarRoomConfig {
  domain: string;
  participants: string[];
  evidence_sources: string[];
  debate_config: Omit<DebateConfig, 'mission_id' | 'domain' | 'participating_analysts'>;
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
  private evidenceController: ReturnType<typeof createEvidenceController>;
  private debateController: ReturnType<typeof createDebateController>;
  private synthesisEngine: SynthesisEngine;
  private reportGenerator: ReportGenerator;
  private config: InvestmentWarRoomConfig;

  constructor(config: InvestmentWarRoomConfig) {
    this.config = config;

    // Initialize controllers with correct config structures
    const evidenceConfig: EvidenceControllerConfig = {
      builderOptions: {
        maxSourcesPerTier: { 1: 10, 2: 5, 3: 3 },
      },
      scorerConfig: {
        weights: {
          tier: 0.4,
          recency: 0.2,
          relevance: 0.3,
          diversity: 0.05,
          verification: 0.05,
        },
        recencyDecayDays: 365,
        boostVerifiedSources: true,
        diversityWindowDays: 90,
      },
    };
    this.evidenceController = createEvidenceController(evidenceConfig);

    this.debateController = createDebateController({
      enabled: true,
    });

    const synthesisConfig: Partial<SynthesisConfig> = {
      conviction_thresholds: {
        reject: 3,
        watch: 4,
        research_more: 5,
        wait_for_price: 6,
        starter_position: 7,
        core_candidate: 8,
      },
      mos_percentages: {
        conservative: 30,
        base: 20,
        mos_30: 30,
      },
      evidence_thresholds: {
        very_high: 80,
        high: 60,
        moderate: 40,
        low: 20,
      },
      constitution_strict: true,
    };
    this.synthesisEngine = new SynthesisEngine(synthesisConfig);

    // ReportGenerator takes ReportTemplate in constructor, format in generate()
    this.reportGenerator = new ReportGenerator(); // Use default template
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
      // Convert evidence_sources string array to source objects
      const sources = this.config.evidence_sources.map(s => {
        const parts = s.split(':');
        return {
          type: parts[0] || 'other',
          identifier: parts[1] || s,
          url: parts[2],
        };
      });

      const packResult = await this.evidenceController.buildPack(
        mission.id,
        `${mission.state.brief?.ticker || 'Unknown'} Analysis`,
        sources
      );

      if (!packResult.pack) {
        errors.push('Failed to build evidence pack');
        return { success: false, errors, warnings };
      }

      // Add warnings for any fetch errors
      warnings.push(...packResult.errors.map(e => `Source fetch failed: ${e.source} - ${e.error}`));

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
      // Create debate session with required fields
      const debateConfig: DebateConfig = {
        mission_id: mission.id,
        domain: this.config.domain,
        participating_analysts: this.config.participants,
        max_rounds: this.config.debate_config.max_rounds ?? 3,
        max_contributions_per_round: this.config.debate_config.max_contributions_per_round ?? 2,
        convergence_threshold: this.config.debate_config.convergence_threshold ?? 0.7,
        timeout_ms: this.config.debate_config.timeout_ms ?? 300000,
        constitution_strict: this.config.debate_config.constitution_strict ?? false,
      };

      const session = this.debateController.createDebate(debateConfig);

      // Initialize positions based on evidence pack
      const initialPositions = this.config.participants.map(analystId => ({
        analyst_id: analystId,
        stance: this.assignInitialStance(analystId),
        conviction_score: 50,
        key_arguments: [] as string[],
        evidence_references: [] as string[],
        thesis_summary: `Initial position based on ${evidencePack.items.length} evidence items`,
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
      const topEvidence = evidencePack.items.slice(0, 3).map(e => e.context).join('; ');
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
      // Map debate positions to full AnalystOutput interface
      const analystOutputs: AnalystOutput[] = debateResult.positions.map(p => ({
        analyst_id: p.analyst_id,
        analyst_name: this.getAnalystDisplayName(p.analyst_id),
        role: this.getAnalystRole(p.analyst_id),
        stance: p.stance,
        conviction: Math.round(p.conviction_score / 10), // Convert 0-100 to 1-10
        fair_value_method: 'Debate consensus',
        thesis_summary: p.thesis_summary,
        key_positives: [],
        key_negatives: [],
        thesis_breakers: [],
        follow_up_events: [],
        data_gaps: [],
        completed_at: new Date(),
      }));

      const synthesisInput: SynthesisInput = {
        mission_id: mission.id,
        domain: this.config.domain,
        subject: {
          type: mission.state.brief?.type || 'stock_analysis',
          ticker: mission.state.brief?.ticker,
        },
        analyst_outputs: analystOutputs,
        evidence_summary: {
          total_sources: 0, // Would come from evidence pack
          tier_counts: { 1: 0, 2: 0, 3: 0 },
          items_extracted: debateResult.total_contributions,
        },
        market_data: {
          current_price: 100, // Would come from market data adapter
          as_of_date: new Date(),
        },
        mission_started: new Date(),
        constitution_rules: [],
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
   * Get display name for analyst
   */
  private getAnalystDisplayName(analystId: string): string {
    const names: Record<string, string> = {
      'damodaran-valuation': 'Damodaran',
      'seth-klarman': 'Seth Klarman',
      'devil-advocate': 'Devil\'s Advocate',
      'portfolio-manager': 'Portfolio Manager',
    };
    return names[analystId] || analystId;
  }

  /**
   * Get role for analyst
   */
  private getAnalystRole(analystId: string): 'valuation' | 'downside' | 'growth' | 'technical' | 'portfolio' {
    const roles: Record<string, 'valuation' | 'downside' | 'growth' | 'technical' | 'portfolio'> = {
      'damodaran-valuation': 'valuation',
      'seth-klarman': 'downside',
      'devil-advocate': 'downside',
      'portfolio-manager': 'portfolio',
    };
    return roles[analystId] || 'valuation';
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
      // ReportGenerator.generate takes synthesis first, then options
      const report = this.reportGenerator.generate(synthesis, {
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
