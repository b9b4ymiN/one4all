/**
 * Routing Quality Benchmark Tests
 *
 * Tests the AgentRegistryLoader.routeQuestion() method to ensure
 * questions are routed to the most appropriate agents based on
 * keyword matching in routing_metadata.
 *
 * Test Categories:
 * 1. Valuation → damodaran-valuation
 * 2. Downside/Risk → seth-klarman
 * 3. Moat/Competition → kessler-moat
 * 4. Quality → klamran-quality
 * 5. Contrarian → devil-advocate
 * 6. Thai Market → Any Thai-capable analyst
 */

import { describe, it, expect } from 'vitest';
import { AgentRegistryLoader } from '@one4all/kernel';

describe('Routing Quality Benchmark', () => {
  const loader = new AgentRegistryLoader('/home/dasimoa/one4all');
  const domain = 'investment-war-room';

  /**
   * Helper function to get the top routing result
   */
  async function getTopRoute(question: string): Promise<string | undefined> {
    const results = await loader.routeQuestion(question, domain);
    return results[0]?.agent.id;
  }

  /**
   * Category 1: Valuation
   * Expected agent: damodaran-valuation
   */
  describe('Valuation routing', () => {
    const questions = [
      { q: "What's the intrinsic value of AAPL?", expected: 'damodaran-valuation' },
      { q: "What is TSLA worth?", expected: 'damodaran-valuation' },
      { q: "Calculate the fair value of Microsoft", expected: 'damodaran-valuation' },
      { q: "What's a fair price for NVDA?", expected: 'damodaran-valuation' },
      { q: "What growth rate is priced into this stock?", expected: 'damodaran-valuation' },
      { q: "Valuation of GOOGL", expected: 'damodaran-valuation' },
      { q: "Is this stock undervalued or overvalued?", expected: 'damodaran-valuation' },
    ];

    questions.forEach(({ q, expected }) => {
      it(`should route "${q}" to ${expected}`, async () => {
        const topAgent = await getTopRoute(q);
        expect(topAgent).toBe(expected);
      });
    });
  });

  /**
   * Category 2: Downside/Risk
   * Expected agent: seth-klarman
   */
  describe('Downside/Risk routing', () => {
    const questions = [
      { q: "What's the worst case for TSLA?", expected: 'seth-klarman' },
      { q: "What can go wrong with this investment?", expected: 'seth-klarman' },
      { q: "What's the margin of safety?", expected: 'seth-klarman' },
      { q: "How much downside risk is there?", expected: 'seth-klarman' },
      { q: "What's the worst-case scenario?", expected: 'seth-klarman' },
      { q: "Is this capital preservation strategy safe?", expected: 'seth-klarman' },
      { q: "What's the risk of permanent loss?", expected: 'seth-klarman' },
    ];

    questions.forEach(({ q, expected }) => {
      it(`should route "${q}" to ${expected}`, async () => {
        const topAgent = await getTopRoute(q);
        expect(topAgent).toBe(expected);
      });
    });
  });

  /**
   * Category 3: Moat/Competition
   * Expected agent: kessler-moat
   */
  describe('Moat/Competition routing', () => {
    const questions = [
      { q: "Does NVDA have a competitive moat?", expected: 'kessler-moat' },
      { q: "What's the competitive moat?", expected: 'kessler-moat' },
      { q: "How durable is this competitive advantage?", expected: 'kessler-moat' },
      { q: "What are the barriers to entry?", expected: 'kessler-moat' },
      { q: "Can competitors easily enter this market?", expected: 'kessler-moat' },
      { q: "What protects this business?", expected: 'kessler-moat' },
      { q: "How strong is the company's market position?", expected: 'kessler-moat' },
    ];

    questions.forEach(({ q, expected }) => {
      it(`should route "${q}" to ${expected}`, async () => {
        const topAgent = await getTopRoute(q);
        expect(topAgent).toBe(expected);
      });
    });
  });

  /**
   * Category 4: Quality
   * Expected agent: klamran-quality
   */
  describe('Quality routing', () => {
    const questions = [
      { q: "Is MSFT a quality compounder?", expected: 'klamran-quality' },
      { q: "Is this a high-quality business?", expected: 'klamran-quality' },
      { q: "What's the ROIC trend?", expected: 'klamran-quality' },
      { q: "How are the margins trending?", expected: 'klamran-quality' },
      { q: "Does this business generate high returns on capital?", expected: 'klamran-quality' },
      { q: "Is this a quality business?", expected: 'klamran-quality' },
      { q: "What's the business quality rating?", expected: 'klamran-quality' },
    ];

    questions.forEach(({ q, expected }) => {
      it(`should route "${q}" to ${expected}`, async () => {
        const topAgent = await getTopRoute(q);
        expect(topAgent).toBe(expected);
      });
    });
  });

  /**
   * Category 5: Contrarian/Bear Case
   * Expected agent: devil-advocate
   */
  describe('Contrarian routing', () => {
    const questions = [
      { q: "What's the bear case for AI stocks?", expected: 'devil-advocate' },
      { q: "What am I missing in this thesis?", expected: 'devil-advocate' },
      { q: "What's wrong with this investment idea?", expected: 'devil-advocate' },
      { q: "Challenge my assumptions", expected: 'devil-advocate' },
      { q: "What are the weaknesses in this argument?", expected: 'devil-advocate' },
      { q: "Stress test this thesis", expected: 'devil-advocate' },
      { q: "What's the contrarian view?", expected: 'devil-advocate' },
    ];

    questions.forEach(({ q, expected }) => {
      it(`should route "${q}" to ${expected}`, async () => {
        const topAgent = await getTopRoute(q);
        expect(topAgent).toBe(expected);
      });
    });
  });

  /**
   * Category 6: Thai Market
   * Expected: Any agent with Thai language support
   * All investment-war-room agents support Thai, so we check for successful routing
   */
  describe('Thai Market routing', () => {
    const questions = [
      { q: "วิเคราะห์ CPALL", expectAny: true }, // Analyze CPALL
      { q: "หุ้นนี้มีมูลค่าเท่าไหร่", expectAny: true }, // What's this stock worth
      { q: "บริษัทนี้มีคุณภาพกิจการดีไหม", expectAny: true }, // Is this company quality
      { q: "คู่แข่งไม่สามารถเข้ามาแข่งได้", expectAny: true }, // Competitors can't enter
      { q: "ลงทุนในหุ้นนี้ปลอดภัยไหม", expectAny: true }, // Is investing in this stock safe
      { q: "มีความเสี่ยงอะไรที่ไม่ได้คิดถึง", expectAny: true }, // What risks are we missing
      { q: "ประเมินมูลค่าหุ้น ADVANC", expectAny: true }, // Value ADVANC stock
    ];

    questions.forEach(({ q, expectAny }) => {
      it(`should route "${q}" to a valid agent`, async () => {
        const topAgent = await getTopRoute(q);
        if (expectAny) {
          // For Thai questions, we expect successful routing to any agent
          expect(topAgent).toBeDefined();
          expect(topAgent).toBeTruthy();
        } else {
          expect(topAgent).toBeDefined();
        }
      });
    });
  });

  /**
   * Overall Accuracy Benchmark Test
   * Verifies >80% accuracy across all test cases
   */
  it('should achieve >80% accuracy across all clear-cut questions', async () => {
    const testCases = [
      // Valuation
      { q: "What's the intrinsic value of AAPL?", expected: 'damodaran-valuation' },
      { q: "What is TSLA worth?", expected: 'damodaran-valuation' },
      { q: "Calculate the fair value of Microsoft", expected: 'damodaran-valuation' },
      { q: "What's a fair price for NVDA?", expected: 'damodaran-valuation' },
      { q: "What growth rate is priced into this stock?", expected: 'damodaran-valuation' },

      // Downside/Risk
      { q: "What's the worst case for TSLA?", expected: 'seth-klarman' },
      { q: "What can go wrong with this investment?", expected: 'seth-klarman' },
      { q: "What's the margin of safety?", expected: 'seth-klarman' },
      { q: "How much downside risk is there?", expected: 'seth-klarman' },
      { q: "What's the worst-case scenario?", expected: 'seth-klarman' },

      // Moat/Competition
      { q: "Does NVDA have a competitive moat?", expected: 'kessler-moat' },
      { q: "What's the competitive moat?", expected: 'kessler-moat' },
      { q: "How durable is this competitive advantage?", expected: 'kessler-moat' },
      { q: "What are the barriers to entry?", expected: 'kessler-moat' },
      { q: "Can competitors easily enter this market?", expected: 'kessler-moat' },

      // Quality
      { q: "Is MSFT a quality compounder?", expected: 'klamran-quality' },
      { q: "Is this a high-quality business?", expected: 'klamran-quality' },
      { q: "What's the ROIC trend?", expected: 'klamran-quality' },
      { q: "How are the margins trending?", expected: 'klamran-quality' },
      { q: "Does this business generate high returns on capital?", expected: 'klamran-quality' },

      // Contrarian
      { q: "What's the bear case for AI stocks?", expected: 'devil-advocate' },
      { q: "What am I missing in this thesis?", expected: 'devil-advocate' },
      { q: "What's wrong with this investment idea?", expected: 'devil-advocate' },
      { q: "Challenge my assumptions", expected: 'devil-advocate' },
      { q: "What are the weaknesses in this argument?", expected: 'devil-advocate' },
    ];

    let correct = 0;
    const results: Array<{ question: string; expected: string; actual: string | undefined; correct: boolean }> = [];

    for (const testCase of testCases) {
      const actual = await getTopRoute(testCase.q);
      const isCorrect = actual === testCase.expected;
      if (isCorrect) correct++;

      results.push({
        question: testCase.q,
        expected: testCase.expected,
        actual,
        correct: isCorrect,
      });
    }

    const accuracy = (correct / testCases.length) * 100;

    console.log('\n=== Routing Quality Results ===');
    console.log(`Total: ${testCases.length}, Correct: ${correct}, Accuracy: ${accuracy.toFixed(1)}%`);
    console.log('\nPer-Category Breakdown:');

    const categories = [
      { name: 'Valuation', expected: 'damodaran-valuation' },
      { name: 'Downside/Risk', expected: 'seth-klarman' },
      { name: 'Moat/Competition', expected: 'kessler-moat' },
      { name: 'Quality', expected: 'klamran-quality' },
      { name: 'Contrarian', expected: 'devil-advocate' },
    ];

    categories.forEach(category => {
      const categoryResults = results.filter(r => r.expected === category.expected);
      const categoryCorrect = categoryResults.filter(r => r.correct).length;
      const categoryAccuracy = (categoryCorrect / categoryResults.length) * 100;
      console.log(`  ${category.name}: ${categoryCorrect}/${categoryResults.length} (${categoryAccuracy.toFixed(1)}%)`);
    });

    console.log('\nIncorrect Routes:');
    results
      .filter(r => !r.correct)
      .forEach(r => {
        console.log(`  ❌ "${r.question}"`);
        console.log(`     Expected: ${r.expected}, Got: ${r.actual || 'none'}`);
      });

    expect(accuracy).toBeGreaterThanOrEqual(80);
  });
});
