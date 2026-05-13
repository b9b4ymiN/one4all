/**
 * Agent Schema - Validation for agent configurations
 *
 * Defines the structure and validation rules for agent cards.
 * Used for both source YAML files and runtime JSON storage.
 */

/**
 * Skill identifiers that agents can have
 */
export const VALID_SKILLS = [
  'intrinsic_valuation',
  'reverse_dcf',
  'sensitivity_analysis',
  'narrative_to_numbers',
  'sector_analysis',
  'competitive_positioning',
  'moat_analysis',
  'risk_assessment',
  'downside_protection',
  'portfolio_allocation',
  'evidence_gathering',
  'financial_forensics',
  'consensus_building',
  'quality_assessment',
  'growth_analysis',
  'margin_safety',
] as const;

/**
 * Role types for agents
 */
export const VALID_ROLES = [
  'valuation_analyst',
  'risk_analyst',
  'researcher',
  'consensus_analyst',
  'portfolio_manager',
  'quality_analyst',
  'devil_advocate',
  'synthesizer',
  'domain_expert',
] as const;

/**
 * Provider types for model selection
 */
export const VALID_PROVIDERS = [
  'claude-cli',
  'gemini-cli',
  'zai-api',
  'claude',
  'gemini',
  'zai',
  'openai',
] as const;

/**
 * Agent configuration interface
 */
export interface AgentConfig {
  // Core identification
  id: string;
  name: string;
  version?: string;
  domain: string;
  active?: boolean;

  // Role and description
  role: typeof VALID_ROLES[number];
  description: string;

  // Model selection
  model: {
    primary: {
      provider: typeof VALID_PROVIDERS[number];
      model: string;
    };
    fallback?: Array<{
      provider: typeof VALID_PROVIDERS[number];
      model: string;
    }>;
  };

  // Identity
  identity?: {
    persona_file?: string;
    worldview?: string[];
    cognitive_bias_awareness?: string[];
  };

  // Capabilities
  skills: typeof VALID_SKILLS[];

  // Dependencies
  requires?: string[];

  // Interaction rules
  interaction_rules?: {
    can_question?: string[];
    must_challenge?: string[];
    cannot_question?: string[];
  };

  // Output contract
  output_contract?: {
    mandatory_fields?: string[];
    forbidden_content?: string[];
  };

  // Performance settings
  timeout_seconds?: number;
  max_tokens?: number;

  // Runtime metadata (not in source YAML)
  _runtime?: {
    imported_at?: string;
    last_modified?: string;
    source_path?: string;
  };
}

/**
 * Runtime agent storage format (JSON in ~/.one4all/agents/)
 */
export interface RuntimeAgent extends AgentConfig {
  _runtime: {
    imported_at: string;
    last_modified: string;
    source_path?: string;
  };
}

/**
 * Agent index entry
 */
export interface AgentIndexEntry {
  id: string;
  name: string;
  domain: string;
  role: string;
  provider: string;
  active: boolean;
  source_path?: string;
  imported_at: string;
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate agent configuration
 */
export function validateAgentConfig(config: unknown): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
  };

  if (!config || typeof config !== 'object') {
    result.valid = false;
    result.errors.push('Agent config must be an object');
    return result;
  }

  const agent = config as Partial<AgentConfig>;

  // Required fields
  if (!agent.id || typeof agent.id !== 'string') {
    result.valid = false;
    result.errors.push('Agent must have a valid "id" string');
  }

  if (!agent.name || typeof agent.name !== 'string') {
    result.valid = false;
    result.errors.push('Agent must have a valid "name" string');
  }

  if (!agent.domain || typeof agent.domain !== 'string') {
    result.valid = false;
    result.errors.push('Agent must have a valid "domain" string');
  }

  if (!agent.role || typeof agent.role !== 'string') {
    result.valid = false;
    result.errors.push('Agent must have a valid "role" string');
  } else if (!VALID_ROLES.includes(agent.role as any)) {
    result.warnings.push(`Role "${agent.role}" is not in the standard role list`);
  }

  if (!agent.description || typeof agent.description !== 'string') {
    result.valid = false;
    result.errors.push('Agent must have a valid "description" string');
  }

  // Model configuration
  if (!agent.model || typeof agent.model !== 'object') {
    result.valid = false;
    result.errors.push('Agent must have a "model" object');
  } else {
    if (!agent.model.primary || typeof agent.model.primary !== 'object') {
      result.valid = false;
      result.errors.push('Agent model must have a "primary" object');
    } else {
      if (!agent.model.primary.provider || typeof agent.model.primary.provider !== 'string') {
        result.valid = false;
        result.errors.push('Primary model must have a "provider" string');
      } else if (!VALID_PROVIDERS.includes(agent.model.primary.provider as any)) {
        result.warnings.push(`Provider "${agent.model.primary.provider}" is not in the standard provider list`);
      }

      if (!agent.model.primary.model || typeof agent.model.primary.model !== 'string') {
        result.valid = false;
        result.errors.push('Primary model must have a "model" string');
      }
    }
  }

  // Skills validation
  if (!agent.skills || !Array.isArray(agent.skills)) {
    result.valid = false;
    result.errors.push('Agent must have a "skills" array');
  } else if (agent.skills.length === 0) {
    result.warnings.push('Agent has no skills defined');
  }

  return result;
}

/**
 * Validate agent ID format
 */
export function validateAgentId(id: string): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
  };

  // ID should be lowercase, hyphen-separated alphanumeric
  const idRegex = /^[a-z][a-z0-9-]*[a-z0-9]$/;

  if (!idRegex.test(id)) {
    result.valid = false;
    result.errors.push(`Agent ID "${id}" must be lowercase, hyphen-separated alphanumeric (e.g., "damodaran-valuation")`);
  }

  return result;
}

/**
 * Sanitize agent config for storage (remove sensitive/unnecessary fields)
 */
export function sanitizeAgentConfig(config: AgentConfig): Partial<AgentConfig> {
  const { _runtime, ...sanitized } = config;
  return sanitized;
}
