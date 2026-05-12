/**
 * Debate Controller Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  DebateController,
  createDebateController,
} from '../debate-controller';
import {
  DebatePhase,
  ConvictionLevel,
  type DebateConfig,
  type DebateSession,
  type DebateContribution,
} from './types';
import { ConstitutionEnforcer } from '../constitution-enforcer/index.js';
import { EnforcementLevel } from '../constitution-enforcer/types.js';
import { EnforcementLevels } from '@one4all/shared';

describe('DebateController', () => {
  let debateController: DebateController;
  let mockConstitutionEnforcer: ConstitutionEnforcer;
  let mockDebateConfig: DebateConfig;

  beforeEach(() => {
    // Create mock constitution enforcer
    mockConstitutionEnforcer = {
      checkViolations: vi.fn().mockResolvedValue({
        approved: true,
        violations: [],
        warnings: [],
        retry_required: false,
        agent_failed: false,
      }),
      loadConstitution: vi.fn(),
      getApplicableRules: vi.fn().mockReturnValue([]),
    } as unknown as ConstitutionEnforcer;

    debateController = new DebateController({
      constitutionEnforcer: mockConstitutionEnforcer,
      enabled: true,
    });

    mockDebateConfig = {
      mission_id: 'mission-123',
      domain: 'investment-war-room',
      participating_analysts: ['damodaran-valuation', 'downside-protection', 'allocation-analyst'],
      max_rounds: 3,
      max_contributions_per_round: 5,
      convergence_threshold: 30,
      timeout_ms: 300000,
      constitution_strict: true,
    };
  });

  describe('createDebate', () => {
    it('should create a new debate session', () => {
      const session = debateController.createDebate(mockDebateConfig);

      expect(session).toBeDefined();
      expect(session.mission_id).toBe('mission-123');
      expect(session.current_phase).toBe(DebatePhase.INITIALIZATION);
      expect(session.current_round).toBe(0);
      expect(session.contributions).toHaveLength(0);
      expect(session.positions.size).toBe(0);
      expect(session.converged).toBe(false);
    });

    it('should generate unique debate IDs', () => {
      const session1 = debateController.createDebate(mockDebateConfig);
      const session2 = debateController.createDebate(mockDebateConfig);

      expect(session1.id).not.toBe(session2.id);
    });

    it('should merge default config with provided config', () => {
      const partialConfig: Partial<DebateConfig> = {
        mission_id: 'mission-456',
        domain: 'investment-war-room',
        participating_analysts: ['analyst-1'],
      };

      const session = debateController.createDebate(partialConfig as DebateConfig);

      expect(session.config.max_rounds).toBe(3);
      expect(session.config.max_contributions_per_round).toBe(5);
      expect(session.config.convergence_threshold).toBe(30);
    });
  });

  describe('initializePositions', () => {
    it('should initialize analyst positions', () => {
      const session = debateController.createDebate(mockDebateConfig);

      debateController.initializePositions(session.id, [
        {
          analyst_id: 'damodaran-valuation',
          stance: 'bullish',
          thesis_summary: 'Fair value $45 based on DCF',
          conviction_score: 75,
        },
        {
          analyst_id: 'downside-protection',
          stance: 'bearish',
          thesis_summary: 'Significant downside risk from competition',
          conviction_score: 60,
        },
      ]);

      const positions = session.positions;
      expect(positions.size).toBe(2);

      const bullishPosition = positions.get('damodaran-valuation');
      expect(bullishPosition?.stance).toBe('bullish');
      expect(bullishPosition?.conviction).toBe(ConvictionLevel.HIGH);
      expect(bullishPosition?.conviction_score).toBe(75);
      expect(bullishPosition?.thesis_summary).toBe('Fair value $45 based on DCF');

      const bearishPosition = positions.get('downside-protection');
      expect(bearishPosition?.stance).toBe('bearish');
      expect(bearishPosition?.conviction).toBe(ConvictionLevel.HIGH);
      expect(bearishPosition?.conviction_score).toBe(60);

      // Phase should transition to OPENING_STATEMENTS
      expect(session.current_phase).toBe(DebatePhase.OPENING_STATEMENTS);
    });

    it('should default conviction to MODERATE when not provided', () => {
      const session = debateController.createDebate(mockDebateConfig);

      debateController.initializePositions(session.id, [
        {
          analyst_id: 'test-analyst',
          stance: 'neutral',
          thesis_summary: 'Neutral view',
        },
      ]);

      const position = session.positions.get('test-analyst');
      expect(position?.conviction).toBe(ConvictionLevel.MODERATE);
      expect(position?.conviction_score).toBe(50);
    });

    it('should throw error for non-existent debate', () => {
      expect(() => {
        debateController.initializePositions('non-existent', []);
      }).toThrow('Debate session not found');
    });
  });

  describe('submitContribution', () => {
    let session: DebateSession;

    beforeEach(() => {
      session = debateController.createDebate(mockDebateConfig);
      debateController.initializePositions(session.id, [
        {
          analyst_id: 'damodaran-valuation',
          stance: 'bullish',
          thesis_summary: 'Bullish thesis',
          conviction_score: 75,
        },
      ]);
    });

    it('should accept valid contribution', async () => {
      const result = await debateController.submitContribution(
        session.id,
        'damodaran-valuation',
        'Based on my DCF analysis, fair value is $45',
        80
      );

      expect(result.approved).toBe(true);
      expect(result.contribution).toBeDefined();
      expect(result.contribution?.content).toBe('Based on my DCF analysis, fair value is $45');
      expect(result.contribution?.conviction_score).toBe(80);
      expect(result.violations).toHaveLength(0);
    });

    it('should record contribution in session', async () => {
      await debateController.submitContribution(
        session.id,
        'damodaran-valuation',
        'My opening statement',
        75
      );

      expect(session.contributions).toHaveLength(1);
      const contribution = session.contributions[0];
      expect(contribution.analyst_id).toBe('damodaran-valuation');
      expect(contribution.phase).toBe(DebatePhase.OPENING_STATEMENTS);
      expect(contribution.content).toBe('My opening statement');
    });

    it('should support referencing other analysts', async () => {
      const result = await debateController.submitContribution(
        session.id,
        'damodaran-valuation',
        'I disagree with the downside analyst',
        70,
        ['downside-protection']
      );

      expect(result.contribution?.referenced_analysts).toEqual(['downside-protection']);
    });

    it('should reject contribution with constitution violations when strict', async () => {
      vi.mocked(mockConstitutionEnforcer.checkViolations).mockResolvedValueOnce({
        approved: false,
        violations: [{
          rule_id: 'rule-1',
          agent_id: 'damodaran-valuation',
          mission_id: 'mission-123',
          severity: EnforcementLevel.REJECT_OUTPUT,
          description: 'Missing evidence citation',
          detected_at: new Date(),
          retry_count: 0,
        }],
        warnings: [],
        retry_required: true,
        agent_failed: false,
      });

      const result = await debateController.submitContribution(
        session.id,
        'damodaran-valuation',
        'Unsubstantiated claim',
        50
      );

      expect(result.approved).toBe(false);
      expect(result.violations).toContain('Missing evidence citation');
      expect(session.moderation_actions).toHaveLength(1);
      expect(session.moderation_actions[0].type).toBe('retry_required');
    });

    it('should allow contribution with violations when not strict', async () => {
      session.config.constitution_strict = false;

      vi.mocked(mockConstitutionEnforcer.checkViolations).mockResolvedValueOnce({
        approved: false,
        violations: [{
          rule_id: 'rule-1',
          agent_id: 'damodaran-valuation',
          mission_id: 'mission-123',
          severity: EnforcementLevel.WARN_AND_FLAG,
          description: 'Weak evidence',
          detected_at: new Date(),
          retry_count: 0,
        }],
        warnings: ['Consider adding more evidence'],
        retry_required: false,
        agent_failed: false,
      });

      const result = await debateController.submitContribution(
        session.id,
        'damodaran-valuation',
        'Weak claim',
        50
      );

      expect(result.approved).toBe(true);
      expect(result.contribution).toBeDefined();
      expect(result.warnings).toContain('Consider adding more evidence');
    });

    it('should update analyst position after contribution', async () => {
      const initialPosition = session.positions.get('damodaran-valuation');
      expect(initialPosition?.key_arguments).toHaveLength(0);

      await debateController.submitContribution(
        session.id,
        'damodaran-valuation',
        'First argument. Second argument. Third argument.',
        85
      );

      const updatedPosition = session.positions.get('damodaran-valuation');
      expect(updatedPosition?.conviction_score).toBe(85);
      expect(updatedPosition?.conviction).toBe(ConvictionLevel.VERY_HIGH);
      expect(updatedPosition?.key_arguments.length).toBeGreaterThan(0);
    });
  });

  describe('transitionPhase', () => {
    let session: DebateSession;

    beforeEach(() => {
      session = debateController.createDebate(mockDebateConfig);
      debateController.initializePositions(session.id, [
        {
          analyst_id: 'analyst-1',
          stance: 'bullish',
          thesis_summary: 'Bull',
          conviction_score: 70,
        },
      ]);
    });

    it('should allow valid phase transitions', () => {
      const result = debateController.transitionPhase(
        session.id,
        DebatePhase.REBUTTAL,
        'Opening statements complete'
      );

      expect(result.allowed).toBe(true);
      expect(result.next_phase).toBe(DebatePhase.REBUTTAL);
      expect(session.current_phase).toBe(DebatePhase.REBUTTAL);
      expect(session.current_round).toBe(1);
    });

    it('should record phase history', () => {
      debateController.transitionPhase(session.id, DebatePhase.REBUTTAL, 'Reason 1');
      debateController.transitionPhase(session.id, DebatePhase.CROSS_EXAMINATION, 'Reason 2');

      expect(session.phase_history).toHaveLength(3); // Including initial transition
      expect(session.phase_history[1].from).toBe(DebatePhase.OPENING_STATEMENTS);
      expect(session.phase_history[1].to).toBe(DebatePhase.REBUTTAL);
    });

    it('should reject invalid phase transitions', () => {
      const result = debateController.transitionPhase(
        session.id,
        DebatePhase.COMPLETED,
        'Skip to end'
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Cannot transition');
      expect(session.current_phase).toBe(DebatePhase.OPENING_STATEMENTS);
    });

    it('should enforce round limits', () => {
      session.current_round = 3;
      session.config.max_rounds = 3;

      const result = debateController.transitionPhase(
        session.id,
        DebatePhase.REBUTTAL,
        'Try another round'
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Maximum rounds reached');
    });
  });

  describe('checkConvergence', () => {
    it('should detect convergence when conviction scores are close', () => {
      const session = debateController.createDebate(mockDebateConfig);
      session.current_phase = DebatePhase.CLOSING_ARGUMENTS;

      debateController.initializePositions(session.id, [
        { analyst_id: 'bull-1', stance: 'bullish', thesis_summary: 'Bull', conviction_score: 55 },
        { analyst_id: 'bear-1', stance: 'bearish', thesis_summary: 'Bear', conviction_score: 60 },
      ]);

      const converged = debateController.checkConvergence(session);

      expect(converged).toBe(true);
      expect(session.converged).toBe(true);
      expect(session.current_phase).toBe(DebatePhase.CONVERGENCE);
    });

    it('should not converge when conviction scores are far apart', () => {
      const session = debateController.createDebate(mockDebateConfig);
      session.current_phase = DebatePhase.CLOSING_ARGUMENTS;

      debateController.initializePositions(session.id, [
        { analyst_id: 'bull-1', stance: 'bullish', thesis_summary: 'Bull', conviction_score: 90 },
        { analyst_id: 'bear-1', stance: 'bearish', thesis_summary: 'Bear', conviction_score: 20 },
      ]);

      const converged = debateController.checkConvergence(session);

      expect(converged).toBe(false);
      expect(session.converged).toBe(false);
    });

    it('should not converge with fewer than 2 analysts', () => {
      const session = debateController.createDebate(mockDebateConfig);
      session.current_phase = DebatePhase.CLOSING_ARGUMENTS;

      debateController.initializePositions(session.id, [
        { analyst_id: 'lonely-analyst', stance: 'neutral', thesis_summary: 'Alone', conviction_score: 50 },
      ]);

      const converged = debateController.checkConvergence(session);

      expect(converged).toBe(false);
    });
  });

  describe('completeDebate', () => {
    let session: DebateSession;

    beforeEach(() => {
      session = debateController.createDebate(mockDebateConfig);
      debateController.initializePositions(session.id, [
        {
          analyst_id: 'bull-1',
          stance: 'bullish',
          thesis_summary: 'Bullish thesis',
          conviction_score: 70,
        },
        {
          analyst_id: 'bear-1',
          stance: 'bearish',
          thesis_summary: 'Bearish thesis',
          conviction_score: 60,
        },
      ]);
    });

    it('should complete debate successfully', () => {
      const result = debateController.completeDebate(session.id);

      expect(result.success).toBe(true);
      expect(result.debate_id).toBe(session.id);
      expect(result.total_rounds).toBe(1);
      expect(result.positions).toHaveLength(2);
      expect(result.failed_analysts).toHaveLength(0);
      expect(session.completed_at).toBeDefined();
      expect(session.current_phase).toBe(DebatePhase.COMPLETED);
    });

    it('should include synthesis input in result', () => {
      const result = debateController.completeDebate(session.id);

      expect(result.synthesis_input).toBeDefined();
      expect(result.synthesis_input.mission_id).toBe('mission-123');
      expect(result.synthesis_input.debate_id).toBe(session.id);
      expect(result.synthesis_input.final_positions).toHaveLength(2);
      expect(result.synthesis_input.conviction_distribution).toBeDefined();
    });

    it('should report failed analysts', () => {
      session.moderation_actions.push({
        type: 'rejection',
        analyst_id: 'bull-1',
        reason: 'Constitution violation',
        timestamp: new Date(),
      });

      const result = debateController.completeDebate(session.id);

      expect(result.success).toBe(false);
      expect(result.failed_analysts).toContain('bull-1');
    });

    it('should count constitution violations', () => {
      session.moderation_actions.push(
        { type: 'warning', analyst_id: 'bull-1', reason: 'Warning', timestamp: new Date() },
        { type: 'rejection', analyst_id: 'bear-1', reason: 'Violation', timestamp: new Date() }
      );

      const result = debateController.completeDebate(session.id);

      expect(result.constitution_violations).toBe(1); // Only non-warnings
    });
  });

  describe('getDebateStats', () => {
    let session: DebateSession;

    beforeEach(async () => {
      session = debateController.createDebate(mockDebateConfig);
      debateController.initializePositions(session.id, [
        { analyst_id: 'analyst-1', stance: 'bullish', thesis_summary: 'Bull', conviction_score: 70 },
        { analyst_id: 'analyst-2', stance: 'bearish', thesis_summary: 'Bear', conviction_score: 50 },
      ]);

      await debateController.submitContribution(session.id, 'analyst-1', 'Statement 1', 70);
      await debateController.submitContribution(session.id, 'analyst-2', 'Statement 2', 50);
      await debateController.submitContribution(session.id, 'analyst-1', 'Statement 3', 80);
    });

    it('should return debate statistics', () => {
      const stats = debateController.getDebateStats(session.id);

      expect(stats).toBeDefined();
      expect(stats?.total_contributions).toBe(3);
      expect(stats?.contributions_by_analyst['analyst-1']).toBe(2);
      expect(stats?.contributions_by_analyst['analyst-2']).toBe(1);
      expect(stats?.average_conviction).toBeCloseTo(66.67, 1);
      expect(stats?.conviction_range.min).toBe(50);
      expect(stats?.conviction_range.max).toBe(80);
    });

    it('should return null for non-existent debate', () => {
      const stats = debateController.getDebateStats('non-existent');
      expect(stats).toBeNull();
    });
  });

  describe('getMissionDebates', () => {
    it('should return all active debates for a mission', () => {
      const session1 = debateController.createDebate(mockDebateConfig);
      const session2 = debateController.createDebate(mockDebateConfig);

      // Complete one debate
      debateController.completeDebate(session1.id);

      const activeDebates = debateController.getMissionDebates('mission-123');

      expect(activeDebates).toHaveLength(1);
      expect(activeDebates[0].id).toBe(session2.id);
    });
  });

  describe('Conviction Level Determination', () => {
    it('should correctly determine conviction levels', () => {
      const session = debateController.createDebate(mockDebateConfig);

      debateController.initializePositions(session.id, [
        { analyst_id: 'very-low', stance: 'neutral', thesis_summary: 'Test', conviction_score: 10 },
        { analyst_id: 'low', stance: 'neutral', thesis_summary: 'Test', conviction_score: 30 },
        { analyst_id: 'moderate', stance: 'neutral', thesis_summary: 'Test', conviction_score: 50 },
        { analyst_id: 'high', stance: 'neutral', thesis_summary: 'Test', conviction_score: 70 },
        { analyst_id: 'very-high', stance: 'neutral', thesis_summary: 'Test', conviction_score: 90 },
      ]);

      expect(session.positions.get('very-low')?.conviction).toBe(ConvictionLevel.VERY_LOW);
      expect(session.positions.get('low')?.conviction).toBe(ConvictionLevel.LOW);
      expect(session.positions.get('moderate')?.conviction).toBe(ConvictionLevel.MODERATE);
      expect(session.positions.get('high')?.conviction).toBe(ConvictionLevel.HIGH);
      expect(session.positions.get('very-high')?.conviction).toBe(ConvictionLevel.VERY_HIGH);
    });
  });

  describe('Controller Configuration', () => {
    it('should be enabled by default', () => {
      const controller = new DebateController();
      expect(controller.isEnabled()).toBe(true);
    });

    it('should respect enabled flag in constructor', () => {
      const controller = new DebateController({ enabled: false });
      expect(controller.isEnabled()).toBe(false);
    });

    it('should allow toggling enabled state', () => {
      debateController.setEnabled(false);
      expect(debateController.isEnabled()).toBe(false);

      debateController.setEnabled(true);
      expect(debateController.isEnabled()).toBe(true);
    });

    it('should skip constitution checks when disabled', async () => {
      debateController.setEnabled(false);

      const session = debateController.createDebate(mockDebateConfig);
      debateController.initializePositions(session.id, [
        { analyst_id: 'analyst-1', stance: 'neutral', thesis_summary: 'Test', conviction_score: 50 },
      ]);

      // Constitution enforcer should not be called
      const result = await debateController.submitContribution(
        session.id,
        'analyst-1',
        'Any content',
        50
      );

      expect(result.approved).toBe(true);
      expect(mockConstitutionEnforcer.checkViolations).not.toHaveBeenCalled();
    });
  });

  describe('clear', () => {
    it('should clear all debate sessions', () => {
      debateController.createDebate(mockDebateConfig);
      debateController.createDebate(mockDebateConfig);

      debateController.clear();

      const session = debateController.getDebateSession('any-id');
      expect(session).toBeUndefined();
    });
  });
});
