/**
 * Enterprise Legal Compliance and Robots.txt Manager
 * Ensures all scraping operations comply with legal requirements and website policies
 */

import robotsParser from 'robots-txt-parser';
import { URL } from 'url';
import { EnterpriseConfig } from './EnterpriseConfig.js';

export interface RobotsInfo {
  allowed: boolean;
  crawlDelay?: number;
  sitemap?: string[];
  userAgent: string;
  lastChecked: Date;
  errors?: string[];
}

export interface ComplianceResult {
  canScrape: boolean;
  recommendedDelay: number;
  sitemaps: string[];
  warnings: string[];
  restrictions: string[];
}

export interface LegalConstraints {
  respectCopyrights: boolean;
  honorPaywalls: boolean;
  maxDailyRequests?: number;
  allowedContentTypes: string[];
  blockedPaths: string[];
}

/**
 * Manages legal compliance for web scraping operations
 * Focuses specifically on recipe content legal considerations
 */
export class ComplianceManager {
  private robotsCache = new Map<string, RobotsInfo>();
  private sitemapCache = new Map<string, string[]>();
  private readonly cacheExpiry = 24 * 60 * 60 * 1000; // 24 hours
  private readonly config: EnterpriseConfig;

  // Recipe-specific legal guidelines
  private readonly recipeContentGuidelines = {
    // Generally legal to scrape
    allowedContent: [
      'ingredient-lists',
      'basic-cooking-methods',
      'public-domain-recipes',
      'factual-nutrition-data',
      'cooking-times-temperatures'
    ],
    
    // Proceed with caution
    cautionContent: [
      'detailed-recipe-descriptions',
      'chef-commentary',
      'cooking-stories',
      'branded-recipe-names'
    ],
    
    // Avoid or require explicit permission
    restrictedContent: [
      'professional-food-photography',
      'copyrighted-recipe-books',
      'paywall-protected-content',
      'subscription-only-recipes',
      'chef-proprietary-techniques'
    ]
  };

  constructor(config: EnterpriseConfig) {
    this.config = config;
  }

  /**
   * Check if a URL can be legally and ethically scraped
   */
  async checkCompliance(url: string, userAgent = 'enterprise-recipe-scraper'): Promise<ComplianceResult> {
    const domain = new URL(url).hostname;
    const result: ComplianceResult = {
      canScrape: false,
      recommendedDelay: 1000,
      sitemaps: [],
      warnings: [],
      restrictions: []
    };

    try {
      // Check robots.txt compliance
      const robotsInfo = await this.checkRobotsTxt(url, userAgent);
      
      if (!robotsInfo.allowed) {
        result.restrictions.push(`Robots.txt disallows scraping for user-agent: ${userAgent}`);
        return result;
      }

      // Apply crawl delay from robots.txt
      if (robotsInfo.crawlDelay) {
        result.recommendedDelay = Math.max(result.recommendedDelay, robotsInfo.crawlDelay * 1000);
      }

      // Extract sitemaps
      if (robotsInfo.sitemap) {
        result.sitemaps = robotsInfo.sitemap;
      }

      // Check for paywall indicators
      if (await this.isProbablyPaywalled(url)) {
        if (this.config.compliance.honorPaywalls) {
          result.restrictions.push('Content appears to be behind a paywall');
          return result;
        } else {
          result.warnings.push('Content may be behind a paywall - proceed with caution');
        }
      }

      // Check for copyright-sensitive content
      const copyrightRisk = this.assessCopyrightRisk(url);
      if (copyrightRisk.high && this.config.compliance.respectCopyrights) {
        result.warnings.push(...copyrightRisk.warnings);
      }

      // Recipe-specific compliance checks
      const recipeCompliance = this.assessRecipeCompliance(url);
      result.warnings.push(...recipeCompliance.warnings);
      result.restrictions.push(...recipeCompliance.restrictions);

      // If no blocking restrictions, allow scraping
      result.canScrape = result.restrictions.length === 0;

      return result;

    } catch (error) {
      result.restrictions.push(`Compliance check failed: ${error}`);
      return result;
    }
  }

  /**
   * Check robots.txt for a given URL
   */
  private async checkRobotsTxt(url: string, userAgent: string): Promise<RobotsInfo> {
    const domain = new URL(url).hostname;
    const cacheKey = `${domain}-${userAgent}`;
    
    // Check cache first
    const cached = this.robotsCache.get(cacheKey);
    if (cached && Date.now() - cached.lastChecked.getTime() < this.cacheExpiry) {
      return cached;
    }

    try {
      const robotsUrl = `https://${domain}/robots.txt`;
      const robots = robotsParser({ userAgent });
      
      await robots.useRobotsFor(robotsUrl);
      
      const allowed = robots.canCrawl(url);
      const crawlDelay = robots.getCrawlDelay();
      const sitemaps = robots.getSitemaps();

      const info: RobotsInfo = {
        allowed,
        crawlDelay,
        sitemap: sitemaps,
        userAgent,
        lastChecked: new Date()
      };

      // Cache the result
      this.robotsCache.set(cacheKey, info);
      return info;

    } catch (error) {
      // If robots.txt is not accessible, assume scraping is allowed (common practice)
      const fallbackInfo: RobotsInfo = {
        allowed: true,
        userAgent,
        lastChecked: new Date(),
        errors: [`Failed to fetch robots.txt: ${error}`]
      };
      
      this.robotsCache.set(cacheKey, fallbackInfo);
      return fallbackInfo;
    }
  }

  /**
   * Detect if content is likely behind a paywall
   */
  private async isProbablyPaywalled(url: string): Promise<boolean> {
    const paywallIndicators = [
      'subscription',
      'premium',
      'members-only',
      'subscriber',
      'paid-content',
      'paywall',
      'register',
      'login-required'
    ];

    const urlLower = url.toLowerCase();
    return paywallIndicators.some(indicator => urlLower.includes(indicator));
  }

  /**
   * Assess copyright risk for recipe content
   */
  private assessCopyrightRisk(url: string): { high: boolean; warnings: string[] } {
    const warnings: string[] = [];
    let high = false;

    // High-risk domains (famous chefs, cookbook publishers, etc.)
    const highRiskDomains = [
      'cookbooks.com',
      'chef-proprietary.com',
      'premium-recipes.com'
    ];

    const domain = new URL(url).hostname;
    if (highRiskDomains.some(risky => domain.includes(risky))) {
      high = true;
      warnings.push('Domain known for copyrighted content - ensure proper attribution');
    }

    // Check for cookbook or professional content indicators
    const urlLower = url.toLowerCase();
    const copyrightIndicators = ['cookbook', 'professional-chef', 'signature-recipe', 'proprietary'];
    
    if (copyrightIndicators.some(indicator => urlLower.includes(indicator))) {
      warnings.push('Content may include copyrighted recipe descriptions or techniques');
    }

    return { high, warnings };
  }

  /**
   * Recipe-specific compliance assessment
   */
  private assessRecipeCompliance(url: string): { warnings: string[]; restrictions: string[] } {
    const warnings: string[] = [];
    const restrictions: string[] = [];
    const urlLower = url.toLowerCase();

    // Check for restricted content indicators
    if (urlLower.includes('professional-photography') || urlLower.includes('food-photography')) {
      restrictions.push('URL suggests professional food photography - avoid scraping images');
    }

    if (urlLower.includes('chef-story') || urlLower.includes('cooking-memoir')) {
      warnings.push('Content may include copyrighted chef commentary or stories');
    }

    // Check for allowed content
    const isBasicRecipe = [
      'ingredients',
      'cooking-instructions',
      'recipe-basic',
      'simple-recipe'
    ].some(indicator => urlLower.includes(indicator));

    if (isBasicRecipe) {
      warnings.push('Basic recipe content - generally safe to scrape ingredient lists and basic instructions');
    }

    return { warnings, restrictions };
  }

  /**
   * Generate compliance report for audit purposes
   */
  generateComplianceReport(results: ComplianceResult[], operationId: string): string {
    const timestamp = new Date().toISOString();
    const totalChecks = results.length;
    const allowedCount = results.filter(r => r.canScrape).length;
    const blockedCount = totalChecks - allowedCount;

    const report = `
ENTERPRISE SCRAPING COMPLIANCE REPORT
=====================================
Operation ID: ${operationId}
Timestamp: ${timestamp}
Configuration: ${this.config.compliance.respectCopyrights ? 'Copyright Respectful' : 'Standard'}

SUMMARY:
- Total URLs Checked: ${totalChecks}
- Allowed to Scrape: ${allowedCount}
- Blocked by Compliance: ${blockedCount}
- Success Rate: ${((allowedCount / totalChecks) * 100).toFixed(1)}%

COMPLIANCE SETTINGS:
- Respect Copyrights: ${this.config.compliance.respectCopyrights}
- Honor Paywalls: ${this.config.compliance.honorPaywalls}
- Usage Logging: ${this.config.compliance.enableUsageLogging}
- Data Retention Compliance: ${this.config.compliance.dataRetentionCompliance}

RECIPE-SPECIFIC GUIDELINES APPLIED:
✅ Allowed Content: ${this.recipeContentGuidelines.allowedContent.join(', ')}
⚠️  Caution Required: ${this.recipeContentGuidelines.cautionContent.join(', ')}
❌ Restricted Content: ${this.recipeContentGuidelines.restrictedContent.join(', ')}

DETAILED RESULTS:
${results.map((result, i) => `
URL ${i + 1}: ${result.canScrape ? '✅ ALLOWED' : '❌ BLOCKED'}
- Recommended Delay: ${result.recommendedDelay}ms
- Warnings: ${result.warnings.length > 0 ? result.warnings.join('; ') : 'None'}
- Restrictions: ${result.restrictions.length > 0 ? result.restrictions.join('; ') : 'None'}
- Sitemaps Found: ${result.sitemaps.length}
`).join('')}

This report demonstrates compliance with legal requirements for recipe scraping operations.
Generated by Enterprise Recipe Scraper Compliance Manager v1.0
    `.trim();

    if (this.config.compliance.enableUsageLogging) {
      this.logComplianceReport(operationId, report);
    }

    return report;
  }

  /**
   * Log compliance report for legal audit trail
   */
  private logComplianceReport(operationId: string, report: string): void {
    // In a real implementation, this would write to a secure audit log
    console.log(`[COMPLIANCE-AUDIT] Operation ${operationId}:`, report);
  }

  /**
   * Clear expired cache entries
   */
  clearExpiredCache(): void {
    const now = Date.now();
    
    for (const [key, info] of this.robotsCache.entries()) {
      if (now - info.lastChecked.getTime() > this.cacheExpiry) {
        this.robotsCache.delete(key);
      }
    }
  }

  /**
   * Get cache statistics for monitoring
   */
  getCacheStats(): { robotsEntries: number; sitemapEntries: number } {
    return {
      robotsEntries: this.robotsCache.size,
      sitemapEntries: this.sitemapCache.size
    };
  }
}
