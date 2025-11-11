/**
 * Production Batch Scraping Service
 * 
 * Consolidated service following SOLID/DRY/KISS/YAGNI principles
 * Combines functionality from scattered root-level batch scripts
 */

import * as path from 'path';
import { SCRAPING_CONFIG, FILE_PATHS, SUCCESS_MESSAGES, ERROR_MESSAGES, DATABASE_CONSTANTS } from '../shared/constants.js';
import { StringUtils, ValidationUtils, FileUtils, AsyncUtils, LoggingUtils, PerformanceUtils } from '../shared/utils.js';
import { Website, BatchResult, ScrapeResult, Recipe } from '../shared/types.js';
import { RecipeService, ServiceResult } from '../core/RecipeService.js';
import { scrapeWebsite } from '../scrapers/websiteScraper.js';
import { SitemapCrawler } from '../crawler/SitemapCrawler.js';

/**
 * Configuration for batch scraping operations
 */
export interface BatchScrapingConfig {
  maxConcurrency: number;
  timeoutMs: number;
  retryAttempts: number;
  progressReportInterval: number;
  saveResults: boolean;
  batchSize: number | undefined;
  enableHealthCheck: boolean;
  outputDirectory: string;
  logLevel: 'info' | 'warn' | 'error';
}

/**
 * Statistics for batch scraping operations
 */
export interface BatchStatistics {
  totalWebsites: number;
  processedWebsites: number;
  successfulWebsites: number;
  failedWebsites: number;
  totalRecipes: number;
  successfulRecipes: number;
  failedRecipes: number;
  overallSuccessRate: number;
  averageProcessingTime: number;
  startTime: string;
  endTime?: string;
  totalDuration?: number;
}

/**
 * Production-ready Batch Scraping Service
 * Consolidates all batch processing functionality into a single, reusable service
 */
export class BatchScrapingService {
  private config: BatchScrapingConfig;
  private recipeService: RecipeService;
  private crawler: SitemapCrawler;
  private statistics: BatchStatistics = {
    totalWebsites: 0,
    processedWebsites: 0,
    successfulWebsites: 0,
    failedWebsites: 0,
    totalRecipes: 0,
    successfulRecipes: 0,
    failedRecipes: 0,
    overallSuccessRate: 0,
    averageProcessingTime: 0,
    startTime: new Date().toISOString(),
    endTime: ''
  };

  constructor(config: Partial<BatchScrapingConfig> = {}) {
    this.config = {
      maxConcurrency: SCRAPING_CONFIG.MAX_CONCURRENT_REQUESTS,
      timeoutMs: SCRAPING_CONFIG.TIMEOUT_MS,
      retryAttempts: SCRAPING_CONFIG.RETRY_ATTEMPTS,
      progressReportInterval: SCRAPING_CONFIG.PROGRESS_REPORT_INTERVAL,
      saveResults: true,
      outputDirectory: FILE_PATHS.REPORTS_DIR,
      batchSize: DATABASE_CONSTANTS.BATCH_SIZE,
      enableHealthCheck: true,
      logLevel: 'info',
      ...config
    };

    this.recipeService = RecipeService.getInstance();
    this.crawler = new SitemapCrawler({});
    
    this.initializeStatistics();
  }

  /**
   * Process multiple websites in batch
   */
  async processBatch(websites: Website[]): Promise<BatchResult[]> {
    this.log('info', `Starting batch processing of ${websites.length} websites`);
    PerformanceUtils.startTimer('batch_processing');
    
    const results: BatchResult[] = [];
    const progressLogger = LoggingUtils.createProgressLogger(websites.length, 'Batch Processing');

    try {
      // Process websites with concurrency control
      const batches = this.createBatches(websites, this.config.maxConcurrency);
      
      for (const batch of batches) {
        const batchPromises = batch.map(website => 
          this.processWebsite(website).catch(error => ({
            website,
            results: [],
            success_count: 0,
            failure_count: 1,
            success_rate: 0,
            total_time: 0,
            errors: [error.message]
          }))
        );

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
        
        // Update progress
        batchResults.forEach(() => progressLogger.increment());
        
        // Add delay between batches to respect rate limits
        await AsyncUtils.sleep(SCRAPING_CONFIG.DEFAULT_DELAY_MS);
      }

      progressLogger.finish();
      this.finalizeStatistics(results);
      
      if (this.config.saveResults) {
        await this.saveResults(results);
      }

      this.log('info', `Batch processing completed: ${this.statistics.overallSuccessRate.toFixed(1)}% success rate`);
      return results;

    } catch (error) {
      this.log('error', 'Batch processing failed', error);
      throw error;
    } finally {
      const processingTime = PerformanceUtils.endTimer('batch_processing');
      this.statistics.totalDuration = processingTime;
      this.log('info', `Total processing time: ${processingTime}ms`);
    }
  }

  /**
   * Process a single website
   */
  async processWebsite(website: Website): Promise<BatchResult> {
    const websiteStartTime = Date.now();
    this.log('info', `Processing website: ${website.name}`);

    try {
      // Crawl website for recipe URLs
      const recipeUrls = await this.crawler.crawlWebsite(website);
      
      if (recipeUrls.length === 0) {
        return {
          website,
          results: [],
          success_count: 0,
          failure_count: 1,
          success_rate: 0,
          total_time: Date.now() - websiteStartTime,
          errors: ['No recipe URLs found']
        };
      }

      this.log('info', `Found ${recipeUrls.recipeUrls.length} recipe URLs for ${website.name}`);

      // Process recipes with concurrency control
      const recipeResults: ScrapeResult[] = [];
      const recipeBatches = this.createBatches(recipeUrls.recipeUrls, this.config.maxConcurrency);

      for (const recipeBatch of recipeBatches) {
        const batchPromises = recipeBatch.map(url => this.processRecipe(url as string, website));
        const results = await Promise.all(batchPromises);
        recipeResults.push(...results);
        
        // Add delay between recipe batches
        await AsyncUtils.sleep(500);
      }

      // Calculate statistics
      const successCount = recipeResults.filter(r => r.success).length;
      const failureCount = recipeResults.length - successCount;
      const successRate = recipeResults.length > 0 ? (successCount / recipeResults.length) : 0;

      // Update website statistics in database if needed
      await this.updateWebsiteStats(website, successRate, successCount + failureCount);

      return {
        website,
        results: recipeResults,
        success_count: successCount,
        failure_count: failureCount,
        success_rate: successRate,
        total_time: Date.now() - websiteStartTime,
        errors: recipeResults.filter(r => !r.success).map(r => r.error || 'Unknown error')
      };

    } catch (error) {
      this.log('error', `Failed to process website ${website.name}`, error);
      return {
        website,
        results: [],
        success_count: 0,
        failure_count: 1,
        success_rate: 0,
        total_time: Date.now() - websiteStartTime,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  /**
   * Process a single recipe URL
   */
  private async processRecipe(url: string, website: Website): Promise<ScrapeResult> {
    const startTime = Date.now();

    try {
      // Validate URL
      if (!ValidationUtils.isValidUrl(url)) {
        throw new Error('Invalid URL format');
      }

      // Scrape recipe with retry logic
      const rawRecipe = await AsyncUtils.retry(
        () => scrapeWebsite(url),
        this.config.retryAttempts
      );

      if (!rawRecipe) {
        throw new Error('Failed to scrape recipe');
      }

      // Process through recipe service if saving to database
      let serviceResult: ServiceResult | null = null;
      if (this.config.saveResults) {
        serviceResult = await this.recipeService.processRecipe(rawRecipe, url, true);
        
        if (!serviceResult.success) {
          throw new Error(serviceResult.error || 'Recipe processing failed');
        }
      }

      this.updateStatistics('success');
      
      return {
        success: true,
        recipe: serviceResult?.recipe,
        url,
        timestamp: new Date().toISOString(),
        processing_time: Date.now() - startTime
      };

    } catch (error) {
      this.updateStatistics('failure');
      this.log('warn', `Failed to process recipe: ${url}`, error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        url,
        timestamp: new Date().toISOString(),
        processing_time: Date.now() - startTime
      };
    }
  }

  /**
   * Load websites from CSV file
   */
  async loadWebsitesFromCSV(csvPath: string): Promise<Website[]> {
    try {
      const csvContent = FileUtils.readJsonFile<any[]>(csvPath);
      if (!csvContent) {
        throw new Error(`Failed to read CSV file: ${csvPath}`);
      }

      return csvContent.map((row, index) => ({
        id: index + 1,
        name: row.name || `Website ${index + 1}`,
        base_url: row.base_url || row.url,
        sitemap_url: row.sitemap_url || row.sitemap,
        sub_sitemaps: row.sub_sitemaps ? row.sub_sitemaps.split(';') : [],
        category: row.category || 'General',
        priority: row.priority || 5,
        active: row.active !== false,
        notes: row.notes
      }));
    } catch (error) {
      this.log('error', 'Failed to load websites from CSV', error);
      throw error;
    }
  }

  /**
   * Save batch results to files
   */
  private async saveResults(results: BatchResult[]): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = path.join(this.config.outputDirectory, `batch-report-${timestamp}.json`);
    const statsPath = path.join(this.config.outputDirectory, `batch-stats-${timestamp}.json`);

    try {
      FileUtils.ensureDirectory(this.config.outputDirectory);
      
      // Save detailed results
      FileUtils.writeJsonFile(reportPath, {
        timestamp: new Date().toISOString(),
        statistics: this.statistics,
        results: results.map(result => ({
          website: result.website.name,
          success_count: result.success_count,
          failure_count: result.failure_count,
          success_rate: result.success_rate,
          total_time: result.total_time,
          errors: result.errors
        }))
      });

      // Save statistics summary
      FileUtils.writeJsonFile(statsPath, this.statistics);

      this.log('info', `Results saved to ${reportPath}`);
      this.log('info', `Statistics saved to ${statsPath}`);
    } catch (error) {
      this.log('error', 'Failed to save results', error);
    }
  }

  /**
   * Get current batch statistics
   */
  getStatistics(): BatchStatistics {
    return { ...this.statistics };
  }

  /**
   * Private helper methods
   */
  private initializeStatistics(): void {
    this.statistics = {
      totalWebsites: 0,
      processedWebsites: 0,
      successfulWebsites: 0,
      failedWebsites: 0,
      totalRecipes: 0,
      successfulRecipes: 0,
      failedRecipes: 0,
      overallSuccessRate: 0,
      averageProcessingTime: 0,
      startTime: new Date().toISOString()
    };
  }

  private updateStatistics(result: 'success' | 'failure'): void {
    this.statistics.totalRecipes++;
    if (result === 'success') {
      this.statistics.successfulRecipes++;
    } else {
      this.statistics.failedRecipes++;
    }
  }

  private finalizeStatistics(results: BatchResult[]): void {
    this.statistics.endTime = new Date().toISOString();
    this.statistics.totalWebsites = results.length;
    this.statistics.processedWebsites = results.length;
    this.statistics.successfulWebsites = results.filter(r => r.success_rate > 0).length;
    this.statistics.failedWebsites = results.filter(r => r.success_rate === 0).length;
    
    const totalTime = results.reduce((sum, r) => sum + r.total_time, 0);
    this.statistics.averageProcessingTime = results.length > 0 ? totalTime / results.length : 0;
    
    this.statistics.overallSuccessRate = this.statistics.totalRecipes > 0 
      ? (this.statistics.successfulRecipes / this.statistics.totalRecipes) * 100 
      : 0;
  }

  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  private async updateWebsiteStats(website: Website, successRate: number, totalRecipes: number): Promise<void> {
    // Implementation would update website statistics in database
    // This is a placeholder for the actual database update logic
  }

  private log(level: 'info' | 'warn' | 'error', message: string, data?: any): void {
    if (this.shouldLog(level)) {
      LoggingUtils.log(level, `[BatchScrapingService] ${message}`, data);
    }
  }

  private shouldLog(level: 'info' | 'warn' | 'error'): boolean {
    const levels = ['info', 'warn', 'error'];
    const configLevel = levels.indexOf(this.config.logLevel);
    const messageLevel = levels.indexOf(level);
    return messageLevel >= configLevel;
  }
}

/**
 * Factory for creating batch scraping service instances
 */
export class BatchScrapingServiceFactory {
  static createDefault(): BatchScrapingService {
    return new BatchScrapingService();
  }

  static createWithConfig(config: Partial<BatchScrapingConfig>): BatchScrapingService {
    return new BatchScrapingService(config);
  }

  static createForTesting(): BatchScrapingService {
    return new BatchScrapingService({
      maxConcurrency: 1,
      timeoutMs: 5000,
      retryAttempts: 1,
      saveResults: false,
      logLevel: 'error'
    });
  }
}
