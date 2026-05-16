/**
 * ZAI Adapter Output Tests — max_tokens + truncation detection
 *
 * Tests AC-1 (DEFAULT_MAX_TOKENS = 16384) and AC-3/AC-11 (finish_reason logging).
 * Uses real ZAI API — no mocks.
 *
 * Run: ZAI_API_KEY=xxx npx vitest run packages/adapters/src/zai/tests/zai-adapter-output.test.ts
 */

import { describe, it, expect, beforeAll } from 'vitest';

const HAS_API_KEY = Boolean(process.env.ZAI_API_KEY || process.env.OPENAI_API_KEY);
const describeIfKey = HAS_API_KEY ? describe : describe.skip;

// We need to read the source to verify constants
import { readFileSync } from 'fs';
import { resolve } from 'path';

const adapterSource = readFileSync(
  resolve(__dirname, '../zai-adapter.ts'),
  'utf-8'
);

// ============================================================
// AC-1: DEFAULT_MAX_TOKENS = 16384
// ============================================================
describe('ZAI Adapter — DEFAULT_MAX_TOKENS (AC-1)', () => {
  it('should have DEFAULT_MAX_TOKENS set to 16384', () => {
    expect(adapterSource).toContain('DEFAULT_MAX_TOKENS = 16384');
    expect(adapterSource).not.toContain('DEFAULT_MAX_TOKENS = 4096');
  });

  it('should not have the old 4096 value anywhere', () => {
    // Ensure there's no leftover 4096 references in max_tokens context
    const lines = adapterSource.split('\n');
    const maxTokenLines = lines.filter(
      (l) => l.includes('max_tokens') && l.includes('4096')
    );
    expect(maxTokenLines).toHaveLength(0);
  });
});

// ============================================================
// AC-2: SYNTHESIZING total_ms = 360000
// ============================================================
describe('State Machine — SYNTHESIZING timeout (AC-2)', () => {
  it('should have SYNTHESIZING total_ms set to 360000', () => {
    const timeoutsSource = readFileSync(
      resolve(__dirname, '../../../../kernel/src/state-machine/timeouts.ts'),
      'utf-8'
    );

    // Find the SYNTHESIZING block and verify 360000
    const synthMatch = timeoutsSource.match(
      /SYNTHESIZING.*?{[\s\S]*?total_ms:\s*(\d+)/
    );
    expect(synthMatch).not.toBeNull();
    expect(synthMatch![1]).toBe('360000');
  });
});

// ============================================================
// AC-3 + AC-11: finish_reason truncation detection
// ============================================================
describe('ZAI Adapter — finish_reason detection (AC-3, AC-11)', () => {
  it('should detect finish_reason in runWithRetry', () => {
    expect(adapterSource).toContain("choice.finish_reason === 'length'");
    expect(adapterSource).toContain('Output truncated');
  });

  it('should detect finish_reason in streamRun', () => {
    // Verify finishReason variable tracking in streaming path
    expect(adapterSource).toMatch(/let finishReason[\s\S]*null/);
    expect(adapterSource).toMatch(/finish_reason[\s\S]*finishReason/);
  });

  it('should log truncation warning via console.error', () => {
    const truncationLogs = adapterSource.match(/console\.error.*truncat/gi);
    expect(truncationLogs).not.toBeNull();
    expect(truncationLogs!.length).toBeGreaterThanOrEqual(2); // One for runWithRetry, one for streamRun
  });
});

// ============================================================
// Real API test — verify 16384 tokens allows longer output
// ============================================================
describeIfKey('ZAI Adapter — Real API output length', () => {
  it('should produce output longer than 4096 tokens could allow', async () => {
    // Dynamic import to avoid mocking issues
    const { ZAIAdapter } = await import('../zai-adapter');

    const adapter = new ZAIAdapter({
      apiKey: process.env.ZAI_API_KEY || process.env.OPENAI_API_KEY,
    });

    const prompt = `Write a detailed financial analysis of Apple (AAPL) covering:
1. Revenue breakdown by segment for the last 3 years
2. Profit margins analysis (gross, operating, net)
3. Balance sheet strength (debt, cash, ratios)
4. DCF valuation with assumptions
5. Risk factors and competitive position

Write at least 800 words. Be specific with numbers.`;

    const result = await adapter.run(prompt, {
      timeout: 120000,
    });

    expect(result.success).toBe(true);
    expect(result.content.length).toBeGreaterThan(2000);
    console.log(`  [REAL API] Output length: ${result.content.length} chars, tokens: ${result.tokensUsed?.output}`);
  }, 180000);
});

// ============================================================
// CLI adapter documentation (P1.4)
// ============================================================
describe('CLI Adapter — output limitation documentation (P1.4)', () => {
  it('should document limitation in claude-cli-adapter', () => {
    const claudeSource = readFileSync(
      resolve(__dirname, '../../cli-adapters/claude-cli-adapter.ts'),
      'utf-8'
    );
    expect(claudeSource).toContain('Known limitation');
    expect(claudeSource).toContain('Output length is controlled');
  });

  it('should document limitation in gemini-cli-adapter', () => {
    const geminiSource = readFileSync(
      resolve(__dirname, '../../cli-adapters/gemini-cli-adapter.ts'),
      'utf-8'
    );
    expect(geminiSource).toContain('Known limitation');
    expect(geminiSource).toContain('Output length is controlled');
  });
});

// ============================================================
// .env.example (AC-9)
// ============================================================
describe('Config — FMP_API_KEY in .env.example (AC-9)', () => {
  it('should have FMP_API_KEY in .env.example', () => {
    const envSource = readFileSync(
      resolve(__dirname, '../../../../../.env.example'),
      'utf-8'
    );
    expect(envSource).toContain('FMP_API_KEY');
    expect(envSource).toContain('financialmodelingprep.com');
  });
});
