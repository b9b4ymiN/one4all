/**
 * CLI Adapters Index
 *
 * Exports all CLI-based adapters and provides factory functions.
 */

import type { Adapter } from '../types/adapter.types';
import { GeminiCLIAdapter, type GeminiCLIAdapterConfig } from './gemini-cli-adapter.js';
import { CodexCLIAdapter, type CodexCLIAdapterConfig } from './codex-cli-adapter.js';
import { ClaudeCLIAdapter, type ClaudeCLIAdapterConfig } from './claude-cli-adapter.js';

export type CLIAdapterType = 'gemini-cli' | 'codex-cli' | 'claude-cli';

export interface CLIAdapterConfig {
  'gemini-cli'?: GeminiCLIAdapterConfig;
  'codex-cli'?: CodexCLIAdapterConfig;
  'claude-cli'?: ClaudeCLIAdapterConfig;
}

/**
 * Create a CLI adapter based on type
 */
export function createCLIAdapter(
  type: CLIAdapterType,
  config?: CLIAdapterConfig[CLIAdapterType]
): Adapter {
  switch (type) {
    case 'gemini-cli':
      return new GeminiCLIAdapter(config as GeminiCLIAdapterConfig);
    case 'codex-cli':
      return new CodexCLIAdapter(config as CodexCLIAdapterConfig);
    case 'claude-cli':
      return new ClaudeCLIAdapter(config as ClaudeCLIAdapterConfig);
    default:
      throw new Error(`Unknown CLI adapter type: ${type}`);
  }
}

/**
 * Create all available CLI adapters
 */
export function createAllCLIAdapters(config?: CLIAdapterConfig): Record<CLIAdapterType, Adapter> {
  return {
    'gemini-cli': new GeminiCLIAdapter(config?.['gemini-cli']),
    'codex-cli': new CodexCLIAdapter(config?.['codex-cli']),
    'claude-cli': new ClaudeCLIAdapter(config?.['claude-cli']),
  };
}

// Re-export adapters and types
export { GeminiCLIAdapter };
export { CodexCLIAdapter };
export { ClaudeCLIAdapter };
export type { GeminiCLIAdapterConfig };
export type { CodexCLIAdapterConfig };
export type { ClaudeCLIAdapterConfig };
