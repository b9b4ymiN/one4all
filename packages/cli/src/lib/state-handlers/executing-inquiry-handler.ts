/**
 * EXECUTING_INQUIRY State Handler
 *
 * Runs selected analyst agents in parallel for brainstorming
 * with per-agent timeout handling
 */

import { Mission, MissionState } from '@one4all/kernel';
import { createUnifiedAdapter } from '../adapter-factory.js';
import { getAdapterForAgent } from '../agent-adapter-mapping.js';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

export interface InquiryResponse {
  analyst_id: string;
  response: string;
  insights: string[];
  what_would_change_my_mind: string[];
  success: boolean;
  error?: string;
}

/**
 * Handle EXECUTING_INQUIRY state
 * Returns INQUIRY_SYNTHESIZING when all agents complete (or timeout)
 */
export async function handleExecutingInquiryState(
  mission: Mission
): Promise<MissionState> {
  const brief = mission.state.brief;
  const question = brief?.question || brief?.description || '';
  const ticker = brief?.ticker || 'UNKNOWN';
  let routingPlan = (brief?.owner_assumptions as any)?.routing_plan;

  if (!routingPlan || !routingPlan.selected_analysts) {
    console.log(`  [EXECUTING_INQUIRY] No routing plan found, using devil-advocate`);
    routingPlan = { selected_analysts: ['devil-advocate'] };
  }

  const analysts = routingPlan.selected_analysts;
  console.log(`  [EXECUTING_INQUIRY] Running ${analysts.length} analysts in parallel...`);

  // Run all analysts in parallel with 2-minute timeout each
  const queryPromises = analysts.map(async (analystId: string) => {
    return await runAnalystWithTimeout(analystId, ticker, question, 120000);
  });

  const results = await Promise.allSettled(queryPromises);

  // Collect successful responses
  const responses: InquiryResponse[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) {
      responses.push(result.value);
    }
  }

  console.log(`  [EXECUTING_INQUIRY] Completed ${responses.length}/${analysts.length} analyst queries`);

  // Store responses in mission state
  mission.state.analyst_outputs = {
    inquiry_responses: responses,
  };

  return MissionState.INQUIRY_SYNTHESIZING;
}

/**
 * Run analyst with timeout
 */
async function runAnalystWithTimeout(
  analystId: string,
  ticker: string,
  question: string,
  timeoutMs: number
): Promise<InquiryResponse> {
  const adapterType = getAdapterForAgent(analystId);
  const adapter = createUnifiedAdapter(adapterType);

  console.log(`  [EXECUTING_INQUIRY] Querying ${analystId} (${adapterType})...`);

  try {
    // Build prompt with persona content
    const prompt = await buildInquiryPrompt(analystId, ticker, question);

    const result = await adapter.run(prompt, { timeout: timeoutMs });

    if (result.success) {
      const parsed = parseInquiryResponse(analystId, result.content);
      console.log(`  [EXECUTING_INQUIRY] ${analystId}: Success`);
      return {
        analyst_id: analystId,
        ...parsed,
        success: true,
      };
    } else {
      console.log(`  [EXECUTING_INQUIRY] ${analystId}: Failed - ${result.error}`);
      return createErrorResponse(analystId, result.error || 'Unknown error');
    }
  } catch (error) {
    console.log(`  [EXECUTING_INQUIRY] ${analystId}: Error - ${error}`);
    return createErrorResponse(analystId, String(error));
  }
}

/**
 * Build inquiry prompt with persona content
 */
async function buildInquiryPrompt(
  analystId: string,
  ticker: string,
  question: string
): Promise<string> {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);

  // Try to load persona content
  let personaContent = '';
  try {
    const personaMap: Record<string, string> = {
      'damodaran-valuation': 'damodaran',
      'seth-klarman': 'klarman',
      'devil-advocate': 'devil-advocate',
      'allocator-steward': 'allocator',
      'consensus-analyst': 'consensus',
      'downside-protection': 'downside-analyst',
      'greenwald-evasion': 'greenwald',
      'kessler-moat': 'kessler',
      'klamran-quality': 'klamran',
      'leveraged-franchise': 'leveraged-franchise',
      'michael-burry': 'burry',
      'portfolio-manager': 'portfolio-manager',
    };

    const filename = personaMap[analystId] || analystId;
    const personaPath = join(__dirname, '../../../../domains/investment-war-room/personas', `${filename}.md`);
    const personaRaw = await readFile(personaPath, 'utf-8');

    // Extract persona content after frontmatter
    const frontmatterEnd = personaRaw.indexOf('---', 3);
    if (frontmatterEnd !== -1) {
      personaContent = personaRaw.substring(frontmatterEnd + 3).trim();
    }
  } catch (error) {
    // Persona not found, continue without it
  }

  return `You are participating in an investment brainstorming session about ${ticker}.

## The Investor's Question:
${question}

## Your Role:
You are ${analystId}. Provide your perspective on this question.

${personaContent ? `## Your Persona:\n${personaContent}\n` : ''}

## Your Response:
Provide your response in this JSON format:
{
  "response": "Your detailed response to the question",
  "insights": ["key insight 1", "key insight 2", "key insight 3"],
  "what_would_change_my_mind": ["thing 1", "thing 2"]
}

Keep your response focused and actionable for an investment decision.

**Language Support**: Respond in the same language as the question (Thai or English).`;
}

/**
 * Parse inquiry response from LLM output
 */
function parseInquiryResponse(analystId: string, content: string): Omit<InquiryResponse, 'analyst_id' | 'success' | 'error'> {
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const data = JSON.parse(jsonMatch[0]);

      return {
        response: data.response || content.substring(0, 500),
        insights: data.insights || [],
        what_would_change_my_mind: data.what_would_change_my_mind || [],
      };
    }
  } catch (error) {
    console.log(`  [EXECUTING_INQUIRY] Failed to parse ${analystId} response`);
  }

  // Fallback
  return {
    response: content.substring(0, 500),
    insights: [],
    what_would_change_my_mind: [],
  };
}

/**
 * Create error response for failed analyst query
 */
function createErrorResponse(analystId: string, error: string): InquiryResponse {
  return {
    analyst_id: analystId,
    response: `Analysis unavailable: ${error}`,
    insights: [],
    what_would_change_my_mind: [],
    success: false,
    error,
  };
}
