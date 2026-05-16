<div align="center">

<img src="docs/assets/banner.png" alt="one4all banner" width="800"/>

# one4all

**AI-Powered Investment War Room with Multi-Agent Debate**

*A sophisticated multi-agent system orchestrating AI specialists through structured debate, evidence validation, and decision governance — supporting US & Thai markets.*

[![Tests](https://img.shields.io/badge/tests-1%2C477%20passing-brightgreen)](https://github.com/b9b4ymiN/one4all)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green)](https://nodejs.org/)
[![MCP](https://img.shields.io/badge/MCP-33%20tools-purple)](https://modelcontextprotocol.io/)
[![License](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)

[Features](#features) · [Quick Start](#quick-start) · [Architecture](#architecture) · [MCP Tools](#mcp-integration) · [A2A Protocol](#a2a-agent-to-agent-protocol) · [Docs](#documentation)

</div>

---

## Features

- **Company Kernel** — State machine orchestrator with 17 mission states (13 classic + 4 inquiry)
- **33 MCP Tools** — Full Model Context Protocol integration for Claude Desktop / IDE
- **FMP Data Enrichment** — Real financial statements from Financial Modeling Prep API injected into prompts
- **Real-Time Prices** — Yahoo Finance integration for US & Thai markets (no hallucinated numbers)
- **A2A Protocol** — Agent-to-Agent communication with trust verification & circuit breakers (342 tests)
- **17 Specialist Agents** — Domain experts with unique personas (Damodaran, Klarman, Burry, etc.)
- **Structured Debate** — Multi-round argumentation with constitution enforcement
- **Inquiry Mode** — Ask questions directly, get targeted analyst responses via CIO Router
- **Thai Market** — Full SET (.BK) support with auto-normalization and THB pricing
- **Multi-LLM** — ZAI API, Claude CLI, Gemini CLI, Codex CLI with automatic fallback

## Quick Start

```bash
# Clone and install
git clone https://github.com/b9b4ymiN/one4all.git
cd one4all && pnpm install

# Configure environment
cp .env.example .env
# Edit .env: add ZAI_API_KEY, FMP_API_KEY (optional, free tier available)

# Build and test
pnpm build
pnpm test

# Quick inquiry
one4all mission inquire \
  --domain investment-war-room \
  --question "What's the fair value of NVDA per Damodaran?"

# Full mission
one4all mission create \
  --domain investment-war-room \
  --type stock_analysis \
  --ticker AAPL \
  --description "Comprehensive valuation" \
  --run
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      one4all Kernel v2.0                        │
│                                                                 │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐           │
│  │ State Machine│ │ Constitution │ │   Debate     │           │
│  │  (17 states) │ │  Enforcer    │ │  Controller  │           │
│  └──────────────┘ └──────────────┘ └──────────────┘           │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐           │
│  │  Evidence    │ │  Synthesis   │ │    Report    │           │
│  │  Controller  │ │    Engine    │ │  Generator   │           │
│  └──────────────┘ └──────────────┘ └──────────────┘           │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐           │
│  │  CIO Router  │ │   Inquiry    │ │  FMP Data    │           │
│  │              │ │   Handler    │ │  Enrichment  │           │
│  └──────────────┘ └──────────────┘ └──────────────┘           │
└─────────────────────────────────────────────────────────────────┘
          │                                    │
          ▼                                    ▼
┌─────────────────────┐           ┌─────────────────────────────┐
│   Adapter Layer      │           │      Data Layer              │
│ ┌──────┐ ┌──────┐   │           │ ┌───────────┐ ┌───────────┐ │
│ │ ZAI  │ │Claude│   │           │ │   Yahoo   │ │   FMP     │ │
│ │ API  │ │ CLI  │   │           │ │  Finance  │ │  API      │ │
│ └──────┘ └──────┘   │           │ └───────────┘ └───────────┘ │
│ ┌──────┐ ┌──────┐   │           │  Prices (US+TH)  Financials │
│ │Gemini│ │Codex │   │           └─────────────────────────────┘
│ │ CLI  │ │ CLI  │   │
│ └──────┘ └──────┘   │
└─────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Domains                                   │
│  ┌───────────────────────────┐  ┌───────────────────────────┐  │
│  │  Investment War Room      │  │    Research Studio         │  │
│  │  13 analysts              │  │    6 researchers           │  │
│  │  US + Thai (.BK) markets  │  │    Literature review       │  │
│  └───────────────────────────┘  └───────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Data Enrichment Pipeline

one4all v2.0 features a data enrichment pipeline that fetches **verified financial data** before the LLM generates analysis, significantly reducing hallucinated numbers.

### Yahoo Finance (Price Data)

Fetched for all stocks before every analysis:
- Current price, 52-week range, market cap
- Auto-normalization: `ADVANC` → `ADVANC.BK` for Thai tickers
- 48 Thai tickers pre-configured with auto `.BK` suffix

### FMP API (Financial Statements)

Fetched for **US stocks only** (Thai stocks not supported by FMP):
- Income Statement: Revenue, Net Income, EPS, Gross Margin, Operating Margin (4 years)
- Key Metrics: P/E Ratio, ROE, ROA, Debt/Equity, Current Ratio
- 24-hour in-memory cache (250 free requests/day)

```
[RESEARCHING] Yahoo: AAPL $300.23 | 52W: $193.46 - $303.20
[RESEARCHING] FMP:  Revenue $391.0B | Net Income $93.7B | EPS $6.11
[RESEARCHING] FMP:  P/E 30.2 | ROE 157.3% | Debt/Equity 1.87
```

This data is injected directly into analyst prompts, giving the LLM **real numbers to work with** instead of fabricating financial data.

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

### Inquiry Flow (4 states)

```
ROUTING → EXECUTING_INQUIRY → INQUIRY_SYNTHESIZING → DELIVERABLE
  ↓                ↓                      ↓
FAILED ←──────────┴──────────────────────┘
```

- **ROUTING** — AI-powered question analysis selects appropriate analysts
- **EXECUTING_INQUIRY** — Parallel execution of selected analysts
- **INQUIRY_SYNTHESIZING** — Quick compilation of analyst responses
- **DELIVERABLE** — Final answer without full mission overhead

## MCP Integration

one4all provides 33 MCP tools, 5 resource types, and 2 prompts for integration with Claude Desktop, IDEs, and any MCP client.

### Tool Categories

| Category | Tools | Key Operations |
|----------|-------|----------------|
| **Mission Management** | 9 | create, run, abort, replay, status, evidence, debate |
| **Agent Management** | 7 | create, show, edit, remove, list, import, export |
| **Domain Management** | 6 | create, show, edit, remove, list, validate |
| **Constitution** | 3 | load, validate, list |
| **Inquiry** | 2 | ask, list_thai_tickers |
| **Journal** | 2 | update, list |
| **Validation** | 4 | agents, domains, constitutions, all |

### Resources

- `mission://{id}` — Full mission data
- `report://{id}` — Generated analysis report
- `journal://{id}` — Journal entry with thesis & breakers
- `constitution://{domain}` — Domain constitution rules
- `agents://{domain}` — Agent configurations

### Claude Desktop Setup

```json
{
  "mcpServers": {
    "one4all": {
      "command": "node",
      "args": ["/path/to/one4all/packages/mcp/dist/index.js"]
    }
  }
}
```

## A2A (Agent-to-Agent) Protocol

The A2A package enables one4all to integrate external agent services as peers to internal agents.

**Status:** Framework complete, 342/342 tests passing

| Feature | Status |
|---------|--------|
| Agent Card Schema (Zod) | Ready |
| Trust Verification | Ready |
| Gateway State Machine | Ready |
| Circuit Breaker | Ready |
| Behavioral Protocols | Ready |
| Agent Adapters (internal/external) | Ready |
| HTTP/gRPC Execution | Stub (needs client) |
| Kernel Wiring | Stub (needs integration) |

### Test Coverage

| Suite | Files | Tests |
|-------|-------|-------|
| Unit Tests | 7 | 172 |
| Integration Tests | 3 | 69 |
| Behavioral Validation | 3 | 53 |
| Chaos Engineering | 3 | 48 |
| **Total** | **16** | **342** |

See [packages/a2a/README.md](packages/a2a/README.md) for complete documentation.

## Project Structure

```
one4all/
├── packages/
│   ├── kernel/              # Core state machine & orchestration
│   │   ├── src/state-machine/       # 17 mission states
│   │   ├── src/constitution/        # Rule enforcement
│   │   ├── src/debate/              # Structured debate
│   │   ├── src/evidence/            # Evidence management
│   │   └── src/registry/            # Agent registry & routing
│   ├── adapters/            # LLM adapters
│   │   ├── src/zai/                # ZAI API (glm-4.5, 16K tokens)
│   │   ├── src/cli-adapters/        # Claude/Gemini/Codex CLI wrappers
│   │   └── src/fallback/           # Circuit breaker pattern
│   ├── cli/                 # CLI commands
│   │   └── src/lib/
│   │       ├── stock-price.ts          # Yahoo Finance + FMP integration
│   │       └── state-handlers/         # Mission & inquiry handlers
│   ├── mcp/                 # MCP server (33 tools, 5 resources)
│   ├── a2a/                 # Agent-to-Agent protocol (342 tests)
│   ├── observability/       # Logging & monitoring
│   └── shared/              # Shared utilities
├── domains/
│   ├── investment-war-room/ # 13 analyst agents + constitution
│   └── research-studio/     # 6 researcher agents
├── tests/
│   └── integration/         # Full pipeline + FMP enrichment tests
└── docs/                    # Documentation & plans
```

## Test Results

### Full Integration Test v2.0 (Real LLM, no mocks)

| Test | Stock | Agent | Time | Tokens | Result |
|------|-------|-------|------|--------|--------|
| TH-1 | ADVANC.BK | Damodaran DCF | 117s | 6,749 | PASS |
| TH-2 | CPF.BK | Klarman Downside | 60s | 3,900 | PASS |
| TH-3 | KBANK.BK | Burry Forensic | 21s | 1,516 | PASS |
| US-1 | AAPL | Damodaran DCF | 154s | 9,523 | PASS |
| US-2 | TSLA | Klarman Downside | 72s | 3,344 | PASS |
| US-3 | NVDA | Kessler Moat | 48s | 2,909 | PASS |

**6/6 passed, 27,941 total tokens, 0 truncated, 480s total duration**

### Unit & Integration Tests

```
1,477 tests passing across 75 test files

├── Kernel Core
│   ├── Constitution Enforcer:    30 tests
│   ├── Debate Controller:        32 tests
│   ├── Evidence Controller:      87 tests
│   ├── State Machine:            27 tests
│   ├── Parallel Execution:       24 tests
│   └── Agent Registry:           11 tests
├── Adapters
│   ├── ZAI Adapter:             154 tests
│   └── Output Verification:       8 tests
├── CLI & State Handlers
│   ├── Kernel Client:            42 tests
│   ├── State Handlers:           47 tests
│   ├── Routing Handler:           5 tests
│   ├── Inquiry Handler:          10 tests
│   └── Stock Price (FMP):        14 tests
├── MCP Server
│   ├── Server Tests:             56 tests
│   ├── Inquiry Handler:          12 tests
│   └── Inspector:                 4 tests
├── A2A Protocol
│   ├── Unit Tests:              172 tests
│   ├── Integration:              69 tests
│   ├── Behavioral:               53 tests
│   └── Chaos Engineering:        48 tests
├── Integration E2E
│   ├── Mission Execution:         5 tests
│   ├── FMP Enrichment:           14 tests
│   └── Inquiry Flow:              8 tests
└── Observability:                17 tests
```

All tests use real functions — no mocking. API-dependent tests gracefully skip when keys are unavailable.

## Agents

### Investment War Room (13 analysts)

| Agent | Persona | Specialty |
|-------|---------|-----------|
| `damodaran-valuation` | Aswath Damodaran | DCF valuation, intrinsic value |
| `seth-klarman` | Seth Klarman | Margin of safety, downside protection |
| `michael-burry` | Michael Burry | Forensic accounting, contrarian |
| `kessler-moat` | Andy Kessler | Competitive moat analysis |
| `greenwald-evasion` | Bruce Greenwald | Competitive advantage period |
| `klamran-quality` | Quality-focused | Earnings quality, balance sheet |
| `leveraged-franchise` | Franchise investor | Franchise value, pricing power |
| `downside-protection` | Risk analyst | Risk scenarios, stress testing |
| `portfolio-allocator` | Portfolio manager | Position sizing, allocation |
| `allocator-steward` | Capital steward | Capital allocation quality |
| `consensus-analyst` | Quick consensus | Fast multi-view synthesis |
| `devil-advocate` | Skeptic | Challenge assumptions, contrarian |
| `cio-synthesizer` | CIO | Final synthesis, decision |

## Configuration

### Environment Variables

```bash
# Required — LLM provider
ZAI_API_KEY=your_zai_api_key

# Optional — Financial data enrichment (free tier: 250 req/day)
FMP_API_KEY=your_fmp_api_key

# Optional — Additional LLM providers
OPENAI_API_KEY=your_openai_key
```

### CLI Tools (Optional)

```bash
npm install -g @anthropic-ai/claude-code   # Claude CLI
npm install -g @google/gemini-cli           # Gemini CLI
npm install -g @openai/codex                # Codex CLI
```

## Usage Examples

### Inquiry Mode (Quick Questions)

```bash
# English
one4all mission inquire \
  --domain investment-war-room \
  --question "What is the fair value of AAPL per Damodaran DCF?"

# Thai
one4all mission inquire \
  --domain investment-war-room \
  --question "ADVANC ราคาปัจจุบันคุ้มไหมตามแนวคิด Klarman?" \
  --language thai
```

### Full Mission (Deep Analysis)

```bash
# US stock with FMP data enrichment
one4all mission create \
  --domain investment-war-room \
  --type stock_analysis \
  --ticker NVDA \
  --description "Full valuation with moat analysis" \
  --run

# Thai stock (Yahoo prices only, FMP not available for Thai)
one4all mission create \
  --domain investment-war-room \
  --type stock_analysis \
  --ticker ADVANC \
  --description "วิเคราะห์หุ้น ADVANC" \
  --run
```

### MCP via Claude Desktop

Just ask Claude naturally:
- "Run a DCF analysis on AAPL"
- "What do the analysts think about TSLA?"
- "วิเคราะห์หุ้น KBANK ให้หน่อย"

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| `DEFAULT_MAX_TOKENS = 16384` | Prevents truncated output for complex DCF analyses |
| `SYNTHESIZING timeout = 360s` | Full missions with 13 analysts need time |
| FMP data pre-fetched | Eliminates hallucinated revenue/EPS numbers |
| Thai tickers skip FMP | FMP doesn't support Thai exchanges |
| 24h FMP cache | Respects 250 req/day free tier limit |
| No mocking in tests | Real API validation catches real issues |

## Documentation

| Document | Description |
|----------|-------------|
| [A2A Protocol](packages/a2a/README.md) | Agent-to-Agent protocol specification |
| [Inquiry System Plan](docs/plan/one4all-v2-inquiry-system.md) | v2.0 inquiry system design |
| [MCP Desktop Setup](docs/mcp-claude-desktop-linux.md) | Claude Desktop integration guide |
| [Integration Test Log](test-results/FULL_INTEGRATION_TEST_V2.log) | Latest 6-stock test results |

## Version History

### v2.0.0 (Current)
- FMP data enrichment pipeline (real financial statements)
- Output truncation fix (16K tokens, 360s timeout)
- Inquiry system with CIO Router
- Thai market support (48 tickers, auto .BK)
- Multi-language handling (Thai/English)
- 1,477 tests passing (no mocking)
- 33 MCP tools, 5 resources

### v1.5.0
- A2A protocol (342 tests)
- Agent registry with routing metadata
- Enhanced CLI commands
- Circuit breaker pattern

### v1.0.0
- Core kernel (13 states)
- Multi-CLI support
- Evidence governance
- Structured debate
- Decision journaling

## License

[MIT](./LICENSE)

---

<div align="center">

**Built for evidence-based investment decisions**

Supporting US & Thai markets 🇺🇸 🇹🇭

</div>
