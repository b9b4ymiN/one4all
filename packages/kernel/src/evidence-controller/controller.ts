/**
 * Evidence Controller
 *
 * Orchestrates pack building and scoring for evidence management
 */

import type {
  EvidencePack,
  EvidenceSource,
  EvidenceItem,
  PackBuilderOptions,
  SourceFetchResult,
  PackBuildResult,
} from './types.js';
import { PackBuilder } from './pack-builder.js';
import { EvidenceScorer, type ScoredEvidenceItem } from './scoring.js';
import { EvidenceTiers } from '@one4all/shared';

/**
 * Evidence controller configuration
 */
export interface EvidenceControllerConfig {
  builderOptions?: PackBuilderOptions;
  scorerConfig?: {
    weights?: Partial<{
      tier: number;
      recency: number;
      relevance: number;
      diversity: number;
      verification: number;
    }>;
    recencyDecayDays?: number;
    boostVerifiedSources?: boolean;
    diversityWindowDays?: number;
  };
}

/**
 * Evidence summary for quick overview
 */
export interface EvidenceSummary {
  missionId: string;
  totalSources: number;
  totalItems: number;
  averageScore: number;
  tierBreakdown: Record<string, number>;
  topClaims: string[];
  recommendations: string[];
}

/**
 * Evidence Controller
 *
 * Main controller for evidence pack operations
 */
export class EvidenceController {
  private builder: PackBuilder;
  private scorer: EvidenceScorer;
  private packs: Map<string, EvidencePack>;

  constructor(config: EvidenceControllerConfig = {}) {
    this.builder = new PackBuilder(config.builderOptions);
    this.scorer = new EvidenceScorer(config.scorerConfig);
    this.packs = new Map();
  }

  /**
   * Build a new evidence pack for a mission
   */
  async buildPack(
    missionId: string,
    subject: string,
    sources: Array<{ type: string; identifier: string; url?: string }>
  ): Promise<PackBuildResult> {
    const result = await this.builder.buildPack(missionId, subject, sources);

    // Store the pack
    this.packs.set(missionId, result.pack);

    return result;
  }

  /**
   * Get an existing evidence pack
   */
  getPack(missionId: string): EvidencePack | undefined {
    return this.packs.get(missionId);
  }

  /**
   * Get all packs
   */
  getAllPacks(): EvidencePack[] {
    return Array.from(this.packs.values());
  }

  /**
   * Score a pack's evidence items
   */
  scorePack(missionId: string): ScoredEvidenceItem[] | undefined {
    const pack = this.packs.get(missionId);
    if (!pack) return undefined;

    return this.scorer.scorePack(pack);
  }

  /**
   * Get top evidence items for a mission
   */
  getTopEvidence(missionId: string, limit = 10): ScoredEvidenceItem[] | undefined {
    const scored = this.scorePack(missionId);
    if (!scored) return undefined;

    return this.scorer.getTopItems(scored, limit);
  }

  /**
   * Get evidence by tier for a mission
   */
  getEvidenceByTier(missionId: string, tier: number): ScoredEvidenceItem[] | undefined {
    const scored = this.scorePack(missionId);
    if (!scored) return undefined;

    return this.scorer.getItemsByTier(scored, tier);
  }

  /**
   * Generate a summary of evidence for a mission
   */
  generateSummary(missionId: string): EvidenceSummary | undefined {
    const pack = this.packs.get(missionId);
    if (!pack) return undefined;

    const scored = this.scorer.scorePack(pack);
    const stats = this.scorer.getPackStatistics(scored);

    const topClaims = this.scorer
      .getTopItems(scored, 5)
      .map(item => item.claim);

    const recommendations = this.generateRecommendations(pack, scored, stats);

    return {
      missionId,
      totalSources: pack.sources.length,
      totalItems: pack.items.length,
      averageScore: stats.averageScore,
      tierBreakdown: pack.metadata.itemsByTier,
      topClaims,
      recommendations,
    };
  }

  /**
   * Find contradictions in evidence
   */
  findContradictions(missionId: string) {
    const pack = this.packs.get(missionId);
    if (!pack) return undefined;

    const scored = this.scorer.scorePack(pack);
    return this.scorer.findContradictions(scored);
  }

  /**
   * Add a new source to an existing pack
   */
  async addSource(
    missionId: string,
    source: { type: string; identifier: string; url?: string }
  ): Promise<SourceFetchResult | undefined> {
    const pack = this.packs.get(missionId);
    if (!pack) return undefined;

    const categorization = this.builder['categorizeSource'](source.identifier, source.type);

    const evidenceSource: EvidenceSource = {
      id: this['generateId']('src'),
      type: this.builder['mapToSourceType'](source.type),
      title: `${pack.subject} - ${source.type}`,
      url: source.url,
      tier: categorization.tier,
      tags: [source.type, categorization.tier === 1 ? 'official' : categorization.tier === 2 ? 'reputable' : 'supplementary'],
      metadata: {
        identifier: source.identifier,
        categorization,
      },
    };

    const result = await this.builder['fetchSource'](evidenceSource);

    if (result.success) {
      pack.sources.push(evidenceSource);
      pack.items.push(...result.items);
      pack.metadata.totalSources = pack.sources.length;
      pack.metadata.itemsByTier = this.builder['groupItemsByTier'](pack.items);
      pack.metadata.averageRelevance = this.builder['calculateAverageRelevance'](pack.items);
      pack.metadata.lastUpdated = new Date();
    }

    return result;
  }

  /**
   * Remove a source from a pack
   */
  removeSource(missionId: string, sourceId: string): boolean {
    const pack = this.packs.get(missionId);
    if (!pack) return false;

    const sourceIndex = pack.sources.findIndex(s => s.id === sourceId);
    if (sourceIndex === -1) return false;

    pack.sources.splice(sourceIndex, 1);

    // Remove associated items
    pack.items = pack.items.filter(item => item.sourceId !== sourceId);

    pack.metadata.totalSources = pack.sources.length;
    pack.metadata.itemsByTier = this.builder['groupItemsByTier'](pack.items);
    pack.metadata.averageRelevance = this.builder['calculateAverageRelevance'](pack.items);
    pack.metadata.lastUpdated = new Date();

    return true;
  }

  /**
   * Clear a pack from storage
   */
  clearPack(missionId: string): boolean {
    return this.packs.delete(missionId);
  }

  /**
   * Clear all packs
   */
  clearAllPacks(): void {
    this.packs.clear();
  }

  /**
   * Get builder instance for advanced usage
   */
  getBuilder(): PackBuilder {
    return this.builder;
  }

  /**
   * Get scorer instance for advanced usage
   */
  getScorer(): EvidenceScorer {
    return this.scorer;
  }

  /**
   * Update controller configuration
   */
  updateConfig(config: Partial<EvidenceControllerConfig>): void {
    if (config.builderOptions) {
      this.builder.updateOptions(config.builderOptions);
    }
    if (config.scorerConfig) {
      this.scorer.updateConfig(config.scorerConfig);
    }
  }

  /**
   * Generate recommendations based on pack quality
   */
  private generateRecommendations(
    pack: EvidencePack,
    scored: ScoredEvidenceItem[],
    stats: ReturnType<EvidenceScorer['getPackStatistics']>
  ): string[] {
    const recommendations: string[] = [];

    // Check tier distribution
    const tier1Count = pack.sources.filter(s => s.tier === EvidenceTiers.TIER_1).length;
    if (tier1Count === 0) {
      recommendations.push('Add Tier 1 sources (SEC filings, official company documents) for stronger evidence.');
    }

    const tier3Count = pack.sources.filter(s => s.tier === EvidenceTiers.TIER_3).length;
    if (tier3Count > pack.sources.length * 0.5) {
      recommendations.push('More than half of sources are Tier 3. Seek higher-quality sources for better reliability.');
    }

    // Check average score
    if (stats.averageScore < 0.6) {
      recommendations.push(`Average evidence score (${stats.averageScore.toFixed(2)}) is below recommended threshold.`);
    }

    // Check source diversity
    const publishers = new Set(pack.sources.map(s => s.publisher).filter(Boolean));
    if (publishers.size < 3 && pack.sources.length > 5) {
      recommendations.push('Evidence comes from limited sources. Diversify your source base.');
    }

    // Check for contradictions
    const contradictions = this.scorer.findContradictions(scored);
    if (contradictions.length > 0) {
      recommendations.push(`Found ${contradictions.length} potential contradictory claims. Review conflicting evidence.`);
    }

    // Check recency
    const oldItems = scored.filter(item => {
      const ageDays = (Date.now() - item.extractedAt.getTime()) / (1000 * 60 * 60 * 24);
      return ageDays > 180;
    });
    if (oldItems.length > scored.length * 0.3) {
      recommendations.push('Some evidence is over 6 months old. Consider updating with more recent sources.');
    }

    if (recommendations.length === 0) {
      recommendations.push('Evidence pack is well-balanced with good quality sources.');
    }

    return recommendations;
  }

  /**
   * Generate a unique ID
   */
  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
}

/**
 * Create an evidence controller with default options
 */
export function createEvidenceController(config?: EvidenceControllerConfig): EvidenceController {
  return new EvidenceController(config);
}
