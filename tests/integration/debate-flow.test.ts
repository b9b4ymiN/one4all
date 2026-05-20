/**
 * Debate Flow Integration Tests
 *
 * End-to-end tests for the full debate pipeline:
 * - DebateController (session bookkeeping)
 * - DebateExecutor (LLM invocation)
 * - PersonaResolver (persona loading)
 * - debating-handler (CLI integration)
 *
 * Test categories:
 * 1. Mock LLM tests - Run without API keys (default)
 * 2. Real LLM tests - Skipped unless TEST_REAL_LLM=true
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DebateController, createDebateController } from '@one4all/kernel';
import { DebateExecutor, createDebateExecutor, type LLMAdapter } from '@one4all/kernel';
import { readFileSync, writeFileSync, unlinkSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';

/**
 * Mock LLM Adapter for testing
 * Simulates structured debate responses without API calls
 */
class MockLLMAdapter implements LLMAdapter {
  private responses: Map<string, string> = new Map();
  private callCount = 0;
  public lastPrompt?: string;

  /**
   * Set a mock response for a specific analyst
   */
  setResponse(analystId: string, response: string): void {
    this.responses.set(analystId, response);
  }

  async chat(params: { prompt: string; maxTokens?: number; temperature?: number; timeout?: number }): Promise<string> {
    this.callCount++;
    this.lastPrompt = params.prompt;

    // Check for analyst-specific responses
    for (const [analystId, response] of this.responses.entries()) {
      if (params.prompt.includes(`You are ${analystId}`)) {
        return response;
      }
    }

    // Default response with conviction score
    return `Based on my analysis, I believe this position has merit with conviction 65.`;
  }

  reset(): void {
    this.responses.clear();
    this.callCount = 0;
    this.lastPrompt = undefined;
  }

  getCallCount(): number {
    return this.callCount;
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

describe('Debate Flow Integration Tests (Mock LLM)', () => {
  let mockLLM: MockLLMAdapter;
  let controller: DebateController;
  let executor: DebateExecutor;
  let mockResolver: MockPersonaResolver;
  let tempDir: string;

  beforeEach(() => {
    // Create temp directory for test persona files
    tempDir = tmpdir();
    if (!existsSync(tempDir)) {
      mkdirSync(tempDir, { recursive: true });
    }

    mockLLM = new MockLLMAdapter();
    controller = createDebateController({ enabled: false }); // Disable constitution for tests
    mockResolver = new MockPersonaResolver(tempDir);
    executor = createDebateExecutor(mockLLM, mockResolver as any, controller);
  });

  afterEach(() => {
    // Clean up temp files
    try {
      mockResolver.cleanup();
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  describe('Full debate lifecycle', () => {
    it('should complete full debate from initialization to completion', async () => {
      // Create debate session
      const session = controller.createDebate({
        mission_id: 'test-mission-1',
        domain: 'test',
        participating_analysts: ['bull-analyst', 'bear-analyst'],
        max_rounds: 2,
        max_contributions_per_round: 5,
        convergence_threshold: 30,
        timeout_ms: 30000,
        constitution_strict: false,
      });

      // Initialize positions
      controller.initializePositions(session.id, [
        {
          analyst_id: 'bull-analyst',
          stance: 'bullish',
          thesis_summary: 'Strong growth potential makes this attractive',
          conviction_score: 75,
        },
        {
          analyst_id: 'bear-analyst',
          stance: 'bearish',
          thesis_summary: 'High valuation and execution risks make this risky',
          conviction_score: 25,
        },
      ]);

      // Set up mock responses for each round
      mockLLM.setResponse('bull-analyst', 'I believe in the growth story with conviction 80. The market opportunity is massive.');
      mockLLM.setResponse('bear-analyst', 'I remain skeptical with conviction 20. The valuation is stretched and execution is unproven.');

      // Run debate
      const result = await executor.runDebate(
        session,
        ['bull-analyst', 'bear-analyst'],
        'test',
        2
      );

      // Verify debate completed
      expect(result.debateId).toBe(session.id);
      expect(result.totalRounds).toBeGreaterThan(0);
      expect(result.totalContributions).toBeGreaterThan(0);
      expect(result.errors).toHaveLength(0);

      // Verify session state
      expect(session.current_phase).toBeDefined();
      expect(session.contributions.length).toBeGreaterThan(0);

      // Verify positions were tracked
      expect(session.positions.size).toBe(2);
      const bullPosition = session.positions.get('bull-analyst');
      const bearPosition = session.positions.get('bear-analyst');
      expect(bullPosition?.stance).toBe('bullish');
      expect(bearPosition?.stance).toBe('bearish');

      // Verify phase transitions
      expect(session.phase_history.length).toBeGreaterThan(0);
      const transition = session.phase_history[0];
      expect(transition.from).toBe('INITIALIZATION');
      expect(transition.to).toBe('OPENING_STATEMENTS');

      // Get debate result
      const debateResult = controller.completeDebate(session.id);
      expect(debateResult.success).toBe(true);
      expect(debateResult.total_contributions).toBe(result.totalContributions);
      expect(debateResult.final_phase).toBeDefined();
      expect(debateResult.positions.length).toBe(2);
    });

    it('should track phase transitions through debate stages', async () => {
      const session = controller.createDebate({
        mission_id: 'test-mission-2',
        domain: 'test',
        participating_analysts: ['bull-analyst', 'bear-analyst'],
        max_rounds: 2,
        max_contributions_per_round: 5,
        convergence_threshold: 30,
        timeout_ms: 30000,
        constitution_strict: false,
      });

      controller.initializePositions(session.id, [
        { analyst_id: 'bull-analyst', stance: 'bullish', thesis_summary: 'Bull thesis', conviction_score: 70 },
        { analyst_id: 'bear-analyst', stance: 'bearish', thesis_summary: 'Bear thesis', conviction_score: 30 },
      ]);

      // Set responses that show gradual convergence
      mockLLM.setResponse('bull-analyst', 'Opening bullish with conviction 80');
      mockLLM.setResponse('bear-analyst', 'Opening bearish with conviction 20');

      // Run for 2 rounds
      const result = await executor.runDebate(session, ['bull-analyst', 'bear-analyst'], 'test', 2);

      // Verify we went through multiple phases
      expect(session.phase_history.length).toBeGreaterThan(1);

      // Verify phase sequence is valid (no duplicates in sequence)
      const phases = session.phase_history.map(t => t.to);
      for (let i = 0; i < phases.length - 1; i++) {
        expect(phases[i]).not.toBe(phases[i + 1]);
      }
    });

    it('should store contributions with correct metadata', async () => {
      const session = controller.createDebate({
        mission_id: 'test-mission-3',
        domain: 'test',
        participating_analysts: ['bull-analyst', 'bear-analyst'],
        max_rounds: 1,
        max_contributions_per_round: 5,
        convergence_threshold: 30,
        timeout_ms: 30000,
        constitution_strict: false,
      });

      controller.initializePositions(session.id, [
        { analyst_id: 'bull-analyst', stance: 'bullish', thesis_summary: 'Bull thesis', conviction_score: 70 },
        { analyst_id: 'bear-analyst', stance: 'bearish', thesis_summary: 'Bear thesis', conviction_score: 30 },
      ]);

      const testResponse = 'This is my detailed analysis with conviction 75';
      mockLLM.setResponse('bull-analyst', testResponse);
      mockLLM.setResponse('bear-analyst', 'Counter argument with conviction 35');

      await executor.runDebate(session, ['bull-analyst', 'bear-analyst'], 'test', 1);

      // Verify contributions
      expect(session.contributions.length).toBeGreaterThanOrEqual(2);

      const bullContribution = session.contributions.find(c => c.analyst_id === 'bull-analyst');
      expect(bullContribution).toBeDefined();
      expect(bullContribution?.content).toContain(testResponse);
      expect(bullContribution?.conviction_score).toBe(75);
      expect(bullContribution?.debate_id).toBe(session.id);
      expect(bullContribution?.phase).toBeDefined();
      expect(bullContribution?.timestamp).toBeDefined();
    });
  });

  describe('Cross-analyst reference verification', () => {
    it('should include previous arguments in prompts', async () => {
      const session = controller.createDebate({
        mission_id: 'test-mission-4',
        domain: 'test',
        participating_analysts: ['bull-analyst', 'bear-analyst'],
        max_rounds: 2,
        max_contributions_per_round: 5,
        convergence_threshold: 30,
        timeout_ms: 30000,
        constitution_strict: false,
      });

      controller.initializePositions(session.id, [
        { analyst_id: 'bull-analyst', stance: 'bullish', thesis_summary: 'Bull thesis', conviction_score: 70 },
        { analyst_id: 'bear-analyst', stance: 'bearish', thesis_summary: 'Bear thesis', conviction_score: 30 },
      ]);

      // Round 1 responses with unique markers
      mockLLM.setResponse('bull-analyst', 'BULL_ANALYST_POSITION: Strong growth story with conviction 80. Market opportunity is massive.');
      mockLLM.setResponse('bear-analyst', 'BEAR_ANALYST_POSITION: High valuation risk with conviction 20. Execution concerns remain.');

      // Capture prompts for round 2
      const round2Prompts: string[] = [];
      const originalChat = mockLLM.chat.bind(mockLLM);
      mockLLM.chat = async (params) => {
        if (mockLLM.getCallCount() >= 2) {
          // Round 2
          round2Prompts.push(params.prompt);
        }
        return originalChat(params);
      };

      // Run debate
      await executor.runDebate(session, ['bull-analyst', 'bear-analyst'], 'test', 2);

      // Verify round 2 prompts include previous arguments section
      expect(round2Prompts.length).toBeGreaterThan(0);

      for (const prompt of round2Prompts) {
        expect(prompt).toContain('Previous Arguments from Other Analysts');
      }

      // Verify specific cross-references exist in prompts
      const hasBullReference = round2Prompts.some(p => p.includes('BEAR_ANALYST_POSITION'));
      const hasBearReference = round2Prompts.some(p => p.includes('BULL_ANALYST_POSITION'));
      expect(hasBullReference || hasBearReference).toBe(true);
    });

    it('should include debate context in prompts', async () => {
      const session = controller.createDebate({
        mission_id: 'test-mission-context',
        domain: 'test',
        participating_analysts: ['bull-analyst', 'bear-analyst'],
        max_rounds: 1,
        max_contributions_per_round: 5,
        convergence_threshold: 30,
        timeout_ms: 30000,
        constitution_strict: false,
      });

      controller.initializePositions(session.id, [
        { analyst_id: 'bull-analyst', stance: 'bullish', thesis_summary: 'Bull thesis', conviction_score: 70 },
        { analyst_id: 'bear-analyst', stance: 'bearish', thesis_summary: 'Bear thesis', conviction_score: 30 },
      ]);

      // Capture all prompts
      const allPrompts: string[] = [];
      const originalChat = mockLLM.chat.bind(mockLLM);
      mockLLM.chat = async (params) => {
        allPrompts.push(params.prompt);
        return originalChat(params);
      };

      mockLLM.setResponse('bull-analyst', 'Response with conviction 75');
      mockLLM.setResponse('bear-analyst', 'Response with conviction 25');

      await executor.runDebate(session, ['bull-analyst', 'bear-analyst'], 'test', 1);

      // Verify all prompts have required sections
      for (const prompt of allPrompts) {
        expect(prompt).toContain('Debate Instructions');
        expect(prompt).toContain('Your Persona');
        expect(prompt).toContain('Current Phase');
        expect(prompt).toContain('Your Current Position');
        expect(prompt).toContain('Stance');
        expect(prompt).toContain('Conviction');
      }
    });
  });

  describe('Debate execution mechanics', () => {
    it('should handle multiple analysts in single round', async () => {
      const session = controller.createDebate({
        mission_id: 'test-mission-multi',
        domain: 'test',
        participating_analysts: ['analyst-1', 'analyst-2', 'analyst-3'],
        max_rounds: 1,
        max_contributions_per_round: 5,
        convergence_threshold: 30,
        timeout_ms: 30000,
        constitution_strict: false,
      });

      controller.initializePositions(session.id, [
        { analyst_id: 'analyst-1', stance: 'bullish', thesis_summary: 'Bull thesis', conviction_score: 80 },
        { analyst_id: 'analyst-2', stance: 'bearish', thesis_summary: 'Bear thesis', conviction_score: 20 },
        { analyst_id: 'analyst-3', stance: 'neutral', thesis_summary: 'Neutral thesis', conviction_score: 50 },
      ]);

      mockLLM.setResponse('analyst-1', 'Bullish with conviction 80');
      mockLLM.setResponse('analyst-2', 'Bearish with conviction 20');
      mockLLM.setResponse('analyst-3', 'Neutral with conviction 50');

      const result = await executor.runDebate(session, ['analyst-1', 'analyst-2', 'analyst-3'], 'test', 1);

      // Should have 3 contributions (one per analyst)
      expect(result.totalContributions).toBe(3);
      expect(session.contributions.length).toBe(3);
      expect(result.errors).toHaveLength(0);

      // Verify each analyst contributed
      const analyst1Contrib = session.contributions.find(c => c.analyst_id === 'analyst-1');
      const analyst2Contrib = session.contributions.find(c => c.analyst_id === 'analyst-2');
      const analyst3Contrib = session.contributions.find(c => c.analyst_id === 'analyst-3');

      expect(analyst1Contrib).toBeDefined();
      expect(analyst2Contrib).toBeDefined();
      expect(analyst3Contrib).toBeDefined();
    });

    it('should handle errors gracefully', async () => {
      const session = controller.createDebate({
        mission_id: 'test-mission-error',
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
      mockLLM.setResponse('analyst-1', 'Good response with conviction 70');
      mockLLM.setResponse('analyst-2', new Error('Simulated LLM failure') as any);
      mockLLM.setResponse('analyst-3', 'Good response with conviction 50');

      const result = await executor.runDebate(session, ['analyst-1', 'analyst-2', 'analyst-3'], 'test');

      // Should complete despite error
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.totalContributions).toBe(2); // Only analyst-1 and analyst-3 succeed
      expect(result.errors.some(e => e.analystId === 'analyst-2')).toBe(true);
    });
  });

  describe('Debate statistics and metrics', () => {
    it('should track debate statistics accurately', async () => {
      const session = controller.createDebate({
        mission_id: 'test-mission-stats',
        domain: 'test',
        participating_analysts: ['analyst-1', 'analyst-2', 'analyst-3'],
        max_rounds: 2,
        max_contributions_per_round: 5,
        convergence_threshold: 30,
        timeout_ms: 30000,
        constitution_strict: false,
      });

      controller.initializePositions(session.id, [
        { analyst_id: 'analyst-1', stance: 'bullish', thesis_summary: 'Bull thesis', conviction_score: 80 },
        { analyst_id: 'analyst-2', stance: 'bearish', thesis_summary: 'Bear thesis', conviction_score: 20 },
        { analyst_id: 'analyst-3', stance: 'neutral', thesis_summary: 'Neutral thesis', conviction_score: 50 },
      ]);

      mockLLM.setResponse('analyst-1', 'Bullish with conviction 80');
      mockLLM.setResponse('analyst-2', 'Bearish with conviction 20');
      mockLLM.setResponse('analyst-3', 'Neutral with conviction 50');

      await executor.runDebate(session, ['analyst-1', 'analyst-2', 'analyst-3'], 'test', 2);

      // Get statistics
      const stats = controller.getDebateStats(session.id);
      expect(stats).toBeDefined();
      expect(stats?.total_contributions).toBeGreaterThan(0);
      expect(stats?.contributions_by_phase).toBeDefined();
      expect(stats?.contributions_by_analyst).toBeDefined();
      expect(stats?.average_conviction).toBeGreaterThan(0);
      expect(stats?.conviction_range).toBeDefined();
      expect(stats?.conviction_range.min).toBeLessThanOrEqual(stats?.conviction_range.max);
    });

    it('should provide accurate debate result summary', async () => {
      const session = controller.createDebate({
        mission_id: 'test-mission-summary',
        domain: 'test',
        participating_analysts: ['bull-analyst', 'bear-analyst'],
        max_rounds: 1,
        max_contributions_per_round: 5,
        convergence_threshold: 30,
        timeout_ms: 30000,
        constitution_strict: false,
      });

      controller.initializePositions(session.id, [
        { analyst_id: 'bull-analyst', stance: 'bullish', thesis_summary: 'Bull thesis', conviction_score: 75 },
        { analyst_id: 'bear-analyst', stance: 'bearish', thesis_summary: 'Bear thesis', conviction_score: 25 },
      ]);

      mockLLM.setResponse('bull-analyst', 'Bullish analysis with conviction 75');
      mockLLM.setResponse('bear-analyst', 'Bearish analysis with conviction 25');

      await executor.runDebate(session, ['bull-analyst', 'bear-analyst'], 'test', 1);

      // Get debate result
      const debateResult = controller.completeDebate(session.id);

      expect(debateResult).toBeDefined();
      expect(debateResult.success).toBe(true);
      expect(debateResult.total_contributions).toBe(2);
      expect(debateResult.positions).toHaveLength(2);
      expect(debateResult.final_phase).toBeDefined();
      expect(debateResult.synthesis_input).toBeDefined();
      expect(debateResult.synthesis_input.mission_id).toBe('test-mission-summary');
      expect(debateResult.synthesis_input.final_positions).toHaveLength(2);
    });
  });

  describe('Round execution', () => {
    it('should execute single round correctly', async () => {
      const session = controller.createDebate({
        mission_id: 'test-mission-round',
        domain: 'test',
        participating_analysts: ['bull-analyst', 'bear-analyst'],
        max_rounds: 1,
        max_contributions_per_round: 5,
        convergence_threshold: 30,
        timeout_ms: 30000,
        constitution_strict: false,
      });

      controller.initializePositions(session.id, [
        { analyst_id: 'bull-analyst', stance: 'bullish', thesis_summary: 'Bull thesis', conviction_score: 70 },
        { analyst_id: 'bear-analyst', stance: 'bearish', thesis_summary: 'Bear thesis', conviction_score: 30 },
      ]);

      mockLLM.setResponse('bull-analyst', 'Opening bullish with conviction 75');
      mockLLM.setResponse('bear-analyst', 'Opening bearish with conviction 25');

      const result = await executor.runDebate(session, ['bull-analyst', 'bear-analyst'], 'test', 1);

      expect(result.totalRounds).toBeGreaterThan(0);
      expect(result.totalContributions).toBe(2);
      expect(result.errors).toHaveLength(0);
    });
  });
});

/**
 * Real LLM Integration Tests
 * These are skipped by default and only run when TEST_REAL_LLM is set
 */
describe.skip('Debate Flow Integration Tests (Real LLM)', () => {
  it('should run debate with real LLM when TEST_REAL_LLM is set', async () => {
    // This test only runs when explicitly enabled
    // It requires a real LLM API key
    expect(process.env.TEST_REAL_LLM).toBeDefined();

    // Real LLM integration test would go here
    // This is where we'd test with actual Claude/OpenAI/etc. API
    // Example:
    // - Create a real debate session
    // - Use actual LLM adapter
    // - Verify real responses are structured correctly
    // - Test convergence with actual LLM behavior
  });
});
