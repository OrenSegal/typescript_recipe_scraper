/**
 * Circuit Breaker Pattern
 * Prevents cascading failures when external services are down
 *
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Too many failures, reject requests immediately
 * - HALF_OPEN: Testing if service recovered
 */

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerConfig {
  failureThreshold: number;     // Failures before opening circuit
  successThreshold: number;      // Successes to close circuit from half-open
  timeout: number;               // Time to wait before half-open (ms)
  monitoringPeriod: number;      // Period to count failures (ms)
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failures: number;
  successes: number;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  lastFailureTime: Date | null;
  lastSuccessTime: Date | null;
  totalRequests: number;
  totalFailures: number;
  totalSuccesses: number;
}

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failures: number[] = []; // Timestamps of failures
  private consecutiveFailures = 0;
  private consecutiveSuccesses = 0;
  private lastFailureTime: Date | null = null;
  private lastSuccessTime: Date | null = null;
  private totalRequests = 0;
  private totalFailures = 0;
  private totalSuccesses = 0;
  private openedAt: number | null = null;

  private readonly config: CircuitBreakerConfig;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = {
      failureThreshold: config.failureThreshold || 5,
      successThreshold: config.successThreshold || 2,
      timeout: config.timeout || 60000, // 1 minute
      monitoringPeriod: config.monitoringPeriod || 60000 // 1 minute
    };
  }

  /**
   * Execute function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>, fallback?: () => Promise<T>): Promise<T> {
    this.totalRequests++;

    // Check if circuit should transition from OPEN to HALF_OPEN
    if (this.state === 'OPEN') {
      if (this.shouldAttemptReset()) {
        console.log('🔄 Circuit breaker transitioning to HALF_OPEN');
        this.state = 'HALF_OPEN';
      } else {
        // Circuit still open, fast fail
        if (fallback) {
          console.log('⚡ Circuit OPEN, using fallback');
          return await fallback();
        }
        throw new Error(`Circuit breaker is OPEN. Service unavailable.`);
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();

      if (fallback) {
        console.log('⚡ Execution failed, using fallback');
        return await fallback();
      }

      throw error;
    }
  }

  /**
   * Record successful execution
   */
  private onSuccess(): void {
    this.totalSuccesses++;
    this.consecutiveSuccesses++;
    this.consecutiveFailures = 0;
    this.lastSuccessTime = new Date();

    // Clean old failures outside monitoring period
    this.cleanOldFailures();

    // Transition from HALF_OPEN to CLOSED
    if (this.state === 'HALF_OPEN') {
      if (this.consecutiveSuccesses >= this.config.successThreshold) {
        console.log('✅ Circuit breaker CLOSED after successful recovery');
        this.state = 'CLOSED';
        this.failures = [];
        this.consecutiveSuccesses = 0;
      }
    }
  }

  /**
   * Record failed execution
   */
  private onFailure(): void {
    this.totalFailures++;
    this.consecutiveFailures++;
    this.consecutiveSuccesses = 0;
    this.lastFailureTime = new Date();
    this.failures.push(Date.now());

    // Clean old failures
    this.cleanOldFailures();

    // Transition to OPEN if threshold exceeded
    if (this.state === 'CLOSED' || this.state === 'HALF_OPEN') {
      if (this.failures.length >= this.config.failureThreshold) {
        console.log(`🚨 Circuit breaker OPENED after ${this.failures.length} failures`);
        this.state = 'OPEN';
        this.openedAt = Date.now();
      }
    }
  }

  /**
   * Remove failures outside monitoring period
   */
  private cleanOldFailures(): void {
    const cutoff = Date.now() - this.config.monitoringPeriod;
    this.failures = this.failures.filter(timestamp => timestamp > cutoff);
  }

  /**
   * Check if enough time has passed to attempt reset
   */
  private shouldAttemptReset(): boolean {
    if (!this.openedAt) return false;
    return Date.now() - this.openedAt >= this.config.timeout;
  }

  /**
   * Manually open circuit (for testing/maintenance)
   */
  open(): void {
    this.state = 'OPEN';
    this.openedAt = Date.now();
    console.log('⚠️ Circuit breaker manually opened');
  }

  /**
   * Manually close circuit (force recovery)
   */
  close(): void {
    this.state = 'CLOSED';
    this.failures = [];
    this.consecutiveFailures = 0;
    this.consecutiveSuccesses = 0;
    this.openedAt = null;
    console.log('✅ Circuit breaker manually closed');
  }

  /**
   * Get current statistics
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failures: this.failures.length,
      successes: this.consecutiveSuccesses,
      consecutiveFailures: this.consecutiveFailures,
      consecutiveSuccesses: this.consecutiveSuccesses,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      totalRequests: this.totalRequests,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses
    };
  }

  /**
   * Get success rate
   */
  getSuccessRate(): number {
    if (this.totalRequests === 0) return 100;
    return (this.totalSuccesses / this.totalRequests) * 100;
  }

  /**
   * Check if circuit is open
   */
  isOpen(): boolean {
    return this.state === 'OPEN';
  }
}

/**
 * Circuit Breaker Manager for multiple services
 */
export class CircuitBreakerManager {
  private breakers = new Map<string, CircuitBreaker>();

  /**
   * Get or create circuit breaker for service
   */
  getBreaker(serviceName: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
    if (!this.breakers.has(serviceName)) {
      this.breakers.set(serviceName, new CircuitBreaker(config));
    }
    return this.breakers.get(serviceName)!;
  }

  /**
   * Execute with named circuit breaker
   */
  async execute<T>(
    serviceName: string,
    fn: () => Promise<T>,
    fallback?: () => Promise<T>
  ): Promise<T> {
    const breaker = this.getBreaker(serviceName);
    return breaker.execute(fn, fallback);
  }

  /**
   * Get stats for all breakers
   */
  getAllStats(): Record<string, CircuitBreakerStats> {
    const stats: Record<string, CircuitBreakerStats> = {};
    this.breakers.forEach((breaker, name) => {
      stats[name] = breaker.getStats();
    });
    return stats;
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    this.breakers.forEach((breaker) => breaker.close());
  }
}

// Export singleton instance
export const circuitBreakerManager = new CircuitBreakerManager();
