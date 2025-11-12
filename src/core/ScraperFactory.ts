/**
 * Scraper Factory
 *
 * Centralized factory for creating and managing scraper instances
 * Eliminates singleton boilerplate from individual scrapers
 * Follows Factory Pattern and Dependency Inversion Principle
 */

import type { IScraper, ScraperConfig } from './BaseScraper.js';
import { SpoonacularScraper } from '../scrapers/SpoonacularScraper.js';
import { EdamamScraper } from '../scrapers/EdamamScraper.js';
import { TheMealDBScraper } from '../scrapers/TheMealDBScraper.js';
import { RecipePuppyScraper } from '../scrapers/RecipePuppyScraper.js';
import { WikidataScraper } from '../scrapers/WikidataScraper.js';
import { GoogleCSEScraper } from '../scrapers/GoogleCSEScraper.js';
import { DummyJSONScraper } from '../scrapers/DummyJSONScraper.js';

/**
 * Scraper type identifiers
 */
export enum ScraperType {
  SPOONACULAR = 'spoonacular',
  EDAMAM = 'edamam',
  THEMEALDB = 'themealdb',
  RECIPE_PUPPY = 'recipe-puppy',
  WIKIDATA = 'wikidata',
  GOOGLE_CSE = 'google-cse',
  DUMMY_JSON = 'dummy-json',
}

/**
 * Scraper Factory Class
 *
 * Manages scraper instances with optional caching
 * Single Responsibility: Create and manage scrapers
 */
export class ScraperFactory {
  private static instanceCache = new Map<ScraperType, IScraper>();
  private static useCache = true;

  /**
   * Create or retrieve a scraper instance
   *
   * @param type - The type of scraper to create
   * @param config - Optional configuration for the scraper
   * @param forceNew - Force creation of new instance (bypass cache)
   * @returns Scraper instance
   */
  static create(
    type: ScraperType,
    config?: ScraperConfig,
    forceNew = false
  ): IScraper {
    // Return cached instance if available and not forcing new
    if (this.useCache && !forceNew && this.instanceCache.has(type)) {
      return this.instanceCache.get(type)!;
    }

    // Create new instance based on type
    const scraper = this.createScraper(type, config);

    // Cache if enabled
    if (this.useCache && !forceNew) {
      this.instanceCache.set(type, scraper);
    }

    return scraper;
  }

  /**
   * Create a new scraper instance
   * Factory Method Pattern
   */
  private static createScraper(type: ScraperType, config?: ScraperConfig): IScraper {
    switch (type) {
      case ScraperType.SPOONACULAR:
        return new SpoonacularScraper(config);
      case ScraperType.EDAMAM:
        return new EdamamScraper(config);
      case ScraperType.THEMEALDB:
        return new TheMealDBScraper(config);
      case ScraperType.RECIPE_PUPPY:
        return new RecipePuppyScraper(config);
      case ScraperType.WIKIDATA:
        return new WikidataScraper(config);
      case ScraperType.GOOGLE_CSE:
        return new GoogleCSEScraper(config);
      case ScraperType.DUMMY_JSON:
        return new DummyJSONScraper(config);
      default:
        throw new Error(`Unknown scraper type: ${type}`);
    }
  }

  /**
   * Get all available scraper types
   */
  static getAvailableScrapers(): ScraperType[] {
    return Object.values(ScraperType);
  }

  /**
   * Clear cached instances (useful for testing)
   */
  static clearCache(): void {
    this.instanceCache.clear();
  }

  /**
   * Disable/enable instance caching
   */
  static setCacheEnabled(enabled: boolean): void {
    this.useCache = enabled;
    if (!enabled) {
      this.clearCache();
    }
  }

  /**
   * Get a cached instance if it exists
   */
  static getCached(type: ScraperType): IScraper | undefined {
    return this.instanceCache.get(type);
  }

  /**
   * Check if a scraper is available based on configuration
   */
  static isAvailable(type: ScraperType): boolean {
    try {
      const scraper = this.create(type, {}, true);
      return scraper !== null;
    } catch {
      return false;
    }
  }

  /**
   * Create multiple scrapers at once
   */
  static createMultiple(
    types: ScraperType[],
    config?: ScraperConfig
  ): Map<ScraperType, IScraper> {
    const scrapers = new Map<ScraperType, IScraper>();

    for (const type of types) {
      try {
        const scraper = this.create(type, config);
        scrapers.set(type, scraper);
      } catch (error) {
        console.warn(`Failed to create scraper ${type}:`, error);
      }
    }

    return scrapers;
  }

  /**
   * Health check all available scrapers
   */
  static async healthCheckAll(): Promise<Map<ScraperType, boolean>> {
    const results = new Map<ScraperType, boolean>();
    const scraperTypes = this.getAvailableScrapers();

    for (const type of scraperTypes) {
      try {
        const scraper = this.create(type);
        const isHealthy = scraper.healthCheck
          ? await scraper.healthCheck()
          : true;
        results.set(type, isHealthy);
      } catch {
        results.set(type, false);
      }
    }

    return results;
  }
}

/**
 * Convenience function to create scrapers
 * Functional programming approach
 */
export const createScraper = ScraperFactory.create.bind(ScraperFactory);

/**
 * Get all available scrapers as instances
 */
export function getAllScrapers(config?: ScraperConfig): IScraper[] {
  const types = ScraperFactory.getAvailableScrapers();
  return types.map(type => {
    try {
      return ScraperFactory.create(type, config);
    } catch {
      return null;
    }
  }).filter((s): s is IScraper => s !== null);
}
