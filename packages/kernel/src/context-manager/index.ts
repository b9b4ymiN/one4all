/**
 * @one4all/kernel - Context Manager
 *
 * Manages context budgets, compression, and distribution across agents
 */

export { ContextManager } from './manager';
export { BudgetTracker } from './budget-tracker';
export { CompressionStrategy } from './compression';

export type {
  ContextBudget,
  AgentContextAllocation,
  ContextManagerConfig,
  CompressionResult,
} from './types';
