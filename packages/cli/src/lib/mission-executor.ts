/**
 * Mission Executor
 *
 * Orchestrates mission execution through the state machine.
 * Handles state transitions, persistence, and timeout management.
 */

import { MissionStateMachine } from '@one4all/kernel';
import { Mission, MissionState } from '@one4all/kernel';
import type { StateTransition } from '@one4all/kernel/src/state-machine/types';
import { getMissionStorage, type StoredMission } from './mission-storage.js';
import { createCLIAdapter, type CLIAdapterType } from '@one4all/adapters';
import { join } from 'path';

// State handler imports
import { handlePlanningState } from './state-handlers/planning-handler.js';
import { handleResearchingState } from './state-handlers/researching-handler.js';
import { handleAnalyzingState } from './state-handlers/analyzing-handler.js';
import { handleCrossQAState } from './state-handlers/cross-qa-handler.js';
import { handleDebatingState } from './state-handlers/debating-handler.js';
import { handleSynthesizingState } from './state-handlers/synthesizing-handler.js';
import { handleJournaledState } from './state-handlers/journaled-handler.js';

export interface ExecutorConfig {
  cliAdapter?: CLIAdapterType;
  onStateChange?: (mission: Mission, transition: StateTransition) => Promise<void>;
  onHumanGate?: (mission: Mission, gate: MissionState, message: string) => Promise<void>;
  onError?: (mission: Mission, error: Error) => Promise<void>;
}

export interface ExecutionResult {
  success: boolean;
  finalState?: MissionState;
  error?: string;
  mission?: Mission;
}

/**
 * Mission Executor - orchestrates full mission lifecycle
 */
export class MissionExecutor {
  private stateMachine: MissionStateMachine;
  private storage = getMissionStorage();
  private cliAdapter: CLIAdapterType;
  private domainConfigs: Map<string, any> = new Map();

  constructor(config: ExecutorConfig = {}) {
    this.cliAdapter = config.cliAdapter || 'gemini-cli';

    // Initialize state machine with callbacks
    this.stateMachine = new MissionStateMachine({
      enable_timeouts: true,
      persist_transitions: true,
      on_state_change: async (mission, transition) => {
        // Persist after each state change
        await this.persistMission(mission);
        if (config.onStateChange) {
          await config.onStateChange(mission, transition);
        }
      },
      on_human_gate: config.onHumanGate,
      on_error: config.onError,
    });
  }

  /**
   * Execute a mission from its current state to completion
   */
  async execute(missionId: string): Promise<ExecutionResult> {
    try {
      // Load mission from storage
      const stored = await this.storage.load(missionId);
      if (!stored) {
        return { success: false, error: `Mission not found: ${missionId}` };
      }

      // Convert to Mission object
      const mission = this.storedToMission(stored);

      // Execute state machine until terminal or human gate
      return await this.runStateMachine(mission);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Run state machine until completion
   */
  private async runStateMachine(mission: Mission): Promise<ExecutionResult> {
    let iterations = 0;
    const MAX_ITERATIONS = 50; // Prevent infinite loops

    // If in DRAFT, first transition to PLANNING
    if (mission.state.current_state === MissionState.DRAFT) {
      console.log(`  [DRAFT → PLANNING] Validating brief...`);
      const result = await this.stateMachine.transition(mission, MissionState.PLANNING);
      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Failed to transition from DRAFT',
          mission,
        };
      }
    }

    while (!this.stateMachine.isTerminal(mission) && iterations < MAX_ITERATIONS) {
      iterations++;

      const currentState = mission.state.current_state;

      // Check if waiting for human input
      if (this.stateMachine.isWaitingForHuman(mission)) {
        return {
          success: true,
          finalState: currentState,
          mission,
        };
      }

      // Execute state handler and determine next state
      const nextState = await this.executeStateHandler(mission, currentState);

      if (!nextState) {
        // State handler didn't return a next state - wait for external trigger
        return {
          success: true,
          finalState: currentState,
          mission,
        };
      }

      // Transition to next state
      const result = await this.stateMachine.transition(mission, nextState);

      if (!result.success) {
        return {
          success: false,
          error: result.error,
          mission,
        };
      }
    }

    if (iterations >= MAX_ITERATIONS) {
      return {
        success: false,
        error: 'Mission exceeded maximum state iterations',
        mission,
      };
    }

    return {
      success: true,
      finalState: mission.state.current_state,
      mission,
    };
  }

  /**
   * Execute state-specific handler logic
   */
  private async executeStateHandler(
    mission: Mission,
    state: MissionState
  ): Promise<MissionState | null> {
    const domainConfig = await this.loadDomainConfig(mission);

    switch (state) {
      case MissionState.PLANNING:
        return await handlePlanningState(mission, domainConfig);

      case MissionState.RESEARCHING:
        return await handleResearchingState(mission, this.cliAdapter);

      case MissionState.ANALYZING:
        return await handleAnalyzingState(mission, this.cliAdapter);

      case MissionState.SYNTHESIZING:
        return await handleSynthesizingState(mission, this.cliAdapter);

      case MissionState.DECIDED:
        return MissionState.JOURNALED;

      case MissionState.JOURNALED:
        await handleJournaledState(mission);
        return null; // Terminal state

      case MissionState.CROSS_QA:
        return await handleCrossQAState(mission);

      case MissionState.DEBATING:
        return await handleDebatingState(mission);

      case MissionState.HUMAN_REVIEW_GATE_1:
      case MissionState.HUMAN_REVIEW_GATE_2:
      case MissionState.HUMAN_REVIEW_GATE_3:
        // Wait for human input
        return null;

      default:
        return null;
    }
  }

  /**
   * Load domain configuration
   */
  private async loadDomainConfig(mission: Mission): Promise<any> {
    const domain = mission.state.brief?.domain;
    if (!domain) {
      throw new Error('Mission brief missing domain');
    }

    if (this.domainConfigs.has(domain)) {
      return this.domainConfigs.get(domain);
    }

    try {
      const domainsDir = join(process.cwd(), 'domains');
      const configPath = join(domainsDir, domain, 'domain.yaml');

      // For now, return a minimal config
      // In production, would parse the YAML file
      const config = {
        id: domain,
        name: domain,
        agents: [],
        evidence_requirements: {
          minimum_sources: [{ tier: 'tier_1', count: 2 }],
          required_documents: [],
        },
        human_checkpoints: {
          after_research: 'conditional',
          after_synthesis: 'always',
        },
      };

      this.domainConfigs.set(domain, config);
      return config;
    } catch (error) {
      // Return default config if file not found
      const defaultConfig = {
        id: domain,
        name: domain,
        agents: [],
        evidence_requirements: {
          minimum_sources: [{ tier: 'tier_1', count: 1 }],
          required_documents: [],
        },
      };
      this.domainConfigs.set(domain, defaultConfig);
      return defaultConfig;
    }
  }

  /**
   * Persist mission to storage
   */
  private async persistMission(mission: Mission): Promise<void> {
    const stored: StoredMission = {
      mission_id: mission.id,
      state: mission.state.current_state,
      created_at: mission.created_at.toISOString(),
      updated_at: mission.updated_at.toISOString(),
      domain: mission.state.brief?.domain || '',
      mission_type: mission.state.brief?.type || '',
      ticker: mission.state.brief?.ticker,
      brief: mission.state.brief,
      state_data: mission.state,
    };
    await this.storage.save(stored);
  }

  /**
   * Convert StoredMission to Mission object
   * Ensures all Date fields are properly converted from strings
   */
  private storedToMission(stored: StoredMission): Mission {
    // If state_data exists, ensure state_entered_at is a Date object
    let stateData = stored.state_data;
    if (stateData && typeof stateData.state_entered_at === 'string') {
      stateData = {
        ...stateData,
        state_entered_at: new Date(stateData.state_entered_at),
      };
    }

    return {
      id: stored.mission_id,
      state: stateData || {
        current_state: stored.state as MissionState,
        state_entered_at: new Date(stored.created_at),
        brief: stored.brief as any,
      },
      transitions: [],
      created_at: new Date(stored.created_at),
      updated_at: new Date(stored.updated_at),
    };
  }

  /**
   * Handle human gate action
   */
  async handleHumanGate(
    missionId: string,
    action: 'proceed' | 'add_data' | 'revise_assumptions' | 'request_reanalysis' | 'skip' | 'abort',
    data?: Record<string, unknown>
  ): Promise<ExecutionResult> {
    const stored = await this.storage.load(missionId);
    if (!stored) {
      return { success: false, error: `Mission not found: ${missionId}` };
    }

    const mission = this.storedToMission(stored);
    const result = await this.stateMachine.handleHumanGateAction(mission, action, data);

    if (!result.success) {
      return { success: false, error: result.error };
    }

    // Continue execution if not waiting for human
    if (!this.stateMachine.isWaitingForHuman(mission)) {
      return await this.runStateMachine(mission);
    }

    return {
      success: true,
      finalState: mission.state.current_state,
      mission,
    };
  }

  /**
   * Clean up resources
   */
  cleanup(missionId: string): void {
    const stored = this.storage.loadSync(missionId);
    if (stored) {
      const mission = this.storedToMission(stored);
      this.stateMachine.cleanup(mission);
    }
  }
}

/**
 * Create a mission executor
 */
export function createMissionExecutor(config?: ExecutorConfig): MissionExecutor {
  return new MissionExecutor(config);
}
