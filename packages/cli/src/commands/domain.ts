/**
 * Domain Commands
 *
 * Commands for domain management
 */

import { Command } from 'commander';
import { getKernelClient } from '../lib/kernel-client.js';
import {
  createTable,
  addTableRow,
  success,
  error,
  header,
  info,
} from '../lib/format.js';

export function createDomainCommands(): Command {
  const cmd = new Command('domain');
  cmd.description('Domain commands');

  // List domains
  cmd
    .command('list')
    .description('List all domains')
    .action(async () => {
      try {
        const client = getKernelClient();
        const domains = await client.listDomains();

        if (domains.length === 0) {
          info('No domains found');
          return;
        }

        const table = createTable([
          'ID',
          'Name',
          'Version',
          'Description',
        ]);

        for (const domain of domains) {
          addTableRow(table, [
            domain.id,
            domain.name,
            domain.version,
            domain.description,
          ]);
        }

        console.log(table.toString());
      } catch (err) {
        error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });

  // Create domain
  cmd
    .command('create')
    .description('Create a new domain')
    .requiredOption('-i, --id <id>', 'Domain ID')
    .requiredOption('-n, --name <name>', 'Domain name')
    .option('-d, --description <description>', 'Domain description')
    .action(async (options) => {
      info('Domain creation is not yet fully implemented');
      info('This will create a new domain with default configuration');
    });

  // Switch domain
  cmd
    .command('switch')
    .description('Switch to a different domain')
    .requiredOption('-i, --id <id>', 'Domain ID')
    .action(async (options) => {
      info('Domain switching is not yet fully implemented');
      info(`This will set ${options.id} as the active domain`);
    });

  return cmd;
}
