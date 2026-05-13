# MCP Integration Guide

## Overview

one4all provides full Model Context Protocol (MCP) server implementations, enabling LLMs to interact with the one4all system through standardized tools and resources.

## MCP Servers

### @one4all/mcp

The core MCP server that exposes the full one4all kernel functionality through MCP protocol.

**Location:** `packages/mcp/`

**Tools (31 total):**

#### Mission Management (6 tools)
| Tool | Description |
|------|-------------|
| `create_mission` | Create a new analysis mission |
| `get_mission_status` | Get current status of a mission |
| `transition_mission` | Transition mission to next state |
| `list_missions` | List all missions with optional filters |
| `get_evidence_pack` | Get evidence pack for a mission |
| `get_debate_summary` | Get debate summary for a mission |

#### Enhanced Mission Tools (3 tools)
| Tool | Description |
|------|-------------|
| `mission_run` | Fire-and-forget mission execution |
| `mission_abort` | Abort a running mission |
| `mission_replay` | Replay a completed mission |

#### Agent Management (7 tools)
| Tool | Description |
|------|-------------|
| `agent_create` | Create a new agent |
| `agent_show` | Show agent details |
| `agent_edit` | Edit existing agent |
| `agent_remove` | Delete an agent |
| `agent_list` | List all agents |
| `agent_import` | Import agents from YAML files |
| `agent_export` | Export agent configuration as JSON |

#### Domain Management (6 tools)
| Tool | Description |
|------|-------------|
| `domain_create` | Create a new domain |
| `domain_show` | Show domain details |
| `domain_edit` | Edit domain properties |
| `domain_remove` | Delete a domain |
| `domain_list` | List all domains |
| `domain_validate` | Validate domain configuration |

#### Constitution Management (3 tools)
| Tool | Description |
|------|-------------|
| `constitution_load` | Load constitution rules for a domain |
| `constitution_validate` | Validate a domain constitution |
| `constitution_list` | List available constitutions |

#### Journal Management (2 tools)
| Tool | Description |
|------|-------------|
| `journal_update` | Update journal entry with outcome |
| `journal_list` | List all journal entries |

#### Validation Tools (4 tools)
| Tool | Description |
|------|-------------|
| `validate_agents` | Validate all agent configurations |
| `validate_domains` | Validate all domain configurations |
| `validate_constitutions` | Validate all constitutions |
| `validate_all` | Validate all configuration types |

**Resources (5):**
| Resource | Description |
|----------|-------------|
| `mission://` | Mission data and metadata |
| `report://` | Formatted analysis reports |
| `journal://` | Journal entries (thesis, fair value, breakers) |
| `constitution://` | Domain constitution rules |
| `agents://` | Agent configurations by domain |

**Prompts (2):**
| Prompt | Description |
|--------|-------------|
| `stock_analysis` | Pre-configured stock analysis prompt |
| `debate_question` | Pre-configured debate question prompt |

### stock-price-server

A standalone MCP server for real-time stock price data.

**Location:** `mcp-servers/stock-price-server/`

**Tools (2):**
| Tool | Description |
|------|-------------|
| `get_stock_price` | Get current stock price for a ticker |
| `get_multiple_prices` | Get prices for multiple tickers |

**Data Source:** Yahoo Finance API

## Installation

```bash
# From the one4all project root
cd one4all

# Install dependencies
pnpm install

# Build all packages
pnpm build
```

## Usage

### With MCP Inspector (Recommended for Testing)

MCP Inspector is the official testing tool for MCP servers.

```bash
# Install MCP Inspector
npm install -g @modelcontextprotocol/inspector

# Test @one4all/mcp server (31 tools)
npx @modelcontextprotocol/inspector node packages/mcp/dist/index.js

# Test stock-price-server
npx @modelcontextprotocol/inspector node mcp-servers/stock-price-server/index.js
```

### With Claude Desktop

Add the server to your Claude Desktop configuration:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

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

### Programmatic Usage

```typescript
import { One4AllMCPServer } from '@one4all/mcp';
import { MissionStateMachine } from '@one4all/kernel';
import { createEvidenceController, createDebateController } from '@one4all/kernel';

const stateMachine = new MissionStateMachine();
const evidenceController = createEvidenceController();
const debateController = createDebateController();

const server = new One4AllMCPServer({
  name: 'one4all-mcp',
  version: '1.0.0',
  stateMachine,
  domainsPath: '~/.one4all/domains',
  evidenceController,
  debateController,
});

// Server runs on stdio
await server.start();
```

## Tool Examples

### Mission Management

#### Create Mission
```json
{
  "name": "create_mission",
  "arguments": {
    "type": "stock_analysis",
    "domain": "investment-war-room",
    "description": "Analyze NVDA stock",
    "ticker": "NVDA"
  }
}
```

#### Run Mission (Fire-and-Forget)
```json
{
  "name": "mission_run",
  "arguments": {
    "type": "stock_analysis",
    "domain": "investment-war-room",
    "description": "Quick NVDA analysis",
    "ticker": "NVDA"
  }
}
```

#### Get Mission Status
```json
{
  "name": "get_mission_status",
  "arguments": {
    "mission_id": "mission-123"
  }
}
```

### Agent Management

#### Create Agent
```json
{
  "name": "agent_create",
  "arguments": {
    "id": "tech-analyst",
    "name": "Tech Analyst",
    "domain": "investment-war-room",
    "role": "analyst",
    "description": "Technology sector analyst",
    "provider": "claude-cli",
    "model": "claude-3-opus"
  }
}
```

#### List Agents
```json
{
  "name": "agent_list",
  "arguments": {
    "domain": "investment-war-room"
  }
}
```

#### Export Agent
```json
{
  "name": "agent_export",
  "arguments": {
    "agent_id": "tech-analyst"
  }
}
```

### Domain Management

#### Create Domain
```json
{
  "name": "domain_create",
  "arguments": {
    "id": "my-domain",
    "name": "My Domain",
    "description": "Custom analysis domain"
  }
}
```

#### Validate Domain
```json
{
  "name": "domain_validate",
  "arguments": {
    "domain_id": "investment-war-room"
  }
}
```

### Constitution Management

#### Load Constitution
```json
{
  "name": "constitution_load",
  "arguments": {
    "domain": "investment-war-room"
  }
}
```

#### Validate Constitution
```json
{
  "name": "constitution_validate",
  "arguments": {
    "domain": "investment-war-room"
  }
}
```

### Journal Management

#### List Journal Entries
```json
{
  "name": "journal_list",
  "arguments": {}
}
```

#### Update Journal Entry
```json
{
  "name": "journal_update",
  "arguments": {
    "ticker": "NVDA",
    "outcome": {
      "decision": "LONG",
      "entry_price": 220.50,
      "current_price": 245.00,
      "pct_change": 11.11,
      "status": "GAINING"
    }
  }
}
```

### Validation

#### Validate All
```json
{
  "name": "validate_all",
  "arguments": {}
}
```

### Stock Price (stock-price-server)

#### Get Stock Price
```json
{
  "name": "get_stock_price",
  "arguments": {
    "ticker": "AAPL"
  }
}
```

#### Get Multiple Prices
```json
{
  "name": "get_multiple_prices",
  "arguments": {
    "tickers": ["AAPL", "NVDA", "MSFT"]
  }
}
```

## Resource Examples

### Read Mission Resource
```
mission://mission-123
```
Returns:
```json
{
  "mission_id": "mission-123",
  "state": "DRAFT",
  "type": "stock_analysis",
  "domain": "investment-war-room",
  "created_at": "2024-01-01T00:00:00Z"
}
```

### Read Report Resource
```
report://mission-123
```
Returns a formatted Markdown report with analysis results.

### Read Journal Resource
```
journal://NVDA
```
Returns thesis, fair value, and thesis breakers for the ticker.

### Read Constitution Resource
```
constitution://investment-war-room
```
Returns the domain's constitution rules in YAML format.

### Read Agents Resource
```
agents://investment-war-room
```
Returns a list of all agents in the domain with their configurations.

## Testing

All MCP servers have comprehensive test suites:

```bash
# Run MCP tests
pnpm test --filter @one4all/mcp

# Run MCP Inspector validation tests
npx vitest run packages/mcp/tests/inspector/mcp-inspector.test.ts

# Run integration tests
npx vitest run packages/mcp/tests/integration.test.ts

# Run server tests
npx vitest run packages/mcp/tests/server.test.ts

# Run stock-price-server tests
cd mcp-servers/stock-price-server && npm test
```

**Test Coverage:**
- 56 MCP tests (unit + integration + inspector validation)
- All 31 tools tested
- All 5 resources tested
- Protocol compliance verified

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     MCP Server Layer                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ @one4all/mcp │  │ stock-price  │  │   Future     │      │
│  │              │  │   -server    │  │  servers...  │      │
│  │ 31 tools     │  │ 2 tools      │  │              │      │
│  │ 5 resources  │  │              │  │              │      │
│  │ 2 prompts    │  │              │  │              │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     Company Kernel                           │
│  State Machine • Constitution • Debate • Evidence           │
└─────────────────────────────────────────────────────────────┘
```

### MCP Module Architecture

```
@one4all/mcp/src/modules/
├── agent-handler.ts         # 7 agent management tools
├── domain-handler.ts        # 6 domain management tools
├── mission-enhanced.ts      # 3 enhanced mission tools
├── constitution-handler.ts  # 3 constitution tools
├── journal-handler.ts       # 2 journal tools
├── validator.ts             # 4 validation tools
└── storage/
    ├── agent-storage.ts     # Agent CRUD operations
    ├── domain-storage.ts    # Domain CRUD operations
    └── journal-storage.ts   # Journal CRUD operations
```

## MCP SDK Version

| Package | SDK Version |
|---------|-------------|
| @one4all/mcp | v1.29.0 |
| stock-price-server | v1.29.0 |

## Protocol Compliance

All MCP servers follow the Model Context Protocol specification:

- ✅ Tool discovery and execution
- ✅ Resource discovery and reading
- ✅ Prompt templates
- ✅ Standard error handling
- ✅ JSON-RPC 2.0 over stdio transport

## Storage Locations

The MCP server uses runtime storage at:

| Data | Location |
|------|----------|
| Agents | `~/.one4all/agents/` |
| Domains | `~/.one4all/domains/` |
| Journals | `~/.one4all/journal/` |
| Missions | In-memory (kernel) |

## Further Reading

- [Model Context Protocol Spec](https://modelcontextprotocol.io/)
- [MCP Inspector](https://github.com/modelcontextprotocol/inspector)
- [one4all Architecture](../README.md#architecture)
- [MCP Package README](../packages/mcp/README.md)
