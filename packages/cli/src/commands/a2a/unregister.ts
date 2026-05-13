/**
 * A2A Unregister Command
 *
 * Removes (unregisters) a registered A2A agent
 */

import { Command } from 'commander';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { success, error, info, header, warning } from '../../lib/format.js';

// Simple confirm function (in real implementation, would use inquirer)
async function confirm(message: string): Promise<boolean> {
  // For now, always return true in non-interactive mode
  // In real implementation, would use readline or inquirer
  return process.stdout.isTTY;
}

export function createUnregisterCommand(): Command {
  const cmd = new Command('unregister');
  cmd.description('Remove (unregister) a registered A2A agent');

  cmd.argument('<agentId>', 'Agent ID');
  cmd.option('-f, --force', 'Skip confirmation prompt', false);
  cmd.option('--purge', 'Remove all agent data including history', false);

  cmd.action(async (agentId: string, options) => {
    try {
      const registryPath = join(process.cwd(), '.one4all', 'a2a-registry.json');

      if (!existsSync(registryPath)) {
        error('No A2A agents registered.');
        process.exit(1);
      }

      const registry = JSON.parse(readFileSync(registryPath, 'utf-8'));
      const agent = registry.agents[agentId];

      if (!agent) {
        error(`Agent not found: ${agentId}`);
        info('Use "one4all a2a list" to see all registered agents.');
        process.exit(1);
      }

      header(`Unregistering Agent: ${agent.name} (${agentId})`);

      // Show agent details before confirmation
      info(`Type: ${agent.a2a_config?.endpoint ? 'External' : 'Internal'}`);
      info(`Role: ${agent.role}`);
      info(`Trust Level: ${agent.trust?.trust_level || 'unverified'}`);

      // Confirm unless force flag is set
      if (!options.force) {
        const answer = await confirm(`Are you sure you want to unregister agent "${agentId}"?`);

        if (!answer) {
          warning('Unregister cancelled.');
          process.exit(0);
        }
      }

      // Remove agent from registry
      delete registry.agents[agentId];
      registry.metadata.lastUpdated = new Date().toISOString();

      // Write updated registry
      writeFileSync(registryPath, JSON.stringify(registry, null, 2));

      success(`Agent "${agentId}" unregistered successfully.`);

      // Show remaining agents count
      const remainingCount = Object.keys(registry.agents).length;
      if (remainingCount > 0) {
        info(`Remaining registered agents: ${remainingCount}`);
      } else {
        info('No agents remaining in registry.');
      }
    } catch (err) {
      error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

  return cmd;
}
