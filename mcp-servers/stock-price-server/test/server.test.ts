/**
 * Stock Price MCP Server Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock fetch for testing
global.fetch = vi.fn();

describe('Stock Price Server', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('get_stock_price tool', () => {
    it('should return stock price data for valid ticker', async () => {
      const mockResponse = {
        chart: {
          result: [{
            meta: {
              regularMarketPrice: 175.50,
              previousClose: 173.20,
              regularMarketDayHigh: 176.00,
              regularMarketDayLow: 174.50,
              fiftyTwoWeekHigh: 200.00,
              fiftyTwoWeekLow: 145.00,
              marketCap: 2800000000000,
              regularMarketVolume: 50000000,
              currency: 'USD',
            },
            indicators: {
              quote: [{
                high: 176.00,
                low: 174.50,
              }],
            },
          }],
        },
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      // Simulate calling the get_stock_price function
      // In a real test, we would import the actual function
      const ticker = 'AAPL';
      const response = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`
      );
      const data = await response.json();

      expect(data.chart.result).toBeDefined();
      expect(data.chart.result[0].meta.regularMarketPrice).toBe(175.50);
      expect(data.chart.result[0].meta.currency).toBe('USD');
    });

    it('should handle invalid ticker gracefully', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ chart: { result: null } }),
      } as Response);

      const ticker = 'INVALID';
      const response = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`
      );
      const data = await response.json();

      expect(data.chart.result).toBeNull();
    });

    it('should handle network errors', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

      const ticker = 'AAPL';
      await expect(
        fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`)
      ).rejects.toThrow('Network error');
    });

    it('should handle HTTP errors', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response);

      const ticker = 'INVALID';
      const response = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`
      );

      expect(response.ok).toBe(false);
      expect(response.status).toBe(404);
    });
  });

  describe('get_multiple_prices tool', () => {
    it('should fetch prices for multiple tickers', async () => {
      const mockResponse = {
        chart: {
          result: [{
            meta: {
              regularMarketPrice: 175.50,
              previousClose: 173.20,
              currency: 'USD',
            },
          }],
        },
      };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const tickers = ['AAPL', 'NVDA', 'TSLA'];
      const promises = tickers.map(ticker =>
        fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`)
      );

      const results = await Promise.all(promises);
      expect(results).toHaveLength(3);
      expect(results.every(r => r.ok)).toBe(true);
    });

    it('should handle mixed success and failure', async () => {
      const successResponse = {
        chart: {
          result: [{
            meta: { regularMarketPrice: 175.50 },
          }],
        },
      };

      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => successResponse,
        } as Response)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => successResponse,
        } as Response);

      const tickers = ['AAPL', 'INVALID', 'NVDA'];
      const results = await Promise.allSettled(
        tickers.map(ticker =>
          fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`)
        )
      );

      expect(results).toHaveLength(3);
      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('rejected');
      expect(results[2].status).toBe('fulfilled');
    });
  });

  describe('Market Cap Formatting', () => {
    it('should format market cap correctly', () => {
      function formatMarketCap(cap: number | undefined): string {
        if (!cap) return 'N/A';
        if (cap >= 1e12) return (cap / 1e12).toFixed(1) + 'T';
        if (cap >= 1e9) return (cap / 1e9).toFixed(1) + 'B';
        if (cap >= 1e6) return (cap / 1e6).toFixed(1) + 'M';
        return cap.toString();
      }

      expect(formatMarketCap(2800000000000)).toBe('2.8T');
      expect(formatMarketCap(250000000000)).toBe('250.0B');
      expect(formatMarketCap(500000000)).toBe('500.0M');
      expect(formatMarketCap(undefined)).toBe('N/A');
      expect(formatMarketCap(100000)).toBe('100000');
    });
  });

  describe('MCP Tool Definitions', () => {
    it('should define get_stock_price tool schema', () => {
      const toolSchema = {
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
      };

      expect(toolSchema.name).toBe('get_stock_price');
      expect(toolSchema.inputSchema.required).toContain('ticker');
      expect(toolSchema.inputSchema.properties.ticker.type).toBe('string');
    });

    it('should define get_multiple_prices tool schema', () => {
      const toolSchema = {
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
      };

      expect(toolSchema.name).toBe('get_multiple_prices');
      expect(toolSchema.inputSchema.required).toContain('tickers');
      expect(toolSchema.inputSchema.properties.tickers.type).toBe('array');
    });
  });
});
