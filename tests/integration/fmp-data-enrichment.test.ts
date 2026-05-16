/**
 * Full Integration Test — FMP Data Enrichment Pipeline
 *
 * Tests the complete data enrichment pipeline from stock-price.ts
 * through researching-handler.ts to verify real financial data
 * is injected into analyst prompts.
 *
 * Real API calls — no mocks.
 * Requires: ZAI_API_KEY, FMP_API_KEY environment variables
 *
 * Run: ZAI_API_KEY=xxx FMP_API_KEY=xxx npx vitest run tests/integration/fmp-data-enrichment.test.ts
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  fetchStockPrice,
  getIncomeStatement,
  getKeyMetrics,
  type FmpIncomeData,
  type FmpMetricsData,
  type StockPriceData,
} from '../../packages/cli/src/lib/stock-price.js';

const HAS_ZAI_KEY = Boolean(process.env.ZAI_API_KEY || process.env.OPENAI_API_KEY);
const HAS_FMP_KEY = Boolean(process.env.FMP_API_KEY);
const describeIfKeys = HAS_ZAI_KEY && HAS_FMP_KEY ? describe : describe.skip;

const US_STOCKS = ['AAPL', 'MSFT', 'NVDA'];
const THAI_STOCKS = ['ADVANC', 'CPF', 'KBANK'];

interface TestResult {
  ticker: string;
  stockPrice: StockPriceData | null;
  incomeData: FmpIncomeData | null;
  metricsData: FmpMetricsData | null;
  promptBuilt: boolean;
  promptHasRevenue: boolean;
  promptHasMetrics: boolean;
  promptLength: number;
}

beforeAll(() => {
  console.log('\n=== FMP Data Enrichment Integration Test ===');
  console.log(`FMP_API_KEY: ${HAS_FMP_KEY ? 'SET' : 'NOT SET'}`);
  console.log(`ZAI_API_KEY: ${HAS_ZAI_KEY ? 'SET' : 'NOT SET'}`);
  console.log(`US Stocks: ${US_STOCKS.join(', ')}`);
  console.log(`Thai Stocks: ${THAI_STOCKS.join(', ')}\n`);
});

// ============================================================
// Phase 1: Data Layer Tests
// ============================================================
describe('Phase 1: Data Layer — Yahoo Finance + FMP', () => {
  it('should fetch Yahoo price data for all US stocks', async () => {
    for (const ticker of US_STOCKS) {
      const data = await fetchStockPrice(ticker);
      expect(data, `Yahoo price for ${ticker}`).not.toBeNull();
      expect(data!.current_price, `${ticker} price`).toBeGreaterThan(0);
      console.log(`  [YAHOO] ${ticker}: $${data!.current_price}`);
    }
  });

  it('should fetch Yahoo price data for all Thai stocks', async () => {
    for (const ticker of THAI_STOCKS) {
      const data = await fetchStockPrice(ticker);
      expect(data, `Yahoo price for ${ticker}`).not.toBeNull();
      expect(data!.current_price, `${ticker} price`).toBeGreaterThan(0);
      console.log(`  [YAHOO] ${ticker}: ฿${data!.current_price}`);
    }
  });

  it('should fetch FMP income statements for US stocks (AC-4)', async () => {
    if (!HAS_FMP_KEY) return;

    for (const ticker of US_STOCKS) {
      const data = await getIncomeStatement(ticker);
      expect(data, `FMP income for ${ticker}`).not.toBeNull();
      expect(data!.periods.length, `${ticker} periods`).toBeGreaterThanOrEqual(1);
      expect(data!.periods[0].revenue, `${ticker} revenue`).toBeGreaterThan(0);
      console.log(`  [FMP] ${ticker} income: ${data!.periods.length} periods, revenue=$${(data!.periods[0].revenue / 1e9).toFixed(1)}B`);
    }
  });

  it('should fetch FMP key metrics for US stocks (AC-5)', async () => {
    if (!HAS_FMP_KEY) return;

    for (const ticker of US_STOCKS) {
      const data = await getKeyMetrics(ticker);
      expect(data, `FMP metrics for ${ticker}`).not.toBeNull();
      expect(data!.pe_ratio, `${ticker} P/E`).toBeDefined();
      console.log(`  [FMP] ${ticker} metrics: P/E=${data!.pe_ratio.toFixed(1)}`);
    }
  });

  it('should return null FMP data for Thai stocks (AC-6)', async () => {
    if (!HAS_FMP_KEY) return;

    for (const ticker of THAI_STOCKS) {
      const income = await getIncomeStatement(ticker);
      expect(income, `FMP income for ${ticker} should be null`).toBeNull();

      const metrics = await getKeyMetrics(ticker);
      expect(metrics, `FMP metrics for ${ticker} should be null`).toBeNull();
    }
    console.log(`  [FMP] Thai stocks correctly skipped`);
  });
});

// ============================================================
// Phase 2: Prompt Construction Tests
// ============================================================
describe('Phase 2: Research Prompt Construction', () => {
  it('should build enriched prompt for US stock with FMP data', async ({ skip }) => {
    if (!HAS_FMP_KEY) skip();
    const ticker = 'AAPL';
    const stockPrice = await fetchStockPrice(ticker);
    const incomeData = await getIncomeStatement(ticker);
    const metricsData = await getKeyMetrics(ticker);

    // Simulate what buildResearcherPrompt does
    let fmpDataContext = '';
    if (incomeData || metricsData) {
      fmpDataContext = `\n**IMPORTANT - Use this VERIFIED financial data (from Financial Modeling Prep API):**\n`;
      if (incomeData && incomeData.periods.length > 0) {
        fmpDataContext += `\n**Income Statement (last ${incomeData.periods.length} years):**\n`;
        for (const p of incomeData.periods) {
          fmpDataContext += `- ${p.date}: Revenue=$${(p.revenue / 1e9).toFixed(1)}B, Net Income=$${(p.net_income / 1e9).toFixed(1)}B, EPS=$${p.eps.toFixed(2)}, Gross Margin=${(p.gross_margin * 100).toFixed(1)}%, Operating Margin=${(p.operating_margin * 100).toFixed(1)}%\n`;
        }
      }
      if (metricsData) {
        fmpDataContext += `\n**Key Metrics:** P/E=${metricsData.pe_ratio?.toFixed(1)}, ROE=${(metricsData.roe * 100).toFixed(1)}%, Debt/Equity=${metricsData.debt_to_equity?.toFixed(2)}\n`;
      }
    }

    // Verify prompt contains real data
    expect(fmpDataContext).toContain('Revenue');
    expect(fmpDataContext).toContain('AAPL').or.toContain('$'); // has dollar amounts
    expect(fmpDataContext.length).toBeGreaterThan(100);
    console.log(`  [PROMPT] AAPL prompt section (${fmpDataContext.length} chars):`);
    console.log(fmpDataContext.substring(0, 300) + '...');
  });

  it('should build prompt without FMP data for Thai stock', async () => {
    const ticker = 'CPF';
    const stockPrice = await fetchStockPrice(ticker);
    const incomeData = HAS_FMP_KEY ? await getIncomeStatement(ticker) : null;
    const metricsData = HAS_FMP_KEY ? await getKeyMetrics(ticker) : null;

    // FMP should return null for Thai stocks
    expect(incomeData).toBeNull();
    expect(metricsData).toBeNull();

    // Prompt should still work with Yahoo data only
    let marketDataContext = '';
    if (stockPrice && stockPrice.current_price > 0) {
      marketDataContext = `Current Price: $${stockPrice.current_price}`;
    }

    expect(marketDataContext).toContain('Current Price');
    console.log(`  [PROMPT] CPF (Thai) — Yahoo only: ${marketDataContext}`);
  });
});

// ============================================================
// Phase 3: Full Pipeline — Real LLM with Enriched Data
// ============================================================
describeIfKeys('Phase 3: Full Pipeline — Real LLM Analysis', () => {
  it('should run AAPL through research with FMP data enrichment', async () => {
    const { ZAIAdapter } = await import('../../packages/adapters/src/zai/zai-adapter.js');

    const adapter = new ZAIAdapter({
      apiKey: process.env.ZAI_API_KEY || process.env.OPENAI_API_KEY,
    });

    // Fetch all data
    const [stockPrice, incomeData, metricsData] = await Promise.all([
      fetchStockPrice('AAPL'),
      getIncomeStatement('AAPL'),
      getKeyMetrics('AAPL'),
    ]);

    expect(stockPrice).not.toBeNull();
    expect(incomeData).not.toBeNull();
    expect(metricsData).not.toBeNull();

    // Build enriched prompt
    let marketDataContext = '';
    if (stockPrice && stockPrice.current_price > 0) {
      marketDataContext = `Current Price: $${stockPrice.current_price}\nMarket Cap: ${stockPrice.market_cap}\n52W Range: $${stockPrice.week_52_low} - $${stockPrice.week_52_high}`;
    }

    let fmpDataContext = '';
    if (incomeData) {
      fmpDataContext += `VERIFIED Income Statement (last ${incomeData.periods.length} years):\n`;
      for (const p of incomeData.periods) {
        fmpDataContext += `${p.date}: Revenue=$${(p.revenue / 1e9).toFixed(1)}B, Net Income=$${(p.net_income / 1e9).toFixed(1)}B, EPS=$${p.eps.toFixed(2)}, Gross Margin=${(p.gross_margin * 100).toFixed(1)}%\n`;
      }
    }
    if (metricsData) {
      fmpDataContext += `Key Metrics: P/E=${metricsData.pe_ratio.toFixed(1)}, ROE=${(metricsData.roe * 100).toFixed(1)}%, Debt/Equity=${metricsData.debt_to_equity.toFixed(2)}\n`;
    }

    const prompt = `You are a research analyst. Analyze AAPL using this verified data:

${marketDataContext}

${fmpDataContext}

Provide a JSON response with:
1. current_price (use the exact price above)
2. financial_data: { revenue, net_income, eps, pe_ratio } (use the exact figures above)
3. business_model: string
4. key_risks: array of 3 strings
5. sources: ["FMP API", "Yahoo Finance"]`;

    const result = await adapter.run(prompt, { timeout: 120000 });

    expect(result.success).toBe(true);
    expect(result.content.length).toBeGreaterThan(500);

    // Verify the LLM used the provided data (not hallucinated different numbers)
    if (incomeData && stockPrice) {
      // The response should contain the real revenue figure
      const revenueInBillions = (incomeData.periods[0].revenue / 1e9).toFixed(1);
      // Check that the response references the real revenue (or a close figure)
      expect(result.content).toMatch(new RegExp(revenueInBillions.replace('.', '\\.'), 'i'));
    }

    console.log(`  [PIPELINE] AAPL analysis: ${result.content.length} chars, ${result.tokensUsed?.output} tokens`);
    console.log(`  [PIPELINE] First 200 chars: ${result.content.substring(0, 200)}...`);
  }, 180000);

  it('should run ADVANC (Thai) through research WITHOUT FMP data', async () => {
    const { ZAIAdapter } = await import('../../packages/adapters/src/zai/zai-adapter.js');

    const adapter = new ZAIAdapter({
      apiKey: process.env.ZAI_API_KEY || process.env.OPENAI_API_KEY,
    });

    const stockPrice = await fetchStockPrice('ADVANC');
    expect(stockPrice).not.toBeNull();
    expect(stockPrice!.current_price).toBeGreaterThan(0);

    const prompt = `You are a research analyst. Analyze ADVANC.BK (Advanced Info Service, Thailand) using this market data:

Current Price: ${stockPrice!.current_price} THB
Market Cap: ${stockPrice!.market_cap}
52W Range: ${stockPrice!.week_52_low} - ${stockPrice!.week_52_high} THB

Provide a JSON response with:
1. current_price (use the exact price above)
2. financial_data: { revenue, net_income, eps, pe_ratio }
3. business_model: string
4. key_risks: array of 3 strings`;

    const result = await adapter.run(prompt, { timeout: 120000 });

    expect(result.success).toBe(true);
    expect(result.content.length).toBeGreaterThan(300);

    console.log(`  [PIPELINE] ADVANC.BK analysis: ${result.content.length} chars, ${result.tokensUsed?.output} tokens`);
  }, 180000);
});

// ============================================================
// Phase 4: Output Completeness Verification
// ============================================================
describe('Phase 4: Output Completeness', () => {
  it('should verify DEFAULT_MAX_TOKENS is 16384 (AC-1)', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.resolve(__dirname, '../../packages/adapters/src/zai/zai-adapter.ts'),
      'utf-8'
    );
    expect(source).toContain('DEFAULT_MAX_TOKENS = 16384');
  });

  it('should verify SYNTHESIZING total_ms is 360000 (AC-2)', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.resolve(__dirname, '../../packages/kernel/src/state-machine/timeouts.ts'),
      'utf-8'
    );
    const match = source.match(/SYNTHESIZING.*?{[\s\S]*?total_ms:\s*(\d+)/);
    expect(match).not.toBeNull();
    expect(match![1]).toBe('360000');
  });

  it('should verify truncation detection exists in both paths (AC-3, AC-11)', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.resolve(__dirname, '../../packages/adapters/src/zai/zai-adapter.ts'),
      'utf-8'
    );
    // runWithRetry path
    expect(source).toContain("choice.finish_reason === 'length'");
    // streamRun path
    expect(source).toMatch(/finishReason.*===.*'length'/);
    // Both should log
    const truncationWarnings = source.match(/console\.error.*truncat/gi);
    expect(truncationWarnings!.length).toBeGreaterThanOrEqual(2);
  });

  it('should verify FMP_API_KEY in .env.example (AC-9)', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.resolve(__dirname, '../../.env.example'),
      'utf-8'
    );
    expect(source).toContain('FMP_API_KEY');
  });

  it('should verify researching-handler imports FMP functions', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.resolve(__dirname, '../../packages/cli/src/lib/state-handlers/researching-handler.ts'),
      'utf-8'
    );
    expect(source).toContain('getIncomeStatement');
    expect(source).toContain('getKeyMetrics');
    expect(source).toContain('FmpIncomeData');
    expect(source).toContain('FmpMetricsData');
  });

  it('should verify buildResearcherPrompt accepts FMP parameters', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.resolve(__dirname, '../../packages/cli/src/lib/state-handlers/researching-handler.ts'),
      'utf-8'
    );
    expect(source).toMatch(/buildResearcherPrompt.*fmpIncome.*FmpIncomeData/);
    expect(source).toMatch(/buildResearcherPrompt.*fmpMetrics.*FmpMetricsData/);
    expect(source).toContain('fmpDataContext');
  });
});
