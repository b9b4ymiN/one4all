import { EventEmitter } from 'events';
import { GatewayEventType, type GatewayEvent, isUnhealthyEvent, isRecoveryEvent } from '../events/gateway-events.js';

/**
 * A2A Gateway states
 *
 * These states represent the overall health of the A2A gateway system.
 * They drive escalation policies and inform the kernel about gateway status.
 *
 * State transitions:
 * - NORMAL → DEGRADED: Circuit breaker opens or multiple agent failures
 * - DEGRADED → FALLBACK: Continued failures in degraded mode
 * - FALLBACK → CRITICAL: All fallback providers failed
 * - Any → NORMAL: Agents recover, circuit breakers close
 */
export enum A2AGatewayState {
  NORMAL = 'NORMAL',
  DEGRADED = 'DEGRADED',
  FALLBACK = 'FALLBACK',
  CRITICAL = 'CRITICAL',
}

/**
 * State transition configuration
 */
export interface StateTransition {
  from: A2AGatewayState;
  to: A2AGatewayState;
  event?: GatewayEventType;
  action?: (event: GatewayEvent) => void | Promise<void>;
}

/**
 * State transition history entry
 */
export interface TransitionHistoryEntry {
  from: string;
  to: string;
  event: GatewayEventType;
  timestamp: string;
  reason?: string;
}

/**
 * Agent health tracking
 */
export interface AgentHealth {
  healthy: boolean;
  failureCount: number;
  lastFailure?: Date;
  lastSuccess?: Date;
  consecutiveFailures: number;
}

/**
 * Escalation policy configuration
 */
export interface EscalationPolicy {
  currentState: A2AGatewayState;
  nextStateOnError: A2AGatewayState;
  action: string;
  threshold?: number; // Number of failures to trigger transition
}

/**
 * A2A Gateway State Machine
 *
 * This state machine integrates with the kernel state machine by emitting
 * events that the kernel can subscribe to. It provides:
 * - State tracking for the overall gateway health
 * - Per-agent health tracking
 * - Escalation policies based on failure patterns
 * - Event emission for kernel integration
 *
 * This implements the Senior AI Harness Engineer principle:
 * "Observable by default" - all state transitions emit events.
 */
export class A2AGatewayStateMachine extends EventEmitter {
  private currentState: A2AGatewayState;
  private stateTransitions: Map<GatewayEventType, StateTransition[]>;
  private agentStates: Map<string, AgentHealth>;
  private failureCounts: Map<string, number>;
  private transitionHistory: TransitionHistoryEntry[];

  // Configuration
  private readonly degradedThreshold: number = 3; // Failures to enter DEGRADED
  private readonly fallbackThreshold: number = 5; // Failures to enter FALLBACK
  private readonly criticalThreshold: number = 10; // Failures to enter CRITICAL

  constructor() {
    super();
    this.currentState = A2AGatewayState.NORMAL;
    this.stateTransitions = new Map();
    this.agentStates = new Map();
    this.failureCounts = new Map();
    this.transitionHistory = [];
    this.initializeTransitions();
  }

  /**
   * Initialize state transitions
   */
  private initializeTransitions(): void {
    // NORMAL → DEGRADED transitions
    this.addTransition(GatewayEventType.CIRCUIT_BREAKER_OPENED, {
      from: A2AGatewayState.NORMAL,
      to: A2AGatewayState.DEGRADED,
      action: (e) => this.handleCircuitBreakerOpened(e),
    });

    this.addTransition(GatewayEventType.AGENT_FAILURE, {
      from: A2AGatewayState.NORMAL,
      to: A2AGatewayState.DEGRADED,
      action: (e) => this.handleAgentFailure(e),
    });

    // DEGRADED → FALLBACK transitions
    this.addTransition(GatewayEventType.AGENT_FAILURE, {
      from: A2AGatewayState.DEGRADED,
      to: A2AGatewayState.FALLBACK,
      action: (e) => this.handleAgentFailureInDegraded(e),
    });

    this.addTransition(GatewayEventType.FALLBACK_TRIGGERED, {
      from: A2AGatewayState.DEGRADED,
      to: A2AGatewayState.FALLBACK,
      action: (e) => this.handleFallbackTriggered(e),
    });

    // FALLBACK → CRITICAL transitions
    this.addTransition(GatewayEventType.FALLBACK_FAILED, {
      from: A2AGatewayState.FALLBACK,
      to: A2AGatewayState.CRITICAL,
      action: (e) => this.handleAllFallbacksFailed(e),
    });

    // Recovery transitions (any state back toward NORMAL)
    this.addTransition(GatewayEventType.AGENT_RECOVERED, {
      from: A2AGatewayState.DEGRADED,
      to: A2AGatewayState.NORMAL,
      action: () => this.handleAgentRecovered(),
    });

    this.addTransition(GatewayEventType.CIRCUIT_BREAKER_CLOSED, {
      from: A2AGatewayState.DEGRADED,
      to: A2AGatewayState.NORMAL,
      action: () => this.handleCircuitBreakerClosed(),
    });

    this.addTransition(GatewayEventType.AGENT_HEALTHY, {
      from: A2AGatewayState.FALLBACK,
      to: A2AGatewayState.DEGRADED,
      action: () => this.handleAgentsHealthy(),
    });
  }

  /**
   * Add a state transition
   */
  private addTransition(event: GatewayEventType, transition: StateTransition): void {
    const transitions = this.stateTransitions.get(event) || [];
    transitions.push(transition);
    this.stateTransitions.set(event, transitions);
  }

  /**
   * Handle gateway event and potentially transition state
   */
  async handleEvent(event: GatewayEvent): Promise<void> {
    const transitions = this.stateTransitions.get(event.type);

    if (!transitions) {
      return; // No transition defined for this event
    }

    // Find matching transition for current state
    const transition = transitions.find(t => t.from === this.currentState);

    if (!transition) {
      this.emit('state_transition_skipped', {
        event: event.type,
        currentState: this.currentState,
        reason: 'No transition defined for current state',
      });
      return;
    }

    // Execute state transition
    const previousState = this.currentState;
    this.currentState = transition.to;

    // Generate reason message
    const reason = event.data.reason || this.getDefaultReasonForEvent(event.type);

    // Record transition in history
    this.transitionHistory.push({
      from: previousState,
      to: this.currentState,
      event: event.type,
      timestamp: new Date().toISOString(),
      reason,
    });

    this.emit('state_transition', {
      from: previousState,
      to: this.currentState,
      event: event.type,
      reason,
      timestamp: new Date().toISOString(),
    });

    // Execute transition action
    if (transition.action) {
      await transition.action(event);
    }

    // Emit to kernel event bus (if configured)
    this.emitStateChangeToKernel(this.currentState, event);
  }

  /**
   * Get current state
   */
  getState(): string {
    return this.currentState;
  }

  /**
   * Get transition history
   */
  getTransitionHistory(): TransitionHistoryEntry[] {
    return [...this.transitionHistory];
  }

  /**
   * Get agent health state
   */
  getAgentState(agentId: string): {
    healthy: boolean;
    failureCount: number;
  } | undefined {
    const state = this.agentStates.get(agentId);
    if (!state) return undefined;
    return {
      healthy: state.healthy,
      failureCount: state.failureCount,
    };
  }

  /**
   * Get all unhealthy agents
   */
  getUnhealthyAgents(): string[] {
    return Array.from(this.agentStates.entries())
      .filter(([_, health]) => !health.healthy)
      .map(([agentId, _]) => agentId);
  }

  /**
   * Get healthy agent count
   */
  getHealthyAgentCount(): number {
    return Array.from(this.agentStates.values())
      .filter(h => h.healthy).length;
  }

  /**
   * Update agent health
   */
  updateAgentHealth(agentId: string, healthy: boolean): void {
    const state = this.agentStates.get(agentId) || {
      healthy: true,
      failureCount: 0,
      consecutiveFailures: 0,
    };

    const wasHealthy = state.healthy;
    state.healthy = healthy;

    if (!healthy) {
      state.failureCount++;
      state.consecutiveFailures++;
      state.lastFailure = new Date();
      this.failureCounts.set(agentId, (this.failureCounts.get(agentId) || 0) + 1);
    } else {
      // Reset counts on successful health update
      state.failureCount = 0;
      state.consecutiveFailures = 0;
      state.lastSuccess = new Date();
      if (wasHealthy) {
        // Already healthy, no change
        this.agentStates.set(agentId, state);
        return;
      }
    }

    this.agentStates.set(agentId, state);

    // Emit recovery event if agent became healthy
    if (!wasHealthy && healthy) {
      this.emit('agent_health_changed', {
        agentId,
        healthy: true,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Get escalation policy for current state
   */
  getEscalationPolicy(): {
    currentState: string;
    conditions: Array<{ trigger: string; nextState: string }>;
  } {
    switch (this.currentState) {
      case A2AGatewayState.NORMAL:
        return {
          currentState: 'NORMAL',
          conditions: [
            {
              trigger: 'Circuit breaker opens',
              nextState: 'DEGRADED',
            },
          ],
        };

      case A2AGatewayState.DEGRADED:
        return {
          currentState: 'DEGRADED',
          conditions: [
            {
              trigger: 'Agent recovery',
              nextState: 'NORMAL',
            },
            {
              trigger: 'Multiple agent failures',
              nextState: 'FALLBACK',
            },
          ],
        };

      case A2AGatewayState.FALLBACK:
        return {
          currentState: 'FALLBACK',
          conditions: [
            {
              trigger: 'All fallbacks failed',
              nextState: 'CRITICAL',
            },
          ],
        };

      case A2AGatewayState.CRITICAL:
        return {
          currentState: 'CRITICAL',
          conditions: [
            {
              trigger: 'Manual intervention',
              nextState: 'NORMAL',
            },
          ],
        };

      default:
        return {
          currentState: 'UNKNOWN',
          conditions: [],
        };
    }
  }

  /**
   * Check if gateway can accept new requests
   */
  canAcceptRequests(): boolean {
    return this.currentState !== A2AGatewayState.CRITICAL;
  }

  /**
   * Get gateway health summary
   */
  getHealthSummary(): {
    totalAgents: number;
    healthyAgents: number;
    unhealthyAgents: number;
  } {
    const totalAgents = this.agentStates.size;
    const healthyAgents = this.getHealthyAgentCount();

    return {
      totalAgents,
      healthyAgents,
      unhealthyAgents: totalAgents - healthyAgents,
    };
  }

  // === Transition action handlers ===

  private handleCircuitBreakerOpened(event: GatewayEvent): void {
    console.warn(`[GatewayState] Circuit breaker opened - entering degraded mode: ${event.data.reason}`);
    // Kernel can subscribe to this event for custom handling
  }

  private handleAgentFailure(event: GatewayEvent): void {
    const agentId = event.agent_id;
    if (agentId) {
      this.updateAgentHealth(agentId, false);
      console.error(`[GatewayState] Agent ${agentId} failed - may enter degraded mode`);
    }
  }

  private handleAgentFailureInDegraded(event: GatewayEvent): void {
    const agentId = event.agent_id;
    if (agentId) {
      this.updateAgentHealth(agentId, false);
      console.error(`[GatewayState] Agent ${agentId} failed in degraded mode - entering fallback mode`);
    }

    // Check if too many unhealthy agents
    const unhealthyCount = this.getUnhealthyAgents().length;
    if (unhealthyCount >= this.fallbackThreshold) {
      console.error(`[GatewayState] ${unhealthyCount} unhealthy agents - entering fallback mode`);
    }
  }

  private handleFallbackTriggered(event: GatewayEvent): void {
    console.info(`[GatewayState] Fallback triggered: ${event.data.reason}`);
    console.info(`[GatewayState] Fallback metadata:`, event.data.metadata);
  }

  private handleAllFallbacksFailed(event: GatewayEvent): void {
    console.error(`[GatewayState] All fallback providers failed - entering critical state: ${event.data.reason}`);
    this.handleCriticalState();
  }

  private handleCriticalState(): void {
    console.error('[GatewayState] Gateway in CRITICAL state - aborting new requests');
    this.emit('critical_state_entered', {
      state: A2AGatewayState.CRITICAL,
      timestamp: new Date().toISOString(),
    });
  }

  private handleAgentRecovered(): void {
    console.info('[GatewayState] Agent recovered - returning to normal operation');
  }

  private handleCircuitBreakerClosed(): void {
    console.info('[GatewayState] Circuit breaker closed - returning to normal operation');
  }

  private handleAgentsHealthy(): void {
    console.info('[GatewayState] Agents recovering - moving from fallback to degraded');
  }

  /**
   * Emit state change to kernel event bus
   *
   * This is the integration point with the kernel state machine.
   * In a real implementation, this would emit to the kernel's event bus.
   */
  private emitStateChangeToKernel(newState: string, event: GatewayEvent): void {
    this.emit('kernel_event', {
      source: 'a2a-gateway',
      event_type: event.type,
      timestamp: new Date().toISOString(),
      agent_id: event.agent_id,
      data: event.data,
    });
  }

  /**
   * Reset state machine (for testing)
   */
  reset(): void {
    this.currentState = A2AGatewayState.NORMAL;
    this.agentStates.clear();
    this.failureCounts.clear();
    this.transitionHistory = [];
  }

  /**
   * Manual recovery from critical state
   */
  manualRecovery(): void {
    this.currentState = A2AGatewayState.NORMAL;
  }

  /**
   * Get default reason message for event type
   */
  private getDefaultReasonForEvent(eventType: GatewayEventType): string {
    switch (eventType) {
      case GatewayEventType.CIRCUIT_BREAKER_OPENED:
        return 'Circuit breaker opened';
      case GatewayEventType.CIRCUIT_BREAKER_CLOSED:
        return 'Circuit breaker closed';
      case GatewayEventType.AGENT_FAILURE:
        return 'Agent failure';
      case GatewayEventType.AGENT_RECOVERED:
        return 'Agent recovered';
      case GatewayEventType.FALLBACK_TRIGGERED:
        return 'Fallback triggered';
      case GatewayEventType.FALLBACK_FAILED:
        return 'Fallback failed';
      default:
        return 'State transition';
    }
  }
}
