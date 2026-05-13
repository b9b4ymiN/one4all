# @one4all/mcp

MCP (Model Context Protocol) server for one4all - exposes all CLI functionality as LLM-accessible tools.

## Overview

This package provides a complete MCP server implementation that allows LLMs to interact with one4all's mission management, agent orchestration, domain configuration, and more through standardized MCP tools and resources.

## Features

- **31 MCP Tools** covering all CLI functionality
- **5 Resource Types** for data access
- **2 Prompt Templates** for common workflows
- Full TypeScript support with strict types
- Modular architecture with separate handler modules

## Installation

```bash
npm install @one4all/mcp
```

## Quick Start

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

// Start the server (stdio transport)
await server.start();
```

## MCP Tools

### Mission Management (6 tools)

| Tool | Description |
|------|-------------|
| `create_mission` | Create a new mission with type, domain, and parameters |
| `get_mission_status` | Get current status and state of a mission |
| `transition_mission` | Manually transition mission to next state |
| `list_missions` | List all missions with optional filtering |
| `get_evidence_pack` | Retrieve evidence pack for a mission |
| `get_debate_summary` | Get debate summary with arguments and consensus |

### Enhanced Mission Tools (3 tools)

| Tool | Description |
|------|-------------|
| `mission_run` | Fire-and-forget mission execution |
| `mission_abort` | Abort a running mission |
| `mission_replay` | Replay a completed mission with same inputs |

### Agent Management (7 tools)

| Tool | Description |
|------|-------------|
| `agent_create` | Create a new agent with configuration |
| `agent_show` | Show detailed agent information |
| `agent_edit` | Edit existing agent properties |
| `agent_remove` | Delete an agent |
| `agent_list` | List all agents (optionally filtered by domain) |
| `agent_import` | Import agents from YAML source files |
| `agent_export` | Export agent configuration as JSON |

### Domain Management (6 tools)

| Tool | Description |
|------|-------------|
| `domain_create` | Create a new domain |
| `domain_show` | Show domain configuration and metadata |
| `domain_edit` | Edit domain properties |
| `domain_remove` | Delete a domain |
| `domain_list` | List all available domains |
| `domain_validate` | Validate domain configuration |

### Constitution Management (3 tools)

| Tool | Description |
|------|-------------|
| `constitution_load` | Load constitution rules for a domain |
| `constitution_validate` | Validate a domain's constitution |
| `constitution_list` | List all available constitutions |

### Journal Management (2 tools)

| Tool | Description |
|------|-------------|
| `journal_update` | Update journal entry with outcome |
| `journal_list` | List all journal entries |

### Validation Tools (4 tools)

| Tool | Description |
|------|-------------|
| `validate_agents` | Validate all agent configurations |
| `validate_domains` | Validate all domain configurations |
| `validate_constitutions` | Validate all constitutions |
| `validate_all` | Validate all configuration types |

## MCP Resources

| URI Pattern | Description |
|-------------|-------------|
| `mission://{mission_id}` | Full mission data and state |
| `report://{mission_id}` | Generated mission report |
| `journal://{ticker}` | Journal entries for ticker |
| `constitution://{domain}` | Domain constitution rules |
| `agents://{domain}` | Agents in a domain |

## MCP Prompts

| Name | Description |
|------|-------------|
| `stock_analysis` | Prompt template for stock analysis missions |
| `debate_question` | Prompt template for debate questions |

## Architecture

```
@one4all/mcp
├── src/
│   ├── server.ts           # Main MCP server
│   ├── modules/
│   │   ├── agent-handler.ts
│   │   ├── domain-handler.ts
│   │   ├── mission-enhanced.ts
│   │   ├── constitution-handler.ts
│   │   ├── journal-handler.ts
│   │   ├── validator.ts
│   │   └── storage/
│   │       ├── agent-storage.ts
│   │       ├── domain-storage.ts
│   │       └── journal-storage.ts
│   └── index.ts
├── tests/
│   ├── inspector/mcp-inspector.test.ts
│   ├── integration.test.ts
│   └── server.test.ts
└── dist/                   # Compiled output
```

## Usage with MCP Inspector

```bash
# Install inspector
npm install -g @modelcontextprotocol/inspector

# Run inspector on one4all MCP server
npx @modelcontextprotocol/inspector node packages/mcp/dist/index.js
```

## Configuration

The `One4AllMCPServer` constructor accepts:

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `name` | string | Yes | Server name |
| `version` | string | Yes | Server version |
| `stateMachine` | MissionStateMachine | Yes | Mission state machine instance |
| `domainsPath` | string | Yes | Path to domains directory |
| `evidenceController` | EvidenceController | Yes | Evidence controller instance |
| `debateController` | DebateController | Yes | Debate controller instance |

## Storage

The MCP server uses runtime storage at:
- **Agents:** `~/.one4all/agents/`
- **Domains:** `~/.one4all/domains/`
- **Journals:** `~/.one4all/journal/`

## Development

```bash
# Build
pnpm --filter @one4all/mcp build

# Test
pnpm --filter @one4all/mcp test

# Typecheck
pnpm --filter @one4all/mcp typecheck
```

## License

MIT
