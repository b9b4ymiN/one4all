/**
 * Mock vs real API comparison utilities
 */

import type { AgentResult } from '../../types/adapter.types';

/**
 * Result of parity comparison between mock and real API
 */
export interface ParityResult {
  isMatch: boolean;
  diffs: ParityDiff[];
  score: number; // 0-100, higher is better
  metrics: {
    structureMatch: boolean;
    successMatch: boolean;
    latencyRatio?: number;
    tokenVariance?: number;
  };
}

/**
 * Individual difference found during parity comparison
 */
export interface ParityDiff {
  field: string;
  mockValue: unknown;
  realValue: unknown;
  severity: 'critical' | 'warning' | 'info';
}

/**
 * Thresholds for determining parity between mock and real results
 */
export const PARITY_THRESHOLDS = {
  structureMatch: 100, // Mock and real should have identical structure
  latencyRatio: 10, // Real API can be up to 10x slower than mock
  tokenVariance: 0.3, // Allow 30% variance in token counts
  successRate: 95, // Both should have >= 95% success rate
};

/**
 * Compare mock and real API results for parity
 */
export function compareParity(mockResult: AgentResult, realResult: AgentResult): ParityResult {
  const diffs: ParityDiff[] = [];
  let score = 100;

  // Check success status match
  const successMatch = mockResult.success === realResult.success;
  if (!successMatch) {
    diffs.push({
      field: 'success',
      mockValue: mockResult.success,
      realValue: realResult.success,
      severity: 'critical',
    });
    score -= 30;
  }

  // Check content presence
  const mockHasContent = Boolean(mockResult.content && mockResult.content.length > 0);
  const realHasContent = Boolean(realResult.content && realResult.content.length > 0);
  const structureMatch = mockHasContent === realHasContent;

  if (!structureMatch) {
    diffs.push({
      field: 'content',
      mockValue: mockHasContent ? 'present' : 'empty',
      realValue: realHasContent ? 'present' : 'empty',
      severity: 'critical',
    });
    score -= 20;
  }

  // Compare latency if both have timing data
  let latencyRatio: number | undefined;
  if (mockResult.timing && realResult.timing) {
    latencyRatio = realResult.timing.durationMs / mockResult.timing.durationMs;
    if (latencyRatio > PARITY_THRESHOLDS.latencyRatio) {
      diffs.push({
        field: 'timing.durationMs',
        mockValue: mockResult.timing.durationMs,
        realValue: realResult.timing.durationMs,
        severity: 'info',
      });
      // Don't penalize score for latency - it's expected
    }
  }

  // Compare token counts if both have them
  let tokenVariance: number | undefined;
  if (mockResult.tokensUsed && realResult.tokensUsed) {
    const mockTotal = mockResult.tokensUsed.total;
    const realTotal = realResult.tokensUsed.total;
    tokenVariance = Math.abs(realTotal - mockTotal) / mockTotal;

    if (tokenVariance > PARITY_THRESHOLDS.tokenVariance) {
      diffs.push({
        field: 'tokensUsed.total',
        mockValue: mockTotal,
        realValue: realTotal,
        severity: 'warning',
      });
      score -= 10;
    }
  }

  // Check model field match
  if (mockResult.model && realResult.model && mockResult.model !== realResult.model) {
    diffs.push({
      field: 'model',
      mockValue: mockResult.model,
      realValue: realResult.model,
      severity: 'info',
    });
  }

  // Check error match (if both failed)
  if (!mockResult.success && !realResult.success) {
    if (mockResult.error !== realResult.error) {
      diffs.push({
        field: 'error',
        mockValue: mockResult.error,
        realValue: realResult.error,
        severity: 'warning',
      });
      score -= 5;
    }
  }

  return {
    isMatch: score >= PARITY_THRESHOLDS.successRate,
    diffs,
    score: Math.max(0, score),
    metrics: {
      structureMatch,
      successMatch,
      latencyRatio,
      tokenVariance,
    },
  };
}

/**
 * Format parity result for display
 */
export function formatParityResult(result: ParityResult): string {
  const lines = [
    `Parity Score: ${result.score}/100`,
    `Match: ${result.isMatch ? '✓' : '✗'}`,
    '',
    'Metrics:',
    `  Structure: ${result.metrics.structureMatch ? '✓' : '✗'}`,
    `  Success: ${result.metrics.successMatch ? '✓' : '✗'}`,
    result.metrics.latencyRatio !== undefined && `  Latency Ratio: ${result.metrics.latencyRatio.toFixed(2)}x`,
    result.metrics.tokenVariance !== undefined && `  Token Variance: ${(result.metrics.tokenVariance * 100).toFixed(1)}%`,
  ].filter(Boolean);

  if (result.diffs.length > 0) {
    lines.push('', 'Differences:');
    result.diffs.forEach((diff) => {
      lines.push(`  [${diff.severity.toUpperCase()}] ${diff.field}`);
      lines.push(`    Mock: ${JSON.stringify(diff.mockValue)}`);
      lines.push(`    Real: ${JSON.stringify(diff.realValue)}`);
    });
  }

  return lines.join('\n');
}
