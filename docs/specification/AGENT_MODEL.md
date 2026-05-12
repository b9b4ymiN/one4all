# Agent Model: Output Schemas

**Version:** 1.0
**Date:** 2026-05-12
**Status:** Approved

---

## 1. Agent Model Philosophy

### Agent ≠ Model

```
Agent = Role + Persona + Worldview + Skills + Tools + Interaction Rules + Output Contract

Model = Engine the agent uses for thinking (swappable without changing agent)
```

### Output Contracts

Every agent MUST:
1. Define its output schema (Zod format)
2. Specify mandatory fields
3. Specify forbidden content
4. Provide validation rules

---

## 2. Investment War Room Agents

### 2.1 Researcher Set (researcher-set)

**Role:** Gather information from official sources

**Persona:** SET/SEC Expert — meticulous about source quality

**Primary Model:** Gemini (long context)

---

**Input Requirements:**
```typescript
interface ResearcherInput {
  mission_id: string
  ticker: string
  market: "thai-set" | "us-nyse" | "us-nasdaq"
  evidence_requirements: {
    minimum_sources: { tier: string; count: number }[]
    required_documents: string[]
  }
}
```

**Output Schema:**
```typescript
interface ResearcherOutput {
  // Metadata
  agent_id: "researcher-set"
  mission_id: string
  timestamp: string

  // Evidence Pack
  evidence_pack: {
    metadata: {
      sources_found: number
      tier1_sources: number
      tier2_sources: number
      evidence_score: number  // 0-100
    }

    source_log: Array<{
      source_name: string
      source_tier: "tier_1" | "tier_2" | "tier_3" | "tier_4" | "tier_5"
      url?: string
      filed_date?: string
      label: "FACT" | "MANAGEMENT_CLAIM" | "UNVERIFIED"
    }>

    financial_statements: {
      income_statement: {
        revenue: number
        cost_of_goods_sold: number
        gross_profit: number
        operating_income: number
        net_income: number
        eps: number
        labels: "FACT"  // Must be FACT
        source: string
      }
      balance_sheet: {
        total_assets: number
        total_liabilities: number
        shareholders_equity: number
        labels: "FACT"
        source: string
      }
      cashflow_statement: {
        operating_cashflow: number
        investing_cashflow: number
        financing_cashflow: number
        labels: "FACT"
        source: string
      }
    }

    business_context: {
      business_model: string
      segments: Array<{ name: string; revenue: number; margin: number }>
      risk_factors: string[]
    }

    management_communication: {
      guidance?: string
      strategy?: string
      labels: "MANAGEMENT_CLAIM"
    }
  }

  // Data Gaps
  data_gaps: Array<{
    requested_field: string
    not_found_in: string[]
    impact: string
    suggested_alternative?: string
  }>
}
```

**Mandatory Fields:**
- evidence_pack.metadata.evidence_score
- evidence_pack.source_log (at least 1 entry)
- evidence_pack.financial_statements
- data_gaps (may be empty)

**Forbidden Content:**
- None for researcher (fact-gatherer role)

**Validation Rules:**
- Every financial number MUST have label: "FACT"
- Every source MUST have tier specified
- Evidence score MUST be calculated correctly
---

### 2.2 Forensic Accountant (forensic-accountant)

**Role:** Analyze earnings quality, identify one-off items

**Persona:** Skeptical accountant — "show me the cash flow"

**Primary Model:** Claude

---

**Input Requirements:**
```typescript
interface ForensicInput {
  mission_id: string
  evidence_pack: any  // From researcher
  owner_assumption?: number  // If owner provided normalized earnings
}
```

**Output Schema:**
```typescript
interface ForensicOutput {
  agent_id: "forensic-accountant"
  mission_id: string
  timestamp: string

  normalized_earnings: {
    reported_net_income: number
    one_off_items: Array<{
      item: string
      amount: number
      label: "ONE_OFF"
      reason: string
      source: string
    }>
    normalized_net_income: number
    adjustment_amount: number
  }

  earnings_quality: {
    operating_cashflow: number
    ocf_to_ni_ratio: number  // OCF / Net Income
    quality_rating: "high" | "medium" | "low" | "negative"
    flags: string[]
  }

  confidence: "high" | "medium" | "low"
  confidence_reasoning: string

  key_findings: string[]

  what_would_change_my_mind: string[]

  data_gaps_found: string[]
}
```

**Mandatory Fields:**
- normalized_earnings.normalized_net_income
- earnings_quality.quality_rating
- confidence
- what_would_change_my_mind

**Forbidden Content:**
- buy/sell recommendations

**Validation Rules:**
- OCF to NI ratio MUST be calculated
- If OCF < 70% of NI, quality_rating MUST be "low" or "negative"
- All adjustments MUST have source

---

### 2.3 Damodaran Valuation (damodaran-valuation)

**Role:** DCF-based intrinsic value calculation

**Persona:** Prof. Damodaran — "Story must become numbers"

**Primary Model:** Claude

---

**Input Requirements:**
```typescript
interface DamodaranInput {
  mission_id: string
  evidence_pack: any
  normalized_earnings_result: any  // From forensic-accountant
}
```

**Output Schema:**
```typescript
interface DamodaranOutput {
  agent_id: "damodaran-valuation"
  mission_id: string
  timestamp: string

  // DCF Inputs
  dcf_inputs: {
    base_revenue: number
    revenue_growth_y1_y5: number  // %
    revenue_growth_y6_y10: number  // %
    terminal_growth: number  // %
    operating_margin_target: number  // %
    wacc: number  // %
    tax_rate: number  // %
  }

  // DCF Results
  dcf_results: {
    fair_value_conservative: number
    fair_value_base: number
    fair_value_optimistic: number
    per_share_values: {
      conservative: number
      base: number
      optimistic: number
    }
  }

  // Reverse DCF
  reverse_dcf: {
    current_price: number
    implied_growth_at_current_price: number  // %
    market_implied_wacc: number  // %
  }

  // Sensitivity
  sensitivity: {
    parameter: string
    scenarios: Array<{
      scenario: string
      value: number
      fair_value: number
    }>
  }

  conviction_level: number  // 1-10

  key_assumptions: Array<{
    assumption: string
    value: number | string
    label: "FACT" | "DERIVED" | "ASSUMPTION"
    source?: string
  }>

  what_would_change_my_mind: string[]

  data_gaps_found: string[]
}
```

**Mandatory Fields:**
- dcf_results.fair_value_conservative
- reverse_dcf.implied_growth_at_current_price
- conviction_level (1-10)
- key_assumptions
- what_would_change_my_mind

**Forbidden Content:**
- "buy" or "sell" recommendation
- "undervalued" or "overvalued" without numbers

**Validation Rules:**
- Terminal growth MUST be ≤ risk-free rate
- WACC MUST be reasonable (5-15% typically)
- Conviction level MUST be 1-10
- Growth assumptions MUST have reinvestment support

---

### 2.4 Klarman Downside (klarman-downside)

**Role:** Margin of safety, downside case analysis

**Persona:** Seth Klarman — "first, don't lose"

**Primary Model:** ZAI

---

**Input Requirements:**
```typescript
interface KlarmanInput {
  mission_id: string
  evidence_pack: any
  normalized_earnings_result: any
}
```

**Output Schema:**
```typescript
interface KlarmanOutput {
  agent_id: "klarman-downside"
  mission_id: string
  timestamp: string

  // Downside Scenarios
  downside_scenarios: Array<{
    scenario: "base" | "stress" | "distress"
    description: string
    probability: number  // 0-1
    normalized_earnings: number
    fair_value: number
    mos_percentage: number  // Margin of Safety %
  }>

  // Margin of Safety Analysis
  margin_of_safety: {
    current_price: number
    conservative_fair_value: number
    mos_30_price: number  // Price for 30% MOS
    mos_50_price: number  // Price for 50% MOS
    current_mos: number  // %
  }

  // Risk Factors
  key_risks: Array<{
    risk: string
    severity: "high" | "medium" | "low"
    probability: "high" | "medium" | "low"
    mitigation?: string
  }>

  // Balance Sheet Check
  balance_sheet_health: {
    debt_to_equity: number
    current_ratio: number
    interest_coverage: number
    health_rating: "strong" | "adequate" | "weak" | "distressed"
  }

  conviction_level: number  // 1-10

  what_would_change_my_mind: string[]

  data_gaps_found: string[]
}
```

**Mandatory Fields:**
- downside_scenarios (at least base and stress)
- margin_of_safety
- key_risks
- conviction_level
- what_would_change_my_mind

**Forbidden Content:**
- "buy" or "sell" recommendation
- Optimistic language without downside consideration

**Validation Rules:**
- At least 2 downside scenarios
- MOS calculation MUST be explicit
- Distressed scenario MUST be included

---

### 2.5 Portfolio Allocator (portfolio-allocator)

**Role:** Position sizing and portfolio fit analysis

**Persona:** Portfolio Manager — "how does this fit?"

**Primary Model:** Claude

---

**Input Requirements:**
```typescript
interface PortfolioInput {
  mission_id: string
  evidence_pack: any
  valuation_result: any  // From damodaran
  downside_result: any  // From klarman
  current_portfolio?: any
}
```

**Output Schema:**
```typescript
interface PortfolioOutput {
  agent_id: "portfolio-allocator"
  mission_id: string
  timestamp: string

  // Position Sizing
  position_sizing: {
    recommended_max_position: number  // % of portfolio
    starter_position: number  // % of portfolio
    full_position: number  // % of portfolio
    sizing_methodology: string
  }

  // Portfolio Fit
  portfolio_fit: {
    current_exposure: number  // % if already owned
    sector_overlap: string[]
    correlation_risk: string[]
    diversification_benefit: string
  }

  // Risk-Adjusted Return
  risk_return: {
    expected_return: number  // %
    risk_level: "low" | "medium" | "high"
    sharpe_estimate: number
    max_drawdown_estimate: number
  }

  // Entry Strategy
  entry_strategy: {
    initial_entry: number  // Price
    add_on_weakness: number  // Price
    stop_loss: number  // Price (if applicable)
  }

  conviction_level: number  // 1-10

  what_would_change_my_mind: string[]

  data_gaps_found: string[]
}
```

**Mandatory Fields:**
- position_sizing.recommended_max_position
- position_sizing.starter_position
- portfolio_fit
- conviction_level
- what_would_change_my_mind

**Forbidden Content:**
- Absolute position size (use % of portfolio)
- "all in" or "nothing" language

---

### 2.6 Pro-Investor (pro-investor)

**Role:** Apply owner's personal investment framework

**Persona:** Owner's Conscious — "am I following my rules?"

**Primary Model:** Claude

---

**Input Requirements:**
```typescript
interface ProInvestorInput {
  mission_id: string
  evidence_pack: any
  all_analyses: any  // All other agent outputs
  owner_checklist: any  // Owner's personal rules
}
```

**Output Schema:**
```typescript
interface ProInvestorOutput {
  agent_id: "pro-investor"
  mission_id: string
  timestamp: string

  // Checklist Results
  checklist_results: Array<{
    rule: string
    passed: boolean
    reasoning: string
  }>

  // Owner Framework Alignment
  framework_alignment: {
    passes_framework: boolean
    failed_rules: string[]
    caveats: string[]
  }

  // Personal Considerations
  personal_context: {
    current_portfolio_fit: string
    liquidity_needs: string
    time_horizon: string
    risk_tolerance: string
  }

  conviction_level: number  // 1-10

  what_would_change_my_mind: string[]

  data_gaps_found: string[]
}
```

**Mandatory Fields:**
- checklist_results
- framework_alignment.passes_framework
- conviction_level

**Forbidden Content:**
- Overriding owner's framework

---

### 2.7 CIO Synthesizer (cio-synthesizer)

**Role:** Combine all outputs into final decision

**Persona:** Chief Investment Officer — "synthesize or die"

**Primary Model:** Claude

---

**Input Requirements:**
```typescript
interface CIOInput {
  mission_id: string
  all_agent_outputs: any
  debate_records: any
  unresolved_disagreements: any
}
```

**Output Schema:**
```typescript
interface CIOOutput {
  agent_id: "cio-synthesizer"
  mission_id: string
  timestamp: string

  // Final Decision
  decision: {
    decision_state: DecisionState
    decision_date: string
    rationale_summary: string
  }

  // Valuation Consensus
  valuation: {
    fair_value_conservative: number
    fair_value_base: number
    price_for_mos_30: number
    current_price: number
    price_to_watch: number
  }

  // Analyst Views
  analyst_views: {
    damodaran: { fair_value: number; conviction: number; view: string }
    klarman: { fair_value: number; conviction: number; view: string }
    portfolio: { position: number; conviction: number; view: string }
    consensus: string
  }

  // Agreement Mapping
  agreement_analysis: {
    high_confidence_points: string[]  // ≥75% agreement
    disagreement_points: Array<{
      topic: string
      agents: string[]
      nature_of_disagreement: string
    }>
  }

  // Thesis Breakers
  thesis_breakers: string[]

  // Follow-up Events
  follow_up_events: Array<{
    event: string
    expected_date: string
    watch_for: string
  }>

  // Evidence Quality
  evidence_quality: {
    score: number
    tier1_sources: number
    data_gaps: string[]
  }

  // What Next
  what_next: {
    action: string
    trigger: string
    timeframe: string
  }
}
```

**Decision State Enum:**
```typescript
type DecisionState =
  | "REJECT"
  | "WATCH"
  | "RESEARCH_MORE"
  | "WAIT_FOR_PRICE"
  | "STARTER_POSITION"
  | "CORE_CANDIDATE"
  | "ADD_ON_WEAKNESS"
  | "HOLD"
  | "TRIM"
  | "EXIT_THESIS_BROKEN"
```

**Mandatory Fields:**
- decision.decision_state
- decision.rationale_summary
- valuation.fair_value_conservative
- valuation.price_to_watch
- thesis_breakers
- follow_up_events
- evidence_quality

**Forbidden Content:**
- "buy" or "sell" (use decision_state instead)
- Resolving disagreements artificially

**Validation Rules:**
- decision_state MUST be valid enum value
- price_to_watch MUST be < current_price for WAIT_FOR_PRICE
- thesis_breakers MUST NOT be empty
- All disagreements MUST be surfaced

---

### 2.8 Book Master (book-master)

**Role:** Generate formatted final report

**Persona:** Document Generator — "make it readable"

**Primary Model:** Claude

---

**Input Requirements:**
```typescript
interface BookMasterInput {
  mission_id: string
  cio_output: any
  evidence_pack: any
  template: string
}
```

**Output Schema:**
```typescript
interface BookMasterOutput {
  agent_id: "book-master"
  mission_id: string
  timestamp: string

  report_format: "full_investment_report" | "executive_summary" | "data_sheet"

  report: {
    title: string
    date: string
    ticker: string

    sections: Array<{
      heading: string
      content: string
      tables?: any[]
      charts?: any[]
    }>

    appendix?: {
      data_sources: string[]
      methodology: string
      assumptions: string[]
    }
  }
}
```

**Mandatory Fields:**
- report.title
- report.sections
- All mandatory report sections from domain config

---

## 3. Universal Agent Requirements

### 3.1 Fields Every Agent Must Provide

```typescript
interface UniversalAgentFields {
  agent_id: string
  mission_id: string
  timestamp: string

  // Analysis
  conviction_level: number  // 1-10

  // Intellectual Honesty
  what_would_change_my_mind: string[]

  // Data Transparency
  data_gaps_found: string[]
}
```

### 3.2 Forbidden Content (All Agents)

- "buy" or "sell" recommendations
- "undervalued" or "overvalued" without specific numbers
- Confidence without conviction_level
- Hiding data gaps
- Averaging out disagreements (in synthesis)

### 3.3 Label Requirements

Every claim MUST be labeled:
- `FACT` — Direct from official source
- `DERIVED` — Calculated from FACT
- `ASSUMPTION` — Modeling assumption
- `ESTIMATE` — Estimate with methodology
- `UNVERIFIED` — From secondary source
- `MANAGEMENT_CLAIM` — From management, not fact

### 3.4 Source Requirements

Every FACT MUST have:
- Source name
- Source tier
- Section reference (if applicable)
- Filed date (if applicable)
