/**
 * Agent Registry Loader
 *
 * Loads agent configurations from domains
 */

import * as path from 'node:path';
import { z } from 'zod';
import { BaseLoader } from './base-loader.js';
import type { AgentConfig, AgentRegistry, RegistryLoadResult, RegistryOptions } from './types.js';

// Zod schemas for AgentConfig components
const AgentModelConfigSchema = z.object({
  primary: z.object({
    provider: z.string(),
    model: z.string(),
  }),
  fallback: z.array(
    z.object({
      provider: z.string(),
      model: z.string(),
    })
  ),
});

const AgentIdentitySchema = z.object({
  persona_file: z.string(),
  worldview: z.array(z.string()),
  cognitive_bias_awareness: z.array(z.string()),
});

const AgentInteractionRulesSchema = z.object({
  can_question: z.array(z.string()).optional(),
  must_challenge: z.array(z.string()).optional(),
  cannot_question: z.array(z.string()).optional(),
});

const AgentOutputContractSchema = z.object({
  schema_file: z.string().optional(),
  mandatory_fields: z.array(z.string()),
  forbidden_content: z.array(z.string()),
});

const AgentPerformanceSchema = z.object({
  timeout_seconds: z.number(),
  max_tokens: z.number(),
  context_budget_override: z.number().nullable().optional(),
});

const AgentConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string(),
  domain: z.string(),
  active: z.boolean(),
  role: z.string(),
  description: z.string(),
  model: AgentModelConfigSchema,
  identity: AgentIdentitySchema,
  skills: z.array(z.string()),
  requires: z.array(z.string()),
  interaction_rules: AgentInteractionRulesSchema,
  output_contract: AgentOutputContractSchema,
  performance: AgentPerformanceSchema,
});

/**
 * Agent Registry Loader
 */
export class AgentRegistryLoader extends BaseLoader<AgentRegistry> {
  private cache?: AgentRegistry;

  constructor(
    basePath: string,
    options: RegistryOptions = {}
  ) {
    super(basePath, options);
  }

  protected validateSchema(data: unknown): data is AgentRegistry {
    // Validate registry structure
    if (typeof data !== 'object' || data === null) return false;
    const registry = data as Record<string, unknown>;
    return 'agents' in registry && 'by_domain' in registry;
  }

  /**
   * Load all agent configurations from domain agent directories
   */
  async load(refresh = false): Promise<RegistryLoadResult<AgentRegistry>> {
    if (this.cache && !refresh && !this.options.hot_reload) {
      return this.createResult(this.cache, []);
    }

    const errors: Array<{ file: string; message: string }> = [];
    const agents: Record<string, AgentConfig> = {};
    const byDomain: Record<string, string[]> = {};

    try {
      const domainEntries = await this.findDomainDirectories();

      for (const domainPath of domainEntries) {
        const domainId = path.basename(domainPath);
        const agentsDir = path.join(domainPath, 'agents');

        if (!(await this.directoryExists(agentsDir))) {
          byDomain[domainId] = [];
          continue;
        }

        const agentFiles = await this.findYamlFiles(agentsDir);

        for (const file of agentFiles) {
          try {
            const data = await this.loadYamlFile(file);
            const result = AgentConfigSchema.safeParse(data);

            if (result.success) {
              // Verify domain matches
              if (result.data.domain !== domainId) {
                errors.push({
                  file,
                  message: `Agent domain mismatch: expected ${domainId}, got ${result.data.domain}`,
                });
                continue;
              }

              agents[result.data.id] = result.data;

              if (!byDomain[domainId]) {
                byDomain[domainId] = [];
              }
              byDomain[domainId].push(result.data.id);
            } else {
              const error = `Invalid agent schema: ${result.error.errors.map((e) => e.message).join(', ')}`;
              this.handleError(file, new Error(error));
              errors.push({ file, message: error });
            }
          } catch (err) {
            const message = err instanceof Error ? err : new Error(String(err));
            this.handleError(file, message);
            errors.push({ file, message: message.message });
          }
        }
      }

      this.cache = { agents, by_domain: byDomain };
      return this.createResult(this.cache, errors);
    } catch (err) {
      const message = err instanceof Error ? err : new Error(String(err));
      this.handleError('domains', message);
      errors.push({ file: 'domains', message: message.message });
      return this.createResult(undefined, errors);
    }
  }

  /**
   * Find all domain directories
   */
  private async findDomainDirectories(): Promise<string[]> {
    const domainsPath = path.resolve(this.basePath, 'domains');
    const { default: fs } = await import('node:fs/promises');
    const entries = await fs.readdir(domainsPath, { withFileTypes: true });

    return entries
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_'))
      .map((entry) => path.join('domains', entry.name));
  }

  /**
   * Check if a directory exists
   */
  private async directoryExists(dirPath: string): Promise<boolean> {
    try {
      const fullPath = path.resolve(this.basePath, dirPath);
      const stats = await import('node:fs/promises').then((fs) => fs.stat(fullPath));
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * Get a specific agent by ID
   */
  async getAgent(agentId: string): Promise<AgentConfig | undefined> {
    const result = await this.load();
    return result.data?.agents[agentId];
  }

  /**
   * Get all agents for a domain
   */
  async getAgentsByDomain(domainId: string): Promise<AgentConfig[]> {
    const result = await this.load();
    if (!result.data) return [];

    const data = result.data;
    const agentIds = data.by_domain[domainId] ?? [];
    return agentIds.map((id) => data.agents[id]).filter(Boolean) as AgentConfig[];
  }

  /**
   * Get all active agents
   */
  async getActiveAgents(): Promise<AgentConfig[]> {
    const result = await this.load();
    if (!result.data) return [];

    return Object.values(result.data.agents).filter((a) => a.active);
  }

  /**
   * Get agents by role
   */
  async getAgentsByRole(role: string): Promise<AgentConfig[]> {
    const result = await this.load();
    if (!result.data) return [];

    return Object.values(result.data.agents).filter((a) => a.role === role);
  }

  /**
   * Get primary model for an agent
   */
  async getAgentModel(agentId: string): Promise<AgentConfig['model']['primary'] | undefined> {
    const agent = await this.getAgent(agentId);
    return agent?.model.primary;
  }
}
