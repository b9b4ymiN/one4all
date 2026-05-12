# Evidence Standard

**Version:** 1.0
**Date:** 2026-05-12
**Status:** Approved

---

## 1. Purpose

The Evidence Standard defines how information is classified, sourced, and validated throughout one4all. Every claim in the system must meet these standards.

### Core Principles

1. **Every claim must have a source** — No sourceless assertions
2. **Facts must be distinguished from assumptions** — Clear labeling
3. **Data gaps must be surfaced** — Hide nothing
4. **Evidence tiers determine weight** — Not all sources are equal

---

## 2. Claim Tagging Standards

### 2.1 Claim Labels

Every claim MUST be tagged with one of these labels:

| Label | Definition | Example |
|-------|------------|---------|
| `FACT` | Direct from official source, verifiable | "Revenue: 2,450M THB [FACT, 56-1, tier_1]" |
| `DERIVED` | Calculated from FACT with clear methodology | "Revenue growth: 8.5% [DERIVED from 2024-2025 FACTs]" |
| `ASSUMPTION` | Modeling assumption for projections | "Revenue growth Y1-Y5: 10% [ASSUMPTION]" |
| `ESTIMATE` | Estimate with methodology and confidence | "Market size: ~10,000M THB [ESTIMATE, confidence: medium]" |
| `UNVERIFIED` | From secondary source, not yet confirmed by primary | "Competitor price: 15% lower [UNVERIFIED, news source]" |
| `MANAGEMENT_CLAIM` | Statement from management, not fact | "Expected growth: 15% [MANAGEMENT_CLAIM, earnings call]" |
| `MARKET_EXPECTATION` | What market appears to price in | "Market implies growth: 12% [MARKET_EXPECTATION, reverse DCF]" |

### 2.2 Label Usage Rules

```
FACT:
  - MUST have source tier specified
  - MUST be verifiable from original document
  - CANNOT be based on another agent's output

DERIVED:
  - MUST cite source FACTs used in calculation
  - MUST show methodology if complex
  - CANNOT have circular references

ASSUMPTION:
  - MUST be explicitly acknowledged as assumption
  - MUST have what_would_change_my_mind consideration
  - SHOULD be based on some evidence (even if weak)

ESTIMATE:
  - MUST include methodology
  - MUST include confidence level
  - SHOULD have sensitivity analysis

UNVERIFIED:
  - SHOULD attempt to verify with primary source
  - CANNOT be used as sole basis for decision

MANAGEMENT_CLAIM:
  - MUST NOT be labeled as FACT
  - MUST have source tier 2 or better
  - SHOULD be corroborated with actual results

MARKET_EXPECTATION:
  - MUST show calculation method (reverse DCF, etc.)
  - IS for context, not as basis for thesis
```

---

## 3. Evidence Pack Structure

### 3.1 Complete Structure

```
evidence_pack/
├── metadata.yaml                    # Mission ID, date, market, ticker
├── source_log.yaml                  # Every source used with tier
├── financial_statements/
│   ├── income_statement.md          # [FACT] labeled
│   ├── balance_sheet.md             # [FACT] labeled
│   ├── cashflow_statement.md        # [FACT] labeled
│   └── notes.md                     # [FACT] labeled
├── business_context/
│   ├── business_model.md
│   ├── segment_data.md
│   └── risk_factors.md
├── management_communication/
│   ├── mdna.md                      # [MANAGEMENT_CLAIM] labeled
│   └── opportunity_day.md           # [MANAGEMENT_CLAIM] labeled
├── market_context/
│   ├── industry_data.md
│   └── peer_comparison.md
└── data_gaps.md                     # What couldn't be found
```

### 3.2 Metadata Schema

```typescript
interface EvidencePackMetadata {
  mission_id: string
  created_at: string
  ticker: string
  market: string

  sources: {
    total: number
    by_tier: {
      tier_1: number
      tier_2: number
      tier_3: number
      tier_4: number
      tier_5: number
    }
  }

  evidence_score: number  // 0-100
}
```

### 3.3 Source Log Schema

```typescript
interface SourceLog {
  sources: Array<{
    source_id: string
    source_name: string
    source_tier: "tier_1" | "tier_2" | "tier_3" | "tier_4" | "tier_5"
    url?: string
    filed_date?: string
    label: "FACT" | "MANAGEMENT_CLAIM" | "UNVERIFIED"
    used_for: string[]
  }>
}
```

---

## 4. Evidence Score Calculation

### 4.1 Scoring Formula

```
Base Score:
  Tier 1 source found → +25 per source (max 50)
  Tier 2 source found → +10 per source (max 20)
  Tier 3 source found → +5 per source (max 10)

Bonus:
  All required documents present → +10
  No critical data gaps → +10

Penalty:
  Critical data gap → -15 per gap
  Only Tier 5 sources → -20
  No Tier 1-3 sources → -10

Score = Base + Bonus - Penalty
Range: 0 to 100
```

### 4.2 Score Thresholds

| Score Range | Action | Description |
|-------------|--------|-------------|
| ≥ 70 | Proceed | Good evidence quality |
| 40-69 | Conditional | Proceed with HUMAN_REVIEW gate |
| < 40 | Block | Must have human review before proceeding |
| < 20 | Recommend abort | Evidence too weak |

### 4.3 Critical Data Gaps

A data gap is CRITICAL if it affects:
- Normalized earnings calculation
- Key valuation inputs (revenue, margins, growth)
- Risk assessment (debt, contracts, competitive position)

Examples of critical fields:
```typescript
critical_fields = [
  "normalized_earnings",
  "revenue",
  "operating_margin",
  "debt_structure",
  "major_contracts",
  "major_shareholders",
  "capex_plan"
]
```

---

## 5. Source Tier Definitions

### 5.1 Tier Classifications

| Tier | Name | Description | Examples | Label As |
|------|------|-------------|----------|----------|
| Tier 1 | Official Primary | SEC/SET filings, audited statements | 10-K, 10-Q, 56-1, Annual Reports | FACT |
| Tier 2 | Company Verified | Company communications, verified | Earnings calls, Investor days, MD&A | MANAGEMENT_CLAIM |
| Tier 3 | Third-Party Analysis | Professional research | Analyst reports, Research papers, Credit ratings | UNVERIFIED |
| Tier 4 | Media Coverage | Financial news, press releases | Bloomberg, Reuters, Company press releases | UNVERIFIED |
| Tier 5 | Unverified | Social, rumors, forums | Stock forums, Social media, Rumors | UNVERIFIED |

### 5.2 Thai SET Specific Sources

```yaml
tier_1_sources:
  - id: set_quarterly_filing
    name: "SET Quarterly Filing (56-2)"
    url_pattern: "https://www.set.or.th/en/market/filings"
    reliability: tier_1
    label_as: FACT

  - id: annual_report_56_1
    name: "56-1 One Report (Annual)"
    url_pattern: "https://market.sec.or.th/..."
    reliability: tier_1
    label_as: FACT

tier_2_sources:
  - id: opportunity_day
    name: "Opportunity Day / Analyst Meeting"
    reliability: tier_2
    label_as: MANAGEMENT_CLAIM

  - id: earnings_call
    name: "Earnings Conference Call"
    reliability: tier_2
    label_as: MANAGEMENT_CLAIM

tier_3_sources:
  - id: analyst_report
    name: "Broker Analyst Report"
    reliability: tier_3
    label_as: UNVERIFIED

tier_4_sources:
  - id: news_thai
    name: "Thai Financial News (Bangkok Post, etc.)"
    reliability: tier_4
    label_as: UNVERIFIED

tier_5_sources:
  - id: social_media
    name: "Social Media / Chat Groups"
    reliability: tier_5
    label_as: UNVERIFIED
    warning: "For rumor monitoring only — never as basis for analysis"
```

---

## 6. Data Gap Handling

### 6.1 Data Gap Schema

```typescript
interface DataGap {
  requested_field: string
  not_found_in: string[]           // Sources searched
  impact: string                   // How this affects analysis
  suggested_alternative?: string   // What to do instead
  severity: "critical" | "moderate" | "low"
}
```

### 6.2 Data Gap Examples

```typescript
// Critical gap
{
  requested_field: "Capex plan for 2026-2028",
  not_found_in: ["56-1 Annual Report", "Q1-2026 Filing", "Opportunity Day"],
  impact: "Cannot verify reinvestment rate assumption. Will use historical average.",
  suggested_alternative: "Use 5-year historical capex average as MANAGEMENT_CLAIM",
  severity: "critical"
}

// Moderate gap
{
  requested_field: "Segment margin breakdown",
  not_found_in: ["56-1 Annual Report"],
  impact: "Cannot analyze segment profitability in detail",
  severity: "moderate"
}

// Low severity gap
{
  requested_field: "Competitor pricing for new product",
  not_found_in: ["Company sources"],
  impact: "Limited view on competitive positioning",
  severity: "low"
}
```

### 6.3 Gap Handling Rules

```
IF severity = "critical":
  → Flag in evidence score
  → Insert HUMAN_REVIEW gate if score < 40
  → Clearly state in final report

IF severity = "moderate":
  → Flag in evidence pack
  → Note in relevant section of report

IF severity = "low":
  → Log for reference
  → No special action
```

---

## 7. Evidence Audit Trail

### 7.1 Purpose

Every claim in a final report must be traceable to its source.

### 7.2 Audit Trail Format

```
EVIDENCE AUDIT TRAIL: {mission_id}

CLAIM: "{claim text}"
├── Label: {FACT | DERIVED | ASSUMPTION | ...}
├── Made by: {agent_id}
├── Source: {source_name}
├── Source Tier: {tier_1 | tier_2 | ...}
├── Section: {section reference}
├── Filed on: {date}
├── Used by: {agents who used this claim}
└── Challenged: {yes | no}
    └── Challenge: {details}
    └── Resolution: {details}
```

### 7.3 Audit Trail Example

```
EVIDENCE AUDIT TRAIL: MCS-valuation-20260511-001

CLAIM: "Revenue FY2025 = 2,450M THB"
├── Label: FACT
├── Made by: researcher-set
├── Source: 56-1 One Report 2025
├── Source Tier: tier_1
├── Section: Financial Statements, Page 45
├── Filed on: 2026-03-15
├── Used by: damodaran-valuation (in DCF base assumptions)
└── Challenged: No

CLAIM: "Revenue growth 10% for Y1-Y5"
├── Label: ASSUMPTION
├── Made by: damodaran-valuation
├── Basis: Historical CAGR 7.8% + management guidance 12%
├── Revised from: 12% → 10% (owner request at Gate 3)
├── Used by: damodaran-valuation (DCF), cio-synthesizer (synthesis)
└── Challenged: Yes
    ├── By: klarman-downside (Round 1)
    ├── Challenge: "10% still aggressive vs 7.8% history"
    └── Resolution: Accepted as reasonable after owner review

CLAIM: "Management expects 15% growth in FY2026"
├── Label: MANAGEMENT_CLAIM
├── Source: Opportunity Day Q1 2026
├── Source Tier: tier_2
└── Note: NOT a fact — labeled correctly as management claim
```

---

## 8. Evidence Validation Rules

### 8.1 Researcher Agent Validation

The researcher agent MUST:
1. Find at least 3 Tier 1 sources if available
2. Label every claim with correct label
3. Provide source tier for every source
4. Report all data gaps found
5. Calculate evidence score correctly

### 8.2 Analyst Agent Validation

Analyst agents MUST:
1. Cite evidence for all non-assumption claims
2. Not create new "facts" without sourcing
3. Flag data gaps they discover
4. Use correct labels for assumptions

### 8.3 Output Validation

Every agent output is checked:
```typescript
interface EvidenceValidation {
  all_facts_have_sources: boolean
  all_sources_have_tiers: boolean
  all_assumptions_labeled: boolean
  data_gaps_declared: boolean
  evidence_score_calculated: boolean
  passed: boolean
  errors: string[]
}
```

---

## 9. Evidence Request Protocol

When an analyst needs additional evidence:

### 9.1 Request Format

```typescript
interface EvidenceRequest {
  from: string                    // Agent requesting
  to: "researcher-set"
  request: string                 // What is needed
  reason: string                  // Why it's needed
  required_tier: "tier_1" | "tier_2" | "tier_3"
  mission_id: string
}
```

### 9.2 Response Format

```typescript
interface EvidenceResponse {
  from: "researcher-set"
  to: string                      // Requesting agent
  found: boolean

  evidence?: Array<{
    claim: string
    source_name: string
    source_tier: string
    section: string
    label: "FACT" | "MANAGEMENT_CLAIM" | "UNVERIFIED"
  }>

  data_gaps?: DataGap[]
  evidence_pack_updated: boolean
}
```

### 9.3 Request Limits

```
Maximum rounds: 2
Timeout per round: 60 seconds

If not found after 2 rounds:
  → Log as data gap
  → Suggest alternative
  → Proceed with flagged assumption
```
