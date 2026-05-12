# one4all Development Roadmap

> **Version:** 1.0
> **Status:** Active Development
> **Last Updated:** 2025-01-12

## Overview

one4all is an AI company simulation system for investment analysis. This roadmap guides development from initial specification through to a fully functional multi-domain system.

## Philosophy

> "Kernel first, LLMs later. Schema first, prompts later. Evidence first, claims later."

## Phases at a Glance

| Phase | Duration | Focus | Status |
|-------|----------|-------|--------|
| **0** | Week 1-2 | Specification Freeze | ✅ Complete |
| **1** | Week 3-4 | Kernel Core (no LLM) | 🔄 In Progress |
| **2** | Week 5-6 | Adapter Layer + CLI | ⏳ Planned |
| **3** | Week 7-10 | Investment War Room MVP | ⏳ Planned |
| **4** | Week 11-12 | MCP Interface | ⏳ Planned |
| **5** | Week 13-14 | Enhanced + Second Domain | ⏳ Planned |

## Phase Details

### Phase 0: Specification Freeze
**Week 1-2 | No Code**

Deliverables:
- PROJECT_CHARTER.md
- ARCHITECTURE.md
- MISSION_LIFECYCLE.md
- AGENT_MODEL.md
- DEBATE_PROTOCOL.md
- COMPANY_CONSTITUTION.md
- JOURNAL_SCHEMA.md
- EVIDENCE_STANDARD.md
- DOMAIN_TEMPLATE.md

**Exit Criteria:** All spec documents complete, reviewed, and consistent.

### Phase 1: Kernel Core
**Week 3-4 | TypeScript**

Deliverables:
- Mission State Machine
- Mock Adapters
- Registry Loaders
- Constitution Enforcer
- Context Manager
- Journal Writer
- Observability Layer

**Exit Criteria:** Full mission runs with mock data, zero real LLM calls.

### Phase 2: Adapter Layer + CLI
**Week 5-6 | TypeScript + Python**

Deliverables:
- Real Adapters (Claude, Gemini, ZAI, Codex)
- Python Quant Module
- Fallback Chain
- Health Monitor
- CLI Interface

**Exit Criteria:** Single adapter works with real LLM, CLI functional.

### Phase 3: Investment War Room MVP
**Week 7-10 | Full System**

Deliverables:
- 12 Agents with personas (2 researchers, 8 analysts, 2 synthesizers)
- Evidence Controller & Pack Builder
- Parallel Execution
- Debate System
- Synthesis Engine
- Report Generator
- Human Checkpoints

**Justification for 4-week duration:** This phase involves the bulk of domain-specific implementation, including detailed persona development for 12 agents, complex multi-round debate logic, and validation against a suite of 6 benchmark stocks.

**Exit Criteria:** Full investment analysis works on benchmark stocks.

### Phase 4: MCP Interface
**Week 11-12 | Integration**

Deliverables:
- MCP Server
- 8+ MCP Tools
- Claude Code Integration
- Documentation

**Exit Criteria:** Claude Code can use one4all tools seamlessly.

### Phase 5: Enhanced + Second Domain
**Week 13-14 | Expansion**

Deliverables:
- Enhanced Debate Protocol
- Disagreement Tracker
- Second Domain (Research Studio or Content Studio)
- Multi-Domain Validation

**Exit Criteria:** System supports multiple domains with zero kernel changes.

## Dependencies

```
Phase 0 (Foundation)
    ↓
Phase 1 (Kernel)
    ↓
Phase 2 (Adapters)
    ↓
Phase 3 (MVP) ← Core Product
    ↓
Phase 4 (MCP) ← Enhanced Interface
    ↓
Phase 5 (Multi-Domain) ← Architecture Validation
```

## Success Metrics

### Phase 0-1 (Foundation)
- [ ] All documentation complete
- [ ] State machine works with mocks
- [ ] 100% test coverage on kernel logic

### Phase 2-3 (Core Product)
- [ ] Real LLM integration working
- [ ] Benchmark stocks analyzed successfully
- [ ] Output matches investment framework

### Phase 4-5 (Enhancement)
- [ ] Claude Code integration complete
- [ ] Second domain working
- [ ] Architecture validated

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| Spec ambiguity | High | Phase 0 thorough review |
| LLM API failures | Medium | Fallback chain |
| Cost overruns | Medium | Mock-first testing |
| Agent hallucination | High | Evidence validation |
| Scope creep | Medium | Clear phase boundaries |

## Timeline Visual

```
Week  1-2  : [████████] Phase 0: Specification
Week  3-4  : [████████] Phase 1: Kernel
Week  5-6  : [████████] Phase 2: Adapters
Week  7-8  : [████████] Phase 3a: Agents
Week  9-10 : [████████] Phase 3b: Integration
Week 11-12 : [████████] Phase 4: MCP
Week 13-14 : [████████] Phase 5: Enhancement
```

## Getting Started

1. Read all phase plans in `/plans/`
2. Review the master specification in `one4all.md`
3. Start with Phase 0 checklist
4. Track progress with TaskList

## Current Focus

**Phase 0: Specification Freeze**

We are currently creating all specification documents before writing any code. This ensures the entire system is designed before implementation begins.

Next milestone: Complete all 9 specification documents.

---

*For detailed phase breakdowns, see individual phase files in `/plans/`*
