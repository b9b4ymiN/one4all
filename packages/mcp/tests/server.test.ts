/**
 * MCP Server Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  One4AllMCPServer,
  createMCPServer,
  type MCPServerConfig,
} from '../src/server.js';
import { MissionStateMachine } from '@one4all/kernel';

// MissionState enum for reference
enum MissionState {
  DRAFT = 'DRAFT',
  PLANNING = 'PLANNING',
  RESEARCHING = 'RESEARCHING',
  ANALYZING = 'ANALYZING',
  DEBATING = 'DEBATING',
  SYNTHESIZING = 'SYNTHESIZING',
  DECIDED = 'DECIDED',
  JOURNALED = 'JOURNALED',
  FAILED = 'FAILED',
}

describe('One4AllMCPServer', () => {
  let server: One4AllMCPServer;
  let stateMachine: MissionStateMachine;
  let config: MCPServerConfig;

  // Helper to create proper request structure
  const createToolRequest = (name: string, args: any = {}) => ({
    params: { name, arguments: args },
  } as any);

  const createPromptRequest = (name: string, args: any = {}) => ({
    params: { name, arguments: args },
  } as any);

  beforeEach(() => {
    stateMachine = new MissionStateMachine();

    config = {
      name: 'one4all-mcp-test',
      version: '1.0.0',
      stateMachine,
      domainsPath: '/tmp/domains',
    };

    server = new One4AllMCPServer(config);
  });

  describe('Construction', () => {
    it('should create server with config', () => {
      expect(server).toBeDefined();
    });

    it('should store state machine reference', () => {
      expect(server['stateMachine']).toBe(stateMachine);
    });

    it('should have empty missions map', () => {
      expect(server['missions'].size).toBe(0);
    });
  });

  describe('Tool Definitions', () => {
    it('should define create_mission tool', () => {
      const tools = server['getToolDefinitions']();
      const createTool = tools.find(t => t.name === 'create_mission');

      expect(createTool).toBeDefined();
      expect(createTool?.description).toBe('Create a new investment analysis mission');
      expect(createTool?.inputSchema).toBeDefined();
    });

    it('should define get_mission_status tool', () => {
      const tools = server['getToolDefinitions']();
      const statusTool = tools.find(t => t.name === 'get_mission_status');

      expect(statusTool).toBeDefined();
      expect(statusTool?.description).toBe('Get the current status of a mission');
    });

    it('should define transition_mission tool', () => {
      const tools = server['getToolDefinitions']();
      const transitionTool = tools.find(t => t.name === 'transition_mission');

      expect(transitionTool).toBeDefined();
      expect(transitionTool?.description).toBe('Manually transition a mission to a new state');
    });

    it('should define list_missions tool', () => {
      const tools = server['getToolDefinitions']();
      const listTool = tools.find(t => t.name === 'list_missions');

      expect(listTool).toBeDefined();
      expect(listTool?.description).toBe('List all missions with optional filtering');
    });

    it('should define get_evidence_pack tool', () => {
      const tools = server['getToolDefinitions']();
      const evidenceTool = tools.find(t => t.name === 'get_evidence_pack');

      expect(evidenceTool).toBeDefined();
      expect(evidenceTool?.description).toBe('Get the evidence pack for a mission');
    });

    it('should define get_debate_summary tool', () => {
      const tools = server['getToolDefinitions']();
      const debateTool = tools.find(t => t.name === 'get_debate_summary');

      expect(debateTool).toBeDefined();
      expect(debateTool?.description).toBe('Get debate summary for a mission');
    });
  });

  describe('Tool Execution', () => {
    it('should create a mission', async () => {
      const result = await server['handleCallTool']({
        name: 'create_mission',
        arguments: {
          type: 'stock_analysis',
          domain: 'investment-war-room',
          description: 'Test analysis',
          ticker: 'TEST',
        },
      });

      expect(result.isError).toBeUndefined();
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');

      const response = JSON.parse(result.content[0].text);
      expect(response.mission_id).toBeDefined();
      expect(response.state).toBe(MissionState.DRAFT);
    });

    it('should get mission status', async () => {
      // First create a mission
      const createResult = await server['handleCallTool']({
        name: 'create_mission',
        arguments: {
          type: 'stock_analysis',
          domain: 'investment-war-room',
          description: 'Test analysis',
          ticker: 'TEST',
        },
      });

      const created = JSON.parse(createResult.content[0].text);

      // Then get status
      const statusResult = await server['handleCallTool']({
        name: 'get_mission_status',
        arguments: {
          mission_id: created.mission_id,
        },
      });

      expect(statusResult.isError).toBeUndefined();

      const status = JSON.parse(statusResult.content[0].text);
      expect(status.mission_id).toBe(created.mission_id);
      expect(status.state).toBe('DRAFT');
    });

    it('should return error for non-existent mission', async () => {
      const result = await server['handleCallTool']({
        name: 'get_mission_status',
        arguments: {
          mission_id: 'non-existent',
        },
      });

      expect(result.content[0].text).toContain('Mission not found');
    });

    it('should list missions', async () => {
      // Create two missions
      await server['handleCallTool']({
        name: 'create_mission',
        arguments: {
          type: 'stock_analysis',
          domain: 'investment-war-room',
          description: 'Mission 1',
          ticker: 'TEST1',
        },
      });

      await server['handleCallTool']({
        name: 'create_mission',
        arguments: {
          type: 'portfolio_review',
          domain: 'investment-war-room',
          description: 'Mission 2',
        },
      });

      // List missions
      const result = await server['handleCallTool']({
        name: 'list_missions',
        arguments: {},
      });

      expect(result.isError).toBeUndefined();

      const missions = JSON.parse(result.content[0].text);
      expect(missions).toHaveLength(2);
    });

    it('should filter missions by state', async () => {
      // Create missions and transition one
      const createResult = await server['handleCallTool']({
        name: 'create_mission',
        arguments: {
          type: 'stock_analysis',
          domain: 'investment-war-room',
          description: 'Test',
          ticker: 'TEST',
        },
      });

      const created = JSON.parse(createResult.content[0].text);
      const mission = server['missions'].get(created.mission_id);

      // Transition to PLANNING
      await stateMachine.transition(mission!, 'PLANNING' as any);

      // Filter by DRAFT state
      const result = await server['handleCallTool']({
        name: 'list_missions',
        arguments: { state: 'DRAFT' },
      });

      const missions = JSON.parse(result.content[0].text);
      expect(missions).toHaveLength(0);
    });

    it('should limit mission list', async () => {
      // Create three missions
      for (let i = 0; i < 3; i++) {
        await server['handleCallTool']({
          name: 'create_mission',
          arguments: {
            type: 'stock_analysis',
            domain: 'investment-war-room',
            description: `Mission ${i}`,
            ticker: `TEST${i}`,
          },
        });
      }

      // Limit to 2
      const result = await server['handleCallTool']({
        name: 'list_missions',
        arguments: { limit: 2 },
      });

      const missions = JSON.parse(result.content[0].text);
      expect(missions.length).toBeLessThanOrEqual(2);
    });
  });

  describe('Mission Transitions', () => {
    it('should transition mission state', async () => {
      // Create mission
      const createResult = await server['handleCallTool']({
        name: 'create_mission',
        arguments: {
          type: 'stock_analysis',
          domain: 'investment-war-room',
          description: 'Test',
          ticker: 'TEST',
        },
      });

      const created = JSON.parse(createResult.content[0].text);

      // Transition to PLANNING
      const transitionResult = await server['handleCallTool']({
        name: 'transition_mission',
        arguments: {
          mission_id: created.mission_id,
          target_state: 'PLANNING',
        },
      });

      expect(transitionResult.isError).toBeUndefined();

      const transition = JSON.parse(transitionResult.content[0].text);
      expect(transition.success).toBe(true);
    });

    it('should return error for invalid transition', async () => {
      // Create mission
      const createResult = await server['handleCallTool']({
        name: 'create_mission',
        arguments: {
          type: 'stock_analysis',
          domain: 'investment-war-room',
          description: 'Test',
          ticker: 'TEST',
        },
      });

      const created = JSON.parse(createResult.content[0].text);

      // Try invalid transition (DRAFT -> DECIDED)
      const transitionResult = await server['handleCallTool']({
        name: 'transition_mission',
        arguments: {
          mission_id: created.mission_id,
          target_state: 'DECIDED',
        },
      });

      const transition = JSON.parse(transitionResult.content[0].text);
      expect(transition.success).toBe(false);
    });
  });

  describe('Resources', () => {
    beforeEach(async () => {
      // Create a test mission
      await server['handleCallTool']({
        name: 'create_mission',
        arguments: {
          type: 'stock_analysis',
          domain: 'investment-war-room',
          description: 'Test mission',
          ticker: 'TEST',
        },
      });
    });

    it('should list resources', async () => {
      const resources = await server['listResources']();

      expect(resources.resources).toBeDefined();
      expect(resources.resources.length).toBeGreaterThan(0);

      // Should have mission, report, and journal resources
      const resourceUris = resources.resources.map(r => r.uri);
      expect(resourceUris.some(uri => uri.startsWith('mission://'))).toBe(true);
      expect(resourceUris.some(uri => uri.startsWith('report://'))).toBe(true);
      expect(resourceUris.some(uri => uri.startsWith('journal://'))).toBe(true);
    });

    it('should read mission resource', async () => {
      const missions = server['missions'];
      const missionId = Array.from(missions.keys())[0];

      const result = await server['handleReadResource']({
        uri: `mission://${missionId}`,
      });

      expect(result.contents).toHaveLength(1);
      expect(result.contents[0].uri).toBe(`mission://${missionId}`);
      expect(result.contents[0].mimeType).toBe('application/json');

      const mission = JSON.parse(result.contents[0].text!);
      expect(mission.id).toBe(missionId);
    });

    it('should read report resource', async () => {
      const missions = server['missions'];
      const missionId = Array.from(missions.keys())[0];

      const result = await server['handleReadResource']({
        uri: `report://${missionId}`,
      });

      expect(result.contents).toHaveLength(1);
      expect(result.contents[0].uri).toBe(`report://${missionId}`);
      expect(result.contents[0].mimeType).toBe('text/markdown');
    });

    it('should return error for unknown resource', async () => {
      await expect(
        server['handleReadResource']({
          uri: 'unknown://test',
        })
      ).rejects.toThrow();
    });
  });

  describe('Prompts', () => {
    it('should define stock_analysis prompt', () => {
      const prompts = server['getPromptDefinitions']();
      const stockPrompt = prompts.find(p => p.name === 'stock_analysis');

      expect(stockPrompt).toBeDefined();
      expect(stockPrompt?.description).toBe('Start a stock analysis mission');
      expect(stockPrompt?.arguments).toHaveLength(2);
    });

    it('should define debate_question prompt', () => {
      const prompts = server['getPromptDefinitions']();
      const debatePrompt = prompts.find(p => p.name === 'debate_question');

      expect(debatePrompt).toBeDefined();
      expect(debatePrompt?.description).toBe('Ask a specific question during the debate phase');
      expect(debatePrompt?.arguments).toHaveLength(3);
    });

    it('should get stock_analysis prompt', async () => {
      const result = await server['handleGetPrompt']({
        params: {
          name: 'stock_analysis',
          arguments: {
            ticker: 'AAPL',
            thesis: 'Strong fundamentals',
          },
        },
      } as any);

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].role).toBe('user');
      expect(result.messages[0].content.text).toContain('AAPL');
      expect(result.messages[0].content.text).toContain('Strong fundamentals');
    });

    it('should get debate_question prompt', async () => {
      const result = await server['handleGetPrompt']({
        params: {
          name: 'debate_question',
          arguments: {
            mission_id: 'test-mission',
            question: 'What about valuation?',
            target_analyst: 'damodaran-valuation',
          },
        },
      } as any);

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].content.text).toContain('test-mission');
      expect(result.messages[0].content.text).toContain('What about valuation?');
      expect(result.messages[0].content.text).toContain('damodaran-valuation');
    });

    it('should handle unknown prompt', async () => {
      const result = await server['handleGetPrompt']({
        params: {
          name: 'unknown',
          arguments: {},
        },
      } as any);

      expect(result.messages[0].content.text).toContain('Unknown prompt');
    });
  });

  describe('Mission Registration', () => {
    it('should register mission', () => {
      const mission = stateMachine.createMission({
        type: 'stock_analysis',
        domain: 'investment-war-room',
        description: 'Test',
        ticker: 'TEST',
      });

      server.registerMission(mission);

      expect(server['missions'].has(mission.id)).toBe(true);
    });

    it('should unregister mission', () => {
      const mission = stateMachine.createMission({
        type: 'stock_analysis',
        domain: 'investment-war-room',
        description: 'Test',
        ticker: 'TEST',
      });

      server.registerMission(mission);
      expect(server['missions'].has(mission.id)).toBe(true);

      server.unregisterMission(mission.id);
      expect(server['missions'].has(mission.id)).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle unknown tool', async () => {
      const result = await server['handleCallTool']({
        params: {
          name: 'unknown_tool',
          arguments: {},
        },
      } as any);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Unknown tool');
    });

    it('should handle tool execution errors', async () => {
      // Mock a failing transition
      const result = await server['handleCallTool']({
        params: {
          name: 'transition_mission',
          arguments: {
            mission_id: 'non-existent',
            target_state: 'PLANNING',
          },
        },
      } as any);

      expect(result.content[0].text).toBeDefined();
    });

    it('should handle create mission with missing required fields', async () => {
      // This should not throw but return structured content
      const result = await server['handleCallTool']({
        params: {
          name: 'create_mission',
          arguments: {
            type: 'stock_analysis',
            // missing domain and description
          },
        },
      } as any);

      expect(result.content).toBeDefined();
    });
  });

  describe('Evidence and Debate Tools', () => {
    it('should return message for non-existent mission evidence pack', async () => {
      const result = await server['getEvidencePack']({ mission_id: 'non-existent' });

      expect(result.content[0].type).toBe('text');
      const pack = JSON.parse(result.content[0].text);
      expect(pack.mission_id).toBe('non-existent');
      // Should have error or note about no evidence pack
      expect(pack.error || pack.note).toBeDefined();
    });

    it('should return evidence data for existing mission', async () => {
      // First create a mission
      const createResult = await server['handleCallTool']({
        name: 'create_mission',
        arguments: {
          type: 'stock_analysis',
          domain: 'investment-war-room',
          description: 'Test analysis',
          ticker: 'TEST',
        },
      });

      const created = JSON.parse(createResult.content[0].text);

      // Then get evidence pack
      const result = await server['getEvidencePack']({ mission_id: created.mission_id });

      expect(result.content[0].type).toBe('text');
      const pack = JSON.parse(result.content[0].text);
      expect(pack.mission_id).toBe(created.mission_id);
      // Should have evidence structure even if no pack exists yet
      expect(pack.sources || pack.note).toBeDefined();
    });

    it('should return message for non-existent mission debate summary', async () => {
      const result = await server['getDebateSummary']({ mission_id: 'non-existent' });

      expect(result.content[0].type).toBe('text');
      const summary = JSON.parse(result.content[0].text);
      expect(summary.mission_id).toBe('non-existent');
      // Should have error or note about no debate
      expect(summary.error || summary.note).toBeDefined();
    });

    it('should return debate summary structure for existing mission', async () => {
      // First create a mission
      const createResult = await server['handleCallTool']({
        name: 'create_mission',
        arguments: {
          type: 'stock_analysis',
          domain: 'investment-war-room',
          description: 'Test analysis',
          ticker: 'TEST',
        },
      });

      const created = JSON.parse(createResult.content[0].text);

      // Then get debate summary
      const result = await server['getDebateSummary']({ mission_id: created.mission_id });

      expect(result.content[0].type).toBe('text');
      const summary = JSON.parse(result.content[0].text);
      expect(summary.mission_id).toBe(created.mission_id);
      // Should have debate structure even if no debate exists yet
      expect(summary.error || summary.note || summary.debate_id).toBeDefined();
    });
  });

  describe('Server Access', () => {
    it('should expose underlying MCP server', () => {
      const mcpServer = server.getServer();
      expect(mcpServer).toBeDefined();
    });
  });
});
