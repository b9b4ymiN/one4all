/**
 * @one4all/mcp-server
 *
 * Unified MCP server for the one4all system
 * Combines mission management, stock price tools, and journal operations
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type {
  Tool,
  Resource,
  Prompt,
  CallToolRequest,
  ReadResourceRequest,
  GetPromptRequest,
} from '@modelcontextprotocol/sdk/types.js';

/**
 * Unified MCP Server configuration
 */
export interface UnifiedMCPServerConfig {
  name?: string;
  version?: string;
  enableStockTools?: boolean;
  enableMissionTools?: boolean;
}

/**
 * Fetch stock price from Yahoo Finance
 */
async function getStockPrice(ticker: string) {
  try {
    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json() as any;

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
      volume: meta.regularMarketVolume,
      currency: meta.currency,
      last_updated: new Date().toISOString(),
    };
  } catch (error) {
    throw new Error(`Failed to fetch ${ticker}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function formatMarketCap(cap: number | undefined): string {
  if (!cap) return 'N/A';
  if (cap >= 1e12) return (cap / 1e12).toFixed(1) + 'T';
  if (cap >= 1e9) return (cap / 1e9).toFixed(1) + 'B';
  if (cap >= 1e6) return (cap / 1e6).toFixed(1) + 'M';
  return cap.toString();
}

/**
 * Unified MCP Server
 *
 * Provides mission management and stock price tools via MCP protocol
 */
export class UnifiedMCPServer {
  private server: Server;
  private config: Required<UnifiedMCPServerConfig>;

  constructor(config: UnifiedMCPServerConfig = {}) {
    this.config = {
      name: config.name || 'one4all-unified-server',
      version: config.version || '1.0.0',
      enableStockTools: config.enableStockTools ?? true,
      enableMissionTools: config.enableMissionTools ?? true,
    };

    this.server = new Server(
      {
        name: this.config.name,
        version: this.config.version,
      },
      {
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
        },
      }
    );

    this.setupHandlers();
  }

  /**
   * Set up request handlers
   */
  private setupHandlers(): void {
    // Tool handlers
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: this.getToolDefinitions(),
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) =>
      this.handleCallTool(request)
    );

    // Resource handlers
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: this.getResourceDefinitions(),
    }));

    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) =>
      this.handleReadResource(request)
    );

    // Prompt handlers
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => ({
      prompts: this.getPromptDefinitions(),
    }));

    this.server.setRequestHandler(GetPromptRequestSchema, async (request) =>
      this.handleGetPrompt(request)
    );
  }

  /**
   * Get tool definitions
   */
  private getToolDefinitions(): Tool[] {
    const tools: Tool[] = [];

    // Stock price tools
    if (this.config.enableStockTools) {
      tools.push(
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
                description: 'Array of stock ticker symbols',
              },
            },
            required: ['tickers'],
          },
        }
      );
    }

    // Mission management tools (placeholder for integration with @one4all/mcp)
    if (this.config.enableMissionTools) {
      tools.push(
        {
          name: 'create_mission',
          description: 'Create a new investment analysis mission',
          inputSchema: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                enum: ['stock_analysis', 'portfolio_review', 'quick_screen'],
                description: 'Type of analysis',
              },
              domain: {
                type: 'string',
                description: 'Domain for the analysis (e.g., investment-war-room)',
              },
              description: {
                type: 'string',
                description: 'Description of the analysis request',
              },
              ticker: {
                type: 'string',
                description: 'Stock ticker symbol (for stock_analysis)',
              },
            },
            required: ['type', 'domain', 'description'],
          },
        },
        {
          name: 'get_mission_status',
          description: 'Get the current status of a mission',
          inputSchema: {
            type: 'object',
            properties: {
              mission_id: {
                type: 'string',
                description: 'Mission ID to check',
              },
            },
            required: ['mission_id'],
          },
        },
        {
          name: 'list_missions',
          description: 'List all missions with optional filtering',
          inputSchema: {
            type: 'object',
            properties: {
              state: {
                type: 'string',
                description: 'Filter by state',
              },
              domain: {
                type: 'string',
                description: 'Filter by domain',
              },
              limit: {
                type: 'number',
                description: 'Maximum number of missions to return',
              },
            },
          },
        }
      );
    }

    return tools;
  }

  /**
   * Handle tool execution
   */
  private async handleCallTool(request: any): Promise<{
    content: Array<{ type: string; text: string }>;
    isError?: boolean;
  }> {
    const params = (request as any).params || request;
    const { name, arguments: args } = params;

    try {
      switch (name) {
        // Stock price tools
        case 'get_stock_price':
          return await this.handleGetStockPrice(args);

        case 'get_multiple_prices':
          return await this.handleGetMultiplePrices(args);

        // Mission management tools
        case 'create_mission':
        case 'get_mission_status':
        case 'list_missions':
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    note: 'Mission management tools require @one4all/mcp integration. Use @one4all/mcp package directly.',
                    tool: name,
                    arguments: args,
                  },
                  null,
                  2
                ),
              },
            ],
          };

        default:
          return {
            content: [{ type: 'text', text: `Unknown tool: ${name}` }],
            isError: true,
          };
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error executing ${name}: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }

  /**
   * Get stock price for a single ticker
   */
  private async handleGetStockPrice(args: any): Promise<{
    content: Array<{ type: string; text: string }>;
    isError?: boolean;
  }> {
    const { ticker } = args;

    if (!ticker) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: 'Ticker is required' }, null, 2),
          },
        ],
        isError: true,
      };
    }

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

  /**
   * Get stock prices for multiple tickers
   */
  private async handleGetMultiplePrices(args: any): Promise<{
    content: Array<{ type: string; text: string }>;
    isError?: boolean;
  }> {
    const { tickers } = args;

    if (!Array.isArray(tickers) || tickers.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: 'Tickers array is required' }, null, 2),
          },
        ],
        isError: true,
      };
    }

    const results = await Promise.allSettled(
      tickers.map((ticker: string) => getStockPrice(ticker))
    );

    const prices = results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          ticker: tickers[index].toUpperCase(),
          error: result.reason instanceof Error ? result.reason.message : String(result.reason),
        };
      }
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(prices, null, 2),
        },
      ],
    };
  }

  /**
   * Get resource definitions
   */
  private getResourceDefinitions(): Resource[] {
    return [
      {
        uri: 'stock://prices',
        name: 'Stock Prices',
        description: 'Real-time stock price information',
        mimeType: 'application/json',
      },
      {
        uri: 'system://health',
        name: 'System Health',
        description: 'Server health status',
        mimeType: 'application/json',
      },
    ];
  }

  /**
   * Handle resource reading
   */
  private async handleReadResource(request: any): Promise<{
    contents: Array<{ uri: string; mimeType: string; text?: string }>;
  }> {
    const params = (request as any).params || request;
    const { uri } = params;

    switch (uri) {
      case 'stock://prices':
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify({
                service: 'Yahoo Finance',
                last_updated: new Date().toISOString(),
                note: 'Use get_stock_price or get_multiple_prices tools for specific tickers',
              }, null, 2),
            },
          ],
        };

      case 'system://health':
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify({
                status: 'healthy',
                server: this.config.name,
                version: this.config.version,
                stock_tools_enabled: this.config.enableStockTools,
                mission_tools_enabled: this.config.enableMissionTools,
                timestamp: new Date().toISOString(),
              }, null, 2),
            },
          ],
        };

      default:
        throw new Error(`Unknown resource: ${uri}`);
    }
  }

  /**
   * Get prompt definitions
   */
  private getPromptDefinitions(): Prompt[] {
    return [
      {
        name: 'stock_analysis',
        description: 'Start a stock analysis with current price data',
        arguments: [
          {
            name: 'ticker',
            description: 'Stock ticker symbol',
            required: true,
          },
          {
            name: 'focus',
            description: 'Analysis focus (valuation, growth, risk, etc.)',
            required: false,
          },
        ],
      },
      {
        name: 'portfolio_check',
        description: 'Check current prices for a portfolio of stocks',
        arguments: [
          {
            name: 'tickers',
            description: 'Comma-separated list of tickers',
            required: true,
          },
        ],
      },
    ];
  }

  /**
   * Handle get prompt
   */
  private async handleGetPrompt(request: any): Promise<{
    messages: Array<{ role: string; content: { type: string; text: string } }>;
  }> {
    const params = (request as any).params || request;
    const { name, arguments: args } = params;

    switch (name) {
      case 'stock_analysis': {
        const ticker = args?.ticker || 'UNKNOWN';
        const focus = args?.focus || 'comprehensive analysis';

        return {
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `Please conduct a ${focus} of ${ticker}.\n\nUse the get_stock_price tool to fetch current market data, then provide your analysis.`,
              },
            },
          ],
        };
      }

      case 'portfolio_check': {
        const tickers = args?.tickers || '';

        return {
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `Please check the current prices for these stocks: ${tickers}\n\nUse the get_multiple_prices tool with these tickers: [${tickers.split(',').map((t: string) => `"${t.trim()}"`).join(', ')}]`,
              },
            },
          ],
        };
      }

      default:
        return {
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `Unknown prompt: ${name}`,
              },
            },
          ],
        };
    }
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }

  /**
   * Get the underlying MCP server
   */
  getServer(): Server {
    return this.server;
  }
}

/**
 * Create and start a unified MCP server
 */
export async function createMCPServer(config?: UnifiedMCPServerConfig): Promise<UnifiedMCPServer> {
  const server = new UnifiedMCPServer(config);
  await server.start();
  return server;
}
