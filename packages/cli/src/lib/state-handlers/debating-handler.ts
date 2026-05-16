/**
 * DEBATING State Handler
 *
 * Orchestrates structured debate between disagreeing analysts
 * Feature-flagged via FEATURE_FLAG_DEBATE_MODE environment variable
 */

import { Mission, MissionState } from '@one4all/kernel';
// import { DebateOrchestrator } from '@one4all/kernel/personas/debate'; // TODO: Implement Debate Orchestrator (Phase A2)

/**
 * Handle DEBATING state
 * Runs debate rounds if feature flag is enabled, otherwise simple mode
 */
export async function handleDebatingState(
  mission: Mission
): Promise<MissionState> {
  const ticker = mission.state.brief?.ticker || 'UNKNOWN';
  const debateEnabled = process.env.FEATURE_FLAG_DEBATE_MODE === 'true';

  if (debateEnabled) {
    console.log(`  [DEBATING] Running debate phase for ${ticker} (feature flag enabled)`);
    // TODO: Implement debate orchestrator (Phase A2)
    // const orchestrator = new DebateOrchestrator();
    // const debateRecord = await orchestrator.runDebate(mission);
  } else {
    console.log(`  [DEBATING] Simple mode for ${ticker} (set FEATURE_FLAG_DEBATE_MODE=true to enable)`);
  }

  // For now, skip directly to synthesizing
  return MissionState.SYNTHESIZING;
}
