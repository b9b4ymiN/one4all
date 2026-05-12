/**
 * State Definitions and Hooks
 *
 * Defines entry/exit hooks for each mission state
 */

import { Mission, MissionState, ValidationResult } from "./types.js";

/**
 * State-specific data and hooks
 */
export interface StateDefinition {
  state: MissionState;
  description: string;
  onEntry?: (mission: Mission) => Promise<void>;
  onExit?: (mission: Mission) => Promise<void>;
  validate?: (mission: Mission) => Promise<ValidationResult>;
  canTransitionTo: MissionState[];
}

/**
 * DRAFT State
 */
export const DraftState: StateDefinition = {
  state: MissionState.DRAFT,
  description: "Owner has provided a brief, not yet validated",
  canTransitionTo: [MissionState.PLANNING, MissionState.FAILED],

  validate: async (mission: Mission): Promise<ValidationResult> => {
    const errors: string[] = [];
    const warnings: string[] = [];

    const brief = mission.state.brief;
    if (!brief) {
      errors.push("Brief is required");
      return { valid: false, errors, warnings };
    }

    // Validate brief structure
    if (!brief.type) {
      errors.push("Brief type is required");
    }
    if (!brief.domain) {
      errors.push("Brief domain is required");
    }
    if (!brief.description) {
      errors.push("Brief description is required");
    }

    // Validate type is one of the allowed values
    const validTypes = ["stock_analysis", "portfolio_review", "quick_screen"];
    if (brief.type && !validTypes.includes(brief.type)) {
      errors.push(`Invalid brief type: ${brief.type}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  },

  onExit: async (mission: Mission): Promise<void> => {
    // Brief has been validated, create mission config
    // This is handled by the transition logic
  },
};

/**
 * PLANNING State
 */
export const PlanningState: StateDefinition = {
  state: MissionState.PLANNING,
  description: "Kernel is analyzing brief and building team",
  canTransitionTo: [MissionState.RESEARCHING, MissionState.FAILED],

  onEntry: async (mission: Mission): Promise<void> => {
    // Parse mission type
    // Select required agents from domain config
    // Define evidence requirements
    // Create execution plan
    // Allocate context budgets
  },
};

/**
 * RESEARCHING State
 */
export const ResearchingState: StateDefinition = {
  state: MissionState.RESEARCHING,
  description: "Researcher agents are gathering evidence",
  canTransitionTo: [
    MissionState.ANALYZING,
    MissionState.HUMAN_REVIEW_GATE_1,
    MissionState.FAILED,
  ],

  onEntry: async (mission: Mission): Promise<void> => {
    // Researcher agents gather evidence
    // Create evidence pack
    // Calculate evidence score
    // Identify data gaps
  },
};

/**
 * HUMAN_REVIEW_GATE_1 State
 */
export const HumanReviewGate1State: StateDefinition = {
  state: MissionState.HUMAN_REVIEW_GATE_1,
  description: "Waiting for owner input after research",
  canTransitionTo: [MissionState.ANALYZING, MissionState.FAILED],

  onEntry: async (mission: Mission): Promise<void> => {
    // Prepare human review message
    // Wait for owner action
  },
};

/**
 * ANALYZING State
 */
export const AnalyzingState: StateDefinition = {
  state: MissionState.ANALYZING,
  description: "Analyst agents are processing evidence",
  canTransitionTo: [
    MissionState.CROSS_QA,
    MissionState.HUMAN_REVIEW_GATE_2,
    MissionState.FAILED,
  ],

  onEntry: async (mission: Mission): Promise<void> => {
    // Distribute evidence pack to analysts
    // Execute analysts in parallel
    // Collect individual outputs
  },
};

/**
 * HUMAN_REVIEW_GATE_2 State
 */
export const HumanReviewGate2State: StateDefinition = {
  state: MissionState.HUMAN_REVIEW_GATE_2,
  description: "Optional review after individual analyses",
  canTransitionTo: [MissionState.DEBATING, MissionState.FAILED],

  onEntry: async (mission: Mission): Promise<void> => {
    // Optional gate - auto-proceed after 60 seconds if no response
  },
};

/**
 * CROSS_QA State
 */
export const CrossQAState: StateDefinition = {
  state: MissionState.CROSS_QA,
  description: "Agents are questioning each other",
  canTransitionTo: [MissionState.DEBATING, MissionState.FAILED],

  onEntry: async (mission: Mission): Promise<void> => {
    // Agents review each other's outputs
    // Questions sent to relevant agents
    // Researchers respond with evidence
    // Unanswered questions collected
  },
};

/**
 * DEBATING State
 */
export const DebatingState: StateDefinition = {
  state: MissionState.DEBATING,
  description: "Structured disagreement rounds",
  canTransitionTo: [MissionState.SYNTHESIZING, MissionState.FAILED],

  onEntry: async (mission: Mission): Promise<void> => {
    // Maximum 3 rounds
    // Challenges must cite evidence tiers
    // Unresolved disagreements preserved
  },
};

/**
 * SYNTHESIZING State
 */
export const SynthesizingState: StateDefinition = {
  state: MissionState.SYNTHESIZING,
  description: "CIO is combining outputs",
  canTransitionTo: [MissionState.HUMAN_REVIEW_GATE_3, MissionState.FAILED],

  validate: async (mission: Mission): Promise<ValidationResult> => {
    const errors: string[] = [];
    const warnings: string[] = [];

    const synthesis = mission.state.synthesis_output;
    if (!synthesis) {
      errors.push("Synthesis output is required");
      return { valid: false, errors, warnings };
    }

    // Validate decision_state is present
    if (!mission.state.decision) {
      errors.push("Decision must be set");
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  },
};

/**
 * HUMAN_REVIEW_GATE_3 State
 */
export const HumanReviewGate3State: StateDefinition = {
  state: MissionState.HUMAN_REVIEW_GATE_3,
  description: "MANDATORY: owner reviews synthesis",
  canTransitionTo: [MissionState.DECIDED, MissionState.FAILED],

  onEntry: async (mission: Mission): Promise<void> => {
    // MANDATORY GATE - no auto-proceed
    // Owner must confirm decision
  },
};

/**
 * DECIDED State
 */
export const DecidedState: StateDefinition = {
  state: MissionState.DECIDED,
  description: "Final decision state determined",
  canTransitionTo: [MissionState.JOURNALED, MissionState.FAILED],

  validate: async (mission: Mission): Promise<ValidationResult> => {
    const errors: string[] = [];
    const warnings: string[] = [];

    const decision = mission.state.decision;
    if (!decision) {
      errors.push("Decision is required");
      return { valid: false, errors, warnings };
    }

    // Validate required fields
    if (!decision.decision_state) {
      errors.push("decision_state is required");
    }
    if (typeof decision.fair_value_conservative !== "number") {
      errors.push("fair_value_conservative is required");
    }
    if (typeof decision.price_to_watch !== "number") {
      errors.push("price_to_watch is required");
    }
    if (!Array.isArray(decision.thesis_breakers) || decision.thesis_breakers.length === 0) {
      errors.push("thesis_breakers must be a non-empty array");
    }
    if (!Array.isArray(decision.follow_up_events)) {
      errors.push("follow_up_events must be an array");
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  },
};

/**
 * JOURNALED State
 */
export const JournaledState: StateDefinition = {
  state: MissionState.JOURNALED,
  description: "Decision written to journal",
  canTransitionTo: [], // Terminal state

  onEntry: async (mission: Mission): Promise<void> => {
    // Write journal entry
    // Set follow-up reminders
    // Mark mission complete
    // Notify owner
  },
};

/**
 * FAILED State
 */
export const FailedState: StateDefinition = {
  state: MissionState.FAILED,
  description: "Mission could not complete",
  canTransitionTo: [], // Terminal state

  onEntry: async (mission: Mission): Promise<void> => {
    // Log which state failed
    // Log error reason
    // Preserve partial work
    // Notify owner with recovery options
  },
};

/**
 * Get state definition by state enum
 */
export function getStateDefinition(state: MissionState): StateDefinition {
  switch (state) {
    case MissionState.DRAFT:
      return DraftState;
    case MissionState.PLANNING:
      return PlanningState;
    case MissionState.RESEARCHING:
      return ResearchingState;
    case MissionState.HUMAN_REVIEW_GATE_1:
      return HumanReviewGate1State;
    case MissionState.ANALYZING:
      return AnalyzingState;
    case MissionState.HUMAN_REVIEW_GATE_2:
      return HumanReviewGate2State;
    case MissionState.CROSS_QA:
      return CrossQAState;
    case MissionState.DEBATING:
      return DebatingState;
    case MissionState.SYNTHESIZING:
      return SynthesizingState;
    case MissionState.HUMAN_REVIEW_GATE_3:
      return HumanReviewGate3State;
    case MissionState.DECIDED:
      return DecidedState;
    case MissionState.JOURNALED:
      return JournaledState;
    case MissionState.FAILED:
      return FailedState;
    default:
      throw new Error(`Unknown state: ${state}`);
  }
}

/**
 * Check if a state is a terminal state
 */
export function isTerminalState(state: MissionState): boolean {
  return state === MissionState.JOURNALED || state === MissionState.FAILED;
}

/**
 * Check if a state is a human review state
 */
export function isHumanReviewState(state: MissionState): boolean {
  return (
    state === MissionState.HUMAN_REVIEW_GATE_1 ||
    state === MissionState.HUMAN_REVIEW_GATE_2 ||
    state === MissionState.HUMAN_REVIEW_GATE_3
  );
}
