/**
 * Evidence Auditor - Track and score evidence used in decisions
 */

import { EvidenceTiers } from '@one4all/shared';

export interface Evidence {
  id: string;
  missionId: string;
  source: string;
  tier: number;
  content: string;
  timestamp: string;
  agentId?: string;
  tags: string[];
  metadata: Record<string, unknown>;
  score?: number;
  verified?: boolean;
}

export interface EvidenceScore {
  evidenceId: string;
  totalScore: number;
  tierScore: number;
  recencyScore: number;
  sourceScore: number;
  verificationScore: number;
  breakdown: {
    tier: number;
    recency: number;
    source: number;
    verification: number;
  };
}

export interface AuditReport {
  missionId: string;
  timestamp: string;
  totalEvidence: number;
  evidenceByTier: Record<number, number>;
  averageScore: number;
  topEvidence: Evidence[];
  unverifiedEvidence: Evidence[];
  sources: string[];
  recommendations: string[];
}

export interface AuditorConfig {
  enableScoring?: boolean;
  tierWeights?: Record<number, number>;
  recencyDecayDays?: number;
  minAcceptableScore?: number;
}

const DEFAULT_CONFIG: AuditorConfig = {
  enableScoring: true,
  tierWeights: {
    [EvidenceTiers.TIER_1]: 1.0,
    [EvidenceTiers.TIER_2]: 0.7,
    [EvidenceTiers.TIER_3]: 0.4,
  },
  recencyDecayDays: 365,
  minAcceptableScore: 0.5,
};

export class EvidenceAuditor {
  private evidence: Map<string, Evidence>;
  private config: AuditorConfig;

  constructor(config: AuditorConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.evidence = new Map();
  }

  addEvidence(evidence: Omit<Evidence, 'id' | 'timestamp'>): Evidence {
    const newEvidence: Evidence = {
      ...evidence,
      id: this.generateId(),
      timestamp: new Date().toISOString(),
    };

    if (this.config.enableScoring) {
      newEvidence.score = this.calculateEvidenceScore(newEvidence).totalScore;
    }

    this.evidence.set(newEvidence.id, newEvidence);
    return newEvidence;
  }

  getEvidence(evidenceId: string): Evidence | null {
    return this.evidence.get(evidenceId) || null;
  }

  getEvidenceByMission(missionId: string): Evidence[] {
    return Array.from(this.evidence.values()).filter(e => e.missionId === missionId);
  }

  getEvidenceByTier(missionId: string, tier: number): Evidence[] {
    return this.getEvidenceByMission(missionId).filter(e => e.tier === tier);
  }

  getEvidenceBySource(missionId: string, source: string): Evidence[] {
    return this.getEvidenceByMission(missionId).filter(e => e.source === source);
  }

  getEvidenceByTag(missionId: string, tag: string): Evidence[] {
    return this.getEvidenceByMission(missionId).filter(e => e.tags.includes(tag));
  }

  calculateEvidenceScore(evidence: Evidence): EvidenceScore {
    const tierScore = this.config.tierWeights![evidence.tier] || 0.5;
    const recencyScore = this.calculateRecencyScore(evidence.timestamp);
    const sourceScore = this.calculateSourceScore(evidence.source);
    const verificationScore = evidence.verified ? 1.0 : 0.5;

    const totalScore = (tierScore * 0.4 + recencyScore * 0.2 + sourceScore * 0.2 + verificationScore * 0.2);

    return {
      evidenceId: evidence.id,
      totalScore,
      tierScore,
      recencyScore,
      sourceScore,
      verificationScore,
      breakdown: {
        tier: tierScore,
        recency: recencyScore,
        source: sourceScore,
        verification: verificationScore,
      },
    };
  }

  private calculateRecencyScore(timestamp: string): number {
    const evidenceAge = Date.now() - new Date(timestamp).getTime();
    const ageInDays = evidenceAge / (1000 * 60 * 60 * 24);
    const decayDays = this.config.recencyDecayDays!;

    if (ageInDays <= 1) return 1.0;
    if (ageInDays >= decayDays) return 0.1;

    return Math.max(0.1, 1 - (ageInDays / decayDays) * 0.9);
  }

  private calculateSourceScore(source: string): number {
    const trustedSources = [
      'sec.gov',
      'investor.apple.com',
      'investor.microsoft.com',
      'investor.berkshirehathaway.com',
    ];

    const lowerSource = source.toLowerCase();
    if (trustedSources.some(ts => lowerSource.includes(ts))) {
      return 1.0;
    }

    if (lowerSource.includes('press') || lowerSource.includes('news')) {
      return 0.6;
    }

    return 0.5;
  }

  verifyEvidence(evidenceId: string): boolean {
    const evidence = this.evidence.get(evidenceId);
    if (!evidence) {
      return false;
    }

    evidence.verified = true;
    if (this.config.enableScoring) {
      evidence.score = this.calculateEvidenceScore(evidence).totalScore;
    }

    return true;
  }

  generateAuditReport(missionId: string): AuditReport {
    const evidence = this.getEvidenceByMission(missionId);

    const evidenceByTier: Record<number, number> = {};
    for (const tier of [1, 2, 3]) {
      evidenceByTier[tier] = evidence.filter(e => e.tier === tier).length;
    }

    const totalScore = evidence.reduce((sum, e) => sum + (e.score || 0), 0);
    const averageScore = evidence.length > 0 ? totalScore / evidence.length : 0;

    const topEvidence = [...evidence]
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, 5);

    const unverifiedEvidence = evidence.filter(e => !e.verified);

    const sources = [...new Set(evidence.map(e => e.source))];

    const recommendations = this.generateRecommendations(evidence, averageScore);

    return {
      missionId,
      timestamp: new Date().toISOString(),
      totalEvidence: evidence.length,
      evidenceByTier,
      averageScore,
      topEvidence,
      unverifiedEvidence,
      sources,
      recommendations,
    };
  }

  private generateRecommendations(evidence: Evidence[], averageScore: number): string[] {
    const recommendations: string[] = [];

    const tier1Count = evidence.filter(e => e.tier === 1).length;
    const tier3Count = evidence.filter(e => e.tier === 3).length;

    if (tier1Count === 0) {
      recommendations.push('Consider adding Tier 1 evidence (official sources) for stronger support.');
    }

    if (tier3Count > evidence.length * 0.5) {
      recommendations.push('More than half of evidence is Tier 3. Seek higher-quality sources.');
    }

    const unverified = evidence.filter(e => !e.verified).length;
    if (unverified > evidence.length * 0.3) {
      recommendations.push(`${unverified} pieces of evidence are unverified. Review and verify.`);
    }

    if (averageScore < this.config.minAcceptableScore!) {
      recommendations.push(`Average evidence score (${averageScore.toFixed(2)}) is below minimum acceptable threshold.`);
    }

    const sources = [...new Set(evidence.map(e => e.source))];
    if (sources.length < 3) {
      recommendations.push('Evidence comes from limited sources. Diversify your sources.');
    }

    if (recommendations.length === 0) {
      recommendations.push('Evidence quality is good. No major concerns.');
    }

    return recommendations;
  }

  getEvidenceChain(missionId: string): Evidence[][] {
    const evidence = this.getEvidenceByMission(missionId);
    const chains: Evidence[][] = [];

    const sourceGroups = new Map<string, Evidence[]>();
    for (const e of evidence) {
      if (!sourceGroups.has(e.source)) {
        sourceGroups.set(e.source, []);
      }
      sourceGroups.get(e.source)!.push(e);
    }

    for (const [, group] of sourceGroups) {
      chains.push(group.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()));
    }

    return chains;
  }

  findContradictions(missionId: string): Array<{ evidence1: Evidence; evidence2: Evidence; description: string }> {
    const evidence = this.getEvidenceByMission(missionId);
    const contradictions: Array<{ evidence1: Evidence; evidence2: Evidence; description: string }> = [];

    for (let i = 0; i < evidence.length; i++) {
      for (let j = i + 1; j < evidence.length; j++) {
        const e1 = evidence[i];
        const e2 = evidence[j];

        if (e1.tier === e2.tier && Math.abs((e1.score || 0) - (e2.score || 0)) < 0.1) {
          const contentSimilarity = this.calculateContentSimilarity(e1.content, e2.content);
          if (contentSimilarity > 0.7 && contentSimilarity < 0.95) {
            contradictions.push({
              evidence1: e1,
              evidence2: e2,
              description: 'Similar content with minor differences',
            });
          }
        }
      }
    }

    return contradictions;
  }

  private calculateContentSimilarity(content1: string, content2: string): number {
    const words1 = new Set(content1.toLowerCase().split(/\s+/));
    const words2 = new Set(content2.toLowerCase().split(/\s+/));

    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  removeEvidence(evidenceId: string): boolean {
    return this.evidence.delete(evidenceId);
  }

  clearMissionEvidence(missionId: string): number {
    let count = 0;
    for (const [id, evidence] of this.evidence) {
      if (evidence.missionId === missionId) {
        this.evidence.delete(id);
        count++;
      }
    }
    return count;
  }

  private generateId(): string {
    return `evd_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  exportEvidence(missionId: string): string | null {
    const evidence = this.getEvidenceByMission(missionId);
    if (evidence.length === 0) {
      return null;
    }
    return JSON.stringify(evidence, null, 2);
  }

  getStatistics(missionId: string): Record<string, unknown> | null {
    const evidence = this.getEvidenceByMission(missionId);
    if (evidence.length === 0) {
      return null;
    }

    const scores = evidence.map(e => e.score || 0);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const minScore = Math.min(...scores);
    const maxScore = Math.max(...scores);

    return {
      totalEvidence: evidence.length,
      averageScore: avgScore,
      minScore,
      maxScore,
      verifiedCount: evidence.filter(e => e.verified).length,
      uniqueSources: new Set(evidence.map(e => e.source)).size,
      uniqueTags: new Set(evidence.flatMap(e => e.tags)).size,
    };
  }
}
