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
const AgentRoutingMetadataSchema = z.object({
  expertise: z.array(z.string()),
  when_to_use: z.array(z.string()),
  output_type: z.array(z.string()),
  model_tier: z.enum(['expert', 'non_expert']),
  can_debate_with: z.array(z.string()),
  example_questions: z.array(z.string()),
}).optional();

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
  timeout_seconds: z.number(),
  max_tokens: z.number(),
  context_budget_override: z.number().nullable().optional(),
  routing_metadata: AgentRoutingMetadataSchema,
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

              agents[result.data.id] = result.data as AgentConfig;

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
    const fs = await import('node:fs/promises');
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

  // === Routing Query Methods ===

  /**
   * Find agents by expertise keyword match
   */
  async getAgentsByExpertise(keyword: string): Promise<AgentConfig[]> {
    const result = await this.load();
    if (!result.data) return [];

    const lowerKeyword = keyword.toLowerCase();
    return Object.values(result.data.agents).filter((agent) => {
      if (!agent.routing_metadata?.expertise) return false;
      return agent.routing_metadata.expertise.some((exp) =>
        exp.toLowerCase().includes(lowerKeyword)
      );
    });
  }

  /**
   * Find agents by when_to_use pattern match
   */
  async getAgentsByWhenToUse(pattern: string): Promise<AgentConfig[]> {
    const result = await this.load();
    if (!result.data) return [];

    const lowerPattern = pattern.toLowerCase();
    return Object.values(result.data.agents).filter((agent) => {
      if (!agent.routing_metadata?.when_to_use) return false;
      return agent.routing_metadata.when_to_use.some((trigger) =>
        trigger.toLowerCase().includes(lowerPattern)
      );
    });
  }

  /**
   * Find agents by model tier
   */
  async getAgentsByModelTier(tier: 'expert' | 'non_expert'): Promise<AgentConfig[]> {
    const result = await this.load();
    if (!result.data) return [];

    return Object.values(result.data.agents).filter((agent) =>
      agent.routing_metadata?.model_tier === tier
    );
  }

  /**
   * Get agents that can debate with a given agent
   */
  async getDebatePartners(agentId: string): Promise<AgentConfig[]> {
    const agent = await this.getAgent(agentId);
    if (!agent?.routing_metadata?.can_debate_with) return [];

    const result = await this.load();
    if (!result.data) return [];

    const partnerIds = agent.routing_metadata.can_debate_with;
    return partnerIds
      .map((id) => result.data?.agents[id])
      .filter(Boolean) as AgentConfig[];
  }

  /**
   * Find agents by output type
   */
  async getAgentsByOutputType(outputType: string): Promise<AgentConfig[]> {
    const result = await this.load();
    if (!result.data) return [];

    const lowerOutputType = outputType.toLowerCase();
    return Object.values(result.data.agents).filter((agent) => {
      if (!agent.routing_metadata?.output_type) return false;
      return agent.routing_metadata.output_type.some((type) =>
        type.toLowerCase().includes(lowerOutputType)
      );
    });
  }

  /**
   * Route a question to the best matching agent based on keywords
   * Returns ranked list of agents with match scores
   */
  async routeQuestion(question: string, domain?: string): Promise<Array<{ agent: AgentConfig; score: number }>> {
    const result = await this.load();
    if (!result.data) return [];

    const lowerQuestion = question.toLowerCase();
    const questionWords = lowerQuestion.split(/\s+/).filter(w => w.length > 2);
    const agents = domain
      ? await this.getAgentsByDomain(domain)
      : Object.values(result.data.agents);

    const scored = agents.map((agent) => {
      let score = 0;
      const metadata = agent.routing_metadata;

      if (!metadata) return { agent, score: 0 };

      // Check when_to_use patterns - extract meaningful text after prefixes
      for (const pattern of metadata.when_to_use) {
        const cleanPattern = pattern.toLowerCase()
          .replace(/^when asking:\s*/i, '')
          .replace(/^thai:\s*/i, '')
          .trim();
        // Check for any word overlap
        const patternWords = cleanPattern.split(/\s+/).filter(w => w.length > 2);
        const matchingWords = patternWords.filter(w => lowerQuestion.includes(w));
        if (matchingWords.length > 0) {
          score += matchingWords.length * 3;
        }
        // Bonus for exact match
        if (lowerQuestion.includes(cleanPattern)) {
          score += 10;
        }
      }

      // Check expertise keywords - split by spaces and check each word
      for (const exp of metadata.expertise) {
        const expWords = exp.toLowerCase().split(/\s+/).filter(w => w.length > 2);
        const matchingWords = expWords.filter(w => questionWords.includes(w));
        if (matchingWords.length > 0) {
          score += matchingWords.length * 5;
        }
      }

      // Check example questions for similarity
      for (const example of metadata.example_questions) {
        const exampleLower = example.toLowerCase().replace(/^thai:\s*/i, '').trim();
        const exampleWords = exampleLower.split(/\s+/).filter(w => w.length > 2);
        const commonWords = questionWords.filter((w) => exampleWords.includes(w));
        if (commonWords.length > 1) {
          score += commonWords.length * 2;
        }
      }

      return { agent, score };
    });

    return scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score);
  }

  /**
   * Get expert agents (Opus tier)
   */
  async getExpertAgents(): Promise<AgentConfig[]> {
    return this.getAgentsByModelTier('expert');
  }

  /**
   * Get non-expert agents (Haiku tier)
   */
  async getNonExpertAgents(): Promise<AgentConfig[]> {
    return this.getAgentsByModelTier('non_expert');
  }
}
