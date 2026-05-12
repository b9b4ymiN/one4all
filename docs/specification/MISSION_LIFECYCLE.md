# Mission Lifecycle: Formal State Machine

**Version:** 1.0
**Date:** 2026-05-12
**Status:** Approved

---

## 1. Purpose

This document defines the formal state machine for all missions in one4all. Every mission MUST follow these states and transition rules — no exceptions.

### Why a Formal State Machine?

Without a formal state machine:
- Agent failures go undetected
- Missions proceed with incomplete information
- System states are unclear
- Recovery from errors is impossible

With a formal state machine:
- Every state has clear entry/exit conditions
- Failures are detected and handled
- Progress is always known
- Recovery options are explicit

---

## 2. Mission States

### 2.1 State Definitions

| State | Description |
|-------|-------------|
| `DRAFT` | Owner has provided a brief, not yet validated |
| `PLANNING` | Kernel is analyzing brief and building team |
| `RESEARCHING` | Researcher agents are gathering evidence |
| `HUMAN_REVIEW_GATE_1` | Waiting for owner input after research |
| `ANALYZING` | Analyst agents are processing evidence |
| `HUMAN_REVIEW_GATE_2` | Optional review after individual analyses |
| `CROSS_QA` | Agents are questioning each other |
| `DEBATING` | Structured disagreement rounds |
| `SYNTHESIZING` | CIO is combining outputs |
| `HUMAN_REVIEW_GATE_3` | Mandatory review before decision |
| `DECIDED` | Final decision state determined |
| `JOURNALED` | Decision written to journal |
| `FAILED` | Mission could not complete |

---

## 3. State Machine Diagram

```
                    ┌─────────────────────────────┐
                    │           DRAFT              │
                    │  (owner provides brief)      │
                    └──────────────┬──────────────┘
                                   │ validate input
                    ┌──────────────▼──────────────┐
                    │          PLANNING            │
                    │  kernel analyzes brief       │
                    │  builds team, defines reqs  │
                    └──────────────┬──────────────┘
                                   │ team ready
     ┌─────────────────────────────▼──────────────────────────┐
     │                       RESEARCHING                       │
     │  researcher agents gather evidence from official sources │
     │  create Evidence Pack                                   │
     └──────┬──────────────────────────────────┬──────────────┘
            │ evidence score ≥ threshold        │ evidence score < threshold
            │                                  ▼
            │                    ┌─────────────────────────┐
            │                    │  HUMAN_REVIEW_GATE_1     │
            │                    │  Notify: low evidence    │
            │                    │  Wait for owner input    │
            │                    └────────────┬────────────┘
            │                                 │ owner approve / add data
            ▼                                 ▼
     ┌──────────────────────────────────────────────────────┐
     │                      ANALYZING                        │
     │  analyst agents work in parallel on evidence pack     │
     │  each produces individual analysis                    │
     └──────────────────────────┬───────────────────────────┘
                                 │ all agents done or timeout
            ┌────────────────────▼───────────────────────────┐
            │               HUMAN_REVIEW_GATE_2              │
            │  Optional: show individual analyses            │
            │  owner may add context before debate           │
            └──────────────────┬──────────────────────────────┘
                               │ auto-proceed or owner continue
            ┌──────────────────▼──────────────────────────────┐
            │                    CROSS_QA                      │
            │  agents question each other                     │
            │  researchers answer with evidence               │
            │  collect unanswered questions                   │
            └──────────────────┬──────────────────────────────┘
                               │
            ┌──────────────────▼──────────────────────────────┐
            │                   DEBATING                       │
            │  structured disagreement rounds (max 3)          │
            │  challenges must cite evidence tiers            │
            │  unresolved disagreements preserved             │
            └──────────────────┬──────────────────────────────┘
                               │ max rounds or all resolved
            ┌──────────────────▼──────────────────────────────┐
            │                  SYNTHESIZING                    │
            │  CIO combines all outputs                       │
            │  agreement → higher confidence                  │
            │  disagreements → surfaced to owner              │
            └──────────────────┬──────────────────────────────┘
                               │
            ┌──────────────────▼──────────────────────────────┐
            │              HUMAN_REVIEW_GATE_3                │
            │  MANDATORY: owner reviews synthesis             │
            │  may request revisions / new assumptions        │
            └──────────────────┬──────────────────────────────┘
                               │ owner confirms
            ┌──────────────────▼──────────────────────────────┐
            │                   DECIDED                        │
            │  decision_state set                              │
            │  price_to_watch set                             │
            │  thesis_breakers defined                        │
            │  follow_up events scheduled                     │
            └──────────────────┬──────────────────────────────┘
                               │
            ┌──────────────────▼──────────────────────────────┐
            │                  JOURNALED                       │
            │  decision journal entry written                  │
            │  assumptions logged                             │
            │  follow-up reminders set                        │
            └──────────────────────────────────────────────────┘

     ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ERROR PATHS ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─

     Any state can transition to FAILED if:
       - timeout exceeds limit
       - adapter error cannot recover
       - owner aborts explicitly

     FAILED state must:
       - log which state failed
       - log error reason
       - preserve partial work
       - notify owner with recovery options
```

---

## 4. State Transition Rules

### 4.1 Transition Table

| From State | To State | Precondition | Timeout | On Timeout |
|------------|----------|--------------|---------|------------|
| DRAFT | PLANNING | Input is valid | - | Reject + explain why |
| PLANNING | RESEARCHING | Team built, evidence requirements defined | - | - |
| RESEARCHING | ANALYZING | Evidence score ≥ 40 | 3 min per researcher | Partial proceed + flag |
| RESEARCHING | HUMAN_REVIEW_GATE_1 | Evidence score < 40 | - | - |
| ANALYZING | CROSS_QA | All analysts returned output | 2 min per analyst | Skip failed agent + flag |
| ANALYZING | HUMAN_REVIEW_GATE_2 | Owner configured optional gate | - | - |
| CROSS_QA | DEBATING | All questions asked | 90 sec | Proceed with logged timeout |
| HUMAN_REVIEW_GATE_2 | DEBATING | Skip requested or owner continue | - | - |
| DEBATING | SYNTHESIZING | Max 3 rounds OR all resolved | 3 rounds max | Close with unresolved flags |
| SYNTHESIZING | HUMAN_REVIEW_GATE_3 | CIO output produced | 2 min | Fail + log |
| HUMAN_REVIEW_GATE_3 | DECIDED | Owner confirms | - | - |
| DECIDED | JOURNALED | Journal schema valid | - | Retry |
| *Any* | FAILED | Timeout / adapter error / abort | Varies | Log + notify |

### 4.2 Error State Transitions

**Conditions for FAILED transition:**

1. **Timeout Error**
   - State exceeds configured timeout
   - No progress for configured duration
   - Agent unresponsive

2. **Adapter Error**
   - Primary backend fails
   - Fallback backend fails
   - No backend available for required agent

3. **Owner Abort**
   - Explicit owner request to stop
   - Mission no longer relevant

4. **Validation Error**
   - Critical schema violation
   - Constitution rule violation with BLOCK_MISSION

**FAILED State Requirements:**
```yaml
failed_state:
  must_include:
    - original_state: string      # Which state failed
    - failure_reason: string      # Why it failed
    - failure_timestamp: datetime # When it failed
    - partial_outputs: object     # Any work completed
    - recovery_options: list      # What owner can do
```

---

## 5. State-Specific Behaviors

### 5.1 DRAFT State

**Entry:** Owner provides brief

**Validation:**
```typescript
interface Brief {
  type: "stock_analysis" | "portfolio_review" | "quick_screen"
  domain: string
  ticker?: string
  description: string
  owner_assumptions?: Record<string, any>
  constraints?: Record<string, any>
}
```

**Exit Condition:** Brief passes validation

**Output:** Mission Object

---

### 5.2 PLANNING State

**Entry:** Valid brief from DRAFT

**Actions:**
1. Parse mission type
2. Select required agents from domain config
3. Define evidence requirements
4. Create execution plan
5. Allocate context budgets

**Exit Condition:** Team selected, plan created

**Output:** Mission configuration

---

### 5.3 RESEARCHING State

**Entry:** Team ready from PLANNING

**Actions:**
1. Researcher agents gather evidence
2. Create evidence pack
3. Calculate evidence score
4. Identify data gaps

**Exit Condition:** Evidence pack complete OR timeout

**Output:** Evidence Pack + Score

---

### 5.4 HUMAN_REVIEW_GATE_1 State

**Entry:** Evidence score < 40 OR owner configured gate

**Message to Owner:**
```
[HUMAN REVIEW REQUIRED]
Mission: {mission_id}
State: After RESEARCHING
Reason: Evidence score below threshold

Summary:
  Evidence score: {score}/100
  Critical gaps: {gap_count}
  Documents found: {documents}

⚠ Action Required: [1] Proceed [2] Add research [3] Abort
```

**Exit Condition:** Owner selects action

---

### 5.5 ANALYZING State

**Entry:** Evidence score ≥ 40

**Actions:**
1. Distribute evidence pack to analysts
2. Execute analysts in parallel
3. Collect individual outputs

**Timeout Handling:**
- Skip failed agent after timeout
- Flag which agent failed
- Continue with remaining agents

**Exit Condition:** All analysts done OR all timeouts reached

**Output:** Individual analysis reports

---

### 5.6 HUMAN_REVIEW_GATE_2 State

**Entry:** Optional gate configured

**Purpose:** Allow owner to review individual analyses before debate

**Default Behavior:** Auto-proceed after 60 seconds if no response

---

### 5.7 CROSS_QA State

**Entry:** All analyst outputs collected

**Actions:**
1. Agents review each other's outputs
2. Questions sent to relevant agents
3. Researchers respond with evidence
4. Unanswered questions collected

**Exit Condition:** All QA rounds complete OR timeout

**Output:** QA record + unanswered questions

---

### 5.8 DEBATING State

**Entry:** Cross QA complete

**Rules:**
- Maximum 3 rounds
- Each round: Agent A challenges Agent B, Agent B responds
- Challenges must cite evidence tier
- Unresolved disagreements preserved (not averaged)

**Exit Condition:** 3 rounds complete OR all disagreements resolved

**Output:** Debate record with resolved/unresolved items

---

### 5.9 SYNTHESIZING State

**Entry:** Debate complete

**Actions (CIO):**
1. Map agreement points (≥75% agreement)
2. Map disagreement points (<50% agreement)
3. Determine decision state
4. Apply constitution rules
5. Generate final report

**Validation:**
- decision_state is valid enum
- fair_value is present
- thesis_breakers not empty
- No forbidden content

**Exit Condition:** Output passes validation

---

### 5.10 HUMAN_REVIEW_GATE_3 State

**Entry:** Synthesis complete

**MANDATORY GATE** — no auto-proceed

**Message to Owner:**
```
[DECISION REVIEW REQUIRED]
Mission: {mission_id}
Decision State: {decision_state}
Fair Value: {fair_value}
Price to Watch: {price_to_watch}

Key Assumptions:
  - {assumption_1}
  - {assumption_2}

Thesis Breakers:
  - {breaker_1}
  - {breaker_2}

Actions:
  [1] Confirm Decision
  [2] Revise Assumptions
  [3] Request Re-analysis
```

**Exit Condition:** Owner confirms or requests revision

---

### 5.11 DECIDED State

**Entry:** Owner confirms decision

**Actions:**
1. Set final decision parameters
2. Validate all required fields
3. Prepare journal entry data

**Required Fields:**
```typescript
interface Decision {
  decision_state: DecisionState
  fair_value_conservative: number
  price_to_watch: number
  thesis_breakers: string[]
  follow_up_events: FollowUpEvent[]
}
```

---

### 5.12 JOURNALED State

**Entry:** Decision validated

**Actions:**
1. Write journal entry
2. Set follow-up reminders
3. Mark mission complete
4. Notify owner

**Terminal State** — mission is complete

---

## 6. Timeout Configurations

```yaml
timeouts:
  researching:
    per_researcher: 180     # 3 minutes
    total: 600              # 10 minutes max

  analyzing:
    per_analyst: 120        # 2 minutes
    total: 600              # 10 minutes max

  cross_qa:
    total: 90               # 90 seconds

  debating:
    per_round: 120          # 2 minutes per round
    max_rounds: 3
    total: 600              # 10 minutes max

  synthesizing:
    total: 120              # 2 minutes

  human_gates:
    gate_1: null            # indefinite wait
    gate_2: 60              # 60 seconds auto-proceed
    gate_3: null            # indefinite wait
```

---

## 7. State Persistence

Every state transition is persisted:

```typescript
interface StateTransition {
  mission_id: string
  from_state: MissionState
  to_state: MissionState
  timestamp: Date
  duration_ms: number
  trigger: "condition_met" | "timeout" | "owner_action" | "error"
}
```

Storage: `mission_transitions` table in SQLite
