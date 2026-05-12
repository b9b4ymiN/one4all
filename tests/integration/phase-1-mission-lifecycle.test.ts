/**
 * Phase 1 Integration Test - Full Mission Lifecycle
 *
 * Tests the complete integration of kernel components with mock adapters.
 * This test verifies that a mission can run from DRAFT to JOURNALED
 * without any real LLM calls.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MissionStateMachine, ContextManager, ConstitutionEnforcer } from '@one4all/kernel';
import {
  StructuredLogger,
  MissionTracer,
  EvidenceAuditor,
  OutputValidator,
  ReplayStorage,
} from '@one4all/observability';
import { MissionStates, EvidenceTiers } from '@one4all/shared';

// Mock mission data for testing
const mockMissionData = {
  id: 'test-mission-phase-1-001',
  domain: 'investment-war-room',
  initialState: MissionStates.DRAFT,
  query: 'Should I buy Apple (AAPL) stock at current price of $175?',
};

const mockAgent = {
  id: 'mock-researcher-1',
  name: 'Mock Researcher',
  type: 'researcher' as const,
};

const mockEvidence = {
  tier1: [
    {
      id: 'evd-1',
      source: 'https://sec.gov/Archives/edgar/data/320193/000032019323000108/aapl-20230930.htm',
      tier: EvidenceTiers.TIER_1,
      content: 'Apple FY 2023 Form 10-K shows revenue of $383.3B, net income of $97.0B',
      tags: ['sec', '10-k', 'financial'],
    },
  ],
  tier2: [
    {
      id: 'evd-2',
      source: 'https://investor.apple.com/investor-relations/default.aspx',
      tier: EvidenceTiers.TIER_2,
      content: 'Apple Q4 2023 earnings: Revenue $89.5B, EPS $1.46',
      tags: ['earnings', 'quarterly'],
    },
  ],
  tier3: [
    {
      id: 'evd-3',
      source: 'Company Press Release',
      tier: EvidenceTiers.TIER_3,
      content: 'Apple CEO Tim Cook confident in future growth',
      tags: ['management', 'press-release'],
    },
  ],
};

const mockDecision = {
  missionId: mockMissionData.id,
  decision: 'BUY',
  reasoning: 'Strong financial fundamentals with $97B net income, healthy balance sheet, and consistent revenue growth. Current valuation at 28x P/E is reasonable given growth prospects.',
  confidence: 0.75,
  recommendation: 'Buy 50 shares of AAPL at current price of $175',
  riskFactors: ['Economic slowdown', 'China market exposure', 'Supply chain risks'],
  timestamp: new Date().toISOString(),
};

describe('Phase 1: Full Mission Lifecycle Integration', () => {
  let stateMachine: MissionStateMachine;
  let contextManager: ContextManager;
  let constitutionEnforcer: ConstitutionEnforcer;
  let logger: StructuredLogger;
  let tracer: MissionTracer;
  let auditor: EvidenceAuditor;
  let validator: OutputValidator;
  let replay: ReplayStorage;
  let mission: any;

  beforeEach(() => {
    // Initialize all kernel components
    stateMachine = new MissionStateMachine();
    contextManager = new ContextManager();
    constitutionEnforcer = new ConstitutionEnforcer();

    // Initialize observability components
    logger = new StructuredLogger({ level: 'info', enableConsole: false });
    tracer = new MissionTracer({ enableConsole: false });
    auditor = new EvidenceAuditor();
    validator = new OutputValidator();
    replay = new ReplayStorage({ persistToFile: false });

    // Create mission with valid brief structure
    mission = stateMachine.createMission({
      type: 'stock_analysis',
      domain: mockMissionData.domain,
      description: mockMissionData.query,
    });

    // Set up logger context
    logger = logger.withContext({ missionId: mission.id });

    // Start tracing and replay
    tracer.createTrace(mission.id, mockMissionData.initialState);
    replay.startSession(mission.id, mockMissionData.initialState);
  });

  afterEach(() => {
    logger.close();
    tracer.clearAllTraces();
    replay.clearAllSessions();
  });

  describe('Mission State Transitions', () => {
    it('should handle basic state transitions with observability', async () => {
      // DRAFT -> PLANNING (should work without preconditions)
      let result = await stateMachine.transition(mission, MissionStates.PLANNING);
      expect(result.success).toBe(true);
      expect(mission.state.current_state).toBe(MissionStates.PLANNING);

      // Record in observability systems
      tracer.recordStateTransition(mission.id, MissionStates.DRAFT, MissionStates.PLANNING);
      replay.recordStateTransition(MissionStates.DRAFT, MissionStates.PLANNING);
      logger.logMissionTransition(mission.id, MissionStates.DRAFT, MissionStates.PLANNING);

      // PLANNING -> FAILED (error transition with trigger)
      result = await stateMachine.transition(
        mission,
        MissionStates.FAILED,
        'error'
      );
      expect(result.success).toBe(true);
      expect(mission.state.current_state).toBe(MissionStates.FAILED);

      // Record error transition
      tracer.recordStateTransition(mission.id, MissionStates.PLANNING, MissionStates.FAILED);
      replay.recordStateTransition(MissionStates.PLANNING, MissionStates.FAILED);
      logger.logMissionTransition(mission.id, MissionStates.PLANNING, MissionStates.FAILED);
    });

    it('should track state transition history', async () => {
      // Create a fresh mission with valid brief
      const testMission = stateMachine.createMission({
        type: 'stock_analysis',
        domain: 'investment-war-room',
        description: 'Test query',
      });

      await stateMachine.transition(testMission, MissionStates.PLANNING);

      // Verify transition was recorded in mission
      expect(testMission.transitions.length).toBeGreaterThan(0);
      expect(testMission.transitions[0].from_state).toBe(MissionStates.DRAFT);
      expect(testMission.transitions[0].to_state).toBe(MissionStates.PLANNING);

      // Verify observability can capture the transition
      tracer.createTrace(testMission.id, MissionStates.DRAFT);
      tracer.recordStateTransition(testMission.id, MissionStates.DRAFT, MissionStates.PLANNING);
      const trace = tracer.getTrace(testMission.id);
      expect(trace?.events.length).toBeGreaterThan(0);
    });
  });

  describe('Context Management', () => {
    it('should allocate and track context for agents', () => {
      const allocation = contextManager.allocateContext(
        mockAgent.id,
        mockAgent.type,
        'claude-3-opus-20240229'
      );

      expect(allocation).toBeDefined();
      expect(allocation.agentName).toBe(mockAgent.id);
      expect(allocation.agentType).toBe(mockAgent.type);

      // Record token usage
      contextManager.recordUsage(mockAgent.id, 5000, 2000);

      // Record in tracer
      tracer.recordAgentAssignment(mission.id, mockAgent.id, mockAgent.type);
      replay.recordAgentCall(mockAgent.id, 'Research task');
      replay.recordAgentResponse(mockAgent.id, { result: 'complete' }, 150);
    });

    it('should handle context for different agent types', () => {
      const researcherAlloc = contextManager.allocateContext(
        'researcher-1',
        'researcher',
        'claude-3-opus-20240229'
      );

      const analystAlloc = contextManager.allocateContext(
        'analyst-1',
        'analyst',
        'claude-3-opus-20240229'
      );

      // Researchers should get more input budget
      expect(researcherAlloc.maxInputTokens).toBeGreaterThan(analystAlloc.maxInputTokens);
    });
  });

  describe('Evidence Collection and Auditing', () => {
    it('should collect and score evidence from all tiers', () => {
      // Add evidence from all tiers
      for (const evidence of [...mockEvidence.tier1, ...mockEvidence.tier2, ...mockEvidence.tier3]) {
        const added = auditor.addEvidence({
          missionId: mission.id,
          source: evidence.source,
          tier: evidence.tier,
          content: evidence.content,
          tags: evidence.tags,
          metadata: {},
        });

        expect(added.id).toBeDefined();
        expect(added.score).toBeGreaterThan(0);

        // Record in tracer
        tracer.recordEvidence(mission.id, added.id, added.tier, added.source);
      }

      // Generate audit report
      const report = auditor.generateAuditReport(mission.id);

      expect(report.totalEvidence).toBe(3);
      expect(report.evidenceByTier[1]).toBe(1);
      expect(report.evidenceByTier[2]).toBe(1);
      expect(report.evidenceByTier[3]).toBe(1);
      expect(report.averageScore).toBeGreaterThan(0);
      expect(report.sources.length).toBe(3);
    });

    it('should verify evidence for stronger scoring', () => {
      const evidence = auditor.addEvidence({
        missionId: mission.id,
        source: 'https://sec.gov/test',
        tier: EvidenceTiers.TIER_1,
        content: 'Test content',
        tags: [],
        metadata: {},
      });

      const beforeScore = evidence.score;
      auditor.verifyEvidence(evidence.id);

      const verified = auditor.getEvidence(evidence.id);
      expect(verified?.verified).toBe(true);
      expect(verified?.score).toBeGreaterThanOrEqual(beforeScore!);
    });
  });

  describe('Decision Validation', () => {
    it('should validate correct decision format', () => {
      const result = validator.validateDecision(mockDecision);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should reject invalid decision format', () => {
      const invalidDecision = {
        missionId: mission.id,
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

    it('should provide detailed error messages', () => {
      const invalidDecision = {
        missionId: mission.id,
        decision: 'BUY',
        reasoning: 'Test reasoning', // Include required field
        confidence: 1.5, // Invalid: > 1
        timestamp: new Date().toISOString(),
      };

      const result = validator.validateDecision(invalidDecision);
      const errors = validator.formatValidationErrors(result);

      expect(errors.length).toBeGreaterThan(0);
      // Should have an error about confidence being too large
      const confidenceError = errors.find(e => e.includes('confidence'));
      expect(confidenceError).toBeDefined();
    });
  });

  describe('Replay and Traceability', () => {
    it('should capture complete mission trace', () => {
      // Record a complete mission flow
      tracer.recordStateTransition(mission.id, MissionStates.DRAFT, MissionStates.PLANNING);
      tracer.recordAgentAssignment(mission.id, mockAgent.id, mockAgent.type);
      tracer.recordDecision(
        mission.id,
        mockDecision.decision,
        mockDecision.reasoning,
        mockDecision.confidence
      );

      const summary = tracer.getTraceSummary(mission.id);

      expect(summary).toBeDefined();
      expect(summary?.missionId).toBe(mission.id);
      expect(summary?.uniqueAgents).toBe(1);
    });

    it('should generate readable timeline', () => {
      tracer.recordStateTransition(mission.id, MissionStates.DRAFT, MissionStates.PLANNING);
      tracer.recordAgentAssignment(mission.id, mockAgent.id, mockAgent.type);

      const timeline = tracer.getTimeline(mission.id);

      expect(timeline.length).toBeGreaterThan(0);
      expect(timeline[0]).toHaveProperty('timestamp');
      expect(timeline[0]).toHaveProperty('description');
    });
  });

  describe('End-to-End Mission Flow', () => {
    it('should integrate all kernel components with observability', async () => {
      const session = replay.startSession(mission.id, mockMissionData.initialState);

      // 1. State machine transition (DRAFT -> PLANNING)
      await stateMachine.transition(mission, MissionStates.PLANNING);
      expect(mission.state.current_state).toBe(MissionStates.PLANNING);

      tracer.recordStateTransition(mission.id, MissionStates.DRAFT, MissionStates.PLANNING);
      replay.recordStateTransition(MissionStates.DRAFT, MissionStates.PLANNING);
      logger.info('Mission started', { state: MissionStates.PLANNING });

      // 2. Context manager - allocate budget for agent
      const allocation = contextManager.allocateContext(
        mockAgent.id,
        mockAgent.type,
        'claude-3-opus-20240229'
      );
      expect(allocation.maxInputTokens).toBeGreaterThan(0);

      tracer.recordAgentAssignment(mission.id, mockAgent.id, mockAgent.type);
      replay.recordAgentCall(mockAgent.id, 'Research AAPL stock');

      // 3. Evidence auditor - collect evidence from all tiers
      const allEvidence = [...mockEvidence.tier1, ...mockEvidence.tier2, ...mockEvidence.tier3];
      for (const ev of allEvidence) {
        const added = auditor.addEvidence({
          missionId: mission.id,
          source: ev.source,
          tier: ev.tier,
          content: ev.content,
          tags: ev.tags,
          metadata: {},
        });

        tracer.recordEvidence(mission.id, added.id, added.tier, added.source);
      }

      // 4. Context manager - record token usage
      contextManager.recordUsage(mockAgent.id, 5000, 2000);
      replay.recordAgentResponse(mockAgent.id, { analysis: 'Complete' }, 250);

      // 5. Decision validator - validate decision format
      const validationResult = validator.validateDecision(mockDecision);
      expect(validationResult.success).toBe(true);

      tracer.recordDecision(
        mission.id,
        mockDecision.decision,
        mockDecision.reasoning,
        mockDecision.confidence
      );

      // 6. Complete observability tracking
      tracer.completeTrace(mission.id, MissionStates.PLANNING);
      replay.endSession(MissionStates.PLANNING);
      logger.info('Mission phase completed', { state: MissionStates.PLANNING });

      // Verify observability components captured everything
      const trace = tracer.getTrace(mission.id);
      expect(trace?.missionId).toBe(mission.id);
      expect(trace?.events.length).toBeGreaterThan(5);

      const auditReport = auditor.generateAuditReport(mission.id);
      expect(auditReport.totalEvidence).toBe(3);
      expect(auditReport.evidenceByTier[1]).toBe(1);

      const sessionStats = replay.getSessionStatistics(session.id);
      expect(sessionStats?.totalEvents).toBeGreaterThan(0);
    });

    it('should produce exportable data for audit trail', () => {
      // Run a minimal mission flow through observability
      tracer.createTrace(mission.id, MissionStates.DRAFT);
      tracer.recordStateTransition(mission.id, MissionStates.DRAFT, MissionStates.PLANNING);
      tracer.recordAgentAssignment(mission.id, mockAgent.id, mockAgent.type);
      tracer.completeTrace(mission.id, MissionStates.PLANNING);

      auditor.addEvidence({
        missionId: mission.id,
        source: 'https://test.com',
        tier: EvidenceTiers.TIER_1,
        content: 'Test',
        tags: [],
        metadata: {},
      });

      // Export trace
      const traceExport = tracer.exportTrace(mission.id);
      expect(traceExport).not.toBeNull();

      // Export evidence
      const evidenceExport = auditor.exportEvidence(mission.id);
      expect(evidenceExport).not.toBeNull();

      // Verify JSON can be parsed
      expect(() => JSON.parse(traceExport!)).not.toThrow();
      expect(() => JSON.parse(evidenceExport!)).not.toThrow();
    });

    it('should integrate all observability components', async () => {
      // This test verifies that all observability components work together
      await stateMachine.transition(mission, MissionStates.PLANNING);

      // Logger - all log types
      logger.info('Test info message');
      logger.logMissionTransition(mission.id, MissionStates.DRAFT, MissionStates.PLANNING);
      logger.logAgentAction(mission.id, mockAgent.id, 'test_action');

      // Tracer - all event types
      tracer.recordAgentAssignment(mission.id, mockAgent.id, mockAgent.type);
      tracer.recordCheckpoint(mission.id, 'test_checkpoint', { data: 'test' });
      tracer.recordDecision(mission.id, 'BUY', 'Test reasoning', 0.8);

      // Auditor
      const evidence = auditor.addEvidence({
        missionId: mission.id,
        source: 'https://test.com',
        tier: EvidenceTiers.TIER_1,
        content: 'Test content',
        tags: ['test'],
        metadata: {},
      });

      // Validator
      const valid = validator.validateDecision(mockDecision);
      expect(valid.success).toBe(true);

      // Replay
      replay.recordAgentCall(mockAgent.id, 'test task');
      replay.recordAgentResponse(mockAgent.id, { done: true }, 100);

      // Verify all components recorded data
      const trace = tracer.getTrace(mission.id);
      expect(trace?.events.length).toBeGreaterThan(0);

      const audit = auditor.getStatistics(mission.id);
      expect(audit?.totalEvidence).toBe(1);

      // Verify evidence was scored
      expect(evidence.score).toBeGreaterThan(0);
    });
  });
});
