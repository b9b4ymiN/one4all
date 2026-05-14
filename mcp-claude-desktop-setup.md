# Claude Desktop MCP Server Setup - One4All

## Overview
This document provides a complete setup guide for configuring Claude Desktop to use the one4all MCP server, which exposes 31 tools for mission management, agent orchestration, domain configuration, and more.

## 1. Build Command Output

The MCP server has been successfully built:

```bash
cd /home/dasimoa/one4all/packages/mcp && npm run build
> @one4all/mcp@0.1.0 build
> tsc
```

**Build artifacts created:**
- `/home/dasimoa/one4all/packages/mcp/dist/index.js` - Main server entry point
- `/home/dasimoa/one4all/packages/mcp/dist/server.js` - Server implementation
- Type definitions and source maps

## 2. Configuration File Path and Content

### File Location
- **OS**: Linux
- **Path**: `~/.config/claude-desktop/claude_desktop_config.json`

### Configuration Content
```json
{
  "mcpServers": {
    "one4all": {
      "command": "node",
      "args": ["/home/dasimoa/one4all/packages/mcp/dist/index.js"],
      "env": {}
    }
  }
}
```

### Key Configuration Details
- **Server Name**: `one4all`
- **Command**: `node` (Node.js runtime)
- **Server Script**: `/home/dasimoa/one4all/packages/mcp/dist/index.js`
- **Environment**: Empty (no additional environment variables)

## 3. Available MCP Tools

The one4all MCP server exposes **31 tools** across these categories:

### Mission Management (9 tools)
- `create_mission` - Create new analysis mission
- `get_mission_status` - Check mission state
- `transition_mission` - Manual state transitions
- `list_missions` - List all missions
- `mission_run` - Execute mission (fire-and-forget)
- `mission_abort` - Abort running mission
- `mission_replay` - Replay completed mission
- `get_evidence_pack` - Retrieve evidence pack
- `get_debate_summary` - Get debate summary

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
- `constitution_load` - Load constitution rules
- `constitution_validate` - Validate constitution
- `constitution_list` - List available constitutions

### Journal Operations (2 tools)
- `journal_update` - Update journal entry
- `journal_list` - List all journal entries

### Validation (4 tools)
- `validate_agents` - Validate all agents
- `validate_domains` - Validate all domains
- `validate_constitutions` - Validate all constitutions
- `validate_all` - Run all validations

## 4. Verification Steps

### Step 1: Restart Claude Desktop
- Close Claude Desktop completely if it's running
- Reopen Claude Desktop to load the new configuration
- The MCP server should automatically connect on startup

### Step 2: Verify MCP Tools in Claude
1. In Claude Desktop, you should see the "one4all" MCP server listed
2. The following tools should be available:
   - All 31 tools should appear in the tool list
   - Tools should have proper descriptions and schemas

### Step 3: Test with Example Prompts

#### Test 1: Create a Mission
```markdown
Please create a stock analysis mission for AAPL in the investment-war-room domain.
```

#### Test 2: List All Domains
```markdown
List all available domains using the domain_list tool.
```

#### Test 3: Create an Agent
```markdown
Create a new agent named "Tech-Analyst" for the investment-war-room domain with a focus on technology stocks.
```

#### Test 4: Check MCP Server Status
```markdown
Check if there are any running missions using the list_missions tool.
```

## 5. Troubleshooting Tips

### Common Issues and Solutions

#### Issue 1: MCP Server Not Loading
**Symptoms**: Tools don't appear in Claude
**Solutions**:
- Verify the config file exists at `~/.config/claude-desktop/claude_desktop_config.json`
- Check absolute paths in the configuration
- Ensure Node.js is installed and available in PATH
- Check Claude Desktop logs for error messages

#### Issue 2: Path Errors
**Symptoms**: "File not found" errors
**Solutions**:
- Verify the absolute path to `/home/dasimoa/one4all/packages/mcp/dist/index.js`
- Ensure the dist directory exists and contains the compiled files
- Check file permissions

#### Issue 3: Dependencies Not Found
**Symptoms**: Module import errors
**Solutions**:
- Ensure all npm dependencies are installed: `npm install`
- Rebuild the server: `npm run build`
- Check TypeScript compilation succeeded

#### Issue 4: Server Connection Issues
**Symptoms**: Tools appear but return errors
**Solutions**:
- Test the server directly: `node packages/mcp/dist/index.js`
- Check if the server starts without errors
- Verify kernel dependencies are available

### Debug Commands

```bash
# Test server directly
cd /home/dasimoa/one4all/packages/mcp
node dist/index.js

# Check if config file exists
ls -la ~/.config/claude-desktop/claude_desktop_config.json

# Verify Node.js installation
node --version

# Check package dependencies
npm list --depth=0
```

### Advanced Verification

#### MCP Inspector Test
```bash
# Install MCP inspector (if needed)
npm install -g @modelcontextprotocol/inspector

# Test the server
npx @modelcontextprotocol/inspector node /home/dasimoa/one4all/packages/mcp/dist/index.js
```

## 6. Storage Locations

The MCP server uses these storage locations:
- **Agents**: `~/.one4all/agents/`
- **Domains**: `~/.one4all/domains/`
- **Journals**: `~/.one4all/journal/`

## 7. Next Steps

After successful configuration:
1. Test creating missions through the MCP interface
2. Verify agent functionality works as expected
3. Test domain and constitution management tools
4. Explore evidence and debate features

## 8. Support

For issues or questions:
- Check the MCP documentation in `/packages/mcp/README.md`
- Review server logs in Claude Desktop
- Test individual components using the debug commands above
