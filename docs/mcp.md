# MCP Integration Guide

## Overview

one4all provides full Model Context Protocol (MCP) server implementations, enabling LLMs to interact with the one4all system through standardized tools and resources.

## MCP Servers

### @one4all/mcp

The core MCP server that exposes the full one4all kernel functionality through MCP protocol.

**Location:** `packages/mcp/`

**Tools (6):**
| Tool | Description |
|------|-------------|
| `create_mission` | Create a new analysis mission |
| `get_mission_status` | Get current status of a mission |
| `transition_mission` | Transition mission to next state |
| `list_missions` | List all missions with optional filters |
| `get_evidence_pack` | Get evidence pack for a mission |
| `get_debate_summary` | Get debate summary for a mission |

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

### @one4all/mcp-server

A unified MCP server combining mission management and stock price tools.

**Location:** `packages/mcp-server/`

**Tools:**
- Mission management tools (same as @one4all/mcp)
- Stock price tools (from stock-price-server)

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

# Test @one4all/mcp server
npx @modelcontextprotocol/inspector node packages/mcp/dist/index.js

# Test @one4all/mcp-server
npx @modelcontextprotocol/inspector node packages/mcp-server/dist/index.js

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

const stateMachine = new MissionStateMachine();
const server = new One4AllMCPServer({
  name: 'one4all-mcp',
  version: '1.0.0',
  stateMachine,
  domainsPath: '/path/to/domains',
});

// Server runs on stdio
await server.start();
```

## Tool Examples

### Create Mission

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

### Get Stock Price

```json
{
  "name": "get_stock_price",
  "arguments": {
    "ticker": "AAPL"
  }
}
```

### Get Evidence Pack

```json
{
  "name": "get_evidence_pack",
  "arguments": {
    "mission_id": "mission-123"
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

## Testing

All MCP servers have comprehensive test suites:

```bash
# Run MCP tests
pnpm test --filter @one4all/mcp

# Run MCP Inspector validation tests
npx vitest run packages/mcp/tests/inspector/mcp-inspector.test.ts

# Run integration tests
npx vitest run packages/mcp/tests/integration.test.ts

# Run stock-price-server tests
cd mcp-servers/stock-price-server && npm test
```

**Test Coverage:**
- 56 MCP tests (unit + integration + inspector validation)
- 9 stock-price-server tests

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     MCP Server Layer                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ @one4all/mcp │  │ mcp-server   │  │ stock-price  │      │
│  │              │  │              │  │   -server    │      │
│  │ 6 tools      │  │ 8 tools      │  │ 2 tools      │      │
│  │ 5 resources  │  │ 5 resources  │  │              │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     Company Kernel                           │
│  State Machine • Constitution • Debate • Evidence           │
└─────────────────────────────────────────────────────────────┘
```

## MCP SDK Version

| Package | SDK Version |
|---------|-------------|
| @one4all/mcp | v1.29.0 |
| @one4all/mcp-server | v0.5.0 |
| stock-price-server | v1.29.0 |

## Protocol Compliance

All MCP servers follow the Model Context Protocol specification:

- ✅ Tool discovery and execution
- ✅ Resource discovery and reading
- ✅ Prompt templates
- ✅ Standard error handling
- ✅ JSON-RPC 2.0 over stdio transport

## Further Reading

- [Model Context Protocol Spec](https://modelcontextprotocol.io/)
- [MCP Inspector](https://github.com/modelcontextprotocol/inspector)
- [one4all Architecture](../README.md#architecture)
