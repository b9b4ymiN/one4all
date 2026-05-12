/**
 * State Transitions
 *
 * Defines valid state transitions and their preconditions
 * as specified in MISSION_LIFECYCLE.md
 */

import {
  Mission,
  MissionState,
  ValidationResult,
  TransitionTrigger,
  TransitionResult,
  FailedStateInfo,
} from "./types.js";
import { getStateDefinition } from "./states.js";

/**
 * Transition rule definition
 */
export interface TransitionRule {
  from: MissionState;
  to: MissionState;
  precondition: (mission: Mission) => Promise<ValidationResult>;
  trigger: TransitionTrigger;
  timeout?: number; // milliseconds, null = no timeout
  on_timeout?: MissionState; // where to go on timeout
}

/**
 * All transition rules
 */
export const TRANSITION_RULES: TransitionRule[] = [
  // DRAFT → PLANNING: Input is valid
  {
    from: MissionState.DRAFT,
    to: MissionState.PLANNING,
    precondition: async (mission: Mission): Promise<ValidationResult> => {
      const stateDef = getStateDefinition(MissionState.DRAFT);
      if (stateDef.validate) {
        return await stateDef.validate(mission);
      }
      return { valid: true, errors: [], warnings: [] };
    },
    trigger: "condition_met",
  },

  // DRAFT → FAILED: Invalid input
  {
    from: MissionState.DRAFT,
    to: MissionState.FAILED,
    precondition: async (): Promise<ValidationResult> => {
      return { valid: true, errors: [], warnings: [] }; // Always can fail
    },
    trigger: "error",
  },

  // PLANNING → RESEARCHING: Team built, evidence requirements defined
  {
    from: MissionState.PLANNING,
    to: MissionState.RESEARCHING,
    precondition: async (mission: Mission): Promise<ValidationResult> => {
      const errors: string[] = [];
      const warnings: string[] = [];

      if (!mission.state.config) {
        errors.push("Mission config is required");
        return { valid: false, errors, warnings };
      }

      if (!mission.state.config.required_agents) {
        errors.push("Required agents must be defined");
      }

      if (!mission.state.config.evidence_requirements) {
        errors.push("Evidence requirements must be defined");
      }

      return { valid: errors.length === 0, errors, warnings };
    },
    trigger: "condition_met",
  },

  // PLANNING → FAILED: Error during planning
  {
    from: MissionState.PLANNING,
    to: MissionState.FAILED,
    precondition: async (): Promise<ValidationResult> => {
      return { valid: true, errors: [], warnings: [] };
    },
    trigger: "error",
  },

  // RESEARCHING → ANALYZING: Evidence score ≥ 40
  {
    from: MissionState.RESEARCHING,
    to: MissionState.ANALYZING,
    precondition: async (mission: Mission): Promise<ValidationResult> => {
      const errors: string[] = [];
      const warnings: string[] = [];

      const evidence = mission.state.evidence_pack;
      if (!evidence) {
        errors.push("Evidence pack is required");
        return { valid: false, errors, warnings };
      }

      if (evidence.evidence_score < 40) {
        errors.push(
          `Evidence score ${evidence.evidence_score} is below threshold 40`
        );
      }

      return { valid: errors.length === 0, errors, warnings };
    },
    trigger: "condition_met",
    timeout: 600000, // 10 minutes max
    on_timeout: MissionState.FAILED,
  },

  // RESEARCHING → HUMAN_REVIEW_GATE_1: Evidence score < 40
  {
    from: MissionState.RESEARCHING,
    to: MissionState.HUMAN_REVIEW_GATE_1,
    precondition: async (mission: Mission): Promise<ValidationResult> => {
      const evidence = mission.state.evidence_pack;
      if (!evidence) {
        return { valid: false, errors: ["Evidence pack is required"], warnings: [] };
      }

      if (evidence.evidence_score >= 40) {
        return {
          valid: false,
          errors: ["Evidence score is above threshold, should go to ANALYZING"],
          warnings: [],
        };
      }

      return { valid: true, errors: [], warnings: [] };
    },
    trigger: "condition_met",
  },

  // RESEARCHING → FAILED: Timeout or error
  {
    from: MissionState.RESEARCHING,
    to: MissionState.FAILED,
    precondition: async (): Promise<ValidationResult> => {
      return { valid: true, errors: [], warnings: [] };
    },
    trigger: "error",
  },

  // HUMAN_REVIEW_GATE_1 → ANALYZING: Owner approves
  {
    from: MissionState.HUMAN_REVIEW_GATE_1,
    to: MissionState.ANALYZING,
    precondition: async (): Promise<ValidationResult> => {
      return { valid: true, errors: [], warnings: [] };
    },
    trigger: "owner_action",
  },

  // HUMAN_REVIEW_GATE_1 → FAILED: Owner aborts
  {
    from: MissionState.HUMAN_REVIEW_GATE_1,
    to: MissionState.FAILED,
    precondition: async (): Promise<ValidationResult> => {
      return { valid: true, errors: [], warnings: [] };
    },
    trigger: "abort",
  },

  // ANALYZING → CROSS_QA: All analysts returned output
  {
    from: MissionState.ANALYZING,
    to: MissionState.CROSS_QA,
    precondition: async (mission: Mission): Promise<ValidationResult> => {
      const errors: string[] = [];
      const warnings: string[] = [];

      if (!mission.state.analyst_outputs) {
        errors.push("Analyst outputs are required");
      }

      return { valid: errors.length === 0, errors, warnings };
    },
    trigger: "condition_met",
    timeout: 600000, // 10 minutes max
    on_timeout: MissionState.CROSS_QA, // Proceed with logged timeout
  },

  // ANALYZING → HUMAN_REVIEW_GATE_2: Optional gate configured
  {
    from: MissionState.ANALYZING,
    to: MissionState.HUMAN_REVIEW_GATE_2,
    precondition: async (mission: Mission): Promise<ValidationResult> => {
      // Check if optional gate is configured
      const config = mission.state.config;
      const hasGate2 = config?.human_checkpoints?.some(
        (cp) => cp.after === MissionState.ANALYZING
      );

      if (!hasGate2) {
        return {
          valid: false,
          errors: ["Optional gate 2 not configured"],
          warnings: [],
        };
      }

      return { valid: true, errors: [], warnings: [] };
    },
    trigger: "condition_met",
  },

  // ANALYZING → FAILED: Error during analysis
  {
    from: MissionState.ANALYZING,
    to: MissionState.FAILED,
    precondition: async (): Promise<ValidationResult> => {
      return { valid: true, errors: [], warnings: [] };
    },
    trigger: "error",
  },

  // HUMAN_REVIEW_GATE_2 → DEBATING: Owner continues
  {
    from: MissionState.HUMAN_REVIEW_GATE_2,
    to: MissionState.DEBATING,
    precondition: async (): Promise<ValidationResult> => {
      return { valid: true, errors: [], warnings: [] };
    },
    trigger: "owner_action",
  },

  // HUMAN_REVIEW_GATE_2 → FAILED: Owner aborts
  {
    from: MissionState.HUMAN_REVIEW_GATE_2,
    to: MissionState.FAILED,
    precondition: async (): Promise<ValidationResult> => {
      return { valid: true, errors: [], warnings: [] };
    },
    trigger: "abort",
  },

  // CROSS_QA → DEBATING: All questions asked
  {
    from: MissionState.CROSS_QA,
    to: MissionState.DEBATING,
    precondition: async (): Promise<ValidationResult> => {
      return { valid: true, errors: [], warnings: [] };
    },
    trigger: "condition_met",
    timeout: 90000, // 90 seconds
    on_timeout: MissionState.DEBATING, // Proceed with logged timeout
  },

  // CROSS_QA → FAILED: Error during QA
  {
    from: MissionState.CROSS_QA,
    to: MissionState.FAILED,
    precondition: async (): Promise<ValidationResult> => {
      return { valid: true, errors: [], warnings: [] };
    },
    trigger: "error",
  },

  // DEBATING → SYNTHESIZING: Max 3 rounds OR all resolved
  {
    from: MissionState.DEBATING,
    to: MissionState.SYNTHESIZING,
    precondition: async (mission: Mission): Promise<ValidationResult> => {
      const errors: string[] = [];
      const warnings: string[] = [];

      const debate = mission.state.debate_records;
      if (!debate) {
        errors.push("Debate records are required");
        return { valid: false, errors, warnings };
      }

      // Check rounds or resolved
      // This is validated by the debate controller

      return { valid: true, errors: [], warnings: [] };
    },
    trigger: "condition_met",
    timeout: 600000, // 10 minutes max
    on_timeout: MissionState.SYNTHESIZING, // Close with unresolved flags
  },

  // DEBATING → FAILED: Error during debate
  {
    from: MissionState.DEBATING,
    to: MissionState.FAILED,
    precondition: async (): Promise<ValidationResult> => {
      return { valid: true, errors: [], warnings: [] };
    },
    trigger: "error",
  },

  // SYNTHESIZING → HUMAN_REVIEW_GATE_3: CIO output produced
  {
    from: MissionState.SYNTHESIZING,
    to: MissionState.HUMAN_REVIEW_GATE_3,
    precondition: async (mission: Mission): Promise<ValidationResult> => {
      const stateDef = getStateDefinition(MissionState.SYNTHESIZING);
      if (stateDef.validate) {
        return await stateDef.validate(mission);
      }
      return { valid: true, errors: [], warnings: [] };
    },
    trigger: "condition_met",
    timeout: 120000, // 2 minutes
    on_timeout: MissionState.FAILED,
  },

  // SYNTHESIZING → FAILED: Error during synthesis
  {
    from: MissionState.SYNTHESIZING,
    to: MissionState.FAILED,
    precondition: async (): Promise<ValidationResult> => {
      return { valid: true, errors: [], warnings: [] };
    },
    trigger: "error",
  },

  // HUMAN_REVIEW_GATE_3 → DECIDED: Owner confirms
  {
    from: MissionState.HUMAN_REVIEW_GATE_3,
    to: MissionState.DECIDED,
    precondition: async (mission: Mission): Promise<ValidationResult> => {
      const stateDef = getStateDefinition(MissionState.DECIDED);
      if (stateDef.validate) {
        return await stateDef.validate(mission);
      }
      return { valid: true, errors: [], warnings: [] };
    },
    trigger: "owner_action",
  },

  // HUMAN_REVIEW_GATE_3 → FAILED: Owner aborts
  {
    from: MissionState.HUMAN_REVIEW_GATE_3,
    to: MissionState.FAILED,
    precondition: async (): Promise<ValidationResult> => {
      return { valid: true, errors: [], warnings: [] };
    },
    trigger: "abort",
  },

  // DECIDED → JOURNALED: Journal schema valid
  {
    from: MissionState.DECIDED,
    to: MissionState.JOURNALED,
    precondition: async (mission: Mission): Promise<ValidationResult> => {
      const stateDef = getStateDefinition(MissionState.DECIDED);
      if (stateDef.validate) {
        return await stateDef.validate(mission);
      }
      return { valid: true, errors: [], warnings: [] };
    },
    trigger: "condition_met",
  },

  // DECIDED → FAILED: Journal write failed (can retry)
  {
    from: MissionState.DECIDED,
    to: MissionState.FAILED,
    precondition: async (): Promise<ValidationResult> => {
      return { valid: true, errors: [], warnings: [] };
    },
    trigger: "error",
  },

  // Any state → FAILED: Universal error transition
  // Note: This is handled separately in the state machine
];

/**
 * Get valid target states for a given source state
 */
export function getValidTransitions(
  from: MissionState
  ): MissionState[] {
  const rules = TRANSITION_RULES.filter((r) => r.from === from);
  return rules.map((r) => r.to);
}

/**
 * Get transition rule for a specific transition
 */
export function getTransitionRule(
  from: MissionState,
  to: MissionState
): TransitionRule | undefined {
  return TRANSITION_RULES.find((r) => r.from === from && r.to === to);
}

/**
 * Check if a transition is valid
 */
export function isValidTransition(
  from: MissionState,
  to: MissionState
): boolean {
  return getValidTransitions(from).includes(to);
}

/**
 * Validate transition precondition
 */
export async function validateTransition(
  mission: Mission,
  to: MissionState,
  trigger: TransitionTrigger = "condition_met"
): Promise<ValidationResult> {
  const from = mission.state.current_state;
  const rule = getTransitionRule(from, to);

  if (!rule) {
    return {
      valid: false,
      errors: [`Invalid transition from ${from} to ${to}`],
      warnings: [],
    };
  }

  if (rule.trigger !== trigger && trigger !== "error" && trigger !== "abort") {
    // Allow error/abort transitions even if trigger doesn't match
    return {
      valid: false,
      errors: [`Transition trigger mismatch: expected ${rule.trigger}, got ${trigger}`],
      warnings: [],
    };
  }

  return await rule.precondition(mission);
}

/**
 * Create failed state info
 */
export function createFailedStateInfo(
  originalState: MissionState,
  reason: string,
  partialOutputs: Record<string, unknown> = {},
  recoveryOptions: string[] = []
): FailedStateInfo {
  return {
    original_state: originalState,
    failure_reason: reason,
    failure_timestamp: new Date(),
    partial_outputs: partialOutputs,
    recovery_options: recoveryOptions,
  };
}

/**
 * Get timeout for a transition
 */
export function getTransitionTimeout(
  from: MissionState,
  to: MissionState
): number | null {
  const rule = getTransitionRule(from, to);
  return rule?.timeout ?? null;
}

/**
 * Get timeout target state
 */
export function getTimeoutTarget(
  from: MissionState,
  to: MissionState
): MissionState | null {
  const rule = getTransitionRule(from, to);
  return rule?.on_timeout ?? null;
}
