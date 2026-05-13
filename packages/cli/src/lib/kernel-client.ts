/**
 * Kernel API Client
 *
 * Provides a simplified interface to the one4all kernel
 * Now with CLI adapter support and file-based persistence
 */

import type {
  AgentConfig,
  DomainConfig,
  ConstitutionConfig,
  Mission,
  Brief,
  TransitionResult,
  Decision,
} from '@one4all/kernel';
import { MissionState } from '@one4all/kernel';
import { getHealthMonitor } from '@one4all/observability';
import { createCLIAdapter, type CLIAdapterType } from '@one4all/adapters';
import { getMissionStorage, type StoredMission } from './mission-storage.js';
import { createMissionExecutor, type ExecutionResult } from './mission-executor.js';

// === Mission Service ===

export interface MissionCreateOptions {
  domain: string;
  type: string;
  ticker?: string;
  description: string;
  assumptions?: Record<string, unknown>;
  constraints?: Record<string, unknown>;
  cliAdapter?: CLIAdapterType; // Which CLI adapter to use for this mission
}

export interface MissionListOptions {
  domain?: string;
  state?: MissionState;
  limit?: number;
}

export interface MissionStatus {
  mission_id: string;
  state: MissionState;
  created_at: Date;
  updated_at: Date;
  domain: string;
  mission_type: string;
  ticker?: string;
  current_state_duration: number;
}

// === Agent Service ===

export interface AgentAskOptions {
  agent: string;
  prompt: string;
  context?: Record<string, unknown>;
  timeout?: number;
  cliAdapter?: CLIAdapterType; // Override default CLI adapter
}

export interface AgentTestOptions {
  agent: string;
  fixture: string;
}

// === Journal Service ===

export interface JournalEntry {
  id: string;
  ticker: string;
  decision: string;
  fair_value: number;
  thesis: string;
  thesis_breakers: string[];
  created_at: Date;
  outcome?: string;
  outcome_updated_at?: Date;
}

export interface JournalUpdateOptions {
  id: string;
  outcome: string;
}

// === Constitution Service ===

export interface ConstitutionValidationResult {
  valid: boolean;
  errors: Array<{
    rule_id: string;
    message: string;
  }>;
  warnings: Array<{
    rule_id: string;
    message: string;
  }>;
}

// === Health Service ===

export interface HealthStatus {
  name: string;
  status: 'online' | 'offline' | 'degraded';
  latency?: number;
  details?: string;
}

/**
 * Kernel Client class
 * Now with real CLI adapter support and file-based persistence
 */
export class KernelClient {
  private journalData: Map<string, JournalEntry> = new Map();
  private defaultCLIAdapter: CLIAdapterType = 'gemini-cli'; // Default CLI adapter
  private storage = getMissionStorage();
  private executor?: ReturnType<typeof createMissionExecutor>;

  constructor(defaultCLIAdapter?: CLIAdapterType) {
    if (defaultCLIAdapter) {
      this.defaultCLIAdapter = defaultCLIAdapter;
    }
    // Lazy-create executor when needed
  }

  private getExecutor() {
    if (!this.executor) {
      this.executor = createMissionExecutor({
        cliAdapter: this.defaultCLIAdapter,
      });
    }
    return this.executor;
  }

  /**
   * Create a new mission with persistence
   */
  async createMission(options: MissionCreateOptions): Promise<MissionStatus> {
    const mission_id = `${options.ticker || 'mission'}-${Date.now()}`;
    const created_at = new Date();

    // Create mission object
    const mission: StoredMission = {
      mission_id,
      state: 'DRAFT',
      created_at: created_at.toISOString(),
      updated_at: created_at.toISOString(),
      domain: options.domain,
      mission_type: options.type,
      ticker: options.ticker,
      brief: {
        type: options.type,
        domain: options.domain,
        ticker: options.ticker,
        description: options.description,
        owner_assumptions: options.assumptions,
        constraints: options.constraints,
      },
    };

    // Save to file storage
    await this.storage.save(mission);

    return {
      mission_id,
      state: MissionState.DRAFT,
      created_at,
      updated_at: created_at,
      domain: options.domain,
      mission_type: options.type,
      ticker: options.ticker,
      current_state_duration: 0,
    };
  }

  /**
   * Start a mission - now executes the full pipeline
   */
  async startMission(missionId: string): Promise<TransitionResult> {
    const executor = this.getExecutor();
    const result = await executor.execute(missionId);

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Mission execution failed',
      };
    }

    // If mission reached a terminal or waiting state, return success
    return {
      success: true,
      new_state: result.finalState || MissionState.PLANNING,
      requires_human_input: result.finalState === MissionState.HUMAN_REVIEW_GATE_1 ||
                            result.finalState === MissionState.HUMAN_REVIEW_GATE_2 ||
                            result.finalState === MissionState.HUMAN_REVIEW_GATE_3,
    };
  }

  /**
   * Get mission status
   */
  async getMissionStatus(missionId: string): Promise<MissionStatus | null> {
    const mission = await this.storage.load(missionId);
    if (!mission) {
      return null;
    }

    const created_at = new Date(mission.created_at);
    const updated_at = new Date(mission.updated_at);
    const state_entered_at = updated_at; // Simplified - using updated_at

    return {
      mission_id: mission.mission_id,
      state: mission.state as MissionState,
      created_at,
      updated_at,
      domain: mission.domain,
      mission_type: mission.mission_type,
      ticker: mission.ticker,
      current_state_duration: Date.now() - state_entered_at.getTime(),
    };
  }

  /**
   * Abort a mission
   */
  async abortMission(missionId: string): Promise<TransitionResult> {
    const mission = await this.storage.load(missionId);
    if (!mission) {
      return { success: false, error: 'Mission not found' };
    }

    mission.state = 'FAILED';
    mission.updated_at = new Date().toISOString();
    await this.storage.save(mission);

    return {
      success: true,
      new_state: MissionState.FAILED,
    };
  }

  /**
   * List missions
   */
  async listMissions(options: MissionListOptions = {}): Promise<MissionStatus[]> {
    let missions = await this.storage.list();

    if (options.domain) {
      missions = missions.filter((m) => m.domain === options.domain);
    }

    if (options.state) {
      missions = missions.filter((m) => m.state === options.state);
    }

    if (options.limit) {
      missions = missions.slice(0, options.limit);
    }

    return missions.map((m) => {
      const created_at = new Date(m.created_at);
      const updated_at = new Date(m.updated_at);
      return {
        mission_id: m.mission_id,
        state: m.state as MissionState,
        created_at,
        updated_at,
        domain: m.domain,
        mission_type: m.mission_type,
        ticker: m.ticker,
        current_state_duration: Date.now() - updated_at.getTime(),
      };
    });
  }

  /**
   * Ask an agent - NOW WITH REAL CLI ADAPTER SUPPORT
   */
  async askAgent(options: AgentAskOptions): Promise<string> {
    const cliType = options.cliAdapter || this.defaultCLIAdapter;
    const adapter = createCLIAdapter(cliType);

    try {
      const result = await adapter.run(options.prompt, {});

      if (result.success) {
        return result.content;
      } else {
        return `[Error from ${this.getCLIName(cliType)}: ${result.error || 'Unknown error'}]\nOriginal prompt: ${options.prompt}`;
      }
    } catch (error) {
      return `[${this.getCLIName(cliType)} execution error: ${error instanceof Error ? error.message : String(error)}]\nPrompt: ${options.prompt}`;
    }
  }

  /**
   * Get friendly CLI name
   */
  private getCLIName(type: CLIAdapterType): string {
    const names: Record<CLIAdapterType, string> = {
      'gemini-cli': 'Gemini CLI',
      'codex-cli': 'Codex CLI',
      'claude-cli': 'Claude CLI',
    };
    return names[type] || type;
  }

  /**
   * Test an agent with specific CLI adapter
   */
  async testAgent(options: AgentTestOptions, cliAdapter?: CLIAdapterType): Promise<{
    success: boolean;
    output: string;
    error?: string;
  }> {
    const cliType = cliAdapter || this.defaultCLIAdapter;
    const adapter = createCLIAdapter(cliType);

    try {
      const health = await adapter.healthCheck();

      if (health.healthy) {
        return {
          success: true,
          output: `Agent ${options.agent} test passed using ${this.getCLIName(cliType)}. Health check OK (${health.latencyMs}ms latency)`,
        };
      } else {
        return {
          success: false,
          output: '',
          error: `Health check failed for ${this.getCLIName(cliType)}: ${health.metadata?.error || 'Unknown error'}`,
        };
      }
    } catch (error) {
      return {
        success: false,
        output: '',
        error: `Test error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Set default CLI adapter
   */
  setDefaultCLIAdapter(adapter: CLIAdapterType): void {
    this.defaultCLIAdapter = adapter;
  }

  /**
   * Get current CLI adapter
   */
  getDefaultCLIAdapter(): CLIAdapterType {
    return this.defaultCLIAdapter;
  }

  /**
   * List agents
   */
  async listAgents(domain?: string): Promise<AgentConfig[]> {
    // Mock agents list with CLI adapter info
    const mockAgents: AgentConfig[] = [
      {
        id: 'damodaran-valuation',
        name: 'Damodaran Valuation',
        version: '1.0.0',
        domain: 'investment-war-room',
        active: true,
        role: 'analyst',
        description: 'DCF valuation specialist',
        model: {
          primary: { provider: this.defaultCLIAdapter, model: 'cli-based' },
          fallback: [],
        },
        identity: {
          persona_file: '/personas/damodaran.yaml',
          worldview: ['value_investing', 'fundamental_analysis'],
          cognitive_bias_awareness: ['anchoring', 'confirmation_bias'],
        },
        skills: ['dcf', 'reverse_dcf', 'mos_analysis'],
        requires: ['financial_statements', 'growth_rate', 'discount_rate'],
        interaction_rules: {},
        output_contract: {
          mandatory_fields: ['fair_value', 'margin_of_safety'],
          forbidden_content: [],
        },
        performance: {
          timeout_seconds: 300,
          max_tokens: 8000,
        },
      },
    ];

    if (domain) {
      return mockAgents.filter((a) => a.domain === domain);
    }
    return mockAgents;
  }

  /**
   * Get journal entry
   */
  async getJournalEntry(ticker: string): Promise<JournalEntry | null> {
    return this.journalData.get(ticker) || null;
  }

  /**
   * Update journal entry outcome
   */
  async updateJournalOutcome(options: JournalUpdateOptions): Promise<boolean> {
    const entry = Array.from(this.journalData.values()).find((e) => e.id === options.id);
    if (entry) {
      entry.outcome = options.outcome;
      entry.outcome_updated_at = new Date();
      return true;
    }
    return false;
  }

  /**
   * List journal entries
   */
  async listJournalEntries(filters: {
    state?: string;
    domain?: string;
  }): Promise<JournalEntry[]> {
    return Array.from(this.journalData.values());
  }

  /**
   * Get constitution
   */
  async getConstitution(domain: string): Promise<ConstitutionConfig | null> {
    // Mock constitution
    return {
      domain,
      version: '1.0.0',
      rules: [
        {
          id: 'no-sources-claims',
          description: 'No claims without tier 1 or tier 2 sources',
          enforcement: 'BLOCK_MISSION',
          applies_to: ['analyst', 'researcher'],
        },
      ],
    };
  }

  /**
   * Validate constitution
   */
  async validateConstitution(domain: string): Promise<ConstitutionValidationResult> {
    return {
      valid: true,
      errors: [],
      warnings: [],
    };
  }

  /**
   * List domains
   */
  async listDomains(): Promise<DomainConfig[]> {
    return [
      {
        id: 'investment-war-room',
        name: 'Investment War Room',
        version: '1.0.0',
        description: 'Investment decision analysis',
        constitution: { rules_file: '/constitutions/investment.yaml' },
        default_team: {},
        mission_types: [],
        markets: ['US', 'TH'],
        output: {
          mandatory_report_sections: ['thesis', 'valuation', 'risk'],
          mandatory_fields: [],
          forbidden_content: [],
        },
        human_checkpoints: {
          after_research: 'conditional',
          after_synthesis: 'always',
          on_low_evidence: 'always',
        },
        journal: { required: true },
        evidence: {
          minimum_sources: [],
          required_documents: [],
        },
        context_budget: {
          default_limit: 200000,
          compression_threshold: 150000,
        },
      },
    ];
  }

  /**
   * Get health status - includes CLI adapter health
   */
  async getHealthStatus(): Promise<HealthStatus[]> {
    const monitor = getHealthMonitor();
    const healthStates = monitor.getFormattedHealthStatus();

    const baseStatus = healthStates.map((state) => ({
      name: state.name,
      status: state.status,
      latency: state.latency,
      details: state.details,
    }));

    // Add CLI adapter health
    const cliHealth: HealthStatus[] = [];
    for (const cliType of ['gemini-cli', 'codex-cli', 'claude-cli'] as CLIAdapterType[]) {
      try {
        const adapter = createCLIAdapter(cliType);
        const health = await adapter.healthCheck();
        cliHealth.push({
          name: this.getCLIName(cliType),
          status: health.healthy ? 'online' : 'offline',
          latency: health.latencyMs,
          details: health.metadata?.adapter as string,
        });
      } catch {
        cliHealth.push({
          name: this.getCLIName(cliType),
          status: 'offline',
          details: 'Failed to initialize',
        });
      }
    }

    return [...baseStatus, ...cliHealth];
  }

  /**
   * List teams
   */
  async listTeams(): Promise<Array<{ id: string; name: string; domain: string }>> {
    return [
      {
        id: 'investment-war-room',
        name: 'Investment War Room',
        domain: 'investment-war-room',
      },
    ];
  }
}

// Singleton instance
let clientInstance: KernelClient | null = null;

export function getKernelClient(defaultCLIAdapter?: CLIAdapterType): KernelClient {
  if (!clientInstance) {
    clientInstance = new KernelClient(defaultCLIAdapter);
  }
  return clientInstance;
}

export function resetKernelClient(): void {
  clientInstance = null;
}
