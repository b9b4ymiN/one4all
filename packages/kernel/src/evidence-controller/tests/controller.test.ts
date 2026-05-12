/**
 * Unit tests for EvidenceController
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EvidenceController } from '../controller.js';
import { EvidenceTiers } from '@one4all/shared';

describe('EvidenceController', () => {
  let controller: EvidenceController;

  beforeEach(() => {
    controller = new EvidenceController();
  });

  describe('Constructor', () => {
    it('should initialize with default configuration', () => {
      expect(controller).toBeDefined();
    });

    it('should accept custom configuration', () => {
      const customController = new EvidenceController({
        builderOptions: {
          maxSourcesPerTier: { [EvidenceTiers.TIER_1]: 5 },
          minRelevanceScore: 0.8,
        },
        scorerConfig: {
          recencyDecayDays: 180,
        },
      });

      expect(customController).toBeDefined();
    });
  });

  describe('Pack Building', () => {
    it('should build a pack for a mission', async () => {
      const sources = [
        { type: 'sec_filing', identifier: 'sec.gov/edgar/data/AAPL', url: 'https://sec.gov/...' },
        { type: 'earnings_transcript', identifier: 'AAPL Q4 Earnings' },
      ];

      const result = await controller.buildPack('mission-1', 'Apple Analysis', sources);

      expect(result.pack).toBeDefined();
      expect(result.pack.missionId).toBe('mission-1');
      expect(result.pack.subject).toBe('Apple Analysis');
      expect(result.stats.totalFetches).toBe(2);
    });

    it('should store built packs', async () => {
      const sources = [
        { type: 'sec_filing', identifier: 'sec.gov/edgar/data/AAPL' },
      ];

      await controller.buildPack('mission-2', 'Test', sources);

      const pack = controller.getPack('mission-2');

      expect(pack).toBeDefined();
      expect(pack?.missionId).toBe('mission-2');
    });

    it('should return undefined for non-existent packs', () => {
      const pack = controller.getPack('non-existent');

      expect(pack).toBeUndefined();
    });

    it('should track build statistics', async () => {
      const sources = [
        { type: 'sec_filing', identifier: 'sec.gov/edgar/data/AAPL' },
        { type: 'earnings_transcript', identifier: 'AAPL Q4' },
        { type: 'blog_post', identifier: 'test-blog' },
      ];

      const result = await controller.buildPack('mission-3', 'Test', sources);

      expect(result.stats.totalFetches).toBe(3);
      expect(result.stats.successfulFetches).toBeGreaterThanOrEqual(0);
      expect(result.stats.failedFetches).toBeGreaterThanOrEqual(0);
      expect(result.stats.totalItemsExtracted).toBeGreaterThanOrEqual(0);
      expect(result.stats.buildTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should collect build errors', async () => {
      const sources = [
        { type: 'invalid_type', identifier: 'invalid-source' },
      ];

      const result = await controller.buildPack('mission-4', 'Test', sources);

      expect(result.errors).toBeDefined();
      expect(result.errors.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Pack Retrieval', () => {
    it('should get all packs', async () => {
      const sources = [
        { type: 'sec_filing', identifier: 'sec.gov/edgar/data/AAPL' },
      ];

      await controller.buildPack('mission-5', 'Test 1', sources);
      await controller.buildPack('mission-6', 'Test 2', sources);

      const allPacks = controller.getAllPacks();

      expect(allPacks.length).toBeGreaterThanOrEqual(2);
      expect(allPacks.some(p => p.missionId === 'mission-5')).toBe(true);
      expect(allPacks.some(p => p.missionId === 'mission-6')).toBe(true);
    });

    it('should return empty array when no packs exist', () => {
      const emptyController = new EvidenceController();
      const allPacks = emptyController.getAllPacks();

      expect(allPacks).toEqual([]);
    });
  });

  describe('Pack Scoring', () => {
    it('should score pack items', async () => {
      const sources = [
        { type: 'sec_filing', identifier: 'sec.gov/edgar/data/AAPL' },
        { type: 'earnings_transcript', identifier: 'AAPL Q4' },
        { type: 'blog_post', identifier: 'test-blog' },
      ];

      await controller.buildPack('mission-7', 'Test', sources);
      const scored = controller.scorePack('mission-7');

      expect(scored).toBeDefined();
      expect(scored?.length).toBeGreaterThan(0);
      scored?.forEach(item => {
        expect(item.score).toBeDefined();
        expect(item.breakdown).toBeDefined();
      });
    });

    it('should return undefined when scoring non-existent pack', () => {
      const scored = controller.scorePack('non-existent');

      expect(scored).toBeUndefined();
    });
  });

  describe('Top Evidence', () => {
    it('should get top evidence items', async () => {
      const sources = [
        { type: 'sec_filing', identifier: 'sec.gov/edgar/data/AAPL' },
        { type: 'earnings_transcript', identifier: 'AAPL Q4' },
      ];

      await controller.buildPack('mission-8', 'Test', sources);
      const topItems = controller.getTopEvidence('mission-8', 5);

      expect(topItems).toBeDefined();
      expect(topItems?.length).toBeGreaterThan(0);
      expect(topItems?.length).toBeLessThanOrEqual(5);

      // Check sorted by score
      for (let i = 0; i < (topItems?.length || 0) - 1; i++) {
        expect(topItems![i].score).toBeGreaterThanOrEqual(topItems![i + 1].score);
      }
    });

    it('should return undefined for non-existent pack', () => {
      const topItems = controller.getTopEvidence('non-existent');

      expect(topItems).toBeUndefined();
    });

    it('should use default limit of 10', async () => {
      const sources = [
        { type: 'sec_filing', identifier: 'sec.gov/edgar/data/AAPL' },
      ];

      await controller.buildPack('mission-9', 'Test', sources);
      const topItems = controller.getTopEvidence('mission-9');

      expect(topItems).toBeDefined();
      expect(topItems?.length).toBeLessThanOrEqual(10);
    });
  });

  describe('Evidence by Tier', () => {
    it('should get evidence by tier', async () => {
      const sources = [
        { type: 'sec_filing', identifier: 'sec.gov/edgar/data/AAPL' },
        { type: 'earnings_transcript', identifier: 'AAPL Q4' },
        { type: 'blog_post', identifier: 'test-blog' },
      ];

      await controller.buildPack('mission-10', 'Test', sources);

      const tier1Items = controller.getEvidenceByTier('mission-10', 1);
      const tier2Items = controller.getEvidenceByTier('mission-10', 2);
      const tier3Items = controller.getEvidenceByTier('mission-10', 3);

      expect(tier1Items).toBeDefined();
      expect(tier2Items).toBeDefined();
      expect(tier3Items).toBeDefined();
    });

    it('should return undefined for non-existent pack', () => {
      const items = controller.getEvidenceByTier('non-existent', 1);

      expect(items).toBeUndefined();
    });
  });

  describe('Summary Generation', () => {
    it('should generate evidence summary', async () => {
      const sources = [
        { type: 'sec_filing', identifier: 'sec.gov/edgar/data/AAPL' },
        { type: 'earnings_transcript', identifier: 'AAPL Q4' },
      ];

      await controller.buildPack('mission-11', 'Apple Analysis', sources);
      const summary = controller.generateSummary('mission-11');

      expect(summary).toBeDefined();
      expect(summary!.missionId).toBe('mission-11');
      expect(summary!.totalSources).toBeDefined();
      expect(summary!.totalItems).toBeDefined();
      expect(summary!.averageScore).toBeGreaterThanOrEqual(0);
      expect(summary!.tierBreakdown).toBeDefined();
      expect(summary!.topClaims).toBeDefined();
      expect(summary!.recommendations).toBeDefined();
    });

    it('should return undefined for non-existent pack', () => {
      const summary = controller.generateSummary('non-existent');

      expect(summary).toBeUndefined();
    });

    it('should include recommendations', async () => {
      const sources = [
        { type: 'blog_post', identifier: 'test-blog' },
      ];

      await controller.buildPack('mission-12', 'Test', sources);
      const summary = controller.generateSummary('mission-12');

      expect(summary?.recommendations).toBeDefined();
      expect(summary?.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('Contradiction Detection', () => {
    it('should find contradictions', async () => {
      const sources = [
        { type: 'sec_filing', identifier: 'sec.gov/edgar/data/AAPL' },
        { type: 'earnings_transcript', identifier: 'AAPL Q4' },
      ];

      await controller.buildPack('mission-13', 'Test', sources);
      const contradictions = controller.findContradictions('mission-13');

      expect(contradictions).toBeDefined();
      expect(Array.isArray(contradictions)).toBe(true);
    });

    it('should return undefined for non-existent pack', () => {
      const contradictions = controller.findContradictions('non-existent');

      expect(contradictions).toBeUndefined();
    });
  });

  describe('Source Management', () => {
    it('should add source to existing pack', async () => {
      const sources = [
        { type: 'sec_filing', identifier: 'sec.gov/edgar/data/AAPL' },
      ];

      await controller.buildPack('mission-14', 'Test', sources);
      const packBefore = controller.getPack('mission-14');
      const sourceCountBefore = packBefore?.sources.length || 0;

      await controller.addSource('mission-14', {
        type: 'earnings_transcript',
        identifier: 'AAPL Q4',
      });

      const packAfter = controller.getPack('mission-14');
      expect(packAfter?.sources.length).toBe(sourceCountBefore + 1);
    });

    it('should return undefined when adding to non-existent pack', async () => {
      const result = await controller.addSource('non-existent', {
        type: 'sec_filing',
        identifier: 'test',
      });

      expect(result).toBeUndefined();
    });

    it('should remove source from pack', async () => {
      const sources = [
        { type: 'sec_filing', identifier: 'sec.gov/edgar/data/AAPL', url: 'https://sec.gov/test' },
        { type: 'earnings_transcript', identifier: 'AAPL Q4' },
      ];

      await controller.buildPack('mission-15', 'Test', sources);
      const packBefore = controller.getPack('mission-15');
      const sourceId = packBefore?.sources[0]?.id;

      if (sourceId) {
        const removed = controller.removeSource('mission-15', sourceId);
        expect(removed).toBe(true);

        const packAfter = controller.getPack('mission-15');
        expect(packAfter?.sources.length).toBe(1);
      }
    });

    it('should return false when removing from non-existent pack', () => {
      const removed = controller.removeSource('non-existent', 'some-id');

      expect(removed).toBe(false);
    });

    it('should return false when removing non-existent source', async () => {
      const sources = [
        { type: 'sec_filing', identifier: 'sec.gov/edgar/data/AAPL' },
      ];

      await controller.buildPack('mission-16', 'Test', sources);
      const removed = controller.removeSource('mission-16', 'non-existent-source');

      expect(removed).toBe(false);
    });
  });

  describe('Pack Management', () => {
    it('should clear a specific pack', async () => {
      const sources = [
        { type: 'sec_filing', identifier: 'sec.gov/edgar/data/AAPL' },
      ];

      await controller.buildPack('mission-17', 'Test', sources);
      const cleared = controller.clearPack('mission-17');

      expect(cleared).toBe(true);
      expect(controller.getPack('mission-17')).toBeUndefined();
    });

    it('should return false when clearing non-existent pack', () => {
      const cleared = controller.clearPack('non-existent');

      expect(cleared).toBe(false);
    });

    it('should clear all packs', async () => {
      const sources = [
        { type: 'sec_filing', identifier: 'sec.gov/edgar/data/AAPL' },
      ];

      await controller.buildPack('mission-18', 'Test 1', sources);
      await controller.buildPack('mission-19', 'Test 2', sources);

      expect(controller.getAllPacks().length).toBeGreaterThanOrEqual(2);

      controller.clearAllPacks();

      expect(controller.getAllPacks().length).toBe(0);
    });
  });

  describe('Configuration Updates', () => {
    it('should update builder options', () => {
      controller.updateConfig({
        builderOptions: {
          maxSourcesPerTier: { [EvidenceTiers.TIER_1]: 20 },
          minRelevanceScore: 0.9,
        },
      });

      expect(controller).toBeDefined();
    });

    it('should update scorer config', () => {
      controller.updateConfig({
        scorerConfig: {
          recencyDecayDays: 180,
          weights: { tier: 0.4, recency: 0.2, relevance: 0.2, diversity: 0.1, verification: 0.1 },
        },
      });

      expect(controller).toBeDefined();
    });
  });

  describe('Component Access', () => {
    it('should provide access to builder', () => {
      const builder = controller.getBuilder();

      expect(builder).toBeDefined();
    });

    it('should provide access to scorer', () => {
      const scorer = controller.getScorer();

      expect(scorer).toBeDefined();
    });
  });

  describe('Recommendations', () => {
    it('should recommend adding Tier 1 sources when missing', async () => {
      const sources = [
        { type: 'blog_post', identifier: 'test-blog' },
        { type: 'blog_post', identifier: 'test-blog-2' },
      ];

      await controller.buildPack('mission-20', 'Test', sources);
      const summary = controller.generateSummary('mission-20');

      const hasTier1Recommendation = summary?.recommendations.some(
        r => r.includes('Tier 1') || r.includes('SEC')
      );

      expect(hasTier1Recommendation).toBe(true);
    });

    it('should recommend reducing Tier 3 sources when overrepresented', async () => {
      const sources = Array.from({ length: 6 }, (_, i) => ({
        type: 'blog_post' as const,
        identifier: `blog-${i}`,
      }));

      await controller.buildPack('mission-21', 'Test', sources);
      const summary = controller.generateSummary('mission-21');

      const hasTier3Recommendation = summary?.recommendations.some(
        r => r.includes('Tier 3')
      );

      expect(hasTier3Recommendation).toBe(true);
    });
  });
});
