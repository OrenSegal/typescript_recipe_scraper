/**
 * Spoonacular API Scraper
 * Free tier: 150 requests/day
 * Features: Recipe search, nutrition data, ingredient substitutions, meal planning
 *
 * Docs: https://spoonacular.com/food-api/docs
 *
 * Refactored to use BaseScraper - eliminates singleton boilerplate
 */

import axios from 'axios';
import type { Recipe, RecipeIngredient, InstructionStep, NutritionInfo } from '../shared/types.js';
import { BaseScraper, ScraperConfig, ScraperMetadata, ScraperResult } from '../core/BaseScraper.js';
import { config } from '../config.js';

const BASE_URL = 'https://api.spoonacular.com';

export interface SpoonacularSearchOptions {
  query?: string;
  cuisine?: string;
  diet?: string; // vegetarian, vegan, gluten free, etc.
  intolerances?: string; // dairy, egg, gluten, etc.
  number?: number; // max results
}

interface SpoonacularRecipe {
  id: number;
  title: string;
  image?: string;
  imageType?: string;
  servings?: number;
  readyInMinutes?: number;
  preparationMinutes?: number;
  cookingMinutes?: number;
  sourceUrl?: string;
  spoonacularSourceUrl?: string;
  summary?: string;
  cuisines?: string[];
  dishTypes?: string[];
  diets?: string[];
  analyzedInstructions?: Array<{
    name: string;
    steps: Array<{
      number: number;
      step: string;
      ingredients?: Array<{ id: number; name: string }>;
      equipment?: Array<{ id: number; name: string }>;
      length?: { number: number; unit: string };
    }>;
  }>;
  extendedIngredients?: Array<{
    id: number;
    name: string;
    original: string;
    originalName: string;
    amount: number;
    unit: string;
    measures?: {
      us?: { amount: number; unitShort: string; unitLong: string };
      metric?: { amount: number; unitShort: string; unitLong: string };
    };
  }>;
  nutrition?: {
    nutrients?: Array<{
      name: string;
      amount: number;
      unit: string;
    }>;
  };
}

export class SpoonacularScraper extends BaseScraper {
  private readonly apiKey: string;
  private readonly dailyLimit = 150;

  constructor(scraperConfig?: ScraperConfig) {
    super({
      maxRetries: 3,
      timeoutMs: 10000,
      rateLimit: {
        requestsPerMinute: 10,
        requestsPerDay: 150,
      },
      ...scraperConfig,
    });

    this.apiKey = config.recipeApis.spoonacularApiKey || '';
  }

  /**
   * Get scraper metadata
   */
  getMetadata(): ScraperMetadata {
    return {
      id: 'spoonacular',
      name: 'Spoonacular API',
      version: '1.0.0',
      description: 'Recipe API with nutrition data and meal planning (150 req/day free tier)',
      requiresAuth: true,
      rateLimits: {
        requestsPerMinute: 10,
        requestsPerDay: 150,
      },
    };
  }

  /**
   * Check if API key is configured
   */
  isConfigured(): boolean {
    return !!this.apiKey && this.apiKey.length > 0;
  }

  /**
   * Check if we've reached the daily limit
   */
  hasReachedLimit(): boolean {
    return this.requestCount >= this.dailyLimit;
  }

  /**
   * Health check - verify API is accessible
   */
  async healthCheck(): Promise<boolean> {
    if (!this.isConfigured()) return false;

    try {
      const params = new URLSearchParams({
        apiKey: this.apiKey,
        number: '1',
      });
      const url = `${BASE_URL}/recipes/random?${params}`;
      const response = await axios.get(url, { timeout: 5000 });
      return response.status === 200;
    } catch {
      return false;
    }
  }

  /**
   * Scrape a single recipe (implements IScraper)
   */
  async scrape(query: string, options?: SpoonacularSearchOptions): Promise<ScraperResult<Recipe>> {
    const startTime = Date.now();

    if (!this.isConfigured()) {
      return this.createErrorResult('API key not configured', 'spoonacular');
    }

    try {
      await this.enforceRateLimit();

      const recipes = await this.searchRecipes({ query, ...options });
      if (recipes.length === 0) {
        return this.createErrorResult('No recipes found', 'spoonacular');
      }

      const duration = Date.now() - startTime;
      return this.createSuccessResult(recipes[0], 'spoonacular', duration);
    } catch (error: any) {
      return this.createErrorResult(error.message, 'spoonacular');
    }
  }

  /**
   * Search for recipes (implements IScraper.search)
   */
  async search(query: string, options?: SpoonacularSearchOptions): Promise<ScraperResult<Recipe[]>> {
    const startTime = Date.now();

    if (!this.isConfigured()) {
      return this.createErrorResult('API key not configured', 'spoonacular');
    }

    if (this.hasReachedLimit()) {
      return this.createErrorResult('Daily limit reached', 'spoonacular');
    }

    try {
      await this.enforceRateLimit();

      const recipes = await this.searchRecipes({ query, ...options });
      const duration = Date.now() - startTime;

      if (recipes.length === 0) {
        return this.createErrorResult('No recipes found', 'spoonacular');
      }

      return this.createSuccessResult(recipes, 'spoonacular', duration);
    } catch (error: any) {
      return this.createErrorResult(error.message, 'spoonacular');
    }
  }

  /**
   * Search for recipes (internal method)
   */
  private async searchRecipes(options: SpoonacularSearchOptions): Promise<Recipe[]> {
    try {
      const params = new URLSearchParams({
        apiKey: this.apiKey,
        query: options.query || '',
        number: String(options.number || 5),
        addRecipeInformation: 'true',
        fillIngredients: 'true',
        instructionsRequired: 'true'
      });

      if (options.cuisine) params.append('cuisine', options.cuisine);
      if (options.diet) params.append('diet', options.diet);
      if (options.intolerances) params.append('intolerances', options.intolerances);

      const url = `${BASE_URL}/recipes/complexSearch?${params}`;
      console.log(`🌐 Spoonacular API request: ${options.query}`);

      const response = await axios.get(url, { timeout: this.config.timeoutMs });
      this.requestCount++;

      if (!response.data?.results || response.data.results.length === 0) {
        console.log('⚠️  No recipes found in Spoonacular');
        return [];
      }

      console.log(`✅ Found ${response.data.results.length} recipes from Spoonacular`);

      // Get full recipe details for each result
      const recipes: Recipe[] = [];
      for (const result of response.data.results.slice(0, 3)) {
        try {
          const fullRecipe = await this.getRecipeById(result.id);
          if (fullRecipe) {
            recipes.push(fullRecipe);
          }
        } catch (error) {
          console.warn(`⚠️  Failed to fetch full recipe ${result.id}:`, error);
        }
      }

      return recipes;
    } catch (error: any) {
      if (error.response?.status === 402) {
        console.error('❌ Spoonacular API: Daily quota exceeded');
        this.requestCount = this.dailyLimit;
      } else {
        console.error('❌ Spoonacular API error:', error.message);
      }
      return [];
    }
  }

  /**
   * Get full recipe details by ID
   */
  private async getRecipeById(id: number): Promise<Recipe | null> {
    if (!this.isConfigured()) return null;
    if (this.hasReachedLimit()) return null;

    try {
      await this.enforceRateLimit();

      const params = new URLSearchParams({
        apiKey: this.apiKey,
        includeNutrition: 'true'
      });

      const url = `${BASE_URL}/recipes/${id}/information?${params}`;
      const response = await axios.get(url, { timeout: this.config.timeoutMs });
      this.requestCount++;

      return this.convertToRecipe(response.data);
    } catch (error: any) {
      console.error(`❌ Error fetching Spoonacular recipe ${id}:`, error.message);
      return null;
    }
  }

  /**
   * Convert Spoonacular format to our Recipe format
   */
  private convertToRecipe(spoon: SpoonacularRecipe): Recipe {
    // Extract ingredients
    const ingredients: RecipeIngredient[] = (spoon.extendedIngredients || []).map((ing, index) => ({
      text: ing.original,
      name: ing.originalName || ing.name,
      quantity: ing.amount > 0 ? ing.amount : undefined,
      unit: ing.unit || undefined,
      notes: undefined,
      category: 'Other',
      order_index: index
    }));

    // Extract instructions
    const instructions: InstructionStep[] = [];
    if (spoon.analyzedInstructions && spoon.analyzedInstructions.length > 0) {
      const analyzed = spoon.analyzedInstructions[0];
      for (const step of analyzed.steps) {
        instructions.push({
          step_number: step.number,
          text: step.step,
          estimated_time: step.length?.number,
          equipment: step.equipment?.map(e => e.name) || [],
          ingredients_referenced: step.ingredients?.map(i => i.name) || []
        });
      }
    }

    // Extract nutrition
    let nutrition: NutritionInfo | undefined;
    if (spoon.nutrition?.nutrients) {
      const nutrients = spoon.nutrition.nutrients;
      nutrition = {
        calories: this.findNutrient(nutrients, 'Calories'),
        protein_g: this.findNutrient(nutrients, 'Protein'),
        fat_g: this.findNutrient(nutrients, 'Fat'),
        carbohydrates_g: this.findNutrient(nutrients, 'Carbohydrates'),
        fiber_g: this.findNutrient(nutrients, 'Fiber'),
        sugar_g: this.findNutrient(nutrients, 'Sugar'),
        sodium_mg: this.findNutrient(nutrients, 'Sodium'),
        cholesterol_mg: this.findNutrient(nutrients, 'Cholesterol')
      };
    }

    return {
      title: spoon.title,
      description: spoon.summary?.replace(/<[^>]*>/g, ''), // Strip HTML
      source_url: spoon.sourceUrl || spoon.spoonacularSourceUrl || `https://spoonacular.com/recipes/${spoon.title.toLowerCase().replace(/\s+/g, '-')}-${spoon.id}`,
      image_url: spoon.image,
      ingredients,
      instructions,
      servings: spoon.servings,
      prep_time: spoon.preparationMinutes,
      cook_time: spoon.cookingMinutes,
      total_time: spoon.readyInMinutes,
      cuisine_type: spoon.cuisines?.[0],
      tags: [
        ...(spoon.cuisines || []),
        ...(spoon.dishTypes || []),
        ...(spoon.diets || [])
      ],
      nutrition
    };
  }

  /**
   * Helper to find nutrient value by name
   */
  private findNutrient(nutrients: Array<{ name: string; amount: number; unit: string }>, name: string): number | undefined {
    const nutrient = nutrients.find(n => n.name.toLowerCase() === name.toLowerCase());
    return nutrient?.amount;
  }

  /**
   * Get current request count (for monitoring)
   */
  getRequestCount(): number {
    return this.requestCount;
  }

  /**
   * Reset daily counter (called at midnight)
   */
  resetDailyCounter(): void {
    this.requestCount = 0;
    console.log('🔄 Spoonacular daily counter reset');
  }
}
