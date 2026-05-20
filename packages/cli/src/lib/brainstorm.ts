/**
 * Brainstorming System
 *
 * One Man Company Brainstorming:
 * Simulate internal dialogue through multiple analyst perspectives
 * to help individual investors think through investment decisions.
 */

import { createUnifiedAdapter } from './adapter-factory.js';
import { getAdapterForAgent } from './agent-adapter-mapping.js';
import { getPersonaResolver } from './registry-connector.js';

export interface BrainstormQuestion {
  /** The analyst persona asking the question */
  from_perspective: string;
  /** The question being asked */
  question: string;
  /** Context for the question */
  context?: string;
}

export interface BrainstormResponse {
  /** The analyst responding */
  analyst_id: string;
  /** The analyst's response */
  response: string;
  /** Key insights from this perspective */
  insights: string[];
  /** What would change their mind */
  what_would_change_my_mind: string[];
}

export interface BrainstormResult {
  ticker: string;
  question: string;
  question_from: string;
  responses: BrainstormResponse[];
  synthesis: string;
  key_takeaways: string[];
  unresolved_questions: string[];
}

/**
 * Parse a natural language question to extract perspective
 * Examples:
 * - "ตามมุมมองดาโมดาลัน มีคำถามอะไรบ้าง" → from_perspective: "damodaran-valuation"
 * - "From Seth Klarman's view, what concerns?" → from_perspective: "seth-klarman"
 * - "What would the devil's advocate ask?" → from_perspective: "devil-advocate"
 */
export function parseQuestionPerspective(question: string): string {
  const lowerQ = question.toLowerCase();

  // Thai patterns
  if (lowerQ.includes('ดาโมดาลัน') || lowerQ.includes('damodaran')) {
    return 'damodaran-valuation';
  }
  if (lowerQ.includes('klarman') || lowerQ.includes('คลาร์แมน') || lowerQ.includes('เคลียร์แมน')) {
    return 'seth-klarman';
  }
  if (lowerQ.includes('devil') || lowerQ.includes('ปีศาจ') || lowerQ.includes('ทนายปีศาจ')) {
    return 'devil-advocate';
  }
  if (lowerQ.includes('portfolio') || lowerQ.includes('pm') || lowerQ.includes('จัดการพอร์ต')) {
    return 'portfolio-manager';
  }
  if (lowerQ.includes('consensus') || lowerQ.includes('มติเอกฉันท์')) {
    return 'consensus-analyst';
  }
  if (lowerQ.includes('downside') || lowerQ.includes('ความเสี่ยง')) {
    return 'downside-protection';
  }
  if (lowerQ.includes('greenwald')) {
    return 'greenwald-evasion';
  }
  if (lowerQ.includes('kessler') || lowerQ.includes('moat')) {
    return 'kessler-moat';
  }
  if (lowerQ.includes('klamran') || lowerQ.includes('quality')) {
    return 'klamran-quality';
  }
  if (lowerQ.includes('burry') || lowerQ.includes('michael')) {
    return 'michael-burry';
  }
  if (lowerQ.includes('allocator') || lowerQ.includes('steward')) {
    return 'allocator-steward';
  }
  if (lowerQ.includes('leveraged') || lowerQ.includes('franchise')) {
    return 'leveraged-franchise';
  }

  // Default to devil's advocate for general "what could go wrong" questions
  return 'devil-advocate';
}

/**
 * Build brainstorming prompt for a specific analyst
 */
async function buildBrainstormPrompt(
  analystId: string,
  ticker: string,
  question: string,
  questionFrom: string,
  marketData: any,
  domain: string = 'investment-war-room'
): Promise<string> {
  // Get persona path from registry (for validation, though we don't load the content here)
  const resolver = getPersonaResolver();
  const personaPath = await resolver.resolvePersonaPath(analystId, domain).catch(() => {
    // Fallback if persona not found
    return '';
  });

  // Build market context
  const marketContext = marketData?.current_price
    ? `## Current Market Data:
- Current Price: $${marketData.current_price}
- Market Cap: ${marketData.market_cap || 'N/A'}
- 52-Week Range: $${marketData.week_52_low || 'N/A'} - $${marketData.week_52_high || 'N/A'}
`
    : '';

  return `You are participating in an investment brainstorming session about ${ticker}.

## The Question:
${question}

## This Question Comes From: ${questionFrom}

${marketContext}

## Your Role:
As ${analystId}, provide your perspective on this question. Consider:

1. **Your Response**: How would you answer this question from your analytical perspective?
2. **Key Insights**: What are the most important points from your viewpoint?
3. **What Would Change Your Mind**: What evidence or events would cause you to reconsider?

Provide your response in this JSON format:
{
  "response": "Your detailed response to the question",
  "insights": ["key insight 1", "key insight 2", "key insight 3"],
  "what_would_change_my_mind": ["thing 1", "thing 2"]
}

Keep your response focused and actionable for an investment decision.`;
}

/**
 * Run brainstorming session with multiple analysts
 */
export async function runBrainstorming(
  ticker: string,
  question: string,
  marketData: any,
  options: {
    questionFrom?: string;
    includeAnalysts?: string[];
    maxResponses?: number;
    domain?: string;
  } = {}
): Promise<BrainstormResult> {
  const {
    questionFrom = parseQuestionPerspective(question),
    includeAnalysts = undefined,
    maxResponses = 5,
    domain = 'investment-war-room',
  } = options;

  // Get default analysts from registry if not specified
  let analystsToQuery: string[];
  if (includeAnalysts) {
    analystsToQuery = includeAnalysts;
  } else {
    const resolver = getPersonaResolver();
    const knownAnalysts = await resolver.getKnownAnalysts(domain);
    analystsToQuery = knownAnalysts.slice(0, maxResponses);
  }

  console.log(`[BRAINSTORM] Running brainstorming for ${ticker}`);
  console.log(`[BRAINSTORM] Question from perspective: ${questionFrom}`);
  console.log(`[BRAINSTORM] Querying ${analystsToQuery.length} analysts`);

  const responses: BrainstormResponse[] = [];

  // Query each analyst in parallel
  const queryPromises = analystsToQuery.map(async (analystId) => {
    try {
      const prompt = await buildBrainstormPrompt(
        analystId,
        ticker,
        question,
        questionFrom,
        marketData,
        domain
      );

      const adapterType = getAdapterForAgent(analystId);
      const adapter = createUnifiedAdapter(adapterType);

      console.log(`[BRAINSTORM] Querying ${analystId}...`);

      const result = await adapter.run(prompt, {
        timeout: 120000, // 2 minutes
      });

      if (result.success) {
        const parsed = parseBrainstormResponse(analystId, result.content);
        console.log(`[BRAINSTORM] ${analystId}: Got response`);
        return parsed;
      } else {
        console.log(`[BRAINSTORM] ${analystId}: Failed - ${result.error}`);
        return createErrorResponse(analystId, result.error || 'Unknown error');
      }
    } catch (error) {
      console.log(`[BRAINSTORM] ${analystId}: Error - ${error}`);
      return createErrorResponse(analystId, String(error));
    }
  });

  const queryResults = await Promise.allSettled(queryPromises);

  for (const result of queryResults) {
    if (result.status === 'fulfilled' && result.value) {
      responses.push(result.value);
    }
  }

  // Generate synthesis
  const synthesis = await generateSynthesis(ticker, question, responses);
  const keyTakeaways = extractKeyTakeaways(responses);
  const unresolvedQuestions = extractUnresolvedQuestions(responses);

  return {
    ticker,
    question,
    question_from: questionFrom,
    responses,
    synthesis,
    key_takeaways: keyTakeaways,
    unresolved_questions: unresolvedQuestions,
  };
}

/**
 * Parse brainstorm response from LLM output
 */
function parseBrainstormResponse(
  analystId: string,
  content: string
): BrainstormResponse {
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const data = JSON.parse(jsonMatch[0]);

      return {
        analyst_id: analystId,
        response: data.response || content.substring(0, 500),
        insights: data.insights || [],
        what_would_change_my_mind: data.what_would_change_my_mind || [],
      };
    }
  } catch (error) {
    console.log(`[BRAINSTORM] Failed to parse ${analystId} response`);
  }

  // Fallback
  return {
    analyst_id: analystId,
    response: content.substring(0, 500),
    insights: [],
    what_would_change_my_mind: [],
  };
}

/**
 * Create error response for failed analyst query
 */
function createErrorResponse(analystId: string, error: string): BrainstormResponse {
  return {
    analyst_id: analystId,
    response: `Analysis unavailable: ${error}`,
    insights: [],
    what_would_change_my_mind: [],
  };
}

/**
 * Generate synthesis of all responses
 */
async function generateSynthesis(
  ticker: string,
  question: string,
  responses: BrainstormResponse[]
): Promise<string> {
  if (responses.length === 0) {
    return `No responses received for brainstorming session about ${ticker}.`;
  }

  // Use a cheap model for synthesis
  const synthesisPrompt = `You are synthesizing a brainstorming session about ${ticker}.

## Original Question:
${question}

## Analyst Responses:
${responses.map(r => `- ${r.analyst_id}: ${r.response.substring(0, 200)}...`).join('\n')}

Provide a concise synthesis (2-3 paragraphs) that:
1. Identifies areas of agreement
2. Highlights key disagreements or concerns
3. Suggests what the investor should focus on next

Keep it actionable and focused on decision-making.`;

  try {
    const adapter = createUnifiedAdapter('claude-cli');
    const result = await adapter.run(synthesisPrompt, { timeout: 30000 });

    if (result.success) {
      return result.content;
    }
  } catch (error) {
    console.log(`[BRAINSTORM] Synthesis failed: ${error}`);
  }

  // Fallback synthesis
  const validResponses = responses.filter(r => !r.response.includes('Analysis unavailable'));

  if (validResponses.length === 0) {
    return `All analyst queries failed. Please check your data sources and try again.`;
  }

  return `Received ${validResponses.length} analyst perspectives. Key themes include:\n` +
    validResponses
      .flatMap(r => r.insights)
      .slice(0, 5)
      .map(i => `- ${i}`)
      .join('\n');
}

/**
 * Extract key takeaways from all responses
 */
function extractKeyTakeaways(responses: BrainstormResponse[]): string[] {
  const allInsights = responses.flatMap(r => r.insights);
  const uniqueInsights = Array.from(new Set(allInsights));

  // Return top 5
  return uniqueInsights.slice(0, 5);
}

/**
 * Extract unresolved questions from responses
 */
function extractUnresolvedQuestions(responses: BrainstormResponse[]): string[] {
  return responses
    .flatMap(r => r.what_would_change_my_mind)
    .filter(q => q.length > 0)
    .slice(0, 3);
}
