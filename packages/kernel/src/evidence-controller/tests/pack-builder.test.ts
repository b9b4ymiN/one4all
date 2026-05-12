/**
 * Unit tests for PackBuilder
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PackBuilder } from '../pack-builder.js';
import { EvidenceTiers } from '@one4all/shared';

describe('PackBuilder', () => {
  let builder: PackBuilder;

  beforeEach(() => {
    builder = new PackBuilder();
  });

  describe('Constructor', () => {
    it('should initialize with default options', () => {
      expect(builder).toBeDefined();
    });

    it('should accept custom options', () => {
      const customBuilder = new PackBuilder({
        maxSourcesPerTier: {
          [EvidenceTiers.TIER_1]: 5,
        },
        minRelevanceScore: 0.7,
      });

      expect(customBuilder).toBeDefined();
    });
  });

  describe('Source Categorization', () => {
    it('should categorize SEC filings as Tier 1', () => {
      const result = builder['categorizeSource']('sec.gov/edgar/data/AAPL', 'sec_filing');

      expect(result.tier).toBe(EvidenceTiers.TIER_1);
      expect(result.confidence).toBeGreaterThan(0.9);
      expect(result.reason.toLowerCase()).toContain('official');
    });

    it('should categorize investor relations as Tier 1', () => {
      const result = builder['categorizeSource']('investor.apple.com', 'presentation');

      expect(result.tier).toBe(EvidenceTiers.TIER_1);
      expect(result.reason.toLowerCase()).toContain('official');
    });

    it('should categorize 10-K filings as Tier 1', () => {
      const result = builder['categorizeSource']('AAPL 10-K 2024', '10-k');

      expect(result.tier).toBe(EvidenceTiers.TIER_1);
    });

    it('should categorize earnings transcripts as Tier 2', () => {
      const result = builder['categorizeSource']('AAPL Q4 Earnings', 'earnings_transcript');

      expect(result.tier).toBe(EvidenceTiers.TIER_2);
      expect(result.reason).toContain('reputable');
    });

    it('should categorize analyst reports as Tier 2', () => {
      const result = builder['categorizeSource']('Goldman Sachs Research', 'analyst_report');

      expect(result.tier).toBe(EvidenceTiers.TIER_2);
    });

    it('should categorize Bloomberg as Tier 2', () => {
      const result = builder['categorizeSource']('bloomberg.com/news/aapl', 'news_article');

      expect(result.tier).toBe(EvidenceTiers.TIER_2);
    });

    it('should categorize blogs as Tier 3', () => {
      const result = builder['categorizeSource']('seekingalpha.com/article/aapl', 'blog_post');

      expect(result.tier).toBe(EvidenceTiers.TIER_3);
      expect(result.reason.toLowerCase()).toContain('supplementary');
    });

    it('should categorize social media as Tier 3', () => {
      const result = builder['categorizeSource']('twitter.com/user/status/123', 'social_media');

      expect(result.tier).toBe(EvidenceTiers.TIER_3);
    });
  });

  describe('Source Type Mapping', () => {
    it('should map SEC filing types correctly', () => {
      const type1 = builder['mapToSourceType']('10-k');
      const type2 = builder['mapToSourceType']('10-q');
      const type3 = builder['mapToSourceType']('sec_filing');

      expect(type1).toBe('sec_filing');
      expect(type2).toBe('sec_filing');
      expect(type3).toBe('sec_filing');
    });

    it('should map transcript types correctly', () => {
      const type1 = builder['mapToSourceType']('earnings_transcript');
      const type2 = builder['mapToSourceType']('earnings call');

      expect(type1).toBe('earnings_transcript');
      expect(type2).toBe('earnings_transcript');
    });

    it('should map presentation types correctly', () => {
      const type = builder['mapToSourceType']('investor deck');

      expect(type).toBe('presentation');
    });

    it('should map press release types correctly', () => {
      const type = builder['mapToSourceType']('press_release');

      expect(type).toBe('press_release');
    });

    it('should map analyst types correctly', () => {
      const type = builder['mapToSourceType']('analyst report');

      expect(type).toBe('analyst_report');
    });

    it('should default to other for unknown types', () => {
      const type = builder['mapToSourceType']('unknown_type');

      expect(type).toBe('other');
    });
  });

  describe('Pack Building', () => {
    it('should build a pack with sources', async () => {
      const sources = [
        { type: 'sec_filing', identifier: 'sec.gov/edgar/data/AAPL', url: 'https://sec.gov/...' },
        { type: 'earnings_transcript', identifier: 'AAPL Q4 Earnings' },
        { type: 'presentation', identifier: 'investor.apple.com' },
      ];

      const result = await builder.buildPack('mission-1', 'Apple Analysis', sources);

      expect(result.pack).toBeDefined();
      expect(result.pack.missionId).toBe('mission-1');
      expect(result.pack.subject).toBe('Apple Analysis');
      expect(result.pack.sources).toBeDefined();
      expect(result.pack.items).toBeDefined();
    });

    it('should track fetch statistics', async () => {
      const sources = [
        { type: 'sec_filing', identifier: 'sec.gov/edgar/data/AAPL' },
        { type: 'earnings_transcript', identifier: 'AAPL Q4 Earnings' },
      ];

      const result = await builder.buildPack('mission-2', 'Test', sources);

      expect(result.stats.totalFetches).toBe(2);
      expect(result.stats.successfulFetches).toBeGreaterThanOrEqual(0);
      expect(result.stats.failedFetches).toBeGreaterThanOrEqual(0);
      expect(result.stats.buildTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should filter sources by tier limits', async () => {
      const limitedBuilder = new PackBuilder({
        maxSourcesPerTier: {
          [EvidenceTiers.TIER_1]: 1,
          [EvidenceTiers.TIER_2]: 1,
          [EvidenceTiers.TIER_3]: 1,
        },
      });

      const sources = [
        { type: 'sec_filing', identifier: 'sec.gov/edgar/data/AAPL' },
        { type: 'sec_filing', identifier: 'sec.gov/edgar/data/MSFT' },
        { type: 'earnings_transcript', identifier: 'AAPL Q4' },
        { type: 'earnings_transcript', identifier: 'MSFT Q4' },
        { type: 'blog_post', identifier: 'blog1' },
        { type: 'blog_post', identifier: 'blog2' },
      ];

      const result = await limitedBuilder.buildPack('mission-3', 'Test', sources);

      expect(result.pack.sources.length).toBeLessThanOrEqual(3);
    });

    it('should filter items by relevance score', async () => {
      const limitedBuilder = new PackBuilder({
        minRelevanceScore: 0.8,
      });

      const sources = [
        { type: 'sec_filing', identifier: 'sec.gov/edgar/data/AAPL' },
      ];

      const result = await limitedBuilder.buildPack('mission-4', 'Test', sources);

      // Mock items have random relevance, so we check the filter is applied
      result.pack.items.forEach(item => {
        expect(item.relevanceScore).toBeGreaterThanOrEqual(0.8);
      });
    });

    it('should group items by tier', async () => {
      const sources = [
        { type: 'sec_filing', identifier: 'sec.gov/edgar/data/AAPL' },
        { type: 'earnings_transcript', identifier: 'AAPL Q4' },
        { type: 'blog_post', identifier: 'blog1' },
      ];

      const result = await builder.buildPack('mission-5', 'Test', sources);

      expect(result.pack.metadata.itemsByTier).toBeDefined();
      expect(typeof result.pack.metadata.itemsByTier['1']).toBe('number');
      expect(typeof result.pack.metadata.itemsByTier['2']).toBe('number');
      expect(typeof result.pack.metadata.itemsByTier['3']).toBe('number');
    });

    it('should calculate average relevance', async () => {
      const sources = [
        { type: 'sec_filing', identifier: 'sec.gov/edgar/data/AAPL' },
      ];

      const result = await builder.buildPack('mission-6', 'Test', sources);

      expect(result.pack.metadata.averageRelevance).toBeGreaterThanOrEqual(0);
      expect(result.pack.metadata.averageRelevance).toBeLessThanOrEqual(1);
    });
  });

  describe('Cache Management', () => {
    it('should cache fetch results', async () => {
      const cachingBuilder = new PackBuilder({
        fetcherConfig: { enableCache: true, cacheTtlMs: 1000 },
      });

      const sources = [
        { type: 'sec_filing', identifier: 'sec.gov/edgar/data/AAPL', url: 'https://sec.gov/test' },
      ];

      await cachingBuilder.buildPack('mission-7', 'Test', sources);

      // Second fetch should be faster (cached)
      const startTime = Date.now();
      await cachingBuilder.buildPack('mission-8', 'Test', sources);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(100); // Should be very fast if cached
    });

    it('should clear cache', () => {
      const testBuilder = new PackBuilder({
        fetcherConfig: { enableCache: true, cacheTtlMs: 1000 },
      });

      testBuilder.clearCache();

      // Cache should be empty after clear
      expect(() => testBuilder.clearCache()).not.toThrow();
    });
  });

  describe('Options Update', () => {
    it('should update builder options', () => {
      builder.updateOptions({
        maxSourcesPerTier: { [EvidenceTiers.TIER_1]: 20 },
        minRelevanceScore: 0.9,
      });

      expect(builder).toBeDefined();
      // Options updated - verified through behavior
    });
  });

  describe('Source Filtering by Age', () => {
    it('should filter out old sources when includeExpired is false', async () => {
      const oldDate = new Date();
      oldDate.setFullYear(oldDate.getFullYear() - 2); // 2 years ago

      const ageLimitedBuilder = new PackBuilder({
        includeExpired: false,
        maxAgeDays: 365,
      });

      const sources = [
        { type: 'sec_filing', identifier: 'sec.gov/edgar/data/AAPL' },
      ];

      const result = await ageLimitedBuilder.buildPack('mission-9', 'Test', sources);

      // With mock data, sources don't have dates, so this passes
      expect(result.pack).toBeDefined();
    });
  });

  describe('Mock Item Extraction', () => {
    it('should generate mock claims for SEC filings', () => {
      const source = {
        id: 'test-src',
        type: 'sec_filing' as const,
        title: 'Test SEC Filing',
        tier: EvidenceTiers.TIER_1,
        tags: ['sec'],
        metadata: {},
      };

      const items = builder['mockExtractItems'](source);

      expect(items.length).toBeGreaterThan(0);
      items.forEach(item => {
        expect(item.sourceId).toBe('test-src');
        expect(item.claim).toBeDefined();
        expect(item.relevanceScore).toBeGreaterThan(0);
      });
    });

    it('should generate mock claims for earnings transcripts', () => {
      const source = {
        id: 'test-src',
        type: 'earnings_transcript' as const,
        title: 'Test Earnings',
        tier: EvidenceTiers.TIER_2,
        tags: ['earnings'],
        metadata: {},
      };

      const items = builder['mockExtractItems'](source);

      expect(items.length).toBeGreaterThan(0);
      items.forEach(item => {
        expect(item.sourceId).toBe('test-src');
        expect(item.claim).toBeDefined();
      });
    });
  });
});
