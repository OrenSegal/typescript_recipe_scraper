/**
 * RecipePuppy API Scraper
 * 100% FREE - No API key required, no rate limits
 *
 * Simple recipe search API with basic data
 * Great for fallback when other APIs fail
 *
 * Docs: http://www.recipepuppy.com/about/api/
 */

import axios from 'axios';
import type { Recipe, RecipeIngredient, InstructionStep } from '../shared/types.js';

const BASE_URL = 'http://www.recipepuppy.com/api/';

export interface RecipePuppySearchOptions {
  query?: string; // Recipe keywords
  ingredients?: string; // Comma-separated ingredients
  page?: number; // Pagination (1-based)
}

interface RecipePuppyResult {
  title: string;
  href: string;
  ingredients: string;
  thumbnail: string;
}

interface RecipePuppyResponse {
  title: string;
  version: number;
  href: string;
  results: RecipePuppyResult[];
}

export class RecipePuppyScraper {
  private static instance: RecipePuppyScraper;
  private requestCount = 0;

  private constructor() {}

  static getInstance(): RecipePuppyScraper {
    if (!RecipePuppyScraper.instance) {
      RecipePuppyScraper.instance = new RecipePuppyScraper();
    }
    return RecipePuppyScraper.instance;
  }

  /**
   * Search for recipes (completely free, no API key needed)
   */
  async searchRecipes(options: RecipePuppySearchOptions): Promise<Recipe[]> {
    try {
      const params = new URLSearchParams();

      if (options.query) {
        params.append('q', options.query);
      }
      if (options.ingredients) {
        params.append('i', options.ingredients);
      }
      if (options.page) {
        params.append('p', String(options.page));
      }

      const url = `${BASE_URL}?${params}`;
      console.log(`🌐 RecipePuppy API request: ${options.query || options.ingredients || 'all'}`);

      const response = await axios.get<RecipePuppyResponse>(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; RecipeScraperBot/1.0)'
        }
      });

      this.requestCount++;

      if (!response.data?.results || response.data.results.length === 0) {
        console.log('⚠️  No recipes found in RecipePuppy');
        return [];
      }

      console.log(`✅ Found ${response.data.results.length} recipes from RecipePuppy`);

      const recipes = response.data.results
        .filter(result => result.href && result.title) // Filter out invalid results
        .map(result => this.convertToRecipe(result));

      return recipes;
    } catch (error: any) {
      console.error('❌ RecipePuppy API error:', error.message);
      return [];
    }
  }

  /**
   * Convert RecipePuppy format to our Recipe format
   */
  private convertToRecipe(puppy: RecipePuppyResult): Recipe {
    // Parse ingredients string (comma-separated)
    const ingredientTexts = puppy.ingredients
      .split(',')
      .map(i => i.trim())
      .filter(i => i.length > 0);

    const ingredients: RecipeIngredient[] = ingredientTexts.map((text, index) => ({
      text,
      name: text,
      quantity: undefined,
      unit: undefined,
      notes: undefined,
      category: 'Other',
      order_index: index
    }));

    // RecipePuppy doesn't provide instructions, just source URL
    const instructions: InstructionStep[] = [
      {
        step_number: 1,
        text: `See full recipe at ${puppy.href}`
      }
    ];

    return {
      title: puppy.title,
      description: undefined,
      source_url: puppy.href,
      image_url: puppy.thumbnail || undefined,
      ingredients,
      instructions,
      servings: undefined,
      prep_time: undefined,
      cook_time: undefined,
      total_time: undefined,
      tags: [],
      nutrition: undefined,
      publisher: this.extractDomain(puppy.href)
    };
  }

  /**
   * Extract domain name from URL for attribution
   */
  private extractDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '');
    } catch {
      return 'Unknown';
    }
  }

  /**
   * Get current request count (for monitoring)
   */
  getRequestCount(): number {
    return this.requestCount;
  }

  /**
   * Reset request counter
   */
  resetCounter(): void {
    this.requestCount = 0;
    console.log('🔄 RecipePuppy counter reset');
  }
}

// Export singleton instance
export const recipepuppy = RecipePuppyScraper.getInstance();
