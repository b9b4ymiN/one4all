/**
 * Registry Types
 *
 * TypeScript interfaces for all registry configurations
 */

// === Model Registry Types ===

export interface ModelConfig {
  id: string;
  provider: 'claude' | 'gemini' | 'zai' | 'codex' | 'human' | 'python' | 'mock';
  name: string;
  version?: string;
  max_tokens: number;
  supports_streaming: boolean;
  cost_per_1k_input_tokens?: number;
  cost_per_1k_output_tokens?: number;
  api_type: 'rest' | 'cli' | 'subprocess' | 'mock';
  config?: Record<string, unknown>;
}

export interface ModelRegistry {
  models: Record<string, ModelConfig>;
  defaults: {
    claude: string;
    gemini: string;
    zai: string;
  };
}

// === Source Registry Types ===

export interface SourceConfig {
  id: string;
  name: string;
  tier: 1 | 2 | 3 | 4 | 5;
  type: 'filing' | 'report' | 'api' | 'news' | 'website' | 'database';
  url_pattern?: string;
  auth_required: boolean;
  update_frequency?: 'realtime' | 'daily' | 'weekly' | 'quarterly' | 'annual';
  parser?: string;
  config?: Record<string, unknown>;
}

export interface SourceRegistry {
  sources: Record<string, SourceConfig>;
}

// === Domain Registry Types ===

export interface DomainDefaultTeam {
  researcher?: string;
  analysts?: string[];
  synthesizer?: string;
  always_include?: string[];
}

export interface DomainMissionType {
  id: string;
  template: string;
  default_agents: string[];
}

export interface DomainOutputConfig {
  mandatory_report_sections: string[];
  mandatory_fields: string[];
  forbidden_content: string[];
}

export interface DomainHumanCheckpoints {
  after_research: 'always' | 'conditional' | 'never';
  after_synthesis: 'always' | 'conditional' | 'never';
  on_low_evidence: 'always' | 'conditional' | 'never';
}

export interface DomainJournalConfig {
  required: boolean;
  template?: string;
}

export interface DomainEvidenceRequirements {
  minimum_sources: Array<{ tier: string; count: number }>;
  required_documents: string[];
}

export interface DomainContextBudget {
  default_limit: number;
  compression_threshold: number;
}

export interface DomainConfig {
  id: string;
  name: string;
  version: string;
  description: string;
  constitution: {
    rules_file: string;
  };
  default_team: DomainDefaultTeam;
  mission_types: DomainMissionType[];
  markets: string[];
  output: DomainOutputConfig;
  human_checkpoints: DomainHumanCheckpoints;
  journal: DomainJournalConfig;
  evidence: DomainEvidenceRequirements;
  context_budget: DomainContextBudget;
}

// === Agent Registry Types ===

export interface AgentRoutingMetadata {
  expertise: string[];
  when_to_use: string[];
  output_type: string[];
  model_tier: 'expert' | 'non_expert';
  can_debate_with: string[];
  example_questions: string[];
}

export interface AgentModelConfig {
  primary: {
    provider: string;
    model: string;
  };
  fallback: Array<{
    provider: string;
    model: string;
  }>;
}

export interface AgentIdentity {
  persona_file: string;
  worldview: string[];
  cognitive_bias_awareness: string[];
}

export interface AgentInteractionRules {
  can_question?: string[];
  must_challenge?: string[];
  cannot_question?: string[];
}

export interface AgentOutputContract {
  schema_file?: string;
  mandatory_fields: string[];
  forbidden_content: string[];
}

export interface AgentPerformance {
  timeout_seconds: number;
  max_tokens: number;
  context_budget_override?: number | null;
}

export interface AgentConfig {
  id: string;
  name: string;
  version: string;
  domain: string;
  active: boolean;
  role: string;
  description: string;
  model: AgentModelConfig;
  identity: AgentIdentity;
  skills: string[];
  requires: string[];
  interaction_rules: AgentInteractionRules;
  output_contract: AgentOutputContract;
  performance: AgentPerformance;
  routing_metadata?: AgentRoutingMetadata;
}

export interface AgentRegistry {
  agents: Record<string, AgentConfig>;
  by_domain: Record<string, string[]>;
}

// === Skill Registry Types ===

export interface SkillInputRequirements {
  required: string[];
  preferred?: string[];
}

export interface SkillOutputSchema {
  [field: string]: string;
}

export interface SkillConfig {
  id: string;
  name: string;
  version: string;
  domain: string;
  description: string;
  skill_file: string;
  applicable_to: string[];
  input_requirements: SkillInputRequirements;
  output_schema: SkillOutputSchema;
  rules: string[];
  validation: string[];
}

export interface SkillRegistry {
  skills: Record<string, SkillConfig>;
  by_domain: Record<string, string[]>;
  by_agent: Record<string, string[]>;
}

// === Constitution Registry Types ===

export interface ConstitutionRule {
  id: string;
  description: string;
  enforcement: 'BLOCK_MISSION' | 'INSERT_HUMAN_REVIEW' | 'WARN_AND_FLAG' | 'REJECT_OUTPUT';
  applies_to: string[];
  exception?: string;
  forbidden_content?: string[];
  validation?: string[];
}

export interface ConstitutionConfig {
  domain: string;
  version: string;
  rules: ConstitutionRule[];
}

// === Common Registry Types ===

export interface RegistryLoadResult<T> {
  success: boolean;
  data?: T;
  errors: Array<{
    file: string;
    message: string;
  }>;
}

export interface RegistryOptions {
  hot_reload?: boolean;
  validate_schemas?: boolean;
  on_error?: 'throw' | 'log' | 'ignore';
}
