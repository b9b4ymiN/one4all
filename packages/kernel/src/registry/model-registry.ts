/**
 * Model Registry Loader
 *
 * Loads model configurations from registry/models.yaml
 */

import * as path from 'node:path';
import { z } from 'zod';
import { BaseLoader, createSchemaValidator } from './base-loader.js';
import type { ModelRegistry, RegistryLoadResult, RegistryOptions } from './types.js';

// Zod schema for ModelConfig
const ModelConfigSchema = z.object({
  id: z.string(),
  provider: z.enum(['claude', 'gemini', 'zai', 'codex', 'human', 'python', 'mock']),
  name: z.string(),
  version: z.string().optional(),
  max_tokens: z.number(),
  supports_streaming: z.boolean(),
  cost_per_1k_input_tokens: z.number().optional(),
  cost_per_1k_output_tokens: z.number().optional(),
  api_type: z.enum(['rest', 'cli', 'subprocess', 'mock']),
  config: z.record(z.unknown()).optional(),
});

// Zod schema for ModelRegistry
const ModelRegistrySchema = z.object({
  models: z.record(ModelConfigSchema),
  defaults: z.object({
    claude: z.string(),
    gemini: z.string(),
    zai: z.string(),
  }),
});

/**
 * Model Registry Loader
 */
export class ModelRegistryLoader extends BaseLoader<ModelRegistry> {
  private cache?: ModelRegistry;

  constructor(basePath: string, options: RegistryOptions = {}) {
    super(basePath, options);
  }

  protected validateSchema = createSchemaValidator(ModelRegistrySchema);

  /**
   * Load the model registry from registry/models.yaml
   */
  async load(refresh = false): Promise<RegistryLoadResult<ModelRegistry>> {
    if (this.cache && !refresh && !this.options.hot_reload) {
      return this.createResult(this.cache, []);
    }

    const errors: Array<{ file: string; message: string }> = [];
    const filePath = 'registry/models.yaml';

    try {
      const data = await this.loadYamlFile(filePath);

      if (!this.validateSchema(data)) {
        const error = 'Invalid model registry schema';
        this.handleError(filePath, new Error(error));
        errors.push({ file: filePath, message: error });
        return this.createResult(undefined, errors);
      }

      this.cache = data;
      return this.createResult(this.cache, []);
    } catch (err) {
      const message = err instanceof Error ? err : new Error(String(err));
      this.handleError(filePath, message);
      errors.push({ file: filePath, message: message.message });
      return this.createResult(undefined, errors);
    }
  }

  /**
   * Get a specific model configuration by ID
   */
  async getModel(modelId: string): Promise<ModelRegistry['models'][string] | undefined> {
    const result = await this.load();
    return result.data?.models[modelId];
  }

  /**
   * Get default model for a provider
   */
  async getDefaultModel(provider: 'claude' | 'gemini' | 'zai'): Promise<string | undefined> {
    const result = await this.load();
    return result.data?.defaults[provider];
  }

  /**
   * Get all models for a provider
   */
  async getModelsByProvider(provider: string): Promise<ModelRegistry['models'][string][]> {
    const result = await this.load();
    if (!result.data) return [];

    return Object.values(result.data.models).filter((m) => m.provider === provider);
  }
}
