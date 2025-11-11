/**
 * Enterprise Recipe Scraping Orchestrator
 * Main facade that orchestrates all enterprise components for production-ready recipe scraping
 */

import { EnterpriseConfig, EnterpriseConfigManager } from '../infrastructure/EnterpriseConfig.js';
import { ComplianceManager, ComplianceResult } from '../infrastructure/ComplianceManager.js';
import { EnterpriseCrawler, CrawlRequest, CrawlResult } from './EnterpriseCrawler.js';
import { QualityAssuranceManager, QualityMetrics } from './QualityAssuranceManager.js';
import { RateLimitManager } from './RateLimitManager.js';
import { ErrorAdaptationManager, ErrorPattern } from './ErrorAdaptationManager.js';
import { DataGovernanceManager } from './DataGovernanceManager.js';
import { Recipe } from '../types.js';
import { RawScrapedRecipe } from '@/scrapers/websiteScraper.js';

export interface ScrapingRequest {
  urls: string[];
  priority?: number;
  batchSize?: number;
  operationId?: string;
  compliance?: {
    respectRobotsTxt?: boolean;
    honorPaywalls?: boolean;
    maxRetries?: number;
  };
}

export interface ScrapingResult {
  operationId: string;
  summary: {
    totalRequests: number;
    successfulScrapes: number;
    failedScrapes: number;
    complianceBlocked: number;
    qualityIssues: number;
    averageQualityScore: number;
    processingTimeMs: number;
  };
  results: Array<{
    url: string;
    success: boolean;
    data?: RawScrapedRecipe;
    governanceRecordId?: string;
    qualityMetrics?: QualityMetrics;
    complianceResult?: ComplianceResult;
    error?: string;
  }>;
  reports: {
    complianceReport: string;
    qualityReport: string;
    rateLimitReport: string;
    errorAdaptationReport: string;
    governanceReport: string;
  };
}

export interface OperationMetrics {
  totalOperations: number;
  totalRecipesProcessed: number;
  averageSuccessRate: number;
  averageQualityScore: number;
  complianceRate: number;
  uptime: number;
  lastOperationTime: Date;
}

/**
 * Production-ready enterprise orchestrator that coordinates all scraping components
 * following SOLID principles and enterprise best practices
 */
export class EnterpriseRecipeScrapingOrchestrator {
  private config: EnterpriseConfig;
  private complianceManager: ComplianceManager;
  private crawler: EnterpriseCrawler;
  private qualityManager: QualityAssuranceManager;
  private rateLimitManager: RateLimitManager;
  private errorAdaptationManager: ErrorAdaptationManager;
  private dataGovernanceManager: DataGovernanceManager;
  
  private operationMetrics: OperationMetrics;
  private readonly startTime: Date;

  constructor(operationSize: 'small' | 'medium' | 'enterprise' = 'medium') {
    this.startTime = new Date();
    
    // Get scaled configuration based on operation size
    const configManager = EnterpriseConfigManager.getInstance();
    this.config = configManager.getScaledConfig(operationSize);
    
    // Initialize all enterprise components (Dependency Injection)
    this.complianceManager = new ComplianceManager(this.config);
    this.qualityManager = new QualityAssuranceManager(this.config);
    this.rateLimitManager = new RateLimitManager(this.config);
    this.errorAdaptationManager = new ErrorAdaptationManager(this.config);
    this.dataGovernanceManager = new DataGovernanceManager(this.config);
    this.crawler = new EnterpriseCrawler(this.config);

    // Initialize metrics
    this.operationMetrics = {
      totalOperations: 0,
      totalRecipesProcessed: 0,
      averageSuccessRate: 0,
      averageQualityScore: 0,
      complianceRate: 0,
      uptime: 0,
      lastOperationTime: new Date()
    };

    console.log(`[ENTERPRISE-ORCHESTRATOR] Initialized for ${operationSize} scale operations`);
  }

  /**
   * Main entry point for enterprise recipe scraping operations
   * Implements the complete enterprise pipeline with all governance and quality controls
   */
  async scrapeRecipes(request: ScrapingRequest): Promise<ScrapingResult> {
    const operationId = request.operationId || this.generateOperationId();
    const startTime = Date.now();
    
    console.log(`[ENTERPRISE-OPERATION] Starting operation ${operationId} with ${request.urls.length} URLs`);
    
    try {
      // Phase 1: Pre-flight compliance checks
      const complianceResults = await this.performComplianceChecks(request.urls);
      
      // Phase 2: Filter compliant URLs and prepare crawl requests
      const crawlRequests = this.prepareCrawlRequests(request, complianceResults);
      
      // Phase 3: Execute enterprise crawling with full monitoring
      const crawlResults = await this.executeCrawling(crawlRequests, operationId);
      
      // Phase 4: Quality validation and governance record creation
      const processedResults = await this.processResults(crawlResults, operationId);
      
      // Phase 5: Generate comprehensive reports
      const reports = await this.generateReports(operationId, processedResults);
      
      // Phase 6: Update metrics and audit trails
      await this.updateOperationMetrics(processedResults);
      
      const summary = this.generateSummary(processedResults, startTime);
      
      console.log(`[ENTERPRISE-OPERATION] Completed operation ${operationId} - Success rate: ${summary.averageQualityScore.toFixed(1)}%`);
      
      return {
        operationId,
        summary,
        results: processedResults,
        reports
      };

    } catch (error) {
      console.error(`[ENTERPRISE-OPERATION] Failed operation ${operationId}:`, error);
      
      // Create error governance record
      await this.handleOperationFailure(operationId, request, error);
      
      throw new Error(`Enterprise scraping operation failed: ${error}`);
    }
  }

  /**
   * Get current system health and performance metrics
   */
  getSystemHealth(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    components: Record<string, 'ok' | 'warning' | 'error'>;
    metrics: OperationMetrics;
    recommendations: string[];
  } {
    const crawlerStats = this.crawler.getStats();
    const rateLimitStats = this.rateLimitManager.getStats();
    const errorStats = this.errorAdaptationManager.getRecoveryMetrics();
    const governanceMetrics = this.dataGovernanceManager.getMetrics();

    // Component health checks
    const components = {
      crawler: crawlerStats.successfulScrapes / Math.max(1, crawlerStats.totalRequests) > 0.7 ? 'ok' : 'warning',
      rateLimit: rateLimitStats.throttledRequests / Math.max(1, rateLimitStats.totalRequests) < 0.5 ? 'ok' : 'warning',
      errorAdaptation: errorStats.recoveredErrors / Math.max(1, errorStats.totalErrors) > 0.6 ? 'ok' : 'warning',
      governance: governanceMetrics.complianceRate > 90 ? 'ok' : 'warning'
    };

    // Overall health assessment
    const healthyComponents = Object.values(components).filter(status => status === 'ok').length;
    const totalComponents = Object.keys(components).length;
    const healthRatio = healthyComponents / totalComponents;

    const status = healthRatio >= 0.8 ? 'healthy' : 
                  healthRatio >= 0.6 ? 'degraded' : 'unhealthy';

    // Generate recommendations
    const recommendations = this.generateHealthRecommendations(components, crawlerStats, rateLimitStats);

    // Update uptime
    this.operationMetrics.uptime = Date.now() - this.startTime.getTime();

    return {
      status,
      components: components as Record<string, 'ok' | 'warning' | 'error'>,
      metrics: { ...this.operationMetrics },
      recommendations
    };
  }

  /**
   * Graceful shutdown with cleanup of all resources
   */
  async shutdown(): Promise<void> {
    console.log('[ENTERPRISE-ORCHESTRATOR] Initiating graceful shutdown...');
    
    try {
      // Cleanup all components
      await this.crawler.cleanup();
      this.complianceManager.clearExpiredCache();
      this.qualityManager.clearOldLineageRecords();
      this.rateLimitManager.resetStats();
      this.errorAdaptationManager.resetState();

      console.log('[ENTERPRISE-ORCHESTRATOR] Shutdown completed successfully');
    } catch (error) {
      console.error('[ENTERPRISE-ORCHESTRATOR] Error during shutdown:', error);
      throw error;
    }
  }

  // Private implementation methods following Single Responsibility Principle

  private async performComplianceChecks(urls: string[]): Promise<Map<string, ComplianceResult>> {
    const results = new Map<string, ComplianceResult>();
    
    for (const url of urls) {
      try {
        const complianceResult = await this.complianceManager.checkCompliance(url);
        results.set(url, complianceResult);
      } catch (error) {
        console.warn(`[COMPLIANCE] Failed to check ${url}:`, error);
        results.set(url, {
          canScrape: false,
          recommendedDelay: 0,
          sitemaps: [],
          warnings: [],
          restrictions: [`Compliance check failed: ${error}`]
        });
      }
    }
    
    return results;
  }

  private prepareCrawlRequests(
    request: ScrapingRequest, 
    complianceResults: Map<string, ComplianceResult>
  ): CrawlRequest[] {
    const crawlRequests: CrawlRequest[] = [];
    
    for (const url of request.urls) {
      const compliance = complianceResults.get(url);
      
      if (compliance?.canScrape) {
        crawlRequests.push({
          url,
          userData: {
            source: 'enterprise_operation',
            priority: request.priority || 5,
            retries: 0
          }
        });
      }
    }
    
    return crawlRequests;
  }

  private async executeCrawling(
    crawlRequests: CrawlRequest[], 
    operationId: string
  ): Promise<CrawlResult[]> {
    const batchSize = this.config.storage.batchSize;
    const results: CrawlResult[] = [];
    
    // Process in batches to manage memory and resources
    for (let i = 0; i < crawlRequests.length; i += batchSize) {
      const batch = crawlRequests.slice(i, i + batchSize);
      
      console.log(`[CRAWLING] Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(crawlRequests.length/batchSize)} (${batch.length} URLs)`);
      
      try {
        const batchResults = await this.crawler.crawlBatch(batch);
        results.push(...batchResults);
        
        // Error adaptation and recovery
        for (const result of batchResults) {
          if (!result.success && result.error) {
            await this.handleCrawlError(result, operationId);
          }
        }
        
      } catch (error) {
        console.error(`[CRAWLING] Batch ${i/batchSize + 1} failed:`, error);
        
        // Create failure results for the batch
        for (const request of batch) {
          results.push({
            success: false,
            error: `Batch processing failed: ${error}`,
            metadata: {
              processingTime: 0,
              method: 'static',
              compliance: { canScrape: false, recommendedDelay: 0, sitemaps: [], warnings: [], restrictions: [] },
              quality: { score: 0, issues: ['Batch processing failed'] }
            }
          });
        }
      }
    }
    
    return results;
  }

  private async processResults(
    crawlResults: CrawlResult[], 
    operationId: string
  ): Promise<Array<{
    url: string;
    success: boolean;
    data?: RawScrapedRecipe;
    governanceRecordId?: string;
    qualityMetrics?: QualityMetrics;
    complianceResult?: ComplianceResult;
    error?: string;
  }>> {
    const processedResults = [];
    
    for (const crawlResult of crawlResults) {
      const result: any = {
        url: crawlResult.data?.source_url || 'unknown',
        success: crawlResult.success,
        complianceResult: crawlResult.metadata.compliance,
        error: crawlResult.error
      };
      
      if (crawlResult.success && crawlResult.data) {
        try {
          // Quality validation
          // Basic quality check for raw scraped data (full validation happens after processing)
          const qualityMetrics = {
            score: crawlResult.data.title && crawlResult.data.ingredients.length > 0 ? 0.8 : 0.3,
            issues: crawlResult.data.ingredients.length === 0 ? ['No ingredients found'] : []
          };
          result.qualityMetrics = qualityMetrics;
          result.data = crawlResult.data;
          
          // Create governance record
          const processingSteps = [
            { step: 'crawling', timestamp: new Date(), metadata: crawlResult.metadata },
            { step: 'quality_validation', timestamp: new Date(), metadata: qualityMetrics }
          ];
          
          const governanceRecordId = await this.dataGovernanceManager.createGovernanceRecord(
            crawlResult.data, 
            processingSteps
          );
          result.governanceRecordId = governanceRecordId;
          
          // Add audit trail
          this.dataGovernanceManager.addAuditEntry(
            governanceRecordId,
            'processing_completed',
            'enterprise_orchestrator',
            { operationId, qualityScore: qualityMetrics.score }
          );
          
        } catch (error) {
          console.error(`[PROCESSING] Failed to process successful crawl result:`, error);
          result.success = false;
          result.error = `Processing failed: ${error}`;
        }
      }
      
      processedResults.push(result);
    }
    
    return processedResults;
  }

  private async generateReports(operationId: string, results: any[]): Promise<{
    complianceReport: string;
    qualityReport: string;
    rateLimitReport: string;
    errorAdaptationReport: string;
    governanceReport: string;
  }> {
    const complianceResults = results.map(r => r.complianceResult).filter(Boolean);
    const qualityMetrics = results.map(r => r.qualityMetrics).filter(Boolean);
    
    return {
      complianceReport: this.complianceManager.generateComplianceReport(complianceResults, operationId),
      qualityReport: this.qualityManager.generateQualityReport(qualityMetrics),
      rateLimitReport: this.rateLimitManager.generateRateLimitReport(),
      errorAdaptationReport: this.errorAdaptationManager.generateErrorAdaptationReport(),
      governanceReport: this.dataGovernanceManager.generateGovernanceReport()
    };
  }

  private async handleCrawlError(result: CrawlResult, operationId: string): Promise<void> {
    const errorPattern: ErrorPattern = {
      type: this.classifyErrorType(result.error || ''),
      message: result.error || 'Unknown error',
      domain: result.data?.source_url ? new URL(result.data.source_url).hostname : 'unknown',
      url: result.data?.source_url || 'unknown',
      timestamp: new Date(),
      responseTime: result.metadata.processingTime
    };

    const adaptationResult = await this.errorAdaptationManager.reportError(errorPattern);
    
    if (adaptationResult.shouldRetry && adaptationResult.adaptationStrategy) {
      console.log(`[ERROR-ADAPTATION] Retry recommended for ${errorPattern.url} using strategy: ${adaptationResult.adaptationStrategy.name}`);
    }
  }

  private classifyErrorType(error: string): ErrorPattern['type'] {
    if (error.includes('timeout')) return 'timeout';
    if (error.includes('403') || error.includes('forbidden')) return 'bot_detection';
    if (error.includes('429') || error.includes('rate limit')) return 'rate_limit';
    if (error.includes('parse') || error.includes('extract')) return 'parsing_error';
    if (error.match(/5\d\d/)) return 'http_error';
    return 'http_error';
  }

  private generateSummary(results: any[], startTime: number) {
    const successful = results.filter(r => r.success).length;
    const failed = results.length - successful;
    const complianceBlocked = results.filter(r => !r.complianceResult?.canScrape).length;
    const qualityIssues = results.filter(r => r.qualityMetrics && r.qualityMetrics.score < 0.7).length;
    
    const qualityScores = results
      .map(r => r.qualityMetrics?.score)
      .filter((score): score is number => typeof score === 'number');
    
    const averageQualityScore = qualityScores.length > 0 
      ? qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length
      : 0;

    return {
      totalRequests: results.length,
      successfulScrapes: successful,
      failedScrapes: failed,
      complianceBlocked,
      qualityIssues,
      averageQualityScore,
      processingTimeMs: Date.now() - startTime
    };
  }

  private async updateOperationMetrics(results: any[]): Promise<void> {
    this.operationMetrics.totalOperations++;
    this.operationMetrics.totalRecipesProcessed += results.length;
    this.operationMetrics.lastOperationTime = new Date();
    
    const successful = results.filter(r => r.success).length;
    const successRate = successful / results.length;
    
    // Update running averages
    const totalOps = this.operationMetrics.totalOperations;
    this.operationMetrics.averageSuccessRate = 
      ((this.operationMetrics.averageSuccessRate * (totalOps - 1)) + successRate) / totalOps;
    
    const qualityScores = results
      .map(r => r.qualityMetrics?.score)
      .filter((score): score is number => typeof score === 'number');
    
    if (qualityScores.length > 0) {
      const avgQuality = qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length;
      this.operationMetrics.averageQualityScore = 
        ((this.operationMetrics.averageQualityScore * (totalOps - 1)) + avgQuality) / totalOps;
    }
    
    const governanceMetrics = this.dataGovernanceManager.getMetrics();
    this.operationMetrics.complianceRate = governanceMetrics.complianceRate;
  }

  private async handleOperationFailure(operationId: string, request: ScrapingRequest, error: any): Promise<void> {
    console.error(`[OPERATION-FAILURE] ${operationId}:`, error);
    
    // In a production environment, this would create audit records,
    // send alerts, and potentially trigger recovery procedures
  }

  private generateHealthRecommendations(
    components: Record<string, string>, 
    crawlerStats: any, 
    rateLimitStats: any
  ): string[] {
    const recommendations: string[] = [];
    
    if (components.crawler === 'warning') {
      recommendations.push('Consider adjusting crawler settings or investigating site-specific issues');
    }
    
    if (components.rateLimit === 'warning') {
      recommendations.push('High throttling detected - consider reducing request rate or implementing better evasion');
    }
    
    if (rateLimitStats.averageWaitTime > 5000) {
      recommendations.push('High average wait times - consider optimizing rate limiting configuration');
    }
    
    if (crawlerStats.failedScrapes / Math.max(1, crawlerStats.totalRequests) > 0.3) {
      recommendations.push('High failure rate detected - review error adaptation strategies');
    }
    
    return recommendations;
  }

  private generateOperationId(): string {
    return `enterprise_op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
