/**
 * Timeout Configuration
 *
 * Defines timeout values for each state as specified in MISSION_LIFECYCLE.md
 */

import { MissionState } from "./types.js";

/**
 * Timeout configuration in milliseconds
 */
export interface TimeoutConfig {
  per_agent_ms?: number;  // Timeout per agent (for parallel states)
  total_ms?: number;      // Total timeout for the state
  auto_proceed_ms?: number; // Auto-proceed timeout (for human gates)
}

/**
 * Default timeout configurations
 */
export const DEFAULT_TIMEOUTS: Record<MissionState, TimeoutConfig> = {
  [MissionState.DRAFT]: {
    total_ms: 30000, // 30 seconds to validate brief
  },

  [MissionState.PLANNING]: {
    total_ms: 60000, // 1 minute to build team
  },

  [MissionState.RESEARCHING]: {
    per_agent_ms: 180000, // 3 minutes per researcher
    total_ms: 600000, // 10 minutes max total
  },

  [MissionState.HUMAN_REVIEW_GATE_1]: {
    // No timeout - wait indefinitely for owner
  },

  [MissionState.ANALYZING]: {
    per_agent_ms: 120000, // 2 minutes per analyst
    total_ms: 600000, // 10 minutes max total
  },

  [MissionState.HUMAN_REVIEW_GATE_2]: {
    auto_proceed_ms: 60000, // 60 seconds auto-proceed
  },

  [MissionState.CROSS_QA]: {
    total_ms: 90000, // 90 seconds
  },

  [MissionState.DEBATING]: {
    per_agent_ms: 120000, // 2 minutes per round
    total_ms: 600000, // 10 minutes max
  },

  [MissionState.SYNTHESIZING]: {
    total_ms: 120000, // 2 minutes
  },

  [MissionState.HUMAN_REVIEW_GATE_3]: {
    // No timeout - mandatory gate, wait indefinitely
  },

  [MissionState.DECIDED]: {
    total_ms: 30000, // 30 seconds to validate decision
  },

  [MissionState.JOURNALED]: {
    // Terminal state - no timeout
  },

  [MissionState.FAILED]: {
    // Terminal state - no timeout
  },
};

/**
 * Timeout manager for tracking state timeouts
 */
export class TimeoutManager {
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private stateStartTimes: Map<string, Date> = new Map();

  /**
   * Start tracking timeout for a mission in a state
   */
  startTimeout(
    missionId: string,
    state: MissionState,
    config: TimeoutConfig,
    onTimeout: () => void
  ): void {
    // Clear any existing timer
    this.clearTimeout(missionId);

    // Record state start time
    this.stateStartTimes.set(missionId, new Date());

    const timeoutMs = this.calculateTimeout(missionId, state, config);
    if (timeoutMs !== null && timeoutMs > 0) {
      const timer = setTimeout(onTimeout, timeoutMs);
      this.timers.set(missionId, timer);
    }
  }

  /**
   * Calculate the effective timeout for a state
   */
  private calculateTimeout(
    missionId: string,
    state: MissionState,
    config: TimeoutConfig
  ): number | null {
    if (config.total_ms !== undefined) {
      return config.total_ms;
    }
    if (config.auto_proceed_ms !== undefined) {
      return config.auto_proceed_ms;
    }
    if (config.per_agent_ms !== undefined) {
      // Per-agent timeout - caller must handle count
      return config.per_agent_ms;
    }
    return null;
  }

  /**
   * Clear timeout for a mission
   */
  clearTimeout(missionId: string): void {
    const timer = this.timers.get(missionId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(missionId);
    }
  }

  /**
   * Get time elapsed since state entry
   */
  getElapsedTime(missionId: string): number | null {
    const startTime = this.stateStartTimes.get(missionId);
    if (!startTime) return null;
    return Date.now() - startTime.getTime();
  }

  /**
   * Get remaining time before timeout
   */
  getRemainingTime(
    missionId: string,
    state: MissionState,
    config: TimeoutConfig
  ): number | null {
    const elapsed = this.getElapsedTime(missionId);
    const total = this.calculateTimeout(missionId, state, config);

    if (elapsed === null || total === null) return null;
    return Math.max(0, total - elapsed);
  }

  /**
   * Check if a mission has timed out
   */
  isTimedOut(
    missionId: string,
    state: MissionState,
    config: TimeoutConfig
  ): boolean {
    const remaining = this.getRemainingTime(missionId, state, config);
    return remaining !== null && remaining <= 0;
  }

  /**
   * Clean up all timers for a mission
   */
  cleanup(missionId: string): void {
    this.clearTimeout(missionId);
    this.stateStartTimes.delete(missionId);
  }

  /**
   * Get timeout configuration for a state
   */
  static getTimeout(state: MissionState): TimeoutConfig {
    return DEFAULT_TIMEOUTS[state] || {};
  }

  /**
   * Set custom timeout for a state (for testing or overrides)
   */
  static setTimeout(state: MissionState, config: TimeoutConfig): void {
    DEFAULT_TIMEOUTS[state] = config;
  }
}

/**
 * Global timeout manager instance
 */
export const timeoutManager = new TimeoutManager();
