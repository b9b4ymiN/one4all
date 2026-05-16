#!/usr/bin/env node

/**
 * one4all Full Integration Test — Thai + US Stocks
 *
 * Tests the complete investment analysis pipeline with REAL API calls.
 * No mocks. Uses ZAI API (glm-4.5) as primary provider.
 * Now with FMP data enrichment for US stocks.
 *
 * Run: node run-full-integration-test.mjs
 * Requires: ZAI_API_KEY env var
 * Optional: FMP_API_KEY env var for financial statement enrichment
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';

// ============================================================
// Configuration
// ============================================================

const ZAI_API_KEY = process.env.ZAI_API_KEY || process.env.OPENAI_API_KEY;
const FMP_API_KEY = process.env.FMP_API_KEY;
const ZAI_BASE_URL = process.env.ZAI_BASE_URL || 'https://api.z.ai/api/coding/paas/v4';
const MODEL = 'glm-4.5';
const MAX_TOKENS = 16384; // Updated from 4096
const TIMEOUT_MS = 240000; // 4 minutes per call

if (!ZAI_API_KEY) {
  console.error('ERROR: ZAI_API_KEY or OPENAI_API_KEY environment variable is required');
  process.exit(1);
}

// ============================================================
// Test Cases
// ============================================================

const TEST_CASES = [
  // Thai Stocks
  { id: 'TH-1', ticker: 'ADVANC.BK', agent: 'Damodaran DCF Valuation', lang: 'th' },
  { id: 'TH-2', ticker: 'CPF.BK',    agent: 'Seth Klarman Downside Protection', lang: 'th' },
  { id: 'TH-3', ticker: 'KBANK.BK',   agent: 'Michael Burry Forensic Analysis', lang: 'th' },
  // US Stocks
  { id: 'US-1', ticker: 'AAPL', agent: 'Damodaran DCF Valuation', lang: 'en' },
  { id: 'US-2', ticker: 'TSLA', agent: 'Klarman Downside Protection', lang: 'en' },
  { id: 'US-3', ticker: 'NVDA', agent: 'Kessler Moat Analysis', lang: 'en' },
];

// ============================================================
// Data Fetching
// ============================================================

const fmpCache = new Map();

async function fetchYahooPrice(ticker) {
  try {
    // Normalize Thai tickers
    let normalized = ticker;
    const thaiTickers = ['CPALL','CPF','BDMS','KBANK','SCB','AOT','ADVANC','PTT','PTTEP','TU','TRUE','DTAC','LH','SF','MFC','TISCO','BBL','KTB','CIMBT','BAY','TMB','BAFS','GPSC','GLOW','RATCH','BGRIM','EA','EGCO','QH','BPP','WHA','AMATA'];
    const base = ticker.replace('.BK', '').toUpperCase();
    if (thaiTickers.includes(base)) {
      normalized = base + '.BK';
    }

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${normalized}?interval=1d&range=1d`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!resp.ok) return null;
    const data = await resp.json();
    if (!data.chart?.result?.[0]) return null;

    const meta = data.chart.result[0].meta;
    return {
      price: meta.regularMarketPrice || 0,
      prevClose: meta.previousClose,
      week52High: meta.fiftyTwoWeekHigh,
      week52Low: meta.fiftyTwoWeekLow,
      marketCap: meta.marketCap ? formatMarketCap(meta.marketCap) : null,
      currency: meta.currency,
    };
  } catch {
    return null;
  }
}

function formatMarketCap(cap) {
  if (cap >= 1e12) return (cap / 1e12).toFixed(1) + 'T';
  if (cap >= 1e9) return (cap / 1e9).toFixed(1) + 'B';
  if (cap >= 1e6) return (cap / 1e6).toFixed(1) + 'M';
  return cap.toString();
}

function isThaiTicker(ticker) {
  const thaiTickers = ['CPALL','CPF','BDMS','KBANK','SCB','AOT','ADVANC','PTT','PTTEP','TU','TRUE','DTAC','LH','SF','MFC','TISCO','BBL','KTB','CIMBT','BAY','TMB','BAFS','GPSC','GLOW','RATCH','BGRIM','EA','EGCO','QH','BPP','WHA','AMATA'];
  const base = ticker.replace('.BK', '').toUpperCase();
  return thaiTickers.includes(base) || ticker.toUpperCase().endsWith('.BK');
}

async function fetchFmpIncome(ticker) {
  if (!FMP_API_KEY || isThaiTicker(ticker)) return null;
  const cacheKey = `income-${ticker}`;
  if (fmpCache.has(cacheKey)) return fmpCache.get(cacheKey);

  try {
    const url = `https://financialmodelingprep.com/api/v3/income-statement/${ticker}?apikey=${FMP_API_KEY}&limit=4`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!resp.ok) return null;
    const data = await resp.json();
    if (!Array.isArray(data) || data.length === 0) return null;

    const periods = data.map(item => ({
      date: item.date,
      revenue: Number(item.revenue) || 0,
      netIncome: Number(item.netIncome) || 0,
      eps: Number(item.eps) || 0,
      grossMargin: (Number(item.revenue) > 0) ? (Number(item.grossProfit) || 0) / Number(item.revenue) : 0,
      operatingMargin: (Number(item.revenue) > 0) ? (Number(item.operatingIncome) || 0) / Number(item.revenue) : 0,
    }));

    fmpCache.set(cacheKey, periods);
    return periods;
  } catch {
    return null;
  }
}

async function fetchFmpMetrics(ticker) {
  if (!FMP_API_KEY || isThaiTicker(ticker)) return null;
  const cacheKey = `metrics-${ticker}`;
  if (fmpCache.has(cacheKey)) return fmpCache.get(cacheKey);

  try {
    const url = `https://financialmodelingprep.com/api/v3/key-metrics/${ticker}?apikey=${FMP_API_KEY}&limit=1`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!resp.ok) return null;
    const data = await resp.json();
    if (!Array.isArray(data) || data.length === 0) return null;

    const item = data[0];
    const result = {
      peRatio: Number(item.peRatio) || 0,
      roe: Number(item.returnOnEquity) || 0,
      roa: Number(item.returnOnAssets) || 0,
      debtToEquity: Number(item.debtToEquity) || 0,
      currentRatio: Number(item.currentRatio) || 0,
    };
    fmpCache.set(cacheKey, result);
    return result;
  } catch {
    return null;
  }
}

// ============================================================
// Prompt Builders
// ============================================================

function buildMarketDataContext(priceData, ticker) {
  if (!priceData || priceData.price <= 0) return '';
  const lines = [
    `\n**IMPORTANT — Use this ACCURATE real-time market data (from Yahoo Finance):**`,
    `- Current Price: ${priceData.currency === 'THB' ? '฿' : '$'}${priceData.price}`,
    `- 52-Week High: ${priceData.week52High || 'N/A'}`,
    `- 52-Week Low: ${priceData.week52Low || 'N/A'}`,
    `- Market Cap: ${priceData.marketCap || 'N/A'}`,
    `- Currency: ${priceData.currency || 'USD'}`,
    ``,
    `Do NOT estimate or guess different prices. Use these values as the source of truth.`,
  ];
  return lines.join('\n');
}

function buildFmpDataContext(incomeData, metricsData) {
  if (!incomeData && !metricsData) return '';

  const lines = [`\n**IMPORTANT — Use this VERIFIED financial data (from Financial Modeling Prep API):**`];

  if (incomeData && incomeData.length > 0) {
    lines.push(`\n**Income Statement (last ${incomeData.length} years):**`);
    for (const p of incomeData) {
      lines.push(`- ${p.date}: Revenue=$${(p.revenue / 1e9).toFixed(1)}B, Net Income=$${(p.netIncome / 1e9).toFixed(1)}B, EPS=$${p.eps.toFixed(2)}, Gross Margin=${(p.grossMargin * 100).toFixed(1)}%, Operating Margin=${(p.operatingMargin * 100).toFixed(1)}%`);
    }
    lines.push(`\nDo NOT estimate or guess different financial figures. Use these values as the source of truth.`);
  }

  if (metricsData) {
    lines.push(`\n**Key Metrics:** P/E=${metricsData.peRatio.toFixed(1)}, ROE=${(metricsData.roe * 100).toFixed(1)}%, ROA=${(metricsData.roa * 100).toFixed(1)}%, Debt/Equity=${metricsData.debtToEquity.toFixed(2)}, Current Ratio=${metricsData.currentRatio.toFixed(2)}`);
  }

  return lines.join('\n');
}

const AGENT_PROMPTS = {
  'Damodaran DCF Valuation': (ticker, lang, marketData, fmpData) => {
    const prefix = lang === 'th'
      ? `คุณคือ Aswath Damodaran ศาสตราจารย์ด้านการประเมินมูลค่า วิเคราะห์ ${ticker} ด้วย DCF Valuation`
      : `You are Aswath Damodaran, Professor of Valuation. Perform a DCF Valuation analysis for ${ticker}.`;
    return `${prefix}

${marketData}
${fmpData}

${lang === 'th' ? 'คำนวณมูลค่าพื้นฐานต่อหุ้น (Intrinsic Value per Share) พร้อมแสดง:' : 'Calculate the Intrinsic Value per Share, showing:'}
${lang === 'th' ? '1. คำนวณ Free Cash Flow ปัจจุบัน' : '1. Calculate current Free Cash Flow'}
${lang === 'th' ? '2. ใช้ Gordon Growth Model หรือ 2-stage DCF' : '2. Use Gordon Growth Model or 2-stage DCF'}
${lang === 'th' ? '3. คำนวณ WACC และ Terminal Value' : '3. Calculate WACC and Terminal Value'}
${lang === 'th' ? '4. สรุป Fair Value และ Margin of Safety' : '4. Summarize Fair Value and Margin of Safety'}

${lang === 'th' ? 'ตอบเป็นภาษาไทย ละเอียด พร้อมตัวเลข อย่าตัดทอน' : 'Be detailed with specific numbers. Do not truncate.'}`;
  },

  'Seth Klarman Downside Protection': (ticker, lang, marketData, fmpData) => {
    const prefix = lang === 'th'
      ? `คุณคือ Seth Klarman ผู้เชี่ยวชาญด้าน Downside Protection วิเคราะห์ ${ticker}`
      : `You are Seth Klarman, downside protection expert. Analyze ${ticker}.`;
    return `${prefix}

${marketData}
${fmpData}

${lang === 'th' ? 'วิเคราะห์ Downside Floor ภายใต้ Worst-Case Scenarios:' : 'Analyze Downside Floor under Worst-Case Scenarios:'}
${lang === 'th' ? '1. สถานการณ์เสี่ยงรุนแรง 3 กรณี' : '1. Three severe risk scenarios'}
${lang === 'th' ? '2. คำนวณ Liquidation Value และ Asset Floor' : '2. Calculate Liquidation Value and Asset Floor'}
${lang === 'th' ? '3. ประเมิน Margin of Safety' : '3. Assess Margin of Safety'}
${lang === 'th' ? '4. สรุป Downside Floor และคำแนะนำ' : '4. Summarize Downside Floor and recommendation'}

${lang === 'th' ? 'ตอบเป็นภาษาไทย ละเอียด พร้อมตัวเลข อย่าตัดทอน' : 'Be detailed with specific numbers. Do not truncate.'}`;
  },

  'Michael Burry Forensic Analysis': (ticker, lang, marketData, fmpData) => {
    const prefix = lang === 'th'
      ? `คุณคือ Michael Burry นักวิเคราะห์ Forensic Accounting วิเคราะห์ ${ticker}`
      : `You are Michael Burry, forensic accounting analyst. Analyze ${ticker}.`;
    return `${prefix}

${marketData}
${fmpData}

${lang === 'th' ? 'วิเคราะห์ Forensic Accounting:' : 'Perform Forensic Accounting Analysis:'}
${lang === 'th' ? '1. ตรวจสอบคุณภาพงบการเงิน' : '1. Examine financial statement quality'}
${lang === 'th' ? '2. ตรวจจับสัญญาณ Red Flags' : '2. Detect Red Flags'}
${lang === 'th' ? '3. วิเคราะห์ Cash Flow vs Net Income' : '3. Analyze Cash Flow vs Net Income'}
${lang === 'th' ? '4. สรุปความเสี่ยงและข้อค้นพบ' : '4. Summarize risks and findings'}

${lang === 'th' ? 'ตอบเป็นภาษาไทย ละเอียด พร้อมตัวเลข อย่าตัดทอน' : 'Be detailed with specific numbers. Do not truncate.'}`;
  },

  'Klarman Downside Protection': (ticker, lang, marketData, fmpData) => {
    return AGENT_PROMPTS['Seth Klarman Downside Protection'](ticker, lang, marketData, fmpData);
  },

  'Kessler Moat Analysis': (ticker, lang, marketData, fmpData) => {
    const prefix = lang === 'th'
      ? `คุณคือ Andy Kessler ผู้เชี่ยวชาญด้าน Moat Analysis วิเคราะห์ ${ticker}`
      : `You are Andy Kessler, competitive moat analyst. Analyze ${ticker}.`;
    return `${prefix}

${marketData}
${fmpData}

${lang === 'th' ? 'วิเคราะห์ Competitive Moat:' : 'Analyze Competitive Moat:'}
${lang === 'th' ? '1. ประเมิน Network Effects, Switching Costs, Brand' : '1. Assess Network Effects, Switching Costs, Brand'}
${lang === 'th' ? '2. วิเคราะห์ Barriers to Entry' : '2. Analyze Barriers to Entry'}
${lang === 'th' ? '3. เปรียบเทียบกับคู่แข่ง' : '3. Compare with competitors'}
${lang === 'th' ? '4. สรุป Moat Strength (1-10)' : '4. Summarize Moat Strength (1-10)'}

${lang === 'th' ? 'ตอบเป็นภาษาไทย ละเอียด พร้อมตัวเลข อย่าตัดทอน' : 'Be detailed with specific numbers. Do not truncate.'}`;
  },
};

// ============================================================
// LLM Call
// ============================================================

async function callLLM(prompt) {
  const start = Date.now();
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(`${ZAI_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ZAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: MAX_TOKENS,
          temperature: 0.7,
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      if (!response.ok) {
        const body = await response.text();
        if ((response.status === 429 || response.status >= 500) && attempt < 2) {
          await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
          continue;
        }
        throw new Error(`HTTP ${response.status}: ${body.substring(0, 200)}`);
      }

      const data = await response.json();
      const choice = data.choices?.[0];
      const content = choice?.message?.content || choice?.message?.reasoning_content || '';
      const finishReason = choice?.finish_reason;
      const duration = Date.now() - start;
      const outputTokens = data.usage?.completion_tokens || 0;
      const inputTokens = data.usage?.prompt_tokens || 0;

      if (finishReason === 'length') {
        console.warn(`  [WARN] Output truncated at ${outputTokens} tokens for ${MODEL}`);
      }

      return {
        success: true,
        content,
        duration,
        tokens: { input: inputTokens, output: outputTokens, total: inputTokens + outputTokens },
        finishReason,
        truncated: finishReason === 'length',
      };
    } catch (error) {
      if (attempt < 2 && (error.message?.includes('429') || error.message?.includes('500') || error.name === 'AbortError')) {
        await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
        continue;
      }
      return {
        success: false,
        content: '',
        duration: Date.now() - start,
        tokens: { input: 0, output: 0, total: 0 },
        error: error.message,
      };
    }
  }
}

// ============================================================
// Main Test Runner
// ============================================================

async function runTests() {
  const testStartTime = Date.now();
  const results = [];

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║  one4all Integration Test v2.0 — Thai + US Stocks          ║');
  console.log('║  with FMP Data Enrichment                                  ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`\nDate: ${new Date().toISOString()}`);
  console.log(`Provider: ZAI API (${MODEL})`);
  console.log(`MAX_TOKENS: ${MAX_TOKENS} (updated from 4096)`);
  console.log(`FMP Enrichment: ${FMP_API_KEY ? 'ENABLED' : 'DISABLED (no FMP_API_KEY)'}`);
  console.log('');

  // ---------- THAI STOCKS ----------
  console.log('========== THAI STOCKS (3 Questions) ==========\n');

  for (const tc of TEST_CASES.filter(t => t.id.startsWith('TH'))) {
    console.log(`[${tc.id}] ${tc.ticker} - ${tc.agent}`);

    // Fetch data
    const priceData = await fetchYahooPrice(tc.ticker);
    const incomeData = await fetchFmpIncome(tc.ticker); // Will be null for Thai
    const metricsData = await fetchFmpMetrics(tc.ticker); // Will be null for Thai

    const marketData = buildMarketDataContext(priceData, tc.ticker);
    const fmpData = buildFmpDataContext(incomeData, metricsData);

    if (priceData) {
      console.log(`  Price: ${priceData.currency === 'THB' ? '฿' : '$'}${priceData.price} (Yahoo Finance)`);
    } else {
      console.log(`  Price: N/A (will use LLM estimate)`);
    }

    // Build prompt
    const promptBuilder = AGENT_PROMPTS[tc.agent];
    const prompt = promptBuilder(tc.ticker, tc.lang, marketData, fmpData);

    // Run LLM
    const result = await callLLM(prompt);

    const status = result.success ? 'SUCCESS' : 'FAILED';
    const truncated = result.truncated ? ' [TRUNCATED]' : '';
    console.log(`[${tc.id}] ${status}${truncated} (${result.duration}ms, ${result.tokens.total} tokens)`);

    if (result.success && result.content) {
      const preview = result.content.substring(0, 200).replace(/\n/g, ' ');
      console.log(`  Output: ${preview}${result.content.length > 200 ? '...' : ''}`);
    } else {
      console.log(`  Error: ${result.error}`);
    }
    console.log('');

    results.push({ ...tc, ...result, priceData, fmpEnriched: !!incomeData || !!metricsData });
  }

  // ---------- US STOCKS ----------
  console.log('========== US STOCKS (3 Questions) ==========\n');

  for (const tc of TEST_CASES.filter(t => t.id.startsWith('US'))) {
    console.log(`[${tc.id}] ${tc.ticker} - ${tc.agent}`);

    // Fetch data
    const priceData = await fetchYahooPrice(tc.ticker);
    const incomeData = await fetchFmpIncome(tc.ticker);
    const metricsData = await fetchFmpMetrics(tc.ticker);

    const marketData = buildMarketDataContext(priceData, tc.ticker);
    const fmpData = buildFmpDataContext(incomeData, metricsData);

    if (priceData) {
      console.log(`  Price: $${priceData.price} (Yahoo Finance)`);
    }
    if (incomeData) {
      console.log(`  FMP Income: ${incomeData.length} periods, revenue=$${(incomeData[0].revenue / 1e9).toFixed(1)}B`);
    }
    if (metricsData) {
      console.log(`  FMP Metrics: P/E=${metricsData.peRatio.toFixed(1)}`);
    }

    // Build prompt
    const promptBuilder = AGENT_PROMPTS[tc.agent];
    const prompt = promptBuilder(tc.ticker, tc.lang, marketData, fmpData);

    // Run LLM
    const result = await callLLM(prompt);

    const status = result.success ? 'SUCCESS' : 'FAILED';
    const truncated = result.truncated ? ' [TRUNCATED]' : '';
    console.log(`[${tc.id}] ${status}${truncated} (${result.duration}ms, ${result.tokens.total} tokens)`);

    if (result.success && result.content) {
      const preview = result.content.substring(0, 200).replace(/\n/g, ' ');
      console.log(`  Output: ${preview}${result.content.length > 200 ? '...' : ''}`);
    } else {
      console.log(`  Error: ${result.error}`);
    }
    console.log('');

    results.push({ ...tc, ...result, priceData, fmpEnriched: !!incomeData || !!metricsData });
  }

  // ============================================================
  // Summary
  // ============================================================

  const totalDuration = Date.now() - testStartTime;
  const passed = results.filter(r => r.success).length;
  const failed = results.length - passed;
  const totalTokens = results.reduce((sum, r) => sum + r.tokens.total, 0);
  const truncatedCount = results.filter(r => r.truncated).length;
  const fmpEnrichedCount = results.filter(r => r.fmpEnriched).length;

  console.log('========== SUMMARY ==========');
  console.log(`Results: ${passed}/${results.length} passed`);
  console.log(`Total tokens: ${totalTokens}`);
  console.log(`Truncated: ${truncatedCount}/${results.length}`);
  console.log(`FMP Enriched: ${fmpEnrichedCount}/${results.length}`);
  console.log(`Duration: ${(totalDuration / 1000).toFixed(1)}s\n`);

  for (const r of results) {
    const status = r.success ? 'PASS' : 'FAIL';
    const trunc = r.truncated ? ' [TRUNCATED]' : '';
    const fmp = r.fmpEnriched ? ' [FMP]' : '';
    console.log(`  ${r.id}: ${status} (${r.duration}ms${trunc}${fmp})`);
  }

  // ============================================================
  // Write Log
  // ============================================================

  const logLines = [
    `=== one4all Integration Test v2.0 — Thai + US Stocks ===`,
    `Date: ${new Date().toISOString()}`,
    `Provider: ZAI API (${MODEL}) | MAX_TOKENS: ${MAX_TOKENS}`,
    `FMP Enrichment: ${FMP_API_KEY ? 'ENABLED' : 'DISABLED'}`,
    ``,
    `========== THAI STOCKS (3 Questions) ==========`,
    ``,
  ];

  for (const r of results.filter(r => r.id.startsWith('TH'))) {
    logLines.push(`[${r.id}] ${r.ticker} - ${r.agent}`);
    logLines.push(`[${r.id}] ${r.success ? 'SUCCESS' : 'FAILED'} (${r.duration}ms, ${r.tokens.total} tokens)`);
    if (r.success) {
      logLines.push(`  Output: ${r.content.substring(0, 500)}`);
    } else {
      logLines.push(`  Error: ${r.error}`);
    }
    logLines.push('');
  }

  logLines.push(`========== US STOCKS (3 Questions) ==========`);
  logLines.push('');

  for (const r of results.filter(r => r.id.startsWith('US'))) {
    logLines.push(`[${r.id}] ${r.ticker} - ${r.agent}`);
    logLines.push(`[${r.id}] ${r.success ? 'SUCCESS' : 'FAILED'} (${r.duration}ms, ${r.tokens.total} tokens)`);
    if (r.fmpEnriched) logLines.push(`  [FMP ENRICHED]`);
    if (r.success) {
      logLines.push(`  Output: ${r.content.substring(0, 500)}`);
    } else {
      logLines.push(`  Error: ${r.error}`);
    }
    logLines.push('');
  }

  logLines.push(`========== SUMMARY ==========`);
  logLines.push(`Results: ${passed}/${results.length} passed`);
  logLines.push(`Total tokens: ${totalTokens}`);
  logLines.push(`Truncated: ${truncatedCount}/${results.length}`);
  logLines.push(`FMP Enriched: ${fmpEnrichedCount}/${results.length}`);
  logLines.push('');
  for (const r of results) {
    const status = r.success ? 'PASS' : 'FAIL';
    const trunc = r.truncated ? ' [TRUNCATED]' : '';
    const fmp = r.fmpEnriched ? ' [FMP]' : '';
    logLines.push(`  ${r.id}: ${status} (${r.duration}ms${trunc}${fmp})`);
  }

  if (!existsSync('test-results')) mkdirSync('test-results', { recursive: true });
  const logFile = `test-results/FULL_INTEGRATION_TEST_V2.log`;
  writeFileSync(logFile, logLines.join('\n'));
  console.log(`\nLog written to: ${logFile}`);

  // Exit code
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
