import { EventEmitter } from 'events';
import type { AgentCard } from '../schemas/agent-card.schema.js';
import type { A2ARequest, A2AResponse } from '../adapters/agent-adapter.js';
import type { InternalMessage } from '../adapters/agent-adapter.js';
import type { TrustVerificationConfig } from '../trust/trust-verifier.js';
import { TrustVerifier } from '../trust/trust-verifier.js';
import { AgentAdapterFactory, BehavioralCompatibilityManager } from '../adapters/agent-adapter.js';
import { A2AGatewayStateMachine } from './gateway-state-machine.js';
import { GatewayEventType, type GatewayEvent, createGatewayEvent } from '../events/gateway-events.js';

/**
 * A2A Gateway Configuration
 */
export interface A2AGatewayConfig {
  discovery_config?: {
    local_registry_path: string;
    remote_registries?: string[];
  };
  trust_config?: Partial<TrustVerificationConfig>;
  default_timeout_seconds: number;
  enable_fallback: boolean;
  max_concurrent_requests: number;
  enable_behavioral_compatibility_checks: boolean;
}

/**
 * Request routing result
 */
interface RoutingResult {
  handler: 'internal' | 'external';
  agent: AgentCard;
  adapter: any;
}

/**
 * In-flight request tracking
 */
interface InFlightRequest {
  request: A2ARequest;
  startTime: number;
  timeout: NodeJS.Timeout | null;
}

/**
 * A2A Gateway
 *
 * This is the main entry point for A2A communication. It:
 * 1. Routes requests to internal or external agents
 * 2. Translates between protocols via adapters
 * 3. Manages trust verification
 * 4. Tracks agent health
 * 5. Emits events to the state machine
 *
 * This implements the Senior AI Harness Engineer principles:
 * - "Observable by default" - all interactions emit events
 * - "Treat the model as unreliable" - timeouts, circuit breakers, fallbacks
 * - "Verifiable output" - response contract validation
 */
export class A2AGateway extends EventEmitter {
  private config: A2AGatewayConfig;
  private stateMachine: A2AGatewayStateMachine;
  private trustVerifier: TrustVerifier;
  private compatibilityManager: BehavioralCompatibilityManager;

  // Agent registry
  private agentRegistry: Map<string, AgentCard>;

  // Request tracking
  private inFlightRequests: Map<string, InFlightRequest>;
  private activeRequests: Set<string>;
  private requestCounter: number;

  // Fallback tracking
  private failureCounts: Map<string, number>;
  private circuitBreakers: Map<string, 'open' | 'closed' | 'half-open'>;

  constructor(config: A2AGatewayConfig) {
    super();

    this.config = {
      default_timeout_seconds: 120,
      enable_fallback: true,
      max_concurrent_requests: 10,
      enable_behavioral_compatibility_checks: true,
      ...config,
    };

    // Initialize components
    this.stateMachine = new A2AGatewayStateMachine();
    this.trustVerifier = new TrustVerifier(this.config.trust_config);
    this.compatibilityManager = new BehavioralCompatibilityManager();

    // Initialize storage
    this.agentRegistry = new Map();
    this.inFlightRequests = new Map();
    this.activeRequests = new Set();
    this.failureCounts = new Map();
    this.circuitBreakers = new Map();
    this.requestCounter = 0;

    // Listen to state machine events
    this.stateMachine.on('state_transition', (event) => {
      this.emit('state_changed', event);
    });

    this.stateMachine.on('kernel_event', (event) => {
      this.emit('kernel_event', event);
    });
  }

  /**
   * Register an agent
   *
   * Agents must pass trust verification before being registered.
   */
  async registerAgent(card: AgentCard, source: 'local' | 'remote' = 'local'): Promise<void> {
    // Verify trust before registration
    const trustResult = await this.trustVerifier.verifyAgentTrust(card);

    if (!trustResult.allowed) {
      throw new Error(`Agent trust verification failed: ${trustResult.reason}`);
    }

    // Store in registry
    this.agentRegistry.set(card.id, card);

    this.emit('agent_registered', {
      agentId: card.id,
      source,
      trustLevel: trustResult.trustLevel,
      timestamp: new Date().toISOString(),
    });

    // Initialize agent health tracking
    this.stateMachine.updateAgentHealth(card.id, true);
  }

  /**
   * Unregister an agent
   */
  unregisterAgent(agentId: string): void {
    if (!this.agentRegistry.has(agentId)) {
      throw new Error(`Agent ${agentId} not found`);
    }

    this.agentRegistry.delete(agentId);
    this.failureCounts.delete(agentId);
    this.circuitBreakers.delete(agentId);

    this.emit('agent_unregistered', {
      agentId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get agent by ID
   */
  getAgent(agentId: string): AgentCard | undefined {
    return this.agentRegistry.get(agentId);
  }

  /**
   * Get all registered agents
   */
  getAllAgents(): AgentCard[] {
    return Array.from(this.agentRegistry.values());
  }

  /**
   * Send request to agent
   *
   * This is the main method for sending requests to agents.
   * It handles routing, translation, timeouts, and fallbacks.
   */
  async sendToAgent(
    agentId: string,
    task: {
      type: string;
      input: any;
      context?: any;
    },
    options?: {
      timeout?: number;
      retry?: boolean;
      skipCompatibilityCheck?: boolean;
    }
  ): Promise<A2AResponse> {
    const startTime = Date.now();
    const timeout = options?.timeout || this.config.default_timeout_seconds;

    // Check gateway state
    if (!this.stateMachine.canAcceptRequests()) {
      return {
        request_id: `req-${this.requestCounter++}`,
        agent_id: agentId,
        timestamp: new Date().toISOString(),
        status: 'error',
        error: {
          code: 'GATEWAY_UNAVAILABLE',
          message: 'Gateway is in critical state and cannot accept requests',
        },
        metadata: { latency_ms: Date.now() - startTime },
      };
    }

    // Get agent
    const agent = this.getAgent(agentId);
    if (!agent) {
      return {
        request_id: `req-${this.requestCounter++}`,
        agent_id: agentId,
        timestamp: new Date().toISOString(),
        status: 'error',
        error: {
          code: 'AGENT_NOT_FOUND',
          message: `Agent ${agentId} not found in registry`,
        },
        metadata: { latency_ms: Date.now() - startTime },
      };
    }

    // Check circuit breaker
    const circuitState = this.circuitBreakers.get(agentId);
    if (circuitState === 'open') {
      // Try fallback if enabled
      if (this.config.enable_fallback && agent.model?.fallback_providers?.length) {
        return await this.handleFallback(agent, task, options, new Error('Circuit breaker open'));
      }

      return {
        request_id: `req-${this.requestCounter++}`,
        agent_id: agentId,
        timestamp: new Date().toISOString(),
        status: 'error',
        error: {
          code: 'CIRCUIT_BREAKER_OPEN',
          message: 'Circuit breaker is open for this agent',
        },
        metadata: { latency_ms: Date.now() - startTime },
      };
    }

    // Check compatibility if enabled
    if (this.config.enable_behavioral_compatibility_checks && !options?.skipCompatibilityCheck) {
      const isExternal = AgentAdapterFactory.isExternalAgent(agent);
      if (isExternal) {
        const compatibility = await this.compatibilityManager.checkCompatibility(agent);
        if (!compatibility.compatible) {
          this.emit('compatibility_warning', {
            agentId,
            reasons: compatibility.reasons,
            warnings: compatibility.warnings,
          });
        }
      }
    }

    // Create request
    const requestId = `req-${this.requestCounter++}`;
    const request: A2ARequest = {
      request_id: requestId,
      timestamp: new Date().toISOString(),
      agent_id: agentId,
      task,
      constraints: {
        timeout_seconds: timeout,
      },
    };

    // Track in-flight request
    const timeoutHandle = setTimeout(() => {
      this.handleTimeout(agentId, requestId);
    }, timeout * 1000);

    this.inFlightRequests.set(requestId, {
      request,
      startTime,
      timeout: timeoutHandle,
    });
    this.activeRequests.add(requestId);

    try {
      // Route and execute request
      const response = await this.routeRequest(agent, request);

      // Record interaction for trust verification
      this.trustVerifier.recordInteraction(agentId, request, response);

      // Update success metrics
      this.failureCounts.delete(agentId);
      this.stateMachine.updateAgentHealth(agentId, true);

      // Check circuit breaker recovery
      if (circuitState === 'half-open') {
        this.circuitBreakers.set(agentId, 'closed');
        this.stateMachine.handleEvent(createGatewayEvent(
          GatewayEventType.CIRCUIT_BREAKER_CLOSED,
          { agent_id: agentId, data: {} }
        ));
      }

      return response;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Track failure
      this.failureCounts.set(agentId, (this.failureCounts.get(agentId) || 0) + 1);
      this.stateMachine.updateAgentHealth(agentId, false);

      // Emit failure event
      this.stateMachine.handleEvent(createGatewayEvent(
        GatewayEventType.AGENT_FAILURE,
        {
          agent_id: agentId,
          request_id: requestId,
          data: {
            error: { code: 'AGENT_EXECUTION_FAILED', message: errorMessage },
          },
        }
      ));

      // Check if should open circuit breaker
      const failureCount = this.failureCounts.get(agentId) || 0;
      if (failureCount >= 3) {
        this.circuitBreakers.set(agentId, 'open');
        this.stateMachine.handleEvent(createGatewayEvent(
          GatewayEventType.CIRCUIT_BREAKER_OPENED,
          {
            agent_id: agentId,
            data: {
              reason: `Failure threshold reached: ${failureCount} failures`,
              previous_state: circuitState || 'closed',
              new_state: 'open',
            },
          }
        ));
      }

      // Handle fallback if enabled
      if (this.config.enable_fallback && options?.retry !== false) {
        return await this.handleFallback(agent, task, options, error);
      }

      // Return error response
      return {
        request_id: requestId,
        agent_id: agentId,
        timestamp: new Date().toISOString(),
        status: 'error',
        error: {
          code: 'AGENT_EXECUTION_FAILED',
          message: errorMessage,
        },
        metadata: { latency_ms: Date.now() - startTime },
      };

    } finally {
      // Clean up in-flight request
      const inFlight = this.inFlightRequests.get(requestId);
      if (inFlight?.timeout) {
        clearTimeout(inFlight.timeout);
      }
      this.inFlightRequests.delete(requestId);
      this.activeRequests.delete(requestId);
    }
  }

  /**
   * Route request to appropriate handler
   */
  private async routeRequest(agent: AgentCard, request: A2ARequest): Promise<A2AResponse> {
    const isExternal = AgentAdapterFactory.isExternalAgent(agent);

    if (isExternal) {
      return await this.executeExternalRequest(agent, request);
    } else {
      return await this.executeInternalRequest(agent, request);
    }
  }

  /**
   * Execute request on external agent
   *
   * In a real implementation, this would make HTTP/WebSocket/gRPC call.
   */
  private async executeExternalRequest(agent: AgentCard, request: A2ARequest): Promise<A2AResponse> {
    const endpoint = agent.a2a_config?.endpoint;
    const protocol = agent.a2a_config?.protocol || 'http';

    if (!endpoint) {
      throw new Error('External agent has no endpoint configured');
    }

    // TODO: Implement actual HTTP/WebSocket/gRPC client
    // For now, return a mock response
    throw new Error('External agent execution not yet implemented - requires HTTP client');
  }

  /**
   * Execute request on internal agent
   *
   * This would integrate with the one4all kernel's agent execution system.
   */
  private async executeInternalRequest(agent: AgentCard, request: A2ARequest): Promise<A2AResponse> {
    // TODO: Integrate with kernel agent execution
    // For now, return a mock response
    throw new Error('Internal agent execution not yet implemented - requires kernel integration');
  }

  /**
   * Handle request timeout
   */
  private handleTimeout(agentId: string, requestId: string): void {
    this.failureCounts.set(agentId, (this.failureCounts.get(agentId) || 0) + 1);
    this.stateMachine.updateAgentHealth(agentId, false);

    this.stateMachine.handleEvent(createGatewayEvent(
      GatewayEventType.AGENT_TIMEOUT,
      {
        agent_id: agentId,
        request_id: requestId,
        data: {
          error: { code: 'REQUEST_TIMEOUT', message: 'Request timed out' },
        },
      }
    ));
  }

  /**
   * Handle fallback to alternative provider
   */
  private async handleFallback(
    agent: AgentCard,
    task: { type: string; input: any; context?: any },
    options?: { timeout?: number; retry?: boolean },
    originalError?: any
  ): Promise<A2AResponse> {
    const fallbacks = agent.model?.fallback_providers;
    if (!fallbacks || fallbacks.length === 0) {
      throw new Error('No fallback providers configured');
    }

    // Emit fallback triggered event
    this.stateMachine.handleEvent(createGatewayEvent(
      GatewayEventType.FALLBACK_TRIGGERED,
      {
        agent_id: agent.id,
        data: {
          reason: 'Primary agent failed',
          metadata: { fallback_count: fallbacks.length },
        },
      }
    ));

    // Try each fallback in order
    for (const fallback of fallbacks) {
      try {
        // In a real implementation, this would route to the fallback agent
        // For now, we throw to indicate this needs implementation
        throw new Error(`Fallback to ${fallback.provider}/${fallback.model} not yet implemented`);
      } catch (fallbackError) {
        // Continue to next fallback
        continue;
      }
    }

    // All fallbacks failed
    this.stateMachine.handleEvent(createGatewayEvent(
      GatewayEventType.FALLBACK_FAILED,
      {
        agent_id: agent.id,
        data: {
          error: { code: 'ALL_FALLBACKS_FAILED', message: 'All fallback providers failed' },
        },
      }
    ));

    throw new Error('All fallback providers failed');
  }

  /**
   * Get gateway health status
   */
  healthCheck(): {
    gateway_healthy: boolean;
    state: string;
    agents: {
      total: number;
      healthy: number;
      unhealthy: number;
    };
    requests: {
      in_flight: number;
      active: number;
    };
  } {
    const state = this.stateMachine.getState();
    const healthSummary = this.stateMachine.getHealthSummary();

    return {
      gateway_healthy: state !== 'critical',
      state,
      agents: {
        total: healthSummary.totalAgents,
        healthy: healthSummary.healthyAgents,
        unhealthy: healthSummary.unhealthyAgents,
      },
      requests: {
        in_flight: this.inFlightRequests.size,
        active: this.activeRequests.size,
      },
    };
  }

  /**
   * Get agent health status
   */
  getAgentHealth(agentId: string): { healthy: boolean; failureCount: number } | undefined {
    return this.stateMachine.getAgentState(agentId);
  }

  /**
   * Get trust status for agent
   */
  getTrustStatus(agentId: string): ReturnType<TrustVerifier['getTrustStatus']> {
    return this.trustVerifier.getTrustStatus(agentId);
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    // Clear all in-flight request timeouts
    for (const [requestId, inFlight] of this.inFlightRequests) {
      if (inFlight.timeout) {
        clearTimeout(inFlight.timeout);
      }
    }

    // Clear collections
    this.inFlightRequests.clear();
    this.activeRequests.clear();
    this.agentRegistry.clear();
    this.failureCounts.clear();
    this.circuitBreakers.clear();

    // Remove all listeners
    this.removeAllListeners();
  }
}
