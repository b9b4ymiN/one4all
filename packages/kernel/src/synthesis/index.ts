/**
 * Synthesis Engine Module
 *
 * CIO synthesizer that combines analyst outputs into final investment decisions
 */

// Types
export type {
  AnalystOutput,
  ConsensusAnalysis,
  EvidenceAssessment,
  SynthesisInput,
  SynthesisOutput,
  SynthesisConfig,
  DecisionDetermination,
} from './types.js';

// Main class
export { SynthesisEngine } from './engine.js';
