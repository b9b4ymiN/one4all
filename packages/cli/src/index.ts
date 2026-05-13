#!/usr/bin/env node
/**
 * @one4all/cli
 *
 * Command-line interface for the one4all system
 */

// Load environment variables from .env file (simple manual approach)
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const loadEnv = () => {
  // List of paths to check for .env file
  const envPaths = [
    join(process.cwd(), '.env'),
    join(process.cwd(), 'packages', 'cli', '.env'),
    join(__dirname, '..', '..', '.env'),  // From packages/cli/src -> project root
    join(__dirname, '..', '..', '..', '.env'),  // Extra level up
    join(homedir(), 'one4all', '.env'),  // ~/one4all/.env
  ];

  for (const envPath of envPaths) {
    if (existsSync(envPath)) {
      console.error(`Loading .env from: ${envPath}`);
      const envContent = readFileSync(envPath, 'utf-8');
      envContent.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
          const [key, ...valueParts] = trimmed.split('=');
          const value = valueParts.join('=').trim();
          if (value && (value[0] === '"' || value[0] === "'")) {
            process.env[key] = value.slice(1, -1);
          } else {
            process.env[key] = value;
          }
        }
      });
      console.error(`Loaded ZAI_API_KEY: ${process.env.ZAI_API_KEY ? '***' + process.env.ZAI_API_KEY.slice(-4) : 'NOT SET'}`);
      break;
    }
  }
};
loadEnv();

import { Command } from 'commander';
import chalk from 'chalk';

// Import command groups
import { createMissionCommands } from './commands/mission.js';
import { createAgentCommands } from './commands/agent.js';
import { createAgentsManageCommands } from './commands/agents-manage.js';
import { createTeamCommands } from './commands/team.js';
import { createJournalCommands } from './commands/journal.js';
import { createConstitutionCommands } from './commands/constitution.js';
import { createDomainCommands } from './commands/domain.js';
import { createDomainsManageCommands } from './commands/domains-manage.js';
import { createValidationCommands } from './commands/validate.js';
import { createKernelCommands } from './commands/kernel.js';
import { createReportCommands } from './commands/report.js';
import {
  createObservabilityCommands,
  createAuditCommands,
  createScorecardCommands,
  createCostCommands,
} from './commands/observability.js';
import { createObserveCommands } from './commands/observe.js';

const program = new Command();

program
  .name('one4all')
  .description(chalk.cyan('one4all - AI Company Simulation System'))
  .version('0.1.0')
  .addHelpText('beforeAll', `
${chalk.bold.cyan('╔═══════════════════════════════════════════════════════╗')}
${chalk.bold.cyan('║')}  ${chalk.bold.white('one4all')} - ${chalk.white('AI Company Simulation System')}           ${chalk.bold.cyan('║')}
${chalk.bold.cyan('╚═══════════════════════════════════════════════════════╝')}
`)
  .addHelpText('after', `

${chalk.dim('Examples:')}
  ${chalk.white('one4all mission create --domain investment-war-room --type stock_analysis --ticker MCS')}
  ${chalk.white('one4all mission run --id MCS-valuation-20260511-001')}
  ${chalk.white('one4all agent ask --agent damodaran-valuation "Analyze MCS DCF"')}
  ${chalk.white('one4all team status')}
  ${chalk.white('one4all journal view --ticker MCS')}

${chalk.dim('Documentation:')} https://github.com/yourusername/one4all
${chalk.dim('Report bugs:')} https://github.com/yourusername/one4all/issues
`);

// Add command groups
program.addCommand(createMissionCommands());
program.addCommand(createAgentCommands());
program.addCommand(createAgentsManageCommands());
program.addCommand(createTeamCommands());
program.addCommand(createJournalCommands());
program.addCommand(createConstitutionCommands());
program.addCommand(createDomainCommands());
program.addCommand(createDomainsManageCommands());
program.addCommand(createValidationCommands());
program.addCommand(createKernelCommands());
program.addCommand(createReportCommands());
program.addCommand(createObservabilityCommands());
program.addCommand(createAuditCommands());
program.addCommand(createScorecardCommands());
program.addCommand(createCostCommands());
program.addCommand(createObserveCommands());

// Parse and execute
program.parse();
