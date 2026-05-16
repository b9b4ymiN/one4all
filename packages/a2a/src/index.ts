/**
 * @one4all/a2a - Agent-to-Agent Compatible Runtime
 *
 * This package enables one4all to integrate external agent services as peers
 * to internal agents through:
 *
 * - Agent Card Standard: Capability advertisement format
 * - Trust Verification Layer: Behavioral validation and trust management
 * - Behavioral Compatibility Layer: Protocol translation between agents
 * - A2A Gateway: Request routing and protocol translation
 * - Kernel State Machine Integration: Event-driven state management
 *
 * Senior AI Harness Engineer Principles Applied:
 * - Treat the model as an unreliable component
 * - Prefer explicit control over clever prompts
 * - Observable by default
 * - Verifiable output
 */

// Schemas
export {
  AgentCardSchema,
  validateAgentCard,
  isExternalAgent,
  hasBehavioralProtocol,
  getTrustLevel,
  isOnProbation,
  type AgentCard,
} from './schemas/agent-card.schema.js';

export type { TrustLevel } from './schemas/agent-card.schema.js';

// Trust Verification
export {
  TrustVerifier,
} from './trust/trust-verifier.js';

export type {
  TrustVerificationConfig,
  ValidationResult,
  TrustVerificationResult,
} from './trust/trust-verifier.js';

// Gateway Events
export {
  GatewayEventType,
  createGatewayEvent,
  isCircuitBreakerEvent,
  isAgentFailureEvent,
  isFallbackEvent,
  isUnhealthyEvent,
  isRecoveryEvent,
} from './events/gateway-events.js';

export type { GatewayEvent, CircuitBreakerState } from './events/gateway-events.js';

// Gateway State Machine
export {
  A2AGatewayStateMachine,
} from './gateway/gateway-state-machine.js';

export type {
  A2AGatewayState,
  StateTransition,
  AgentHealth,
  EscalationPolicy,
} from './gateway/gateway-state-machine.js';

// Behavioral Protocols
export {
  hasBehavioralProtocolSupport,
  getSupportedInteractionModes,
  canParticipateInDebates,
  canHandleChallenges,
  canSubmitEvidence,
  getBehavioralCompatibilityScore,
} from './protocols/behavioral-protocol.js';

export {
  InteractionMode,
  type ChallengeRequest,
  type ChallengeResponse,
  type DebateRequest,
  type DebateResponse,
  type EvidenceSubmission,
  type BehavioralProtocol,
} from './protocols/behavioral-protocol.js';

// Agent Adapters
export {
  AgentAdapterFactory,
  BehavioralCompatibilityManager,
} from './adapters/agent-adapter.js';

export type {
  InternalMessage,
  A2ARequest,
  A2AResponse,
  AgentAdapter,
  CompatibilityResult,
} from './adapters/agent-adapter.js';

export { ExternalAgentAdapter, InternalAgentAdapter } from './adapters/agent-adapter.js';

// A2A Gateway
export { A2AGateway } from './gateway/a2a-gateway.js';

export type { A2AGatewayConfig } from './gateway/a2a-gateway.js';
