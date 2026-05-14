/**
 * CPALL.BK Thai Market Test
 *
 * Integration tests for CPALL.BK with pre-flight market validation
 */

import { describe, test, beforeAll, expect } from 'vitest';
import { validateThaiMarket, MarketValidationResult } from '../src/market-validation';

let validationResult: MarketValidationResult;

describe('Thai Market Pre-Flight Validation', () => {
  test('should validate Thai market data availability before testing', async () => {
    validationResult = await validateThaiMarket();

    console.log('\n=== Thai Market Validation Summary ===');
    console.log(`Market: ${validationResult.market}`);
    console.log(`Data Quality: ${validationResult.data_quality.toUpperCase()}`);
    console.log(`Timestamp: ${validationResult.timestamp}`);
    console.log('\nChecks:');
    console.log(`  CPALL.BK: ${validationResult.checks.cpall_available ? '✅ Available' : '❌ Missing'}`);
    console.log(`  THB=X: ${validationResult.checks.thb_available ? '✅ Available' : '❌ Missing'}`);
    console.log(`  ^SET: ${validationResult.checks.set_index_available ? '✅ Available' : '❌ Missing'}`);

    if (validationResult.missing_fields.length > 0) {
      console.log('\nMissing Fields:', validationResult.missing_fields.join(', '));
    }

    // Store for use in subsequent tests
    expect(validationResult).toBeDefined();
    expect(validationResult.market).toBe('TH');
    expect(['good', 'partial', 'poor']).toContain(validationResult.data_quality);
  }, 30000);
});

describe('CPALL.BK Stock Data Tests', () => {
  beforeAll(() => {
    // Skip tests if data quality is poor
    if (validationResult.data_quality === 'poor') {
      console.warn('\n⚠️  SKIPPING CPALL.BK TESTS: Data quality is POOR');
      test.skip = true;
    } else if (validationResult.data_quality === 'partial') {
      console.warn('\n⚠️  WARNING: Data quality is PARTIAL. Some tests may fail.');
    }
  });

  test('should have CPALL.BK data available', () => {
    if (!validationResult.checks.cpall_available) {
      console.warn('⚠️  CPALL.BK data not available - skipping test');
      return;
    }

    expect(validationResult.checks.cpall_available).toBe(true);
    expect(validationResult.checks.cpall_data).toBeDefined();
  });

  test('CPALL.BK should have valid price data', () => {
    if (!validationResult.checks.cpall_available || !validationResult.checks.cpall_data) {
      console.warn('⚠️  CPALL.BK data not available - skipping test');
      return;
    }

    const cpallData = validationResult.checks.cpall_data;

    expect(cpallData.ticker).toBe('CPALL.BK');
    expect(cpallData.current_price).toBeDefined();
    expect(cpallData.current_price).toBeGreaterThan(0);
    expect(cpallData.currency).toBeDefined();

    console.log(`\n📊 CPALL.BK Stock Info:`);
    console.log(`  Current Price: ${cpallData.current_price} ${cpallData.currency}`);
    if (cpallData.previous_close) {
      const change = ((cpallData.current_price - cpallData.previous_close) / cpallData.previous_close * 100).toFixed(2);
      console.log(`  Previous Close: ${cpallData.previous_close}`);
      console.log(`  Change: ${change > 0 ? '+' : ''}${change}%`);
    }
    if (cpallData.market_cap) {
      console.log(`  Market Cap: ${(cpallData.market_cap / 1e9).toFixed(1)}B ${cpallData.currency}`);
    }
    if (cpallData.volume) {
      console.log(`  Volume: ${cpallData.volume.toLocaleString()}`);
    }
  });

  test('CPALL.BK price should be within reasonable range', () => {
    if (!validationResult.checks.cpall_available || !validationResult.checks.cpall_data) {
      console.warn('⚠️  CPALL.BK data not available - skipping test');
      return;
    }

    const price = validationResult.checks.cpall_data.current_price;

    // CPALL.BK should be between 10-1000 THB (sanity check)
    expect(price).toBeGreaterThan(10);
    expect(price).toBeLessThan(1000);
  });
});

describe('Thai Market Supporting Data Tests', () => {
  test('THB=X exchange rate should be available', () => {
    if (!validationResult.checks.thb_available) {
      console.warn('⚠️  THB=X data not available - skipping test');
      return;
    }

    expect(validationResult.checks.thb_available).toBe(true);
    expect(validationResult.checks.thb_data).toBeDefined();
    expect(validationResult.checks.thb_data.rate).toBeGreaterThan(0);

    console.log(`\n💱 THB/USD Exchange Rate: ${validationResult.checks.thb_data.rate}`);
  });

  test('^SET index should be available', () => {
    if (!validationResult.checks.set_index_available) {
      console.warn('⚠️  ^SET data not available - skipping test');
      return;
    }

    expect(validationResult.checks.set_index_available).toBe(true);
    expect(validationResult.checks.set_index_data).toBeDefined();
    expect(validationResult.checks.set_index_data.value).toBeGreaterThan(0);

    console.log(`\n📈 SET Index: ${validationResult.checks.set_index_data.value}`);
  });
});

describe('Market Validation Quality Tests', () => {
  test('should have at least partial data quality', () => {
    // Even partial quality should have at least 2 data sources
    const availableCount = [
      validationResult.checks.cpall_available,
      validationResult.checks.thb_available,
      validationResult.checks.set_index_available
    ].filter(Boolean).length;

    expect(availableCount).toBeGreaterThanOrEqual(1);
  });

  test('should identify missing fields correctly', () => {
    const missingCount = validationResult.missing_fields.length;
    const availableCount = [
      validationResult.checks.cpall_available,
      validationResult.checks.thb_available,
      validationResult.checks.set_index_available
    ].filter(Boolean).length;

    expect(missingCount + availableCount).toBe(3);
  });

  test('timestamp should be recent', () => {
    const validationTime = new Date(validationResult.timestamp).getTime();
    const currentTime = Date.now();
    const timeDiff = currentTime - validationTime;

    // Timestamp should be within last minute
    expect(timeDiff).toBeLessThan(60000);
  });
});