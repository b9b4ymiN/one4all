/**
 * Domain Schema - Validation for domain configurations
 *
 * Defines the structure and validation rules for domain cards.
 */

import type { AgentConfig } from './agent-schema.js';

/**
 * Domain configuration interface
 */
export interface DomainConfig {
  // Core identification
  id: string;
  name: string;
  version?: string;
  description: string;

  // Domain settings
  constitution_path?: string;
  default_cli?: 'claude-cli' | 'gemini-cli' | 'zai-api';
  evidence_requirements?: {
    tier_1: number;
    tier_2?: number;
    tier_3?: number;
  };

  // Supported mission types
  mission_types?: string[];

  // Agent assignments (agent IDs that belong to this domain)
  agent_ids?: string[];

  // Runtime metadata (not in source YAML)
  _runtime?: {
    created_at?: string;
    last_modified?: string;
    source_path?: string;
    constitution_rules?: number;
  };
}

/**
 * Runtime domain storage format (JSON in ~/.one4all/domains/)
 */
export interface RuntimeDomain extends DomainConfig {
  _runtime: {
    created_at: string;
    last_modified: string;
    source_path?: string;
    constitution_rules?: number;
  };
}

/**
 * Domain index entry
 */
export interface DomainIndexEntry {
  id: string;
  name: string;
  description: string;
  agent_count: number;
  constitution_loaded: boolean;
  created_at: string;
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
 * Validate domain configuration
 */
export function validateDomainConfig(config: unknown): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
  };

  if (!config || typeof config !== 'object') {
    result.valid = false;
    result.errors.push('Domain config must be an object');
    return result;
  }

  const domain = config as Partial<DomainConfig>;

  // Required fields
  if (!domain.id || typeof domain.id !== 'string') {
    result.valid = false;
    result.errors.push('Domain must have a valid "id" string');
  }

  if (!domain.name || typeof domain.name !== 'string') {
    result.valid = false;
    result.errors.push('Domain must have a valid "name" string');
  }

  if (!domain.description || typeof domain.description !== 'string') {
    result.valid = false;
    result.errors.push('Domain must have a valid "description" string');
  }

  // Optional but validated if present
  if (domain.default_cli) {
    const validCLIs = ['claude-cli', 'gemini-cli', 'zai-api'];
    if (!validCLIs.includes(domain.default_cli)) {
      result.warnings.push(`Default CLI "${domain.default_cli}" is not in the standard list`);
    }
  }

  return result;
}

/**
 * Validate domain ID format
 */
export function validateDomainId(id: string): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
  };

  // ID should be lowercase, hyphen-separated alphanumeric
  const idRegex = /^[a-z][a-z0-9-]*[a-z0-9]$/;

  if (!idRegex.test(id)) {
    result.valid = false;
    result.errors.push(`Domain ID "${id}" must be lowercase, hyphen-separated alphanumeric (e.g., "content-creator")`);
  }

  return result;
}

/**
 * Domain templates for quick creation
 */
export const DOMAIN_TEMPLATES: Record<string, Partial<DomainConfig>> = {
  'investment-war-room': {
    description: 'Evidence-based investment analysis with multiple specialist analysts',
    default_cli: 'gemini-cli',
    evidence_requirements: {
      tier_1: 3,
      tier_2: 5,
      tier_3: 10,
    },
    mission_types: ['stock_analysis', 'portfolio_review', 'thesis_validation'],
  },
  'content-creator': {
    description: 'Content creation and analysis domain with writers and editors',
    default_cli: 'claude-cli',
    evidence_requirements: {
      tier_1: 2,
      tier_2: 3,
    },
    mission_types: ['content_review', 'article_generation', 'seo_analysis'],
  },
  'research-studio': {
    description: 'Academic research and literature review domain',
    default_cli: 'gemini-cli',
    evidence_requirements: {
      tier_1: 5,
      tier_2: 10,
    },
    mission_types: ['literature_review', 'methodology_review', 'citation_analysis'],
  },
  'crypto-analysis': {
    description: 'Cryptocurrency analysis domain with on-chain data',
    default_cli: 'gemini-cli',
    evidence_requirements: {
      tier_1: 3,
    },
    mission_types: ['token_analysis', 'defi_review', 'nft_valuation'],
  },
};
