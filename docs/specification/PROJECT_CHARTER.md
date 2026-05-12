# Project Charter: one4all

**Version:** 1.0
**Date:** 2026-05-12
**Status:** Approved

---

## 1. Executive Summary

**one4all** is a personal AI-powered company simulation system designed to enable one person to have a team that thinks critically, analyzes deeply, and makes actionable decisions — without being tied to any single AI model.

### Crystalized Statement

> one4all is a personal simulated company
> that uses multiple AIs as employees, multiple skills as capabilities,
> multiple sources as evidence, and multiple protocols as work channels,
> with a single Company Kernel as the core of thinking, decision-making, and learning.

### First Use Case: Investment War Room
Analyze stocks, assess value, evaluate risk, and transform information into actionable investment decisions.

---

## 2. Vision and Goals

### Vision
To create a domain-agnostic "Company Kernel" that can orchestrate multiple AI agents to collaborate, debate, and synthesize decisions while maintaining evidence standards and full observability.

### Goals

1. **Evidence-First Decision Making**: Every claim must be sourced, distinguished from assumptions, and traceable to its origin.
2. **Model Independence**: The kernel must work regardless of which AI models are available — models can be swapped without changing agent behavior.
3. **Multi-Agent Collaboration**: Agents must question, challenge, and synthesize diverse perspectives before reaching conclusions.
4. **Full Observability**: Every agent call, decision, and assumption must be logged for audit and replay.
5. **Domain Extensibility**: New domains (beyond investment analysis) can be added by configuration, not code changes.

---

## 3. Target Users and Use Cases

### Primary User
Individual decision-makers who need:
- Deep analysis of complex topics
- Multiple perspectives before deciding
- Evidence-based reasoning
- Decision tracking and learning

### Use Case 1: Investment War Room (Initial)
- Analyze stocks with fundamental valuation
- Assess downside risks
- Determine position sizing
- Generate investment decision states (not buy/sell recommendations)

### Use Case 2: Research Studio (Future)
- Manage research projects
- Coordinate multiple researchers
- Synthesize findings into actionable insights

### Use Case 3: Business Decision Support (Future)
- Analyze business opportunities
- Evaluate strategic options
- Track decision outcomes

---

## 4. Success Criteria

### Phase 0: Specification Freeze
- [x] All 9 specification documents created
- [ ] Each document reviewed for completeness
- [ ] No ambiguity in component responsibilities
- [ ] Clear validation criteria for all outputs
- [ ] Technology stack finalized

### Phase 1: Kernel Core
- [ ] TypeScript foundation without LLM dependencies
- [ ] Mission state machine implemented
- [ ] Configuration system for agents, skills, sources
- [ ] SQLite persistence layer

### Phase 2: Adapter Layer + CLI
- [ ] Runtime adapters for Claude, Gemini, ZAI
- [ ] CLI interface with all basic commands
- [ ] Mock adapter for testing

### Phase 3: Investment War Room MVP
- [ ] Full investment domain configuration
- [ ] All agents operational
- [ ] End-to-end mission execution
- [ ] Decision journal functional

### Phase 4: MCP Interface
- [ ] MCP server with all tools exposed
- [ ] Integration with Claude Code

### Phase 5: Enhanced Debate + Second Domain
- [ ] Structured debate rounds
- [ ] Evidence request loops
- [ ] Second domain operational

---

## 5. Risk Register

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| LLM API failures | High | Medium | Fallback models, graceful degradation |
| Cost overruns | Medium | High | Context management, token budgeting |
| Agent hallucination | High | Medium | Output validation, evidence requirements |
| Model lock-in | High | Low | Model-agnostic adapter design |
| Decision journal not used | Medium | Medium | Built-in reminders, simple UX |
| Multi-domain complexity | High | Medium | Template system, clear separation |

---

## 6. Timeline Overview

| Phase | Duration | Status | Key Deliverables |
|-------|----------|--------|------------------|
| Phase 0: Specification Freeze | Week 1-2 | In Progress | All 9 spec documents |
| Phase 1: Kernel Core | Week 3-4 | Pending | TypeScript foundation, state machine |
| Phase 2: Adapter Layer + CLI | Week 5-6 | Pending | Runtime adapters, CLI |
| Phase 3: Investment War Room MVP | Week 7-10 | Pending | Full investment domain |
| Phase 4: MCP Interface | Week 11 | Pending | MCP server |
| Phase 5: Enhanced Debate + Second Domain | Week 12+ | Pending | Debate protocols, new domain |

---

## 7. Non-Goals

These are explicitly **not** goals of one4all:

- **Not a chatbot**: The system is mission-driven, not conversation-driven
- **Not a web app**: Initial interface is CLI; UI is future work
- **Not a script runner**: The kernel orchestrates intelligent collaboration, not sequential calls
- **Not model-specific**: The system must work with any capable LLM backend
- **Not auto-trading**: The system outputs decision states, never executes trades

---

## 8. Key Principles

### Company-First, Tool-Second
Start with "how should this company work?" not "what tool should we use?"

### Agent ≠ Model
```
Agent = Role + Persona + Worldview + Skills + Tools + Interaction Rules + Output Contract
Model = Engine the agent uses for thinking (swappable)
```

### Kernel is Stable Core
```
Changeable:  Protocol | Model | Interface | Tool
Unchangeable: Company Kernel | Operating Process | Evidence Standard
```

### Evidence-First
- Every claim must have a source
- Facts must be distinguished from assumptions
- Data gaps must be surfaced, not hidden

### Observable by Default
- Every agent call is logged
- Every decision can be audited
- Every error is visible, not silent

---

## 9. Definitions

| Term | Definition |
|------|------------|
| **Company Kernel** | The core orchestration logic that manages missions, agents, and state transitions |
| **Agent** | A role-based entity with persona, skills, and output contracts |
| **Mission** | A specific analysis or decision task from the owner |
| **Evidence Pack** | The collection of sourced information that supports analysis |
| **Decision State** | The output classification (e.g., WAIT_FOR_PRICE, CORE_CANDIDATE) |
| **Domain** | A specialized area of operation (e.g., investment-war-room) |
| **Constitution** | The rules that govern all operations within a domain |
