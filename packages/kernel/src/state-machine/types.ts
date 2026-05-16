/**
 * Mission State Machine Types
 *
 * Defines all types for the mission state machine implementation
 * as specified in MISSION_LIFECYCLE.md
 */

/**
 * All possible mission states
 */
export enum MissionState {
  DRAFT = "DRAFT",
  PLANNING = "PLANNING",
  RESEARCHING = "RESEARCHING",
  HUMAN_REVIEW_GATE_1 = "HUMAN_REVIEW_GATE_1",
  ANALYZING = "ANALYZING",
  HUMAN_REVIEW_GATE_2 = "HUMAN_REVIEW_GATE_2",
  CROSS_QA = "CROSS_QA",
  DEBATING = "DEBATING",
  SYNTHESIZING = "SYNTHESIZING",
  HUMAN_REVIEW_GATE_3 = "HUMAN_REVIEW_GATE_3",
  DECIDED = "DECIDED",
  JOURNALED = "JOURNALED",
  FAILED = "FAILED",
  // Inquiry mode states
  ROUTING = "ROUTING",
  EXECUTING_INQUIRY = "EXECUTING_INQUIRY",
  INQUIRY_SYNTHESIZING = "INQUIRY_SYNTHESIZING",
  DELIVERABLE = "DELIVERABLE",
}

/**
 * Terminal states - no transitions out of these
 */
export const TERMINAL_STATES: Set<MissionState> = new Set([
  MissionState.JOURNALED,
  MissionState.FAILED,
]);

/**
 * Human review states - wait for owner input
 */
export const HUMAN_REVIEW_STATES: Set<MissionState> = new Set([
  MissionState.HUMAN_REVIEW_GATE_1,
  MissionState.HUMAN_REVIEW_GATE_2,
  MissionState.HUMAN_REVIEW_GATE_3,
]);

/**
 * Decision states for investment domain
 */
export enum DecisionState {
  // Rejection states
  REJECT = "REJECT",
  WATCH = "WATCH",

  // Need more info
  RESEARCH_MORE = "RESEARCH_MORE",

  // Waiting states
  WAIT_FOR_PRICE = "WAIT_FOR_PRICE",
  STARTER_POSITION = "STARTER_POSITION",
  CORE_CANDIDATE = "CORE_CANDIDATE",
  ADD_ON_WEAKNESS = "ADD_ON_WEAKNESS",

  // Existing positions
  HOLD = "HOLD",
  TRIM = "TRIM",
  EXIT_THESIS_BROKEN = "EXIT_THESIS_BROKEN",
}

/**
 * Transition trigger types
 */
export type TransitionTrigger =
  | "condition_met"
  | "timeout"
  | "owner_action"
  | "error"
  | "abort";

/**
 * Brief input from owner
 */
export interface Brief {
  type: "stock_analysis" | "portfolio_review" | "quick_screen";
  domain: string;
  ticker?: string;
  description: string;
  owner_assumptions?: Record<string, unknown>;
  constraints?: Record<string, unknown>;
  // Inquiry mode fields
  inquiry_mode?: boolean;
  question?: string;
}

/**
 * Evidence pack metadata
 */
export interface EvidencePackMetadata {
  sources_found: number;
  tier1_sources: number;
  tier2_sources: number;
  tier3_sources: number;
  evidence_score: number; // 0-100
  data_gaps: string[];
}

/**
 * Mission configuration
 */
export interface MissionConfig {
  mission_id: string;
  domain: string;
  mission_type: string;
  ticker?: string;
  brief: Brief;
  required_agents: string[];
  evidence_requirements: {
    minimum_sources: Array<{ tier: string; count: number }>;
    required_documents: string[];
  };
  human_checkpoints: Array<{
    after: MissionState;
    condition: "always" | "conditional";
    trigger?: string;
  }>;
  created_at: Date;
}

/**
 * Decision output
 */
export interface Decision {
  decision_state: DecisionState;
  fair_value_conservative: number;
  price_to_watch: number;
  thesis_breakers: string[];
  follow_up_events: FollowUpEvent[];
}

/**
 * Follow-up event
 */
export interface FollowUpEvent {
  event: string;
  expected_date: Date;
  watch_for: string;
}

/**
 * Failed state information
 */
export interface FailedStateInfo {
  original_state: MissionState;
  failure_reason: string;
  failure_timestamp: Date;
  partial_outputs: Record<string, unknown>;
  recovery_options: string[];
}

/**
 * State transition record
 */
export interface StateTransition {
  mission_id: string;
  from_state: MissionState;
  to_state: MissionState;
  timestamp: Date;
  duration_ms: number;
  trigger: TransitionTrigger;
}

/**
 * Mission state data
 */
export interface MissionStateData {
  current_state: MissionState;
  state_entered_at: Date;
  previous_state?: MissionState;
  // State-specific data
  brief?: Brief;
  config?: MissionConfig;
  evidence_pack?: EvidencePackMetadata;
  analyst_outputs?: Record<string, unknown>;
  debate_records?: unknown;
  synthesis_output?: unknown;
  decision?: Decision;
  journal_entry_id?: string;
  failed_info?: FailedStateInfo;
}

/**
 * Mission object
 */
export interface Mission {
  id: string;
  state: MissionStateData;
  transitions: StateTransition[];
  created_at: Date;
  updated_at: Date;
}

/**
 * State transition result
 */
export interface TransitionResult {
  success: boolean;
  new_state?: MissionState;
  error?: string;
  requires_human_input?: boolean;
  human_message?: string;
}

/**
 * State validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Transition precondition
 */
export interface TransitionPrecondition {
  from: MissionState;
  to: MissionState;
  check: (mission: Mission) => Promise<ValidationResult>;
  timeout?: number; // milliseconds, null = no timeout
  on_timeout?: MissionState; // where to go on timeout
}

/**
 * State entry/exit hooks
 */
export interface StateHooks {
  onEntry?: (mission: Mission) => Promise<void>;
  onExit?: (mission: Mission) => Promise<void>;
  onTimeout?: (mission: Mission) => Promise<TransitionResult>;
}

/**
 * Human gate action
 */
export type HumanGateAction =
  | "proceed"
  | "add_data"
  | "revise_assumptions"
  | "request_reanalysis"
  | "abort"
  | "skip";
