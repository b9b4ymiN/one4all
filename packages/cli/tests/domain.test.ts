/**
 * Domain Command Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Command } from "commander";
import { createDomainCommands } from "../src/commands/domain.js";

describe("Domain Commands", () => {
  let program: Command;
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    program = new Command();
    program.addCommand(createDomainCommands());

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

  describe("domain list", () => {
    it("should have list command defined", () => {
      const domainCmd = program.commands.find((c) => c.name() === "domain");
      const listCmd = domainCmd?.commands.find((c) => c.name() === "list");

      expect(listCmd).toBeDefined();
    });

    it("should have proper description", () => {
      const domainCmd = program.commands.find((c) => c.name() === "domain");
      const listCmd = domainCmd?.commands.find((c) => c.name() === "list");

      expect(listCmd?.description()).toBeDefined();
      expect(listCmd?.description()).toContain("domains");
    });

    it("should not require any options", () => {
      const domainCmd = program.commands.find((c) => c.name() === "domain");
      const listCmd = domainCmd?.commands.find((c) => c.name() === "list");

      const options = listCmd?.options || [];
      const requiredOptions = options.filter((o) => o.required);

      expect(requiredOptions.length).toBe(0);
    });
  });

  describe("domain create", () => {
    it("should have create command defined", () => {
      const domainCmd = program.commands.find((c) => c.name() === "domain");
      const createCmd = domainCmd?.commands.find((c) => c.name() === "create");

      expect(createCmd).toBeDefined();
    });

    it("should require id option", () => {
      const domainCmd = program.commands.find((c) => c.name() === "domain");
      const createCmd = domainCmd?.commands.find((c) => c.name() === "create");

      const options = createCmd?.options || [];
      const idOption = options.find((o) => o.long === "--id");
      expect(idOption).toBeDefined();
      expect(idOption?.required).toBe(true);
    });

    it("should require name option", () => {
      const domainCmd = program.commands.find((c) => c.name() === "domain");
      const createCmd = domainCmd?.commands.find((c) => c.name() === "create");

      const options = createCmd?.options || [];
      const nameOption = options.find((o) => o.long === "--name");
      expect(nameOption).toBeDefined();
      expect(nameOption?.required).toBe(true);
    });

    it("should have description option", () => {
      const domainCmd = program.commands.find((c) => c.name() === "domain");
      const createCmd = domainCmd?.commands.find((c) => c.name() === "create");

      const options = createCmd?.options || [];
      const descOption = options.find((o) => o.long === "--description");
      expect(descOption).toBeDefined();
    });
  });

  describe("domain switch", () => {
    it("should have switch command defined", () => {
      const domainCmd = program.commands.find((c) => c.name() === "domain");
      const switchCmd = domainCmd?.commands.find((c) => c.name() === "switch");

      expect(switchCmd).toBeDefined();
    });

    it("should require id option", () => {
      const domainCmd = program.commands.find((c) => c.name() === "domain");
      const switchCmd = domainCmd?.commands.find((c) => c.name() === "switch");

      const options = switchCmd?.options || [];
      const idOption = options.find((o) => o.long === "--id");
      expect(idOption).toBeDefined();
      expect(idOption?.required).toBe(true);
    });
  });

  describe("command structure", () => {
    it("should have all required subcommands", () => {
      const domainCmd = program.commands.find((c) => c.name() === "domain");
      const subcommands = domainCmd?.commands.map((c) => c.name()) || [];

      expect(subcommands).toContain("list");
      expect(subcommands).toContain("create");
      expect(subcommands).toContain("switch");
    });

    it("should have proper command description", () => {
      const domainCmd = program.commands.find((c) => c.name() === "domain");

      expect(domainCmd?.description()).toBeDefined();
      expect(domainCmd?.description()).toContain("Domain");
    });

    it("should have descriptions for all subcommands", () => {
      const domainCmd = program.commands.find((c) => c.name() === "domain");
      const subcommands = domainCmd?.commands || [];

      for (const cmd of subcommands) {
        expect(cmd.description()).toBeDefined();
        expect(cmd.description().length).toBeGreaterThan(0);
      }
    });
  });
});
