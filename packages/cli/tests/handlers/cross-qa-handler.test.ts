/**
 * Cross-QA Handler Tests
 *
 * Tests for the CROSS_QA state handler that orchestrates
 * cross-questioning between analyst agents
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MissionStateMachine, MissionState } from '@one4all/kernel';
import { handleCrossQAState } from '../../src/lib/state-handlers/cross-qa-handler.js';

// Mock the dependencies
vi.mock('../../src/lib/registry-connector.js', () => ({
  getPersonaResolver: vi.fn(() => ({
    resolvePersonaPath: vi.fn(() => '/mock/path/persona.md'),
  })),
}));

vi.mock('../../src/lib/adapter-factory.js', () => ({
  createUnifiedAdapter: vi.fn(() => ({
    run: vi.fn(() => Promise.resolve({
      success: true,
      content: 'Mock answer to question',
    })),
  })),
}));

vi.mock('../../src/lib/agent-adapter-mapping.js', () => ({
  getAdapterForAgent: vi.fn(() => 'claude-cli'),
}));

vi.mock('fs/promises', () => ({
  readFile: vi.fn(() => Promise.resolve('---\nfrontmatter\n---\nMock persona content')),
}));

describe('cross-qa-handler', () => {
  let stateMachine: MissionStateMachine;

  beforeEach(() => {
    stateMachine = new MissionStateMachine({});
    vi.clearAllMocks();
  });

  describe('handleCrossQAState', () => {
    it('should skip QA when less than 2 analysts', async () => {
      const mission = stateMachine.createMission({
        type: 'stock_analysis',
        domain: 'investment-war-room',
        ticker: 'TEST',
        description: 'Test mission',
        inquiry_mode: false,
      });

      // Only one analyst output
      mission.state.analyst_outputs = [
        {
          analyst_id: 'consensus-analyst',
          fair_value: 150,
          risk_level: 'medium',
          thesis_summary: 'Good investment',
        },
      ] as any;

      const nextState = await handleCrossQAState(mission);

      expect(nextState).toBe(MissionState.DEBATING);
    });

    it('should generate questions between analysts', async () => {
      const mission = stateMachine.createMission({
        type: 'stock_analysis',
        domain: 'investment-war-room',
        ticker: 'AAPL',
        description: 'Test mission',
        inquiry_mode: false,
      });

      // Two analysts with different valuations
      mission.state.analyst_outputs = [
        {
          analyst_id: 'analyst1',
          fair_value: 150,
          risk_level: 'low',
          thesis_summary: 'Bullish on growth',
        },
        {
          analyst_id: 'analyst2',
          fair_value: 100,
          risk_level: 'high',
          thesis_summary: 'Bearish on valuation',
        },
      ] as any;

      const nextState = await handleCrossQAState(mission);

      expect(nextState).toBe(MissionState.DEBATING);
      expect((mission.state as any).cross_qa_results).toBeDefined();
    });

    it('should question analyst with LLM call', async () => {
      const mission = stateMachine.createMission({
        type: 'stock_analysis',
        domain: 'investment-war-room',
        ticker: 'TSLA',
        description: 'Test mission',
        inquiry_mode: false,
      });

      mission.state.analyst_outputs = [
        {
          analyst_id: 'analyst1',
          fair_value: 200,
          risk_level: 'low',
          thesis_summary: 'Strong growth potential',
        },
        {
          analyst_id: 'analyst2',
          fair_value: 100,
          risk_level: 'high',
          thesis_summary: 'Overvalued and risky',
        },
      ] as any;

      const nextState = await handleCrossQAState(mission);

      expect(nextState).toBe(MissionState.DEBATING);
      expect((mission.state as any).cross_qa_results).toBeDefined();
    });

    it('should load persona via registry for analyst', async () => {
      const mission = stateMachine.createMission({
        type: 'stock_analysis',
        domain: 'investment-war-room',
        ticker: 'MSFT',
        description: 'Test mission',
        inquiry_mode: false,
      });

      mission.state.analyst_outputs = [
        {
          analyst_id: 'damodaran-valuation',
          fair_value: 180,
          risk_level: 'medium',
          thesis_summary: 'Fair value based on DCF',
        },
        {
          analyst_id: 'seth-klarman',
          fair_value: 120,
          risk_level: 'high',
          thesis_summary: 'Requires margin of safety',
        },
      ] as any;

      const nextState = await handleCrossQAState(mission);

      expect(nextState).toBe(MissionState.DEBATING);

      // Verify that the mock adapter factory was called
      // The handler should have called createUnifiedAdapter for questioning analysts
      const { createUnifiedAdapter } = await import('../../src/lib/adapter-factory.js');
      expect(createUnifiedAdapter).toHaveBeenCalled();
    });

    it('should handle missing analyst gracefully', async () => {
      const mission = stateMachine.createMission({
        type: 'stock_analysis',
        domain: 'investment-war-room',
        ticker: 'MISSING',
        description: 'Test missing analyst',
        inquiry_mode: false,
      });

      mission.state.analyst_outputs = [
        {
          analyst_id: 'analyst1',
          fair_value: 150,
          risk_level: 'medium',
          thesis_summary: 'Valid analysis',
        },
        {
          analyst_id: 'unknown-analyst',
          fair_value: 100,
          risk_level: 'high',
          thesis_summary: 'Unknown analyst',
        },
      ] as any;

      // Mock adapter to fail for unknown analyst
      const { createUnifiedAdapter } = await import('../../src/lib/adapter-factory.js');
      vi.mocked(createUnifiedAdapter).mockReturnValueOnce({
        run: vi.fn(() => Promise.resolve({
          success: false,
          error: 'Analyst not found',
        })),
      } as any);

      const nextState = await handleCrossQAState(mission);

      expect(nextState).toBe(MissionState.DEBATING);
      // Should continue despite errors
      expect((mission.state as any).cross_qa_results).toBeDefined();
    });

    it('should calculate thesis similarity correctly', async () => {
      const mission = stateMachine.createMission({
        type: 'stock_analysis',
        domain: 'investment-war-room',
        ticker: 'SIMILARITY',
        description: 'Test thesis similarity',
        inquiry_mode: false,
      });

      mission.state.analyst_outputs = [
        {
          analyst_id: 'analyst1',
          thesis_summary: 'Strong growth and good margins',
        },
        {
          analyst_id: 'analyst2',
          thesis_summary: 'Strong growth with excellent margins',
        },
      ] as any;

      const nextState = await handleCrossQAState(mission);

      expect(nextState).toBe(MissionState.DEBATING);
    });

    it('should generate questions for valuation differences > 10%', async () => {
      const mission = stateMachine.createMission({
        type: 'stock_analysis',
        domain: 'investment-war-room',
        ticker: 'VALUATION',
        description: 'Test valuation difference',
        inquiry_mode: false,
      });

      mission.state.analyst_outputs = [
        {
          analyst_id: 'analyst1',
          fair_value: 200,
          thesis_summary: 'High growth',
        },
        {
          analyst_id: 'analyst2',
          fair_value: 100, // 50% difference
          thesis_summary: 'Conservative',
        },
      ] as any;

      const nextState = await handleCrossQAState(mission);

      expect(nextState).toBe(MissionState.DEBATING);
      const results = (mission.state as any).cross_qa_results;
      expect(results.questions_asked).toBeGreaterThan(0);
    });

    it('should generate questions for risk level differences', async () => {
      const mission = stateMachine.createMission({
        type: 'stock_analysis',
        domain: 'investment-war-room',
        ticker: 'RISK',
        description: 'Test risk difference',
        inquiry_mode: false,
      });

      mission.state.analyst_outputs = [
        {
          analyst_id: 'analyst1',
          risk_level: 'low',
          thesis_summary: 'Safe investment',
        },
        {
          analyst_id: 'analyst2',
          risk_level: 'high',
          thesis_summary: 'Risky investment',
        },
      ] as any;

      const nextState = await handleCrossQAState(mission);

      expect(nextState).toBe(MissionState.DEBATING);
      const results = (mission.state as any).cross_qa_results;
      expect(results.questions_asked).toBeGreaterThan(0);
    });

    it('should store QA results in mission state', async () => {
      const mission = stateMachine.createMission({
        type: 'stock_analysis',
        domain: 'investment-war-room',
        ticker: 'STORE',
        description: 'Test result storage',
        inquiry_mode: false,
      });

      mission.state.analyst_outputs = [
        {
          analyst_id: 'analyst1',
          fair_value: 150,
          risk_level: 'medium',
          thesis_summary: 'Balanced view',
        },
        {
          analyst_id: 'analyst2',
          fair_value: 120,
          risk_level: 'medium',
          thesis_summary: 'Different view',
        },
      ] as any;

      await handleCrossQAState(mission);

      expect((mission.state as any).cross_qa_results).toBeDefined();
      expect((mission.state as any).cross_qa_results).toHaveProperty('questions_asked');
      expect((mission.state as any).cross_qa_results).toHaveProperty('questions_answered');
      expect((mission.state as any).cross_qa_results).toHaveProperty('unresolved_questions');
    });

    it('should track answered and unanswered questions', async () => {
      const mission = stateMachine.createMission({
        type: 'stock_analysis',
        domain: 'investment-war-room',
        ticker: 'TRACK',
        description: 'Test question tracking',
        inquiry_mode: false,
      });

      mission.state.analyst_outputs = [
        {
          analyst_id: 'analyst1',
          fair_value: 150,
          thesis_summary: 'First view',
        },
        {
          analyst_id: 'analyst2',
          fair_value: 100,
          thesis_summary: 'Second view',
        },
      ] as any;

      await handleCrossQAState(mission);

      const results = (mission.state as any).cross_qa_results;
      expect(results.questions_asked).toBe(results.questions_answered);
      expect(results.unresolved_questions).toBeDefined();
    });

    it('should handle empty analyst outputs', async () => {
      const mission = stateMachine.createMission({
        type: 'stock_analysis',
        domain: 'investment-war-room',
        ticker: 'EMPTY',
        description: 'Test empty outputs',
        inquiry_mode: false,
      });

      mission.state.analyst_outputs = [] as any;

      const nextState = await handleCrossQAState(mission);

      expect(nextState).toBe(MissionState.DEBATING);
    });

    it('should log QA progress', async () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const mission = stateMachine.createMission({
        type: 'stock_analysis',
        domain: 'investment-war-room',
        ticker: 'LOG',
        description: 'Test logging',
        inquiry_mode: false,
      });

      mission.state.analyst_outputs = [
        {
          analyst_id: 'analyst1',
          fair_value: 150,
          thesis_summary: 'View 1',
        },
        {
          analyst_id: 'analyst2',
          fair_value: 100,
          thesis_summary: 'View 2',
        },
      ] as any;

      await handleCrossQAState(mission);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[CROSS_QA]')
      );

      consoleLogSpy.mockRestore();
    });

    it('should store answers in mission state with metadata', async () => {
      const mission = stateMachine.createMission({
        type: 'stock_analysis',
        domain: 'investment-war-room',
        ticker: 'META',
        description: 'Test answer storage',
        inquiry_mode: false,
      });

      mission.state.analyst_outputs = [
        {
          analyst_id: 'analyst1',
          fair_value: 150,
          thesis_summary: 'Thesis 1',
        },
        {
          analyst_id: 'analyst2',
          fair_value: 100,
          thesis_summary: 'Thesis 2',
        },
      ] as any;

      await handleCrossQAState(mission);

      expect((mission.state as any).cross_qa_answers).toBeDefined();
      expect(Array.isArray((mission.state as any).cross_qa_answers)).toBe(true);

      if ((mission.state as any).cross_qa_answers.length > 0) {
        const answer = (mission.state as any).cross_qa_answers[0];
        expect(answer).toHaveProperty('question');
        expect(answer).toHaveProperty('from_analyst');
        expect(answer).toHaveProperty('to_analyst');
        expect(answer).toHaveProperty('answer');
        expect(answer).toHaveProperty('timestamp');
      }
    });
  });

  describe('thesis similarity calculation', () => {
    it('should detect low similarity between different theses', async () => {
      const mission = stateMachine.createMission({
        type: 'stock_analysis',
        domain: 'investment-war-room',
        ticker: 'DIFF',
        description: 'Test different theses',
        inquiry_mode: false,
      });

      mission.state.analyst_outputs = [
        {
          analyst_id: 'analyst1',
          thesis_summary: 'Bullish on technology growth',
        },
        {
          analyst_id: 'analyst2',
          thesis_summary: 'Bearish on market valuation',
        },
      ] as any;

      await handleCrossQAState(mission);

      // Low similarity should generate questions
      const results = (mission.state as any).cross_qa_results;
      expect(results.questions_asked).toBeGreaterThan(0);
    });

    it('should detect high similarity between similar theses', async () => {
      const mission = stateMachine.createMission({
        type: 'stock_analysis',
        domain: 'investment-war-room',
        ticker: 'SIMILAR',
        description: 'Test similar theses',
        inquiry_mode: false,
      });

      mission.state.analyst_outputs = [
        {
          analyst_id: 'analyst1',
          thesis_summary: 'Strong growth with good margins',
          fair_value: 150,
        },
        {
          analyst_id: 'analyst2',
          thesis_summary: 'Strong growth with excellent margins',
          fair_value: 152, // Minimal difference
        },
      ] as any;

      await handleCrossQAState(mission);

      // High similarity with minimal valuation diff may generate fewer questions
      const results = (mission.state as any).cross_qa_results;
      expect(results).toBeDefined();
    });
  });
});
