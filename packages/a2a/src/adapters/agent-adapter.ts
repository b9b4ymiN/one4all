import type { AgentCard } from '../schemas/agent-card.schema.js';
import { InteractionMode, getSupportedInteractionModes } from '../protocols/behavioral-protocol.js';

/**
 * Simplified Internal Message type (matches one4all kernel format)
 */
export interface InternalMessage {
  id: string;
  type: string;
  sender: string;
  recipient: string;
  timestamp: string;
  payload: any;
  context?: any;
  timeout?: number;
  reply_to?: string;
  status?: string;
  error?: { code: string; message: string };
  metadata?: Record<string, any>;
}

/**
 * A2A Request format
 */
export interface A2ARequest {
  request_id: string;
  timestamp: string;
  agent_id: string;
  task: {
    type: string;
    input: any;
    context?: any;
  };
  constraints?: {
    timeout_seconds?: number;
    max_tokens?: number;
  };
  reply_to?: string;
}

/**
 * A2A Response format
 */
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
    tokens_used?: number;
  };
}

/**
 * Agent Adapter interface
 *
 * Adapters bridge the protocol gap between internal agents (with full behavioral
 * support) and external agents (with limited or no behavioral support).
 *
 * This implements the Senior AI Harness Engineer principle:
 * "Explicit control over clever prompts" - we explicitly translate protocols.
 */
export interface AgentAdapter {
  /**
   * Adapt internal message to external agent format (A2A Request)
   */
  adaptRequest(message: InternalMessage): A2ARequest;

  /**
   * Adapt external agent response to internal message format
   */
  adaptResponse(response: A2AResponse): InternalMessage;

  /**
   * Check if adapter supports specific interaction mode
   */
  supportsMode(mode: InteractionMode): boolean;

  /**
   * Handle behavioral protocol request
   * (Only works if agent implements the protocol)
   */
  handleBehavioralRequest?(request: any): Promise<any>;
}

/**
 * External Agent Adapter
 *
 * Wraps external agents that don't implement one4all's behavioral protocols.
 * Provides protocol translation and graceful degradation.
 */
export class ExternalAgentAdapter implements AgentAdapter {
  private card: AgentCard;

  constructor(card: AgentCard) {
    this.card = card;
  }

  /**
   * Adapt internal message to A2A request
   */
  adaptRequest(message: InternalMessage): A2ARequest {
    return {
      request_id: message.id,
      timestamp: message.timestamp || new Date().toISOString(),
      agent_id: message.recipient,
      task: {
        type: message.type,
        input: message.payload,
        context: message.context,
      },
      constraints: {
        timeout_seconds: message.timeout,
      },
      reply_to: message.reply_to,
    };
  }

  /**
   * Adapt A2A response to internal message
   */
  adaptResponse(response: A2AResponse): InternalMessage {
    return {
      id: response.request_id,
      type: 'response',
      sender: response.agent_id,
      recipient: 'gateway',
      timestamp: response.timestamp,
      payload: response.output,
      status: response.status,
      error: response.error,
      metadata: response.metadata,
    };
  }

  /**
   * Check if agent supports interaction mode
   */
  supportsMode(mode: InteractionMode): boolean {
    const supportedModes = getSupportedInteractionModes(this.card);
    return supportedModes.includes(mode);
  }

  /**
   * Handle behavioral protocol request
   *
   * For external agents, this checks if the agent claims to support
   * the protocol and forwards the request if so.
   */
  async handleBehavioralRequest(request: any): Promise<any> {
    const protocol = this.card.a2a_config?.behavioral_protocol;

    if (!protocol) {
      throw new Error('Agent does not implement behavioral protocol');
    }

    // Check if request type is supported
    if (request.type === 'challenge' && !protocol.implements_challenge_response) {
      throw new Error('Agent does not support challenge/response protocol');
    }

    if (request.type === 'debate' && !protocol.implements_debate_protocol) {
      throw new Error('Agent does not support debate protocol');
    }

    if (request.type === 'evidence' && !protocol.implements_evidence_submission) {
      throw new Error('Agent does not support evidence submission');
    }

    // In a real implementation, this would forward the request to the
    // external agent's endpoint. For now, we throw to indicate
    // that this needs actual HTTP client integration.
    throw new Error('External agent behavioral protocol forwarding not yet implemented');
  }
}

/**
 * Internal Agent Adapter
 *
 * Wraps internal agents (from the one4all kernel) to provide A2A compatibility.
 * Internal agents implement full behavioral protocols by design.
 */
export class InternalAgentAdapter implements AgentAdapter {
  private card: AgentCard;

  constructor(card: AgentCard) {
    this.card = card;
  }

  /**
   * Adapt internal message to A2A request
   *
   * For internal agents, this is mostly a passthrough with format translation.
   */
  adaptRequest(message: InternalMessage): A2ARequest {
    return {
      request_id: message.id,
      timestamp: message.timestamp || new Date().toISOString(),
      agent_id: message.recipient,
      task: {
        type: message.type,
        input: message.payload,
        context: message.context,
      },
      constraints: {
        timeout_seconds: message.timeout,
      },
      reply_to: message.reply_to,
    };
  }

  /**
   * Adapt A2A response to internal message
   */
  adaptResponse(response: A2AResponse): InternalMessage {
    return {
      id: response.request_id,
      type: 'response',
      sender: response.agent_id,
      recipient: 'gateway',
      timestamp: response.timestamp,
      payload: response.output,
      status: response.status,
      error: response.error,
      metadata: response.metadata,
    };
  }

  /**
   * Check if agent supports interaction mode
   *
   * Internal agents (without a2a_config) support all modes.
   * External agents with declared modes are checked against those modes.
   */
  supportsMode(mode: InteractionMode): boolean {
    // Internal agents (no a2a_config at all) support all modes
    if (!this.card.a2a_config) {
      return true;
    }

    // For agents with a2a_config, check declared modes
    const supportedModes = getSupportedInteractionModes(this.card);
    return supportedModes.includes(mode);
  }

  /**
   * Handle behavioral protocol request
   *
   * Internal agents implement full behavioral protocol.
   * This would forward to the kernel's agent execution system.
   */
  async handleBehavioralRequest(request: any): Promise<any> {
    // Internal agents support all behavioral protocols
    // This would integrate with the kernel's agent system
    throw new Error('Internal agent behavioral protocol integration not yet implemented');
  }
}

/**
 * Adapter Factory
 *
 * Creates the appropriate adapter for a given agent card.
 */
export class AgentAdapterFactory {
  /**
   * Create appropriate adapter for agent
   *
   * External agents (with endpoint) get ExternalAgentAdapter
   * Internal agents (without endpoint) get InternalAgentAdapter
   */
  static createAdapter(card: AgentCard): AgentAdapter {
    if (card.a2a_config?.endpoint) {
      return new ExternalAgentAdapter(card);
    } else {
      return new InternalAgentAdapter(card);
    }
  }

  /**
   * Check if agent is external
   */
  static isExternalAgent(card: AgentCard): boolean {
    return !!card.a2a_config?.endpoint;
  }

  /**
   * Check if agent is internal
   */
  static isInternalAgent(card: AgentCard): boolean {
    return !this.isExternalAgent(card);
  }
}

/**
 * Compatibility check result
 */
export interface CompatibilityResult {
  compatible: boolean;
  reasons: string[];
  warnings: string[];
  requiredAdaptations: string[];
}

/**
 * Behavioral Compatibility Manager
 *
 * Checks compatibility between agents and manages protocol adaptations.
 */
export class BehavioralCompatibilityManager {
  /**
   * Check if external agent is compatible with internal agent system
   */
  async checkCompatibility(card: AgentCard): Promise<CompatibilityResult> {
    const reasons: string[] = [];
    const warnings: string[] = [];
    const requiredAdaptations: string[] = [];

    // Check 1: Does agent have behavioral protocol?
    const hasProtocol = card.a2a_config?.behavioral_protocol;
    if (!hasProtocol) {
      reasons.push('Agent does not implement behavioral protocol');
      requiredAdaptations.push('Wrap with ExternalAgentAdapter');
    }

    // Check 2: Interaction mode coverage
    const supportedModes = getSupportedInteractionModes(card);
    if (supportedModes.length === 1 && supportedModes[0] === InteractionMode.REQUEST_RESPONSE) {
      warnings.push('Agent only supports request/response mode');
      requiredAdaptations.push('Limited interaction capabilities - will not participate in debates');
    }

    // Check 3: Challenge/response support
    if (!hasProtocol?.implements_challenge_response) {
      warnings.push('Agent cannot handle challenges - may not participate effectively in debates');
      requiredAdaptations.push('Implement challenge/response fallback');
    }

    // Check 4: Evidence submission support
    if (!hasProtocol?.implements_evidence_submission) {
      warnings.push('Agent cannot submit structured evidence');
      requiredAdaptations.push('Evidence submissions will be handled by gateway');
    }

    // Check 5: Debate protocol support
    if (!hasProtocol?.implements_debate_protocol) {
      warnings.push('Agent cannot participate in structured debates');
      requiredAdaptations.push('Debate rounds will skip this agent');
    }

    return {
      compatible: reasons.length === 0,
      reasons,
      warnings,
      requiredAdaptations,
    };
  }

  /**
   * Adapt message between internal and external agent formats
   */
  adaptMessage(
    from: AgentCard,
    to: AgentCard,
    message: InternalMessage
  ): InternalMessage {
    const adapter = AgentAdapterFactory.createAdapter(to);

    // First adapt to A2A format
    const a2aRequest = adapter.adaptRequest(message);

    // Then adapt response back (this is a simplified flow)
    // In reality, this would go through HTTP/WebSocket for external agents
    const adapted = adapter.adaptResponse({
      request_id: a2aRequest.request_id,
      agent_id: to.id,
      timestamp: a2aRequest.timestamp,
      status: 'success',
      output: message.payload,
    } as any);

    // Override recipient to maintain the target agent
    adapted.recipient = to.id;
    return adapted;
  }

  /**
   * Handle behavioral protocol interaction
   */
  async handleBehavioralInteraction(
    agent: AgentCard,
    mode: InteractionMode,
    request: any
  ): Promise<any> {
    const adapter = AgentAdapterFactory.createAdapter(agent);

    if (!adapter.supportsMode(mode)) {
      throw new Error(`Agent ${agent.id} does not support interaction mode: ${mode}`);
    }

    if (adapter.handleBehavioralRequest) {
      return await adapter.handleBehavioralRequest(request);
    }

    throw new Error(`Behavioral protocol handler not available for agent ${agent.id}`);
  }
}
