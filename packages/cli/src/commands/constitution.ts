/**
 * Constitution Commands
 *
 * Commands for constitution management
 */

import { Command } from 'commander';
import { getKernelClient } from '../lib/kernel-client.js';
import {
  createTable,
  addTableRow,
  formatEnforcementLevel,
  formatEvidenceTier,
  success,
  error,
  header,
  info,
} from '../lib/format.js';

export function createConstitutionCommands(): Command {
  const cmd = new Command('constitution');
  cmd.description('Constitution commands');

  // Load constitution
  cmd
    .command('load')
    .description('Load constitution for a domain')
    .requiredOption('-d, --domain <domain>', 'Domain ID')
    .option('-f, --file <path>', 'Path to constitution file')
    .action(async (options) => {
      info('Constitution loading is not yet fully implemented');
      info('This will load and validate a constitution file for the domain');
    });

  // List constitutions
  cmd
    .command('list')
    .description('List constitution rules for a domain')
    .option('-d, --domain <domain>', 'Domain ID (defaults to current domain)')
    .action(async (options) => {
      try {
        const domain = options.domain || 'investment-war-room';
        const client = getKernelClient();
        const constitution = await client.getConstitution(domain);

        if (!constitution) {
          error(`No constitution found for domain: ${domain}`);
          process.exit(1);
        }

        header(`Constitution: ${domain} (v${constitution.version})`);

        if (constitution.rules.length === 0) {
          info('No rules defined');
          return;
        }

        const table = createTable([
          'ID',
          'Enforcement',
          'Applies To',
          'Description',
        ]);

        for (const rule of constitution.rules) {
          addTableRow(table, [
            rule.id,
            formatEnforcementLevel(rule.enforcement),
            rule.applies_to.join(', '),
            rule.description,
          ]);
        }

        console.log(table.toString());
      } catch (err) {
        error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });

  // Validate constitution
  cmd
    .command('validate')
    .description('Validate constitution for a domain')
    .option('-d, --domain <domain>', 'Domain ID')
    .action(async (options) => {
      try {
        const domain = options.domain || 'investment-war-room';
        const client = getKernelClient();
        const result = await client.validateConstitution(domain);

        header(`Constitution Validation: ${domain}`);

        if (result.valid) {
          success('Constitution is valid');
        } else {
          error('Constitution validation failed');
        }

        if (result.warnings.length > 0) {
          info('\nWarnings:');
          for (const warning of result.warnings) {
            info(`  [${warning.rule_id}] ${warning.message}`);
          }
        }

        if (result.errors.length > 0) {
          info('\nErrors:');
          for (const err of result.errors) {
            error(`  [${err.rule_id}] ${err.message}`);
          }
          process.exit(1);
        }
      } catch (err) {
        error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });

  return cmd;
}
