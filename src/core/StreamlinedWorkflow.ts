/*
 * Streamlined Recipe Processing Workflow
 * 
 * Core workflow orchestrator for:
 * 1. Crawling & Scraping (websites, Instagram, TikTok, YouTube)
 * 2. Parsing & Formatting (ingredients, instructions, metadata)
 * 3. Data Enrichment (categorization, nutrition, diet tagging, health scoring)
 * 4. Embedding Generation (semantic search)
 * 5. Supabase Upserting (data persistence)
 */

import { RecipeProcessor, ProcessingOptions } from './RecipeProcessor.js';
import { DatabaseService, DatabaseServiceFactory } from './DatabaseService.js';
import { RecipeService, RecipeServiceFactory } from './RecipeService.js';
import { generateRecipeEmbedding } from '../utils/embeddingGenerator.js';
import { RawScrapedRecipe } from '../scrapers/websiteScraper.js';
import { Recipe } from '../types.js';
import { DataQualityLogger } from '../utils/dataQualityLogger.js';

export interface WorkflowConfig {
  enableEnrichment: boolean;
  enableEmbedding: boolean;
  enableValidation: boolean;
  enableNutrition: boolean;
  batchSize: number;
  retryAttempts: number;
  timeoutMs: number;
}

export interface WorkflowStats {
  totalProcessed: number;
  successful: number;
  failed: number;
  averageProcessingTime: number;
  errors: string[];
  startTime: Date;
  endTime?: Date;
}

export class StreamlinedWorkflow {
  private processor: RecipeProcessor;
  private database: DatabaseService;
  private service: RecipeService;
  private dataQualityLogger: DataQualityLogger;
  private config: WorkflowConfig;
  private stats: WorkflowStats;

  constructor(config: Partial<WorkflowConfig> = {}) {
    this.processor = RecipeProcessor.getInstance();
    this.database = DatabaseServiceFactory.create();
    this.service = RecipeServiceFactory.createWithDefaults();
    this.dataQualityLogger = DataQualityLogger.getInstance();

    this.config = {
      enableEnrichment: true,
      enableEmbedding: true,
      enableValidation: true,
      enableNutrition: true,
      batchSize: 10,
      retryAttempts: 3,
      timeoutMs: 30000,
      ...config
    };

    this.stats = {
      totalProcessed: 0,
      successful: 0,
      failed: 0,
      averageProcessingTime: 0,
      errors: [],
      startTime: new Date()
    };
  }

  async initialize(): Promise<void> {
    await this.database.initialize();
    await this.dataQualityLogger.initialize();
  }

  /*
   * Process a single recipe through the complete workflow
   */
  async processRecipe(rawRecipe: RawScrapedRecipe, sourceUrl: string, options: ProcessingOptions): Promise<Recipe | null> {
    const startTime = Date.now();
    
    try {
      console.log(`🔄 Processing recipe: ${rawRecipe.title}`);
      
      // Step 1: Parse and format
      const processingResult = await this.processor.processRecipe(
        rawRecipe, 
        sourceUrl
      );
      
      // Step 2: Data enrichment (if enabled)
      let enrichedRecipe = processingResult.recipe;
      if (this.config.enableEnrichment) {
        // RecipeService.processRecipe handles enrichment internally
        // We'll need to extract the recipe from the processing result
        // For now, we'll use the already enriched parsedRecipe
        enrichedRecipe = processingResult.recipe;
      }
      
      // Step 3: Generate embeddings (if enabled)
      if (this.config.enableEmbedding) {
        try {
          const embedding = await generateRecipeEmbedding({
            title: enrichedRecipe.title,
            description: enrichedRecipe.description || undefined, // Convert null to undefined
            ingredients: enrichedRecipe.ingredients
          });
          if (embedding) {
            enrichedRecipe.embedding = embedding;
            console.log(`✅ Generated embedding for ${rawRecipe.title} (${embedding.length} dimensions)`);
          } else {
            console.warn(`⚠️ Failed to generate embedding for ${rawRecipe.title}`);
          }
        } catch (error) {
          console.warn(`⚠️ Embedding generation failed for ${rawRecipe.title}:`, error);
        }
      }
      
      // Step 4: Validate (if enabled)
      if (this.config.enableValidation) {
        const isValid = this.validateRecipe(enrichedRecipe);
        if (!isValid) {
          throw new Error('Recipe validation failed');
        }
      }
      
      // Step 5: Upsert to database
      // Use DatabaseService directly since we already have a fully processed recipe
      // Create proper ProcessingResult object as required by DatabaseService.saveRecipe
      const processingResultForSave = {
        recipe: enrichedRecipe,
        processingTime: Date.now() - startTime,
        completenessScore: enrichedRecipe.completeness_score || 0,
        parsingConfidence: enrichedRecipe.parsing_confidence || 0
      };
      
      const saveResult = await this.database.saveRecipe(processingResultForSave);
      
      if (!saveResult.success) {
        throw new Error(`Database save failed: ${saveResult.error}`);
      }
      
      const processingTime = Date.now() - startTime;
      this.updateStats(true, processingTime);
      
      console.log(`✅ Successfully processed: ${rawRecipe.title} (${processingTime}ms)`);
      return enrichedRecipe;
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.updateStats(false, processingTime, error as Error);
      
      console.error(`❌ Failed to process ${rawRecipe.title}:`, error);
      return null;
    }
  }

  /*
   * Process multiple recipes in batches
   */
  async processBatch(rawRecipes: RawScrapedRecipe[]): Promise<Recipe[]> {
    console.log(`🚀 Processing batch of ${rawRecipes.length} recipes`);
    
    const results: Recipe[] = [];
    const batches = this.chunkArray(rawRecipes, this.config.batchSize);
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`📦 Processing batch ${i + 1}/${batches.length} (${batch.length} recipes)`);
      
      const batchPromises = batch.map(recipe => this.processRecipe(recipe, recipe.source_url, {
        include_ai: true,
        include_nutrition: true,
        generate_embedding: true
      }));
      const batchResults = await Promise.allSettled(batchPromises);
      
      for (const result of batchResults) {
        if (result.status === 'fulfilled' && result.value) {
          results.push(result.value);
        }
      }
      
      // Brief pause between batches to avoid overwhelming services
      if (i < batches.length - 1) {
        await this.sleep(1000);
      }
    }
    
    this.stats.endTime = new Date();
    this.logFinalStats();
    
    return results;
  }

  /*
   * Validate recipe completeness and quality
   */
  private validateRecipe(recipe: Recipe): boolean {
    let isValid = true;

    if (!recipe.title || recipe.title.trim().length === 0) {
      this.dataQualityLogger.logIssue(recipe.source_url, 'title', 'Title is missing or empty.');
      isValid = false;
    }

    if (!recipe.ingredients || recipe.ingredients.length === 0) {
      this.dataQualityLogger.logIssue(recipe.source_url, 'ingredients', 'Ingredients array is missing or empty.');
      isValid = false;
    } else {
      recipe.ingredients.forEach((ing, index) => {
        if (!ing.name || ing.name.trim().length === 0) {
          this.dataQualityLogger.logIssue(recipe.source_url, `ingredients[${index}].name`, 'Ingredient name is missing or empty.', { ingredient: ing });
          isValid = false;
        }
      });
    }

    if (!recipe.instructions || recipe.instructions.length === 0) {
      this.dataQualityLogger.logIssue(recipe.source_url, 'instructions', 'Instructions array is missing or empty.');
      isValid = false;
    } else {
      recipe.instructions.forEach((inst, index) => {
        if (!inst.text || inst.text.trim().length < 10) {
          this.dataQualityLogger.logIssue(recipe.source_url, `instructions[${index}].text`, 'Instruction text is missing or too short.', { instruction: inst });
          isValid = false;
        }
      });
    }

    if (!recipe.source_url) {
      this.dataQualityLogger.logIssue(recipe.source_url || 'Unknown', 'source_url', 'Source URL is missing.');
      isValid = false;
    }

    return isValid;
  }

  /*
   * Update processing statistics
   */
  private updateStats(success: boolean, processingTime: number, error?: Error): void {
    this.stats.totalProcessed++;
    
    if (success) {
      this.stats.successful++;
    } else {
      this.stats.failed++;
      if (error) {
        this.stats.errors.push(error.message);
      }
    }
    
    // Update average processing time
    const totalTime = (this.stats.averageProcessingTime * (this.stats.totalProcessed - 1)) + processingTime;
    this.stats.averageProcessingTime = totalTime / this.stats.totalProcessed;
  }

  /*
   * Log final processing statistics
   */
  public logFinalStats(): void {
    this.dataQualityLogger.saveLog(); // Save data quality issues
    this.stats.endTime = new Date();
    const duration = (this.stats.endTime.getTime() - this.stats.startTime.getTime()) / 1000;
    
    console.log('\n📊 WORKFLOW STATISTICS:');
    console.log(`⏱️  Total Duration: ${duration.toFixed(1)}s`);
    console.log(`📈 Total Processed: ${this.stats.totalProcessed}`);
    console.log(`✅ Successful: ${this.stats.successful} (${((this.stats.successful / this.stats.totalProcessed) * 100).toFixed(1)}%)`);
    console.log(`❌ Failed: ${this.stats.failed} (${((this.stats.failed / this.stats.totalProcessed) * 100).toFixed(1)}%)`);
    console.log(`⚡ Average Processing Time: ${this.stats.averageProcessingTime.toFixed(0)}ms`);
    
    if (this.stats.errors.length > 0) {
      console.log(`\n🚨 Common Errors:`);
      const errorCounts = this.stats.errors.reduce((acc, error) => {
        acc[error] = (acc[error] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      Object.entries(errorCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .forEach(([error, count]) => {
          console.log(`   ${count}x: ${error}`);
        });
    }
  }

  /*
   * Get current processing statistics
   */
  getStats(): WorkflowStats {
    return { ...this.stats };
  }

  /*
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalProcessed: 0,
      successful: 0,
      failed: 0,
      averageProcessingTime: 0,
      errors: [],
      startTime: new Date()
    };
  }

  /*
   * Utility: Split array into chunks
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /*
   * Utility: Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
