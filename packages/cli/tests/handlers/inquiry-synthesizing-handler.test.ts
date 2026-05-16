/**
 * Inquiry Synthesizing Handler Tests
 *
 * Tests for formatting inquiry responses in different patterns
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MissionStateMachine, MissionState } from '@one4all/kernel';
import { handleInquirySynthesizingState } from '../../src/lib/state-handlers/inquiry-synthesizing-handler.js';

describe('inquiry-synthesizing-handler', () => {
  let stateMachine: MissionStateMachine;

  beforeEach(() => {
    stateMachine = new MissionStateMachine({
      domainPath: '/home/dasimoa/one4all/domains',
    });
  });

  describe('handleInquirySynthesizingState', () => {
    it('should format single agent response', async () => {
      const mission = stateMachine.createMission({
        type: 'stock_analysis',
        domain: 'investment-war-room',
        ticker: 'AAPL',
        description: 'Test mission',
        inquiry_mode: true,
        question: 'What is the fair value?',
      });

      // Mock single agent output with correct structure
      mission.state.analyst_outputs = {
        inquiry_responses: [
          {
            analyst_id: 'consensus-analyst',
            response: 'Fair value around $150 based on consensus estimates',
            insights: ['Strong earnings growth', 'Market leader'],
            what_would_change_my_mind: ['Earnings miss', 'Guidance cut'],
            success: true,
          },
        ],
      };

      const nextState = await handleInquirySynthesizingState(mission);

      expect(nextState).toBe(MissionState.DELIVERABLE);
      expect(mission.state.synthesis_output).toBeDefined();
      expect(mission.state.synthesis_output?.format).toBe('single_agent');
    });

    it('should format debate response (two conflicting agents)', async () => {
      const mission = stateMachine.createMission({
        type: 'stock_analysis',
        domain: 'investment-war-room',
        ticker: 'AAPL',
        description: 'Test mission',
        inquiry_mode: true,
        question: 'Bull vs Bear case?',
      });

      // Mock debate outputs with correct structure
      mission.state.analyst_outputs = {
        inquiry_responses: [
          {
            analyst_id: 'damodaran-valuation',
            response: 'Bullish: $200 based on DCF',
            insights: ['Strong growth potential'],
            what_would_change_my_mind: ['Growth slowdown'],
            success: true,
          },
          {
            analyst_id: 'seth-klarman',
            response: 'Bearish: $120 with margin of safety',
            insights: ['Overvalued market'],
            what_would_change_my_mind: ['Price below $100'],
            success: true,
          },
        ],
      };

      const nextState = await handleInquirySynthesizingState(mission);

      expect(nextState).toBe(MissionState.DELIVERABLE);
      expect(mission.state.synthesis_output).toBeDefined();
      expect(mission.state.synthesis_output?.format).toBe('debate');
    });

    it('should format deliverable response (multiple analysts)', async () => {
      const mission = stateMachine.createMission({
        type: 'stock_analysis',
        domain: 'investment-war-room',
        ticker: 'AAPL',
        description: 'Test mission',
        inquiry_mode: true,
        question: 'Full analysis',
      });

      // Mock multiple agent outputs with correct structure
      mission.state.analyst_outputs = {
        inquiry_responses: [
          {
            analyst_id: 'damodaran-valuation',
            response: 'DCF suggests $180',
            insights: ['Solid fundamentals'],
            what_would_change_my_mind: [],
            success: true,
          },
          {
            analyst_id: 'klarman-downside',
            response: 'Downside case at $140',
            insights: ['Risk factors present'],
            what_would_change_my_mind: [],
            success: true,
          },
          {
            analyst_id: 'consensus-analyst',
            response: 'Consensus at $165',
            insights: ['Market sentiment positive'],
            what_would_change_my_mind: [],
            success: true,
          },
        ],
      };

      const nextState = await handleInquirySynthesizingState(mission);

      expect(nextState).toBe(MissionState.DELIVERABLE);
      expect(mission.state.synthesis_output).toBeDefined();
      expect(mission.state.synthesis_output?.format).toBe('deliverable');
    });

    it('should handle Thai language output', async () => {
      const mission = stateMachine.createMission({
        type: 'stock_analysis',
        domain: 'investment-war-room',
        ticker: 'CPALL.BK',
        description: 'Test mission',
        inquiry_mode: true,
        question: 'คำนวณมูลค่าหลักทรัพย์ CPALL ให้หน่อย',
      });

      mission.state.analyst_outputs = {
        inquiry_responses: [
          {
            analyst_id: 'damodaran-valuation',
            response: 'มูลค่าหลักทรัพย์ที่เหมาะสมประมาณ 60 บาท',
            insights: ['เติบโตดี', 'มีโมเดลธุรกิจที่เข้มแข็ง'],
            what_would_change_my_mind: [],
            success: true,
          },
        ],
      };

      const nextState = await handleInquirySynthesizingState(mission);

      expect(nextState).toBe(MissionState.DELIVERABLE);
      const result = mission.state.synthesis_output;
      expect(result).toBeDefined();
      expect(result?.content).toContain('CPALL.BK');
    });
  });
});
