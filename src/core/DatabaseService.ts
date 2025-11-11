/*
 * Database Service - Clean, modular database operations
 * Follows SOLID principles for maintainable data persistence
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Recipe, RecipeSchema } from '../types.js';
import { ProcessingResult } from './RecipeProcessor.js';

export interface DatabaseConfig {
  url: string;
  key: string;
}

export interface SaveResult {
  success: boolean;
  recipeId?: string;
  error?: string;
}

/*
 * Single Responsibility: Handle all database operations for recipes
 * Open/Closed: Extensible for new database operations
 * Dependency Inversion: Depends on Supabase abstraction
 */
export class DatabaseService {
  private static instance: DatabaseService;
  private supabase: SupabaseClient;
  private initialized = false;

  private constructor(config: DatabaseConfig) {
    this.supabase = createClient(config.url, config.key);
  }

  /*
   * Singleton pattern - YAGNI principle
   */
  public static getInstance(config?: DatabaseConfig): DatabaseService {
    if (!DatabaseService.instance) {
      if (!config) {
        throw new Error('DatabaseService requires config for first initialization');
      }
      DatabaseService.instance = new DatabaseService(config);
    }
    return DatabaseService.instance;
  }

  /*
   * Initialize database connection - KISS principle
   */
  public async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Test connection
      const { error } = await this.supabase.from('recipes').select('id').limit(1);
      if (error) throw error;
      
      this.initialized = true;
      console.log('✅ Database service initialized');
    } catch (error) {
      console.error('❌ Database initialization failed:', error);
      throw new Error(`Database initialization failed: ${error}`);
    }
  }

  /*
   * Save recipe with validation - DRY principle
   */
  public async saveRecipe(processingResult: ProcessingResult): Promise<SaveResult> {
    try {
      // Validate recipe data
      const validationResult = RecipeSchema.safeParse(processingResult.recipe);
      if (!validationResult.success) {
        console.error('[DatabaseService] Validation failed:', validationResult.error);
        return {
          success: false,
          error: 'Recipe validation failed'
        };
      }

      // Prepare data for database
      const recipeData = this.prepareRecipeData(validationResult.data);

      // Upsert to database
      const { data, error } = await this.supabase
        .from('recipes')
        .upsert(recipeData, { 
          onConflict: 'source_url',
          ignoreDuplicates: false 
        })
        .select('id')
        .single();

      if (error) {
        console.error('[DatabaseService] Upsert failed:', error);
        return {
          success: false,
          error: `Database upsert failed: ${error.message}`
        };
      }

      console.log(`✅ Recipe saved successfully: ${data.id}`);
      return {
        success: true,
        recipeId: data.id
      };

    } catch (error) {
      console.error('[DatabaseService] Save operation failed:', error);
      return {
        success: false,
        error: `Save operation failed: ${error}`
      };
    }
  }

  /*
   * Prepare recipe data for database - KISS principle
   */
  private prepareRecipeData(recipe: Recipe): any {
    return {
      title: recipe.title,
      description: recipe.description,
      ingredients: recipe.ingredients,
      instructions: recipe.instructions,
      servings: recipe.servings,
      prep_time_minutes: recipe.prep_time_minutes,
      cook_time_minutes: recipe.cook_time_minutes,
      total_time_minutes: recipe.total_time_minutes,

      cuisines: recipe.cuisines,
      suitable_for_diet: recipe.suitable_for_diet,
      effort_level: recipe.effort_level,
      tags: recipe.tags,
      source_url: recipe.source_url,
      image_url: recipe.image_url,
      author: recipe.author,
      created_by: recipe.created_by,
      created_at: recipe.created_at,
      updated_at: new Date().toISOString()
    };
  }

  /*
   * Batch save recipes - DRY principle
   */
  public async saveRecipes(processingResults: ProcessingResult[]): Promise<SaveResult[]> {
    const results: SaveResult[] = [];
    
    for (const result of processingResults) {
      const saveResult = await this.saveRecipe(result);
      results.push(saveResult);
    }
    
    return results;
  }

  /*
   * Health check - KISS principle
   */
  public async healthCheck(): Promise<boolean> {
    try {
      const { error } = await this.supabase.from('recipes').select('id').limit(1);
      return !error;
    } catch {
      return false;
    }
  }

  /*
   * Get recipe by ID - YAGNI principle (only implement when needed)
   */
  public async getRecipeById(id: string): Promise<Recipe | null> {
    try {
      const { data, error } = await this.supabase
        .from('recipes')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) return null;
      return data as Recipe;
    } catch {
      return null;
    }
  }
}

/*
 * Factory for database service - SOLID compliance
 */
export class DatabaseServiceFactory {
  public static create(): DatabaseService {
    const config: DatabaseConfig = {
      url: process.env.SUPABASE_URL || '',
      key: process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    };

    if (!config.url || !config.key) {
      throw new Error('Database configuration missing: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required');
    }

    return DatabaseService.getInstance(config);
  }
}

/*
 * Database utilities - DRY principle
 */
export class DatabaseUtils {
  public static validateConfig(config: DatabaseConfig): boolean {
    return Boolean(config.url && config.key);
  }

  public static isValidRecipeId(id: string): boolean {
    return typeof id === 'string' && id.length > 0;
  }
}
