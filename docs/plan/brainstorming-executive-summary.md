# Brainstorming System - Executive Summary for Team Review

**Date:** 2026-05-14
**Plan Version:** 3.0
**Status:** Ready for Implementation

---

## What Are We Building?

A **conversational question-answering system** for one4all that enables "One Man Company" thinking - allowing individual investors to ask questions from multiple analyst perspectives and receive synthesized insights.

### User's Core Request
> "ตามมุมมองดาโมดาลัน มีคำถามอะไรเพื่อเคลียร์ความกังวลไหม"
>
> Translation: "From Damodaran's perspective, what questions would he ask to clear up concerns?"
>
> → Have other agents summarize and respond

---

## Why This Matters

**Current State:**
- Users must run full investment-war-room mission for simple questions
- Takes 5-10 minutes, costs $0.50-1.00 in API calls
- Overkill for "quick sanity check" questions

**Proposed Solution:**
- Lightweight conversational interface
- Takes 2-3 minutes, costs $0.05-0.10
- Perfect for: "What would Klarman ask about this stock?"

---

## Technical Approach

### Architecture: MCP-First with CLI Fallback

1. **Primary:** Claude Desktop MCP tools (most professional UX)
2. **Secondary:** CLI commands for power users
3. **Shared Utilities:** Extract common code to reduce duplication

### Key Components

| Component | File | Purpose |
|-----------|------|---------|
| Core Logic | `brainstorm.ts` | Question parsing, analyst queries, synthesis |
| Shared Utils | `analyst-utils.ts` | Common functions (reduces 90% duplication to 30%) |
| MCP Handler | `brainstorm-handler.ts` | Claude Desktop integration |
| Cache | `market-data-cache.ts` | 5-min TTL, reduces redundant API calls |

---

## Critical Issues & Solutions

### Issues Found During Review

| Issue | Severity | Solution |
|-------|----------|----------|
| Missing `fetchStockData` export | 🔴 Blocker | Add export to adapters package |
| Wrong persona path resolution | 🔴 Blocker | Use `__dirname` with `join()` |
| No Thai examples in prompts | 🔴 Blocker | Add Thai language instructions |
| Expensive synthesis model | 🔴 Blocker | Use Haiku explicitly |
| 90% code duplication | ⚠️ Technical | Extract shared utilities |
| Vague acceptance criteria | ⚠️ Testing | Use Given/When/Then format |

### All Issues Addressed in v3.0 ✅

---

## Implementation Timeline

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| Fix Adapters | 0.5 day | `fetchStockData` export |
| Core Logic | 1 day | `brainstorm.ts` with all fixes |
| Cache | 0.5 day | `market-data-cache.ts` |
| MCP Tools | 1 day | `brainstorm-handler.ts` |
| Shared Utils | 0.5 day | `analyst-utils.ts` |
| CLI Commands | 0.5 day | CLI integration |
| Testing | 1 day | Full test suite |
| Documentation | 0.5 day | User guide |

**Total:** 3-4 days

---

## Testing Strategy

### Unit Tests
- Input validation (ticker format, question length)
- Thai/English question parsing
- Cache functionality
- Empty response handling

### Integration Tests
- Full brainstorming flow
- MCP tool execution
- CLI command execution

### E2E Tests
- Thai language questions (DELTA.BK, PTT.BK)
- Performance benchmarks (<3 min for 5 analysts)
- Graceful failure handling

---

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| Response Time | <3 minutes | Performance tests |
| Thai Support | 100% | Thai language E2E tests |
| Reliability | Works with 40% failure | Error injection tests |
| Code Duplication | <30% | Code analysis after Phase 5 |
| Cost per Session | ~$0.05-0.10 | Token counting |

---

## Cost Comparison

| Feature | Time | Cost | Use Case |
|---------|------|------|----------|
| Brainstorming | 2-3 min | $0.05-0.10 | Quick questions |
| Full IWR Mission | 5-10 min | $0.50-1.00 | Comprehensive analysis |

**ROI:** 10x faster, 10x cheaper for focused questions

---

## Examples

### Thai Language Support
```bash
# User asks in Thai
"ตามมุมมองดาโมดาลัน มีคำถามอะไรบ้าง"

# System detects: damodaran-valuation
# Queries 5 analysts
# Returns: Synthesis in Thai/English
```

### English Language Support
```bash
# User asks in English
"What would Seth Klarman ask about downside risk?"

# System detects: klarman-downside
# Queries 5 analysts
# Returns: Synthesis with risk perspective
```

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| LLM doesn't follow JSON | Regex fallback |
| Market data fetch fails | 5-min cache |
| Thai language issues | Explicit Thai prompts + tests |
| Empty analyst responses | Filter <20 chars before synthesis |
| High API costs | Use Haiku for synthesis |

---

## Next Steps

1. **Review this plan** with team
2. **Approve for implementation**
3. **Execute phases 1-8** (3-4 days)
4. **Test thoroughly** (unit, integration, E2E)
5. **Deploy to production**

---

## Questions for Team

1. **Timeline:** 3-4 days acceptable?
2. **Cost:** $0.05-0.10 per session within budget?
3. **Thai Support:** Priority high enough for extensive testing?
4. **Code Duplication:** Agree with extracting shared utilities?
5. **Future Phases:** Multi-turn conversations (Phase 8) needed soon?

---

**Contact:** For questions, see full plan at `.omc/plans/brainstorming-system/plan.md`

**Version:** 3.0 | **Last Updated:** 2026-05-14
