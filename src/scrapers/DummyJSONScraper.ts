/**
 * DummyJSON Recipe Scraper
 * 100% FREE - No API key, unlimited requests
 *
 * DummyJSON provides fake/sample recipe data for testing and development
 * Perfect fallback source with reliable structured data
 *
 * API Docs: https://dummyjson.com/docs/recipes
 * Endpoint: https://dummyjson.com/recipes
 */

import axios from 'axios';
import type { Recipe, RecipeIngredient as Ingredient, InstructionStep as Instruction } from '../shared/types.js';

const DUMMYJSON_BASE_URL = 'https://dummyjson.com';

interface DummyJSONRecipe {
  id: number;
  name: string;
  ingredients: string[];
  instructions: string[];
  prepTimeMinutes: number;
  cookTimeMinutes: number;
  servings: number;
  difficulty: string;
  cuisine: string;
  caloriesPerServing: number;
  tags: string[];
  userId: number;
  image: string;
  rating: number;
  reviewCount: number;
  mealType: string[];
}

interface DummyJSONResponse {
  recipes: DummyJSONRecipe[];
  total: number;
  skip: number;
  limit: number;
}

interface SearchOptions {
  query?: string;
  limit?: number;
  skip?: number;
}

/**
 * Scraper for DummyJSON Recipe API
 * Provides sample/test recipe data with no authentication
 */
export class DummyJSONScraper {
  private static instance: DummyJSONScraper;
  private recipeCache: DummyJSONRecipe[] | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_TTL = 1000 * 60 * 60; // 1 hour

  private constructor() {}

  /**
   * Get singleton instance
   */
  public static getInstance(): DummyJSONScraper {
    if (!DummyJSONScraper.instance) {
      DummyJSONScraper.instance = new DummyJSONScraper();
    }
    return DummyJSONScraper.instance;
  }

  /**
   * Get all recipes (cached for performance)
   */
  private async getAllRecipes(): Promise<DummyJSONRecipe[]> {
    const now = Date.now();

    // Return cached data if still valid
    if (this.recipeCache && now - this.cacheTimestamp < this.CACHE_TTL) {
      return this.recipeCache;
    }

    try {
      console.log('🌐 DummyJSON API request: fetching all recipes');

      const response = await axios.get<DummyJSONResponse>(`${DUMMYJSON_BASE_URL}/recipes`, {
        params: {
          limit: 0, // Get all recipes
        },
        timeout: 10000,
      });

      this.recipeCache = response.data.recipes || [];
      this.cacheTimestamp = now;

      console.log(`✅ Found ${this.recipeCache.length} recipes from DummyJSON`);

      return this.recipeCache;
    } catch (error: any) {
      console.error('❌ DummyJSON API error:', error.message);
      return [];
    }
  }

  /**
   * Search for recipes by name
   */
  public async searchRecipes(options: SearchOptions): Promise<Recipe[]> {
    try {
      const allRecipes = await this.getAllRecipes();

      if (allRecipes.length === 0) {
        return [];
      }

      let filtered = allRecipes;

      // Filter by query if provided
      if (options.query) {
        const query = options.query.toLowerCase();
        filtered = allRecipes.filter((recipe) => {
          return (
            recipe.name.toLowerCase().includes(query) ||
            recipe.cuisine.toLowerCase().includes(query) ||
            recipe.tags.some((tag) => tag.toLowerCase().includes(query)) ||
            recipe.ingredients.some((ing) => ing.toLowerCase().includes(query))
          );
        });
      }

      // Apply pagination
      const skip = options.skip || 0;
      const limit = options.limit || 10;
      const paginated = filtered.slice(skip, skip + limit);

      // Convert to Recipe format
      return paginated.map((recipe) => this.convertToRecipe(recipe));
    } catch (error: any) {
      console.error('❌ DummyJSON search error:', error.message);
      return [];
    }
  }

  /**
   * Get a specific recipe by ID
   */
  public async getRecipe(id: number): Promise<Recipe | null> {
    try {
      const response = await axios.get<DummyJSONRecipe>(`${DUMMYJSON_BASE_URL}/recipes/${id}`, {
        timeout: 10000,
      });

      return this.convertToRecipe(response.data);
    } catch (error: any) {
      console.error(`❌ DummyJSON recipe error for ID ${id}:`, error.message);
      return null;
    }
  }

  /**
   * Get random recipes
   */
  public async getRandomRecipes(count: number = 5): Promise<Recipe[]> {
    try {
      const allRecipes = await this.getAllRecipes();

      if (allRecipes.length === 0) {
        return [];
      }

      // Shuffle and take first N recipes
      const shuffled = allRecipes.sort(() => 0.5 - Math.random());
      const selected = shuffled.slice(0, count);

      return selected.map((recipe) => this.convertToRecipe(recipe));
    } catch (error: any) {
      console.error('❌ DummyJSON random recipes error:', error.message);
      return [];
    }
  }

  /**
   * Search recipes by cuisine
   */
  public async searchByCuisine(cuisine_type: string, limit: number = 10): Promise<Recipe[]> {
    try {
      const allRecipes = await this.getAllRecipes();

      const filtered = allRecipes.filter((recipe) => recipe.cuisine.toLowerCase().includes(cuisine_type.toLowerCase()));

      const limited = filtered.slice(0, limit);

      return limited.map((recipe) => this.convertToRecipe(recipe));
    } catch (error: any) {
      console.error('❌ DummyJSON cuisine search error:', error.message);
      return [];
    }
  }

  /**
   * Search recipes by difficulty
   */
  public async searchByDifficulty(effort_level: string, limit: number = 10): Promise<Recipe[]> {
    try {
      const allRecipes = await this.getAllRecipes();

      const filtered = allRecipes.filter((recipe) => recipe.difficulty.toLowerCase() === effort_level.toLowerCase());

      const limited = filtered.slice(0, limit);

      return limited.map((recipe) => this.convertToRecipe(recipe));
    } catch (error: any) {
      console.error('❌ DummyJSON difficulty search error:', error.message);
      return [];
    }
  }

  /**
   * Convert DummyJSON recipe to standard Recipe format
   */
  private convertToRecipe(data: DummyJSONRecipe): Recipe {
    const recipe: Recipe = {
      title: data.name,
      description: `${data.cuisine} cuisine, ${data.difficulty} difficulty, rated ${data.rating}/5`,
      ingredients: this.parseIngredients(data.ingredients),
      instructions: this.parseInstructions(data.instructions),
      prep_time: data.prepTimeMinutes,
      cook_time: data.cookTimeMinutes,
      total_time: data.prepTimeMinutes + data.cookTimeMinutes,
      servings: data.servings,
      effort_level: data.difficulty.toLowerCase(),
      cuisine_type: data.cuisine,
      meal_types: data.mealType || ['main'],
      tags: data.tags || [],
      image_url: data.image,
      source_url: `https://dummyjson.com/recipes/${data.id}`,
      author: `DummyJSON User ${data.userId}`,
      nutrition: {
        calories: data.caloriesPerServing,
      },
    };

    return recipe;
  }

  /**
   * Parse ingredients array
   */
  private parseIngredients(ingredients: string[]): Ingredient[] {
    return ingredients.map((text, index) => ({
      name: text,
      text,
      order_index: index
    }));
  }

  /**
   * Parse instructions array
   */
  private parseInstructions(instructions: string[]): Instruction[] {
    return instructions.map((text, index) => ({
      step_number: index + 1,
      text,
    }));
  }

  /**
   * Clear cache (useful for testing)
   */
  public clearCache(): void {
    this.recipeCache = null;
    this.cacheTimestamp = 0;
  }
}

// Export singleton instance
export const dummyJSON = DummyJSONScraper.getInstance();
