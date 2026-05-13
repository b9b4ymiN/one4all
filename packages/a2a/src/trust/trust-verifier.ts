import { EventEmitter } from 'events';
import type { AgentCard, TrustLevel } from '../schemas/agent-card.schema.js';

/**
 * Trust verification configuration
 */
export interface TrustVerificationConfig {
  enable_behavioral_validation: boolean;
  probation_period_days: number;
  required_audit_for_permissions: string[];
  behavioral_threshold_score: number;
  max_violations_before_revocation: number;
  enable_continuous_monitoring: boolean;
}

/**
 * Behavioral validation result
 */
export interface ValidationResult {
  passed: boolean;
  score: number;
  violations: string[];
  warnings: string[];
  metrics: {
    response_time_consistency: number;
    output_contract_compliance: number;
    error_handling_quality: number;
    protocol_adherence: number;
  };
}

/**
 * Trust event types
 */
export interface TrustEvents {
  'agent:verification_started': { agentId: string };
  'agent:verification_completed': { agentId: string; result: ValidationResult };
  'agent:trust_promoted': { agentId: string; from: string; to: string };
  'agent:trust_demoted': { agentId: string; from: string; to: string; reason: string };
  'agent:placed_on_probation': { agentId: string; reason: string; expiresAt: string };
  'agent:probation_violation': { agentId: string; violation: string };
  'agent:audit_required': { agentId: string; permissions: string[] };
  'agent:trust_revoked': { agentId: string; reason: string };
}

/**
 * Trust verification result
 */
export interface TrustVerificationResult {
  allowed: boolean;
  trustLevel: string;
  reason?: string;
  requirements?: string[];
  requiresProbation?: boolean;
}

/**
 * Trust history tracking
 */
interface AgentTrustHistory {
  trustLevel: string;
  violations: string[];
  verificationResults: ValidationResult[];
  probationExpiresAt?: Date;
  createdAt: Date;
  lastUpdated: Date;
  // Interaction tracking for continuous monitoring
  totalInteractions: number;
  successfulInteractions: number;
  failedInteractions: number;
  behavioralScore: number;
}

/**
 * A2A Request/Response types (simplified for this module)
 */
export interface A2ARequest {
  request_id: string;
  timestamp: string;
  agent_id: string;
  task: {
    type: string;
    input: any;
  };
}

export interface A2AResponse {
  request_id: string;
  agent_id: string;
  timestamp: string;
  status: 'success' | 'error';
  output?: any;
  error?: {
    code: string;
    message: string;
  };
  metadata?: {
    latency_ms?: number;
  };
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: TrustVerificationConfig = {
  enable_behavioral_validation: true,
  probation_period_days: 7,
  required_audit_for_permissions: ['network', 'filesystem', 'subprocess'],
  behavioral_threshold_score: 70,
  max_violations_before_revocation: 5,
  enable_continuous_monitoring: true,
};

/**
 * Trust Verification Layer
 *
 * Responsibilities:
 * - Validate agent behavior against claimed capabilities (not just self-reported cards)
 * - Manage probationary periods for new/untrusted agents
 * - Require external audits for elevated permissions
 * - Monitor continuous behavior and adjust trust levels
 * - Track violations and revoke trust when necessary
 *
 * This implements the Senior AI Harness Engineer principle:
 * "Treat the model as an unreliable component" - we validate, don't trust.
 */
export class TrustVerifier extends EventEmitter {
  private config: TrustVerificationConfig;
  private agentTrustHistory: Map<string, AgentTrustHistory>;

  constructor(config: Partial<TrustVerificationConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.agentTrustHistory = new Map();
  }

  /**
   * Verify agent trust before registration
   *
   * This is the main entry point for trust verification.
   * Agents must pass this check before being allowed into the registry.
   */
  async verifyAgentTrust(card: AgentCard): Promise<TrustVerificationResult> {
    this.emit('agent:verification_started', { agentId: card.id });

    // Check 1: Verify audit requirements for elevated permissions
    const permissions = card.security?.permissions || [];
    const elevatedPermissions = permissions.filter(p =>
      this.config.required_audit_for_permissions.includes(p)
    );

    if (elevatedPermissions.length > 0) {
      if (!card.trust?.audit_report_url) {
        return {
          allowed: false,
          trustLevel: 'unverified',
          reason: 'Agent requires elevated permissions but has no audit report',
          requirements: [
            'Submit external security audit',
            'Pass behavioral validation tests',
            'Provide audit report URL'
          ],
        };
      }
    }

    // Check 1.5: Check verification status for revoked agents
    if (card.trust?.verification_status === 'revoked') {
      return {
        allowed: false,
        trustLevel: 'unverified',
        reason: 'Agent trust has been revoked',
      };
    }

    // Check 1.6: Check existing trust history for violations
    const existingHistory = this.agentTrustHistory.get(card.id);
    if (existingHistory && existingHistory.violations.length >= this.config.max_violations_before_revocation) {
      return {
        allowed: false,
        trustLevel: 'unverified',
        reason: `Agent has too many trust violations: ${existingHistory.violations.length}`,
      };
    }

    // Check 1.7: Check for expired probation in the card itself
    if (card.trust?.probation_expires_at) {
      const probationExpiry = new Date(card.trust.probation_expires_at);
      if (probationExpiry < new Date()) {
        return {
          allowed: false,
          trustLevel: 'probationary',
          reason: 'probation expired',
        };
      }
    }

    // Check 2: Perform behavioral validation if enabled
    let validationResult: ValidationResult | null = null;
    if (this.config.enable_behavioral_validation) {
      validationResult = await this.performBehavioralValidation(card);

      if (!validationResult.passed) {
        this.emit('agent:verification_completed', {
          agentId: card.id,
          result: validationResult,
        });

        return {
          allowed: false,
          trustLevel: 'unverified',
          reason: `Behavioral validation failed: ${validationResult.violations.join(', ')}`,
          requirements: validationResult.violations,
        };
      }
    }

    // Determine initial trust level
    let trustLevel = card.trust?.trust_level || 'unverified';
    let requiresProbation = false;

    // Check if unverified or low behavioral score - place on probation but keep trust level
    if (trustLevel === 'unverified' ||
        (validationResult && validationResult.score < this.config.behavioral_threshold_score)) {
      requiresProbation = true;
      const probationExpiresAt = new Date();
      probationExpiresAt.setDate(probationExpiresAt.getDate() + this.config.probation_period_days);

      this.emit('agent:placed_on_probation', {
        agentId: card.id,
        reason: 'New agent or low behavioral score',
        expiresAt: probationExpiresAt.toISOString(),
      });

      // Store trust history with actual trust level for internal tracking
      this.agentTrustHistory.set(card.id, {
        trustLevel: requiresProbation ? 'probationary' : trustLevel, // Use probationary for internal tracking
        violations: [],
        verificationResults: validationResult ? [validationResult] : [],
        probationExpiresAt,
        createdAt: new Date(),
        lastUpdated: new Date(),
        totalInteractions: 0,
        successfulInteractions: 0,
        failedInteractions: 0,
        behavioralScore: validationResult?.score || 0,
      });
    }

    this.emit('agent:verification_completed', {
      agentId: card.id,
      result: validationResult || { passed: true, score: 100, violations: [], warnings: [], metrics: {
        response_time_consistency: 1,
        output_contract_compliance: 1,
        error_handling_quality: 1,
        protocol_adherence: 1,
      }},
    });

    return {
      allowed: true,
      trustLevel,
      requiresProbation,
    };
  }

  /**
   * Perform behavioral validation on agent
   *
   * This tests the agent's actual behavior against its claimed capabilities.
   * In a real implementation, this would send actual requests to the agent.
   */
  private async performBehavioralValidation(card: AgentCard): Promise<ValidationResult> {
    const violations: string[] = [];
    const warnings: string[] = [];
    let score = 100;

    // For external agents with endpoint, we could do actual tests
    if (card.a2a_config?.endpoint) {
      // Test 1: Response time consistency (mocked for now)
      const responseTimeTest = await this.testResponseTimeConsistency(card);
      if (responseTimeTest < 0.7) {
        violations.push('Response time highly inconsistent');
        score -= 20;
      }

      // Test 2: Output contract compliance (mocked for now)
      const contractComplianceTest = await this.testOutputContractCompliance(card);
      if (contractComplianceTest < 0.9) {
        violations.push('Output contract compliance below threshold');
        score -= 30;
      }

      // Test 3: Error handling quality (mocked for now)
      const errorHandlingTest = await this.testErrorHandling(card);
      if (errorHandlingTest < 0.8) {
        warnings.push('Error handling could be improved');
        score -= 10;
      }

      // Test 4: Protocol adherence (mocked for now)
      const protocolAdherenceTest = await this.testProtocolAdherence(card);
      if (protocolAdherenceTest < 0.8) {
        violations.push('Protocol adherence insufficient');
        score -= 25;
      }

      // Test 5: Behavioral protocol compliance (if claimed)
      if (card.a2a_config?.behavioral_protocol) {
        const protocolTest = await this.testBehavioralProtocol(card);
        if (protocolTest < 0.8) {
          violations.push('Behavioral protocol claims not met');
          score -= 20;
        }
      }
    } else {
      // For internal agents, we trust the system's own validation
      warnings.push('Internal agent - behavioral validation skipped');
    }

    return {
      passed: violations.length === 0,
      score: Math.max(0, score),
      violations,
      warnings,
      metrics: {
        response_time_consistency: 0.9,
        output_contract_compliance: 0.95,
        error_handling_quality: 0.85,
        protocol_adherence: 0.9,
      },
    };
  }

  /**
   * Test response time consistency
   * (Simplified - real implementation would send actual requests)
   */
  private async testResponseTimeConsistency(_card: AgentCard): Promise<number> {
    // Mock implementation - real version would send multiple test requests
    // and calculate coefficient of variation
    return 0.85;
  }

  /**
   * Test output contract compliance
   */
  private async testOutputContractCompliance(card: AgentCard): Promise<number> {
    // Simplified check - real implementation would test actual responses
    if (card.output_contract.mandatory_fields.length === 0) {
      return 1.0;
    }
    return 0.95;
  }

  /**
   * Test error handling quality
   */
  private async testErrorHandling(_card: AgentCard): Promise<number> {
    // Mock implementation
    return 0.85;
  }

  /**
   * Test protocol adherence
   */
  private async testProtocolAdherence(card: AgentCard): Promise<number> {
    // Check if timeout is reasonable
    if (card.performance.timeout_seconds < 10 || card.performance.timeout_seconds > 600) {
      return 0.5;
    }
    return 0.9;
  }

  /**
   * Test behavioral protocol compliance
   */
  private async testBehavioralProtocol(card: AgentCard): Promise<number> {
    const protocol = card.a2a_config?.behavioral_protocol;
    if (!protocol) return 1.0;

    let score = 1.0;

    // If claims to support challenge_response but has no evidence support
    if (protocol.implements_challenge_response && !protocol.implements_evidence_submission) {
      score -= 0.3;
    }

    // If claims debate but only has request_response mode
    if (protocol.implements_debate_protocol &&
        protocol.supported_interaction_modes.length === 1 &&
        protocol.supported_interaction_modes[0] === 'request_response') {
      score -= 0.4;
    }

    return Math.max(0, score);
  }

  /**
   * Validate agent behavior against response
   *
   * This is called to validate individual agent responses
   * for continuous behavioral monitoring.
   */
  async validateBehavior(card: AgentCard, response: {
    output: any;
    latency_ms: number;
    satisfies_contract: boolean;
  }): Promise<{
    valid: boolean;
    behavioral_score: number;
    violations: string[];
  }> {
    const violations: string[] = [];
    let score = 100;
    const timeoutThreshold = (card.performance?.timeout_seconds || 120) * 1000;

    // Check response time
    if (response.latency_ms > timeoutThreshold) {
      violations.push('response_time_threshold_exceeded');
      score -= 30;
    }

    // Check output contract compliance
    if (!response.satisfies_contract) {
      violations.push('output_contract_violation');
      score -= 40;
    }

    // Check for required fields
    if (card.output_contract.mandatory_fields.length > 0 && response.output) {
      const missingFields = card.output_contract.mandatory_fields.filter(
        field => !(field in response.output)
      );
      if (missingFields.length > 0) {
        violations.push(`missing_mandatory_fields: ${missingFields.join(', ')}`);
        score -= 20;
      }
    }

    return {
      valid: violations.length === 0,
      behavioral_score: Math.max(0, score),
      violations,
    };
  }

  /**
   * Record interaction for continuous monitoring
   */
  recordInteraction(
    agentId: string,
    _request: A2ARequest,
    response: A2AResponse
  ): void {
    // Get or create history
    let history = this.agentTrustHistory.get(agentId);
    if (!history) {
      history = {
        trustLevel: 'unverified',
        violations: [],
        verificationResults: [],
        createdAt: new Date(),
        lastUpdated: new Date(),
        totalInteractions: 0,
        successfulInteractions: 0,
        failedInteractions: 0,
        behavioralScore: 0,
      };
      this.agentTrustHistory.set(agentId, history);
    }

    // Update interaction counts
    history.totalInteractions++;
    if (response.status === 'success') {
      history.successfulInteractions++;
    } else {
      history.failedInteractions++;
    }

    // Update behavioral score
    history.behavioralScore = history.totalInteractions > 0
      ? Math.round((history.successfulInteractions / history.totalInteractions) * 100)
      : 0;

    if (!this.config.enable_continuous_monitoring) return;

    // Check for probation violations
    if (history.trustLevel === 'probationary') {
      if (response.status === 'error') {
        const violation = `Error during probation: ${response.error?.code || 'unknown'}`;
        history.violations.push(violation);

        this.emit('agent:probation_violation', {
          agentId,
          violation: response.error?.code || 'unknown',
        });

        // Check if should revoke trust
        if (history.violations.length >= this.config.max_violations_before_revocation) {
          this.revokeTrust(agentId, 'Too many violations during probation');
        }

        history.lastUpdated = new Date();
      }
    }
  }

  /**
   * Record a trust violation for an agent
   */
  recordTrustViolation(agentId: string, violation: string): void {
    const history = this.agentTrustHistory.get(agentId);
    if (!history) {
      // Create history if it doesn't exist
      this.agentTrustHistory.set(agentId, {
        trustLevel: 'unverified',
        violations: [violation],
        verificationResults: [],
        createdAt: new Date(),
        lastUpdated: new Date(),
        totalInteractions: 0,
        successfulInteractions: 0,
        failedInteractions: 0,
        behavioralScore: 0,
      });
      return;
    }

    history.violations.push(violation);
    history.lastUpdated = new Date();

    // Check if should revoke trust
    if (history.violations.length >= this.config.max_violations_before_revocation) {
      const reason = `Too many trust violations: ${history.violations.length}`;
      this.revokeTrust(agentId, reason);

      // Emit the event format expected by tests
      this.emit('trust_revoked', {
        agentId,
        reason,
        previousLevel: history.trustLevel,
      });
    }
  }

  /**
   * Place agent on probation
   */
  placeOnProbation(agentId: string, days: number, reason: string): string {
    const probationExpiresAt = new Date();
    probationExpiresAt.setDate(probationExpiresAt.getDate() + days);

    let history = this.agentTrustHistory.get(agentId);
    if (!history) {
      history = {
        trustLevel: 'unverified',
        violations: [],
        verificationResults: [],
        createdAt: new Date(),
        lastUpdated: new Date(),
        totalInteractions: 0,
        successfulInteractions: 0,
        failedInteractions: 0,
        behavioralScore: 0,
      };
      this.agentTrustHistory.set(agentId, history);
    }

    const oldLevel = history.trustLevel;
    history.trustLevel = 'probationary';
    history.probationExpiresAt = probationExpiresAt;
    history.lastUpdated = new Date();

    this.emit('agent:placed_on_probation', {
      agentId,
      reason,
      expiresAt: probationExpiresAt.toISOString(),
    });

    // Also emit the trust event format expected by tests
    this.emit('probation_started', {
      agentId,
      duration: days,
      reason,
      expiresAt: probationExpiresAt.toISOString(),
      previousLevel: oldLevel,
    });

    return probationExpiresAt.toISOString();
  }

  /**
   * Elevate agent trust level
   */
  elevateTrustLevel(agentId: string, newLevel: TrustLevel, reason: string): void {
    let history = this.agentTrustHistory.get(agentId);
    if (!history) {
      history = {
        trustLevel: 'unverified',
        violations: [],
        verificationResults: [],
        createdAt: new Date(),
        lastUpdated: new Date(),
        totalInteractions: 0,
        successfulInteractions: 0,
        failedInteractions: 0,
        behavioralScore: 0,
      };
      this.agentTrustHistory.set(agentId, history);
    }

    const oldLevel = history.trustLevel;
    history.trustLevel = newLevel;
    history.lastUpdated = new Date();

    this.emit('agent:trust_promoted', {
      agentId,
      from: oldLevel,
      to: newLevel,
    });

    // Also emit the trust event format expected by tests
    this.emit('trust_elevated', {
      agentId,
      newLevel,
      previousLevel: oldLevel,
      reason,
      requiresAudit: newLevel === 'certified',
    });
  }

  /**
   * Promote agent trust level
   */
  promoteTrust(agentId: string, newLevel: TrustLevel): void {
    const history = this.agentTrustHistory.get(agentId);
    if (!history) return;

    const oldLevel = history.trustLevel;
    history.trustLevel = newLevel;
    history.lastUpdated = new Date();

    this.emit('agent:trust_promoted', {
      agentId,
      from: oldLevel,
      to: newLevel,
    });
  }

  /**
   * Demote agent trust level
   */
  demoteTrust(agentId: string, newLevel: TrustLevel, reason: string): void {
    const history = this.agentTrustHistory.get(agentId);
    if (!history) return;

    const oldLevel = history.trustLevel;
    history.trustLevel = newLevel;
    history.lastUpdated = new Date();

    this.emit('agent:trust_demoted', {
      agentId,
      from: oldLevel,
      to: newLevel,
      reason,
    });
  }

  /**
   * Revoke agent trust
   */
  revokeTrust(agentId: string, reason: string): void {
    this.demoteTrust(agentId, 'unverified', reason);

    this.emit('agent:trust_revoked', { agentId, reason });
  }

  /**
   * Get agent trust status
   */
  getTrustStatus(agentId: string): {
    agentId: string;
    trustLevel: string;
    totalInteractions: number;
    successfulInteractions: number;
    failedInteractions: number;
    behavioralScore: number;
    trustViolations: number;
    violations: string[];
    probationExpiresAt?: Date;
  } | undefined {
    const history = this.agentTrustHistory.get(agentId);
    if (!history) {
      // Return default status for unknown agent
      return {
        agentId,
        trustLevel: 'unverified',
        totalInteractions: 0,
        successfulInteractions: 0,
        failedInteractions: 0,
        behavioralScore: 0,
        trustViolations: 0,
        violations: [],
      };
    }

    return {
      agentId,
      trustLevel: history.trustLevel,
      totalInteractions: history.totalInteractions,
      successfulInteractions: history.successfulInteractions,
      failedInteractions: history.failedInteractions,
      behavioralScore: history.behavioralScore,
      trustViolations: history.violations.length,
      violations: history.violations,
      probationExpiresAt: history.probationExpiresAt,
    };
  }

  /**
   * Get all agents on probation
   */
  getAgentsOnProbation(): string[] {
    return Array.from(this.agentTrustHistory.entries())
      .filter(([_, history]) =>
        history.trustLevel === 'probationary' &&
        (!history.probationExpiresAt || history.probationExpiresAt > new Date())
      )
      .map(([agentId, _]) => agentId);
  }

  /**
   * Check if agent needs audit
   */
  requiresAudit(card: AgentCard): boolean {
    const permissions = card.security?.permissions || [];
    const elevatedPermissions = permissions.filter(p =>
      this.config.required_audit_for_permissions.includes(p)
    );
    return elevatedPermissions.length > 0 && !card.trust?.audit_report_url;
  }
}
