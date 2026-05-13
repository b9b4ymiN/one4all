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

/**
 * Fetch stock price from Yahoo Finance
 */
export async function fetchStockPrice(ticker: string): Promise<StockPriceData | null> {
  try {
    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`
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
      ticker: ticker.toUpperCase(),
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
