/**
 * Mock Claude Adapter
 * Simulates Claude API responses for testing
 */

import { BaseMockAdapter } from './mock-adapter';
import type { AdapterConfig, AgentResult } from '../types/adapter.types';

export class MockClaudeAdapter extends BaseMockAdapter {
  protected readonly adapterType = 'claude' as const;
  protected readonly defaultModel = 'claude-3-opus-20240229';

  async run(prompt: string, config: AdapterConfig = {}): Promise<AgentResult> {
    const inputTokens = this.estimateTokens(prompt);

    // Generate mock response based on prompt keywords
    const content = this.generateMockResponse(prompt);
    const outputTokens = this.estimateTokens(content);

    return this.createMockResult(content, inputTokens, outputTokens, {
      temperature: config.temperature ?? 0.7,
      maxTokens: config.maxTokens ?? 4096,
    });
  }

  private generateMockResponse(prompt: string): string {
    const lowerPrompt = prompt.toLowerCase();

    // Investment analysis responses
    if (lowerPrompt.includes('analyze') || lowerPrompt.includes('stock') || lowerPrompt.includes('valuation')) {
      return `## Investment Analysis Summary

Based on my analysis of the provided data, here are my findings:

### Key Findings
- The company demonstrates strong fundamentals with consistent revenue growth
- Cash flow generation remains healthy across business cycles
- Management has demonstrated prudent capital allocation

### Valuation Assessment
Using a conservative DCF approach with appropriate discount rates:
- Intrinsic Value Range: THB 24.00 - 32.00 per share
- Margin of Safety at Current Price: Assessment pending current market data

### Risk Factors
1. Market volatility in the sector
2. Currency fluctuations affecting export revenue
3. Competitive pressure from new entrants

### Recommendation
Current assessment suggests WAIT_FOR_PRICE status until better margin of safety available.

*This is a mock response for testing purposes.*`;
    }

    // Research responses
    if (lowerPrompt.includes('research') || lowerPrompt.includes('gather') || lowerPrompt.includes('evidence')) {
      return `## Research Evidence Pack

### Sources Consulted
- SEC Filings (Form 10-K, 10-Q)
- Annual Reports
- Industry Analysis Reports

### Key Evidence Gathered
1. **Financial Data**: Revenue, EBITDA, Free Cash Flow trends
2. **Market Position**: Competitive landscape analysis
3. **Management Guidance**: Future outlook statements

### Evidence Quality Assessment
- Tier 1 Sources: 65% (Official filings)
- Tier 2 Sources: 30% (Reputable third-party analysis)
- Tier 3 Sources: 5% (Management commentary)

*This is a mock response for testing purposes.*`;
    }

    // Default response
    return `I understand you're asking about: "${prompt.substring(0, 100)}${prompt.length > 100 ? '...' : ''}"

This is a mock Claude response. In production, this would call the actual Anthropic Claude API
to generate a thoughtful response based on the agent's persona and the given context.

**Mock Response Details:**
- Model: ${this.defaultModel}
- Timestamp: ${new Date().toISOString()}
- Status: Mock response for testing`;
  }

  estimateCost(inputTokens: number, outputTokens: number): number {
    // Claude Opus pricing (as of 2024): $15/1M input, $75/1M output
    return (inputTokens / 1_000_000) * 15 + (outputTokens / 1_000_000) * 75;
  }
}
