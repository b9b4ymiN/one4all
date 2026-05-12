# Architecture Specification

**Version:** 1.0
**Date:** 2026-05-12
**Status:** Approved

---

## 1. System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        OWNER                                     │
└─────────────────────┬───────────────────────────────────────────┘
                      │ Brief / Commands / Results
┌─────────────────────▼───────────────────────────────────────────┐
│                   INTERFACE LAYER                                │
│  Claude Code CLI │ Terminal CLI │ Future Web │ Future Mobile    │
└─────────────────────┬───────────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────────┐
│                   COMPANY KERNEL                                 │
│                                                                  │
│  Mission Planner → Team Builder → Context Manager               │
│  Task Router → Debate Controller → Evidence Controller          │
│  Synthesis Engine → Constitution Enforcer → Human Gate          │
│  Decision Journal Writer                                         │
└──────┬──────────────┬──────────────┬───────────────────────────┘
       │              │              │
┌──────▼──────┐ ┌────▼──────┐ ┌────▼──────────────────────────┐
│   REGISTRY  │ │OBSERVABILITY│ │     RUNTIME ADAPTER LAYER    │
│   LAYER     │ │& AUDIT      │ │                              │
│             │ │SYSTEM       │ │ Claude │ Gemini │ Codex │ ZAI│
│ Agent Reg.  │ │             │ │ Python │ Local  │ Human │    │
│ Skill Reg.  │ │ Trace Log   │ │                              │
│ Source Reg. │ │ Mission Log │ └──────────────────────────────┘
│ Model Reg.  │ │ Audit Trail │
│ Tool Reg.   │ │ Validator   │
│ Domain Reg. │ │ Replay Sys. │
└─────────────┘ └─────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────────┐
│                   PROTOCOL LAYER                                 │
│        CLI │ MCP │ A2A │ HTTP API │ File/Queue/Event            │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Layer Responsibilities

### 2.1 Interface Layer

**Purpose:** Receive input from owner and display output

**Components:**
- Claude Code CLI (via MCP)
- Terminal CLI (`oneman` command)
- Future: Web interface
- Future: Mobile interface

**Changeability:** Yes — new interfaces can be added without changing kernel

**Key Requirements:**
- Must preserve mission context across sessions
- Must support human gate interruptions
- Must display decision states clearly
- Must allow journal updates

---

### 2.2 Company Kernel

**Purpose:** Core orchestration logic — the "brain" of the company

**Stability:** Stable core — does not change based on model or interface

**Components:**

| Component | Responsibility |
|-----------|---------------|
| Mission Planner | Parse owner brief, create mission object, define objectives |
| Team Builder | Select agents based on mission requirements, create execution plan |
| Context Manager | Manage token budgets, compress context, distribute to agents |
| Task Router | Orchestrate parallel/sequential agent execution |
| Debate Controller | Manage structured disagreement rounds |
| Evidence Controller | Validate sources, calculate evidence scores |
| Synthesis Engine | Combine agent outputs, resolve disagreements |
| Constitution Enforcer | Apply domain rules, reject invalid outputs |
| Human Gate | Pause for owner input at checkpoints |
| Journal Writer | Record decisions for future learning |

**Key Invariants:**
- No agent output accepted without schema validation
- No mission proceeds without meeting evidence thresholds
- No decision finalized without human confirmation
- Every action is logged for audit

---

### 2.3 Registry Layer

**Purpose:** Configuration database for all system components

**Storage Format:** YAML files (human-readable, LLM-readable)

**Registries:**

| Registry | Contents | Location |
|----------|----------|----------|
| Agent Registry | Agent definitions, personas, skills, output contracts | `registry/agents/` |
| Skill Registry | Skill definitions, input/output schemas | `registry/skills/` |
| Source Registry | Data source definitions, tier classifications | `registry/sources/` |
| Model Registry | Model capabilities, context limits, routing policy | `registry/models.yaml` |
| Tool Registry | Available tools and their interfaces | `registry/tools.yaml` |
| Domain Registry | Domain configurations, constitutions | `domains/*/domain.yaml` |

**Changeability:** Yes — configurations can be added/modified via YAML

---

### 2.4 Observability & Audit System

**Purpose:** Record everything for audit, replay, and learning

**Stability:** Critical system — must always function

**Components:**

| Component | Responsibility |
|-----------|---------------|
| Structured Logger | Log every LLM call with full context |
| Mission Tracer | Record state transitions and timelines |
| Evidence Auditor | Track every claim to its source |
| Output Validator | Validate agent outputs against schemas |
| Replay Engine | Re-run missions with saved or modified inputs |
| Health Monitor | Check backend availability |
| Scorecard | Track agent quality metrics over time |

**Storage:**
- SQLite database for structured queries
- File storage for full inputs/outputs

---

### 2.5 Runtime Adapter Layer

**Purpose:** Translate "run agent" commands to actual model calls

**Changeability:** Yes — new backends can be added

**Adapters:**

| Adapter | Backend | Purpose |
|---------|---------|---------|
| ClaudeAdapter | Anthropic API | Complex reasoning, synthesis |
| GeminiAdapter | Gemini CLI | Long context, research |
| ZAIAdapter | OpenAI-compatible API | Cost-effective parallel tasks |
| CodexAdapter | Codex CLI | Code generation, validation |
| PythonQuantAdapter | Python subprocess | Deterministic calculations |
| HumanAdapter | Console input | Human-in-the-loop checkpoints |
| MockAdapter | Test responses | Testing without API calls |

**Interface Contract:**
```typescript
interface Adapter {
  run(prompt: string, config: AdapterConfig): Promise<AgentResult>
  healthCheck(): Promise<HealthStatus>
  estimateTokens(prompt: string): number
  estimateCost(inputTokens: number, outputTokens: number): number
}
```

---

### 2.6 Protocol Layer

**Purpose:** Define how the system exposes itself to external entities

**Protocols:**

| Protocol | Phase | Purpose |
|----------|-------|---------|
| CLI | Phase 2 | Terminal interaction |
| MCP | Phase 4 | Claude Code integration |
| A2A | Phase 6 | Agent-to-agent communication (future) |
| HTTP API | Future | External integrations |

**Changeability:** Yes — new protocols can be added

---

## 3. Component Interactions

### 3.1 Mission Flow

```
Owner Brief
    │
    ▼
┌─────────────────┐
│ Mission Planner │ ───► Create Mission Object
└────────┬────────┘
         ▼
┌─────────────────┐
│  Team Builder   │ ───► Select Agents, Create Execution Plan
└────────┬────────┘
         ▼
┌─────────────────┐
│ Context Manager │ ───► Allocate Token Budgets
└────────┬────────┘
         ▼
┌─────────────────┐
│   Task Router   │ ───► Orchestrate Agent Execution
└────────┬────────┘
         ▼
    [State Machine: DRAFT → PLANNING → RESEARCHING → ANALYZING → ...]
         ▼
┌─────────────────┐
│ Debate Control  │ ───► Manage Disagreement Rounds
└────────┬────────┘
         ▼
┌─────────────────┐
│ Synthesis Engine│ ───► Combine Outputs
└────────┬────────┘
         ▼
┌─────────────────┐
│  Human Gate     │ ───► Owner Confirmation
└────────┬────────┘
         ▼
┌─────────────────┐
│ Journal Writer  │ ───► Record Decision
└─────────────────┘
```

### 3.2 Agent Communication

```
┌──────────────┐  question  ┌──────────────┐
│   Agent A    │───────────►│   Agent B    │
└──────────────┘            └──────┬───────┘
                                   │
                                   │ answer
                                   ▼
                            ┌──────────────┐
                            │   Agent A    │
                            └──────────────┘

┌──────────────┐ challenge  ┌──────────────┐
│   Agent A    │───────────►│   Agent B    │
└──────────────┘            └──────┬───────┘
                                   │
                                   │ response
                                   ▼
                            ┌──────────────┐
                            │   Agent A    │
                            └──────────────┘
```

---

## 4. Data Flow

### 4.1 Evidence Flow

```
┌────────────────┐
│ Researcher     │
│ Agent          │
└───────┬────────┘
        │
        ▼
┌────────────────┐
│ Evidence Pack  │ ◄─── All claims labeled with:
│                │      FACT, DERIVED, ASSUMPTION,
└───────┬────────┘      ESTIMATE, UNVERIFIED, etc.
        │
        ▼
┌────────────────┐
│ Evidence        │
│ Controller      │ ───► Calculate Score (0-100)
└───────┬────────┘
        │
        ▼
        ┌──────────────────┐
        │ Analyst Agents   │ ◄─── Each reads evidence pack
        │ (Parallel)       │      through Context Manager
        └────────┬─────────┘
                 │
                 ▼
        ┌──────────────────┐
        │ Synthesis Engine │
        └──────────────────┘
```

### 4.2 Decision Flow

```
┌──────────────────┐
│ Agent Outputs    │
│ (Individual      │
│  Analyses)       │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Debate Records   │ ───► Resolved + Unresolved
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Synthesis Engine │ ───► Apply Constitution Rules
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Decision State   │ ───► WAIT_FOR_PRICE |
│                  │      CORE_CANDIDATE |
└────────┬─────────┘      REJECT, etc.
         │
         ▼
┌──────────────────┐
│ Journal Entry    │
└──────────────────┘
```

---

## 5. Technology Stack Rationale

### 5.1 TypeScript / Node.js (Kernel + Adapters + CLI)

**Reasons:**
- Type system enforces output schemas at compile time
- Zod provides runtime validation (critical for LLM outputs)
- async/await + Promise.all enable natural parallel execution
- MCP SDK is TypeScript-first
- Rich tooling ecosystem

**Key Libraries:**
- `zod` — runtime schema validation
- `neverthrow` — functional error handling
- `commander` — CLI framework
- `@modelcontextprotocol/sdk` — MCP server
- `drizzle-orm` — type-safe database queries
- `better-sqlite3` — SQLite driver
- `winston` — structured logging
- `vitest` — unit testing

### 5.2 Python (Quant Module)

**Reasons:**
- DCF, reverse DCF, MOS calculations are deterministic
- pandas, numpy for financial data manipulation
- Pydantic for schema validation
- Reproducible, testable calculations

**Key Libraries:**
- `pydantic` — schema validation
- `pandas` — data manipulation
- `numpy` — mathematical operations
- `pytest` — testing
- `fastapi` — optional HTTP wrapper

### 5.3 SQLite (Persistence)

**Reasons:**
- Local-first (no cloud infrastructure needed)
- Zero setup
- SQL queries for analysis
- Sufficient for single-user systems
- Easy migration to PostgreSQL if needed

### 5.4 YAML + Markdown

**YAML:** Machine-readable configuration
- Agent cards
- Skill cards
- Source registry
- Mission templates
- Domain constitutions

**Markdown:** Human-readable + LLM-readable
- Persona files
- Skill instructions
- Evidence pack content
- Final reports

---

## 6. Project Structure

```
one4all/
├── packages/
│   ├── kernel/              # TypeScript: Company Kernel
│   │   ├── src/
│   │   │   ├── state-machine.ts
│   │   │   ├── mission-planner.ts
│   │   │   ├── team-builder.ts
│   │   │   ├── context-manager.ts
│   │   │   ├── debate-controller.ts
│   │   │   ├── evidence-controller.ts
│   │   │   ├── synthesis-engine.ts
│   │   │   ├── constitution-enforcer.ts
│   │   │   ├── human-gate.ts
│   │   │   └── journal-writer.ts
│   │   └── tests/
│   │
│   ├── adapters/            # TypeScript: Runtime Adapters
│   │   ├── src/
│   │   │   ├── claude.adapter.ts
│   │   │   ├── gemini.adapter.ts
│   │   │   ├── zai.adapter.ts
│   │   │   ├── codex.adapter.ts
│   │   │   ├── python.adapter.ts
│   │   │   ├── human.adapter.ts
│   │   │   └── mock.adapter.ts
│   │   └── tests/
│   │
│   ├── observability/       # TypeScript: Logging + Audit
│   │   ├── src/
│   │   │   ├── structured-logger.ts
│   │   │   ├── mission-tracer.ts
│   │   │   ├── evidence-auditor.ts
│   │   │   ├── output-validator.ts
│   │   │   ├── replay-engine.ts
│   │   │   ├── health-monitor.ts
│   │   │   └── scorecard.ts
│   │   └── tests/
│   │
│   ├── cli/                 # TypeScript: CLI interface
│   │   ├── src/
│   │   │   └── commands/
│   │   └── tests/
│   │
│   └── mcp-server/          # TypeScript: MCP interface (Phase 4)
│       └── src/
│
├── apps/
│   └── quant/               # Python: Financial calculations
│       ├── src/
│       │   ├── dcf.py
│       │   ├── reverse_dcf.py
│       │   ├── mos_table.py
│       │   ├── sensitivity.py
│       │   └── normalizer.py
│       └── tests/
│
├── domains/                 # Domain configurations
│   ├── investment-war-room/
│   │   ├── domain.yaml
│   │   ├── agents/
│   │   ├── skills/
│   │   ├── missions/
│   │   └── output-templates/
│   └── _template/
│
├── registry/                # Global registries
│   ├── models.yaml
│   ├── tools.yaml
│   └── sources/
│
├── observability/           # Logs, traces, journal DB
│   └── one4all.db
│
└── missions/                # Mission data + replay storage
    └── {mission_id}/
```

---

## 7. Cross-Cutting Concerns

### 7.1 Error Handling

- Use `neverthrow` for functional error handling
- No silent failures — all errors logged
- Graceful degradation when backends fail
- Clear error messages to owner

### 7.2 Performance

- Parallel agent execution where possible
- Context compression to reduce token usage
- Cached model availability checks
- Efficient SQLite queries with indexes

### 7.3 Security

- API keys stored in environment variables
- No credentials in code or YAML files
- Input validation at all system boundaries
- Schema validation for all agent outputs

### 7.4 Testing

- Mock adapter for unit testing
- Integration tests with real backends
- Property-based testing for critical logic
- Reproducible test fixtures
