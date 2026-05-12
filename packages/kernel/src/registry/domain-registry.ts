/**
 * Domain Registry Loader
 */

import * as path from 'node:path';
import { z } from 'zod';
import { BaseLoader } from './base-loader.js';
import type { DomainConfig, RegistryLoadResult, RegistryOptions } from './types.js';

const DomainConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string(),
  description: z.string(),
  constitution: z.object({ rules_file: z.string() }),
  default_team: z.object({
    researcher: z.string().optional(),
    analysts: z.array(z.string()).optional(),
    synthesizer: z.string().optional(),
    always_include: z.array(z.string()).optional(),
  }),
  mission_types: z.array(z.object({
    id: z.string(),
    template: z.string(),
    default_agents: z.array(z.string()),
  })),
  markets: z.array(z.string()),
  output: z.object({
    mandatory_report_sections: z.array(z.string()),
    mandatory_fields: z.array(z.string()),
    forbidden_content: z.array(z.string()),
  }),
  human_checkpoints: z.object({
    after_research: z.enum(['always', 'conditional', 'never']),
    after_synthesis: z.enum(['always', 'conditional', 'never']),
    on_low_evidence: z.enum(['always', 'conditional', 'never']),
  }),
  journal: z.object({ required: z.boolean(), template: z.string().optional() }),
  evidence: z.object({
    minimum_sources: z.array(z.object({ tier: z.string(), count: z.number() })),
    required_documents: z.array(z.string()),
  }),
  context_budget: z.object({ default_limit: z.number(), compression_threshold: z.number() }),
});

export class DomainRegistryLoader extends BaseLoader<Record<string, DomainConfig>> {
  private cache?: Record<string, DomainConfig>;

  constructor(basePath: string, options: RegistryOptions = {}) {
    super(basePath, options);
  }

  protected validateSchema(data: unknown): data is Record<string, DomainConfig> {
    // We're validating the full registry, not individual domains
    // Individual validation happens during load
    return typeof data === 'object' && data !== null;
  }

  async load(refresh = false): Promise<RegistryLoadResult<Record<string, DomainConfig>>> {
    if (this.cache && !refresh && !this.options.hot_reload) {
      return this.createResult(this.cache, []);
    }

    const errors: Array<{ file: string; message: string }> = [];
    const domains: Record<string, DomainConfig> = {};

    try {
      const entries = await this.findDomainDirectories();

      for (const entry of entries) {
        const domainFile = path.join(entry, 'domain.yaml');

        if (!(await this.fileExists(domainFile))) {
          errors.push({ file: domainFile, message: 'domain.yaml not found' });
          continue;
        }

        try {
          const data = await this.loadYamlFile(domainFile);
          const result = DomainConfigSchema.safeParse(data);

          if (result.success) {
            domains[result.data.id] = result.data;
          } else {
            const error = 'Invalid domain schema';
            this.handleError(domainFile, new Error(error));
            errors.push({ file: domainFile, message: error });
          }
        } catch (err) {
          const message = err instanceof Error ? err : new Error(String(err));
          this.handleError(domainFile, message);
          errors.push({ file: domainFile, message: message.message });
        }
      }

      this.cache = domains;
      return this.createResult(this.cache, errors);
    } catch (err) {
      const message = err instanceof Error ? err : new Error(String(err));
      this.handleError('domains', message);
      errors.push({ file: 'domains', message: message.message });
      return this.createResult(undefined, errors);
    }
  }

  private async findDomainDirectories(): Promise<string[]> {
    const domainsPath = path.resolve(this.basePath, 'domains');
    const fs = await import('node:fs/promises');
    const entries = await fs.readdir(domainsPath, { withFileTypes: true });

    return entries
      .filter((e) => e.isDirectory() && !e.name.startsWith('_'))
      .map((e) => path.join('domains', e.name));
  }

  async getDomain(domainId: string): Promise<DomainConfig | undefined> {
    const result = await this.load();
    return result.data?.[domainId];
  }

  async getDomainIds(): Promise<string[]> {
    const result = await this.load();
    return Object.keys(result.data ?? {});
  }

  async getConstitutionPath(domainId: string): Promise<string | undefined> {
    const domain = await this.getDomain(domainId);
    if (!domain) return undefined;
    return path.join('domains', domainId, domain.constitution.rules_file);
  }

  async loadConstitution(domainId: string): Promise<unknown | undefined> {
    const constitutionPath = await this.getConstitutionPath(domainId);
    if (!constitutionPath || !(await this.fileExists(constitutionPath))) {
      return undefined;
    }
    return this.loadYamlFile(constitutionPath);
  }
}
