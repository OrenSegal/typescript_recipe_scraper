/**
 * Blocked Websites Registry
 * Tracks websites that consistently fail to scrape and maintains a blocklist
 */

import fs from 'fs/promises';
import path from 'path';

export interface BlockedWebsite {
  domain: string;
  url: string;
  reason: string;
  firstFailedAt: Date;
  lastAttemptAt: Date;
  attemptCount: number;
  errorType: 'cloudflare' | 'captcha' | 'authentication' | 'rate_limit' | 'invalid_format' | 'timeout' | 'other';
  isTemporary: boolean; // If true, will retry after cooldown
  cooldownUntil?: Date; // When to retry again
}

export interface FailureRecord {
  url: string;
  error: string;
  timestamp: Date;
}

export class BlockedWebsitesRegistry {
  private static instance: BlockedWebsitesRegistry;
  private blockedSites: Map<string, BlockedWebsite> = new Map();
  private registryPath: string;

  // Failure threshold before blocking
  private readonly BLOCK_THRESHOLD = 5;
  private readonly TEMPORARY_COOLDOWN_MS = 1000 * 60 * 60; // 1 hour
  private readonly PERMANENT_THRESHOLD = 20;

  private constructor() {
    this.registryPath = path.join(process.cwd(), 'blocked-websites.json');
    this.loadRegistry();
  }

  public static getInstance(): BlockedWebsitesRegistry {
    if (!BlockedWebsitesRegistry.instance) {
      BlockedWebsitesRegistry.instance = new BlockedWebsitesRegistry();
    }
    return BlockedWebsitesRegistry.instance;
  }

  /**
   * Check if a URL/domain is blocked
   */
  isBlocked(url: string): boolean {
    const domain = this.extractDomain(url);
    const blocked = this.blockedSites.get(domain);

    if (!blocked) return false;

    // Check if temporary block has expired
    if (blocked.isTemporary && blocked.cooldownUntil) {
      if (new Date() > blocked.cooldownUntil) {
        console.log(`🔓 Cooldown expired for ${domain}, allowing retry`);
        this.unblock(domain);
        return false;
      }
    }

    return true;
  }

  /**
   * Get blocked website info
   */
  getBlockedInfo(url: string): BlockedWebsite | null {
    const domain = this.extractDomain(url);
    return this.blockedSites.get(domain) || null;
  }

  /**
   * Register a failed scraping attempt
   */
  async recordFailure(url: string, error: string): Promise<void> {
    const domain = this.extractDomain(url);
    let blocked = this.blockedSites.get(domain);

    const errorType = this.classifyError(error);

    if (!blocked) {
      // First failure
      blocked = {
        domain,
        url,
        reason: error,
        firstFailedAt: new Date(),
        lastAttemptAt: new Date(),
        attemptCount: 1,
        errorType,
        isTemporary: true
      };
    } else {
      // Subsequent failure
      blocked.attemptCount++;
      blocked.lastAttemptAt = new Date();
      blocked.reason = error;
      blocked.errorType = errorType;
    }

    // Decide if should block
    if (blocked.attemptCount >= this.BLOCK_THRESHOLD) {
      if (blocked.attemptCount >= this.PERMANENT_THRESHOLD) {
        // Permanent block
        blocked.isTemporary = false;
        blocked.cooldownUntil = undefined;
        console.log(`🚫 PERMANENTLY BLOCKED: ${domain} (${blocked.attemptCount} failures)`);
      } else {
        // Temporary block with cooldown
        blocked.isTemporary = true;
        blocked.cooldownUntil = new Date(Date.now() + this.TEMPORARY_COOLDOWN_MS);
        console.log(`⏰ TEMPORARILY BLOCKED: ${domain} until ${blocked.cooldownUntil.toISOString()}`);
      }
    }

    this.blockedSites.set(domain, blocked);
    await this.saveRegistry();
  }

  /**
   * Record a successful scrape (reduces failure count)
   */
  async recordSuccess(url: string): Promise<void> {
    const domain = this.extractDomain(url);
    const blocked = this.blockedSites.get(domain);

    if (blocked) {
      // Reduce failure count on success
      blocked.attemptCount = Math.max(0, blocked.attemptCount - 2);

      if (blocked.attemptCount === 0) {
        console.log(`✅ Unblocking ${domain} after successful scrape`);
        this.blockedSites.delete(domain);
      } else {
        this.blockedSites.set(domain, blocked);
      }

      await this.saveRegistry();
    }
  }

  /**
   * Manually unblock a domain
   */
  async unblock(domain: string): Promise<void> {
    this.blockedSites.delete(domain);
    await this.saveRegistry();
    console.log(`🔓 Manually unblocked: ${domain}`);
  }

  /**
   * Get all blocked websites
   */
  getAllBlocked(): BlockedWebsite[] {
    return Array.from(this.blockedSites.values());
  }

  /**
   * Get statistics
   */
  getStats() {
    const blocked = this.getAllBlocked();
    const temporary = blocked.filter(b => b.isTemporary);
    const permanent = blocked.filter(b => !b.isTemporary);

    return {
      total: blocked.length,
      temporary: temporary.length,
      permanent: permanent.length,
      byErrorType: this.groupByErrorType(blocked)
    };
  }

  /**
   * Export blocked sites for reporting
   */
  exportReport(): string {
    const blocked = this.getAllBlocked();
    let report = '# Blocked Websites Report\n\n';
    report += `Generated: ${new Date().toISOString()}\n`;
    report += `Total Blocked: ${blocked.length}\n\n`;

    report += '## Permanently Blocked\n\n';
    const permanent = blocked.filter(b => !b.isTemporary);
    permanent.forEach(site => {
      report += `- **${site.domain}**\n`;
      report += `  - Reason: ${site.reason}\n`;
      report += `  - Error Type: ${site.errorType}\n`;
      report += `  - Failures: ${site.attemptCount}\n`;
      report += `  - First Failed: ${site.firstFailedAt}\n\n`;
    });

    report += '## Temporarily Blocked\n\n';
    const temporary = blocked.filter(b => b.isTemporary);
    temporary.forEach(site => {
      report += `- **${site.domain}**\n`;
      report += `  - Reason: ${site.reason}\n`;
      report += `  - Cooldown Until: ${site.cooldownUntil}\n`;
      report += `  - Failures: ${site.attemptCount}\n\n`;
    });

    return report;
  }

  /**
   * Load registry from disk
   */
  private async loadRegistry(): Promise<void> {
    try {
      const data = await fs.readFile(this.registryPath, 'utf-8');
      const parsed = JSON.parse(data);

      // Convert dates from strings
      for (const [domain, site] of Object.entries(parsed)) {
        const blocked = site as any;
        blocked.firstFailedAt = new Date(blocked.firstFailedAt);
        blocked.lastAttemptAt = new Date(blocked.lastAttemptAt);
        if (blocked.cooldownUntil) {
          blocked.cooldownUntil = new Date(blocked.cooldownUntil);
        }
        this.blockedSites.set(domain, blocked);
      }

      console.log(`📋 Loaded ${this.blockedSites.size} blocked sites from registry`);
    } catch (error) {
      // Registry doesn't exist yet, start fresh
      console.log('📋 Starting fresh blocked websites registry');
    }
  }

  /**
   * Save registry to disk
   */
  private async saveRegistry(): Promise<void> {
    try {
      const data: Record<string, BlockedWebsite> = {};
      for (const [domain, site] of this.blockedSites.entries()) {
        data[domain] = site;
      }

      await fs.writeFile(
        this.registryPath,
        JSON.stringify(data, null, 2),
        'utf-8'
      );
    } catch (error) {
      console.error('❌ Failed to save blocked websites registry:', error);
    }
  }

  /**
   * Extract domain from URL
   */
  private extractDomain(url: string): string {
    try {
      const parsed = new URL(url);
      return parsed.hostname;
    } catch {
      return url;
    }
  }

  /**
   * Classify error type
   */
  private classifyError(error: string): BlockedWebsite['errorType'] {
    const errorLower = error.toLowerCase();

    if (errorLower.includes('cloudflare') || errorLower.includes('cf-ray')) {
      return 'cloudflare';
    }
    if (errorLower.includes('captcha') || errorLower.includes('recaptcha')) {
      return 'captcha';
    }
    if (errorLower.includes('403') || errorLower.includes('forbidden') || errorLower.includes('unauthorized')) {
      return 'authentication';
    }
    if (errorLower.includes('429') || errorLower.includes('rate limit')) {
      return 'rate_limit';
    }
    if (errorLower.includes('timeout') || errorLower.includes('timed out')) {
      return 'timeout';
    }
    if (errorLower.includes('parse') || errorLower.includes('invalid') || errorLower.includes('format')) {
      return 'invalid_format';
    }

    return 'other';
  }

  /**
   * Group blocked sites by error type
   */
  private groupByErrorType(blocked: BlockedWebsite[]) {
    const groups: Record<string, number> = {};

    blocked.forEach(site => {
      groups[site.errorType] = (groups[site.errorType] || 0) + 1;
    });

    return groups;
  }
}

/**
 * Convenience functions
 */
export function isWebsiteBlocked(url: string): boolean {
  return BlockedWebsitesRegistry.getInstance().isBlocked(url);
}

export async function recordScrapingFailure(url: string, error: string): Promise<void> {
  await BlockedWebsitesRegistry.getInstance().recordFailure(url, error);
}

export async function recordScrapingSuccess(url: string): Promise<void> {
  await BlockedWebsitesRegistry.getInstance().recordSuccess(url);
}

export function getBlockedWebsitesReport(): string {
  return BlockedWebsitesRegistry.getInstance().exportReport();
}
