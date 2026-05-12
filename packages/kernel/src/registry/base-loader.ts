/**
 * Base Registry Loader
 *
 * Provides common functionality for all registry loaders
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as yaml from 'js-yaml';
import { z } from 'zod';
import type { RegistryLoadResult, RegistryOptions } from './types.js';

export abstract class BaseLoader<T> {
  protected options: Required<RegistryOptions>;

  constructor(
    protected basePath: string,
    options: RegistryOptions = {}
  ) {
    this.options = {
      hot_reload: options.hot_reload ?? false,
      validate_schemas: options.validate_schemas ?? true,
      on_error: options.on_error ?? 'log',
    };
  }

  /**
   * Abstract method to validate loaded data
   */
  protected abstract validateSchema(data: unknown): data is T;

  /**
   * Load and parse a YAML file
   */
  protected async loadYamlFile(filePath: string): Promise<unknown> {
    const fullPath = path.resolve(this.basePath, filePath);
    const content = await fs.readFile(fullPath, 'utf-8');
    return yaml.load(content);
  }

  /**
   * Check if a file exists
   */
  protected async fileExists(filePath: string): Promise<boolean> {
    try {
      const fullPath = path.resolve(this.basePath, filePath);
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Find all YAML files in a directory (non-recursive)
   */
  protected async findYamlFiles(dirPath: string): Promise<string[]> {
    const fullPath = path.resolve(this.basePath, dirPath);
    const entries = await fs.readdir(fullPath, { withFileTypes: true });

    return entries
      .filter((entry) => entry.isFile() && (entry.name.endsWith('.yaml') || entry.name.endsWith('.yml')))
      .map((entry) => path.join(dirPath, entry.name));
  }

  /**
   * Find all YAML files recursively in subdirectories
   */
  protected async findYamlFilesRecursive(dirPath: string): Promise<string[]> {
    const results: string[] = [];
    const fullPath = path.resolve(this.basePath, dirPath);
    const entries = await fs.readdir(fullPath, { withFileTypes: true });

    for (const entry of entries) {
      const relativePath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        results.push(...await this.findYamlFilesRecursive(relativePath));
      } else if (entry.isFile() && (entry.name.endsWith('.yaml') || entry.name.endsWith('.yml'))) {
        results.push(relativePath);
      }
    }

    return results;
  }

  /**
   * Handle errors based on options
   */
  protected handleError(file: string, message: Error): void {
    const error = {
      file,
      message: message.message,
    };

    switch (this.options.on_error) {
      case 'throw':
        throw new Error(`Failed to load ${file}: ${message.message}`);
      case 'log':
        console.warn(`[Registry Loader] Error loading ${file}: ${message.message}`);
        break;
      case 'ignore':
        // Silent
        break;
    }
  }

  /**
   * Create a load result
   */
  protected createResult(
    data: T | undefined,
    errors: Array<{ file: string; message: string }>
  ): RegistryLoadResult<T> {
    return {
      success: errors.length === 0,
      data,
      errors,
    };
  }
}

/**
 * Zod schema validator helper
 */
export function createSchemaValidator<T extends z.ZodType>(schema: T) {
  return function (data: unknown): data is z.infer<T> {
    try {
      schema.parse(data);
      return true;
    } catch {
      return false;
    }
  };
}
