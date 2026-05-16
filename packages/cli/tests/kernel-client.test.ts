/**
 * Kernel Client Tests
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { KernelClient, getKernelClient } from "../src/lib/kernel-client.js";
import { getMissionStorage } from "../src/lib/mission-storage.js";

// Check for API keys to skip tests that require real LLM calls
const hasApiKey = !!(
  process.env.ANTHROPIC_API_KEY ||
  process.env.OPENAI_API_KEY ||
  process.env.GEMINI_API_KEY ||
  process.env.ZAI_API_KEY
);

describe("KernelClient", () => {
  let client: KernelClient;

  beforeEach(() => {
    client = new KernelClient();
  });

  describe("createMission", () => {
    it("should create a mission with required options", async () => {
      const result = await client.createMission({
        domain: "investment-war-room",
        type: "stock_analysis",
        ticker: "MCS",
        description: "Analysis of MCS stock",
      });

      expect(result.mission_id).toBeDefined();
      expect(result.state).toBe("DRAFT");
      expect(result.domain).toBe("investment-war-room");
      expect(result.mission_type).toBe("stock_analysis");
      expect(result.ticker).toBe("MCS");
      expect(result.created_at).toBeInstanceOf(Date);
    });

    it("should create mission without ticker", async () => {
      const result = await client.createMission({
        domain: "investment-war-room",
        type: "general_analysis",
        description: "General analysis",
      });

      expect(result.mission_id).toBeDefined();
      expect(result.ticker).toBeUndefined();
    });

    it("should create mission with assumptions", async () => {
      const result = await client.createMission({
        domain: "investment-war-room",
        type: "stock_analysis",
        ticker: "AAPL",
        description: "Apple analysis",
        assumptions: {
          growth_rate: 0.05,
          discount_rate: 0.10,
        },
      });

      expect(result.mission_id).toBeDefined();
    });

    it("should create mission with constraints", async () => {
      const result = await client.createMission({
        domain: "investment-war-room",
        type: "stock_analysis",
        ticker: "GOOGL",
        description: "Google analysis",
        constraints: {
          max_position_size: 0.15,
        },
      });

      expect(result.mission_id).toBeDefined();
    });

    it("should generate unique mission IDs", async () => {
      const result1 = await client.createMission({
        domain: "investment-war-room",
        type: "stock_analysis",
        ticker: "TSLA",
        description: "Tesla analysis",
      });

      // Wait a bit to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 10));

      const result2 = await client.createMission({
        domain: "investment-war-room",
        type: "stock_analysis",
        ticker: "MSFT",
        description: "Microsoft analysis",
      });

      expect(result1.mission_id).not.toBe(result2.mission_id);
    });
  });

  describe.skipIf(!hasApiKey)("startMission", () => {
    it("should start an existing mission", async () => {
      // First create a mission
      const created = await client.createMission({
        domain: "investment-war-room",
        type: "stock_analysis",
        ticker: "MCS",
        description: "Test mission",
      });

      // Then start it
      const result = await client.startMission(created.mission_id);

      expect(result.success).toBe(true);
      expect(result.new_state).toBe("PLANNING");
    });

    it("should fail for non-existent mission", async () => {
      const result = await client.startMission("non-existent-id");

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe.skipIf(!hasApiKey)("getMissionStatus", () => {
    it("should get status of existing mission", async () => {
      const created = await client.createMission({
        domain: "investment-war-room",
        type: "stock_analysis",
        ticker: "MCS",
        description: "Test mission",
      });

      const status = await client.getMissionStatus(created.mission_id);

      expect(status).toBeDefined();
      expect(status?.mission_id).toBe(created.mission_id);
      expect(status?.state).toBe("DRAFT");
      expect(status?.domain).toBe("investment-war-room");
      expect(status?.ticker).toBe("MCS");
      expect(status?.created_at).toBeInstanceOf(Date);
    });

    it("should return null for non-existent mission", async () => {
      const status = await client.getMissionStatus("non-existent-id");
      expect(status).toBeNull();
    });

    it("should return updated status after starting mission", async () => {
      const created = await client.createMission({
        domain: "investment-war-room",
        type: "stock_analysis",
        ticker: "MCS",
        description: "Test mission",
      });

      await client.startMission(created.mission_id);

      const status = await client.getMissionStatus(created.mission_id);

      expect(status?.state).toBe("PLANNING");
    });
  });

  describe("abortMission", () => {
    it("should abort an existing mission", async () => {
      const created = await client.createMission({
        domain: "investment-war-room",
        type: "stock_analysis",
        ticker: "MCS",
        description: "Test mission",
      });

      const result = await client.abortMission(created.mission_id);

      expect(result.success).toBe(true);
      expect(result.new_state).toBe("FAILED");
    });

    it("should fail for non-existent mission", async () => {
      const result = await client.abortMission("non-existent-id");

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should update mission state after abort", async () => {
      const created = await client.createMission({
        domain: "investment-war-room",
        type: "stock_analysis",
        ticker: "MCS",
        description: "Test mission",
      });

      await client.abortMission(created.mission_id);

      const status = await client.getMissionStatus(created.mission_id);

      expect(status?.state).toBe("FAILED");
    });
  });

  describe("listMissions", () => {
    beforeEach(async () => {
      // Clean up any existing missions first
      const storage = getMissionStorage();
      const missions = await storage.list();
      for (const mission of missions) {
        await storage.delete(mission.mission_id);
      }

      // Create some test missions
      await client.createMission({
        domain: "investment-war-room",
        type: "stock_analysis",
        ticker: "MCS",
        description: "MCS analysis",
      });

      await client.createMission({
        domain: "investment-war-room",
        type: "stock_analysis",
        ticker: "AAPL",
        description: "Apple analysis",
      });

      await client.createMission({
        domain: "research-studio",
        type: "general_analysis",
        description: "Research analysis",
      });
    });

    it("should list all missions", async () => {
      const missions = await client.listMissions();

      expect(missions.length).toBeGreaterThanOrEqual(3);
    });

    it("should filter missions by domain", async () => {
      const missions = await client.listMissions({
        domain: "investment-war-room",
      });

      expect(missions.length).toBe(2);
      expect(missions.every((m) => m.domain === "investment-war-room")).toBe(true);
    });

    it("should limit number of results", async () => {
      const missions = await client.listMissions({
        limit: 2,
      });

      expect(missions.length).toBe(2);
    });

    it("should return empty array when no missions match", async () => {
      const missions = await client.listMissions({
        domain: "non-existent-domain",
      });

      expect(missions).toEqual([]);
    });
  });

  describe.skipIf(!hasApiKey)("askAgent", () => {
    it("should return agent response", async () => {
      const response = await client.askAgent({
        agent: "damodaran-valuation",
        prompt: "Analyze MCS DCF",
      });

      expect(typeof response).toBe("string");
      expect(response).toContain("damodaran-valuation");
      expect(response).toContain("Analyze MCS DCF");
    });

    it("should include context in response when provided", async () => {
      const response = await client.askAgent({
        agent: "test-agent",
        prompt: "Test prompt",
        context: { key: "value" },
      });

      expect(typeof response).toBe("string");
    });

    it("should use default timeout when not specified", async () => {
      const response = await client.askAgent({
        agent: "test-agent",
        prompt: "Test",
      });

      expect(typeof response).toBe("string");
    });

    it("should include timeout in options", async () => {
      const response = await client.askAgent({
        agent: "test-agent",
        prompt: "Test",
        timeout: 600,
      });

      expect(typeof response).toBe("string");
    });
  });

  describe.skipIf(!hasApiKey)("testAgent", () => {
    it("should return successful test result", async () => {
      const result = await client.testAgent({
        agent: "damodaran-valuation",
        fixture: "/fixtures/test.yaml",
      });

      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
      expect(result.error).toBeUndefined();
    });

    it("should include agent and fixture in output", async () => {
      const result = await client.testAgent({
        agent: "test-agent",
        fixture: "/test/fixtures/test.yaml",
      });

      expect(result.output).toContain("test-agent");
      expect(result.output).toContain("/test/fixtures/test.yaml");
    });
  });

  describe("listAgents", () => {
    it("should list all agents", async () => {
      const agents = await client.listAgents();

      expect(agents.length).toBeGreaterThan(0);
      expect(agents[0]).toMatchObject({
        id: expect.any(String),
        name: expect.any(String),
        domain: expect.any(String),
        active: expect.any(Boolean),
        role: expect.any(String),
      });
    });

    it("should filter agents by domain", async () => {
      const agents = await client.listAgents("investment-war-room");

      expect(agents.length).toBeGreaterThan(0);
      expect(agents.every((a) => a.domain === "investment-war-room")).toBe(true);
    });

    it("should return agent with model config", async () => {
      const agents = await client.listAgents();
      const agent = agents[0];

      expect(agent.model).toBeDefined();
      expect(agent.model.primary).toBeDefined();
      expect(agent.model.primary.provider).toBeDefined();
      expect(agent.model.primary.model).toBeDefined();
    });

    it("should return agent with identity config", async () => {
      const agents = await client.listAgents();
      const agent = agents[0];

      expect(agent.identity).toBeDefined();
      expect(agent.identity.persona_file).toBeDefined();
      expect(agent.identity.worldview).toBeDefined();
    });
  });

  describe("getJournalEntry", () => {
    it("should return null for non-existent entry", async () => {
      const entry = await client.getJournalEntry("NONEXISTENT");
      expect(entry).toBeNull();
    });
  });

  describe("updateJournalOutcome", () => {
    it("should return false for non-existent entry", async () => {
      const result = await client.updateJournalOutcome({
        id: "non-existent-id",
        outcome: "Success",
      });

      expect(result).toBe(false);
    });
  });

  describe("listJournalEntries", () => {
    it("should return empty array initially", async () => {
      const entries = await client.listJournalEntries({
        state: "open",
        domain: "investment-war-room",
      });

      expect(entries).toEqual([]);
    });
  });

  describe("getConstitution", () => {
    it("should return constitution for domain", async () => {
      const constitution = await client.getConstitution("investment-war-room");

      expect(constitution).toBeDefined();
      expect(constitution?.domain).toBe("investment-war-room");
      expect(constitution?.version).toBeDefined();
      expect(constitution?.rules).toBeInstanceOf(Array);
    });

    it("should return constitution with rules", async () => {
      const constitution = await client.getConstitution("investment-war-room");

      expect(constitution?.rules.length).toBeGreaterThan(0);
      expect(constitution?.rules[0]).toMatchObject({
        id: expect.any(String),
        description: expect.any(String),
        enforcement: expect.any(String),
        applies_to: expect.any(Array),
      });
    });
  });

  describe("validateConstitution", () => {
    it("should return valid result", async () => {
      const result = await client.validateConstitution("investment-war-room");

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
    });
  });

  describe("listDomains", () => {
    it("should list available domains", async () => {
      const domains = await client.listDomains();

      expect(domains.length).toBeGreaterThan(0);
      expect(domains[0]).toMatchObject({
        id: expect.any(String),
        name: expect.any(String),
        version: expect.any(String),
        description: expect.any(String),
      });
    });

    it("should include investment-war-room domain", async () => {
      const domains = await client.listDomains();

      const investmentDomain = domains.find((d) => d.id === "investment-war-room");
      expect(investmentDomain).toBeDefined();
      expect(investmentDomain?.name).toBe("Investment War Room");
    });

    it("should include domain configuration", async () => {
      const domains = await client.listDomains();
      const domain = domains[0];

      expect(domain.constitution).toBeDefined();
      expect(domain.default_team).toBeDefined();
      expect(domain.mission_types).toBeDefined();
      expect(domain.markets).toBeDefined();
      expect(domain.output).toBeDefined();
      expect(domain.human_checkpoints).toBeDefined();
      expect(domain.journal).toBeDefined();
      expect(domain.evidence).toBeDefined();
      expect(domain.context_budget).toBeDefined();
    });
  });

  describe("getHealthStatus", () => {
    it("should return health status array", async () => {
      const health = await client.getHealthStatus();

      expect(health).toBeInstanceOf(Array);
    });

    it("should include status properties", async () => {
      const health = await client.getHealthStatus();

      if (health.length > 0) {
        expect(health[0]).toMatchObject({
          name: expect.any(String),
          status: expect.any(String),
        });
      }
    });
  });

  describe("listTeams", () => {
    it("should return teams array", async () => {
      const teams = await client.listTeams();

      expect(teams).toBeInstanceOf(Array);
    });

    it("should include investment-war-room team", async () => {
      const teams = await client.listTeams();

      const investmentTeam = teams.find((t) => t.id === "investment-war-room");
      expect(investmentTeam).toBeDefined();
      expect(investmentTeam?.name).toBe("Investment War Room");
      expect(investmentTeam?.domain).toBe("investment-war-room");
    });
  });
});

describe("getKernelClient", () => {
  it("should return singleton instance", () => {
    const client1 = getKernelClient();
    const client2 = getKernelClient();

    expect(client1).toBe(client2);
  });

  it("should return KernelClient instance", () => {
    const client = getKernelClient();

    expect(client).toBeInstanceOf(KernelClient);
  });
});
