/**
 * Synthesis Engine Types
 *
 * Types for the CIO synthesizer that combines analyst outputs
 * into a final investment decision
 */

import type { DecisionState } from '../journal-writer/types.js';

/**
 * Individual analyst output from mission execution
 */
export interface AnalystOutput {
  analyst_id: string;
  analyst_name: string;
  role: 'valuation' | 'downside' | 'growth' | 'technical' | 'portfolio';
  stance: 'bullish' | 'bearish' | 'neutral';
  conviction: number; // 1-10

  // Valuation outputs
  fair_value?: number;
  fair_value_method: string;
  price_target?: number;
  margin_of_safety?: number; // percentage

  // Key inputs
  normalized_earnings?: number;
  growth_rate_y1_y5?: number;
  discount_rate?: number;
  terminal_growth?: number;

  // Thesis
  thesis_summary: string;
  key_positives: string[];
  key_negatives: string[];

  // Thesis breakers this analyst identified
  thesis_breakers: string[];

  // Follow-up events this analyst wants to track
  follow_up_events: Array<{
    event: string;
    expected_date: string;
    watch_for: string;
  }>;

  // Data gaps this analyst identified
  data_gaps: string[];

  // Additional assumptions specific to this analyst
  assumptions?: Record<string, unknown>;

  // Raw analysis for reference
  raw_analysis?: string;

  // Timestamp
  completed_at: Date;
}

/**
 * Consensus analysis across all analysts
 */
export interface ConsensusAnalysis {
  // Overall stance distribution
  stance_distribution: {
    bullish: number;
    bearish: number;
    neutral: number;
  };

  // Average conviction
  average_conviction: number;
  conviction_variance: number;

  // Valuation consensus
  valuation_consensus: {
    fair_values: number[];
    average_fair_value: number;
    median_fair_value: number;
    min_fair_value: number;
    max_fair_value: number;
    standard_deviation: number;
  };

  // Key agreements
  key_agreements: string[];

  // Key disagreements
  key_disagreements: Array<{
    topic: string;
    bullish_view: { analyst: string; view: string };
    bearish_view: { analyst: string; view: string };
  }>;
}

/**
 * Evidence quality assessment
 */
export interface EvidenceAssessment {
  overall_score: number; // 0-100

  // Source tier counts
  tier1_sources: number;
  tier2_sources: number;
  tier3_sources: number;
  tier4_sources: number;

  // Data gaps identified by analysts
  data_gaps: string[];

  // Unresolved questions
  unresolved_questions: string[];

  // Confidence level based on evidence
  evidence_confidence: 'very_high' | 'high' | 'moderate' | 'low' | 'very_low';
}

/**
 * Synthesis input from mission execution
 */
export interface SynthesisInput {
  mission_id: string;
  domain: string;
  subject: {
    type: string;
    ticker?: string;
    company_name?: string;
    market?: string;
  };

  // All analyst outputs
  analyst_outputs: AnalystOutput[];

  // Evidence pack metadata
  evidence_summary: {
    total_sources: number;
    tier_counts: Record<number, number>;
    items_extracted: number;
  };

  // Current market data
  market_data: {
    current_price: number;
    market_cap?: number;
    as_of_date: Date;
  };

  // Mission start time
  mission_started: Date;

  // Constitution rules applied
  constitution_rules: string[];
}

/**
 * Synthesis output - the final investment decision
 */
export interface SynthesisOutput {
  mission_id: string;
  synthesized_at: Date;

  // Final decision
  decision_state: DecisionState;
  conviction_level: number; // 1-10
  rationale_summary: string;

  // Final valuation
  valuation: {
    conservative: number;
    base: number;
    mos_30: number;
    price_to_watch: number;
    method: string;
  };

  // Key assumptions used
  assumptions: {
    normalized_earnings?: number;
    revenue_growth_y1_y5?: number;
    operating_margin_target?: number;
    wacc?: number;
    terminal_growth?: number;
    other_assumptions?: Record<string, unknown>;
  };

  // Evidence quality
  evidence_quality: {
    score: number;
    tier1_sources: number;
    tier2_sources: number;
    tier3_sources: number;
    data_gaps: string[];
  };

  // Individual analyst views summary
  analyst_views: {
    damodaran?: { fair_value: number; conviction: number; view: string };
    klarman?: { fair_value: number; conviction: number; view: string };
    portfolio?: { position: number; conviction: number; view: string };
    consensus: string;
    key_disagreement?: string;
  };

  // Thesis breakers - conditions that would invalidate the thesis
  thesis_breakers: string[];

  // Follow-up events to monitor
  follow_up_events: Array<{
    event: string;
    expected_date: string;
    watch_for: string;
  }>;

  // Meta-information
  consensus_analysis: ConsensusAnalysis;
  evidence_assessment: EvidenceAssessment;

  // Dissent notes - preserve minority views
  dissent_notes?: Array<{
    analyst: string;
    view: string;
    reason: string;
  }>;
}

/**
 * Synthesis engine configuration
 */
export interface SynthesisConfig {
  // Conviction thresholds for decision states
  conviction_thresholds: {
    reject: number; // Below this, reject
    watch: number; // Below this, watch only
    research_more: number; // Below this, need more research
    wait_for_price: number; // Below this, wait for better price
    starter_position: number; // Minimum for starter
    core_candidate: number; // Minimum for core
  };

  // Margin of safety percentages
  mos_percentages: {
    conservative: number; // % below fair value for conservative
    base: number; // % below fair value for base
    mos_30: number; // 30% MOS price
  };

  // Evidence quality thresholds
  evidence_thresholds: {
    very_high: number; // Minimum score for very high confidence
    high: number;
    moderate: number;
    low: number;
  };

  // Constitution strictness
  constitution_strict: boolean;
}

/**
 * Decision state determination result
 */
export interface DecisionDetermination {
  state: DecisionState;
  reason: string;
  conviction: number;
  caveats: string[];
}
