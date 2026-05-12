# Decision Journal Schema

**Version:** 1.0
**Date:** 2026-05-12
**Status:** Approved

---

## 1. Purpose

The Decision Journal captures every investment decision for future learning and review. Unlike transaction logs, the journal records:

- What we decided
- Why we decided it
- What assumptions we made
- What would invalidate the thesis
- What actually happened (filled later)

### Why Start from Phase 0

If we don't design the journal schema from day one:
- Early mission data is lost
- Learning loop cannot open properly
- No historical comparison possible

The journal is written for EVERY mission starting Phase 3.
Outcome section is filled later when results are known.

---

## 2. Journal Entry Schema

### 2.1 Complete Schema

```typescript
interface JournalEntry {
  // === IDENTIFICATION ===
  journal_id: string                // Format: {TICKER}-journal-{YYYYMMDD}
  mission_id: string                // Mission that produced this decision
  created_at: string                // ISO 8601 timestamp

  // === SUBJECT ===
  subject: {
    type: "stock" | "project" | "business_decision" | "research"
    ticker?: string
    market?: "thai-set" | "us-nyse" | "us-nasdaq" | "other"
    company_name?: string
  }

  // === DECISION (written immediately) ===
  decision: {
    state: DecisionState
    decision_date: string           // ISO 8601
    rationale_summary: string        // 2-3 sentences on why
  }

  // === VALUATION (written immediately) ===
  valuation: {
    fair_value_conservative: number  // THB or USD
    fair_value_base: number
    price_for_mos_30: number        // Fair value × 0.7
    price_to_watch: number          // Target entry price
    current_price_at_analysis: number
    market_cap_at_analysis?: number // M THB or M USD
  }

  // === ASSUMPTIONS (written immediately) ===
  assumptions: {
    normalized_earnings?: number
    revenue_growth_y1_y5?: number
    operating_margin_target?: number
    wacc?: number
    terminal_growth?: number
    other_assumptions?: Record<string, any>
    note?: string                   // E.g., "owner revised growth at Gate 3"
  }

  // === EVIDENCE (written immediately) ===
  evidence: {
    score: number                   // 0-100
    tier1_sources_used: number
    tier2_sources_used: number
    tier3_sources_used: number
    data_gaps: string[]
  }

  // === ANALYST VIEWS (written immediately) ===
  analyst_views: {
    damodaran?: {
      fair_value: number
      conviction: number            // 1-10
      view: string
    }
    klarman?: {
      fair_value: number
      conviction: number
      view: string
    }
    portfolio?: {
      position: number              // % of portfolio
      conviction: number
      view: string
    }
    consensus: string
    key_disagreement?: string
  }

  // === THESIS BREAKERS (written immediately) ===
  thesis_breakers: string[]         // Observable events that invalidate thesis

  // === FOLLOW-UP EVENTS (written immediately) ===
  follow_up_events: Array<{
    event: string
    expected_date: string           // ISO 8601
    watch_for: string
  }>

  // === OUTCOME (filled later when known) ===
  outcome: {
    updated_at?: string             // When outcome was recorded
    what_happened?: string          // What actually occurred
    price_reached_target?: boolean
    thesis_held?: boolean
    actual_outcome?: string
    lessons?: {
      what_worked?: string
      what_was_wrong?: string
      what_to_do_differently?: string
    }
  }
}
```

### 2.2 Decision State Enum

```typescript
type DecisionState =
  // Rejection states
  | "REJECT"              // Thesis doesn't work, move on
  | "WATCH"               // Interesting but not now

  // Need more info
  | "RESEARCH_MORE"       // Critical questions unanswered

  // Waiting states
  | "WAIT_FOR_PRICE"      // Good business, price too high
  | "STARTER_POSITION"    // Small position to learn
  | "CORE_CANDIDATE"      // Ready for full position
  | "ADD_ON_WEAKNESS"     // Add more if price drops

  // Existing positions
  | "HOLD"                // Keep current position
  | "TRIM"                // Reduce position
  | "EXIT_THESIS_BROKEN"  // Sell, thesis invalidated
```

---

## 3. Required vs Optional Fields

### 3.1 Required Fields (Must Have)

Written Immediately:
```typescript
required_immediate = [
  "journal_id",
  "mission_id",
  "created_at",
  "subject.type",
  "decision.state",
  "decision.decision_date",
  "decision.rationale_summary",
  "valuation.fair_value_conservative",
  "valuation.price_to_watch",
  "evidence.score",
  "thesis_breakers",      // Must have at least 1
  "follow_up_events"      // Must have at least 1
]
```

Written Later (Outcome):
```typescript
required_outcome = [
  // None — outcome section is entirely optional
]
```

### 3.2 Optional Fields

```typescript
optional_fields = [
  "subject.ticker",           // Not all subjects are stocks
  "subject.company_name",
  "valuation.market_cap_at_analysis",
  "assumptions.*",            // Only relevant assumptions
  "analyst_views.*",          // Only if those agents participated
  "outcome.*"                 // Entire outcome section
]
```

### 3.3 Conditional Requirements

| Condition | Required Fields |
|-----------|-----------------|
| `decision.state === "WAIT_FOR_PRICE"` | `price_to_watch` < `current_price_at_analysis` |
| `decision.state === "STARTER_POSITION"` | `position_size` defined |
| `evidence.score < 40` | `data_gaps` not empty |
| `analyst_views` present | At least one analyst view |

---

## 4. Outcome Tracking

### 4.1 When to Update Outcome

The outcome section is updated when:
1. Follow-up event occurs
2. Price target is reached
3. Thesis breaker is triggered
4. Position is entered/exited
5. Quarterly review is conducted

### 4.2 Outcome Examples

**Positive Outcome:**
```yaml
outcome:
  updated_at: "2026-08-20T10:00:00Z"
  what_happened: "Q2 earnings confirmed normalized earnings of 410M, above our 400M base"
  price_reached_target: true
  thesis_held: true
  actual_outcome: "Entered starter position at 23.50 on 2026-07-15"
  lessons:
    what_worked: "Conservative assumption (400M) was appropriate"
    what_was_wrong: "Waited too long, could have entered at 24.50"
    what_to_do_differently: "Next time: don't wait for perfect price, good enough is fine"
```

**Negative Outcome:**
```yaml
outcome:
  updated_at: "2026-09-10T14:30:00Z"
  what_happened: "Thesis breaker triggered: Founder sold 8% stake"
  price_reached_target: false
  thesis_held: false
  actual_outcome: "Did not enter position. Stock dropped to 18.00 after founder sale news"
  lessons:
    what_worked: "Thesis breaker list included insider selling"
    what_was_wrong: "Should have monitored insider trading more closely"
    what_to_do_differently: "Set up insider trading alerts for all watch list stocks"
```

---

## 5. Follow-up Structure

### 5.1 Follow-up Event Schema

```typescript
interface FollowUpEvent {
  event: string                  // Human-readable description
  expected_date: string          // ISO 8601
  watch_for: string              // What to look for
  status?: "pending" | "triggered" | "passed"
  outcome_note?: string          // What happened
}
```

### 5.2 Follow-up Examples

```typescript
follow_up_events: [
  {
    event: "Q2 2026 earnings release",
    expected_date: "2026-08-15",
    watch_for: "Normalized earnings validation (target: ≥100M per quarter)",
    status: "triggered",
    outcome_note: "Q2 earnings: 105M — thesis confirmed"
  },
  {
    event: "Q3 2026 earnings release",
    expected_date: "2026-11-15",
    watch_for: "Normalized earnings sustained",
    status: "pending"
  },
  {
    event: "Annual report 2026",
    expected_date: "2027-03-01",
    watch_for: "Capex plan update, major shareholder changes",
    status: "pending"
  }
]
```

---

## 6. Journal Operations

### 6.1 Create Entry

```typescript
function createJournalEntry(mission: Mission): JournalEntry {
  return {
    journal_id: `${mission.ticker}-journal-${formatDate(new Date())}`,
    mission_id: mission.id,
    created_at: new Date().toISOString(),

    subject: {
      type: mission.type,
      ticker: mission.ticker,
      market: mission.market,
      company_name: mission.company_name
    },

    decision: {
      state: mission.output.decision_state,
      decision_date: new Date().toISOString(),
      rationale_summary: mission.output.rationale_summary
    },

    valuation: {
      fair_value_conservative: mission.output.valuation.conservative,
      fair_value_base: mission.output.valuation.base,
      price_for_mos_30: mission.output.valuation.mos_30,
      price_to_watch: mission.output.price_to_watch,
      current_price_at_analysis: mission.evidence_pack.current_price
    },

    assumptions: mission.output.assumptions,
    evidence: mission.evidence_quality,
    analyst_views: mission.analyst_views,
    thesis_breakers: mission.output.thesis_breakers,
    follow_up_events: mission.output.follow_up_events,

    outcome: {
      // To be filled later
    }
  }
}
```

### 6.2 Query Journal

```sql
-- All entries for a ticker
SELECT * FROM journal_entries
WHERE subject_ticker = 'MCS'
ORDER BY created_at DESC;

-- Open positions (outcome not yet final)
SELECT * FROM journal_entries
WHERE decision_state IN ('STARTER_POSITION', 'CORE_CANDIDATE', 'HOLD')
AND outcome_actual_outcome IS NULL;

-- Entries needing follow-up
SELECT * FROM journal_entries
WHERE EXISTS (
  SELECT 1 FROM json_each(follow_up_events)
  WHERE json_extract(value, '$.status') = 'pending'
  AND json_extract(value, '$.expected_date') < DATE('now')
);
```

### 6.3 Update Outcome

```typescript
function updateOutcome(
  journalId: string,
  outcome: Partial<Outcome>
): JournalEntry {
  const entry = loadJournalEntry(journalId)
  entry.outcome = {
    ...entry.outcome,
    ...outcome,
    updated_at: new Date().toISOString()
  }
  saveJournalEntry(journalId, entry)
  return entry
}
```

---

## 7. Storage Schema

### 7.1 Database Table

```sql
CREATE TABLE journal_entries (
  -- Identification
  journal_id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL,
  created_at TEXT NOT NULL,

  -- Subject
  subject_type TEXT NOT NULL,
  subject_ticker TEXT,
  subject_market TEXT,
  subject_company_name TEXT,

  -- Decision
  decision_state TEXT NOT NULL,
  decision_date TEXT NOT NULL,
  decision_rationale_summary TEXT NOT NULL,

  -- Valuation (JSON)
  valuation_json TEXT NOT NULL,

  -- Assumptions (JSON)
  assumptions_json TEXT,

  -- Evidence (JSON)
  evidence_json TEXT NOT NULL,

  -- Analyst Views (JSON)
  analyst_views_json TEXT,

  -- Thesis Breakers (JSON array)
  thesis_breakers_json TEXT NOT NULL,

  -- Follow-up Events (JSON array)
  follow_up_events_json TEXT NOT NULL,

  -- Outcome (JSON)
  outcome_json TEXT,

  -- Metadata
  outcome_updated_at TEXT,

  FOREIGN KEY (mission_id) REFERENCES missions(mission_id)
);
```

### 7.2 Indexes

```sql
CREATE INDEX idx_journal_ticker ON journal_entries(subject_ticker);
CREATE INDEX idx_journal_state ON journal_entries(decision_state);
CREATE INDEX idx_journal_date ON journal_entries(created_at);
CREATE INDEX idx_journal_outcome ON journal_entries(outcome_updated_at);
```

---

## 8. Learning Loop Integration

### 8.1 Review Triggers

The journal is reviewed on:
1. **Event-based**: When follow-up event is triggered
2. **Time-based**: Quarterly review of all open positions
3. **Pattern-based**: When enough data accumulates (≥20 entries)

### 8.2 Review Query Examples

```sql
-- What decisions were correct?
SELECT decision_state, outcome_thesis_held, COUNT(*)
FROM journal_entries
WHERE outcome_thesis_held IS NOT NULL
GROUP BY decision_state, outcome_thesis_held;

-- Which data gaps mattered most?
SELECT json_extract(evidence_json, '$.data_gaps') as gaps,
       outcome_lessons_what_was_wrong
FROM journal_entries
WHERE outcome_thesis_held = false;

-- Which analysts were most accurate?
SELECT
  json_extract(analyst_views_json, '$.damodaran.conviction') as damo_conv,
  json_extract(analyst_views_json, '$.klarman.conviction') as klarman_conv,
  outcome_thesis_held
FROM journal_entries
WHERE outcome_thesis_held IS NOT NULL;
```

---

## 9. Example Complete Entry

```yaml
journal_id: "MCS-journal-20260511"
mission_id: "MCS-valuation-20260511-001"
created_at: "2026-05-11T11:46:00Z"

subject:
  type: stock
  ticker: MCS
  market: thai-set
  company_name: "MCS Medical"

decision:
  state: WAIT_FOR_PRICE
  decision_date: "2026-05-11"
  rationale_summary: |
    Quality business with consistent margins. Current price prices in
    growth above our conservative assumptions. Waiting for MOS ≥ 30%

valuation:
  fair_value_conservative: 28.50
  fair_value_base: 34.20
  price_for_mos_30: 23.94
  price_to_watch: 24.00
  current_price_at_analysis: 31.50
  market_cap_at_analysis: 12600

assumptions:
  normalized_earnings: 400
  revenue_growth_y1_y5: 10.0
  operating_margin_target: 18.5
  wacc: 9.2
  terminal_growth: 2.5
  note: "Owner revised growth from 12% to 10% at Gate 3"

evidence:
  score: 72
  tier1_sources_used: 3
  tier2_sources_used: 2
  tier3_sources_used: 0
  data_gaps:
    - "Capex plan 2026-2028 not found in filing — used historical avg"

analyst_views:
  damodaran:
    fair_value: 34.20
    conviction: 6
    view: "Fair value exists, but not cheap enough yet"
  klarman:
    fair_value: 27.80
    conviction: 7
    view: "Downside risk if earnings normalize lower"
  consensus: "Wait for better price"
  key_disagreement: "Terminal growth: Damodaran 3% vs Klarman 2% — unresolved"

thesis_breakers:
  - "Q2 2026 earnings < 80M THB (suggests Q1 was peak)"
  - "Major hospital contract loss"
  - "Competitor enters market with lower price"
  - "Founder sells ≥ 5% stake"

follow_up_events:
  - event: "Q2 2026 earnings release"
    expected_date: "2026-08-15"
    watch_for: "Normalized earnings validation (≥100M per quarter)"
    status: pending

outcome:
  # To be filled later
```
