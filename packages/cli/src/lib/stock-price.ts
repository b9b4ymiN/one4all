/**
 * Stock Price Fetcher
 *
 * Fetches real-time stock prices from Yahoo Finance API
 */

export interface StockPriceData {
  ticker: string;
  current_price: number;
  previous_close?: number;
  day_high?: number;
  day_low?: number;
  week_52_high?: number;
  week_52_low?: number;
  market_cap?: string;
  volume?: number;
  currency?: string;
  as_of_date: string;
}

export interface FinancialData {
  revenue?: number;
  net_income?: number;
  eps?: number;
  pe_ratio?: number;
}

// Thai tickers list (shared between normalizeTicker and FMP skip detection)
const thaiTickers = [
  'CPALL', 'CPF', 'BDMS', 'KBANK', 'SCB', 'AOT', 'ADVANC', 'PTT',
  'PTTEP', 'TU', 'TRUE', 'DTAC', 'LH', 'SF', 'MFC', 'TISCO',
  'BBL', 'KTB', 'CIMBT', 'BAY', 'TMB', 'BAFS', 'GPSC', 'GLOW',
  'RATCH', 'BGRIM', 'EA', 'EGCO', 'QH', 'BPP', 'WHA', 'AMATA'
];

/**
 * Normalize ticker for Yahoo Finance
 * Adds exchange suffix for known markets (e.g., Thai stocks get .BK)
 */
function normalizeTicker(ticker: string): string {
  const upperTicker = ticker.toUpperCase();

  if (thaiTickers.includes(upperTicker) && !upperTicker.endsWith('.BK')) {
    return upperTicker + '.BK';
  }

  return upperTicker;
}

function isThaiTicker(ticker: string): boolean {
  const upper = ticker.toUpperCase().replace('.BK', '');
  return thaiTickers.includes(upper) || ticker.toUpperCase().endsWith('.BK');
}

/**
 * Fetch stock price from Yahoo Finance
 */
export async function fetchStockPrice(ticker: string): Promise<StockPriceData | null> {
  try {
    const normalizedTicker = normalizeTicker(ticker);
    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${normalizedTicker}?interval=1d&range=1d`
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!data.chart?.result?.[0]) {
      return null;
    }

    const meta = data.chart.result[0].meta;
    const quote = data.chart.result[0].indicators?.quote?.[0];

    // Handle array values from quote
    const dayHigh = Array.isArray(quote?.high) ? quote.high[0] : quote?.high;
    const dayLow = Array.isArray(quote?.low) ? quote.low[0] : quote?.low;

    return {
      ticker: ticker.toUpperCase(), // Return original ticker, not normalized
      current_price: meta.regularMarketPrice || 0,
      previous_close: meta.previousClose,
      day_high: dayHigh || meta.regularMarketDayHigh,
      day_low: dayLow || meta.regularMarketDayLow,
      week_52_high: meta.fiftyTwoWeekHigh,
      week_52_low: meta.fiftyTwoWeekLow,
      market_cap: formatMarketCap(meta.marketCap),
      volume: meta.regularMarketVolume,
      currency: meta.currency,
      as_of_date: new Date().toISOString(),
    };
  } catch (error) {
    console.error(`  [STOCK_PRICE] Failed to fetch ${ticker}: ${(error as Error).message}`);
    return null;
  }
}

/**
 * Fetch multiple stock prices in parallel
 */
export async function fetchMultipleStockPrices(tickers: string[]): Promise<StockPriceData[]> {
  const results = await Promise.allSettled(
    tickers.map((t) => fetchStockPrice(t))
  );

  return results.map((result, i) => {
    if (result.status === 'fulfilled' && result.value) {
      return result.value;
    }
    return {
      ticker: tickers[i].toUpperCase(),
      current_price: 0,
      as_of_date: new Date().toISOString(),
    };
  });
}

function formatMarketCap(cap: number | undefined): string | undefined {
  if (!cap) return undefined;
  if (cap >= 1e12) return (cap / 1e12).toFixed(1) + 'T';
  if (cap >= 1e9) return (cap / 1e9).toFixed(1) + 'B';
  if (cap >= 1e6) return (cap / 1e6).toFixed(1) + 'M';
  return cap.toString();
}

// === FMP Financial Data Integration ===

const FMP_BASE_URL = 'https://financialmodelingprep.com/api/v3';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const fmpCache = new Map<string, CacheEntry<unknown>>();

export interface FmpIncomeData {
  ticker: string;
  periods: Array<{
    date: string;
    revenue: number;
    net_income: number;
    eps: number;
    gross_margin: number;
    operating_margin: number;
  }>;
}

export interface FmpMetricsData {
  ticker: string;
  pe_ratio: number;
  roe: number;
  roa: number;
  debt_to_equity: number;
  current_ratio: number;
  as_of_date: string;
}

async function fmpFetch<T>(url: string, retries = 3): Promise<T | null> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(url);
      if (response.status === 429 || response.status >= 500) {
        if (attempt < retries - 1) {
          const delay = 1000 * Math.pow(2, attempt);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        return null;
      }
      if (!response.ok) return null;
      return await response.json() as T;
    } catch {
      if (attempt < retries - 1) {
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
        continue;
      }
      return null;
    }
  }
  return null;
}

function getCached<T>(key: string): T | null {
  const entry = fmpCache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL_MS) {
    return entry.data as T;
  }
  return null;
}

function setCache(key: string, data: unknown): void {
  fmpCache.set(key, { data, timestamp: Date.now() });
}

export async function getIncomeStatement(ticker: string): Promise<FmpIncomeData | null> {
  const apiKey = process.env.FMP_API_KEY;
  if (!apiKey || isThaiTicker(ticker)) return null;

  const cacheKey = `income-${ticker}`;
  const cached = getCached<FmpIncomeData>(cacheKey);
  if (cached) return cached;

  const url = `${FMP_BASE_URL}/income-statement/${ticker}?apikey=${apiKey}&limit=4`;
  const data = await fmpFetch<Array<Record<string, unknown>>>(url);
  if (!data || !Array.isArray(data) || data.length === 0) return null;

  const periods = data.map((item: Record<string, unknown>) => {
    const revenue = Number(item.revenue) || 0;
    const grossProfit = Number(item.grossProfit) || 0;
    const operatingIncome = Number(item.operatingIncome) || 0;
    return {
      date: String(item.date || ''),
      revenue,
      net_income: Number(item.netIncome) || 0,
      eps: Number(item.eps) || 0,
      gross_margin: revenue > 0 ? grossProfit / revenue : 0,
      operating_margin: revenue > 0 ? operatingIncome / revenue : 0,
    };
  });

  const result: FmpIncomeData = { ticker: ticker.toUpperCase(), periods };
  setCache(cacheKey, result);
  return result;
}

export async function getKeyMetrics(ticker: string): Promise<FmpMetricsData | null> {
  const apiKey = process.env.FMP_API_KEY;
  if (!apiKey || isThaiTicker(ticker)) return null;

  const cacheKey = `metrics-${ticker}`;
  const cached = getCached<FmpMetricsData>(cacheKey);
  if (cached) return cached;

  const url = `${FMP_BASE_URL}/key-metrics/${ticker}?apikey=${apiKey}&limit=1`;
  const data = await fmpFetch<Array<Record<string, unknown>>>(url);
  if (!data || !Array.isArray(data) || data.length === 0) return null;

  const item = data[0];
  const result: FmpMetricsData = {
    ticker: ticker.toUpperCase(),
    pe_ratio: Number(item.peRatio) || 0,
    roe: Number(item.returnOnEquity) || 0,
    roa: Number(item.returnOnAssets) || 0,
    debt_to_equity: Number(item.debtToEquity) || 0,
    current_ratio: Number(item.currentRatio) || 0,
    as_of_date: String(item.date || new Date().toISOString()),
  };

  setCache(cacheKey, result);
  return result;
}
