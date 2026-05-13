# one4all — AI Company Simulation System

> A sophisticated multi-agent system orchestrating AI specialists through structured debate, evidence validation, and decision governance.

[![Tests](https://img.shields.io/badge/tests-967%20passing-brightgreen)](https://github.com/dasimoa/one4all)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green)](https://nodejs.org/)
[![MCP](https://img.shields.io/badge/MCP-1.29.0-purple)](https://modelcontextprotocol.io/)

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
│  │  Claude  │  │  Gemini  │  │   Codex  │  │ Fallback │   │
│  │    CLI   │  │    CLI   │  │    CLI   │  │ Manager  │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│  ┌──────────┐  ┌──────────┐                               │
│  │    ZAI   │  │  Human   │                               │
│  │   API    │  │   Gate   │                               │
│  └──────────┘  └──────────┘                               │
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
| **LLM Backends** | Claude CLI, Gemini CLI, Codex CLI, ZAI API |
| **Protocol** | Model Context Protocol (MCP) |
| **MCP SDK** | @modelcontextprotocol/sdk v1.29.0 |
| **Data Source** | Yahoo Finance API |
| **Storage** | File-based (~/.one4all/) |

## A2A (Agent-to-Agent) Protocol ✅

The **A2A protocol** enables one4all to integrate external agent services as peers to internal agents, providing a standardized way for agents to discover, communicate, and trust each other.

**Status:** ✅ Complete (342/342 tests passing)

### Key Features

- **Agent Card Standard** - Standardized format for capability advertisement
- **Trust Verification** - Behavioral validation with probationary periods
- **Behavioral Protocols** - Challenge/response, evidence submission, debate
- **Gateway State Machine** - NORMAL → DEGRADED → FALLBACK → CRITICAL
- **Circuit Breaker** - Automatic failure isolation
- **CLI Commands** - `one4all a2a list/register/info/health/verify/unregister`

### Usage

```bash
# List all registered agents
one4all a2a list

# Register an external agent
one4all a2a register agent-card.yaml

# Check agent health
one4all a2a health <agent-id>

# Run trust verification
one4all a2a verify <agent-id>
```

### Documentation

See [packages/a2a/README.md](packages/a2a/README.md) for complete A2A protocol documentation including:
- Agent Card schema reference
- Trust levels and verification process
- Behavioral protocols and interaction modes
- External agent development guide
- Troubleshooting guide

### Test Coverage

| Suite | Tests | Status |
|-------|-------|--------|
| Unit Tests | 172 | ✅ Passing |
| Integration Tests | 69 | ✅ Passing |
| Behavioral Validation | 53 | ✅ Passing |
| Chaos Engineering | 48 | ✅ Passing |
| **Total** | **342** | ✅ **All Passing** |

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
│   ├── mcp/                 # MCP server for one4all kernel
│   │   └── dist/                    # Compiled MCP server (31 tools, 5 resources)
│   ├── mcp-server/          # Unified MCP server (missions + stock prices)
│   ├── observability/       # Logging & monitoring
│   └── shared/              # Shared utilities and types
├── domains/
│   └── investment-war-room/ # Investment analysis domain
│       ├── agents/          # 17 analyst cards
│       └── constitution/    # Domain rules
├── a2a/                   # Agent-to-Agent Protocol ✅
│   ├── src/schemas/       # Agent Card standard
│   ├── src/trust/         # Trust verification
│   ├── src/gateway/       # A2A gateway
│   ├── tests/             # 342 tests (all passing)
│   └── examples/          # External agent example
└── mcp-servers/             # Standalone MCP servers
    └── stock-price-server/  # Real-time stock data via Yahoo Finance
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

# Codex CLI (optional)
npm install -g @openai/codex
codex auth login
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
| **claude-cli** | 15 | Primary for most agents - high-quality reasoning |
| **gemini-cli** | All | Fallback for claude-cli |
| **codex-cli** | All | Fallback for gemini-cli |

**CLI Adapter Features:**
- **Health checks**: Verify CLI tool availability and latency
- **Automatic fallback**: Seamlessly switch between CLI tools
- **JSON parsing**: Handles different output formats from each CLI
- **Timeout handling**: Configurable per-adapter timeouts
- **Error recovery**: Graceful degradation on failures

## Quick Start

```bash
# Check system health (CLI tools, storage, configs)
one4all observe health

# List available agents and domains
one4all agents list
one4all domains list

# Import agents from source YAMLs
one4all agents import --all

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

## MCP Integration

one4all provides full [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) support, enabling LLMs to interact with the system through standardized tools and resources.

### MCP Servers

| Server | Tools | Resources | Description |
|--------|-------|-----------|-------------|
| **@one4all/mcp** | 31 | 5 | Full kernel integration (missions, agents, domains, validation) |
| **stock-price-server** | 2 | 0 | Standalone stock price data |

### Available Tools

**Mission Management (6 tools):**
- `create_mission` - Create new analysis missions
- `get_mission_status` - Get mission state and metadata
- `transition_mission` - Advance mission through state machine
- `list_missions` - List/filter missions
- `get_evidence_pack` - Retrieve evidence for a mission
- `get_debate_summary` - Get structured debate results

**Enhanced Missions (3 tools):**
- `mission_run` - Fire-and-forget mission execution
- `mission_abort` - Abort a running mission
- `mission_replay` - Replay completed mission

**Agent Management (7 tools):**
- `agent_create` - Create new agent
- `agent_show` - Show agent details
- `agent_edit` - Edit existing agent
- `agent_remove` - Delete agent
- `agent_list` - List all agents
- `agent_import` - Import agents from YAML
- `agent_export` - Export agent configuration

**Domain Management (6 tools):**
- `domain_create` - Create new domain
- `domain_show` - Show domain details
- `domain_edit` - Edit domain
- `domain_remove` - Delete domain
- `domain_list` - List all domains
- `domain_validate` - Validate domain configuration

**Constitution Management (3 tools):**
- `constitution_load` - Load constitution rules
- `constitution_validate` - Validate constitution
- `constitution_list` - List available constitutions

**Journal Management (2 tools):**
- `journal_update` - Update journal entry
- `journal_list` - List journal entries

**Validation (4 tools):**
- `validate_agents` - Validate all agents
- `validate_domains` - Validate all domains
- `validate_constitutions` - Validate all constitutions
- `validate_all` - Validate everything

### Available Resources

- `mission://` - Mission data and metadata
- `report://` - Formatted analysis reports
- `journal://` - Journal entries (thesis, fair value, breakers)
- `constitution://` - Domain constitution rules
- `agents://` - Agent configurations

### Using MCP Inspector

```bash
# Install MCP Inspector
npm install -g @modelcontextprotocol/inspector

# Test the one4all MCP server
npx @modelcontextprotocol/inspector node packages/mcp/dist/index.js
```

### Claude Desktop Configuration

Add to your Claude Desktop config:

```json
{
  "mcpServers": {
    "one4all": {
      "command": "node",
      "args": ["/absolute/path/to/one4all/packages/mcp/dist/index.js"]
    },
    "stock-price": {
      "command": "node",
      "args": ["/absolute/path/to/one4all/mcp-servers/stock-price-server/index.js"]
    }
  }
}
```

**See [docs/mcp.md](docs/mcp.md) for complete MCP documentation.**

## CLI Management Commands

### Agent Lifecycle Management

```bash
# List all agents
one4all agents list

# Show agent details
one4all agents show damodaran-valuation

# Create new agent
one4all agents create --id tech-analyst --name "Tech Analyst" --domain investment-war-room

# Edit agent
one4all agents edit damodaran-valuation --set-name "New Name"

# Remove agent
one4all agents remove old-agent

# Import from source YAMLs
one4all agents import --all

# Export agent config
one4all agents export damodaran-valuation --output agent.yaml

# Test agent with CLI adapter
one4all agents test damodaran-valuation --fixture test-prompt.yaml

# Backup/restore
one4all agents backup damodaran-valuation
one4all agents restore damodaran-valuation --from backup.yaml
```

### Domain Management

```bash
# List all domains
one4all domains list

# Show domain details
one4all domains show investment-war-room

# Create new domain (with templates)
one4all domains create --id my-domain --template investment-war-room

# Edit domain
one4all domains edit my-domain --set-name "My Domain"

# Remove domain
one4all domains remove my-domain

# Validate domain
one4all domains validate investment-war-room --check-agents --check-constitution

# List domain agents
one4all domains agents investment-war-room
```

### Validation Commands

```bash
# Validate agent configuration
one4all validate agent damodaran-valuation --schema --runtime

# Validate domain configuration
one4all validate domain investment-war-room --check-agents --check-constitution

# Validate constitution
one4all validate constitution investment-war-room --rules --enforcement

# Validate everything
one4all validate all --include-constitution
```

### Observability Commands

```bash
# Health check (CLI tools, storage, environment)
one4all observe health --verbose

# Observe mission progress
one4all observe mission MISSION-ID --follow

# Observe agent performance
one4all observe agents --domain investment-war-room --active-only

# View system logs
one4all observe logs -n 100 --follow --level error

# Export metrics
one4all observe export --format csv --output metrics.csv
```

### Journal Commands

```bash
# List journal entries
one4all journal list --domain investment-war-room

# View entry for ticker
one4all journal view --ticker NVDA

# Add new entry
one4all journal add --ticker NVDA --decision "LONG" --fair-value 250 --thesis "Strong moat"

# Update outcome
one4all journal update --entry-id ID --outcome "GAINED 20%"
```

### Team Commands

```bash
# Show team/agent health
one4all team status

# List all teams
one4all team list
```

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
- **Claude CLI** (15): Primary provider for all agents
- **Gemini CLI** (fallback): Backup when Claude CLI unavailable
- **Codex CLI** (fallback): Additional backup option

**Constitution Rules:**
- Tier 1 sources required for material claims
- Real-time market data from Yahoo Finance
- Margin of safety analysis mandatory
- Thesis breakers must be explicit

## Test Coverage

```
625 tests passing across 28 test files

├── Constitution Enforcer:   30 tests
├── Debate Controller:        32 tests
├── Evidence Controller:      87 tests
├── State Machine:            27 tests
├── Parallel Execution:       24 tests
├── Adapters:                 65 tests
├── CLI:                     195 tests
├── MCP:                      56 tests
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
