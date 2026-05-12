/**
 * Agent Command Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Command } from "commander";
import { createAgentCommands } from "../src/commands/agent.js";

describe("Agent Commands", () => {
  let program: Command;
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    program = new Command();
    program.addCommand(createAgentCommands());

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

  describe("agent ask", () => {
    it("should have ask command defined", () => {
      const agentCmd = program.commands.find((c) => c.name() === "agent");
      const askCmd = agentCmd?.commands.find((c) => c.name() === "ask");

      expect(askCmd).toBeDefined();
    });

    it("should require agent option", () => {
      const agentCmd = program.commands.find((c) => c.name() === "agent");
      const askCmd = agentCmd?.commands.find((c) => c.name() === "ask");

      const options = askCmd?.options || [];
      const agentOption = options.find((o) => o.long === "--agent");
      expect(agentOption).toBeDefined();
      expect(agentOption?.required).toBe(true);
    });

    it("should have prompt option", () => {
      const agentCmd = program.commands.find((c) => c.name() === "agent");
      const askCmd = agentCmd?.commands.find((c) => c.name() === "ask");

      const options = askCmd?.options || [];
      const promptOption = options.find((o) => o.long === "--prompt");
      expect(promptOption).toBeDefined();
    });

    it("should have interactive option", () => {
      const agentCmd = program.commands.find((c) => c.name() === "agent");
      const askCmd = agentCmd?.commands.find((c) => c.name() === "ask");

      const options = askCmd?.options || [];
      const interactiveOption = options.find((o) => o.long === "--interactive");
      expect(interactiveOption).toBeDefined();
    });

    it("should have context option", () => {
      const agentCmd = program.commands.find((c) => c.name() === "agent");
      const askCmd = agentCmd?.commands.find((c) => c.name() === "ask");

      const options = askCmd?.options || [];
      const contextOption = options.find((o) => o.long === "--context");
      expect(contextOption).toBeDefined();
    });

    it("should have timeout option with default", () => {
      const agentCmd = program.commands.find((c) => c.name() === "agent");
      const askCmd = agentCmd?.commands.find((c) => c.name() === "ask");

      const options = askCmd?.options || [];
      const timeoutOption = options.find((o) => o.long === "--timeout");
      expect(timeoutOption).toBeDefined();
      expect(timeoutOption?.defaultValue).toBe("300");
    });
  });

  describe("agent list", () => {
    it("should have list command defined", () => {
      const agentCmd = program.commands.find((c) => c.name() === "agent");
      const listCmd = agentCmd?.commands.find((c) => c.name() === "list");

      expect(listCmd).toBeDefined();
    });

    it("should have domain filter option", () => {
      const agentCmd = program.commands.find((c) => c.name() === "agent");
      const listCmd = agentCmd?.commands.find((c) => c.name() === "list");

      const options = listCmd?.options || [];
      const domainOption = options.find((o) => o.long === "--domain");
      expect(domainOption).toBeDefined();
    });
  });

  describe("agent test", () => {
    it("should have test command defined", () => {
      const agentCmd = program.commands.find((c) => c.name() === "agent");
      const testCmd = agentCmd?.commands.find((c) => c.name() === "test");

      expect(testCmd).toBeDefined();
    });

    it("should require id option", () => {
      const agentCmd = program.commands.find((c) => c.name() === "agent");
      const testCmd = agentCmd?.commands.find((c) => c.name() === "test");

      const options = testCmd?.options || [];
      const idOption = options.find((o) => o.long === "--id");
      expect(idOption).toBeDefined();
      expect(idOption?.required).toBe(true);
    });

    it("should require fixture option", () => {
      const agentCmd = program.commands.find((c) => c.name() === "agent");
      const testCmd = agentCmd?.commands.find((c) => c.name() === "test");

      const options = testCmd?.options || [];
      const fixtureOption = options.find((o) => o.long === "--fixture");
      expect(fixtureOption).toBeDefined();
      expect(fixtureOption?.required).toBe(true);
    });
  });

  describe("command structure", () => {
    it("should have all required subcommands", () => {
      const agentCmd = program.commands.find((c) => c.name() === "agent");
      const subcommands = agentCmd?.commands.map((c) => c.name()) || [];

      expect(subcommands).toContain("ask");
      expect(subcommands).toContain("list");
      expect(subcommands).toContain("test");
    });

    it("should have proper command descriptions", () => {
      const agentCmd = program.commands.find((c) => c.name() === "agent");

      expect(agentCmd?.description()).toBeDefined();

      const subcommands = agentCmd?.commands || [];
      for (const cmd of subcommands) {
        expect(cmd.description()).toBeDefined();
      }
    });
  });
});
