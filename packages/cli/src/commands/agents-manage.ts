/**
 * Agents Manage Commands - CRUD operations for agents
 *
 * Full lifecycle management: create, edit, list, show, remove, import, export, test
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { table } from 'table';
import {
  readAgent,
  writeAgent,
  deleteAgent,
  backupAgent,
  listAgents,
  listAgentBackups,
  getStoragePaths,
} from '../lib/agent-storage.js';
import {
  loadAgentFromFile,
  loadAllAgents,
  agentToYAML,
  extractAgentIdFromPath,
} from '../lib/agent-loader.js';
import {
  validateAgentConfig,
  validateAgentId,
  type AgentConfig,
  type RuntimeAgent,
} from '../lib/agent-schema.js';
import { existsSync } from 'fs';
import { writeFile, readFile } from 'fs/promises';
import { join } from 'path';

export function createAgentsManageCommands(): Command {
  const cmd = new Command('agents');

  cmd.description('Agent lifecycle management (create, edit, list, show, remove, import, export, test)');

  // === CREATE ===
  cmd
    .command('create')
    .description('Create a new agent')
    .option('-i, --id <id>', 'Agent ID (lowercase-hyphenated)')
    .option('-n, --name <name>', 'Agent display name')
    .option('-d, --domain <domain>', 'Domain name')
    .option('-r, --role <role>', 'Agent role')
    .option('--description <description>', 'Agent description')
    .option('-p, --provider <provider>', 'Primary provider (claude-cli, gemini-cli, zai-api)')
    .option('-m, --model <model>', 'Primary model name')
    .option('-s, --skill <skills...>', 'Agent skills (space-separated)')
    .option('--clone <agentId>', 'Clone from existing agent')
    .option('--interactive', 'Interactive mode with prompts')
    .option('--timeout <seconds>', 'Timeout in seconds', '120')
    .option('--max-tokens <tokens>', 'Max tokens', '4096')
    .action(async (options) => {
      if (options.interactive) {
        await createAgentInteractive();
      } else if (options.clone) {
        await createAgentClone(options.clone, options);
      } else {
        await createAgentDirect(options);
      }
    });

  // === EDIT ===
  cmd
    .command('edit <agentId>')
    .description('Edit an existing agent')
    .option('--add-skill <skill>', 'Add a skill')
    .option('--remove-skill <skill>', 'Remove a skill')
    .option('--set-name <name>', 'Set display name')
    .option('--set-description <description>', 'Set description')
    .option('--set-provider <provider>', 'Set primary provider')
    .option('--set-model <model>', 'Set primary model')
    .option('--set-timeout <seconds>', 'Set timeout')
    .option('--set-active <true|false>', 'Set active status')
    .option('--interactive', 'Interactive edit mode')
    .option('--no-backup', 'Skip automatic backup')
    .action(async (agentId, options) => {
      await editAgent(agentId, options);
    });

  // === LIST ===
  cmd
    .command('list')
    .description('List all agents')
    .option('-d, --domain <domain>', 'Filter by domain')
    .option('-r, --role <role>', 'Filter by role')
    .option('-p, --provider <provider>', 'Filter by provider')
    .option('--active-only', 'Show only active agents')
    .option('--inactive-only', 'Show only inactive agents')
    .option('-f, --format <format>', 'Output format (table, json)', 'table')
    .action(async (options) => {
      await listAgentsCmd(options);
    });

  // === SHOW ===
  cmd
    .command('show <agentId>')
    .description('Show detailed agent information')
    .option('-f, --format <format>', 'Output format (yaml, json)', 'yaml')
    .option('--include-runtime', 'Include runtime metadata')
    .action(async (agentId, options) => {
      await showAgent(agentId, options);
    });

  // === REMOVE ===
  cmd
    .command('remove <agentId>')
    .description('Remove an agent')
    .option('-f, --force', 'Skip confirmation')
    .option('--backup', 'Create backup before removal')
    .action(async (agentId, options) => {
      await removeAgent(agentId, options);
    });

  // === IMPORT ===
  cmd
    .command('import')
    .description('Import agent from source YAML')
    .argument('[source]', 'Source YAML file path')
    .option('--id <id>', 'Override agent ID')
    .option('-d, --domain <domain>', 'Target domain')
    .option('--all', 'Import all agents from /domains/')
    .action(async (source, options) => {
      await importAgent(source, options);
    });

  // === EXPORT ===
  cmd
    .command('export <agentId>')
    .description('Export agent configuration')
    .option('-o, --output <file>', 'Output file path')
    .option('-f, --format <format>', 'Output format (json, yaml)', 'json')
    .action(async (agentId, options) => {
      await exportAgent(agentId, options);
    });

  // === TEST ===
  cmd
    .command('test <agentId>')
    .description('Test agent with a sample prompt')
    .option('-p, --prompt <prompt>', 'Test prompt (default: agent-specific)')
    .option('--provider <provider>', 'Override provider')
    .option('-v, --verbose', 'Verbose output')
    .action(async (agentId, options) => {
      await testAgent(agentId, options);
    });

  // === BACKUPS ===
  cmd
    .command('backups <agentId>')
    .description('List agent backups')
    .action(async (agentId) => {
      await listAgentBackupsCmd(agentId);
    });

  // === RESTORE ===
  cmd
    .command('restore <agentId> <backupFile>')
    .description('Restore agent from backup')
    .action(async (agentId, backupFile) => {
      await restoreAgentBackup(agentId, backupFile);
    });

  return cmd;
}

// === CREATE FUNCTIONS ===

async function createAgentDirect(options: any): Promise<void> {
  // Validate required fields
  if (!options.id) {
    console.error(chalk.red('Error: --id is required'));
    process.exit(1);
  }

  const idValidation = validateAgentId(options.id);
  if (!idValidation.valid) {
    console.error(chalk.red('Invalid agent ID:'));
    idValidation.errors.forEach(e => console.error(chalk.red(`  - ${e}`)));
    process.exit(1);
  }

  // Check if agent already exists
  const existing = await readAgent(options.id);
  if (existing) {
    console.error(chalk.red(`Error: Agent "${options.id}" already exists`));
    process.exit(1);
  }

  const agent: RuntimeAgent = {
    id: options.id,
    name: options.name || options.id,
    domain: options.domain || 'default',
    role: (options.role || 'domain_expert') as any,
    description: options.description || `${options.name || options.id} agent`,
    model: {
      primary: {
        provider: (options.provider || 'gemini-cli') as any,
        model: options.model || 'gemini-2-flash',
      },
    },
    skills: (options.skills || []) as any,
    timeout_seconds: parseInt(options.timeout, 10),
    max_tokens: parseInt(options.maxTokens, 10),
    active: true,
    _runtime: {
      imported_at: new Date().toISOString(),
      last_modified: new Date().toISOString(),
    },
  };

  await writeAgent(agent);
  console.log(chalk.green(`✓ Agent "${options.id}" created successfully`));
  console.log(chalk.dim(`  ID: ${agent.id}`));
  console.log(chalk.dim(`  Name: ${agent.name}`));
  console.log(chalk.dim(`  Domain: ${agent.domain}`));
  console.log(chalk.dim(`  Role: ${agent.role}`));
  console.log(chalk.dim(`  Provider: ${agent.model.primary.provider}/${agent.model.primary.model}`));
}

async function createAgentClone(sourceId: string, options: any): Promise<void> {
  const sourceAgent = await readAgent(sourceId);

  if (!sourceAgent) {
    console.error(chalk.red(`Error: Source agent "${sourceId}" not found`));
    process.exit(1);
  }

  const newId = options.id || `${sourceId}-copy`;
  const idValidation = validateAgentId(newId);

  if (!idValidation.valid) {
    console.error(chalk.red('Invalid agent ID:'));
    idValidation.errors.forEach(e => console.error(chalk.red(`  - ${e}`)));
    process.exit(1);
  }

  // Clone with new ID and metadata
  const newAgent: RuntimeAgent = {
    ...sourceAgent,
    id: newId,
    name: options.name || `${sourceAgent.name} (Copy)`,
    _runtime: {
      ...sourceAgent._runtime,
      imported_at: new Date().toISOString(),
      last_modified: new Date().toISOString(),
    },
  };

  await writeAgent(newAgent);
  console.log(chalk.green(`✓ Agent "${newId}" created as clone of "${sourceId}"`));
}

async function createAgentInteractive(): Promise<void> {
  console.log(chalk.cyan('Interactive Agent Creation'));
  console.log(chalk.dim('Press Enter to use default values'));

  // Simple readline implementation
  const readline = await import('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (prompt: string): Promise<string> =>
    new Promise(resolve => rl.question(prompt, resolve));

  const id = await question(chalk.yellow('Agent ID (lowercase-hyphenated): '));
  const name = await question(chalk.yellow('Display name: ') || id);
  const domain = await question(chalk.yellow('Domain (default: investment-war-room): ') || 'investment-war-room');
  const role = await question(chalk.yellow('Role (default: valuation_analyst): ') || 'valuation_analyst');
  const provider = await question(chalk.yellow('Provider (claude-cli, gemini-cli, zai-api) (default: gemini-cli): ') || 'gemini-cli');
  const model = await question(chalk.yellow('Model (default: gemini-2-flash): ') || 'gemini-2-flash');
  const skillsInput = await question(chalk.yellow('Skills (comma-separated): '));
  const skills = skillsInput ? skillsInput.split(',').map((s: string) => s.trim()) : [];

  rl.close();

  const idValidation = validateAgentId(id);
  if (!idValidation.valid) {
    console.error(chalk.red('Invalid agent ID:'));
    idValidation.errors.forEach(e => console.error(chalk.red(`  - ${e}`)));
    process.exit(1);
  }

  const agent: RuntimeAgent = {
    id,
    name,
    domain,
    role: role as any,
    description: `${name} - ${role} for ${domain}`,
    model: {
      primary: { provider: provider as any, model },
    },
    skills: skills as any,
    timeout_seconds: 120,
    max_tokens: 4096,
    active: true,
    _runtime: {
      imported_at: new Date().toISOString(),
      last_modified: new Date().toISOString(),
    },
  };

  await writeAgent(agent);
  console.log(chalk.green(`\n✓ Agent "${id}" created successfully`));
}

// === EDIT FUNCTIONS ===

async function editAgent(agentId: string, options: any): Promise<void> {
  const agent = await readAgent(agentId);

  if (!agent) {
    console.error(chalk.red(`Error: Agent "${agentId}" not found`));
    process.exit(1);
  }

  // Create backup unless skipped
  if (options.backup !== false) {
    const backupPath = await backupAgent(agentId);
    if (backupPath) {
      console.log(chalk.dim(`✓ Backup created: ${backupPath}`));
    }
  }

  let modified = false;

  // Apply edits
  if (options.addSkill) {
    if (!agent.skills.includes(options.addSkill)) {
      agent.skills.push(options.addSkill);
      modified = true;
      console.log(chalk.green(`✓ Added skill: ${options.addSkill}`));
    }
  }

  if (options.removeSkill) {
    const idx = agent.skills.indexOf(options.removeSkill);
    if (idx >= 0) {
      agent.skills.splice(idx, 1);
      modified = true;
      console.log(chalk.green(`✓ Removed skill: ${options.removeSkill}`));
    }
  }

  if (options.setName) {
    agent.name = options.setName;
    modified = true;
    console.log(chalk.green(`✓ Set name to: ${options.setName}`));
  }

  if (options.setDescription) {
    agent.description = options.setDescription;
    modified = true;
    console.log(chalk.green(`✓ Set description`));
  }

  if (options.setProvider) {
    agent.model.primary.provider = options.setProvider;
    modified = true;
    console.log(chalk.green(`✓ Set provider to: ${options.setProvider}`));
  }

  if (options.setModel) {
    agent.model.primary.model = options.setModel;
    modified = true;
    console.log(chalk.green(`✓ Set model to: ${options.setModel}`));
  }

  if (options.setTimeout) {
    agent.timeout_seconds = parseInt(options.setTimeout, 10);
    modified = true;
    console.log(chalk.green(`✓ Set timeout to: ${options.setTimeout}s`));
  }

  if (options.setActive !== undefined) {
    agent.active = options.setActive === 'true' || options.setActive === true;
    modified = true;
    console.log(chalk.green(`✓ Set active to: ${agent.active}`));
  }

  if (modified) {
    await writeAgent(agent);
    console.log(chalk.green(`✓ Agent "${agentId}" updated successfully`));
  } else {
    console.log(chalk.yellow('No changes applied'));
  }
}

// === LIST FUNCTIONS ===

async function listAgentsCmd(options: any): Promise<void> {
  let agents = await listAgents();

  // Apply filters
  if (options.domain) {
    agents = agents.filter(a => a.domain === options.domain);
  }
  if (options.role) {
    agents = agents.filter(a => a.role === options.role);
  }
  if (options.provider) {
    agents = agents.filter(a => a.provider === options.provider);
  }
  if (options.activeOnly) {
    agents = agents.filter(a => a.active);
  }
  if (options.inactiveOnly) {
    agents = agents.filter(a => !a.active);
  }

  if (options.format === 'json') {
    console.log(JSON.stringify(agents, null, 2));
    return;
  }

  if (agents.length === 0) {
    console.log(chalk.yellow('No agents found'));
    return;
  }

  // Table format
  const data = [
    ['ID', 'Name', 'Domain', 'Role', 'Provider', 'Active'],
  ];

  for (const agent of agents) {
    data.push([
      agent.id,
      agent.name.substring(0, 30),
      agent.domain.substring(0, 15),
      agent.role.substring(0, 15),
      agent.provider,
      agent.active ? '✓' : '✗',
    ]);
  }

  console.log(table(data));
  console.log(chalk.dim(`\nTotal: ${agents.length} agents`));
}

// === SHOW FUNCTIONS ===

async function showAgent(agentId: string, options: any): Promise<void> {
  const agent = await readAgent(agentId);

  if (!agent) {
    console.error(chalk.red(`Error: Agent "${agentId}" not found`));
    process.exit(1);
  }

  if (options.format === 'json') {
    const output = options.includeRuntime ? agent : sanitizeAgent(agent);
    console.log(JSON.stringify(output, null, 2));
  } else {
    const yaml = agentToYAML(sanitizeAgent(agent));
    console.log(yaml);
  }
}

function sanitizeAgent(agent: RuntimeAgent): AgentConfig {
  const { _runtime, ...sanitized } = agent;
  return sanitized;
}

// === REMOVE FUNCTIONS ===

async function removeAgent(agentId: string, options: any): Promise<void> {
  const agent = await readAgent(agentId);

  if (!agent) {
    console.error(chalk.red(`Error: Agent "${agentId}" not found`));
    process.exit(1);
  }

  if (!options.force) {
    console.log(chalk.yellow(`About to remove agent "${agentId}" (${agent.name})`));
    console.log(chalk.yellow('This action cannot be undone.'));

    const readline = await import('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const answer = await new Promise<string>(resolve =>
      rl.question(chalk.yellow('Continue? (y/N): '), resolve)
    );
    rl.close();

    if (answer.toLowerCase() !== 'y') {
      console.log(chalk.dim('Cancelled'));
      return;
    }
  }

  // Create backup if requested
  if (options.backup) {
    await backupAgent(agentId);
  }

  const success = await deleteAgent(agentId);

  if (success) {
    console.log(chalk.green(`✓ Agent "${agentId}" removed successfully`));
  } else {
    console.error(chalk.red(`Error: Failed to remove agent "${agentId}"`));
    process.exit(1);
  }
}

// === IMPORT FUNCTIONS ===

async function importAgent(source: string | undefined, options: any): Promise<void> {
  if (options.all) {
    await importAllAgents();
    return;
  }

  if (!source) {
    console.error(chalk.red('Error: Specify source file or use --all'));
    process.exit(1);
  }

  if (!existsSync(source)) {
    console.error(chalk.red(`Error: Source file not found: ${source}`));
    process.exit(1);
  }

  const result = await loadAgentFromFile(source);

  if (!result.success) {
    console.error(chalk.red('Error loading agent:'));
    console.error(chalk.red(`  ${result.error}`));
    if (result.validation?.errors) {
      result.validation.errors.forEach(e => console.error(chalk.red(`  - ${e}`)));
    }
    process.exit(1);
  }

  const agentId = options.id || result.agent!.id;

  // Check for conflicts
  const existing = await readAgent(agentId);
  if (existing) {
    console.error(chalk.red(`Error: Agent "${agentId}" already exists`));
    console.error(chalk.dim('Use --id <new-id> to import with a different ID'));
    process.exit(1);
  }

  // Override domain if specified
  if (options.domain && result.agent) {
    result.agent.domain = options.domain;
  }

  // Update ID if overridden
  if (options.id && result.agent) {
    result.agent.id = options.id;
  }

  await writeAgent(result.agent!);
  console.log(chalk.green(`✓ Agent "${agentId}" imported from ${source}`));
}

async function importAllAgents(): Promise<void> {
  // Try to find domains directory - check current dir, then parent directories
  let domainsPath = join(process.cwd(), 'domains');

  // If not found in current directory, try going up to project root
  if (!existsSync(domainsPath)) {
    // Check if we're in packages/cli
    if (process.cwd().endsWith('/packages/cli') || process.cwd().endsWith('\\packages\\cli')) {
      domainsPath = join(process.cwd(), '..', '..', 'domains');
    } else {
      // Try two levels up
      domainsPath = join(process.cwd(), '..', '..', 'domains');
    }
  }

  if (!existsSync(domainsPath)) {
    console.error(chalk.red(`Error: domains/ directory not found at ${domainsPath}`));
    console.error(chalk.dim('Run from project root or specify a path to a source YAML file'));
    process.exit(1);
  }

  const results = await loadAllAgents(domainsPath);

  let imported = 0;
  let skipped = 0;
  let failed = 0;

  for (const result of results) {
    if (!result.success) {
      console.error(chalk.red(`✗ Failed to load ${result.sourcePath}: ${result.error}`));
      failed++;
      continue;
    }

    const existing = await readAgent(result.agent!.id);
    if (existing) {
      console.log(chalk.dim(`  Skipped existing: ${result.agent!.id}`));
      skipped++;
      continue;
    }

    await writeAgent(result.agent!);
    console.log(chalk.green(`✓ Imported: ${result.agent!.id}`));
    imported++;
  }

  console.log(chalk.cyan(`\nImport summary:`));
  console.log(chalk.green(`  Imported: ${imported}`));
  console.log(chalk.dim(`  Skipped: ${skipped}`));
  console.log(chalk.red(`  Failed: ${failed}`));
}

// === EXPORT FUNCTIONS ===

async function exportAgent(agentId: string, options: any): Promise<void> {
  const agent = await readAgent(agentId);

  if (!agent) {
    console.error(chalk.red(`Error: Agent "${agentId}" not found`));
    process.exit(1);
  }

  let content: string;

  if (options.format === 'yaml') {
    content = agentToYAML(sanitizeAgent(agent));
  } else {
    content = JSON.stringify(sanitizeAgent(agent), null, 2);
  }

  if (options.output) {
    await writeFile(options.output, content);
    console.log(chalk.green(`✓ Agent "${agentId}" exported to ${options.output}`));
  } else {
    console.log(content);
  }
}

// === TEST FUNCTIONS ===

async function testAgent(agentId: string, options: any): Promise<void> {
  const agent = await readAgent(agentId);

  if (!agent) {
    console.error(chalk.red(`Error: Agent "${agentId}" not found`));
    process.exit(1);
  }

  console.log(chalk.cyan(`Testing agent: ${agent.name} (${agent.id})`));
  console.log(chalk.dim(`Provider: ${agent.model.primary.provider}/${agent.model.primary.model}`));

  const testPrompt = options.prompt || `Hello, I am testing your capabilities. Respond with "OK" if you understand.`;

  console.log(chalk.dim(`\nPrompt: ${testPrompt}`));
  console.log(chalk.dim('\nRunning test...'));

  // For now, just validate the agent config
  // Full CLI integration testing would require the adapter factory
  const validation = validateAgentConfig(agent);

  if (validation.valid) {
    console.log(chalk.green('✓ Agent configuration is valid'));
  } else {
    console.log(chalk.red('✗ Agent configuration has errors:'));
    validation.errors.forEach(e => console.log(chalk.red(`  - ${e}`)));
  }

  if (validation.warnings.length > 0) {
    console.log(chalk.yellow('\nWarnings:'));
    validation.warnings.forEach(w => console.log(chalk.yellow(`  - ${w}`)));
  }

  if (options.verbose) {
    console.log(chalk.dim('\nAgent details:'));
    console.log(chalk.dim(`  ID: ${agent.id}`));
    console.log(chalk.dim(`  Role: ${agent.role}`));
    console.log(chalk.dim(`  Domain: ${agent.domain}`));
    console.log(chalk.dim(`  Skills: ${agent.skills.join(', ')}`));
    console.log(chalk.dim(`  Timeout: ${agent.timeout_seconds}s`));
    console.log(chalk.dim(`  Max Tokens: ${agent.max_tokens}`));
  }
}

// === BACKUP FUNCTIONS ===

async function listAgentBackupsCmd(agentId: string): Promise<void> {
  const backups = await listAgentBackups(agentId);

  if (backups.length === 0) {
    console.log(chalk.yellow(`No backups found for agent "${agentId}"`));
    return;
  }

  console.log(chalk.cyan(`Backups for agent "${agentId}":`));
  backups.sort().reverse().forEach(b => console.log(chalk.dim(`  ${b}`)));
}

async function restoreAgentBackup(agentId: string, backupFile: string): Promise<void> {
  if (!existsSync(backupFile)) {
    console.error(chalk.red(`Error: Backup file not found: ${backupFile}`));
    process.exit(1);
  }

  // Backup current state before restoring
  await backupAgent(agentId);

  const content = await readFile(backupFile, 'utf-8');
  const agent = JSON.parse(content) as RuntimeAgent;

  await writeAgent(agent);
  console.log(chalk.green(`✓ Agent "${agentId}" restored from ${backupFile}`));
}
