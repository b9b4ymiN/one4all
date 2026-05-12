/**
 * Skill Registry Loader
 *
 * Loads skill configurations from domains
 */

import * as path from 'node:path';
import { z } from 'zod';
import { BaseLoader } from './base-loader.js';
import type { SkillConfig, SkillRegistry, RegistryLoadResult, RegistryOptions } from './types.js';

// Zod schemas for SkillConfig components
const SkillInputRequirementsSchema = z.object({
  required: z.array(z.string()),
  preferred: z.array(z.string()).optional(),
});

const SkillConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string(),
  domain: z.string(),
  description: z.string(),
  skill_file: z.string(),
  applicable_to: z.array(z.string()),
  input_requirements: SkillInputRequirementsSchema,
  output_schema: z.record(z.string()),
  rules: z.array(z.string()),
  validation: z.array(z.string()),
});

/**
 * Skill Registry Loader
 */
export class SkillRegistryLoader extends BaseLoader<SkillRegistry> {
  private cache?: SkillRegistry;

  constructor(basePath: string, options: RegistryOptions = {}) {
    super(basePath, options);
  }

  protected validateSchema(data: unknown): data is SkillRegistry {
    if (typeof data !== 'object' || data === null) return false;
    const registry = data as Record<string, unknown>;
    return 'skills' in registry && 'by_domain' in registry && 'by_agent' in registry;
  }

  /**
   * Load all skill configurations from domain skill directories
   */
  async load(refresh = false): Promise<RegistryLoadResult<SkillRegistry>> {
    if (this.cache && !refresh && !this.options.hot_reload) {
      return this.createResult(this.cache, []);
    }

    const errors: Array<{ file: string; message: string }> = [];
    const skills: Record<string, SkillConfig> = {};
    const byDomain: Record<string, string[]> = {};
    const byAgent: Record<string, string[]> = {};

    try {
      const domainEntries = await this.findDomainDirectories();

      for (const domainPath of domainEntries) {
        const domainId = path.basename(domainPath);
        const skillsDir = path.join(domainPath, 'skills');

        if (!(await this.directoryExists(skillsDir))) {
          byDomain[domainId] = [];
          continue;
        }

        const skillFiles = await this.findYamlFiles(skillsDir);

        for (const file of skillFiles) {
          try {
            const data = await this.loadYamlFile(file);
            const result = SkillConfigSchema.safeParse(data);

            if (result.success) {
              // Verify domain matches
              if (result.data.domain !== domainId) {
                errors.push({
                  file,
                  message: `Skill domain mismatch: expected ${domainId}, got ${result.data.domain}`,
                });
                continue;
              }

              skills[result.data.id] = result.data;

              // Index by domain
              if (!byDomain[domainId]) {
                byDomain[domainId] = [];
              }
              byDomain[domainId].push(result.data.id);

              // Index by applicable agents
              for (const agentId of result.data.applicable_to) {
                if (!byAgent[agentId]) {
                  byAgent[agentId] = [];
                }
                byAgent[agentId].push(result.data.id);
              }
            } else {
              const error = `Invalid skill schema: ${result.error.errors.map((e) => e.message).join(', ')}`;
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

      this.cache = { skills, by_domain: byDomain, by_agent: byAgent };
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
   * Get a specific skill by ID
   */
  async getSkill(skillId: string): Promise<SkillConfig | undefined> {
    const result = await this.load();
    return result.data?.skills[skillId];
  }

  /**
   * Get all skills for a domain
   */
  async getSkillsByDomain(domainId: string): Promise<SkillConfig[]> {
    const result = await this.load();
    if (!result.data) return [];

    const data = result.data;
    const skillIds = data.by_domain[domainId] ?? [];
    return skillIds.map((id) => data.skills[id]).filter(Boolean) as SkillConfig[];
  }

  /**
   * Get all skills applicable to an agent
   */
  async getSkillsForAgent(agentId: string): Promise<SkillConfig[]> {
    const result = await this.load();
    if (!result.data) return [];

    const data = result.data;
    const skillIds = data.by_agent[agentId] ?? [];
    return skillIds.map((id) => data.skills[id]).filter(Boolean) as SkillConfig[];
  }

  /**
   * Get skill content file path
   */
  async getSkillContentPath(skillId: string): Promise<string | undefined> {
    const skill = await this.getSkill(skillId);
    if (!skill) return undefined;

    return path.join('domains', skill.domain, skill.skill_file);
  }

  /**
   * Load skill content
   */
  async loadSkillContent(skillId: string): Promise<string | undefined> {
    const contentPath = await this.getSkillContentPath(skillId);
    if (!contentPath || !(await this.fileExists(contentPath))) {
      return undefined;
    }

    const { default: fs } = await import('node:fs/promises');
    const fullPath = path.resolve(this.basePath, contentPath);
    return fs.readFile(fullPath, 'utf-8');
  }
}
