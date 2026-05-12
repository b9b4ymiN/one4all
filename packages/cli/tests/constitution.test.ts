/**
 * Constitution Command Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Command } from "commander";
import { createConstitutionCommands } from "../src/commands/constitution.js";

describe("Constitution Commands", () => {
  let program: Command;
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    program = new Command();
    program.addCommand(createConstitutionCommands());

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

  describe("constitution load", () => {
    it("should have load command defined", () => {
      const constitutionCmd = program.commands.find((c) => c.name() === "constitution");
      const loadCmd = constitutionCmd?.commands.find((c) => c.name() === "load");

      expect(loadCmd).toBeDefined();
    });

    it("should require domain option", () => {
      const constitutionCmd = program.commands.find((c) => c.name() === "constitution");
      const loadCmd = constitutionCmd?.commands.find((c) => c.name() === "load");

      const options = loadCmd?.options || [];
      const domainOption = options.find((o) => o.long === "--domain");
      expect(domainOption).toBeDefined();
      expect(domainOption?.required).toBe(true);
    });

    it("should have file option", () => {
      const constitutionCmd = program.commands.find((c) => c.name() === "constitution");
      const loadCmd = constitutionCmd?.commands.find((c) => c.name() === "load");

      const options = loadCmd?.options || [];
      const fileOption = options.find((o) => o.long === "--file");
      expect(fileOption).toBeDefined();
    });
  });

  describe("constitution list", () => {
    it("should have list command defined", () => {
      const constitutionCmd = program.commands.find((c) => c.name() === "constitution");
      const listCmd = constitutionCmd?.commands.find((c) => c.name() === "list");

      expect(listCmd).toBeDefined();
    });

    it("should have domain option", () => {
      const constitutionCmd = program.commands.find((c) => c.name() === "constitution");
      const listCmd = constitutionCmd?.commands.find((c) => c.name() === "list");

      const options = listCmd?.options || [];
      const domainOption = options.find((o) => o.long === "--domain");
      expect(domainOption).toBeDefined();
    });
  });

  describe("constitution validate", () => {
    it("should have validate command defined", () => {
      const constitutionCmd = program.commands.find((c) => c.name() === "constitution");
      const validateCmd = constitutionCmd?.commands.find((c) => c.name() === "validate");

      expect(validateCmd).toBeDefined();
    });

    it("should have domain option", () => {
      const constitutionCmd = program.commands.find((c) => c.name() === "constitution");
      const validateCmd = constitutionCmd?.commands.find((c) => c.name() === "validate");

      const options = validateCmd?.options || [];
      const domainOption = options.find((o) => o.long === "--domain");
      expect(domainOption).toBeDefined();
    });
  });

  describe("command structure", () => {
    it("should have all required subcommands", () => {
      const constitutionCmd = program.commands.find((c) => c.name() === "constitution");
      const subcommands = constitutionCmd?.commands.map((c) => c.name()) || [];

      expect(subcommands).toContain("load");
      expect(subcommands).toContain("list");
      expect(subcommands).toContain("validate");
    });

    it("should have proper command description", () => {
      const constitutionCmd = program.commands.find((c) => c.name() === "constitution");

      expect(constitutionCmd?.description()).toBeDefined();
      expect(constitutionCmd?.description()).toContain("Constitution");
    });

    it("should have descriptions for all subcommands", () => {
      const constitutionCmd = program.commands.find((c) => c.name() === "constitution");
      const subcommands = constitutionCmd?.commands || [];

      for (const cmd of subcommands) {
        expect(cmd.description()).toBeDefined();
        expect(cmd.description().length).toBeGreaterThan(0);
      }
    });
  });
});
