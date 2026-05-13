import { z } from 'zod';

/**
 * Agent Card - Standard format for capability advertisement
 * Compatible with internal agents and external agent services
 *
 * This schema enables the A2A (Agent-to-Agent) runtime by providing:
 * 1. Capability discovery and advertisement
 * 2. Trust verification metadata
 * 3. Behavioral protocol compliance declaration
 * 4. Security and permission boundaries
 */
export const AgentCardSchema = z.object({
  // Identity
  id: z.string().min(1).regex(/^[a-z0-9-]+$/, "Agent ID must be lowercase with hyphens"),
  name: z.string().min(1).max(100),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  domain: z.string().min(1),
  active: z.boolean().default(true),

  // Metadata
  role: z.enum([
    'researcher', 'analyst', 'synthesizer', 'validator',
    'executor', 'monitor', 'document', 'coordinator'
  ]),
  description: z.string().min(10).max(500),
  tags: z.array(z.string()).default([]),

  // Capability Advertisement
  capabilities: z.object({
    input_types: z.array(z.string()).describe('Accepted input schemas'),
    output_types: z.array(z.string()).describe('Produced output schemas'),
    skills: z.array(z.object({
      id: z.string(),
      name: z.string(),
      description: z.string(),
      version: z.string().optional(),
    })).default([]),
    tools_required: z.array(z.string()).default([]),
    tools_provided: z.array(z.string()).default([]),
  }),

  // Model Configuration (for internal agents)
  model: z.object({
    provider: z.string(),
    model: z.string(),
    fallback_providers: z.array(z.object({
      provider: z.string(),
      model: z.string(),
      priority: z.number().min(1).max(10),
    })).default([]),
  }).optional().describe('Optional for external agents'),

  // Output Contract - defines what the agent MUST return
  output_contract: z.object({
    mandatory_fields: z.array(z.string()),
    forbidden_content: z.array(z.string()).default([]),
    validation_rules: z.array(z.string()).default([]),
  }),

  // Performance Constraints
  performance: z.object({
    timeout_seconds: z.number().min(10).max(600).default(120),
    max_tokens: z.number().min(1000).max(100000).default(8192),
    max_retries: z.number().min(0).max(5).default(3),
    memory_mb: z.number().optional().describe('Memory limit for containerized agents'),
  }).default({}),

  // A2A Specific (for external agents)
  a2a_config: z.object({
    endpoint: z.string().url().optional().describe('HTTP/WebSocket/gRPC endpoint'),
    protocol: z.enum(['http', 'websocket', 'grpc', 'custom']).optional(),
    authentication: z.object({
      type: z.enum(['none', 'api_key', 'jwt', 'oauth2', 'mutual_tls']),
      credentials_ref: z.string().optional().describe('Reference to credentials store (NOT the actual credentials)'),
    }).optional(),
    rate_limits: z.object({
      max_requests_per_minute: z.number().optional(),
      max_concurrent_requests: z.number().optional(),
    }).optional(),
    health_check: z.object({
      enabled: z.boolean().default(true),
      interval_seconds: z.number().default(60),
      endpoint: z.string().optional(),
      timeout_seconds: z.number().default(10),
    }).optional(),

    // Behavioral protocol compliance declaration
    behavioral_protocol: z.object({
      implements_challenge_response: z.boolean().default(false),
      implements_evidence_submission: z.boolean().default(false),
      implements_debate_protocol: z.boolean().default(false),
      supported_interaction_modes: z.array(z.enum([
        'request_response',
        'challenge_response',
        'debate',
        'collaborative',
        'adversarial'
      ])).default(['request_response']),
    }).optional(),
  }).optional(),

  // Observability
  observability: z.object({
    log_level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    metrics_enabled: z.boolean().default(true),
    tracing_enabled: z.boolean().default(true),
  }).default({}),

  // Security
  security: z.object({
    permissions: z.array(z.string()).default([]).describe('Required permissions (e.g., network, filesystem)'),
    sandbox_level: z.enum(['none', 'basic', 'strict', 'network_isolated']).default('basic'),
    allowed_domains: z.array(z.string()).default([]).describe('Allowlist for network access'),
  }).default({}),

  // Trust verification metadata
  trust: z.object({
    trust_level: z.enum(['unverified', 'probationary', 'trusted', 'certified']).default('unverified'),
    verification_status: z.enum(['pending', 'in_progress', 'verified', 'failed', 'revoked']).default('pending'),
    verification_method: z.enum([
      'self_attested',
      'behavioral_validation',
      'external_audit',
      'certified_authority'
    ]).default('self_attested'),
    probation_expires_at: z.string().datetime().optional(),
    audit_report_url: z.string().url().optional().describe('URL of external security audit report'),
    behavioral_score: z.number().min(0).max(100).optional().describe('Score from behavioral validation (0-100)'),
    last_verified_at: z.string().datetime().optional(),
  }).optional().describe('Trust verification metadata - populated by TrustVerifier'),

  // Metadata
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
  owner: z.string().optional().describe('Organization or individual owner'),
  documentation_url: z.string().url().optional(),
  source_code_url: z.string().url().optional(),
});

/**
 * Agent Card type inferred from schema
 */
export type AgentCard = z.infer<typeof AgentCardSchema>;

/**
 * Trust levels ordered by increasing trust
 */
export const TRUST_LEVELS = ['unverified', 'probationary', 'trusted', 'certified'] as const;
export type TrustLevel = typeof TRUST_LEVELS[number];

/**
 * Interaction modes supported by behavioral protocol
 */
export const INTERACTION_MODES = [
  'request_response',
  'challenge_response',
  'debate',
  'collaborative',
  'adversarial'
] as const;
export type InteractionMode = typeof INTERACTION_MODES[number];

/**
 * Validate an Agent Card
 */
export function validateAgentCard(data: unknown): {
  valid: boolean;
  data?: AgentCard;
  errors?: string[];
} {
  const result = AgentCardSchema.safeParse(data);
  if (result.success) {
    return { valid: true, data: result.data };
  }
  return {
    valid: false,
    errors: result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
  };
}

/**
 * Check if agent card represents an external agent
 */
export function isExternalAgent(card: AgentCard): boolean {
  return !!card.a2a_config?.endpoint;
}

/**
 * Check if agent has behavioral protocol support
 */
export function hasBehavioralProtocol(card: AgentCard): boolean {
  return !!card.a2a_config?.behavioral_protocol;
}

/**
 * Get trust level from agent card
 */
export function getTrustLevel(card: AgentCard): TrustLevel {
  return card.trust?.trust_level ?? 'unverified';
}

/**
 * Check if agent is on probation
 */
export function isOnProbation(card: AgentCard): boolean {
  const trustLevel = getTrustLevel(card);
  if (trustLevel !== 'probationary') return false;

  const expiresAt = card.trust?.probation_expires_at;
  if (!expiresAt) return true;

  return new Date(expiresAt) > new Date();
}

/**
 * Check if agent can handle challenges (challenge/response protocol)
 */
export function canHandleChallenges(card: AgentCard): boolean {
  return card.a2a_config?.behavioral_protocol?.implements_challenge_response ?? false;
}

/**
 * Check if agent can submit evidence
 */
export function canSubmitEvidence(card: AgentCard): boolean {
  return card.a2a_config?.behavioral_protocol?.implements_evidence_submission ?? false;
}

/**
 * Check if agent can participate in debates
 */
export function canParticipateInDebates(card: AgentCard): boolean {
  return card.a2a_config?.behavioral_protocol?.implements_debate_protocol ?? false;
}

/**
 * Get supported interaction modes for an agent
 */
export function getSupportedInteractionModes(card: AgentCard): InteractionMode[] {
  return card.a2a_config?.behavioral_protocol?.supported_interaction_modes ?? [];
}
