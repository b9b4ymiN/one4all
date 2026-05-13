/**
 * MCP Journal Handler
 *
 * Journal operations for MCP server
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import * as storage from './storage/journal-storage.js';

/**
 * Get tool definitions for journal operations
 */
export function getJournalTools(): Tool[] {
  return [
    {
      name: 'journal_update',
      description: 'Update journal entry with outcome',
      inputSchema: {
        type: 'object' as const,
        properties: {
          ticker: {
            type: 'string',
            description: 'Stock ticker symbol',
          },
          decision: {
            type: 'string',
            enum: ['LONG', 'SHORT', 'PASS'],
            description: 'Investment decision',
          },
          rationale: {
            type: 'string',
            description: 'Decision rationale',
          },
          entry_price: {
            type: 'number',
            description: 'Entry price',
          },
          position_size: {
            type: 'number',
            description: 'Position size',
          },
          return_pct: {
            type: 'number',
            description: 'Return percentage (when closed)',
          },
        },
        required: ['ticker', 'decision', 'rationale'],
      },
    },
    {
      name: 'journal_list',
      description: 'List all journal entries',
      inputSchema: {
        type: 'object' as const,
        properties: {},
      },
    },
  ];
}

/**
 * Handle journal_update
 */
export async function handleJournalUpdate(args: any) {
  try {
    const { ticker, decision, rationale, entry_price, position_size, return_pct } = args;

    const exists = await storage.journalEntryExists(ticker);

    if (!exists) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            error: 'Journal entry not found',
            ticker,
            hint: 'Create a journal entry first through the CLI',
          }),
        }],
        isError: true,
      };
    }

    const outcome: storage.JournalEntry['outcome'] = {
      decision,
      rationale,
      entry_price,
      position_size,
    };

    if (return_pct !== undefined) {
      outcome.return_pct = return_pct;
      outcome.date_closed = new Date().toISOString();
    }

    const success = await storage.updateJournalOutcome(ticker, outcome);

    if (!success) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: 'Failed to update journal' }) }],
        isError: true,
      };
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          message: 'Journal entry updated successfully',
          ticker,
          outcome,
        }, null, 2),
      }],
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: String(error) }) }],
      isError: true,
    };
  }
}

/**
 * Handle journal_list
 */
export async function handleJournalList() {
  try {
    const entries = await storage.listJournalEntries();

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          entries,
          count: entries.length,
        }, null, 2),
      }],
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: String(error) }) }],
      isError: true,
    };
  }
}
