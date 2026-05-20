/**
 * DEBATING State Handler
 *
 * Orchestrates structured debate between disagreeing analysts
 * Runs debate rounds through DebateExecutor and stores results
 */

import { Mission, MissionState } from '@one4all/kernel';
import {
  DebateController,
  createDebateController,
  DebateExecutor,
  createDebateExecutor,
  type LLMAdapter,
} from '@one4all/kernel';
import { createUnifiedAdapter } from '../adapter-factory.js';
import { getAdapterForAgent } from '../agent-adapter-mapping.js';
import { getPersonaResolver, getDomainFromBrief } from '../registry-connector.js';
import type { Adapter } from '@one4all/adapters';

/**
 * LLM Adapter wrapper for DebateExecutor
 * Wraps the project's Adapter interface to match DebateExecutor's LLMAdapter interface
 */
class CLIAdapterWrapper {
  constructor(private readonly adapter: Adapter) {}

  async chat(params: {
    prompt: string;
    maxTokens?: number;
    temperature?: number;
    timeout?: number;
  }): Promise<string> {
    const result = await this.adapter.run(params.prompt, {
      timeout: params.timeout || 300000,
    });

    if (!result.success) {
      throw new Error(result.error || 'LLM call failed');
    }

    return result.content;
  }
}

/**
 * Get analyst IDs for debate from mission context
 * Priority: routing_plan.selected_analysts > required_agents > fallback
 */
function getDebateAnalysts(mission: Mission): string[] {
  const brief = mission.state.brief;
  const ownerAssumptions = brief?.owner_assumptions as any;
  const routingPlan = ownerAssumptions?.routing_plan;

  if (routingPlan?.selected_analysts && Array.isArray(routingPlan.selected_analysts)) {
    return routingPlan.selected_analysts;
  }

  const config = mission.state.config;
  const requiredAgents = config?.required_agents || [];

  if (requiredAgents.length > 0) {
    return requiredAgents;
  }

  return ['devil-advocate'];
}

/**
 * Get debate topic from mission brief
 */
function getDebateTopic(mission: Mission): string {
  const brief = mission.state.brief;
  return brief?.question || brief?.description || brief?.ticker || 'Investment Analysis';
}

/**
 * Create initial positions for debate participants
 */
function createInitialPositions(analystIds: string[]): Array<{
  analyst_id: string;
  stance: 'bullish' | 'bearish' | 'neutral';
  thesis_summary: string;
  conviction_score?: number;
}> {
  return analystIds.map((analystId, index) => {
    // Alternate between bullish and bearish for diversity
    const stance = index % 2 === 0 ? 'bullish' : 'bearish';
    return {
      analyst_id: analystId,
      stance,
      thesis_summary: `${analystId} initial position`,
      conviction_score: 50,
    };
  });
}

/**
 * Handle DEBATING state
 * Runs debate rounds and transitions to SYNTHESIZING
 */
export async function handleDebatingState(
  mission: Mission
): Promise<MissionState> {
  const ticker = mission.state.brief?.ticker || 'UNKNOWN';
  const topic = getDebateTopic(mission);
  const domain = getDomainFromBrief(mission.state.brief);
  const analystIds = getDebateAnalysts(mission);

  console.log(`  [DEBATING] Starting debate for ${ticker} with ${analystIds.length} analysts`);
  console.log(`  [DEBATING] Topic: ${topic}`);
  console.log(`  [DEBATING] Analysts: ${analystIds.join(', ')}`);

  try {
    // Create debate controller
    const controller: DebateController = createDebateController({
      enabled: true,
    });

    // Get persona resolver
    const personaResolver = getPersonaResolver();

    // Create debate session
    const session = controller.createDebate({
      mission_id: mission.id,
      domain,
      participating_analysts: analystIds,
      max_rounds: 3,
      max_contributions_per_round: 5,
      convergence_threshold: 30,
      timeout_ms: 300000,
      constitution_strict: false,
    });

    // Initialize analyst positions
    const initialPositions = createInitialPositions(analystIds);
    controller.initializePositions(session.id, initialPositions);

    // Create LLM adapter wrapper
    // Use the first analyst's adapter type as the default
    const adapterType = getAdapterForAgent(analystIds[0] || 'devil-advocate');
    const adapter = createUnifiedAdapter(adapterType);
    const llmAdapter = new CLIAdapterWrapper(adapter);

    // Create debate executor
    const executor = createDebateExecutor(llmAdapter, personaResolver, controller);

    // Run the debate
    console.log(`  [DEBATING] Running debate rounds...`);
    const result = await executor.runDebate(session, analystIds, domain);

    console.log(`  [DEBATING] Debate completed:`);
    console.log(`  [DEBATING]   - Rounds: ${result.totalRounds}`);
    console.log(`  [DEBATING]   - Contributions: ${result.totalContributions}`);
    console.log(`  [DEBATING]   - Converged: ${result.converged}`);
    console.log(`  [DEBATING]   - Final Phase: ${result.finalPhase}`);

    if (result.errors.length > 0) {
      console.log(`  [DEBATING]   - Errors: ${result.errors.length}`);
      for (const error of result.errors) {
        console.log(`  [DEBATING]     [Round ${error.round}] ${error.analystId}: ${error.error}`);
      }
    }

    // Get debate result and store in mission state
    const debateResult = controller.completeDebate(session.id);
    mission.state.debate_records = debateResult;

    console.log(`  [DEBATING] Debate results stored in mission state`);

  } catch (error) {
    console.error(`  [DEBATING] Debate failed: ${error instanceof Error ? error.message : String(error)}`);
    // Continue to synthesizing even if debate fails
    console.log(`  [DEBATING] Continuing to synthesizing state`);
  }

  return MissionState.SYNTHESIZING;
}
