/**
 * Base Scraper Interface
 *
 * Defines the contract for all recipe scrapers
 * Eliminates need for singleton pattern by using dependency injection
 * Follows Interface Segregation Principle (ISP) from SOLID
 */

import type { Recipe } from '../shared/types.js';

/**
 * Scraper configuration options
 */
export interface ScraperConfig {
  maxRetries?: number;
  timeoutMs?: number;
  rateLimit?: {
    requestsPerMinute?: number;
    requestsPerDay?: number;
  };
  cache?: {
    enabled?: boolean;
    ttl?: number;
  };
}

/**
 * Scraper metadata for identification and capabilities
 */
export interface ScraperMetadata {
  id: string;
  name: string;
  version: string;
  description: string;
  supportedDomains?: string[];
  requiresAuth: boolean;
  rateLimits?: {
    requestsPerMinute?: number;
    requestsPerDay?: number;
  };
}

/**
 * Scraper result with metadata
 */
export interface ScraperResult<T = Recipe> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: {
    source: string;
    scrapedAt: Date;
    duration: number;
  };
}

/**
 * Base interface that all scrapers should implement
 * Single Responsibility: Define scraper contract only
 */
export interface IScraper {
  /**
   * Get scraper metadata
   */
  getMetadata(): ScraperMetadata;

  /**
   * Scrape a single recipe
   */
  scrape(urlOrQuery: string, options?: any): Promise<ScraperResult<Recipe>>;

  /**
   * Search for recipes (optional - not all scrapers support search)
   */
  search?(query: string, options?: any): Promise<ScraperResult<Recipe[]>>;

  /**
   * Health check to verify scraper is operational
   */
  healthCheck?(): Promise<boolean>;
}

/**
 * Abstract base class for scrapers
 * Provides common functionality and reduces boilerplate
 * Open/Closed Principle: Open for extension, closed for modification
 */
export abstract class BaseScraper implements IScraper {
  protected config: Required<ScraperConfig>;
  protected requestCount = 0;
  protected lastRequestTime = 0;

  constructor(config: ScraperConfig = {}) {
    // Provide sensible defaults
    this.config = {
      maxRetries: config.maxRetries ?? 3,
      timeoutMs: config.timeoutMs ?? 30000,
      rateLimit: {
        requestsPerMinute: config.rateLimit?.requestsPerMinute ?? 60,
        requestsPerDay: config.rateLimit?.requestsPerDay ?? 1000,
      },
      cache: {
        enabled: config.cache?.enabled ?? true,
        ttl: config.cache?.ttl ?? 3600,
      },
    };
  }

  abstract getMetadata(): ScraperMetadata;
  abstract scrape(urlOrQuery: string, options?: any): Promise<ScraperResult<Recipe>>;

  /**
   * Rate limiting helper
   */
  protected async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const minInterval = 60000 / (this.config.rateLimit.requestsPerMinute ?? 60);
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < minInterval) {
      await new Promise(resolve => setTimeout(resolve, minInterval - timeSinceLastRequest));
    }

    this.lastRequestTime = Date.now();
    this.requestCount++;
  }

  /**
   * Create a successful result
   */
  protected createSuccessResult<T>(data: T, source: string, duration: number): ScraperResult<T> {
    return {
      success: true,
      data,
      metadata: {
        source,
        scrapedAt: new Date(),
        duration,
      },
    };
  }

  /**
   * Create an error result
   */
  protected createErrorResult(error: string, source: string): ScraperResult {
    return {
      success: false,
      error,
      metadata: {
        source,
        scrapedAt: new Date(),
        duration: 0,
      },
    };
  }

  /**
   * Default health check implementation
   */
  async healthCheck(): Promise<boolean> {
    return true;
  }
}
