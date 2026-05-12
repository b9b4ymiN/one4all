/**
 * Company Constitution Enforcer
 *
 * Main class for enforcing company constitution rules
 * as specified in COMPANY_CONSTITUTION.md
 */

import {
  Constitution,
  ConstitutionRule,
  ConstitutionViolation,
  ConstitutionCheckSummary,
  OutputCheckResult,
  RuleContext,
  RuleOverride,
  EnforcementLevel,
  ExceptionType,
  AgentSelector,
} from "./types.js";
import { getValidator } from "./validators/index.js";

/**
 * Constitution Enforcer class
 */
export class ConstitutionEnforcer {
  private constitutions: Map<string, Constitution> = new Map();
  private activeOverrides: Map<string, RuleOverride> = new Map();
  private violationHistory: Map<string, ConstitutionViolation[]> = new Map();

  /**
   * Load a constitution from a YAML file path or object
   */
  loadConstitution(domain: string, source: string | Constitution): Constitution {
    let constitution: Constitution;

    if (typeof source === "string") {
      // Load from YAML file (in real implementation, use yaml parser)
      // For now, return empty constitution
      constitution = {
        domain,
        version: "1.0",
        rules: [],
        loaded_at: new Date(),
        source_file: source,
      };
    } else {
      constitution = {
        ...source,
        loaded_at: new Date(),
        source_file: "memory",
      };
    }

    this.constitutions.set(domain, constitution);
    return constitution;
  }

  /**
   * Get constitution for a domain
   */
  getConstitution(domain: string): Constitution | undefined {
    return this.constitutions.get(domain);
  }

  /**
   * Check if a rule applies to an agent
   */
  ruleAppliesToAgent(rule: ConstitutionRule, agentId: string): boolean {
    const appliesTo = rule.applies_to;

    if (appliesTo === "all_agents") {
      return true;
    }

    if (appliesTo === "all_analyst_agents") {
      // Analyst agents typically have these patterns
      const analystPatterns = ["valuation", "downside", "analyst", "allocator"];
      return analystPatterns.some((pattern) => agentId.includes(pattern));
    }

    if (appliesTo === "researcher_agents") {
      return agentId.includes("researcher") || agentId.includes("forensic");
    }

    if (Array.isArray(appliesTo)) {
      return appliesTo.includes(agentId);
    }

    return false;
  }

  /**
   * Get applicable rules for an agent
   */
  getApplicableRules(domain: string, agentId: string): ConstitutionRule[] {
    const constitution = this.constitutions.get(domain);
    if (!constitution) {
      return [];
    }

    return constitution.rules.filter((rule) => this.ruleAppliesToAgent(rule, agentId));
  }

  /**
   * Check if rule has active override
   */
  hasOverride(ruleId: string, missionId?: string): boolean {
    const overrideKey = missionId ? `${ruleId}:${missionId}` : ruleId;
    return this.activeOverrides.has(overrideKey);
  }

  /**
   * Add a rule override
   */
  addOverride(override: RuleOverride): void {
    const key = override.mission_id ? `${override.rule_id}:${override.mission_id}` : override.rule_id;
    this.activeOverrides.set(key, override);
  }

  /**
   * Remove a rule override
   */
  removeOverride(ruleId: string, missionId?: string): void {
    const key = missionId ? `${ruleId}:${missionId}` : ruleId;
    this.activeOverrides.delete(key);
  }

  /**
   * Enforce a single rule
   */
  async enforceRule(rule: ConstitutionRule, context: RuleContext): Promise<{
    result: OutputCheckResult;
    enforcement?: EnforcementLevel;
  }> {
    // Check for override
    const overrideKey = context.mission_id ? `${rule.id}:${context.mission_id}` : rule.id;
    const override = this.activeOverrides.get(overrideKey);

    if (override) {
      return {
        result: {
          approved: true,
          violations: [],
          warnings: [`Rule ${rule.id} overridden: ${override.reason}`],
          retry_required: false,
          agent_failed: false,
        },
      };
    }

    // Check if rule applies to agent
    if (!this.ruleAppliesToAgent(rule, context.agent_id)) {
      return {
        result: {
          approved: true,
          violations: [],
          warnings: [],
          retry_required: false,
          agent_failed: false,
        },
      };
    }

    // Get validator and validate
    const validator = getValidator(rule);
    const validationResult = validator.validate(rule, context);

    // Build result
    const violations: ConstitutionViolation[] = [];
    const blocked = validationResult.enforcement === EnforcementLevel.BLOCK_MISSION;
    const rejected = validationResult.enforcement === EnforcementLevel.REJECT_OUTPUT;

    // Get retry count BEFORE recording violations
    const currentRetryCount = this.getRetryCount(rule.id, context.agent_id, context.mission_id);

    for (const violation of validationResult.violations) {
      violations.push({
        rule_id: rule.id,
        agent_id: context.agent_id,
        mission_id: context.mission_id,
        severity: validationResult.enforcement,
        description: violation,
        detected_at: new Date(),
        retry_count: currentRetryCount,
      });
    }

    // Record violations
    this.recordViolations(violations);

    // Check if agent should be marked as failed
    const agent_failed = this.shouldFailAgent(violations);

    // Determine if retry is required (use pre-recording retry count)
    const retry_required =
      rejected &&
      violations.length > 0 &&
      !agent_failed &&
      currentRetryCount === 0;

    return {
      result: {
        approved: violations.length === 0,
        violations,
        warnings: validationResult.warnings,
        retry_required,
        retry_instructions: retry_required ? this.buildRetryInstructions(violations) : undefined,
        agent_failed,
      },
      enforcement: validationResult.enforcement,
    };
  }

  /**
   * Check agent output against constitution
   */
  async checkViolations(
    domain: string,
    agentId: string,
    context: RuleContext
  ): Promise<OutputCheckResult> {
    const rules = this.getApplicableRules(domain, agentId);

    if (rules.length === 0) {
      return {
        approved: true,
        violations: [],
        warnings: [],
        retry_required: false,
        agent_failed: false,
      };
    }

    const allViolations: ConstitutionViolation[] = [];
    const allWarnings: string[] = [];
    let blocked = false;
    let rejected = false;
    let requiresHumanReview = false;
    let retryRequired = false;

    // Check each rule
    for (const rule of rules) {
      const { result, enforcement } = await this.enforceRule(rule, context);

      allViolations.push(...result.violations);
      allWarnings.push(...result.warnings);

      if (result.agent_failed) {
        return result; // Agent failed, return immediately
      }

      if (enforcement === EnforcementLevel.BLOCK_MISSION && !result.approved) {
        blocked = true;
      }

      if (enforcement === EnforcementLevel.REJECT_OUTPUT && !result.approved) {
        rejected = true;
        retryRequired = result.retry_required;
      }

      if (enforcement === EnforcementLevel.INSERT_HUMAN_REVIEW && !result.approved) {
        requiresHumanReview = true;
      }
    }

    return {
      approved: allViolations.length === 0,
      violations: allViolations,
      warnings: allWarnings,
      retry_required: retryRequired,
      retry_instructions: retryRequired ? this.buildRetryInstructions(allViolations) : undefined,
      agent_failed: false,
    };
  }

  /**
   * Check if mission should be blocked
   */
  shouldBlockMission(missionId: string, domain?: string): boolean {
    const missionViolations = this.violationHistory.get(missionId) || [];

    return missionViolations.some(
      (v) => v.severity === EnforcementLevel.BLOCK_MISSION && !this.isOverridden(v)
    );
  }

  /**
   * Check if mission should insert human review
   */
  shouldInsertHumanReview(missionId: string, domain?: string): boolean {
    const missionViolations = this.violationHistory.get(missionId) || [];

    return missionViolations.some(
      (v) => v.severity === EnforcementLevel.INSERT_HUMAN_REVIEW && !this.isOverridden(v)
    );
  }

  /**
   * Get constitution check summary for a mission
   */
  getCheckSummary(missionId: string, domain: string): ConstitutionCheckSummary {
    const constitution = this.constitutions.get(domain);
    const violations = this.violationHistory.get(missionId) || [];

    const totalRules = constitution?.rules.length || 0;
    const rulesFailed = new Set(violations.map((v) => v.rule_id)).size;
    const warningsIssued = violations.filter(
      (v) => v.severity === EnforcementLevel.WARN_AND_FLAG
    ).length;

    return {
      total_rules: totalRules,
      rules_checked: violations.length > 0 ? new Set(violations.map((v) => v.rule_id)).size : 0,
      rules_passed: totalRules - rulesFailed,
      rules_failed: rulesFailed,
      warnings_issued: warningsIssued,
      violations,
      blocked: this.shouldBlockMission(missionId, domain),
      requires_human_review: this.shouldInsertHumanReview(missionId, domain),
    };
  }

  /**
   * Record violations
   */
  private recordViolations(violations: ConstitutionViolation[]): void {
    for (const violation of violations) {
      const missionViolations = this.violationHistory.get(violation.mission_id) || [];
      missionViolations.push(violation);
      this.violationHistory.set(violation.mission_id, missionViolations);
    }
  }

  /**
   * Get retry count for a rule
   */
  private getRetryCount(ruleId: string, agentId: string, missionId: string): number {
    const missionViolations = this.violationHistory.get(missionId) || [];
    return missionViolations.filter(
      (v) => v.rule_id === ruleId && v.agent_id === agentId
    ).length;
  }

  /**
   * Check if agent should be marked as failed
   */
  private shouldFailAgent(violations: ConstitutionViolation[]): boolean {
    for (const violation of violations) {
      if (violation.retry_count >= 1) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if violation is overridden
   */
  private isOverridden(violation: ConstitutionViolation): boolean {
    const key = `${violation.rule_id}:${violation.mission_id}`;
    return this.activeOverrides.has(key);
  }

  /**
   * Build retry instructions
   */
  private buildRetryInstructions(violations: ConstitutionViolation[]): string {
    const instructions: string[] = [];

    instructions.push("Your output violated the following constitution rules:");
    for (const violation of violations) {
      instructions.push(`  - ${violation.description}`);
    }
    instructions.push("");
    instructions.push("Please revise your output to address these issues.");

    return instructions.join("\n");
  }

  /**
   * Clear violation history for a mission
   */
  clearMissionViolations(missionId: string): void {
    this.violationHistory.delete(missionId);
  }

  /**
   * Get all violations for a mission
   */
  getMissionViolations(missionId: string): ConstitutionViolation[] {
    return this.violationHistory.get(missionId) || [];
  }

  /**
   * Get violation history
   */
  getViolationHistory(): Map<string, ConstitutionViolation[]> {
    return this.violationHistory;
  }

  /**
   * Get active overrides
   */
  getActiveOverrides(): RuleOverride[] {
    return Array.from(this.activeOverrides.values());
  }

  /**
   * Clear all overrides
   */
  clearOverrides(): void {
    this.activeOverrides.clear();
  }

  /**
   * Clear all data (for testing)
   */
  clear(): void {
    this.constitutions.clear();
    this.activeOverrides.clear();
    this.violationHistory.clear();
  }
}

/**
 * Create a constitution enforcer instance
 */
export function createConstitutionEnforcer(): ConstitutionEnforcer {
  return new ConstitutionEnforcer();
}

/**
 * Global constitution enforcer instance
 */
export const constitutionEnforcer = createConstitutionEnforcer();
