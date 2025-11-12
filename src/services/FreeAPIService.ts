/**
 * Free API Service
 * Integrates multiple free APIs for recipe data enrichment
 *
 * Free APIs used:
 * 1. OpenFoodFacts (Free, no API key needed)
 * 2. Edamam Nutrition API (Free tier: 10 req/min, 10k req/month)
 * 3. Spoonacular (Free tier: 150 points/day)
 * 4. TheMealDB (Free tier: 1 request per 5 seconds)
 * 5. Recipe Puppy (Free, no API key)
 * 6. Tasty API (RapidAPI free tier)
 */

import { Nutrition } from '../types.js';

export interface APIResponse {
  success: boolean;
  data?: any;
  error?: string;
  provider: string;
  cached?: boolean;
}

export interface NutritionRequest {
  ingredientName: string;
  quantity?: number;
  unit?: string;
}

export class FreeAPIService {

  // Simple in-memory cache to reduce API calls
  private static cache: Map<string, { data: any; timestamp: number }> = new Map();
  private static CACHE_TTL = 3600000; // 1 hour

  /**
   * Get nutrition data with fallback chain
   */
  static async getNutrition(request: NutritionRequest): Promise<APIResponse> {
    const cacheKey = `nutrition_${request.ingredientName}_${request.quantity}_${request.unit}`;

    // Check cache first
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return {
        success: true,
        data: cached,
        provider: 'cache',
        cached: true
      };
    }

    // Try free APIs in order
    const providers = [
      { name: 'openfoodfacts', fn: () => this.getOpenFoodFactsNutrition(request) },
      { name: 'edamam', fn: () => this.getEdamamNutrition(request), enabled: !!process.env.EDAMAM_APP_ID },
      { name: 'usda', fn: () => this.getUSDANutrition(request), enabled: !!process.env.USDA_API_KEY }
    ];

    for (const provider of providers) {
      if (provider.enabled === false) continue;

      try {
        console.log(`🔄 Trying ${provider.name} for nutrition data...`);
        const result = await provider.fn();

        if (result.success && result.data) {
          // Cache successful result
          this.setCache(cacheKey, result.data);
          console.log(`✅ Got nutrition from ${provider.name}`);
          return { ...result, provider: provider.name };
        }
      } catch (error) {
        console.warn(`⚠️  ${provider.name} failed:`, error);
        continue;
      }
    }

    return {
      success: false,
      error: 'All nutrition API providers failed',
      provider: 'none'
    };
  }

  /**
   * OpenFoodFacts API (Free, no API key, global food database)
   */
  private static async getOpenFoodFactsNutrition(request: NutritionRequest): Promise<APIResponse> {
    const searchQuery = encodeURIComponent(request.ingredientName);
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${searchQuery}&search_simple=1&action=process&json=1`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'TypeScript Recipe Scraper/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`OpenFoodFacts API error: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.products || data.products.length === 0) {
      return { success: false, error: 'No products found', provider: 'openfoodfacts' };
    }

    // Get first product with complete nutrition data
    const product = data.products.find((p: any) => p.nutriments && p.nutriments.energy_100g);

    if (!product) {
      return { success: false, error: 'No complete nutrition data', provider: 'openfoodfacts' };
    }

    // Convert per 100g to requested quantity
    const multiplier = (request.quantity || 100) / 100;

    const nutrition: Nutrition = {
      calories: Math.round((product.nutriments.energy_kcal_100g || 0) * multiplier),
      protein_g: parseFloat(((product.nutriments.proteins_100g || 0) * multiplier).toFixed(2)),
      carbs_g: parseFloat(((product.nutriments.carbohydrates_100g || 0) * multiplier).toFixed(2)),
      fat_g: parseFloat(((product.nutriments.fat_100g || 0) * multiplier).toFixed(2)),
      fiber_g: parseFloat(((product.nutriments.fiber_100g || 0) * multiplier).toFixed(2)),
      sugar_g: parseFloat(((product.nutriments.sugars_100g || 0) * multiplier).toFixed(2)),
      sodium_mg: parseFloat(((product.nutriments.sodium_100g || 0) * 1000 * multiplier).toFixed(2))
    };

    return {
      success: true,
      data: nutrition,
      provider: 'openfoodfacts'
    };
  }

  /**
   * Edamam Nutrition API (Free tier: 10 req/min, 10k/month)
   */
  private static async getEdamamNutrition(request: NutritionRequest): Promise<APIResponse> {
    const appId = process.env.EDAMAM_APP_ID;
    const appKey = process.env.EDAMAM_APP_KEY;

    if (!appId || !appKey) {
      throw new Error('Edamam credentials not configured');
    }

    const ingredient = `${request.quantity || 100} ${request.unit || 'g'} ${request.ingredientName}`;
    const url = `https://api.edamam.com/api/nutrition-data?app_id=${appId}&app_key=${appKey}&ingr=${encodeURIComponent(ingredient)}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Edamam API error: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.calories) {
      return { success: false, error: 'No nutrition data', provider: 'edamam' };
    }

    const nutrition: Nutrition = {
      calories: Math.round(data.calories),
      protein_g: parseFloat((data.totalNutrients.PROCNT?.quantity || 0).toFixed(2)),
      carbs_g: parseFloat((data.totalNutrients.CHOCDF?.quantity || 0).toFixed(2)),
      fat_g: parseFloat((data.totalNutrients.FAT?.quantity || 0).toFixed(2)),
      fiber_g: parseFloat((data.totalNutrients.FIBTG?.quantity || 0).toFixed(2)),
      sugar_g: parseFloat((data.totalNutrients.SUGAR?.quantity || 0).toFixed(2)),
      sodium_mg: parseFloat((data.totalNutrients.NA?.quantity || 0).toFixed(2))
    };

    return {
      success: true,
      data: nutrition,
      provider: 'edamam'
    };
  }

  /**
   * USDA FoodData Central API (Free tier: 3600 req/hour)
   */
  private static async getUSDANutrition(request: NutritionRequest): Promise<APIResponse> {
    const apiKey = process.env.USDA_API_KEY;

    if (!apiKey) {
      throw new Error('USDA API key not configured');
    }

    // First, search for the ingredient
    const searchUrl = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${apiKey}&query=${encodeURIComponent(request.ingredientName)}&pageSize=1`;

    const searchResponse = await fetch(searchUrl);

    if (!searchResponse.ok) {
      throw new Error(`USDA API error: ${searchResponse.statusText}`);
    }

    const searchData = await searchResponse.json();

    if (!searchData.foods || searchData.foods.length === 0) {
      return { success: false, error: 'No foods found', provider: 'usda' };
    }

    const food = searchData.foods[0];
    const nutrients = food.foodNutrients || [];

    // USDA nutrient IDs
    const getNutrient = (nutrientId: number) => {
      const nutrient = nutrients.find((n: any) => n.nutrientId === nutrientId);
      return nutrient?.value || 0;
    };

    // Convert per 100g to requested quantity
    const multiplier = (request.quantity || 100) / 100;

    const nutrition: Nutrition = {
      calories: Math.round(getNutrient(1008) * multiplier), // Energy (kcal)
      protein_g: parseFloat((getNutrient(1003) * multiplier).toFixed(2)), // Protein
      carbs_g: parseFloat((getNutrient(1005) * multiplier).toFixed(2)), // Carbohydrates
      fat_g: parseFloat((getNutrient(1004) * multiplier).toFixed(2)), // Total lipid (fat)
      fiber_g: parseFloat((getNutrient(1079) * multiplier).toFixed(2)), // Fiber
      sugar_g: parseFloat((getNutrient(2000) * multiplier).toFixed(2)), // Sugars
      sodium_mg: parseFloat((getNutrient(1093) * multiplier).toFixed(2)) // Sodium
    };

    return {
      success: true,
      data: nutrition,
      provider: 'usda'
    };
  }

  /**
   * TheMealDB API (Free, no API key, recipe database)
   */
  static async searchRecipesByIngredient(ingredient: string): Promise<APIResponse> {
    const url = `https://www.themealdb.com/api/json/v1/1/filter.php?i=${encodeURIComponent(ingredient)}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`TheMealDB API error: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      success: true,
      data: data.meals || [],
      provider: 'themealdb'
    };
  }

  /**
   * Recipe Puppy API (Free, no API key)
   */
  static async searchRecipes(query: string): Promise<APIResponse> {
    const url = `http://www.recipepuppy.com/api/?q=${encodeURIComponent(query)}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Recipe Puppy API error: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      success: true,
      data: data.results || [],
      provider: 'recipepuppy'
    };
  }

  /**
   * Spoonacular API (Free tier: 150 points/day)
   */
  static async getRecipeDetails(recipeId: string): Promise<APIResponse> {
    const apiKey = process.env.SPOONACULAR_API_KEY;

    if (!apiKey) {
      return { success: false, error: 'Spoonacular API key not configured', provider: 'spoonacular' };
    }

    const url = `https://api.spoonacular.com/recipes/${recipeId}/information?apiKey=${apiKey}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Spoonacular API error: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      success: true,
      data: data,
      provider: 'spoonacular'
    };
  }

  /**
   * Cache management
   */
  private static getFromCache(key: string): any | null {
    const cached = this.cache.get(key);

    if (!cached) return null;

    // Check if expired
    if (Date.now() - cached.timestamp > this.CACHE_TTL) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  private static setCache(key: string, data: any): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });

    // Limit cache size to 1000 entries
    if (this.cache.size > 1000) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
  }

  /**
   * Clear cache
   */
  static clearCache(): void {
    this.cache.clear();
    console.log('✅ API cache cleared');
  }

  /**
   * Get cache statistics
   */
  static getCacheStats(): { size: number; ttl: number } {
    return {
      size: this.cache.size,
      ttl: this.CACHE_TTL
    };
  }

  /**
   * Test all configured APIs
   */
  static async testAPIs(): Promise<{ [key: string]: boolean }> {
    const results: { [key: string]: boolean } = {};

    // Test OpenFoodFacts (always available)
    try {
      const result = await this.getNutrition({ ingredientName: 'banana' });
      results.openfoodfacts = result.success;
    } catch (error) {
      results.openfoodfacts = false;
    }

    // Test Edamam if configured
    if (process.env.EDAMAM_APP_ID && process.env.EDAMAM_APP_KEY) {
      try {
        const result = await this.getEdamamNutrition({ ingredientName: 'banana' });
        results.edamam = result.success;
      } catch (error) {
        results.edamam = false;
      }
    }

    // Test USDA if configured
    if (process.env.USDA_API_KEY) {
      try {
        const result = await this.getUSDANutrition({ ingredientName: 'banana' });
        results.usda = result.success;
      } catch (error) {
        results.usda = false;
      }
    }

    // Test TheMealDB (always available)
    try {
      const result = await this.searchRecipesByIngredient('chicken');
      results.themealdb = result.success;
    } catch (error) {
      results.themealdb = false;
    }

    // Test Recipe Puppy (always available)
    try {
      const result = await this.searchRecipes('pasta');
      results.recipepuppy = result.success;
    } catch (error) {
      results.recipepuppy = false;
    }

    return results;
  }
}

export default FreeAPIService;
