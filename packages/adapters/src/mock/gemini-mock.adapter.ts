/**
 * Mock Gemini Adapter
 * Simulates Google Gemini API responses for testing
 */

import { BaseMockAdapter } from './mock-adapter';
import type { AdapterConfig, AgentResult } from '../types/adapter.types';

export class MockGeminiAdapter extends BaseMockAdapter {
  protected readonly adapterType = 'gemini' as const;
  protected readonly defaultModel = 'gemini-1.5-pro';

  async run(prompt: string, config: AdapterConfig = {}): Promise<AgentResult> {
    const inputTokens = this.estimateTokens(prompt);
    const content = this.generateMockResponse(prompt);
    const outputTokens = this.estimateTokens(content);

    return this.createMockResult(content, inputTokens, outputTokens, {
      temperature: config.temperature ?? 0.7,
    });
  }

  private generateMockResponse(prompt: string): string {
    const lowerPrompt = prompt.toLowerCase();

    if (lowerPrompt.includes('search') || lowerPrompt.includes('find') || lowerPrompt.includes('locate')) {
      return `## Search Results

### Query Analysis
I've searched for the requested information using multiple data sources.

### Results Found
1. **Primary Source**: Official company documents
2. **Secondary Sources**: Financial news outlets, analyst reports
3. **Supplementary Data**: Industry benchmarks

### Data Points Collected
- Revenue figures for the last 5 years
- Earnings per share (EPS) trends
- Market share data in key segments
- Peer comparison metrics

### Source Reliability
All Tier 1 and Tier 2 sources have been verified for accuracy.

*This is a mock Gemini response for testing purposes.*`;
    }

    return `**Mock Gemini Response**

I've processed your request through the Google Gemini simulation.

Your input was analyzed and this simulated response was generated.
In production, this would utilize Google's Gemini 1.5 Pro model
to provide comprehensive search and analysis capabilities.

**Response Metadata:**
- Model: ${this.defaultModel}
- Processing Time: Simulated
- Status: Mock response for testing`;
  }

  estimateCost(inputTokens: number, outputTokens: number): number {
    // Gemini Pro pricing (as of 2024): $0.50/1M input, $1.50/1M output
    return (inputTokens / 1_000_000) * 0.5 + (outputTokens / 1_000_000) * 1.5;
  }
}
