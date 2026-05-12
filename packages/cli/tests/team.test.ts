/**
 * Team Command Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Command } from "commander";
import { createTeamCommands } from "../src/commands/team.js";

describe("Team Commands", () => {
  let program: Command;
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    program = new Command();
    program.addCommand(createTeamCommands());

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

  describe("team status", () => {
    it("should have status command defined", () => {
      const teamCmd = program.commands.find((c) => c.name() === "team");
      const statusCmd = teamCmd?.commands.find((c) => c.name() === "status");

      expect(statusCmd).toBeDefined();
    });

    it("should have proper description", () => {
      const teamCmd = program.commands.find((c) => c.name() === "team");
      const statusCmd = teamCmd?.commands.find((c) => c.name() === "status");

      expect(statusCmd?.description()).toBeDefined();
      expect(statusCmd?.description()).toContain("health");
    });

    it("should not require any options", () => {
      const teamCmd = program.commands.find((c) => c.name() === "team");
      const statusCmd = teamCmd?.commands.find((c) => c.name() === "status");

      const options = statusCmd?.options || [];
      const requiredOptions = options.filter((o) => o.required);

      expect(requiredOptions.length).toBe(0);
    });
  });

  describe("team list", () => {
    it("should have list command defined", () => {
      const teamCmd = program.commands.find((c) => c.name() === "team");
      const listCmd = teamCmd?.commands.find((c) => c.name() === "list");

      expect(listCmd).toBeDefined();
    });

    it("should have proper description", () => {
      const teamCmd = program.commands.find((c) => c.name() === "team");
      const listCmd = teamCmd?.commands.find((c) => c.name() === "list");

      expect(listCmd?.description()).toBeDefined();
      expect(listCmd?.description()).toContain("teams");
    });

    it("should not require any options", () => {
      const teamCmd = program.commands.find((c) => c.name() === "team");
      const listCmd = teamCmd?.commands.find((c) => c.name() === "list");

      const options = listCmd?.options || [];
      const requiredOptions = options.filter((o) => o.required);

      expect(requiredOptions.length).toBe(0);
    });
  });

  describe("command structure", () => {
    it("should have all required subcommands", () => {
      const teamCmd = program.commands.find((c) => c.name() === "team");
      const subcommands = teamCmd?.commands.map((c) => c.name()) || [];

      expect(subcommands).toContain("status");
      expect(subcommands).toContain("list");
    });

    it("should have proper command description", () => {
      const teamCmd = program.commands.find((c) => c.name() === "team");

      expect(teamCmd?.description()).toBeDefined();
    });

    it("should have descriptions for all subcommands", () => {
      const teamCmd = program.commands.find((c) => c.name() === "team");
      const subcommands = teamCmd?.commands || [];

      for (const cmd of subcommands) {
        expect(cmd.description()).toBeDefined();
        expect(cmd.description().length).toBeGreaterThan(0);
      }
    });
  });
});
