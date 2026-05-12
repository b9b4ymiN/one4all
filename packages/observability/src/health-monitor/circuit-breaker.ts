/**
 * Circuit Breaker Implementation
 *
 * Implements the circuit breaker pattern for automatic failover
 */

import type {
  CircuitState,
  CircuitBreakerConfig,
  CircuitBreakerState as CBState,
  Provider,
} from './types.js';

/**
 * Circuit Breaker class
 */
export class CircuitBreaker {
  private config: CircuitBreakerConfig;
  private state: CBState;
  private provider: Provider;

  constructor(provider: Provider, config: CircuitBreakerConfig) {
    this.provider = provider;
    this.config = config;
    this.state = {
      state: 'closed' as CircuitState,
      failureCount: 0,
      successCount: 0,
    };
  }

  /**
   * Record a success
   */
  recordSuccess(): void {
    this.state.lastSuccessTime = new Date();
    this.state.successCount++;

    if (this.state.state === 'half_open') {
      if (this.state.successCount >= this.config.successThreshold) {
        this.close();
      }
    } else if (this.state.state === 'closed') {
      // Reset failure count on success in closed state
      this.state.failureCount = 0;
    }
  }

  /**
   * Record a failure
   */
  recordFailure(): void {
    this.state.lastFailureTime = new Date();
    this.state.failureCount++;
    this.state.successCount = 0;

    if (this.state.state === 'half_open') {
      this.open();
    } else if (this.state.state === 'closed') {
      if (this.state.failureCount >= this.config.failureThreshold) {
        this.open();
      }
    }
  }

  /**
   * Check if a request should be allowed
   */
  allowRequest(): boolean {
    if (this.state.state === 'open') {
      // Check if we should transition to half-open
      if (this.state.openedAt) {
        const timeSinceOpen = Date.now() - this.state.openedAt.getTime();
        if (timeSinceOpen >= this.config.timeout) {
          this.halfOpen();
          return true;
        }
      }
      return false;
    }

    return true;
  }

  /**
   * Open the circuit (block requests)
   */
  private open(): void {
    this.state.state = 'open' as CircuitState;
    this.state.openedAt = new Date();
  }

  /**
   * Close the circuit (normal operation)
   */
  private close(): void {
    this.state.state = 'closed' as CircuitState;
    this.state.failureCount = 0;
    this.state.successCount = 0;
    this.state.openedAt = undefined;
  }

  /**
   * Move to half-open state (testing recovery)
   */
  private halfOpen(): void {
    this.state.state = 'half_open' as CircuitState;
    this.state.successCount = 0;
  }

  /**
   * Get current state
   */
  getState(): CBState {
    return { ...this.state };
  }

  /**
   * Get provider
   */
  getProvider(): Provider {
    return this.provider;
  }

  /**
   * Reset the circuit breaker
   */
  reset(): void {
    this.state = {
      state: 'closed' as CircuitState,
      failureCount: 0,
      successCount: 0,
    };
  }

  /**
   * Manually open the circuit
   */
  manualOpen(): void {
    this.open();
  }

  /**
   * Manually close the circuit
   */
  manualClose(): void {
    this.close();
  }
}

/**
 * Circuit Breaker Registry
 *
 * Manages circuit breakers for all providers
 */
export class CircuitBreakerRegistry {
  private breakers: Map<Provider, CircuitBreaker> = new Map();
  private defaultConfig: CircuitBreakerConfig;

  constructor(defaultConfig: CircuitBreakerConfig) {
    this.defaultConfig = defaultConfig;
  }

  /**
   * Get or create circuit breaker for provider
   */
  getBreaker(provider: Provider): CircuitBreaker {
    let breaker = this.breakers.get(provider);
    if (!breaker) {
      breaker = new CircuitBreaker(provider, this.defaultConfig);
      this.breakers.set(provider, breaker);
    }
    return breaker;
  }

  /**
   * Check if request is allowed for provider
   */
  allowRequest(provider: Provider): boolean {
    const breaker = this.getBreaker(provider);
    return breaker.allowRequest();
  }

  /**
   * Record success for provider
   */
  recordSuccess(provider: Provider): void {
    const breaker = this.getBreaker(provider);
    breaker.recordSuccess();
  }

  /**
   * Record failure for provider
   */
  recordFailure(provider: Provider): void {
    const breaker = this.getBreaker(provider);
    breaker.recordFailure();
  }

  /**
   * Get all circuit breaker states
   */
  getAllStates(): Map<Provider, CBState> {
    const states = new Map<Provider, CBState>();
    for (const [provider, breaker] of this.breakers.entries()) {
      states.set(provider, breaker.getState());
    }
    return states;
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
  }
}
