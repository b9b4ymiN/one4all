/**
 * Mock Python Quant Adapter
 * Simulates Python financial calculation responses for testing
 */

import { BaseMockAdapter } from './mock-adapter';
import type { AdapterConfig, AgentResult } from '../types/adapter.types';

export class MockPythonQuantAdapter extends BaseMockAdapter {
  protected readonly adapterType = 'python' as const;
  protected readonly defaultModel = 'quant-v1';

  async run(prompt: string, config: AdapterConfig = {}): Promise<AgentResult> {
    const inputTokens = this.estimateTokens(prompt);

    // Parse the calculation request from prompt
    const content = this.generateMockCalculation(prompt);
    const outputTokens = this.estimateTokens(content);

    return this.createMockResult(content, inputTokens, outputTokens, {
      calculationType: this.inferCalculationType(prompt),
    });
  }

  private inferCalculationType(prompt: string): string {
    const lower = prompt.toLowerCase();
    if (lower.includes('dcf') || lower.includes('discount')) return 'DCF';
    if (lower.includes('reverse')) return 'REVERSE_DCF';
    if (lower.includes('sizing') || lower.includes('position')) return 'PORTFOLIO_SIZING';
    if (lower.includes('downside') || lower.includes('scenario')) return 'RISK_ANALYSIS';
    return 'GENERAL';
  }

  private generateMockCalculation(prompt: string): string {
    const calcType = this.inferCalculationType(prompt);

    switch (calcType) {
      case 'DCF':
        return `{
  "calculationType": "DCF",
  "inputs": {
    "freeCashFlow": 1000000000,
    "growthRates": [[0.10, 5], [0.05, 5]],
    "discountRate": 0.10,
    "terminalGrowthRate": 0.025,
    "yearsToProject": 10
  },
  "outputs": {
    "presentValueFCF": 8500000000,
    "terminalValue": 12000000000,
    "enterpriseValue": 20500000000,
    "impliedSharePrice": 28.50
  },
  "metadata": {
    "currency": "THB",
    "sharesOutstanding": 720000000,
    "netDebt": 2000000000
  }
}`;

      case 'REVERSE_DCF':
        return `{
  "calculationType": "REVERSE_DCF",
  "inputs": {
    "currentPrice": 31.50,
    "targetPrice": 28.50,
    "marginOfSafety": 0.30,
    "discountRate": 0.10,
    "terminalGrowthRate": 0.025
  },
  "outputs": {
    "requiredGrowthRate": 0.065,
    "impliedFCF": 850000000,
    "marketImpliedGrowth": 0.095,
    "assessment": "Market pricing in higher growth than our conservative estimate"
  }
}`;

      case 'PORTFOLIO_SIZING':
        return `{
  "calculationType": "PORTFOLIO_SIZING",
  "inputs": {
    "portfolioValue": 1000000,
    "convictionLevel": 7,
    "marginOfSafety": 0.30,
    "currentPosition": 0
  },
  "outputs": {
    "recommendedPositionSize": 85000,
    "positionPercentage": 0.085,
    "maxPosition": 120000,
    "minPosition": 50000,
    "rationale": "High conviction (7/10) with good margin of safety justifies 8.5% position"
  }
}`;

      case 'RISK_ANALYSIS':
        return `{
  "calculationType": "RISK_ANALYSIS",
  "scenarios": [
    {
      "name": "Base Case",
      "probability": 0.50,
      "value": 28.50,
      "return": -9.5
    },
    {
      "name": "Bear Case",
      "probability": 0.25,
      "value": 18.00,
      "return": -42.9
    },
    {
      "name": "Bull Case",
      "probability": 0.25,
      "value": 38.00,
      "return": 20.6
    }
  ],
  "expectedValue": 28.25,
  "riskRewardRatio": 1.8,
  "maxDrawdown": -42.9
}`;

      default:
        return `{
  "calculationType": "GENERAL",
  "status": "Mock quant calculation",
  "message": "Python quant adapter processed the request",
  "note": "In production, this would run actual NumPy/Pandas calculations"
}`;
    }
  }

  estimateCost(_inputTokens: number, _outputTokens: number): number {
    return 0; // Local Python calculations have no API cost
  }
}
