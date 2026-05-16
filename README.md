# one4all — AI Company Simulation System

![banner](docs/assets/banner.png)

> A sophisticated multi-agent system orchestrating AI specialists through structured debate, evidence validation, and decision governance.

[![Tests](https://img.shields.io/badge/tests-1106%20passing-brightgreen)](https://github.com/dasimoa/one4all)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green)](https://node.js.org/)
[![MCP](https://img.shields.io/badge/MCP-1.29.0-purple)](https://modelcontextprotocol.io/)
[![Version](https://img.shields.io/badge/v2.0.0-blue)](https://github.com/dasimoa/one4all)

## Overview

**one4all** simulates a "company" with AI agents as employees, featuring a central kernel that orchestrates missions, enforces constitution rules, manages structured debate, and maintains decision journals. The system supports multiple LLM backends through CLI tools and API adapters.

### v2.0 — Inquiry System & Thai Market Support 🚀

- **Inquiry Mode** — Ask questions directly, get targeted analyst responses
- **Smart Routing** — AI-powered question routing to appropriate analysts
- **Thai Market Support** — Full SET (.BK) ticker support with THB=X rates
- **Multi-Language** — Thai and English question handling
- **CIO Router** — Intelligent analyst selection based on question type
- **Parallel Execution** — Multiple analysts respond simultaneously
- **Quick Synthesis** — Fast answer compilation for inquiries

**Core Features:**
- **Company Kernel** — State machine orchestrator with 17 mission states (13 classic + 4 inquiry)
- **Specialist Agents** — 17 domain experts with unique personas and skills
- **Evidence Governance** — Source tiering, scoring, and validation
- **Structured Debate** — Multi-round argumentation with constitution enforcement
- **Decision Journaling** — Persistent audit trail with thesis breakers
- **Multi-CLI Support** — Claude CLI, Gemini CLI, Codex CLI, ZAI API with automatic fallback
- **Real-Time Data** — Yahoo Finance integration for live stock prices (US + Thai markets)

## Philosophy

> "Company-first, tool-second. Agent ≠ Model. Kernel is stable, everything else changes."

- The **Kernel** contains all orchestration intelligence
- **Agents** are employees with roles, not model wrappers
- **Models** are interchangeable thinking engines
- **Domains** are pluggable business contexts
- **CLI First** — Works with your installed CLI tools
- **Inquiry First** — Quick questions don't need full missions

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Company Kernel v2.0                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ State Machine│  │ Constitution │  │   Debate     │      │
│  │  (17 states) │  │  Enforcer    │  │  Controller  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Evidence    │  │  Synthesis   │  │    Report    │      │
│  │  Controller  │  │    Engine    │  │  Generator   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  CIO Router  │  │   Inquiry    │  │   Thai       │      │
│  │   (NEW v2)   │  │   Handler    │  │   Support    │      │
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
│  │  - 13 analysts       │  │  - 6 researchers     │        │
│  │  - Stock analysis    │  │  - Literature review │        │
│  │  - Thai (.BK) support│  │  - Multi-language   │        │
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
| **Data Source** | Yahoo Finance API (US + Thai markets) |
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
│   │   ├── src/state-machine/       # Mission state machine (17 states)
│   │   ├── src/constitution/        # Rule enforcement
│   │   ├── src/debate/              # Structured debate
│   │   ├── src/evidence/            # Evidence management
│   │   └── src/registry/            # Agent registry & routing
│   ├── adapters/            # AI model adapters
│   │   ├── src/cli-adapters/        # CLI tool wrappers
│   │   ├── src/zai/                # ZAI API adapter
│   │   └── src/fallback/           # Circuit breaker pattern
│   ├── cli/                 # Command-line interface
│   │   ├── src/lib/adapter-factory.ts     # Unified adapter factory
│   │   ├── src/lib/agent-adapter-mapping.ts # Provider assignments
│   │   ├── src/lib/stock-price.ts          # Real-time price fetching
│   │   ├── src/lib/state-handlers/         # State machine handlers
│   │   ├── src/lib/state-handlers/routing-handler.ts    # v2.0 CIO Router
│   │   └── src/lib/state-handlers/executing-inquiry-handler.ts # v2.0 Inquiry
│   ├── mcp/                 # MCP server for one4all kernel
│   │   └── dist/                    # Compiled MCP server (33 tools, 5 resources)
│   ├── mcp-server/          # Unified MCP server (missions + stock prices)
│   ├── observability/       # Logging & monitoring
│   └── shared/              # Shared utilities and types
├── domains/
│   └── investment-war-room/ # Investment analysis domain
│       ├── agents/          # 13 analyst cards
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
| **claude-cli** | 13 | Primary for most agents - high-quality reasoning |
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

# v2.0: Quick inquiry mode (NEW!)
one4all mission inquire \
  --domain investment-war-room \
  --question "What's the fair value of ADVANC per Damodaran?" \
  --language thai

# Create a full mission
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

### Classic Mission Flow (13 states)

```
DRAFT → PLANNING → RESEARCHING → HUMAN_REVIEW_GATE_1 → ANALYZING
  ↓                                              ↓
FAILED ←─────┴──────── CROSS_QA ←─── DEBATING ←───┘
                    ↓              ↓
               SYNTHESIZING → HUMAN_REVIEW_GATE_3
                    ↓
                 DECIDED → JOURNALED
```

### v2.0 Inquiry Flow (4 states) 🆕

```
ROUTING → EXECUTING_INQUIRY → INQUIRY_SYNTHESIZING → DELIVERABLE
  ↓                ↓                      ↓
FAILED ←──────────┴──────────────────────┘
```

**Inquiry Mode Features:**
- **ROUTING** — AI-powered question analysis to select appropriate analysts
- **EXECUTING_INQUIRY** — Parallel execution of selected analysts
- **INQUIRY_SYNTHESIZING** — Quick compilation of analyst responses
- **DELIVERABLE** — Final answer delivered without full mission overhead

## Real-Time Data Integration

The system automatically fetches real-time stock prices from Yahoo Finance:

### US Market Data
```
[RESEARCHING] Current price: $220.78 (Yahoo Finance)
[RESEARCHING] 52-Week High: $223.75
[RESEARCHING] 52-Week Low: $124.47
```

### Thai Market Data (NEW!)
```
[RESEARCHING] Current price: ฿152.50 (Yahoo Finance)
[RESEARCHING] 52-Week High: ฿168.00
[RESEARCHING] 52-Week Low: ฿124.00
[RESEARCHING] THB/X: 35.42
```

This data is:
- Fetched BEFORE prompting LLMs (no hallucinated prices)
- Passed to all analysts for accurate analysis
- Stored in mission reports for reference
- Supports both US and Thai markets with currency conversion

## MCP Integration

one4all provides full [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) support, enabling LLMs to interact with the system through standardized tools and resources.

### MCP Servers

| Server | Tools | Resources | Description |
|--------|-------|-----------|-------------|
| **@one4all/mcp** | 33 | 5 | Full kernel integration (missions, agents, domains, validation) |
| **stock-price-server** | 2 | 0 | Standalone stock price data (US + Thai) |

### Available Tools

**Mission Management (9 tools):**
- `create_mission` - Create new analysis missions
- `get_mission_status` - Get mission state and metadata
- `transition_mission` - Advance mission through state machine
- `list_missions` - List/filter missions
- `get_evidence_pack` - Retrieve evidence for a mission
- `get_debate_summary` - Get structured debate results
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

### v2.0 Quick Inquiry (NEW!)

```bash
# Quick question in English
one4all mission inquire \
  --domain investment-war-room \
  --question "What is the fair value of AAPL according to Damodaran?"

# Quick question in Thai
one4all mission inquire \
  --domain investment-war-room \
  --question "ADVANC ราคาปัจจุบันคุ้มไหมตามแนวคิด Klarman?" \
  --language thai

# The system will:
# 1. Analyze the question using CIO Router
# 2. Select appropriate analysts (e.g., damodaran-valuation for DCF questions)
# 3. Execute selected analysts in parallel
# 4. Synthesize responses into a quick answer
# 5. Deliver without full mission overhead
```

### Investment Analysis with Multi-CLI

```bash
# Create and run in one command
one4all mission create \
  --domain investment-war-room \
  --type stock_analysis \
  --ticker AAPL \
  --description "Should I buy at current price?" \
  --run

# The system will:
# 1. Fetch real-time AAPL price from Yahoo Finance
# 2. Run researcher-set with gemini-cli
# 3. Run damodaran-valuation with claude-cli
# 4. Run downside-protection with zai-api (fallback to gemini-cli if API fails)
# 5. Run portfolio-allocator with gemini-cli
# 6. Synthesize with cio-synthesizer using claude-cli
```

### Thai Market Analysis (NEW!)

```bash
# Analyze Thai stock
one4all mission create \
  --domain investment-war-room \
  --type stock_analysis \
  --ticker ADVANC \
  --description "วิเคราะห์หุ้น ADVANC" \
  --run

# The system will:
# 1. Auto-normalize ADVANC → ADVANC.BK
# 2. Fetch real-time price from SET in THB
# 3. Get THB/X exchange rate
# 4. Run analysis with Thai market context
# 5. Present results in Thai Baht
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
**Purpose:** Evidence-based investment analysis (US + Thai markets)

**Agents (13 total):**
- `damodaran-valuation` — DCF valuation specialist
- `downside-protection` — Risk analyst (formerly klarman-downside)
- `portfolio-allocator` — Position sizing
- `seth-klarman` — Margin of safety
- `michael-burry` — Downside scenarios
- `consensus-analyst` — Quick consensus builder (NEW for inquiries)
- `devil-advocate` — Challenge assumptions (NEW for inquiries)
- `greenwald-evasion` — Competitive advantage
- `kessler-moat` — Moat analysis
- `klamran-quality` — Quality assessment
- `leveraged-franchise` — Franchise value
- `allocator-steward` — Capital allocation
- And more...

**Provider Distribution:**
- **Claude CLI** (13): Primary provider for all agents
- **Gemini CLI** (fallback): Backup when Claude CLI unavailable
- **Codex CLI** (fallback): Additional backup option
- **ZAI API** (fallback): Additional backup option

**Constitution Rules:**
- Tier 1 sources required for material claims
- Real-time market data from Yahoo Finance (US + Thai)
- Margin of safety analysis mandatory
- Thesis breakers must be explicit

**v2.0 Features:**
- Thai (.BK) ticker support with auto-normalization
- THB/X exchange rate integration
- Multi-language question handling (Thai/English)
- CIO Router for intelligent analyst selection
- Quick inquiry mode for fast answers

## Test Coverage

```
✅ 1106 tests passing across 58 test files

├── Constitution Enforcer:    30 tests ✅
├── Debate Controller:         32 tests ✅
├── Evidence Controller:       87 tests ✅
├── State Machine:             27 tests ✅
├── Parallel Execution:        24 tests ✅
├── Adapters:                 154 tests ✅
├── CLI:                      195 tests ✅
├── MCP:                       56 tests ✅
├── Integration:              418 tests ✅
│   ├── Mission Execution E2E:   5 tests ✅
│   ├── Kernel Client:           42 tests ✅
│   ├── State Handlers:          47 tests ✅
│   └── A2A Protocol:           342 tests ✅
├── Observability:             17 tests ✅
├── Agent Registry:            11 tests ✅
├── Routing Handler:            5 tests ✅
└── Thai Market Support:        8 tests ✅
```

**Test Quality:**
- ✅ No mocking — All tests use real functions
- ✅ Real API integration when keys available
- ✅ Graceful skip when API keys unavailable
- ✅ Full coverage of mission states (17 states)
- ✅ Error handling and edge cases

## Configuration

### Agent Card Example

```yaml
# domains/investment-war-room/agents/damodaran-valuation.yaml
id: damodaran-valuation
name: "Damodaran Valuation Partner"
domain: investment-war-room

role: valuation_analyst
description: "DCF-first valuation analyst"

# v2.0: Routing metadata for CIO Router
routing_metadata:
  expertise:
    - "DCF valuation"
    - "discounted cash flow"
    - "intrinsic value"
  when_to_use:
    - "When asking: What is the fair value"
    - "Thai: มูลค่าตามหลัก Damodaran"
  trigger_patterns:
    - "fair value"
    - "intrinsic value"
    - "DCF"
    - "มูลค่าหลักทุน"
  model_preference: "claude-cli"
  timeout_seconds: 120
  max_tokens: 4000

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
4. Add/update tests (all tests must pass, no mocking)
5. Submit a pull request

## Version History

### v2.0.0 (Current)
- ✅ Inquiry System with CIO Router
- ✅ Thai Market (.BK) Support
- ✅ Multi-language Question Handling
- ✅ Parallel Inquiry Execution
- ✅ 1106 tests passing (no mocking)
- ✅ Mission Storage Improvements
- ✅ Enhanced Error Handling

### v1.5.0
- ✅ A2A Protocol (342 tests)
- ✅ Agent Registry with Routing
- ✅ Enhanced CLI Commands
- ✅ Improved Observability

### v1.0.0
- ✅ Core Kernel with 13 States
- ✅ Multi-CLI Support
- ✅ Evidence Governance
- ✅ Structured Debate
- ✅ Decision Journaling

## License

MIT License — see LICENSE file for details

## Acknowledgments

Inspired by:
- Aswath Damodaran's valuation philosophy
- Seth Klarman's margin of safety approach
- Michael Burry's downside analysis
- The concept of AI agents as company employees

---

**Built with ❤️ for evidence-based decision making**
**Supporting US & Thai markets** 🇺🇸 🇹🇭
