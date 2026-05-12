/**
 * Registry Manager
 *
 * Unified interface for loading and accessing all registries
 */

import * as path from 'node:path';
import type { RegistryOptions } from './types.js';
import { ModelRegistryLoader } from './model-registry.js';
import { SourceRegistryLoader } from './source-registry.js';
import { DomainRegistryLoader } from './domain-registry.js';
import { AgentRegistryLoader } from './agent-registry.js';
import { SkillRegistryLoader } from './skill-registry.js';

/**
 * Registry Manager - Unified access to all registries
 */
export class RegistryManager {
  public readonly models: ModelRegistryLoader;
  public readonly sources: SourceRegistryLoader;
  public readonly domains: DomainRegistryLoader;
  public readonly agents: AgentRegistryLoader;
  public readonly skills: SkillRegistryLoader;

  constructor(
    basePath: string,
    options: RegistryOptions = {}
  ) {
    this.models = new ModelRegistryLoader(basePath, options);
    this.sources = new SourceRegistryLoader(basePath, options);
    this.domains = new DomainRegistryLoader(basePath, options);
    this.agents = new AgentRegistryLoader(basePath, options);
    this.skills = new SkillRegistryLoader(basePath, options);
  }

  /**
   * Load all registries
   */
  async loadAll(refresh = false): Promise<void> {
    await Promise.all([
      this.models.load(refresh),
      this.sources.load(refresh),
      this.domains.load(refresh),
      this.agents.load(refresh),
      this.skills.load(refresh),
    ]);
  }

  /**
   * Get the base path being used
   */
  getBasePath(): string {
    return (this.models as unknown as { basePath: string }).basePath;
  }

  /**
   * Create a registry manager for a specific base path
   */
  static create(basePath: string = process.cwd(), options?: RegistryOptions): RegistryManager {
    return new RegistryManager(basePath, options);
  }

  /**
   * Create a registry manager relative to the project root
   */
  static async fromProjectRoot(options?: RegistryOptions): Promise<RegistryManager> {
    // Find project root by looking for pnpm-workspace.yaml
    let currentPath = process.cwd();
    const fs = await import('node:fs/promises');

    while (currentPath !== path.parse(currentPath).root) {
      const workspaceFile = path.join(currentPath, 'pnpm-workspace.yaml');
      try {
        await fs.access(workspaceFile);
        return new RegistryManager(currentPath, options);
      } catch {
        currentPath = path.dirname(currentPath);
      }
    }

    // Fallback to current directory
    return new RegistryManager(process.cwd(), options);
  }

  /**
   * Get agent with its skills
   */
  async getAgentWithSkills(agentId: string) {
    const agent = await this.agents.getAgent(agentId);
    if (!agent) return undefined;

    const skills = await Promise.all(
      agent.skills.map((skillId) => this.skills.getSkill(skillId))
    );

    return {
      ...agent,
      skill_details: skills.filter(Boolean),
    };
  }

  /**
   * Get domain with all its agents
   */
  async getDomainWithAgents(domainId: string) {
    const domain = await this.domains.getDomain(domainId);
    if (!domain) return undefined;

    const agents = await this.agents.getAgentsByDomain(domainId);

    return {
      ...domain,
      agents,
    };
  }

  /**
   * Validate that all required registries load successfully
   */
  async validate(): Promise<{
    valid: boolean;
    errors: Array<{ registry: string; errors: Array<{ file: string; message: string }> }>;
  }> {
    const results = await Promise.all([
      this.models.load(),
      this.sources.load(),
      this.domains.load(),
      this.agents.load(),
      this.skills.load(),
    ]);

    const errors: Array<{ registry: string; errors: Array<{ file: string; message: string }> }> = [];

    if (results[0].errors.length > 0) {
      errors.push({ registry: 'models', errors: results[0].errors });
    }
    if (results[1].errors.length > 0) {
      errors.push({ registry: 'sources', errors: results[1].errors });
    }
    if (results[2].errors.length > 0) {
      errors.push({ registry: 'domains', errors: results[2].errors });
    }
    if (results[3].errors.length > 0) {
      errors.push({ registry: 'agents', errors: results[3].errors });
    }
    if (results[4].errors.length > 0) {
      errors.push({ registry: 'skills', errors: results[4].errors });
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    // Force reload on next load
    (this.models as unknown as { cache?: unknown }).cache = undefined;
    (this.sources as unknown as { cache?: unknown }).cache = undefined;
    (this.domains as unknown as { cache?: unknown }).cache = undefined;
    (this.agents as unknown as { cache?: unknown }).cache = undefined;
    (this.skills as unknown as { cache?: unknown }).cache = undefined;
  }

  /**
   * Enable hot-reload mode
   */
  enableHotReload(): void {
    (this.models as unknown as { options: { hot_reload: boolean } }).options.hot_reload = true;
    (this.sources as unknown as { options: { hot_reload: boolean } }).options.hot_reload = true;
    (this.domains as unknown as { options: { hot_reload: boolean } }).options.hot_reload = true;
    (this.agents as unknown as { options: { hot_reload: boolean } }).options.hot_reload = true;
    (this.skills as unknown as { options: { hot_reload: boolean } }).options.hot_reload = true;
  }

  /**
   * Disable hot-reload mode
   */
  disableHotReload(): void {
    (this.models as unknown as { options: { hot_reload: boolean } }).options.hot_reload = false;
    (this.sources as unknown as { options: { hot_reload: boolean } }).options.hot_reload = false;
    (this.domains as unknown as { options: { hot_reload: boolean } }).options.hot_reload = false;
    (this.agents as unknown as { options: { hot_reload: boolean } }).options.hot_reload = false;
    (this.skills as unknown as { options: { hot_reload: boolean } }).options.hot_reload = false;
  }
}

/**
 * Default registry manager instance
 * Lazily initialized
 */
let defaultManager: RegistryManager | undefined;

/**
 * Get or create the default registry manager
 */
export async function getRegistryManager(
  options?: RegistryOptions
): Promise<RegistryManager> {
  if (!defaultManager) {
    defaultManager = await RegistryManager.fromProjectRoot(options);
  }
  return defaultManager;
}
