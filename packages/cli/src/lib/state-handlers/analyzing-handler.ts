/**
 * ANALYZING State Handler
 *
 * Runs analyst agents in parallel with per-agent adapter selection
 */

import { Mission, MissionState } from '@one4all/kernel';
import { createCLIAdapter, type CLIAdapterType } from '@one4all/adapters';
import { getAdapterForAgent, getFallbackAdapterForAgent } from '../agent-adapter-mapping.js';
import { createUnifiedAdapter } from '../adapter-factory.js';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

export interface AnalystOutputData {
  agent_id: string;
  fair_value?: number;
  conviction_level?: number;
  view?: string;
  what_would_change_my_mind?: string[];
  data_gaps?: string[];
}

/**
 * Get the directory path of the current module
 */
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Load persona content for a specific agent
 * Returns persona content or null if not found
 */
async function loadPersonaForAgent(agentId: string): Promise<string | null> {
  try {
    // Map agent IDs to persona filenames (handling naming differences)
    const personaMap: Record<string, string> = {
      'damodaran-valuation': 'damodaran',
      'seth-klarman': 'klarman',
      'devil-advocate': 'devil-advocate',
    };

    const filename = personaMap[agentId] || agentId;
    // Navigate from packages/cli/src/lib/state-handlers/ to domains/investment-war-room/personas/
    const personaPath = join(__dirname, '../../../../domains/investment-war-room/personas', `${filename}.md`);
    const personaContent = await readFile(personaPath, 'utf-8');

    // Extract just the persona content (after the frontmatter)
    const frontmatterEnd = personaContent.indexOf('---', 3); // Skip first ---
    if (frontmatterEnd !== -1) {
      return personaContent.substring(frontmatterEnd + 3).trim();
    }

    return personaContent;
  } catch (error) {
    // Persona file not found, return null to trigger fallback
    return null;
  }
}

/**
 * Sleep helper for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Run analyst with retry logic
 * Retries up to 2 times with exponential backoff (1s, 2s)
 * Uses per-agent adapter selection with fallback
 */
async function runAnalystWithRetry(
  analyst: string,
  prompt: string,
  maxRetries: number = 2
): Promise<{ success: boolean; output?: AnalystOutputData; error?: string }> {
  let lastError = '';
  const adapterType = getAdapterForAgent(analyst);
  const fallbackType = getFallbackAdapterForAgent(analyst);

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      const delay = Math.pow(2, attempt - 1) * 1000; // 1s, 2s
      console.log(`  [ANALYZING] ${analyst} retry ${attempt}/${maxRetries} after ${delay}ms...`);
      await sleep(delay);
    }

    // Try primary adapter, or fallback on retry
    const currentAdapterType = (attempt > 0 && fallbackType) ? fallbackType : adapterType;
    const adapter = createUnifiedAdapter(currentAdapterType);

    console.log(`  [ANALYZING] ${analyst} using ${currentAdapterType}...`);

    const result = await adapter.run(prompt, {
      timeout: 300000, // 5 minutes
    });

    if (result.success) {
      const output = parseAnalystOutput(analyst, result.content);
      console.log(`  [ANALYZING] ${analyst}: fair_value=${output.fair_value}, conviction=${output.conviction_level}`);
      return { success: true, output };
    }

    lastError = result.error || 'Unknown error';
    console.log(`  [ANALYZING] ${analyst} attempt ${attempt + 1}/${maxRetries + 1} failed (${currentAdapterType}): ${lastError}`);
  }

  // All retries exhausted
  return { success: false, error: lastError };
}

/**
 * Handle ANALYZING state
 * Returns SYNTHESIZING when all analysts complete (always succeeds, even with partial failures)
 */
export async function handleAnalyzingState(
  mission: Mission,
  cliAdapter: CLIAdapterType
): Promise<MissionState> {
  const brief = mission.state.brief;
  const ticker = brief?.ticker || 'UNKNOWN';
  const evidence = mission.state.synthesis_output as any;

  console.log(`  [ANALYZING] Running analysts for ${ticker}...`);

  // Get team from config
  const config = mission.state.config;
  const allAgents = config?.required_agents || [];
  const analysts = allAgents.filter((a: string) =>
    ['damodaran-valuation', 'klarman-downside', 'portfolio-allocator'].includes(a)
  );

  // Run analysts with per-agent adapter selection
  const analystOutputs: AnalystOutputData[] = [];

  for (const analyst of analysts.length > 0 ? analysts : ['damodaran-valuation']) {
    console.log(`  [ANALYZING] Running ${analyst}...`);

    const prompt = await buildAnalystPrompt(analyst, ticker, evidence);
    const result = await runAnalystWithRetry(analyst, prompt, 2);

    if (result.success && result.output) {
      analystOutputs.push(result.output);
    } else {
      // Add placeholder for failed analyst - mission continues
      console.log(`  [ANALYZING] ${analyst} failed after retries - using placeholder`);
      analystOutputs.push({
        agent_id: analyst,
        view: `Analysis unavailable: ${result.error?.substring(0, 100) || 'Unknown error'}`,
        conviction_level: 0,
        what_would_change_my_mind: [],
      });
    }
  }

  // Store outputs as Record<string, unknown>
  const outputsRecord: Record<string, unknown> = {};
  for (const output of analystOutputs) {
    outputsRecord[output.agent_id] = output;
  }
  mission.state.analyst_outputs = outputsRecord;

  console.log(`  [ANALYZING] Completed ${analystOutputs.length} analyst analyses`);

  return MissionState.CROSS_QA;
}

/**
 * Build analyst prompt with persona content
 */
async function buildAnalystPrompt(analyst: string, ticker: string, evidence: any): Promise<string> {
  // Load persona content from markdown file
  const personaContent = await loadPersonaForAgent(analyst);

  // Build market data section
  const marketData = evidence?.current_price
    ? `CURRENT MARKET DATA:
- Current Price: $${evidence.current_price}
- Market Cap: ${evidence.market_cap || 'UNKNOWN'}
- 52-Week High: $${evidence.week_52_high || 'UNKNOWN'}
- 52-Week Low: $${evidence.week_52_low || 'UNKNOWN'}
- As of: ${evidence.as_of_date || 'Recent'}`
    : '';

  const evidenceText = evidence?.financial_data
    ? `FINANCIAL DATA (Most Recent Quarter):
- Revenue: ${evidence.financial_data.revenue || 'UNKNOWN'}
- Net Income: ${evidence.financial_data.net_income || 'UNKNOWN'}
- EPS: ${evidence.financial_data.eps || 'UNKNOWN'}
- P/E Ratio: ${evidence.financial_data.pe_ratio || 'UNKNOWN'}`
    : 'Financial data not available';

  const businessText = evidence?.business_context?.business_model
    ? `Business Model: ${evidence.business_context.business_model}`
    : '';

  // Use persona content if available, otherwise fall back to generic prompt
  if (personaContent) {
    // Use the full persona content from markdown file
    return `You are analyzing ${ticker}.

${personaContent}

## Current Analysis Context:

${marketData}

${evidenceText}

${businessText}

Provide your analysis in the appropriate JSON format based on your persona's output requirements above.`;
  }

  // Fallback to generic prompt if persona not found
  switch (analyst) {
    case 'damodaran-valuation':
      return `You are Prof. Damodaran, performing a DCF valuation for ${ticker}.

${marketData}

${evidenceText}

${businessText}

IMPORTANT: The current stock price is $${evidence?.current_price || 'check research data'}. Your DCF valuation should be grounded in reality - compare your intrinsic value estimate to the current market price.

Provide a concise DCF analysis in JSON format:
{
  "fair_value": number (intrinsic value per share),
  "conviction_level": number (1-10),
  "view": string (brief valuation thesis, mention current price),
  "key_assumptions": array of strings,
  "what_would_change_my_mind": array of strings
}

If financial data is unavailable, use "UNKNOWN" and set conviction_level to 1.`;

    case 'klarman-downside':
      return `You are Seth Klarman, analyzing downside risk for ${ticker}.

${marketData}

${evidenceText}

${businessText}

IMPORTANT: Current price is $${evidence?.current_price || 'check research data'}. Your downside fair value should be BELOW this price to provide a margin of safety.

Provide a margin of safety analysis in JSON format:
{
  "fair_value": number (conservative downside estimate, below current price),
  "conviction_level": number (1-10),
  "view": string (risk analysis summary),
  "key_risks": array of strings,
  "what_would_change_my_mind": array of strings
}

Focus on what could go wrong and permanent loss risk.`;

    case 'portfolio-allocator':
      return `You are a Portfolio Manager, assessing position sizing for ${ticker}.

${marketData}

${evidenceText}

${businessText}

IMPORTANT: Current price is $${evidence?.current_price || 'check research data'}. Based on current valuation levels and the 52-week range ($${evidence?.week_52_low || 'N/A'}-$${evidence?.week_52_high || 'N/A'}), recommend position sizing.

Provide portfolio allocation guidance in JSON format:
{
  "position_size": number (max % of portfolio, 0-15%),
  "conviction_level": number (1-10),
  "view": string (portfolio fit summary, mention current price vs valuation),
  "entry_strategy": string,
  "what_would_change_my_mind": array of strings
}

Consider diversification and risk-adjusted returns.`;

    default:
      return `Analyze ${ticker} as a ${analyst} and provide your assessment in JSON format with: fair_value (number), conviction_level (1-10), view (string), and what_would_change_my_mind (array of strings).`;
  }
}

/**
 * Parse analyst output
 */
function parseAnalystOutput(agentId: string, content: string): AnalystOutputData {
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const data = JSON.parse(jsonMatch[0]);

      return {
        agent_id: agentId,
        fair_value: data.fair_value || data.position_size,
        conviction_level: data.conviction_level || 5,
        view: data.view || data.entry_strategy || 'No view provided',
        what_would_change_my_mind: data.what_would_change_my_mind || [],
        data_gaps: data.data_gaps || [],
      };
    }
  } catch (error) {
    // Parse failed
  }

  // Default output
  return {
    agent_id: agentId,
    conviction_level: 3,
    view: content.substring(0, 500),
    what_would_change_my_mind: [],
  };
}
