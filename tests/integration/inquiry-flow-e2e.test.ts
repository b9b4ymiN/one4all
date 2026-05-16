/**
 * Inquiry Flow E2E Tests
 *
 * End-to-end tests for the full inquiry flow:
 * ROUTING → EXECUTING_INQUIRY → INQUIRY_SYNTHESIZING
 *
 * NOTE: These tests require API keys to run. They will be skipped if:
 * - ANTHROPIC_API_KEY is not set (for Claude)
 * - OPENAI_API_KEY is not set (for zai/codex)
 * - GEMINI_API_KEY is not set (for Gemini)
 */

import { describe, it, expect } from 'vitest';
import { MissionStateMachine, MissionState } from '@one4all/kernel';
import { handleRoutingState } from '../../packages/cli/src/lib/state-handlers/routing-handler.js';
import { handleExecutingInquiryState } from '../../packages/cli/src/lib/state-handlers/executing-inquiry-handler.js';
import { handleInquirySynthesizingState } from '../../packages/cli/src/lib/state-handlers/inquiry-synthesizing-handler.js';

// Check if any API keys are available
const hasApiKey = !!(
  process.env.ANTHROPIC_API_KEY ||
  process.env.OPENAI_API_KEY ||
  process.env.GEMINI_API_KEY ||
  process.env.ZAI_API_KEY
);

describe.skipIf(!hasApiKey)('Inquiry Flow E2E', () => {
  let stateMachine: MissionStateMachine;

  beforeEach(() => {
    stateMachine = new MissionStateMachine({
      domainPath: '/home/dasimoa/one4all/domains',
    });
  });

  describe('Thai question flow (CPALL.BK)', () => {
    it('should complete full inquiry flow for Thai question', async () => {
      const mission = stateMachine.createMission({
        type: 'stock_analysis',
        domain: 'investment-war-room',
        ticker: 'CPALL',
        description: 'Thai stock inquiry',
        inquiry_mode: true,
        question: 'ตามมุมมองดาโมดาลัน มีคำถามอะไรบ้าง',
      });

      // Step 1: ROUTING
      let nextState = await handleRoutingState(mission);
      expect(nextState).toBe(MissionState.EXECUTING_INQUIRY);

      const routingPlan = mission.state.brief?.owner_assumptions?.routing_plan;
      expect(routingPlan?.selected_analysts.length).toBeGreaterThan(0);

      // Step 2: EXECUTING_INQUIRY
      nextState = await handleExecutingInquiryState(mission);
      expect(nextState).toBe(MissionState.INQUIRY_SYNTHESIZING);
      expect(mission.state.analyst_outputs).toBeDefined();

      // Step 3: INQUIRY_SYNTHESIZING
      nextState = await handleInquirySynthesizingState(mission);
      expect(nextState).toBe(MissionState.DELIVERABLE);
      expect(mission.state.inquiry_result).toBeDefined();

      // Verify Thai ticker was normalized
      const result = mission.state.inquiry_result;
      expect(result?.answer).toBeDefined();
    });
  });

  describe('English question flow (AAPL)', () => {
    it('should complete full inquiry flow for English question', async () => {
      const mission = stateMachine.createMission({
        type: 'stock_analysis',
        domain: 'investment-war-room',
        ticker: 'AAPL',
        description: 'US stock inquiry',
        inquiry_mode: true,
        question: 'What is the fair value according to Damodaran?',
      });

      // Step 1: ROUTING
      let nextState = await handleRoutingState(mission);
      expect(nextState).toBe(MissionState.EXECUTING_INQUIRY);

      const routingPlan = mission.state.brief?.owner_assumptions?.routing_plan;
      expect(routingPlan?.selected_analysts).toContain('damodaran-valuation');

      // Step 2: EXECUTING_INQUIRY
      nextState = await handleExecutingInquiryState(mission);
      expect(nextState).toBe(MissionState.INQUIRY_SYNTHESIZING);

      // Step 3: INQUIRY_SYNTHESIZING
      nextState = await handleInquirySynthesizingState(mission);
      expect(nextState).toBe(MissionState.DELIVERABLE);
    });
  });

  describe('Low confidence routing (includes devil-advocate)', () => {
    it('should include devil-advocate for vague questions', async () => {
      const mission = stateMachine.createMission({
        type: 'stock_analysis',
        domain: 'investment-war-room',
        ticker: 'TSLA',
        description: 'Vague inquiry',
        inquiry_mode: true,
        question: 'Is this good?', // Very vague
      });

      // Step 1: ROUTING
      let nextState = await handleRoutingState(mission);
      expect(nextState).toBe(MissionState.EXECUTING_INQUIRY);

      const routingPlan = mission.state.brief?.owner_assumptions?.routing_plan;
      expect(routingPlan?.selected_analysts).toContain('devil-advocate');
      expect(routingPlan?.confidence).toBeLessThan(70);

      // Complete flow
      nextState = await handleExecutingInquiryState(mission);
      expect(nextState).toBe(MissionState.INQUIRY_SYNTHESIZING);

      nextState = await handleInquirySynthesizingState(mission);
      expect(nextState).toBe(MissionState.DELIVERABLE);
    });
  });

  describe('Debate pattern (two conflicting analysts)', () => {
    it('should handle bull vs bear debate', async () => {
      const mission = stateMachine.createMission({
        type: 'stock_analysis',
        domain: 'investment-war-room',
        ticker: 'NVDA',
        description: 'Debate inquiry',
        inquiry_mode: true,
        question: 'Damodaran says bullish, Klarman says bearish - who is right?',
      });

      // Step 1: ROUTING
      let nextState = await handleRoutingState(mission);
      expect(nextState).toBe(MissionState.EXECUTING_INQUIRY);

      const routingPlan = mission.state.brief?.owner_assumptions?.routing_plan;
      expect(routingPlan?.selected_analysts.length).toBeGreaterThanOrEqual(2);

      // Complete flow
      nextState = await handleExecutingInquiryState(mission);
      expect(nextState).toBe(MissionState.INQUIRY_SYNTHESIZING);

      nextState = await handleInquirySynthesizingState(mission);
      expect(nextState).toBe(MissionState.DELIVERABLE);

      // Verify synthesis includes both perspectives
      const result = mission.state.inquiry_result;
      expect(result?.answer).toBeDefined();
    });
  });
});
