/**
 * Domains Manage Commands - CRUD operations for domains
 *
 * Full lifecycle management: create, edit, list, show, remove, validate
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { table } from 'table';
import {
  readDomain,
  writeDomain,
  deleteDomain,
  backupDomain,
  listDomains,
  listDomainBackups,
  getDomainStoragePaths,
} from '../lib/domain-storage.js';
import {
  validateDomainConfig,
  validateDomainId,
  DOMAIN_TEMPLATES,
  type DomainConfig,
  type RuntimeDomain,
} from '../lib/domain-schema.js';
import { listAgents } from '../lib/agent-storage.js';
import { existsSync } from 'fs';
import { writeFile, readFile } from 'fs/promises';
import { join } from 'path';

export function createDomainsManageCommands(): Command {
  const cmd = new Command('domains');

  cmd.description('Domain lifecycle management (create, edit, list, show, remove, validate)');

  // === CREATE ===
  cmd
    .command('create')
    .description('Create a new domain')
    .option('-i, --id <id>', 'Domain ID (lowercase-hyphenated)')
    .option('-n, --name <name>', 'Domain display name')
    .option('-d, --description <description>', 'Domain description')
    .option('--template <template>', 'Use template (investment-war-room, content-creator, research-studio, crypto-analysis)')
    .option('--cli <cli>', 'Default CLI (claude-cli, gemini-cli, zai-api)')
    .option('--tier1 <count>', 'Tier 1 evidence requirement', '3')
    .option('--tier2 <count>', 'Tier 2 evidence requirement')
    .option('--tier3 <count>', 'Tier 3 evidence requirement')
    .option('--mission-types <types>', 'Mission types (comma-separated)')
    .option('--interactive', 'Interactive mode with prompts')
    .action(async (options) => {
      if (options.interactive) {
        await createDomainInteractive();
      } else {
        await createDomainDirect(options);
      }
    });

  // === EDIT ===
  cmd
    .command('edit <domainId>')
    .description('Edit an existing domain')
    .option('--set-name <name>', 'Set display name')
    .option('--set-description <description>', 'Set description')
    .option('--set-cli <cli>', 'Set default CLI')
    .option('--add-mission-type <type>', 'Add a mission type')
    .option('--remove-mission-type <type>', 'Remove a mission type')
    .option('--add-agent <agentId>', 'Add an agent to domain')
    .option('--remove-agent <agentId>', 'Remove an agent from domain')
    .option('--no-backup', 'Skip automatic backup')
    .action(async (domainId, options) => {
      await editDomain(domainId, options);
    });

  // === LIST ===
  cmd
    .command('list')
    .description('List all domains')
    .option('-f, --format <format>', 'Output format (table, json)', 'table')
    .action(async (options) => {
      await listDomainsCmd(options);
    });

  // === SHOW ===
  cmd
    .command('show <domainId>')
    .description('Show detailed domain information')
    .option('-f, --format <format>', 'Output format (yaml, json)', 'yaml')
    .option('--include-runtime', 'Include runtime metadata')
    .action(async (domainId, options) => {
      await showDomain(domainId, options);
    });

  // === REMOVE ===
  cmd
    .command('remove <domainId>')
    .description('Remove a domain')
    .option('-f, --force', 'Skip confirmation')
    .option('--backup', 'Create backup before removal')
    .action(async (domainId, options) => {
      await removeDomain(domainId, options);
    });

  // === VALIDATE ===
  cmd
    .command('validate <domainId>')
    .description('Validate domain configuration')
    .option('--check-agents', 'Verify all assigned agents exist')
    .option('--check-constitution', 'Verify constitution file exists')
    .action(async (domainId, options) => {
      await validateDomain(domainId, options);
    });

  // === AGENTS ===
  cmd
    .command('agents <domainId>')
    .description('List agents in a domain')
    .action(async (domainId) => {
      await listDomainAgents(domainId);
    });

  // === BACKUPS ===
  cmd
    .command('backups <domainId>')
    .description('List domain backups')
    .action(async (domainId) => {
      await listDomainBackupsCmd(domainId);
    });

  // === RESTORE ===
  cmd
    .command('restore <domainId> <backupFile>')
    .description('Restore domain from backup')
    .action(async (domainId, backupFile) => {
      await restoreDomainBackup(domainId, backupFile);
    });

  return cmd;
}

// === CREATE FUNCTIONS ===

async function createDomainDirect(options: any): Promise<void> {
  // Validate required fields
  if (!options.id) {
    console.error(chalk.red('Error: --id is required'));
    process.exit(1);
  }

  const idValidation = validateDomainId(options.id);
  if (!idValidation.valid) {
    console.error(chalk.red('Invalid domain ID:'));
    idValidation.errors.forEach(e => console.error(chalk.red(`  - ${e}`)));
    process.exit(1);
  }

  // Check if domain already exists
  const existing = await readDomain(options.id);
  if (existing) {
    console.error(chalk.red(`Error: Domain "${options.id}" already exists`));
    process.exit(1);
  }

  // Start with template if provided
  let domainConfig: Partial<DomainConfig> = {};

  if (options.template && DOMAIN_TEMPLATES[options.template]) {
    domainConfig = { ...DOMAIN_TEMPLATES[options.template] };
    console.log(chalk.dim(`Using template: ${options.template}`));
  }

  const domain: RuntimeDomain = {
    id: options.id,
    name: options.name || options.id,
    description: options.description || domainConfig.description || `${options.name || options.id} domain`,
    default_cli: options.cli || domainConfig.default_cli || 'gemini-cli',
    evidence_requirements: {
      tier_1: parseInt(options.tier1, 10),
      ...(options.tier2 && { tier_2: parseInt(options.tier2, 10) }),
      ...(options.tier3 && { tier_3: parseInt(options.tier3, 10) }),
    },
    mission_types: options.missionTypes
      ? options.missionTypes.split(',').map((s: string) => s.trim())
      : domainConfig.mission_types || [],
    agent_ids: [],
    _runtime: {
      created_at: new Date().toISOString(),
      last_modified: new Date().toISOString(),
    },
  };

  await writeDomain(domain);
  console.log(chalk.green(`✓ Domain "${options.id}" created successfully`));
  console.log(chalk.dim(`  ID: ${domain.id}`));
  console.log(chalk.dim(`  Name: ${domain.name}`));
  console.log(chalk.dim(`  Description: ${domain.description}`));
  console.log(chalk.dim(`  Default CLI: ${domain.default_cli}`));

  if (options.template) {
    console.log(chalk.dim(`  Template: ${options.template}`));
    console.log(chalk.dim(`  Mission Types: ${domain.mission_types?.join(', ') || 'none'}`));
  }
}

async function createDomainInteractive(): Promise<void> {
  console.log(chalk.cyan('Interactive Domain Creation'));
  console.log(chalk.dim('Press Enter to use default values'));

  const readline = await import('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (prompt: string): Promise<string> =>
    new Promise(resolve => rl.question(prompt, resolve));

  console.log(chalk.yellow('\nAvailable templates:'));
  console.log(chalk.dim('  - investment-war-room: Investment analysis with specialists'));
  console.log(chalk.dim('  - content-creator: Content creation and review'));
  console.log(chalk.dim('  - research-studio: Academic research and literature review'));
  console.log(chalk.dim('  - crypto-analysis: Cryptocurrency analysis'));

  const id = await question(chalk.yellow('\nDomain ID (lowercase-hyphenated): '));
  const name = await question(chalk.yellow('Display name: ') || id);
  const description = await question(chalk.yellow('Description: '));
  const templateChoice = await question(chalk.yellow('Template (optional, press Enter to skip): '));
  const cliChoice = await question(chalk.yellow('Default CLI (claude-cli, gemini-cli, zai-api) (default: gemini-cli): ') || 'gemini-cli');

  rl.close();

  const idValidation = validateDomainId(id);
  if (!idValidation.valid) {
    console.error(chalk.red('Invalid domain ID:'));
    idValidation.errors.forEach(e => console.error(chalk.red(`  - ${e}`)));
    process.exit(1);
  }

  // Start with template if provided
  let domainConfig: Partial<DomainConfig> = {};
  if (templateChoice && DOMAIN_TEMPLATES[templateChoice]) {
    domainConfig = DOMAIN_TEMPLATES[templateChoice];
    console.log(chalk.dim(`Using template: ${templateChoice}`));
  }

  const domain: RuntimeDomain = {
    id,
    name,
    description: description || domainConfig.description || `${name} domain`,
    default_cli: cliChoice as any,
    evidence_requirements: domainConfig.evidence_requirements || { tier_1: 3 },
    mission_types: domainConfig.mission_types || [],
    agent_ids: [],
    _runtime: {
      created_at: new Date().toISOString(),
      last_modified: new Date().toISOString(),
    },
  };

  await writeDomain(domain);
  console.log(chalk.green(`\n✓ Domain "${id}" created successfully`));
}

// === EDIT FUNCTIONS ===

async function editDomain(domainId: string, options: any): Promise<void> {
  const domain = await readDomain(domainId);

  if (!domain) {
    console.error(chalk.red(`Error: Domain "${domainId}" not found`));
    process.exit(1);
  }

  // Create backup unless skipped
  if (options.backup !== false) {
    const backupPath = await backupDomain(domainId);
    if (backupPath) {
      console.log(chalk.dim(`✓ Backup created: ${backupPath}`));
    }
  }

  let modified = false;

  // Apply edits
  if (options.setName) {
    domain.name = options.setName;
    modified = true;
    console.log(chalk.green(`✓ Set name to: ${options.setName}`));
  }

  if (options.setDescription) {
    domain.description = options.setDescription;
    modified = true;
    console.log(chalk.green(`✓ Set description`));
  }

  if (options.setCli) {
    domain.default_cli = options.setCli as any;
    modified = true;
    console.log(chalk.green(`✓ Set default CLI to: ${options.setCli}`));
  }

  if (options.addMissionType) {
    if (!domain.mission_types) domain.mission_types = [];
    if (!domain.mission_types.includes(options.addMissionType)) {
      domain.mission_types.push(options.addMissionType);
      modified = true;
      console.log(chalk.green(`✓ Added mission type: ${options.addMissionType}`));
    }
  }

  if (options.removeMissionType && domain.mission_types) {
    const idx = domain.mission_types.indexOf(options.removeMissionType);
    if (idx >= 0) {
      domain.mission_types.splice(idx, 1);
      modified = true;
      console.log(chalk.green(`✓ Removed mission type: ${options.removeMissionType}`));
    }
  }

  if (options.addAgent) {
    if (!domain.agent_ids) domain.agent_ids = [];
    if (!domain.agent_ids.includes(options.addAgent)) {
      domain.agent_ids.push(options.addAgent);
      modified = true;
      console.log(chalk.green(`✓ Added agent: ${options.addAgent}`));
    }
  }

  if (options.removeAgent && domain.agent_ids) {
    const idx = domain.agent_ids.indexOf(options.removeAgent);
    if (idx >= 0) {
      domain.agent_ids.splice(idx, 1);
      modified = true;
      console.log(chalk.green(`✓ Removed agent: ${options.removeAgent}`));
    }
  }

  if (modified) {
    await writeDomain(domain);
    console.log(chalk.green(`✓ Domain "${domainId}" updated successfully`));
  } else {
    console.log(chalk.yellow('No changes applied'));
  }
}

// === LIST FUNCTIONS ===

async function listDomainsCmd(options: any): Promise<void> {
  const domains = await listDomains();

  if (options.format === 'json') {
    console.log(JSON.stringify(domains, null, 2));
    return;
  }

  if (domains.length === 0) {
    console.log(chalk.yellow('No domains found'));
    return;
  }

  // Table format
  const data = [
    ['ID', 'Name', 'Agents', 'Constitution', 'Description'],
  ];

  for (const domain of domains) {
    data.push([
      domain.id,
      domain.name.substring(0, 25),
      String(domain.agent_count),
      domain.constitution_loaded ? '✓' : '✗',
      domain.description.substring(0, 40),
    ]);
  }

  console.log(table(data));
  console.log(chalk.dim(`\nTotal: ${domains.length} domains`));
}

// === SHOW FUNCTIONS ===

async function showDomain(domainId: string, options: any): Promise<void> {
  const domain = await readDomain(domainId);

  if (!domain) {
    console.error(chalk.red(`Error: Domain "${domainId}" not found`));
    process.exit(1);
  }

  if (options.format === 'json') {
    const output = options.includeRuntime ? domain : sanitizeDomain(domain);
    console.log(JSON.stringify(output, null, 2));
  } else {
    const yaml = domainToYAML(sanitizeDomain(domain));
    console.log(yaml);
  }
}

function sanitizeDomain(domain: RuntimeDomain): DomainConfig {
  const { _runtime, ...sanitized } = domain;
  return sanitized;
}

function domainToYAML(domain: DomainConfig): string {
  const lines: string[] = [];

  lines.push(`# Domain: ${domain.name}`);
  lines.push('');
  lines.push(`id: ${domain.id}`);
  lines.push(`name: "${domain.name}"`);
  lines.push(`description: "${domain.description}"`);
  lines.push('');

  if (domain.default_cli) {
    lines.push(`default_cli: ${domain.default_cli}`);
    lines.push('');
  }

  if (domain.evidence_requirements) {
    lines.push('evidence_requirements:');
    lines.push(`  tier_1: ${domain.evidence_requirements.tier_1}`);
    if (domain.evidence_requirements.tier_2) lines.push(`  tier_2: ${domain.evidence_requirements.tier_2}`);
    if (domain.evidence_requirements.tier_3) lines.push(`  tier_3: ${domain.evidence_requirements.tier_3}`);
    lines.push('');
  }

  if (domain.mission_types && domain.mission_types.length > 0) {
    lines.push('mission_types:');
    for (const mt of domain.mission_types) {
      lines.push(`  - ${mt}`);
    }
    lines.push('');
  }

  if (domain.agent_ids && domain.agent_ids.length > 0) {
    lines.push('agent_ids:');
    for (const aid of domain.agent_ids) {
      lines.push(`  - ${aid}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// === REMOVE FUNCTIONS ===

async function removeDomain(domainId: string, options: any): Promise<void> {
  const domain = await readDomain(domainId);

  if (!domain) {
    console.error(chalk.red(`Error: Domain "${domainId}" not found`));
    process.exit(1);
  }

  if (!options.force) {
    console.log(chalk.yellow(`About to remove domain "${domainId}" (${domain.name})`));
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
    await backupDomain(domainId);
  }

  const success = await deleteDomain(domainId);

  if (success) {
    console.log(chalk.green(`✓ Domain "${domainId}" removed successfully`));
  } else {
    console.error(chalk.red(`Error: Failed to remove domain "${domainId}"`));
    process.exit(1);
  }
}

// === VALIDATE FUNCTIONS ===

async function validateDomain(domainId: string, options: any): Promise<void> {
  const domain = await readDomain(domainId);

  if (!domain) {
    console.error(chalk.red(`Error: Domain "${domainId}" not found`));
    process.exit(1);
  }

  console.log(chalk.cyan(`Validating domain: ${domain.name} (${domain.id})`));

  let hasErrors = false;
  let hasWarnings = false;

  // Basic validation
  const validation = validateDomainConfig(domain);
  if (!validation.valid) {
    console.log(chalk.red('\n✗ Configuration errors:'));
    validation.errors.forEach(e => {
      console.log(chalk.red(`  - ${e}`));
    });
    hasErrors = true;
  }

  if (validation.warnings.length > 0) {
    console.log(chalk.yellow('\n⚠ Configuration warnings:'));
    validation.warnings.forEach(w => {
      console.log(chalk.yellow(`  - ${w}`));
    });
    hasWarnings = true;
  }

  if (validation.valid && !hasWarnings) {
    console.log(chalk.green('\n✓ Domain configuration is valid'));
  }

  // Check agents
  if (options.checkAgents) {
    console.log(chalk.dim('\nChecking agents...'));

    if (!domain.agent_ids || domain.agent_ids.length === 0) {
      console.log(chalk.dim('  No agents assigned to domain'));
    } else {
      const allAgents = await listAgents();
      const agentIds = new Set(allAgents.map(a => a.id));

      for (const agentId of domain.agent_ids) {
        if (agentIds.has(agentId)) {
          console.log(chalk.green(`  ✓ ${agentId}`));
        } else {
          console.log(chalk.red(`  ✗ ${agentId} (not found)`));
          hasErrors = true;
        }
      }
    }
  }

  // Check constitution
  if (options.checkConstitution) {
    console.log(chalk.dim('\nChecking constitution...'));

    if (!domain.constitution_path) {
      console.log(chalk.yellow('  ⚠ No constitution path configured'));
      hasWarnings = true;
    } else {
      // Try to find the constitution file
      const constitutionPaths = [
        join(process.cwd(), domain.constitution_path),
        join(process.cwd(), 'domains', domainId, 'constitution', 'constitution.yaml'),
      ];

      let found = false;
      for (const path of constitutionPaths) {
        if (existsSync(path)) {
          console.log(chalk.green(`  ✓ Constitution found: ${path}`));
          found = true;
          break;
        }
      }

      if (!found) {
        console.log(chalk.yellow(`  ⚠ Constitution not found: ${domain.constitution_path}`));
        hasWarnings = true;
      }
    }
  }

  // Summary
  console.log(chalk.dim('\n' + '='.repeat(50)));
  if (hasErrors) {
    console.log(chalk.red('Validation failed with errors'));
    process.exit(1);
  } else if (hasWarnings) {
    console.log(chalk.yellow('Validation passed with warnings'));
  } else {
    console.log(chalk.green('Validation passed'));
  }
}

// === AGENTS LIST FUNCTIONS ===

async function listDomainAgents(domainId: string): Promise<void> {
  const domain = await readDomain(domainId);

  if (!domain) {
    console.error(chalk.red(`Error: Domain "${domainId}" not found`));
    process.exit(1);
  }

  console.log(chalk.cyan(`Agents in domain: ${domain.name} (${domain.id})`));

  if (!domain.agent_ids || domain.agent_ids.length === 0) {
    console.log(chalk.yellow('  No agents assigned'));
    return;
  }

  const allAgents = await listAgents();
  const agentMap = new Map(allAgents.map(a => [a.id, a]));

  for (const agentId of domain.agent_ids) {
    const agent = agentMap.get(agentId);
    if (agent) {
      console.log(chalk.green(`  ✓ ${agent.id}`));
      console.log(chalk.dim(`      Name: ${agent.name}`));
      console.log(chalk.dim(`      Role: ${agent.role}`));
      console.log(chalk.dim(`      Provider: ${agent.provider}`));
    } else {
      console.log(chalk.red(`  ✗ ${agentId} (not found)`));
    }
  }
}

// === BACKUP FUNCTIONS ===

async function listDomainBackupsCmd(domainId: string): Promise<void> {
  const backups = await listDomainBackups(domainId);

  if (backups.length === 0) {
    console.log(chalk.yellow(`No backups found for domain "${domainId}"`));
    return;
  }

  console.log(chalk.cyan(`Backups for domain "${domainId}":`));
  backups.sort().reverse().forEach(b => console.log(chalk.dim(`  ${b}`)));
}

async function restoreDomainBackup(domainId: string, backupFile: string): Promise<void> {
  if (!existsSync(backupFile)) {
    console.error(chalk.red(`Error: Backup file not found: ${backupFile}`));
    process.exit(1);
  }

  // Backup current state before restoring
  await backupDomain(domainId);

  const content = await readFile(backupFile, 'utf-8');
  const domain = JSON.parse(content) as RuntimeDomain;

  await writeDomain(domain);
  console.log(chalk.green(`✓ Domain "${domainId}" restored from ${backupFile}`));
}
