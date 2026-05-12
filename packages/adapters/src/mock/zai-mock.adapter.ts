/**
 * Mock ZAI Adapter
 * Simulates OpenAI-compatible API responses for testing
 */

import { BaseMockAdapter } from './mock-adapter';
import type { AdapterConfig, AgentResult } from '../types/adapter.types';

export class MockZAIAdapter extends BaseMockAdapter {
  protected readonly adapterType = 'zai' as const;
  protected readonly defaultModel = 'zai-v1';

  async run(prompt: string, config: AdapterConfig = {}): Promise<AgentResult> {
    const inputTokens = this.estimateTokens(prompt);
    const content = this.generateMockResponse(prompt);
    const outputTokens = this.estimateTokens(content);

    return this.createMockResult(content, inputTokens, outputTokens, {
      temperature: config.temperature ?? 0.5,
    });
  }

  private generateMockResponse(prompt: string): string {
    const lowerPrompt = prompt.toLowerCase();

    if (lowerPrompt.includes('downside') || lowerPrompt.includes('risk') || lowerPrompt.includes('scenario')) {
      return `## Downside Risk Analysis

### Bear Case Scenarios

**Scenario 1: Market Contraction (30% probability)**
- Revenue decline: 15-25%
- Margin compression: 200-400 bps
- Impact on intrinsic value: -35% to -45%

**Scenario 2: Competitive Disruption (20% probability)**
- Market share loss: 5-10 percentage points
- Pricing pressure: 10-15% reduction
- Impact on intrinsic value: -25% to -35%

**Scenario 3: Regulatory Change (15% probability)**
- Compliance costs: +5-10% of opex
- Revenue restrictions: Potential cap on growth
- Impact on intrinsic value: -15% to -25%

### Margin of Safety Analysis
At current valuation, the market is pricing in:
- Optimistic growth scenarios
- Minimal execution risk
- Limited competitive threat

**Recommendation**: Significant downside risk suggests caution.

*This is a mock ZAI response for testing purposes.*`;
    }

    return `**Mock ZAI Analysis**

Your request has been processed through the downside analysis framework.

The ZAI adapter specializes in risk assessment and bear-case analysis.
In production, this would use an OpenAI-compatible backend to provide
comprehensive scenario modeling and risk evaluation.

**Analysis Framework:**
- Model: ${this.defaultModel}
- Focus: Downside protection, margin of safety
- Status: Mock response for testing`;
  }

  estimateCost(inputTokens: number, outputTokens: number): number {
    // ZAI assumed pricing similar to GPT-4: $30/1M input, $60/1M output
    return (inputTokens / 1_000_000) * 30 + (outputTokens / 1_000_000) * 60;
  }
}
