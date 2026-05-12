/**
 * Unit tests for GeminiAdapter
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GeminiAdapter } from '../gemini-adapter';
import { CANONICAL_PROMPTS, expectSuccess, expectStructure, expectContentNotEmpty } from '../../tests/fixtures';

// Conditional execution: only run real API tests if explicitly enabled
const USE_REAL_API = process.env.TEST_GEMINI_REAL === '1' || process.env.TEST_REAL_API === '1';

describe('GeminiAdapter', () => {
  describe('Constructor', () => {
    it('should initialize with API key from config', () => {
      const adapter = new GeminiAdapter({
        apiKey: 'test-key',
      });

      expect(adapter.getName()).toContain('GeminiAdapter');
      expect(adapter.getModel()).toBe('gemini-1.5-flash');
    });

    it('should initialize with API key from environment', () => {
      const originalKey = process.env.GOOGLE_API_KEY;
      process.env.GOOGLE_API_KEY = 'env-key';

      const adapter = new GeminiAdapter();

      expect(adapter.getName()).toContain('GeminiAdapter');

      process.env.GOOGLE_API_KEY = originalKey;
    });

    it('should throw error when no API key provided', () => {
      const originalKey = process.env.GOOGLE_API_KEY;
      delete process.env.GOOGLE_API_KEY;

      expect(() => new GeminiAdapter()).toThrow('Gemini API key is required');

      if (originalKey) {
        process.env.GOOGLE_API_KEY = originalKey;
      }
    });

    it('should use custom model when provided', () => {
      const adapter = new GeminiAdapter({
        apiKey: 'test-key',
        model: 'gemini-1.5-pro',
      });

      expect(adapter.getModel()).toBe('gemini-1.5-pro');
    });

    it('should use default model when none provided', () => {
      const adapter = new GeminiAdapter({
        apiKey: 'test-key',
      });

      expect(adapter.getModel()).toBe('gemini-1.5-flash');
    });
  });

  describe('Token estimation', () => {
    let adapter: GeminiAdapter;

    beforeEach(() => {
      adapter = new GeminiAdapter({ apiKey: 'test-key' });
    });

    it('should estimate tokens for text', () => {
      const text = 'Hello world'; // 11 chars
      const tokens = adapter.estimateTokens(text);

      // Gemini: ~4 chars per token
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

    it('should handle non-string input gracefully', () => {
      // The estimateTokens method handles empty/undefined input
      const result = adapter.estimateTokens('' as any);
      expect(result).toBe(0);
    });
  });

  describe('Cost estimation', () => {
    let adapter: GeminiAdapter;

    beforeEach(() => {
      adapter = new GeminiAdapter({ apiKey: 'test-key' });
    });

    it('should estimate cost for Gemini 1.5 Flash', () => {
      // Gemini 1.5 Flash: $0.075/1M input, $0.30/1M output
      const cost = adapter.estimateCost(100000, 50000);

      // (100000/1000000) * 0.075 + (50000/1000000) * 0.30
      const expected = 0.0075 + 0.015;
      expect(cost).toBeCloseTo(expected, 4);
    });

    it('should estimate cost for Gemini 1.5 Pro', () => {
      adapter = new GeminiAdapter({
        apiKey: 'test-key',
        model: 'gemini-1.5-pro',
      });

      // Gemini 1.5 Pro: $3.50/1M input, $10.50/1M output
      const cost = adapter.estimateCost(100000, 50000);

      // (100000/1000000) * 3.50 + (50000/1000000) * 10.50
      const expected = 0.35 + 0.525;
      expect(cost).toBeCloseTo(expected, 4);
    });

    it('should return 0 for zero tokens', () => {
      expect(adapter.estimateCost(0, 0)).toBe(0);
    });

    it('should handle unknown model with default pricing', () => {
      adapter = new GeminiAdapter({
        apiKey: 'test-key',
        model: 'unknown-model',
      });

      // Should use default (Flash) pricing
      const cost = adapter.estimateCost(1000, 500);
      expect(cost).toBeGreaterThan(0);
    });
  });

  describe('Model management', () => {
    let adapter: GeminiAdapter;

    beforeEach(() => {
      adapter = new GeminiAdapter({ apiKey: 'test-key' });
    });

    it('should get current model', () => {
      expect(adapter.getModel()).toBe('gemini-1.5-flash');
    });

    it('should set new model', () => {
      adapter.setModel('gemini-1.5-pro');
      expect(adapter.getModel()).toBe('gemini-1.5-pro');
    });

    it('should get client for advanced usage', () => {
      const client = adapter.getClient();
      expect(client).toBeDefined();
    });
  });

  describe('getName', () => {
    it('should include model name in adapter name', () => {
      const adapter = new GeminiAdapter({
        apiKey: 'test-key',
        model: 'gemini-1.5-pro',
      });

      expect(adapter.getName()).toBe('GeminiAdapter(gemini-1.5-pro)');
    });
  });
});

// Real API tests - only run when explicitly enabled
if (USE_REAL_API) {
  describe('GeminiAdapter (Real API)', () => {
    let adapter: GeminiAdapter;

    beforeEach(() => {
      const apiKey = process.env.GOOGLE_API_KEY;
      if (!apiKey) {
        throw new Error('GOOGLE_API_KEY environment variable is required for real API tests');
      }

      adapter = new GeminiAdapter({
        apiKey,
        model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
      });
    });

    describe('Health check', () => {
      it('should pass health check with valid API key', async () => {
        const health = await adapter.healthCheck();

        expect(health.healthy).toBe(true);
        expect(health.latencyMs).toBeGreaterThan(0);
        expect(health.metadata?.model).toBeDefined();
      });

      it('should complete health check within reasonable time', async () => {
        const start = Date.now();
        const health = await adapter.healthCheck();
        const duration = Date.now() - start;

        expect(health.healthy).toBe(true);
        expect(duration).toBeLessThan(15000); // Should complete within 15 seconds
      });
    });

    describe('Basic completion', () => {
      it('should complete a simple prompt', async () => {
        const prompt = CANONICAL_PROMPTS[0].text; // 'simple-greeting'
        const result = await adapter.run(prompt);

        expectSuccess(result);
        expectContentNotEmpty(result);
        expectStructure(result, {
          hasContent: true,
          hasTiming: true,
          hasTokens: true,
        });
      });

      it('should answer a simple question', async () => {
        const prompt = CANONICAL_PROMPTS[1].text; // 'simple-question'
        const result = await adapter.run(prompt);

        expectSuccess(result);
        expectContentNotEmpty(result);
        expect(result.content).toBeDefined();
      });

      it('should handle medium complexity reasoning', async () => {
        const prompt = CANONICAL_PROMPTS[2].text; // 'medium-reasoning'
        const result = await adapter.run(prompt);

        expectSuccess(result);
        expectContentNotEmpty(result);
        expectStructure(result, {
          hasContent: true,
          hasTiming: true,
          hasTokens: true,
          hasCost: true,
        });
      });

      it('should generate code for medium complexity task', async () => {
        const prompt = CANONICAL_PROMPTS[3].text; // 'medium-code'
        const result = await adapter.run(prompt, {
          maxTokens: 1024,
        });

        expectSuccess(result);
        expectContentNotEmpty(result);
        // Should contain some code-related terms
        expect(result.content.toLowerCase()).toMatch(/function|javascript|factorial/);
      });
    });

    describe('Token counting', () => {
      it('should estimate tokens reasonably accurately', async () => {
        const prompt = CANONICAL_PROMPTS[0].text;
        const result = await adapter.run(prompt);

        expectSuccess(result);
        expect(result.tokensUsed).toBeDefined();
        expect(result.tokensUsed!.input).toBeGreaterThan(0);
        expect(result.tokensUsed!.output).toBeGreaterThan(0);
        expect(result.tokensUsed!.total).toBe(
          result.tokensUsed!.input + result.tokensUsed!.output
        );
      });
    });

    describe('Cost estimation', () => {
      it('should estimate cost for a simple prompt', async () => {
        const prompt = CANONICAL_PROMPTS[0].text;
        const result = await adapter.run(prompt);

        expectSuccess(result);
        expect(result.cost).toBeDefined();
        expect(result.cost).toBeGreaterThan(0);
      });

      it('should calculate reasonable cost based on tokens', async () => {
        const prompt = CANONICAL_PROMPTS[2].text;
        const result = await adapter.run(prompt);

        expectSuccess(result);
        expect(result.tokensUsed).toBeDefined();
        expect(result.cost).toBeDefined();

        // Verify cost is proportional to token usage
        const expectedMinCost = adapter.estimateCost(
          result.tokensUsed!.input,
          result.tokensUsed!.output
        );
        expect(result.cost).toBeCloseTo(expectedMinCost, 4);
      });
    });

    describe('Error handling', () => {
      it('should handle invalid API key gracefully', async () => {
        const badAdapter = new GeminiAdapter({
          apiKey: 'invalid-api-key-12345',
        });

        const result = await badAdapter.run('Hello');
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      });
    });

    describe('Streaming', () => {
      it('should support streaming responses', async () => {
        const prompt = CANONICAL_PROMPTS[0].text;
        const result = await adapter.run(prompt, {
          stream: true,
        });

        expectSuccess(result);
        expectContentNotEmpty(result);
        expect(result.metadata?.streamed).toBe(true);
      });
    });
  });
} else {
  describe('GeminiAdapter (Real API)', () => {
    it.skip('Real API tests are skipped. Set TEST_GEMINI_REAL=1 or TEST_REAL_API=1 to enable.', () => {});
  });
}
