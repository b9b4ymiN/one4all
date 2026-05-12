/**
 * Evidence Controller exports
 *
 * Manages evidence pack building, scoring, and retrieval
 */

export { PackBuilder, createPackBuilder } from './pack-builder.js';
export { EvidenceScorer, createEvidenceScorer } from './scoring.js';
export { EvidenceController, createEvidenceController } from './controller.js';

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
} from './types.js';

export type {
  ScoredEvidenceItem,
  EvidenceScorerConfig,
} from './scoring.js';

export type {
  EvidenceControllerConfig,
  EvidenceSummary,
} from './controller.js';
