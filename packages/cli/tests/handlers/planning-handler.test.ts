/**
 * Planning Handler Tests
 *
 * Tests for registry-based team composition and mission planning
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MissionStateMachine, MissionState } from '@one4all/kernel';
import { handlePlanningState } from '../../src/lib/state-handlers/planning-handler.js';

// Mock the registry connector
vi.mock('../../src/lib/registry-connector.js', () => ({
  getPersonaResolver: vi.fn(() => ({
    resolvePersonaPath: vi.fn(async () => '/mock/persona.md'),
    getKnownAnalysts: vi.fn(async () => [
      'researcher-set',
      'forensic-accountant',
      'damodaran-valuation',
      'seth-klarman',
      'portfolio-allocator',
      'cio-synthesizer',
      'devil-advocate',
      'consensus-analyst',
    ]),
  })),
  getDomainFromBrief: vi.fn((brief) => brief?.domain || 'investment-war-room'),
}));

describe('planning-handler', () => {
  let stateMachine: MissionStateMachine;
  let mockDomainConfig: any;

  beforeEach(() => {
    stateMachine = new MissionStateMachine({
      domainPath: '/home/dasimoa/one4all/domains',
    });
    vi.clearAllMocks();

    mockDomainConfig = {
      evidence_requirements: {
        minimum_sources: [{ tier: 'tier_1', count: 2 }],
        required_documents: ['10-k', '10-q'],
      },
    };
  });

  describe('handlePlanningState', () => {
    it('should create execution plan for stock analysis mission', async () => {
      const mission = stateMachine.createMission({
        type: 'stock_analysis',
        domain: 'investment-war-room',
        ticker: 'AAPL',
        description: 'Analyze Apple Inc',
      });

      const nextState = await handlePlanningState(mission, mockDomainConfig);

      expect(nextState).toBe(MissionState.RESEARCHING);
      expect(mission.state.config).toBeDefined();
      expect(mission.state.config?.required_agents).toBeDefined();
      expect(mission.state.config?.required_agents).toContain('researcher-set');
      expect(mission.state.config?.required_agents).toContain('forensic-accountant');
      expect(mission.state.config?.required_agents).toContain('damodaran-valuation');
    });

    it('should create execution plan for portfolio review mission', async () => {
      const mission = stateMachine.createMission({
        type: 'portfolio_review',
        domain: 'investment-war-room',
        ticker: 'PORTFOLIO',
        description: 'Review portfolio allocation',
      });

      const nextState = await handlePlanningState(mission, mockDomainConfig);

      expect(nextState).toBe(MissionState.RESEARCHING);
      expect(mission.state.config).toBeDefined();
      expect(mission.state.config?.required_agents).toContain('researcher-set');
      expect(mission.state.config?.required_agents).toContain('portfolio-allocator');
      expect(mission.state.config?.required_agents).toContain('cio-synthesizer');
    });

    it('should create execution plan for quick screen mission', async () => {
      const mission = stateMachine.createMission({
        type: 'quick_screen',
        domain: 'investment-war-room',
        ticker: 'TSLA',
        description: 'Quick screen',
      });

      const nextState = await handlePlanningState(mission, mockDomainConfig);

      expect(nextState).toBe(MissionState.RESEARCHING);
      expect(mission.state.config).toBeDefined();
      expect(mission.state.config?.required_agents).toContain('researcher-set');
      expect(mission.state.config?.required_agents).toContain('damodaran-valuation');
      expect(mission.state.config?.required_agents).toContain('cio-synthesizer');
    });

    it('should use base team for unknown mission types', async () => {
      const mission = stateMachine.createMission({
        type: 'unknown_type' as any,
        domain: 'investment-war-room',
        ticker: 'TEST',
        description: 'Unknown mission type',
      });

      const nextState = await handlePlanningState(mission, mockDomainConfig);

      expect(nextState).toBe(MissionState.RESEARCHING);
      expect(mission.state.config).toBeDefined();
      expect(mission.state.config?.required_agents).toContain('researcher-set');
    });

    it('should store evidence requirements from domain config', async () => {
      const mission = stateMachine.createMission({
        type: 'stock_analysis',
        domain: 'investment-war-room',
        ticker: 'AAPL',
        description: 'Test mission',
      });

      const customEvidenceConfig = {
        evidence_requirements: {
          minimum_sources: [{ tier: 'tier_1', count: 3 }],
          required_documents: ['10-k', '10-q', 'earnings-transcript'],
        },
      };

      await handlePlanningState(mission, customEvidenceConfig);

      expect(mission.state.config?.evidence_requirements).toEqual(
        customEvidenceConfig.evidence_requirements
      );
    });

    it('should set human checkpoints in config', async () => {
      const mission = stateMachine.createMission({
        type: 'stock_analysis',
        domain: 'investment-war-room',
        ticker: 'AAPL',
        description: 'Test mission',
      });

      await handlePlanningState(mission, mockDomainConfig);

      expect(mission.state.config?.human_checkpoints).toBeDefined();
      expect(mission.state.config?.human_checkpoints).toHaveLength(2);
      expect(mission.state.config?.human_checkpoints[0].after).toBe(MissionState.RESEARCHING);
      expect(mission.state.config?.human_checkpoints[1].after).toBe(MissionState.SYNTHESIZING);
    });

    it('should return RESEARCHING as next state', async () => {
      const mission = stateMachine.createMission({
        type: 'stock_analysis',
        domain: 'investment-war-room',
        ticker: 'AAPL',
        description: 'Test mission',
      });

      const nextState = await handlePlanningState(mission, mockDomainConfig);

      // Verify the handler returns RESEARCHING as the next state
      expect(nextState).toBe(MissionState.RESEARCHING);
    });

    it('should throw error when brief is missing', async () => {
      const mission = stateMachine.createMission({
        type: 'stock_analysis',
        domain: 'investment-war-room',
        ticker: 'AAPL',
        description: 'Test mission',
      });

      // Remove brief
      mission.state.brief = undefined;

      await expect(handlePlanningState(mission, mockDomainConfig)).rejects.toThrow(
        'Cannot plan mission: missing brief'
      );
    });

    it('should store mission metadata in config', async () => {
      const mission = stateMachine.createMission({
        type: 'stock_analysis',
        domain: 'investment-war-room',
        ticker: 'AAPL',
        description: 'Test mission',
      });

      await handlePlanningState(mission, mockDomainConfig);

      expect(mission.state.config?.mission_id).toBe(mission.id);
      expect(mission.state.config?.domain).toBe('investment-war-room');
      expect(mission.state.config?.mission_type).toBe('stock_analysis');
      expect(mission.state.config?.ticker).toBe('AAPL');
      expect(mission.state.config?.brief).toBeDefined();
    });
  });

  describe('Registry-based team composition', () => {
    it('should not contain hardcoded phantom IDs', async () => {
      const mission = stateMachine.createMission({
        type: 'stock_analysis',
        domain: 'investment-war-room',
        ticker: 'AAPL',
        description: 'Test mission',
      });

      await handlePlanningState(mission, mockDomainConfig);

      const team = mission.state.config?.required_agents || [];

      // Check for old phantom IDs that should NOT be present
      const phantomIds = [
        'phantom-analyst-1',
        'phantom-analyst-2',
        'phantom-analyst-3',
        'unknown-analyst',
      ];

      for (const phantomId of phantomIds) {
        expect(team).not.toContain(phantomId);
      }
    });

    it('should create valid team from available agents', async () => {
      const mission = stateMachine.createMission({
        type: 'stock_analysis',
        domain: 'investment-war-room',
        ticker: 'AAPL',
        description: 'Test mission',
      });

      await handlePlanningState(mission, mockDomainConfig);

      const team = mission.state.config?.required_agents || [];

      // All team members should be known analyst types
      const knownAnalystPatterns = [
        'researcher',
        'forensic',
        'damodaran',
        'klarman',
        'portfolio',
        'allocator',
        'synthesizer',
        'devil',
        'consensus',
      ];

      for (const analystId of team) {
        const matchesKnownPattern = knownAnalystPatterns.some(pattern =>
          analystId.toLowerCase().includes(pattern)
        );
        expect(matchesKnownPattern).toBe(true);
      }
    });

    it('should have appropriate team size for mission type', async () => {
      const stockAnalysisMission = stateMachine.createMission({
        type: 'stock_analysis',
        domain: 'investment-war-room',
        ticker: 'AAPL',
        description: 'Test mission',
      });

      await handlePlanningState(stockAnalysisMission, mockDomainConfig);

      const stockAnalysisTeam = stockAnalysisMission.state.config?.required_agents || [];

      // Stock analysis should have a reasonable team size (5-7 agents)
      expect(stockAnalysisTeam.length).toBeGreaterThanOrEqual(5);
      expect(stockAnalysisTeam.length).toBeLessThanOrEqual(7);

      // Portfolio review should have smaller team
      const portfolioReviewMission = stateMachine.createMission({
        type: 'portfolio_review',
        domain: 'investment-war-room',
        ticker: 'PORTFOLIO',
        description: 'Test mission',
      });

      await handlePlanningState(portfolioReviewMission, mockDomainConfig);

      const portfolioReviewTeam = portfolioReviewMission.state.config?.required_agents || [];

      // Portfolio review should have smaller team (3-4 agents)
      expect(portfolioReviewTeam.length).toBeGreaterThanOrEqual(3);
      expect(portfolioReviewTeam.length).toBeLessThanOrEqual(4);
    });

    it('should always include base researcher-set', async () => {
      const missionTypes = ['stock_analysis', 'portfolio_review', 'quick_screen'];

      for (const type of missionTypes) {
        const mission = stateMachine.createMission({
          type: type as any,
          domain: 'investment-war-room',
          ticker: 'TEST',
          description: 'Test mission',
        });

        await handlePlanningState(mission, mockDomainConfig);

        const team = mission.state.config?.required_agents || [];
        expect(team).toContain('researcher-set');
      }
    });
  });

  describe('Domain config handling', () => {
    it('should use default evidence requirements when not provided', async () => {
      const mission = stateMachine.createMission({
        type: 'stock_analysis',
        domain: 'investment-war-room',
        ticker: 'AAPL',
        description: 'Test mission',
      });

      const emptyConfig = {};

      await handlePlanningState(mission, emptyConfig);

      expect(mission.state.config?.evidence_requirements).toBeDefined();
      expect(mission.state.config?.evidence_requirements.minimum_sources).toBeDefined();
    });

    it('should preserve domain config evidence requirements', async () => {
      const mission = stateMachine.createMission({
        type: 'stock_analysis',
        domain: 'investment-war-room',
        ticker: 'AAPL',
        description: 'Test mission',
      });

      const customConfig = {
        evidence_requirements: {
          minimum_sources: [
            { tier: 'tier_1', count: 5 },
            { tier: 'tier_2', count: 3 },
          ],
          required_documents: ['10-k', '10-q', 'earnings-transcript', 'proxy-statement'],
        },
      };

      await handlePlanningState(mission, customConfig);

      expect(mission.state.config?.evidence_requirements).toEqual(customConfig.evidence_requirements);
    });
  });
});
