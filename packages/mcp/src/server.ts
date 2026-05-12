/**
 * one4all MCP Server
 *
 * Model Context Protocol server that exposes one4all kernel
 * functionality to MCP clients (Claude Desktop, IDE integrations, etc.)
 */

import type {
  Tool,
  Resource,
  Prompt,
  CallToolRequest,
  ReadResourceRequest,
  GetPromptRequest,
} from '@modelcontextprotocol/sdk/types.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { MissionStateMachine } from '@one4all/kernel';
import type {
  Mission,
  Brief,
  MissionState,
} from '@one4all/kernel/src/state-machine/types.js';

/**
 * MCP Server configuration
 */
export interface MCPServerConfig {
  name: string;
  version: string;
  stateMachine: MissionStateMachine;
  domainsPath: string;
}

/**
 * one4all MCP Server
 *
 * Exposes kernel functionality as MCP tools and resources:
 *
 * **Tools:**
 * - create_mission: Create a new analysis mission
 * - get_mission_status: Get mission status and state
 * - transition_mission: Manually transition mission state
 * - list_missions: List all missions
 * - get_evidence_pack: Get evidence pack for a mission
 * - get_debate_summary: Get debate summary for a mission
 *
 * **Resources:**
 * - mission://{missionId}: Full mission data
 * - report://{missionId}: Generated report for mission
 * - journal://{missionId}: Journal entry for mission
 * - constitution://{domain}: Constitution rules for domain
 * - agents://{domain}: List of agents in domain
 */
export class One4AllMCPServer {
  private server: Server;
  private config: MCPServerConfig;
  private stateMachine: MissionStateMachine;
  private missions: Map<string, Mission> = new Map();

  constructor(config: MCPServerConfig) {
    this.config = config;
    this.stateMachine = config.stateMachine;

    this.server = new Server(
      {
        name: config.name,
        version: config.version,
      },
      {
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
        },
      }
    );

    this.setupHandlers();
  }

  /**
   * Set up request handlers
   */
  private setupHandlers(): void {
    // Tool handlers
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: this.getToolDefinitions(),
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) =>
      this.handleCallTool(request)
    );

    // Resource handlers
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: await this.listResources(),
    }));

    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) =>
      this.handleReadResource(request)
    );

    // Prompt handlers
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => ({
      prompts: this.getPromptDefinitions(),
    }));

    this.server.setRequestHandler(GetPromptRequestSchema, async (request) =>
      this.handleGetPrompt(request)
    );
  }

  /**
   * Get tool definitions
   */
  private getToolDefinitions(): Tool[] {
    return [
      {
        name: 'create_mission',
        description: 'Create a new investment analysis mission',
        inputSchema: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['stock_analysis', 'portfolio_review', 'quick_screen'],
              description: 'Type of analysis',
            },
            domain: {
              type: 'string',
              description: 'Domain for the analysis (e.g., investment-war-room)',
            },
            description: {
              type: 'string',
              description: 'Description of the analysis request',
            },
            ticker: {
              type: 'string',
              description: 'Stock ticker symbol (for stock_analysis)',
            },
          },
          required: ['type', 'domain', 'description'],
        },
      },
      {
        name: 'get_mission_status',
        description: 'Get the current status of a mission',
        inputSchema: {
          type: 'object',
          properties: {
            mission_id: {
              type: 'string',
              description: 'Mission ID to check',
            },
          },
          required: ['mission_id'],
        },
      },
      {
        name: 'transition_mission',
        description: 'Manually transition a mission to a new state',
        inputSchema: {
          type: 'object',
          properties: {
            mission_id: {
              type: 'string',
              description: 'Mission ID to transition',
            },
            target_state: {
              type: 'string',
              enum: [
                'DRAFT',
                'PLANNING',
                'RESEARCHING',
                'ANALYZING',
                'CROSS_QA',
                'DEBATING',
                'SYNTHESIZING',
                'DECIDED',
                'JOURNALED',
                'FAILED',
                'HUMAN_REVIEW_GATE_1',
                'HUMAN_REVIEW_GATE_2',
                'HUMAN_REVIEW_GATE_3',
              ],
              description: 'Target state',
            },
          },
          required: ['mission_id', 'target_state'],
        },
      },
      {
        name: 'list_missions',
        description: 'List all missions with optional filtering',
        inputSchema: {
          type: 'object',
          properties: {
            state: {
              type: 'string',
              description: 'Filter by state',
            },
            domain: {
              type: 'string',
              description: 'Filter by domain',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of missions to return',
            },
          },
        },
      },
      {
        name: 'get_evidence_pack',
        description: 'Get the evidence pack for a mission',
        inputSchema: {
          type: 'object',
          properties: {
            mission_id: {
              type: 'string',
              description: 'Mission ID',
            },
          },
          required: ['mission_id'],
        },
      },
      {
        name: 'get_debate_summary',
        description: 'Get debate summary for a mission',
        inputSchema: {
          type: 'object',
          properties: {
            mission_id: {
              type: 'string',
              description: 'Mission ID',
            },
          },
          required: ['mission_id'],
        },
      },
    ];
  }

  /**
   * Handle tool execution
   */
  private async handleCallTool(request: CallToolRequest): Promise<{
    content: Array<{ type: string; text: string }>;
    isError?: boolean;
  }> {
    // Handle both MCP SDK format and test format
    const params = (request as any).params || request;
    const { name, arguments: args } = params;

    try {
      switch (name) {
        case 'create_mission':
          return await this.createMission(args);

        case 'get_mission_status':
          return await this.getMissionStatus(args);

        case 'transition_mission':
          return await this.transitionMission(args);

        case 'list_missions':
          return await this.listMissions(args);

        case 'get_evidence_pack':
          return await this.getEvidencePack(args);

        case 'get_debate_summary':
          return await this.getDebateSummary(args);

        default:
          return {
            content: [{ type: 'text', text: `Unknown tool: ${name}` }],
            isError: true,
          };
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error executing ${name}: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }

  /**
   * Create a new mission
   */
  private async createMission(args: any): Promise<{
    content: Array<{ type: string; text: string }>;
  }> {
    const brief: Brief = {
      type: args.type,
      domain: args.domain,
      description: args.description,
      ticker: args.ticker,
    };

    const mission = this.stateMachine.createMission(brief);
    this.missions.set(mission.id, mission);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              mission_id: mission.id,
              state: mission.state.current_state,
              created_at: mission.created_at,
              brief: mission.state.brief,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  /**
   * Get mission status
   */
  private async getMissionStatus(args: any): Promise<{
    content: Array<{ type: string; text: string }>;
  }> {
    const mission = this.missions.get(args.mission_id);

    if (!mission) {
      return {
        content: [{ type: 'text', text: `Mission not found: ${args.mission_id}` }],
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              mission_id: mission.id,
              state: mission.state.current_state,
              previous_state: mission.state.previous_state,
              state_entered_at: mission.state.state_entered_at,
              transitions: mission.transitions.length,
              created_at: mission.created_at,
              updated_at: mission.updated_at,
              brief: mission.state.brief,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  /**
   * Transition mission to new state
   */
  private async transitionMission(args: any): Promise<{
    content: Array<{ type: string; text: string }>;
  }> {
    const mission = this.missions.get(args.mission_id);

    if (!mission) {
      return {
        content: [{ type: 'text', text: `Mission not found: ${args.mission_id}` }],
      };
    }

    const targetState = args.target_state as MissionState;
    const result = await this.stateMachine.transition(mission, targetState);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  /**
   * List missions
   */
  private async listMissions(args: any): Promise<{
    content: Array<{ type: string; text: string }>;
  }> {
    let missions = Array.from(this.missions.values());

    // Apply filters
    if (args.state) {
      missions = missions.filter(m => m.state.current_state === args.state);
    }
    if (args.domain) {
      missions = missions.filter(m => m.state.brief?.domain === args.domain);
    }
    if (args.limit) {
      missions = missions.slice(0, args.limit);
    }

    // Sort by updated_at descending
    missions.sort((a, b) => b.updated_at.getTime() - a.updated_at.getTime());

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            missions.map(m => ({
              mission_id: m.id,
              state: m.state.current_state,
              domain: m.state.brief?.domain,
              type: m.state.brief?.type,
              description: m.state.brief?.description,
              created_at: m.created_at,
              updated_at: m.updated_at,
            })),
            null,
            2
          ),
        },
      ],
    };
  }

  /**
   * Get evidence pack (placeholder)
   */
  private async getEvidencePack(args: any): Promise<{
    content: Array<{ type: string; text: string }>;
  }> {
    // This would integrate with the EvidenceController
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              mission_id: args.mission_id,
              note: 'Evidence pack retrieval requires full kernel integration',
            },
            null,
            2
          ),
        },
      ],
    };
  }

  /**
   * Get debate summary (placeholder)
   */
  private async getDebateSummary(args: any): Promise<{
    content: Array<{ type: string; text: string }>;
  }> {
    // This would integrate with the DebateController
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              mission_id: args.mission_id,
              note: 'Debate summary retrieval requires full kernel integration',
            },
            null,
            2
          ),
        },
      ],
    };
  }

  /**
   * List available resources
   */
  private async listResources(): Promise<{ resources: Resource[] }> {
    const resources: Resource[] = [];

    for (const [id, mission] of this.missions) {
      resources.push(
        {
          uri: `mission://${id}`,
          name: `Mission: ${mission.state.brief?.description || id}`,
          description: `Full mission data for ${id}`,
          mimeType: 'application/json',
        },
        {
          uri: `report://${id}`,
          name: `Report for ${id}`,
          description: `Generated report for mission ${id}`,
          mimeType: 'text/markdown',
        },
        {
          uri: `journal://${id}`,
          name: `Journal entry for ${id}`,
          description: `Journal entry for mission ${id}`,
          mimeType: 'text/markdown',
        }
      );
    }

    return { resources };
  }

  /**
   * Read resource content
   */
  private async handleReadResource(request: ReadResourceRequest): Promise<{
    contents: Array<{ uri: string; mimeType: string; text?: string; blob?: string }>;
  }> {
    // Handle both MCP SDK format and test format
    const params = (request as any).params || request;
    const { uri } = params;

    // Parse URI
    const [type, id] = uri.split('://');

    switch (type) {
      case 'mission': {
        const mission = this.missions.get(id);
        if (!mission) {
          throw new Error(`Mission not found: ${id}`);
        }
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(mission, null, 2),
            },
          ],
        };
      }

      case 'report': {
        // Would generate actual report
        return {
          contents: [
            {
              uri,
              mimeType: 'text/markdown',
              text: `# Report for ${id}\n\nReport generation requires full kernel integration.`,
            },
          ],
        };
      }

      case 'journal': {
        // Would retrieve actual journal entry
        return {
          contents: [
            {
              uri,
              mimeType: 'text/markdown',
              text: `# Journal Entry for ${id}\n\nJournal retrieval requires full kernel integration.`,
            },
          ],
        };
      }

      case 'constitution': {
        // Would load domain constitution
        return {
          contents: [
            {
              uri,
              mimeType: 'text/yaml',
              text: `# Constitution for ${id}\n\nConstitution loading requires file system access.`,
            },
          ],
        };
      }

      case 'agents': {
        // Would list domain agents
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: `[]\n\nAgent listing requires file system access.`,
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown resource type: ${type}`);
    }
  }

  /**
   * Get prompt definitions
   */
  private getPromptDefinitions(): Prompt[] {
    return [
      {
        name: 'stock_analysis',
        description: 'Start a stock analysis mission',
        arguments: [
          {
            name: 'ticker',
            description: 'Stock ticker symbol',
            required: true,
          },
          {
            name: 'thesis',
            description: 'Initial investment thesis to test',
            required: false,
          },
        ],
      },
      {
        name: 'debate_question',
        description: 'Ask a specific question during the debate phase',
        arguments: [
          {
            name: 'mission_id',
            description: 'Mission ID',
            required: true,
          },
          {
            name: 'question',
            description: 'Question to pose to analysts',
            required: true,
          },
          {
            name: 'target_analyst',
            description: 'Specific analyst to question',
            required: false,
          },
        ],
      },
    ];
  }

  /**
   * Handle get prompt
   */
  private async handleGetPrompt(request: GetPromptRequest): Promise<{
    messages: Array<{ role: string; content: { type: string; text: string } }>;
  }> {
    // Handle both MCP SDK format and test format
    const params = (request as any).params || request;
    const { name, arguments: args } = params;

    switch (name) {
      case 'stock_analysis': {
        const ticker = args?.ticker || 'UNKNOWN';
        const thesis = args?.thesis || 'Comprehensive analysis requested';

        return {
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `Please conduct a comprehensive investment analysis of ${ticker}.\n\nInitial thesis: ${thesis}\n\nUse the create_mission tool to start this analysis.`,
              },
            },
          ],
        };
      }

      case 'debate_question': {
        const missionId = args?.mission_id || 'UNKNOWN';
        const question = args?.question || 'Please provide your analysis';
        const targetAnalyst = args?.target_analyst
          ? `This question is directed to: ${args.target_analyst}`
          : '';

        return {
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `Regarding mission ${missionId}:\n\n${question}\n\n${targetAnalyst}\n\nPlease use the get_debate_summary tool first to understand the current debate state.`,
              },
            },
          ],
        };
      }

      default:
        return {
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `Unknown prompt: ${name}`,
              },
            },
          ],
        };
    }
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }

  /**
   * Get the underlying MCP server
   */
  getServer(): Server {
    return this.server;
  }

  /**
   * Register a mission
   */
  registerMission(mission: Mission): void {
    this.missions.set(mission.id, mission);
  }

  /**
   * Unregister a mission
   */
  unregisterMission(missionId: string): void {
    this.missions.delete(missionId);
  }
}

/**
 * Create and start an MCP server
 */
export async function createMCPServer(config: MCPServerConfig): Promise<One4AllMCPServer> {
  const server = new One4AllMCPServer(config);
  await server.start();
  return server;
}
