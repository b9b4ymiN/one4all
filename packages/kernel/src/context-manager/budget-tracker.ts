/**
 * Budget Tracker - Tracks context usage per model and agent
 */

import type {
  ContextBudget,
  AgentContextAllocation,
} from './types';

export class BudgetTracker {
  private budgets: Map<string, ContextBudget>;
  private allocations: Map<string, AgentContextAllocation>;

  constructor(initialBudgets: ContextBudget[]) {
    this.budgets = new Map();
    this.allocations = new Map();

    // Initialize budgets
    for (const budget of initialBudgets) {
      this.budgets.set(budget.model, budget);
    }
  }

  /**
   * Get budget for a specific model
   */
  getBudget(model: string): ContextBudget | undefined {
    return this.budgets.get(model);
  }

  /**
   * Get all budgets
   */
  getAllBudgets(): ContextBudget[] {
    return Array.from(this.budgets.values());
  }

  /**
   * Add or update a budget
   */
  setBudget(budget: ContextBudget): void {
    this.budgets.set(budget.model, budget);
  }

  /**
   * Check if adding tokens would exceed budget
   */
  wouldExceedBudget(
    model: string,
    inputTokens: number,
    outputTokens: number
  ): boolean {
    const budget = this.budgets.get(model);
    if (!budget) {
      return false; // No budget set, assume unlimited
    }

    const totalTokens = inputTokens + outputTokens;
    return totalTokens > budget.availableTokens;
  }

  /**
   * Get remaining tokens for a model
   */
  getRemainingTokens(model: string): number {
    const budget = this.budgets.get(model);
    if (!budget) {
      return Number.MAX_SAFE_INTEGER;
    }

    // Calculate current usage from allocations
    const currentUsage = this.getCurrentUsage(model);
    return budget.availableTokens - currentUsage;
  }

  /**
   * Get current token usage for a model
   */
  getCurrentUsage(model: string): number {
    let total = 0;
    for (const allocation of this.allocations.values()) {
      if (allocation.model === model) {
        total += allocation.currentUsage.input + allocation.currentUsage.output;
      }
    }
    return total;
  }

  /**
   * Create a new agent allocation
   */
  createAllocation(
    agentName: string,
    agentType: AgentContextAllocation['agentType'],
    model: string,
    maxInputTokens: number,
    maxOutputTokens: number
  ): AgentContextAllocation {
    const budget = this.budgets.get(model);
    const availableTokens = budget?.availableTokens ?? maxInputTokens + maxOutputTokens;

    // Limit allocation to available budget
    const allocation: AgentContextAllocation = {
      agentName,
      agentType,
      model,
      maxInputTokens: Math.min(maxInputTokens, availableTokens),
      maxOutputTokens: Math.min(maxOutputTokens, availableTokens),
      currentUsage: {
        input: 0,
        output: 0,
      },
    };

    this.allocations.set(agentName, allocation);
    return allocation;
  }

  /**
   * Get allocation for an agent
   */
  getAllocation(agentName: string): AgentContextAllocation | undefined {
    return this.allocations.get(agentName);
  }

  /**
   * Update agent's current usage
   */
  updateUsage(agentName: string, inputTokens: number, outputTokens: number): void {
    const allocation = this.allocations.get(agentName);
    if (allocation) {
      allocation.currentUsage.input += inputTokens;
      allocation.currentUsage.output += outputTokens;
    }
  }

  /**
   * Reset usage for an agent
   */
  resetUsage(agentName: string): void {
    const allocation = this.allocations.get(agentName);
    if (allocation) {
      allocation.currentUsage = { input: 0, output: 0 };
    }
  }

  /**
   * Remove an agent allocation
   */
  removeAllocation(agentName: string): void {
    this.allocations.delete(agentName);
  }

  /**
   * Get all allocations
   */
  getAllAllocations(): AgentContextAllocation[] {
    return Array.from(this.allocations.values());
  }

  /**
   * Calculate estimated cost for an operation
   */
  estimateCost(model: string, inputTokens: number, outputTokens: number): number {
    const budget = this.budgets.get(model);
    if (!budget) {
      return 0;
    }

    const inputCost = (inputTokens / 1_000_000) * budget.costPerMillionTokens.input;
    const outputCost = (outputTokens / 1_000_000) * budget.costPerMillionTokens.output;

    return inputCost + outputCost;
  }

  /**
   * Get utilization percentage for a model
   */
  getUtilization(model: string): number {
    const budget = this.budgets.get(model);
    if (!budget || budget.availableTokens === 0) {
      return 0;
    }

    const usage = this.getCurrentUsage(model);
    return (usage / budget.availableTokens) * 100;
  }

  /**
   * Reset all allocations
   */
  resetAll(): void {
    this.allocations.clear();
  }
}
