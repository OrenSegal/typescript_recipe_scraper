/**
 * Adaptive Crawler with intelligent rate limiting, error recovery, and site-specific optimizations
 * Implements SOLID principles for maintainable and extensible crawling
 */

import * as cheerio from 'cheerio';
import axios, { AxiosError } from 'axios';
import { URL } from 'url';
import { UnifiedScraper, ScrapingResult } from '@/scrapers/UnifiedScraper.js';
import { DatabaseService } from '@/services/DatabaseService.js';
import { RateLimiter } from '../utils/RateLimiter.js';

interface CrawlOptions {
  maxConcurrency?: number;
  maxRetries?: number;
  enableUpsert?: boolean;
  userAgent?: string;
  timeout?: number;
  followRedirects?: boolean;
  respectRobotsTxt?: boolean;
}

interface CrawlStats {
  total: number;
  successful: number;
  failed: number;
  rateLimited: number;
  errors: Map<string, number>;
  startTime: number;
  domains: Map<string, { success: number; failed: number }>;
}

interface SiteConfig {
  selectors?: {
    recipeLinks?: string[];
    nextPage?: string[];
    jsonLd?: string[];
  };
  headers?: Record<string, string>;
  waitTime?: number;
  requiresCookies?: boolean;
}

export class AdaptiveCrawler {
  private rateLimiter: RateLimiter;
  private scraper: UnifiedScraper;
  private databaseService: DatabaseService | null = null;
  private stats: CrawlStats;
  private siteConfigs: Map<string, SiteConfig>;
  private userAgents: string[];
  private currentUAIndex: number = 0;

  constructor(private options: CrawlOptions = {}) {
    this.rateLimiter = new RateLimiter();
    this.scraper = new UnifiedScraper();
    this.stats = this.initStats();
    this.siteConfigs = this.initSiteConfigs();
    this.userAgents = this.initUserAgents();

    // Initialize database if upsert is enabled
    if (options.enableUpsert) {
      this.databaseService = DatabaseService.getInstance();
    }

    // Set up rate limiter event listeners
    this.setupRateLimiterEvents();
  }

  /**
   * Initialize crawl statistics
   */
  private initStats(): CrawlStats {
    return {
      total: 0,
      successful: 0,
      failed: 0,
      rateLimited: 0,
      errors: new Map(),
      startTime: Date.now(),
      domains: new Map()
    };
  }

  /**
   * Initialize site-specific configurations
   */
  private initSiteConfigs(): Map<string, SiteConfig> {
    const configs = new Map<string, SiteConfig>();

    // Taste of Home - very strict rate limiting
    configs.set('www.tasteofhome.com', {
      selectors: {
        recipeLinks: [
          'a[href*="/recipes/"]',
          '.recipe-card a',
          'article a[href*="recipes"]'
        ],
        jsonLd: ['script[type="application/ld+json"]']
      },
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
      waitTime: 3000,
      requiresCookies: true
    });

    // Pinch of Yum
    configs.set('pinchofyum.com', {
      selectors: {
        recipeLinks: [
          'a[href*="/recipe/"]',
          '.recipe-card a',
          'h2 a[href*="pinchofyum.com"]'
        ],
        jsonLd: ['script[type="application/ld+json"]']
      },
      waitTime: 2000
    });

    // Food52
    configs.set('food52.com', {
      selectors: {
        recipeLinks: [
          'a[href*="/recipes/"]',
          '.recipe-tile a',
          'article a[href*="recipes"]'
        ]
      },
      waitTime: 2500,
      requiresCookies: true
    });

    // Simply Recipes
    configs.set('www.simplyrecipes.com', {
      selectors: {
        recipeLinks: [
          'a[href*="simplyrecipes.com"][href*="-recipe-"]',
          '.recipe-card a',
          'article a'
        ],
        jsonLd: ['script[type="application/ld+json"]']
      }
    });

    // Serious Eats
    configs.set('www.seriouseats.com', {
      selectors: {
        recipeLinks: [
          'a[href*="/recipes/"]',
          'a[href*="seriouseats.com/recipes"]',
          '.recipe-link'
        ]
      }
    });

    return configs;
  }

  /**
   * Initialize user agent rotation pool
   */
  private initUserAgents(): string[] {
    return [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0'
    ];
  }

  /**
   * Get next user agent in rotation
   */
  private getNextUserAgent(): string {
    const ua = this.userAgents[this.currentUAIndex];
    this.currentUAIndex = (this.currentUAIndex + 1) % this.userAgents.length;
    return ua;
  }

  /**
   * Set up rate limiter event listeners for monitoring
   */
  private setupRateLimiterEvents(): void {
    this.rateLimiter.on('rateLimit', ({ domain, attempt }) => {
      console.log(`⚠️ Rate limited on ${domain} (attempt ${attempt})`);
      this.stats.rateLimited++;
    });

    this.rateLimiter.on('backoff', ({ domain, waitTime }) => {
      console.log(`⏸️ Backing off ${domain} for ${waitTime}ms`);
    });

    this.rateLimiter.on('retry', ({ domain, attempt, backoff }) => {
      console.log(`🔄 Retrying ${domain} (attempt ${attempt}) after ${backoff}ms`);
    });

    this.rateLimiter.on('forbidden', ({ domain }) => {
      console.log(`🚫 Access forbidden for ${domain} - applying extended backoff`);
    });
  }

  /**
   * Crawl a sitemap and extract recipe URLs
   */
  async crawlSitemap(sitemapUrl: string): Promise<string[]> {
    const domain = new URL(sitemapUrl).hostname;
    const config = this.siteConfigs.get(domain) || {};

    try {
      const response = await this.rateLimiter.queueRequest(
        domain,
        async () => {
          return await axios.get(sitemapUrl, {
            headers: {
              'User-Agent': this.getNextUserAgent(),
              ...config.headers
            },
            timeout: this.options.timeout || 30000
          });
        }
      );

      const $ = cheerio.load(response.data, { xmlMode: true });
      const urls: string[] = [];

      // Extract URLs from sitemap
      $('url > loc').each((_, elem) => {
        const url = $(elem).text();
        if (this.isRecipeUrl(url)) {
          urls.push(url);
        }
      });

      // Also check for nested sitemaps
      $('sitemap > loc').each((_, elem) => {
        const nestedSitemapUrl = $(elem).text();
        if (nestedSitemapUrl.includes('recipe')) {
          console.log(`📍 Found nested recipe sitemap: ${nestedSitemapUrl}`);
        }
      });

      return urls;
    } catch (error) {
      this.handleError(error as Error, domain);
      return [];
    }
  }

  /**
   * Crawl a website page and extract recipe URLs
   */
  async crawlPage(pageUrl: string): Promise<string[]> {
    const domain = new URL(pageUrl).hostname;
    const config = this.siteConfigs.get(domain) || {};

    try {
      const response = await this.rateLimiter.queueRequest(
        domain,
        async () => {
          return await axios.get(pageUrl, {
            headers: {
              'User-Agent': this.getNextUserAgent(),
              ...config.headers
            },
            timeout: this.options.timeout || 30000
          });
        }
      );

      const $ = cheerio.load(response.data);
      const urls = new Set<string>();

      // Use site-specific selectors if available
      const selectors = config.selectors?.recipeLinks || [
        'a[href*="/recipe"]',
        'a[href*="/recipes/"]',
        '.recipe-card a',
        'article a'
      ];

      selectors.forEach(selector => {
        $(selector).each((_, elem) => {
          const href = $(elem).attr('href');
          if (href) {
            const absoluteUrl = new URL(href, pageUrl).toString();
            if (this.isRecipeUrl(absoluteUrl)) {
              urls.add(absoluteUrl);
            }
          }
        });
      });

      return Array.from(urls);
    } catch (error) {
      this.handleError(error as Error, domain);
      return [];
    }
  }

  /**
   * Scrape a recipe with intelligent retry and fallback
   */
  async scrapeRecipe(recipeUrl: string): Promise<ScrapingResult> {
    const domain = new URL(recipeUrl).hostname;
    this.stats.total++;

    try {
      // Use rate limiter for scraping
      const result = await this.rateLimiter.queueRequest(
        domain,
        async () => {
          return await this.scraper.scrapeRecipe(recipeUrl);
        }
      );

      if (result.success && result) {
        this.stats.successful++;
        this.updateDomainStats(domain, true);

        // Upsert to database if enabled
        if (this.options.enableUpsert && this.databaseService && result.recipe) {
          try {
            await this.databaseService.saveRecipe(result.recipe);
            console.log(`✅ Recipe saved to database: ${result.recipe.title}`);
          } catch (dbError) {
            console.error(`❌ Database save failed: ${dbError}`);
          }
        }

        return result;
      } else {
        this.stats.failed++;
        this.updateDomainStats(domain, false);
        return result;
      }
    } catch (error) {
      this.stats.failed++;
      this.updateDomainStats(domain, false);
      this.handleError(error as Error, domain);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error', recipe: null, source: 'website', processingTime: 0 };
    }
  }

  /**
   * Batch scrape multiple recipe URLs
   */
  async batchScrape(
    urls: string[],
    batchSize: number = 5
  ): Promise<ScrapingResult[]> {
    const results: ScrapingResult[] = [];
    
    for (let i = 0; i < urls.length; i += batchSize) {
      const batch = urls.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(url => this.scrapeRecipe(url))
      );
      results.push(...batchResults);
      
      // Log progress
      const progress = Math.min(i + batchSize, urls.length);
      const successRate = (this.stats.successful / this.stats.total * 100).toFixed(2);
      console.log(`📊 Progress: ${progress}/${urls.length} | Success rate: ${successRate}%`);
    }
    
    return results;
  }

  /**
   * Check if URL is likely a recipe
   */
  private isRecipeUrl(url: string): boolean {
    const recipePatterns = [
      /\/recipe[s]?\//i,
      /\-recipe\-/i,
      /\/cooking\//i,
      /\/food\//i,
      /\/meal[s]?\//i,
      /\/dish(es)?\//i
    ];
    
    const excludePatterns = [
      /\/category\//i,
      /\/tag\//i,
      /\/author\//i,
      /\/about/i,
      /\/contact/i,
      /\/privacy/i,
      /\/search/i
    ];
    
    // Check if URL matches recipe patterns
    const isRecipe = recipePatterns.some(pattern => pattern.test(url));
    const isExcluded = excludePatterns.some(pattern => pattern.test(url));
    
    return isRecipe && !isExcluded;
  }

  /**
   * Update domain-specific statistics
   */
  private updateDomainStats(domain: string, success: boolean): void {
    const domainStats = this.stats.domains.get(domain) || { success: 0, failed: 0 };
    
    if (success) {
      domainStats.success++;
    } else {
      domainStats.failed++;
    }
    
    this.stats.domains.set(domain, domainStats);
  }

  /**
   * Handle and categorize errors
   */
  private handleError(error: Error, domain: string): void {
    let errorCategory = 'Unknown';
    
    if (error instanceof AxiosError) {
      if (error.response?.status === 429) {
        errorCategory = 'RateLimit';
      } else if (error.response?.status === 403) {
        errorCategory = 'Forbidden';
      } else if (error.response?.status === 404) {
        errorCategory = 'NotFound';
      } else if (error.response?.status && error.response.status >= 500) {
        errorCategory = 'ServerError';
      } else if (error.code === 'ECONNABORTED') {
        errorCategory = 'Timeout';
      } else if (error.code === 'ENOTFOUND') {
        errorCategory = 'DNSError';
      }
    }
    
    const count = this.stats.errors.get(errorCategory) || 0;
    this.stats.errors.set(errorCategory, count + 1);
    
    console.error(`❌ Error on ${domain}: ${errorCategory} - ${error.message}`);
  }

  /**
   * Get current statistics
   */
  getStats(): CrawlStats & { runtime: number; successRate: number } {
    const runtime = Date.now() - this.stats.startTime;
    const successRate = this.stats.total > 0 
      ? (this.stats.successful / this.stats.total) * 100 
      : 0;
    
    return {
      ...this.stats,
      runtime,
      successRate
    };
  }

  /**
   * Generate detailed report
   */
  generateReport(): string {
    const stats = this.getStats();
    const runtimeMinutes = (stats.runtime / 60000).toFixed(2);
    
    let report = `
=== Crawl Report ===
Runtime: ${runtimeMinutes} minutes
Total: ${stats.total}
Successful: ${stats.successful} (${stats.successRate.toFixed(2)}%)
Failed: ${stats.failed}
Rate Limited: ${stats.rateLimited}

Error Breakdown:
`;
    
    stats.errors.forEach((count, category) => {
      report += `  ${category}: ${count}\n`;
    });
    
    report += '\nDomain Performance:\n';
    stats.domains.forEach((domainStats, domain) => {
      const total = domainStats.success + domainStats.failed;
      const successRate = total > 0 ? (domainStats.success / total * 100).toFixed(2) : '0';
      report += `  ${domain}: ${domainStats.success}/${total} (${successRate}%)\n`;
    });
    
    return report;
  }
}
