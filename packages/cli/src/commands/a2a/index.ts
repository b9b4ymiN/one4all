/**
 * A2A (Agent-to-Agent) Commands
 *
 * Commands for managing A2A agents: register, list, info, health, verify, unregister
 */

import { Command } from 'commander';
import {
  createTable,
  addTableRow,
  formatTimestamp,
  success,
  error,
  header,
  kv,
  info,
  warning,
} from '../../lib/format.js';
import { createListCommand } from './list.js';
import { createRegisterCommand } from './register.js';
import { createInfoCommand } from './info.js';
import { createHealthCommand } from './health.js';
import { createVerifyCommand } from './verify.js';
import { createUnregisterCommand } from './unregister.js';

export function createA2ACommands(): Command {
  const cmd = new Command('a2a');
  cmd.description('Agent-to-Agent (A2A) protocol commands for managing external and internal agents');

  // Add subcommands
  cmd.addCommand(createListCommand());
  cmd.addCommand(createRegisterCommand());
  cmd.addCommand(createInfoCommand());
  cmd.addCommand(createHealthCommand());
  cmd.addCommand(createVerifyCommand());
  cmd.addCommand(createUnregisterCommand());

  return cmd;
}
