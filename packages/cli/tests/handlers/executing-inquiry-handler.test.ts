/**
 * Executing Inquiry Handler Tests
 *
 * Tests for parallel agent execution with timeout handling
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MissionStateMachine, MissionState } from '@one4all/kernel';
import { handleExecutingInquiryState } from '../../src/lib/state-handlers/executing-inquiry-handler.js';

// Check for API keys to skip tests that require real LLM calls
const hasApiKey = !!(
  process.env.ANTHROPIC_API_KEY ||
  process.env.OPENAI_API_KEY ||
  process.env.GEMINI_API_KEY ||
  process.env.ZAI_API_KEY
);

describe.skipIf(!hasApiKey)('executing-inquiry-handler', () => {
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
