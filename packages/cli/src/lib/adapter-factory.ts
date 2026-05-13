/**
 * Unified Adapter Factory
 *
 * Creates adapters based on type (CLI or API)
 * Supports: gemini-cli, claude-cli, zai-api
 */

import type { Adapter, AdapterConfig } from '@one4all/adapters';
import { createCLIAdapter, ZAIAdapter, type ZAIAdapterConfig } from '@one4all/adapters';

export type UnifiedAdapterType = 'gemini-cli' | 'claude-cli' | 'zai-api';

/**
 * Create an adapter based on type
 * - CLI adapters: gemini-cli, claude-cli (no API key needed)
 * - API adapters: zai-api (uses ZAI_API_KEY from .env)
 */
export function createUnifiedAdapter(
  type: UnifiedAdapterType,
  config?: AdapterConfig
): Adapter {
  switch (type) {
    case 'gemini-cli':
    case 'claude-cli':
      return createCLIAdapter(type, config);

    case 'zai-api':
      // ZAIAdapter implements Adapter interface directly
      return new ZAIAdapter(config as ZAIAdapterConfig);

    default:
      throw new Error(`Unknown adapter type: ${type}`);
  }
}
