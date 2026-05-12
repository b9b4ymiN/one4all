/**
 * Evidence Pack Builder Types
 *
 * Types for gathering, organizing, and scoring evidence sources
 */

import { EvidenceTiers } from '@one4all/shared';

// Evidence tier values type (1 | 2 | 3)
export type EvidenceTierValue = (typeof EvidenceTiers)[keyof typeof EvidenceTiers];

/**
 * Evidence source types
 */
export type EvidenceSourceType =
  | 'sec_filing'
  | 'earnings_transcript'
  | 'presentation'
  | 'press_release'
  | 'analyst_report'
  | 'news_article'
  | 'blog_post'
  | 'social_media'
  | 'company_website'
  | 'regulatory_filing'
  | 'database'
  | 'other';

/**
 * Evidence source metadata
 */
export interface EvidenceSource {
  id: string;
  type: EvidenceSourceType;
  title: string;
  url?: string;
  date?: Date;
  author?: string;
  publisher?: string;
  tier: EvidenceTierValue;
  tags: string[];
  metadata: Record<string, unknown>;
}

/**
 * Individual evidence item extracted from a source
 */
export interface EvidenceItem {
  id: string;
  sourceId: string;
  claim: string;
  context: string;
  relevanceScore: number;
  extractedAt: Date;
  metadata: Record<string, unknown>;
}

/**
 * Evidence pack - collection of sources and items for a mission
 */
export interface EvidencePack {
  missionId: string;
  subject: string;
  ticker?: string;
  createdAt: Date;
  sources: EvidenceSource[];
  items: EvidenceItem[];
  metadata: {
    totalSources: number;
    itemsByTier: Record<number, number>;
    averageRelevance: number;
    lastUpdated: Date;
  };
}

/**
 * Source fetcher configuration
 */
export interface SourceFetcherConfig {
  enableCache?: boolean;
  cacheTtlMs?: number;
  timeoutMs?: number;
  maxRetries?: number;
  userAgent?: string;
}

/**
 * Pack builder options
 */
export interface PackBuilderOptions {
  maxSourcesPerTier?: Partial<Record<EvidenceTierValue, number>>;
  minRelevanceScore?: number;
  includeExpired?: boolean;
  maxAgeDays?: number;
  fetcherConfig?: SourceFetcherConfig;
}

/**
 * Fetch result from a source
 */
export interface SourceFetchResult {
  source: EvidenceSource;
  success: boolean;
  items: EvidenceItem[];
  error?: string;
  fetchTimeMs: number;
}

/**
 * Pack build result
 */
export interface PackBuildResult {
  pack: EvidencePack;
  stats: {
    totalFetches: number;
    successfulFetches: number;
    failedFetches: number;
    totalItemsExtracted: number;
    buildTimeMs: number;
  };
  errors: Array<{ source: string; error: string }>;
}

/**
 * Evidence scoring weights
 */
export interface EvidenceScoringWeights {
  tier: number;
  recency: number;
  relevance: number;
  diversity: number;
  verification: number;
}

/**
 * Categorization result for auto-tiering
 */
export interface SourceCategorization {
  source: string;
  tier: EvidenceTierValue;
  confidence: number;
  reason: string;
}
