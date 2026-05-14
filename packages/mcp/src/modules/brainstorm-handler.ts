/**
 * Brainstorm Handler
 *
 * MCP tools for One Man Company Brainstorming system
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { runBrainstorming, parseQuestionPerspective } from '@one4all/cli/lib/brainstorm.js';
import { fetchStockData } from '@one4all/adapters';

export interface BrainstormRequest {
  ticker: string;
  question: string;
  question_from?: string;
  include_analysts?: string[];
  max_responses?: number;
}

/**
 * Get brainstorming tool definitions
 */
export function getBrainstormTools(): Tool[] {
  return [
    {
      name: 'brainstorm',
      description: `Run a brainstorming session with multiple analyst perspectives.

Example questions:
- "ตามมุมมองดาโมดาลัน มีคำถามอะไรบ้างเพื่อเคลียร์ความกังวล"
- "What would Seth Klarman ask about downside risk?"
- "From the devil's advocate perspective, what could go wrong?"
- "What should I consider before investing?"

The system will query multiple analysts and synthesize their perspectives.`,
      inputSchema: {
        type: 'object',
        properties: {
          ticker: {
            type: 'string',
            description: 'Stock ticker symbol (e.g., AAPL, DELTA.BK)',
          },
          question: {
            type: 'string',
            description: 'Your question in natural language (English or Thai)',
          },
          question_from: {
            type: 'string',
            description: 'Optional: Override the perspective (e.g., "damodaran-valuation", "klarman-downside")',
          },
          include_analysts: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional: Specific analysts to include',
          },
          max_responses: {
            type: 'number',
            description: 'Maximum number of analyst responses (default: 5)',
          },
        },
        required: ['ticker', 'question'],
      } as any,
    },
    {
      name: 'ask_analyst',
      description: 'Ask a specific analyst a direct question',
      inputSchema: {
        type: 'object',
        properties: {
          ticker: {
            type: 'string',
            description: 'Stock ticker symbol',
          },
          analyst_id: {
            type: 'string',
            description: 'Analyst ID (e.g., "damodaran-valuation", "klarman-downside", "devil-advocate")',
          },
          question: {
            type: 'string',
            description: 'Your question',
          },
        },
        required: ['ticker', 'analyst_id', 'question'],
      } as any,
    },
    {
      name: 'list_analysts',
      description: 'List all available analyst personas',
      inputSchema: {
        type: 'object',
        properties: {},
      } as any,
    },
  ];
}

/**
 * Handle brainstorm tool call
 */
export async function handleBrainstorm(args: any): Promise<{
  content: Array<{ type: string; text: string }>;
}> {
  try {
    const { ticker, question, question_from, include_analysts, max_responses } = args;

    // Fetch market data
    console.log(`[BRAINSTORM MCP] Fetching data for ${ticker}...`);
    const marketData = await fetchStockData(ticker);

    if (!marketData) {
      return {
        content: [
          {
            type: 'text',
            text: `Could not fetch data for ticker: ${ticker}. Please verify the ticker symbol and try again.`,
          },
        ],
        isError: true,
      };
    }

    // Run brainstorming
    const result = await runBrainstorming(ticker, question, marketData, {
      question_from: question_from,
      include_analysts: include_analysts,
      max_responses: max_responses,
    });

    // Format output
    const output = formatBrainstormResult(result);

    return {
      content: [{ type: 'text', text: output }],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Brainstorming error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

/**
 * Handle ask_analyst tool call
 */
export async function handleAskAnalyst(args: any): Promise<{
  content: Array<{ type: string; text: text }>;
}> {
  try {
    const { ticker, analyst_id, question } = args;

    // Fetch market data
    const marketData = await fetchStockData(ticker);

    if (!marketData) {
      return {
        content: [
          {
            type: 'text',
            text: `Could not fetch data for ticker: ${ticker}`,
          },
        ],
        isError: true,
      };
    }

    // Run brainstorming with single analyst
    const result = await runBrainstorming(ticker, question, marketData, {
      include_analysts: [analyst_id],
      max_responses: 1,
    });

    const response = result.responses[0];

    if (!response) {
      return {
        content: [
          {
            type: 'text',
            text: `No response received from ${analyst_id}`,
          },
        ],
        isError: true,
      };
    }

    const output = `## ${analyst_id}

### Response
${response.response}

### Key Insights
${response.insights.map(i => `- ${i}`).join('\n')}

### What Would Change My Mind
${response.what_would_change_my_mind.map(w => `- ${w}`).join('\n') || 'None specified'}
`;

    return {
      content: [{ type: 'text', text: output }],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error asking ${args.analyst_id}: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

/**
 * Handle list_analysts tool call
 */
export async function handleListAnalysts(): Promise<{
  content: Array<{ type: string; text: string }>;
}> {
  const analysts = [
    { id: 'damodaran-valuation', name: 'Prof. Damodaran', focus: 'DCF Valuation' },
    { id: 'klarman-downside', name: 'Seth Klarman', focus: 'Margin of Safety / Downside Risk' },
    { id: 'devil-advocate', name: 'Devil\'s Advocate', focus: 'What Could Go Wrong' },
    { id: 'portfolio-manager', name: 'Portfolio Manager', focus: 'Position Sizing' },
    { id: 'consensus-analyst', name: 'Consensus Analyst', focus: 'Market Consensus' },
    { id: 'downside-protection', name: 'Downside Protection', focus: 'Capital Preservation' },
    { id: 'greenwald-evasion', name: 'Bruce Greenwald', focus: 'Earnings Power Value' },
    { id: 'kessler-moat', name: 'Kessler Moat', focus: 'Competitive Advantage' },
    { id: 'klamran-quality', name: 'Klamran Quality', focus: 'Business Quality' },
    { id: 'michael-burry', name: 'Michael Burry', focus: 'Contrarian Opportunities' },
    { id: 'allocator-steward', name: 'Allocator Steward', focus: 'Long-term Stewardship' },
    { id: 'leveraged-franchise', name: 'Leveraged Franchise', focus: 'Franchise Value' },
  ];

  const output = `## Available Analysts

${analysts.map(a => `- **${a.id}** (${a.name}): ${a.focus}`).join('\n')}

## Usage Examples

Ask a question from a specific perspective:
\`\`\`
brainstorm(ticker="AAPL", question="ตามมุมมองดาโมดาลัน มีคำถามอะไรบ้าง")
\`\`\`

Ask a specific analyst:
\`\`\`
ask_analyst(ticker="AAPL", analyst_id="devil-advocate", question="What risks am I missing?")
\`\`\`
`;

  return {
    content: [{ type: 'text', text: output }],
  };
}

/**
 * Format brainstorm result for display
 */
function formatBrainstormResult(result: any): string {
  let output = `# Brainstorming Session: ${result.ticker}\n\n`;

  output += `## Question\n${result.question}\n\n`;
  output += `**Perspective:** ${result.question_from}\n\n`;

  output += `## Analyst Responses\n\n`;

  for (const response of result.responses) {
    output += `### ${response.analyst_id}\n\n`;
    output += `${response.response}\n\n`;

    if (response.insights.length > 0) {
      output += `**Key Insights:**\n`;
      response.insights.forEach((insight: string) => {
        output += `- ${insight}\n`;
      });
      output += `\n`;
    }

    if (response.what_would_change_my_mind.length > 0) {
      output += `**What Would Change My Mind:**\n`;
      response.what_would_change_my_mind.forEach((thing: string) => {
        output += `- ${thing}\n`;
      });
      output += `\n`;
    }

    output += `---\n\n`;
  }

  output += `## Synthesis\n\n${result.synthesis}\n\n`;

  if (result.key_takeaways.length > 0) {
    output += `## Key Takeaways\n\n`;
    result.key_takeaways.forEach((takeaway: string) => {
      output += `- ${takeaway}\n`;
    });
    output += `\n`;
  }

  if (result.unresolved_questions.length > 0) {
    output += `## Unresolved Questions\n\n`;
    result.unresolved_questions.forEach((question: string) => {
      output += `- ${question}\n`;
    });
    output += `\n`;
  }

  return output;
}
