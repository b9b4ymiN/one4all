# one4all — AI Company Simulation System

> A sophisticated multi-agent system orchestrating AI specialists through structured debate, evidence validation, and decision governance.

[![Tests](https://img.shields.io/badge/tests-605%20passing-brightgreen)](https://github.com/dasimoa/one4all)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green)](https://nodejs.org/)

## Overview

**one4all** simulates a "company" with AI agents as employees, featuring a central kernel that orchestrates missions, enforces constitution rules, manages structured debate, and maintains decision journals. Unlike simple multi-model routers, one4all provides:

- **Company Kernel** — State machine orchestrator with 13 mission states
- **Specialist Agents** — Domain experts with unique personas and skills
- **Evidence Governance** — Source tiering, scoring, and validation
- **Structured Debate** — Multi-round argumentation with constitution enforcement
- **Decision Journaling** — Persistent audit trail with thesis breakers
- **MCP Interface** — Model Context Protocol server for external integrations

## Philosophy

> "Company-first, tool-second. Agent ≠ Model. Kernel is stable, everything else changes."

- The **Kernel** contains all orchestration intelligence
- **Agents** are employees with roles, not model wrappers
- **Models** are interchangeable thinking engines
- **Domains** are pluggable business contexts

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Company Kernel                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ State Machine│  │ Constitution │  │   Debate     │      │
│  │   (13 states)│  │  Enforcer    │  │  Controller  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Evidence    │  │  Synthesis   │  │    Report    │      │
│  │  Controller  │  │    Engine    │  │  Generator   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Adapter Layer                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  Claude  │  │  Gemini  │  │    ZAI   │  │ Fallback │   │
│  │  Adapter │  │  Adapter │  │  Adapter │  │ Manager  │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Domains                                  │
│  ┌──────────────────────┐  ┌──────────────────────┐        │
│  │ Investment War Room  │  │   Research Studio    │        │
│  │  - 12 analysts       │  │  - 6 researchers     │        │
│  │  - Stock analysis    │  │  - Literature review │        │
│  └──────────────────────┘  └──────────────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

## Tech Stack

| Component | Technology |
|-----------|------------|
| **Language** | TypeScript 5.7+ |
| **Runtime** | Node.js 20+ |
| **Package Manager** | pnpm 8+ |
| **Testing** | Vitest |
| **CLI Framework** | Commander.js |
| **MCP Server** | @modelcontextprotocol/sdk |
| **Validation** | Zod |

## Project Structure

```
one4all/
├── packages/
│   ├── kernel/              # Company Kernel (core logic)
│   │   ├── src/
│   │   │   ├── state-machine/       # Mission state machine
│   │   │   ├── constitution-enforcer/ # Rule enforcement
│   │   │   ├── debate-controller/    # Structured debate
│   │   │   ├── evidence-controller/  # Evidence management
│   │   │   ├── synthesis/            # Consensus engine
│   │   │   ├── report/               # Report generation
│   │   │   ├── parallel-execution/   # Concurrent agents
│   │   │   └── integration/          # Workflow orchestration
│   │   └── tests/
│   ├── adapters/            # AI model adapters
│   │   ├── src/claude/       # Anthropic Claude
│   │   ├── src/zai/          # OpenAI-compatible
│   │   └── src/fallback/     # Circuit breaker pattern
│   ├── cli/                 # Command-line interface
│   ├── observability/       # Logging & monitoring
│   └── mcp/                 # MCP server
├── domains/
│   ├── investment-war-room/ # Investment analysis domain
│   │   ├── agents/          # 12 analyst cards
│   │   ├── constitution/    # Domain rules
│   │   └── missions/        # Mission storage
│   └── research-studio/     # Academic research domain
│       ├── agents/          # 6 researcher cards
│       └── constitution/    # Research rules
└── tests/integration/       # Cross-package tests
```

## Installation

```bash
# Clone repository
git clone https://github.com/dasimoa/one4all.git
cd one4all

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test
```

## Quick Start

```bash
# Check system health
one4all kernel status

# Create a mission
one4all mission create \
  --domain investment-war-room \
  --type stock_analysis \
  --ticker AAPL \
  --description "Comprehensive valuation analysis"

# Run a mission
one4all mission run <mission-id>

# View results
one4all report view <mission-id>

# Browse journal
one4all journal list
```

## Mission States

```
DRAFT → PLANNING → RESEARCHING → HUMAN_REVIEW_GATE_1 → ANALYZING
  ↓                                              ↓
FAILED ←─────┴──────── CROSS_QA ←─── DEBATING ←───┘
                    ↓              ↓
               SYNTHESIZING → HUMAN_REVIEW_GATE_3
                    ↓
                 DECIDED → JOURNALED
```

## Usage Examples

### Investment Analysis

```typescript
import { InvestmentWarRoom, createInvestmentWarRoom } from '@one4all/kernel';

const warRoom = createInvestmentWarRoom({
  domain: 'investment-war-room',
  participants: [
    'damodaran-valuation',
    'downside-protection',
    'leveraged-franchise',
  ],
  evidence_sources: ['sec', 'earnings-transcripts'],
  debate_config: {
    max_rounds: 3,
    convergence_threshold: 30,
  },
  report_format: 'markdown',
});

const result = await warRoom.executeAnalysis(mission);
console.log(result.report?.decision);
```

### MCP Server

```bash
# Start MCP server for Claude Desktop
one4all mcp start

# In Claude Desktop settings.json:
{
  "mcpServers": {
    "one4all": {
      "command": "node",
      "args": ["/path/to/one4all/packages/mcp/dist/index.js"]
    }
  }
}
```

## Domains

### Investment War Room
**Purpose:** Evidence-based investment analysis

**Agents:**
- `damodaran-valuation` — DCF valuation specialist
- `downside-protection` — Risk analyst
- `leveraged-franchise` — Quality assessor
- `allocator-steward` — Portfolio fit
- `seth-klarman` — Margin of safety
- `michael-burry` — Downside scenarios
- And 6 more specialists

**Constitution Rules:**
- Tier 1 sources required for material claims
- No buy/sell recommendations (analysts provide valuation only)
- Margin of safety analysis mandatory
- Thesis breakers must be explicit

### Research Studio
**Purpose:** Academic research synthesis

**Agents:**
- `literature-reviewer` — Systematic review
- `methodologist` — Study design evaluation
- `statistician` — Power analysis and validity
- `peer-reviewer` — Critical appraisal
- `synthesizer` — Evidence integration
- `hypothesis-tester` — Hypothesis validation

**Constitution Rules:**
- Peer-reviewed sources preferred
- Claim-warrant-impact argumentation
- Bayesian belief updating
- Methodology transparency required

## Test Coverage

```
605 tests passing across 27 test files

├── Constitution Enforcer:   30 tests
├── Debate Controller:        32 tests
├── Evidence Controller:      87 tests
├── State Machine:            27 tests
├── Parallel Execution:       24 tests
├── Adapters:                 65 tests
├── CLI:                     195 tests
├── Integration:             16 tests
├── MCP Server:               34 tests
└── Observability:            17 tests
```

## Configuration

### Agent Card Example

```yaml
# domains/investment-war-room/agents/damodaran-valuation.yaml
id: damodaran-valuation
name: "Damodaran Valuation Partner"
version: "1.0"
domain: investment-war-room

role: valuation_analyst
description: "DCF-first valuation analyst. Story must become numbers."

model:
  primary:
    provider: claude
    model: claude-opus-4-5
  fallback:
    - provider: zai
      model: zai-default

output_contract:
  mandatory_fields:
    - fair_value_conservative
    - fair_value_base
    - implied_growth_at_market_price
    - conviction_level
  forbidden_content:
    - buy_recommendation
    - sell_recommendation
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add/update tests
5. Submit a pull request

## License

MIT License — see LICENSE file for details

## Acknowledgments

Inspired by:
- Aswath Damodaran's valuation philosophy
- Seth Klarman's margin of safety approach
- The concept of AI agents as company employees

---

**Built with ❤️ for evidence-based decision making**
