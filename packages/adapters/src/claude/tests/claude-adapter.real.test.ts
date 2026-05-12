/**
 * Real API tests for ClaudeAdapter
 *
 * This test suite supports two execution modes:
 * 1. Real API mode: USE_REAL_API=true makes actual calls to Anthropic API
 * 2. Mock mode: USE_REAL_API=false uses mocked responses (default)
 *
 * Run with real API:
 *   TEST_CLAUDE_REAL=1 pnpm test claude-adapter.real.test.ts
 *   TEST_REAL_API=1 pnpm test claude-adapter.real.test.ts
 *
 * Run with mocks:
 *   pnpm test claude-adapter.real.test.ts
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ClaudeAdapter } from '../claude-adapter';
import type { AdapterConfig } from '../../types/adapter.types';
import {
  CANONICAL_PROMPTS,
  getPromptsByCategory,
  getPromptById,
} from '../../tests/fixtures/prompts';
import {
  expectSuccess,
  expectStructure,
  expectContentNotEmpty,
  expectCompletionWithin,
  expectError,
  expectValidModel,
} from '../../tests/fixtures/expectations';

// Conditional execution flags
const USE_REAL_API = process.env.TEST_CLAUDE_REAL === '1' || process.env.TEST_REAL_API === '1';
const HAS_API_KEY = Boolean(process.env.ANTHROPIC_API_KEY);

// Test configuration
const TEST_TIMEOUT = USE_REAL_API ? 60000 : 5000; // 60s for real API, 5s for mocks
const QUICK_TEST_TIMEOUT = USE_REAL_API ? 30000 : 5000; // 30s for real API, 5s for mocks

// Skip condition helper
function skipIfNoRealApi(): void {
  if (USE_REAL_API && !HAS_API_KEY) {
    // Skip real API tests if no API key is available
    throw new Error('Skipping: ANTHROPIC_API_KEY not set');
  }
}

// Mock the Anthropic SDK when not using real API
if (!USE_REAL_API) {
  vi.mock('@anthropic-ai/sdk', () => {
    // Mock factory with no external references to avoid hoisting issues
    const mockCreate = vi.fn().mockImplementation(async () => {
      // Add small delay to simulate network latency
      await new Promise(resolve => setTimeout(resolve, 10));
      return {
        content: [{ type: 'text', text: 'Mock response from Claude' }],
        usage: {
          input_tokens: 10,
          output_tokens: 20,
        },
        model: 'claude-3-5-sonnet-20241022',
        id: 'mock-msg-123',
      };
    });
    const mockMessages = { create: mockCreate };

    return {
      default: vi.fn().mockImplementation(() => ({
        messages: mockMessages,
      })),
    };
  });
}

describe('ClaudeAdapter - Real API Tests', () => {
  let adapter: ClaudeAdapter;

  beforeEach(() => {
    skipIfNoRealApi();

    // Setup adapter with appropriate configuration
    const config: AdapterConfig = {
      apiKey: USE_REAL_API ? process.env.ANTHROPIC_API_KEY : 'test-key',
      maxRetries: USE_REAL_API ? 3 : 0,
      timeout: USE_REAL_API ? 60000 : 5000,
      temperature: 0.7,
      maxTokens: 1024,
    };

    adapter = new ClaudeAdapter(config);
  });

  describe('Health Check', () => {
    it(
      'should report healthy status when API is accessible',
      async () => {
        const health = await adapter.healthCheck();

        expect(health.healthy).toBe(true);
        expect(health.latencyMs).toBeGreaterThan(0);
        expect(health.metadata).toBeDefined();
        expect(health.metadata?.model).toBeDefined();
      },
      TEST_TIMEOUT
    );

    it(
      'should include model version in health check',
      async () => {
        const health = await adapter.healthCheck();

        expect(health.healthy).toBe(true);
        expect(health.metadata?.version).toBeDefined();
      },
      TEST_TIMEOUT
    );
  });

  describe('Basic Completion', () => {
    it(
      'should complete a simple greeting prompt',
      async () => {
        const prompt = getPromptById('simple-greeting');
        expect(prompt).toBeDefined();

        const result = await adapter.run(prompt!.text);

        expectSuccess(result);
        expectContentNotEmpty(result);
        expectValidModel(result);
        expectStructure(result, {
          hasContent: true,
          hasTiming: true,
          hasTokens: USE_REAL_API,
          hasCost: USE_REAL_API,
        });
      },
      TEST_TIMEOUT
    );

    it(
      'should answer a simple question',
      async () => {
        const prompt = getPromptById('simple-question');
        expect(prompt).toBeDefined();

        const result = await adapter.run(prompt!.text);

        expectSuccess(result);
        expectContentNotEmpty(result);
        expectStructure(result, { hasTiming: true });

        // Real API should mention Paris or the capital
        if (USE_REAL_API) {
          expect(result.content).toMatch(/paris/i);
        }
      },
      TEST_TIMEOUT
    );

    it(
      'should handle medium complexity reasoning',
      async () => {
        const prompt = getPromptById('medium-reasoning');
        expect(prompt).toBeDefined();

        const result = await adapter.run(prompt!.text);

        expectSuccess(result);
        expectContentNotEmpty(result);
        expectStructure(result, { hasTiming: true });
      },
      TEST_TIMEOUT
    );

    it(
      'should generate code for programming tasks',
      async () => {
        const prompt = getPromptById('medium-code');
        expect(prompt).toBeDefined();

        const result = await adapter.run(prompt!.text);

        expectSuccess(result);
        expectContentNotEmpty(result);
        expectStructure(result, { hasTiming: true });

        // Should contain code-related keywords
        if (USE_REAL_API) {
          expect(result.content.toLowerCase()).toMatch(/function|factorial|javascript|js/i);
        }
      },
      TEST_TIMEOUT
    );
  });

  describe('Token Estimation', () => {
    beforeEach(() => {
      // Ensure adapter is initialized
      if (!adapter) {
        adapter = new ClaudeAdapter({
          apiKey: USE_REAL_API ? undefined : 'test-key',
        });
      }
    });

    it('should estimate tokens for short prompts', () => {
      const shortPrompt = 'Hello world';
      const estimated = adapter.estimateTokens(shortPrompt);

      expect(estimated).toBeGreaterThan(0);
      expect(estimated).toBeLessThan(20); // Reasonable upper bound
    });

    it('should estimate tokens for longer prompts', () => {
      const longPrompt = CANONICAL_PROMPTS.find((p) => p.id === 'complex-multi-step')!.text;
      const estimated = adapter.estimateTokens(longPrompt);

      expect(estimated).toBeGreaterThan(50); // Longer text should have more tokens
    });

    it('should estimate more tokens for longer text', () => {
      const short = 'Hi';
      const long = CANONICAL_PROMPTS.find((p) => p.id === 'complex-refactoring')!.text;

      const shortTokens = adapter.estimateTokens(short);
      const longTokens = adapter.estimateTokens(long);

      expect(longTokens).toBeGreaterThan(shortTokens);
    });

    it('should handle empty string', () => {
      const estimated = adapter.estimateTokens('');
      expect(estimated).toBe(0);
    });

    it(
      'should estimate tokens reasonably close to actual usage (real API only)',
      async () => {
        if (!USE_REAL_API) {
          // Skip in mock mode
          return;
        }

        const prompt = getPromptById('simple-greeting')!.text;
        const estimated = adapter.estimateTokens(prompt);

        const result = await adapter.run(prompt);
        expectSuccess(result);

        // Actual usage should be within 50% of estimate
        const actualInput = result.tokensUsed?.input ?? 0;
        const tolerance = estimated * 0.5; // 50% tolerance

        expect(actualInput).toBeGreaterThanOrEqual(estimated - tolerance);
        expect(actualInput).toBeLessThanOrEqual(estimated + tolerance);
      },
      TEST_TIMEOUT
    );
  });

  describe('Cost Estimation', () => {
    beforeEach(() => {
      if (!adapter) {
        adapter = new ClaudeAdapter({
          apiKey: USE_REAL_API ? undefined : 'test-key',
        });
      }
    });

    it('should estimate cost for default model', () => {
      const inputTokens = 1000;
      const outputTokens = 500;
      const cost = adapter.estimateCost(inputTokens, outputTokens);

      expect(cost).toBeGreaterThan(0);
      expect(cost).toBeLessThan(1); // Should be relatively small
    });

    it('should estimate cost accurately for Claude 3.5 Sonnet', () => {
      adapter = new ClaudeAdapter({
        apiKey: USE_REAL_API ? undefined : 'test-key',
        model: 'claude-3-5-sonnet-20241022',
      });

      // Claude 3.5 Sonnet: $3/1M input, $15/1M output
      const inputTokens = 1_000_000;
      const outputTokens = 500_000;
      const cost = adapter.estimateCost(inputTokens, outputTokens);

      // (1M/1M) * $3 + (0.5M/1M) * $15 = $3 + $7.50 = $10.50
      expect(cost).toBeCloseTo(10.5, 1);
    });

    it('should estimate cost for Claude 3 Haiku', () => {
      adapter = new ClaudeAdapter({
        apiKey: USE_REAL_API ? undefined : 'test-key',
        model: 'claude-3-5-haiku-20241022',
      });

      // Claude 3.5 Haiku: $1/1M input, $5/1M output
      const inputTokens = 1_000_000;
      const outputTokens = 500_000;
      const cost = adapter.estimateCost(inputTokens, outputTokens);

      // (1M/1M) * $1 + (0.5M/1M) * $5 = $1 + $2.50 = $3.50
      expect(cost).toBeCloseTo(3.5, 1);
    });

    it('should return 0 for zero tokens', () => {
      const cost = adapter.estimateCost(0, 0);
      expect(cost).toBe(0);
    });

    it(
      'should include cost in actual API response (real API only)',
      async () => {
        if (!USE_REAL_API) {
          // Skip in mock mode
          return;
        }

        const prompt = getPromptById('simple-question')!.text;
        const result = await adapter.run(prompt);

        expectSuccess(result);
        expect(result.cost).toBeDefined();
        expect(result.cost).toBeGreaterThan(0);
        expect(result.cost).toBeLessThan(0.01); // Small prompt should cost very little
      },
      TEST_TIMEOUT
    );
  });

  describe('Timing and Performance', () => {
    it(
      'should complete simple prompts quickly',
      async () => {
        const prompt = getPromptById('simple-greeting')!.text;
        const result = await adapter.run(prompt);

        expectSuccess(result);
        expectCompletionWithin(result, USE_REAL_API ? 10000 : 1000);
      },
      QUICK_TEST_TIMEOUT
    );

    it(
      'should include timing information',
      async () => {
        const prompt = getPromptById('simple-question')!.text;
        const result = await adapter.run(prompt);

        expectSuccess(result);
        expectStructure(result, { hasTiming: true });

        expect(result.timing?.startedAt).toBeGreaterThan(0);
        expect(result.timing?.completedAt).toBeGreaterThan(0);
        expect(result.timing?.durationMs).toBeGreaterThan(0);
      },
      TEST_TIMEOUT
    );

    it(
      'should have completedAt after startedAt',
      async () => {
        const prompt = getPromptById('simple-greeting')!.text;
        const result = await adapter.run(prompt);

        expectSuccess(result);
        expect(result.timing?.completedAt).toBeGreaterThan(result.timing?.startedAt ?? 0);
      },
      TEST_TIMEOUT
    );
  });

  describe('Error Handling', () => {
    it(
      'should handle invalid API key gracefully (real API only)',
      async () => {
        if (!USE_REAL_API) {
          // Skip in mock mode
          return;
        }

        const invalidAdapter = new ClaudeAdapter({
          apiKey: 'sk-ant-invalid-key-12345',
          maxRetries: 1,
          timeout: 5000,
        });

        const result = await invalidAdapter.run('Test prompt');

        expectError(result);
        expect(result.error).toBeDefined();
      },
      QUICK_TEST_TIMEOUT
    );

    it(
      'should handle timeout errors (real API only)',
      async () => {
        if (!USE_REAL_API) {
          // Skip in mock mode
          return;
        }

        const timeoutAdapter = new ClaudeAdapter({
          apiKey: undefined, // Use real key from env
          timeout: 1, // 1ms timeout - should fail
          maxRetries: 0,
        });

        const result = await timeoutAdapter.run('Test prompt');

        expectError(result);
      },
      QUICK_TEST_TIMEOUT
    );

    it(
      'should return structured error response',
      async () => {
        if (!USE_REAL_API) {
          // Skip in mock mode
          return;
        }

        const invalidAdapter = new ClaudeAdapter({
          apiKey: 'invalid-key',
          maxRetries: 0,
        });

        const result = await invalidAdapter.run('Test');

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
        expect(result.timing).toBeDefined(); // Should still have timing
        expect(result.model).toBeDefined(); // Should still have model
      },
      QUICK_TEST_TIMEOUT
    );
  });

  describe('Configuration Options', () => {
    it(
      'should respect custom temperature setting',
      async () => {
        const result = await adapter.run('Generate a random number', {
          temperature: 0.1,
        });

        expectSuccess(result);
        expectContentNotEmpty(result);
      },
      TEST_TIMEOUT
    );

    it(
      'should respect custom maxTokens setting',
      async () => {
        const result = await adapter.run('Tell me a story', {
          maxTokens: 50,
        });

        expectSuccess(result);
        expectContentNotEmpty(result);
      },
      TEST_TIMEOUT
    );

    it(
      'should support model switching',
      async () => {
        const defaultModel = adapter.getModel();

        adapter.setModel('claude-3-5-haiku-20241022');
        expect(adapter.getModel()).toBe('claude-3-5-haiku-20241022');

        const result = await adapter.run('Hello');
        expectSuccess(result);
        expect(result.model).toBe('claude-3-5-haiku-20241022');

        // Restore default model
        adapter.setModel(defaultModel);
      },
      TEST_TIMEOUT
    );
  });

  describe('Multiple Sequential Requests', () => {
    it(
      'should handle multiple requests in sequence',
      async () => {
        const prompts = getPromptsByCategory('simple');

        const results = await Promise.all(
          prompts.map((prompt) => adapter.run(prompt.text))
        );

        expect(results).toHaveLength(prompts.length);
        results.forEach((result) => {
          expectSuccess(result);
          expectContentNotEmpty(result);
        });
      },
      TEST_TIMEOUT * 3
    );
  });

  describe('Response Quality', () => {
    it(
      'should provide relevant responses (real API only)',
      async () => {
        if (!USE_REAL_API) {
          // Skip in mock mode
          return;
        }

        const result = await adapter.run(
          'What is 2 + 2? Respond with just the number.'
        );

        expectSuccess(result);
        expectContentNotEmpty(result);
        expect(result.content).toMatch(/4/);
      },
      TEST_TIMEOUT
    );

    it(
      'should follow instructions in prompt (real API only)',
      async () => {
        if (!USE_REAL_API) {
          // Skip in mock mode
          return;
        }

        const result = await adapter.run(
          'Count to 3. Respond with each number on a new line.'
        );

        expectSuccess(result);
        expectContentNotEmpty(result);

        // Should contain numbers 1, 2, 3
        expect(result.content).toMatch(/1/);
        expect(result.content).toMatch(/2/);
        expect(result.content).toMatch(/3/);
      },
      TEST_TIMEOUT
    );
  });

  describe('Adapter Metadata', () => {
    it('should return correct adapter name', () => {
      const name = adapter.getName();
      expect(name).toContain('ClaudeAdapter');
      expect(name).toContain('claude-3-5-sonnet-20241022');
    });

    it('should return current model', () => {
      const model = adapter.getModel();
      expect(model).toBeDefined();
      expect(typeof model).toBe('string');
    });

    it('should provide access to underlying client', () => {
      const client = adapter.getClient();
      expect(client).toBeDefined();
    });
  });

  // Describe block for tests that only run with real API
  describe('Real API Exclusive Tests', () => {
    const runTest = USE_REAL_API ? it : it.skip;

    runTest(
      'should include accurate token counts in response',
      async () => {
        const prompt = getPromptById('medium-reasoning')!.text;
        const result = await adapter.run(prompt);

        expectSuccess(result);
        expectStructure(result, { hasTokens: true });

        expect(result.tokensUsed?.input).toBeGreaterThan(0);
        expect(result.tokensUsed?.output).toBeGreaterThan(0);
        expect(result.tokensUsed?.total).toBe(
          result.tokensUsed.input + result.tokensUsed.output
        );
      },
      TEST_TIMEOUT
    );

    runTest(
      'should calculate cost accurately based on token usage',
      async () => {
        const prompt = getPromptById('simple-greeting')!.text;
        const result = await adapter.run(prompt);

        expectSuccess(result);
        expectStructure(result, { hasTokens: true, hasCost: true });

        const { inputTokens = 0, outputTokens = 0 } = result.tokensUsed ?? {};
        const expectedCost = adapter.estimateCost(inputTokens, outputTokens);

        expect(result.cost).toBeCloseTo(expectedCost, 6);
      },
      TEST_TIMEOUT
    );
  });

  // Describe block for tests that only run with mocks
  describe('Mock Mode Tests', () => {
    const runTest = !USE_REAL_API ? it : it.skip;

    runTest('should work without API key in mock mode', async () => {
      const mockAdapter = new ClaudeAdapter({
        apiKey: 'fake-test-key',
      });

      const result = await mockAdapter.run('Test prompt');

      expectSuccess(result);
      expectContentNotEmpty(result);
    });
  });
});
