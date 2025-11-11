/**
 * Unified Crawler with All Workarounds - Single, Modular, Reusable Architecture
 * Consolidates all crawler functionality with real-time error adaptation
 */

import { scrapeWebsite } from '../scrapers/websiteScraper.js';
import { BatchRecipeProcessor } from '../processor/BatchRecipeProcessor.js';
import ErrorTracker from '../utils/errorTracker.js';
import { addSiteConfig } from '../utils/robustFetch.js';
import {
  DEFAULT_SITE_CONFIG,
  ERROR_TYPES,
  ERROR_TYPE_MAP,
  ADAPTATION_STRATEGIES,
  CRAWLER_MODES,
  BATCH_CONSTANTS,
  ERROR_THRESHOLDS,
  LOG_SYMBOLS,
  type ErrorType,
  type CrawlerMode
} from '../shared/crawlerConstants.js';
import {
  parseWebsiteDataFromCSV,
  sortWebsitesByPriority,
  generateSampleRecipeUrls,
  initializeStatistics,
  generateProgressReport,
  generateFinalReport,
  sleep,
  chunkArray,
  type WebsiteData,
  type CrawlerStatistics
} from '../shared/crawlerHelpers.js';

export interface CrawlerOptions {
  mode?: CrawlerMode;
  maxSites?: number;
  maxRecipesPerSite?: number;
  batchSize?: number;
  progressReportInterval?: number;
  csvPaths?: string[];
  testUrls?: string[];
}

export interface CrawlerResult {
  success: boolean;
  processed: number;
  successful: number;
  successRate: number;
  reason?: string;
  recipes?: any[];
}

export class UnifiedCrawler {
  private errorTracker: ErrorTracker;
  private batchProcessor: BatchRecipeProcessor;
  private statistics: CrawlerStatistics;
  private adaptiveConfigs: Map<string, any>;
  private options: Required<CrawlerOptions>;

  constructor(options: CrawlerOptions = {}) {
    this.errorTracker = ErrorTracker.getInstance();
    this.batchProcessor = new BatchRecipeProcessor();
    this.statistics = initializeStatistics();
    this.adaptiveConfigs = new Map();
    
    // Set default options
    this.options = {
      mode: options.mode || CRAWLER_MODES.ADAPTIVE,
      maxSites: options.maxSites || Infinity,
      maxRecipesPerSite: options.maxRecipesPerSite || 100,
      batchSize: options.batchSize || BATCH_CONSTANTS.DEFAULT_BATCH_SIZE,
      progressReportInterval: options.progressReportInterval || BATCH_CONSTANTS.PROGRESS_REPORT_INTERVAL,
      csvPaths: options.csvPaths || [],
      testUrls: options.testUrls || []
    };

    console.log(`${LOG_SYMBOLS.INFO} Initialized Unified Crawler in ${this.options.mode} mode`);
  }

  /**
   * Dynamically adapt site-specific configuration based on errors
   */
  private adaptSiteConfig(domain: string, errorType: ErrorType): void {
    // Map error type to strategy key using ERROR_TYPE_MAP
    const strategyKey = typeof errorType === 'number' ? ERROR_TYPE_MAP[errorType as keyof typeof ERROR_TYPE_MAP] : ERROR_TYPE_MAP[errorType as keyof typeof ERROR_TYPE_MAP];
    const strategy = strategyKey ? ADAPTATION_STRATEGIES[ERROR_TYPES[strategyKey]] : undefined;
    
    if (!strategy) {
      console.log(`${LOG_SYMBOLS.WARNING} No adaptation strategy for error type: ${errorType}`);
      return;
    }

    this.statistics.adaptations++;
    
    const currentConfig = this.adaptiveConfigs.get(domain) || { ...DEFAULT_SITE_CONFIG };
    
    // Apply adaptation strategy
    const newConfig = { ...currentConfig };
    
    // Apply adaptation strategy consistently
    newConfig.minDelay = Math.max(strategy.minDelay, Math.floor(currentConfig.minDelay * strategy.delayMultiplier));
    newConfig.maxDelay = Math.max(strategy.maxDelay, Math.floor(currentConfig.maxDelay * strategy.delayMultiplier));
    newConfig.maxConcurrency = Math.max(1, Math.floor(currentConfig.maxConcurrency / strategy.concurrencyDivisor));
    
    // Keep current retry settings (no changes needed to maxRetries)

    console.log(`${LOG_SYMBOLS.ADAPTATION} ADAPTATION [${domain}]: ${strategy.description}`);
    console.log(`  → delays: ${newConfig.minDelay}-${newConfig.maxDelay}ms, concurrency: ${newConfig.maxConcurrency}`);
    
    this.adaptiveConfigs.set(domain, newConfig);
    addSiteConfig(domain, newConfig);
  }

  /**
   * Monitor errors and trigger immediate adaptations
   * Core workaround for preventing site blocking
   */
  private monitorAndAdapt(domain: string): boolean {
    const stats = this.errorTracker.getDomainStats(domain);
    if (!stats || stats.totalAttempts < ERROR_THRESHOLDS.MIN_ATTEMPTS_FOR_ADAPTATION) {
      return false;
    }
    
    const errorRate = (stats.totalAttempts - stats.successCount) / stats.totalAttempts;
    const blocked = stats.isBlocked;
    
    if (blocked) {
      console.log(`${LOG_SYMBOLS.BLOCKED} BLOCKED: ${domain} - Too many errors, skipping`);
      this.statistics.blockedSites++;
      return true; // Skip this site
    }
    
    // Immediate adaptation if error rate is high
    if (errorRate > ERROR_THRESHOLDS.HIGH_ERROR_RATE) {
      let primaryErrorType: ErrorType = ERROR_TYPES.UNKNOWN;
      
      if (stats.error429Count > stats.error403Count && stats.error429Count > stats.errorOtherCount) {
        primaryErrorType = ERROR_TYPES.RATE_LIMIT;
      } else if (stats.error403Count > stats.errorOtherCount) {
        primaryErrorType = ERROR_TYPES.FORBIDDEN;
      } else if (stats.errorOtherCount > 0) {
        primaryErrorType = ERROR_TYPES.CONNECTION;
      }
      
      console.log(`${LOG_SYMBOLS.WARNING} High error rate (${(errorRate * 100).toFixed(1)}%) for ${domain}`);
      this.adaptSiteConfig(domain, primaryErrorType);
    }
    
    return false; // Continue processing
  }

  /**
   * Crawl a single website with comprehensive error handling
   * Unified workaround combining all crawling strategies
   */
  private async crawlSingleWebsite(website: WebsiteData): Promise<CrawlerResult> {
    const { domain, name, url } = website;
    
    console.log(`\n${LOG_SYMBOLS.TEST} Crawling: ${name} (${domain})`);
    console.log(`${LOG_SYMBOLS.SITE} URL: ${url}`);
    console.log('-'.repeat(60));
    
    try {
      // Pre-crawl adaptation check
      const shouldSkip = this.monitorAndAdapt(domain);
      if (shouldSkip) {
        return { success: false, processed: 0, successful: 0, successRate: 0, reason: 'blocked' };
      }
      
      // Get URLs to test based on mode
      let urlsToTest: string[] = [];
      
      switch (this.options.mode) {
        case CRAWLER_MODES.TEST:
        case CRAWLER_MODES.SAMPLE:
          urlsToTest = generateSampleRecipeUrls(website, Math.min(5, this.options.maxRecipesPerSite));
          console.log(`${LOG_SYMBOLS.INFO} Testing ${urlsToTest.length} sample recipe patterns...`);
          break;
          
        case CRAWLER_MODES.FULL:
          // In full mode, we would use sitemap crawling - simplified here for consolidation
          urlsToTest = generateSampleRecipeUrls(website, this.options.maxRecipesPerSite);
          console.log(`${LOG_SYMBOLS.INFO} Full crawl mode - testing ${urlsToTest.length} URLs...`);
          break;
          
        case CRAWLER_MODES.ADAPTIVE:
        default:
          urlsToTest = generateSampleRecipeUrls(website, Math.min(3, this.options.maxRecipesPerSite));
          console.log(`${LOG_SYMBOLS.INFO} Adaptive mode - testing ${urlsToTest.length} URLs...`);
          break;
      }
      
      let processedCount = 0;
      let successCount = 0;
      const recipes: any[] = [];
      
      // Process URLs in batches
      const batches = chunkArray(urlsToTest, Math.min(this.options.batchSize, 10));
      
      for (const batch of batches) {
        // Check for adaptation before each batch
        const shouldSkipBatch = this.monitorAndAdapt(domain);
        if (shouldSkipBatch) break;
        
        for (const testUrl of batch) {
          try {
            console.log(`  ${LOG_SYMBOLS.TEST} Testing: ${testUrl}`);
            
            const recipe = await scrapeWebsite(testUrl);
            processedCount++;
            
            if (recipe && recipe.title) {
              successCount++;
              recipes.push(recipe);
              console.log(`  ${LOG_SYMBOLS.SUCCESS} SUCCESS: "${recipe.title}"`);
              console.log(`    • Ingredients: ${recipe.ingredients?.length || 0}`);
              console.log(`    • Instructions: ${recipe.instructions?.length || 0}`);
            } else {
              console.log(`  ${LOG_SYMBOLS.WARNING} PARTIAL: Recipe scraped but incomplete data`);
            }
            
          } catch (error: any) {
            processedCount++;
            console.log(`  ${LOG_SYMBOLS.FAILURE} FAILED: ${error.message}`);
            
            // Real-time error adaptation
            if (error.message.includes('429') || error.message.includes('rate limit')) {
              this.adaptSiteConfig(domain, ERROR_TYPES.RATE_LIMIT);
            } else if (error.message.includes('403') || error.message.includes('forbidden')) {
              this.adaptSiteConfig(domain, ERROR_TYPES.FORBIDDEN);
            } else if (error.message.includes('timeout')) {
              this.adaptSiteConfig(domain, ERROR_TYPES.TIMEOUT);
            } else {
              this.adaptSiteConfig(domain, ERROR_TYPES.UNKNOWN);
            }
          }
          
          // Small delay between requests
          await sleep(1000);
        }
        
        // Delay between batches
        if (batches.length > 1) {
          await sleep(BATCH_CONSTANTS.INTER_BATCH_DELAY);
        }
      }
      
      // Update statistics
      this.statistics.totalRecipes += processedCount;
      this.statistics.successfulRecipes += successCount;
      
      const successRate = processedCount > 0 ? (successCount / processedCount * 100) : 0;
      console.log(`\n${LOG_SYMBOLS.SUCCESS} ${name}: ${successCount}/${processedCount} recipes (${successRate.toFixed(1)}%)`);
      
      return {
        success: successCount > 0,
        processed: processedCount,
        successful: successCount,
        successRate: successRate,
        recipes: recipes
      };
      
    } catch (error: any) {
      console.error(`${LOG_SYMBOLS.ERROR} Fatal error crawling ${name}:`, error.message);
      
      // Final adaptation attempt
      if (error.message.includes('429')) {
        this.adaptSiteConfig(domain, ERROR_TYPES.RATE_LIMIT);
      } else if (error.message.includes('403')) {
        this.adaptSiteConfig(domain, ERROR_TYPES.FORBIDDEN);
      } else {
        this.adaptSiteConfig(domain, ERROR_TYPES.CONNECTION);
      }
      
      return { success: false, processed: 0, successful: 0, successRate: 0, reason: error.message };
    }
  }

  /**
   * Run unified crawler across websites from CSV data
   * Main entry point combining all crawler modes and workarounds
   */
  public async runCrawler(): Promise<void> {
    console.log(`${LOG_SYMBOLS.PROGRESS} Starting Unified Crawler with Real-time Error Adaptation\n`);
    console.log('=' .repeat(80) + '\n');
    
    let websites: WebsiteData[] = [];
    
    // Load websites from CSV or use test URLs
    if (this.options.csvPaths.length > 0) {
      websites = await parseWebsiteDataFromCSV(this.options.csvPaths);
      websites = sortWebsitesByPriority(websites);
    } else if (this.options.testUrls.length > 0) {
      // Convert test URLs to WebsiteData format
      websites = this.options.testUrls.map((url, index) => ({
        name: `Test Site ${index + 1}`,
        url: url,
        domain: new URL(url).hostname,
        category: 'Test Sites',
        priority: 1
      }));
    } else {
      throw new Error('No CSV paths or test URLs provided');
    }
    
    // Limit sites if specified
    if (this.options.maxSites < websites.length) {
      websites = websites.slice(0, this.options.maxSites);
      console.log(`${LOG_SYMBOLS.INFO} Limited to first ${this.options.maxSites} websites\n`);
    }
    
    this.statistics.totalSites = websites.length;
    console.log(`${LOG_SYMBOLS.INFO} Processing ${websites.length} websites in ${this.options.mode} mode...\n`);
    
    // Process websites in batches to avoid overwhelming
    const siteBatches = chunkArray(websites, BATCH_CONSTANTS.SITE_BATCH_SIZE);
    
    for (let batchIndex = 0; batchIndex < siteBatches.length; batchIndex++) {
      const batch = siteBatches[batchIndex];
      console.log(`\n${LOG_SYMBOLS.PROGRESS} Processing batch ${batchIndex + 1}/${siteBatches.length} (${batch.length} websites)...\n`);
      
      for (const website of batch) {
        const progress = `(${this.statistics.processedSites + 1}/${websites.length})`;
        console.log(`${LOG_SYMBOLS.SITE} ${progress} ${website.category}: ${website.name}`);
        
        const result = await this.crawlSingleWebsite(website);
        this.statistics.processedSites++;
        
        if (result.success) {
          this.statistics.successfulSites++;
          console.log(`${LOG_SYMBOLS.SUCCESS} SITE SUCCESS: ${result.successful}/${result.processed} recipes`);
        } else {
          console.log(`${LOG_SYMBOLS.FAILURE} SITE FAILED: ${result.reason || 'Unknown error'}`);
        }
        
        // Progress report at intervals
        if (this.statistics.processedSites % this.options.progressReportInterval === 0) {
          console.log(generateProgressReport(this.statistics));
        }
        
        // Inter-site delay
        await sleep(BATCH_CONSTANTS.INTER_SITE_DELAY);
      }
    }
    
    console.log('\n' + '=' .repeat(80));
    console.log(`${LOG_SYMBOLS.SUCCESS} Unified Crawler Complete!\n`);
    
    await this.generateFinalReport();
  }

  /**
   * Generate comprehensive final report
   */
  private async generateFinalReport(): Promise<void> {
    const errorReport = this.errorTracker.generateReport();
    const finalReport = generateFinalReport(this.statistics, errorReport);
    console.log(finalReport);
  }

  /**
   * Get current statistics
   */
  public getStatistics(): CrawlerStatistics {
    return { ...this.statistics };
  }

  /**
   * Get error tracker instance for external access
   */
  public getErrorTracker(): ErrorTracker {
    return this.errorTracker;
  }
}

// Export convenience function for easy usage
export async function runUnifiedCrawler(options: CrawlerOptions = {}): Promise<CrawlerStatistics> {
  const crawler = new UnifiedCrawler(options);
  await crawler.runCrawler();
  return crawler.getStatistics();
}
