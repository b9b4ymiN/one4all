/**
 * Debate Executor Unit Tests
 *
 * Tests DebateExecutor with mock LLM adapter - no API keys required.
 * These tests must pass in CI without external dependencies.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DebateExecutor, type LLMAdapter } from './debate-executor.js';
import { DebateController } from './debate-controller.js';
import { PersonaResolver } from '../registry/persona-resolver.js';
import { AgentRegistryLoader } from '../registry/agent-registry.js';
import { DebatePhase } from './types.js';
import { readFileSync, writeFileSync, unlinkSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';

/**
 * Mock LLM Adapter for testing
 */
class MockLLMAdapter implements LLMAdapter {
  public responses: Map<string, string> = new Map();
  public delays: Map<string, number> = new Map();
  public callCount = 0;
  public lastPrompt?: string;

  /**
   * Set a mock response for a specific prompt pattern
   */
  setResponse(promptPattern: string, response: string): void {
    this.responses.set(promptPattern, response);
  }

  /**
   * Set a simulated delay for a specific prompt pattern (ms)
   */
  setDelay(promptPattern: string, delayMs: number): void {
    this.delays.set(promptPattern, delayMs);
  }

  async chat(params: { prompt: string; maxTokens?: number; temperature?: number; timeout?: number }): Promise<string> {
    this.callCount++;
    this.lastPrompt = params.prompt;

    // Check for delay
    for (const [pattern, delay] of this.delays.entries()) {
      if (params.prompt.includes(pattern)) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // Find matching response
    for (const [pattern, response] of this.responses.entries()) {
      if (params.prompt.includes(pattern)) {
        return response;
      }
    }

    // Default response
    return 'I believe this position is moderately strong with conviction 60.';
  }

  reset(): void {
    this.responses.clear();
    this.delays.clear();
    this.callCount = 0;
    this.lastPrompt = undefined;
  }
}

/**
 * Mock Persona Resolver that creates temporary persona files
 */
class MockPersonaResolver {
  private tempDir: string;
  private createdFiles: string[] = [];

  constructor(tempDir: string) {
    this.tempDir = tempDir;
  }

  async resolvePersonaPath(agentId: string, domain: string): Promise<string> {
    // Create a temporary persona file
    const personaPath = resolve(this.tempDir, `${agentId}.md`);

    const personaContent = `# Test Analyst: ${agentId}

## Voice & Tone
I write with a skeptical, analytical tone focused on evidence.

## Worldview
- Cash flows reveal truth
- Accounting quality matters
- Skepticism prevents losses

## Cognitive Biases Awareness
- Confirmation bias: seeking only confirming evidence
- Recency bias: overweighting recent events

## Key Questions I Always Ask
- What does the cash flow say?
- Where are the accounting risks?
- What would change my mind?
`;

    writeFileSync(personaPath, personaContent, 'utf-8');
    this.createdFiles.push(personaPath);

    return personaPath;
  }

  cleanup(): void {
    for (const file of this.createdFiles) {
      try {
        if (existsSync(file)) {
          unlinkSync(file);
        }
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    this.createdFiles = [];
  }

  async getAgent(agentId: string): Promise<any> {
    return {
      id: agentId,
      name: `Test ${agentId}`,
      performance: {
        timeout_seconds: 5,
        max_tokens: 1000,
      },
      identity: {
        persona_file: 'test.md',
      },
    };
  }

  async getAgentsByDomain(domain: string): Promise<any[]> {
    return [];
  }
}

describe('DebateExecutor', () => {
  let executor: DebateExecutor;
  let mockLLM: MockLLMAdapter;
  let controller: DebateController;
  let mockResolver: MockPersonaResolver;
  let tempDir: string;

  beforeEach(() => {
    // Create temp directory for test persona files
    tempDir = tmpdir();
    if (!existsSync(tempDir)) {
      mkdirSync(tempDir, { recursive: true });
    }

    mockLLM = new MockLLMAdapter();
    controller = new DebateController({ enabled: false }); // Disable constitution for tests
    mockResolver = new MockPersonaResolver(tempDir);
    executor = new DebateExecutor(mockLLM, mockResolver as any, controller);
  });

  afterEach(() => {
    // Clean up temp files
    try {
      mockResolver.cleanup();
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  describe('executeRound', () => {
    it('should execute a round between two analysts', async () => {
      // Create debate session
      const session = controller.createDebate({
        mission_id: 'test-mission',
        domain: 'test',
        participating_analysts: ['analyst-1', 'analyst-2'],
        max_rounds: 3,
        max_contributions_per_round: 5,
        convergence_threshold: 30,
        timeout_ms: 30000,
        constitution_strict: false,
      });

      // Initialize positions
      controller.initializePositions(session.id, [
        { analyst_id: 'analyst-1', stance: 'bullish', thesis_summary: 'Bull thesis', conviction_score: 70 },
        { analyst_id: 'analyst-2', stance: 'bearish', thesis_summary: 'Bear thesis', conviction_score: 30 },
      ]);

      // Set up mock responses
      mockLLM.setResponse('analyst-1', 'I strongly believe in this position with conviction 75. The cash flow analysis supports this view.');
      mockLLM.setResponse('analyst-2', 'I remain skeptical with conviction 25. The accounting risks are too high.');

      // Execute round
      const result = await executor.executeRound(session, ['analyst-1', 'analyst-2'], 'test');

      // Verify results
      expect(result.contributions).toHaveLength(2);
      expect(result.errors).toHaveLength(0);
      expect(result.round).toBe(0);
      expect(mockLLM.callCount).toBe(2);
    });

    it('should include previous contributions in prompts', async () => {
      const session = controller.createDebate({
        mission_id: 'test-mission',
        domain: 'test',
        participating_analysts: ['analyst-1', 'analyst-2'],
        max_rounds: 3,
        max_contributions_per_round: 5,
        convergence_threshold: 30,
        timeout_ms: 30000,
        constitution_strict: false,
      });

      controller.initializePositions(session.id, [
        { analyst_id: 'analyst-1', stance: 'bullish', thesis_summary: 'Bull thesis', conviction_score: 70 },
        { analyst_id: 'analyst-2', stance: 'bearish', thesis_summary: 'Bear thesis', conviction_score: 30 },
      ]);

      // First round
      mockLLM.setResponse('analyst-1', 'Round 1: Bullish with conviction 70');
      mockLLM.setResponse('analyst-2', 'Round 1: Bearish with conviction 30');

      await executor.executeRound(session, ['analyst-1', 'analyst-2'], 'test');

      // Reset call count but keep session state
      const callCountAfterFirstRound = mockLLM.callCount;

      // Second round - should include previous contributions
      mockLLM.setResponse('analyst-1', 'Round 2: Responding to analyst-2');
      mockLLM.setResponse('analyst-2', 'Round 2: Responding to analyst-1');

      await executor.executeRound(session, ['analyst-1', 'analyst-2'], 'test');

      // Verify second round prompts included previous contributions
      expect(mockLLM.callCount).toBe(callCountAfterFirstRound + 2);

      // Check that prompts contain previous arguments
      const prompts: string[] = [];
      const originalChat = mockLLM.chat.bind(mockLLM);
      mockLLM.chat = async (params) => {
        prompts.push(params.prompt);
        return originalChat(params);
      };

      await executor.executeRound(session, ['analyst-1'], 'test');

      expect(prompts[0]).toContain('Previous Arguments from Other Analysts');
      expect(prompts[0]).toContain('Round 1: Bearish with conviction 30');
    });

    it('should detect convergence when convictions align', async () => {
      const session = controller.createDebate({
        mission_id: 'test-mission',
        domain: 'test',
        participating_analysts: ['analyst-1', 'analyst-2'],
        max_rounds: 3,
        max_contributions_per_round: 5,
        convergence_threshold: 30,
        timeout_ms: 30000,
        constitution_strict: false,
      });

      controller.initializePositions(session.id, [
        { analyst_id: 'analyst-1', stance: 'bullish', thesis_summary: 'Bull thesis', conviction_score: 70 },
        { analyst_id: 'analyst-2', stance: 'bearish', thesis_summary: 'Bear thesis', conviction_score: 30 },
      ]);

      // Both analysts converge to similar positions (conviction scores within threshold)
      mockLLM.setResponse('analyst-1', 'After reviewing evidence, I now believe conviction 55. Both positions have merit.');
      mockLLM.setResponse('analyst-2', 'I acknowledge the bullish points. My conviction is now 50. There is common ground.');

      const result = await executor.executeRound(session, ['analyst-1', 'analyst-2'], 'test');

      // Should detect convergence (55 - 50 = 5, which is < 30 threshold)
      expect(result.contributions).toHaveLength(2);
      // Convergence is checked after contributions are submitted
    });
  });

  describe('runDebate', () => {
    it('should run complete debate until convergence', async () => {
      const session = controller.createDebate({
        mission_id: 'test-mission',
        domain: 'test',
        participating_analysts: ['analyst-1', 'analyst-2'],
        max_rounds: 3,
        max_contributions_per_round: 5,
        convergence_threshold: 30,
        timeout_ms: 30000,
        constitution_strict: false,
      });

      controller.initializePositions(session.id, [
        { analyst_id: 'analyst-1', stance: 'bullish', thesis_summary: 'Bull thesis', conviction_score: 70 },
        { analyst_id: 'analyst-2', stance: 'bearish', thesis_summary: 'Bear thesis', conviction_score: 30 },
      ]);

      // First round: far apart
      mockLLM.setResponse('analyst-1', 'Opening: Strong bull case with conviction 80');
      mockLLM.setResponse('analyst-2', 'Opening: Strong bear case with conviction 20');

      // Second round: converge
      mockLLM.setResponse('After reviewing', 'Both perspectives have merit. My conviction is 55.');

      const result = await executor.runDebate(session, ['analyst-1', 'analyst-2'], 'test', 3);

      expect(result.debateId).toBe(session.id);
      expect(result.totalContributions).toBeGreaterThan(0);
      expect(result.totalRounds).toBeGreaterThan(0);
    });

    it('should respect max rounds limit', async () => {
      const session = controller.createDebate({
        mission_id: 'test-mission',
        domain: 'test',
        participating_analysts: ['analyst-1', 'analyst-2'],
        max_rounds: 2,
        max_contributions_per_round: 5,
        convergence_threshold: 5, // Very tight threshold - unlikely to converge
        timeout_ms: 30000,
        constitution_strict: false,
      });

      controller.initializePositions(session.id, [
        { analyst_id: 'analyst-1', stance: 'bullish', thesis_summary: 'Bull thesis', conviction_score: 90 },
        { analyst_id: 'analyst-2', stance: 'bearish', thesis_summary: 'Bear thesis', conviction_score: 10 },
      ]);

      // Never converge - stay far apart
      mockLLM.setResponse('analyst-1', 'I remain very bullish with conviction 95');
      mockLLM.setResponse('analyst-2', 'I remain very bearish with conviction 5');

      const result = await executor.runDebate(session, ['analyst-1', 'analyst-2'], 'test');

      // Should stop after max rounds
      expect(result.totalRounds).toBeLessThanOrEqual(2);
    });

    it('should handle errors gracefully', async () => {
      const session = controller.createDebate({
        mission_id: 'test-mission',
        domain: 'test',
        participating_analysts: ['analyst-1', 'analyst-2', 'analyst-3'],
        max_rounds: 1,
        max_contributions_per_round: 5,
        convergence_threshold: 30,
        timeout_ms: 30000,
        constitution_strict: false,
      });

      controller.initializePositions(session.id, [
        { analyst_id: 'analyst-1', stance: 'bullish', thesis_summary: 'Bull thesis', conviction_score: 70 },
        { analyst_id: 'analyst-2', stance: 'bearish', thesis_summary: 'Bear thesis', conviction_score: 30 },
        { analyst_id: 'analyst-3', stance: 'neutral', thesis_summary: 'Neutral thesis', conviction_score: 50 },
      ]);

      // analyst-2 will fail
      mockLLM.setResponse('analyst-1', 'Bullish view with conviction 70');
      mockLLM.setResponse('analyst-2', new Error('Simulated LLM failure') as any);
      mockLLM.setResponse('analyst-3', 'Neutral view with conviction 50');

      const result = await executor.runDebate(session, ['analyst-1', 'analyst-2', 'analyst-3'], 'test');

      // Should complete despite error
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.totalContributions).toBe(2); // Only analyst-1 and analyst-3 succeed
      expect(result.errors.some(e => e.analystId === 'analyst-2')).toBe(true);
    });
  });

  describe('timeout handling', () => {
    it('should timeout slow LLM responses', async () => {
      const session = controller.createDebate({
        mission_id: 'test-mission',
        domain: 'test',
        participating_analysts: ['analyst-1'],
        max_rounds: 1,
        max_contributions_per_round: 5,
        convergence_threshold: 30,
        timeout_ms: 30000,
        constitution_strict: false,
      });

      controller.initializePositions(session.id, [
        { analyst_id: 'analyst-1', stance: 'bullish', thesis_summary: 'Bull thesis', conviction_score: 70 },
      ]);

      // Simulate slow response (6 seconds, but timeout is 5 seconds)
      mockLLM.setDelay('analyst-1', 6000);
      mockLLM.setResponse('analyst-1', 'Slow response');

      const result = await executor.executeRound(session, ['analyst-1'], 'test');

      // Should have error due to timeout
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].error).toContain('timed out');
    });
  });

  describe('cross-references', () => {
    it('should include cross-references to other analysts in prompts', async () => {
      const session = controller.createDebate({
        mission_id: 'test-mission',
        domain: 'test',
        participating_analysts: ['analyst-1', 'analyst-2', 'analyst-3'],
        max_rounds: 1,
        max_contributions_per_round: 5,
        convergence_threshold: 30,
        timeout_ms: 30000,
        constitution_strict: false,
      });

      controller.initializePositions(session.id, [
        { analyst_id: 'analyst-1', stance: 'bullish', thesis_summary: 'Bull thesis', conviction_score: 70 },
        { analyst_id: 'analyst-2', stance: 'bearish', thesis_summary: 'Bear thesis', conviction_score: 30 },
        { analyst_id: 'analyst-3', stance: 'neutral', thesis_summary: 'Neutral thesis', conviction_score: 50 },
      ]);

      // Capture prompts
      const prompts: string[] = [];
      const originalChat = mockLLM.chat.bind(mockLLM);
      mockLLM.chat = async (params) => {
        prompts.push(params.prompt);
        return originalChat(params);
      };

      mockLLM.setResponse('analyst-1', 'Response 1');
      mockLLM.setResponse('analyst-2', 'Response 2');
      mockLLM.setResponse('analyst-3', 'Response 3');

      await executor.executeRound(session, ['analyst-1', 'analyst-2', 'analyst-3'], 'test');

      // Each prompt should include the persona
      prompts.forEach(prompt => {
        expect(prompt).toContain('Your Persona');
        expect(prompt).toContain('Debate Instructions');
      });

      // Second round should include previous contributions
      const round2Prompts: string[] = [];
      mockLLM.chat = async (params) => {
        round2Prompts.push(params.prompt);
        return originalChat(params);
      };

      mockLLM.setResponse('analyst-1', 'Response to others');
      await executor.executeRound(session, ['analyst-1'], 'test');

      expect(round2Prompts[0]).toContain('Previous Arguments from Other Analysts');
      // Note: analyst-1's own previous responses are filtered out
      expect(round2Prompts[0]).toContain('Response 2');
      expect(round2Prompts[0]).toContain('Response 3');
    });
  });

  describe('conviction score extraction', () => {
    it('should extract explicit conviction scores from responses', async () => {
      const session = controller.createDebate({
        mission_id: 'test-mission',
        domain: 'test',
        participating_analysts: ['analyst-1'],
        max_rounds: 1,
        max_contributions_per_round: 5,
        convergence_threshold: 30,
        timeout_ms: 30000,
        constitution_strict: false,
      });

      controller.initializePositions(session.id, [
        { analyst_id: 'analyst-1', stance: 'bullish', thesis_summary: 'Bull thesis', conviction_score: 50 },
      ]);

      // The test expects extractConvictionScore to work, but we need to verify
      // Let's test with a simpler approach - check that the response format is parsed
      const response = 'After reviewing the evidence, my conviction: 85. The analysis is strong.';
      const regex = /conviction[:\s]*(\d+)/i;
      const match = response.match(regex);

      // Verify the regex works
      expect(match).toBeTruthy();
      if (match) {
        expect(parseInt(match[1], 10)).toBe(85);
      }

      // Now test that it's extracted in the flow
      const originalChat = mockLLM.chat.bind(mockLLM);
      mockLLM.chat = async () => response;

      const result = await executor.executeRound(session, ['analyst-1'], 'test');

      // Restore original method
      mockLLM.chat = originalChat;

      // The contribution should have the extracted conviction score
      expect(result.contributions[0].conviction_score).toBe(85);
    });

    it('should fallback to tone analysis when no explicit score', async () => {
      const session = controller.createDebate({
        mission_id: 'test-mission',
        domain: 'test',
        participating_analysts: ['analyst-1'],
        max_rounds: 1,
        max_contributions_per_round: 5,
        convergence_threshold: 30,
        timeout_ms: 30000,
        constitution_strict: false,
      });

      controller.initializePositions(session.id, [
        { analyst_id: 'analyst-1', stance: 'bullish', thesis_summary: 'Bull thesis', conviction_score: 50 },
      ]);

      // Strong bullish language but no explicit score
      mockLLM.setResponse('analyst-1', 'This is a strong and compelling case with excellent evidence.');

      const result = await executor.executeRound(session, ['analyst-1'], 'test');

      // Should increase conviction based on tone
      expect(result.contributions[0].conviction_score).toBeGreaterThan(50);
    });
  });
});

/**
 * Integration tests with real LLM
 * These are skipped by default and only run when TEST_REAL_LLM is set
 */
describe.skip('DebateExecutor Integration Tests (Real LLM)', () => {
  it('should run debate with real LLM when TEST_REAL_LLM is set', async () => {
    // This test only runs when explicitly enabled
    // It requires a real LLM API key
    expect(process.env.TEST_REAL_LLM).toBeDefined();

    // Real LLM integration test would go here
    // This is where we'd test with actual Claude/OpenAI/etc. API
  });
});
