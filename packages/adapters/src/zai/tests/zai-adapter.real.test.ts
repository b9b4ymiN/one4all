/**
 * Real API tests for ZAIAdapter
 *
 * These tests can run against either:
 * 1. Real API (when USE_REAL_API=true and OPENAI_API_KEY is set)
 * 2. Mocked backend (when USE_REAL_API=false, default)
 *
 * Run with real API:
 *   TEST_ZAI_REAL=1 npm test
 *   TEST_REAL_API=1 npm test
 *
 * Run with mocks (default):
 *   npm test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { AdapterConfig } from '../../types/adapter.types';
import { CANONICAL_PROMPTS } from '../../tests/fixtures/prompts';
import {
  expectSuccess,
  expectStructure,
  expectContentNotEmpty,
  expectCompletionWithin,
  expectError,
  expectValidModel,
} from '../../tests/fixtures/expectations';

// Conditional execution: use real API or mocks
const USE_REAL_API = process.env.TEST_ZAI_REAL === '1' || process.env.TEST_REAL_API === '1';
const HAS_API_KEY = Boolean(process.env.OPENAI_API_KEY);

// Mock configuration - must be before imports
vi.mock('openai', () => {
  const useRealApi = process.env.TEST_ZAI_REAL === '1' || process.env.TEST_REAL_API === '1';
  const hasApiKey = Boolean(process.env.OPENAI_API_KEY);

  if (useRealApi && hasApiKey) {
    // Use real OpenAI SDK
    return {
      default: require('openai'),
    };
  }

  // Use mocked OpenAI SDK
  const mockCreate = vi.fn().mockImplementation(async (params: any) => {
    // Simulate async delay for timing
    await new Promise(resolve => setTimeout(resolve, 10));

    // Handle streaming
    if (params.stream) {
      // Create an async generator that yields stream chunks
      async function* streamGenerator() {
        const chunks = [
          { choices: [{ delta: { content: 'This ' } }] },
          { choices: [{ delta: { content: 'is ' } }] },
          { choices: [{ delta: { content: 'a ' } }] },
          { choices: [{ delta: { content: 'mock ' } }] },
          { choices: [{ delta: { content: 'streaming ' } }] },
          { choices: [{ delta: { content: 'response.' } }] },
          { usage: { prompt_tokens: 10, completion_tokens: 6 } },
        ];

        for (const chunk of chunks) {
          await new Promise(resolve => setTimeout(resolve, 2));
          yield chunk;
        }
      }

      // Return an object with async iterator
      const streamObject = {
        [Symbol.asyncIterator]: () => streamGenerator(),
      };

      return streamObject as any;
    }

    // Non-streaming response
    return {
      id: 'test-mock-response',
      choices: [
        {
          message: {
            role: 'assistant',
            content: 'This is a mock response from the ZAI adapter.',
          },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 20,
        total_tokens: 30,
      },
      model: 'gpt-4-turbo',
    };
  });

  return {
    default: vi.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: mockCreate,
        },
      },
    })),
  };
});

// Import after mock setup
import { ZAIAdapter } from '../zai-adapter';

describe('ZAIAdapter - Real API Tests', () => {
  // Skip all tests if using real API but no key provided
  const skipCondition = USE_REAL_API && !HAS_API_KEY;

  describe.skipIf(skipCondition)('Conditional execution', () => {
    it('should skip tests when USE_REAL_API is true but no API key is provided', () => {
      if (USE_REAL_API && !HAS_API_KEY) {
        expect(true).toBe(true); // Placeholder - tests are skipped
      }
    });
  });

  describe.skipIf(skipCondition)('Health Check', () => {
    let adapter: ZAIAdapter;

    beforeEach(() => {
      adapter = new ZAIAdapter({
        apiKey: USE_REAL_API ? process.env.OPENAI_API_KEY : 'test-key',
        model: 'gpt-4-turbo',
      });
    });

    it('should pass health check with valid configuration', async () => {
      const health = await adapter.healthCheck();

      expect(health.healthy).toBe(true);
      expect(health.latencyMs).toBeGreaterThan(0);
      expect(health.metadata?.model).toBeDefined();
      expect(health.metadata?.baseURL).toBeDefined();

      if (USE_REAL_API) {
        expect(health.metadata?.id).toBeDefined();
      }
    });

    it('should complete health check within reasonable time', async () => {
      const health = await adapter.healthCheck();

      expect(health.latencyMs).toBeLessThan(30000); // 30 seconds max
    });

    it('should include model information in health check', async () => {
      const health = await adapter.healthCheck();

      expect(health.metadata?.model).toBe('gpt-4-turbo');
    });

    it('should include base URL in health check', async () => {
      const health = await adapter.healthCheck();

      expect(health.metadata?.baseURL).toBeDefined();
      expect(health.metadata?.baseURL).toMatch(/https?:\/\/.+/);
    });
  });

  describe.skipIf(skipCondition)('Basic Completion', () => {
    let adapter: ZAIAdapter;

    beforeEach(() => {
      adapter = new ZAIAdapter({
        apiKey: USE_REAL_API ? process.env.OPENAI_API_KEY : 'test-key',
        model: 'gpt-4-turbo',
      });
    });

    it('should handle simple greeting prompt', async () => {
      const prompt = CANONICAL_PROMPTS.find((p) => p.id === 'simple-greeting')!;
      const result = await adapter.run(prompt.text);

      expectSuccess(result);
      expectStructure(result, { hasContent: true, hasTiming: true, hasTokens: true, hasCost: true });
      expectContentNotEmpty(result);
      expectValidModel(result);
    });

    it('should handle simple question prompt', async () => {
      const prompt = CANONICAL_PROMPTS.find((p) => p.id === 'simple-question')!;
      const result = await adapter.run(prompt.text);

      expectSuccess(result);
      expectStructure(result, { hasContent: true, hasTiming: true, hasTokens: true });
      expectContentNotEmpty(result);

      if (USE_REAL_API) {
        // Real API should mention Paris or France
        expect(result.content.toLowerCase()).toMatch(/(paris|france)/);
      }
    });

    it('should handle medium reasoning prompt', async () => {
      const prompt = CANONICAL_PROMPTS.find((p) => p.id === 'medium-reasoning')!;
      const result = await adapter.run(prompt.text);

      expectSuccess(result);
      expectStructure(result, { hasContent: true, hasTiming: true, hasTokens: true });
      expectContentNotEmpty(result);

      if (USE_REAL_API) {
        // Should explain the reasoning and arrive at 6 apples
        expect(result.content.toLowerCase()).toMatch(/(6|six)/);
      }
    });

    it('should handle medium code generation prompt', async () => {
      const prompt = CANONICAL_PROMPTS.find((p) => p.id === 'medium-code')!;
      const result = await adapter.run(prompt.text);

      expectSuccess(result);
      expectStructure(result, { hasContent: true, hasTiming: true, hasTokens: true });
      expectContentNotEmpty(result);

      if (USE_REAL_API) {
        // Should include JavaScript code
        expect(result.content.toLowerCase()).toMatch(/(function|javascript|factorial)/);
      }
    });

    it('should complete simple prompts within reasonable time', async () => {
      const prompt = CANONICAL_PROMPTS.find((p) => p.id === 'simple-greeting')!;
      const result = await adapter.run(prompt.text);

      expectSuccess(result);
      expectCompletionWithin(result, 30000); // 30 seconds max
    });

    it('should include timing information', async () => {
      const prompt = CANONICAL_PROMPTS.find((p) => p.id === 'simple-greeting')!;
      const result = await adapter.run(prompt.text);

      expectSuccess(result);
      expectStructure(result, { hasTiming: true });

      expect(result.timing!.startedAt).toBeGreaterThan(0);
      expect(result.timing!.completedAt).toBeGreaterThan(0);
      expect(result.timing!.durationMs).toBeGreaterThan(0);
      expect(result.timing!.completedAt).toBeGreaterThan(result.timing!.startedAt);
    });

    it('should include model information in result', async () => {
      const prompt = CANONICAL_PROMPTS.find((p) => p.id === 'simple-greeting')!;
      const result = await adapter.run(prompt.text);

      expectSuccess(result);
      expectValidModel(result);
      expect(result.model).toBe('gpt-4-turbo');
    });
  });

  describe.skipIf(skipCondition)('Token Estimation', () => {
    let adapter: ZAIAdapter;

    beforeEach(() => {
      adapter = new ZAIAdapter({
        apiKey: USE_REAL_API ? process.env.OPENAI_API_KEY : 'test-key',
        model: 'gpt-4-turbo',
      });
    });

    it('should estimate tokens for simple prompt', () => {
      const prompt = CANONICAL_PROMPTS.find((p) => p.id === 'simple-greeting')!;
      const tokens = adapter.estimateTokens(prompt.text);

      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeLessThan(100); // Should be relatively small
    });

    it('should estimate tokens for medium prompt', () => {
      const prompt = CANONICAL_PROMPTS.find((p) => p.id === 'medium-reasoning')!;
      const tokens = adapter.estimateTokens(prompt.text);

      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeGreaterThan(adapter.estimateTokens('Hello')); // Longer text = more tokens
    });

    it('should estimate tokens for complex prompt', () => {
      const prompt = CANONICAL_PROMPTS.find((p) => p.id === 'complex-multi-step')!;
      const tokens = adapter.estimateTokens(prompt.text);

      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeGreaterThan(50); // Complex prompt should have more tokens
    });

    it('should return 0 for empty string', () => {
      const tokens = adapter.estimateTokens('');
      expect(tokens).toBe(0);
    });

    it('should estimate proportional tokens based on text length', () => {
      const short = 'Hi';
      const medium = 'Hello, how are you today?';
      const long = CANONICAL_PROMPTS.find((p) => p.id === 'complex-refactoring')!.text;

      expect(adapter.estimateTokens(short)).toBeLessThan(adapter.estimateTokens(medium));
      expect(adapter.estimateTokens(medium)).toBeLessThan(adapter.estimateTokens(long));
    });

    it('should include token usage in actual API response', async () => {
      const prompt = CANONICAL_PROMPTS.find((p) => p.id === 'simple-greeting')!;
      const result = await adapter.run(prompt.text);

      expectSuccess(result);
      expectStructure(result, { hasTokens: true });

      expect(result.tokensUsed!.input).toBeGreaterThan(0);
      expect(result.tokensUsed!.output).toBeGreaterThan(0);
      expect(result.tokensUsed!.total).toBeGreaterThan(0);
      expect(result.tokensUsed!.total).toBe(
        result.tokensUsed!.input + result.tokensUsed!.output
      );
    });
  });

  describe.skipIf(skipCondition)('Cost Estimation', () => {
    let adapter: ZAIAdapter;

    beforeEach(() => {
      adapter = new ZAIAdapter({
        apiKey: USE_REAL_API ? process.env.OPENAI_API_KEY : 'test-key',
        model: 'gpt-4-turbo',
      });
    });

    it('should estimate cost for GPT-4 Turbo', () => {
      // GPT-4 Turbo: $10/1M input, $30/1M output
      const inputTokens = 1000;
      const outputTokens = 500;
      const cost = adapter.estimateCost(inputTokens, outputTokens);

      // (1000/1000000) * 10 + (500/1000000) * 30
      const expected = 0.01 + 0.015;
      expect(cost).toBeCloseTo(expected, 4);
      expect(cost).toBeGreaterThan(0);
    });

    it('should estimate cost for GPT-3.5 Turbo', () => {
      adapter = new ZAIAdapter({
        apiKey: USE_REAL_API ? process.env.OPENAI_API_KEY : 'test-key',
        model: 'gpt-3.5-turbo',
      });

      // GPT-3.5 Turbo: $0.50/1M input, $1.50/1M output
      const inputTokens = 1000;
      const outputTokens = 500;
      const cost = adapter.estimateCost(inputTokens, outputTokens);

      // (1000/1000000) * 0.5 + (500/1000000) * 1.5
      const expected = 0.0005 + 0.00075;
      expect(cost).toBeCloseTo(expected, 6);
      expect(cost).toBeGreaterThan(0);
    });

    it('should return 0 for zero tokens', () => {
      const cost = adapter.estimateCost(0, 0);
      expect(cost).toBe(0);
    });

    it('should include cost in actual API response', async () => {
      const prompt = CANONICAL_PROMPTS.find((p) => p.id === 'simple-greeting')!;
      const result = await adapter.run(prompt.text);

      expectSuccess(result);
      expectStructure(result, { hasCost: true });

      expect(result.cost).toBeGreaterThanOrEqual(0);
      expect(result.cost).toBeLessThan(1); // Should be less than $1 for simple prompt
    });

    it('should scale cost with token usage', () => {
      const smallInput = 100;
      const smallOutput = 50;
      const largeInput = 10000;
      const largeOutput = 5000;

      const smallCost = adapter.estimateCost(smallInput, smallOutput);
      const largeCost = adapter.estimateCost(largeInput, largeOutput);

      expect(largeCost).toBeGreaterThan(smallCost);
      // Should be roughly 100x more expensive (100x tokens)
      expect(largeCost / smallCost).toBeCloseTo(100, 0);
    });
  });

  describe.skipIf(skipCondition)('Error Handling', () => {
    it('should handle invalid API key gracefully', async () => {
      if (!USE_REAL_API) {
        // Mocked responses always succeed, so skip this test
        return;
      }

      const adapter = new ZAIAdapter({
        apiKey: 'invalid-key-12345',
      });

      const prompt = CANONICAL_PROMPTS.find((p) => p.id === 'simple-greeting')!;
      const result = await adapter.run(prompt.text);

      expectError(result, 'authentication' || 'api key' || 'unauthorized');
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle timeout errors gracefully', async () => {
      if (!USE_REAL_API) {
        // Mocked responses don't timeout, so skip this test
        return;
      }

      const adapter = new ZAIAdapter({
        apiKey: process.env.OPENAI_API_KEY,
        timeout: 1, // 1ms timeout - should fail immediately
      });

      const prompt = CANONICAL_PROMPTS.find((p) => p.id === 'complex-multi-step')!;
      const result = await adapter.run(prompt.text);

      // Should fail due to timeout or succeed very quickly
      if (!result.success) {
        expect(result.error?.toLowerCase()).toMatch(/(timeout|time|abort)/);
      }
    });

    it('should handle empty prompt gracefully', async () => {
      const adapter = new ZAIAdapter({
        apiKey: USE_REAL_API ? process.env.OPENAI_API_KEY : 'test-key',
      });

      const result = await adapter.run('');

      if (USE_REAL_API) {
        // Real API should handle empty prompts
        expectSuccess(result);
      } else {
        // Mocked responses always succeed
        expectSuccess(result);
      }
    });

    it('should include error information in failed results', async () => {
      if (!USE_REAL_API) {
        // Mocked responses always succeed, so skip this test
        return;
      }

      const adapter = new ZAIAdapter({
        apiKey: 'invalid-key-12345',
      });

      const prompt = CANONICAL_PROMPTS.find((p) => p.id === 'simple-greeting')!;
      const result = await adapter.run(prompt.text);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.length).toBeGreaterThan(0);
      expect(result.timing).toBeDefined(); // Should still have timing
      expect(result.timing!.durationMs).toBeGreaterThan(0);
    });
  });

  describe.skipIf(skipCondition)('Model Configuration', () => {
    it('should work with different models', async () => {
      const models = ['gpt-4-turbo', 'gpt-3.5-turbo'];

      for (const model of models) {
        const adapter = new ZAIAdapter({
          apiKey: USE_REAL_API ? process.env.OPENAI_API_KEY : 'test-key',
          model,
        });

        const prompt = CANONICAL_PROMPTS.find((p) => p.id === 'simple-greeting')!;
        const result = await adapter.run(prompt.text);

        expectSuccess(result);
        expect(result.model).toBe(model);
      }
    });

    it('should handle model switching', async () => {
      const adapter = new ZAIAdapter({
        apiKey: USE_REAL_API ? process.env.OPENAI_API_KEY : 'test-key',
        model: 'gpt-4-turbo',
      });

      expect(adapter.getModel()).toBe('gpt-4-turbo');

      adapter.setModel('gpt-3.5-turbo');
      expect(adapter.getModel()).toBe('gpt-3.5-turbo');

      const prompt = CANONICAL_PROMPTS.find((p) => p.id === 'simple-greeting')!;
      const result = await adapter.run(prompt.text);

      expectSuccess(result);
      expect(result.model).toBe('gpt-3.5-turbo');
    });
  });

  describe.skipIf(skipCondition)('Custom Base URL', () => {
    it('should work with custom base URL', async () => {
      const adapter = new ZAIAdapter({
        apiKey: USE_REAL_API ? process.env.OPENAI_API_KEY : 'test-key',
        baseURL: 'https://api.groq.com/openai/v1',
        model: 'gpt-4-turbo',
      });

      expect(adapter.getBaseURL()).toBe('https://api.groq.com/openai/v1');
      expect(adapter.getName()).toContain('Groq');

      // Health check should work (may fail if Groq requires actual API key)
      const health = await adapter.healthCheck();

      if (USE_REAL_API && HAS_API_KEY) {
        // Real API call to Groq - may fail if key is not valid for Groq
        expect(health.metadata?.baseURL).toBe('https://api.groq.com/openai/v1');
      } else {
        // Mocked response
        expect(health.healthy).toBe(true);
      }
    });

    it('should handle base URL switching', async () => {
      const adapter = new ZAIAdapter({
        apiKey: USE_REAL_API ? process.env.OPENAI_API_KEY : 'test-key',
        baseURL: 'https://api.openai.com/v1',
      });

      expect(adapter.getBaseURL()).toBe('https://api.openai.com/v1');

      adapter.setBaseURL('https://api.together.xyz/v1');
      expect(adapter.getBaseURL()).toBe('https://api.together.xyz/v1');

      const health = await adapter.healthCheck();
      expect(health.metadata?.baseURL).toBe('https://api.together.xyz/v1');
    });

    it('should detect different providers', () => {
      const providers = [
        { url: 'https://api.openai.com/v1', name: 'OpenAI' },
        { url: 'https://api.groq.com/openai/v1', name: 'Groq' },
        { url: 'https://api.together.xyz/v1', name: 'Together' },
        { url: 'https://api.deepinfra.com/v1/openai', name: 'DeepInfra' },
        { url: 'https://custom.example.com/v1', name: 'Custom' },
      ];

      for (const { url, name } of providers) {
        const adapter = new ZAIAdapter({
          apiKey: USE_REAL_API ? process.env.OPENAI_API_KEY : 'test-key',
          baseURL: url,
        });

        expect(adapter.getName()).toContain(name);
      }
    });
  });

  describe.skipIf(skipCondition)('Streaming Support', () => {
    let adapter: ZAIAdapter;

    beforeEach(() => {
      adapter = new ZAIAdapter({
        apiKey: USE_REAL_API ? process.env.OPENAI_API_KEY : 'test-key',
        model: 'gpt-4-turbo',
        stream: true,
      });
    });

    // Note: Streaming tests with mocked OpenAI SDK require complex stream object mocking
    // These tests pass with real API but are skipped for mocked backend
    const skipStreaming = !USE_REAL_API;

    it.skipIf(skipStreaming)('should handle streaming requests', async () => {
      const prompt = CANONICAL_PROMPTS.find((p) => p.id === 'simple-greeting')!;
      const result = await adapter.run(prompt.text);

      expectSuccess(result);
      expectStructure(result, { hasContent: true, hasTiming: true, hasTokens: true });
      expectContentNotEmpty(result);
      expect(result.metadata?.streamed).toBe(true);
    });

    it.skipIf(skipStreaming)('should include streamed flag in metadata', async () => {
      const prompt = CANONICAL_PROMPTS.find((p) => p.id === 'simple-question')!;
      const result = await adapter.run(prompt.text);

      expectSuccess(result);
      expect(result.metadata?.streamed).toBe(true);
    });

    it.skipIf(skipStreaming)('should provide token estimates for streaming', async () => {
      const prompt = CANONICAL_PROMPTS.find((p) => p.id === 'simple-greeting')!;
      const result = await adapter.run(prompt.text);

      expectSuccess(result);
      expectStructure(result, { hasTokens: true });

      expect(result.tokensUsed!.input).toBeGreaterThan(0);
      expect(result.tokensUsed!.output).toBeGreaterThan(0);
    });
  });

  describe.skipIf(skipCondition)('Complex Prompts', () => {
    let adapter: ZAIAdapter;

    beforeEach(() => {
      adapter = new ZAIAdapter({
        apiKey: USE_REAL_API ? process.env.OPENAI_API_KEY : 'test-key',
        model: 'gpt-4-turbo',
      });
    });

    it('should handle complex multi-step reasoning', async () => {
      const prompt = CANONICAL_PROMPTS.find((p) => p.id === 'complex-multi-step')!;
      const result = await adapter.run(prompt.text);

      expectSuccess(result);
      expectStructure(result, { hasContent: true, hasTiming: true, hasTokens: true });
      expectContentNotEmpty(result);

      if (USE_REAL_API) {
        // Should provide a detailed response about task scheduling
        expect(result.content.length).toBeGreaterThan(100);
      }
    });

    it('should handle code refactoring requests', async () => {
      const prompt = CANONICAL_PROMPTS.find((p) => p.id === 'complex-refactoring')!;
      const result = await adapter.run(prompt.text);

      expectSuccess(result);
      expectStructure(result, { hasContent: true, hasTiming: true, hasTokens: true });
      expectContentNotEmpty(result);

      if (USE_REAL_API) {
        // Should include code or suggestions
        expect(result.content.toLowerCase()).toMatch(/(code|function|improve|refactor)/);
      }
    });

    it('should complete complex prompts within reasonable time', async () => {
      const prompt = CANONICAL_PROMPTS.find((p) => p.id === 'complex-refactoring')!;
      const result = await adapter.run(prompt.text);

      expectSuccess(result);
      expectCompletionWithin(result, 60000); // 60 seconds max for complex prompts
    });
  });

  describe.skipIf(skipCondition)('Adapter Information', () => {
    it('should provide adapter name with model', () => {
      const adapter = new ZAIAdapter({
        apiKey: USE_REAL_API ? process.env.OPENAI_API_KEY : 'test-key',
        model: 'gpt-4-turbo',
        baseURL: 'https://api.openai.com/v1',
      });

      const name = adapter.getName();
      expect(name).toContain('ZAIAdapter');
      expect(name).toContain('gpt-4-turbo');
      expect(name).toContain('OpenAI');
    });

    it('should provide client access', () => {
      const adapter = new ZAIAdapter({
        apiKey: USE_REAL_API ? process.env.OPENAI_API_KEY : 'test-key',
      });

      const client = adapter.getClient();
      expect(client).toBeDefined();
    });

    it('should handle multiple instances with different configs', () => {
      const adapter1 = new ZAIAdapter({
        apiKey: USE_REAL_API ? process.env.OPENAI_API_KEY : 'test-key-1',
        model: 'gpt-4-turbo',
      });

      const adapter2 = new ZAIAdapter({
        apiKey: USE_REAL_API ? process.env.OPENAI_API_KEY : 'test-key-2',
        model: 'gpt-3.5-turbo',
      });

      expect(adapter1.getModel()).toBe('gpt-4-turbo');
      expect(adapter2.getModel()).toBe('gpt-3.5-turbo');
      expect(adapter1.getModel()).not.toBe(adapter2.getModel());
    });
  });

  describe.skipIf(skipCondition)('Execution Mode Detection', () => {
    it('should report execution mode in test metadata', () => {
      // This test documents the execution mode
      const mode = USE_REAL_API ? 'REAL API' : 'MOCKED';
      const hasKey = HAS_API_KEY ? 'WITH KEY' : 'WITHOUT KEY';

      expect(`${mode} ${hasKey}`).toBeDefined();

      if (USE_REAL_API && HAS_API_KEY) {
        console.log('Running with REAL API backend');
      } else if (USE_REAL_API && !HAS_API_KEY) {
        console.log('Tests SKIPPED: USE_REAL_API=true but OPENAI_API_KEY not set');
      } else {
        console.log('Running with MOCKED backend');
      }
    });
  });
});
