/**
 * Mission Command Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Command } from "commander";
import { createMissionCommands } from "../src/commands/mission.js";
import { KernelClient } from "../src/lib/kernel-client.js";

describe("Mission Commands", () => {
  let program: Command;
  let mockClient: KernelClient;
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    program = new Command();
    program.addCommand(createMissionCommands());

    mockClient = new KernelClient();

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

  describe("mission create", () => {
    it("should have create command defined", () => {
      const createCmd = program.commands.find((c) => c.name() === "mission");
      expect(createCmd).toBeDefined();

      const createSubCmd = createCmd?.commands.find((c) => c.name() === "create");
      expect(createSubCmd).toBeDefined();
    });

    it("should require domain option", () => {
      const createCmd = program.commands.find((c) => c.name() === "mission");
      const createSubCmd = createCmd?.commands.find((c) => c.name() === "create");

      const options = createSubCmd?.options || [];
      const domainOption = options.find((o) => o.long === "--domain");
      expect(domainOption).toBeDefined();
      expect(domainOption?.required).toBe(true);
    });

    it("should require type option", () => {
      const createCmd = program.commands.find((c) => c.name() === "mission");
      const createSubCmd = createCmd?.commands.find((c) => c.name() === "create");

      const options = createSubCmd?.options || [];
      const typeOption = options.find((o) => o.long === "--type");
      expect(typeOption).toBeDefined();
      expect(typeOption?.required).toBe(true);
    });

    it("should have ticker option", () => {
      const createCmd = program.commands.find((c) => c.name() === "mission");
      const createSubCmd = createCmd?.commands.find((c) => c.name() === "create");

      const options = createSubCmd?.options || [];
      const tickerOption = options.find((o) => o.long === "--ticker");
      expect(tickerOption).toBeDefined();
    });

    it("should have optional description option", () => {
      const createCmd = program.commands.find((c) => c.name() === "mission");
      const createSubCmd = createCmd?.commands.find((c) => c.name() === "create");

      const options = createSubCmd?.options || [];
      const descOption = options.find((o) => o.long === "--description");
      expect(descOption).toBeDefined();
    });

    it("should support assumption options", () => {
      const createCmd = program.commands.find((c) => c.name() === "mission");
      const createSubCmd = createCmd?.commands.find((c) => c.name() === "create");

      const options = createSubCmd?.options || [];
      const assumptionOption = options.find((o) => o.long === "--assumption");
      expect(assumptionOption).toBeDefined();
    });

    it("should support constraint options", () => {
      const createCmd = program.commands.find((c) => c.name() === "mission");
      const createSubCmd = createCmd?.commands.find((c) => c.name() === "create");

      const options = createSubCmd?.options || [];
      const constraintOption = options.find((o) => o.long === "--constraint");
      expect(constraintOption).toBeDefined();
    });
  });

  describe("mission run", () => {
    it("should have run command defined", () => {
      const missionCmd = program.commands.find((c) => c.name() === "mission");
      const runCmd = missionCmd?.commands.find((c) => c.name() === "run");

      expect(runCmd).toBeDefined();
    });

    it("should require id option", () => {
      const missionCmd = program.commands.find((c) => c.name() === "mission");
      const runCmd = missionCmd?.commands.find((c) => c.name() === "run");

      const options = runCmd?.options || [];
      const idOption = options.find((o) => o.long === "--id");
      expect(idOption).toBeDefined();
      expect(idOption?.required).toBe(true);
    });
  });

  describe("mission status", () => {
    it("should have status command defined", () => {
      const missionCmd = program.commands.find((c) => c.name() === "mission");
      const statusCmd = missionCmd?.commands.find((c) => c.name() === "status");

      expect(statusCmd).toBeDefined();
    });

    it("should require id option", () => {
      const missionCmd = program.commands.find((c) => c.name() === "mission");
      const statusCmd = missionCmd?.commands.find((c) => c.name() === "status");

      const options = statusCmd?.options || [];
      const idOption = options.find((o) => o.long === "--id");
      expect(idOption).toBeDefined();
      expect(idOption?.required).toBe(true);
    });
  });

  describe("mission abort", () => {
    it("should have abort command defined", () => {
      const missionCmd = program.commands.find((c) => c.name() === "mission");
      const abortCmd = missionCmd?.commands.find((c) => c.name() === "abort");

      expect(abortCmd).toBeDefined();
    });

    it("should require id option", () => {
      const missionCmd = program.commands.find((c) => c.name() === "mission");
      const abortCmd = missionCmd?.commands.find((c) => c.name() === "abort");

      const options = abortCmd?.options || [];
      const idOption = options.find((o) => o.long === "--id");
      expect(idOption).toBeDefined();
      expect(idOption?.required).toBe(true);
    });

    it("should have force option", () => {
      const missionCmd = program.commands.find((c) => c.name() === "mission");
      const abortCmd = missionCmd?.commands.find((c) => c.name() === "abort");

      const options = abortCmd?.options || [];
      const forceOption = options.find((o) => o.long === "--force");
      expect(forceOption).toBeDefined();
      expect(forceOption?.required).toBe(false);
    });
  });

  describe("mission list", () => {
    it("should have list command defined", () => {
      const missionCmd = program.commands.find((c) => c.name() === "mission");
      const listCmd = missionCmd?.commands.find((c) => c.name() === "list");

      expect(listCmd).toBeDefined();
    });

    it("should have domain filter option", () => {
      const missionCmd = program.commands.find((c) => c.name() === "mission");
      const listCmd = missionCmd?.commands.find((c) => c.name() === "list");

      const options = listCmd?.options || [];
      const domainOption = options.find((o) => o.long === "--domain");
      expect(domainOption).toBeDefined();
    });

    it("should have state filter option", () => {
      const missionCmd = program.commands.find((c) => c.name() === "mission");
      const listCmd = missionCmd?.commands.find((c) => c.name() === "list");

      const options = listCmd?.options || [];
      const stateOption = options.find((o) => o.long === "--state");
      expect(stateOption).toBeDefined();
    });

    it("should have limit option with default", () => {
      const missionCmd = program.commands.find((c) => c.name() === "mission");
      const listCmd = missionCmd?.commands.find((c) => c.name() === "list");

      const options = listCmd?.options || [];
      const limitOption = options.find((o) => o.long === "--limit");
      expect(limitOption).toBeDefined();
      expect(limitOption?.defaultValue).toBe("20");
    });
  });

  describe("mission replay", () => {
    it("should have replay command defined", () => {
      const missionCmd = program.commands.find((c) => c.name() === "mission");
      const replayCmd = missionCmd?.commands.find((c) => c.name() === "replay");

      expect(replayCmd).toBeDefined();
    });

    it("should require id option", () => {
      const missionCmd = program.commands.find((c) => c.name() === "mission");
      const replayCmd = missionCmd?.commands.find((c) => c.name() === "replay");

      const options = replayCmd?.options || [];
      const idOption = options.find((o) => o.long === "--id");
      expect(idOption).toBeDefined();
      expect(idOption?.required).toBe(true);
    });

    it("should have assumption option", () => {
      const missionCmd = program.commands.find((c) => c.name() === "mission");
      const replayCmd = missionCmd?.commands.find((c) => c.name() === "replay");

      const options = replayCmd?.options || [];
      const assumptionOption = options.find((o) => o.long === "--assumption");
      expect(assumptionOption).toBeDefined();
    });
  });

  describe("command structure", () => {
    it("should have all required subcommands", () => {
      const missionCmd = program.commands.find((c) => c.name() === "mission");
      const subcommands = missionCmd?.commands.map((c) => c.name()) || [];

      expect(subcommands).toContain("create");
      expect(subcommands).toContain("run");
      expect(subcommands).toContain("status");
      expect(subcommands).toContain("abort");
      expect(subcommands).toContain("list");
      expect(subcommands).toContain("replay");
    });

    it("should have proper command descriptions", () => {
      const missionCmd = program.commands.find((c) => c.name() === "mission");

      expect(missionCmd?.description()).toBeDefined();

      const subcommands = missionCmd?.commands || [];
      for (const cmd of subcommands) {
        expect(cmd.description()).toBeDefined();
      }
    });
  });
});
