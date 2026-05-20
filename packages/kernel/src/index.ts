/**
 * @one4all/kernel
 *
 * Company Kernel - the core orchestration logic of the one4all system
 */

export { MissionStateMachine } from './state-machine';
export { ContextManager } from './context-manager';

// State machine types and values
export type {
  Mission,
  Brief,
  TransitionResult,
  Decision,
  StateTransition,
  MissionConfig,
  MissionStateData,
  EvidencePackMetadata,
  DecisionState as SMDecisionState,
  FollowUpEvent as SMFollowUpEvent,
} from './state-machine/types';
export { MissionState } from './state-machine/types';

// Constitution Enforcer
export { ConstitutionEnforcer } from './constitution-enforcer';

// Journal Writer
export { JournalWriter } from './journal-writer';

// Debate Controller
export type {
  DebatePhase,
  ConvictionLevel,
  AnalystPosition,
  DebateContribution,
  DebateConfig,
  DebateSession,
  DebateResult,
  DebateSynthesisInput,
} from './debate-controller';
export { DebateController, createDebateController, DebateExecutor, createDebateExecutor } from './debate-controller';
export type { LLMAdapter, RoundResult, DebateExecutionResult } from './debate-controller';

// Evidence Controller
export {
  PackBuilder,
  createPackBuilder,
  EvidenceScorer,
  createEvidenceScorer,
  EvidenceController,
  createEvidenceController,
} from './evidence-controller';
export type {
  EvidenceSourceType,
  EvidenceSource,
  EvidenceItem,
  EvidencePack,
  SourceFetcherConfig,
  PackBuilderOptions,
  SourceFetchResult,
  PackBuildResult,
  EvidenceScoringWeights,
  SourceCategorization,
  ScoredEvidenceItem,
  EvidenceScorerConfig,
  EvidenceControllerConfig,
  EvidenceSummary,
} from './evidence-controller';

// Synthesis Engine (CIO)
export type {
  AnalystOutput,
  ConsensusAnalysis,
  EvidenceAssessment,
  SynthesisInput,
  SynthesisOutput,
  SynthesisConfig,
  DecisionDetermination,
} from './synthesis';
export { SynthesisEngine } from './synthesis';

// Report Generator
export type {
  ReportFormat,
  ReportSection,
  InvestmentReport,
  ReportTemplate,
  ReportGeneratorOptions,
} from './report';
export { ReportGenerator } from './report';

// Registry loaders
export * from './registry';

// Integration Layer
export * from './integration';

// Python Integration
export * from './python/types';
export { PythonDCFClient } from './python/dcf';

// Personas (analyst types and filtering)
export * from './personas/types';
