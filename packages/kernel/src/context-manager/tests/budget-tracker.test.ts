/**
 * Unit tests for BudgetTracker
 */

import { describe, it, expect } from 'vitest';
import { BudgetTracker } from '../budget-tracker';
import type { ContextBudget } from '../types';

describe('BudgetTracker', () => {
  const mockBudgets: ContextBudget[] = [
    {
      model: 'claude-3-opus',
      adapterType: 'claude',
      maxTokens: 200000,
      reservedTokens: 4000,
      get availableTokens() {
        return this.maxTokens - this.reservedTokens;
      },
      costPerMillionTokens: { input: 15, output: 75 },
    },
    {
      model: 'gemini-pro',
      adapterType: 'gemini',
      maxTokens: 1000000,
      reservedTokens: 4000,
      get availableTokens() {
        return this.maxTokens - this.reservedTokens;
      },
      costPerMillionTokens: { input: 0.5, output: 1.5 },
    },
  ];

  describe('Budget tracking', () => {
    it('should initialize with given budgets', () => {
      const tracker = new BudgetTracker(mockBudgets);
      const claudeBudget = tracker.getBudget('claude-3-opus');

      expect(claudeBudget?.availableTokens).toBe(196000);
    });

    it('should estimate cost correctly', () => {
      const tracker = new BudgetTracker(mockBudgets);

      // Claude Opus: $15/1M input, $75/1M output
      const claudeCost = tracker.estimateCost('claude-3-opus', 1000, 500);
      expect(claudeCost).toBeCloseTo(0.0525, 4); // (1000/1M)*15 + (500/1M)*75

      // Gemini Pro: $0.50/1M input, $1.50/1M output
      const geminiCost = tracker.estimateCost('gemini-pro', 1000, 500);
      expect(geminiCost).toBeCloseTo(0.00125, 4); // (1000/1M)*0.5 + (500/1M)*1.5
    });

    it('should check if adding tokens would exceed budget', () => {
      const tracker = new BudgetTracker(mockBudgets);

      expect(tracker.wouldExceedBudget('claude-3-opus', 200000, 50000)).toBe(true);
      expect(tracker.wouldExceedBudget('claude-3-opus', 50000, 50000)).toBe(false);
    });

    it('should get remaining tokens', () => {
      const tracker = new BudgetTracker(mockBudgets);

      expect(tracker.getRemainingTokens('claude-3-opus')).toBe(196000);

      // Create an allocation
      tracker.createAllocation('agent-1', 'analyst', 'claude-3-opus', 100000, 50000);

      // After allocation, remaining should be full budget (no usage yet)
      expect(tracker.getRemainingTokens('claude-3-opus')).toBe(196000);

      // Record usage
      tracker.updateUsage('agent-1', 50000, 10000);

      // Remaining should decrease
      expect(tracker.getRemainingTokens('claude-3-opus')).toBe(136000);
    });

    it('should calculate utilization percentage', () => {
      const tracker = new BudgetTracker(mockBudgets);

      tracker.createAllocation('agent-1', 'analyst', 'claude-3-opus', 100000, 50000);
      tracker.updateUsage('agent-1', 50000, 10000);

      // (50000 + 10000) / 196000 * 100
      const util = tracker.getUtilization('claude-3-opus');
      expect(util).toBeCloseTo(30.61, 1);
    });
  });

  describe('Agent allocations', () => {
    it('should create allocation for agent', () => {
      const tracker = new BudgetTracker(mockBudgets);

      const allocation = tracker.createAllocation(
        'agent-1',
        'analyst',
        'claude-3-opus',
        100000,
        50000
      );

      expect(allocation.agentName).toBe('agent-1');
      expect(allocation.agentType).toBe('analyst');
      expect(allocation.model).toBe('claude-3-opus');
      expect(allocation.maxInputTokens).toBe(100000);
      expect(allocation.maxOutputTokens).toBe(50000);
    });

    it('should limit allocation to available budget', () => {
      const tracker = new BudgetTracker(mockBudgets);

      // Try to allocate more than available
      const allocation = tracker.createAllocation(
        'agent-1',
        'analyst',
        'claude-3-opus',
        300000, // More than 196000 available
        50000
      );

      expect(allocation.maxInputTokens).toBeLessThanOrEqual(196000);
    });

    it('should update agent usage', () => {
      const tracker = new BudgetTracker(mockBudgets);

      tracker.createAllocation('agent-1', 'analyst', 'claude-3-opus', 100000, 50000);
      tracker.updateUsage('agent-1', 5000, 2000);

      const allocation = tracker.getAllocation('agent-1');
      expect(allocation?.currentUsage.input).toBe(5000);
      expect(allocation?.currentUsage.output).toBe(2000);
    });

    it('should reset agent usage', () => {
      const tracker = new BudgetTracker(mockBudgets);

      tracker.createAllocation('agent-1', 'analyst', 'claude-3-opus', 100000, 50000);
      tracker.updateUsage('agent-1', 5000, 2000);
      tracker.resetUsage('agent-1');

      const allocation = tracker.getAllocation('agent-1');
      expect(allocation?.currentUsage.input).toBe(0);
      expect(allocation?.currentUsage.output).toBe(0);
    });

    it('should remove agent allocation', () => {
      const tracker = new BudgetTracker(mockBudgets);

      tracker.createAllocation('agent-1', 'analyst', 'claude-3-opus', 100000, 50000);
      expect(tracker.getAllocation('agent-1')).toBeDefined();

      tracker.removeAllocation('agent-1');
      expect(tracker.getAllocation('agent-1')).toBeUndefined();
    });
  });

  describe('Edge cases', () => {
    it('should handle unknown model gracefully', () => {
      const tracker = new BudgetTracker(mockBudgets);

      expect(tracker.getBudget('unknown-model')).toBeUndefined();
      expect(tracker.getRemainingTokens('unknown-model')).toBe(Number.MAX_SAFE_INTEGER);
      expect(tracker.estimateCost('unknown-model', 1000, 500)).toBe(0);
      expect(tracker.wouldExceedBudget('unknown-model', 1000000, 1000000)).toBe(false);
    });

    it('should reset all allocations', () => {
      const tracker = new BudgetTracker(mockBudgets);

      tracker.createAllocation('agent-1', 'analyst', 'claude-3-opus', 100000, 50000);
      tracker.createAllocation('agent-2', 'researcher', 'gemini-pro', 200000, 50000);
      tracker.updateUsage('agent-1', 5000, 2000);
      tracker.updateUsage('agent-2', 10000, 3000);

      tracker.resetAll();

      expect(tracker.getAllocation('agent-1')).toBeUndefined();
      expect(tracker.getAllocation('agent-2')).toBeUndefined();
    });
  });
});
