/**
 * Agent Commands
 *
 * Commands for interacting with agents: ask, list, test
 */

import { Command } from 'commander';
import { getKernelClient } from '../lib/kernel-client.js';
import {
  createTable,
  addTableRow,
  formatTimestamp,
  success,
  error,
  header,
  kv,
  info,
} from '../lib/format.js';

export function createAgentCommands(): Command {
  const cmd = new Command('agent');
  cmd.description('Agent commands');

  // Ask agent
  cmd
    .command('ask')
    .description('Ask an agent a question')
    .requiredOption('-a, --agent <agentId>', 'Agent ID')
    .option('-p, --prompt <prompt>', 'Prompt to send to agent')
    .option('-i, --interactive', 'Interactive mode (read from stdin)')
    .option('-c, --context <json>', 'Additional context as JSON')
    .option('-t, --timeout <seconds>', 'Timeout in seconds', '300')
    .action(async (options) => {
      try {
        let prompt = options.prompt;

        if (options.interactive && !prompt) {
          info('Enter your prompt (press Ctrl+D when done):');
          // In real implementation, would read from stdin
          prompt = '<interactive input>';
        }

        if (!prompt) {
          error('Please provide a prompt using --prompt or --interactive');
          process.exit(1);
        }

        const context = options.context ? JSON.parse(options.context) : undefined;

        const client = getKernelClient();
        const response = await client.askAgent({
          agent: options.agent,
          prompt,
          context,
          timeout: parseInt(options.timeout, 10),
        });

        header('Response');
        console.log(response);
      } catch (err) {
        error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });

  // List agents
  cmd
    .command('list')
    .description('List all agents')
    .option('-d, --domain <domain>', 'Filter by domain')
    .action(async (options) => {
      try {
        const client = getKernelClient();
        const agents = await client.listAgents(options.domain);

        if (agents.length === 0) {
          info('No agents found');
          return;
        }

        const table = createTable([
          'ID',
          'Name',
          'Role',
          'Domain',
          'Active',
          'Model',
        ]);

        for (const agent of agents) {
          addTableRow(table, [
            agent.id,
            agent.name,
            agent.role,
            agent.domain,
            agent.active ? 'Yes' : 'No',
            `${agent.model.primary.provider}/${agent.model.primary.model}`,
          ]);
        }

        console.log(table.toString());
      } catch (err) {
        error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });

  // Test agent
  cmd
    .command('test')
    .description('Test an agent with a fixture')
    .requiredOption('-i, --id <agentId>', 'Agent ID')
    .requiredOption('-f, --fixture <path>', 'Path to test fixture')
    .action(async (options) => {
      try {
        const client = getKernelClient();
        const result = await client.testAgent({
          agent: options.id,
          fixture: options.fixture,
        });

        if (result.success) {
          success(`Agent ${options.id} test passed`);
          console.log(result.output);
        } else {
          error(`Agent ${options.id} test failed`);
          if (result.error) {
            error(result.error);
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
