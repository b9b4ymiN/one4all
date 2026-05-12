/**
 * Journal Command Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Command } from "commander";
import { createJournalCommands } from "../src/commands/journal.js";

describe("Journal Commands", () => {
  let program: Command;
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    program = new Command();
    program.addCommand(createJournalCommands());

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

  describe("journal view", () => {
    it("should have view command defined", () => {
      const journalCmd = program.commands.find((c) => c.name() === "journal");
      const viewCmd = journalCmd?.commands.find((c) => c.name() === "view");

      expect(viewCmd).toBeDefined();
    });

    it("should require ticker option", () => {
      const journalCmd = program.commands.find((c) => c.name() === "journal");
      const viewCmd = journalCmd?.commands.find((c) => c.name() === "view");

      const options = viewCmd?.options || [];
      const tickerOption = options.find((o) => o.long === "--ticker");
      expect(tickerOption).toBeDefined();
      expect(tickerOption?.required).toBe(true);
    });

    it("should have proper description", () => {
      const journalCmd = program.commands.find((c) => c.name() === "journal");
      const viewCmd = journalCmd?.commands.find((c) => c.name() === "view");

      expect(viewCmd?.description()).toBeDefined();
      expect(viewCmd?.description()).toContain("ticker");
    });
  });

  describe("journal update", () => {
    it("should have update command defined", () => {
      const journalCmd = program.commands.find((c) => c.name() === "journal");
      const updateCmd = journalCmd?.commands.find((c) => c.name() === "update");

      expect(updateCmd).toBeDefined();
    });

    it("should require id option", () => {
      const journalCmd = program.commands.find((c) => c.name() === "journal");
      const updateCmd = journalCmd?.commands.find((c) => c.name() === "update");

      const options = updateCmd?.options || [];
      const idOption = options.find((o) => o.long === "--id");
      expect(idOption).toBeDefined();
      expect(idOption?.required).toBe(true);
    });

    it("should require outcome option", () => {
      const journalCmd = program.commands.find((c) => c.name() === "journal");
      const updateCmd = journalCmd?.commands.find((c) => c.name() === "update");

      const options = updateCmd?.options || [];
      const outcomeOption = options.find((o) => o.long === "--outcome");
      expect(outcomeOption).toBeDefined();
      expect(outcomeOption?.required).toBe(true);
    });
  });

  describe("journal list", () => {
    it("should have list command defined", () => {
      const journalCmd = program.commands.find((c) => c.name() === "journal");
      const listCmd = journalCmd?.commands.find((c) => c.name() === "list");

      expect(listCmd).toBeDefined();
    });

    it("should have state filter option", () => {
      const journalCmd = program.commands.find((c) => c.name() === "journal");
      const listCmd = journalCmd?.commands.find((c) => c.name() === "list");

      const options = listCmd?.options || [];
      const stateOption = options.find((o) => o.long === "--state");
      expect(stateOption).toBeDefined();
    });

    it("should have domain filter option", () => {
      const journalCmd = program.commands.find((c) => c.name() === "journal");
      const listCmd = journalCmd?.commands.find((c) => c.name() === "list");

      const options = listCmd?.options || [];
      const domainOption = options.find((o) => o.long === "--domain");
      expect(domainOption).toBeDefined();
    });

    it("should have filter options", () => {
      const journalCmd = program.commands.find((c) => c.name() === "journal");
      const listCmd = journalCmd?.commands.find((c) => c.name() === "list");

      const options = listCmd?.options || [];
      const stateOption = options.find((o) => o.long === "--state");
      const domainOption = options.find((o) => o.long === "--domain");

      expect(stateOption).toBeDefined();
      expect(domainOption).toBeDefined();
    });
  });

  describe("command structure", () => {
    it("should have all required subcommands", () => {
      const journalCmd = program.commands.find((c) => c.name() === "journal");
      const subcommands = journalCmd?.commands.map((c) => c.name()) || [];

      expect(subcommands).toContain("view");
      expect(subcommands).toContain("update");
      expect(subcommands).toContain("list");
    });

    it("should have proper command description", () => {
      const journalCmd = program.commands.find((c) => c.name() === "journal");

      expect(journalCmd?.description()).toBeDefined();
      expect(journalCmd?.description()).toContain("Journal");
    });

    it("should have descriptions for all subcommands", () => {
      const journalCmd = program.commands.find((c) => c.name() === "journal");
      const subcommands = journalCmd?.commands || [];

      for (const cmd of subcommands) {
        expect(cmd.description()).toBeDefined();
        expect(cmd.description().length).toBeGreaterThan(0);
      }
    });
  });
});
