/**
 * Journal Types
 *
 * TypeScript types for the Decision Journal matching JOURNAL_SCHEMA.md
 */

// Decision State Enum
export type DecisionState =
  // Rejection states
  | 'REJECT'
  | 'WATCH'
  // Need more info
  | 'RESEARCH_MORE'
  // Waiting states
  | 'WAIT_FOR_PRICE'
  | 'STARTER_POSITION'
  | 'CORE_CANDIDATE'
  | 'ADD_ON_WEAKNESS'
  // Existing positions
  | 'HOLD'
  | 'TRIM'
  | 'EXIT_THESIS_BROKEN';

// Subject Type
export type SubjectType = 'stock' | 'project' | 'business_decision' | 'research';

// Market Type
export type Market = 'thai-set' | 'us-nyse' | 'us-nasdaq' | 'other';

// Subject
export interface Subject {
  type: SubjectType;
  ticker?: string;
  market?: Market;
  company_name?: string;
}

// Decision
export interface Decision {
  state: DecisionState;
  decision_date: string; // ISO 8601
  rationale_summary: string;
}

// Valuation
export interface Valuation {
  fair_value_conservative: number;
  fair_value_base: number;
  price_for_mos_30: number;
  price_to_watch: number;
  current_price_at_analysis: number;
  market_cap_at_analysis?: number;
}

// Assumptions
export interface Assumptions {
  normalized_earnings?: number;
  revenue_growth_y1_y5?: number;
  operating_margin_target?: number;
  wacc?: number;
  terminal_growth?: number;
  other_assumptions?: Record<string, unknown>;
  note?: string;
}

// Evidence
export interface Evidence {
  score: number; // 0-100
  tier1_sources_used: number;
  tier2_sources_used: number;
  tier3_sources_used: number;
  data_gaps: string[];
}

// Analyst View
export interface AnalystView {
  fair_value: number;
  conviction: number; // 1-10
  view: string;
}

// Analyst Views
export interface AnalystViews {
  damodaran?: AnalystView;
  klarman?: AnalystView;
  portfolio?: {
    position: number; // % of portfolio
    conviction: number;
    view: string;
  };
  consensus: string;
  key_disagreement?: string;
}

// Follow-up Event
export interface FollowUpEvent {
  event: string;
  expected_date: string; // ISO 8601
  watch_for: string;
  status?: 'pending' | 'triggered' | 'passed';
  outcome_note?: string;
}

// Outcome Lessons
export interface OutcomeLessons {
  what_worked?: string;
  what_was_wrong?: string;
  what_to_do_differently?: string;
}

// Outcome
export interface Outcome {
  updated_at?: string;
  what_happened?: string;
  price_reached_target?: boolean;
  thesis_held?: boolean;
  actual_outcome?: string;
  lessons?: OutcomeLessons;
}

// Complete Journal Entry
export interface JournalEntry {
  // Identification
  journal_id: string;
  mission_id: string;
  created_at: string;

  // Subject
  subject: Subject;

  // Decision
  decision: Decision;

  // Valuation
  valuation: Valuation;

  // Assumptions
  assumptions?: Assumptions;

  // Evidence
  evidence: Evidence;

  // Analyst Views
  analyst_views?: AnalystViews;

  // Thesis Breakers
  thesis_breakers: string[];

  // Follow-up Events
  follow_up_events: FollowUpEvent[];

  // Outcome
  outcome?: Outcome;
}

// Journal Filters for Querying
export interface JournalFilters {
  ticker?: string;
  decision_state?: DecisionState | DecisionState[];
  date_from?: string;
  date_to?: string;
  has_outcome?: boolean;
  open_positions_only?: boolean;
  domain?: string;
}

// Mission Output (simplified for journal creation)
export interface MissionOutput {
  mission_id: string;
  ticker?: string;
  market?: Market;
  company_name?: string;
  subject_type: SubjectType;
  decision_state: DecisionState;
  rationale_summary: string;
  valuation: {
    conservative: number;
    base: number;
    mos_30?: number;
    price_to_watch: number;
  };
  current_price: number;
  assumptions?: Assumptions;
  evidence_quality: {
    score: number;
    tier1_sources: number;
    tier2_sources: number;
    tier3_sources: number;
    data_gaps: string[];
  };
  analyst_views?: AnalystViews;
  thesis_breakers: string[];
  follow_up_events: FollowUpEvent[];
}

// Database Entry (row format)
export interface JournalEntryDb {
  journal_id: string;
  mission_id: string;
  created_at: string;

  subject_type: string;
  subject_ticker: string | null;
  subject_market: string | null;
  subject_company_name: string | null;

  decision_state: string;
  decision_date: string;
  decision_rationale_summary: string;

  valuation_json: string;
  assumptions_json: string | null;
  evidence_json: string;
  analyst_views_json: string | null;
  thesis_breakers_json: string;
  follow_up_events_json: string;
  outcome_json: string | null;
  outcome_updated_at: string | null;
}
