/**
 * Mission State Machine Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  MissionStateMachine,
  createStateMachine,
} from "../state-machine.js";
import {
  MissionState,
  DecisionState,
  Brief,
  HumanGateAction,
} from "../types.js";
import { DEFAULT_TIMEOUTS } from "../timeouts.js";

// Mock timeout functions for testing
vi.mock("../timeouts.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../timeouts.js")>();
  return {
    ...actual,
    timeoutManager: {
      startTimeout: vi.fn(),
      clearTimeout: vi.fn(),
      cleanup: vi.fn(),
      isTimedOut: vi.fn(() => false),
      getElapsedTime: vi.fn(() => 1000),
      getRemainingTime: vi.fn(() => 5000),
    },
  };
});

describe("MissionStateMachine", () => {
  let stateMachine: MissionStateMachine;
  let validBrief: Brief;

  beforeEach(() => {
    stateMachine = createStateMachine({
      enable_timeouts: false, // Disable for most tests
      persist_transitions: false,
    });

    validBrief = {
      type: "stock_analysis",
      domain: "investment-war-room",
      ticker: "MCS",
      description: "Analyze MCS stock",
    };
  });

  describe("createMission", () => {
    it("should create a mission in DRAFT state", () => {
      const mission = stateMachine.createMission(validBrief);

      expect(mission.id).toBeDefined();
      expect(mission.state.current_state).toBe(MissionState.DRAFT);
      expect(mission.state.brief).toEqual(validBrief);
      expect(mission.transitions).toHaveLength(0);
    });

    it("should generate unique mission IDs", () => {
      const mission1 = stateMachine.createMission(validBrief);
      const mission2 = stateMachine.createMission(validBrief);

      expect(mission1.id).not.toBe(mission2.id);
    });
  });

  describe("transition - DRAFT to PLANNING", () => {
    it("should transition successfully with valid brief", async () => {
      const mission = stateMachine.createMission(validBrief);

      const result = await stateMachine.transition(
        mission,
        MissionState.PLANNING
      );

      expect(result.success).toBe(true);
      expect(result.new_state).toBe(MissionState.PLANNING);
      expect(mission.state.current_state).toBe(MissionState.PLANNING);
      expect(mission.state.previous_state).toBe(MissionState.DRAFT);
      expect(mission.transitions).toHaveLength(1);
    });

    it("should fail transition with invalid brief", async () => {
      const invalidBrief: Brief = {
        type: "stock_analysis",
        domain: "",
        description: "",
      };
      const mission = stateMachine.createMission(invalidBrief);

      const result = await stateMachine.transition(
        mission,
        MissionState.PLANNING
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(mission.state.current_state).toBe(MissionState.DRAFT);
    });
  });

  describe("transition - PLANNING to RESEARCHING", () => {
    it("should transition when config is ready", async () => {
      const mission = stateMachine.createMission(validBrief);
      await stateMachine.transition(mission, MissionState.PLANNING);

      // Set up mission config
      mission.state.config = {
        mission_id: mission.id,
        domain: "investment-war-room",
        mission_type: "stock_analysis",
        ticker: "MCS",
        brief: validBrief,
        required_agents: ["researcher-set", "damodaran-valuation"],
        evidence_requirements: {
          minimum_sources: [{ tier: "tier_1", count: 3 }],
          required_documents: ["56-1"],
        },
        human_checkpoints: [],
        created_at: new Date(),
      };

      const result = await stateMachine.transition(
        mission,
        MissionState.RESEARCHING
      );

      expect(result.success).toBe(true);
      expect(result.new_state).toBe(MissionState.RESEARCHING);
    });

    it("should fail transition without config", async () => {
      const mission = stateMachine.createMission(validBrief);
      await stateMachine.transition(mission, MissionState.PLANNING);

      const result = await stateMachine.transition(
        mission,
        MissionState.RESEARCHING
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("config");
    });
  });

  describe("transition - RESEARCHING to ANALYZING", () => {
    it("should transition when evidence score >= 40", async () => {
      const mission = stateMachine.createMission(validBrief);
      mission.state.current_state = MissionState.RESEARCHING;
      mission.state.evidence_pack = {
        sources_found: 5,
        tier1_sources: 3,
        tier2_sources: 2,
        tier3_sources: 0,
        evidence_score: 72,
        data_gaps: [],
      };

      const result = await stateMachine.transition(
        mission,
        MissionState.ANALYZING
      );

      expect(result.success).toBe(true);
      expect(result.new_state).toBe(MissionState.ANALYZING);
    });

    it("should fail transition when evidence score < 40", async () => {
      const mission = stateMachine.createMission(validBrief);
      mission.state.current_state = MissionState.RESEARCHING;
      mission.state.evidence_pack = {
        sources_found: 2,
        tier1_sources: 1,
        tier2_sources: 1,
        tier3_sources: 0,
        evidence_score: 25,
        data_gaps: ["Missing critical data"],
      };

      const result = await stateMachine.transition(
        mission,
        MissionState.ANALYZING
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("below threshold");
    });
  });

  describe("transition - RESEARCHING to HUMAN_REVIEW_GATE_1", () => {
    it("should transition when evidence score < 40", async () => {
      const mission = stateMachine.createMission(validBrief);
      mission.state.current_state = MissionState.RESEARCHING;
      mission.state.evidence_pack = {
        sources_found: 2,
        tier1_sources: 1,
        tier2_sources: 1,
        tier3_sources: 0,
        evidence_score: 25,
        data_gaps: ["Missing critical data"],
      };

      const result = await stateMachine.transition(
        mission,
        MissionState.HUMAN_REVIEW_GATE_1
      );

      expect(result.success).toBe(true);
      expect(result.new_state).toBe(MissionState.HUMAN_REVIEW_GATE_1);
      expect(result.requires_human_input).toBe(true);
    });
  });

  describe("transition - DECIDED to JOURNALED", () => {
    it("should transition when decision is valid", async () => {
      const mission = stateMachine.createMission(validBrief);
      mission.state.current_state = MissionState.DECIDED;
      mission.state.decision = {
        decision_state: DecisionState.WAIT_FOR_PRICE,
        fair_value_conservative: 28.5,
        price_to_watch: 24.0,
        thesis_breakers: ["Q2 earnings < 100M"],
        follow_up_events: [
          {
            event: "Q2 earnings",
            expected_date: new Date("2026-08-15"),
            watch_for: "Earnings validation",
          },
        ],
      };

      const result = await stateMachine.transition(
        mission,
        MissionState.JOURNALED
      );

      expect(result.success).toBe(true);
      expect(result.new_state).toBe(MissionState.JOURNALED);
    });

    it("should fail transition without valid decision", async () => {
      const mission = stateMachine.createMission(validBrief);
      mission.state.current_state = MissionState.DECIDED;
      mission.state.decision = {
        decision_state: DecisionState.WAIT_FOR_PRICE,
        fair_value_conservative: 28.5,
        price_to_watch: 24.0,
        thesis_breakers: [], // Empty - should fail
        follow_up_events: [],
      };

      const result = await stateMachine.transition(
        mission,
        MissionState.JOURNALED
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("thesis_breakers");
    });
  });

  describe("transition to FAILED", () => {
    it("should transition to FAILED on error trigger", async () => {
      const mission = stateMachine.createMission(validBrief);
      await stateMachine.transition(mission, MissionState.PLANNING);

      const result = await stateMachine.transition(
        mission,
        MissionState.FAILED,
        "error",
        "Adapter error"
      );

      expect(result.success).toBe(true);
      expect(result.new_state).toBe(MissionState.FAILED);
      expect(mission.state.failed_info).toBeDefined();
      expect(mission.state.failed_info?.failure_reason).toBe("Adapter error");
      expect(mission.state.failed_info?.original_state).toBe(MissionState.PLANNING);
    });

    it("should collect partial outputs when failing", async () => {
      const mission = stateMachine.createMission(validBrief);
      mission.state.current_state = MissionState.ANALYZING;
      mission.state.evidence_pack = {
        sources_found: 5,
        tier1_sources: 3,
        tier2_sources: 2,
        tier3_sources: 0,
        evidence_score: 72,
        data_gaps: [],
      };
      mission.state.analyst_outputs = {
        damodaran: { fair_value: 34.2 },
      };

      await stateMachine.transition(
        mission,
        MissionState.FAILED,
        "error",
        "Agent timeout"
      );

      expect(mission.state.failed_info?.partial_outputs).toBeDefined();
      expect(mission.state.failed_info?.partial_outputs.evidence_pack).toBeDefined();
      expect(mission.state.failed_info?.partial_outputs.analyst_outputs).toBeDefined();
    });
  });

  describe("handleHumanGateAction", () => {
    it("should handle proceed action at GATE_1", async () => {
      const mission = stateMachine.createMission(validBrief);
      mission.state.current_state = MissionState.HUMAN_REVIEW_GATE_1;
      mission.state.evidence_pack = {
        sources_found: 2,
        tier1_sources: 1,
        tier2_sources: 1,
        tier3_sources: 0,
        evidence_score: 25,
        data_gaps: [],
      };

      const result = await stateMachine.handleHumanGateAction(
        mission,
        "proceed" as HumanGateAction
      );

      expect(result.success).toBe(true);
      expect(result.new_state).toBe(MissionState.ANALYZING);
    });

    it("should handle skip action at GATE_2", async () => {
      const mission = stateMachine.createMission(validBrief);
      mission.state.current_state = MissionState.HUMAN_REVIEW_GATE_2;

      const result = await stateMachine.handleHumanGateAction(
        mission,
        "skip" as HumanGateAction
      );

      expect(result.success).toBe(true);
      expect(result.new_state).toBe(MissionState.DEBATING);
    });

    it("should handle abort action", async () => {
      const mission = stateMachine.createMission(validBrief);
      mission.state.current_state = MissionState.HUMAN_REVIEW_GATE_3;

      const result = await stateMachine.handleHumanGateAction(
        mission,
        "abort" as HumanGateAction
      );

      expect(result.success).toBe(true);
      expect(result.new_state).toBe(MissionState.FAILED);
    });

    it("should fail for non-human-review states", async () => {
      const mission = stateMachine.createMission(validBrief);
      mission.state.current_state = MissionState.PLANNING;

      const result = await stateMachine.handleHumanGateAction(
        mission,
        "proceed" as HumanGateAction
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("not a human review gate");
    });
  });

  describe("state queries", () => {
    it("should know if mission is terminal", () => {
      const mission = stateMachine.createMission(validBrief);
      mission.state.current_state = MissionState.JOURNALED;

      expect(stateMachine.isTerminal(mission)).toBe(true);

      mission.state.current_state = MissionState.DRAFT;
      expect(stateMachine.isTerminal(mission)).toBe(false);
    });

    it("should know if mission is waiting for human", () => {
      const mission = stateMachine.createMission(validBrief);
      mission.state.current_state = MissionState.HUMAN_REVIEW_GATE_1;

      expect(stateMachine.isWaitingForHuman(mission)).toBe(true);

      mission.state.current_state = MissionState.ANALYZING;
      expect(stateMachine.isWaitingForHuman(mission)).toBe(false);
    });

    it("should get time in current state", () => {
      const mission = stateMachine.createMission(validBrief);
      const time = stateMachine.getTimeInCurrentState(mission);

      expect(time).toBeGreaterThanOrEqual(0);
      expect(time).toBeLessThan(100); // Should be very recent
    });
  });

  describe("terminal state transitions", () => {
    it("should not allow transitions from terminal states", async () => {
      const mission = stateMachine.createMission(validBrief);
      mission.state.current_state = MissionState.JOURNALED;

      const result = await stateMachine.transition(
        mission,
        MissionState.DECIDED
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("terminal state");
    });
  });

  describe("invalid transitions", () => {
    it("should reject invalid state transitions", async () => {
      const mission = stateMachine.createMission(validBrief);
      mission.state.current_state = MissionState.DRAFT;

      // Can't go from DRAFT to ANALYZING directly
      const result = await stateMachine.transition(
        mission,
        MissionState.ANALYZING
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid transition");
    });
  });

  describe("transition history", () => {
    it("should record all transitions", async () => {
      const mission = stateMachine.createMission(validBrief);

      await stateMachine.transition(mission, MissionState.PLANNING);

      // Set up mission config to enable PLANNING -> RESEARCHING transition
      mission.state.config = {
        mission_id: mission.id,
        domain: "investment-war-room",
        mission_type: "stock_analysis",
        ticker: "MCS",
        brief: validBrief,
        required_agents: ["researcher-set"],
        evidence_requirements: {
          minimum_sources: [{ tier: "tier_1", count: 3 }],
          required_documents: [],
        },
        human_checkpoints: [],
        created_at: new Date(),
      };

      await stateMachine.transition(mission, MissionState.RESEARCHING);

      const history = stateMachine.getStateHistory(mission);

      expect(history).toHaveLength(2);
      expect(history[0].from_state).toBe(MissionState.DRAFT);
      expect(history[0].to_state).toBe(MissionState.PLANNING);
      expect(history[1].from_state).toBe(MissionState.PLANNING);
      expect(history[1].to_state).toBe(MissionState.RESEARCHING);
    });
  });

  describe("cleanup", () => {
    it("should cleanup mission resources", () => {
      const mission = stateMachine.createMission(validBrief);

      stateMachine.cleanup(mission);

      // No assertions - just verify no error thrown
      expect(true).toBe(true);
    });
  });
});

describe("Timeout Configuration", () => {
  it("should have timeout for each state", () => {
    const states = [
      MissionState.DRAFT,
      MissionState.PLANNING,
      MissionState.RESEARCHING,
      MissionState.ANALYZING,
      MissionState.CROSS_QA,
      MissionState.DEBATING,
      MissionState.SYNTHESIZING,
      MissionState.HUMAN_REVIEW_GATE_2,
    ];

    for (const state of states) {
      const config = DEFAULT_TIMEOUTS[state];
      expect(config).toBeDefined();
    }
  });

  it("should have no timeout for mandatory human gates", () => {
    const gate1Config = DEFAULT_TIMEOUTS[MissionState.HUMAN_REVIEW_GATE_1];
    const gate3Config = DEFAULT_TIMEOUTS[MissionState.HUMAN_REVIEW_GATE_3];

    expect(gate1Config.total_ms).toBeUndefined();
    expect(gate1Config.auto_proceed_ms).toBeUndefined();
    expect(gate3Config.total_ms).toBeUndefined();
    expect(gate3Config.auto_proceed_ms).toBeUndefined();
  });

  it("should have auto-proceed for optional human gate", () => {
    const gate2Config = DEFAULT_TIMEOUTS[MissionState.HUMAN_REVIEW_GATE_2];

    expect(gate2Config.auto_proceed_ms).toBe(60000); // 60 seconds
  });
});
