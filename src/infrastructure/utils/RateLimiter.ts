/**
 * Advanced Rate Limiter with exponential backoff, jitter, and per-domain tracking
 * Implements SOLID principles with configurable strategies
 */

import { EventEmitter } from 'events';

interface RateLimitConfig {
  requestsPerSecond?: number;
  requestsPerMinute?: number;
  burstSize?: number;
  retryAfter?: number;
  backoffMultiplier?: number;
  maxBackoff?: number;
  jitterRange?: number;
}

interface DomainStats {
  requests: number;
  lastRequest: number;
  errors: number;
  backoffUntil: number;
  successRate: number;
}

export class RateLimiter extends EventEmitter {
  private domainQueues: Map<string, Array<() => Promise<any>>> = new Map();
  private domainStats: Map<string, DomainStats> = new Map();
  private domainConfigs: Map<string, RateLimitConfig> = new Map();
  private processing: Set<string> = new Set();
  
  private defaultConfig: RateLimitConfig = {
    requestsPerSecond: 2,
    requestsPerMinute: 50,
    burstSize: 5,
    retryAfter: 1000,
    backoffMultiplier: 2,
    maxBackoff: 60000,
    jitterRange: 0.3
  };

  constructor() {
    super();
    // Special configurations for known problematic sites
    this.domainConfigs.set('www.tasteofhome.com', {
      requestsPerSecond: 0.5,
      requestsPerMinute: 20,
      backoffMultiplier: 3,
      maxBackoff: 120000
    });
    
    this.domainConfigs.set('pinchofyum.com', {
      requestsPerSecond: 1,
      requestsPerMinute: 30,
      backoffMultiplier: 2.5
    });
    
    this.domainConfigs.set('food52.com', {
      requestsPerSecond: 0.8,
      requestsPerMinute: 25
    });
  }

  /**
   * Queue a request with automatic rate limiting and retry logic
   */
  async queueRequest<T>(
    domain: string,
    requestFn: () => Promise<T>,
    retries: number = 3
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const queue = this.domainQueues.get(domain) || [];
      
      const wrappedRequest = async () => {
        let lastError: any;
        
        for (let attempt = 0; attempt <= retries; attempt++) {
          try {
            // Check if we're in backoff period
            const stats = this.domainStats.get(domain);
            if (stats && stats.backoffUntil > Date.now()) {
              const waitTime = stats.backoffUntil - Date.now();
              this.emit('backoff', { domain, waitTime, attempt });
              await this.sleep(waitTime);
            }
            
            // Apply rate limiting
            await this.waitForRateLimit(domain);
            
            // Execute request
            const result = await requestFn();
            
            // Update success stats
            this.updateStats(domain, true);
            
            resolve(result);
            return result;
          } catch (error: any) {
            lastError = error;
            
            // Handle rate limit errors
            if (error.status === 429 || error.message?.includes('429')) {
              this.handleRateLimitError(domain, error);
              this.emit('rateLimit', { domain, attempt, error });
            } else if (error.status === 403) {
              // Forbidden - apply longer backoff
              this.applyBackoff(domain, 30000);
              this.emit('forbidden', { domain, attempt, error });
            } else {
              this.updateStats(domain, false);
            }
            
            if (attempt < retries) {
              const backoff = this.calculateBackoff(attempt, domain);
              this.emit('retry', { domain, attempt, backoff, error });
              await this.sleep(backoff);
            }
          }
        }
        
        reject(lastError);
      };
      
      queue.push(wrappedRequest);
      this.domainQueues.set(domain, queue);
      
      // Process queue if not already processing
      if (!this.processing.has(domain)) {
        this.processQueue(domain);
      }
    });
  }

  /**
   * Process queued requests for a domain
   */
  private async processQueue(domain: string): Promise<void> {
    if (this.processing.has(domain)) return;
    
    this.processing.add(domain);
    const queue = this.domainQueues.get(domain) || [];
    
    while (queue.length > 0) {
      const request = queue.shift();
      if (request) {
        try {
          await request();
        } catch (error) {
          this.emit('error', { domain, error });
        }
      }
    }
    
    this.processing.delete(domain);
  }

  /**
   * Wait for rate limit window
   */
  private async waitForRateLimit(domain: string): Promise<void> {
    const config = this.domainConfigs.get(domain) || this.defaultConfig;
    const stats = this.domainStats.get(domain) || this.initStats(domain);
    
    const now = Date.now();
    const timeSinceLastRequest = now - stats.lastRequest;
    const minInterval = 1000 / (config.requestsPerSecond || 2);
    
    if (timeSinceLastRequest < minInterval) {
      const waitTime = minInterval - timeSinceLastRequest;
      await this.sleep(waitTime);
    }
    
    stats.lastRequest = Date.now();
    this.domainStats.set(domain, stats);
  }

  /**
   * Calculate exponential backoff with jitter
   */
  private calculateBackoff(attempt: number, domain: string): number {
    const config = this.domainConfigs.get(domain) || this.defaultConfig;
    const baseBackoff = config.retryAfter || 1000;
    const multiplier = config.backoffMultiplier || 2;
    const maxBackoff = config.maxBackoff || 60000;
    const jitterRange = config.jitterRange || 0.3;
    
    let backoff = Math.min(baseBackoff * Math.pow(multiplier, attempt), maxBackoff);
    
    // Add jitter to prevent thundering herd
    const jitter = backoff * jitterRange * (Math.random() - 0.5);
    backoff += jitter;
    
    return Math.max(backoff, 100);
  }

  /**
   * Handle rate limit errors
   */
  private handleRateLimitError(domain: string, error: any): void {
    const retryAfter = this.parseRetryAfter(error);
    this.applyBackoff(domain, retryAfter || 60000);
  }

  /**
   * Parse Retry-After header
   */
  private parseRetryAfter(error: any): number | null {
    const retryAfter = error.headers?.['retry-after'];
    if (!retryAfter) return null;
    
    // Handle seconds or HTTP date
    const seconds = parseInt(retryAfter);
    if (!isNaN(seconds)) {
      return seconds * 1000;
    }
    
    const date = new Date(retryAfter);
    if (!isNaN(date.getTime())) {
      return Math.max(date.getTime() - Date.now(), 0);
    }
    
    return null;
  }

  /**
   * Apply backoff to domain
   */
  private applyBackoff(domain: string, duration: number): void {
    const stats = this.domainStats.get(domain) || this.initStats(domain);
    stats.backoffUntil = Date.now() + duration;
    this.domainStats.set(domain, stats);
  }

  /**
   * Initialize stats for domain
   */
  private initStats(domain: string): DomainStats {
    return {
      requests: 0,
      lastRequest: 0,
      errors: 0,
      backoffUntil: 0,
      successRate: 1.0
    };
  }

  /**
   * Update domain statistics
   */
  private updateStats(domain: string, success: boolean): void {
    const stats = this.domainStats.get(domain) || this.initStats(domain);
    stats.requests++;
    
    if (!success) {
      stats.errors++;
    }
    
    stats.successRate = (stats.requests - stats.errors) / stats.requests;
    this.domainStats.set(domain, stats);
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current stats for monitoring
   */
  getStats(): Map<string, DomainStats> {
    return new Map(this.domainStats);
  }

  /**
   * Reset stats for a domain
   */
  resetDomain(domain: string): void {
    this.domainStats.delete(domain);
    this.domainQueues.delete(domain);
    this.processing.delete(domain);
  }

  /**
   * Update configuration for a domain
   */
  updateDomainConfig(domain: string, config: RateLimitConfig): void {
    this.domainConfigs.set(domain, { ...this.defaultConfig, ...config });
  }
}
