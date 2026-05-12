/**
 * Journal Commands
 *
 * Commands for decision journal operations
 */

import { Command } from 'commander';
import { getKernelClient } from '../lib/kernel-client.js';
import {
  createTable,
  addTableRow,
  formatDecisionState,
  formatTimestamp,
  formatCurrency,
  success,
  error,
  header,
  kv,
  info,
} from '../lib/format.js';

export function createJournalCommands(): Command {
  const cmd = new Command('journal');
  cmd.description('Journal commands');

  // View journal entry
  cmd
    .command('view')
    .description('View journal entry for a ticker')
    .requiredOption('-t, --ticker <ticker>', 'Stock ticker')
    .action(async (options) => {
      try {
        const client = getKernelClient();
        const entry = await client.getJournalEntry(options.ticker);

        if (!entry) {
          info(`No journal entry found for ${options.ticker}`);
          return;
        }

        header('Journal Entry');
        kv('ID', entry.id);
        kv('Ticker', entry.ticker);
        kv('Decision', formatDecisionState(entry.decision));
        kv('Fair Value', formatCurrency(entry.fair_value));
        kv('Created', formatTimestamp(entry.created_at));

        if (entry.thesis) {
          console.log('\n' + 'Thesis:');
          console.log(entry.thesis);
        }

        if (entry.thesis_breakers.length > 0) {
          console.log('\n' + 'Thesis Breakers:');
          for (const breaker of entry.thesis_breakers) {
            console.log(`  - ${breaker}`);
          }
        }

        if (entry.outcome) {
          kv('Outcome', entry.outcome);
          if (entry.outcome_updated_at) {
            kv('Updated', formatTimestamp(entry.outcome_updated_at));
          }
        }
      } catch (err) {
        error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });

  // Update journal outcome
  cmd
    .command('update')
    .description('Update journal entry outcome')
    .requiredOption('-i, --id <entryId>', 'Journal entry ID')
    .requiredOption('-o, --outcome <outcome>', 'Outcome description')
    .action(async (options) => {
      try {
        const client = getKernelClient();
        const updated = await client.updateJournalOutcome({
          id: options.id,
          outcome: options.outcome,
        });

        if (updated) {
          success('Journal entry updated');
        } else {
          error('Journal entry not found');
          process.exit(1);
        }
      } catch (err) {
        error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });

  // List journal entries
  cmd
    .command('list')
    .description('List journal entries')
    .option('-s, --state <state>', 'Filter by state (e.g., open, closed)')
    .option('-d, --domain <domain>', 'Filter by domain')
    .action(async (options) => {
      try {
        const client = getKernelClient();
        const entries = await client.listJournalEntries({
          state: options.state,
          domain: options.domain,
        });

        if (entries.length === 0) {
          info('No journal entries found');
          return;
        }

        const table = createTable([
          'ID',
          'Ticker',
          'Decision',
          'Fair Value',
          'Created',
          'Outcome',
        ]);

        for (const entry of entries) {
          addTableRow(table, [
            entry.id.slice(0, 20),
            entry.ticker,
            formatDecisionState(entry.decision),
            formatCurrency(entry.fair_value),
            formatTimestamp(entry.created_at),
            entry.outcome || 'Open',
          ]);
        }

        console.log(table.toString());
      } catch (err) {
        error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });

  return cmd;
}
