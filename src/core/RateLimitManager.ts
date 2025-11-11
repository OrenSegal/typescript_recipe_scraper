/**
 * Enterprise Intelligent Rate Limiting Manager
 * Implements adaptive rate limiting with domain-specific throttling and anti-bot evasion
 */

import { EnterpriseConfig } from '../infrastructure/EnterpriseConfig.js';

export interface RateLimitInfo {
  domain: string;
  requestsPerSecond: number;
  burstCapacity: number;
  currentBurst: number;
  lastRequest: Date;
  adaptiveMultiplier: number;
  consecutiveErrors: number;
  backoffUntil?: Date;
}

export interface ThrottleRequest {
  domain: string;
  url: string;
  priority?: number; // Higher priority = faster processing
  retryCount?: number;
}

export interface RateLimitStats {
  totalRequests: number;
  throttledRequests: number;
  averageWaitTime: number;
  domainsTracked: number;
  adaptiveAdjustments: number;
  backoffEvents: number;
}

/**
 * Intelligent rate limiting with adaptive throttling based on server responses
 * and domain-specific rate limits for respectful scraping
 */
export class RateLimitManager {
  private config: EnterpriseConfig;
  private domainLimits = new Map<string, RateLimitInfo>();
  private requestQueue: Array<{ resolve: () => void; domain: string; timestamp: Date }> = [];
  private stats: RateLimitStats;

  // Domain-specific rate limits (requests per second)
  private defaultDomainLimits = new Map<string, number>([
    // Conservative limits for major recipe sites
    ['allrecipes.com', 0.5],
    ['food.com', 0.5],
    ['foodnetwork.com', 0.3],
    ['bon-appetit.com', 0.3],
    ['epicurious.com', 0.3],
    ['seriouseats.com', 0.5],
    ['tasteofhome.com', 0.5],
    ['delish.com', 0.4],
    ['foodandwine.com', 0.3],
    ['myrecipes.com', 0.4],
    
    // More permissive for smaller sites
    ['default', 1.0]
  ]);

  // Response codes that trigger adaptive throttling
  private throttleTriggers = new Set([
    429, // Too Many Requests
    503, // Service Unavailable
    502, // Bad Gateway
    403, // Forbidden (might be rate limiting)
  ]);

  constructor(config: EnterpriseConfig) {
    this.config = config;
    this.stats = {
      totalRequests: 0,
      throttledRequests: 0,
      averageWaitTime: 0,
      domainsTracked: 0,
      adaptiveAdjustments: 0,
      backoffEvents: 0
    };

    // Start cleanup interval for old domain data
    setInterval(() => this.cleanupOldDomains(), 300000); // 5 minutes
  }

  /**
   * Wait for permission to make a request to a specific URL
   */
  async waitForSlot(url: string, priority = 5): Promise<void> {
    if (!this.config.rateLimiting.enabled) return;

    const domain = this.extractDomain(url);
    const startTime = Date.now();
    this.stats.totalRequests++;

    const limitInfo = this.getDomainLimitInfo(domain);

    // Check if domain is in backoff period
    if (limitInfo.backoffUntil && new Date() < limitInfo.backoffUntil) {
      const waitTime = limitInfo.backoffUntil.getTime() - Date.now();
      if (waitTime > 0) {
        this.stats.throttledRequests++;
        await this.sleep(waitTime);
      }
    }

    // Calculate required wait time based on rate limits
    const requiredWait = this.calculateWaitTime(limitInfo, priority);
    
    if (requiredWait > 0) {
      this.stats.throttledRequests++;
      await this.sleep(requiredWait);
    }

    // Update tracking info
    this.updateDomainTracking(domain, limitInfo);
    this.updateAverageWaitTime(Date.now() - startTime);
  }

  /**
   * Report response status to enable adaptive rate limiting
   */
  reportResponse(url: string, statusCode: number, responseTime?: number): void {
    if (!this.config.rateLimiting.adaptiveThrottling) return;

    const domain = this.extractDomain(url);
    const limitInfo = this.getDomainLimitInfo(domain);

    if (this.throttleTriggers.has(statusCode)) {
      this.handleThrottleResponse(domain, limitInfo, statusCode);
    } else if (statusCode >= 200 && statusCode < 300) {
      this.handleSuccessResponse(domain, limitInfo, responseTime);
    } else if (statusCode >= 400) {
      this.handleErrorResponse(domain, limitInfo, statusCode);
    }
  }

  /**
   * Get current rate limit info for a domain
   */
  getDomainInfo(url: string): RateLimitInfo {
    const domain = this.extractDomain(url);
    return this.getDomainLimitInfo(domain);
  }

  /**
   * Manually adjust rate limit for a domain
   */
  setDomainLimit(domain: string, requestsPerSecond: number): void {
    const limitInfo = this.getDomainLimitInfo(domain);
    limitInfo.requestsPerSecond = requestsPerSecond;
    limitInfo.adaptiveMultiplier = 1.0;
    
    console.log(`[RATE-LIMIT] Manual override for ${domain}: ${requestsPerSecond} req/s`);
  }

  /**
   * Extract domain from URL
   */
  private extractDomain(url: string): string {
    try {
      return new URL(url).hostname.toLowerCase();
    } catch {
      return 'invalid-domain';
    }
  }

  /**
   * Get or create domain limit info
   */
  private getDomainLimitInfo(domain: string): RateLimitInfo {
    if (!this.domainLimits.has(domain)) {
      const defaultRate = this.defaultDomainLimits.get(domain) || 
                         this.defaultDomainLimits.get('default') || 
                         this.config.rateLimiting.requestsPerSecond;

      const limitInfo: RateLimitInfo = {
        domain,
        requestsPerSecond: defaultRate,
        burstCapacity: this.config.rateLimiting.burstSize,
        currentBurst: this.config.rateLimiting.burstSize,
        lastRequest: new Date(0),
        adaptiveMultiplier: 1.0,
        consecutiveErrors: 0
      };

      this.domainLimits.set(domain, limitInfo);
      this.stats.domainsTracked++;
    }

    return this.domainLimits.get(domain)!;
  }

  /**
   * Calculate wait time based on current rate limits and burst capacity
   */
  private calculateWaitTime(limitInfo: RateLimitInfo, priority: number): number {
    const now = Date.now();
    const timeSinceLastRequest = now - limitInfo.lastRequest.getTime();
    
    // Calculate effective rate with adaptive multiplier
    const effectiveRate = limitInfo.requestsPerSecond * limitInfo.adaptiveMultiplier;
    const minInterval = 1000 / effectiveRate; // milliseconds between requests

    // Priority adjustment (higher priority = less wait time)
    const priorityMultiplier = Math.max(0.1, 1.0 - (priority - 5) * 0.1);
    const adjustedInterval = minInterval * priorityMultiplier;

    // Check burst capacity
    if (limitInfo.currentBurst > 0 && timeSinceLastRequest > adjustedInterval) {
      // Can use burst capacity
      return 0;
    }

    // Calculate required wait time
    const requiredWait = Math.max(0, adjustedInterval - timeSinceLastRequest);
    
    // Add jitter for human-like behavior if evasion is enabled
    if (this.config.evasion.simulateHumanBehavior && requiredWait > 0) {
      const jitter = Math.random() * requiredWait * 0.2; // ±20% jitter
      return requiredWait + (Math.random() > 0.5 ? jitter : -jitter);
    }

    return requiredWait;
  }

  /**
   * Update domain tracking after request
   */
  private updateDomainTracking(domain: string, limitInfo: RateLimitInfo): void {
    const now = new Date();
    const timeSinceLastRequest = now.getTime() - limitInfo.lastRequest.getTime();
    
    // Regenerate burst capacity based on time elapsed
    const burstRegen = Math.floor(timeSinceLastRequest / 1000 * limitInfo.requestsPerSecond);
    limitInfo.currentBurst = Math.min(
      limitInfo.burstCapacity,
      limitInfo.currentBurst + burstRegen
    );

    // Consume burst capacity if available
    if (limitInfo.currentBurst > 0) {
      limitInfo.currentBurst--;
    }

    limitInfo.lastRequest = now;
  }

  /**
   * Handle throttle response (429, 503, etc.)
   */
  private handleThrottleResponse(domain: string, limitInfo: RateLimitInfo, statusCode: number): void {
    this.stats.adaptiveAdjustments++;
    
    // Reduce rate aggressively
    limitInfo.adaptiveMultiplier *= 0.5; // Halve the rate
    limitInfo.consecutiveErrors++;

    // Implement exponential backoff for repeated throttling
    if (statusCode === 429 || limitInfo.consecutiveErrors >= 3) {
      const backoffMs = Math.min(
        300000, // Max 5 minutes
        1000 * Math.pow(2, limitInfo.consecutiveErrors - 1)
      );
      
      limitInfo.backoffUntil = new Date(Date.now() + backoffMs);
      this.stats.backoffEvents++;
      
      console.log(`[RATE-LIMIT] Backoff for ${domain}: ${backoffMs}ms (errors: ${limitInfo.consecutiveErrors})`);
    }

    console.log(`[RATE-LIMIT] Throttled by ${domain} (${statusCode}). New rate: ${(limitInfo.requestsPerSecond * limitInfo.adaptiveMultiplier).toFixed(2)} req/s`);
  }

  /**
   * Handle successful response
   */
  private handleSuccessResponse(domain: string, limitInfo: RateLimitInfo, responseTime?: number): void {
    // Reset error count on success
    limitInfo.consecutiveErrors = 0;
    limitInfo.backoffUntil = undefined;

    // Gradually increase rate if we've been throttled
    if (limitInfo.adaptiveMultiplier < 1.0) {
      limitInfo.adaptiveMultiplier = Math.min(1.0, limitInfo.adaptiveMultiplier * 1.1);
    }

    // Further optimize based on response time if available
    if (responseTime && this.config.rateLimiting.adaptiveThrottling) {
      if (responseTime < 1000) { // Fast response
        limitInfo.adaptiveMultiplier = Math.min(1.2, limitInfo.adaptiveMultiplier * 1.05);
      } else if (responseTime > 5000) { // Slow response
        limitInfo.adaptiveMultiplier = Math.max(0.5, limitInfo.adaptiveMultiplier * 0.95);
      }
    }
  }

  /**
   * Handle error response
   */
  private handleErrorResponse(domain: string, limitInfo: RateLimitInfo, statusCode: number): void {
    limitInfo.consecutiveErrors++;

    // Be more conservative on errors
    if (limitInfo.consecutiveErrors >= 2) {
      limitInfo.adaptiveMultiplier = Math.max(0.1, limitInfo.adaptiveMultiplier * 0.8);
      console.log(`[RATE-LIMIT] Error throttling for ${domain} (${statusCode}). New rate: ${(limitInfo.requestsPerSecond * limitInfo.adaptiveMultiplier).toFixed(2)} req/s`);
    }
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Update average wait time statistic
   */
  private updateAverageWaitTime(waitTime: number): void {
    const totalWaitTime = this.stats.averageWaitTime * (this.stats.totalRequests - 1);
    this.stats.averageWaitTime = (totalWaitTime + waitTime) / this.stats.totalRequests;
  }

  /**
   * Clean up old domain data to prevent memory leaks
   */
  private cleanupOldDomains(): void {
    const cutoffTime = Date.now() - 3600000; // 1 hour ago
    
    for (const [domain, limitInfo] of this.domainLimits.entries()) {
      if (limitInfo.lastRequest.getTime() < cutoffTime) {
        this.domainLimits.delete(domain);
        this.stats.domainsTracked--;
      }
    }
  }

  /**
   * Get current rate limiting statistics
   */
  getStats(): RateLimitStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalRequests: 0,
      throttledRequests: 0,
      averageWaitTime: 0,
      domainsTracked: this.domainLimits.size,
      adaptiveAdjustments: 0,
      backoffEvents: 0
    };
  }

  /**
   * Get domain-specific rate limiting report
   */
  generateRateLimitReport(): string {
    const domains = Array.from(this.domainLimits.values())
      .sort((a, b) => b.lastRequest.getTime() - a.lastRequest.getTime())
      .slice(0, 20); // Top 20 most recent

    const report = `
ENTERPRISE RATE LIMITING REPORT
===============================
Total Requests Processed: ${this.stats.totalRequests}
Throttled Requests: ${this.stats.throttledRequests} (${((this.stats.throttledRequests/this.stats.totalRequests)*100).toFixed(1)}%)
Average Wait Time: ${this.stats.averageWaitTime.toFixed(0)}ms
Domains Tracked: ${this.stats.domainsTracked}
Adaptive Adjustments: ${this.stats.adaptiveAdjustments}
Backoff Events: ${this.stats.backoffEvents}

DOMAIN-SPECIFIC LIMITS:
${domains.map(limit => {
  const effectiveRate = limit.requestsPerSecond * limit.adaptiveMultiplier;
  const status = limit.backoffUntil && new Date() < limit.backoffUntil ? 'BACKOFF' : 
                limit.consecutiveErrors > 0 ? 'THROTTLED' : 'NORMAL';
  
  return `${limit.domain.padEnd(25)} | ${effectiveRate.toFixed(2)} req/s | ${status} | Errors: ${limit.consecutiveErrors}`;
}).join('\n')}

CONFIGURATION:
- Rate Limiting Enabled: ${this.config.rateLimiting.enabled}
- Adaptive Throttling: ${this.config.rateLimiting.adaptiveThrottling}
- Base Rate: ${this.config.rateLimiting.requestsPerSecond} req/s
- Burst Size: ${this.config.rateLimiting.burstSize}
- Human Behavior Simulation: ${this.config.evasion.simulateHumanBehavior}

Generated: ${new Date().toISOString()}
    `.trim();

    return report;
  }

  /**
   * Emergency throttle - immediately slow down all domains
   */
  emergencyThrottle(multiplier = 0.1): void {
    console.log(`[RATE-LIMIT] EMERGENCY THROTTLE: Reducing all rates by ${(1-multiplier)*100}%`);
    
    for (const limitInfo of this.domainLimits.values()) {
      limitInfo.adaptiveMultiplier = Math.min(limitInfo.adaptiveMultiplier, multiplier);
    }
    
    this.stats.adaptiveAdjustments++;
  }

  /**
   * Restore normal rates after emergency throttle
   */
  restoreNormalRates(): void {
    console.log('[RATE-LIMIT] Restoring normal rates');
    
    for (const limitInfo of this.domainLimits.values()) {
      limitInfo.adaptiveMultiplier = 1.0;
      limitInfo.consecutiveErrors = 0;
      limitInfo.backoffUntil = undefined;
    }
  }
}
