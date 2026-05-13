/**
 * A2A List Command
 *
 * Lists all registered A2A agents
 */

import { Command } from 'commander';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { createTable, addTableRow, success, error, info, header } from '../../lib/format.js';

export function createListCommand(): Command {
  const cmd = new Command('list');
  cmd.description('List all registered A2A agents');

  cmd.option('-a, --all', 'Show all agents including inactive', false);
  cmd.option('-t, --type <type>', 'Filter by agent type (internal|external)');
  cmd.option('-d, --domain <domain>', 'Filter by domain');
  cmd.option('-r, --role <role>', 'Filter by role');

  cmd.action(async (options) => {
    try {
      // In a real implementation, this would query the gateway
      // For now, we'll read from a local registry file if it exists
      const registryPath = join(process.cwd(), '.one4all', 'a2a-registry.json');

      if (!existsSync(registryPath)) {
        info('No A2A agents registered. Use "one4all a2a register" to add agents.');
        return;
      }

      const registry = JSON.parse(readFileSync(registryPath, 'utf-8'));
      let agents = Object.values(registry.agents || {});

      // Apply filters
      if (!options.all) {
        agents = agents.filter((a: any) => a.active !== false);
      }

      if (options.type) {
        agents = agents.filter((a: any) => {
          const isExternal = !!a.a2a_config?.endpoint;
          return options.type === 'external' ? isExternal : !isExternal;
        });
      }

      if (options.domain) {
        agents = agents.filter((a: any) => a.domain === options.domain);
      }

      if (options.role) {
        agents = agents.filter((a: any) => a.role === options.role);
      }

      if (agents.length === 0) {
        info('No agents found matching the criteria');
        return;
      }

      header(`Registered A2A Agents (${agents.length})`);

      const table = createTable([
        'ID',
        'Name',
        'Type',
        'Role',
        'Domain',
        'Status',
        'Trust Level',
      ]);

      for (const agent of agents as any[]) {
        const type = agent.a2a_config?.endpoint ? 'External' : 'Internal';
        const status = agent.active ? 'Active' : 'Inactive';
        const trustLevel = agent.trust?.trust_level || 'unverified';

        addTableRow(table, [
          agent.id,
          agent.name,
          type,
          agent.role,
          agent.domain,
          status,
          trustLevel,
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
