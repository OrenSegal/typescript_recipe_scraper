/*
 * Recipe Service - Main orchestrator following SOLID, KISS, DRY, YAGNI principles
 * Consolidated, modular approach for recipe processing pipeline
 */

import { RawScrapedRecipe } from '../scrapers/websiteScraper.js';
import { Recipe } from '../types.js';
import { RecipeProcessor, ProcessingOptions, ProcessingResult, ProcessorFactory, ProcessingUtils } from './RecipeProcessor.js';
import { DatabaseService, DatabaseServiceFactory, SaveResult } from './DatabaseService.js';

export interface ServiceConfig {
  enableAI: boolean;
  enableNutrition: boolean;
  enableEmbedding: boolean;
  batchSize: number;
}

export interface ServiceResult {
  success: boolean;
  recipe?: Recipe;
  recipeId?: string;
  processingTime: number;
  completenessScore: number;
  parsingConfidence: number;
  error?: string;
}

/*
 * Main Recipe Service - Facade pattern for clean API
 * Single Responsibility: Orchestrate recipe processing workflow
 * Open/Closed: Extensible without modification
 * Dependency Inversion: Depends on abstractions
 */
export class RecipeService {
  private static instance: RecipeService;
  private processor: RecipeProcessor;
  private database: DatabaseService;
  private config: ServiceConfig;
  private initialized = false;

  private constructor(config: ServiceConfig) {
    this.config = config;
    this.processor = ProcessorFactory.createProcessor();
    this.database = DatabaseServiceFactory.create();
  }

  /*
   * Singleton pattern - YAGNI principle
   */
  public static getInstance(config?: ServiceConfig): RecipeService {
    if (!RecipeService.instance) {
      if (!config) {
        config = RecipeService.getDefaultConfig();
      }
      RecipeService.instance = new RecipeService(config);
    }
    return RecipeService.instance;
  }

  /*
   * Initialize service - KISS principle
   */
  public async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await this.database.initialize();
      this.initialized = true;
      console.log('✅ Recipe service initialized');
    } catch (error) {
      console.error('❌ Recipe service initialization failed:', error);
      throw error;
    }
  }

  /*
   * Process single recipe - Main API method
   */
  public async processRecipe(
    rawRecipe: RawScrapedRecipe,
    sourceUrl: string,
    saveToDatabase = true
  ): Promise<ServiceResult> {
    const startTime = Date.now();

    try {
      // Ensure service is initialized
      await this.initialize();

      // Prepare processing options
      const options: ProcessingOptions = {
        include_ai: this.config.enableAI,
        include_nutrition: this.config.enableNutrition,
        generate_embedding: this.config.enableEmbedding
      };

      // Validate options
      if (!ProcessingUtils.validateProcessingOptions(options)) {
        throw new Error('Invalid processing options');
      }

      // Process recipe
      const processingResult: ProcessingResult = await this.processor.processRecipe(
        rawRecipe,
        sourceUrl,
        true, // include_ai
        true, // include_nutrition
        true  // generate_embedding
      );

      // Save to database if requested
      let saveResult: SaveResult | null = null;
      if (saveToDatabase) {
        saveResult = await this.database.saveRecipe(processingResult);
        if (!saveResult.success) {
          console.warn('⚠️ Database save failed, but processing succeeded');
        }
      }

      const totalTime = Date.now() - startTime;

      return {
        success: true,
        recipe: processingResult.recipe,
        recipeId: saveResult?.recipeId,
        processingTime: totalTime,
        completenessScore: processingResult.completenessScore,
        parsingConfidence: processingResult.parsingConfidence
      };

    } catch (error) {
      console.error('[RecipeService] Processing failed:', error);
      return {
        success: false,
        processingTime: Date.now() - startTime,
        completenessScore: 0,
        parsingConfidence: 0,
        error: `Processing failed: ${error}`
      };
    }
  }

  /*
   * Process multiple recipes - Batch processing
   */
  public async processRecipes(
    recipes: Array<{ rawRecipe: RawScrapedRecipe; sourceUrl: string }>,
    saveToDatabase = true
  ): Promise<ServiceResult[]> {
    const results: ServiceResult[] = [];
    const batches = this.createBatches(recipes, this.config.batchSize);

    for (const batch of batches) {
      const batchPromises = batch.map(({ rawRecipe, sourceUrl }) =>
        this.processRecipe(rawRecipe, sourceUrl, saveToDatabase)
      );

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Small delay between batches to prevent overwhelming the system
      if (batches.length > 1) {
        await this.delay(100);
      }
    }

    return results;
  }

  /*
   * Health check - KISS principle
   */
  public async healthCheck(): Promise<boolean> {
    try {
      await this.initialize();
      return await this.database.healthCheck();
    } catch {
      return false;
    }
  }

  /*
   * Get service statistics - YAGNI principle
   */
  public getConfig(): ServiceConfig {
    return { ...this.config };
  }

  /*
   * Update service configuration
   */
  public updateConfig(newConfig: Partial<ServiceConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /*
   * Default configuration - DRY principle
   */
  public static getDefaultConfig(): ServiceConfig {
    return {
      enableAI: false,
      enableNutrition: true,
      enableEmbedding: false,
      batchSize: 5
    };
  }

  /*
   * Create batches for processing - DRY principle
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /*
   * Simple delay utility - KISS principle
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/*
 * Service Factory - SOLID compliance
 */
export class RecipeServiceFactory {
  public static create(config?: ServiceConfig): RecipeService {
    return RecipeService.getInstance(config);
  }

  public static createWithDefaults(): RecipeService {
    return RecipeService.getInstance(RecipeService.getDefaultConfig());
  }

  public static createForTesting(): RecipeService {
    const testConfig: ServiceConfig = {
      enableAI: false,
      enableNutrition: false,
      enableEmbedding: false,
      batchSize: 2
    };
    return RecipeService.getInstance(testConfig);
  }
}

/*
 * Service utilities - DRY principle
 */
export class ServiceUtils {
  public static validateRawRecipe(rawRecipe: RawScrapedRecipe): boolean {
    return Boolean(
      rawRecipe.title &&
      rawRecipe.ingredients &&
      rawRecipe.instructions &&
      rawRecipe.source_url
    );
  }

  public static calculateSuccessRate(results: ServiceResult[]): number {
    if (results.length === 0) return 0;
    const successCount = results.filter(r => r.success).length;
    return (successCount / results.length) * 100;
  }

  public static getAverageProcessingTime(results: ServiceResult[]): number {
    if (results.length === 0) return 0;
    const totalTime = results.reduce((sum, r) => sum + r.processingTime, 0);
    return totalTime / results.length;
  }
}


