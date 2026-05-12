/**
 * @one4all/adapters
 *
 * AI backend adapters for Claude, Gemini, Codex, ZAI, Python, and Human
 */

// Mock Adapters (for testing without real LLM calls)
export {
  BaseMockAdapter,
  MockClaudeAdapter,
  MockGeminiAdapter,
  MockZAIAdapter,
  MockCodexAdapter,
  MockPythonQuantAdapter,
  MockHumanAdapter,
} from './mock';

export type { HumanGateConfig } from './mock/human-mock.adapter';

// Fallback Manager
export {
  FallbackManager,
  createFallbackManager,
} from './fallback';

export type {
  AdapterError,
  AdapterErrorType,
  AdapterHealth,
  FallbackChain,
  FallbackConfig,
  FallbackResult,
} from './fallback/fallback-manager';

// Real Adapters
export { ClaudeAdapter } from './claude';
export { ZAIAdapter } from './zai';
export { GeminiAdapter } from './gemini';

// CLI Adapters
export {
  GeminiCLIAdapter,
  CodexCLIAdapter,
  ClaudeCLIAdapter,
  createCLIAdapter,
  createAllCLIAdapters,
} from './cli-adapters';

export type { ClaudeAdapterConfig, ClaudeMessage, ClaudeOptions } from './claude/claude-adapter';
export type { ZAIAdapterConfig, ZAIMessage, ZAIOptions } from './zai/zai-adapter';
export type { GeminiAdapterConfig, GeminiMessage, GeminiOptions } from './gemini/gemini-adapter';
export type { GeminiCLIAdapterConfig } from './cli-adapters/gemini-cli-adapter';
export type { CodexCLIAdapterConfig } from './cli-adapters/codex-cli-adapter';
export type { ClaudeCLIAdapterConfig } from './cli-adapters/claude-cli-adapter';
export type { CLIAdapterType, CLIAdapterConfig } from './cli-adapters';

export type {
  Adapter,
  AdapterConfig,
  AgentResult,
  HealthStatus,
  AdapterType,
} from './types/adapter.types';
