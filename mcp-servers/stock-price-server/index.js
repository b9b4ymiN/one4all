#!/usr/bin/env node

/**
 * Stock Price MCP Server
 *
 * Provides real-time stock price tools to LLMs via Model Context Protocol
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// Fetch stock price from Yahoo Finance (unofficial, works for basic usage)
async function getStockPrice(ticker) {
  try {
    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!data.chart?.result?.[0]) {
      throw new Error('No data found');
    }

    const meta = data.chart.result[0].meta;
    const quote = data.chart.result[0].indicators?.quote?.[0];

    return {
      ticker: ticker.toUpperCase(),
      current_price: meta.regularMarketPrice,
      previous_close: meta.previousClose,
      day_high: quote?.high || meta.regularMarketDayHigh,
      day_low: quote?.low || meta.regularMarketDayLow,
      week_52_high: meta.fiftyTwoWeekHigh,
      week_52_low: meta.fiftyTwoWeekLow,
      market_cap: formatMarketCap(meta.marketCap),
      pe_ratio: quote?.regularMarketPrice ? (meta.regularMarketPrice / (quote?.regularMarketPrice || 1)).toFixed(2) : null,
      volume: meta.regularMarketVolume,
      currency: meta.currency,
      last_updated: new Date().toISOString(),
    };
  } catch (error) {
    throw new Error(`Failed to fetch ${ticker}: ${error.message}`);
  }
}

function formatMarketCap(cap) {
  if (!cap) return 'N/A';
  if (cap >= 1e12) return (cap / 1e12).toFixed(1) + 'T';
  if (cap >= 1e9) return (cap / 1e9).toFixed(1) + 'B';
  if (cap >= 1e6) return (cap / 1e6).toFixed(1) + 'M';
  return cap.toString();
}

// Create MCP server
const server = new Server(
  {
    name: 'stock-price-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'get_stock_price',
        description: 'Get current stock price and market data for a ticker symbol',
        inputSchema: {
          type: 'object',
          properties: {
            ticker: {
              type: 'string',
              description: 'Stock ticker symbol (e.g., AAPL, NVDA, TSLA)',
            },
          },
          required: ['ticker'],
        },
      },
      {
        name: 'get_multiple_prices',
        description: 'Get current prices for multiple stock tickers at once',
        inputSchema: {
          type: 'object',
          properties: {
            tickers: {
              type: 'array',
              items: { type: 'string' },
              description: 'Array of ticker symbols (e.g., ["AAPL", "NVDA", "TSLA"])',
            },
          },
          required: ['tickers'],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === 'get_stock_price') {
      const { ticker } = args;
      const data = await getStockPrice(ticker);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(data, null, 2),
          },
        ],
      };
    }

    if (name === 'get_multiple_prices') {
      const { tickers } = args;
      const promises = tickers.map((t) => getStockPrice(t));
      const results = await Promise.allSettled(promises);

      const data = results.map((result, i) => {
        if (result.status === 'fulfilled') {
          return result.value;
        }
        return {
          ticker: tickers[i].toUpperCase(),
          error: result.reason.message,
        };
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(data, null, 2),
          },
        ],
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ error: error.message }),
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('Stock Price MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
