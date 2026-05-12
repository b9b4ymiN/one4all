/**
 * Evidence Pack Builder
 *
 * Gathers sources from SEC filings, earnings transcripts, presentations,
 * and press releases. Categorizes by tier and builds evidence packs.
 */

import type {
  EvidenceSource,
  EvidenceItem,
  EvidencePack,
  PackBuilderOptions,
  SourceFetchResult,
  PackBuildResult,
  SourceCategorization,
} from './types.js';
import { EvidenceTiers } from '@one4all/shared';

const DEFAULT_OPTIONS: PackBuilderOptions = {
  maxSourcesPerTier: {
    [EvidenceTiers.TIER_1]: 10,
    [EvidenceTiers.TIER_2]: 15,
    [EvidenceTiers.TIER_3]: 20,
  },
  minRelevanceScore: 0.5,
  includeExpired: false,
  maxAgeDays: 365,
  fetcherConfig: {
    enableCache: true,
    cacheTtlMs: 3600000, // 1 hour
    timeoutMs: 30000, // 30 seconds
    maxRetries: 3,
  },
};

/**
 * Evidence Pack Builder
 *
 * Builds evidence packs from various sources for investment research missions
 */
export class PackBuilder {
  private options: PackBuilderOptions;
  private cache: Map<string, { data: SourceFetchResult; expiresAt: number }>;

  constructor(options: PackBuilderOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.cache = new Map();
  }

  /**
   * Build an evidence pack for a mission
   */
  async buildPack(
    missionId: string,
    subject: string,
    sources: Array<{ type: string; identifier: string; url?: string }>
  ): Promise<PackBuildResult> {
    const startTime = Date.now();

    const evidenceSources: EvidenceSource[] = [];
    const allItems: EvidenceItem[] = [];
    const errors: Array<{ source: string; error: string }> = [];
    let successfulFetches = 0;

    // Fetch all sources
    for (const sourceConfig of sources) {
      try {
        const categorization = this.categorizeSource(sourceConfig.identifier, sourceConfig.type);
        const source: EvidenceSource = {
          id: this.generateId('src'),
          type: this.mapToSourceType(sourceConfig.type),
          title: `${subject} - ${sourceConfig.type}`,
          url: sourceConfig.url,
          tier: categorization.tier,
          tags: [sourceConfig.type, categorization.tier === 1 ? 'official' : categorization.tier === 2 ? 'reputable' : 'supplementary'],
          metadata: {
            identifier: sourceConfig.identifier,
            categorization,
          },
        };

        const result = await this.fetchSource(source);
        evidenceSources.push(source);
        allItems.push(...result.items);

        if (result.success) {
          successfulFetches++;
        } else {
          errors.push({ source: sourceConfig.identifier, error: result.error || 'Unknown error' });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push({ source: sourceConfig.identifier, error: message });
      }
    }

    // Filter by relevance and max sources per tier
    const filteredSources = this.filterSources(evidenceSources);
    const filteredItems = this.filterItems(allItems, filteredSources);

    const pack: EvidencePack = {
      missionId,
      subject,
      createdAt: new Date(),
      sources: filteredSources,
      items: filteredItems,
      metadata: {
        totalSources: filteredSources.length,
        itemsByTier: this.groupItemsByTier(filteredItems),
        averageRelevance: this.calculateAverageRelevance(filteredItems),
        lastUpdated: new Date(),
      },
    };

    return {
      pack,
      stats: {
        totalFetches: sources.length,
        successfulFetches,
        failedFetches: sources.length - successfulFetches,
        totalItemsExtracted: allItems.length,
        buildTimeMs: Date.now() - startTime,
      },
      errors,
    };
  }

  /**
   * Categorize a source by tier based on its identifier and type
   */
  categorizeSource(identifier: string, type: string): SourceCategorization {
    const normalizedIdentifier = identifier.toLowerCase();
    const normalizedType = type.toLowerCase();

    // Tier 1: Official company and regulatory sources
    if (
      normalizedIdentifier.includes('sec.gov') ||
      normalizedIdentifier.includes('edgar') ||
      normalizedIdentifier.includes('investor.') ||
      normalizedIdentifier.includes('ir.') ||
      normalizedType.includes('sec') ||
      normalizedType.includes('10-k') ||
      normalizedType.includes('10-q') ||
      normalizedType.includes('8-k') ||
      normalizedType.includes('filing') ||
      normalizedType.includes('annual report')
    ) {
      return {
        source: identifier,
        tier: EvidenceTiers.TIER_1,
        confidence: 0.95,
        reason: 'Official company or regulatory filing',
      };
    }

    // Tier 2: Mainstream financial and reputable sources
    if (
      normalizedIdentifier.includes('bloomberg') ||
      normalizedIdentifier.includes('reuters') ||
      normalizedIdentifier.includes('wsj') ||
      normalizedIdentifier.includes('financial times') ||
      normalizedIdentifier.includes('morningstar') ||
      normalizedIdentifier.includes('yahoo finance') ||
      normalizedIdentifier.includes('seeking alpha') ||
      normalizedType.includes('earnings') ||
      normalizedType.includes('transcript') ||
      normalizedType.includes('presentation') ||
      normalizedType.includes('analyst')
    ) {
      return {
        source: identifier,
        tier: EvidenceTiers.TIER_2,
        confidence: 0.85,
        reason: 'Mainstream financial or reputable third-party source',
      };
    }

    // Tier 3: Blogs, social media, press releases
    return {
      source: identifier,
      tier: EvidenceTiers.TIER_3,
      confidence: 0.7,
      reason: 'Supplementary source (blog, social, or press release)',
    };
  }

  /**
   * Fetch items from a source (mock implementation - real implementation would use adapters)
   */
  private async fetchSource(source: EvidenceSource): Promise<SourceFetchResult> {
    const startTime = Date.now();

    // Check cache first
    const cacheKey = `${source.type}:${source.url || source.id}`;
    if (this.options.fetcherConfig?.enableCache) {
      const cached = this.cache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        return cached.data;
      }
    }

    try {
      // Mock extraction - in real implementation, this would:
      // 1. Call appropriate adapter (SEC API, transcript parser, etc.)
      // 2. Extract relevant claims with context
      // 3. Score relevance

      const items: EvidenceItem[] = this.mockExtractItems(source);

      const result: SourceFetchResult = {
        source,
        success: true,
        items,
        fetchTimeMs: Date.now() - startTime,
      };

      // Cache the result
      if (this.options.fetcherConfig?.enableCache) {
        this.cache.set(cacheKey, {
          data: result,
          expiresAt: Date.now() + (this.options.fetcherConfig.cacheTtlMs || 3600000),
        });
      }

      return result;
    } catch (error) {
      return {
        source,
        success: false,
        items: [],
        error: error instanceof Error ? error.message : String(error),
        fetchTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Mock extraction of evidence items from a source
   */
  private mockExtractItems(source: EvidenceSource): EvidenceItem[] {
    const items: EvidenceItem[] = [];

    // Generate mock items based on source type
    const itemCount = Math.floor(Math.random() * 5) + 3;

    for (let i = 0; i < itemCount; i++) {
      items.push({
        id: this.generateId('item'),
        sourceId: source.id,
        claim: this.generateMockClaim(source),
        context: `Extracted from ${source.title}`,
        relevanceScore: Math.random() * 0.5 + 0.5, // 0.5 to 1.0
        extractedAt: new Date(),
        metadata: {
          position: i,
          sourceType: source.type,
        },
      });
    }

    return items;
  }

  /**
   * Generate a mock claim based on source type
   */
  private generateMockClaim(source: EvidenceSource): string {
    const claimsByType: Record<string, string[]> = {
      sec_filing: [
        'Revenue increased by 15% year-over-year',
        'Operating margin expanded to 28.5%',
        'Free cash flow reached $2.3 billion',
        'Cash and equivalents totaled $15.7 billion',
      ],
      earnings_transcript: [
        'Management highlighted strong product demand',
        'New product pipeline expected to drive growth',
        'Supply chain constraints improving',
        'Customer retention rates remain high',
      ],
      presentation: [
        'Market share in key segment grew to 22%',
        'Strategic initiatives on track',
        'R&D investment increased to support innovation',
        'International expansion progressing',
      ],
      press_release: [
        'Company announces strategic partnership',
        'New product launch scheduled for Q2',
        'Executive appointment announced',
        'Quarterly dividend increased',
      ],
    };

    const claims = claimsByType[source.type] || [
      'Key financial metric discussed',
      'Strategic initiative highlighted',
      'Market trend identified',
    ];

    return claims[Math.floor(Math.random() * claims.length)];
  }

  /**
   * Filter sources based on options
   */
  private filterSources(sources: EvidenceSource[]): EvidenceSource[] {
    const filtered: EvidenceSource[] = [];
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0 };

    for (const source of sources) {
      const maxForTier = this.options.maxSourcesPerTier?.[source.tier];
      if (maxForTier && counts[source.tier] >= maxForTier) {
        continue;
      }

      // Filter by age if specified
      if (!this.options.includeExpired && source.date) {
        const maxAge = this.options.maxAgeDays || 365;
        const ageDays = (Date.now() - source.date.getTime()) / (1000 * 60 * 60 * 24);
        if (ageDays > maxAge) {
          continue;
        }
      }

      filtered.push(source);
      counts[source.tier]++;
    }

    return filtered;
  }

  /**
   * Filter items based on relevance and source whitelist
   */
  private filterItems(items: EvidenceItem[], sources: EvidenceSource[]): EvidenceItem[] {
    const sourceIds = new Set(sources.map(s => s.id));
    const minRelevance = this.options.minRelevanceScore || 0.5;

    return items.filter(
      item => sourceIds.has(item.sourceId) && item.relevanceScore >= minRelevance
    );
  }

  /**
   * Map source type string to EvidenceSourceType
   */
  private mapToSourceType(type: string): EvidenceSource['type'] {
    const normalized = type.toLowerCase();

    // SEC filings and forms
    if (normalized.includes('sec') ||
        normalized.includes('filing') ||
        normalized.includes('10-k') ||
        normalized.includes('10-q') ||
        normalized.includes('8-k') ||
        normalized.startsWith('10-') ||
        normalized.startsWith('8-')) {
      return 'sec_filing';
    }

    if (normalized.includes('transcript') || normalized.includes('earnings')) return 'earnings_transcript';
    if (normalized.includes('presentation') || normalized.includes('deck')) return 'presentation';
    if (normalized.includes('press')) return 'press_release';
    if (normalized.includes('analyst')) return 'analyst_report';
    if (normalized.includes('news')) return 'news_article';
    if (normalized.includes('blog')) return 'blog_post';
    if (normalized.includes('social') || normalized.includes('twitter') || normalized.includes('linkedin')) return 'social_media';

    return 'other';
  }

  /**
   * Group items by tier
   */
  private groupItemsByTier(items: EvidenceItem[]): Record<number, number> {
    const result: Record<number, number> = { 1: 0, 2: 0, 3: 0 };

    for (const item of items) {
      // Determine tier from item metadata
      const tier = (item.metadata.tier as number) || 2;
      result[tier] = (result[tier] || 0) + 1;
    }

    return result;
  }

  /**
   * Calculate average relevance score
   */
  private calculateAverageRelevance(items: EvidenceItem[]): number {
    if (items.length === 0) return 0;

    const sum = items.reduce((acc, item) => acc + item.relevanceScore, 0);
    return sum / items.length;
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Update builder options
   */
  updateOptions(options: Partial<PackBuilderOptions>): void {
    this.options = { ...this.options, ...options };
  }

  /**
   * Generate a unique ID
   */
  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
}

/**
 * Create a pack builder with default options
 */
export function createPackBuilder(options?: PackBuilderOptions): PackBuilder {
  return new PackBuilder(options);
}
