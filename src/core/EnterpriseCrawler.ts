/**
 * Enterprise-Grade Crawlee-Based Recipe Scraper
 * Unified interface for HTTP and headless browser crawling with enterprise features
 */

import { 
  CheerioCrawler, 
  PlaywrightCrawler, 
  Dataset, 
  RequestQueue,
  ProxyConfiguration,
  SessionPool,
  Configuration,
  log,
  CheerioCrawlingContext,
  PlaywrightCrawlingContext
} from 'crawlee';
import { CheerioAPI } from 'cheerio';
import { Page } from 'playwright';
import { EnterpriseConfig } from '../infrastructure/EnterpriseConfig.js';
import { ComplianceManager, ComplianceResult } from '../infrastructure/ComplianceManager.js';
import { RawScrapedRecipe } from '../shared/types.js';
import { QualityAssuranceManager } from './QualityAssuranceManager.js';
import { RateLimitManager } from './RateLimitManager.js';

export interface CrawlRequest {
  url: string;
  userData?: {
    recipeId?: string;
    source?: string;
    priority?: number;
    retries?: number;
  };
}

export interface CrawlResult {
  success: boolean;
  data?: RawScrapedRecipe;
  error?: string;
  metadata: {
    processingTime: number;
    method: 'static' | 'dynamic';
    compliance: ComplianceResult;
    quality: {
      score: number;
      issues: string[];
    };
  };
}

export interface CrawlStats {
  totalRequests: number;
  successfulScrapes: number;
  failedScrapes: number;
  averageProcessingTime: number;
  complianceBlocked: number;
  qualityIssues: number;
  methodsUsed: {
    static: number;
    dynamic: number;
  };
}

/**
 * Enterprise-grade crawler that automatically chooses between static (Cheerio) 
 * and dynamic (Playwright) scraping based on content requirements
 */
export class EnterpriseCrawler {
  private config: EnterpriseConfig;
  private complianceManager: ComplianceManager;
  private qualityManager: QualityAssuranceManager;
  private rateLimitManager: RateLimitManager;
  private requestQueue: RequestQueue | undefined;
  private dataset: Dataset | undefined;
  private sessionPool: SessionPool | undefined;
  private proxyConfiguration?: ProxyConfiguration;
  private stats: CrawlStats;

  // User agents for rotation
  private userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:89.0) Gecko/20100101 Firefox/89.0'
  ];

  constructor(config: EnterpriseConfig) {
    this.config = config;
    this.complianceManager = new ComplianceManager(config);
    this.qualityManager = new QualityAssuranceManager(config);
    this.rateLimitManager = new RateLimitManager(config);
    
    this.stats = {
      totalRequests: 0,
      successfulScrapes: 0,
      failedScrapes: 0,
      averageProcessingTime: 0,
      complianceBlocked: 0,
      qualityIssues: 0,
      methodsUsed: { static: 0, dynamic: 0 }
    };

    this.initializeCrawlee();
  }

  /**
   * Initialize Crawlee configuration and components
   */
  private async initializeCrawlee(): Promise<void> {
    // Configure Crawlee with enterprise settings
    Configuration.set('logLevel', this.config.logLevel);

    // Initialize request queue
    this.requestQueue = await RequestQueue.open('enterprise-recipe-queue');
    
    // Initialize dataset for results
    this.dataset = await Dataset.open('enterprise-recipe-results');

    // Initialize session pool for user agent rotation
    this.sessionPool = new SessionPool({
      maxPoolSize: this.config.crawling.maxConcurrency * 2,
      sessionOptions: {
        maxUsageCount: 50, // Rotate sessions frequently
      },
    });

    // Configure proxy rotation if enabled
    if (this.config.evasion.useResidentialProxies && this.config.crawling.enableProxyRotation) {
      this.proxyConfiguration = new ProxyConfiguration({
        // In production, configure with actual proxy providers
        // proxyUrls: ['http://proxy1:8000', 'http://proxy2:8000'],
      });
    }

    log.info('Enterprise crawler initialized successfully');
  }

  /**
   * Crawl a single URL with automatic method selection
   */
  async crawlUrl(request: CrawlRequest): Promise<CrawlResult> {
    const startTime = Date.now();
    this.stats.totalRequests++;

    try {
      // Check compliance first
      const compliance = await this.complianceManager.checkCompliance(request.url);
      
      if (!compliance.canScrape) {
        this.stats.complianceBlocked++;
        console.error(`EnterpriseCrawler batch crawling failed: ${compliance.restrictions.join(', ')}`);
        return {
          success: false,
          error: `Compliance check failed: ${compliance.restrictions.join(', ')}`,
          metadata: {
            processingTime: Date.now() - startTime,
            method: 'static',
            compliance,
            quality: { score: 0, issues: ['Compliance blocked'] }
          }
        };
      }

      // Apply rate limiting
      await this.rateLimitManager.waitForSlot(request.url);

      // Determine scraping method
      const useJavaScript = this.shouldUseJavaScript(request.url);
      const method = useJavaScript ? 'dynamic' : 'static';
      this.stats.methodsUsed[method]++;

      // Perform scraping
      const scrapedData = useJavaScript 
        ? await this.scrapeWithPlaywright(request)
        : await this.scrapeWithCheerio(request);

      if (!scrapedData) {
        this.stats.failedScrapes++;
        return {
          success: false,
          error: 'Failed to extract recipe data',
          metadata: {
            processingTime: Date.now() - startTime,
            method,
            compliance,
            quality: { score: 0, issues: ['No data extracted'] }
          }
        };
      }

      // Basic quality check for raw scraped data
      const qualityResult = {
        score: scrapedData.title && scrapedData.ingredients.length > 0 ? 0.8 : 0.3,
        issues: scrapedData.ingredients.length === 0 ? ['No ingredients found'] : []
      };
      
      if (qualityResult.score < this.config.quality.minDataCompleteness) {
        this.stats.qualityIssues++;
      }

      this.stats.successfulScrapes++;
      const processingTime = Date.now() - startTime;
      this.updateAverageProcessingTime(processingTime);

      return {
        success: true,
        data: scrapedData,
        metadata: {
          processingTime,
          method,
          compliance,
          quality: qualityResult
        }
      };

    } catch (error) {
      this.stats.failedScrapes++;
      log.error(`Crawling failed for ${request.url}`, { message: (error as Error).message });
      
      return {
        success: false,
        error: String(error),
        metadata: {
          processingTime: Date.now() - startTime,
          method: 'static',
          compliance: { canScrape: false, recommendedDelay: 0, sitemaps: [], warnings: [], restrictions: [String(error)] },
          quality: { score: 0, issues: ['Crawling error'] }
        }
      };
    }
  }

  /**
   * Batch crawl multiple URLs with enterprise optimizations
   */
  async crawlBatch(requests: CrawlRequest[]): Promise<CrawlResult[]> {
    log.info(`Starting batch crawl of ${requests.length} URLs`);

    // Add requests to queue
    for (const request of requests) {
      await this.requestQueue?.addRequest({
        url: request.url,
        userData: request.userData,
      });
    }

    const results: CrawlResult[] = [];
    const crawler = this.createBatchCrawler(results);

    await crawler.run();
    
    log.info(`Batch crawl completed. Success rate: ${(this.stats.successfulScrapes / this.stats.totalRequests * 100).toFixed(1)}%`);
    
    return results;
  }

  /**
   * Create a batch crawler with enterprise features
   */
  private createBatchCrawler(results: CrawlResult[]) {
    return new CheerioCrawler({
      requestQueue: this.requestQueue,
      useSessionPool: true,
      proxyConfiguration: this.proxyConfiguration,
      maxConcurrency: this.config.crawling.maxConcurrency,
      maxRequestRetries: this.config.crawling.maxRetries,
      requestHandlerTimeoutSecs: this.config.crawling.requestTimeout / 1000,
      
      preNavigationHooks: [
        async (crawlingContext) => {
          // Apply rate limiting
          await this.rateLimitManager.waitForSlot(crawlingContext.request.url);
          
          // Randomize headers if enabled
          if (this.config.evasion.randomizeHeaders) {
            const randomUserAgent = this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
            crawlingContext.request.headers = {
              ...crawlingContext.request.headers,
              'User-Agent': randomUserAgent,
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.5',
              'Accept-Encoding': 'gzip, deflate',
              'DNT': '1',
              'Connection': 'keep-alive',
              'Upgrade-Insecure-Requests': '1',
            };
          }
        }
      ],
      
      requestHandler: async (context) => {
        const { request, $ } = context;
        const startTime = Date.now();
        
        try {
          // Check if we need to fall back to Playwright
          if (this.requiresJavaScript($)) {
            const playWrightResult = await this.scrapeWithPlaywright({ url: request.url, userData: request.userData });
            if (playWrightResult) {
              const result = await this.processSuccessfulScrape(playWrightResult, startTime, 'dynamic', request.url);
              results.push(result);
              return;
            }
          }

          // Proceed with Cheerio scraping
          const scrapedData = await this.extractRecipeData($, request.url);
          if (scrapedData) {
            const result = await this.processSuccessfulScrape(scrapedData, startTime, 'static', request.url);
            results.push(result);
          } else {
            results.push(this.createFailureResult('No recipe data found', startTime, 'static', request.url));
          }

        } catch (error) {
          log.error(`Handler error for ${request.url}`, { message: (error as Error).message });
          results.push(this.createFailureResult((error as Error).message, startTime, 'static', request.url));
        }
      },

      failedRequestHandler: async (context) => {
        const { request } = context;
        log.error(`Request failed: ${request.url}`);
        results.push(this.createFailureResult('Request failed', Date.now(), 'static', request.url));
      }
    });
  }

  /**
   * Scrape using Cheerio (static content)
   */
  private async scrapeWithCheerio(request: CrawlRequest): Promise<RawScrapedRecipe | null> {
    const dataset = await Dataset.open();
    
    const crawler = new CheerioCrawler({
      maxConcurrency: 1,
      maxRequestRetries: this.config.crawling.maxRetries,
      requestHandlerTimeoutSecs: this.config.crawling.requestTimeout / 1000,
      useSessionPool: true,
      requestHandler: async ({ $, request }) => {
        const result = await this.extractRecipeData($, request.url);
        if (result) {
          await dataset.pushData(result);
        }
      }
    });

    await crawler.addRequests([{ url: request.url }]);
    await crawler.run();
    
    const { items } = await dataset.getData();
    return items.length > 0 ? items[0] as RawScrapedRecipe : null;
  }

  /**
   * Scrape using Playwright (dynamic content)
   */
  private async scrapeWithPlaywright(request: CrawlRequest): Promise<RawScrapedRecipe | null> {
    const dataset = await Dataset.open();
    
    const crawler = new PlaywrightCrawler({
      maxConcurrency: Math.min(this.config.crawling.maxConcurrency, 3),
      maxRequestRetries: this.config.crawling.maxRetries,
      requestHandlerTimeoutSecs: this.config.crawling.requestTimeout / 1000,
      useSessionPool: true,
      launchContext: {
        useChrome: true,
      },
      requestHandler: async ({ page, request }) => {
        const result = await this.extractRecipeDataFromPage(page, request.url);
        if (result) {
          await dataset.pushData(result);
        }
      }
    });

    await crawler.addRequests([{ url: request.url }]);
    await crawler.run();
    
    const { items } = await dataset.getData();
    return items.length > 0 ? items[0] as RawScrapedRecipe : null;
  }

  /**
   * Extract recipe data using Cheerio
   */
  private async extractRecipeData($: any, url: string): Promise<RawScrapedRecipe | null> {
    try {
      // Try JSON-LD first
      const jsonLd = $('script[type="application/ld+json"]').first().html();
      if (jsonLd) {
        const parsed = JSON.parse(jsonLd);
        const recipe = Array.isArray(parsed) ? parsed.find(item => item['@type'] === 'Recipe') : 
                     parsed['@type'] === 'Recipe' ? parsed : null;
        
        if (recipe) {
          return this.convertJsonLdToRawRecipe(recipe, url);
        }
      }

      // Fallback to microdata/HTML parsing
      return this.extractFromHTML($, url);

    } catch (error) {
      log.error(`Recipe extraction error for ${url}`, { message: (error as Error).message });
      return null;
    }
  }

  /**
   * Extract recipe data from Playwright page
   */
  private async extractRecipeDataFromPage(page: Page, url: string): Promise<RawScrapedRecipe | null> {
    try {
      // Wait for content to load
      await page.waitForLoadState('networkidle');
      
      // Try to find JSON-LD
      const jsonLd = await page.$eval('script[type="application/ld+json"]', 
        el => el.textContent).catch(() => null);
      
      if (jsonLd) {
        const parsed = JSON.parse(jsonLd);
        const recipe = Array.isArray(parsed) ? parsed.find(item => item['@type'] === 'Recipe') : 
                     parsed['@type'] === 'Recipe' ? parsed : null;
        
        if (recipe) {
          return this.convertJsonLdToRawRecipe(recipe, url);
        }
      }

      // Fallback to DOM extraction
      const content = await page.content();
      const cheerio = await import('cheerio');
      const $ = cheerio.load(content);
      return this.extractFromHTML($, url);

    } catch (error) {
      log.error(`Playwright extraction error for ${url}`, { message: (error as Error).message });
      return null;
    }
  }

  /**
   * Determine if JavaScript rendering is needed
   */
  private shouldUseJavaScript(url: string): boolean {
    if (!this.config.crawling.enableJavaScript) return false;

    // Sites known to require JavaScript
    const jsRequiredDomains = [
      'react-recipe-site.com',
      'spa-cooking.com',
      'dynamic-recipes.com'
    ];

    const domain = new URL(url).hostname;
    return jsRequiredDomains.some(jsRequired => domain.includes(jsRequired));
  }

  /**
   * Check if page requires JavaScript (called from Cheerio handler)
   */
  private requiresJavaScript($: any): boolean {
    // Check for common SPA indicators
    const indicators = [
      $('div[id="root"]').length > 0,
      $('div[id="app"]').length > 0,
      $('script').text().includes('React'),
      $('script').text().includes('Vue'),
      $('script').text().includes('Angular'),
      $('.recipe-content').length === 0 && $('script').length > 5
    ];

    return indicators.some(Boolean);
  }

  /**
   * Convert JSON-LD recipe to RawScrapedRecipe format
   */
  private convertJsonLdToRawRecipe(jsonLd: any, sourceUrl: string): RawScrapedRecipe {
    return {
      title: jsonLd.name || '',
      description: jsonLd.description || '',
      ingredients: Array.isArray(jsonLd.recipeIngredient) ? jsonLd.recipeIngredient : [],
      instructions: Array.isArray(jsonLd.recipeInstructions) 
        ? jsonLd.recipeInstructions.map((inst: any) => typeof inst === 'string' ? inst : inst.text || inst.name || '')
        : [],
      prep_time: this.parseTime(jsonLd.prepTime) ?? undefined,
      cook_time: this.parseTime(jsonLd.cookTime) ?? undefined,
      total_time: this.parseTime(jsonLd.totalTime) ?? undefined,
      servings: jsonLd.recipeYield || jsonLd.yield || null,
      image_url: typeof jsonLd.image === 'string' ? jsonLd.image : 
                Array.isArray(jsonLd.image) ? jsonLd.image[0] : 
                jsonLd.image?.url || null,
      source_url: sourceUrl,
      nutrition: jsonLd.nutrition ? {
        protein_g: this.parseNutritionValue(jsonLd.nutrition.proteinContent),
        carbohydrates_g: this.parseNutritionValue(jsonLd.nutrition.carbohydrateContent),
        fat_g: this.parseNutritionValue(jsonLd.nutrition.fatContent),
        fiber_g: this.parseNutritionValue(jsonLd.nutrition.fiberContent),
        sugar_g: this.parseNutritionValue(jsonLd.nutrition.sugarContent),
        sodium_mg: this.parseNutritionValue(jsonLd.nutrition.sodiumContent),
      } : undefined
    };
  }

  /**
   * Extract recipe from HTML using selectors
   */
  private extractFromHTML($: CheerioAPI, url: string): RawScrapedRecipe | null {
    // Implementation would include comprehensive selector-based extraction
    // This is a simplified version
    const title = $('h1').first().text().trim() || $('.recipe-title').first().text().trim();
    const description = $('.recipe-description').first().text().trim() || $('meta[name="description"]').attr('content');
    
    if (!title) return null;

    return {
      title,
      description: description || '',
      ingredients: [],
      instructions: [],
      source_url: url,
    };
  }

  /**
   * Parse duration strings to minutes
   */
  private parseTime(timeStr?: string): number | null {
    if (!timeStr) return null;
    
    // ISO 8601 duration parsing (PT30M, PT1H30M, etc.)
    const match = timeStr.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
    if (match) {
      const hours = parseInt(match[1] || '0');
      const minutes = parseInt(match[2] || '0');
      return hours * 60 + minutes;
    }
    
    return null;
  }

  /**
   * Parse nutrition values
   */
  private parseNutritionValue(value: string | undefined): number | null {
    if (!value) return null;
    if (typeof value === 'number') return value;
    
    const numMatch = value.toString().match(/(\d+(?:\.\d+)?)/);
    return numMatch ? parseFloat(numMatch[1]) : null;
  }

  /**
   * Process successful scrape result
   */
  private async processSuccessfulScrape(
    data: RawScrapedRecipe, 
    startTime: number, 
    method: 'static' | 'dynamic', 
    url: string
  ): Promise<CrawlResult> {
    const compliance = await this.complianceManager.checkCompliance(url);
    // Basic quality check for raw scraped data 
    const quality = {
      score: data.title && data.ingredients.length > 0 ? 0.8 : 0.3,
      issues: data.ingredients.length === 0 ? ['No ingredients found'] : []
    };
    
    this.stats.successfulScrapes++;
    const processingTime = Date.now() - startTime;
    this.updateAverageProcessingTime(processingTime);

    return {
      success: true,
      data,
      metadata: {
        processingTime,
        method,
        compliance,
        quality
      }
    };
  }

  /**
   * Create failure result
   */
  private createFailureResult(error: string, startTime: number, method: 'static' | 'dynamic', url: string): CrawlResult {
    this.stats.failedScrapes++;
    
    return {
      success: false,
      error,
      metadata: {
        processingTime: Date.now() - startTime,
        method,
        compliance: { canScrape: false, recommendedDelay: 0, sitemaps: [], warnings: [], restrictions: [error] },
        quality: { score: 0, issues: ['Scraping failed'] }
      }
    };
  }

  /**
   * Update average processing time
   */
  private updateAverageProcessingTime(processingTime: number): void {
    const totalProcessedTime = this.stats.averageProcessingTime * (this.stats.successfulScrapes - 1);
    this.stats.averageProcessingTime = (totalProcessedTime + processingTime) / this.stats.successfulScrapes;
  }

  /**
   * Get current crawling statistics
   */
  getStats(): CrawlStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalRequests: 0,
      successfulScrapes: 0,
      failedScrapes: 0,
      averageProcessingTime: 0,
      complianceBlocked: 0,
      qualityIssues: 0,
      methodsUsed: { static: 0, dynamic: 0 }
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    await this.requestQueue?.drop();
    await this.dataset?.drop();
    this.complianceManager.clearExpiredCache();
    log.info('Enterprise crawler cleanup completed');
  }
}
