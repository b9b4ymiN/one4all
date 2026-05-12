# Phase 3: Investment War Room MVP

> **Status:** Pending
> **Duration:** Week 7-10
> **Goal:** Complete working investment analysis system with real LLM agents

## Philosophy

"The kernel works, the adapters work — now build the actual team that makes investment decisions."

This is where the system becomes useful. We create real agents with real personas, connect them to real evidence sources, and produce real investment analysis.

## Agent Roster

### Researcher Agents
| Agent ID | Role | Persona | Primary Model |
|----------|------|---------|---------------|
| researcher-set | researcher | SET/SEC Expert | Gemini (long context) |
| researcher-us | researcher | SEC/EDGAR Expert | Gemini |

### Analyst Agents
| Agent ID | Role | Persona | Primary Model |
|----------|------|---------|---------------|
| forensic-accountant | analyst | Forensic Accountant | Claude |
| damodaran-valuation | analyst | Prof. Damodaran | Claude |
| klarman-downside | analyst | Seth Klarman | ZAI |
| peter-lynch-story | analyst | Peter Lynch | ZAI |
| hf-manager | analyst | HF Institutional | Claude |
| technical-analyst | analyst | Technical Trader | ZAI |
| portfolio-allocator | analyst | Portfolio Manager | Claude |
| pro-investor | analyst | Owner's Framework | Claude |

### Synthesizer Agents
| Agent ID | Role | Persona | Primary Model |
|----------|------|---------|---------------|
| cio-synthesizer | synthesizer | CIO | Claude |
| book-master | document | Document Generator | Claude |

## Deliverables

### 1. Agent Cards
**Location:** `domains/investment-war-room/agents/`

Each agent needs:
- `agent.yaml` - Configuration
- `persona.md` - Persona description
- `skills/` - Skill files

Example: `damodaran-valuation.yaml`
```yaml
id: damodaran-valuation
name: "Damodaran Valuation Partner"
role: valuation_analyst
model:
  primary:
    provider: claude
    model: claude-opus-4-5
  fallback:
    - provider: zai
      model: zai-default
skills:
  - intrinsic_valuation
  - reverse_dcf
  - sensitivity_analysis
output_contract:
  schema_ref: schemas/damodaran-output.schema.yaml
```

### 2. Skill Definitions
**Location:** `domains/investment-war-room/skills/`

Key skills:
- `normalized-earnings.yaml`
- `intrinsic-valuation.yaml`
- `reverse-dcf.yaml`
- `downside-analysis.yaml`
- `portfolio-fit.yaml`
- `thesis-breaker.yaml`

### 3. Evidence Controller & Pack Builder
**Location:** `packages/kernel/src/evidence-controller/`

Features:
- `EvidenceController`: Orchestrate the end-to-end evidence lifecycle
- `PackBuilder`: Fetch from Tier 1 sources (56-1, quarterly filings), Tier 2 sources (opportunity day, MD&A)
- Parse financial statements
- Tag claims with labels [FACT], [MANAGEMENT_CLAIM], etc.
- Build source log
- `EvidenceScorer`: Calculate evidence score
- Identify data gaps

### 4. Parallel Analyst Execution
**Location:** `packages/kernel/src/execution/parallel-runner.ts`

Features:
- Run multiple analysts simultaneously
- Evidence distribution per agent
- Context budget management per agent
- Collect all outputs
- Handle individual agent failures

### 5. Debate Controller
**Location:** `packages/kernel/src/debate/controller.ts`

Features:
- 3-round protocol
- Challenge message format
- Evidence request loop
- Resolution tracking
- Disagreement preservation
- Timeout handling

### 6. Synthesis Engine (CIO)
**Location:** `packages/kernel/src/synthesis/engine.ts`

Features:
- Agreement mapping
- Disagreement preservation
- Decision state determination
- Output assembly
- Validation against output standard

### 7. Human Checkpoint
**Location:** `packages/kernel/src/human/gate.ts`

Features:
- Console-based pause
- Evidence summary display
- Owner input capture
- Input validation
- Gate timeout (optional auto-proceed)

### 8. Report Generator
**Location:** `packages/kernel/src/report/generator.ts`

Output sections:
1. One-Page Decision Summary
2. Business Model
3. Evidence Quality
4. Normalized Earnings
5. Conservative DCF
6. Reverse DCF
7. MOS Table
8. Downside Case
9. Analyst Disagreement
10. Decision State & Thesis Breakers
11. Follow-Up Checklist
12. Audit Trail

### 9. Source Integration
**Location:** `registry/sources/thai-set.yaml`

Sources:
- SET Quarterly Filing (56-2) - Tier 1
- 56-1 One Report - Tier 1
- Opportunity Day - Tier 2
- Analyst Reports - Tier 3
- News - Tier 4

## Benchmark Stocks

For testing and validation:
- **APP** (Asian Property Development)
- **MCS** (MCS Medical)
- **HMPRO** (Hemaraj)
- **ACG** (Asset Five Fund)
- **CPALL** (CP ALL)
- **SCGD** (SCG Packaging)

Each benchmark should:
- Have full evidence pack available
- Produce complete analysis
- Generate valid decision state
- Create journal entry

## Success Criteria

### Evidence Quality
- [ ] Every FACT has source tier ≥ 2
- [ ] All claims properly labeled
- [ ] Data gaps explicitly declared
- [ ] Evidence score calculated correctly

### Analysis Quality
- [ ] Normalized earnings verified by forensic
- [ ] Conservative DCF every time
- [ ] Reverse DCF every time
- [ ] MOS table every time
- [ ] Downside case every time
- [ ] Decision state clear and actionable
- [ ] Thesis breakers identified

### System Quality
- [ ] Journal writes automatically
- [ ] Mission replay works
- [ ] All agent outputs validated
- [ ] Constitution rules enforced
- [ ] Observability data complete

### Output Quality
- [ ] Report matches owner's framework
- [ ] Price to watch calculated correctly
- [ ] Conviction level justified
- [ ] Follow-up checklist generated

## Testing Strategy

### Agent Tests
- [ ] Test each agent individually
- [ ] Test with fixture data
- [ ] Validate output schemas
- [ ] Test fallback behavior

### Integration Tests
- [ ] Full mission pipeline
- [ ] Researcher → Analysts flow
- [ ] Cross-QA flow
- [ ] Debate flow
- [ ] Synthesis flow

### Evidence Tests
- [ ] Evidence pack building
- [ ] Claim tagging
- [ ] Source tier assignment
- [ ] Evidence score calculation

### Output Tests
- [ ] Report generation
- [ ] Journal entry creation
- [ ] Decision state validation

### Benchmark Tests
- [ ] Run full analysis on APP
- [ ] Run full analysis on MCS
- [ ] Run full analysis on HMPRO
- [ ] Verify outputs match expectations

---

## Checklist for Phase 3

### Agent Development
- [ ] Create all agent cards
- [ ] Write all persona files
- [ ] Create all skill definitions
- [ ] Write all output schemas
- [ ] Test each agent individually

### Evidence System
- [ ] Evidence pack builder
- [ ] Source integration
- [ ] Claim tagging system
- [ ] Evidence score calculator
- [ ] Data gap detection

### Execution System
- [ ] Parallel runner
- [ ] Context distributor
- [ ] Timeout handler
- [ ] Failure recovery

### Debate System
- [ ] Debate controller
- [ ] Challenge formatter
- [ ] Evidence request handler
- [ ] Resolution tracker

### Synthesis System
- [ ] CIO synthesizer
- [ ] Agreement mapper
- [ ] Disagreement preserver
- [ ] Decision state engine

### Output System
- [ ] Report generator
- [ ] Journal writer
- [ ] Follow-up tracker
- [ ] Template system

### Human Interface
- [ ] Console-based gate
- [ ] Input validator
- [ ] Display formatter
- [ ] Timeout handler

### Testing
- [ ] Unit tests for all components
- [ ] Integration tests
- [ ] Benchmark runs
- [ ] End-to-end tests

### Verification
- [ ] Run full mission on benchmark stocks
- [ ] Verify output quality
- [ ] Verify journal entries
- [ ] Verify observability
- [ ] Verify replay works

### Handoff
- [ ] Document agent behavior
- [ ] Create user guide
- [ ] Create Phase 4 handoff notes
