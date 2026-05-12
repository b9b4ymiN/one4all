/**
 * Evidence Scoring
 *
 * Scores evidence based on tier, recency, relevance, diversity, and verification
 */

import type {
  EvidenceSource,
  EvidenceItem,
  EvidencePack,
  EvidenceScoringWeights,
} from './types.js';
import { EvidenceTiers } from '@one4all/shared';

/**
 * Default scoring weights
 */
const DEFAULT_WEIGHTS: EvidenceScoringWeights = {
  tier: 0.35,
  recency: 0.20,
  relevance: 0.25,
  diversity: 0.10,
  verification: 0.10,
};

/**
 * Scored evidence item
 */
export interface ScoredEvidenceItem extends EvidenceItem {
  score: number;
  breakdown: {
    tier: number;
    recency: number;
    relevance: number;
    diversity: number;
    verification: number;
  };
}

/**
 * Evidence scorer configuration
 */
export interface EvidenceScorerConfig {
  weights?: Partial<EvidenceScoringWeights>;
  recencyDecayDays?: number;
  boostVerifiedSources?: boolean;
  diversityWindowDays?: number;
}

/**
 * Evidence Scorer
 *
 * Scores evidence items based on multiple factors
 */
export class EvidenceScorer {
  private config: Required<EvidenceScorerConfig>;
  private weights: EvidenceScoringWeights;

  constructor(config: EvidenceScorerConfig = {}) {
    this.config = {
      weights: DEFAULT_WEIGHTS,
      recencyDecayDays: 365,
      boostVerifiedSources: true,
      diversityWindowDays: 90,
      ...config,
    };

    this.weights = {
      ...DEFAULT_WEIGHTS,
      ...(this.config.weights as EvidenceScoringWeights),
    };
  }

  /**
   * Score a single evidence item
   */
  scoreItem(
    item: EvidenceItem,
    sources: Map<string, EvidenceSource>,
    context?: { allItems?: EvidenceItem[] }
  ): ScoredEvidenceItem {
    const source = sources.get(item.sourceId);
    const tier = source?.tier ?? EvidenceTiers.TIER_3;

    const tierScore = this.calculateTierScore(tier);
    const recencyScore = this.calculateRecencyScore(item.extractedAt);
    const relevanceScore = item.relevanceScore;
    const diversityScore = context?.allItems
      ? this.calculateDiversityScore(item, context.allItems)
      : 1.0;
    const verificationScore = this.calculateVerificationScore(item, source);

    const totalScore =
      tierScore * this.weights.tier +
      recencyScore * this.weights.recency +
      relevanceScore * this.weights.relevance +
      diversityScore * this.weights.diversity +
      verificationScore * this.weights.verification;

    return {
      ...item,
      score: totalScore,
      breakdown: {
        tier: tierScore,
        recency: recencyScore,
        relevance: relevanceScore,
        diversity: diversityScore,
        verification: verificationScore,
      },
    };
  }

  /**
   * Score all items in an evidence pack
   */
  scorePack(pack: EvidencePack): ScoredEvidenceItem[] {
    const sourcesMap = new Map(pack.sources.map(s => [s.id, s]));

    return pack.items.map(item =>
      this.scoreItem(item, sourcesMap, { allItems: pack.items })
    );
  }

  /**
   * Get top-scoring items
   */
  getTopItems(scoredItems: ScoredEvidenceItem[], limit = 10): ScoredEvidenceItem[] {
    return [...scoredItems]
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Get items by tier
   */
  getItemsByTier(scoredItems: ScoredEvidenceItem[], tier: number): ScoredEvidenceItem[] {
    return scoredItems.filter(item => {
      const sourceTier = item.metadata.tier as number;
      return sourceTier === tier;
    });
  }

  /**
   * Calculate tier score based on evidence tier
   */
  private calculateTierScore(tier: number): number {
    switch (tier) {
      case EvidenceTiers.TIER_1:
        return 1.0;
      case EvidenceTiers.TIER_2:
        return 0.7;
      case EvidenceTiers.TIER_3:
        return 0.4;
      default:
        return 0.3;
    }
  }

  /**
   * Calculate recency score with exponential decay
   */
  private calculateRecencyScore(extractedAt: Date): number {
    const ageMs = Date.now() - extractedAt.getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    const decayDays = this.config.recencyDecayDays;

    if (ageDays <= 1) return 1.0;
    if (ageDays >= decayDays) return 0.1;

    // Exponential decay
    return Math.max(0.1, Math.exp(-ageDays / decayDays));
  }

  /**
   * Calculate diversity score based on uniqueness
   */
  private calculateDiversityScore(item: EvidenceItem, allItems: EvidenceItem[]): number {
    // Check if this item brings unique information
    const similarItems = allItems.filter(other => {
      if (other.id === item.id) return false;
      return this.calculateSimilarity(item.claim, other.claim) > 0.8;
    });

    // Fewer similar items = higher diversity score
    return Math.max(0.2, 1.0 - similarItems.length * 0.1);
  }

  /**
   * Calculate text similarity using Jaccard similarity
   */
  private calculateSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));

    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Calculate verification score
   */
  private calculateVerificationScore(item: EvidenceItem, source?: EvidenceSource): number {
    let score = 0.5;

    // Boost verified sources
    if (source?.metadata?.verified) {
      score += 0.3;
    }

    // Boost items with strong source attribution
    if (item.metadata.sourceType && !['blog_post', 'social_media'].includes(item.metadata.sourceType as string)) {
      score += 0.1;
    }

    // Boost items with direct quotes or data references
    if (item.context.toLowerCase().includes('according to') ||
        item.context.toLowerCase().includes('stated') ||
        item.context.toLowerCase().includes('reported')) {
      score += 0.1;
    }

    return Math.min(1.0, score);
  }

  /**
   * Get pack statistics
   */
  getPackStatistics(scoredItems: ScoredEvidenceItem[]): {
    averageScore: number;
    minScore: number;
    maxScore: number;
    scoreDistribution: Record<string, number>;
    tierDistribution: Record<number, { count: number; avgScore: number }>;
  } {
    if (scoredItems.length === 0) {
      return {
        averageScore: 0,
        minScore: 0,
        maxScore: 0,
        scoreDistribution: {},
        tierDistribution: {},
      };
    }

    const scores = scoredItems.map(i => i.score);
    const averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const minScore = Math.min(...scores);
    const maxScore = Math.max(...scores);

    // Score distribution
    const scoreDistribution: Record<string, number> = {
      high: scoredItems.filter(i => i.score >= 0.8).length,
      medium: scoredItems.filter(i => i.score >= 0.5 && i.score < 0.8).length,
      low: scoredItems.filter(i => i.score < 0.5).length,
    };

    // Tier distribution
    const tierDistribution: Record<number, { count: number; avgScore: number }> = {};
    for (const tier of [1, 2, 3]) {
      const tierItems = this.getItemsByTier(scoredItems, tier);
      if (tierItems.length > 0) {
        tierDistribution[tier] = {
          count: tierItems.length,
          avgScore: tierItems.reduce((a, b) => a + b.score, 0) / tierItems.length,
        };
      }
    }

    return {
      averageScore,
      minScore,
      maxScore,
      scoreDistribution,
      tierDistribution,
    };
  }

  /**
   * Find contradictory evidence
   */
  findContradictions(scoredItems: ScoredEvidenceItem[]): Array<{
    item1: ScoredEvidenceItem;
    item2: ScoredEvidenceItem;
    similarity: number;
  }> {
    const contradictions: Array<{
      item1: ScoredEvidenceItem;
      item2: ScoredEvidenceItem;
      similarity: number;
    }> = [];

    for (let i = 0; i < scoredItems.length; i++) {
      for (let j = i + 1; j < scoredItems.length; j++) {
        const item1 = scoredItems[i];
        const item2 = scoredItems[j];

        // Check for contradictory keywords
        const hasContradiction = this.hasContradictoryTerms(item1.claim, item2.claim);

        if (hasContradiction) {
          const similarity = this.calculateSimilarity(item1.claim, item2.claim);
          if (similarity > 0.3 && similarity < 0.9) {
            contradictions.push({ item1, item2, similarity });
          }
        }
      }
    }

    return contradictions;
  }

  /**
   * Check if two claims have contradictory terms
   */
  private hasContradictoryTerms(claim1: string, claim2: string): boolean {
    const contradictions = [
      ['increased', 'decreased'],
      ['grew', 'declined'],
      ['growth', 'contraction'],
      ['profit', 'loss'],
      ['beat', 'missed'],
      ['higher', 'lower'],
      ['improved', 'worsened'],
      ['expansion', 'contraction'],
    ];

    const words1 = claim1.toLowerCase().split(/\s+/);
    const words2 = claim2.toLowerCase().split(/\s+/);

    for (const [term1, term2] of contradictions) {
      if (words1.includes(term1) && words2.includes(term2)) {
        return true;
      }
      if (words1.includes(term2) && words2.includes(term1)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Update scorer configuration
   */
  updateConfig(config: Partial<EvidenceScorerConfig>): void {
    if (config.weights) {
      this.weights = { ...this.weights, ...config.weights };
    }
    if (config.recencyDecayDays) this.config.recencyDecayDays = config.recencyDecayDays;
    if (config.boostVerifiedSources !== undefined) {
      this.config.boostVerifiedSources = config.boostVerifiedSources;
    }
    if (config.diversityWindowDays) this.config.diversityWindowDays = config.diversityWindowDays;
  }
}

/**
 * Create an evidence scorer with default options
 */
export function createEvidenceScorer(config?: EvidenceScorerConfig): EvidenceScorer {
  return new EvidenceScorer(config);
}
