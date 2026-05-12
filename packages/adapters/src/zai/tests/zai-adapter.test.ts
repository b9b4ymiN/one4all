/**
 * Unit tests for ZAIAdapter
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ZAIAdapter } from '../zai-adapter';
import type { AdapterConfig } from '../../types/adapter.types';

// Mock the OpenAI SDK
vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: vi.fn(),
      },
    },
  })),
}));

describe('ZAIAdapter', () => {
  describe('Constructor', () => {
    it('should initialize with API key from config', () => {
      const adapter = new ZAIAdapter({
        apiKey: 'test-key',
      });

      expect(adapter.getName()).toContain('ZAIAdapter');
      expect(adapter.getModel()).toBe('gpt-4-turbo');
      expect(adapter.getBaseURL()).toBe('https://api.openai.com/v1');
    });

    it('should initialize with API key from environment', () => {
      const originalKey = process.env.OPENAI_API_KEY;
      process.env.OPENAI_API_KEY = 'env-key';

      const adapter = new ZAIAdapter();

      expect(adapter.getName()).toContain('ZAIAdapter');

      process.env.OPENAI_API_KEY = originalKey;
    });

    it('should throw error when no API key provided', () => {
      const originalKey = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;

      expect(() => new ZAIAdapter()).toThrow('ZAI API key is required');

      process.env.OPENAI_API_KEY = originalKey;
    });

    it('should use custom model when provided', () => {
      const adapter = new ZAIAdapter({
        apiKey: 'test-key',
        model: 'gpt-3.5-turbo',
      });

      expect(adapter.getModel()).toBe('gpt-3.5-turbo');
    });

    it('should use custom baseURL when provided', () => {
      const adapter = new ZAIAdapter({
        apiKey: 'test-key',
        baseURL: 'https://api.groq.com/openai/v1',
      });

      expect(adapter.getBaseURL()).toBe('https://api.groq.com/openai/v1');
    });

    it('should include provider name in adapter name', () => {
      const openAIAdapter = new ZAIAdapter({
        apiKey: 'test-key',
        baseURL: 'https://api.openai.com/v1',
      });
      expect(openAIAdapter.getName()).toContain('OpenAI');

      const groqAdapter = new ZAIAdapter({
        apiKey: 'test-key',
        baseURL: 'https://api.groq.com/openai/v1',
      });
      expect(groqAdapter.getName()).toContain('Groq');
    });
  });

  describe('Token estimation', () => {
    let adapter: ZAIAdapter;

    beforeEach(() => {
      adapter = new ZAIAdapter({ apiKey: 'test-key' });
    });

    it('should estimate tokens for text', () => {
      const text = 'Hello world'; // 11 chars
      const tokens = adapter.estimateTokens(text);

      // OpenAI: ~4 chars per token
      expect(tokens).toBe(Math.ceil(11 / 4));
    });

    it('should handle empty string', () => {
      expect(adapter.estimateTokens('')).toBe(0);
    });

    it('should estimate more tokens for longer text', () => {
      const short = 'Hi';
      const long = 'a'.repeat(400);

      expect(adapter.estimateTokens(long)).toBeGreaterThan(adapter.estimateTokens(short));
    });
  });

  describe('Cost estimation', () => {
    let adapter: ZAIAdapter;

    beforeEach(() => {
      adapter = new ZAIAdapter({ apiKey: 'test-key' });
    });

    it('should estimate cost for GPT-4 Turbo', () => {
      // GPT-4 Turbo: $10/1M input, $30/1M output
      const cost = adapter.estimateCost(100000, 50000);

      // (100000/1000000) * 10 + (50000/1000000) * 30
      const expected = 1.0 + 1.5;
      expect(cost).toBeCloseTo(expected, 4);
    });

    it('should estimate cost for GPT-3.5 Turbo', () => {
      adapter = new ZAIAdapter({
        apiKey: 'test-key',
        model: 'gpt-3.5-turbo',
      });

      // GPT-3.5 Turbo: $0.50/1M input, $1.50/1M output
      const cost = adapter.estimateCost(100000, 50000);

      // (100000/1000000) * 0.5 + (50000/1000000) * 1.5
      const expected = 0.05 + 0.075;
      expect(cost).toBeCloseTo(expected, 4);
    });

    it('should return 0 for zero tokens', () => {
      expect(adapter.estimateCost(0, 0)).toBe(0);
    });

    it('should handle unknown model with default pricing', () => {
      adapter = new ZAIAdapter({
        apiKey: 'test-key',
        model: 'unknown-model',
      });

      // Should use default (GPT-4 Turbo) pricing
      const cost = adapter.estimateCost(1000, 500);
      expect(cost).toBeGreaterThan(0);
    });
  });

  describe('Model and URL management', () => {
    let adapter: ZAIAdapter;

    beforeEach(() => {
      adapter = new ZAIAdapter({ apiKey: 'test-key' });
    });

    it('should get current model', () => {
      expect(adapter.getModel()).toBe('gpt-4-turbo');
    });

    it('should set new model', () => {
      adapter.setModel('gpt-3.5-turbo');
      expect(adapter.getModel()).toBe('gpt-3.5-turbo');
    });

    it('should get current base URL', () => {
      expect(adapter.getBaseURL()).toBe('https://api.openai.com/v1');
    });

    it('should set new base URL', () => {
      adapter.setBaseURL('https://api.groq.com/openai/v1');
      expect(adapter.getBaseURL()).toBe('https://api.groq.com/openai/v1');
    });

    it('should get client for advanced usage', () => {
      const client = adapter.getClient();
      expect(client).toBeDefined();
    });
  });

  describe('Provider detection', () => {
    it('should detect OpenAI from default URL', () => {
      const adapter = new ZAIAdapter({ apiKey: 'test-key' });
      expect(adapter.getName()).toContain('OpenAI');
    });

    it('should detect Groq', () => {
      const adapter = new ZAIAdapter({
        apiKey: 'test-key',
        baseURL: 'https://api.groq.com/openai/v1',
      });
      expect(adapter.getName()).toContain('Groq');
    });

    it('should detect Together', () => {
      const adapter = new ZAIAdapter({
        apiKey: 'test-key',
        baseURL: 'https://api.together.xyz/v1',
      });
      expect(adapter.getName()).toContain('Together');
    });

    it('should detect DeepInfra', () => {
      const adapter = new ZAIAdapter({
        apiKey: 'test-key',
        baseURL: 'https://api.deepinfra.com/v1/openai',
      });
      expect(adapter.getName()).toContain('DeepInfra');
    });

    it('should show Custom for unknown providers', () => {
      const adapter = new ZAIAdapter({
        apiKey: 'test-key',
        baseURL: 'https://custom.example.com/v1',
      });
      expect(adapter.getName()).toContain('Custom');
    });
  });
});
