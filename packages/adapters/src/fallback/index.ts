/**
 * Fallback Manager Module
 *
 * Exports fallback manager functionality for handling adapter failures
 */

export {
  FallbackManager,
  createFallbackManager,
} from './fallback-manager';

export type {
  AdapterError,
  AdapterErrorType,
  AdapterHealth,
  FallbackChain,
  FallbackConfig,
  FallbackResult,
} from './fallback-manager';
