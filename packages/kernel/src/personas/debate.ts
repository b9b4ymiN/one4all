/**
 * Debate Mode System
 *
 * Feature-flagged debate orchestration with timeout handling
 */

import { Mission } from '../state-machine/types.js';

export interface DebateConfig {
  enabled: boolean;
  timeoutSeconds: number;
  maxRounds: number;
}

export const DEFAULT_DEBATE_CONFIG: DebateConfig = {
  enabled: process.env.FEATURE_FLAG_DEBATE_MODE === 'true',
  timeoutSeconds: 300, // 5 minutes per round
  maxRounds: 3,
};

export interface DebateRound {
  round_number: number;
  topic: string;
  unresolved_flags: string[];
}

export interface DebateRecord {
  rounds: DebateRound[];
  summary: string;
}

export class DebateOrchestrator {
  private config: DebateConfig;

  constructor(config: DebateConfig = DEFAULT_DEBATE_CONFIG) {
    this.config = config;
  }

  /**
   * Check if debate mode is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Run debate phase with feature flag check
   */
  async runDebate(mission: Mission): Promise<DebateRecord> {
    if (!this.isEnabled()) {
      return this.createSimpleModeRecord();
    }

    const analystOutputs = this.analystOutputsToArray(mission.state.analyst_outputs);
    if (analystOutputs.length === 0) {
      return this.createNoAnalystsRecord();
    }

    // Check if there's meaningful variance to debate
    const hasVariance = this.detectVariance(analystOutputs);
    if (!hasVariance) {
      return this.createNoVarianceRecord();
    }

    // Execute debate with timeout
    return await this.executeDebate(mission);
  }

  /**
   * Convert analyst_outputs from Record to array
   */
  private analystOutputsToArray(outputs?: Record<string, unknown>): any[] {
    if (!outputs) return [];
    return Object.values(outputs).filter(v => v !== null && v !== undefined);
  }

  /**
   * Execute debate rounds with timeout handling
   */
  private async executeDebate(mission: Mission): Promise<DebateRecord> {
    const rounds: DebateRound[] = [];
    const maxRounds = this.config.maxRounds;

    for (let roundNum = 1; roundNum <= maxRounds; roundNum++) {
      const roundResult = await this.runRound(mission, roundNum);
      rounds.push(roundResult);

      // Check if debate should continue (unresolved issues)
      if (roundResult.unresolved_flags.length === 0) {
        break;
      }
    }

    return {
      rounds,
      summary: this.generateSummary(rounds),
    };
  }

  /**
   * Run a single debate round with timeout
   */
  private async runRound(mission: Mission, roundNumber: number): Promise<DebateRound> {
    const timeoutMs = this.config.timeoutSeconds * 1000;

    // Create timeout promise
    const timeoutPromise = new Promise<DebateRound>((_, reject) => {
      setTimeout(() => reject(new Error('Debate round timeout')), timeoutMs);
    });

    // Create debate round promise
    const debatePromise = this.executeRoundLogic(mission, roundNumber);

    try {
      return await Promise.race([debatePromise, timeoutPromise]);
    } catch (error) {
      if (error instanceof Error && error.message === 'Debate round timeout') {
        console.log(`[DEBATE] Round ${roundNumber} timed out after ${this.config.timeoutSeconds}s`);
        return {
          round_number: roundNumber,
          topic: this.getRoundTopic(roundNumber),
          unresolved_flags: ['TIMEOUT'],
        };
      }
      throw error;
    }
  }

  /**
   * Execute the actual debate logic for a round
   */
  private async executeRoundLogic(mission: Mission, roundNumber: number): Promise<DebateRound> {
    const analystOutputs = this.analystOutputsToArray(mission.state.analyst_outputs);
    const unresolvedFlags: string[] = [];

    // Compare analyst outputs and identify disagreements
    const topics = this.identifyDisagreements(analystOutputs);

    // For each disagreement, check if it can be resolved
    for (const topic of topics) {
      const resolved = await this.attemptResolution(mission, topic);
      if (!resolved) {
        unresolvedFlags.push(topic);
      }
    }

    return {
      round_number: roundNumber,
      topic: this.getRoundTopic(roundNumber),
      unresolved_flags: unresolvedFlags,
    };
  }

  /**
   * Detect variance in analyst outputs
   */
  private detectVariance(outputs: any[]): boolean {
    if (outputs.length < 2) return false;

    // Check for variance in valuations
    const valuations = outputs
      .map(o => o.fair_value)
      .filter(v => v !== undefined);

    if (valuations.length < 2) return false;

    const min = Math.min(...valuations);
    const max = Math.max(...valuations);
    const variance = ((max - min) / min) * 100;

    return variance > 10; // 10% variance threshold
  }

  /**
   * Identify key disagreements between analysts
   */
  private identifyDisagreements(outputs: any[]): string[] {
    const disagreements: string[] = [];

    // Compare valuations
    const valuations = outputs.map(o => o.fair_value).filter(v => v !== undefined);
    if (valuations.length >= 2) {
      const min = Math.min(...valuations);
      const max = Math.max(...valuations);
      if ((max - min) / min > 0.15) {
        disagreements.push('VALUATION_DISAGREEMENT');
      }
    }

    // Compare risk assessments
    const riskLevels = outputs.map(o => o.risk_level).filter(r => r !== undefined);
    if (riskLevels.length >= 2) {
      const uniqueRisks = new Set(riskLevels);
      if (uniqueRisks.size > 1) {
        disagreements.push('RISK_ASSESSMENT_DISAGREEMENT');
      }
    }

    // Compare theses
    const theses = outputs.map(o => o.thesis_summary).filter(t => t !== undefined);
    if (theses.length >= 2) {
      disagreements.push('THESIS_DISAGREEMENT');
    }

    return disagreements;
  }

  /**
   * Attempt to resolve a specific disagreement
   */
  private async attemptResolution(mission: Mission, topic: string): Promise<boolean> {
    // In full implementation, this would:
    // 1. Present the disagreement to analysts
    // 2. Allow them to debate with evidence
    // 3. Check if consensus is reached

    // For now, mark as unresolved for demonstration
    return false;
  }

  /**
   * Get round topic based on round number
   */
  private getRoundTopic(roundNumber: number): string {
    const topics = {
      1: 'Valuation and risk assessment',
      2: 'Thesis disagreements and evidence quality',
      3: 'Final reconciliation and consensus building',
    };
    return topics[roundNumber as keyof typeof topics] || 'Additional discussion';
  }

  /**
   * Generate debate summary
   */
  private generateSummary(rounds: DebateRound[]): string {
    const totalRounds = rounds.length;
    const totalUnresolved = rounds.reduce((sum, r) => sum + r.unresolved_flags.length, 0);

    if (totalUnresolved === 0) {
      return `Debate completed in ${totalRounds} round(s) with full consensus`;
    }

    return `Debate completed after ${totalRounds} round(s) with ${totalUnresolved} unresolved issue(s)`;
  }

  /**
   * Create simple mode record
   */
  private createSimpleModeRecord(): DebateRecord {
    return {
      rounds: [{
        round_number: 1,
        topic: 'Valuation and risk assessment',
        unresolved_flags: [],
      }],
      summary: 'Analysis completed without debate (simple mode)',
    };
  }

  /**
   * Create no analysts record
   */
  private createNoAnalystsRecord(): DebateRecord {
    return {
      rounds: [{
        round_number: 1,
        topic: 'System initialization',
        unresolved_flags: ['NO_ANALYSTS'],
      }],
      summary: 'Debate skipped - no analyst outputs available',
    };
  }

  /**
   * Create no variance record
   */
  private createNoVarianceRecord(): DebateRecord {
    return {
      rounds: [{
        round_number: 1,
        topic: 'Consensus check',
        unresolved_flags: [],
      }],
      summary: 'Debate skipped - analyst outputs are consistent',
    };
  }
}
