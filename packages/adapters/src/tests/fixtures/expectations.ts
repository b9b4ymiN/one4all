/**
 * Expected response patterns and validation utilities
 */

import type { AgentResult } from '../../types/adapter.types';

/**
 * Expect the result to be successful
 */
export function expectSuccess(result: AgentResult): void {
  if (!result.success) {
    throw new Error(`Expected successful result, but got error: ${result.error || 'Unknown error'}`);
  }
}

/**
 * Expect the result to have specific structure fields
 */
export function expectStructure(
  result: AgentResult,
  options: {
    hasContent?: boolean;
    hasTiming?: boolean;
    hasTokens?: boolean;
    hasCost?: boolean;
    hasMetadata?: boolean;
  } = {}
): void {
  const {
    hasContent = true,
    hasTiming = false,
    hasTokens = false,
    hasCost = false,
    hasMetadata = false,
  } = options;

  const errors: string[] = [];

  if (hasContent && (!result.content || result.content.length === 0)) {
    errors.push('Expected non-empty content field');
  }

  if (hasTiming && !result.timing) {
    errors.push('Expected timing field to be present');
  }

  if (hasTiming && result.timing) {
    if (typeof result.timing.startedAt !== 'number' || result.timing.startedAt <= 0) {
      errors.push('Expected valid timing.startedAt timestamp');
    }
    if (typeof result.timing.completedAt !== 'number' || result.timing.completedAt <= 0) {
      errors.push('Expected valid timing.completedAt timestamp');
    }
    if (typeof result.timing.durationMs !== 'number' || result.timing.durationMs <= 0) {
      errors.push('Expected valid timing.durationMs');
    }
    if (result.timing.completedAt <= result.timing.startedAt) {
      errors.push('Expected completedAt > startedAt');
    }
  }

  if (hasTokens && !result.tokensUsed) {
    errors.push('Expected tokensUsed field to be present');
  }

  if (hasTokens && result.tokensUsed) {
    if (typeof result.tokensUsed.input !== 'number' || result.tokensUsed.input < 0) {
      errors.push('Expected valid tokensUsed.input');
    }
    if (typeof result.tokensUsed.output !== 'number' || result.tokensUsed.output < 0) {
      errors.push('Expected valid tokensUsed.output');
    }
    if (typeof result.tokensUsed.total !== 'number' || result.tokensUsed.total < 0) {
      errors.push('Expected valid tokensUsed.total');
    }
    if (result.tokensUsed.total !== result.tokensUsed.input + result.tokensUsed.output) {
      errors.push('Expected tokensUsed.total = input + output');
    }
  }

  if (hasCost && result.cost === undefined) {
    errors.push('Expected cost field to be present');
  }

  if (hasCost && typeof result.cost === 'number' && result.cost < 0) {
    errors.push('Expected cost to be non-negative');
  }

  if (hasMetadata && !result.metadata) {
    errors.push('Expected metadata field to be present');
  }

  if (errors.length > 0) {
    throw new Error(`Structure validation failed:\n${errors.map((e) => `  - ${e}`).join('\n')}`);
  }
}

/**
 * Expect the result content to not be empty
 */
export function expectContentNotEmpty(result: AgentResult): void {
  expectSuccess(result);

  if (!result.content || result.content.trim().length === 0) {
    throw new Error('Expected non-empty content, but got empty string');
  }
}

/**
 * Expect the result content to contain a substring
 */
export function expectContentContains(result: AgentResult, substring: string): void {
  expectContentNotEmpty(result);

  if (!result.content.includes(substring)) {
    throw new Error(`Expected content to contain "${substring}", but it did not`);
  }
}

/**
 * Expect the result content to match a regex pattern
 */
export function expectContentMatches(result: AgentResult, pattern: RegExp): void {
  expectContentNotEmpty(result);

  if (!pattern.test(result.content)) {
    throw new Error(`Expected content to match pattern ${pattern}, but it did not`);
  }
}

/**
 * Expect the result to complete within a time threshold
 */
export function expectCompletionWithin(result: AgentResult, maxDurationMs: number): void {
  expectSuccess(result);

  if (!result.timing) {
    throw new Error('Cannot check completion time: timing field is missing');
  }

  if (result.timing.durationMs > maxDurationMs) {
    throw new Error(
      `Expected completion within ${maxDurationMs}ms, but took ${result.timing.durationMs}ms`
    );
  }
}

/**
 * Expect the result to fail with a specific error message
 */
export function expectError(result: AgentResult, expectedError?: string): void {
  if (result.success) {
    throw new Error('Expected result to fail, but it succeeded');
  }

  if (expectedError && !result.error?.includes(expectedError)) {
    throw new Error(`Expected error to contain "${expectedError}", but got: ${result.error}`);
  }
}

/**
 * Expect the result to have a valid model field
 */
export function expectValidModel(result: AgentResult): void {
  if (!result.model || typeof result.model !== 'string' || result.model.trim().length === 0) {
    throw new Error('Expected valid model field');
  }
}
