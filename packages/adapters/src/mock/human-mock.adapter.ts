/**
 * Mock Human Adapter
 * Auto-responds to human gates for testing without actual human input
 */

import { BaseMockAdapter } from './mock-adapter';
import type { AdapterConfig, AgentResult, HealthStatus } from '../types/adapter.types';

export interface HumanGateConfig extends AdapterConfig {
  autoApprove?: boolean;
  approvalDelay?: number; // ms to simulate human thinking time
  gateReason?: string;
}

export class MockHumanAdapter extends BaseMockAdapter {
  protected readonly adapterType = 'human' as const;
  protected readonly defaultModel = 'human-v1';
  private approvalCount = 0;

  async run(prompt: string, config: HumanGateConfig = {}): Promise<AgentResult> {
    const inputTokens = this.estimateTokens(prompt);

    // Simulate human "thinking" time
    const delay = config.approvalDelay ?? Math.random() * 1000 + 500;
    await new Promise(resolve => setTimeout(resolve, delay));

    const autoApprove = config.autoApprove ?? true;
    this.approvalCount++;

    const content = this.generateMockHumanResponse(prompt, autoApprove, config.gateReason);
    const outputTokens = this.estimateTokens(content);

    return this.createMockResult(content, inputTokens, outputTokens, {
      gateApproval: autoApprove,
      gateNumber: this.approvalCount,
      thinkingTimeMs: delay,
    });
  }

  private generateMockHumanResponse(
    prompt: string,
    autoApprove: boolean,
    gateReason?: string
  ): string {
    const timestamp = new Date().toISOString();

    if (autoApprove) {
      return `## Human Gate Response - AUTO-APPROVED

**Gate Status**: ✅ APPROVED
**Timestamp**: ${timestamp}
**Reason**: Mock auto-approval for testing

### Review Summary
The following item was presented for human review:
${prompt.substring(0, 200)}${prompt.length > 200 ? '...' : ''}

### Human Decision
**Decision**: APPROVE - Proceed with next step

### Comments (Auto-generated)
${gateReason ?? 'Automated approval for testing purposes. No actual human review performed.'}

---
*This is a mock human response. In production, this would require actual human input through CLI or web interface.*`;
    }

    return `## Human Gate Response - REJECTED

**Gate Status**: ❌ REJECTED
**Timestamp**: ${timestamp}

### Review Summary
The following item requires revision before proceeding.

### Human Decision
**Decision**: REJECT - Requires changes

### Feedback
Mock rejection for testing. In production, a human would provide specific feedback here.

---
*This is a mock human response.*`;
  }

  async healthCheck(): Promise<HealthStatus> {
    return {
      healthy: true,
      latencyMs: 0, // Human response time is unpredictable
      metadata: {
        adapter: this.adapterType,
        model: this.defaultModel,
        mock: true,
        note: 'Human adapter health depends on human availability',
        approvalCount: this.approvalCount,
      },
    };
  }

  estimateCost(_inputTokens: number, _outputTokens: number): number {
    return 0; // Human input has no API cost (but has time cost)
  }

  getApprovalCount(): number {
    return this.approvalCount;
  }

  resetApprovalCount(): void {
    this.approvalCount = 0;
  }
}
