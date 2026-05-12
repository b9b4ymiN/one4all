/**
 * Format Utility Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  formatState,
  formatDecisionState,
  formatTimestamp,
  formatDuration,
  formatNumber,
  formatCurrency,
  createTable,
  addTableRow,
  formatHealth,
  formatEvidenceTier,
  formatEnforcementLevel,
  success,
  error,
  warning,
  info,
  header,
  kv,
} from "../src/lib/format.js";

describe("format utilities", () => {
  describe("formatState", () => {
    it("should format DRAFT state", () => {
      const result = formatState("DRAFT");
      expect(result).toContain("DRAFT");
    });

    it("should format PLANNING state", () => {
      const result = formatState("PLANNING");
      expect(result).toContain("PLANNING");
    });

    it("should format RESEARCHING state", () => {
      const result = formatState("RESEARCHING");
      expect(result).toContain("RESEARCHING");
    });

    it("should format ANALYZING state", () => {
      const result = formatState("ANALYZING");
      expect(result).toContain("ANALYZING");
    });

    it("should format CROSS_QA state", () => {
      const result = formatState("CROSS_QA");
      expect(result).toContain("CROSS_QA");
    });

    it("should format DEBATING state", () => {
      const result = formatState("DEBATING");
      expect(result).toContain("DEBATING");
    });

    it("should format SYNTHESIZING state", () => {
      const result = formatState("SYNTHESIZING");
      expect(result).toContain("SYNTHESIZING");
    });

    it("should format HUMAN_REVIEW_GATE states", () => {
      const result1 = formatState("HUMAN_REVIEW_GATE_1");
      expect(result1).toContain("HUMAN_REVIEW_GATE_1");

      const result2 = formatState("HUMAN_REVIEW_GATE_2");
      expect(result2).toContain("HUMAN_REVIEW_GATE_2");

      const result3 = formatState("HUMAN_REVIEW_GATE_3");
      expect(result3).toContain("HUMAN_REVIEW_GATE_3");
    });

    it("should format DECIDED state", () => {
      const result = formatState("DECIDED");
      expect(result).toContain("DECIDED");
    });

    it("should format JOURNALED state", () => {
      const result = formatState("JOURNALED");
      expect(result).toContain("JOURNALED");
    });

    it("should format FAILED state", () => {
      const result = formatState("FAILED");
      expect(result).toContain("FAILED");
    });

    it("should format unknown state", () => {
      const result = formatState("UNKNOWN_STATE");
      expect(result).toContain("UNKNOWN_STATE");
    });
  });

  describe("formatDecisionState", () => {
    it("should format positive states", () => {
      expect(formatDecisionState("HOLD")).toContain("HOLD");
      expect(formatDecisionState("STARTER_POSITION")).toContain("STARTER_POSITION");
      expect(formatDecisionState("CORE_CANDIDATE")).toContain("CORE_CANDIDATE");
    });

    it("should format negative states", () => {
      expect(formatDecisionState("REJECT")).toContain("REJECT");
      expect(formatDecisionState("WATCH")).toContain("WATCH");
      expect(formatDecisionState("EXIT_THESIS_BROKEN")).toContain("EXIT_THESIS_BROKEN");
    });

    it("should format neutral states", () => {
      expect(formatDecisionState("TRIM")).toContain("TRIM");
      expect(formatDecisionState("ADD_ON_WEAKNESS")).toContain("ADD_ON_WEAKNESS");
      expect(formatDecisionState("WAIT_FOR_PRICE")).toContain("WAIT_FOR_PRICE");
    });

    it("should format pending states", () => {
      expect(formatDecisionState("RESEARCH_MORE")).toContain("RESEARCH_MORE");
    });

    it("should format unknown state", () => {
      const result = formatDecisionState("UNKNOWN_STATE");
      expect(result).toContain("UNKNOWN_STATE");
    });
  });

  describe("formatTimestamp", () => {
    it("should format Date object", () => {
      const date = new Date("2026-05-12T10:30:00Z");
      const result = formatTimestamp(date);
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });

    it("should format date string", () => {
      const result = formatTimestamp("2026-05-12T10:30:00Z");
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });

    it("should handle invalid date string", () => {
      const result = formatTimestamp("invalid-date");
      expect(typeof result).toBe("string");
    });
  });

  describe("formatDuration", () => {
    it("should format seconds", () => {
      const result = formatDuration(5000);
      expect(result).toContain("5s");
    });

    it("should format minutes and seconds", () => {
      const result = formatDuration(125000);
      expect(result).toContain("2m");
      expect(result).toContain("5s");
    });

    it("should format hours and minutes", () => {
      const result = formatDuration(3665000);
      expect(result).toContain("1h");
      expect(result).toContain("1m");
    });

    it("should format zero duration", () => {
      const result = formatDuration(0);
      expect(result).toContain("0s");
    });

    it("should format large duration", () => {
      const result = formatDuration(7265000);
      expect(result).toContain("2h");
      expect(result).toContain("1m");
    });
  });

  describe("formatNumber", () => {
    it("should format number with default precision", () => {
      const result = formatNumber(123.456);
      expect(result).toBe("123.46");
    });

    it("should format number with custom precision", () => {
      const result = formatNumber(123.456, 3);
      expect(result).toBe("123.456");
    });

    it("should format integer", () => {
      const result = formatNumber(123);
      expect(result).toBe("123.00");
    });

    it("should format negative number", () => {
      const result = formatNumber(-123.456);
      expect(result).toBe("-123.46");
    });

    it("should format zero", () => {
      const result = formatNumber(0);
      expect(result).toBe("0.00");
    });
  });

  describe("formatCurrency", () => {
    it("should format USD currency", () => {
      const result = formatCurrency(1234.56);
      expect(result).toContain("$");
      expect(result).toContain("1,234.56");
    });

    it("should format large amount", () => {
      const result = formatCurrency(1234567.89);
      expect(result).toContain("$");
      expect(result).toContain("1,234,567.89");
    });

    it("should format negative amount", () => {
      const result = formatCurrency(-123.45);
      expect(result).toContain("-");
    });

    it("should format zero", () => {
      const result = formatCurrency(0);
      expect(result).toContain("$0.00");
    });

    it("should format with custom currency", () => {
      const result = formatCurrency(1234.56, "EUR");
      expect(result).toContain("€");
    });
  });

  describe("formatHealth", () => {
    it("should format online status", () => {
      const result = formatHealth("API", "online");
      expect(result).toContain("API");
      expect(result).toContain("online");
    });

    it("should format offline status", () => {
      const result = formatHealth("Database", "offline");
      expect(result).toContain("Database");
      expect(result).toContain("OFFLINE");
    });

    it("should format degraded status", () => {
      const result = formatHealth("Cache", "degraded");
      expect(result).toContain("Cache");
      expect(result).toContain("degraded");
    });

    it("should include details when provided", () => {
      const result = formatHealth("API", "online", "Latency: 50ms");
      expect(result).toContain("Latency: 50ms");
    });

    it("should work without details", () => {
      const result = formatHealth("Service", "online");
      expect(result).toBeDefined();
      expect(typeof result).toBe("string");
    });
  });

  describe("formatEvidenceTier", () => {
    it("should format Tier 1", () => {
      const result = formatEvidenceTier(1);
      expect(result).toContain("Tier 1");
    });

    it("should format Tier 2", () => {
      const result = formatEvidenceTier(2);
      expect(result).toContain("Tier 2");
    });

    it("should format Tier 3", () => {
      const result = formatEvidenceTier(3);
      expect(result).toContain("Tier 3");
    });

    it("should format Tier 4", () => {
      const result = formatEvidenceTier(4);
      expect(result).toContain("Tier 4");
    });

    it("should format Tier 5", () => {
      const result = formatEvidenceTier(5);
      expect(result).toContain("Tier 5");
    });

    it("should format unknown tier", () => {
      const result = formatEvidenceTier(99);
      expect(result).toContain("Tier 99");
    });
  });

  describe("formatEnforcementLevel", () => {
    it("should format BLOCK_MISSION", () => {
      const result = formatEnforcementLevel("BLOCK_MISSION");
      expect(result).toContain("BLOCK_MISSION");
    });

    it("should format INSERT_HUMAN_REVIEW", () => {
      const result = formatEnforcementLevel("INSERT_HUMAN_REVIEW");
      expect(result).toContain("INSERT_HUMAN_REVIEW");
    });

    it("should format WARN_AND_FLAG", () => {
      const result = formatEnforcementLevel("WARN_AND_FLAG");
      expect(result).toContain("WARN_AND_FLAG");
    });

    it("should format REJECT_OUTPUT", () => {
      const result = formatEnforcementLevel("REJECT_OUTPUT");
      expect(result).toContain("REJECT_OUTPUT");
    });

    it("should format unknown level", () => {
      const result = formatEnforcementLevel("UNKNOWN_LEVEL");
      expect(result).toContain("UNKNOWN_LEVEL");
    });
  });

  describe("table utilities", () => {
    it("should create a table", () => {
      const table = createTable(["Col1", "Col2"]);
      expect(table).toBeDefined();
    });

    it("should add row to table", () => {
      const table = createTable(["Col1", "Col2"]);
      addTableRow(table, ["val1", "val2"]);
      expect(table).toBeDefined();
    });

    it("should create table with multiple columns", () => {
      const table = createTable(["A", "B", "C", "D", "E"]);
      addTableRow(table, ["1", "2", "3", "4", "5"]);
      expect(table).toBeDefined();
    });
  });
});

describe("output functions", () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe("success", () => {
    it("should print success message", () => {
      success("Operation completed");
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe("error", () => {
    it("should print error message", () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      error("Operation failed");
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe("warning", () => {
    it("should print warning message", () => {
      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      warning("Warning message");
      expect(consoleWarnSpy).toHaveBeenCalled();
      consoleWarnSpy.mockRestore();
    });
  });

  describe("info", () => {
    it("should print info message", () => {
      info("Info message");
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe("header", () => {
    it("should print header", () => {
      header("Section Title");
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe("kv", () => {
    it("should print key-value pair", () => {
      kv("Key", "Value");
      expect(consoleSpy).toHaveBeenCalled();
    });
  });
});
