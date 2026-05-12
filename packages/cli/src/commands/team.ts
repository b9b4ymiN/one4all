/**
 * Team Commands
 *
 * Commands for team status and health checks
 */

import { Command } from 'commander';
import { getKernelClient } from '../lib/kernel-client.js';
import {
  createTable,
  addTableRow,
  formatHealth,
  header,
  info,
} from '../lib/format.js';

export function createTeamCommands(): Command {
  const cmd = new Command('team');
  cmd.description('Team commands');

  // Health status
  cmd
    .command('status')
    .description('Show health of all backends')
    .action(async () => {
      try {
        const client = getKernelClient();
        const health = await client.getHealthStatus();

        header('Backend Health Status');

        for (const status of health) {
          console.log(formatHealth(status.name, status.status, status.details));
        }
      } catch (err) {
        info(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });

  // List teams
  cmd
    .command('list')
    .description('Show all teams')
    .action(async () => {
      try {
        const client = getKernelClient();
        const teams = await client.listTeams();

        if (teams.length === 0) {
          info('No teams found');
          return;
        }

        const table = createTable(['ID', 'Name', 'Domain']);

        for (const team of teams) {
          addTableRow(table, [team.id, team.name, team.domain]);
        }

        console.log(table.toString());
      } catch (err) {
        info(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });

  return cmd;
}
