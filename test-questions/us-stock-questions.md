# US Stock Questions for CIO Router Testing

Generated: 2026-05-16
Purpose: Test diverse inquiry types for the Investment War Room CIO Router

---

## Questions

### 1. Damodaran Valuation - AAPL
**Question:** What is the intrinsic value of Apple (AAPL) using Damodaran's DCF valuation methodology? Assume current market conditions and provide the margin of safety.

**Expected Analyst:** damodaran-valuation
**Type:** Valuation, DCF Analysis

### 2. Klarman Downside Protection - TSLA
**Question:** Analyze Tesla (TSLA) from a Seth Klarman downside protection perspective. What is the worst-case scenario valuation, and what margin of safety exists at current price levels?

**Expected Analyst:** seth-klarman / downside-protection
**Type:** Risk Assessment, Downside Analysis

### 3. Moat Analysis - NVDA
**Question:** Using Kessler's moat analysis framework, evaluate NVIDIA's (NVDA) competitive advantages. Is their moat widening or narrowing given AI competition?

**Expected Analyst:** kessler-moat
**Type:** Moat Analysis, Competitive Positioning

### 4. Michael Burry Style - META
**Question:** From a Michael Burry value investing perspective, identify any hidden risks or accounting irregularities in Meta's (META) current financials that the market may be overlooking.

**Expected Analyst:** michael-burry
**Type:** Deep Value, forensic-style analysis

### 5. Greenwald Evasion - MSFT
**Question:** Apply Greenwald's strategic analysis to Microsoft (MSFT). What are the key barriers to entry protecting their cloud and AI franchises, and can competitors circumvent them?

**Expected Analyst:** greenwald-evasion
**Type:** Strategic Analysis, Competitive Threat Assessment

### 6. Portfolio Allocation - BRK.B
**Question:** As a portfolio allocator, what position size would you recommend for Berkshire Hathaway (BRK.B) in a diversified value-focused portfolio? Justify the allocation based on risk/return characteristics.

**Expected Analyst:** portfolio-manager / allocator-steward
**Type:** Portfolio Construction, Position Sizing

### 7. Quality Assessment - GOOGL
**Question:** Using Klamran's quality scoring framework, evaluate Alphabet (GOOGL) across business quality, financial strength, and management competence. What is the overall quality score?

**Expected Analyst:** klamran-quality
**Type:** Quality Scoring, Fundamental Assessment

### 8. Devil's Advocate - AMZN
**Question:** Play devil's advocate for Amazon (AMZN). Make the strongest possible bear case against current valuation, identifying key risks that bulls may be ignoring.

**Expected Analyst:** devil-advocate
**Type:** Bear Case, Risk Identification

### 9. Consensus Analysis - JPM
**Question:** Synthesize a consensus view on JPMorgan Chase (JPM) by weighing the perspectives of valuation analysts, risk analysts, and quality analysts. What is the overall investment thesis?

**Expected Analyst:** consensus-analyst
**Type:** Synthesis, Multi-view Integration

### 10. Leveraged Franchise Analysis - V
**Question:** Evaluate Visa (V) as a leveraged franchise business. Analyze their network effects, pricing power, and capital efficiency. Does it qualify as a high-quality compounder?

**Expected Analyst:** leveraged-franchise
**Type:** Business Model Analysis, Franchise Quality

---

## Question Distribution Summary

| Stock | Question Type | Analyst Type |
|-------|---------------|--------------|
| AAPL | DCF Valuation | Damodaran |
| TSLA | Downside Protection | Klarman |
| NVDA | Moat Analysis | Kessler |
| META | Forensic/Deep Value | Burry |
| MSFT | Strategic Barriers | Greenwald |
| BRK.B | Portfolio Allocation | Portfolio Manager |
| GOOGL | Quality Scoring | Klamran |
| AMZN | Bear Case | Devil's Advocate |
| JPM | Consensus Synthesis | Consensus Analyst |
| V | Franchise Analysis | Leveraged Franchise |

## Test Coverage Notes

- **Valuation Methods:** DCF, relative valuation, worst-case scenario
- **Risk Perspectives:** Downside protection, forensic analysis, bear case construction
- **Qualitative Factors:** Moats, barriers to entry, network effects
- **Portfolio Context:** Position sizing, allocation decisions
- **Synthesis Tasks:** Consensus building, multi-analyst coordination

---

## Usage

These questions can be used to test:
1. CIO Router routing logic (question → correct analyst)
2. Analyst response quality and completeness
3. Cross-analyst coordination capabilities
4. Synthesis and consensus-building features
