/**
 * MCP Inspector Validation Tests
 *
 * These tests validate that MCP servers are properly configured
 * and can be inspected by the MCP Inspector tool.
 *
 * To use MCP Inspector manually:
 *
 * 1. Install inspector: npm install -g @modelcontextprotocol/inspector
 * 2. Test @one4all/mcp server:
 *    npx @modelcontextprotocol/inspector node packages/mcp/dist/index.js
 * 3. Test @one4all/mcp-server:
 *    npx @modelcontextprotocol/inspector node packages/mcp-server/dist/index.js
 * 4. Test stock-price-server:
 *    npx @modelcontextprotocol/inspector node mcp-servers/stock-price-server/index.js
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  One4AllMCPServer,
  type MCPServerConfig,
} from '../../src/server.js';
import { MissionStateMachine, createEvidenceController, createDebateController } from '@one4all/kernel';

describe('MCP Inspector Validation', () => {
  describe('@one4all/mcp Server', () => {
    let server: One4AllMCPServer;

    beforeEach(() => {
      const stateMachine = new MissionStateMachine();
      const evidenceController = createEvidenceController();
      const debateController = createDebateController();

      const config: MCPServerConfig = {
        name: 'one4all-mcp',
        version: '1.0.0',
        stateMachine,
        domainsPath: '/tmp/domains',
        evidenceController,
        debateController,
      };

      server = new One4AllMCPServer(config);
    });

    it('should expose all 33 MCP tools with correct schemas', async () => {
      const tools = server['getToolDefinitions']();

      expect(tools).toHaveLength(33);

      const toolNames = tools.map(t => t.name);
      // Core mission tools
      expect(toolNames).toContain('create_mission');
      expect(toolNames).toContain('get_mission_status');
      expect(toolNames).toContain('transition_mission');
      expect(toolNames).toContain('list_missions');
      expect(toolNames).toContain('get_evidence_pack');
      expect(toolNames).toContain('get_debate_summary');
      // Enhanced mission tools
      expect(toolNames).toContain('mission_run');
      expect(toolNames).toContain('mission_abort');
      expect(toolNames).toContain('mission_replay');
      // Agent tools
      expect(toolNames).toContain('agent_create');
      expect(toolNames).toContain('agent_show');
      expect(toolNames).toContain('agent_edit');
      expect(toolNames).toContain('agent_remove');
      expect(toolNames).toContain('agent_list');
      expect(toolNames).toContain('agent_import');
      expect(toolNames).toContain('agent_export');
      // Domain tools
      expect(toolNames).toContain('domain_create');
      expect(toolNames).toContain('domain_show');
      expect(toolNames).toContain('domain_edit');
      expect(toolNames).toContain('domain_remove');
      expect(toolNames).toContain('domain_list');
      expect(toolNames).toContain('domain_validate');
      // Constitution tools
      expect(toolNames).toContain('constitution_load');
      expect(toolNames).toContain('constitution_validate');
      expect(toolNames).toContain('constitution_list');
      // Journal tools
      expect(toolNames).toContain('journal_update');
      expect(toolNames).toContain('journal_list');
      // Validation tools
      expect(toolNames).toContain('validate_agents');
      expect(toolNames).toContain('validate_domains');
      expect(toolNames).toContain('validate_constitutions');
      expect(toolNames).toContain('validate_all');

      // Verify tool schemas
      const createMission = tools.find(t => t.name === 'create_mission')!;
      expect(createMission.inputSchema).toBeDefined();
      expect(createMission.inputSchema.required).toContain('type');
      expect(createMission.inputSchema.required).toContain('domain');
      expect(createMission.inputSchema.required).toContain('description');
    });

    it('should expose all 5 resource types', async () => {
      // Create a test mission first
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
      const resourceUris = resources.resources.map((r: any) => r.uri.split('://')[0]);

      expect(resourceUris).toContain('mission');
      expect(resourceUris).toContain('report');
      expect(resourceUris).toContain('journal');

      // Verify resource properties
      resources.resources.forEach((resource: any) => {
        expect(resource.uri).toBeDefined();
        expect(resource.name).toBeDefined();
        expect(resource.description).toBeDefined();
        expect(resource.mimeType).toBeDefined();
      });
    });

    it('should handle tool calls correctly for inspector', async () => {
      // Test create_mission
      const createResult = await server['handleCallTool']({
        name: 'create_mission',
        arguments: {
          type: 'stock_analysis',
          domain: 'investment-war-room',
          description: 'Test mission',
          ticker: 'TEST',
        },
      });

      expect(createResult.isError).toBeUndefined();
      const created = JSON.parse(createResult.content[0].text);
      expect(created.mission_id).toBeDefined();

      // Test get_mission_status
      const statusResult = await server['handleCallTool']({
        name: 'get_mission_status',
        arguments: { mission_id: created.mission_id },
      });

      const status = JSON.parse(statusResult.content[0].text);
      expect(status.mission_id).toBe(created.mission_id);
    });

    it('should handle resource reads correctly for inspector', async () => {
      // Create a test mission
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

      // Test mission resource
      const missionResult = await server['handleReadResource']({
        uri: `mission://${created.mission_id}`,
      });

      expect(missionResult.contents).toHaveLength(1);
      expect(missionResult.contents[0].uri).toBe(`mission://${created.mission_id}`);
      expect(missionResult.contents[0].mimeType).toBe('application/json');
    });

    it('should expose prompt definitions', () => {
      const prompts = server['getPromptDefinitions']();

      expect(prompts).toHaveLength(2);
      expect(prompts[0].name).toBe('stock_analysis');
      expect(prompts[1].name).toBe('debate_question');
    });
  });

  describe('MCP Protocol Compliance', () => {
    it('should follow MCP tool response format', async () => {
      const stateMachine = new MissionStateMachine();
      const evidenceController = createEvidenceController();
      const debateController = createDebateController();

      const server = new One4AllMCPServer({
        name: 'one4all-mcp',
        version: '1.0.0',
        stateMachine,
        domainsPath: '/tmp/domains',
        evidenceController,
        debateController,
      });

      const result = await server['handleCallTool']({
        name: 'create_mission',
        arguments: {
          type: 'stock_analysis',
          domain: 'investment-war-room',
          description: 'Test',
        },
      });

      // MCP tool response format
      expect(result.content).toBeInstanceOf(Array);
      expect(result.content[0]).toHaveProperty('type');
      expect(result.content[0].type).toBe('text');
      expect(result.content[0]).toHaveProperty('text');
    });

    it('should follow MCP resource response format', async () => {
      const stateMachine = new MissionStateMachine();
      const evidenceController = createEvidenceController();
      const debateController = createDebateController();

      const server = new One4AllMCPServer({
        name: 'one4all-mcp',
        version: '1.0.0',
        stateMachine,
        domainsPath: '/tmp/domains',
        evidenceController,
        debateController,
      });

      // Create a mission first
      await server['handleCallTool']({
        name: 'create_mission',
        arguments: {
          type: 'stock_analysis',
          domain: 'investment-war-room',
          description: 'Test',
        },
      });

      const resources = await server['listResources']();

      // MCP resource list format
      expect(resources).toHaveProperty('resources');
      expect(resources.resources).toBeInstanceOf(Array);
    });
  });
});
