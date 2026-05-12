#!/usr/bin/env node
/**
 * @one4all/cli
 *
 * Command-line interface for the one4all system
 */

import { Command } from 'commander';
import chalk from 'chalk';

// Import command groups
import { createMissionCommands } from './commands/mission.js';
import { createAgentCommands } from './commands/agent.js';
import { createTeamCommands } from './commands/team.js';
import { createJournalCommands } from './commands/journal.js';
import { createConstitutionCommands } from './commands/constitution.js';
import { createDomainCommands } from './commands/domain.js';
import {
  createObservabilityCommands,
  createAuditCommands,
  createScorecardCommands,
  createCostCommands,
} from './commands/observability.js';

const program = new Command();

program
  .name('oneman')
  .description(chalk.cyan('one4all - AI Company Simulation System'))
  .version('0.1.0')
  .addHelpText('beforeAll', `
${chalk.bold.cyan('╔═══════════════════════════════════════════════════════╗')}
${chalk.bold.cyan('║')}  ${chalk.bold.white('one4all')} - ${chalk.white('AI Company Simulation System')}           ${chalk.bold.cyan('║')}
${chalk.bold.cyan('╚═══════════════════════════════════════════════════════╝')}
`)
  .addHelpText('after', `

${chalk.dim('Examples:')}
  ${chalk.white('oneman mission create --domain investment-war-room --type stock_analysis --ticker MCS')}
  ${chalk.white('oneman mission run --id MCS-valuation-20260511-001')}
  ${chalk.white('oneman agent ask --agent damodaran-valuation "Analyze MCS DCF"')}
  ${chalk.white('oneman team status')}
  ${chalk.white('oneman journal view --ticker MCS')}

${chalk.dim('Documentation:')} https://github.com/yourusername/one4all
${chalk.dim('Report bugs:')} https://github.com/yourusername/one4all/issues
`);

// Add command groups
program.addCommand(createMissionCommands());
program.addCommand(createAgentCommands());
program.addCommand(createTeamCommands());
program.addCommand(createJournalCommands());
program.addCommand(createConstitutionCommands());
program.addCommand(createDomainCommands());
program.addCommand(createObservabilityCommands());
program.addCommand(createAuditCommands());
program.addCommand(createScorecardCommands());
program.addCommand(createCostCommands());

// Parse and execute
program.parse();
