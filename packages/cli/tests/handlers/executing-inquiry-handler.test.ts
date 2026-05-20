/**
 * Executing Inquiry Handler Tests
 *
 * Tests for parallel agent execution with timeout handling and pattern support
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MissionStateMachine, MissionState } from '@one4all/kernel';
import { handleExecutingInquiryState } from '../../src/lib/state-handlers/executing-inquiry-handler.js';

// Mock the adapter factory and mapping
vi.mock('../../src/lib/adapter-factory.js', () => ({
  createUnifiedAdapter: vi.fn(() => ({
    run: vi.fn(),
  })),
}));

vi.mock('../../src/lib/agent-adapter-mapping.js', () => ({
  getAdapterForAgent: vi.fn(() => 'gemini-cli'),
}));

vi.mock('../../src/lib/registry-connector.js', () => ({
  getPersonaResolver: vi.fn(() => ({
    resolvePersonaPath: vi.fn(async () => '/mock/persona.md'),
  })),
  getDomainFromBrief: vi.fn(() => 'investment-war-room'),
}));

// Check for API keys to skip tests that require real LLM calls
const hasApiKey = !!(
  process.env.ANTHROPIC_API_KEY ||
  process.env.OPENAI_API_KEY ||
  process.env.GEMINI_API_KEY ||
  process.env.ZAI_API_KEY
);

describe('executing-inquiry-handler', () => {
  let stateMachine: MissionStateMachine;

  beforeEach(() => {
    stateMachine = new MissionStateMachine({
      domainPath: '/home/dasimoa/one4all/domains',
    });
    vi.clearAllMocks();
  });

  describe('Single pattern (backward compatible)', () => {
    it('should execute agents in parallel without cross-referencing', async () => {
      const { createUnifiedAdapter } = await import('../../src/lib/adapter-factory.js');
      const mockAdapter = {
        run: vi.fn().mockResolvedValue({
          success: true,
          content: JSON.stringify({
            response: 'Test response',
            insights: ['insight 1'],
            what_would_change_my_mind: ['factor 1'],
          }),
        }),
      };
      (createUnifiedAdapter as any).mockReturnValue(mockAdapter);

      const mission = stateMachine.createMission({
        type: 'stock_analysis',
        domain: 'investment-war-room',
        ticker: 'AAPL',
        description: 'Test mission',
        inquiry_mode: true,
        question: 'Quick valuation check',
      });

      // Set routing plan and pattern
      mission.state.brief = {
        ...mission.state.brief!,
        owner_assumptions: {
          routing_plan: {
            confidence: 95,
            selected_analysts: ['consensus-analyst', 'devil-advocate'],
            reasoning: 'Simple question',
            fallback_to_devil_advocate: false,
          },
          inquiry_pattern: 'single',
        },
      };

      const nextState = await handleExecutingInquiryState(mission);

      expect(nextState).toBe(MissionState.INQUIRY_SYNTHESIZING);
      expect(mission.state.analyst_outputs).toBeDefined();
      expect(mission.state.analyst_outputs?.inquiry_responses).toHaveLength(2);

      // Verify parallel execution - both analysts queried
      expect(mockAdapter.run).toHaveBeenCalledTimes(2);
    });

    it('should default to single pattern when not specified', async () => {
      const { createUnifiedAdapter } = await import('../../src/lib/adapter-factory.js');
      const mockAdapter = {
        run: vi.fn().mockResolvedValue({
          success: true,
          content: JSON.stringify({
            response: 'Test response',
            insights: ['insight 1'],
            what_would_change_my_mind: ['factor 1'],
          }),
        }),
      };
      (createUnifiedAdapter as any).mockReturnValue(mockAdapter);

      const mission = stateMachine.createMission({
        type: 'stock_analysis',
        domain: 'investment-war-room',
        ticker: 'AAPL',
        description: 'Test mission',
        inquiry_mode: true,
        question: 'Quick valuation check',
      });

      // Set routing plan WITHOUT pattern
      mission.state.brief = {
        ...mission.state.brief!,
        owner_assumptions: {
          routing_plan: {
            confidence: 95,
            selected_analysts: ['consensus-analyst'],
            reasoning: 'Simple question',
            fallback_to_devil_advocate: false,
          },
          // No inquiry_pattern specified
        },
      };

      const nextState = await handleExecutingInquiryState(mission);

      expect(nextState).toBe(MissionState.INQUIRY_SYNTHESIZING);
      expect(mission.state.analyst_outputs).toBeDefined();
    });
  });

  describe('Debate pattern', () => {
    it('should execute two-round debate with cross-references', async () => {
      const { createUnifiedAdapter } = await import('../../src/lib/adapter-factory.js');

      // Mock different responses for each round
      let callCount = 0;
      const mockAdapter = {
        run: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount <= 2) {
            // First round responses
            return Promise.resolve({
              success: true,
              content: JSON.stringify({
                response: `First round response ${callCount}`,
                insights: [`insight ${callCount}`],
                what_would_change_my_mind: [`factor ${callCount}`],
              }),
            });
          } else {
            // Second round responses (with cross-references)
            return Promise.resolve({
              success: true,
              content: JSON.stringify({
                response: 'Second round response with cross-reference',
                insights: ['updated insight'],
                what_would_change_my_mind: ['updated factor'],
              }),
            });
          }
        }),
      };
      (createUnifiedAdapter as any).mockReturnValue(mockAdapter);

      const mission = stateMachine.createMission({
        type: 'stock_analysis',
        domain: 'investment-war-room',
        ticker: 'AAPL',
        description: 'Test mission',
        inquiry_mode: true,
        question: 'Is AAPL a good investment?',
      });

      // Set routing plan with debate pattern
      mission.state.brief = {
        ...mission.state.brief!,
        owner_assumptions: {
          routing_plan: {
            confidence: 80,
            selected_analysts: ['consensus-analyst', 'devil-advocate'],
            reasoning: 'Debate needed',
            fallback_to_devil_advocate: false,
          },
          inquiry_pattern: 'debate',
        },
      };

      const nextState = await handleExecutingInquiryState(mission);

      expect(nextState).toBe(MissionState.INQUIRY_SYNTHESIZING);
      expect(mission.state.analyst_outputs).toBeDefined();

      // Should have 2 responses (second round)
      expect(mission.state.analyst_outputs?.inquiry_responses).toHaveLength(2);

      // Should have called adapter 4 times (2 analysts × 2 rounds)
      expect(mockAdapter.run).toHaveBeenCalledTimes(4);

      // Verify second round prompts contain cross-references
      const secondRoundCalls = mockAdapter.run.mock.calls.slice(2);
      for (const call of secondRoundCalls) {
        const prompt = call[0] as string;
        expect(prompt).toContain('Other Analysts\' Perspectives');
        expect(prompt).toContain('First round response');
      }
    });

    it('should handle single analyst in debate pattern', async () => {
      const { createUnifiedAdapter } = await import('../../src/lib/adapter-factory.js');
      const mockAdapter = {
        run: vi.fn().mockResolvedValue({
          success: true,
          content: JSON.stringify({
            response: 'Test response',
            insights: ['insight 1'],
            what_would_change_my_mind: ['factor 1'],
          }),
        }),
      };
      (createUnifiedAdapter as any).mockReturnValue(mockAdapter);

      const mission = stateMachine.createMission({
        type: 'stock_analysis',
        domain: 'investment-war-room',
        ticker: 'AAPL',
        description: 'Test mission',
        inquiry_mode: true,
        question: 'Quick check',
      });

      mission.state.brief = {
        ...mission.state.brief!,
        owner_assumptions: {
          routing_plan: {
            confidence: 95,
            selected_analysts: ['consensus-analyst'],
            reasoning: 'Single analyst',
            fallback_to_devil_advocate: false,
          },
          inquiry_pattern: 'debate',
        },
      };

      const nextState = await handleExecutingInquiryState(mission);

      expect(nextState).toBe(MissionState.INQUIRY_SYNTHESIZING);
      // With single analyst, debate should still work but only one response
      expect(mission.state.analyst_outputs?.inquiry_responses).toHaveLength(1);
    });
  });

  describe('Pattern selection', () => {
    it('should read inquiry_pattern from mission config', async () => {
      const { createUnifiedAdapter } = await import('../../src/lib/adapter-factory.js');
      const mockAdapter = {
        run: vi.fn().mockResolvedValue({
          success: true,
          content: JSON.stringify({
            response: 'Test response',
            insights: ['insight 1'],
            what_would_change_my_mind: ['factor 1'],
          }),
        }),
      };
      (createUnifiedAdapter as any).mockReturnValue(mockAdapter);

      const mission = stateMachine.createMission({
        type: 'stock_analysis',
        domain: 'investment-war-room',
        ticker: 'AAPL',
        description: 'Test mission',
        inquiry_mode: true,
        question: 'Test question',
      });

      mission.state.brief = {
        ...mission.state.brief!,
        owner_assumptions: {
          routing_plan: {
            confidence: 80,
            selected_analysts: ['consensus-analyst'],
            reasoning: 'Test',
            fallback_to_devil_advocate: false,
          },
          inquiry_pattern: 'single',
        },
      };

      await handleExecutingInquiryState(mission);

      // Verify pattern was read (single pattern = 1 call per analyst)
      expect(mockAdapter.run).toHaveBeenCalledTimes(1);
    });
  });

  describe('Fallback patterns', () => {
    it('should fallback to single pattern for research_write', async () => {
      const { createUnifiedAdapter } = await import('../../src/lib/adapter-factory.js');
      const mockAdapter = {
        run: vi.fn().mockResolvedValue({
          success: true,
          content: JSON.stringify({
            response: 'Test response',
            insights: ['insight 1'],
            what_would_change_my_mind: ['factor 1'],
          }),
        }),
      };
      (createUnifiedAdapter as any).mockReturnValue(mockAdapter);

      const mission = stateMachine.createMission({
        type: 'stock_analysis',
        domain: 'investment-war-room',
        ticker: 'AAPL',
        description: 'Test mission',
        inquiry_mode: true,
        question: 'Test question',
      });

      mission.state.brief = {
        ...mission.state.brief!,
        owner_assumptions: {
          routing_plan: {
            confidence: 80,
            selected_analysts: ['consensus-analyst'],
            reasoning: 'Test',
            fallback_to_devil_advocate: false,
          },
          inquiry_pattern: 'research_write',
        },
      };

      await handleExecutingInquiryState(mission);

      // Should fallback to single (1 call per analyst)
      expect(mockAdapter.run).toHaveBeenCalledTimes(1);
    });

    it('should fallback to single pattern for deliverable', async () => {
      const { createUnifiedAdapter } = await import('../../src/lib/adapter-factory.js');
      const mockAdapter = {
        run: vi.fn().mockResolvedValue({
          success: true,
          content: JSON.stringify({
            response: 'Test response',
            insights: ['insight 1'],
            what_would_change_my_mind: ['factor 1'],
          }),
        }),
      };
      (createUnifiedAdapter as any).mockReturnValue(mockAdapter);

      const mission = stateMachine.createMission({
        type: 'stock_analysis',
        domain: 'investment-war-room',
        ticker: 'AAPL',
        description: 'Test mission',
        inquiry_mode: true,
        question: 'Test question',
      });

      mission.state.brief = {
        ...mission.state.brief!,
        owner_assumptions: {
          routing_plan: {
            confidence: 80,
            selected_analysts: ['consensus-analyst'],
            reasoning: 'Test',
            fallback_to_devil_advocate: false,
          },
          inquiry_pattern: 'deliverable',
        },
      };

      await handleExecutingInquiryState(mission);

      // Should fallback to single (1 call per analyst)
      expect(mockAdapter.run).toHaveBeenCalledTimes(1);
    });
  });
});

describe.skipIf(!hasApiKey)('executing-inquiry-handler (integration)', () => {
  let stateMachine: MissionStateMachine;

  beforeEach(() => {
    stateMachine = new MissionStateMachine({
      domainPath: '/home/dasimoa/one4all/domains',
    });
  });

  describe('handleExecutingInquiryState', () => {
    it('should execute single agent inquiry', async () => {
      const mission = stateMachine.createMission({
        type: 'stock_analysis',
        domain: 'investment-war-room',
        ticker: 'AAPL',
        description: 'Test mission',
        inquiry_mode: true,
        question: 'Quick valuation check',
      });

      // Set routing plan for single agent
      mission.state.brief = {
        ...mission.state.brief!,
        owner_assumptions: {
          routing_plan: {
            confidence: 95,
            selected_analysts: ['consensus-analyst'], // Non-expert, faster
            reasoning: 'Simple question',
            fallback_to_devil_advocate: false,
          },
        },
      };

      const nextState = await handleExecutingInquiryState(mission);

      expect(nextState).toBe(MissionState.INQUIRY_SYNTHESIZING);
      expect(mission.state.analyst_outputs).toBeDefined();
    });

    it('should execute multiple agents in parallel', async () => {
      const mission = stateMachine.createMission({
        type: 'stock_analysis',
        domain: 'investment-war-room',
        ticker: 'AAPL',
        description: 'Test mission',
        inquiry_mode: true,
        question: 'Full analysis please',
      });

      // Set routing plan for multiple agents
      mission.state.brief = {
        ...mission.state.brief!,
        owner_assumptions: {
          routing_plan: {
            confidence: 80,
            selected_analysts: ['consensus-analyst', 'devil-advocate'],
            reasoning: 'Multiple perspectives needed',
            fallback_to_devil_advocate: false,
          },
        },
      };

      const nextState = await handleExecutingInquiryState(mission);

      expect(nextState).toBe(MissionState.INQUIRY_SYNTHESIZING);
      expect(mission.state.analyst_outputs).toBeDefined();
      expect(Object.keys(mission.state.analyst_outputs || {}).length).toBeGreaterThanOrEqual(1);
    });

    it('should handle agent timeout gracefully', async () => {
      const mission = stateMachine.createMission({
        type: 'stock_analysis',
        domain: 'investment-war-room',
        ticker: 'TEST',
        description: 'Test mission',
        inquiry_mode: true,
        question: 'Test timeout',
      });

      // Set routing plan with agent that might timeout
      mission.state.brief = {
        ...mission.state.brief!,
        owner_assumptions: {
          routing_plan: {
            confidence: 70,
            selected_analysts: ['devil-advocate'],
            reasoning: 'Test timeout',
            fallback_to_devil_advocate: false,
          },
        },
      };

      const nextState = await handleExecutingInquiryState(mission);

      expect(nextState).toBe(MissionState.INQUIRY_SYNTHESIZING);
      // Should complete even if some agents timeout
      expect(mission.state.analyst_outputs).toBeDefined();
    });
  });
});
