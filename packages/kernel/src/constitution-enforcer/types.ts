/**
 * Constitution Enforcer Types
 *
 * Defines all types for the Company Constitution system
 * as specified in COMPANY_CONSTITUTION.md
 */

/**
 * Enforcement levels for constitution rules
 */
export enum EnforcementLevel {
  BLOCK_MISSION = "BLOCK_MISSION",
  INSERT_HUMAN_REVIEW = "INSERT_HUMAN_REVIEW",
  WARN_AND_FLAG = "WARN_AND_FLAG",
  REJECT_OUTPUT = "REJECT_OUTPUT",
}

/**
 * Exception types for rules
 */
export enum ExceptionType {
  NONE = "none",
  OWNER_EXPLICIT_OVERRIDE = "owner_explicit_override",
  EMERGENCY_SKIP = "emergency_skip",
  TEST_MODE = "test_mode",
}

/**
 * Agent selector - either all agents, specific agents, or agent groups
 */
export type AgentSelector =
  | "all_agents"
  | "all_analyst_agents"
  | "researcher_agents"
  | string[]; // specific agent IDs

/**
 * Validation criteria for a rule
 */
export interface ValidationCriteria {
  criteria: string[];
  forbidden_content?: string[];
  required_fields?: string[];
  thresholds?: Record<string, number | string>;
  critical_fields?: string[];
}

/**
 * Constitution rule definition
 */
export interface ConstitutionRule {
  id: string;
  name: string;
  description: string;
  version: string;
  domain: string;

  enforcement: EnforcementLevel;
  applies_to: AgentSelector;
  exception: ExceptionType;

  validation: ValidationCriteria;

  violation_example?: {
    bad: string;
    good: string;
  };

  trigger_condition?: string; // For conditional rules
}

/**
 * Constitution for a domain
 */
export interface Constitution {
  domain: string;
  version: string;
  rules: ConstitutionRule[];
  loaded_at: Date;
  source_file: string;
}

/**
 * Constitution violation record
 */
export interface ConstitutionViolation {
  rule_id: string;
  agent_id: string;
  mission_id: string;
  severity: EnforcementLevel;
  description: string;
  detected_at: Date;
  output_sample?: string;
  retry_count: number; // For retry policy
}

/**
 * Enforcement result from checking a rule
 */
export interface EnforcementResult {
  passed: boolean;
  rule_id: string;
  enforcement: EnforcementLevel;
  violations: string[];
  warnings: string[];
  blocked?: boolean;
  requires_human_review?: boolean;
  rejected?: boolean;
}

/**
 * Result of checking agent output against constitution
 */
export interface OutputCheckResult {
  approved: boolean;
  violations: ConstitutionViolation[];
  warnings: string[];
  retry_required: boolean;
  retry_instructions?: string;
  agent_failed: boolean;
}

/**
 * Context for rule evaluation
 */
export interface RuleContext {
  agent_id: string;
  mission_id: string;
  mission_state?: string;
  output: Record<string, unknown>;
  previous_violations?: ConstitutionViolation[];
  owner_override_active?: boolean;
  test_mode_active?: boolean;
}

/**
 * Evidence score thresholds
 */
export interface EvidenceScoreThresholds {
  very_low: number; // < 20
  low: number; // < 40
  conditional: number; // < 70
}

/**
 * Constitution check summary
 */
export interface ConstitutionCheckSummary {
  total_rules: number;
  rules_checked: number;
  rules_passed: number;
  rules_failed: number;
  warnings_issued: number;
  violations: ConstitutionViolation[];
  blocked: boolean;
  requires_human_review: boolean;
}

/**
 * Rule override record
 */
export interface RuleOverride {
  rule_id: string;
  mission_id: string;
  agent_id?: string;
  override_type: ExceptionType;
  reason: string;
  granted_by: "owner" | "system";
  granted_at: Date;
}

/**
 * Constitution filter options
 */
export interface ConstitutionFilterOptions {
  agent_id?: string;
  enforcement_level?: EnforcementLevel;
  domain?: string;
  include_exceptions?: boolean;
}
