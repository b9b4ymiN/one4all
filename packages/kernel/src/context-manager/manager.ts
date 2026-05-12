/**
 * Context Manager - Main class for managing context across the system
 *
 * Responsibilities:
 * - Track context budgets per model
 * - Allocate context to agents
 * - Compress context when needed
 * - Handle budget exceeded scenarios
 */

import { BudgetTracker } from './budget-tracker';
import { CompressionStrategy } from './compression';
import type {
  ContextManagerConfig,
  ContextItem,
  AgentContextAllocation,
  CompressionResult,
} from './types';
import type { AdapterType } from '@one4all/adapters';

// Default context budgets for common models
const DEFAULT_BUDGETS: ContextManagerConfig['budgets'] = [
  {
    model: 'claude-3-opus-20240229',
    adapterType: 'claude',
    maxTokens: 200000,
    reservedTokens: 4000,
    get availableTokens() {
      return this.maxTokens - this.reservedTokens;
    },
    costPerMillionTokens: { input: 15, output: 75 },
  },
  {
    model: 'claude-3-sonnet-20240229',
    adapterType: 'claude',
    maxTokens: 200000,
    reservedTokens: 4000,
    get availableTokens() {
      return this.maxTokens - this.reservedTokens;
    },
    costPerMillionTokens: { input: 3, output: 15 },
  },
  {
    model: 'gemini-1.5-pro',
    adapterType: 'gemini',
    maxTokens: 1000000,
    reservedTokens: 4000,
    get availableTokens() {
      return this.maxTokens - this.reservedTokens;
    },
    costPerMillionTokens: { input: 0.5, output: 1.5 },
  },
  {
    model: 'gemini-1.5-flash',
    adapterType: 'gemini',
    maxTokens: 1000000,
    reservedTokens: 4000,
    get availableTokens() {
      return this.maxTokens - this.reservedTokens;
    },
    costPerMillionTokens: { input: 0.075, output: 0.3 },
  },
  {
    model: 'gpt-4',
    adapterType: 'zai',
    maxTokens: 128000,
    reservedTokens: 4000,
    get availableTokens() {
      return this.maxTokens - this.reservedTokens;
    },
    costPerMillionTokens: { input: 30, output: 60 },
  },
  {
    model: 'codex-v1',
    adapterType: 'codex',
    maxTokens: 16000,
    reservedTokens: 2000,
    get availableTokens() {
      return this.maxTokens - this.reservedTokens;
    },
    costPerMillionTokens: { input: 10, output: 20 },
  },
];

export class ContextManager {
  private budgetTracker: BudgetTracker;
  private compression: CompressionStrategy;
  private config: ContextManagerConfig;

  constructor(config?: Partial<ContextManagerConfig>) {
    this.config = {
      budgets: config?.budgets ?? DEFAULT_BUDGETS,
      defaultBudget: config?.defaultBudget ?? DEFAULT_BUDGETS[0],
      compressionThreshold: config?.compressionThreshold ?? 0.8,
      prioritizeRecent: config?.prioritizeRecent ?? true,
      reserveSystemTokens: config?.reserveSystemTokens ?? 4000,
    };

    this.budgetTracker = new BudgetTracker(this.config.budgets);
    this.compression = new CompressionStrategy();
  }

  /**
   * Create a context allocation for an agent
   */
  allocateContext(
    agentName: string,
    agentType: AgentContextAllocation['agentType'],
    model: string
  ): AgentContextAllocation {
    const budget = this.budgetTracker.getBudget(model);

    if (!budget) {
      // Use default budget for unknown models
      return this.budgetTracker.createAllocation(
        agentName,
        agentType,
        model,
        this.config.defaultBudget.availableTokens,
        this.config.defaultBudget.availableTokens / 2
      );
    }

    // Agent-specific allocation based on type
    const inputRatio = this.getInputRatio(agentType);
    const maxInputTokens = Math.floor(budget.availableTokens * inputRatio);
    const maxOutputTokens = Math.floor(budget.availableTokens * (1 - inputRatio));

    return this.budgetTracker.createAllocation(
      agentName,
      agentType,
      model,
      maxInputTokens,
      maxOutputTokens
    );
  }

  /**
   * Get input token ratio for agent type
   */
  private getInputRatio(agentType: AgentContextAllocation['agentType']): number {
    switch (agentType) {
      case 'researcher':
        return 0.9; // Researchers need more input (evidence)
      case 'analyst':
        return 0.7; // Analysts need balanced input/output
      case 'synthesizer':
        return 0.6; // Synthesizers produce more output
      case 'validator':
        return 0.8; // Validators need more input to check
      default:
        return 0.7;
    }
  }

  /**
   * Prepare context for an agent, compressing if needed
   */
  prepareContext(
    agentName: string,
    items: ContextItem[],
    systemPrompt: string
  ): { context: string; compressionResult?: CompressionResult } {
    const allocation = this.budgetTracker.getAllocation(agentName);

    if (!allocation) {
      // No allocation yet, estimate from model
      const estimatedTokens = this.compression.estimateTokens(
        systemPrompt + items.map(i => i.content).join('\n')
      );
      return {
        context: systemPrompt + '\n\n' + this.formatItems(items),
      };
    }

    // Calculate available budget after system prompt
    const systemTokens = this.compression.estimateTokens(systemPrompt);
    const availableTokens = allocation.maxInputTokens - systemTokens;

    // Check if compression is needed
    const totalTokens = items.reduce((sum, item) => sum + item.tokens, 0);

    if (totalTokens > availableTokens * this.config.compressionThreshold) {
      // Compress context
      const result = this.compression.compress(items, availableTokens, {
        prioritizeRecent: this.config.prioritizeRecent,
      });

      return {
        context: systemPrompt + '\n\n' + result.content,
        compressionResult: result,
      };
    }

    return {
      context: systemPrompt + '\n\n' + this.formatItems(items),
    };
  }

  /**
   * Record actual token usage after an API call
   */
  recordUsage(agentName: string, inputTokens: number, outputTokens: number): void {
    this.budgetTracker.updateUsage(agentName, inputTokens, outputTokens);
  }

  /**
   * Check if adding context would exceed budget
   */
  checkBudget(agentName: string, additionalTokens: number): boolean {
    const allocation = this.budgetTracker.getAllocation(agentName);
    if (!allocation) {
      return true; // No allocation, assume OK
    }

    const currentTotal =
      allocation.currentUsage.input + allocation.currentUsage.output;
    return currentTotal + additionalTokens <= allocation.maxInputTokens;
  }

  /**
   * Get remaining tokens for an agent
   */
  getRemainingTokens(agentName: string): number {
    const allocation = this.budgetTracker.getAllocation(agentName);
    if (!allocation) {
      return Number.MAX_SAFE_INTEGER;
    }

    const used = allocation.currentUsage.input + allocation.currentUsage.output;
    return allocation.maxInputTokens - used;
  }

  /**
   * Get budget info for a model
   */
  getModelBudget(model: string) {
    return this.budgetTracker.getBudget(model);
  }

  /**
   * Get all model budgets
   */
  getAllBudgets() {
    return this.budgetTracker.getAllBudgets();
  }

  /**
   * Estimate cost for an operation
   */
  estimateCost(model: string, inputTokens: number, outputTokens: number): number {
    return this.budgetTracker.estimateCost(model, inputTokens, outputTokens);
  }

  /**
   * Get utilization percentage for a model
   */
  getUtilization(model: string): number {
    return this.budgetTracker.getUtilization(model);
  }

  /**
   * Reset an agent's usage
   */
  resetAgentUsage(agentName: string): void {
    this.budgetTracker.resetUsage(agentName);
  }

  /**
   * Reset all usage
   */
  resetAllUsage(): void {
    this.budgetTracker.resetAll();
  }

  /**
   * Create a context item
   */
  createContextItem(
    id: string,
    content: string,
    type: ContextItem['type'],
    priority = 5
  ): ContextItem {
    return {
      id,
      content,
      tokens: this.compression.estimateTokens(content),
      priority,
      timestamp: Date.now(),
      type,
    };
  }

  /**
   * Format context items into a string
   */
  private formatItems(items: ContextItem[]): string {
    return items
      .map(item => `[${item.type} (priority: ${item.priority})]\n${item.content}`)
      .join('\n\n---\n\n');
  }

  /**
   * Remove an agent allocation
   */
  removeAgent(agentName: string): void {
    this.budgetTracker.removeAllocation(agentName);
  }

  /**
   * Handle budget exceeded scenario
   */
  handleBudgetExceeded(agentName: string): {
    action: 'compress' | 'abort' | 'warn';
    message: string;
  } {
    const allocation = this.budgetTracker.getAllocation(agentName);

    if (!allocation) {
      return {
        action: 'warn',
        message: `Agent ${agentName} has no context allocation`,
      };
    }

    const utilization = this.getUtilization(allocation.model);

    if (utilization >= 100) {
      return {
        action: 'abort',
        message: `Context budget exceeded for ${agentName} (${utilization.toFixed(1)}%)`,
      };
    }

    if (utilization >= this.config.compressionThreshold * 100) {
      return {
        action: 'compress',
        message: `Context budget at ${utilization.toFixed(1)}% for ${agentName}, compression recommended`,
      };
    }

    return {
      action: 'warn',
      message: `Context budget at ${utilization.toFixed(1)}% for ${agentName}`,
    };
  }
}
