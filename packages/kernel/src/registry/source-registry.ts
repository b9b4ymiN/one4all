/**
 * Source Registry Loader
 *
 * Loads source configurations from registry/sources/*.yaml
 */

import { z } from 'zod';
import { BaseLoader, createSchemaValidator } from './base-loader.js';
import type { SourceConfig, SourceRegistry, RegistryLoadResult, RegistryOptions } from './types.js';

// Zod schema for SourceConfig
const SourceConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  tier: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  type: z.enum(['filing', 'report', 'api', 'news', 'website', 'database']),
  url_pattern: z.string().optional(),
  auth_required: z.boolean(),
  update_frequency: z.enum(['realtime', 'daily', 'weekly', 'quarterly', 'annual']).optional(),
  parser: z.string().optional(),
  config: z.record(z.unknown()).optional(),
});

/**
 * Source Registry Loader
 */
export class SourceRegistryLoader extends BaseLoader<SourceRegistry> {
  private cache?: SourceRegistry;

  constructor(basePath: string, options: RegistryOptions = {}) {
    super(basePath, options);
  }

  protected validateSchema(data: unknown): data is SourceRegistry {
    // Source registry is a collection, validate individual sources
    if (typeof data !== 'object' || data === null) return false;
    if (!('sources' in data)) return false;

    const sources = (data as { sources: unknown }).sources;
    if (typeof sources !== 'object' || sources === null) return false;

    for (const value of Object.values(sources)) {
      const result = SourceConfigSchema.safeParse(value);
      if (!result.success) return false;
    }

    return true;
  }

  /**
   * Load all source configurations from registry/sources/
   */
  async load(refresh = false): Promise<RegistryLoadResult<SourceRegistry>> {
    if (this.cache && !refresh && !this.options.hot_reload) {
      return this.createResult(this.cache, []);
    }

    const errors: Array<{ file: string; message: string }> = [];
    const sources: Record<string, SourceConfig> = {};

    try {
      const files = await this.findYamlFiles('registry/sources');

      for (const file of files) {
        try {
          const data = await this.loadYamlFile(file);
          const result = SourceConfigSchema.safeParse(data);

          if (result.success) {
            sources[result.data.id] = result.data;
          } else {
            const error = `Invalid source schema: ${result.error.errors.map((e) => e.message).join(', ')}`;
            this.handleError(file, new Error(error));
            errors.push({ file, message: error });
          }
        } catch (err) {
          const message = err instanceof Error ? err : new Error(String(err));
          this.handleError(file, message);
          errors.push({ file, message: message.message });
        }
      }

      this.cache = { sources };
      return this.createResult(this.cache, errors);
    } catch (err) {
      const message = err instanceof Error ? err : new Error(String(err));
      this.handleError('registry/sources', message);
      errors.push({ file: 'registry/sources', message: message.message });
      return this.createResult(undefined, errors);
    }
  }

  /**
   * Get a specific source by ID
   */
  async getSource(sourceId: string): Promise<SourceConfig | undefined> {
    const result = await this.load();
    return result.data?.sources[sourceId];
  }

  /**
   * Get all sources for a specific tier
   */
  async getSourcesByTier(tier: 1 | 2 | 3 | 4 | 5): Promise<SourceConfig[]> {
    const result = await this.load();
    if (!result.data) return [];

    return Object.values(result.data.sources).filter((s) => s.tier === tier);
  }

  /**
   * Get all sources for a specific type
   */
  async getSourcesByType(type: SourceConfig['type']): Promise<SourceConfig[]> {
    const result = await this.load();
    if (!result.data) return [];

    return Object.values(result.data.sources).filter((s) => s.type === type);
  }
}
