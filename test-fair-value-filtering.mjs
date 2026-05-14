/**
 * Test script to verify fair_value analyst filtering
 * This tests the fix for the $5 bug where position_size (5%) was treated as $5 fair value
 */

import { isFairValueAnalyst, FAIR_VALUE_ANALYSTS } from './packages/kernel/src/personas/types.ts';

console.log('=== Fair Value Analyst Filtering Test ===\n');

// Test 1: Verify FAIR_VALUE_ANALYSTS constant
console.log('Test 1: FAIR_VALUE_ANALYSTS constant');
console.log('Expected: damodaran-valuation, klarman-downside, greenwald-evasion');
console.log('Actual:', FAIR_VALUE_ANALYSTS);
console.log('Pass:', FAIR_VALUE_ANALYSTS.length === 3 && FAIR_VALUE_ANALYSTS.includes('damodaran-valuation'));
console.log();

// Test 2: Verify portfolio-allocator is NOT a fair value analyst
console.log('Test 2: portfolio-allocator should NOT be a fair_value analyst');
const portfolioAllocatorResult = isFairValueAnalyst('portfolio-allocator');
console.log('isFairValueAnalyst("portfolio-allocator"):', portfolioAllocatorResult);
console.log('Pass:', portfolioAllocatorResult === false);
console.log();

// Test 3: Verify damodaran-valuation IS a fair value analyst
console.log('Test 3: damodaran-valuation should be a fair_value analyst');
const damodaranResult = isFairValueAnalyst('damodaran-valuation');
console.log('isFairValueAnalyst("damodaran-valuation"):', damodaranResult);
console.log('Pass:', damodaranResult === true);
console.log();

// Test 4: Verify klarman-downside IS a fair value analyst
console.log('Test 4: klarman-downside should be a fair_value analyst');
const klarmanResult = isFairValueAnalyst('klarman-downside');
console.log('isFairValueAnalyst("klarman-downside"):', klarmanResult);
console.log('Pass:', klarmanResult === true);
console.log();

// Test 5: Verify greenwald-evasion IS a fair value analyst
console.log('Test 5: greenwald-evasion should be a fair_value analyst');
const greenwaldResult = isFairValueAnalyst('greenwald-evasion');
console.log('isFairValueAnalyst("greenwald-evasion"):', greenwaldResult);
console.log('Pass:', greenwaldResult === true);
console.log();

// Test 6: Verify other analysts are NOT fair value analysts
console.log('Test 6: Other analysts should NOT be fair_value analysts');
const otherAnalysts = [
  'consensus-analyst',
  'devil-advocate',
  'allocator-steward',
  'downside-protection',
  'kessler-moat',
  'klamran-quality',
  'leveraged-franchise',
  'michael-burry',
  'portfolio-manager',
];
const allPass = otherAnalysts.every(analyst => !isFairValueAnalyst(analyst as any));
console.log('Other analysts test result:', allPass);
console.log('Pass:', allPass);
console.log();

// Summary
console.log('=== Summary ===');
const allTestsPass = [
  FAIR_VALUE_ANALYSTS.length === 3,
  !portfolioAllocatorResult,
  damodaranResult,
  klarmanResult,
  greenwaldResult,
  allPass
].every(Boolean);

console.log('All tests passed:', allTestsPass ? '✅ YES' : '❌ NO');
console.log('\nThis fix prevents the $5 bug by:');
console.log('1. Explicitly defining which analysts provide fair_value estimates');
console.log('2. Preventing position_size (5%) from being treated as $5 fair_value');
console.log('3. Filtering CIO averaging to only include fair_value analysts');
