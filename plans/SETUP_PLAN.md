# one4all Setup Plan

> **Version:** 1.0
> **Status:** Phase 0 - Planning Document
> **Created:** 2026-05-12
> **Purpose:** Comprehensive guide for setting up the project structure and dependencies (Phase 1)

---

## Executive Summary

This document outlines the complete setup strategy for the one4all project. **IMPORTANT:** We are currently in Phase 0 (Specification Freeze). This setup plan is for reference and will be executed in Phase 1.

### Setup Philosophy

> "Kernel first, LLMs later. Mock-first testing, real integration after validation."

The setup follows these principles:
1. **Structure before dependencies** - Create folders before installing packages
2. **TypeScript packages as monorepo** - Related packages managed together
3. **Python for calculations only** - Financial models in isolated quant module
4. **Configuration over code** - YAML registries, not hardcoded configs

---

## Part 1: Folder Structure

### Root Structure

```
one4all/
├── packages/              # TypeScript packages (monorepo)
│   ├── kernel/           # Company Kernel core
│   ├── adapters/         # AI backend adapters
│   ├── observability/    # Logging, tracing, audit
│   ├── cli/              # Command-line interface
│   ├── mcp-server/       # MCP interface (Phase 4)
│   └── shared/           # Shared types/schemas
├── apps/                 # External applications
│   └── quant/            # Python financial calculations
├── domains/              # Domain implementations
│   └── investment-war-room/
├── registry/             # YAML configuration files
│   ├── agents/          # Agent definitions
│   ├── skills/          # Skill definitions
│   ├── sources/         # Data source definitions
│   ├── models/          # Model configurations
│   └── tools/           # Tool definitions
├── observability/        # Runtime data (gitignored)
│   ├── logs/            # Structured logs
│   ├── traces/          # Mission traces
│   └── journal.db       # SQLite decision journal
├── missions/             # Mission data + replays (gitignored)
│   ├── active/          # In-progress missions
│   ├── completed/       # Completed missions
│   └── replays/         # Replay storage
├── docs/                 # Documentation
│   ├── specification/   # Phase 0 deliverables
│   ├── api/             # API documentation
│   └── guides/          # User guides
├── plans/                # Development phase plans (exists)
├── tests/                # Integration tests
├── scripts/              # Build/deploy scripts
├── .gitignore
├── package.json          # Root package.json (workspace)
├── pnpm-workspace.yaml   # PNPM workspace config
├── tsconfig.base.json    # Base TypeScript config
└── README.md             # (exists)
```

---

## Part 2: TypeScript Packages Setup

### 2.1 Root Configuration

**File:** `package.json` (root)
```json
{
  "name": "one4all",
  "version": "0.1.0",
  "private": true,
  "description": "AI Company Simulation System",
  "scripts": {
    "build": "turbo run build",
    "test": "vitest",
    "lint": "eslint packages --ext .ts",
    "format": "prettier --write \"**/*.ts\"",
    "clean": "rm -rf node_modules packages/*/node_modules",
    "kernel": "node packages/cli/dist/index.js"
  },
  "devDependencies": {
    "@types/node": "^20.11.0",
    "@typescript-eslint/eslint-plugin": "^6.0.0",
    "@typescript-eslint/parser": "^6.0.0",
    "eslint": "^8.50.0",
    "prettier": "^3.0.0",
    "turbo": "^1.11.0",
    "typescript": "^5.3.0",
    "vitest": "^1.0.0"
  },
  "engines": {
    "node": ">=20.0.0",
    "pnpm": ">=8.0.0"
  },
  "packageManager": "pnpm@8.12.0"
}
```

**File:** `pnpm-workspace.yaml`
```yaml
packages:
  - 'packages/*'
  - 'apps/*'
```

**File:** `tsconfig.base.json`
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src"
  }
}
```

### 2.2 Package: @one4all/kernel

**Purpose:** Company Kernel - the core orchestration logic

**Folder Structure:**
```
packages/kernel/
├── src/
│   ├── state-machine/
│   │   ├── index.ts
│   │   ├── mission-states.ts
│   │   ├── state-machine.ts
│   │   └── transitions.ts
│   ├── mission-planner/
│   │   ├── index.ts
│   │   ├── planner.ts
│   │   └── task-builder.ts
│   ├── team-builder/
│   │   ├── index.ts
│   │   ├── builder.ts
│   │   └── agent-selector.ts
│   ├── context-manager/
│   │   ├── index.ts
│   │   ├── manager.ts
│   │   ├── budget-tracker.ts
│   │   └── compression.ts
│   ├── debate-controller/
│   │   ├── index.ts
│   │   ├── controller.ts
│   │   ├── round-manager.ts
│   │   └── resolution.ts
│   ├── evidence-controller/
│   │   ├── index.ts
│   │   ├── controller.ts
│   │   ├── pack-builder.ts
│   │   └── scoring.ts
│   ├── synthesis-engine/
│   │   ├── index.ts
│   │   ├── engine.ts
│   │   ├── merger.ts
│   │   └── decision-maker.ts
│   ├── constitution-enforcer/
│   │   ├── index.ts
│   │   ├── enforcer.ts
│   │   ├── rule-loader.ts
│   │   └── violation-detector.ts
│   ├── human-gate/
│   │   ├── index.ts
│   │   ├── gate.ts
│   │   └── checkpoint.ts
│   ├── journal-writer/
│   │   ├── index.ts
│   │   ├── writer.ts
│   │   ├── schema.ts
│   │   └── queries.ts
│   ├── registry/
│   │   ├── index.ts
│   │   ├── loader.ts
│   │   └── validators.ts
│   └── index.ts
├── tests/
│   ├── unit/
│   └── integration/
├── package.json
└── tsconfig.json
```

**package.json dependencies:**
```json
{
  "name": "@one4all/kernel",
  "version": "0.1.0",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "dependencies": {
    "@one4all/shared": "workspace:*",
    "@one4all/adapters": "workspace:*",
    "@one4all/observability": "workspace:*",
    "zod": "^3.22.0",
    "neverthrow": "^6.0.0",
    "drizzle-orm": "^0.29.0",
    "better-sqlite3": "^9.2.0",
    "js-yaml": "^4.1.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.0",
    "@types/js-yaml": "^4.0.0",
    "vitest": "^1.0.0"
  }
}
```

### 2.3 Package: @one4all/adapters

**Purpose:** AI backend adapters (mock and real)

**Folder Structure:**
```
packages/adapters/
├── src/
│   ├── types/
│   │   ├── adapter.types.ts
│   │   └── agent-result.types.ts
│   ├── mock/
│   │   ├── mock-adapter.ts
│   │   └── mock-responses.ts
│   ├── claude/
│   │   ├── claude-adapter.ts
│   │   └── claude-client.ts
│   ├── gemini/
│   │   ├── gemini-adapter.ts
│   │   └── gemini-client.ts
│   ├── codex/
│   │   ├── codex-adapter.ts
│   │   └── codex-client.ts
│   ├── zai/
│   │   ├── zai-adapter.ts
│   │   └── zai-client.ts
│   ├── python/
│   │   ├── python-adapter.ts
│   │   └── quant-client.ts
│   ├── human/
│   │   ├── human-adapter.ts
│   │   └── terminal-prompt.ts
│   ├── fallback/
│   │   ├── fallback-chain.ts
│   │   └── health-monitor.ts
│   └── index.ts
├── tests/
├── package.json
└── tsconfig.json
```

**package.json dependencies:**
```json
{
  "name": "@one4all/adapters",
  "version": "0.1.0",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "dependencies": {
    "@one4all/shared": "workspace:*",
    "@anthropic-ai/sdk": "^0.18.0",
    "@google/generative-ai": "^0.17.0",
    "openai": "^4.0.0",
    "neverthrow": "^6.0.0"
  },
  "devDependencies": {
    "vitest": "^1.0.0"
  }
}
```

### 2.4 Package: @one4all/observability

**Purpose:** Logging, tracing, audit, validation

**Folder Structure:**
```
packages/observability/
├── src/
│   ├── logger/
│   │   ├── index.ts
│   │   ├── structured-logger.ts
│   │   └── formats.ts
│   ├── tracer/
│   │   ├── index.ts
│   │   ├── mission-tracer.ts
│   │   └── span.ts
│   ├── auditor/
│   │   ├── index.ts
│   │   ├── evidence-auditor.ts
│   │   └── audit-trail.ts
│   ├── validator/
│   │   ├── index.ts
│   │   ├── output-validator.ts
│   │   └── schema-registry.ts
│   ├── health/
│   │   ├── index.ts
│   │   ├── monitor.ts
│   │   └── metrics.ts
│   ├── replay/
│   │   ├── index.ts
│   │   ├── recorder.ts
│   │   └── replayer.ts
│   └── index.ts
├── tests/
├── package.json
└── tsconfig.json
```

**package.json dependencies:**
```json
{
  "name": "@one4all/observability",
  "version": "0.1.0",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "dependencies": {
    "@one4all/shared": "workspace:*",
    "winston": "^3.11.0",
    "winston-daily-rotate-file": "^4.7.0",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "@types/winston": "^2.4.0",
    "vitest": "^1.0.0"
  }
}
```

### 2.5 Package: @one4all/cli

**Purpose:** Command-line interface

**Folder Structure:**
```
packages/cli/
├── src/
│   ├── commands/
│   │   ├── mission/
│   │   ├── journal/
│   │   ├── team/
│   │   ├── domain/
│   │   └── system/
│   ├── ui/
│   │   ├── spinner.ts
│   │   ├── tables.ts
│   │   └── prompts.ts
│   └── index.ts
├── tests/
├── package.json
└── tsconfig.json
```

**package.json dependencies:**
```json
{
  "name": "@one4all/cli",
  "version": "0.1.0",
  "bin": {
    "oneman": "./dist/index.js"
  },
  "dependencies": {
    "@one4all/kernel": "workspace:*",
    "@one4all/shared": "workspace:*",
    "commander": "^11.1.0",
    "chalk": "^5.3.0",
    "ora": "^8.0.0",
    "cli-table3": "^0.6.3",
    "enquirer": "^2.4.0"
  }
}
```

### 2.6 Package: @one4all/shared

**Purpose:** Shared types, schemas, constants

**Folder Structure:**
```
packages/shared/
├── src/
│   ├── types/
│   │   ├── mission.types.ts
│   │   ├── agent.types.ts
│   │   ├── domain.types.ts
│   │   └── registry.types.ts
│   ├── schemas/
│   │   ├── mission.schema.ts
│   │   ├── agent.schema.ts
│   │   ├── evidence.schema.ts
│   │   └── journal.schema.ts
│   ├── constants/
│   │   ├── states.ts
│   │   ├── evidence-tiers.ts
│   │   └── enforcement-levels.ts
│   └── index.ts
├── tests/
├── package.json
└── tsconfig.json
```

**package.json dependencies:**
```json
{
  "name": "@one4all/shared",
  "version": "0.1.0",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "dependencies": {
    "zod": "^3.22.0"
  }
}
```

### 2.7 Package: @one4all/mcp-server (Phase 4)

**Purpose:** Model Context Protocol server

**Folder Structure:**
```
packages/mcp-server/
├── src/
│   ├── tools/
│   │   ├── mission-tools.ts
│   │   ├── journal-tools.ts
│   │   ├── evidence-tools.ts
│   │   └── analysis-tools.ts
│   ├── server.ts
│   └── index.ts
├── package.json
└── tsconfig.json
```

**package.json dependencies:**
```json
{
  "name": "@one4all/mcp-server",
  "version": "0.1.0",
  "dependencies": {
    "@one4all/kernel": "workspace:*",
    "@one4all/shared": "workspace:*",
    "@modelcontextprotocol/sdk": "^0.5.0"
  }
}
```

---

## Part 3: Python Application Setup

### 3.1 App: Quant (Financial Calculations)

**Purpose:** DCF, reverse DCF, portfolio calculations

**Folder Structure:**
```
apps/quant/
├── src/
│   ├── valuation/
│   │   ├── dcf.py
│   │   ├── reverse_dcf.py
│   │   └── multiples.py
│   ├── risk/
│   │   ├── downside.py
│   │   └── scenario.py
│   ├── portfolio/
│   │   ├── sizing.py
│   │   └── allocation.py
│   ├── models/
│   │   └── schemas.py
│   └── __init__.py
├── tests/
├── requirements.txt
├── pyproject.toml
└── README.md
```

**requirements.txt:**
```
# Core
numpy>=1.24.0
pandas>=2.0.0

# Validation
pydantic>=2.0.0

# Testing
pytest>=7.4.0
pytest-cov>=4.1.0

# API (for calling Python from Node)
python-dotenv>=1.0.0
```

**pyproject.toml:**
```toml
[project]
name = "one4all-quant"
version = "0.1.0"
description = "Financial calculation engine for one4all"
requires-python = ">=3.11"
dependencies = [
    "numpy>=1.24.0",
    "pandas>=2.0.0",
    "pydantic>=2.0.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=7.4.0",
    "pytest-cov>=4.1.0",
]

[build-system]
requires = ["setuptools>=68.0"]
build-backend = "setuptools.build_meta"
```

---

## Part 4: Domain Structure

### 4.1 Domain: investment-war-room

**Folder Structure:**
```
domains/investment-war-room/
├── domain.yaml           # Domain configuration
├── agents/              # Agent definitions
│   ├── researcher-set.yaml
│   ├── forensic-accountant.yaml
│   ├── damodaran-valuation.yaml
│   ├── klarman-downside.yaml
│   ├── portfolio-allocator.yaml
│   ├── cio-synthesizer.yaml
│   └── pro-investor.yaml
├── skills/              # Skill definitions
│   ├── sec-filing-reader.yaml
│   ├── thailand-market-knowledge.yaml
│   └── valuation-models.yaml
├── missions/            # Mission templates
│   ├── stock-analysis.yaml
│   └── portfolio-review.yaml
├── constitution/        # Domain-specific rules
│   └── investment-constitution.yaml
├── prompts/             # Agent prompts
│   ├── researcher/
│   ├── analyst/
│   └── synthesizer/
└── README.md
```

---

## Part 5: Registry Structure

### 5.1 Global Registries

**Folder Structure:**
```
registry/
├── agents/              # Global agent registry
│   └── registry.yaml
├── skills/              # Global skill registry
│   └── registry.yaml
├── sources/             # Data source registry
│   └── registry.yaml
├── models/              # Model configuration
│   └── registry.yaml
├── tools/               # Tool registry
│   └── registry.yaml
└── domains/             # Domain registry
    └── registry.yaml
```

---

## Part 6: Configuration Files

### 6.1 .gitignore

```gitignore
# Dependencies
node_modules/
.pnpm-store/

# Build outputs
dist/
*.tsbuildinfo

# Environment
.env
.env.local
.env.*.local

# Observability data (runtime only)
observability/logs/
observability/traces/
observability/journal.db
observability/journal.db-shm
observability/journal.db-wal

# Mission data (runtime only)
missions/active/
missions/completed/
missions/replays/

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Python
__pycache__/
*.py[cod]
*$py.class
.pytest_cache/
.coverage
*.egg-info/

# OMC (oh-my-claudecode)
.omc/state/sessions/
```

### 6.2 Vitest Configuration

**File:** `vitest.config.ts`
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['**/node_modules/**', '**/dist/**', '**/tests/**'],
    },
  },
});
```

### 6.3 ESLint Configuration

**File:** `.eslintrc.json`
```json
{
  "root": true,
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "ecmaVersion": 2022,
    "sourceType": "module"
  },
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended"
  ],
  "plugins": ["@typescript-eslint"],
  "rules": {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/explicit-function-return-type": "warn",
    "@typescript-eslint/no-unused-vars": "error"
  },
  "ignorePatterns": ["dist", "node_modules"]
}
```

### 6.4 Prettier Configuration

**File:** `.prettier.json`
```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "arrowParens": "always"
}
```

---

## Part 7: Phase 1 Execution Checklist

This section will be used when we enter Phase 1.

### Step 1: Initialize Root
- [ ] Create root package.json
- [ ] Create pnpm-workspace.yaml
- [ ] Create tsconfig.base.json
- [ ] Create .gitignore
- [ ] Create vitest.config.ts
- [ ] Create .eslintrc.json
- [ ] Create .prettier.json
- [ ] Run `pnpm install`

### Step 2: Create Package Skeletons
- [ ] Create packages/kernel skeleton
- [ ] Create packages/adapters skeleton
- [ ] Create packages/observability skeleton
- [ ] Create packages/cli skeleton
- [ ] Create packages/shared skeleton
- [ ] Create packages/mcp-server skeleton

### Step 3: Setup Python App
- [ ] Create apps/quant structure
- [ ] Create requirements.txt
- [ ] Create pyproject.toml
- [ ] Create virtual environment setup script

### Step 4: Setup Directories
- [ ] Create domains/investment-war-room structure
- [ ] Create registry structure
- [ ] Create observability runtime directories
- [ ] Create missions runtime directories
- [ ] Create docs/specification structure

### Step 5: Install Dependencies
- [ ] `pnpm install` (TypeScript)
- [ ] `cd apps/quant && python -m venv .venv`
- [ ] `source .venv/bin/activate && pip install -r requirements.txt`

### Step 6: Initial Build Verification
- [ ] Run `pnpm build` - should succeed (even if empty)
- [ ] Run `pnpm test` - should succeed (no tests yet)
- [ ] Run `pnpm lint` - should succeed

---

## Part 8: Database Schema

### SQLite Decision Journal Schema

**File:** `packages/kernel/src/journal-writer/schema.sql`

```sql
-- Mission entries
CREATE TABLE missions (
  id TEXT PRIMARY KEY,
  domain TEXT NOT NULL,
  mission_type TEXT NOT NULL,
  brief TEXT NOT NULL,
  decision_state TEXT NOT NULL,
  confidence INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  completed_at TEXT,
  follow_up_date TEXT
);

-- Evidence used
CREATE TABLE evidence (
  id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL,
  source TEXT NOT NULL,
  tier INTEGER NOT NULL,
  claim TEXT NOT NULL,
  relevance_score INTEGER NOT NULL,
  FOREIGN KEY (mission_id) REFERENCES missions(id)
);

-- Agent outputs
CREATE TABLE agent_outputs (
  id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  model_used TEXT NOT NULL,
  output TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (mission_id) REFERENCES missions(id)
);

-- Thesis breakers
CREATE TABLE thesis_breakers (
  id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL,
  condition TEXT NOT NULL,
  triggered INTEGER DEFAULT 0,
  FOREIGN KEY (mission_id) REFERENCES missions(id)
);

-- Disagreements tracked
CREATE TABLE disagreements (
  id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL,
  agent_1 TEXT NOT NULL,
  agent_2 TEXT NOT NULL,
  topic TEXT NOT NULL,
  resolved INTEGER DEFAULT 0,
  FOREIGN KEY (mission_id) REFERENCES missions(id)
);

-- Indexes
CREATE INDEX idx_missions_domain ON missions(domain);
CREATE INDEX idx_missions_decision_state ON missions(decision_state);
CREATE INDEX idx_evidence_mission ON evidence(mission_id);
CREATE INDEX idx_agent_outputs_mission ON agent_outputs(mission_id);
```

---

## Part 9: Node.js/TypeScript Version Requirements

### Toolchain Versions

```json
{
  "node": ">=20.11.0",
  "pnpm": ">=8.12.0",
  "typescript": ">=5.3.0",
  "python": ">=3.11"
}
```

### Verification Commands

```bash
# Check versions
node --version   # Should be v20.11.0+
pnpm --version   # Should be 8.12.0+
python --version # Should be 3.11+

# Install if needed
# Node: Use nvm or download from nodejs.org
# pnpm: npm install -g pnpm
```

---

## Part 10: Environment Variables

### Required for Phase 1 (Mock only)

```env
# No API keys needed for Phase 1 (mock adapters)
```

### Required for Phase 2+ (Real adapters)

```env
# Anthropic Claude
ANTHROPIC_API_KEY=sk-ant-...

# Google Gemini
GOOGLE_API_KEY=...

# OpenAI (Codex)
OPENAI_API_KEY=sk-...

# ZAI (if applicable)
ZAI_API_KEY=...

# Observability
LOG_LEVEL=info
LOG_FORMAT=json
TRACE_ENABLED=true

# Database
JOURNAL_PATH=./observability/journal.db
```

---

## Summary

This setup plan provides:

1. **Complete folder structure** for monorepo organization
2. **Package configurations** for all TypeScript packages
3. **Python app setup** for quant calculations
4. **Domain structure** template for investment-war-room
5. **Registry structure** for YAML-based configuration
6. **Configuration files** (.gitignore, tsconfig, vitest, eslint, prettier)
7. **Database schema** for decision journal
8. **Execution checklist** for Phase 1

**Next Steps:**
1. Complete Phase 0 specification documents
2. Review this setup plan for any changes needed
3. Execute Phase 1 following this plan
