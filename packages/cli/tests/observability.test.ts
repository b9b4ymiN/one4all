/**
 * Observability Command Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Command } from "commander";
import {
  createObservabilityCommands,
  createAuditCommands,
  createScorecardCommands,
  createCostCommands,
} from "../src/commands/observability.js";

describe("Observability Commands", () => {
  let program: Command;
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    program = new Command();
    program.addCommand(createObservabilityCommands());
    program.addCommand(createAuditCommands());
    program.addCommand(createScorecardCommands());
    program.addCommand(createCostCommands());

    // Mock console methods
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});

    // Mock process.exit
    processExitSpy = vi.spyOn(process, "exit").mockImplementation((() => {}) as any);
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    processExitSpy.mockRestore();
    vi.restoreAllMocks();
  });

  describe("log show", () => {
    it("should have log show command defined", () => {
      const logCmd = program.commands.find((c) => c.name() === "log");
      const showCmd = logCmd?.commands.find((c) => c.name() === "show");

      expect(showCmd).toBeDefined();
    });

    it("should have mission option", () => {
      const logCmd = program.commands.find((c) => c.name() === "log");
      const showCmd = logCmd?.commands.find((c) => c.name() === "show");

      const options = showCmd?.options || [];
      const missionOption = options.find((o) => o.long === "--mission");
      expect(missionOption).toBeDefined();
    });

    it("should have agent option", () => {
      const logCmd = program.commands.find((c) => c.name() === "log");
      const showCmd = logCmd?.commands.find((c) => c.name() === "show");

      const options = showCmd?.options || [];
      const agentOption = options.find((o) => o.long === "--agent");
      expect(agentOption).toBeDefined();
    });

    it("should have last option with default", () => {
      const logCmd = program.commands.find((c) => c.name() === "log");
      const showCmd = logCmd?.commands.find((c) => c.name() === "show");

      const options = showCmd?.options || [];
      const lastOption = options.find((o) => o.long === "--last");
      expect(lastOption).toBeDefined();
      expect(lastOption?.defaultValue).toBe("50");
    });
  });

  describe("audit trail", () => {
    it("should have audit trail command defined", () => {
      const auditCmd = program.commands.find((c) => c.name() === "audit");
      const trailCmd = auditCmd?.commands.find((c) => c.name() === "trail");

      expect(trailCmd).toBeDefined();
    });

    it("should require mission option", () => {
      const auditCmd = program.commands.find((c) => c.name() === "audit");
      const trailCmd = auditCmd?.commands.find((c) => c.name() === "trail");

      const options = trailCmd?.options || [];
      const missionOption = options.find((o) => o.long === "--mission");
      expect(missionOption).toBeDefined();
      expect(missionOption?.required).toBe(true);
    });
  });

  describe("scorecard show", () => {
    it("should have scorecard show command defined", () => {
      const scorecardCmd = program.commands.find((c) => c.name() === "scorecard");
      const showCmd = scorecardCmd?.commands.find((c) => c.name() === "show");

      expect(showCmd).toBeDefined();
    });

    it("should require agent option", () => {
      const scorecardCmd = program.commands.find((c) => c.name() === "scorecard");
      const showCmd = scorecardCmd?.commands.find((c) => c.name() === "show");

      const options = showCmd?.options || [];
      const agentOption = options.find((o) => o.long === "--agent");
      expect(agentOption).toBeDefined();
      expect(agentOption?.required).toBe(true);
    });
  });

  describe("cost show", () => {
    it("should have cost show command defined", () => {
      const costCmd = program.commands.find((c) => c.name() === "cost");
      const showCmd = costCmd?.commands.find((c) => c.name() === "show");

      expect(showCmd).toBeDefined();
    });

    it("should have period option", () => {
      const costCmd = program.commands.find((c) => c.name() === "cost");
      const showCmd = costCmd?.commands.find((c) => c.name() === "show");

      const options = showCmd?.options || [];
      const periodOption = options.find((o) => o.long === "--period");
      expect(periodOption).toBeDefined();
    });
  });

  describe("command structure", () => {
    it("should have all required command groups", () => {
      const commandNames = program.commands.map((c) => c.name());

      expect(commandNames).toContain("log");
      expect(commandNames).toContain("audit");
      expect(commandNames).toContain("scorecard");
      expect(commandNames).toContain("cost");
    });

    it("should have proper command descriptions", () => {
      const commandGroups = program.commands;

      for (const cmd of commandGroups) {
        expect(cmd.description()).toBeDefined();
      }
    });

    it("should have descriptions for all subcommands", () => {
      const commandGroups = program.commands;

      for (const group of commandGroups) {
        const subcommands = group.commands || [];
        for (const cmd of subcommands) {
          expect(cmd.description()).toBeDefined();
          expect(cmd.description().length).toBeGreaterThan(0);
        }
      }
    });
  });
});
