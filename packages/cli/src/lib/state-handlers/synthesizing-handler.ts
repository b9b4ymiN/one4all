/**
 * SYNTHESIZING State Handler
 *
 * CIO combines all analyst outputs into final decision
 */

import { Mission, MissionState } from '@one4all/kernel';
import type { Decision, SMDecisionState, SMFollowUpEvent } from '@one4all/kernel';
import { createCLIAdapter, type CLIAdapterType } from '@one4all/adapters';
import { getAdapterForAgent } from '../agent-adapter-mapping.js';
import { createUnifiedAdapter } from '../adapter-factory.js';

// Type aliases for compatibility
type DecisionState = SMDecisionState;
type FollowUpEvent = SMFollowUpEvent;

export interface SynthesisData {
  agent_id: string;
  decision: Decision;
  consensus: string;
  agreement_analysis?: {
    high_confidence_points: string[];
    disagreement_points: Array<{ topic: string; agents: string[]; nature: string }>;
  };
}

/**
 * Handle SYNTHESIZING state
 * Returns HUMAN_REVIEW_GATE_3 when synthesis complete
 */
export async function handleSynthesizingState(
  mission: Mission,
  cliAdapter: CLIAdapterType
): Promise<MissionState> {
  const brief = mission.state.brief;
  const ticker = brief?.ticker || 'UNKNOWN';
  const evidence = mission.state.synthesis_output as any;
  const analystsRecord = mission.state.analyst_outputs || {};

  // Convert Record to array
  const analysts = Object.values(analystsRecord).filter((a): a is any => a !== null && a !== undefined);

  console.log(`  [SYNTHESIZING] CIO combining analyses for ${ticker}...`);

  // Build CIO prompt with all analyst outputs
  const cioPrompt = buildCIOPrompt(ticker, evidence, analysts);

  // Get adapter for CIO synthesizer (uses per-agent mapping - prefers claude-cli)
  const cioAdapterType = getAdapterForAgent('cio-synthesizer');
  const adapter = createUnifiedAdapter(cioAdapterType);

  console.log(`  [SYNTHESIZING] Using ${cioAdapterType} for CIO synthesis...`);

  const result = await adapter.run(cioPrompt, {
    timeout: 300000, // 5 minutes - increased from 120s for complex synthesis
  });

  if (!result.success) {
    console.log(`  [SYNTHESIZING] Error: ${result.error}`);
    // Create minimal decision on failure
    const fallbackDecision = createFallbackDecision(ticker, analysts);
    mission.state.synthesis_output = fallbackDecision;
    mission.state.decision = fallbackDecision.decision;
    return MissionState.HUMAN_REVIEW_GATE_3;
  }

  // Parse CIO decision
  const decision = parseCIOOutput(result.content, ticker);

  console.log(`  [SYNTHESIZING] Decision: ${decision.decision.decision_state}`);
  console.log(`  [SYNTHESIZING] Fair Value: ${decision.decision.fair_value_conservative}`);
  console.log(`  [SYNTHESIZING] Thesis Breakers: ${decision.decision.thesis_breakers.length}`);

  // Store in mission state, preserving research market data
  const researchData = mission.state.synthesis_output as any;
  mission.state.synthesis_output = {
    ...decision,
    // Preserve market data from research phase
    current_price: researchData?.current_price,
    market_cap: researchData?.market_cap,
    week_52_high: researchData?.week_52_high,
    week_52_low: researchData?.week_52_low,
    as_of_date: researchData?.as_of_date,
  };
  mission.state.decision = decision.decision;

  return MissionState.HUMAN_REVIEW_GATE_3;
}

/**
 * Build CIO synthesizer prompt
 */
function buildCIOPrompt(ticker: string, evidence: any, analysts: any[]): string {
  const analystViews = analysts.map((a: any) =>
    `- ${a.agent_id}: fair_value=${a.fair_value}, conviction=${a.conviction_level}, view="${a.view?.substring(0, 100)}..."`
  ).join('\n');

  const evidenceText = evidence?.financial_data
    ? `Financial Data:\n- Revenue: ${evidence.financial_data.revenue || 'UNKNOWN'}\n- Net Income: ${evidence.financial_data.net_income || 'UNKNOWN'}\n- EPS: ${evidence.financial_data.eps || 'UNKNOWN'}\n\nEvidence Score: ${evidence.evidence_score || 30}/100`
    : 'No evidence available';

  return `You are the CIO (Chief Investment Officer) synthesizing research for ${ticker}.

${evidenceText}

ANALYST VIEWS:
${analystViews}

Your task: Provide a clear investment decision in JSON format:

{
  "decision_state": string (one of: "REJECT", "WATCH", "RESEARCH_MORE", "WAIT_FOR_PRICE", "STARTER_POSITION", "CORE_CANDIDATE"),
  "fair_value_conservative": number (conservative per-share estimate),
  "price_to_watch": number (price threshold for action),
  "thesis_breakers": array of strings (events that would invalidate the thesis),
  "follow_up_events": array of objects with "event", "expected_date", and "watch_for" keys,
  "consensus": string (summary of analyst agreement),
  "rationale": string (brief decision reasoning)
}

DECISION STATE GUIDANCE:
- REJECT: Fundamental flaws or excessive risk
- WATCH: Interesting but need more information or better price
- RESEARCH_MORE: Critical data gaps
- WAIT_FOR_PRICE: Good company but price too high
- STARTER_POSITION: Good opportunity for small position
- CORE_CANDIDATE: High conviction, can be large holding

Be decisive. Use current price ~${ticker === 'AAPL' ? '180' : '100'} as reference if not provided.`;
}

/**
 * Parse CIO output
 */
function parseCIOOutput(content: string, ticker: string): SynthesisData {
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const data = JSON.parse(jsonMatch[0]);

      const decision: Decision = {
        decision_state: (data.decision_state || 'WATCH') as DecisionState,
        fair_value_conservative: data.fair_value_conservative || 100,
        price_to_watch: data.price_to_watch || (data.fair_value_conservative || 100) * 0.8,
        thesis_breakers: data.thesis_breakers || ['Earnings deteriorate', 'Thesis invalidated'],
        follow_up_events: (data.follow_up_events || []).map((e: any) => ({
          event: e.event || 'Next earnings',
          expected_date: new Date(e.expected_date || e.date || '2026-06-01'),
          watch_for: e.watch_for || 'Results',
        })),
      };

      return {
        agent_id: 'cio-synthesizer',
        decision,
        consensus: data.consensus || 'Moderate buy',
        agreement_analysis: {
          high_confidence_points: [],
          disagreement_points: [],
        },
      };
    }
  } catch (error) {
    console.log('  [SYNTHESIZING] Failed to parse CIO output');
  }

  return createFallbackDecision(ticker, []);
}

/**
 * Create fallback decision
 */
function createFallbackDecision(ticker: string, analysts: any[]): SynthesisData {
  const avgFairValue = analysts.length > 0
    ? analysts
        .filter((a: any) => a.fair_value)
        .reduce((sum: number, a: any) => sum + (a.fair_value || 0), 0) / analysts.filter((a: any) => a.fair_value).length
    : 100;

  const decision: Decision = {
    decision_state: 'WATCH' as DecisionState,
    fair_value_conservative: avgFairValue || 100,
    price_to_watch: (avgFairValue || 100) * 0.85,
    thesis_breakers: ['Insufficient data for full analysis', 'Earnings miss expected'],
    follow_up_events: [
      {
        event: 'Next earnings release',
        expected_date: new Date('2026-06-15'),
        watch_for: 'Results vs expectations',
      },
      {
        event: 'Quarterly update',
        expected_date: new Date('2026-08-01'),
        watch_for: 'Guidance changes',
      },
    ],
  };

  return {
    agent_id: 'cio-synthesizer',
    decision,
    consensus: 'Analysts had mixed views',
    agreement_analysis: {
      high_confidence_points: [],
      disagreement_points: [],
    },
  };
}
