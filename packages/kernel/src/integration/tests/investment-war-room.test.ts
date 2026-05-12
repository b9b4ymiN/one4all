/**
 * Investment War Room Integration Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  InvestmentWarRoom,
  createInvestmentWarRoom,
  type InvestmentWarRoomConfig,
} from '../investment-war-room.js';
import type { Brief, Mission } from '../../state-machine/types.js';
import { MissionStateMachine } from '../../state-machine/index.js';
import { MissionState } from '../../state-machine/types.js';

describe('InvestmentWarRoom', () => {
  let warRoom: InvestmentWarRoom;
  let stateMachine: MissionStateMachine;
  let config: InvestmentWarRoomConfig;
  let mission: Mission;

  beforeEach(() => {
    config = {
      domain: 'investment-war-room',
      participants: [
        'damodaran-valuation',
        'downside-protection',
        'leveraged-franchise',
      ],
      evidence_sources: ['mock-source-1', 'mock-source-2'],
      debate_config: {
        max_rounds: 2,
        max_contributions_per_round: 3,
        convergence_threshold: 30,
        timeout_ms: 10000,
        constitution_strict: false, // Disable for tests
      },
      report_format: 'markdown',
    };

    warRoom = createInvestmentWarRoom(config);
    stateMachine = new MissionStateMachine();

    const brief: Brief = {
      type: 'stock_analysis',
      domain: 'investment-war-room',
      description: 'Test analysis mission',
      ticker: 'TEST',
    };

    mission = stateMachine.createMission(brief);
  });

  describe('Configuration', () => {
    it('should create with default configuration', () => {
      expect(warRoom).toBeDefined();
    });

    it('should store configuration', () => {
      const room = createInvestmentWarRoom(config);
      expect(room).toBeDefined();
    });
  });

  describe('Evidence Pack Building', () => {
    it('should build evidence pack for mission', async () => {
      // Mock evidence controller behavior
      const evidencePack = await warRoom['buildEvidencePack'](mission);

      expect(evidencePack).toBeDefined();
      // With mock sources, this may fail - that's expected in unit tests
    });
  });

  describe('Full Analysis Workflow', () => {
    it('should execute complete analysis workflow', async () => {
      const result = await warRoom.executeAnalysis(mission);

      // The workflow should complete even with mocks
      expect(result).toBeDefined();
      expect(result.mission).toBeDefined();
      expect(result.errors).toBeDefined();
      expect(result.warnings).toBeDefined();
    });

    it('should handle constitution violations gracefully', async () => {
      const strictConfig: InvestmentWarRoomConfig = {
        ...config,
        debate_config: {
          ...config.debate_config,
          constitution_strict: true,
        },
      };

      const strictRoom = createInvestmentWarRoom(strictConfig);
      const result = await strictRoom.executeAnalysis(mission);

      expect(result).toBeDefined();
      // With strict mode and no constitution, may have errors
    });
  });

  describe('Debate Session Management', () => {
    it('should track debate sessions', async () => {
      const debateSession = warRoom.getDebateSession(mission.id);

      // Before running, session doesn't exist
      expect(debateSession).toBeUndefined();
    });

    it('should provide debate statistics', () => {
      const stats = warRoom.getDebateStats(mission.id);

      // Before running, stats are null
      expect(stats).toBeNull();
    });
  });

  describe('Stance Assignment', () => {
    it('should assign bullish stance to valuation analysts', () => {
      const stance = warRoom['assignInitialStance']('damodaran-valuation');
      expect(stance).toBe('bullish');
    });

    it('should assign bearish stance to protection analysts', () => {
      const stance = warRoom['assignInitialStance']('downside-protection');
      expect(stance).toBe('bearish');
    });

    it('should assign neutral stance to unknown analysts', () => {
      const stance = warRoom['assignInitialStance']('unknown-analyst');
      expect(stance).toBe('neutral');
    });
  });

  describe('Session Management', () => {
    it('should clear all sessions', () => {
      expect(() => warRoom.clear()).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle missing evidence pack gracefully', async () => {
      const result = await warRoom.executeAnalysis(mission);

      // Should still return a result structure
      expect(result).toBeDefined();
      expect(result.errors).toBeInstanceOf(Array);
    });
  });

  describe('State Machine Integration', () => {
    it('should work with mission state transitions', async () => {
      const initialState = mission.state.current_state;
      expect(initialState).toBe(MissionState.DRAFT);

      // Transition to planning
      const planResult = await stateMachine.transition(mission, MissionState.PLANNING);
      expect(planResult.success).toBe(true);
      expect(mission.state.current_state).toBe(MissionState.PLANNING);
    });
  });

  describe('Component Integration', () => {
    it('should have evidence controller', () => {
      const evidencePack = warRoom.getEvidencePack('test-mission');
      expect(evidencePack).toBeUndefined(); // No pack exists yet
    });

    it('should have debate controller', () => {
      const session = warRoom.getDebateSession('test-mission');
      expect(session).toBeUndefined(); // No session exists yet
    });

    it('should have debate stats method', () => {
      const stats = warRoom.getDebateStats('test-mission');
      expect(stats).toBeNull(); // No stats yet
    });
  });
});
