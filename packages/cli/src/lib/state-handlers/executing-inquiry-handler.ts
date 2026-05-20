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
import { getPersonaResolver, getDomainFromBrief } from '../registry-connector.js';

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
  const domain = getDomainFromBrief(brief);
  let routingPlan = (brief?.owner_assumptions as any)?.routing_plan;

  if (!routingPlan || !routingPlan.selected_analysts) {
    console.log(`  [EXECUTING_INQUIRY] No routing plan found, using devil-advocate`);
    routingPlan = { selected_analysts: ['devil-advocate'] };
  }

  const analysts = routingPlan.selected_analysts;
  const pattern = (brief?.owner_assumptions as any)?.inquiry_pattern || 'single';

  console.log(`  [EXECUTING_INQUIRY] Running ${analysts.length} analysts with pattern: ${pattern}...`);

  let responses: InquiryResponse[];

  // Branch based on pattern
  switch (pattern) {
    case 'debate':
      responses = await executeDebatePattern(analysts, ticker, question, domain);
      break;

    case 'research_write':
      // TODO: Implement research_write pattern - parallel research → synthesis
      console.log(`  [EXECUTING_INQUIRY] research_write pattern not yet implemented, falling back to single`);
      responses = await executeSinglePattern(analysts, ticker, question, domain);
      break;

    case 'deliverable':
      // TODO: Implement deliverable pattern - structured output with sections
      console.log(`  [EXECUTING_INQUIRY] deliverable pattern not yet implemented, falling back to single`);
      responses = await executeSinglePattern(analysts, ticker, question, domain);
      break;

    case 'single':
    default:
      responses = await executeSinglePattern(analysts, ticker, question, domain);
      break;
  }

  console.log(`  [EXECUTING_INQUIRY] Completed ${responses.length}/${analysts.length} analyst queries`);

  // Store responses in mission state
  mission.state.analyst_outputs = {
    inquiry_responses: responses,
  };

  return MissionState.INQUIRY_SYNTHESIZING;
}

/**
 * Execute single pattern - parallel execution without cross-referencing
 * (backward compatible with original behavior)
 */
async function executeSinglePattern(
  analysts: string[],
  ticker: string,
  question: string,
  domain: string
): Promise<InquiryResponse[]> {
  // Run all analysts in parallel with 2-minute timeout each
  const queryPromises = analysts.map(async (analystId: string) => {
    return await runAnalystWithTimeout(analystId, ticker, question, domain, 120000);
  });

  const results = await Promise.allSettled(queryPromises);

  // Collect successful responses
  const responses: InquiryResponse[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) {
      responses.push(result.value);
    }
  }

  return responses;
}

/**
 * Execute debate pattern - first round → cross-references → second round → synthesize
 */
async function executeDebatePattern(
  analysts: string[],
  ticker: string,
  question: string,
  domain: string
): Promise<InquiryResponse[]> {
  console.log(`  [EXECUTING_INQUIRY] Debate pattern: First round starting...`);

  // First round: run all analysts in parallel
  const firstRoundPromises = analysts.map(async (analystId: string) => {
    return await runAnalystWithTimeout(analystId, ticker, question, domain, 120000);
  });

  const firstRoundResults = await Promise.allSettled(firstRoundPromises);

  const firstRoundResponses: InquiryResponse[] = [];
  for (const result of firstRoundResults) {
    if (result.status === 'fulfilled' && result.value) {
      firstRoundResponses.push(result.value);
    }
  }

  console.log(`  [EXECUTING_INQUIRY] Debate pattern: First round completed with ${firstRoundResponses.length} responses`);

  // Inject cross-references: for each analyst, show what OTHER analysts said
  const secondRoundPromises = firstRoundResponses.map(async (firstResponse) => {
    const otherResponses = firstRoundResponses
      .filter(r => r.analyst_id !== firstResponse.analyst_id)
      .map(r => `### ${r.analyst_id}:\n${r.response}`)
      .join('\n\n');

    const crossReferencePrompt = buildCrossReferencePrompt(
      firstResponse.analyst_id,
      ticker,
      question,
      domain,
      otherResponses
    );

    return await runAnalystWithPrompt(
      firstResponse.analyst_id,
      ticker,
      domain,
      crossReferencePrompt,
      120000
    );
  });

  console.log(`  [EXECUTING_INQUIRY] Debate pattern: Second round starting with cross-references...`);

  const secondRoundResults = await Promise.allSettled(secondRoundPromises);

  const secondRoundResponses: InquiryResponse[] = [];
  for (const result of secondRoundResults) {
    if (result.status === 'fulfilled' && result.value) {
      secondRoundResponses.push(result.value);
    }
  }

  console.log(`  [EXECUTING_INQUIRY] Debate pattern: Second round completed with ${secondRoundResponses.length} responses`);

  return secondRoundResponses;
}

/**
 * Build cross-reference prompt for second round of debate
 */
function buildCrossReferencePrompt(
  analystId: string,
  ticker: string,
  question: string,
  domain: string,
  otherResponses: string
): string {
  return `You are participating in an investment brainstorming session about ${ticker}.

## The Investor's Question:
${question}

## Your Role:
You are ${analystId}. Other analysts have provided their perspectives. Now you have the opportunity to respond to their viewpoints.

## Other Analysts' Perspectives:
${otherResponses}

## Your Task:
Review the other analysts' perspectives and provide your response. Address disagreements, provide counter-arguments where appropriate, and acknowledge valid points from others.

Provide your response in this JSON format:
{
  "response": "Your detailed response addressing other viewpoints",
  "insights": ["key insight 1", "key insight 2", "key insight 3"],
  "what_would_change_my_mind": ["thing 1", "thing 2"]
}

**Language Support**: Respond in the same language as the question (Thai or English).`;
}

/**
 * Run analyst with a custom prompt
 */
async function runAnalystWithPrompt(
  analystId: string,
  ticker: string,
  domain: string,
  prompt: string,
  timeoutMs: number
): Promise<InquiryResponse> {
  const adapterType = getAdapterForAgent(analystId);
  const adapter = createUnifiedAdapter(adapterType);

  console.log(`  [EXECUTING_INQUIRY] Querying ${analystId} with custom prompt (${adapterType})...`);

  try {
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
 * Run analyst with timeout
 */
async function runAnalystWithTimeout(
  analystId: string,
  ticker: string,
  question: string,
  domain: string,
  timeoutMs: number
): Promise<InquiryResponse> {
  const adapterType = getAdapterForAgent(analystId);
  const adapter = createUnifiedAdapter(adapterType);

  console.log(`  [EXECUTING_INQUIRY] Querying ${analystId} (${adapterType})...`);

  try {
    // Build prompt with persona content
    const prompt = await buildInquiryPrompt(analystId, ticker, question, domain);

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
  question: string,
  domain: string
): Promise<string> {
  // Try to load persona content using registry
  let personaContent = '';
  try {
    const resolver = getPersonaResolver();
    const personaPath = await resolver.resolvePersonaPath(analystId, domain);
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
