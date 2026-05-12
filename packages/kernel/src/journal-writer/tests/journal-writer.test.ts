/**
 * Journal Writer Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { JournalWriter } from '../journal-writer.js';
import type { MissionOutput, DecisionState } from '../types.js';
import { rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';

describe('JournalWriter', () => {
  const testDbPath = join(process.cwd(), 'test-journal.db');
  let journalWriter: JournalWriter;

  beforeEach(() => {
    // Clean up any existing test database
    if (existsSync(testDbPath)) {
      rmSync(testDbPath);
    }
    journalWriter = new JournalWriter(process.cwd(), {
      dbPath: testDbPath,
      autoMigrate: true,
    });
  });

  afterEach(() => {
    journalWriter.close();
    if (existsSync(testDbPath)) {
      rmSync(testDbPath);
    }
  });

  const createMockMission = (overrides?: Partial<MissionOutput>): MissionOutput => ({
    mission_id: 'test-mission-001',
    ticker: 'TEST',
    market: 'thai-set',
    company_name: 'Test Company',
    subject_type: 'stock',
    decision_state: 'WAIT_FOR_PRICE',
    rationale_summary: 'Good company, waiting for better price',
    valuation: {
      conservative: 100,
      base: 120,
      price_to_watch: 80,
      mos_30: 70,
    },
    current_price: 95,
    assumptions: {
      normalized_earnings: 500,
      revenue_growth_y1_y5: 10,
    },
    evidence_quality: {
      score: 75,
      tier1_sources: 3,
      tier2_sources: 2,
      tier3_sources: 0,
      data_gaps: [],
    },
    analyst_views: {
      damodaran: {
        fair_value: 120,
        conviction: 7,
        view: 'Fair value exists but wait for better price',
      },
      consensus: 'Wait for better price',
    },
    thesis_breakers: ['Q2 earnings < 100M', 'Major contract loss'],
    follow_up_events: [
      {
        event: 'Q2 earnings',
        expected_date: '2026-08-15',
        watch_for: 'Earnings validation',
      },
    ],
    ...overrides,
  });

  describe('writeJournalEntry', () => {
    it('should write a journal entry successfully', async () => {
      const mission = createMockMission();
      const entry = await journalWriter.writeJournalEntry(mission);

      expect(entry).toBeDefined();
      expect(entry.journal_id).toContain('TEST-journal-');
      expect(entry.mission_id).toBe(mission.mission_id);
      expect(entry.decision.state).toBe('WAIT_FOR_PRICE');
      expect(entry.valuation.fair_value_conservative).toBe(100);
    });

    it('should generate correct journal ID format', async () => {
      const mission = createMockMission();
      const entry = await journalWriter.writeJournalEntry(mission);

      // Format: TICKER-journal-YYYYMMDD-HHMMSS-uniqueSuffix
      expect(entry.journal_id).toMatch(/^TEST-journal-\d{8}-\d{6}-[-a-z0-9]+$/);
    });

    it('should handle entries without ticker', async () => {
      const mission = createMockMission({ ticker: undefined });
      const entry = await journalWriter.writeJournalEntry(mission);

      expect(entry.journal_id).toMatch(/^journal-test-mission-001$/);
      expect(entry.subject.ticker).toBeUndefined();
    });
  });

  describe('getJournalEntry', () => {
    it('should retrieve a written journal entry', async () => {
      const mission = createMockMission();
      const written = await journalWriter.writeJournalEntry(mission);
      const retrieved = await journalWriter.getJournalEntry(written.journal_id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.journal_id).toBe(written.journal_id);
      expect(retrieved?.mission_id).toBe(mission.mission_id);
    });

    it('should return null for non-existent entry', async () => {
      const retrieved = await journalWriter.getJournalEntry('non-existent');
      expect(retrieved).toBeNull();
    });
  });

  describe('getJournalEntryByMissionId', () => {
    it('should retrieve entry by mission ID', async () => {
      const mission = createMockMission();
      await journalWriter.writeJournalEntry(mission);
      const retrieved = await journalWriter.getJournalEntryByMissionId(mission.mission_id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.mission_id).toBe(mission.mission_id);
    });
  });

  describe('updateOutcome', () => {
    it('should update outcome for a journal entry', async () => {
      const mission = createMockMission();
      const written = await journalWriter.writeJournalEntry(mission);

      const outcome = {
        what_happened: 'Price reached target, entered position',
        price_reached_target: true,
        thesis_held: true,
        actual_outcome: 'Entered at 79.50',
        lessons: {
          what_worked: 'Patience paid off',
          what_was_wrong: 'Could have entered slightly earlier',
        },
      };

      const updated = await journalWriter.updateOutcome(written.journal_id, outcome);

      expect(updated).toBeDefined();
      expect(updated?.outcome).toBeDefined();
      expect(updated?.outcome?.what_happened).toBe(outcome.what_happened);
      expect(updated?.outcome?.updated_at).toBeDefined();
    });

    it('should return null for non-existent entry', async () => {
      const result = await journalWriter.updateOutcome('non-existent', {});
      expect(result).toBeNull();
    });
  });

  describe('queryJournal', () => {
    beforeEach(async () => {
      // Create multiple test entries
      await journalWriter.writeJournalEntry(
        createMockMission({
          mission_id: 'm1',
          ticker: 'AAA',
          decision_state: 'WAIT_FOR_PRICE',
        })
      );
      await journalWriter.writeJournalEntry(
        createMockMission({
          mission_id: 'm2',
          ticker: 'BBB',
          decision_state: 'STARTER_POSITION',
        })
      );
      await journalWriter.writeJournalEntry(
        createMockMission({
          mission_id: 'm3',
          ticker: 'AAA',
          decision_state: 'CORE_CANDIDATE',
        })
      );
    });

    it('should filter by ticker', async () => {
      const results = await journalWriter.queryJournal({ ticker: 'AAA' });
      expect(results).toHaveLength(2);
      expect(results.every((r) => r.subject.ticker === 'AAA')).toBe(true);
    });

    it('should filter by decision state', async () => {
      const results = await journalWriter.queryJournal({ decision_state: 'WAIT_FOR_PRICE' });
      expect(results).toHaveLength(1);
      expect(results[0].decision.state).toBe('WAIT_FOR_PRICE');
    });

    it('should filter by multiple decision states', async () => {
      const results = await journalWriter.queryJournal({
        decision_state: ['STARTER_POSITION', 'CORE_CANDIDATE'],
      });
      expect(results).toHaveLength(2);
    });
  });

  describe('getOpenPositions', () => {
    it('should return entries without final outcome for open position states', async () => {
      await journalWriter.writeJournalEntry(
        createMockMission({
          mission_id: 'open1',
          decision_state: 'STARTER_POSITION',
        })
      );
      await journalWriter.writeJournalEntry(
        createMockMission({
          mission_id: 'open2',
          decision_state: 'CORE_CANDIDATE',
        })
      );
      await journalWriter.writeJournalEntry(
        createMockMission({
          mission_id: 'closed',
          decision_state: 'REJECT',
        })
      );

      const openPositions = await journalWriter.getOpenPositions();

      expect(openPositions).toHaveLength(2);
      expect(openPositions.every((p) => !p.outcome?.updated_at)).toBe(true);
    });
  });

  describe('updateFollowUpEvent', () => {
    it('should update follow-up event status', async () => {
      const mission = createMockMission();
      const written = await journalWriter.writeJournalEntry(mission);

      const updated = await journalWriter.updateFollowUpEvent(
        written.journal_id,
        0,
        'triggered',
        'Earnings confirmed thesis'
      );

      expect(updated).toBeDefined();
      expect(updated?.follow_up_events[0].status).toBe('triggered');
      expect(updated?.follow_up_events[0].outcome_note).toBe('Earnings confirmed thesis');
    });
  });

  describe('deleteJournalEntry', () => {
    it('should delete a journal entry', async () => {
      const mission = createMockMission();
      const written = await journalWriter.writeJournalEntry(mission);

      const deleted = await journalWriter.deleteJournalEntry(written.journal_id);
      expect(deleted).toBe(true);

      const retrieved = await journalWriter.getJournalEntry(written.journal_id);
      expect(retrieved).toBeNull();
    });

    it('should return false for non-existent entry', async () => {
      const deleted = await journalWriter.deleteJournalEntry('non-existent');
      expect(deleted).toBe(false);
    });
  });

  describe('schema validation', () => {
    it('should store and retrieve complex nested objects', async () => {
      const mission = createMockMission({
        assumptions: {
          normalized_earnings: 500,
          revenue_growth_y1_y5: 10,
          operating_margin_target: 18.5,
          wacc: 9.2,
          terminal_growth: 2.5,
          other_assumptions: {
            custom_field: 'custom_value',
          },
        },
        analyst_views: {
          damodaran: {
            fair_value: 120,
            conviction: 7,
            view: 'Fair value exists',
          },
          klarman: {
            fair_value: 90,
            conviction: 8,
            view: 'Too expensive',
          },
          portfolio: {
            position: 5,
            conviction: 6,
            view: 'Small starter position',
          },
          consensus: 'Mixed views',
          key_disagreement: 'Growth rate assumptions',
        },
      });

      const written = await journalWriter.writeJournalEntry(mission);
      const retrieved = await journalWriter.getJournalEntry(written.journal_id);

      expect(retrieved?.assumptions).toEqual(mission.assumptions);
      expect(retrieved?.analyst_views).toEqual(mission.analyst_views);
    });
  });
});
