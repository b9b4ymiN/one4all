/**
 * INQUIRY_SYNTHESIZING State Handler
 *
 * Synthesizes analyst responses into a deliverable
 * Formats output based on number of analysts (single, debate, or deliverable)
 */

import { Mission, MissionState } from '@one4all/kernel';
import { createUnifiedAdapter } from '../adapter-factory.js';
import type { InquiryResponse } from './executing-inquiry-handler.js';

export interface SynthesisOutput {
  format: 'single_agent' | 'debate' | 'deliverable';
  ticker: string;
  question: string;
  content: string;
  key_takeaways: string[];
  unresolved_questions: string[];
  analysts_count: number;
  successful_responses: number;
}

/**
 * Handle INQUIRY_SYNTHESIZING state
 * Returns DELIVERABLE when synthesis is complete
 */
export async function handleInquirySynthesizingState(
  mission: Mission
): Promise<MissionState> {
  const brief = mission.state.brief;
  const question = brief?.question || brief?.description || '';
  const ticker = brief?.ticker || 'UNKNOWN';
  const analystOutputs = mission.state.analyst_outputs as any;

  const responses: InquiryResponse[] = analystOutputs?.inquiry_responses || [];
  const successfulResponses = responses.filter(r => r.success);

  console.log(`  [INQUIRY_SYNTHESIZING] Synthesizing ${successfulResponses.length} responses...`);

  if (successfulResponses.length === 0) {
    // No successful responses
    const output: SynthesisOutput = {
      format: 'single_agent',
      ticker,
      question,
      content: 'No analyst responses were received. Please check your connections and try again.',
      key_takeaways: [],
      unresolved_questions: [],
      analysts_count: responses.length,
      successful_responses: 0,
    };
    mission.state.synthesis_output = output;
    return MissionState.DELIVERABLE;
  }

  // Determine format based on number of responses
  let synthesisOutput: SynthesisOutput;

  if (successfulResponses.length === 1) {
    synthesisOutput = await formatSingleAgent(ticker, question, successfulResponses[0]);
  } else if (successfulResponses.length === 2) {
    synthesisOutput = await formatDebate(ticker, question, successfulResponses);
  } else {
    synthesisOutput = await formatDeliverable(ticker, question, successfulResponses);
  }

  console.log(`  [INQUIRY_SYNTHESIZING] Format: ${synthesisOutput.format}`);

  mission.state.synthesis_output = synthesisOutput;

  return MissionState.DELIVERABLE;
}

/**
 * Format single agent response
 */
async function formatSingleAgent(
  ticker: string,
  question: string,
  response: InquiryResponse
): Promise<SynthesisOutput> {
  const content = `# Brainstorming Response: ${ticker}

## Question
${question}

## Analyst: ${response.analyst_id}

### Response
${response.response}

### Key Insights
${response.insights.map(i => `- ${i}`).join('\n') || 'None provided'}

### What Would Change My Mind
${response.what_would_change_my_mind.map(w => `- ${w}`).join('\n') || 'None provided'}
`;

  return {
    format: 'single_agent',
    ticker,
    question,
    content,
    key_takeaways: response.insights,
    unresolved_questions: response.what_would_change_my_mind,
    analysts_count: 1,
    successful_responses: 1,
  };
}

/**
 * Format debate between two analysts
 */
async function formatDebate(
  ticker: string,
  question: string,
  responses: InquiryResponse[]
): Promise<SynthesisOutput> {
  const [r1, r2] = responses;

  const content = `# Investment Debate: ${ticker}

## Question
${question}

## Participants
- ${r1.analyst_id}
- ${r2.analyst_id}

---

## ${r1.analyst_id}'s Perspective

${r1.response}

**Key Insights:**
${r1.insights.map(i => `- ${i}`).join('\n') || 'None provided'}

**What Would Change My Mind:**
${r1.what_would_change_my_mind.map(w => `- ${w}`).join('\n') || 'None provided'}

---

## ${r2.analyst_id}'s Perspective

${r2.response}

**Key Insights:**
${r2.insights.map(i => `- ${i}`).join('\n') || 'None provided'}

**What Would Change My Mind:**
${r2.what_would_change_my_mind.map(w => `- ${w}`).join('\n') || 'None provided'}

---

## Areas of Agreement
${await findAgreements(responses)}

## Areas of Disagreement
${await findDisagreements(responses)}
`;

  const allInsights = [...r1.insights, ...r2.insights];
  const allQuestions = [...r1.what_would_change_my_mind, ...r2.what_would_change_my_mind];

  return {
    format: 'debate',
    ticker,
    question,
    content,
    key_takeaways: allInsights,
    unresolved_questions: allQuestions,
    analysts_count: 2,
    successful_responses: 2,
  };
}

/**
 * Format full deliverable with multiple analysts
 */
async function formatDeliverable(
  ticker: string,
  question: string,
  responses: InquiryResponse[]
): Promise<SynthesisOutput> {
  let content = `# Investment Analysis: ${ticker}\n\n`;
  content += `## Question\n${question}\n\n`;
  content += `## Analyst Responses\n\n`;

  for (const response of responses) {
    content += `### ${response.analyst_id}\n\n`;
    content += `${response.response}\n\n`;

    if (response.insights.length > 0) {
      content += `**Key Insights:**\n`;
      response.insights.forEach(insight => {
        content += `- ${insight}\n`;
      });
      content += `\n`;
    }

    if (response.what_would_change_my_mind.length > 0) {
      content += `**What Would Change My Mind:**\n`;
      response.what_would_change_my_mind.forEach(thing => {
        content += `- ${thing}\n`;
      });
      content += `\n`;
    }

    content += `---\n\n`;
  }

  // Generate synthesis
  content += `## Synthesis\n\n`;
  content += await generateSynthesis(question, responses);

  content += `\n\n## Key Takeaways\n\n`;
  const allInsights = responses.flatMap(r => r.insights);
  const uniqueInsights = Array.from(new Set(allInsights)).slice(0, 5);
  uniqueInsights.forEach(insight => {
    content += `- ${insight}\n`;
  });

  content += `\n\n## Unresolved Questions\n\n`;
  const allQuestions = responses.flatMap(r => r.what_would_change_my_mind);
  const uniqueQuestions = Array.from(new Set(allQuestions)).slice(0, 3);
  uniqueQuestions.forEach(q => {
    content += `- ${q}\n`;
  });

  return {
    format: 'deliverable',
    ticker,
    question,
    content,
    key_takeaways: uniqueInsights,
    unresolved_questions: uniqueQuestions,
    analysts_count: responses.length,
    successful_responses: responses.length,
  };
}

/**
 * Find areas of agreement between responses
 */
async function findAgreements(responses: InquiryResponse[]): Promise<string> {
  if (responses.length < 2) return 'N/A';

  const prompt = `You are analyzing investment analyst responses.

## Responses:
${responses.map(r => `- ${r.analyst_id}: ${r.response.substring(0, 200)}...`).join('\n')}

Identify areas of agreement (2-3 bullet points). Be concise.`;

  try {
    const adapter = createUnifiedAdapter('claude-cli');
    const result = await adapter.run(prompt, { timeout: 15000 });
    if (result.success) {
      return result.content;
    }
  } catch (error) {
    console.log(`  [INQUIRY_SYNTHESIZING] Agreement analysis failed: ${error}`);
  }

  return '- Unable to determine agreements\n';
}

/**
 * Find areas of disagreement between responses
 */
async function findDisagreements(responses: InquiryResponse[]): Promise<string> {
  if (responses.length < 2) return 'N/A';

  const prompt = `You are analyzing investment analyst responses.

## Responses:
${responses.map(r => `- ${r.analyst_id}: ${r.response.substring(0, 200)}...`).join('\n')}

Identify areas of disagreement or conflicting views (2-3 bullet points). Be concise.`;

  try {
    const adapter = createUnifiedAdapter('claude-cli');
    const result = await adapter.run(prompt, { timeout: 15000 });
    if (result.success) {
      return result.content;
    }
  } catch (error) {
    console.log(`  [INQUIRY_SYNTHESIZING] Disagreement analysis failed: ${error}`);
  }

  return '- Unable to determine disagreements\n';
}

/**
 * Generate synthesis of all responses
 */
async function generateSynthesis(question: string, responses: InquiryResponse[]): Promise<string> {
  const prompt = `You are synthesizing investment analyst responses.

## Question:
${question}

## Analyst Responses:
${responses.map(r => `- ${r.analyst_id}: ${r.response.substring(0, 300)}...`).join('\n')}

Provide a concise synthesis (2-3 paragraphs) that:
1. Identifies the main themes
2. Highlights key differences in perspective
3. Suggests what the investor should focus on

Keep it actionable and focused on decision-making.`;

  try {
    const adapter = createUnifiedAdapter('claude-cli');
    const result = await adapter.run(prompt, { timeout: 30000 });
    if (result.success) {
      return result.content;
    }
  } catch (error) {
    console.log(`  [INQUIRY_SYNTHESIZING] Synthesis failed: ${error}`);
  }

  return 'Synthesis unavailable. Please review individual analyst responses above.';
}
