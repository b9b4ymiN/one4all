# Phase 1: Kernel Core - TypeScript Foundation

> **Status:** Pending
> **Duration:** Week 3-4
> **Goal:** Build Company Kernel that works without any real LLM calls

## Philosophy

"Build the kernel to work completely with mock adapters before calling a single real LLM."

This ensures:
- State machine logic is correct
- Error handling is comprehensive
- All components integrate properly
- Tests are fast and deterministic
- No API costs during development

## Tech Stack

- **Language:** TypeScript
- **Runtime:** Node.js
- **Key Libraries:**
  - `zod` - Runtime schema validation
  - `neverthrow` - Functional error handling
  - `better-sqlite3` - SQLite driver
  - `drizzle-orm` - Type-safe ORM
  - `winston` - Structured logging
  - `vitest` - Testing framework

## Deliverables

### 1. Project Structure Setup
```
packages/
├── kernel/
│   ├── src/
│   │   ├── state-machine/
│   │   ├── mission-planner/
│   │   ├── team-builder/
│   │   ├── context-manager/
│   │   ├── debate-controller/
│   │   ├── evidence-controller/
│   │   ├── synthesis-engine/
│   │   ├── constitution-enforcer/
│   │   ├── human-gate/
│   │   └── journal-writer/
│   └── tests/
├── adapters/
│   ├── src/
│   │   ├── mock.adapter.ts
│   │   ├── claude.adapter.ts
│   │   ├── gemini.adapter.ts
│   │   └── ...
│   └── tests/
├── observability/
│   ├── src/
│   │   ├── structured-logger.ts
│   │   ├── mission-tracer.ts
│   │   ├── evidence-auditor.ts
│   │   ├── output-validator.ts
│   │   └── ...
│   └── tests/
└── shared/
    ├── src/
    │   ├── types/
    │   ├── schemas/
    │   └── constants/
    └── tests/
```

### 2. Mission State Machine
**File:** `packages/kernel/src/state-machine/`

States:
- DRAFT
- PLANNING
- RESEARCHING
- ANALYZING
- CROSS_QA
- DEBATING
- SYNTHESIZING
- DECIDED
- JOURNALED
- FAILED
- HUMAN_REVIEW (special state at multiple points)

Transitions with:
- Preconditions
- Timeouts
- Error handling
- State entry/exit hooks

### 3. Mock Adapters
**File:** `packages/adapters/src/mock.adapter.ts`

Interface:
```typescript
interface Adapter {
  run(prompt: string, config: AdapterConfig): Promise<AgentResult>;
  healthCheck(): Promise<HealthStatus>;
  estimateTokens(prompt: string): number;
  estimateCost(inputTokens: number, outputTokens: number): number;
}
```

Mock implementations for:
- ClaudeAdapter (mock)
- GeminiAdapter (mock)
- ZAIAdapter (mock)
- CodexAdapter (mock)
- PythonQuantAdapter (mock)
- HumanAdapter (mock - auto-responds)

### 4. Registry Loaders
**Files:** `packages/kernel/src/registry/`

- Agent Registry loader (YAML → TypeScript objects)
- Skill Registry loader
- Model Registry loader
- Source Registry loader
- Domain Registry loader

### 5. Company Constitution Enforcer
**File:** `packages/kernel/src/constitution-enforcer/`

Rules engine that:
- Loads constitution rules from YAML
- Applies rules at enforcement levels
- Violation detection
- Appropriate actions (block, warn, reject)

### 6. Context Manager
**File:** `packages/kernel/src/context-manager/`

Features:
- Context budget tracking per model
- Smart compression logic
- Context distribution per agent type
- Budget exceeded handling

### 7. Decision Journal Writer
**File:** `packages/kernel/src/journal-writer/`

Features:
- SQLite integration (Drizzle ORM)
- Schema validation
- Auto-write on mission completion
- Query interface

### 8. Observability Layer
**Files:** `packages/observability/src/`

- Structured Logger (Winston-based)
- Mission Tracer
- Evidence Auditor
- Output Validator (Zod-based)
- Replay storage structure
- Health Monitor

## Tests Required

### Unit Tests (100% coverage target)
- [ ] All state machine transitions
- [ ] All constitution rules
- [ ] Context manager calculations
- [ ] Debate controller round resolution
- [ ] Evidence score calculation
- [ ] Journal writer schema validation

### Integration Tests
- [ ] Full mission lifecycle with mock data
- [ ] Agent registry loading
- [ ] Constitution enforcement flow
- [ ] Journal writing and reading
- [ ] Observability data capture

## Success Criteria

- [ ] Full mission lifecycle runs end-to-end with mock data
- [ ] All state machine error paths handled
- [ ] Journal schema validates and writes to SQLite
- [ ] Constitution violations detected and logged
- [ ] 100% unit test coverage on kernel logic
- [ ] Zero real LLM calls in tests
- [ ] All tests pass in < 5 seconds

## Exit Criteria

Phase 1 is complete when:
1. A test mission runs from DRAFT to JOURNALED with only mock adapters
2. Every component has unit tests
3. SQLite database is created and populated correctly
4. All observability data is captured
5. No code calls real LLM APIs

---

## Checklist for Phase 1

### Setup
- [ ] Initialize TypeScript packages
- [ ] Configure tsconfig.json
- [ ] Set up Vitest
- [ ] Install dependencies (zod, neverthrow, drizzle-orm, better-sqlite3, winston)
- [ ] Set up SQLite database schema

### Core Components
- [ ] Mission State Machine implementation
- [ ] Mock Adapters for all backends
- [ ] Agent Registry loader
- [ ] Skill Registry loader
- [ ] Company Constitution enforcer
- [ ] Context Manager
- [ ] Decision Journal writer

### Observability
- [ ] Structured Logger
- [ ] Mission Tracer
- [ ] Evidence Auditor
- [ ] Output Validator
- [ ] Health Monitor

### Testing
- [ ] Unit tests for state machine
- [ ] Unit tests for constitution enforcer
- [ ] Unit tests for context manager
- [ ] Unit tests for journal writer
- [ ] Integration test: full mission lifecycle

### Verification
- [ ] Run test mission with mock data
- [ ] Verify SQLite database contents
- [ ] Verify observability logs
- [ ] Verify journal entry created
- [ ] Verify no real LLM calls made

### Handoff
- [ ] Document adapter interface requirements
- [ ] Create Phase 2 handoff notes
- [ ] Prepare real adapter integration guide
