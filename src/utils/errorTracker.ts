/**
 * Error tracking utility to monitor and adapt to site-specific issues
 */

export interface SiteErrorStats {
  domain: string;
  totalAttempts: number;
  successCount: number;
  error429Count: number;
  error403Count: number;
  errorOtherCount: number;
  lastError?: string;
  lastErrorTime?: Date;
  isBlocked: boolean;
  successRate: number;
}

class ErrorTracker {
  private static instance: ErrorTracker;
  private siteStats: Map<string, SiteErrorStats> = new Map();
  private blockedDomains: Set<string> = new Set();
  
  // Thresholds for blocking sites
  private readonly ERROR_429_THRESHOLD = 10;  // Block after 10 consecutive 429s
  private readonly ERROR_403_THRESHOLD = 5;   // Block after 5 consecutive 403s
  private readonly SUCCESS_RATE_THRESHOLD = 0.1; // Block if success rate < 10%
  private readonly MIN_ATTEMPTS_FOR_BLOCKING = 5; // Need at least 5 attempts before blocking
  
  private constructor() {}
  
  static getInstance(): ErrorTracker {
    if (!ErrorTracker.instance) {
      ErrorTracker.instance = new ErrorTracker();
    }
    return ErrorTracker.instance;
  }
  
  /**
   * Record a successful fetch
   */
  recordSuccess(url: string): void {
    const domain = this.getDomain(url);
    const stats = this.getOrCreateStats(domain);
    
    stats.totalAttempts++;
    stats.successCount++;
    stats.successRate = stats.successCount / stats.totalAttempts;
    
    // Reset consecutive error counts on success
    if (stats.error429Count > 0 || stats.error403Count > 0) {
      console.log(`✅ ${domain} is responding again (success rate: ${(stats.successRate * 100).toFixed(1)}%)`);
    }
    
    // Unblock domain if success rate improves
    if (stats.isBlocked && stats.successRate > this.SUCCESS_RATE_THRESHOLD * 2) {
      this.unblockDomain(domain);
    }
  }
  
  /**
   * Record an error
   */
  recordError(url: string, statusCode: number, errorMessage: string): void {
    const domain = this.getDomain(url);
    const stats = this.getOrCreateStats(domain);
    
    stats.totalAttempts++;
    stats.lastError = errorMessage;
    stats.lastErrorTime = new Date();
    
    if (statusCode === 429) {
      stats.error429Count++;
      console.warn(`⚠️ ${domain}: 429 error #${stats.error429Count}`);
      
      // Check if we should block this domain
      if (stats.error429Count >= this.ERROR_429_THRESHOLD) {
        this.blockDomain(domain, `Too many rate limit errors (${stats.error429Count})`);
      }
    } else if (statusCode === 403) {
      stats.error403Count++;
      console.warn(`⚠️ ${domain}: 403 error #${stats.error403Count}`);
      
      // Check if we should block this domain
      if (stats.error403Count >= this.ERROR_403_THRESHOLD) {
        this.blockDomain(domain, `Too many forbidden errors (${stats.error403Count})`);
      }
    } else {
      stats.errorOtherCount++;
    }
    
    stats.successRate = stats.successCount / stats.totalAttempts;
    
    // Block domain if success rate is too low
    if (stats.totalAttempts >= this.MIN_ATTEMPTS_FOR_BLOCKING && 
        stats.successRate < this.SUCCESS_RATE_THRESHOLD) {
      this.blockDomain(domain, `Low success rate (${(stats.successRate * 100).toFixed(1)}%)`);
    }
  }
  
  /**
   * Check if a domain is blocked
   */
  isDomainBlocked(url: string): boolean {
    const domain = this.getDomain(url);
    return this.blockedDomains.has(domain);
  }
  
  /**
   * Get statistics for a domain
   */
  getDomainStats(url: string): SiteErrorStats | undefined {
    const domain = this.getDomain(url);
    return this.siteStats.get(domain);
  }
  
  /**
   * Get all statistics
   */
  getAllStats(): SiteErrorStats[] {
    return Array.from(this.siteStats.values());
  }
  
  /**
   * Get blocked domains
   */
  getBlockedDomains(): string[] {
    return Array.from(this.blockedDomains);
  }
  
  /**
   * Generate a summary report
   */
  generateReport(): string {
    const stats = this.getAllStats();
    const blocked = this.getBlockedDomains();
    
    let report = '\n📊 Scraping Error Report\n';
    report += '=' .repeat(50) + '\n\n';
    
    // Summary
    const totalDomains = stats.length;
    const successfulDomains = stats.filter(s => s.successRate > 0.5).length;
    const problematicDomains = stats.filter(s => s.successRate <= 0.5 && s.successRate > 0).length;
    const blockedCount = blocked.length;
    
    report += `📈 Summary:\n`;
    report += `  • Total domains: ${totalDomains}\n`;
    report += `  • Successful (>50% success): ${successfulDomains}\n`;
    report += `  • Problematic (≤50% success): ${problematicDomains}\n`;
    report += `  • Blocked: ${blockedCount}\n\n`;
    
    // Blocked domains
    if (blocked.length > 0) {
      report += `🚫 Blocked Domains:\n`;
      blocked.forEach(domain => {
        const stat = this.siteStats.get(domain);
        if (stat) {
          report += `  • ${domain}: ${stat.lastError || 'Multiple errors'}\n`;
        }
      });
      report += '\n';
    }
    
    // Problematic domains
    const problematic = stats
      .filter(s => !s.isBlocked && s.successRate < 0.5 && s.totalAttempts > 0)
      .sort((a, b) => a.successRate - b.successRate);
    
    if (problematic.length > 0) {
      report += `⚠️ Problematic Domains:\n`;
      problematic.slice(0, 10).forEach(stat => {
        report += `  • ${stat.domain}: ${(stat.successRate * 100).toFixed(1)}% success`;
        report += ` (${stat.successCount}/${stat.totalAttempts} attempts)`;
        if (stat.error429Count > 0) report += ` [429: ${stat.error429Count}]`;
        if (stat.error403Count > 0) report += ` [403: ${stat.error403Count}]`;
        report += '\n';
      });
      report += '\n';
    }
    
    // Top performing domains
    const topPerformers = stats
      .filter(s => s.successRate >= 0.8 && s.totalAttempts >= 5)
      .sort((a, b) => b.totalAttempts - a.totalAttempts);
    
    if (topPerformers.length > 0) {
      report += `✅ Top Performing Domains:\n`;
      topPerformers.slice(0, 10).forEach(stat => {
        report += `  • ${stat.domain}: ${(stat.successRate * 100).toFixed(1)}% success`;
        report += ` (${stat.successCount}/${stat.totalAttempts} attempts)\n`;
      });
    }
    
    report += '\n' + '=' .repeat(50) + '\n';
    return report;
  }
  
  /**
   * Reset statistics for a domain
   */
  resetDomain(domain: string): void {
    this.siteStats.delete(domain);
    this.blockedDomains.delete(domain);
    console.log(`🔄 Reset statistics for ${domain}`);
  }
  
  /**
   * Reset all statistics
   */
  resetAll(): void {
    this.siteStats.clear();
    this.blockedDomains.clear();
    console.log('🔄 Reset all error tracking statistics');
  }
  
  private getDomain(url: string): string {
    try {
      return new URL(url).hostname;
    } catch {
      return 'unknown';
    }
  }
  
  private getOrCreateStats(domain: string): SiteErrorStats {
    if (!this.siteStats.has(domain)) {
      this.siteStats.set(domain, {
        domain,
        totalAttempts: 0,
        successCount: 0,
        error429Count: 0,
        error403Count: 0,
        errorOtherCount: 0,
        isBlocked: false,
        successRate: 0
      });
    }
    return this.siteStats.get(domain)!;
  }
  
  private blockDomain(domain: string, reason: string): void {
    const stats = this.getOrCreateStats(domain);
    if (!stats.isBlocked) {
      stats.isBlocked = true;
      this.blockedDomains.add(domain);
      console.error(`🚫 Blocking ${domain}: ${reason}`);
    }
  }
  
  private unblockDomain(domain: string): void {
    const stats = this.getOrCreateStats(domain);
    if (stats.isBlocked) {
      stats.isBlocked = false;
      this.blockedDomains.delete(domain);
      console.log(`✅ Unblocking ${domain} due to improved success rate`);
    }
  }
}

export default ErrorTracker;
