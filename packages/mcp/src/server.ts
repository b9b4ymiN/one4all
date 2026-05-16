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
import { readFile, readdir, access } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import * as yaml from 'js-yaml';

import { MissionStateMachine, createEvidenceController, EvidenceController, createDebateController, DebateController } from '@one4all/kernel';
import type {
  Mission,
  Brief,
  MissionState,
} from '@one4all/kernel/src/state-machine/types.js';
import type {
  EvidencePack,
  EvidenceSummary,
} from '@one4all/kernel';
import type {
  DebateSession,
  DebateResult,
} from '@one4all/kernel';

// Import handler modules
import * as agentHandler from './modules/agent-handler.js';
import * as domainHandler from './modules/domain-handler.js';
import * as inquiryHandler from './modules/inquiry-handler.js';
import * as missionEnhanced from './modules/mission-enhanced.js';
import * as constitutionHandler from './modules/constitution-handler.js';
import * as journalHandler from './modules/journal-handler.js';
import * as validator from './modules/validator.js';

/**
 * MCP Server configuration
 */
export interface MCPServerConfig {
  name: string;
  version: string;
  stateMachine: MissionStateMachine;
  domainsPath: string;
  evidenceController?: EvidenceController;
  debateController?: DebateController;
}

/**
 * one4all MCP Server
 *
 * Exposes kernel functionality as MCP tools and resources:
 *
 * **Tools (27 total):**
 *
 * Mission Management (9):
 * - create_mission: Create a new analysis mission
 * - get_mission_status: Get mission status and state
 * - transition_mission: Manually transition mission state
 * - list_missions: List all missions
 * - mission_run: Execute mission (fire-and-forget)
 * - mission_abort: Abort running mission
 * - mission_replay: Replay mission with new config
 * - get_evidence_pack: Get evidence pack for a mission
 * - get_debate_summary: Get debate summary for a mission
 *
 * Agent Management (7):
 * - agent_create: Create new agent
 * - agent_show: Show agent details
 * - agent_edit: Edit existing agent
 * - agent_remove: Delete agent
 * - agent_list: List all agents
 * - agent_import: Import agents from YAML
 * - agent_export: Export agent configuration
 *
 * Domain Management (6):
 * - domain_create: Create new domain
 * - domain_show: Show domain details
 * - domain_edit: Edit domain config
 * - domain_remove: Delete domain
 * - domain_list: List all domains
 * - domain_validate: Validate domain configuration
 *
 * Constitution Management (3):
 * - constitution_load: Load constitution for domain
 * - constitution_validate: Validate constitution rules
 * - constitution_list: List available constitutions
 *
 * Journal Operations (2):
 * - journal_update: Update journal entry outcome
 * - journal_list: List all journal entries
 *
 * Inquiry (2):
 * - ask: Ask a direct investment question about a stock
 * - list_thai_tickers: List Thai stock tickers with auto .BK suffix
 *
 * Validation (4):
 * - validate_agents: Validate all agents
 * - validate_domains: Validate all domains
 * - validate_constitutions: Validate all constitutions
 * - validate_all: Run all validations
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
  private evidenceController: EvidenceController;
  private debateController: DebateController;
  private missions: Map<string, Mission> = new Map();

  constructor(config: MCPServerConfig) {
    this.config = config;
    this.stateMachine = config.stateMachine;
    this.evidenceController = config.evidenceController ?? createEvidenceController();
    this.debateController = config.debateController ?? createDebateController();

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
        } as any,
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
        } as any,
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
        } as any,
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
        } as any,
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
        } as any,
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
        } as any,
      },
      ...missionEnhanced.getMissionEnhancedTools(),
      ...agentHandler.getAgentTools(),
      ...domainHandler.getDomainTools(),
      ...constitutionHandler.getConstitutionTools(),
      ...inquiryHandler.getInquiryTools(),
      ...journalHandler.getJournalTools(),
      ...validator.getValidatorTools(),
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
        // Mission tools (base)
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

        // Mission enhanced tools
        case 'mission_run':
          return await missionEnhanced.handleMissionRun(args, this.stateMachine, this.missions);

        case 'mission_abort':
          return await missionEnhanced.handleMissionAbort(args, this.missions);

        case 'mission_replay':
          return await missionEnhanced.handleMissionReplay(args, this.stateMachine, this.missions);

        // Agent tools
        case 'agent_create':
          return await agentHandler.handleAgentCreate(args);

        case 'agent_show':
          return await agentHandler.handleAgentShow(args);

        case 'agent_edit':
          return await agentHandler.handleAgentEdit(args);

        case 'agent_remove':
          return await agentHandler.handleAgentRemove(args);

        case 'agent_list':
          return await agentHandler.handleAgentList(args);

        case 'agent_import':
          return await agentHandler.handleAgentImport(args);

        case 'agent_export':
          return await agentHandler.handleAgentExport(args);

        // Domain tools
        case 'domain_create':
          return await domainHandler.handleDomainCreate(args);

        case 'domain_show':
          return await domainHandler.handleDomainShow(args);

        case 'domain_edit':
          return await domainHandler.handleDomainEdit(args);

        case 'domain_remove':
          return await domainHandler.handleDomainRemove(args);

        case 'domain_list':
          return await domainHandler.handleDomainList();

        case 'domain_validate':
          return await domainHandler.handleDomainValidate(args);

        // Constitution tools
        case 'constitution_load':
          return await constitutionHandler.handleConstitutionLoad(args);

        case 'constitution_validate':
          return await constitutionHandler.handleConstitutionValidate(args);

        case 'constitution_list':
          return await constitutionHandler.handleConstitutionList();

        // Journal tools
        case 'journal_update':
          return await journalHandler.handleJournalUpdate(args);

        case 'journal_list':
          return await journalHandler.handleJournalList();

        // Inquiry tools
        case 'ask':
          return await inquiryHandler.handleAsk(args);

        case 'list_thai_tickers':
          return await inquiryHandler.handleListThaiTickers();

        // Validation tools
        case 'validate_agents':
          return await validator.handleValidateAgents(args);

        case 'validate_domains':
          return await validator.handleValidateDomains();

        case 'validate_constitutions':
          return await validator.handleValidateConstitutions();

        case 'validate_all':
          return await validator.handleValidateAll();

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
   * Get evidence pack for a mission
   */
  private async getEvidencePack(args: any): Promise<{
    content: Array<{ type: string; text: string }>;
  }> {
    const { mission_id } = args;

    // Check if mission exists
    const mission = this.missions.get(mission_id);
    if (!mission) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                mission_id,
                error: 'Mission not found',
              },
              null,
              2
            ),
          },
        ],
      };
    }

    // Get evidence pack from controller
    const pack = this.evidenceController.getPack(mission_id);

    if (!pack) {
      // Return summary if no pack exists
      const summary = this.evidenceController.generateSummary(mission_id);
      if (summary) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(summary, null, 2),
            },
          ],
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                mission_id,
                note: 'No evidence pack found for this mission. Evidence packs are created during the RESEARCHING phase.',
              },
              null,
              2
            ),
          },
        ],
      };
    }

    // Get scored evidence for additional context
    const scoredEvidence = this.evidenceController.scorePack(mission_id);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              mission_id: pack.missionId,
              subject: pack.subject,
              ticker: pack.ticker,
              created_at: pack.createdAt,
              sources: {
                total: pack.sources.length,
                by_tier: pack.metadata.itemsByTier,
                average_relevance: pack.metadata.averageRelevance,
              },
              items: {
                total: pack.items.length,
                top_claims: scoredEvidence
                  ?.slice(0, 10)
                  .map(item => ({
                    claim: item.claim,
                    score: item.score,
                    tier: item.breakdown.tier,
                  })) || [],
              },
              sources_list: pack.sources.map(s => ({
                id: s.id,
                type: s.type,
                title: s.title,
                tier: s.tier,
                url: s.url,
              })),
            },
            null,
            2
          ),
        },
      ],
    };
  }

  /**
   * Get debate summary for a mission
   */
  private async getDebateSummary(args: any): Promise<{
    content: Array<{ type: string; text: string }>;
  }> {
    const { mission_id } = args;

    // Check if mission exists
    const mission = this.missions.get(mission_id);
    if (!mission) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                mission_id,
                error: 'Mission not found',
              },
              null,
              2
            ),
          },
        ],
      };
    }

    // Get all debate sessions for this mission
    const debates = this.debateController.getMissionDebates(mission_id);

    if (debates.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                mission_id,
                note: 'No debate sessions found for this mission. Debates occur during the DEBATING phase.',
              },
              null,
              2
            ),
          },
        ],
      };
    }

    // Get the most recent active debate
    const latestDebate = debates[debates.length - 1];
    const debateStats = this.debateController.getDebateStats(latestDebate.id);

    // Format the debate summary
    const summary = {
      mission_id,
      debate_id: latestDebate.id,
      current_phase: latestDebate.current_phase,
      current_round: latestDebate.current_round,
      started_at: latestDebate.started_at,
      completed: !!latestDebate.completed_at,
      converged: latestDebate.converged,

      // Positions
      positions: Array.from(latestDebate.positions.values()).map(p => ({
        analyst_id: p.analyst_id,
        stance: p.stance,
        conviction: p.conviction,
        conviction_score: p.conviction_score,
        thesis_summary: p.thesis_summary,
        key_arguments: p.key_arguments,
      })),

      // Statistics
      statistics: debateStats ? {
        total_contributions: debateStats.total_contributions,
        contributions_by_phase: debateStats.contributions_by_phase,
        contributions_by_analyst: debateStats.contributions_by_analyst,
        average_conviction: debateStats.average_conviction,
        conviction_range: debateStats.conviction_range,
        moderation_actions: debateStats.moderation_actions,
      } : null,

      // Recent contributions (last 5)
      recent_contributions: latestDebate.contributions.slice(-5).map(c => ({
        analyst_id: c.analyst_id,
        phase: c.phase,
        content: c.content.substring(0, 200) + (c.content.length > 200 ? '...' : ''),
        conviction_score: c.conviction_score,
        timestamp: c.timestamp,
      })),

      // Moderation
      moderation_actions: latestDebate.moderation_actions.length,
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(summary, null, 2),
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
        // Generate actual report from mission data
        const mission = this.missions.get(id);
        if (!mission) {
          throw new Error(`Mission not found: ${id}`);
        }

        // Get additional context
        const evidence = this.evidenceController.getPack(id);
        const debates = this.debateController.getMissionDebates(id);

        let report = `# Investment Analysis Report\n\n`;
        report += `## Mission Information\n`;
        report += `- **Mission ID**: ${mission.id}\n`;
        report += `- **State**: ${mission.state.current_state}\n`;
        report += `- **Created**: ${mission.created_at.toISOString()}\n`;
        report += `- **Type**: ${mission.state.brief?.type || 'N/A'}\n`;
        report += `- **Domain**: ${mission.state.brief?.domain || 'N/A'}\n`;
        report += `- **Description**: ${mission.state.brief?.description || 'N/A'}\n`;

        if (mission.state.brief?.ticker) {
          report += `- **Ticker**: ${mission.state.brief.ticker}\n`;
        }

        // Evidence section
        if (evidence) {
          report += `\n## Evidence Summary\n`;
          report += `- **Total Sources**: ${evidence.sources.length}\n`;
          report += `- **Total Items**: ${evidence.items.length}\n`;
          report += `- **Average Relevance**: ${evidence.metadata.averageRelevance.toFixed(2)}\n`;

          const tierBreakdown = Object.entries(evidence.metadata.itemsByTier)
            .map(([tier, count]) => `Tier ${tier}: ${count}`)
            .join(', ');
          report += `- **Sources by Tier**: ${tierBreakdown}\n`;
        }

        // Debate section
        if (debates.length > 0) {
          const latestDebate = debates[debates.length - 1];
          report += `\n## Debate Summary\n`;
          report += `- **Debate ID**: ${latestDebate.id}\n`;
          report += `- **Phase**: ${latestDebate.current_phase}\n`;
          report += `- **Round**: ${latestDebate.current_round}\n`;
          report += `- **Contributions**: ${latestDebate.contributions.length}\n`;
          report += `- **Converged**: ${latestDebate.converged ? 'Yes' : 'No'}\n`;

          if (latestDebate.positions.size > 0) {
            report += `\n### Analyst Positions\n`;
            for (const [analystId, position] of latestDebate.positions) {
              report += `- **${analystId}**: ${position.stance} (conviction: ${position.conviction_score})\n`;
            }
          }
        }

        report += `\n## Status\n`;
        if (mission.state.current_state === 'DECIDED' || mission.state.current_state === 'JOURNALED') {
          report += `✓ This mission has completed analysis.\n`;
        } else if (mission.state.current_state === 'FAILED') {
          report += `✗ This mission failed during execution.\n`;
        } else {
          report += `○ This mission is currently in progress.\n`;
        }

        return {
          contents: [
            {
              uri,
              mimeType: 'text/markdown',
              text: report,
            },
          ],
        };
      }

      case 'journal': {
        // Retrieve journal entry from storage
        // Journal storage path: ~/.one4all/journal/
        const homedir = require('os').homedir();
        const journalPath = join(homedir, '.one4all', 'journal');

        try {
          // Check if journal directory exists
          if (!existsSync(journalPath)) {
            return {
              contents: [
                {
                  uri,
                  mimeType: 'text/markdown',
                  text: `# Journal Entry for ${id}\n\nNo journal entries found. Journal directory does not exist yet.`,
                },
              ],
            };
          }

          // Look for journal entry files
          const files = await readdir(journalPath);
          const journalFiles = files.filter(f => f.endsWith('.json') || f.endsWith('.yaml') || f.endsWith('.md'));

          if (journalFiles.length === 0) {
            return {
              contents: [
                {
                  uri,
                  mimeType: 'text/markdown',
                  text: `# Journal Entry for ${id}\n\nNo journal entries found in ${journalPath}`,
                },
              ],
            };
          }

          // Try to find a journal entry for this specific mission/ticker
          let journalText = `# Journal Entries\n\n`;

          for (const file of journalFiles) {
            const filePath = join(journalPath, file);
            try {
              const content = await readFile(filePath, 'utf-8');
              let entry: any;

              if (file.endsWith('.json')) {
                entry = JSON.parse(content);
              } else if (file.endsWith('.yaml')) {
                entry = yaml.load(content);
              } else {
                // Markdown file
                journalText += `## ${file}\n\n${content}\n\n`;
                continue;
              }

              // If this entry matches the mission/ticker, include it
              if (id && (entry.mission_id === id || entry.ticker === id || file.includes(id))) {
                journalText += `## Entry: ${entry.ticker || entry.mission_id || 'Unknown'}\n`;
                journalText += `- **Decision**: ${entry.decision || 'N/A'}\n`;
                journalText += `- **Fair Value**: ${entry.fair_value || 'N/A'}\n`;
                journalText += `- **Thesis**: ${entry.thesis || 'N/A'}\n`;
                if (entry.thesis_breakers) {
                  journalText += `- **Thesis Breakers**: ${entry.thesis_breakers.join(', ') || 'None'}\n`;
                }
                journalText += `- **Created**: ${entry.created_at || new Date().toISOString()}\n\n`;
              }
            } catch {
              // Skip invalid files
            }
          }

          if (journalText === `# Journal Entries\n\n`) {
            journalText += `No specific journal entry found for "${id}".\n\n`;
            journalText += `Available entries: ${journalFiles.join(', ')}`;
          }

          return {
            contents: [
              {
                uri,
                mimeType: 'text/markdown',
                text: journalText,
              },
            ],
          };
        } catch (error) {
          return {
            contents: [
              {
                uri,
                mimeType: 'text/markdown',
                text: `# Journal Entry for ${id}\n\nError reading journal: ${error}`,
              },
            ],
          };
        }
      }

      case 'constitution': {
        // Load domain constitution from YAML files
        const domainId = id;

        // Possible constitution paths
        const possiblePaths = [
          join(process.cwd(), 'domains', domainId, 'constitution', 'constitution.yaml'),
          join(process.cwd(), 'domains', domainId, 'constitution.yaml'),
          join(process.cwd(), 'domains', domainId, 'constitution', 'rules.yaml'),
        ];

        let constitutionPath: string | null = null;
        for (const path of possiblePaths) {
          if (existsSync(path)) {
            constitutionPath = path;
            break;
          }
        }

        if (!constitutionPath) {
          return {
            contents: [
              {
                uri,
                mimeType: 'text/yaml',
                text: `# Constitution for ${domainId}\n\nConstitution file not found.\n\nSearched paths:\n${possiblePaths.map(p => `- ${p}`).join('\n')}`,
              },
            ],
          };
        }

        try {
          const content = await readFile(constitutionPath, 'utf-8');
          return {
            contents: [
              {
                uri,
                mimeType: 'text/yaml',
                text: content,
              },
            ],
          };
        } catch (error) {
          return {
            contents: [
              {
                uri,
                mimeType: 'text/yaml',
                text: `# Constitution for ${domainId}\n\nError reading constitution: ${error}`,
              },
            ],
          };
        }
      }

      case 'agents': {
        // List agents by domain
        const domainId = id;

        // Possible agent paths
        const possiblePaths = [
          join(process.cwd(), 'domains', domainId, 'agents'),
          join(process.cwd(), 'domains', domainId),
        ];

        let agentsDir: string | null = null;
        for (const path of possiblePaths) {
          if (existsSync(path)) {
            agentsDir = path;
            break;
          }
        }

        if (!agentsDir) {
          return {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify({
                  domain: domainId,
                  error: 'Domain not found',
                  searched_paths: possiblePaths,
                }, null, 2),
              },
            ],
          };
        }

        try {
          const files = await readdir(agentsDir);
          const agentFiles = files.filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));

          if (agentFiles.length === 0) {
            return {
              contents: [
                {
                  uri,
                  mimeType: 'application/json',
                  text: JSON.stringify({
                    domain: domainId,
                    agents: [],
                    note: 'No agent YAML files found in this domain',
                  }, null, 2),
                },
              ],
            };
          }

          const agents: any[] = [];
          for (const file of agentFiles) {
            try {
              const filePath = join(agentsDir, file);
              const content = await readFile(filePath, 'utf-8');
              const agentData = yaml.load(content) as any;

              agents.push({
                id: agentData.id,
                name: agentData.name,
                role: agentData.role,
                description: agentData.description,
                domain: agentData.domain,
                model: agentData.model,
                active: agentData.active ?? true,
              });
            } catch {
              // Skip invalid files
            }
          }

          return {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify({
                  domain: domainId,
                  count: agents.length,
                  agents,
                }, null, 2),
              },
            ],
          };
        } catch (error) {
          return {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify({
                  domain: domainId,
                  error: `Error reading agents: ${error}`,
                }, null, 2),
              },
            ],
          };
        }
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
