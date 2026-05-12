# Phase 2: Adapter Layer + CLI Interface

> **Status:** Pending
> **Duration:** Week 5-6
> **Goal:** Connect to real AI backends and provide CLI interface

## Philosophy

"Now that the kernel works with mocks, connect to real intelligence."

This phase brings the system to life by connecting to actual LLMs while maintaining all the safety and validation from Phase 1.

## Deliverables

### 1. Real Adapters
**Location:** `packages/adapters/src/`

#### Claude Adapter
- Anthropic API integration
- Message API support
- Streaming support (optional)
- Token counting
- Cost tracking
- Error handling with retry logic

#### Gemini Adapter
- Gemini CLI integration
- Long context support (1M tokens)
- Document processing
- Error handling

#### ZAI Adapter
- OpenAI-compatible API
- Cost-effective parallel reasoning
- Error handling

#### Codex Adapter
- Codex CLI integration
- Code generation tasks
- Validation building

#### Python Quant Adapter
- subprocess or FastAPI wrapper
- DCF calculations
- Reverse DCF
- MOS table generation
- Sensitivity analysis

#### Human Adapter
- Console-based input
- Gate waiting logic
- Input validation

### 2. Fallback Chain
**Location:** `packages/adapters/src/fallback-manager.ts`

```typescript
interface FallbackConfig {
  agentId: string;
  primary: AdapterConfig;
  fallbacks: AdapterConfig[];
}

// Example for damodaran-valuation:
// Primary: Claude Opus
// Fallback 1: ZAI
// Fallback 2: Gemini 2 Flash
```

Features:
- Automatic fallback on failure
- Fallback logging
- Configurable per agent
- Health-aware routing

### 3. Health Monitor
**Location:** `packages/observability/src/health-monitor.ts`

Pre-session checks:
- [ ] Claude API auth and connectivity
- [ ] Gemini CLI availability
- [ ] ZAI API auth and connectivity
- [ ] Codex CLI availability
- [ ] Python environment

Output example:
```
✓ gemini-cli:  online (v2.1.0) | latency: 234ms
✓ claude-api:  online | latency: 412ms | auth: valid
✓ zai-api:     online | latency: 189ms | auth: valid
✗ codex-cli:   OFFLINE — session expired, re-login required
✓ python-quant: online
```

### 4. CLI Interface
**Location:** `packages/cli/src/`

#### Commands

**Mission Commands:**
```bash
oneman mission create --domain investment-war-room --type stock_analysis --ticker MCS
oneman mission run --id MCS-valuation-20260511-001
oneman mission status --id MCS-valuation-20260511-001
oneman mission abort --id MCS-valuation-20260511-001
oneman mission replay --id MCS-valuation-20260511-001 [--assumption growth=8%]
oneman mission list [--domain investment-war-room] [--state DECIDED]
```

**Agent Commands:**
```bash
oneman agent ask --agent damodaran-valuation "วิเคราะห์ MCS DCF ให้หน่อย"
oneman agent list [--domain investment-war-room]
oneman agent test --id damodaran-valuation --fixture test/fixtures/damodaran-test.json
```

**Team Commands:**
```bash
oneman team status              # Show health of all backends
oneman team list                # Show all teams
```

**Journal Commands:**
```bash
oneman journal view --ticker MCS
oneman journal update --id MCS-journal-20260511 --outcome "earnings Q2 confirmed"
oneman journal list [--state open] [--domain investment-war-room]
```

**Observability Commands:**
```bash
oneman log show --mission MCS-valuation-20260511-001
oneman log show --agent damodaran-valuation --last 10
oneman audit trail --mission MCS-valuation-20260511-001
oneman scorecard --agent damodaran-valuation
oneman cost --period 2026-05
```

**Domain Commands:**
```bash
oneman domain list
oneman domain create --id research-studio
oneman domain switch --id investment-war-room
```

### 5. Python Quant Module
**Location:** `apps/quant/src/`

Files:
- `dcf.py` - Discounted Cash Flow calculation
- `reverse_dcf.py` - Reverse DCF (implied growth)
- `mos_table.py` - Margin of Safety table
- `sensitivity.py` - Sensitivity analysis
- `normalizer.py` - Normalized earnings calculator

Each with:
- Pydantic input/output schemas
- Type annotations
- Unit tests
- CLI interface

## API Integration Details

### Claude API
```typescript
// Environment variables
ANTHROPIC_API_KEY
CLAUDE_MODEL (default: claude-opus-4-5)

// Call format
messages API with max_tokens, temperature
```

### Gemini CLI
```bash
# Integration via child_process
gemini "prompt" --model gemini-2-flash --format json
```

### ZAI API
```typescript
// Environment variables
ZAI_API_KEY
ZAI_BASE_URL
ZAI_MODEL (default: zai-default)

// OpenAI-compatible format
POST /chat/completions
```

## Success Criteria

- [ ] Single adapter runs correctly against real model
- [ ] Fallback activates when primary backend fails
- [ ] CLI functional through Claude Code
- [ ] All calls logged with full context
- [ ] Health check detects offline backends
- [ ] Python quant module produces correct calculations
- [ ] All adapter tests pass with real APIs

## Testing Strategy

### Adapter Tests
- [ ] Test each adapter with minimal real call
- [ ] Test fallback chain with simulated failures
- [ ] Test error handling and retry logic
- [ ] Test token counting accuracy
- [ ] Test cost calculation

### CLI Tests
- [ ] Test each command with valid inputs
- [ ] Test error messages for invalid inputs
- [ ] Test help text displays
- [ ] Test command completion

### Integration Tests
- [ ] Run test mission with real adapters
- [ ] Verify observability data captured
- [ ] Verify journal entry created
- [ ] Verify cost tracking works

---

## Checklist for Phase 2

### Adapter Implementation
- [ ] Claude Adapter implementation
- [ ] Gemini Adapter implementation
- [ ] ZAI Adapter implementation
- [ ] Codex Adapter implementation
- [ ] Python Quant Adapter implementation
- [ ] Human Adapter implementation
- [ ] Mock Adapter for testing

### Fallback System
- [ ] Fallback manager implementation
- [ ] Per-agent fallback configuration
- [ ] Fallback logging
- [ ] Health-aware routing

### Health Monitoring
- [ ] Health check for Claude
- [ ] Health check for Gemini
- [ ] Health check for ZAI
- [ ] Health check for Codex
- [ ] Health check for Python
- [ ] Health status CLI command

### CLI Development
- [ ] Mission commands
- [ ] Agent commands
- [ ] Team commands
- [ ] Journal commands
- [ ] Observability commands
- [ ] Domain commands
- [ ] Help system

### Python Quant
- [ ] DCF implementation
- [ ] Reverse DCF implementation
- [ ] MOS table implementation
- [ ] Sensitivity analysis implementation
- [ ] Normalizer implementation
- [ ] CLI interface
- [ ] Unit tests

### Testing
- [ ] Adapter tests
- [ ] CLI tests
- [ ] Integration tests with real APIs
- [ ] End-to-end test mission

### Verification
- [ ] Run full mission with real adapters
- [ ] Verify all logging works
- [ ] Verify cost tracking
- [ ] Verify journal creation
- [ ] Verify observability data

### Handoff
- [ ] Document adapter behavior
- [ ] Create Phase 3 handoff notes
- [ ] Prepare agent development guide
