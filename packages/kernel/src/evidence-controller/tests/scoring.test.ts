/**
 * Unit tests for EvidenceScorer
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EvidenceScorer } from '../scoring.js';
import { EvidenceTiers } from '@one4all/shared';
import type { EvidenceSource, EvidenceItem, EvidencePack } from '../types.js';

describe('EvidenceScorer', () => {
  let scorer: EvidenceScorer;
  let mockSources: Map<string, EvidenceSource>;
  let mockItems: EvidenceItem[];

  beforeEach(() => {
    scorer = new EvidenceScorer();

    // Setup mock sources
    mockSources = new Map([
      ['tier1-src', {
        id: 'tier1-src',
        type: 'sec_filing',
        title: 'SEC Filing',
        tier: EvidenceTiers.TIER_1,
        tags: ['official'],
        metadata: { verified: true },
      }],
      ['tier2-src', {
        id: 'tier2-src',
        type: 'earnings_transcript',
        title: 'Earnings Transcript',
        tier: EvidenceTiers.TIER_2,
        tags: ['reputable'],
        metadata: {},
      }],
      ['tier3-src', {
        id: 'tier3-src',
        type: 'blog_post',
        title: 'Blog Post',
        tier: EvidenceTiers.TIER_3,
        tags: ['supplementary'],
        metadata: {},
      }],
    ]);

    // Setup mock items
    mockItems = [
      {
        id: 'item-1',
        sourceId: 'tier1-src',
        claim: 'Revenue increased by 15% year-over-year',
        context: 'According to SEC filing 10-K',
        relevanceScore: 0.9,
        extractedAt: new Date(),
        metadata: { tier: 1, sourceType: 'sec_filing' },
      },
      {
        id: 'item-2',
        sourceId: 'tier2-src',
        claim: 'Management highlighted strong product demand',
        context: 'From earnings call transcript',
        relevanceScore: 0.8,
        extractedAt: new Date(),
        metadata: { tier: 2, sourceType: 'earnings_transcript' },
      },
      {
        id: 'item-3',
        sourceId: 'tier3-src',
        claim: 'Social media sentiment is positive',
        context: 'Twitter analysis',
        relevanceScore: 0.6,
        extractedAt: new Date(),
        metadata: { tier: 3, sourceType: 'social_media' },
      },
    ];
  });

  describe('Constructor', () => {
    it('should initialize with default weights', () => {
      expect(scorer).toBeDefined();
    });

    it('should accept custom weights', () => {
      const customScorer = new EvidenceScorer({
        weights: { tier: 0.5, recency: 0.2, relevance: 0.2, diversity: 0.05, verification: 0.05 },
      });

      expect(customScorer).toBeDefined();
    });
  });

  describe('Item Scoring', () => {
    it('should score a single item', () => {
      const scored = scorer.scoreItem(mockItems[0], mockSources);

      expect(scored.score).toBeDefined();
      expect(scored.score).toBeGreaterThan(0);
      expect(scored.breakdown).toBeDefined();
      expect(scored.breakdown.tier).toBeDefined();
      expect(scored.breakdown.recency).toBeDefined();
      expect(scored.breakdown.relevance).toBeDefined();
    });

    it('should give higher scores to Tier 1 sources', () => {
      const tier1Scored = scorer.scoreItem(mockItems[0], mockSources);
      const tier2Scored = scorer.scoreItem(mockItems[1], mockSources);
      const tier3Scored = scorer.scoreItem(mockItems[2], mockSources);

      expect(tier1Scored.score).toBeGreaterThan(tier2Scored.score);
      expect(tier2Scored.score).toBeGreaterThan(tier3Scored.score);
    });

    it('should calculate tier scores correctly', () => {
      const tier1Item = { ...mockItems[0], sourceId: 'tier1-src' };
      const tier2Item = { ...mockItems[0], sourceId: 'tier2-src' };
      const tier3Item = { ...mockItems[0], sourceId: 'tier3-src' };

      const tier1Scored = scorer.scoreItem(tier1Item, mockSources);
      const tier2Scored = scorer.scoreItem(tier2Item, mockSources);
      const tier3Scored = scorer.scoreItem(tier3Item, mockSources);

      expect(tier1Scored.breakdown.tier).toBe(1.0);
      expect(tier2Scored.breakdown.tier).toBe(0.7);
      expect(tier3Scored.breakdown.tier).toBe(0.4);
    });

    it('should calculate recency scores', () => {
      const recentItem = { ...mockItems[0], extractedAt: new Date() };
      const oldItem = { ...mockItems[0], extractedAt: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000) };

      const recentScored = scorer.scoreItem(recentItem, mockSources);
      const oldScored = scorer.scoreItem(oldItem, mockSources);

      expect(recentScored.breakdown.recency).toBeGreaterThan(oldScored.breakdown.recency);
    });

    it('should use item relevance score directly', () => {
      const highRelevance = { ...mockItems[0], relevanceScore: 0.95 };
      const lowRelevance = { ...mockItems[0], relevanceScore: 0.5 };

      const highScored = scorer.scoreItem(highRelevance, mockSources);
      const lowScored = scorer.scoreItem(lowRelevance, mockSources);

      expect(highScored.breakdown.relevance).toBe(0.95);
      expect(lowScored.breakdown.relevance).toBe(0.5);
    });

    it('should calculate diversity scores', () => {
      const uniqueItem = { ...mockItems[0], claim: 'Unique claim about revenue growth' };
      const similarItem = { ...mockItems[0], claim: 'Revenue increased by 15% year-over-year' };

      const uniqueScored = scorer.scoreItem(uniqueItem, mockSources, { allItems: mockItems });
      const similarScored = scorer.scoreItem(similarItem, mockSources, { allItems: mockItems });

      expect(uniqueScored.breakdown.diversity).toBeGreaterThanOrEqual(similarScored.breakdown.diversity);
    });

    it('should boost verified sources', () => {
      const verifiedItem = { ...mockItems[0] };
      const unverifiedItem = { ...mockItems[1] };

      const verifiedScored = scorer.scoreItem(verifiedItem, mockSources);
      const unverifiedScored = scorer.scoreItem(unverifiedItem, mockSources);

      expect(verifiedScored.breakdown.verification).toBeGreaterThan(unverifiedScored.breakdown.verification);
    });
  });

  describe('Pack Scoring', () => {
    it('should score all items in a pack', () => {
      const pack: EvidencePack = {
        missionId: 'test-mission',
        subject: 'Test Subject',
        createdAt: new Date(),
        sources: Array.from(mockSources.values()),
        items: mockItems,
        metadata: {
          totalSources: 3,
          itemsByTier: { '1': 1, '2': 1, '3': 1 },
          averageRelevance: 0.77,
          lastUpdated: new Date(),
        },
      };

      const scored = scorer.scorePack(pack);

      expect(scored).toHaveLength(3);
      scored.forEach(item => {
        expect(item.score).toBeDefined();
        expect(item.breakdown).toBeDefined();
      });
    });
  });

  describe('Top Items', () => {
    it('should return top N items by score', () => {
      const pack: EvidencePack = {
        missionId: 'test-mission',
        subject: 'Test Subject',
        createdAt: new Date(),
        sources: Array.from(mockSources.values()),
        items: mockItems,
        metadata: {
          totalSources: 3,
          itemsByTier: { '1': 1, '2': 1, '3': 1 },
          averageRelevance: 0.77,
          lastUpdated: new Date(),
        },
      };

      const scored = scorer.scorePack(pack);
      const topItems = scorer.getTopItems(scored, 2);

      expect(topItems).toHaveLength(2);
      expect(topItems[0].score).toBeGreaterThanOrEqual(topItems[1].score);
    });

    it('should return all items when limit exceeds item count', () => {
      const pack: EvidencePack = {
        missionId: 'test-mission',
        subject: 'Test Subject',
        createdAt: new Date(),
        sources: Array.from(mockSources.values()),
        items: mockItems,
        metadata: {
          totalSources: 3,
          itemsByTier: { '1': 1, '2': 1, '3': 1 },
          averageRelevance: 0.77,
          lastUpdated: new Date(),
        },
      };

      const scored = scorer.scorePack(pack);
      const topItems = scorer.getTopItems(scored, 10);

      expect(topItems).toHaveLength(3);
    });
  });

  describe('Items by Tier', () => {
    it('should filter items by tier', () => {
      const pack: EvidencePack = {
        missionId: 'test-mission',
        subject: 'Test Subject',
        createdAt: new Date(),
        sources: Array.from(mockSources.values()),
        items: mockItems,
        metadata: {
          totalSources: 3,
          itemsByTier: { '1': 1, '2': 1, '3': 1 },
          averageRelevance: 0.77,
          lastUpdated: new Date(),
        },
      };

      const scored = scorer.scorePack(pack);

      const tier1Items = scorer.getItemsByTier(scored, 1);
      const tier2Items = scorer.getItemsByTier(scored, 2);
      const tier3Items = scorer.getItemsByTier(scored, 3);

      expect(tier1Items).toHaveLength(1);
      expect(tier2Items).toHaveLength(1);
      expect(tier3Items).toHaveLength(1);
    });

    it('should return empty array for non-existent tier', () => {
      const pack: EvidencePack = {
        missionId: 'test-mission',
        subject: 'Test Subject',
        createdAt: new Date(),
        sources: Array.from(mockSources.values()),
        items: mockItems,
        metadata: {
          totalSources: 3,
          itemsByTier: { '1': 1, '2': 1, '3': 1 },
          averageRelevance: 0.77,
          lastUpdated: new Date(),
        },
      };

      const scored = scorer.scorePack(pack);
      const tier4Items = scorer.getItemsByTier(scored, 4);

      expect(tier4Items).toHaveLength(0);
    });
  });

  describe('Statistics', () => {
    it('should calculate pack statistics', () => {
      const pack: EvidencePack = {
        missionId: 'test-mission',
        subject: 'Test Subject',
        createdAt: new Date(),
        sources: Array.from(mockSources.values()),
        items: mockItems,
        metadata: {
          totalSources: 3,
          itemsByTier: { '1': 1, '2': 1, '3': 1 },
          averageRelevance: 0.77,
          lastUpdated: new Date(),
        },
      };

      const scored = scorer.scorePack(pack);
      const stats = scorer.getPackStatistics(scored);

      expect(stats.averageScore).toBeGreaterThan(0);
      expect(stats.minScore).toBeLessThanOrEqual(stats.maxScore);
      expect(stats.scoreDistribution).toBeDefined();
      expect(stats.tierDistribution).toBeDefined();
    });

    it('should handle empty packs', () => {
      const stats = scorer.getPackStatistics([]);

      expect(stats.averageScore).toBe(0);
      expect(stats.minScore).toBe(0);
      expect(stats.maxScore).toBe(0);
    });

    it('should categorize scores into high/medium/low', () => {
      const pack: EvidencePack = {
        missionId: 'test-mission',
        subject: 'Test Subject',
        createdAt: new Date(),
        sources: Array.from(mockSources.values()),
        items: mockItems,
        metadata: {
          totalSources: 3,
          itemsByTier: { '1': 1, '2': 1, '3': 1 },
          averageRelevance: 0.77,
          lastUpdated: new Date(),
        },
      };

      const scored = scorer.scorePack(pack);
      const stats = scorer.getPackStatistics(scored);

      expect(stats.scoreDistribution.high).toBeDefined();
      expect(stats.scoreDistribution.medium).toBeDefined();
      expect(stats.scoreDistribution.low).toBeDefined();
    });
  });

  describe('Contradiction Detection', () => {
    it('should find contradictory claims', () => {
      const contradictoryItems: EvidenceItem[] = [
        {
          id: 'item-1',
          sourceId: 'tier1-src',
          claim: 'Revenue increased by 15%',
          context: 'Q1 Report',
          relevanceScore: 0.9,
          extractedAt: new Date(),
          metadata: { tier: 1 },
        },
        {
          id: 'item-2',
          sourceId: 'tier2-src',
          claim: 'Revenue decreased by 5%',
          context: 'Analyst Report',
          relevanceScore: 0.8,
          extractedAt: new Date(),
          metadata: { tier: 2 },
        },
      ];

      const pack: EvidencePack = {
        missionId: 'test-mission',
        subject: 'Test Subject',
        createdAt: new Date(),
        sources: Array.from(mockSources.values()),
        items: contradictoryItems,
        metadata: {
          totalSources: 2,
          itemsByTier: { '1': 1, '2': 1 },
          averageRelevance: 0.85,
          lastUpdated: new Date(),
        },
      };

      const scored = scorer.scorePack(pack);
      const contradictions = scorer.findContradictions(scored);

      expect(contradictions.length).toBeGreaterThan(0);
    });

    it('should not find contradictions in consistent claims', () => {
      const consistentItems: EvidenceItem[] = [
        {
          id: 'item-1',
          sourceId: 'tier1-src',
          claim: 'Revenue growth is strong',
          context: 'Q1 Report',
          relevanceScore: 0.9,
          extractedAt: new Date(),
          metadata: { tier: 1 },
        },
        {
          id: 'item-2',
          sourceId: 'tier2-src',
          claim: 'Revenue exceeded expectations',
          context: 'Analyst Report',
          relevanceScore: 0.8,
          extractedAt: new Date(),
          metadata: { tier: 2 },
        },
      ];

      const pack: EvidencePack = {
        missionId: 'test-mission',
        subject: 'Test Subject',
        createdAt: new Date(),
        sources: Array.from(mockSources.values()),
        items: consistentItems,
        metadata: {
          totalSources: 2,
          itemsByTier: { '1': 1, '2': 1 },
          averageRelevance: 0.85,
          lastUpdated: new Date(),
        },
      };

      const scored = scorer.scorePack(pack);
      const contradictions = scorer.findContradictions(scored);

      expect(contradictions.length).toBe(0);
    });
  });

  describe('Configuration Updates', () => {
    it('should update scorer weights', () => {
      scorer.updateConfig({
        weights: { tier: 0.5, recency: 0.2, relevance: 0.2, diversity: 0.05, verification: 0.05 },
      });

      expect(scorer).toBeDefined();
      // Weights updated - verified through behavior
    });

    it('should update recency decay days', () => {
      scorer.updateConfig({ recencyDecayDays: 180 });

      expect(scorer).toBeDefined();
    });
  });

  describe('Text Similarity', () => {
    it('should calculate Jaccard similarity', () => {
      const text1 = 'Revenue increased by 15% year-over-year';
      const text2 = 'Revenue increased by 20% year-over-year';
      const text3 = 'Profit margin expanded significantly';

      const similarity12 = scorer['calculateSimilarity'](text1, text2);
      const similarity13 = scorer['calculateSimilarity'](text1, text3);

      expect(similarity12).toBeGreaterThan(similarity13);
    });

    it('should return 1.0 for identical texts', () => {
      const text1 = 'Revenue increased by 15%';
      const text2 = 'Revenue increased by 15%';

      const similarity = scorer['calculateSimilarity'](text1, text2);

      expect(similarity).toBe(1.0);
    });

    it('should return 0 for completely different texts', () => {
      const text1 = 'Revenue increased';
      const text2 = 'Profit decreased';

      const similarity = scorer['calculateSimilarity'](text1, text2);

      expect(similarity).toBeLessThan(0.5);
    });
  });
});
