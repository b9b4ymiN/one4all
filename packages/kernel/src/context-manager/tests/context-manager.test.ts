/**
 * Unit tests for ContextManager
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ContextManager } from '../manager';
import type { ContextItem } from '../types';

describe('ContextManager', () => {
  let manager: ContextManager;

  beforeEach(() => {
    manager = new ContextManager();
  });

  describe('Context allocation', () => {
    it('should allocate context with appropriate ratios for different agent types', () => {
      const researcher = manager.allocateContext('researcher-1', 'researcher', 'claude-3-opus-20240229');
      const analyst = manager.allocateContext('analyst-1', 'analyst', 'claude-3-opus-20240229');
      const synthesizer = manager.allocateContext('synthesizer-1', 'synthesizer', 'claude-3-opus-20240229');

      // Researchers need more input (90%)
      expect(researcher.maxInputTokens / (researcher.maxInputTokens + researcher.maxOutputTokens))
        .toBeGreaterThan(0.85);

      // Synthesizers produce more output (40% input, 60% output)
      expect(synthesizer.maxInputTokens / (synthesizer.maxInputTokens + synthesizer.maxOutputTokens))
        .toBeLessThan(0.65);

      // Analysts are balanced
      const analystRatio = analyst.maxInputTokens / (analyst.maxInputTokens + analyst.maxOutputTokens);
      expect(analystRatio).toBeGreaterThan(0.6);
      expect(analystRatio).toBeLessThan(0.8);
    });

    it('should use default budget for unknown models', () => {
      const allocation = manager.allocateContext('agent-1', 'analyst', 'unknown-model');

      expect(allocation).toBeDefined();
      expect(allocation.model).toBe('unknown-model');
    });

    it('should respect model context limits', () => {
      const geminiAllocation = manager.allocateContext('agent-1', 'researcher', 'gemini-1.5-pro');
      const claudeAllocation = manager.allocateContext('agent-2', 'researcher', 'claude-3-opus-20240229');

      // Gemini has 1M tokens vs Claude's 200K
      expect(geminiAllocation.maxInputTokens).toBeGreaterThan(claudeAllocation.maxInputTokens);
    });
  });

  describe('Context preparation', () => {
    it('should prepare context without compression when under limit', () => {
      manager.allocateContext('agent-1', 'analyst', 'claude-3-opus-20240229');

      const items: ContextItem[] = [
        manager.createContextItem('1', 'Short content', 'evidence', 5),
        manager.createContextItem('2', 'Another short content', 'analysis', 5),
      ];

      const result = manager.prepareContext('agent-1', items, 'System prompt');

      expect(result.context).toContain('System prompt');
      expect(result.context).toContain('Short content');
      expect(result.compressionResult).toBeUndefined();
    });

    it('should compress context when approaching limit', () => {
      manager.allocateContext('agent-1', 'analyst', 'claude-3-opus-20240229');

      // Create many items to exceed budget
      const items: ContextItem[] = [];
      for (let i = 0; i < 1000; i++) {
        items.push(
          manager.createContextItem(
            `${i}`,
            `Long content item ${i} with lots of text to consume tokens `.repeat(10),
            'evidence',
            i < 10 ? 9 : 3 // First 10 are high priority
          )
        );
      }

      const result = manager.prepareContext('agent-1', items, 'System prompt');

      expect(result.compressionResult).toBeDefined();
      expect(result.compressionResult!.compressionRatio).toBeLessThan(1);
      expect(result.compressionResult!.strategy).toMatch(/priority/);
    });

    it('should preserve high priority items during compression', () => {
      manager.allocateContext('agent-1', 'analyst', 'claude-3-opus-20240229');

      const items: ContextItem[] = [
        manager.createContextItem('high-1', 'CRITICAL FACT: Revenue $100M', 'evidence', 10),
        manager.createContextItem('low-1', 'Low priority note', 'system', 1),
        manager.createContextItem('high-2', 'CRITICAL FACT: EBITDA 25%', 'evidence', 10),
        manager.createContextItem('low-2', 'Another low priority', 'analysis', 2),
      ];

      // Add many low priority items to force compression
      for (let i = 0; i < 1000; i++) {
        items.push(
          manager.createContextItem(
            `low-${i + 3}`,
            `Filler content ${i}`.repeat(100),
            'analysis',
            1
          )
        );
      }

      const result = manager.prepareContext('agent-1', items, 'System prompt');

      // High priority items should be in the compressed result
      expect(result.context).toContain('CRITICAL FACT: Revenue $100M');
      expect(result.context).toContain('CRITICAL FACT: EBITDA 25%');
    });
  });

  describe('Usage tracking', () => {
    it('should record token usage', () => {
      manager.allocateContext('agent-1', 'analyst', 'claude-3-opus-20240229');

      manager.recordUsage('agent-1', 5000, 2000);

      const allocation = manager['budgetTracker'].getAllocation('agent-1');
      expect(allocation?.currentUsage.input).toBe(5000);
      expect(allocation?.currentUsage.output).toBe(2000);
    });

    it('should track remaining tokens', () => {
      manager.allocateContext('agent-1', 'analyst', 'claude-3-opus-20240229');

      const initialRemaining = manager.getRemainingTokens('agent-1');
      manager.recordUsage('agent-1', 50000, 10000);

      const afterUsage = manager.getRemainingTokens('agent-1');
      expect(afterUsage).toBe(initialRemaining - 60000);
    });

    it('should reset agent usage', () => {
      manager.allocateContext('agent-1', 'analyst', 'claude-3-opus-20240229');
      manager.recordUsage('agent-1', 5000, 2000);

      manager.resetAgentUsage('agent-1');

      const remaining = manager.getRemainingTokens('agent-1');
      const allocation = manager['budgetTracker'].getAllocation('agent-1');
      expect(allocation?.currentUsage.input).toBe(0);
      expect(remaining).toBeGreaterThan(0);
    });
  });

  describe('Budget checking', () => {
    it('should check if content fits in budget', () => {
      manager.allocateContext('agent-1', 'analyst', 'claude-3-opus-20240229');

      expect(manager.checkBudget('agent-1', 1000)).toBe(true);

      // Use most of the budget
      manager.recordUsage('agent-1', 150000, 30000);

      expect(manager.checkBudget('agent-1', 50000)).toBe(false);
    });

    it('should handle budget exceeded scenarios', () => {
      manager.allocateContext('agent-1', 'analyst', 'claude-3-opus-20240229');

      // Use budget to just under compression threshold
      manager.recordUsage('agent-1', 140000, 20000);

      const result = manager['handleBudgetExceeded']('agent-1');

      expect(result.action).toBe('compress');
      expect(result.message).toContain('compression recommended');
    });

    it('should abort when completely over budget', () => {
      manager.allocateContext('agent-1', 'analyst', 'claude-3-opus-20240229');
      manager.recordUsage('agent-1', 200000, 50000); // Way over

      const result = manager['handleBudgetExceeded']('agent-1');

      expect(result.action).toBe('abort');
      expect(result.message).toContain('exceeded');
    });
  });

  describe('Cost estimation', () => {
    it('should estimate cost for different models', () => {
      const claudeCost = manager.estimateCost('claude-3-opus-20240229', 100000, 50000);
      const geminiCost = manager.estimateCost('gemini-1.5-pro', 100000, 50000);

      // Claude is more expensive than Gemini
      expect(claudeCost).toBeGreaterThan(geminiCost);

      // Claude Opus: ~$5.25 for 100K input, 50K output
      expect(claudeCost).toBeCloseTo(5.25, 1);
    });
  });

  describe('Context item creation', () => {
    it('should create context items with proper metadata', () => {
      const item = manager.createContextItem('test-1', 'Test content', 'evidence', 7);

      expect(item.id).toBe('test-1');
      expect(item.content).toBe('Test content');
      expect(item.type).toBe('evidence');
      expect(item.priority).toBe(7);
      expect(item.tokens).toBeGreaterThan(0);
      expect(item.timestamp).toBeDefined();
    });

    it('should estimate tokens for created items', () => {
      const shortItem = manager.createContextItem('1', 'Hi', 'evidence', 5);
      const longItem = manager.createContextItem('2', 'a'.repeat(1000), 'evidence', 5);

      expect(longItem.tokens).toBeGreaterThan(shortItem.tokens);
    });
  });

  describe('Agent management', () => {
    it('should remove agent allocations', () => {
      manager.allocateContext('agent-1', 'analyst', 'claude-3-opus-20240229');
      expect(manager['budgetTracker'].getAllocation('agent-1')).toBeDefined();

      manager.removeAgent('agent-1');
      expect(manager['budgetTracker'].getAllocation('agent-1')).toBeUndefined();
    });

    it('should reset all usage', () => {
      manager.allocateContext('agent-1', 'analyst', 'claude-3-opus-20240229');
      manager.allocateContext('agent-2', 'researcher', 'gemini-1.5-pro');
      manager.recordUsage('agent-1', 5000, 2000);
      manager.recordUsage('agent-2', 10000, 3000);

      manager.resetAllUsage();

      expect(manager.getRemainingTokens('agent-1')).toBeGreaterThan(150000);
      expect(manager.getRemainingTokens('agent-2')).toBeGreaterThan(900000);
    });
  });

  describe('Model budgets', () => {
    it('should provide budget information for models', () => {
      const claudeBudget = manager.getModelBudget('claude-3-opus-20240229');

      expect(claudeBudget).toBeDefined();
      expect(claudeBudget?.maxTokens).toBe(200000);
      expect(claudeBudget?.costPerMillionTokens.input).toBe(15);
    });

    it('should return all budgets', () => {
      const budgets = manager.getAllBudgets();

      expect(budgets.length).toBeGreaterThan(0);
      expect(budgets.find(b => b.model === 'claude-3-opus-20240229')).toBeDefined();
      expect(budgets.find(b => b.model === 'gemini-1.5-pro')).toBeDefined();
    });

    it('should return undefined for unknown model', () => {
      const budget = manager.getModelBudget('unknown-model');
      expect(budget).toBeUndefined();
    });
  });
});
