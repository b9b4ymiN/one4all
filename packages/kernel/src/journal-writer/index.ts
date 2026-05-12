/**
 * Journal Writer Module
 *
 * Decision Journal Writer for tracking investment decisions
 */

// Types (excluding conflicting names)
export type {
  DecisionState,
  SubjectType,
  Market,
  Subject,
  Decision,
  Valuation,
  Assumptions,
  Evidence,
  AnalystView,
  AnalystViews,
  FollowUpEvent,
  OutcomeLessons,
  Outcome,
  JournalEntry,
  JournalFilters,
  MissionOutput,
} from './types.js';

// Re-export from schema with aliases to avoid conflicts
export { journalEntries } from './schema.js';
export type { JournalEntryDb as JournalEntryDbRow, NewJournalEntryDb } from './schema.js';

// Main class
export { JournalWriter } from './journal-writer.js';
