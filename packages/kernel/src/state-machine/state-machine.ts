/**
 * Mission State Machine
 *
 * Main state machine implementation for mission lifecycle
 * as specified in MISSION_LIFECYCLE.md
 */

import {
  Mission,
  MissionState,
  MissionStateData,
  StateTransition,
  TransitionTrigger,
  TransitionResult,
  ValidationResult,
  HumanGateAction,
  Brief,
} from "./types.js";
import {
  getStateDefinition,
  isTerminalState,
  isHumanReviewState,
} from "./states.js";
import {
  validateTransition,
  isValidTransition,
  createFailedStateInfo,
  getTransitionTimeout,
  getTimeoutTarget,
} from "./transitions.js";
import { timeoutManager, TimeoutConfig, DEFAULT_TIMEOUTS } from "./timeouts.js";

/**
 * State machine configuration
 */
export interface StateMachineConfig {
  enable_timeouts: boolean;
  persist_transitions: boolean;
  on_state_change?: (mission: Mission, transition: StateTransition) => Promise<void>;
  on_error?: (mission: Mission, error: Error) => Promise<void>;
  on_human_gate?: (
    mission: Mission,
    gate: MissionState,
    message: string
  ) => Promise<void>;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: StateMachineConfig = {
  enable_timeouts: true,
  persist_transitions: true,
};

/**
 * Mission State Machine
 */
export class MissionStateMachine {
  private config: StateMachineConfig;
  private activeTimeouts: Set<string> = new Set();

  constructor(config: Partial<StateMachineConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Create a new mission in DRAFT state
   */
  createMission(brief: Brief): Mission {
    const now = new Date();
    const missionId = this.generateMissionId(brief);

    const stateData: MissionStateData = {
      current_state: MissionState.DRAFT,
      state_entered_at: now,
      brief,
    };

    const mission: Mission = {
      id: missionId,
      state: stateData,
      transitions: [],
      created_at: now,
      updated_at: now,
    };

    return mission;
  }

  /**
   * Transition mission to a new state
   */
  async transition(
    mission: Mission,
    to: MissionState,
    trigger: TransitionTrigger = "condition_met",
    failedReason?: string
  ): Promise<TransitionResult> {
    const from = mission.state.current_state;

    // Check if already in target state
    if (from === to) {
      return {
        success: true,
        new_state: to,
      };
    }

    // Check if coming from terminal state
    if (isTerminalState(from)) {
      return {
        success: false,
        error: `Cannot transition from terminal state ${from}`,
      };
    }

    // Special handling for error/abort to FAILED
    if (to === MissionState.FAILED) {
      return await this.transitionToFailed(mission, trigger, failedReason);
    }

    // Validate transition
    const valid = await validateTransition(mission, to, trigger);
    if (!valid.valid) {
      return {
        success: false,
        error: valid.errors.join(", "),
      };
    }

    // Exit current state
    await this.exitState(mission);

    // Record transition
    const transition = this.createTransitionRecord(mission, to, trigger);

    // Update mission state
    const now = new Date();
    mission.state.previous_state = from;
    mission.state.current_state = to;
    mission.state.state_entered_at = now;
    mission.updated_at = now;
    mission.transitions.push(transition);

    // Enter new state
    await this.enterState(mission);

    // Setup timeout for new state
    await this.setupTimeout(mission, to);

    // Persist transition if configured
    if (this.config.persist_transitions && this.config.on_state_change) {
      await this.config.on_state_change(mission, transition);
    }

    return {
      success: true,
      new_state: to,
      requires_human_input: isHumanReviewState(to),
    };
  }

  /**
   * Handle human gate action
   */
  async handleHumanGateAction(
    mission: Mission,
    action: HumanGateAction,
    data?: Record<string, unknown>
  ): Promise<TransitionResult> {
    const currentState = mission.state.current_state;

    if (!isHumanReviewState(currentState)) {
      return {
        success: false,
        error: `Current state ${currentState} is not a human review gate`,
      };
    }

    switch (action) {
      case "proceed":
        // Move to next state based on which gate we're at
        const nextState = this.getNextStateAfterGate(currentState);
        return await this.transition(mission, nextState, "owner_action");

      case "add_data":
        // Add data and stay in current state (for GATE_1)
        if (currentState === MissionState.HUMAN_REVIEW_GATE_1 && data) {
          // Merge additional data into mission state
          Object.assign(mission.state, data);
        }
        return {
          success: true,
          new_state: currentState,
        };

      case "revise_assumptions":
        // Update assumptions and go back to SYNTHESIZING
        if (currentState === MissionState.HUMAN_REVIEW_GATE_3 && data) {
          Object.assign(mission.state, data);
          return await this.transition(
            mission,
            MissionState.SYNTHESIZING,
            "owner_action"
          );
        }
        return {
          success: false,
          error: "Cannot revise assumptions at this gate",
        };

      case "request_reanalysis":
        // Go back to ANALYZING
        return await this.transition(
          mission,
          MissionState.ANALYZING,
          "owner_action"
        );

      case "skip":
        // Skip this gate (only for GATE_2)
        if (currentState === MissionState.HUMAN_REVIEW_GATE_2) {
          return await this.transition(
            mission,
            MissionState.DEBATING,
            "owner_action"
          );
        }
        return {
          success: false,
          error: "Cannot skip this gate",
        };

      case "abort":
        return await this.transition(mission, MissionState.FAILED, "abort");

      default:
        return {
          success: false,
          error: `Unknown action: ${action}`,
        };
    }
  }

  /**
   * Get current state of mission
   */
  getCurrentState(mission: Mission): MissionState {
    return mission.state.current_state;
  }

  /**
   * Check if mission is in terminal state
   */
  isTerminal(mission: Mission): boolean {
    return isTerminalState(mission.state.current_state);
  }

  /**
   * Check if mission is waiting for human input
   */
  isWaitingForHuman(mission: Mission): boolean {
    return isHumanReviewState(mission.state.current_state);
  }

  /**
   * Get state history
   */
  getStateHistory(mission: Mission): StateTransition[] {
    return mission.transitions;
  }

  /**
   * Get time elapsed in current state
   */
  getTimeInCurrentState(mission: Mission): number {
    const enteredAt = mission.state.state_entered_at;
    return Date.now() - enteredAt.getTime();
  }

  /**
   * Check if mission has timed out
   */
  hasTimedOut(mission: Mission): boolean {
    const state = mission.state.current_state;
    const config = DEFAULT_TIMEOUTS[state];
    return timeoutManager.isTimedOut(mission.id, state, config);
  }

  /**
   * Cancel all timeouts for a mission
   */
  cleanup(mission: Mission): void {
    timeoutManager.cleanup(mission.id);
    this.activeTimeouts.delete(mission.id);
  }

  /**
   * Enter a state (call state hooks)
   */
  private async enterState(mission: Mission): Promise<void> {
    const stateDef = getStateDefinition(mission.state.current_state);
    if (stateDef.onEntry) {
      await stateDef.onEntry(mission);
    }

    // Notify human gate listener if this is a human review state
    if (isHumanReviewState(mission.state.current_state) && this.config.on_human_gate) {
      const message = this.generateHumanGateMessage(mission);
      await this.config.on_human_gate(mission, mission.state.current_state, message);
    }
  }

  /**
   * Exit a state (call state hooks)
   */
  private async exitState(mission: Mission): Promise<void> {
    const stateDef = getStateDefinition(mission.state.previous_state || mission.state.current_state);
    if (stateDef.onExit) {
      await stateDef.onExit(mission);
    }

    // Clear timeout for previous state
    timeoutManager.cleanup(mission.id);
  }

  /**
   * Setup timeout for a state
   */
  private async setupTimeout(mission: Mission, state: MissionState): Promise<void> {
    if (!this.config.enable_timeouts) {
      return;
    }

    const config = DEFAULT_TIMEOUTS[state];
    const timeoutMs = config.total_ms || config.auto_proceed_ms;

    if (!timeoutMs) {
      return; // No timeout for this state
    }

    this.activeTimeouts.add(mission.id);

    timeoutManager.startTimeout(
      mission.id,
      state,
      config,
      async () => {
        this.activeTimeouts.delete(mission.id);
        await this.handleTimeout(mission, state);
      }
    );
  }

  /**
   * Handle timeout for a state
   */
  private async handleTimeout(mission: Mission, state: MissionState): Promise<void> {
    // Get timeout target state
    let targetState: MissionState | null = null;

    // Check transition rules for timeout target
    for (const to of this.getValidNextStates(state)) {
      const timeoutTarget = getTimeoutTarget(state, to);
      if (timeoutTarget) {
        targetState = timeoutTarget;
        break;
      }
    }

    if (targetState) {
      const result = await this.transition(mission, targetState, "timeout");
      if (!result.success && this.config.on_error) {
        await this.config.on_error(
          mission,
          new Error(`Timeout transition failed: ${result.error}`)
        );
      }
    } else {
      // No timeout target - fail the mission
      await this.transition(mission, MissionState.FAILED, "timeout", "State timeout exceeded");
    }
  }

  /**
   * Transition to FAILED state
   */
  private async transitionToFailed(
    mission: Mission,
    trigger: TransitionTrigger,
    reason?: string
  ): Promise<TransitionResult> {
    const from = mission.state.current_state;

    // Exit current state
    await this.exitState(mission);

    // Create failed state info
    const failedInfo = createFailedStateInfo(
      from,
      reason || `Mission ${trigger} to FAILED`,
      this.collectPartialOutputs(mission),
      this.getRecoveryOptions(mission)
    );

    // Record transition
    const transition = this.createTransitionRecord(mission, MissionState.FAILED, trigger);

    // Update mission state
    const now = new Date();
    mission.state.previous_state = from;
    mission.state.current_state = MissionState.FAILED;
    mission.state.state_entered_at = now;
    mission.state.failed_info = failedInfo;
    mission.updated_at = now;
    mission.transitions.push(transition);

    // Enter FAILED state
    await this.enterState(mission);

    // Clean up
    this.cleanup(mission);

    return {
      success: true,
      new_state: MissionState.FAILED,
    };
  }

  /**
   * Collect partial outputs from mission
   */
  private collectPartialOutputs(mission: Mission): Record<string, unknown> {
    const partial: Record<string, unknown> = {};

    if (mission.state.evidence_pack) {
      partial.evidence_pack = mission.state.evidence_pack;
    }
    if (mission.state.analyst_outputs) {
      partial.analyst_outputs = mission.state.analyst_outputs;
    }
    if (mission.state.debate_records) {
      partial.debate_records = mission.state.debate_records;
    }
    if (mission.state.synthesis_output) {
      partial.synthesis_output = mission.state.synthesis_output;
    }

    return partial;
  }

  /**
   * Get recovery options for failed mission
   */
  private getRecoveryOptions(mission: Mission): string[] {
    const options: string[] = [];

    const state = mission.state.current_state;
    switch (state) {
      case MissionState.RESEARCHING:
        options.push("Retry research with different sources");
        options.push("Proceed with current evidence (if score >= 20)");
        options.push("Abort mission");
        break;

      case MissionState.ANALYZING:
        options.push("Retry with remaining agents");
        options.push("Proceed with partial analysis");
        options.push("Abort mission");
        break;

      case MissionState.DEBATING:
        options.push("Close debate with current round");
        options.push("Abort mission");
        break;

      case MissionState.SYNTHESIZING:
        options.push("Retry synthesis");
        options.push("Use partial synthesis");
        options.push("Abort mission");
        break;

      default:
        options.push("Retry mission");
        options.push("Abort mission");
    }

    return options;
  }

  /**
   * Get next state after a human gate
   */
  private getNextStateAfterGate(gate: MissionState): MissionState {
    switch (gate) {
      case MissionState.HUMAN_REVIEW_GATE_1:
        return MissionState.ANALYZING;

      case MissionState.HUMAN_REVIEW_GATE_2:
        return MissionState.DEBATING;

      case MissionState.HUMAN_REVIEW_GATE_3:
        return MissionState.DECIDED;

      default:
        throw new Error(`Unknown gate: ${gate}`);
    }
  }

  /**
   * Get valid next states for current state
   */
  private getValidNextStates(from: MissionState): MissionState[] {
    const stateDef = getStateDefinition(from);
    return stateDef.canTransitionTo;
  }

  /**
   * Create a transition record
   */
  private createTransitionRecord(
    mission: Mission,
    to: MissionState,
    trigger: TransitionTrigger
  ): StateTransition {
    const from = mission.state.current_state;
    const now = new Date();
    const duration = now.getTime() - mission.state.state_entered_at.getTime();

    return {
      mission_id: mission.id,
      from_state: from,
      to_state: to,
      timestamp: now,
      duration_ms: duration,
      trigger,
    };
  }

  /**
   * Generate human gate message
   */
  private generateHumanGateMessage(mission: Mission): string {
    const state = mission.state.current_state;
    const lines: string[] = [];

    lines.push("\n[HUMAN REVIEW REQUIRED]");
    lines.push(`Mission: ${mission.id}`);
    lines.push(`State: ${state}`);
    lines.push("");

    switch (state) {
      case MissionState.HUMAN_REVIEW_GATE_1:
        lines.push("Reason: Evidence score below threshold");
        lines.push("");
        if (mission.state.evidence_pack) {
          const ev = mission.state.evidence_pack;
          lines.push(`Summary:`);
          lines.push(`  Evidence score: ${ev.evidence_score}/100`);
          lines.push(`  Critical gaps: ${ev.data_gaps.length}`);
        }
        lines.push("");
        lines.push("Actions:");
        lines.push("  [1] Proceed with current evidence");
        lines.push("  [2] Add research data");
        lines.push("  [3] Abort mission");
        break;

      case MissionState.HUMAN_REVIEW_GATE_2:
        lines.push("Reason: Optional review of individual analyses");
        lines.push("");
        lines.push("Actions:");
        lines.push("  [1] Continue to debate");
        lines.push("  [2] Skip (auto-proceed in 60s)");
        break;

      case MissionState.HUMAN_REVIEW_GATE_3:
        lines.push("Reason: Decision review required");
        lines.push("");
        if (mission.state.decision) {
          const dec = mission.state.decision;
          lines.push(`Decision State: ${dec.decision_state}`);
          lines.push(`Fair Value: ${dec.fair_value_conservative}`);
          lines.push(`Price to Watch: ${dec.price_to_watch}`);
          lines.push("");
          lines.push("Thesis Breakers:");
          for (const breaker of dec.thesis_breakers) {
            lines.push(`  - ${breaker}`);
          }
        }
        lines.push("");
        lines.push("Actions:");
        lines.push("  [1] Confirm Decision");
        lines.push("  [2] Revise Assumptions");
        lines.push("  [3] Abort");
        break;
    }

    lines.push("");
    return lines.join("\n");
  }

  /**
   * Generate unique mission ID
   */
  private generateMissionId(brief: Brief): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const ticker = brief.ticker || "mission";
    return `${ticker}-${timestamp}-${random}`;
  }
}

/**
 * Factory function to create state machine with config
 */
export function createStateMachine(
  config?: Partial<StateMachineConfig>
): MissionStateMachine {
  return new MissionStateMachine(config);
}
