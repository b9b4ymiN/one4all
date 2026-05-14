/**
 * DEBATING State Handler
 *
 * Orchestrates structured debate between disagreeing analysts
 * Feature-flagged via FEATURE_FLAG_DEBATE_MODE environment variable
 */

import { Mission, MissionState } from '@one4all/kernel';
import { DebateOrchestrator } from '@one4all/kernel/personas/debate';

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
  } else {
    console.log(`  [DEBATING] Simple mode for ${ticker} (set FEATURE_FLAG_DEBATE_MODE=true to enable)`);
  }

  // Create debate orchestrator and run debate
  const orchestrator = new DebateOrchestrator();
  const debateRecord = await orchestrator.runDebate(mission);

  // Store debate record in mission state
  mission.state.debate_records = debateRecord;

  // Log results
  console.log(`  [DEBATING] ${debateRecord.summary}`);
  if (debateRecord.rounds.length > 0) {
    const lastRound = debateRecord.rounds[debateRecord.rounds.length - 1];
    if (lastRound.unresolved_flags.length > 0) {
      console.log(`  [DEBATING] Unresolved issues: ${lastRound.unresolved_flags.join(', ')}`);
    }
  }

  return MissionState.SYNTHESIZING;
}
