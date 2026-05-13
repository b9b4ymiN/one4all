/**
 * JOURNALED State Handler
 *
 * Writes final decision to journal
 */

import { Mission } from '@one4all/kernel';
import type { Decision } from '@one4all/kernel';
import { join } from 'path';
import { homedir } from 'os';
import { promises as fs } from 'fs';

/**
 * Handle JOURNALED state
 * Writes journal entry to filesystem
 */
export async function handleJournaledState(mission: Mission): Promise<void> {
  const decision = mission.state.decision;
  const brief = mission.state.brief;
  const ticker = brief?.ticker || 'UNKNOWN';

  if (!decision) {
    console.log('  [JOURNALED] No decision to journal');
    return;
  }

  console.log(`  [JOURNALED] Writing decision for ${ticker} to journal...`);

  // Create journal entry
  const entry = {
    id: mission.id,
    ticker,
    decision_state: decision.decision_state,
    fair_value_conservative: decision.fair_value_conservative,
    price_to_watch: decision.price_to_watch,
    thesis_breakers: decision.thesis_breakers,
    follow_up_events: decision.follow_up_events.map(e => ({
      event: e.event,
      date: e.expected_date instanceof Date ? e.expected_date.toISOString().split('T')[0] : '2026-06-01',
    })),
    created_at: new Date().toISOString(),
  };

  // Write to journal directory
  const journalDir = join(homedir(), '.one4all', 'journal');
  await fs.mkdir(journalDir, { recursive: true });

  const journalPath = join(journalDir, `${ticker}.jsonl`);
  const entryLine = JSON.stringify(entry) + '\n';

  await fs.appendFile(journalPath, entryLine);

  console.log(`  [JOURNALED] Journal entry written to ${journalPath}`);
  console.log(`  [JOURNALED] Decision: ${decision.decision_state} | Fair Value: ${decision.fair_value_conservative}`);
}
