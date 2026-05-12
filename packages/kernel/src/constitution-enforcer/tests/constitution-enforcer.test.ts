/**
 * Constitution Enforcer Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  ConstitutionEnforcer,
  createConstitutionEnforcer,
} from "../constitution-enforcer.js";
import {
  ConstitutionRule,
  RuleContext,
  EnforcementLevel,
  ExceptionType,
} from "../types.js";

describe("ConstitutionEnforcer", () => {
  let enforcer: ConstitutionEnforcer;
  let sampleRules: ConstitutionRule[];

  beforeEach(() => {
    enforcer = createConstitutionEnforcer();

    // Create sample rules for testing
    sampleRules = [
      {
        id: "test_rule_1",
        name: "Test Rule 1",
        description: "A test rule",
        version: "1.0",
        domain: "test-domain",
        enforcement: EnforcementLevel.REJECT_OUTPUT,
        applies_to: "all_agents",
        exception: ExceptionType.NONE,
        validation: {
          criteria: ["Field X is required"],
          required_fields: ["field_x"],
        },
      },
      {
        id: "test_rule_2",
        name: "Test Rule 2",
        description: "Another test rule",
        version: "1.0",
        domain: "test-domain",
        enforcement: EnforcementLevel.WARN_AND_FLAG,
        applies_to: ["analyst_agent_1", "analyst_agent_2"],
        exception: ExceptionType.NONE,
        validation: {
          criteria: ["WACC must be reasonable"],
          required_fields: ["wacc"],
          thresholds: {
            min_wacc: 5,
            max_wacc: 15,
          },
        },
      },
      {
        id: "test_rule_3",
        name: "Test Rule 3",
        description: "Forbidden content test",
        version: "1.0",
        domain: "test-domain",
        enforcement: EnforcementLevel.REJECT_OUTPUT,
        applies_to: "all_agents",
        exception: ExceptionType.NONE,
        validation: {
          criteria: ["No forbidden words"],
          forbidden_content: ["buy", "sell"],
        },
      },
      {
        id: "test_rule_4",
        name: "Test Rule 4",
        description: "Conviction level test",
        version: "1.0",
        domain: "test-domain",
        enforcement: EnforcementLevel.REJECT_OUTPUT,
        applies_to: "all_analyst_agents",
        exception: ExceptionType.NONE,
        validation: {
          criteria: ["Conviction required"],
          required_fields: ["conviction_level"],
          thresholds: {
            low: 4,
            high: 7,
          },
        },
      },
      {
        id: "test_rule_5",
        name: "Test Rule 5",
        description: "Evidence score test",
        version: "1.0",
        domain: "test-domain",
        enforcement: EnforcementLevel.INSERT_HUMAN_REVIEW,
        applies_to: "all_agents",
        exception: ExceptionType.NONE,
        validation: {
          criteria: ["Evidence score check"],
          thresholds: {
            very_low: 20,
            low: 40,
            conditional: 70,
          },
        },
      },
    ];

    // Load sample constitution
    enforcer.loadConstitution("test-domain", {
      domain: "test-domain",
      version: "1.0",
      rules: sampleRules,
      loaded_at: new Date(),
      source_file: "test",
    });
  });

  afterEach(() => {
    enforcer.clear();
  });

  describe("loadConstitution", () => {
    it("should load a constitution from object", () => {
      const constitution = enforcer.loadConstitution("new-domain", {
        domain: "new-domain",
        version: "1.0",
        rules: [],
        loaded_at: new Date(),
        source_file: "memory",
      });

      expect(constitution.domain).toBe("new-domain");
      expect(enforcer.getConstitution("new-domain")).toBeDefined();
    });
  });

  describe("getConstitution", () => {
    it("should return constitution for a domain", () => {
      const constitution = enforcer.getConstitution("test-domain");

      expect(constitution).toBeDefined();
      expect(constitution?.domain).toBe("test-domain");
      expect(constitution?.rules).toHaveLength(5);
    });

    it("should return undefined for unknown domain", () => {
      const constitution = enforcer.getConstitution("unknown-domain");

      expect(constitution).toBeUndefined();
    });
  });

  describe("ruleAppliesToAgent", () => {
    it("should return true for all_agents", () => {
      const rule = sampleRules[0]; // all_agents

      expect(enforcer.ruleAppliesToAgent(rule, "any_agent")).toBe(true);
      expect(enforcer.ruleAppliesToAgent(rule, "researcher")).toBe(true);
    });

    it("should return true for agents in list", () => {
      const rule = sampleRules[1]; // specific agents

      expect(enforcer.ruleAppliesToAgent(rule, "analyst_agent_1")).toBe(true);
      expect(enforcer.ruleAppliesToAgent(rule, "analyst_agent_2")).toBe(true);
      expect(enforcer.ruleAppliesToAgent(rule, "other_agent")).toBe(false);
    });

    it("should return true for analyst agents", () => {
      const rule: ConstitutionRule = {
        ...sampleRules[0],
        applies_to: "all_analyst_agents",
      };

      expect(enforcer.ruleAppliesToAgent(rule, "valuation_analyst")).toBe(true);
      expect(enforcer.ruleAppliesToAgent(rule, "downside_analyst")).toBe(true);
      expect(enforcer.ruleAppliesToAgent(rule, "researcher")).toBe(false);
    });
  });

  describe("getApplicableRules", () => {
    it("should return rules that apply to an agent", () => {
      const rules = enforcer.getApplicableRules("test-domain", "analyst_agent_1");

      expect(rules).toHaveLength(5); // All rules apply to all_agents or this specific agent
    });

    it("should filter rules for specific agents", () => {
      const rules = enforcer.getApplicableRules("test-domain", "other_agent");

      expect(rules.length).toBeGreaterThan(0); // all_agents rules still apply
      expect(rules.find((r) => r.id === "test_rule_2")).toBeUndefined(); // This only applies to specific agents
    });

    it("should return empty for unknown domain", () => {
      const rules = enforcer.getApplicableRules("unknown", "any_agent");

      expect(rules).toHaveLength(0);
    });
  });

  describe("enforceRule", () => {
    it("should pass rule with valid output", async () => {
      const rule = sampleRules[0];
      const context: RuleContext = {
        agent_id: "test_agent",
        mission_id: "test_mission",
        output: {
          field_x: "value",
        },
      };

      const result = await enforcer.enforceRule(rule, context);

      expect(result.result.approved).toBe(true);
      expect(result.result.violations).toHaveLength(0);
    });

    it("should fail rule with missing required field", async () => {
      const rule = sampleRules[0];
      const context: RuleContext = {
        agent_id: "test_agent",
        mission_id: "test_mission",
        output: {
          other_field: "value",
        },
      };

      const result = await enforcer.enforceRule(rule, context);

      expect(result.result.approved).toBe(false);
      expect(result.result.violations).toHaveLength(1);
      expect(result.result.violations[0].description).toContain("field_x");
    });

    it("should warn on threshold violation", async () => {
      const rule = sampleRules[1];
      const context: RuleContext = {
        agent_id: "analyst_agent_1",
        mission_id: "test_mission",
        output: {
          wacc: 20, // Above max threshold
        },
      };

      const result = await enforcer.enforceRule(rule, context);

      expect(result.enforcement).toBe(EnforcementLevel.WARN_AND_FLAG);
      expect(result.result.violations.length).toBeGreaterThan(0);
    });

    it("should detect forbidden content", async () => {
      const rule = sampleRules[2];
      const context: RuleContext = {
        agent_id: "test_agent",
        mission_id: "test_mission",
        output: {
          analysis: "I recommend you buy this stock",
        },
      };

      const result = await enforcer.enforceRule(rule, context);

      expect(result.result.approved).toBe(false);
      expect(result.result.violations).toHaveLength(1);
      expect(result.result.violations[0].description).toContain("buy");
    });

    it("should check conviction level", async () => {
      const rule = sampleRules[3];
      const context: RuleContext = {
        agent_id: "valuation_analyst",
        mission_id: "test_mission",
        output: {
          conviction_level: 6,
        },
      };

      const result = await enforcer.enforceRule(rule, context);

      expect(result.result.approved).toBe(true);
    });

    it("should reject missing conviction", async () => {
      const rule = sampleRules[3];

      const context: RuleContext = {
        agent_id: "valuation_analyst",
        mission_id: "test_mission",
        output: {},
      };

      const result = await enforcer.enforceRule(rule, context);

      expect(result.result.approved).toBe(false);
      expect(result.result.violations.length).toBeGreaterThan(0);
      expect(result.result.violations[0].description).toContain("Conviction");
    });
  });

  describe("checkViolations", () => {
    it("should approve clean output", async () => {
      const context: RuleContext = {
        agent_id: "test_agent",
        mission_id: "test_mission",
        output: {
          field_x: "value",
          conviction_level: 6,
          analysis: "This looks like a good opportunity",
          evidence_score: 75,
        },
      };

      const result = await enforcer.checkViolations("test-domain", "test_agent", context);

      expect(result.approved).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it("should detect multiple violations", async () => {
      const context: RuleContext = {
        agent_id: "test_agent",
        mission_id: "test_mission",
        output: {
          analysis: "I recommend you buy this stock",
          evidence_score: 10, // Very low
        },
      };

      const result = await enforcer.checkViolations("test-domain", "test_agent", context);

      expect(result.approved).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
    });
  });

  describe("rule overrides", () => {
    it("should override a rule", async () => {
      const rule = sampleRules[0];
      const context: RuleContext = {
        agent_id: "test_agent",
        mission_id: "test_mission",
        output: {}, // Missing field_x
      };

      // Add override
      enforcer.addOverride({
        rule_id: rule.id,
        mission_id: "test_mission",
        override_type: ExceptionType.OWNER_EXPLICIT_OVERRIDE,
        reason: "Owner approved",
        granted_by: "owner",
        granted_at: new Date(),
      });

      const result = await enforcer.enforceRule(rule, context);

      expect(result.result.approved).toBe(true);
      expect(result.result.warnings).toHaveLength(1);
      expect(result.result.warnings[0]).toContain("overridden");
    });

    it("should remove override", () => {
      enforcer.addOverride({
        rule_id: "test_rule",
        mission_id: "test_mission",
        override_type: ExceptionType.OWNER_EXPLICIT_OVERRIDE,
        reason: "Test",
        granted_by: "owner",
        granted_at: new Date(),
      });

      expect(enforcer.hasOverride("test_rule", "test_mission")).toBe(true);

      enforcer.removeOverride("test_rule", "test_mission");

      expect(enforcer.hasOverride("test_rule", "test_mission")).toBe(false);
    });

    it("should get active overrides", () => {
      enforcer.addOverride({
        rule_id: "rule1",
        mission_id: "mission1",
        override_type: ExceptionType.OWNER_EXPLICIT_OVERRIDE,
        reason: "Test",
        granted_by: "owner",
        granted_at: new Date(),
      });

      const overrides = enforcer.getActiveOverrides();

      expect(overrides).toHaveLength(1);
      expect(overrides[0].rule_id).toBe("rule1");
    });
  });

  describe("shouldBlockMission", () => {
    it("should return true when BLOCK_MISSION rule violated", async () => {
      const context: RuleContext = {
        agent_id: "test_agent",
        mission_id: "test_mission",
        output: {},
      };

      // Create a BLOCK_MISSION rule
      const blockRule: ConstitutionRule = {
        id: "block_rule",
        name: "Block Rule",
        description: "Blocks mission",
        version: "1.0",
        domain: "test-domain",
        enforcement: EnforcementLevel.BLOCK_MISSION,
        applies_to: "all_agents",
        exception: ExceptionType.NONE,
        validation: {
          criteria: ["Must have required_field"],
          required_fields: ["required_field"],
        },
      };

      await enforcer.enforceRule(blockRule, context);

      expect(enforcer.shouldBlockMission("test_mission")).toBe(true);
    });

    it("should return false when no violations", () => {
      expect(enforcer.shouldBlockMission("no_violations_mission")).toBe(false);
    });
  });

  describe("shouldInsertHumanReview", () => {
    it("should return true when INSERT_HUMAN_REVIEW rule violated", async () => {
      const context: RuleContext = {
        agent_id: "test_agent",
        mission_id: "test_mission",
        output: {
          evidence_score: 10, // Very low
        },
      };

      await enforcer.checkViolations("test-domain", "test_agent", context);

      expect(enforcer.shouldInsertHumanReview("test_mission")).toBe(true);
    });

    it("should return false when no review violations", () => {
      expect(enforcer.shouldInsertHumanReview("no_violations_mission")).toBe(false);
    });
  });

  describe("getCheckSummary", () => {
    it("should return summary for mission", async () => {
      const context: RuleContext = {
        agent_id: "test_agent",
        mission_id: "summary_test",
        output: {
          field_x: "value",
        },
      };

      await enforcer.checkViolations("test-domain", "test_agent", context);

      const summary = enforcer.getCheckSummary("summary_test", "test-domain");

      expect(summary.total_rules).toBe(5);
      expect(summary.rules_passed).toBeGreaterThan(0);
      expect(summary.blocked).toBe(false);
    });
  });

  describe("violation history", () => {
    it("should record violations", async () => {
      const context: RuleContext = {
        agent_id: "test_agent",
        mission_id: "history_test",
        output: {},
      };

      await enforcer.checkViolations("test-domain", "test_agent", context);

      const violations = enforcer.getMissionViolations("history_test");

      expect(violations.length).toBeGreaterThan(0);
    });

    it("should clear mission violations", async () => {
      const context: RuleContext = {
        agent_id: "test_agent",
        mission_id: "clear_test",
        output: {},
      };

      await enforcer.checkViolations("test-domain", "test_agent", context);
      expect(enforcer.getMissionViolations("clear_test").length).toBeGreaterThan(0);

      enforcer.clearMissionViolations("clear_test");

      expect(enforcer.getMissionViolations("clear_test")).toHaveLength(0);
    });
  });

  describe("retry policy", () => {
    it("should require retry on first rejection", async () => {
      const rule = sampleRules[0]; // REJECT_OUTPUT
      const context: RuleContext = {
        agent_id: "test_agent",
        mission_id: "retry_test",
        output: {}, // Missing field_x
      };

      const result = await enforcer.enforceRule(rule, context);

      expect(result.result.approved).toBe(false);
      expect(result.result.retry_required).toBe(true);
      expect(result.result.retry_instructions).toBeDefined();
    });

    it("should mark agent failed after second violation", async () => {
      const rule = sampleRules[0];
      const context: RuleContext = {
        agent_id: "test_agent",
        mission_id: "fail_test",
        output: {}, // Missing field_x
      };

      // First violation
      await enforcer.enforceRule(rule, context);
      // Second violation
      const result = await enforcer.enforceRule(rule, context);

      expect(result.result.agent_failed).toBe(true);
    });
  });
});

describe("EnforcementLevel", () => {
  it("should have all required levels", () => {
    expect(EnforcementLevel.BLOCK_MISSION).toBe("BLOCK_MISSION");
    expect(EnforcementLevel.INSERT_HUMAN_REVIEW).toBe("INSERT_HUMAN_REVIEW");
    expect(EnforcementLevel.WARN_AND_FLAG).toBe("WARN_AND_FLAG");
    expect(EnforcementLevel.REJECT_OUTPUT).toBe("REJECT_OUTPUT");
  });
});
