/**
 * Enterprise Real-time Error Adaptation Manager
 * Automatically adapts scraping strategies based on encountered errors and failures
 */

import { EnterpriseConfig } from '../infrastructure/EnterpriseConfig.js';

export interface ErrorPattern {
  type: 'http_error' | 'parsing_error' | 'timeout' | 'rate_limit' | 'bot_detection' | 'content_change';
  statusCode?: number;
  message: string;
  domain: string;
  url: string;
  timestamp: Date;
  userAgent?: string;
  responseTime?: number;
}

export interface AdaptationStrategy {
  id: string;
  name: string;
  description: string;
  conditions: (error: ErrorPattern) => boolean;
  actions: Array<{
    type: 'retry' | 'user_agent_rotation' | 'delay_increase' | 'proxy_rotation' | 'fallback_method' | 'skip_domain';
    parameters: Record<string, any>;
  }>;
  priority: number;
  successRate: number;
  lastUsed: Date;
}

export interface ErrorAnalysis {
  domain: string;
  errorFrequency: number;
  commonErrors: Array<{ type: string; count: number; percentage: number }>;
  recommendedActions: string[];
  adaptationHistory: Array<{
    strategy: string;
    appliedAt: Date;
    success: boolean;
    impact: string;
  }>;
}

export interface RecoveryMetrics {
  totalErrors: number;
  recoveredErrors: number;
  adaptationStrategiesApplied: number;
  averageRecoveryTime: number;
  successfulAdaptations: number;
  failedAdaptations: number;
}

/**
 * Intelligent error adaptation system that learns from failures and automatically
 * adjusts scraping strategies to improve success rates
 */
export class ErrorAdaptationManager {
  private config: EnterpriseConfig;
  private errorHistory = new Map<string, ErrorPattern[]>(); // domain -> errors
  private adaptationStrategies: AdaptationStrategy[] = [];
  private recoveryMetrics: RecoveryMetrics;
  private domainBlacklist = new Set<string>();
  private readonly maxErrorHistory = 1000;
  private readonly analysisWindowHours = 24;

  constructor(config: EnterpriseConfig) {
    this.config = config;
    this.recoveryMetrics = {
      totalErrors: 0,
      recoveredErrors: 0,
      adaptationStrategiesApplied: 0,
      averageRecoveryTime: 0,
      successfulAdaptations: 0,
      failedAdaptations: 0
    };

    this.initializeAdaptationStrategies();
    
    // Cleanup old errors periodically
    setInterval(() => this.cleanupOldErrors(), 3600000); // Every hour
  }

  /**
   * Report an error and get recommended adaptation strategy
   */
  async reportError(error: ErrorPattern): Promise<{
    shouldRetry: boolean;
    adaptationStrategy?: AdaptationStrategy;
    waitTime?: number;
    skipDomain?: boolean;
  }> {
    this.recoveryMetrics.totalErrors++;
    
    // Store error in history
    this.storeError(error);

    // Check if domain should be blacklisted
    if (this.shouldBlacklistDomain(error.domain)) {
      this.domainBlacklist.add(error.domain);
      console.log(`[ERROR-ADAPTATION] Domain blacklisted: ${error.domain}`);
      return { shouldRetry: false, skipDomain: true };
    }

    // Find appropriate adaptation strategy
    const strategy = this.findBestAdaptationStrategy(error);
    
    if (strategy) {
      this.recoveryMetrics.adaptationStrategiesApplied++;
      strategy.lastUsed = new Date();
      
      console.log(`[ERROR-ADAPTATION] Applying strategy "${strategy.name}" for ${error.domain}`);
      
      // Calculate retry wait time based on strategy
      const waitTime = this.calculateRetryWaitTime(error, strategy);
      
      return {
        shouldRetry: true,
        adaptationStrategy: strategy,
        waitTime
      };
    }

    // No suitable strategy found
    return { shouldRetry: false };
  }

  /**
   * Report successful recovery after applying an adaptation strategy
   */
  reportRecoverySuccess(domain: string, strategyId: string, recoveryTime: number): void {
    this.recoveryMetrics.recoveredErrors++;
    this.recoveryMetrics.successfulAdaptations++;
    
    // Update average recovery time
    const totalRecoveryTime = this.recoveryMetrics.averageRecoveryTime * (this.recoveryMetrics.recoveredErrors - 1);
    this.recoveryMetrics.averageRecoveryTime = (totalRecoveryTime + recoveryTime) / this.recoveryMetrics.recoveredErrors;

    // Update strategy success rate
    const strategy = this.adaptationStrategies.find(s => s.id === strategyId);
    if (strategy) {
      strategy.successRate = Math.min(1.0, strategy.successRate + 0.1);
      console.log(`[ERROR-ADAPTATION] Strategy "${strategy.name}" success rate: ${(strategy.successRate * 100).toFixed(1)}%`);
    }

    // Remove from blacklist if recovery was successful
    if (this.domainBlacklist.has(domain)) {
      this.domainBlacklist.delete(domain);
      console.log(`[ERROR-ADAPTATION] Domain removed from blacklist: ${domain}`);
    }
  }

  /**
   * Report failed recovery after applying an adaptation strategy
   */
  reportRecoveryFailure(domain: string, strategyId: string): void {
    this.recoveryMetrics.failedAdaptations++;

    // Update strategy success rate
    const strategy = this.adaptationStrategies.find(s => s.id === strategyId);
    if (strategy) {
      strategy.successRate = Math.max(0.0, strategy.successRate - 0.05);
      console.log(`[ERROR-ADAPTATION] Strategy "${strategy.name}" failed. Success rate: ${(strategy.successRate * 100).toFixed(1)}%`);
    }
  }

  /**
   * Get error analysis for a specific domain
   */
  getDomainErrorAnalysis(domain: string): ErrorAnalysis {
    const errors = this.errorHistory.get(domain) || [];
    const recentErrors = this.getRecentErrors(errors);
    
    // Count error types
    const errorTypeCounts = new Map<string, number>();
    for (const error of recentErrors) {
      const key = error.statusCode ? `${error.type}_${error.statusCode}` : error.type;
      errorTypeCounts.set(key, (errorTypeCounts.get(key) || 0) + 1);
    }

    // Calculate common errors
    const totalErrors = recentErrors.length;
    const commonErrors = Array.from(errorTypeCounts.entries())
      .map(([type, count]) => ({
        type,
        count,
        percentage: (count / totalErrors) * 100
      }))
      .sort((a, b) => b.count - a.count);

    // Generate recommendations
    const recommendedActions = this.generateRecommendations(commonErrors, domain);

    return {
      domain,
      errorFrequency: recentErrors.length,
      commonErrors,
      recommendedActions,
      adaptationHistory: [] // Would be populated from actual adaptation logs
    };
  }

  /**
   * Check if a domain is currently blacklisted
   */
  isDomainBlacklisted(domain: string): boolean {
    return this.domainBlacklist.has(domain);
  }

  /**
   * Initialize built-in adaptation strategies
   */
  private initializeAdaptationStrategies(): void {
    this.adaptationStrategies = [
      {
        id: 'bot_detection_recovery',
        name: 'Bot Detection Recovery',
        description: 'Handles bot detection with user agent rotation and delays',
        conditions: (error) => error.type === 'bot_detection' || 
                              (error.type === 'http_error' && (error.statusCode === 403 || error.statusCode === 429)),
        actions: [
          { type: 'user_agent_rotation', parameters: { rotateSession: true } },
          { type: 'delay_increase', parameters: { multiplier: 3, randomJitter: true } },
          { type: 'proxy_rotation', parameters: { forceNew: true } }
        ],
        priority: 9,
        successRate: 0.7,
        lastUsed: new Date(0)
      },
      {
        id: 'rate_limit_recovery',
        name: 'Rate Limit Recovery',
        description: 'Handles rate limiting with exponential backoff',
        conditions: (error) => error.type === 'rate_limit' || error.statusCode === 429,
        actions: [
          { type: 'delay_increase', parameters: { exponentialBackoff: true, maxDelay: 300000 } }
        ],
        priority: 10,
        successRate: 0.9,
        lastUsed: new Date(0)
      },
      {
        id: 'timeout_recovery',
        name: 'Timeout Recovery',
        description: 'Handles timeouts with reduced concurrency and longer delays',
        conditions: (error) => error.type === 'timeout',
        actions: [
          { type: 'delay_increase', parameters: { multiplier: 2 } },
          { type: 'retry', parameters: { maxRetries: 2, reduceConcurrency: true } }
        ],
        priority: 7,
        successRate: 0.6,
        lastUsed: new Date(0)
      },
      {
        id: 'server_error_recovery',
        name: 'Server Error Recovery',
        description: 'Handles 5xx server errors with retry and fallback',
        conditions: (error) => error.type === 'http_error' && error.statusCode != null && error.statusCode >= 500,
        actions: [
          { type: 'delay_increase', parameters: { multiplier: 1.5 } },
          { type: 'retry', parameters: { maxRetries: 3 } },
          { type: 'fallback_method', parameters: { useStaticScraping: true } }
        ],
        priority: 6,
        successRate: 0.5,
        lastUsed: new Date(0)
      },
      {
        id: 'parsing_error_recovery',
        name: 'Parsing Error Recovery',
        description: 'Handles parsing errors by trying different extraction methods',
        conditions: (error) => error.type === 'parsing_error',
        actions: [
          { type: 'fallback_method', parameters: { useDynamicScraping: true } },
          { type: 'retry', parameters: { maxRetries: 1, differentUserAgent: true } }
        ],
        priority: 5,
        successRate: 0.4,
        lastUsed: new Date(0)
      },
      {
        id: 'content_change_recovery',
        name: 'Content Change Recovery',
        description: 'Handles content structure changes with alternative selectors',
        conditions: (error) => error.type === 'content_change',
        actions: [
          { type: 'fallback_method', parameters: { useAlternativeSelectors: true } },
          { type: 'retry', parameters: { maxRetries: 2 } }
        ],
        priority: 4,
        successRate: 0.3,
        lastUsed: new Date(0)
      }
    ];
  }

  /**
   * Store error in history
   */
  private storeError(error: ErrorPattern): void {
    if (!this.errorHistory.has(error.domain)) {
      this.errorHistory.set(error.domain, []);
    }

    const domainErrors = this.errorHistory.get(error.domain)!;
    domainErrors.push(error);

    // Limit history size
    if (domainErrors.length > this.maxErrorHistory) {
      domainErrors.shift();
    }
  }

  /**
   * Check if domain should be blacklisted based on error patterns
   */
  private shouldBlacklistDomain(domain: string): boolean {
    const errors = this.errorHistory.get(domain) || [];
    const recentErrors = this.getRecentErrors(errors);

    // Blacklist if too many consecutive errors
    const consecutiveErrors = this.getConsecutiveErrors(recentErrors);
    if (consecutiveErrors >= 10) {
      return true;
    }

    // Blacklist if too many bot detection errors
    const botDetectionErrors = recentErrors.filter(e => 
      e.type === 'bot_detection' || (e.type === 'http_error' && e.statusCode === 403)
    );
    
    if (botDetectionErrors.length >= 5 && botDetectionErrors.length / recentErrors.length > 0.8) {
      return true;
    }

    return false;
  }

  /**
   * Find the best adaptation strategy for an error
   */
  private findBestAdaptationStrategy(error: ErrorPattern): AdaptationStrategy | null {
    const applicableStrategies = this.adaptationStrategies
      .filter(strategy => strategy.conditions(error))
      .sort((a, b) => {
        // Sort by priority (higher first) and success rate
        if (a.priority !== b.priority) {
          return b.priority - a.priority;
        }
        return b.successRate - a.successRate;
      });

    return applicableStrategies[0] || null;
  }

  /**
   * Calculate retry wait time based on error and strategy
   */
  private calculateRetryWaitTime(error: ErrorPattern, strategy: AdaptationStrategy): number {
    let baseDelay = 1000; // 1 second base

    // Check strategy actions for delay modifications
    for (const action of strategy.actions) {
      if (action.type === 'delay_increase') {
        const params = action.parameters;
        
        if (params.exponentialBackoff) {
          const domain = error.domain;
          const recentErrors = this.getRecentErrors(this.errorHistory.get(domain) || []);
          const consecutiveErrors = this.getConsecutiveErrors(recentErrors);
          baseDelay = Math.min(params.maxDelay || 300000, 1000 * Math.pow(2, consecutiveErrors));
        } else if (params.multiplier) {
          baseDelay *= params.multiplier;
        }

        // Add random jitter if specified
        if (params.randomJitter) {
          const jitter = Math.random() * baseDelay * 0.3; // ±30% jitter
          baseDelay += (Math.random() > 0.5 ? jitter : -jitter);
        }
      }
    }

    return Math.max(0, baseDelay);
  }

  /**
   * Get recent errors within the analysis window
   */
  private getRecentErrors(errors: ErrorPattern[]): ErrorPattern[] {
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - this.analysisWindowHours);
    
    return errors.filter(error => error.timestamp > cutoffTime);
  }

  /**
   * Count consecutive errors from the end of the array
   */
  private getConsecutiveErrors(errors: ErrorPattern[]): number {
    let count = 0;
    for (let i = errors.length - 1; i >= 0; i--) {
      count++;
      // In a real implementation, you'd track successes too
      // For now, we'll just count all recent errors as consecutive
    }
    return Math.min(count, errors.length);
  }

  /**
   * Generate recommendations based on error patterns
   */
  private generateRecommendations(commonErrors: Array<{ type: string; count: number; percentage: number }>, domain: string): string[] {
    const recommendations: string[] = [];

    for (const errorType of commonErrors) {
      if (errorType.percentage > 50) {
        switch (true) {
          case errorType.type.includes('403') || errorType.type.includes('bot_detection'):
            recommendations.push('Consider rotating user agents and implementing longer delays');
            recommendations.push('Use residential proxies if available');
            break;
          case errorType.type.includes('429') || errorType.type.includes('rate_limit'):
            recommendations.push('Reduce request rate for this domain');
            recommendations.push('Implement exponential backoff strategy');
            break;
          case errorType.type.includes('timeout'):
            recommendations.push('Increase request timeout settings');
            recommendations.push('Reduce concurrent requests to this domain');
            break;
          case errorType.type.includes('parsing_error'):
            recommendations.push('Update CSS selectors and parsing logic');
            recommendations.push('Consider using dynamic scraping (Playwright) instead of static');
            break;
          case errorType.type.includes('5'):
            recommendations.push('Server appears unstable - implement retry with exponential backoff');
            recommendations.push('Consider scraping during off-peak hours');
            break;
        }
      }
    }

    // Add domain-specific recommendations
    if (recommendations.length === 0) {
      recommendations.push('Monitor error patterns and adjust scraping strategy accordingly');
      recommendations.push('Consider implementing custom handling for this domain');
    }

    return recommendations;
  }

  /**
   * Clean up old errors to prevent memory leaks
   */
  private cleanupOldErrors(): void {
    const cutoffTime = new Date();
    cutoffTime.setDate(cutoffTime.getDate() - 7); // Keep 7 days of history

    for (const [domain, errors] of this.errorHistory.entries()) {
      const recentErrors = errors.filter(error => error.timestamp > cutoffTime);
      
      if (recentErrors.length === 0) {
        this.errorHistory.delete(domain);
      } else {
        this.errorHistory.set(domain, recentErrors);
      }
    }
  }

  /**
   * Get current recovery metrics
   */
  getRecoveryMetrics(): RecoveryMetrics {
    return { ...this.recoveryMetrics };
  }

  /**
   * Get blacklisted domains
   */
  getBlacklistedDomains(): string[] {
    return Array.from(this.domainBlacklist);
  }

  /**
   * Manually remove domain from blacklist
   */
  removeFromBlacklist(domain: string): void {
    this.domainBlacklist.delete(domain);
    console.log(`[ERROR-ADAPTATION] Manually removed from blacklist: ${domain}`);
  }

  /**
   * Generate comprehensive error adaptation report
   */
  generateErrorAdaptationReport(): string {
    const totalDomains = this.errorHistory.size;
    const blacklistedDomains = this.domainBlacklist.size;
    const recoveryRate = this.recoveryMetrics.totalErrors > 0 
      ? (this.recoveryMetrics.recoveredErrors / this.recoveryMetrics.totalErrors * 100)
      : 0;

    const topProblematicDomains = Array.from(this.errorHistory.entries())
      .map(([domain, errors]) => ({
        domain,
        errorCount: this.getRecentErrors(errors).length,
        isBlacklisted: this.domainBlacklist.has(domain)
      }))
      .sort((a, b) => b.errorCount - a.errorCount)
      .slice(0, 10);

    const strategyEffectiveness = this.adaptationStrategies
      .sort((a, b) => b.successRate - a.successRate)
      .slice(0, 5);

    return `
ENTERPRISE ERROR ADAPTATION REPORT
==================================
Recovery Metrics:
- Total Errors: ${this.recoveryMetrics.totalErrors}
- Recovered Errors: ${this.recoveryMetrics.recoveredErrors}
- Recovery Rate: ${recoveryRate.toFixed(1)}%
- Adaptation Strategies Applied: ${this.recoveryMetrics.adaptationStrategiesApplied}
- Average Recovery Time: ${this.recoveryMetrics.averageRecoveryTime.toFixed(0)}ms

Domain Status:
- Total Domains Tracked: ${totalDomains}
- Blacklisted Domains: ${blacklistedDomains}
- Active Monitoring: ${totalDomains - blacklistedDomains}

Most Problematic Domains:
${topProblematicDomains.map((d, i) => 
  `${i+1}. ${d.domain} (${d.errorCount} errors) ${d.isBlacklisted ? '[BLACKLISTED]' : ''}`
).join('\n')}

Strategy Effectiveness:
${strategyEffectiveness.map((s, i) => 
  `${i+1}. ${s.name}: ${(s.successRate * 100).toFixed(1)}% success rate`
).join('\n')}

Blacklisted Domains:
${this.getBlacklistedDomains().map(domain => `- ${domain}`).join('\n') || 'None'}

Generated: ${new Date().toISOString()}
    `.trim();
  }

  /**
   * Reset all metrics and clear blacklist (for testing/debugging)
   */
  resetState(): void {
    this.errorHistory.clear();
    this.domainBlacklist.clear();
    this.recoveryMetrics = {
      totalErrors: 0,
      recoveredErrors: 0,
      adaptationStrategiesApplied: 0,
      averageRecoveryTime: 0,
      successfulAdaptations: 0,
      failedAdaptations: 0
    };

    // Reset strategy success rates
    for (const strategy of this.adaptationStrategies) {
      strategy.successRate = 0.5; // Reset to neutral
      strategy.lastUsed = new Date(0);
    }

    console.log('[ERROR-ADAPTATION] State reset completed');
  }
}
