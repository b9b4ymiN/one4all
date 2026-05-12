/**
 * Integration tests for observability layer - full mission lifecycle
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StructuredLogger } from '../src/logger/structured-logger';
import { MissionTracer } from '../src/tracer/mission-tracer';
import { EvidenceAuditor } from '../src/auditor/evidence-auditor';
import { OutputValidator, DecisionOutputSchema, ResearchOutputSchema } from '../src/validator/output-validator';
import { ReplayStorage } from '../src/replay/replay-storage';
import { MissionStates, EvidenceTiers } from '@one4all/shared';

describe('Observability Layer - Mission Lifecycle Integration', () => {
  let logger: StructuredLogger;
  let tracer: MissionTracer;
  let auditor: EvidenceAuditor;
  let validator: OutputValidator;
  let replay: ReplayStorage;
  const testMissionId = 'test-mission-001';

  beforeEach(() => {
    logger = new StructuredLogger({ level: 'debug', enableConsole: false });
    tracer = new MissionTracer({ enableConsole: false });
    auditor = new EvidenceAuditor();
    validator = new OutputValidator();
    replay = new ReplayStorage({ persistToFile: false });
  });

  afterEach(() => {
    logger.close();
    tracer.clearAllTraces();
    replay.clearAllSessions();
  });

  describe('Full Mission Lifecycle', () => {
    it('should trace a complete mission from DRAFT to JOURNALED', () => {
      // Start mission
      tracer.createTrace(testMissionId, MissionStates.DRAFT);
      logger.info('Mission created', { missionId: testMissionId });

      // Start replay session
      replay.startSession(testMissionId, MissionStates.DRAFT);

      // Transition to PLANNING
      tracer.recordStateTransition(testMissionId, MissionStates.DRAFT, MissionStates.PLANNING);
      logger.logMissionTransition(testMissionId, MissionStates.DRAFT, MissionStates.PLANNING);
      replay.recordStateTransition(MissionStates.DRAFT, MissionStates.PLANNING);

      // Assign agents
      const agentId = 'research-agent-1';
      tracer.recordAgentAssignment(testMissionId, agentId, 'researcher');
      replay.recordAgentCall(agentId, 'Analyze financial data');
      logger.logAgentAction(testMissionId, agentId, 'Assigned as researcher');

      // Record agent response
      replay.recordAgentResponse(agentId, { result: 'analysis complete' }, 150);

      // Add evidence
      const evidence = auditor.addEvidence({
        missionId: testMissionId,
        source: 'https://sec.gov/files/test',
        tier: EvidenceTiers.TIER_1,
        content: 'SEC filing data shows revenue growth',
        tags: ['financial', 'sec'],
        metadata: { year: 2024 },
      });

      expect(evidence.id).toBeDefined();
      expect(evidence.score).toBeGreaterThan(0);

      tracer.recordEvidence(testMissionId, evidence.id, evidence.tier, evidence.source);

      // Transition through states
      const states = [
        MissionStates.RESEARCHING,
        MissionStates.ANALYZING,
        MissionStates.CROSS_QA,
        MissionStates.DEBATING,
        MissionStates.SYNTHESIZING,
        MissionStates.DECIDED,
        MissionStates.JOURNALED,
      ];

      let prevState = MissionStates.PLANNING;
      for (const state of states) {
        tracer.recordStateTransition(testMissionId, prevState, state);
        replay.recordStateTransition(prevState, state);
        logger.logMissionTransition(testMissionId, prevState, state);
        prevState = state;
      }

      // Complete trace and session
      tracer.completeTrace(testMissionId, MissionStates.JOURNALED);

      // Capture session ID before ending (endSession clears currentSession)
      const sessionId = replay.getCurrentSession()?.id || '';
      replay.endSession(MissionStates.JOURNALED);

      // Verify trace
      const trace = tracer.getTrace(testMissionId);
      expect(trace).toBeDefined();
      expect(trace?.metadata.finalState).toBe(MissionStates.JOURNALED);
      expect(trace?.metadata.totalDuration).toBeGreaterThan(0);

      // Verify session
      const stats = replay.getSessionStatistics(sessionId);
      expect(stats).toBeDefined();
      expect(stats?.totalEvents).toBeGreaterThan(0);
    });

    it('should handle mission errors and recovery', () => {
      tracer.createTrace(testMissionId, MissionStates.PLANNING);
      replay.startSession(testMissionId, MissionStates.PLANNING);

      // Record error
      const error = new Error('Mock API failure');
      tracer.recordError(testMissionId, error);
      replay.recordError(error, { phase: 'planning' });
      logger.error('Mock API failure', error, { missionId: testMissionId });

      // Verify error recorded
      const trace = tracer.getTrace(testMissionId);
      expect(trace?.metadata.errorCount).toBe(1);

      const errorEvents = tracer.getEvents(testMissionId, { eventType: 'error' });
      expect(errorEvents.length).toBe(1);

      // Verify session error
      const sessionStats = replay.getSessionStatistics(replay.getCurrentSession()?.id || '');
      expect(sessionStats?.errors).toBe(1);
    });
  });

  describe('Evidence Auditing', () => {
    it('should generate comprehensive audit report', () => {
      // Add evidence from different tiers
      auditor.addEvidence({
        missionId: testMissionId,
        source: 'https://sec.gov/test',
        tier: EvidenceTiers.TIER_1,
        content: 'Official SEC filing',
        tags: ['official'],
        metadata: {},
      });

      auditor.addEvidence({
        missionId: testMissionId,
        source: 'https://news.example.com/article',
        tier: EvidenceTiers.TIER_2,
        content: 'News article analysis',
        tags: ['news'],
        metadata: {},
      });

      auditor.addEvidence({
        missionId: testMissionId,
        source: 'Company Press Release',
        tier: EvidenceTiers.TIER_3,
        content: 'Management statement',
        tags: ['management'],
        metadata: {},
      });

      // Generate report
      const report = auditor.generateAuditReport(testMissionId);

      expect(report.totalEvidence).toBe(3);
      expect(report.evidenceByTier[1]).toBe(1);
      expect(report.evidenceByTier[2]).toBe(1);
      expect(report.evidenceByTier[3]).toBe(1);
      expect(report.averageScore).toBeGreaterThan(0);
      expect(report.sources.length).toBe(3);
      expect(report.recommendations.length).toBeGreaterThan(0);
    });

    it('should calculate evidence scores correctly', () => {
      const evidence = auditor.addEvidence({
        missionId: testMissionId,
        source: 'https://sec.gov/test',
        tier: EvidenceTiers.TIER_1,
        content: 'Test content',
        tags: [],
        metadata: {},
      });

      const score = auditor.calculateEvidenceScore(evidence);
      expect(score.totalScore).toBeGreaterThan(0);
      expect(score.tierScore).toBe(1.0); // Tier 1 gets full weight
      expect(score.breakdown.tier).toBe(1.0);
    });
  });

  describe('Output Validation', () => {
    it('should validate valid decision output', () => {
      const validDecision = {
        missionId: testMissionId,
        decision: 'BUY',
        reasoning: 'Strong financial metrics and growth potential',
        confidence: 0.85,
        recommendation: 'Buy 100 shares',
        timestamp: new Date().toISOString(),
      };

      const result = validator.validateDecision(validDecision);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should reject invalid decision output', () => {
      const invalidDecision = {
        missionId: testMissionId,
        decision: 'BUY',
        reasoning: 'Test',
        confidence: 1.5, // Invalid: > 1
        timestamp: new Date().toISOString(),
      };

      const result = validator.validateDecision(invalidDecision);
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.length).toBeGreaterThan(0);
    });

    it('should validate research output with findings', () => {
      const validResearch = {
        missionId: testMissionId,
        topic: 'Financial Analysis',
        findings: [
          {
            source: 'https://sec.gov/test',
            content: 'Revenue increased 20%',
            tier: 1,
            timestamp: new Date().toISOString(),
          },
        ],
        summary: 'Strong financial performance',
        confidence: 0.9,
        timestamp: new Date().toISOString(),
      };

      const result = validator.validateResearch(validResearch);
      expect(result.success).toBe(true);
    });
  });

  describe('Replay and Tracing', () => {
    it('should record and replay mission events', async () => {
      const session = replay.startSession(testMissionId, MissionStates.PLANNING);

      // Record events
      replay.recordAgentCall('agent-1', 'Task 1');
      replay.recordAgentResponse('agent-1', { result: 'done' }, 100);
      replay.recordDecision('BUY', 'Good prospects', 0.8);

      replay.endSession(MissionStates.DECIDED);

      // Replay events - use session.id from the returned session object
      const events: string[] = [];
      const success = await replay.replaySession(session.id, (event) => {
        events.push(event.type);
      });

      expect(success).toBe(true);
      expect(events).toContain('agent_call');
      expect(events).toContain('agent_response');
      expect(events).toContain('decision');
    });

    it('should generate mission timeline', () => {
      tracer.createTrace(testMissionId, MissionStates.DRAFT);
      tracer.recordStateTransition(testMissionId, MissionStates.DRAFT, MissionStates.PLANNING);
      tracer.recordAgentAssignment(testMissionId, 'agent-1', 'researcher');
      tracer.recordDecision(testMissionId, 'Test decision', 'Test reasoning', 0.8);

      const timeline = tracer.getTimeline(testMissionId);
      expect(timeline.length).toBeGreaterThan(0);
      expect(timeline[0]).toHaveProperty('timestamp');
      expect(timeline[0]).toHaveProperty('description');
    });
  });

  describe('Logger Context and Levels', () => {
    it('should maintain context across log entries', () => {
      const loggerWithContext = logger.withContext({ missionId: testMissionId, phase: 'research' });

      loggerWithContext.info('Test message with context');
      loggerWithContext.debug('Debug message');

      expect(loggerWithContext.getLevel()).toBe('debug');
    });

    it('should log specific mission events', () => {
      logger.logMissionTransition(testMissionId, 'DRAFT', 'PLANNING');
      logger.logAgentAction(testMissionId, 'agent-1', 'started_analysis');
      logger.logConstitutionViolation(testMissionId, 'rule-1', 'high', 'Test violation');

      // These methods should not throw
      expect(logger.getLevel()).toBeDefined();
    });

    it('should handle different log levels', () => {
      logger.setLevel('error');

      logger.error('Error message');
      logger.warn('Warn message');
      logger.info('Info message');
      logger.debug('Debug message');

      expect(logger.getLevel()).toBe('error');
    });
  });

  describe('Statistics and Reports', () => {
    it('should generate comprehensive trace summary', () => {
      tracer.createTrace(testMissionId, MissionStates.DRAFT);
      tracer.recordAgentAssignment(testMissionId, 'agent-1', 'researcher');
      tracer.recordAgentAssignment(testMissionId, 'agent-2', 'analyst');
      tracer.recordDecision(testMissionId, 'BUY', 'Good prospects', 0.8);

      const summary = tracer.getTraceSummary(testMissionId);
      expect(summary).toBeDefined();
      expect(summary?.missionId).toBe(testMissionId);
      expect(summary?.uniqueAgents).toBe(2);
    });

    it('should calculate evidence statistics', () => {
      auditor.addEvidence({
        missionId: testMissionId,
        source: 'https://sec.gov/test',
        tier: EvidenceTiers.TIER_1,
        content: 'Test',
        tags: [],
        metadata: {},
      });

      auditor.verifyEvidence(auditor.getEvidenceByMission(testMissionId)[0].id);

      const stats = auditor.getStatistics(testMissionId);
      expect(stats).toBeDefined();
      expect(stats?.totalEvidence).toBe(1);
      expect(stats?.verifiedCount).toBe(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing trace gracefully', () => {
      const result = tracer.getTrace('non-existent-mission');
      expect(result).toBeNull();
    });

    it('should handle missing evidence gracefully', () => {
      const result = auditor.getEvidence('non-existent-evidence');
      expect(result).toBeNull();
    });

    it('should handle validation errors with details', () => {
      const invalid = { invalidField: 'test' };
      const result = validator.validateDecision(invalid);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();

      const formatted = validator.formatValidationErrors(result);
      expect(formatted.length).toBeGreaterThan(0);
    });
  });
});
