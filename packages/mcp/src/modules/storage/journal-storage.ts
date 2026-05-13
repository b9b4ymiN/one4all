/**
 * MCP Journal Storage
 *
 * Journal storage for MCP server.
 * Stores journal entries in ~/.one4all/journal/
 */

import { mkdir, readFile, writeFile, readdir, unlink } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { homedir } from 'os';

const JOURNAL_DIR = join(homedir(), '.one4all', 'journal');

export interface JournalEntry {
  ticker: string;
  thesis?: string;
  fair_value?: {
    amount: number;
    currency: string;
    methodology: string;
    date: string;
  };
  thesis_breakers?: Array<{
    condition: string;
    triggered: boolean;
    date_detected?: string;
  }>;
  outcome?: {
    decision: 'LONG' | 'SHORT' | 'PASS';
    rationale: string;
    entry_price?: number;
    position_size?: number;
    date_closed?: string;
    return_pct?: number;
  };
  created_at: string;
  updated_at: string;
  notes?: string[];
}

export interface JournalIndex {
  entries: Array<{
    ticker: string;
    updated_at: string;
    has_outcome: boolean;
  }>;
  last_updated: string;
}

/**
 * Ensure the journal directory exists
 */
export async function ensureJournalDir(): Promise<void> {
  if (!existsSync(JOURNAL_DIR)) {
    await mkdir(JOURNAL_DIR, { recursive: true });
  }
}

/**
 * Get journal file path for a ticker
 */
function getJournalPath(ticker: string): string {
  return join(JOURNAL_DIR, `${ticker.toUpperCase()}.json`);
}

/**
 * Read a journal entry
 */
export async function readJournalEntry(ticker: string): Promise<JournalEntry | null> {
  await ensureJournalDir();

  const journalPath = getJournalPath(ticker);

  try {
    const content = await readFile(journalPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Write a journal entry
 */
export async function writeJournalEntry(entry: JournalEntry): Promise<void> {
  await ensureJournalDir();

  entry.updated_at = new Date().toISOString();

  if (!entry.created_at) {
    entry.created_at = entry.updated_at;
  }

  const journalPath = getJournalPath(entry.ticker);
  await writeFile(journalPath, JSON.stringify(entry, null, 2));
}

/**
 * Update journal outcome
 */
export async function updateJournalOutcome(
  ticker: string,
  outcome: JournalEntry['outcome']
): Promise<boolean> {
  const entry = await readJournalEntry(ticker);

  if (!entry) {
    return false;
  }

  entry.outcome = outcome;
  entry.updated_at = new Date().toISOString();

  await writeJournalEntry(entry);
  return true;
}

/**
 * List all journal entries
 */
export async function listJournalEntries(): Promise<JournalEntry[]> {
  await ensureJournalDir();

  try {
    const files = await readdir(JOURNAL_DIR);
    const entries: JournalEntry[] = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        const content = await readFile(join(JOURNAL_DIR, file), 'utf-8');
        try {
          entries.push(JSON.parse(content));
        } catch {
          // Skip invalid files
        }
      }
    }

    return entries.sort((a, b) =>
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );
  } catch {
    return [];
  }
}

/**
 * Delete a journal entry
 */
export async function deleteJournalEntry(ticker: string): Promise<boolean> {
  await ensureJournalDir();

  const journalPath = getJournalPath(ticker);

  if (!existsSync(journalPath)) {
    return false;
  }

  await unlink(journalPath);
  return true;
}

/**
 * Check if journal entry exists
 */
export async function journalEntryExists(ticker: string): Promise<boolean> {
  await ensureJournalDir();
  const journalPath = getJournalPath(ticker);
  return existsSync(journalPath);
}
