/**
 * Market Validation Module
 *
 * Pre-flight validation for Thai market data availability and quality
 * before running CPALL.BK tests.
 */

export interface MarketValidationResult {
  market: string;
  data_quality: 'good' | 'partial' | 'poor';
  checks: {
    cpall_available: boolean;
    cpall_data?: any;
    thb_available: boolean;
    thb_data?: any;
    set_index_available: boolean;
    set_index_data?: any;
  };
  missing_fields: string[];
  timestamp: string;
}

export class MarketValidator {
  private market: string;

  constructor(market: string = 'TH') {
    this.market = market;
  }

  /**
   * Validate Thai market data availability before testing
   */
  async validateThaiMarket(): Promise<MarketValidationResult> {
    console.log(`\n🔍 Validating Thai Market data availability...`);

    // Run all checks in parallel
    const [cpallResult, thbResult, setResult] = await Promise.allSettled([
      this.checkYahooFinanceCPALL(),
      this.checkTHBExchangeRate(),
      this.checkSETIndexData()
    ]);

    const result: MarketValidationResult = {
      market: this.market,
      data_quality: 'good',
      checks: {
        cpall_available: false,
        thb_available: false,
        set_index_available: false
      },
      missing_fields: [],
      timestamp: new Date().toISOString()
    };

    // Process CPALL.BK data
    if (cpallResult.status === 'fulfilled') {
      result.checks.cpall_available = true;
      result.checks.cpall_data = cpallResult.value;
      console.log(`✅ CPALL.BK data available`);
    } else {
      result.checks.cpall_available = false;
      result.missing_fields.push('CPALL.BK stock data');
      console.log(`❌ CPALL.BK data unavailable: ${cpallResult.reason}`);
    }

    // Process THB=X data
    if (thbResult.status === 'fulfilled') {
      result.checks.thb_available = true;
      result.checks.thb_data = thbResult.value;
      console.log(`✅ THB=X exchange rate available`);
    } else {
      result.checks.thb_available = false;
      result.missing_fields.push('THB=X exchange rate');
      console.log(`❌ THB=X data unavailable: ${thbResult.reason}`);
    }

    // Process ^SET index data
    if (setResult.status === 'fulfilled') {
      result.checks.set_index_available = true;
      result.checks.set_index_data = setResult.value;
      console.log(`✅ ^SET index data available`);
    } else {
      result.checks.set_index_available = false;
      result.missing_fields.push('^SET index data');
      console.log(`❌ ^SET data unavailable: ${setResult.reason}`);
    }

    // Determine data quality
    const availableCount = [
      result.checks.cpall_available,
      result.checks.thb_available,
      result.checks.set_index_available
    ].filter(Boolean).length;

    if (availableCount === 3) {
      result.data_quality = 'good';
      console.log(`🟢 Data quality: GOOD (all 3 checks passed)`);
    } else if (availableCount === 2) {
      result.data_quality = 'partial';
      console.log(`🟡 Data quality: PARTIAL (${availableCount}/3 checks passed)`);
    } else {
      result.data_quality = 'poor';
      console.log(`🔴 Data quality: POOR (${availableCount}/3 checks passed)`);
    }

    return result;
  }

  /**
   * Check CPALL.BK data from Yahoo Finance
   */
  private async checkYahooFinanceCPALL(): Promise<any> {
    const ticker = 'CPALL.BK';
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!data.chart?.result?.[0]) {
      throw new Error('No data returned');
    }

    const meta = data.chart.result[0].meta;

    return {
      ticker: 'CPALL.BK',
      current_price: meta.regularMarketPrice,
      currency: meta.currency,
      market_cap: meta.marketCap,
      volume: meta.regularMarketVolume,
      previous_close: meta.previousClose
    };
  }

  /**
   * Check THB=X exchange rate data
   */
  private async checkTHBExchangeRate(): Promise<any> {
    const ticker = 'THB=X';
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!data.chart?.result?.[0]) {
      throw new Error('No data returned');
    }

    const meta = data.chart.result[0].meta;

    return {
      ticker: 'THB=X',
      rate: meta.regularMarketPrice,
      currency: meta.currency
    };
  }

  /**
   * Check ^SET index data
   */
  private async checkSETIndexData(): Promise<any> {
    const ticker = '^SET';
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!data.chart?.result?.[0]) {
      throw new Error('No data returned');
    }

    const meta = data.chart.result[0].meta;

    return {
      ticker: '^SET',
      value: meta.regularMarketPrice,
      previous_close: meta.previousClose
    };
  }

  /**
   * Get missing fields from validation result
   */
  getMissingFields(result: MarketValidationResult): string[] {
    return result.missing_fields;
  }
}

/**
 * Standalone function to validate Thai market
 */
export async function validateThaiMarket(): Promise<MarketValidationResult> {
  const validator = new MarketValidator('TH');
  return await validator.validateThaiMarket();
}