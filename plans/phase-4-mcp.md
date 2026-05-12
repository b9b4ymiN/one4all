# Phase 4: MCP Interface

> **Status:** Pending
> **Duration:** Week 11-12
> **Goal:** Expose one4all as MCP tools for Claude Code integration

## Philosophy

"Claude Code becomes the boardroom terminal — one4all kernel works behind the scenes."

This phase transforms one4all from a CLI tool to an integrated assistant that Claude Code can use as tools.

## MCP Tools to Expose

### 1. Mission Tools
```typescript
// Create a new mission
one4all.create_mission(domain: string, type: string, params: object) -> mission_id

// Run a mission
one4all.run_mission(mission_id: string) -> mission_status

// Get mission status
one4all.get_mission_status(mission_id: string) -> status_detail

// Abort a mission
one4all.abort_mission(mission_id: string) -> success
```

### 2. Agent Tools
```typescript
// Ask a specific agent a question
one4all.ask_agent(agent_id: string, question: string, context?: object) -> response

// List available agents
one4all.list_agents(domain?: string) -> agent_list
```

### 3. Evidence Tools
```typescript
// Get evidence pack for a mission
one4all.get_evidence_pack(mission_id: string) -> evidence_pack

// Get audit trail for evidence
one4all.get_evidence_audit(mission_id: string) -> audit_trail
```

### 4. Analysis Tools
```typescript
// Run committee (all analysts)
one4all.run_committee(mission_id: string) -> synthesis

// Generate MOS table
one4all.generate_mos_table(ticker: string, assumptions: object) -> mos_table

// Compare multiple candidates
one4all.compare_candidates(tickers: string[], criteria: object) -> comparison
```

### 5. Journal Tools
```typescript
// Get journal entries
one4all.get_journal(ticker?: string, domain?: string) -> journal_entries

// Update journal with outcome
one4all.update_journal(journal_id: string, outcome: string) -> success
```

### 6. Observability Tools
```typescript
// Get mission trace
one4all.get_mission_trace(mission_id: string) -> trace_log

// Get agent scorecard
one4all.get_agent_scorecard(agent_id: string) -> scorecard

// Get cost summary
one4all.get_cost_summary(period: string) -> cost_summary
```

## Deliverables

### 1. MCP Server
**Location:** `packages/mcp-server/src/`

Files:
- `server.ts` - Main MCP server
- `tools/` - Tool implementations
- `handlers/` - Request handlers
- `schemas/` - Input/output schemas

### 2. Tool Implementations
Each tool needs:
- Input schema (Zod)
- Output schema (Zod)
- Handler function
- Error handling
- Logging

### 3. Claude Code Integration
**Location:** `.claude/settings.json` or MCP config

```json
{
  "mcpServers": {
    "one4all": {
      "command": "node",
      "args": ["/path/to/packages/mcp-server/dist/index.js"]
    }
  }
}
```

### 4. Documentation
- MCP tool reference
- Integration guide
- Example conversations
- Troubleshooting guide

## Example Conversation

```
User: "Claude, please analyze MCS stock using one4all"

Claude: "I'll use one4all to analyze MCS. Let me create a mission and run it."

[Claude calls one4all.create_mission]
[Claude calls one4all.run_mission]
... (mission runs in background)

Claude: "I've started the analysis. The system is now gathering evidence from official sources..."

[... Claude polls status ...]

Claude: "The evidence gathering is complete. Now the analyst team is working in parallel..."

[... mission completes ...]

Claude: "Analysis complete! Here's the summary:
Decision State: WAIT_FOR_PRICE
Price to Watch: 24.00 THB
Current Price: 31.50 THB
Conservative Fair Value: 28.50 THB

The team found that normalized earnings are approximately 400M THB annualized.
Key thesis breakers: Q2 earnings < 80M, major contract loss, founder selling.

Would you like me to show you the full report or dive into any specific section?"
```

## Success Criteria

- [ ] MCP server starts without errors
- [ ] All 8+ tools exposed and working
- [ ] Claude Code can call tools successfully
- [ ] Tools return properly formatted responses
- [ ] Error handling works gracefully
- [ ] Logging captures all tool calls
- [ ] Example conversations work end-to-end

## Testing Strategy

### Tool Tests
- [ ] Test each tool individually
- [ ] Test with valid inputs
- [ ] Test with invalid inputs
- [ ] Test error handling

### Integration Tests
- [ ] Test with Claude Code
- [ ] Test long-running missions
- [ ] Test concurrent tool calls
- [ ] Test tool call chains

### E2E Tests
- [ ] Full analysis conversation
- [ ] Journal query conversation
- [ ] Compare candidates conversation

---

## Checklist for Phase 4

### MCP Server Setup
- [ ] Initialize MCP server package
- [ ] Set up TypeScript config
- [ ] Install @modelcontextprotocol/sdk
- [ ] Create server entry point

### Tool Implementation
- [ ] create_mission tool
- [ ] run_mission tool
- [ ] get_mission_status tool
- [ ] abort_mission tool
- [ ] ask_agent tool
- [ ] list_agents tool
- [ ] get_evidence_pack tool
- [ ] run_committee tool
- [ ] generate_mos_table tool
- [ ] compare_candidates tool
- [ ] get_journal tool
- [ ] update_journal tool
- [ ] get_mission_trace tool
- [ ] get_agent_scorecard tool
- [ ] get_cost_summary tool

### Integration
- [ ] MCP config for Claude Code
- [ ] Connection testing
- [ ] Authentication if needed

### Documentation
- [ ] Tool reference
- [ ] Integration guide
- [ ] Example conversations
- [ ] Troubleshooting guide

### Testing
- [ ] Unit tests for tools
- [ ] Integration tests with Claude Code
- [ ] E2E conversation tests

### Verification
- [ ] Test with Claude Code
- [ ] Verify all tools work
- [ ] Verify error handling
- [ ] Verify logging

### Handoff
- [ ] Document MCP behavior
- [ ] Create Phase 5 handoff notes
