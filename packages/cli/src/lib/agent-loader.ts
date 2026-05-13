/**
 * Agent Loader - Load and parse agent YAML files
 *
 * Reads agent cards from domains directory and converts to runtime format
 */

import { readFile, readdir } from 'fs/promises';
import { join, dirname, basename } from 'path';
import { existsSync } from 'fs';
import * as yaml from 'js-yaml';
import type { AgentConfig, RuntimeAgent, ValidationResult } from './agent-schema.js';
import { validateAgentConfig } from './agent-schema.js';

/**
 * Result of loading an agent
 */
export interface AgentLoadResult {
  success: boolean;
  agent?: RuntimeAgent;
  error?: string;
  validation?: ValidationResult;
  sourcePath?: string;
}

/**
 * Find all agent YAML files in the domains directory
 */
export async function findAgentFiles(domainsPath: string): Promise<string[]> {
  const agentFiles: string[] = [];

  if (!existsSync(domainsPath)) {
    return agentFiles;
  }

  const domains = await readdir(domainsPath, { withFileTypes: true });

  for (const domain of domains) {
    if (!domain.isDirectory()) {
      continue;
    }

    const agentsPath = join(domainsPath, domain.name, 'agents');

    if (!existsSync(agentsPath)) {
      continue;
    }

    const files = await readdir(agentsPath);

    for (const file of files) {
      if (file.endsWith('.yaml') || file.endsWith('.yml')) {
        agentFiles.push(join(agentsPath, file));
      }
    }
  }

  return agentFiles;
}

/**
 * Load an agent from a YAML file
 */
export async function loadAgentFromFile(filePath: string): Promise<AgentLoadResult> {
  try {
    const content = await readFile(filePath, 'utf-8');
    const parsed = yaml.load(content) as Record<string, any>;

    const validation = validateAgentConfig(parsed);

    if (!validation.valid) {
      return {
        success: false,
        error: `Validation failed: ${validation.errors.join(', ')}`,
        validation,
        sourcePath: filePath,
      };
    }

    const agent: RuntimeAgent = {
      ...parsed as AgentConfig,
      _runtime: {
        imported_at: new Date().toISOString(),
        last_modified: new Date().toISOString(),
        source_path: filePath,
      },
    };

    return {
      success: true,
      agent,
      validation,
      sourcePath: filePath,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      sourcePath: filePath,
    };
  }
}

/**
 * Load all agents from a domains directory
 */
export async function loadAllAgents(
  domainsPath: string,
  options: { filter?: { domain?: string; role?: string } } = {}
): Promise<AgentLoadResult[]> {
  const agentFiles = await findAgentFiles(domainsPath);
  const results: AgentLoadResult[] = [];

  for (const filePath of agentFiles) {
    const result = await loadAgentFromFile(filePath);

    // Apply filters
    if (result.agent && options.filter) {
      if (options.filter.domain && result.agent.domain !== options.filter.domain) {
        continue;
      }
      if (options.filter.role && result.agent.role !== options.filter.role) {
        continue;
      }
    }

    results.push(result);
  }

  return results;
}

/**
 * Extract domain name from agent file path
 */
export function extractDomainFromPath(filePath: string): string | null {
  const match = filePath.match(/domains\/([^\/]+)\/agents/);
  return match ? match[1] : null;
}

/**
 * Get agent ID from file path
 */
export function extractAgentIdFromPath(filePath: string): string {
  const filename = basename(filePath);
  return filename.replace(/\.(yaml|yml)$/, '');
}

/**
 * Convert agent config to YAML string
 */
export function agentToYAML(agent: AgentConfig): string {
  const lines: string[] = [];

  lines.push(`# Agent Card: ${agent.name}`);
  lines.push('');

  lines.push(`id: ${agent.id}`);
  lines.push(`name: "${agent.name}"`);

  if (agent.version) {
    lines.push(`version: "${agent.version}"`);
  }

  lines.push(`domain: ${agent.domain}`);

  if (agent.active !== undefined) {
    lines.push(`active: ${agent.active}`);
  }

  lines.push('');
  lines.push(`role: ${agent.role}`);
  lines.push(`description: "${agent.description}"`);
  lines.push('');

  // Model selection
  lines.push('# Model Selection');
  lines.push('model:');
  lines.push('  primary:');
  lines.push(`    provider: ${agent.model.primary.provider}`);
  lines.push(`    model: ${agent.model.primary.model}`);

  if (agent.model.fallback && agent.model.fallback.length > 0) {
    lines.push('  fallback:');
    for (const fb of agent.model.fallback) {
      lines.push(`    - provider: ${fb.provider}`);
      lines.push(`      model: ${fb.model}`);
    }
  }

  lines.push('');

  // Skills
  lines.push('skills:');
  for (const skill of agent.skills) {
    lines.push(`  - ${skill}`);
  }

  if (agent.output_contract) {
    lines.push('');
    lines.push('# Output Contract');
    lines.push('output_contract:');
    if (agent.output_contract.mandatory_fields) {
      lines.push('  mandatory_fields:');
      for (const field of agent.output_contract.mandatory_fields) {
        lines.push(`    - ${field}`);
      }
    }
    if (agent.output_contract.forbidden_content) {
      lines.push('  forbidden_content:');
      for (const item of agent.output_contract.forbidden_content) {
        lines.push(`    - ${item}`);
      }
    }
  }

  if (agent.timeout_seconds) {
    lines.push('');
    lines.push(`timeout_seconds: ${agent.timeout_seconds}`);
  }

  if (agent.max_tokens) {
    lines.push(`max_tokens: ${agent.max_tokens}`);
  }

  return lines.join('\n');
}
