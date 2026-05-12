# Debate Protocol

**Version:** 1.0
**Date:** 2026-05-12
**Status:** Approved

---

## 1. Purpose

The Debate Protocol governs how agents disagree, challenge each other, and resolve (or preserve) disagreements. Without structured debate:

- Agents with "louder" personalities dominate
- Disagreements are averaged out (losing valuable signal)
- False consensus emerges
- Owner never sees the full picture

With structured debate:
- Every challenge must cite evidence
- Disagreements are preserved, not hidden
- Evidence tiers determine weight
- Owner sees all perspectives

---

## 2. Round Structure

### 2.1 Maximum Rounds

```
Maximum rounds: 3
```

- If resolved before 3 rounds → close debate, log "resolved in round X"
- If 3 rounds complete and unresolved → close with "unresolved disagreement"
- CIO MUST NOT artificially resolve disagreements

### 2.2 Per Round Format

```
1. Agent A creates challenge message
   - Must cite specific claim from Agent B
   - Must state what is disagreed with
   - Must provide counter-evidence or counter-argument

2. Agent B responds
   - Either: Confirm claim with additional evidence
   - Or: Update/retract claim with explanation

3. Debate Controller records: resolved / partial / unresolved
```

### 2.3 Round Example

```
Round 1:

[From: klarman-downside]
To: damodaran-valuation
Challenge: "Your revenue growth assumption of 15% is too aggressive"
Counter-evidence:
  - Claim: "5-year CAGR was 7.8% (FY2020-2025)"
  - Source: "56-1 Annual Report 2025, page 23"
  - Source Tier: tier_1
  - Label: FACT
Request: "Please justify 15% or revise downward"

[From: damodaran-valuation]
Response: "Revising to 10% based on: (1) historical 7.8%, (2) management guidance 12%"
Status: RESOLVED (agent revised)
```

---

## 3. Challenge Rules

### 3.1 Who Can Challenge Whom

**Agent X can challenge Agent Y if:**
1. Their interaction rules specify `can_question: true`
2. OR disagreement exceeds threshold defined in domain config

**No agent can challenge:**
- Themselves
- The CIO (synthesizer is not challenged in debate rounds)

**Default Interaction Rules:**
```yaml
# Analyst agents can question:
can_question:
  - researcher-set
  - forensic-accountant
  - business-quality-analyst

# Must challenge (if found):
must_challenge:
  - growth_assumptions  # If seeing growth assumption → must challenge
  - margin_expansion    # If seeing margin expansion → must challenge

# Cannot question:
cannot_question:
  - cio-synthesizer
```

### 3.2 Challenge Requirements

Every challenge MUST include:

```typescript
interface ChallengeMessage {
  message_type: "challenge"
  from: string  // Agent ID
  to: string  // Agent ID
  mission_id: string
  round: number

  challenged_claim: string  // Exact claim being challenged
  challenge_reason: string  // Why disagree

  counter_evidence?: {
    claim: string
    source: string
    source_tier: "tier_1" | "tier_2" | "tier_3" | "tier_4" | "tier_5"
    label: "FACT" | "DERIVED" | "ASSUMPTION" | "ESTIMATE"
  }

  request: string  // What is being asked
  requires_response: true
  response_deadline_seconds: number  // Default: 90
}
```

### 3.3 Challenge Validations

A challenge is VALID if:
1. Challenged claim exists in target's output
2. Challenge reason is specific (not "I disagree")
3. Counter-evidence has source tier specified
4. Request is clear and actionable

A challenge is INVALID if:
1. Challenged claim is not found
2. Challenge is on FACT from Tier 1 source (use evidence_request instead)
3. Request is vague

---

## 4. Evidence Weighting

### 4.1 Evidence Tier Hierarchy

```
Tier 1 > Tier 2 > Tier 3 > ASSUMPTION > ESTIMATE
```

**When evidence conflicts:**
- Agent with Tier 1 evidence has higher weight
- Agent with Tier 2 evidence can challenge Tier 3
- Agent with ASSUMPTION cannot challenge FACT (must use evidence_request)

### 4.2 Source Tier Definitions

| Tier | Description | Examples | Label As |
|------|-------------|----------|----------|
| Tier 1 | Official filings, primary sources | 10-K, 10-Q, 56-1, annual reports | FACT |
| Tier 2 | Company communications, verified | Earnings calls, opportunity day | MANAGEMENT_CLAIM |
| Tier 3 | Third-party analysis | Analyst reports, research papers | UNVERIFIED |
| Tier 4 | News and media | Financial news, press releases | UNVERIFIED |
| Tier 5 | Social, rumors | Forums, social media | UNVERIFIED (rumor only) |

### 4.3 Weighting Rules

```
IF Agent A has Tier 1 evidence AND Agent B has Tier 2:
  → Agent A's claim has higher weight
  → Agent B must accept or provide Tier 1 counter-evidence

IF Agent A has Tier 2 evidence AND Agent B has Tier 2:
  → Disagreement is valuable signal
  → DO NOT average out
  → Preserve both perspectives for CIO

IF Agent A has FACT AND Agent B has ASSUMPTION:
  → FACT wins
  → Agent B must revise assumption
```

---

## 5. Resolution Tracking

### 5.1 Resolution States

```typescript
type ResolutionState =
  | "resolved"      // Agent accepted challenge or revised claim
  | "partial"       // Some agreement, some disagreement remains
  | "unresolved"    // No agreement after max rounds
```

### 5.2 Resolution Recording

```typescript
interface DebateRecord {
  mission_id: string
  topic: string
  rounds: number

  participants: {
    challenger: string
    challenged: string
  }

  challenges: Array<{
    round: number
    from: string
    claim: string
    counter_evidence?: any
    response?: string
  }>

  resolution: {
    state: ResolutionState
    final_claim?: string
    preserved_disagreement?: {
      agent_a: string
      agent_b: string
      nature_of_disagreement: string
    }
  }
}
```

### 5.3 Resolution Examples

**Resolved:**
```
Topic: Revenue growth assumption
Rounds: 1
Resolution: RESOLVED
Final claim: "10% growth Y1-Y5 (revised from 15%)"
```

**Unresolved:**
```
Topic: Terminal growth rate
Rounds: 3
Resolution: UNRESOLVED
Preserved disagreement:
  - Agent A (damodaran): 3% terminal growth
  - Agent B (klarman): 2% terminal growth
  - Nature: Damodaran uses GDP+premium, Klarman uses inflation only
```

---

## 6. Disagreement Preservation

### 6.1 Golden Rule

> **DO NOT AVERAGE DISAGREEMENTS**
>
> When agents disagree, present both perspectives to the owner.
> Let the human decide, or let the disagreement lower overall confidence.

### 6.2 Preservation Format

In the final synthesis, disagreements appear as:

```markdown
## Key Disagreements

### Terminal Growth Rate
- **Damodaran View:** 3% terminal growth
  - Reasoning: Long-term GDP growth + premium for business quality
  - Conviction: 6/10
  - Evidence: Historical GDP, industry projections

- **Klarman View:** 2% terminal growth
  - Reasoning: Conservative inflation assumption, no premium
  - Conviction: 8/10
  - Evidence: Risk-free rate, historical market returns

**Impact on Valuation:**
- At 3% terminal growth: Fair value = 34.20 THB
- At 2% terminal growth: Fair value = 28.50 THB

**Our Position:** We use 2.5% (midpoint) with reduced confidence.
```

---

## 7. Evidence Request Loop

### 7.1 Purpose

When an agent needs additional information during analysis:
- NOT a challenge (agent is not disagreeing)
- Agent needs data to complete analysis

### 7.2 Evidence Request Format

```typescript
interface EvidenceRequest {
  message_type: "evidence_request"
  from: string  // Agent needing info
  to: "researcher-set"  // Always goes to researcher
  mission_id: string

  request: string  // What information is needed
  reason: string  // Why it's needed
  required_tier: "tier_1" | "tier_2" | "tier_3"  // Minimum tier
}
```

### 7.3 Evidence Response Format

```typescript
interface EvidenceResponse {
  message_type: "evidence_response"
  from: "researcher-set"
  to: string  // Requesting agent
  mission_id: string

  found: boolean

  evidence?: Array<{
    claim: string
    source_name: string
    source_tier: string
    section: string
    confidence: "high" | "medium" | "low"
    label: "FACT" | "MANAGEMENT_CLAIM" | "UNVERIFIED"
  }>

  data_gaps?: Array<{
    requested: string
    not_found_in: string[]
    impact: string
    suggested_alternative?: string
  }>

  evidence_pack_updated: boolean
}
```

### 7.4 Evidence Request Example

```
[From: damodaran-valuation]
To: researcher-set
Request: "Capex for 2022-2025 and depreciation schedule"
Reason: "Need to calculate reinvestment rate for DCF"
Required Tier: tier_1

[From: researcher-set]
Response:
  Found: true
  Evidence:
    - Claim: "Capex 2022-2025 averaged 85M THB/year"
      Source: "56-1 One Report 2025, Note 12"
      Tier: tier_1
      Label: FACT
  Data Gaps:
    - Requested: "Capex plan for 2026-2028"
      Not Found In: ["56-1", "quarterly-filing", "opportunity-day"]
      Impact: "Cannot verify future reinvestment rate"
      Suggested Alternative: "Use management guidance as MANAGEMENT_CLAIM"
```

### 7.5 Evidence Request Limits

```
Maximum evidence request rounds: 2
```

This prevents infinite loops. If not found after 2 rounds:
- Log as data gap
- Suggest alternative
- Proceed with flagged assumption

---

## 8. Debate Controller Behavior

### 8.1 Initialization

```typescript
function startDebate(mission: Mission, analystOutputs: AnalystOutput[]): DebateState {
  return {
    mission_id: mission.id,
    round: 0,
    max_rounds: 3,
    topics: identifyDisagreements(analystOutputs),
    status: "active"
  }
}
```

### 8.2 Round Execution

```typescript
function executeRound(state: DebateState): DebateState {
  state.round += 1

  for (const topic of state.topics) {
    if (topic.resolved) continue

    // Get challenge from challenger
    const challenge = await getChallenge(topic.challenger, topic.challenged, topic)

    // Get response from challenged
    const response = await getResponse(topic.challenged, challenge)

    // Determine resolution
    topic.resolution = determineResolution(challenge, response)

    // Log
    logDebateInteraction({
      round: state.round,
      topic:.topic,
      challenge,
      response,
      resolution: topic.resolution
    })
  }

  // Check if all resolved or max rounds reached
  if (allResolved(state.topics) || state.round >= state.max_rounds) {
    state.status = "complete"
  }

  return state
}
```

### 8.3 Completion

```typescript
function finalizeDebate(state: DebateState): DebateResult {
  return {
    mission_id: state.mission_id,
    rounds_completed: state.round,
    topics: state.topics.map(t => ({
      topic: t.topic,
      resolution: t.resolution,
      final_claim: t.resolved ? t.final_claim : null,
      preserved_disagreement: !t.resolved ? {
        agent_a: t.challenger,
        agent_b: t.challenged,
        nature: t.description
      } : null
    })),
    summary: {
      total_topics: state.topics.length,
      resolved: state.topics.filter(t => t.resolved).length,
      unresolved: state.topics.filter(t => !t.resolved).length
    }
  }
}
```

---

## 9. Integration with CIO Synthesis

The CIO receives the Debate Result and uses it to:

1. **Lower confidence** when disagreements exist
2. **Present both views** in the final report
3. **Highlight disagreements** in the summary
4. **Never artificially resolve** — preserve the signal

```typescript
interface CIOInput {
  analyst_outputs: AnalystOutput[]
  debate_result: DebateResult
  unresolved_disagreements: PreservedDisagreement[]
}
```
