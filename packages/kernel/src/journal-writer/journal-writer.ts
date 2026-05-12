/**
 * Decision Journal Writer
 *
 * Writes journal entries to SQLite database for investment decision tracking
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq, and, gte, lte, or, isNull, inArray } from 'drizzle-orm';
import * as schema from './schema.js';
import type {
  JournalEntry,
  JournalFilters,
  MissionOutput,
  Outcome,
  DecisionState,
} from './types.js';

export interface JournalWriterOptions {
  dbPath?: string;
  autoMigrate?: boolean;
}

/**
 * Decision Journal Writer
 *
 * Manages writing and querying journal entries for investment decisions
 */
export class JournalWriter {
  private db: ReturnType<typeof drizzle>;
  private sqlite: Database.Database;

  constructor(
    private basePath: string,
    options: JournalWriterOptions = {}
  ) {
    const dbPath = options.dbPath || path.join(basePath, 'data', 'journal.db');

    // Ensure data directory exists
    const dataDir = path.dirname(dbPath);
    fs.mkdir(dataDir, { recursive: true }).catch(() => {
      // Ignore if already exists
    });

    this.sqlite = new Database(dbPath);
    this.db = drizzle(this.sqlite, { schema });

    if (options.autoMigrate !== false) {
      this.migrate();
    }
  }

  /**
   * Create/update database schema
   */
  private migrate(): void {
    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS journal_entries (
        journal_id TEXT PRIMARY KEY,
        mission_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        subject_type TEXT NOT NULL,
        subject_ticker TEXT,
        subject_market TEXT,
        subject_company_name TEXT,
        decision_state TEXT NOT NULL,
        decision_date TEXT NOT NULL,
        decision_rationale_summary TEXT NOT NULL,
        valuation_json TEXT NOT NULL,
        assumptions_json TEXT,
        evidence_json TEXT NOT NULL,
        analyst_views_json TEXT,
        thesis_breakers_json TEXT NOT NULL,
        follow_up_events_json TEXT NOT NULL,
        outcome_json TEXT,
        outcome_updated_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_journal_ticker ON journal_entries(subject_ticker);
      CREATE INDEX IF NOT EXISTS idx_journal_state ON journal_entries(decision_state);
      CREATE INDEX IF NOT EXISTS idx_journal_date ON journal_entries(created_at);
      CREATE INDEX IF NOT EXISTS idx_journal_outcome ON journal_entries(outcome_updated_at);
    `);
  }

  /**
   * Generate journal ID from ticker and date with timestamp for uniqueness
   */
  private generateJournalId(ticker: string, date: Date): string {
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const timeStr = date.toISOString().slice(11, 19).replace(/:/g, '');
    return `${ticker}-journal-${dateStr}-${timeStr}`;
  }

  /**
   * Convert MissionOutput to JournalEntry
   */
  private missionToJournalEntry(mission: MissionOutput): JournalEntry {
    const now = new Date().toISOString();
    // Use mission_id as suffix to ensure uniqueness even for same ticker on same day
    const uniqueId = mission.mission_id.slice(-8); // Last 8 chars of mission ID
    const journalId = mission.ticker
      ? `${this.generateJournalId(mission.ticker, new Date())}-${uniqueId}`
      : `journal-${mission.mission_id}`;

    return {
      journal_id: journalId,
      mission_id: mission.mission_id,
      created_at: now,

      subject: {
        type: mission.subject_type,
        ticker: mission.ticker,
        market: mission.market,
        company_name: mission.company_name,
      },

      decision: {
        state: mission.decision_state,
        decision_date: now.slice(0, 10),
        rationale_summary: mission.rationale_summary,
      },

      valuation: {
        fair_value_conservative: mission.valuation.conservative,
        fair_value_base: mission.valuation.base,
        price_for_mos_30: mission.valuation.mos_30 ?? Math.round(mission.valuation.conservative * 0.7),
        price_to_watch: mission.valuation.price_to_watch,
        current_price_at_analysis: mission.current_price,
      },

      assumptions: mission.assumptions,

      evidence: {
        score: mission.evidence_quality.score,
        tier1_sources_used: mission.evidence_quality.tier1_sources,
        tier2_sources_used: mission.evidence_quality.tier2_sources,
        tier3_sources_used: mission.evidence_quality.tier3_sources,
        data_gaps: mission.evidence_quality.data_gaps,
      },

      analyst_views: mission.analyst_views,

      thesis_breakers: mission.thesis_breakers,
      follow_up_events: mission.follow_up_events,
    };
  }

  /**
   * Write a journal entry
   */
  async writeJournalEntry(mission: MissionOutput): Promise<JournalEntry> {
    const entry = this.missionToJournalEntry(mission);

    await this.db.insert(schema.journalEntries).values({
      journalId: entry.journal_id,
      missionId: entry.mission_id,
      createdAt: entry.created_at,

      subjectType: entry.subject.type,
      subjectTicker: entry.subject.ticker ?? null,
      subjectMarket: entry.subject.market ?? null,
      subjectCompanyName: entry.subject.company_name ?? null,

      decisionState: entry.decision.state,
      decisionDate: entry.decision.decision_date,
      decisionRationaleSummary: entry.decision.rationale_summary,

      valuationJson: JSON.stringify(entry.valuation),
      assumptionsJson: entry.assumptions ? JSON.stringify(entry.assumptions) : null,
      evidenceJson: JSON.stringify(entry.evidence),
      analystViewsJson: entry.analyst_views ? JSON.stringify(entry.analyst_views) : null,
      thesisBreakersJson: JSON.stringify(entry.thesis_breakers),
      followUpEventsJson: JSON.stringify(entry.follow_up_events),
      outcomeJson: null,
      outcomeUpdatedAt: null,
    });

    return entry;
  }

  /**
   * Update outcome for a journal entry
   */
  async updateOutcome(journalId: string, outcome: Partial<Outcome>): Promise<JournalEntry | null> {
    const existing = await this.getJournalEntry(journalId);
    if (!existing) return null;

    const updatedOutcome: Outcome = {
      ...(existing.outcome ?? {}),
      ...outcome,
      updated_at: new Date().toISOString(),
    };

    await this.db
      .update(schema.journalEntries)
      .set({
        outcomeJson: JSON.stringify(updatedOutcome),
        outcomeUpdatedAt: updatedOutcome.updated_at,
      })
      .where(eq(schema.journalEntries.journalId, journalId));

    return {
      ...existing,
      outcome: updatedOutcome,
    } as JournalEntry;
  }

  /**
   * Get a specific journal entry
   */
  async getJournalEntry(journalId: string): Promise<JournalEntry | null> {
    const rows = await this.db
      .select()
      .from(schema.journalEntries)
      .where(eq(schema.journalEntries.journalId, journalId))
      .limit(1);

    if (rows.length === 0) return null;
    return this.dbRowToJournalEntry(rows[0]);
  }

  /**
   * Get journal entry by mission ID
   */
  async getJournalEntryByMissionId(missionId: string): Promise<JournalEntry | null> {
    const rows = await this.db
      .select()
      .from(schema.journalEntries)
      .where(eq(schema.journalEntries.missionId, missionId))
      .limit(1);

    if (rows.length === 0) return null;
    return this.dbRowToJournalEntry(rows[0]);
  }

  /**
   * Query journal entries with filters
   */
  async queryJournal(filters: JournalFilters = {}): Promise<JournalEntry[]> {
    const conditions = [];

    if (filters.ticker) {
      conditions.push(eq(schema.journalEntries.subjectTicker, filters.ticker));
    }

    if (filters.decision_state) {
      const states = Array.isArray(filters.decision_state) ? filters.decision_state : [filters.decision_state];
      conditions.push(inArray(schema.journalEntries.decisionState, states));
    }

    if (filters.date_from) {
      conditions.push(gte(schema.journalEntries.createdAt, filters.date_from));
    }

    if (filters.date_to) {
      conditions.push(lte(schema.journalEntries.createdAt, filters.date_to));
    }

    if (filters.has_outcome === true) {
      conditions.push(sql`${schema.journalEntries.outcomeUpdatedAt} IS NOT NULL`);
    } else if (filters.has_outcome === false) {
      conditions.push(isNull(schema.journalEntries.outcomeUpdatedAt));
    }

    if (filters.open_positions_only) {
      const openStates: DecisionState[] = ['STARTER_POSITION', 'CORE_CANDIDATE', 'HOLD'];
      conditions.push(
        and(
          inArray(schema.journalEntries.decisionState, openStates),
          isNull(schema.journalEntries.outcomeUpdatedAt)
        )
      );
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await this.db
      .select()
      .from(schema.journalEntries)
      .where(where)
      .orderBy(schema.journalEntries.createdAt);

    return rows.map((row) => this.dbRowToJournalEntry(row));
  }

  /**
   * Get open positions (decisions without final outcome)
   */
  async getOpenPositions(): Promise<JournalEntry[]> {
    return this.queryJournal({ open_positions_only: true });
  }

  /**
   * Get entries needing follow-up (pending events past due date)
   */
  async getEntriesNeedingFollowUp(): Promise<JournalEntry[]> {
    const rows = await this.db
      .select()
      .from(schema.journalEntries)
      .orderBy(schema.journalEntries.createdAt);

    const now = new Date().toISOString();

    return rows
      .map((row) => this.dbRowToJournalEntry(row))
      .filter((entry) => {
        return entry.follow_up_events.some(
          (event) =>
            (event.status === 'pending' || !event.status) && event.expected_date < now
        );
      });
  }

  /**
   * Update follow-up event status
   */
  async updateFollowUpEvent(
    journalId: string,
    eventIndex: number,
    status: 'triggered' | 'passed',
    outcomeNote?: string
  ): Promise<JournalEntry | null> {
    const existing = await this.getJournalEntry(journalId);
    if (!existing) return null;

    const updatedEvents = [...existing.follow_up_events];
    if (eventIndex >= 0 && eventIndex < updatedEvents.length) {
      updatedEvents[eventIndex] = {
        ...updatedEvents[eventIndex],
        status,
        outcome_note: outcomeNote,
      };
    }

    await this.db
      .update(schema.journalEntries)
      .set({
        followUpEventsJson: JSON.stringify(updatedEvents),
      })
      .where(eq(schema.journalEntries.journalId, journalId));

    return {
      ...existing,
      follow_up_events: updatedEvents,
    } as JournalEntry;
  }

  /**
   * Delete a journal entry
   */
  async deleteJournalEntry(journalId: string): Promise<boolean> {
    const existing = await this.getJournalEntry(journalId);
    if (!existing) return false;

    await this.db
      .delete(schema.journalEntries)
      .where(eq(schema.journalEntries.journalId, journalId));

    return true;
  }

  /**
   * Close database connection
   */
  close(): void {
    this.sqlite.close();
  }

  /**
   * Convert database row to JournalEntry
   */
  private dbRowToJournalEntry(row: Record<string, unknown>): JournalEntry {
    return {
      journal_id: row.journalId as string,
      mission_id: row.missionId as string,
      created_at: row.createdAt as string,

      subject: {
        type: row.subjectType as JournalEntry['subject']['type'],
        ticker: (row.subjectTicker as string | null) ?? undefined,
        market: (row.subjectMarket as JournalEntry['subject']['market'] | null) ?? undefined,
        company_name: (row.subjectCompanyName as string | null) ?? undefined,
      },

      decision: {
        state: row.decisionState as JournalEntry['decision']['state'],
        decision_date: row.decisionDate as string,
        rationale_summary: row.decisionRationaleSummary as string,
      },

      valuation: JSON.parse(row.valuationJson as string),

      assumptions: row.assumptionsJson ? JSON.parse(row.assumptionsJson as string) : undefined,

      evidence: JSON.parse(row.evidenceJson as string),

      analyst_views: row.analystViewsJson ? JSON.parse(row.analystViewsJson as string) : undefined,

      thesis_breakers: JSON.parse(row.thesisBreakersJson as string),

      follow_up_events: JSON.parse(row.followUpEventsJson as string),

      outcome: row.outcomeJson ? JSON.parse(row.outcomeJson as string) : undefined,
    };
  }
}

// SQL helper for the queryJournal method
import { sql } from 'drizzle-orm';
