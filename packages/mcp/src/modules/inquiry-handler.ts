/**
 * Inquiry Handler
 *
 * MCP tools for the Inquiry System - direct questions with Thai ticker support
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';

export interface InquiryRequest {
  ticker: string;
  question: string;
}

/**
 * Thai ticker symbols that need .BK suffix
 */
const THAI_TICKERS = [
  'ACP', 'ADVANC', 'AOT', 'BDMS', 'BBL', 'BCP', 'BGH', 'BTS', 'CBG', 'CPALL',
  'CPF', 'CPN', 'DELTA', 'DTAC', 'EA', 'EGCO', 'EP', 'GULF', 'HMPRO', 'INTUCH',
  'IRPC', 'IVL', 'JAS', 'KBANK', 'KCE', 'KTC', 'LH', 'MINT', 'MTC', 'OR',
  'OSP', 'PTT', 'PTTEP', 'PTTGC', 'RATCH', 'SAWAD', 'SCC', 'STA',
  'TIDLOR', 'TISCO', 'TKC', 'TMB', 'TOP', 'TRUE', 'TU', 'VGI', 'WHA', 'WII'
];

/**
 * Auto-suffix Thai tickers with .BK
 * Returns the ticker with appropriate suffix
 */
export function normalizeThaiTicker(ticker: string): string {
  const upperTicker = ticker.toUpperCase().replace(/\.(BK|TB)$/i, '');

  // If already has suffix, return as-is
  if (ticker.toUpperCase().endsWith('.BK') || ticker.toUpperCase().endsWith('.TB')) {
    return ticker.toUpperCase();
  }

  // Check if it's a known Thai ticker
  if (THAI_TICKERS.includes(upperTicker)) {
    return `${upperTicker}.BK`;
  }

  // Return original if not Thai
  return ticker;
}

/**
 * Get inquiry tool definitions
 */
export function getInquiryTools(): Tool[] {
  return [
    {
      name: 'ask',
      description: `Ask a direct investment question about a stock ticker.

Supports both Thai and US stocks:
- Thai stocks (auto .BK suffix): CPALL, DELTA, ADVANC, CPF, KBANK, PTT, etc.
- US stocks: AAPL, MSFT, GOOGL, TSLA, etc.

This tool creates an inquiry mission that routes your question to appropriate analysts.

Examples:
- ask(ticker="CPALL", question="What's the fair value?")
- ask(ticker="DELTA.BK", question="ตามมุมมองดาโมดาลัน มีคำถามอะไรบ้าง")
- ask(ticker="AAPL", question="What are the key risks?")

**Note:** This is a simplified implementation. For full functionality, use the CLI:
npx @one4all/cli inquire --ticker CPALL --question "..."`,
      inputSchema: {
        type: 'object',
        properties: {
          ticker: {
            type: 'string',
            description: 'Stock ticker symbol (Thai stocks auto-get .BK suffix)',
          },
          question: {
            type: 'string',
            description: 'Your question in natural language (English or Thai)',
          },
        },
        required: ['ticker', 'question'],
      } as any,
    },
    {
      name: 'list_thai_tickers',
      description: 'List all Thai stock tickers that auto-get .BK suffix',
      inputSchema: {
        type: 'object',
        properties: {},
      } as any,
    },
  ];
}

/**
 * Handle ask tool call
 */
export async function handleAsk(args: InquiryRequest): Promise<{
  content: Array<{ type: string; text: string }>;
}> {
  try {
    const { ticker, question } = args;

    // Normalize Thai ticker
    const normalizedTicker = normalizeThaiTicker(ticker);
    console.log(`[INQUIRY MCP] Original ticker: ${ticker} → Normalized: ${normalizedTicker}`);

    // For MVP, return instructions
    const output = `# Inquiry Received

**Ticker:** ${normalizedTicker}${ticker !== normalizedTicker ? ` (normalized from ${ticker})` : ''}
**Question:** ${question}

## Next Steps

For full inquiry system functionality, please use the CLI:

\`\`\`bash
npx @one4all/cli inquire \\
  --ticker "${normalizedTicker}" \\
  --question "${question}"
\`\`\`

Or run from source:

\`\`\`bash
cd /home/dasimoa/one4all
npm run inquire -- --ticker "${normalizedTicker}" --question "${question}"
\`\`\`

## Thai Ticker Auto-Suffix

The following tickers automatically get the .BK suffix:

${THAI_TICKERS.map(t => `- ${t}`).join(', ')}.

Total: ${THAI_TICKERS.length} Thai tickers supported.
`;

    return {
      content: [{ type: 'text', text: output }],
    };
  } catch (error) {
    const errorMsg = `Inquiry error: ${error instanceof Error ? error.message : String(error)}`;
    return {
      content: [{ type: 'text', text: errorMsg }],
    };
  }
}

/**
 * Handle list_thai_tickers tool call
 */
export async function handleListThaiTickers(): Promise<{
  content: Array<{ type: string; text: string }>;
}> {
  const output = `## Thai Stock Tickers (Auto .BK Suffix)

The following tickers automatically get the .BK suffix:

${THAI_TICKERS.map(t => `- ${t}`).join('\n')}

## Usage

\`\`\`
ask(ticker="CPALL", question="What's the fair value?")
// Uses CPALL.BK

ask(ticker="AAPL", question="What are the risks?")
// Uses AAPL as-is
\`\`\`

Total: ${THAI_TICKERS.length} Thai tickers supported.
`;

  return {
    content: [{ type: 'text', text: output }],
  };
}
