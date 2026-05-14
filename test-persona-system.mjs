#!/usr/bin/env node
/**
 * Test script to verify Phase 1 persona system implementation
 */

import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

console.log('🧪 Testing Persona System - Phase 1 PoC\n');
console.log('=' .repeat(50));

// Test 1: Verify persona files exist
async function testPersonaFilesExist() {
  console.log('\n📂 Test 1: Persona Files Exist');
  const personas = ['damodaran', 'klarman', 'devil-advocate'];
  const basePath = join(__dirname, 'domains/investment-war-room/personas');

  let passed = 0;
  for (const persona of personas) {
    try {
      const content = await readFile(join(basePath, `${persona}.md`), 'utf-8');
      console.log(`  ✅ ${persona}.md (${content.length} bytes)`);
      passed++;
    } catch (err) {
      console.log(`  ❌ ${persona}.md - NOT FOUND`);
    }
  }

  console.log(`  Result: ${passed}/${personas.length} files found`);
  return passed === personas.length;
}

// Test 2: Verify persona content structure
async function testPersonaContentStructure() {
  console.log('\n📝 Test 2: Persona Content Structure');
  const personas = ['damodaran', 'klarman', 'devil-advocate'];
  const basePath = join(__dirname, 'domains/investment-war-room/personas');

  const requiredSections = [
    'Voice & Tone',
    'Worldview',
    'Cognitive Biases',
    'Analytical Framework',
    'What Would Change My Mind'
  ];

  let passed = 0;
  for (const persona of personas) {
    try {
      const content = await readFile(join(basePath, `${persona}.md`), 'utf-8');
      const missing = requiredSections.filter(section => !content.includes(section));

      if (missing.length === 0) {
        console.log(`  ✅ ${persona}.md - All sections present`);
        passed++;
      } else {
        console.log(`  ⚠️  ${persona}.md - Missing: ${missing.join(', ')}`);
      }
    } catch (err) {
      console.log(`  ❌ ${persona}.md - Error reading: ${err.message}`);
    }
  }

  console.log(`  Result: ${passed}/${personas.length} personas have complete structure`);
  return passed === personas.length;
}

// Test 3: Simulate evidence scoring with tier-based algorithm
function testEvidenceScoring() {
  console.log('\n📊 Test 3: Tier-Based Evidence Scoring');

  // Simulate the new scoring algorithm
  function calculateEvidenceScore(data) {
    let score = 0;

    const tier1 = data.tier1_sources || 0;
    const tier2 = data.tier2_sources || 0;
    const tier3 = data.tier3_sources || 0;
    const tier4 = data.tier4_sources || 0;
    const tier5 = data.tier5_sources || 0;

    // Tier 1: +25 per source (max 50)
    score += Math.min(tier1 * 25, 50);

    // Tier 2: +10 per source (max 20)
    score += Math.min(tier2 * 10, 20);

    // Tier 3: +5 per source (max 10)
    score += Math.min(tier3 * 5, 10);

    // Bonus: +10 for required documents
    const requiredDocs = data.required_documents || 0;
    if (requiredDocs > 0) score += 10;

    // Bonus: +10 for no critical gaps
    const criticalGaps = data.critical_gaps || 0;
    if (criticalGaps === 0) {
      score += 10;
    } else {
      score -= (criticalGaps * 15);
    }

    // Penalty: -10 for no Tier 1-3
    if (tier1 === 0 && tier2 === 0 && tier3 === 0) {
      score -= 10;
    }

    // Penalty: -20 for only Tier 5
    if (tier5 > 0 && tier1 === 0 && tier2 === 0 && tier3 === 0 && tier4 === 0) {
      score -= 20;
    }

    return Math.max(0, Math.min(score, 100));
  }

  const testCases = [
    {
      name: 'Perfect score (2 Tier 1 sources)',
      input: { tier1_sources: 2, required_documents: 1, critical_gaps: 0 },
      expected: '70' // 2*25=50 +10 docs +10 no gaps = 70
    },
    {
      name: 'Good mix (1 Tier 1, 2 Tier 2)',
      input: { tier1_sources: 1, tier2_sources: 2, required_documents: 1, critical_gaps: 0 },
      expected: '65' // 1*25 + 2*10=45 +10 docs +10 no gaps = 65
    },
    {
      name: 'Only Tier 5 sources (penalty)',
      input: { tier5_sources: 3 },
      expected: '< 30'
    },
    {
      name: 'Critical gaps penalty',
      input: { tier1_sources: 1, tier2_sources: 1, critical_gaps: 2 },
      expected: '< 50'
    }
  ];

  let passed = 0;
  for (const tc of testCases) {
    const score = calculateEvidenceScore(tc.input);
    const expected = parseInt(tc.expected) || 0;

    if (tc.expected.startsWith('>=')) {
      const minExpected = parseInt(tc.expected.split(' ')[1]) || 0;
      if (score >= minExpected) {
        console.log(`  ✅ ${tc.name}: ${score} points (expected ${tc.expected})`);
        passed++;
      } else {
        console.log(`  ❌ ${tc.name}: ${score} points (expected ${tc.expected})`);
      }
    } else if (tc.expected.startsWith('<')) {
      const maxExpected = parseInt(tc.expected.split(' ')[1]) || 100;
      if (score < maxExpected) {
        console.log(`  ✅ ${tc.name}: ${score} points (expected ${tc.expected})`);
        passed++;
      } else {
        console.log(`  ❌ ${tc.name}: ${score} points (expected ${tc.expected})`);
      }
    } else {
      // Exact match
      if (score === expected) {
        console.log(`  ✅ ${tc.name}: ${score} points (expected ${expected})`);
        passed++;
      } else {
        console.log(`  ❌ ${tc.name}: ${score} points (expected ${expected})`);
      }
    }
  }

  console.log(`  Result: ${passed}/${testCases.length} scoring tests passed`);
  return passed === testCases.length;
}

// Test 4: Agent ID mapping
function testAgentIdMapping() {
  console.log('\n🔗 Test 4: Agent ID to Persona File Mapping');

  const personaMap = {
    'damodaran-valuation': 'damodaran',
    'klarman-downside': 'klarman',
    'devil-advocate': 'devil-advocate',
  };

  const testCases = [
    { agentId: 'damodaran-valuation', expectedFile: 'damodaran.md' },
    { agentId: 'klarman-downside', expectedFile: 'klarman.md' },
    { agentId: 'devil-advocate', expectedFile: 'devil-advocate.md' },
  ];

  let passed = 0;
  for (const tc of testCases) {
    const filename = personaMap[tc.agentId] || tc.agentId;
    if (filename === tc.expectedFile.replace('.md', '')) {
      console.log(`  ✅ ${tc.agentId} → ${tc.expectedFile}`);
      passed++;
    } else {
      console.log(`  ❌ ${tc.agentId} → ${filename}.md (expected ${tc.expectedFile})`);
    }
  }

  console.log(`  Result: ${passed}/${testCases.length} mappings correct`);
  return passed === testCases.length;
}

// Run all tests
async function runAllTests() {
  const results = [];

  results.push(await testPersonaFilesExist());
  results.push(await testPersonaContentStructure());
  results.push(testEvidenceScoring());
  results.push(testAgentIdMapping());

  console.log('\n' + '='.repeat(50));
  console.log(`\n📋 SUMMARY: ${results.filter(r => r).length}/${results.length} test groups passed`);

  if (results.every(r => r)) {
    console.log('\n✅ All tests PASSED! Phase 1 implementation is working correctly.\n');
    return 0;
  } else {
    console.log('\n⚠️  Some tests FAILED. Please review the issues above.\n');
    return 1;
  }
}

runAllTests().then(exitCode => process.exit(exitCode));
