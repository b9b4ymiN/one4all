/**
 * Routing Handler Tests
 *
 * Tests for the CIO Router that routes questions to appropriate analysts
 * with Thai/English support and confidence-based fallback
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MissionStateMachine, MissionState } from '@one4all/kernel';
import { handleRoutingState } from '../../src/lib/state-handlers/routing-handler.js';

describe('routing-handler', () => {
  let stateMachine: MissionStateMachine;

  beforeEach(() => {
    stateMachine = new MissionStateMachine({
      domainPath: '/home/dasimoa/one4all/domains',
    });
  });

  describe('handleRoutingState', () => {
    it('should route English valuation question to damodaran-valuation', async () => {
      const mission = stateMachine.createMission({
        type: 'stock_analysis',
        domain: 'investment-war-room',
        ticker: 'AAPL',
        description: 'Test mission',
        inquiry_mode: true,
        question: 'What is the fair value according to Damodaran?',
      });

      const nextState = await handleRoutingState(mission);

      expect(nextState).toBe(MissionState.EXECUTING_INQUIRY);

      // Check routing plan was stored
      const routingPlan = mission.state.brief?.owner_assumptions?.routing_plan;
      expect(routingPlan).toBeDefined();
      expect(routingPlan.selected_analysts).toContain('damodaran-valuation');
    });

    it('should route Thai risk question to downside-protection', async () => {
      const mission = stateMachine.createMission({
        type: 'stock_analysis',
        domain: 'investment-war-room',
        ticker: 'CPALL.BK',
        description: 'Test mission',
        inquiry_mode: true,
        question: 'ความเสี่ยงด้านลงมีอะไรบ้าง ตามมุม Klarman',
      });

      const nextState = await handleRoutingState(mission);

      expect(nextState).toBe(MissionState.EXECUTING_INQUIRY);

      const routingPlan = mission.state.brief?.owner_assumptions?.routing_plan;
      expect(routingPlan).toBeDefined();
      expect(routingPlan.selected_analysts).toContain('downside-protection');
    });

    it('should include devil-advocate for low confidence questions', async () => {
      const mission = stateMachine.createMission({
        type: 'stock_analysis',
        domain: 'investment-war-room',
        ticker: 'TSLA',
        description: 'Test mission',
        inquiry_mode: true,
        question: 'Is this a good investment?', // Vague question = low confidence
      });

      const nextState = await handleRoutingState(mission);

      expect(nextState).toBe(MissionState.EXECUTING_INQUIRY);

      const routingPlan = mission.state.brief?.owner_assumptions?.routing_plan;
      expect(routingPlan?.selected_analysts).toContain('devil-advocate');
    });

    it('should fallback to devil-advocate on routing failure', async () => {
      const mission = stateMachine.createMission({
        type: 'stock_analysis',
        domain: 'investment-war-room',
        ticker: 'UNKNOWN',
        description: 'Test mission',
        inquiry_mode: true,
        question: 'Analyze this unknown ticker',
      });

      const nextState = await handleRoutingState(mission);

      expect(nextState).toBe(MissionState.EXECUTING_INQUIRY);

      const routingPlan = mission.state.brief?.owner_assumptions?.routing_plan;
      expect(routingPlan?.selected_analysts).toContain('devil-advocate');
      expect(routingPlan?.fallback_to_devil_advocate).toBe(true);
    });
  });

  describe('parseRoutingPlan', () => {
    // Note: parseRoutingPlan is a private function, so we test it indirectly
    // through handleRoutingState behavior

    it('should filter out unknown analyst IDs', async () => {
      const mission = stateMachine.createMission({
        type: 'stock_analysis',
        domain: 'investment-war-room',
        ticker: 'TEST',
        description: 'Test mission',
        inquiry_mode: true,
        question: 'Test question',
      });

      const nextState = await handleRoutingState(mission);

      expect(nextState).toBe(MissionState.EXECUTING_INQUIRY);

      const routingPlan = mission.state.brief?.owner_assumptions?.routing_plan;
      expect(routingPlan).toBeDefined();

      // All selected analysts should be from known list
      const knownAnalysts = [
        'damodaran-valuation',
        'seth-klarman',
        'devil-advocate',
        'portfolio-manager',
        'consensus-analyst',
        'downside-protection',
        'greenwald-evasion',
        'kessler-moat',
        'klamran-quality',
        'michael-burry',
        'allocator-steward',
        'leveraged-franchise',
      ];

      for (const analyst of routingPlan?.selected_analysts || []) {
        expect(knownAnalysts).toContain(analyst);
      }
    });
  });
});
