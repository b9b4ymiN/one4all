# MCP Server Configuration for Claude Desktop (Linux)

## Overview

The one4all MCP server provides tools for investment analysis, inquiry, and mission management through Claude Desktop.

## Installation

### 1. Build the MCP Server

```bash
cd /home/dasimoa/one4all/packages/mcp
npm run build
```

### 2. Configure Claude Desktop

On Linux, Claude Desktop stores configuration in:

```
~/.config/Claude/claude_desktop_config.json
```

Create or edit this file with the following configuration:

```json
{
  "mcpServers": {
    "one4all": {
      "command": "node",
      "args": ["/home/dasimoa/one4all/packages/mcp/dist/index.js"],
      "env": {
        "NODE_PATH": "/home/dasimoa/one4all/node_modules"
      }
    }
  }
}
```

### 3. Restart Claude Desktop

After updating the configuration, restart Claude Desktop to load the MCP server.

## Available Tools

### Inquiry (2 tools)

#### ask
Ask a direct investment question about a stock ticker.

```typescript
ask(ticker: string, question: string)
```

**Thai Ticker Auto-Suffix:** Thai tickers automatically get `.BK` suffix:
- `CPALL` → `CPALL.BK`
- `DELTA` → `DELTA.BK`
- `ADVANC` → `ADVANC.BK`

**Examples:**
```typescript
// Thai stock
ask(ticker="CPALL", question="What's the fair value?")

// Thai stock with question in Thai
ask(ticker="DELTA", question="ตามมุมมองดาโมดาลัน มีคำถามอะไรบ้าง")

// US stock
ask(ticker="AAPL", question="What are the key risks?")
```

#### list_thai_tickers
List all Thai stock tickers with auto `.BK` suffix.

### Mission Management (9 tools)

- `create_mission` - Create a new analysis mission
- `get_mission_status` - Get mission status and state
- `transition_mission` - Manually transition mission state
- `list_missions` - List all missions
- `mission_run` - Execute mission (fire-and-forget)
- `mission_abort` - Abort running mission
- `mission_replay` - Replay mission with new config
- `get_evidence_pack` - Get evidence pack for a mission
- `get_debate_summary` - Get debate summary for a mission

### Agent Management (7 tools)

- `agent_create` - Create new agent
- `agent_show` - Show agent details
- `agent_edit` - Edit existing agent
- `agent_remove` - Delete agent
- `agent_list` - List all agents
- `agent_import` - Import agents from YAML
- `agent_export` - Export agent configuration

### Domain Management (6 tools)

- `domain_create` - Create new domain
- `domain_show` - Show domain details
- `domain_edit` - Edit domain config
- `domain_remove` - Delete domain
- `domain_list` - List all domains
- `domain_validate` - Validate domain configuration

### Constitution Management (3 tools)

- `constitution_load` - Load constitution for domain
- `constitution_validate` - Validate constitution rules
- `constitution_list` - List available constitutions

### Journal Operations (2 tools)

- `journal_update` - Update journal entry outcome
- `journal_list` - List all journal entries

### Validation (4 tools)

- `validate_agents` - Validate all agents
- `validate_domains` - Validate all domains
- `validate_constitutions` - Validate all constitutions
- `validate_all` - Run all validations

## Troubleshooting

### Server Not Showing Up

1. Check that the MCP server built successfully:
   ```bash
   ls -la /home/dasimoa/one4all/packages/mcp/dist/index.js
   ```

2. Check Claude Desktop logs for errors:
   ```bash
   ~/.config/Claude/logs/
   ```

### Module Not Found Errors

Ensure `NODE_PATH` is set correctly in the configuration to point to the monorepo's `node_modules`.

### Thai Ticker Not Working

Verify the ticker is in the supported list by calling:
```
list_thai_tickers()
```

## Development

To rebuild after changes:

```bash
cd /home/dasimoa/one4all/packages/mcp
npm run build
```

Then restart Claude Desktop.
