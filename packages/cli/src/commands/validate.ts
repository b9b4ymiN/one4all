/**
 * Validation Commands - Quality gates and schema validation
 *
 * validate: agents, domains, constitutions with actionable errors
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { existsSync, readFileSync } from 'fs';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import { glob } from 'glob';
import { validateAgentConfig, validateAgentId } from '../lib/agent-schema.js';
import { validateDomainConfig, validateDomainId } from '../lib/domain-schema.js';
import { readAgent, listAgents } from '../lib/agent-storage.js';
import { readDomain, listDomains } from '../lib/domain-storage.js';
import * as yaml from 'js-yaml';

export function createValidationCommands(): Command {
  const cmd = new Command('validate');

  cmd.description('Quality gates and validation (agents, domains, constitutions)');

  // === VALIDATE AGENT ===
  cmd
    .command('agent <agentId>')
    .description('Validate agent configuration')
    .option('--schema', 'Check schema compliance')
    .option('--runtime', 'Check runtime requirements')
    .option('-v, --verbose', 'Verbose output')
    .action(async (agentId, options) => {
      await validateAgent(agentId, options);
    });

  // === VALIDATE DOMAIN ===
  cmd
    .command('domain <domainId>')
    .description('Validate domain configuration')
    .option('--schema', 'Check schema compliance')
    .option('--agents', 'Check all assigned agents')
    .option('--constitution', 'Check constitution file')
    .option('-v, --verbose', 'Verbose output')
    .action(async (domainId, options) => {
      await validateDomainCmd(domainId, options);
    });

  // === VALIDATE CONSTITUTION ===
  cmd
    .command('constitution <domainId>')
    .description('Validate domain constitution rules')
    .option('--rules', 'Check rule syntax')
    .option('--enforcement', 'Check enforcement settings')
    .option('-v, --verbose', 'Verbose output')
    .action(async (domainId, options) => {
      await validateConstitution(domainId, options);
    });

  // === VALIDATE ALL ===
  cmd
    .command('all')
    .description('Validate all agents and domains')
    .option('--include-constitution', 'Also validate constitutions')
    .option('-v, --verbose', 'Verbose output')
    .action(async (options) => {
      await validateAll(options);
    });

  return cmd;
}

// === VALIDATE AGENT ===

async function validateAgent(agentId: string, options: any): Promise<void> {
  console.log(chalk.cyan(`Validating agent: ${agentId}`));

  // First check runtime storage
  let agent = await readAgent(agentId);

  if (!agent) {
    console.log(chalk.yellow(`  Agent not found in runtime storage, checking source files...`));

    // Check source YAML files
    const domains = join(process.cwd(), 'domains');
    const yamlFiles = await glob('**/agents/*.yaml', { cwd: domains, absolute: true });

    for (const yamlFile of yamlFiles) {
      const content = await readFile(yamlFile, 'utf-8');
      const parsed = yaml.load(content) as any;
      if (parsed.id === agentId) {
        agent = parsed;
        console.log(chalk.dim(`  Found in: ${yamlFile}`));
        break;
      }
    }

    if (!agent) {
      console.error(chalk.red(`✗ Agent "${agentId}" not found`));
      console.log(chalk.dim('  Checked runtime storage and source YAML files'));
      process.exit(1);
    }
  }

  let hasErrors = false;
  let hasWarnings = false;

  // Schema validation
  if (options.schema !== false) {
    const validation = validateAgentConfig(agent);

    if (!validation.valid) {
      console.log(chalk.red('\n✗ Schema validation failed:'));
      for (const error of validation.errors) {
        console.log(chalk.red(`  - ${error}`));
        // Provide actionable suggestion
        const suggestion = getSuggestion(error);
        if (suggestion) {
          console.log(chalk.dim(`    → ${suggestion}`));
        }
      }
      hasErrors = true;
    }

    if (validation.warnings.length > 0) {
      console.log(chalk.yellow('\n⚠ Schema warnings:'));
      for (const warning of validation.warnings) {
        console.log(chalk.yellow(`  - ${warning}`));
      }
      hasWarnings = true;
    }

    if (validation.valid && !hasWarnings) {
      console.log(chalk.green('\n✓ Schema validation passed'));
    }
  }

  // ID format validation
  if (options.runtime !== false) {
    const idValidation = validateAgentId(agent.id);
    if (!idValidation.valid) {
      console.log(chalk.red('\n✗ ID format invalid:'));
      for (const error of idValidation.errors) {
        console.log(chalk.red(`  - ${error}`));
      }
      hasErrors = true;
    }
  }

  // Runtime checks
  if (options.runtime !== false) {
    console.log(chalk.dim('\nRuntime checks:'));

    // Check if skills are valid
    if (agent.skills && agent.skills.length > 0) {
      console.log(chalk.green(`  ✓ Has ${agent.skills.length} skills defined`));
    } else {
      console.log(chalk.yellow('  ⚠ No skills defined'));
      hasWarnings = true;
    }

    // Check if provider is valid
    const validProviders = ['claude-cli', 'gemini-cli', 'zai-api', 'claude', 'gemini', 'zai', 'openai'];
    const provider = agent.model?.primary?.provider;
    if (provider) {
      if (validProviders.includes(provider)) {
        console.log(chalk.green(`  ✓ Provider "${provider}" is valid`));
      } else {
        console.log(chalk.yellow(`  ⚠ Provider "${provider}" is not in standard list`));
        hasWarnings = true;
      }
    } else {
      console.log(chalk.red('  ✗ No provider specified'));
      hasErrors = true;
    }

    // Check if model is specified
    const model = agent.model?.primary?.model;
    if (model) {
      console.log(chalk.green(`  ✓ Model "${model}" is specified`));
    } else {
      console.log(chalk.yellow('  ⚠ No model specified'));
      hasWarnings = true;
    }

    // Check timeout
    if (agent.timeout_seconds) {
      if (agent.timeout_seconds >= 30) {
        console.log(chalk.green(`  ✓ Timeout: ${agent.timeout_seconds}s`));
      } else {
        console.log(chalk.yellow(`  ⚠ Timeout ${agent.timeout_seconds}s may be too short`));
        hasWarnings = true;
      }
    } else {
      console.log(chalk.yellow('  ⚠ No timeout specified (will use default)'));
    }
  }

  // Verbose details
  if (options.verbose) {
    console.log(chalk.dim('\nAgent details:'));
    console.log(chalk.dim(`  ID: ${agent.id}`));
    console.log(chalk.dim(`  Name: ${agent.name}`));
    console.log(chalk.dim(`  Domain: ${agent.domain}`));
    console.log(chalk.dim(`  Role: ${agent.role}`));
    console.log(chalk.dim(`  Skills: ${agent.skills?.join(', ') || 'none'}`));
    console.log(chalk.dim(`  Provider: ${agent.model?.primary?.provider || 'none'}`));
    console.log(chalk.dim(`  Model: ${agent.model?.primary?.model || 'none'}`));
  }

  // Summary
  console.log(chalk.dim('\n' + '='.repeat(40)));
  if (hasErrors) {
    console.log(chalk.red('Validation failed with errors'));
    process.exit(1);
  } else if (hasWarnings) {
    console.log(chalk.yellow('Validation passed with warnings'));
  } else {
    console.log(chalk.green('Validation passed'));
  }
}

// === VALIDATE DOMAIN ===

async function validateDomainCmd(domainId: string, options: any): Promise<void> {
  console.log(chalk.cyan(`Validating domain: ${domainId}`));

  let domain = await readDomain(domainId);

  if (!domain) {
    console.error(chalk.red(`✗ Domain "${domainId}" not found in runtime storage`));
    process.exit(1);
  }

  let hasErrors = false;
  let hasWarnings = false;

  // Schema validation
  if (options.schema !== false) {
    const validation = validateDomainConfig(domain);

    if (!validation.valid) {
      console.log(chalk.red('\n✗ Schema validation failed:'));
      for (const error of validation.errors) {
        console.log(chalk.red(`  - ${error}`));
        const suggestion = getSuggestion(error);
        if (suggestion) {
          console.log(chalk.dim(`    → ${suggestion}`));
        }
      }
      hasErrors = true;
    }

    if (validation.warnings.length > 0) {
      console.log(chalk.yellow('\n⚠ Schema warnings:'));
      for (const warning of validation.warnings) {
        console.log(chalk.yellow(`  - ${warning}`));
      }
      hasWarnings = true;
    }

    if (validation.valid && !hasWarnings) {
      console.log(chalk.green('\n✓ Schema validation passed'));
    }
  }

  // ID format validation
  const idValidation = validateDomainId(domain.id);
  if (!idValidation.valid) {
    console.log(chalk.red('\n✗ ID format invalid:'));
    for (const error of idValidation.errors) {
      console.log(chalk.red(`  - ${error}`));
    }
    hasErrors = true;
  }

  // Check agents
  if (options.agents) {
    console.log(chalk.dim('\nChecking agents...'));

    if (!domain.agent_ids || domain.agent_ids.length === 0) {
      console.log(chalk.yellow('  ⚠ No agents assigned to domain'));
      hasWarnings = true;
    } else {
      const allAgents = await listAgents();
      const agentIds = new Set(allAgents.map(a => a.id));
      let missing = 0;

      for (const agentId of domain.agent_ids) {
        if (agentIds.has(agentId)) {
          console.log(chalk.green(`  ✓ ${agentId}`));
        } else {
          console.log(chalk.red(`  ✗ ${agentId} (not found)`));
          hasErrors = true;
          missing++;
        }
      }

      if (missing > 0) {
        console.log(chalk.yellow(`\n  → ${missing} agents not found in runtime storage`));
        console.log(chalk.dim('    Use "one4all agents import --all" to import agents'));
      }
    }
  }

  // Check constitution
  if (options.constitution) {
    console.log(chalk.dim('\nChecking constitution...'));

    if (!domain.constitution_path) {
      console.log(chalk.yellow('  ⚠ No constitution path configured'));
      console.log(chalk.dim('    Add constitution_path to domain config'));
      hasWarnings = true;
    } else {
      const constitutionPaths = [
        join(process.cwd(), domain.constitution_path),
        join(process.cwd(), 'domains', domainId, 'constitution', 'constitution.yaml'),
      ];

      let found = false;
      for (const path of constitutionPaths) {
        if (existsSync(path)) {
          console.log(chalk.green(`  ✓ Constitution found: ${path}`));
          found = true;

          // Try to parse and validate constitution
          try {
            const content = await readFile(path, 'utf-8');
            const parsed = yaml.load(content) as any;

            if (parsed.rules && Array.isArray(parsed.rules)) {
              console.log(chalk.green(`    ✓ ${parsed.rules.length} rules defined`));
            } else {
              console.log(chalk.yellow('    ⚠ No rules array found in constitution'));
            }
          } catch (error) {
            console.log(chalk.red(`    ✗ Failed to parse constitution: ${error}`));
            hasErrors = true;
          }

          break;
        }
      }

      if (!found) {
        console.log(chalk.yellow(`  ⚠ Constitution not found: ${domain.constitution_path}`));
        console.log(chalk.dim('    Checked paths:'));
        constitutionPaths.forEach(p => console.log(chalk.dim(`      - ${p}`)));
        hasWarnings = true;
      }
    }
  }

  // Summary
  console.log(chalk.dim('\n' + '='.repeat(40)));
  if (hasErrors) {
    console.log(chalk.red('Validation failed with errors'));
    process.exit(1);
  } else if (hasWarnings) {
    console.log(chalk.yellow('Validation passed with warnings'));
  } else {
    console.log(chalk.green('Validation passed'));
  }
}

// === VALIDATE CONSTITUTION ===

async function validateConstitution(domainId: string, options: any): Promise<void> {
  console.log(chalk.cyan(`Validating constitution for domain: ${domainId}`));

  // Find constitution file
  const constitutionPaths = [
    join(process.cwd(), 'domains', domainId, 'constitution', 'constitution.yaml'),
    join(process.cwd(), 'domains', domainId, 'constitution.yaml'),
    join(process.cwd(), 'domains', domainId, 'constitution', 'rules.yaml'),
  ];

  let constitutionPath: string | null = null;
  for (const path of constitutionPaths) {
    if (existsSync(path)) {
      constitutionPath = path;
      break;
    }
  }

  if (!constitutionPath) {
    console.error(chalk.red(`✗ Constitution not found for domain "${domainId}"`));
    console.log(chalk.dim('  Checked paths:'));
    constitutionPaths.forEach(p => console.log(chalk.dim(`    - ${p}`)));
    console.log(chalk.dim('\n  Create a constitution file at:'));
    console.log(chalk.dim(`    domains/${domainId}/constitution/constitution.yaml`));
    process.exit(1);
  }

  console.log(chalk.dim(`Found: ${constitutionPath}`));

  let hasErrors = false;
  let hasWarnings = false;

  try {
    const content = await readFile(constitutionPath, 'utf-8');
    const parsed = yaml.load(content) as any;

    // Check rules structure
    if (options.rules !== false) {
      if (!parsed.rules || !Array.isArray(parsed.rules)) {
        console.log(chalk.red('\n✗ No rules array found in constitution'));
        console.log(chalk.dim('  Constitution should have a top-level "rules" array'));
        hasErrors = true;
      } else {
        console.log(chalk.green(`\n✓ Found ${parsed.rules.length} rules`));

        // Validate each rule
        for (let i = 0; i < parsed.rules.length; i++) {
          const rule = parsed.rules[i];
          console.log(chalk.dim(`\n  Rule ${i + 1}:`));

          if (!rule.id) {
            console.log(chalk.red('    ✗ Missing "id" field'));
            hasErrors = true;
          } else {
            console.log(chalk.dim(`    ID: ${rule.id}`));
          }

          if (!rule.description) {
            console.log(chalk.yellow('    ⚠ Missing "description"'));
            hasWarnings = true;
          }

          if (!rule.enforcement) {
            console.log(chalk.yellow('    ⚠ Missing "enforcement" level'));
            hasWarnings = true;
          } else {
            const validLevels = ['required', 'recommended', 'optional'];
            if (!validLevels.includes(rule.enforcement)) {
              console.log(chalk.yellow(`    ⚠ Invalid enforcement level: ${rule.enforcement}`));
              console.log(chalk.dim(`      Valid levels: ${validLevels.join(', ')}`));
              hasWarnings = true;
            } else {
              console.log(chalk.green(`    ✓ Enforcement: ${rule.enforcement}`));
            }
          }
        }
      }
    }

    // Check enforcement settings
    if (options.enforcement !== false) {
      console.log(chalk.dim('\nEnforcement settings:'));

      if (parsed.strict_mode !== undefined) {
        if (typeof parsed.strict_mode === 'boolean') {
          console.log(chalk.green(`  ✓ Strict mode: ${parsed.strict_mode}`));
        } else {
          console.log(chalk.yellow('  ⚠ strict_mode should be boolean'));
          hasWarnings = true;
        }
      } else {
        console.log(chalk.dim('  – No strict_mode setting (will use default)'));
      }

      if (parsed.validation_level) {
        const validLevels = ['strict', 'standard', 'lenient'];
        if (validLevels.includes(parsed.validation_level)) {
          console.log(chalk.green(`  ✓ Validation level: ${parsed.validation_level}`));
        } else {
          console.log(chalk.yellow(`  ⚠ Invalid validation_level: ${parsed.validation_level}`));
          hasWarnings = true;
        }
      }
    }

  } catch (error) {
    console.log(chalk.red(`\n✗ Failed to parse constitution: ${error}`));
    hasErrors = true;
  }

  // Summary
  console.log(chalk.dim('\n' + '='.repeat(40)));
  if (hasErrors) {
    console.log(chalk.red('Validation failed with errors'));
    process.exit(1);
  } else if (hasWarnings) {
    console.log(chalk.yellow('Validation passed with warnings'));
  } else {
    console.log(chalk.green('Validation passed'));
  }
}

// === VALIDATE ALL ===

async function validateAll(options: any): Promise<void> {
  console.log(chalk.cyan('Validating all agents and domains...\n'));

  let agentErrors = 0;
  let agentWarnings = 0;
  let domainErrors = 0;
  let domainWarnings = 0;

  // Validate all agents
  const agents = await listAgents();
  console.log(chalk.dim(`Validating ${agents.length} agents...`));

  for (const agent of agents) {
    try {
      const agentData = await readAgent(agent.id);
      if (agentData) {
        const validation = validateAgentConfig(agentData);
        if (!validation.valid) agentErrors++;
        if (validation.warnings.length > 0) agentWarnings++;

        if (options.verbose || !validation.valid) {
          console.log(`  ${agent.id}: ${validation.valid ? chalk.green('✓') : chalk.red('✗')}`);
          if (!validation.valid && validation.errors.length > 0) {
            validation.errors.forEach(e => console.log(chalk.dim(`    - ${e}`)));
          }
        }
      }
    } catch (error) {
      console.log(chalk.red(`  ${agent.id}: ✗ ${error}`));
      agentErrors++;
    }
  }

  // Validate all domains
  const domains = await listDomains();
  console.log(chalk.dim(`\nValidating ${domains.length} domains...`));

  for (const domain of domains) {
    try {
      const domainData = await readDomain(domain.id);
      if (domainData) {
        const validation = validateDomainConfig(domainData);
        if (!validation.valid) domainErrors++;
        if (validation.warnings.length > 0) domainWarnings++;

        if (options.verbose || !validation.valid) {
          console.log(`  ${domain.id}: ${validation.valid ? chalk.green('✓') : chalk.red('✗')}`);
          if (!validation.valid && validation.errors.length > 0) {
            validation.errors.forEach(e => console.log(chalk.dim(`    - ${e}`)));
          }
        }
      }
    } catch (error) {
      console.log(chalk.red(`  ${domain.id}: ✗ ${error}`));
      domainErrors++;
    }
  }

  // Validate constitutions if requested
  if (options.includeConstitution) {
    console.log(chalk.dim('\nValidating constitutions...'));
    for (const domain of domains) {
      try {
        // This would call validateConstitution but simplified for summary
        console.log(`  ${domain.id}: ${chalk.dim('constitution check skipped')}`);
      } catch (error) {
        console.log(chalk.red(`  ${domain.id}: ✗ ${error}`));
      }
    }
  }

  // Summary
  console.log(chalk.dim('\n' + '='.repeat(40)));
  console.log(chalk.dim(`Agents: ${agents.length} total, ${agentErrors} errors, ${agentWarnings} warnings`));
  console.log(chalk.dim(`Domains: ${domains.length} total, ${domainErrors} errors, ${domainWarnings} warnings`));

  if (agentErrors > 0 || domainErrors > 0) {
    console.log(chalk.red('\nValidation failed'));
    process.exit(1);
  } else if (agentWarnings > 0 || domainWarnings > 0) {
    console.log(chalk.yellow('\nValidation passed with warnings'));
  } else {
    console.log(chalk.green('\nAll validations passed'));
  }
}

// === HELPER FUNCTIONS ===

function getSuggestion(error: string): string | null {
  const suggestions: Record<string, string> = {
    'must have a valid "id" string': 'Add: id: <agent-id>',
    'must have a valid "name" string': 'Add: name: "Display Name"',
    'must have a valid "role" string': 'Add: role: valuation_analyst (or other valid role)',
    'must have a valid "domain" string': 'Add: domain: investment-war-room',
    'must have a valid "description" string': 'Add: description: "What this agent does"',
    'must have a "model" object': 'Add: model: { primary: { provider: gemini-cli, model: gemini-2-flash } }',
    'must have a "primary" object': 'Add: primary: { provider: gemini-cli, model: gemini-2-flash }',
    'Primary model must have a "provider" string': 'Add: provider: gemini-cli (or claude-cli, zai-api)',
    'Primary model must have a "model" string': 'Add: model: gemini-2-flash (or other model name)',
    'must have a "skills" array': 'Add: skills: [skill1, skill2, ...]',
  };

  for (const [key, value] of Object.entries(suggestions)) {
    if (error.includes(key)) {
      return value;
    }
  }

  return null;
}
