# one4all 2.0 - Free-Form Inquiry System

**Project Code:** Inquiry System
**Version:** 2.0
**Status:** DRAFT - Ready for Implementation
**Created:** 2024-05-15

---

## Executive Summary

Transform one4all from a single-mode pipeline (full stock_analysis) into a flexible **question-answering system** where users can ask natural language questions and the system automatically routes to appropriate agents.

**Before:** Users run full pipeline `one4all mission run --ticker AAPL`
**After:** Users ask questions `"คำนวณตาม Damodaran ปีนี้ CPALL ควรเท่าไร"` and get targeted answers

---

## Problem Statement

### Current Limitation

one4all v1.0 works great (~80% of MVP complete) but only supports **one interaction pattern**:

```
User: "Analyze AAPL"
System: [runs full pipeline] DRAFT → PLANNING → RESEARCHING → ANALYZING → CROSS_QA → DEBATING → SYNTHESIZING → DECIDED → JOURNALED
Time: 10-15 minutes
Cost: $0.50-1.00 in API calls
```

**Users cannot:**
- Ask quick questions to specific analysts
- Get targeted insights without running full pipeline
- Have conversational back-and-forth
- Ask in Thai and get Thai responses

---

## Solution: one4all 2.0 Inquiry System

### Core Concept

**Transform CIO from "synthesizer at the end" to "Router/Orchestrator at the beginning"**

```
User Question (Thai/English)
    ↓
[CIO Router] Analyzes question → Determines pattern → Selects agents
    ↓
4 Execution Patterns:
    ├─ SINGLE AGENT: "What does Damodaran say about CPALL?"
    ├─ DEBATE: "Damodaran says no growth, what does Seth think?"
    ├─ RESEARCH + WRITE: "Explain CPALL's revenue structure"
    └─ DELIVERABLE: "Prepare full investment memo for CPALL"
    ↓
[INQUIRY SYNTHESIS] Combine answers into user-friendly format
    ↓
Done (in 2-10 minutes, depending on pattern)
```

### New Mission Type: `inquiry`

Not replacing `stock_analysis` - **adding alongside**:

| Mission Type | Use Case | Time | Cost |
|--------------|----------|------|------|
| `stock_analysis` | Full investment analysis | 10-15 min | $0.50-1.00 |
| `inquiry` | Quick targeted questions | 2-10 min | $0.05-0.20 |

---

## Architecture Overview

### New State Flow (Inquiry Mission)

```
DRAFT → ROUTING → EXECUTING_INQUIRY → INQUIRY_SYNTHESIZING → INQUIRY_DONE
```

| State | Purpose | Handler |
|-------|---------|---------|
| ROUTING | CIO analyzes question, selects agents | `routing-handler.ts` |
| EXECUTING_INQUIRY | Run selected agents in parallel | `executing-inquiry-handler.ts` |
| INQUIRY_SYNTHESIZING | Format answers for user | `inquiry-synthesizing-handler.ts` |
| INQUIRY_DONE | Final output (not journaled) | Terminal state |

### Agent Registry Enhancement

Every agent YAML gets `routing_metadata`:

```yaml
# damodaran-valuation.yaml (enhanced)
routing_metadata:
  expertise:
    - "DCF valuation"
    - "Intrinsic value calculation"
    - "Reverse DCF (market expectations)"
  when_to_use:
    - "User asks for fair value or intrinsic value"
    - "User mentions 'Damodaran' or valuation methods"
    - "Question includes 'คำนวณ', 'มูลค่า', 'DCF'"
  output_type:
    - "numerical_estimate"  # fair_value in dollars
    - "conviction_level"
    - "key_assumptions"
  can_debate_with:
    - "klarman-downside"
    - "devil-advocate"
  example_questions:
    - "คำนวณตาม Damodaran ปีนี้ CPALL ควรเท่าไร"
    - "What is AAPL's intrinsic value?"
```

---

## Implementation Plan (4 Phases)

### Phase 0: Fix Pre-requisites (1 day)

**Why:** Inquiry System will reuse analyst/reading/synthesis code. Fix bugs now or they propagate.

#### Bug #1: Portfolio-Allocator $5 Bug

**Problem:** `position_size` (%) gets parsed as `fair_value` ($)

**Location:** `packages/cli/src/lib/state-handlers/analyzing-handler.ts`

```typescript
// Current (WRONG):
function parseAnalystOutput(agentId, content) {
  const data = JSON.parse(content);
  return {
    fair_value: data.fair_value || data.position_size, // BUG: 5% becomes $5
    ...
  };
}

// Fixed:
function parseAnalystOutput(agentId, content) {
  const data = JSON.parse(content);
  
  if (agentId === 'portfolio-allocator') {
    return {
      position_size: data.position_size,
      fair_value: undefined, // Never provide fair_value
      ...
    };
  }
  
  return {
    fair_value: data.fair_value,
    ...
  };
}
```

**Acceptance:** Run `stock_analysis` for AAPL → portfolio-allocator outputs `position_size` (1-15%), `fair_value` = undefined

---

#### Bug #2: CIO Hardcoded Price Reference

**Problem:** CIO prompt says "Use current price ~180 for AAPL, 100 otherwise"

**Location:** `packages/cli/src/lib/state-handlers/synthesizing-handler.ts:154`

```typescript
// Current (WRONG):
Be decisive. Use current price ~${ticker === 'AAPL' ? '180' : '100'} as reference if not provided.

// Fixed:
const currentPrice = evidence?.current_price || 'UNAVAILABLE';
Be decisive. Use current price ~${currentPrice} as reference.
```

**Acceptance:** Run `stock_analysis` for CPALL.BK → CIO output references CPALL's actual price

---

#### Bug #3: Thai Ticker Suffix Not Auto-Handled

**Problem:** User asks "CPALL" → Yahoo Finance fetch fails (needs "CPALL.BK")

**Location:** `packages/adapters/src/stock-price.ts` (or wherever `fetchStockData` lives)

```typescript
// Fix: Auto-append .BK for Thai tickers
async function fetchStockData(ticker: string): Promise<MarketData> {
  // Thai market detection
  const knownThaiTickers = ['CPALL', 'PTT', 'PTTEP', 'DELTA', 'SISB', 'KBANK', 'SCB', 'AOT'];
  
  let fetchTicker = ticker;
  if (knownThaiTickers.includes(ticker) && !ticker.endsWith('.BK')) {
    fetchTicker = `${ticker}.BK`;
    console.log(`[STOCK-PRICE] Auto-appending .BK for Thai ticker: ${fetchTicker}`);
  }
  
  // Fetch from Yahoo Finance
  return await yahooFinance(fetchTicker);
}
```

**Acceptance:** `fetchStockData('CPALL')` returns CPALL.BK data

---

**Phase 0 Deliverable:**
- [ ] AAPL stock_analysis passes end-to-end
- [ ] CPALL.BK stock_analysis passes end-to-end
- [ ] portfolio-allocator outputs correct position_size (not fair_value)
- [ ] CIO uses actual market prices

---

### Phase 1: Agent Registry Metadata (1-2 days)

#### 1.1 Add routing_metadata to All 12 Agents

**Template:**

```yaml
# {agent-name}.yaml
routing_metadata:
  expertise: [array of expertise areas]
  when_to_use: [array of trigger patterns]
  output_type: [array of output formats]
  can_debate_with: [array of agent IDs]
  example_questions: [array of example Thai + English questions]
```

**Agents to update:**
1. `damodaran-valuation.yaml`
2. `klarman-downside.yaml`
3. `devil-advocate.yaml`
4. `portfolio-manager.yaml` (note: output is position_size %)
5. `consensus-analyst.yaml`
6. `downside-protection.yaml`
7. `greenwald-evasion.yaml`
8. `kessler-moat.yaml`
9. `klamran-quality.yaml`
10. `michael-burry.yaml`
11. `allocator-steward.yaml`
12. `leveraged-franchise.yaml`

**Example (Thai support):**

```yaml
# klarman-downside.yaml
routing_metadata:
  expertise:
    - "Margin of safety analysis"
    - "Downside risk assessment"
    - "Permanent loss risk"
  when_to_use:
    - "User asks about downside, risk, or loss"
    - "User mentions 'Klarman', 'risk', 'dangerous'"
    - "Thai: ความเสี่ยง, อันตราย, หนี้สิน"
  output_type:
    - "risk_assessment"
    - "conservative_fair_value"  # lower than damodaran
  can_debate_with:
    - "damodaran-valuation"
    - "leveraged-franchise"
  example_questions:
    - "Klarman มองหนี้สิน CPALL ยังไง"
    - "What is the downside risk for AAPL?"
    - "ควรระวังอะไรบ้าง ถือครอง"
```

---

#### 1.2 Create New CIO Router Persona

**File:** `domains/investment-war-room/personas/cio-router.md`

```markdown
# CIO Router - Intelligent Query Orchestrator

You are the CIO Router, responsible for understanding user questions
and determining which analysts should answer.

## Your Responsibilities

1. **Understand the Question**: Identify core intent
2. **Detect Pattern**: single / debate / research / deliverable
3. **Select Agents**: Choose appropriate analysts
4. **Estimate Confidence**: 0-1 score, add devil-advocate if < 0.5

## Language Support

You handle both Thai and English questions seamlessly. Respond in the
same language as the question.

## Routing Logic

For each question, output JSON:
{
  "pattern": "single|debate|research_write|deliverable",
  "agents": ["agent-id-1", "agent-id-2"],
  "reasoning": "Why these agents",
  "confidence": 0.8,
  "fallback_agent": "devil-advocate"  // if confidence < 0.5
}
```

---

#### 1.3 Create Registry Reader Module

**File:** `packages/kernel/src/registry/agent-registry.ts`

```typescript
/**
 * Agent Registry Reader
 * 
 * Loads agent metadata from YAML files for CIO Router
 */

export interface AgentRoutingMetadata {
  agent_id: string;
  name: string;
  expertise: string[];
  when_to_use: string[];
  output_type: string[];
  can_debate_with: string[];
  example_questions: string[];
}

export class AgentRegistry {
  private agents: Map<string, AgentRoutingMetadata> = new Map();
  
  /**
   * Load all agents from domain
   */
  async loadDomain(domainPath: string): Promise<void> {
    const agentFiles = await glob(`${domainPath}/agents/*.yaml`);
    
    for (const file of agentFiles) {
      const yaml = await readFile(file, 'utf-8');
      const agent = load(yaml) as any;
      
      if (agent.routing_metadata) {
        this.agents.set(agent.id, {
          agent_id: agent.id,
          name: agent.name,
          ...agent.routing_metadata
        });
      }
    }
  }
  
  /**
   * Find agents by expertise/pattern
   */
  findAgents(query: string): AgentRoutingMetadata[] {
    const results: AgentRoutingMetadata[] = [];
    
    for (const agent of this.agents.values()) {
      // Check if query matches expertise or when_to_use
      const matches = 
        this.matchesExpertise(query, agent) ||
        this.matchesWhenToUse(query, agent);
      
      if (matches) {
        results.push(agent);
      }
    }
    
    return results;
  }
  
  /**
   * Get all agents (for CIO to choose from)
   */
  getAllAgents(): AgentRoutingMetadata[] {
    return Array.from(this.agents.values());
  }
  
  /**
   * Get debate partners for an agent
   */
  getDebate Partners(agentId: string): AgentRoutingMetadata[] {
    const agent = this.agents.get(agentId);
    if (!agent?.can_debate_with) return [];
    
    return agent.can_debate_with
      .map(id => this.agents.get(id))
      .filter((a): a is AgentRoutingMetadata => a !== undefined);
  }
}
```

---

**Phase 1 Deliverable:**
- [ ] All 12 agent YAMLs have routing_metadata
- [ ] 6 persona markdown files exist (including new cio-router.md)
- [ ] Registry Reader can load and query agent metadata
- [ ] Unit tests for Registry.findAgents() with Thai/English queries

---

### Phase 2: CIO Router Core (2-3 days)

#### 2.1 Add New Mission Type and States

**File:** `packages/kernel/src/state-machine/types.ts`

```typescript
// Add to MissionState enum:
export enum MissionState {
  // ... existing states ...
  ROUTING = "ROUTING",
  EXECUTING_INQUIRY = "EXECUTING_INQUIRY",
  INQUIRY_SYNTHESIZING = "INQUIRY_SYNTHESIZING",
  INQUIRY_DONE = "INQUIRY_DONE",
}

// Add to Brief type:
export interface Brief {
  type: "stock_analysis" | "portfolio_review" | "quick_screen" | "inquiry";  // ADD "inquiry"
  domain: string;
  description: string;
  ticker?: string;
  question?: string;  // ADD for inquiry type
}
```

---

#### 2.2 Create Routing Handler

**File:** `packages/cli/src/lib/state-handlers/routing-handler.ts`

```typescript
/**
 * ROUTING State Handler
 * 
 * CIO Router analyzes question and determines execution plan
 */

import { Mission, MissionState } from '@one4all/kernel';
import { createUnifiedAdapter } from '../adapter-factory.js';
import { AgentRegistry } from '@one4all/kernel';
import { readFileSync } from 'fs';
import { load } from 'yaml';

export interface RoutingPlan {
  pattern: 'single' | 'debate' | 'research_write' | 'deliverable';
  agents: string[];
  reasoning: string;
  confidence: number;
  fallback_agent?: string;
}

export async function handleRoutingState(
  mission: Mission
): Promise<MissionState> {
  const question = mission.state.brief?.question || '';
  const ticker = mission.state.brief?.ticker || 'UNKNOWN';
  
  console.log(`  [ROUTING] Analyzing question: "${question}"`);
  
  // Load agent registry
  const registry = new AgentRegistry();
  await registry.loadDomain('./domains/investment-war-room');
  
  // Build CIO Router prompt
  const routerPrompt = buildRouterPrompt(question, ticker, registry);
  
  // Get routing decision
  const adapter = createUnifiedAdapter('anthropic');
  const result = await adapter.run(routerPrompt, { timeout: 60000 });
  
  if (!result.success) {
    console.log(`  [ROUTING] Error: ${result.error}`);
    // Fallback: use devil-advocate
    mission.state.routing_plan = createFallbackPlan(question);
    return MissionState.EXECUTING_INQUIRY;
  }
  
  // Parse routing plan
  const routingPlan = parseRoutingPlan(result.content);
  
  console.log(`  [ROUTING] Pattern: ${routingPlan.pattern}`);
  console.log(`  [ROUTING] Agents: ${routingPlan.agents.join(', ')}`);
  console.log(`  [ROUTING] Confidence: ${routingPlan.confidence}`);
  
  // Store routing plan in mission state
  mission.state.routing_plan = routingPlan;
  
  // Add fallback if low confidence
  if (routingPlan.confidence < 0.5 && !routingPlan.fallback_agent) {
    routingPlan.agents.push('devil-advocate');
    console.log(`  [ROUTING] Low confidence, added devil-advocate`);
  }
  
  return MissionState.EXECUTING_INQUIRY;
}

function buildRouterPrompt(
  question: string,
  ticker: string,
  registry: AgentRegistry
): string {
  const allAgents = registry.getAllAgents();
  
  const agentsList = allAgents.map(a => 
    `- ${a.agent_id}: ${a.name}\n  Expertise: ${a.expertise.join(', ')}\n  When to use: ${a.when_to_use.join(', ')}`
  ).join('\n\n');
  
  return `You are the CIO Router. Analyze this question and determine which analysts should answer.

## Question
"${question}"

## Ticker
${ticker}

## Available Agents
${agentsList}

## Your Task

Output JSON:
{
  "pattern": "single|debate|research_write|deliverable",
  "agents": ["agent-id-1", "agent-id-2"],
  "reasoning": "Brief explanation",
  "confidence": 0.0-1.0
}

## Pattern Definitions

- **single**: One analyst can answer (e.g., "What does Damodaran say?")
- **debate**: Two analysts have conflicting views (e.g., "Damodaran vs Klarman")
- **research_write**: Need information synthesis (e.g., "Explain revenue structure")
- **deliverable**: Full analysis needed (use all analysts)

Be precise. Select 1-4 agents max. Confidence < 0.5 means uncertain - add devil-advocate.`;
}

function parseRoutingPlan(content: string): RoutingPlan {
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    const data = JSON.parse(jsonMatch[0]);
    return {
      pattern: data.pattern || 'single',
      agents: data.agents || ['devil-advocate'],
      reasoning: data.reasoning || '',
      confidence: data.confidence || 0.5,
    };
  }
  
  // Fallback
  return {
    pattern: 'single',
    agents: ['devil-advocate'],
    reasoning: 'Failed to parse routing decision',
    confidence: 0.3,
  };
}

function createFallbackPlan(question: string): RoutingPlan {
  return {
    pattern: 'single',
    agents: ['devil-advocate'],
    reasoning: 'Routing failed, using devil-advocate as fallback',
    confidence: 0.2,
  };
}
```

---

#### 2.3 Create Executing Inquiry Handler

**File:** `packages/cli/src/lib/state-handlers/executing-inquiry-handler.ts`

```typescript
/**
 * EXECUTING_INQUIRY State Handler
 * 
 * Execute selected agents based on routing plan
 */

import { Mission, MissionState } from '@one4all/kernel';
import { createUnifiedAdapter } from '../adapter-factory.js';
import { getAdapterForAgent } from '../agent-adapter-mapping.js';
import { loadPersonaForAgent } from '../lib/brainstorm.js';  // reuse from brainstorm

export async function handleExecutingInquiryState(
  mission: Mission
): Promise<MissionState> {
  const routingPlan = mission.state.routing_plan;
  const question = mission.state.brief?.question || '';
  const ticker = mission.state.brief?.ticker || 'UNKNOWN';
  
  if (!routingPlan) {
    console.log(`  [EXECUTING_INQUIRY] No routing plan, skipping to DONE`);
    return MissionState.INQUIRY_DONE;
  }
  
  console.log(`  [EXECUTING_INQUIRY] Running ${routingPlan.agents.length} agents...`);
  
  const inquiryOutputs: InquiryOutput[] = [];
  
  // Run agents in parallel
  const agentPromises = routingPlan.agents.map(async (agentId) => {
    console.log(`  [EXECUTING_INQUIRY] Running ${agentId}...`);
    
    // Build agent-specific prompt
    const prompt = await buildInquiryPrompt(agentId, ticker, question, mission);
    
    // Get adapter
    const adapterType = getAdapterForAgent(agentId);
    const adapter = createUnifiedAdapter(adapterType);
    
    // Run with timeout
    const result = await adapter.run(prompt, {
      timeout: 120000,  // 2 minutes
    });
    
    if (result.success) {
      const output = parseInquiryOutput(agentId, result.content);
      console.log(`  [EXECUTING_INQUIRY] ${agentId}: success`);
      return output;
    } else {
      console.log(`  [EXECUTING_INQUIRY] ${agentId}: failed - ${result.error}`);
      return createErrorOutput(agentId, result.error);
    }
  });
  
  // Wait for all agents
  const results = await Promise.allSettled(agentPromises);
  
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) {
      inquiryOutputs.push(result.value);
    }
  }
  
  // Store in mission state
  mission.state.inquiry_outputs = inquiryOutputs;
  
  return MissionState.INQUIRY_SYNTHESIZING;
}

async function buildInquiryPrompt(
  agentId: string,
  ticker: string,
  question: string,
  mission: Mission
): Promise<string> {
  // Load persona
  const persona = await loadPersonaForAgent(agentId);
  
  // Get market data from research (if available)
  const marketData = (mission.state.evidence_pack as any) || {};
  
  const marketContext = marketData.current_price
    ? `## Market Data
- Current Price: $${marketData.current_price}
- Market Cap: ${marketData.market_cap || 'N/A'}
- 52-Week Range: $${marketData.week_52_low || 'N/A'} - $${marketData.week_52_high || 'N/A'}`
    : '## Market Data\nNot available';

  return `You are ${agentId}, analyzing ${ticker}.

${persona ? `## Your Persona\n${persona}\n` : ''}

${marketContext}

## User's Question
"${question}"

## Your Task

Provide a clear, concise answer. Focus on what the user is asking.

Respond in JSON format:
{
  "answer": "Your detailed answer",
  "key_points": ["key point 1", "key point 2"],
  "confidence": 1-10,
  "what_would_change_my_mind": ["thing 1", "thing 2"]
}

If the question is in Thai, respond in Thai. If in English, respond in English.`;
}

interface InquiryOutput {
  agent_id: string;
  answer: string;
  key_points: string[];
  confidence: number;
  what_would_change_my_mind: string[];
}

function parseInquiryOutput(agentId: string, content: string): InquiryOutput {
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const data = JSON.parse(jsonMatch[0]);
      return {
        agent_id: agentId,
        answer: data.answer || content.substring(0, 500),
        key_points: data.key_points || [],
        confidence: data.confidence || 5,
        what_would_change_my_mind: data.what_would_change_my_mind || [],
      };
    }
  } catch (error) {
    // Fall through
  }
  
  return {
    agent_id: agentId,
    answer: content.substring(0, 500),
    key_points: [],
    confidence: 3,
    what_would_change_my_mind: [],
  };
}

function createErrorOutput(agentId: string, error?: string): InquiryOutput {
  return {
    agent_id: agentId,
    answer: `Analysis unavailable: ${error || 'Unknown error'}`,
    key_points: [],
    confidence: 0,
    what_would_change_my_mind: [],
  };
}
```

---

#### 2.4 Create Inquiry Synthesizing Handler

**File:** `packages/cli/src/lib/state-handlers/inquiry-synthesizing-handler.ts`

```typescript
/**
 * INQUIRY_SYNTHESIZING State Handler
 * 
 * Format inquiry outputs for user consumption
 */

import { Mission, MissionState } from '@one4all/kernel';
import { createUnifiedAdapter } from '../adapter-factory.js';

export async function handleInquirySynthesizingState(
  mission: Mission
): Promise<MissionState> {
  const routingPlan = mission.state.routing_plan;
  const outputs = mission.state.inquiry_outputs || [];
  const question = mission.state.brief?.question || '';
  
  console.log(`  [INQUIRY_SYNTHESIZING] Formatting ${outputs.length} responses...`);
  
  if (outputs.length === 0) {
    mission.state.inquiry_result = {
      answer: 'No analysts could provide an answer. Please try rephrasing your question.',
      pattern: routingPlan?.pattern || 'unknown',
      agents_attempted: routingPlan?.agents || [],
    };
    return MissionState.INQUIRY_DONE;
  }
  
  // Build synthesis based on pattern
  let synthesis: string;
  
  switch (routingPlan?.pattern) {
    case 'single':
      synthesis = formatSingleAgent(outputs[0]);
      break;
    case 'debate':
      synthesis = formatDebate(outputs);
      break;
    case 'research_write':
      synthesis = formatResearchWrite(outputs);
      break;
    case 'deliverable':
      synthesis = formatDeliverable(outputs);
      break;
    default:
      synthesis = formatGeneric(outputs);
  }
  
  mission.state.inquiry_result = {
    answer: synthesis,
    pattern: routingPlan.pattern,
    agents_responded: outputs.map(o => o.agent_id),
    key_takeaways: outputs.flatMap(o => o.key_points).slice(0, 5),
  };
  
  return MissionState.INQUIRY_DONE;
}

function formatSingleAgent(output: InquiryOutput): string {
  return `**${output.agent_id}**

${output.answer}

**Key Points:**
${output.key_points.map(p => `- ${p}`).join('\n')}

**What would change my mind:**
${output.what_would_change_my_mind.map(w => `- ${w}`).join('\n' || 'None specified')}

**Confidence:** ${output.confidence}/10`;
}

function formatDebate(outputs: InquiryOutput[]): string {
  let result = '# Debate Results\n\n';
  
  for (const output of outputs) {
    result += `## ${output.agent_id}\n\n`;
    result += `${output.answer}\n\n`;
    result += `**Confidence:** ${output.confidence}/10\n\n`;
    result += `---\n\n`;
  }
  
  // Add synthesis
  result += '## Synthesis\n\n';
  result += 'The above analysts have provided their perspectives. ';
  
  // Check for agreement/disagreement
  const highConfidence = outputs.filter(o => o.confidence >= 7);
  const lowConfidence = outputs.filter(o => o.confidence < 5);
  
  if (highConfidence.length === outputs.length && lowConfidence.length === 0) {
    result += 'All analysts express high confidence in their respective views.';
  } else if (lowConfidence.length > 0) {
    result += 'Some analysts express low confidence - additional research may be warranted.';
  }
  
  return result;
}

function formatResearchWrite(outputs: InquiryOutput[]): string {
  let result = '# Research Summary\n\n';
  
  for (const output of outputs) {
    result += `${output.answer}\n\n`;
  }
  
  result += '## Key Points\n\n';
  result += outputs.flatMap(o => o.key_points)
    .slice(0, 8)
    .map(p => `- ${p}`)
    .join('\n');
  
  return result;
}

function formatDeliverable(outputs: InquiryOutput[]): string {
  // Full investment memo format
  return formatDebate(outputs) + '\n\n## Recommendation\n\nBased on the above analysis, [recommendation would go here].';
}

function formatGeneric(outputs: InquiryOutput[]): string {
  return outputs.map(o => `**${o.agent_id}**\n\n${o.answer}\n`).join('\n\n---\n\n');
}
```

---

**Phase 2 Deliverable:**
- [ ] New mission type "inquiry" works
- [ ] 4 new states added and functional
- [ ] All 4 test questions pass (see Acceptance Criteria)
- [ ] Mission completes in 2-10 minutes depending on pattern

---

### Phase 3: MCP Entry Point (1 day)

#### 3.1 Add MCP Tool: `ask`

**File:** `packages/mcp/src/modules/inquiry-handler.ts`

```typescript
/**
 * Inquiry Handler - MCP Tools
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { MissionStateMachine } from '@one4all/kernel';

export function getInquiryTools(stateMachine: MissionStateMachine): Tool[] {
  return [
    {
      name: 'ask',
      description: `Ask a natural language question to the one4all investment analysis system.

Supports Thai and English questions.

Examples:
- "คำนวณตาม Damodaran ปีนี้ CPALL ควรเท่าไร"
- "Klarman มองหนี้สิน CPALL ยังไง"
- "Damodaran บอกไม่โต Seth คิดว่าไง"
- "ขอข้อมูลโครงสร้างรายได้ CPALL"

The system will route your question to appropriate analysts automatically.`,
      inputSchema: {
        type: 'object',
        properties: {
          question: {
            type: 'string',
            description: 'Your question in Thai or English',
          },
          ticker: {
            type: 'string',
            description: 'Stock ticker symbol (e.g., AAPL, CPALL.BK)',
          },
        },
        required: ['question', 'ticker'],
      },
    },
  ];
}

export async function handleAsk(
  args: any,
  stateMachine: MissionStateMachine
): Promise<{
  content: Array<{ type: string; text: string }>;
}> {
  const { question, ticker } = args;
  
  // Create inquiry mission
  const brief = {
    type: 'inquiry',
    domain: 'investment-war-room',
    description: question,
    question,
    ticker,
  };
  
  const mission = stateMachine.createMission(brief);
  
  // Run mission (fire and forget for now)
  // In production, would track mission ID and return status
  
  // For MVP, run synchronously with timeout
  const result = await runInquiryMission(mission);
  
  return {
    content: [{
      type: 'text',
      text: result.answer || 'Processing...',
    }],
  };
}

async function runInquiryMission(mission): Promise<any> {
  // This would integrate with the state machine
  // For now, stub implementation
  return {
    answer: 'Inquiry system under construction',
  };
}
```

---

#### 3.2 Update MCP Server

**File:** `packages/mcp/src/server.ts`

```typescript
// Import inquiry handler
import * as inquiryHandler from './modules/inquiry-handler.js';

// Add to getToolDefinitions():
const inquiryTools = inquiryHandler.getInquiryTools(this.stateMachine);
return [
  ...existingTools,
  ...inquiryTools,
];

// Add to handleCallTool():
case 'ask':
  return await inquiryHandler.handleAsk(args, this.stateMachine);
```

---

#### 3.3 Activate in Claude Desktop

**Config:** `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS)
or `~/.config/Claude/claude_desktop_config.json` (Linux)

```json
{
  "mcpServers": {
    "one4all": {
      "command": "node",
      "args": ["/path/to/one4all/packages/mcp/dist/index.js"],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

---

**Phase 3 Deliverable:**
- [ ] MCP tool `ask` works from Claude Desktop
- [ ] Thai questions work end-to-end
- [ ] All 4 patterns produce correct output
- [ ] Response time < 10 minutes

---

## Acceptance Criteria

### Phase 0: Pre-requisites

| Test | Expected | Command |
|------|----------|---------|
| AAPL full analysis | Passes all states | `one4all mission run --ticker AAPL` |
| CPALL.BK full analysis | Passes all states | `one4all mission run --ticker CPALL.BK` |
| Portfolio-allocator output | `position_size` (1-15%), `fair_value` = undefined | Check logs |
| CIO price reference | Uses actual market price | Check synthesis output |
| Thai ticker auto-suffix | `fetchStockData('CPALL')` returns CPALL.BK data | Unit test |

---

### Phase 1: Agent Registry

| Test | Expected |
|------|----------|
| All 12 YAMLs have routing_metadata | 5 fields populated |
| Persona files exist (6 files) | Files in `personas/` directory |
| Damodaran vs Klarman conflict | `can_debate_with` includes each other |
| Registry.findAgents("คำนวณ") | Returns damodaran-valuation |
| Registry.findAgents("risk") | Returns klarman-downside, downside-protection |

---

### Phase 2: CIO Router Core

| # | Question Input | Expected Pattern | Expected Agents |
|---|-----------------|------------------|-----------------|
| 1 | "คำนวณตาม Damodaran ปีนี้ CPALL ควรเท่าไร" | single | damodaran-valuation |
| 2 | "Klarman มองหนี้สิน CPALL ยังไง" | single | klarman-downside |
| 3 | "Damodaran บอกไม่โต Seth คิดว่าไง" | debate | damodaran + klarman |
| 4 | "ขอข้อมูลโครงสร้างรายได้ CPALL" | research_write | researcher + (maybe) writer |

**Additional:**
- Low confidence (< 0.5) → devil-advocate auto-added
- Thai questions → Thai responses
- Each agent responds in < 2 minutes
- Total time < 10 minutes for debate pattern

---

### Phase 3: MCP Entry Point

| Test | Expected |
|------|----------|
| Claude Desktop → `ask` tool | Tool appears in Claude UI |
| Thai question from Claude | Thai response returned |
| All 4 CLI examples work in MCP | Same output as CLI |
| Response time < 10 minutes | From question to answer |

---

## Definition of Done

**Final Test (Non-Developer):**

> A non-developer (fund manager) sits in Claude Desktop, types in Thai:
> "ในมุม Klarman ดูหนี้ CPALL ยังไง น่ากังวลไหม"
>
> Within 10 minutes, gets:
> - A response from klarman-downside
> - With actual CPALL market data
> - Including "what would change my mind"
> - No additional API cost
> - Without needing developer help

---

## Timeline & Effort

| Phase | Duration | Dependencies | Deliverables |
|-------|----------|--------------|--------------|
| Phase 0 | 1 day | - | 3 bugs fixed |
| Phase 1 | 1-2 days | Phase 0 | Agent metadata + Registry |
| Phase 2 | 2-3 days | Phase 1 | CIO Router + 4 handlers |
| Phase 3 | 1 day | Phase 2 | MCP integration |

**Total:** 5-7 days

---

## Files to Create/Modify

### New Files (15+)

```
packages/kernel/src/
├── registry/
│   └── agent-registry.ts                    [NEW]
└── state-machine/
    └── types.ts                              [MODIFY - add inquiry states]

packages/cli/src/lib/state-handlers/
├── routing-handler.ts                       [NEW]
├── executing-inquiry-handler.ts             [NEW]
└── inquiry-synthesizing-handler.ts           [NEW]

packages/mcp/src/modules/
└── inquiry-handler.ts                        [NEW]

domains/investment-war-room/
├── personas/
│   ├── cio-router.md                         [NEW]
│   ├── damodaran.md                          [VERIFY]
│   ├── klarman.md                            [VERIFY]
│   └── ... (verify all 6 exist)
└── agents/
    ├── damodaran-valuation.yaml              [MODIFY - add routing_metadata]
    ├── klarman-downside.yaml                 [MODIFY]
    └── ... (all 12 agents)
```

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Thai question success rate | >95% | Thai test suite |
| Average response time | <5 min (single), <10 min (debate) | Performance tests |
| Routing accuracy | >90% | User feedback on agent selection |
| Cost per inquiry | <$0.20 | Token counting |
| CLI + MCP parity | 100% | Same output for both interfaces |

---

## Future Enhancements (Post-2.0)

1. **Multi-turn conversations** - Follow-up questions within context
2. **Session persistence** - Save inquiry history
3. **More patterns** - comparison, portfolio review, etc.
4. **Voice input** - Thai speech-to-text
5. **Mobile app** - iOS/Android interface

---

**Document Version:** 1.0
**Status:** READY FOR IMPLEMENTATION
**Last Updated:** 2024-05-15
