/**
 * MCP Integration Tests
 *
 * End-to-end tests for MCP server functionality
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  One4AllMCPServer,
  createMCPServer,
  type MCPServerConfig,
} from '../src/server.js';
import { MissionStateMachine, createEvidenceController, createDebateController } from '@one4all/kernel';

describe('MCP Integration Tests', () => {
  let server: One4AllMCPServer;
  let stateMachine: MissionStateMachine;
  let config: MCPServerConfig;
  let evidenceController: ReturnType<typeof createEvidenceController>;
  let debateController: ReturnType<typeof createDebateController>;

  beforeEach(() => {
    stateMachine = new MissionStateMachine();
    evidenceController = createEvidenceController();
    debateController = createDebateController();

    config = {
      name: 'one4all-mcp-integration-test',
      version: '1.0.0',
      stateMachine,
      domainsPath: '/tmp/domains',
      evidenceController,
      debateController,
    };

    server = new One4AllMCPServer(config);
  });

  describe('Full Mission Lifecycle', () => {
    it('should create, retrieve, and transition a mission', async () => {
      // Step 1: Create a mission
      const createResult = await server['handleCallTool']({
        name: 'create_mission',
        arguments: {
          type: 'stock_analysis',
          domain: 'investment-war-room',
          description: 'Analyze NVDA stock',
          ticker: 'NVDA',
        },
      });

      expect(createResult.isError).toBeUndefined();
      const created = JSON.parse(createResult.content[0].text);
      expect(created.mission_id).toBeDefined();
      expect(created.state).toBe('DRAFT');

      // Step 2: Get mission status
      const statusResult = await server['handleCallTool']({
        name: 'get_mission_status',
        arguments: { mission_id: created.mission_id },
      });

      const status = JSON.parse(statusResult.content[0].text);
      expect(status.mission_id).toBe(created.mission_id);
      expect(status.state).toBe('DRAFT');

      // Step 3: Transition to PLANNING
      const transitionResult = await server['handleCallTool']({
        name: 'transition_mission',
        arguments: {
          mission_id: created.mission_id,
          target_state: 'PLANNING',
        },
      });

      const transition = JSON.parse(transitionResult.content[0].text);
      expect(transition.success).toBe(true);
    });

    it('should list missions with filters', async () => {
      // Create missions in different states
      const createResult1 = await server['handleCallTool']({
        name: 'create_mission',
        arguments: {
          type: 'stock_analysis',
          domain: 'investment-war-room',
          description: 'Mission 1',
          ticker: 'AAPL',
        },
      });

      const createResult2 = await server['handleCallTool']({
        name: 'create_mission',
        arguments: {
          type: 'stock_analysis',
          domain: 'investment-war-room',
          description: 'Mission 2',
          ticker: 'NVDA',
        },
      });

      const mission1 = JSON.parse(createResult1.content[0].text);
      const mission2 = JSON.parse(createResult2.content[0].text);

      // Transition first mission
      const mission = server['missions'].get(mission1.mission_id);
      await stateMachine.transition(mission!, 'PLANNING');

      // List all missions
      const listResult = await server['handleCallTool']({
        name: 'list_missions',
        arguments: {},
      });

      const allMissions = JSON.parse(listResult.content[0].text);
      expect(allMissions).toHaveLength(2);

      // Filter by state
      const draftResult = await server['handleCallTool']({
        name: 'list_missions',
        arguments: { state: 'DRAFT' },
      });

      const draftMissions = JSON.parse(draftResult.content[0].text);
      expect(draftMissions).toHaveLength(1);
      expect(draftMissions[0].mission_id).toBe(mission2.mission_id);

      // Filter by domain
      const domainResult = await server['handleCallTool']({
        name: 'list_missions',
        arguments: { domain: 'investment-war-room' },
      });

      const domainMissions = JSON.parse(domainResult.content[0].text);
      expect(domainMissions).toHaveLength(2);
    });
  });

  describe('Evidence Pack Integration', () => {
    it('should return evidence pack for mission with data', async () => {
      // Create a mission
      const createResult = await server['handleCallTool']({
        name: 'create_mission',
        arguments: {
          type: 'stock_analysis',
          domain: 'investment-war-room',
          description: 'Test mission',
          ticker: 'TEST',
        },
      });

      const created = JSON.parse(createResult.content[0].text);

      // Build an evidence pack
      await evidenceController.buildPack(
        created.mission_id,
        'Test Analysis',
        [
          { type: 'sec_filing', identifier: '10-K', url: 'https://example.com/10k' },
          { type: 'news_article', identifier: 'test-news' },
        ]
      );

      // Get evidence pack
      const evidenceResult = await server['handleCallTool']({
        name: 'get_evidence_pack',
        arguments: { mission_id: created.mission_id },
      });

      const evidence = JSON.parse(evidenceResult.content[0].text);
      expect(evidence.mission_id).toBe(created.mission_id);
      expect(evidence.sources).toBeDefined();
      expect(evidence.items).toBeDefined();
    });

    it('should handle non-existent missions gracefully', async () => {
      const result = await server['handleCallTool']({
        name: 'get_evidence_pack',
        arguments: { mission_id: 'non-existent' },
      });

      const evidence = JSON.parse(result.content[0].text);
      expect(evidence.error || evidence.note).toBeDefined();
    });

    it('should return summary when no evidence pack exists', async () => {
      // Create a mission without evidence
      const createResult = await server['handleCallTool']({
        name: 'create_mission',
        arguments: {
          type: 'stock_analysis',
          domain: 'investment-war-room',
          description: 'Test mission',
          ticker: 'TEST',
        },
      });

      const created = JSON.parse(createResult.content[0].text);

      // Get evidence pack (should return note)
      const evidenceResult = await server['handleCallTool']({
        name: 'get_evidence_pack',
        arguments: { mission_id: created.mission_id },
      });

      const evidence = JSON.parse(evidenceResult.content[0].text);
      expect(evidence.mission_id).toBe(created.mission_id);
      expect(evidence.note || evidence.sources).toBeDefined();
    });
  });

  describe('Debate Summary Integration', () => {
    it('should return debate summary for active debates', async () => {
      // Create a mission
      const createResult = await server['handleCallTool']({
        name: 'create_mission',
        arguments: {
          type: 'stock_analysis',
          domain: 'investment-war-room',
          description: 'Test mission',
          ticker: 'TEST',
        },
      });

      const created = JSON.parse(createResult.content[0].text);

      // Create a debate session
      const debate = debateController.createDebate({
        mission_id: created.mission_id,
        domain: 'investment-war-room',
        max_rounds: 2,
      });

      // Initialize positions
      debateController.initializePositions(debate.id, [
        {
          analyst_id: 'analyst-1',
          stance: 'bullish',
          thesis_summary: 'Strong buy signal',
          conviction_score: 75,
        },
        {
          analyst_id: 'analyst-2',
          stance: 'bearish',
          thesis_summary: 'Overvalued',
          conviction_score: 60,
        },
      ]);

      // Get debate summary
      const debateResult = await server['handleCallTool']({
        name: 'get_debate_summary',
        arguments: { mission_id: created.mission_id },
      });

      const summary = JSON.parse(debateResult.content[0].text);
      expect(summary.mission_id).toBe(created.mission_id);
      expect(summary.debate_id).toBe(debate.id);
      expect(summary.positions).toBeDefined();
      expect(summary.positions).toHaveLength(2);
    });

    it('should handle missions without debates', async () => {
      // Create a mission without debates
      const createResult = await server['handleCallTool']({
        name: 'create_mission',
        arguments: {
          type: 'stock_analysis',
          domain: 'investment-war-room',
          description: 'Test mission',
          ticker: 'TEST',
        },
      });

      const created = JSON.parse(createResult.content[0].text);

      // Get debate summary
      const debateResult = await server['handleCallTool']({
        name: 'get_debate_summary',
        arguments: { mission_id: created.mission_id },
      });

      const summary = JSON.parse(debateResult.content[0].text);
      expect(summary.mission_id).toBe(created.mission_id);
      expect(summary.note || summary.debate_id).toBeDefined();
    });
  });

  describe('Resource Loading Integration', () => {
    it('should load and format mission report', async () => {
      // Create a mission
      const createResult = await server['handleCallTool']({
        name: 'create_mission',
        arguments: {
          type: 'stock_analysis',
          domain: 'investment-war-room',
          description: 'NVDA Analysis',
          ticker: 'NVDA',
        },
      });

      const created = JSON.parse(createResult.content[0].text);

      // Add some evidence
      await evidenceController.buildPack(
        created.mission_id,
        'NVDA Analysis',
        [{ type: 'sec_filing', identifier: '10-K' }]
      );

      // Get report resource
      const reportResult = await server['handleReadResource']({
        uri: `report://${created.mission_id}`,
      });

      expect(reportResult.contents).toHaveLength(1);
      expect(reportResult.contents[0].mimeType).toBe('text/markdown');
      expect(reportResult.contents[0].text).toContain('# Investment Analysis Report');
      expect(reportResult.contents[0].text).toContain('NVDA');
    });

    it('should handle non-existent resources gracefully', async () => {
      await expect(
        server['handleReadResource']({ uri: 'report://non-existent' })
      ).rejects.toThrow();
    });

    it('should return error for non-existent mission', async () => {
      const result = await server['handleCallTool']({
        name: 'get_mission_status',
        arguments: { mission_id: 'non-existent' },
      });

      const statusText = result.content[0].text;
      expect(statusText).toContain('Mission not found');
    });
  });

  describe('Tool Error Handling', () => {
    it('should handle unknown tool gracefully', async () => {
      const result = await server['handleCallTool']({
        name: 'unknown_tool',
        arguments: {},
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Unknown tool');
    });

    it('should handle tool execution errors', async () => {
      const result = await server['handleCallTool']({
        name: 'transition_mission',
        arguments: {
          mission_id: 'non-existent',
          target_state: 'PLANNING',
        },
      });

      expect(result.content[0].text).toBeDefined();
    });
  });

  describe('Resource Listings', () => {
    it('should list available resources for missions', async () => {
      // Create a mission
      await server['handleCallTool']({
        name: 'create_mission',
        arguments: {
          type: 'stock_analysis',
          domain: 'investment-war-room',
          description: 'Test mission',
          ticker: 'TEST',
        },
      });

      const resources = await server['listResources']();

      expect(resources.resources).toBeDefined();
      expect(resources.resources.length).toBeGreaterThan(0);

      const uris = resources.resources.map((r: any) => r.uri);
      expect(uris.some((uri: string) => uri.startsWith('mission://'))).toBe(true);
      expect(uris.some((uri: string) => uri.startsWith('report://'))).toBe(true);
      expect(uris.some((uri: string) => uri.startsWith('journal://'))).toBe(true);
    });
  });
});
