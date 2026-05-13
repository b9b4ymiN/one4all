# one4all — AI Company Simulation System

> A sophisticated multi-agent system orchestrating AI specialists through structured debate, evidence validation, and decision governance.

[![Tests](https://img.shields.io/badge/tests-605%20passing-brightgreen)](https://github.com/dasimoa/one4all)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green)](https://nodejs.org/)

## Overview

**one4all** simulates a "company" with AI agents as employees, featuring a central kernel that orchestrates missions, enforces constitution rules, manages structured debate, and maintains decision journals. The system supports multiple LLM backends through CLI tools and API adapters.

- **Company Kernel** — State machine orchestrator with 13 mission states
- **Specialist Agents** — Domain experts with unique personas and skills
- **Evidence Governance** — Source tiering, scoring, and validation
- **Structured Debate** — Multi-round argumentation with constitution enforcement
- **Decision Journaling** — Persistent audit trail with thesis breakers
- **Multi-CLI Support** — Gemini CLI, Claude CLI, ZAI API with automatic fallback
- **Real-Time Data** — Yahoo Finance integration for live stock prices

## Philosophy

> "Company-first, tool-second. Agent ≠ Model. Kernel is stable, everything else changes."

- The **Kernel** contains all orchestration intelligence
- **Agents** are employees with roles, not model wrappers
- **Models** are interchangeable thinking engines
- **Domains** are pluggable business contexts
- **CLI First** — Works with your installed CLI tools

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
│  │    CLI   │  │    CLI   │  │   API    │  │ Manager  │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Domains                                  │
│  ┌──────────────────────┐  ┌──────────────────────┐        │
│  │ Investment War Room  │  │   Research Studio    │        │
│  │  - 17 analysts       │  │  - 6 researchers     │        │
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
| **LLM Backends** | Gemini CLI, Claude CLI, ZAI API |
| **Data Source** | Yahoo Finance API |

## Project Structure

```
one4all/
├── packages/
│   ├── kernel/              # Company Kernel (core logic)
│   │   ├── src/state-machine/       # Mission state machine
│   │   ├── src/constitution/        # Rule enforcement
│   │   ├── src/debate/              # Structured debate
│   │   └── src/evidence/            # Evidence management
│   ├── adapters/            # AI model adapters
│   │   ├── src/cli-adapters/        # CLI tool wrappers
│   │   ├── src/zai/                # ZAI API adapter
│   │   └── src/fallback/           # Circuit breaker pattern
│   ├── cli/                 # Command-line interface
│   │   ├── src/lib/adapter-factory.ts     # Unified adapter factory
│   │   ├── src/lib/agent-adapter-mapping.ts # Provider assignments
│   │   ├── src/lib/stock-price.ts          # Real-time price fetching
│   │   └── src/lib/state-handlers/         # State machine handlers
│   └── observability/       # Logging & monitoring
├── domains/
│   └── investment-war-room/ # Investment analysis domain
│       ├── agents/          # 17 analyst cards
│       └── constitution/    # Domain rules
└── mcp-servers/             # MCP servers for external integrations
    └── stock-price-server/  # Real-time stock data
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

## Configuration

### 1. CLI Tools Setup

Install and authenticate the CLI tools you want to use:

```bash
# Gemini CLI (optional but recommended)
npm install -g @google/gemini-cli
gemini auth login

# Claude CLI (optional but recommended)
npm install -g @anthropic-ai/claude-code
claude auth login
```

### 2. ZAI API Setup

Create a `.env` file in the project root:

```bash
# one4all/.env
ZAI_API_KEY=your_api_key_here
```

### 3. Agent-to-Provider Mapping

Agents are distributed across available providers:

| Provider | Agents | Purpose |
|----------|--------|---------|
| **gemini-cli** | 6 | Fast research, consensus, portfolio allocation |
| **zai-api** | 6 | Risk analysis, devil's advocate, quality checks |
| **claude-cli** | 4 | DCF valuation, synthesis, complex reasoning |

**Full mapping:**
- `claude-cli`: damodaran-valuation, cio-synthesizer, greenwald-evasion, michael-burry
- `gemini-cli`: researcher-set, consensus-analyst, kessler-moat, allocator-steward, leveraged-franchise, portfolio-allocator, portfolio-manager
- `zai-api`: klarman-downside, forensic-accountant, devil-advocate, downside-protection, klamran-quality, seth-klarman

## Quick Start

```bash
# Check system health
one4all kernel status

# Create a mission
one4all mission create \
  --domain investment-war-room \
  --type stock_analysis \
  --ticker NVDA \
  --description "Comprehensive valuation analysis"

# Run a mission (uses multi-CLI setup automatically)
one4all mission run -i <mission-id>

# View results
one4all report view -i <mission-id>

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

## Real-Time Data Integration

The system automatically fetches real-time stock prices from Yahoo Finance:

```
[RESEARCHING] Current price: $220.78 (Yahoo Finance)
[RESEARCHING] 52-Week High: $223.75
[RESEARCHING] 52-Week Low: $124.47
```

This data is:
- Fetched BEFORE prompting LLMs (no hallucinated prices)
- Passed to all analysts for accurate analysis
- Stored in mission reports for reference

## Usage Examples

### Investment Analysis with Multi-CLI

```bash
# Create and run in one command
one4all mission create \
  --domain "Analyze AAPL stock" \
  --type stock_analysis \
  --ticker AAPL \
  --description "Should I buy at current price?" \
  --run

# The system will:
# 1. Fetch real-time AAPL price from Yahoo Finance
# 2. Run researcher-set with gemini-cli
# 3. Run damodaran-valuation with claude-cli
# 4. Run klarman-downside with zai-api (fallback to gemini-cli if API fails)
# 5. Run portfolio-allocator with gemini-cli
# 6. Synthesize with cio-synthesizer using claude-cli
```

### Custom Provider Selection

```typescript
import { createUnifiedAdapter } from '@one4all/cli';

// Use specific CLI for an agent
const adapter = createUnifiedAdapter('claude-cli');
const result = await adapter.run(prompt);
```

## Domains

### Investment War Room
**Purpose:** Evidence-based investment analysis

**Agents (17 total):**
- `damodaran-valuation` — DCF valuation specialist
- `klarman-downside` — Risk analyst
- `portfolio-allocator` — Position sizing
- `seth-klarman` — Margin of safety
- `michael-burry` — Downside scenarios
- And 12 more specialists

**Provider Distribution:**
- **Claude CLI** (4): Complex valuation, synthesis
- **ZAI API** (6): Risk analysis, devil's advocate
- **Gemini CLI** (6): Research, consensus, allocation

**Constitution Rules:**
- Tier 1 sources required for material claims
- Real-time market data from Yahoo Finance
- Margin of safety analysis mandatory
- Thesis breakers must be explicit

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
└── Observability:            17 tests
```

## Configuration

### Agent Card Example

```yaml
# domains/investment-war-room/agents/damodaran-valuation.yaml
id: damodaran-valuation
name: "Damodaran Valuation Partner"
domain: investment-war-room

role: valuation_analyst
description: "DCF-first valuation analyst"

# Provider assignment (via agent-adapter-mapping.ts)
# Uses claude-cli for high-quality reasoning
# Falls back to gemini-cli if unavailable

output_contract:
  mandatory_fields:
    - fair_value_conservative
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
