/**
 * Journal Database Schema
 *
 * Drizzle ORM schema for SQLite journal_entries table
 */

import { sqliteTable, text, index } from 'drizzle-orm/sqlite-core';

export const journalEntries = sqliteTable(
  'journal_entries',
  {
    // Identification
    journalId: text('journal_id').primaryKey(),
    missionId: text('mission_id').notNull(),
    createdAt: text('created_at').notNull(),

    // Subject
    subjectType: text('subject_type').notNull(),
    subjectTicker: text('subject_ticker'),
    subjectMarket: text('subject_market'),
    subjectCompanyName: text('subject_company_name'),

    // Decision
    decisionState: text('decision_state').notNull(),
    decisionDate: text('decision_date').notNull(),
    decisionRationaleSummary: text('decision_rationale_summary').notNull(),

    // JSON fields
    valuationJson: text('valuation_json').notNull(),
    assumptionsJson: text('assumptions_json'),
    evidenceJson: text('evidence_json').notNull(),
    analystViewsJson: text('analyst_views_json'),
    thesisBreakersJson: text('thesis_breakers_json').notNull(),
    followUpEventsJson: text('follow_up_events_json').notNull(),
    outcomeJson: text('outcome_json'),

    // Metadata
    outcomeUpdatedAt: text('outcome_updated_at'),
  },
  (table) => ({
    idxTicker: index('idx_journal_ticker').on(table.subjectTicker),
    idxState: index('idx_journal_state').on(table.decisionState),
    idxDate: index('idx_journal_date').on(table.createdAt),
    idxOutcomeDate: index('idx_journal_outcome').on(table.outcomeUpdatedAt),
  })
);

export type JournalEntryDb = typeof journalEntries.$inferSelect;
export type NewJournalEntryDb = typeof journalEntries.$inferInsert;
