# Phase 5: Enhanced Debate + Second Domain

> **Status:** Pending
> **Duration:** Week 13-14
> **Goal:** Complete debate protocol and prove multi-domain architecture

## Philosophy

"Prove the architecture works for ANY domain, not just investment."

This phase validates that the kernel is truly domain-agnostic by adding a second domain with completely different agents and workflows.

## Deliverables Part 1: Enhanced Debate

### 1. Full Evidence Request Loop
- Analyst can request specific evidence from researcher
- Researcher responds with findings or data gaps
- Maximum 2 rounds of evidence requests
- Request/response schema validation

### 2. Multi-Round Structured Debate
- Round 1: Initial challenges
- Round 2: Counter-responses
- Round 3: Final resolutions
- Explicit resolution tracking
- Unresolved disagreement preservation

### 3. Disagreement Tracker
- Track all disagreements over time
- Pattern analysis (what agents disagree on)
- Resolution rate statistics
- Historical disagreement lookup

### 4. Dynamic Agent Selection
- Select agents based on mission type
- Optional agent inclusion
- Exclusion rules
- Minimum team requirements

## Deliverables Part 2: Second Domain

### Domain Option A: Research Studio
For academic and business research:

**Purpose:** Literature review, hypothesis testing, research synthesis

**Agents:**
- `literature-reviewer` - Scans papers, extracts key findings
- `hypothesis-tester` - Designs experiments, evaluates evidence
- `statistician` - Statistical analysis, validation
- `methodology-critic` - Reviews methods, identifies flaws
- `synthesis-writer` - Creates research summaries

**Mission Types:**
- `literature_review` - Comprehensive literature review
- `hypothesis_evaluation` - Test a hypothesis with evidence
- `experimental_design` - Design an experiment
- `peer_review` - Review a paper

### Domain Option B: Content Studio
For content creation and marketing:

**Purpose:** Blog posts, marketing copy, educational content

**Agents:**
- `content-strategist` - Plans content structure
- `writer` - Creates content
- `editor` - Reviews and improves
- `seo-specialist` - Optimizes for search
- `fact-checker` - Verifies claims

**Mission Types:**
- `blog_post` - Create blog article
- `landing_page` - Create landing page copy
- `email_campaign` - Create email sequence
- `educational_content` - Create tutorial/guide

### Domain Template Verification

For the second domain:
- [ ] Copy domain template
- [ ] Create domain.yaml
- [ ] Create agent cards
- [ ] Create skill definitions
- [ ] Create mission templates
- [ ] Test with mock adapters
- [ ] Verify NO kernel changes needed

## Multi-Domain Architecture Proof

The key validation: **Kernel remains unchanged**

When adding a second domain:
- [ ] Zero changes to `packages/kernel/`
- [ ] Zero changes to `packages/adapters/`
- [ ] Zero changes to `packages/observability/`
- [ ] Only additions in `domains/{new-domain}/`

## Success Criteria

### Enhanced Debate
- [ ] Evidence request loop works end-to-end
- [ ] Multi-round debate completes properly
- [ ] Disagreement tracker captures all disagreements
- [ ] Resolution patterns emerge over time

### Second Domain
- [ ] Second domain agents defined
- [ ] Second domain missions run successfully
- [ ] Output formats appropriate for domain
- [ ] Zero kernel changes required

### Architecture Validation
- [ ] Domain switching works
- [ ] Agents from different domains don't interfere
- [ ] Shared observability works across domains
- [ ] Journal entries properly domain-tagged

---

## Checklist for Phase 5

### Enhanced Debate
- [ ] Evidence request implementation
- [ ] Multi-round debate refinement
- [ ] Disagreement tracker
- [ ] Pattern analysis
- [ ] Resolution statistics

### Second Domain
- [ ] Choose domain (Research Studio or Content Studio)
- [ ] Create domain structure
- [ ] Define agents
- [ ] Define skills
- [ ] Define mission types
- [ ] Create constitution
- [ ] Test with mocks
- [ ] Test with real adapters

### Validation
- [ ] Verify no kernel changes
- [ ] Test domain switching
- [ ] Test cross-domain queries
- [ ] Verify observability separation
- [ ] Verify journal separation

### Documentation
- [ ] Document second domain
- [ ] Create domain creation guide
- [ ] Document debate enhancements

### Testing
- [ ] Enhanced debate tests
- [ ] Second domain tests
- [ ] Architecture validation tests

### Handoff
- [ ] Document multi-domain behavior
- [ ] Create final summary
