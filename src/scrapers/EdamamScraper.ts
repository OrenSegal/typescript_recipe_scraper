/**
 * Edamam Recipe API Scraper
 * Free tier: 10,000 requests/month
 * Features: Recipe search, nutrition analysis, dietary filters
 *
 * Docs: https://developer.edamam.com/edamam-recipe-api
 */

import axios from 'axios';
import type { Recipe, RecipeIngredient, InstructionStep, NutritionInfo } from '../shared/types.js';

const BASE_URL = 'https://api.edamam.com/api/recipes/v2';

// API credentials should be set in environment variables
const APP_ID = process.env.EDAMAM_APP_ID || '';
const APP_KEY = process.env.EDAMAM_APP_KEY || '';

export interface EdamamSearchOptions {
  query?: string;
  cuisineType?: string; // American, Asian, British, etc.
  mealType?: string; // Breakfast, Dinner, Lunch, Snack
  dishType?: string; // Biscuits and cookies, Bread, Desserts, Main course, etc.
  diet?: string; // balanced, high-fiber, high-protein, low-carb, low-fat, low-sodium
  health?: string; // alcohol-free, dairy-free, gluten-free, peanut-free, vegan, vegetarian
  from?: number; // pagination
  to?: number;
}

interface EdamamRecipe {
  recipe: {
    uri: string;
    label: string;
    image?: string;
    images?: {
      REGULAR?: { url: string };
      SMALL?: { url: string };
      THUMBNAIL?: { url: string };
    };
    source: string;
    url: string;
    yield: number;
    dietLabels?: string[];
    healthLabels?: string[];
    cautions?: string[];
    ingredientLines: string[];
    ingredients: Array<{
      text: string;
      quantity: number;
      measure: string;
      food: string;
      weight: number;
    }>;
    calories: number;
    totalTime?: number;
    cuisineType?: string[];
    mealType?: string[];
    dishType?: string[];
    totalNutrients?: {
      [key: string]: {
        label: string;
        quantity: number;
        unit: string;
      };
    };
  };
}

export class EdamamScraper {
  private static instance: EdamamScraper;
  private requestCount = 0;
  private monthlyLimit = 10000;

  private constructor() {}

  static getInstance(): EdamamScraper {
    if (!EdamamScraper.instance) {
      EdamamScraper.instance = new EdamamScraper();
    }
    return EdamamScraper.instance;
  }

  /**
   * Check if API credentials are configured
   */
  isConfigured(): boolean {
    return !!APP_ID && !!APP_KEY && APP_ID.length > 0 && APP_KEY.length > 0;
  }

  /**
   * Check if we've reached the monthly limit
   */
  hasReachedLimit(): boolean {
    return this.requestCount >= this.monthlyLimit;
  }

  /**
   * Search for recipes
   */
  async searchRecipes(options: EdamamSearchOptions): Promise<Recipe[]> {
    if (!this.isConfigured()) {
      console.warn('⚠️  Edamam API credentials not configured, skipping');
      return [];
    }

    if (this.hasReachedLimit()) {
      console.warn(`⚠️  Edamam monthly limit reached (${this.monthlyLimit} requests)`);
      return [];
    }

    try {
      const params = new URLSearchParams({
        type: 'public',
        app_id: APP_ID,
        app_key: APP_KEY,
        q: options.query || '',
        from: String(options.from || 0),
        to: String(options.to || 5)
      });

      if (options.cuisineType) params.append('cuisineType', options.cuisineType);
      if (options.mealType) params.append('mealType', options.mealType);
      if (options.dishType) params.append('dishType', options.dishType);
      if (options.diet) params.append('diet', options.diet);
      if (options.health) params.append('health', options.health);

      const url = `${BASE_URL}?${params}`;
      console.log(`🌐 Edamam API request: ${options.query}`);

      const response = await axios.get(url, { timeout: 10000 });
      this.requestCount++;

      if (!response.data?.hits || response.data.hits.length === 0) {
        console.log('⚠️  No recipes found in Edamam');
        return [];
      }

      console.log(`✅ Found ${response.data.hits.length} recipes from Edamam`);

      const recipes = response.data.hits.map((hit: EdamamRecipe) =>
        this.convertToRecipe(hit.recipe)
      );

      return recipes;
    } catch (error: any) {
      if (error.response?.status === 429) {
        console.error('❌ Edamam API: Rate limit exceeded');
        this.requestCount = this.monthlyLimit;
      } else {
        console.error('❌ Edamam API error:', error.message);
      }
      return [];
    }
  }

  /**
   * Convert Edamam format to our Recipe format
   */
  private convertToRecipe(edamam: EdamamRecipe['recipe']): Recipe {
    // Extract ingredients
    const ingredients: RecipeIngredient[] = edamam.ingredientLines.map((text, index) => {
      // Try to match with detailed ingredient data
      const detailed = edamam.ingredients[index];

      return {
        text,
        name: detailed?.food || text.replace(/^[\d\s\/\-\.]+/, '').trim(),
        quantity: detailed?.quantity,
        unit: detailed?.measure !== '<unit>' ? detailed?.measure : undefined,
        notes: undefined,
        category: 'Other',
        order_index: index
      };
    });

    // Edamam doesn't provide structured instructions, only ingredient lines
    // We'll create a single instruction step
    const instructions: InstructionStep[] = [
      {
        step_number: 1,
        text: `See original recipe at ${edamam.url}`
      }
    ];

    // Extract nutrition (Edamam has excellent nutrition data)
    let nutrition: NutritionInfo | undefined;
    if (edamam.totalNutrients) {
      const nutrients = edamam.totalNutrients;
      nutrition = {
        calories: Math.round(edamam.calories / edamam.yield), // Per serving
        protein_g: nutrients.PROCNT ? Math.round(nutrients.PROCNT.quantity / edamam.yield) : undefined,
        fat_g: nutrients.FAT ? Math.round(nutrients.FAT.quantity / edamam.yield) : undefined,
        carbohydrates_g: nutrients.CHOCDF ? Math.round(nutrients.CHOCDF.quantity / edamam.yield) : undefined,
        fiber_g: nutrients.FIBTG ? Math.round(nutrients.FIBTG.quantity / edamam.yield) : undefined,
        sugar_g: nutrients.SUGAR ? Math.round(nutrients.SUGAR.quantity / edamam.yield) : undefined,
        sodium_mg: nutrients.NA ? Math.round(nutrients.NA.quantity / edamam.yield) : undefined,
        cholesterol_mg: nutrients.CHOLE ? Math.round(nutrients.CHOLE.quantity / edamam.yield) : undefined
      };
    }

    // Get image URL (prefer REGULAR size)
    let imageUrl = edamam.image;
    if (edamam.images?.REGULAR) {
      imageUrl = edamam.images.REGULAR.url;
    }

    return {
      title: edamam.label,
      description: undefined,
      source_url: edamam.url,
      image_url: imageUrl,
      ingredients,
      instructions,
      servings: edamam.yield,
      prep_time: undefined,
      cook_time: undefined,
      total_time: edamam.totalTime,
      cuisine_type: edamam.cuisineType?.[0],
      tags: [
        ...(edamam.cuisineType || []),
        ...(edamam.mealType || []),
        ...(edamam.dishType || []),
        ...(edamam.dietLabels || []),
        ...(edamam.healthLabels || [])
      ],
      nutrition,
      publisher: edamam.source
    };
  }

  /**
   * Get current request count (for monitoring)
   */
  getRequestCount(): number {
    return this.requestCount;
  }

  /**
   * Reset monthly counter
   */
  resetMonthlyCounter(): void {
    this.requestCount = 0;
    console.log('🔄 Edamam monthly counter reset');
  }
}

// Export singleton instance
export const edamam = EdamamScraper.getInstance();
