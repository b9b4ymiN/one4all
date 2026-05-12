# Company Constitution: Investment War Room

**Version:** 1.0
**Domain:** investment-war-room
**Date:** 2026-05-12
**Status:** Approved

---

## 1. Purpose

The Company Constitution contains rules that override ALL agents, ALL missions, and ALL operations within this domain. Unlike agent rules (which apply to specific agents), constitution rules apply universally.

### Why Constitution Exists

```
Agent Rule:     "Damodaran must do sensitivity analysis"
                → Applies only to damodaran-valuation agent

Company Rule:   "No analysis without normalized earnings verification"
                → Applies to ALL agents, ALL missions
                → No exceptions
```

---

## 2. Enforcement Levels

| Level | Behavior | Example |
|-------|----------|---------|
| `BLOCK_MISSION` | Mission cannot proceed if violated | No analysis without evidence |
| `INSERT_HUMAN_REVIEW` | Add checkpoint, notify owner | Low evidence score gate |
| `WARN_AND_FLAG` | Proceed but log warning | Using Tier 5 source |
| `REJECT_OUTPUT` | Reject agent output | Output contains "buy recommendation" |

---

## 3. Constitution Rules

### 3.1 Evidence Rules

#### Rule 1: No Analysis Without Evidence

```yaml
id: no_analysis_without_evidence
description: "Every analysis must be based on verified evidence"
enforcement: BLOCK_MISSION
applies_to: all_agents
exception: none

validation:
  - "Every FACT must have source_tier specified"
  - "Every DERIVED must cite source FACTs"
  - "No sourceless claims allowed"

violation_example:
  bad: "Revenue is growing at 15%"
  good: "Revenue grew 15% [FACT, source: 56-1, tier_1]"
```

#### Rule 2: Normalized Earnings Required

```yaml
id: normalized_earnings_required
description: "No valuation without normalized earnings verification"
enforcement: BLOCK_MISSION
applies_to: [damodaran-valuation, klarman-downside, portfolio-allocator]
exception: none

validation:
  - "forensic-accountant must complete first"
  - "normalized_earnings must be calculated"
  - "quality_rating must be provided"

violation_example:
  bad: "DCF based on reported net income of 100M"
  good: "DCF based on normalized earnings of 85M (after removing 15M one-off gain)"
```

#### Rule 3: Data Gaps Must Surface

```yaml
id: data_gaps_must_surface
description: "Critical data gaps must be disclosed to owner"
enforcement: INSERT_HUMAN_REVIEW
applies_to: researcher-set
trigger_condition: "critical_field missing"

critical_fields:
  - normalized_earnings
  - revenue
  - major_shareholders
  - debt_structure
  - capex

violation_example:
  bad: "Proceeding without capex data (not mentioned)"
  good: "CAPES DATA GAP: Cannot find capex plan. Using historical average instead."
```

#### Rule 4: Evidence Score Threshold

```yaml
id: evidence_score_threshold
description: "Low evidence score requires human review"
enforcement: INSERT_HUMAN_REVIEW
applies_to: evidence_controller

thresholds:
  - score: < 20
    action: "recommend_abort"
  - score: < 40
    action: "human_review_required"
  - score: 40-69
    action: "human_review_conditional"
  - score: ≥ 70
    action: "proceed"
```

---

### 3.2 Output Rules

#### Rule 5: No Buy/Sell Recommendations

```yaml
id: no_buy_sell_recommendation
description: "System outputs decision states, not recommendations"
enforcement: REJECT_OUTPUT
applies_to: all_agents
exception: none

forbidden_phrases:
  - "buy"
  - "sell"
  - "strong buy"
  - "strong sell"
  - "accumulate"
  - "dispose"

allowed_phrases:
  - "decision_state: WAIT_FOR_PRICE"
  - "decision_state: CORE_CANDIDATE"
  - "fair value exceeds current price by X%"
  - "margin of safety is Y%"

violation_example:
  bad: "I recommend buying this stock"
  good: "Decision state: WAIT_FOR_PRICE at 24.00 (MOS 30% would be at 23.94)"
```

#### Rule 6: Conviction Level Required

```yaml
id: conviction_level_required
description: "Every analysis must state conviction level 1-10"
enforcement: REJECT_OUTPUT
applies_to: all_analyst_agents
exception: none

validation:
  - "conviction_level must be 1-10"
  - "conviction_reasoning must be provided"

conviction_guidelines:
  1-3: "Low conviction — major data gaps or conflicting evidence"
  4-6: "Medium conviction — adequate evidence but some uncertainty"
  7-10: "High conviction — strong evidence, clear thesis"

violation_example:
  bad: "This is a great opportunity"
  good: "Conviction: 6/10 — Good business, fair valuation, but waiting for better price"
```

#### Rule 7: What Would Change My Mind Required

```yaml
id: what_would_change_my_mind_required
description: "Every analyst must state what would invalidate their thesis"
enforcement: REJECT_OUTPUT
applies_to: all_analyst_agents
exception: none

validation:
  - "what_would_change_my_mind must not be empty"
  - "At least 3 specific items required"

violation_example:
  bad: "Nothing — this is a solid investment"
  good: "What would change my mind: (1) Q2 earnings < 80M, (2) major hospital contract loss, (3) founder sells >5%"
```

---

### 3.3 Valuation Rules

#### Rule 8: Terminal Growth Cap

```yaml
id: terminal_growth_cap
description: "Terminal growth cannot exceed risk-free rate"
enforcement: REJECT_OUTPUT
applies_to: damodaran-valuation
exception: "owner_explicit_override"

validation:
  - "terminal_growth <= risk_free_rate"
  - "If risk_free_rate not found, use 3% as cap"

violation_example:
  bad: "Terminal growth: 5% (higher than risk-free rate)"
  good: "Terminal growth: 2.5% (at or below risk-free rate)"
```

#### Rule 9: WACC Reasonableness

```yaml
id: wacc_reasonableness
description: "WACC must be within reasonable bounds"
enforcement: WARN_AND_FLAG
applies_to: damodaran-valuation

validation:
  - "WACC between 5% and 15% typically"
  - "Flag if WACC > 15% or < 5%"

warning_message: "WACC of X% is outside typical range. Please verify."
```

#### Rule 10: Growth With Reinvestment

```yaml
id: growth_with_reinvestment
description: "Growth assumptions must have reinvestment support"
enforcement: REJECT_OUTPUT
applies_to: damodaran-valuation

validation:
  - "If growth > 5%, must show reinvestment rate"
  - "If margin expanding, must justify with efficiency gains"

violation_example:
  bad: "Revenue grows 15% with 2% reinvestment"
  good: "Revenue grows 15% with 8% reinvestment (capex + working capital)"
```

---

### 3.4 Risk Rules

#### Rule 11: Downside Scenario Required

```yaml
id: downside_scenario_required
description: "Every analysis must include downside scenario"
enforcement: REJECT_OUTPUT
applies_to: [damodaran-valuation, klarman-downside]
exception: none

validation:
  - "At least 2 scenarios: base and stress"
  - "Distress scenario preferred"

violation_example:
  bad: "Only presenting base case valuation"
  good: "Base: 34.20, Stress: 27.80, Distress: 18.50"
```

#### Rule 12: Thesis Breakers Required

```yaml
id: thesis_breakers_required
description: "Every decision must include thesis breakers"
enforcement: REJECT_OUTPUT
applies_to: cio-synthesizer
exception: none

validation:
  - "thesis_breakers must not be empty"
  - "At least 3 specific breakers required"
  - "Each breaker must be observable/measurable"

violation_example:
  bad: "Thesis breakers: None — this is a solid company"
  good: "Thesis breakers: (1) Q2 earnings < 80M, (2) Major contract loss, (3) Founder sells >5%"
```

---

### 3.5 Position Sizing Rules

#### Rule 13: Position Size Limits

```yaml
id: position_size_limits
description: "Position sizing must respect risk limits"
enforcement: REJECT_OUTPUT
applies_to: portfolio-allocator

validation:
  - "starter_position ≤ 5% of portfolio"
  - "full_position ≤ 15% of portfolio"
  - "If conviction < 5, max position = 3%"

violation_example:
  bad: "Recommended position: 25% of portfolio"
  good: "Starter: 2%, Full: 8% (based on conviction 6/10)"
```

---

### 3.6 Disclosure Rules

#### Rule 14: Assumptions Must Be Labeled

```yaml
id: assumptions_must_be_labeled
description: "All assumptions must be explicitly labeled"
enforcement: WARN_AND_FLAG
applies_to: all_agents

validation:
  - "Every assumption has label: ASSUMPTION"
  - "Sensitive assumptions flagged"

sensitive_assumptions:
  - revenue_growth
  - margin_expansion
  - terminal_growth
  - wacc
```

#### Rule 15: Source Tier Disclosure

```yaml
id: source_tier_disclosure
description: "Every source must have tier declared"
enforcement: REJECT_OUTPUT
applies_to: all_agents

validation:
  - "Every FACT has source_tier"
  - "If tier unknown, label as UNVERIFIED"

violation_example:
  bad: "Revenue: 2,450M THB"
  good: "Revenue: 2,450M THB [FACT, source: 56-1, tier_1]"
```

---

## 4. Agent-Specific Rules

### 4.1 Researcher Agent Rules

```yaml
researcher_rules:
  - id: researcher_must_cite_sources
    description: "Every fact must have source citation"
    enforcement: REJECT_OUTPUT
    applies_to: researcher-set

  - id: researcher_must_label_tier
    description: "Every source must have tier classification"
    enforcement: REJECT_OUTPUT
    applies_to: researcher-set

  - id: researcher_data_gaps
    description: "Must report what information could not be found"
    enforcement: REJECT_OUTPUT
    applies_to: researcher-set
```

### 4.2 Forensic Accountant Rules

```yaml
forensic_rules:
  - id: forensic_ocf_check
    description: "Must compare operating cash flow to net income"
    enforcement: REJECT_OUTPUT
    applies_to: forensic-accountant

  - id: forensic_quality_rating
    description: "Must provide earnings quality rating"
    enforcement: REJECT_OUTPUT
    applies_to: forensic-accountant
```

### 4.3 Valuation Agent Rules

```yaml
valuation_rules:
  - id: valuation_multiple_scenarios
    description: "Must provide at least 3 valuation scenarios"
    enforcement: REJECT_OUTPUT
    applies_to: damodaran-valuation

  - id: valuation_reverse_dcf
    description: "Must provide reverse DCF showing market expectations"
    enforcement: REJECT_OUTPUT
    applies_to: damodaran-valuation
```

### 4.4 CIO Rules

```yaml
cio_rules:
  - id: cio_must_preserve_disagreements
    description: "Must not artificially resolve agent disagreements"
    enforcement: REJECT_OUTPUT
    applies_to: cio-synthesizer

  - id: cio_decision_state_required
    description: "Must output valid decision state enum"
    enforcement: REJECT_OUTPUT
    applies_to: cio-synthesizer

  - id: cio_thesis_breakers_required
    description: "Must include thesis breakers in final output"
    enforcement: REJECT_OUTPUT
    applies_to: cio-synthesizer
```

---

## 5. Rule Violation Handling

### 5.1 Violation Detection

```typescript
interface ConstitutionViolation {
  rule_id: string
  agent_id: string
  mission_id: string
  severity: "block" | "reject" | "warn" | "insert_review"
  description: string
  detected_at: Date
  output_sample?: string
}
```

### 5.2 Violation Response

| Enforcement Level | Action |
|-------------------|--------|
| BLOCK_MISSION | Mission cannot proceed. Log violation. Notify owner. |
| INSERT_HUMAN_REVIEW | Add checkpoint. Flag violation in output. |
| WARN_AND_FLAG | Continue with warning. Log violation. Flag in report. |
| REJECT_OUTPUT | Reject agent output. Request retry. Log violation. |

### 5.3 Retry Policy

```
First violation: Request retry with explicit correction instruction
Second violation (same rule): Mark agent as FAILED, log, notify owner
```

---

## 6. Exception Handling

### 6.1 Owner Override

Some rules allow `owner_explicit_override`:

```yaml
if owner provides explicit override:
  log_override(rule_id, reason, owner)
  proceed with flagged output
  include warning in final report
```

### 6.2 Exception Categories

| Exception Type | When Allowed | Example |
|----------------|--------------|---------|
| owner_explicit_override | Owner confirms in gate | Terminal growth > risk-free rate with owner approval |
| emergency_skip | System degradation | Proceeding with partial evidence in outage |
| test_mode | In test environment | Using mock adapters |

---

## 7. Rule Schema

```yaml
# constitution rule template

id: unique_rule_id
name: "Human-Readable Rule Name"
description: "What this rule enforces"
version: "1.0"

enforcement: BLOCK_MISSION | INSERT_HUMAN_REVIEW | WARN_AND_FLAG | REJECT_OUTPUT
applies_to: all_agents | [agent_list] | specific_agent
exception: none | owner_explicit_override | emergency_skip

validation:
  - "specific validation criteria"
  - "another validation criterion"

forbidden_content?: []
required_fields?: []
thresholds?: {}

violation_example:
  bad: "example of violation"
  good: "example of compliance"
```
