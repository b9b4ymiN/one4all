/**
 * Unit tests for ClaudeAdapter
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ClaudeAdapter } from '../claude-adapter';
import type { AdapterConfig } from '../../types/adapter.types';

// Mock the Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn(),
    },
  })),
}));

describe('ClaudeAdapter', () => {
  describe('Constructor', () => {
    it('should initialize with API key from config', () => {
      const adapter = new ClaudeAdapter({
        apiKey: 'test-key',
      });

      expect(adapter.getName()).toContain('ClaudeAdapter');
      expect(adapter.getModel()).toBe('claude-3-5-sonnet-20241022');
    });

    it('should initialize with API key from environment', () => {
      const originalKey = process.env.ANTHROPIC_API_KEY;
      process.env.ANTHROPIC_API_KEY = 'env-key';

      const adapter = new ClaudeAdapter();

      expect(adapter.getName()).toContain('ClaudeAdapter');

      process.env.ANTHROPIC_API_KEY = originalKey;
    });

    it('should throw error when no API key provided', () => {
      const originalKey = process.env.ANTHROPIC_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;

      expect(() => new ClaudeAdapter()).toThrow('Claude API key is required');

      process.env.ANTHROPIC_API_KEY = originalKey;
    });

    it('should use custom model when provided', () => {
      const adapter = new ClaudeAdapter({
        apiKey: 'test-key',
        model: 'claude-3-opus-20240229',
      });

      expect(adapter.getModel()).toBe('claude-3-opus-20240229');
    });

    it('should use default model when none provided', () => {
      const adapter = new ClaudeAdapter({
        apiKey: 'test-key',
      });

      expect(adapter.getModel()).toBe('claude-3-5-sonnet-20241022');
    });
  });

  describe('Token estimation', () => {
    let adapter: ClaudeAdapter;

    beforeEach(() => {
      adapter = new ClaudeAdapter({ apiKey: 'test-key' });
    });

    it('should estimate tokens for text', () => {
      const text = 'Hello world'; // 11 chars
      const tokens = adapter.estimateTokens(text);

      // Claude: ~3.5 chars per token
      expect(tokens).toBe(Math.ceil(11 / 3.5));
    });

    it('should handle empty string', () => {
      expect(adapter.estimateTokens('')).toBe(0);
    });

    it('should estimate more tokens for longer text', () => {
      const short = 'Hi';
      const long = 'a'.repeat(350);

      expect(adapter.estimateTokens(long)).toBeGreaterThan(adapter.estimateTokens(short));
    });
  });

  describe('Cost estimation', () => {
    let adapter: ClaudeAdapter;

    beforeEach(() => {
      adapter = new ClaudeAdapter({ apiKey: 'test-key' });
    });

    it('should estimate cost for Claude 3.5 Sonnet', () => {
      // Claude 3.5 Sonnet: $3/1M input, $15/1M output
      const cost = adapter.estimateCost(100000, 50000);

      // (100000/1000000) * 3 + (50000/1000000) * 15
      const expected = 0.3 + 0.75;
      expect(cost).toBeCloseTo(expected, 4);
    });

    it('should estimate cost for Claude 3 Opus', () => {
      adapter = new ClaudeAdapter({
        apiKey: 'test-key',
        model: 'claude-3-opus-20240229',
      });

      // Claude 3 Opus: $15/1M input, $75/1M output
      const cost = adapter.estimateCost(100000, 50000);

      // (100000/1000000) * 15 + (50000/1000000) * 75
      const expected = 1.5 + 3.75;
      expect(cost).toBeCloseTo(expected, 4);
    });

    it('should return 0 for zero tokens', () => {
      expect(adapter.estimateCost(0, 0)).toBe(0);
    });

    it('should handle unknown model with default pricing', () => {
      adapter = new ClaudeAdapter({
        apiKey: 'test-key',
        model: 'unknown-model',
      });

      // Should use default (Sonnet) pricing
      const cost = adapter.estimateCost(1000, 500);
      expect(cost).toBeGreaterThan(0);
    });
  });

  describe('Model management', () => {
    let adapter: ClaudeAdapter;

    beforeEach(() => {
      adapter = new ClaudeAdapter({ apiKey: 'test-key' });
    });

    it('should get current model', () => {
      expect(adapter.getModel()).toBe('claude-3-5-sonnet-20241022');
    });

    it('should set new model', () => {
      adapter.setModel('claude-3-opus-20240229');
      expect(adapter.getModel()).toBe('claude-3-opus-20240229');
    });

    it('should get client for advanced usage', () => {
      const client = adapter.getClient();
      expect(client).toBeDefined();
    });
  });

  describe('getName', () => {
    it('should include model name in adapter name', () => {
      const adapter = new ClaudeAdapter({
        apiKey: 'test-key',
        model: 'claude-3-opus-20240229',
      });

      expect(adapter.getName()).toBe('ClaudeAdapter(claude-3-opus-20240229)');
    });
  });
});
