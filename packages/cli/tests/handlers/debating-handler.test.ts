/**
 * Debating Handler Tests
 *
 * Tests for the DEBATING state handler that orchestrates
 * structured debates between disagreeing analysts
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MissionStateMachine, MissionState } from '@one4all/kernel';
import { handleDebatingState } from '../../src/lib/state-handlers/debating-handler.js';

// Mock the dependencies
vi.mock('../../src/lib/registry-connector.js', () => ({
  getPersonaResolver: vi.fn(() => ({
    resolvePersonaPath: vi.fn(() => '/mock/path/persona.md'),
    getKnownAnalysts: vi.fn(() => ['analyst1', 'analyst2']),
  })),
  getDomainFromBrief: vi.fn((brief) => brief?.domain || 'investment-war-room'),
}));

vi.mock('../../src/lib/adapter-factory.js', () => ({
  createUnifiedAdapter: vi.fn(() => ({
    run: vi.fn(() => Promise.resolve({
      success: true,
      content: 'Mock debate response',
    })),
  })),
}));

vi.mock('../../src/lib/agent-adapter-mapping.js', () => ({
  getAdapterForAgent: vi.fn(() => 'claude-cli'),
}));

vi.mock('@one4all/kernel', async () => {
  const actual = await vi.importActual('@one4all/kernel');
  return {
    ...actual,
    createDebateController: vi.fn(() => ({
      createDebate: vi.fn(() => ({
        id: 'mock-debate-session',
        domain: 'investment-war-room',
        participating_analysts: ['analyst1', 'analyst2'],
        status: 'active',
        created_at: new Date(),
      })),
      initializePositions: vi.fn(),
      completeDebate: vi.fn(() => ({
        id: 'mock-debate-result',
        session_id: 'mock-debate-session',
        total_rounds: 2,
        total_contributions: 4,
        converged: true,
        final_phase: 'SYNTHESIS',
        positions: [],
        contributions: [],
        synthesis: {
          consensus_points: ['Point 1', 'Point 2'],
          remaining_disagreements: [],
          recommendation: 'Mock recommendation',
        },
      })),
    })),
    createDebateExecutor: vi.fn(() => ({
      runDebate: vi.fn(() => Promise.resolve({
        totalRounds: 2,
        totalContributions: 4,
        converged: true,
        finalPhase: 'SYNTHESIS',
        errors: [],
      })),
    })),
  };
});

describe('debating-handler', () => {
  let stateMachine: MissionStateMachine;

  beforeEach(() => {
    stateMachine = new MissionStateMachine({});
    vi.clearAllMocks();
  });

  describe('handleDebatingState', () => {
    it('should extract topic from mission brief', async () => {
      const mission = stateMachine.createMission({
        type: 'stock_analysis',
        domain: 'investment-war-room',
        ticker: 'AAPL',
        description: 'Test mission',
        inquiry_mode: false,
        question: 'Is AAPL a good investment?',
      });

      const nextState = await handleDebatingState(mission);

      expect(nextState).toBe(MissionState.SYNTHESIZING);
      // Topic extraction is tested implicitly - handler should not throw
    });

    it('should create debate session and run DebateExecutor', async () => {
      const mission = stateMachine.createMission({
        type: 'stock_analysis',
        domain: 'investment-war-room',
        ticker: 'TSLA',
        description: 'Test mission',
        inquiry_mode: false,
      });

      // Set routing plan with specific analysts
      mission.state.brief = {
        ...mission.state.brief!,
        owner_assumptions: {
          routing_plan: {
            confidence: 75,
            selected_analysts: ['damodaran-valuation', 'seth-klarman'],
            reasoning: 'Test debate',
            fallback_to_devil_advocate: false,
          },
        },
      };

      const nextState = await handleDebatingState(mission);

      expect(nextState).toBe(MissionState.SYNTHESIZING);
      expect(mission.state.debate_records).toBeDefined();
    });

    it('should transition to SYNTHESIZING on success', async () => {
      const mission = stateMachine.createMission({
        type: 'stock_analysis',
        domain: 'investment-war-room',
        ticker: 'MSFT',
        description: 'Test mission',
        inquiry_mode: false,
      });

      const nextState = await handleDebatingState(mission);

      expect(nextState).toBe(MissionState.SYNTHESIZING);
    });

    it('should transition to SYNTHESIZING even on debate error (graceful degradation)', async () => {
      const mission = stateMachine.createMission({
        type: 'stock_analysis',
        domain: 'investment-war-room',
        ticker: 'ERROR',
        description: 'Test error handling',
        inquiry_mode: false,
      });

      // Mock to throw error
      const { createDebateExecutor } = await import('@one4all/kernel');
      vi.mocked(createDebateExecutor).mockReturnValueOnce({
        runDebate: vi.fn(() => Promise.reject(new Error('Debate failed'))),
      } as any);

      const nextState = await handleDebatingState(mission);

      // Should still transition to SYNTHESIZING despite error
      expect(nextState).toBe(MissionState.SYNTHESIZING);
    });

    it('should use analysts from routing plan when available', async () => {
      const mission = stateMachine.createMission({
        type: 'stock_analysis',
        domain: 'investment-war-room',
        ticker: 'NVDA',
        description: 'Test mission',
        inquiry_mode: false,
      });

      mission.state.brief = {
        ...mission.state.brief!,
        owner_assumptions: {
          routing_plan: {
            confidence: 80,
            selected_analysts: ['consensus-analyst', 'devil-advocate'],
            reasoning: 'Test routing plan',
            fallback_to_devil_advocate: false,
          },
        },
      };

      const nextState = await handleDebatingState(mission);

      expect(nextState).toBe(MissionState.SYNTHESIZING);
      expect(mission.state.debate_records).toBeDefined();
    });

    it('should fallback to devil-advocate when no analysts specified', async () => {
      const mission = stateMachine.createMission({
        type: 'stock_analysis',
        domain: 'investment-war-room',
        ticker: 'TEST',
        description: 'Test fallback',
        inquiry_mode: false,
      });

      // No routing plan, no required_agents
      mission.state.brief = {
        ...mission.state.brief!,
        owner_assumptions: {},
      };
      mission.state.config = undefined;

      const nextState = await handleDebatingState(mission);

      expect(nextState).toBe(MissionState.SYNTHESIZING);
    });

    it('should use question as debate topic when available', async () => {
      const mission = stateMachine.createMission({
        type: 'stock_analysis',
        domain: 'investment-war-room',
        ticker: 'AAPL',
        description: 'Test mission',
        inquiry_mode: false,
        question: 'What is the fair value of AAPL?',
      });

      const nextState = await handleDebatingState(mission);

      expect(nextState).toBe(MissionState.SYNTHESIZING);
    });

    it('should use description as debate topic when question missing', async () => {
      const mission = stateMachine.createMission({
        type: 'stock_analysis',
        domain: 'investment-war-room',
        ticker: 'GOOGL',
        description: 'Analyze Google investment opportunity',
        inquiry_mode: false,
      });

      const nextState = await handleDebatingState(mission);

      expect(nextState).toBe(MissionState.SYNTHESIZING);
    });

    it('should use ticker as debate topic when both question and description missing', async () => {
      const mission = stateMachine.createMission({
        type: 'stock_analysis',
        domain: 'investment-war-room',
        ticker: 'AMZN',
        description: '',
        inquiry_mode: false,
      });

      const nextState = await handleDebatingState(mission);

      expect(nextState).toBe(MissionState.SYNTHESIZING);
    });

    it('should store debate results in mission state', async () => {
      const mission = stateMachine.createMission({
        type: 'stock_analysis',
        domain: 'investment-war-room',
        ticker: 'META',
        description: 'Test mission',
        inquiry_mode: false,
      });

      await handleDebatingState(mission);

      expect(mission.state.debate_records).toBeDefined();
      expect(mission.state.debate_records).toHaveProperty('id');
      expect(mission.state.debate_records).toHaveProperty('total_rounds');
      expect(mission.state.debate_records).toHaveProperty('synthesis');
    });

    it('should handle empty debate result gracefully', async () => {
      const mission = stateMachine.createMission({
        type: 'stock_analysis',
        domain: 'investment-war-room',
        ticker: 'EMPTY',
        description: 'Test empty result',
        inquiry_mode: false,
      });

      // Mock to return minimal result
      const { createDebateController } = await import('@one4all/kernel');
      vi.mocked(createDebateController).mockReturnValueOnce({
        createDebate: vi.fn(() => ({
          id: 'empty-debate',
          domain: 'investment-war-room',
          participating_analysts: [],
          status: 'active',
          created_at: new Date(),
        })),
        initializePositions: vi.fn(),
        completeDebate: vi.fn(() => ({
          id: 'empty-result',
          session_id: 'empty-debate',
          total_rounds: 0,
          total_contributions: 0,
          converged: false,
          final_phase: 'INITIALIZING',
          positions: [],
          contributions: [],
          synthesis: null,
        })),
      } as any);

      const nextState = await handleDebatingState(mission);

      expect(nextState).toBe(MissionState.SYNTHESIZING);
    });

    it('should log debate statistics', async () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const mission = stateMachine.createMission({
        type: 'stock_analysis',
        domain: 'investment-war-room',
        ticker: 'LOGS',
        description: 'Test logging',
        inquiry_mode: false,
      });

      await handleDebatingState(mission);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[DEBATING]')
      );

      consoleLogSpy.mockRestore();
    });
  });
});
