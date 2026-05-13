/**
 * Mission Commands
 *
 * Commands for managing missions: create, start, status, abort, list, replay
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora, { Ora } from 'ora';
import { getKernelClient, type MissionCreateOptions } from '../lib/kernel-client.js';
import {
  createTable,
  addTableRow,
  formatState,
  formatTimestamp,
  formatDuration,
  success,
  error,
  warning,
  header,
  kv,
  info,
} from '../lib/format.js';

export function createMissionCommands(): Command {
  const cmd = new Command('mission');
  cmd.description('Mission commands');

  // Create mission
  cmd
    .command('create')
    .description('Create a new mission')
    .requiredOption('-d, --domain <domain>', 'Domain ID (e.g., investment-war-room)')
    .requiredOption('-t, --type <type>', 'Mission type (e.g., stock_analysis)')
    .option('-T, --ticker <ticker>', 'Stock ticker symbol')
    .option('-d, --description <description>', 'Mission description')
    .option('--assumption <key=value>', 'Owner assumptions (can be used multiple times)', [])
    .option('--constraint <key=value>', 'Constraints (can be used multiple times)', [])
    .action(async (options) => {
      const spinner = ora('Creating mission...').start();

      try {
        const assumptions: Record<string, unknown> = {};
        for (const arg of options.assumption) {
          const [key, value] = arg.split('=');
          if (key && value) {
            assumptions[key] = value;
          }
        }

        const constraints: Record<string, unknown> = {};
        for (const arg of options.constraint) {
          const [key, value] = arg.split('=');
          if (key && value) {
            constraints[key] = value;
          }
        }

        const createOptions: MissionCreateOptions = {
          domain: options.domain,
          type: options.type,
          ticker: options.ticker,
          description: options.description || `${options.type} for ${options.ticker || 'unknown'}`,
          assumptions: Object.keys(assumptions).length > 0 ? assumptions : undefined,
          constraints: Object.keys(constraints).length > 0 ? constraints : undefined,
        };

        const client = getKernelClient();
        const mission = await client.createMission(createOptions);

        spinner.succeed('Mission created');

        header('Mission Details');
        kv('ID', chalk.cyan(mission.mission_id));
        kv('Domain', mission.domain);
        kv('Type', mission.mission_type);
        if (mission.ticker) {
          kv('Ticker', chalk.yellow(mission.ticker));
        }
        kv('State', formatState(mission.state));
        kv('Created', formatTimestamp(mission.created_at));
      } catch (err) {
        spinner.fail('Failed to create mission');
        error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });

  // Start mission
  cmd
    .command('run')
    .description('Start a mission and execute through state machine')
    .requiredOption('-i, --id <missionId>', 'Mission ID')
    .option('-w, --wait', 'Wait for mission completion (including human gates)')
    .action(async (options) => {
      const spinner = ora('Executing mission...').start();

      try {
        const client = getKernelClient();
        const result = await client.startMission(options.id);

        if (result.success) {
          spinner.succeed('Mission execution updated');
          if (result.new_state) {
            kv('Final State', formatState(result.new_state));
          }

          // If reached terminal or waiting state, show summary
          if (result.new_state === 'JOURNALED' || result.new_state === 'FAILED') {
            // Load mission to show details
            const status = await client.getMissionStatus(options.id);
            if (status && (status as any).decision) {
              const decision = (status as any).decision;
              header('Investment Decision');
              kv('Decision State', chalk.bold(decision.decision_state));
              kv('Fair Value', chalk.cyan(`$${decision.fair_value_conservative}`));
              kv('Price to Watch', chalk.yellow(`$${decision.price_to_watch}`));
              console.log('');
              console.log(chalk.gray('Thesis Breakers:'));
              for (const breaker of decision.thesis_breakers) {
                console.log(`  - ${chalk.red(breaker)}`);
              }
            }
          } else if (result.requires_human_input) {
            warning('Mission requires human input');
            info(`Run: one4all mission status -i ${options.id}`);
          }
        } else {
          spinner.fail('Failed to start mission');
          error(result.error || 'Unknown error');
          process.exit(1);
        }
      } catch (err) {
        spinner.fail('Failed to start mission');
        error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });

  // Mission status
  cmd
    .command('status')
    .description('Get mission status')
    .requiredOption('-i, --id <missionId>', 'Mission ID')
    .action(async (options) => {
      try {
        const client = getKernelClient();
        const status = await client.getMissionStatus(options.id);

        if (!status) {
          error(`Mission not found: ${options.id}`);
          process.exit(1);
        }

        header('Mission Status');
        kv('ID', chalk.cyan(status.mission_id));
        kv('State', formatState(status.state));
        kv('Domain', status.domain);
        kv('Type', status.mission_type);
        if (status.ticker) {
          kv('Ticker', chalk.yellow(status.ticker));
        }
        kv('Created', formatTimestamp(status.created_at));
        kv('Updated', formatTimestamp(status.updated_at));
        kv('In State For', formatDuration(status.current_state_duration));
      } catch (err) {
        error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });

  // Abort mission
  cmd
    .command('abort')
    .description('Abort a mission')
    .requiredOption('-i, --id <missionId>', 'Mission ID')
    .option('-f, --force', 'Force abort without confirmation')
    .action(async (options) => {
      if (!options.force) {
        warning(`Are you sure you want to abort mission ${options.id}?`);
        warning('This action cannot be undone.');
        // In real implementation, would use enquirer for confirmation
      }

      const spinner = ora('Aborting mission...').start();

      try {
        const client = getKernelClient();
        const result = await client.abortMission(options.id);

        if (result.success) {
          spinner.succeed('Mission aborted');
        } else {
          spinner.fail('Failed to abort mission');
          error(result.error || 'Unknown error');
          process.exit(1);
        }
      } catch (err) {
        spinner.fail('Failed to abort mission');
        error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });

  // List missions
  cmd
    .command('list')
    .description('List missions')
    .option('-d, --domain <domain>', 'Filter by domain')
    .option('-s, --state <state>', 'Filter by state')
    .option('-n, --limit <number>', 'Limit number of results', '20')
    .action(async (options) => {
      try {
        const client = getKernelClient();
        const missions = await client.listMissions({
          domain: options.domain,
          state: options.state as any,
          limit: parseInt(options.limit, 10),
        });

        if (missions.length === 0) {
          warning('No missions found');
          return;
        }

        const table = createTable([
          'ID',
          'Ticker',
          'State',
          'Type',
          'Created',
          'Duration',
        ]);

        for (const mission of missions) {
          addTableRow(table, [
            chalk.cyan(mission.mission_id.slice(0, 20)),
            mission.ticker || '-',
            formatState(mission.state),
            mission.mission_type,
            formatTimestamp(mission.created_at),
            formatDuration(mission.current_state_duration),
          ]);
        }

        console.log(table.toString());
      } catch (err) {
        error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });

  // Replay mission (placeholder)
  cmd
    .command('replay')
    .description('Replay a mission with different assumptions')
    .requiredOption('-i, --id <missionId>', 'Mission ID')
    .option('--assumption <key=value>', 'Override assumption (can be used multiple times)', [])
    .action(async (options) => {
      warning('Mission replay is not yet implemented');
      info('This feature will allow replaying missions with modified assumptions');
    });

  return cmd;
}
