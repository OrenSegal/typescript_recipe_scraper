/**
 * Spoonacular API Scraper
 * Free tier: 150 requests/day
 * Features: Recipe search, nutrition data, ingredient substitutions, meal planning
 *
 * Docs: https://spoonacular.com/food-api/docs
 */

import axios from 'axios';
import type { Recipe, RecipeIngredient, InstructionStep, NutritionInfo } from '../shared/types.js';

const BASE_URL = 'https://api.spoonacular.com';

// API Key should be set in environment variable SPOONACULAR_API_KEY
const API_KEY = process.env.SPOONACULAR_API_KEY || '';

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

export class SpoonacularScraper {
  private static instance: SpoonacularScraper;
  private requestCount = 0;
  private dailyLimit = 150;

  private constructor() {}

  static getInstance(): SpoonacularScraper {
    if (!SpoonacularScraper.instance) {
      SpoonacularScraper.instance = new SpoonacularScraper();
    }
    return SpoonacularScraper.instance;
  }

  /**
   * Check if API key is configured
   */
  isConfigured(): boolean {
    return !!API_KEY && API_KEY.length > 0;
  }

  /**
   * Check if we've reached the daily limit
   */
  hasReachedLimit(): boolean {
    return this.requestCount >= this.dailyLimit;
  }

  /**
   * Search for recipes
   */
  async searchRecipes(options: SpoonacularSearchOptions): Promise<Recipe[]> {
    if (!this.isConfigured()) {
      console.warn('⚠️  Spoonacular API key not configured, skipping');
      return [];
    }

    if (this.hasReachedLimit()) {
      console.warn(`⚠️  Spoonacular daily limit reached (${this.dailyLimit} requests)`);
      return [];
    }

    try {
      const params = new URLSearchParams({
        apiKey: API_KEY,
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

      const response = await axios.get(url, { timeout: 10000 });
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
  async getRecipeById(id: number): Promise<Recipe | null> {
    if (!this.isConfigured()) return null;
    if (this.hasReachedLimit()) return null;

    try {
      const params = new URLSearchParams({
        apiKey: API_KEY,
        includeNutrition: 'true'
      });

      const url = `${BASE_URL}/recipes/${id}/information?${params}`;
      const response = await axios.get(url, { timeout: 10000 });
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

// Export singleton instance
export const spoonacular = SpoonacularScraper.getInstance();
