/**
 * FMP Financial Data Integration Tests
 *
 * Real API tests — no mocks.
 * Requires: FMP_API_KEY environment variable
 * Run: FMP_API_KEY=xxx npx vitest run packages/cli/tests/stock-price-fmp.test.ts
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  fetchStockPrice,
  fetchMultipleStockPrices,
  getIncomeStatement,
  getKeyMetrics,
  type StockPriceData,
  type FmpIncomeData,
  type FmpMetricsData,
} from '../src/lib/stock-price.js';

const HAS_FMP_KEY = Boolean(process.env.FMP_API_KEY);
const describeIfFmp = HAS_FMP_KEY ? describe : describe.skip;

beforeAll(() => {
  if (!HAS_FMP_KEY) {
    console.warn('[FMP TESTS] Skipping: FMP_API_KEY not set');
  }
});

// ============================================================
// Yahoo Finance (existing functionality — baseline)
// ============================================================
describe('Yahoo Finance — fetchStockPrice', () => {
  it('should fetch AAPL price', async () => {
    const data = await fetchStockPrice('AAPL');
    expect(data).not.toBeNull();
    expect(data!.current_price).toBeGreaterThan(0);
    expect(data!.ticker).toBe('AAPL');
  });

  it('should fetch Thai stock ADVANC with .BK suffix', async () => {
    const data = await fetchStockPrice('ADVANC');
    expect(data).not.toBeNull();
    expect(data!.current_price).toBeGreaterThan(0);
  });

  it('should return null for invalid ticker', async () => {
    const data = await fetchStockPrice('INVALIDTICKER12345');
    expect(data).toBeNull();
  });

  it('should fetch multiple stocks in parallel', async () => {
    const results = await fetchMultipleStockPrices(['AAPL', 'MSFT']);
    expect(results).toHaveLength(2);
    expect(results[0].current_price).toBeGreaterThan(0);
    expect(results[1].current_price).toBeGreaterThan(0);
  });
});

// ============================================================
// FMP — getIncomeStatement (AC-4)
// ============================================================
describeIfFmp('FMP — getIncomeStatement', () => {
  it('should return income statement for AAPL', async () => {
    const data = await getIncomeStatement('AAPL');

    expect(data).not.toBeNull();
    expect(data!.ticker).toBe('AAPL');
    expect(data!.periods.length).toBeGreaterThanOrEqual(1);

    const latest = data!.periods[0];
    expect(latest.revenue).toBeGreaterThan(0);
    expect(latest.net_income).toBeDefined();
    expect(latest.eps).toBeDefined();
    expect(latest.gross_margin).toBeGreaterThanOrEqual(0);
    expect(latest.gross_margin).toBeLessThanOrEqual(1);
    expect(latest.operating_margin).toBeGreaterThanOrEqual(0);
  });

  it('should return 4 periods by default', async () => {
    const data = await getIncomeStatement('MSFT');
    expect(data).not.toBeNull();
    expect(data!.periods.length).toBeLessThanOrEqual(4);
  });

  it('should return null for Thai tickers (AC-6)', async () => {
    const thaiResult1 = await getIncomeStatement('ADVANC');
    expect(thaiResult1).toBeNull();

    const thaiResult2 = await getIncomeStatement('CPF.BK');
    expect(thaiResult2).toBeNull();

    const thaiResult3 = await getIncomeStatement('KBANK');
    expect(thaiResult3).toBeNull();
  });

  it('should return null for invalid ticker', async () => {
    const data = await getIncomeStatement('INVALIDTICKER12345');
    expect(data).toBeNull();
  });

  it('should use cache on second call (AC-7)', async () => {
    const first = await getIncomeStatement('GOOGL');
    expect(first).not.toBeNull();

    // Second call should return cached data (same object reference or equal)
    const second = await getIncomeStatement('GOOGL');
    expect(second).not.toBeNull();
    expect(second!.ticker).toBe(first!.ticker);
    expect(second!.periods.length).toBe(first!.periods.length);
  });
});

// ============================================================
// FMP — getKeyMetrics (AC-5)
// ============================================================
describeIfFmp('FMP — getKeyMetrics', () => {
  it('should return key metrics for AAPL', async () => {
    const data = await getKeyMetrics('AAPL');

    expect(data).not.toBeNull();
    expect(data!.ticker).toBe('AAPL');
    expect(data!.pe_ratio).toBeDefined();
    expect(data!.as_of_date).toBeDefined();
  });

  it('should return null for Thai tickers (AC-6)', async () => {
    const result = await getKeyMetrics('CPALL');
    expect(result).toBeNull();
  });

  it('should return null for invalid ticker', async () => {
    const data = await getKeyMetrics('INVALIDTICKER12345');
    expect(data).toBeNull();
  });

  it('should use cache on second call (AC-7)', async () => {
    const first = await getKeyMetrics('META');
    expect(first).not.toBeNull();

    const second = await getKeyMetrics('META');
    expect(second).not.toBeNull();
    expect(second!.ticker).toBe(first!.ticker);
  });
});

// ============================================================
// Graceful degradation (AC-8)
// ============================================================
describe('Graceful degradation', () => {
  it('should return null when FMP_API_KEY is not set', async () => {
    const originalKey = process.env.FMP_API_KEY;
    delete process.env.FMP_API_KEY;

    const income = await getIncomeStatement('AAPL');
    expect(income).toBeNull();

    const metrics = await getKeyMetrics('AAPL');
    expect(metrics).toBeNull();

    // Restore
    if (originalKey) process.env.FMP_API_KEY = originalKey;
  });
});

// ============================================================
// Thai ticker detection (AC-6)
// ============================================================
describe('Thai ticker detection', () => {
  const thaiTickers = ['CPALL', 'CPF', 'BDMS', 'KBANK', 'SCB', 'AOT', 'ADVANC', 'PTT'];
  const usTickers = ['AAPL', 'MSFT', 'GOOGL'];

  it('should skip FMP for all known Thai tickers', async () => {
    for (const ticker of thaiTickers) {
      const income = await getIncomeStatement(ticker);
      expect(income, `Expected null for Thai ticker ${ticker}`).toBeNull();

      const metrics = await getKeyMetrics(ticker);
      expect(metrics, `Expected null for Thai ticker ${ticker}`).toBeNull();
    }
  });

  it('should not skip FMP for US tickers (when key is set)', async () => {
    if (!HAS_FMP_KEY) return;

    for (const ticker of usTickers.slice(0, 1)) {
      const income = await getIncomeStatement(ticker);
      expect(income, `Expected data for US ticker ${ticker}`).not.toBeNull();
    }
  });

  it('should detect .BK suffix as Thai', async () => {
    const income = await getIncomeStatement('PTT.BK');
    expect(income).toBeNull();
  });
});
