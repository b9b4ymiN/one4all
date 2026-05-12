/**
 * Mock Codex Adapter
 * Simulates OpenAI Codex responses for testing
 */

import { BaseMockAdapter } from './mock-adapter';
import type { AdapterConfig, AgentResult } from '../types/adapter.types';

export class MockCodexAdapter extends BaseMockAdapter {
  protected readonly adapterType = 'codex' as const;
  protected readonly defaultModel = 'codex-v1';

  async run(prompt: string, config: AdapterConfig = {}): Promise<AgentResult> {
    const inputTokens = this.estimateTokens(prompt);
    const content = this.generateMockResponse(prompt);
    const outputTokens = this.estimateTokens(content);

    return this.createMockResult(content, inputTokens, outputTokens, {});
  }

  private generateMockResponse(prompt: string): string {
    const lowerPrompt = prompt.toLowerCase();

    if (lowerPrompt.includes('calculate') || lowerPrompt.includes('compute') || lowerPrompt.includes('formula')) {
      const codeBlock = `
Base Year FCF: Provided as input
Growth Rate: Applied per specification
Discount Rate: WACC as specified
Terminal Growth: 2.5% (conservative)

Projected Cash Flows:
Year 1: [Calculated Value]
Year 2: [Calculated Value]
...
Terminal Value: [Calculated Value]

Present Value of FCFs: [Sum]
Present Value of TV:    [Value]
Enterprise Value:      [Sum]`;

      return `## Calculation Results

### Input Parameters
Based on the provided parameters, here are the computed results:

### Discounted Cash Flow (DCF) Analysis
${codeBlock}

### Output Summary
- Implied Share Price: Calculated based on shares outstanding
- Margin of Safety: Determined by comparing to current price

*This is a mock Codex calculation response for testing purposes.*`;
    }

    return `**Mock Codex Response**

Your calculation request has been received.

The Codex adapter specializes in financial modeling and calculations.
In production, this would process complex financial formulas and
return computed values for valuation and portfolio analysis.

**Response Details:**
- Model: ${this.defaultModel}
- Computation: Simulated
- Status: Mock response for testing`;
  }

  estimateCost(_inputTokens: number, _outputTokens: number): number {
    // Codex assumed pricing: $10/1M input, $20/1M output
    return 0; // Mock cost is always 0
  }
}
