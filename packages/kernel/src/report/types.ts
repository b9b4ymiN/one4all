/**
 * Report Generator Types
 *
 * Types for generating investment research reports
 */

import type { DecisionState } from '../journal-writer/types.js';
import type { SynthesisOutput, ConsensusAnalysis, EvidenceAssessment } from '../synthesis/types.js';

/**
 * Report format options
 */
export type ReportFormat = 'markdown' | 'html' | 'json';

/**
 * Report section - individual sections of the report
 */
export interface ReportSection {
  id: string;
  title: string;
  content: string;
  order: number;
  included: boolean;
}

/**
 * Complete investment report
 */
export interface InvestmentReport {
  // Metadata
  mission_id: string;
  generated_at: Date;
  report_format: ReportFormat;

  // Subject info
  subject: {
    ticker?: string;
    company_name?: string;
    market?: string;
    subject_type: string;
  };

  // Sections
  sections: ReportSection[];

  // Summary data
  summary: {
    decision_state: DecisionState;
    conviction_level: number;
    fair_value_conservative: number;
    fair_value_base: number;
    current_price: number;
    mos_30_price: number;
    price_to_watch: number;
    evidence_score: number;
  };

  // Raw synthesis output for reference
  synthesis_output?: SynthesisOutput;
}

/**
 * Report template
 */
export interface ReportTemplate {
  name: string;
  description: string;
  sections: Array<{
    id: string;
    title: string;
    included_by_default: boolean;
    order: number;
  }>;
}

/**
 * Report generation options
 */
export interface ReportGeneratorOptions {
  format?: ReportFormat;
  template?: string;
  include_sections?: string[];
  exclude_sections?: string[];
  include_raw_synthesis?: boolean;
  language?: 'en' | 'th';
}

/**
 * Section render context
 */
export interface SectionRenderContext {
  synthesis: SynthesisOutput;
  mission_id: string;
  generated_at: Date;
  language: 'en' | 'th';
}
