/**
 * Synthesis Engine (CIO)
 *
 * Combines analyst outputs into a final investment decision
 * Acts as the Chief Investment Officer role
 */

import type {
  AnalystOutput,
  SynthesisInput,
  SynthesisOutput,
  SynthesisConfig,
  DecisionDetermination,
  ConsensusAnalysis,
  EvidenceAssessment,
} from './types.js';
import type { DecisionState } from '../journal-writer/types.js';

/**
 * Default synthesis configuration
 */
const DEFAULT_CONFIG: SynthesisConfig = {
  conviction_thresholds: {
    reject: 3,
    watch: 4,
    research_more: 5,
    wait_for_price: 6,
    starter_position: 7,
    core_candidate: 8,
  },
  mos_percentages: {
    conservative: 30, // 30% below fair value
    base: 20, // 20% below fair value
    mos_30: 30, // Explicit 30% MOS price
  },
  evidence_thresholds: {
    very_high: 80,
    high: 65,
    moderate: 50,
    low: 35,
  },
  constitution_strict: true,
};

/**
 * Synthesis Engine - CIO role
 */
export class SynthesisEngine {
  private config: SynthesisConfig;

  constructor(config: Partial<SynthesisConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Main synthesis method - combine analyst outputs into final decision
   */
  synthesize(input: SynthesisInput): SynthesisOutput {
    const consensus = this.analyzeConsensus(input.analyst_outputs);
    const evidenceAssessment = this.assessEvidence(input);
    const decision = this.determineDecisionState(
      input,
      consensus,
      evidenceAssessment
    );

    const valuation = this.calculateFinalValuation(
      input.analyst_outputs,
      input.market_data.current_price
    );

    const assumptions = this.extractKeyAssumptions(input.analyst_outputs);
    const analystViews = this.summarizeAnalystViews(input.analyst_outputs);
    const thesisBreakers = this.compileThesisBreakers(input.analyst_outputs);
    const followUpEvents = this.compileFollowUpEvents(input.analyst_outputs);
    const dissentNotes = this.preserveDissent(input.analyst_outputs, consensus);

    return {
      mission_id: input.mission_id,
      synthesized_at: new Date(),

      decision_state: decision.state,
      conviction_level: decision.conviction,
      rationale_summary: decision.reason,

      valuation,
      assumptions,
      evidence_quality: {
        score: evidenceAssessment.overall_score,
        tier1_sources: evidenceAssessment.tier1_sources,
        tier2_sources: evidenceAssessment.tier2_sources,
        tier3_sources: evidenceAssessment.tier3_sources,
        data_gaps: evidenceAssessment.data_gaps,
      },

      analyst_views: analystViews,
      thesis_breakers: thesisBreakers,
      follow_up_events: followUpEvents,

      consensus_analysis: consensus,
      evidence_assessment: evidenceAssessment,

      dissent_notes: dissentNotes,
    };
  }

  /**
   * Analyze consensus across analyst outputs
   */
  private analyzeConsensus(outputs: AnalystOutput[]): ConsensusAnalysis {
    if (outputs.length === 0) {
      return {
        stance_distribution: { bullish: 0, bearish: 0, neutral: 0 },
        average_conviction: 0,
        conviction_variance: 0,
        valuation_consensus: {
          fair_values: [],
          average_fair_value: 0,
          median_fair_value: 0,
          min_fair_value: 0,
          max_fair_value: 0,
          standard_deviation: 0,
        },
        key_agreements: [],
        key_disagreements: [],
      };
    }

    // Stance distribution
    const stance_distribution = {
      bullish: outputs.filter((o) => o.stance === 'bullish').length,
      bearish: outputs.filter((o) => o.stance === 'bearish').length,
      neutral: outputs.filter((o) => o.stance === 'neutral').length,
    };

    // Conviction stats
    const convictions = outputs.map((o) => o.conviction);
    const average_conviction = average(convictions);
    const conviction_variance =
      convictions.reduce((sum, c) => sum + Math.pow(c - average_conviction, 2), 0) /
      convictions.length;

    // Valuation consensus
    const fairValues = outputs
      .filter((o) => o.fair_value !== undefined)
      .map((o) => o.fair_value!);

    const valuation_consensus = {
      fair_values: fairValues,
      average_fair_value: fairValues.length > 0 ? average(fairValues) : 0,
      median_fair_value: fairValues.length > 0 ? median(fairValues) : 0,
      min_fair_value: fairValues.length > 0 ? Math.min(...fairValues) : 0,
      max_fair_value: fairValues.length > 0 ? Math.max(...fairValues) : 0,
      standard_deviation: fairValues.length > 1 ? standardDeviation(fairValues) : 0,
    };

    // Find agreements and disagreements
    const { key_agreements, key_disagreements } = this.findAgreementsAndDisagreements(
      outputs
    );

    return {
      stance_distribution,
      average_conviction,
      conviction_variance,
      valuation_consensus,
      key_agreements,
      key_disagreements,
    };
  }

  /**
   * Find key agreements and disagreements across analysts
   */
  private findAgreementsAndDisagreements(outputs: AnalystOutput[]): {
    key_agreements: string[];
    key_disagreements: Array<{
      topic: string;
      bullish_view: { analyst: string; view: string };
      bearish_view: { analyst: string; view: string };
    }>;
  } {
    const key_agreements: string[] = [];
    const key_disagreements: Array<{
      topic: string;
      bullish_view: { analyst: string; view: string };
      bearish_view: { analyst: string; view: string };
    }> = [];

    // Group analysts by stance
    const bullish = outputs.filter((o) => o.stance === 'bullish');
    const bearish = outputs.filter((o) => o.stance === 'bearish');

    if (bullish.length > 0 && bearish.length > 0) {
      // Find common positives mentioned by bullish analysts
      const bullishPositives = new Map<string, number>();
      for (const analyst of bullish) {
        for (const positive of analyst.key_positives) {
          bullishPositives.set(
            positive,
            (bullishPositives.get(positive) || 0) + 1
          );
        }
      }

      // Find common negatives mentioned by bearish analysts
      const bearishNegatives = new Map<string, number>();
      for (const analyst of bearish) {
        for (const negative of analyst.key_negatives) {
          bearishNegatives.set(
            negative,
            (bearishNegatives.get(negative) || 0) + 1
          );
        }
      }

      // Add as agreements if mentioned by multiple analysts
      for (const [point, count] of bullishPositives) {
        if (count >= 2) {
          key_agreements.push(`Bullish consensus: ${point}`);
        }
      }

      for (const [point, count] of bearishNegatives) {
        if (count >= 2) {
          key_agreements.push(`Bearish consensus: ${point}`);
        }
      }

      // Find disagreements by matching opposing views
      for (const bull of bullish) {
        for (const bear of bearish) {
          // Check for similar topics with opposing views
          for (const bullPoint of bull.key_positives) {
            for (const bearPoint of bear.key_negatives) {
              if (this.topicsAreSimilar(bullPoint, bearPoint)) {
                key_disagreements.push({
                  topic: bullPoint,
                  bullish_view: { analyst: bull.analyst_name, view: bullPoint },
                  bearish_view: { analyst: bear.analyst_name, view: bearPoint },
                });
              }
            }
          }
        }
      }
    }

    return { key_agreements, key_disagreements };
  }

  /**
   * Check if two topic strings are semantically similar
   */
  private topicsAreSimilar(topic1: string, topic2: string): boolean {
    const words1 = new Set(topic1.toLowerCase().split(/\s+/));
    const words2 = new Set(topic2.toLowerCase().split(/\s+/));

    const intersection = new Set([...words1].filter((x) => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size > 0.3;
  }

  /**
   * Assess evidence quality
   */
  private assessEvidence(input: SynthesisInput): EvidenceAssessment {
    const { evidence_summary } = input;

    // Calculate tier counts
    const tier1_sources = evidence_summary.tier_counts[1] || 0;
    const tier2_sources = evidence_summary.tier_counts[2] || 0;
    const tier3_sources = evidence_summary.tier_counts[3] || 0;
    const tier4_sources = evidence_summary.tier_counts[4] || 0;

    // Calculate overall score
    // Tier 1: 10 points each, Tier 2: 5, Tier 3: 2, Tier 4: 1
    const raw_score =
      tier1_sources * 10 + tier2_sources * 5 + tier3_sources * 2 + tier4_sources;

    // Normalize to 0-100, cap at 100
    const overall_score = Math.min(100, raw_score);

    // Gather data gaps from all analysts
    const data_gaps = new Set<string>();
    const unresolved_questions: string[] = [];

    for (const output of input.analyst_outputs) {
      for (const gap of output.data_gaps) {
        data_gaps.add(gap);
      }
    }

    // Determine evidence confidence
    let evidence_confidence: EvidenceAssessment['evidence_confidence'];
    if (overall_score >= this.config.evidence_thresholds.very_high) {
      evidence_confidence = 'very_high';
    } else if (overall_score >= this.config.evidence_thresholds.high) {
      evidence_confidence = 'high';
    } else if (overall_score >= this.config.evidence_thresholds.moderate) {
      evidence_confidence = 'moderate';
    } else if (overall_score >= this.config.evidence_thresholds.low) {
      evidence_confidence = 'low';
    } else {
      evidence_confidence = 'very_low';
    }

    return {
      overall_score,
      tier1_sources,
      tier2_sources,
      tier3_sources,
      tier4_sources,
      data_gaps: Array.from(data_gaps),
      unresolved_questions,
      evidence_confidence,
    };
  }

  /**
   * Determine the final decision state
   */
  private determineDecisionState(
    input: SynthesisInput,
    consensus: ConsensusAnalysis,
    evidenceAssessment: EvidenceAssessment
  ): DecisionDetermination {
    const currentPrice = input.market_data.current_price;
    const avgFairValue = consensus.valuation_consensus.average_fair_value;
    const avgConviction = consensus.average_conviction;

    const caveats: string[] = [];
    let state: DecisionState;
    let reason: string;

    // First, check if evidence quality is too low
    if (evidenceAssessment.evidence_confidence === 'very_low') {
      state = 'REJECT';
      reason = 'Insufficient evidence quality to make any investment decision';
      caveats.push('Evidence quality below minimum threshold');
      return {
        state,
        reason,
        conviction: 1,
        caveats,
      };
    }

    if (evidenceAssessment.evidence_confidence === 'low') {
      state = 'RESEARCH_MORE';
      reason = 'Need higher quality evidence before making decision';
      caveats.push('Evidence quality suggests more research needed');
      return {
        state,
        reason,
        conviction: Math.max(1, Math.floor(avgConviction * 0.5)),
        caveats,
      };
    }

    // Check conviction thresholds
    if (avgConviction < this.config.conviction_thresholds.reject) {
      state = 'REJECT';
      reason = 'Overall analyst conviction too low for investment';
      caveats.push(`Average conviction: ${avgConviction.toFixed(1)}/10`);
    } else if (avgConviction < this.config.conviction_thresholds.watch) {
      state = 'WATCH';
      reason = 'Low conviction - keep on watchlist but do not invest';
    } else if (avgConviction < this.config.conviction_thresholds.research_more) {
      state = 'RESEARCH_MORE';
      reason = 'Moderate conviction - requires more research';
    } else {
      // Conviction is sufficient, now check valuation
      const conservativePrice =
        avgFairValue * (1 - this.config.mos_percentages.conservative / 100);

      if (currentPrice > conservativePrice) {
        // Price is too high - wait or watch
        if (avgConviction >= this.config.conviction_thresholds.starter_position) {
          state = 'WAIT_FOR_PRICE';
          reason = `Strong thesis but current price (${currentPrice}) above conservative target (${conservativePrice.toFixed(0)})`;
        } else {
          state = 'WATCH';
          reason = `Price elevated and conviction moderate - keep on watchlist`;
        }
      } else if (currentPrice <= conservativePrice * 0.9) {
        // Great price - consider position
        if (avgConviction >= this.config.conviction_thresholds.core_candidate) {
          state = 'CORE_CANDIDATE';
          reason = `Excellent price and high conviction - core position candidate`;
        } else if (avgConviction >= this.config.conviction_thresholds.starter_position) {
          state = 'STARTER_POSITION';
          reason = `Good price with solid conviction - starter position appropriate`;
        } else {
          state = 'WAIT_FOR_PRICE';
          reason = `Good price but conviction suggests waiting for more evidence`;
        }
      } else {
        // Price in acceptable range
        if (avgConviction >= this.config.conviction_thresholds.starter_position) {
          state = 'STARTER_POSITION';
          reason = `Fair value with good conviction - starter position appropriate`;
        } else {
          state = 'WATCH';
          reason = `Fair valuation but conviction moderate - keep watching`;
        }
      }
    }

    // Add caveats based on consensus dispersion
    if (consensus.valuation_consensus.standard_deviation > avgFairValue * 0.2) {
      caveats.push('High variance in analyst valuations');
    }

    if (consensus.stance_distribution.bullish === consensus.stance_distribution.bearish) {
      caveats.push('Analysts evenly split on direction');
    }

    // Add caveats based on evidence gaps
    if (evidenceAssessment.data_gaps.length > 0) {
      caveats.push(`${evidenceAssessment.data_gaps.length} data gaps identified`);
    }

    return {
      state,
      reason,
      conviction: Math.round(avgConviction),
      caveats,
    };
  }

  /**
   * Calculate final valuation from analyst outputs
   */
  private calculateFinalValuation(
    outputs: AnalystOutput[],
    currentPrice: number
  ): SynthesisOutput['valuation'] {
    const fairValues = outputs
      .filter((o) => o.fair_value !== undefined)
      .map((o) => o.fair_value!);

    if (fairValues.length === 0) {
      return {
        conservative: currentPrice,
        base: currentPrice,
        mos_30: currentPrice * 0.7,
        price_to_watch: currentPrice * 1.1,
        method: 'No valuation data available',
      };
    }

    const avgFairValue = average(fairValues);
    const conservative = avgFairValue * (1 - this.config.mos_percentages.conservative / 100);
    const base = avgFairValue * (1 - this.config.mos_percentages.base / 100);
    const mos_30 = avgFairValue * (1 - this.config.mos_percentages.mos_30 / 100);
    const price_to_watch = avgFairValue * 1.1; // 10% above fair value

    return {
      conservative: Math.round(conservative),
      base: Math.round(base),
      mos_30: Math.round(mos_30),
      price_to_watch: Math.round(price_to_watch),
      method: `Weighted average of ${fairValues.length} analyst valuations`,
    };
  }

  /**
   * Extract key assumptions from analyst outputs
   */
  private extractKeyAssumptions(outputs: AnalystOutput[]): SynthesisOutput['assumptions'] {
    const assumptions: SynthesisOutput['assumptions'] = {
      other_assumptions: {},
    };

    // Collect normalized earnings
    const earnings = outputs
      .filter((o) => o.normalized_earnings !== undefined)
      .map((o) => o.normalized_earnings!);
    if (earnings.length > 0) {
      assumptions.normalized_earnings = average(earnings);
    }

    // Collect growth rates
    const growthRates = outputs
      .filter((o) => o.growth_rate_y1_y5 !== undefined)
      .map((o) => o.growth_rate_y1_y5!);
    if (growthRates.length > 0) {
      assumptions.revenue_growth_y1_y5 = average(growthRates);
    }

    // Collect discount rates
    const discountRates = outputs
      .filter((o) => o.discount_rate !== undefined)
      .map((o) => o.discount_rate!);
    if (discountRates.length > 0) {
      assumptions.wacc = average(discountRates);
    }

    // Collect terminal growth rates
    const terminalRates = outputs
      .filter((o) => o.terminal_growth !== undefined)
      .map((o) => o.terminal_growth!);
    if (terminalRates.length > 0) {
      assumptions.terminal_growth = average(terminalRates);
    }

    // Find operating margin target from any analyst
    for (const output of outputs) {
      if (output.assumptions && 'operating_margin_target' in output.assumptions) {
        assumptions.operating_margin_target = (output.assumptions as any).operating_margin_target;
        break;
      }
    }

    return assumptions;
  }

  /**
   * Summarize analyst views for journal entry
   */
  private summarizeAnalystViews(outputs: AnalystOutput[]): SynthesisOutput['analyst_views'] {
    const views: SynthesisOutput['analyst_views'] = {
      consensus: '',
    };

    // Find Damodaran-style valuation analyst
    const damodaran = outputs.find((o) =>
      o.analyst_id.toLowerCase().includes('damodaran') ||
      o.role === 'valuation'
    );
    if (damodaran && damodaran.fair_value) {
      views.damodaran = {
        fair_value: damodaran.fair_value,
        conviction: damodaran.conviction,
        view: damodaran.thesis_summary,
      };
    }

    // Find Klarman-style downside analyst
    const klarman = outputs.find((o) =>
      o.analyst_id.toLowerCase().includes('klarman') ||
      o.role === 'downside'
    );
    if (klarman && klarman.fair_value) {
      views.klarman = {
        fair_value: klarman.fair_value,
        conviction: klarman.conviction,
        view: klarman.thesis_summary,
      };
    }

    // Find portfolio allocator
    const portfolio = outputs.find((o) => o.role === 'portfolio');
    if (portfolio) {
      const position = this.suggestPositionSize(portfolio.conviction, portfolio.stance);
      views.portfolio = {
        position,
        conviction: portfolio.conviction,
        view: portfolio.thesis_summary,
      };
    }

    // Build consensus view
    const bullishCount = outputs.filter((o) => o.stance === 'bullish').length;
    const bearishCount = outputs.filter((o) => o.stance === 'bearish').length;

    if (bullishCount > bearishCount * 1.5) {
      views.consensus = 'Bullish - majority of analysts see upside';
    } else if (bearishCount > bullishCount * 1.5) {
      views.consensus = 'Bearish - majority of analysts see risks';
    } else {
      views.consensus = 'Mixed - analysts divided on outlook';
    }

    // Key disagreement
    const keyDisagreements = this.findKeyDisagreement(outputs);
    if (keyDisagreements) {
      views.key_disagreement = keyDisagreements;
    }

    return views;
  }

  /**
   * Find the most significant disagreement between analysts
   */
  private findKeyDisagreement(outputs: AnalystOutput[]): string | undefined {
    const bullish = outputs.filter((o) => o.stance === 'bullish');
    const bearish = outputs.filter((o) => o.stance === 'bearish');

    if (bullish.length === 0 || bearish.length === 0) {
      return undefined;
    }

    // Compare valuations
    const bullVal = bullish.find((o) => o.fair_value);
    const bearVal = bearish.find((o) => o.fair_value);

    if (bullVal && bearVal && bullVal.fair_value && bearVal.fair_value) {
      const diff = Math.abs(bullVal.fair_value - bearVal.fair_value);
      const pctDiff = diff / ((bullVal.fair_value + bearVal.fair_value) / 2);

      if (pctDiff > 0.3) {
        return `Valuation: ${bullVal.analyst_name} sees ${bullVal.fair_value} vs ${bearVal.analyst_name} sees ${bearVal.fair_value}`;
      }
    }

    // Compare growth assumptions
    const bullGrowth = bullish.find((o) => o.growth_rate_y1_y5);
    const bearGrowth = bearish.find((o) => o.growth_rate_y1_y5);

    if (bullGrowth && bearGrowth) {
      const diff = Math.abs(bullGrowth.growth_rate_y1_y5! - bearGrowth.growth_rate_y1_y5!);
      if (diff > 5) {
        return `Growth: ${bullGrowth.analyst_name} assumes ${bullGrowth.growth_rate_y1_y5}% vs ${bearGrowth.analyst_name} assumes ${bearGrowth.growth_rate_y1_y5}%`;
      }
    }

    return undefined;
  }

  /**
   * Suggest position size based on conviction and stance
   */
  private suggestPositionSize(conviction: number, stance: string): number {
    if (stance === 'bearish') {
      return 0;
    }

    if (conviction >= 9) return 10; // Core position
    if (conviction >= 8) return 7;
    if (conviction >= 7) return 5; // Starter
    if (conviction >= 6) return 3;
    if (conviction >= 5) return 2;
    return 1; // Tiny position
  }

  /**
   * Compile thesis breakers from all analysts
   */
  private compileThesisBreakers(outputs: AnalystOutput[]): string[] {
    const breakers = new Set<string>();

    for (const output of outputs) {
      for (const breaker of output.thesis_breakers) {
        breakers.add(breaker);
      }
    }

    return Array.from(breakers);
  }

  /**
   * Compile follow-up events from all analysts
   */
  private compileFollowUpEvents(outputs: AnalystOutput[]): Array<{
    event: string;
    expected_date: string;
    watch_for: string;
  }> {
    const events = new Map<string, { expected_date: string; watch_for: string }>();

    for (const output of outputs) {
      for (const event of output.follow_up_events) {
        const key = event.event.toLowerCase();
        if (!events.has(key)) {
          events.set(key, {
            expected_date: event.expected_date,
            watch_for: event.watch_for,
          });
        }
      }
    }

    return Array.from(events.entries()).map(([event, data]) => ({
      event,
      expected_date: data.expected_date,
      watch_for: data.watch_for,
    }));
  }

  /**
   * Preserve dissenting minority views
   */
  private preserveDissent(
    outputs: AnalystOutput[],
    consensus: ConsensusAnalysis
  ): Array<{ analyst: string; view: string; reason: string }> | undefined {
    const dissent: Array<{ analyst: string; view: string; reason: string }> = [];

    const majorityStance =
      consensus.stance_distribution.bullish > consensus.stance_distribution.bearish
        ? 'bullish'
        : 'bearish';

    for (const output of outputs) {
      if (output.stance !== majorityStance) {
        dissent.push({
          analyst: output.analyst_name,
          view: output.thesis_summary,
          reason: `${output.stance} stance against ${majorityStance} majority`,
        });
      }
    }

    return dissent.length > 0 ? dissent : undefined;
  }
}

/**
 * Helper math utilities
 */
function average(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
}

function median(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function standardDeviation(numbers: number[]): number {
  if (numbers.length <= 1) return 0;
  const avg = average(numbers);
  const squareDiffs = numbers.map((n) => Math.pow(n - avg, 2));
  return Math.sqrt(average(squareDiffs));
}
