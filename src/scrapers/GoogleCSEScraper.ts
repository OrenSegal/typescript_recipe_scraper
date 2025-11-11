/**
 * Google Custom Search API Recipe Scraper
 * FREE TIER: 100 queries/day
 *
 * Uses Google CSE to find recipes with schema.org markup
 * Filters for Recipe structured data on high-quality sites
 *
 * Setup: Requires GOOGLE_API_KEY and GOOGLE_CSE_CX in .env
 * Docs: https://developers.google.com/custom-search/v1/overview
 */

import axios from 'axios';
import type { Recipe, RecipeIngredient, InstructionStep } from '../shared/types.js';

const GOOGLE_CSE_API = 'https://www.googleapis.com/customsearch/v1';
const DAILY_LIMIT = 100;

export interface GoogleCSESearchOptions {
  query: string; // Recipe search query
  num?: number; // Number of results (1-10, default: 5)
}

interface GoogleCSEItem {
  title: string;
  link: string;
  snippet?: string;
  pagemap?: {
    metatags?: Array<{
      'og:type'?: string;
      'og:title'?: string;
      'og:image'?: string;
      'og:description'?: string;
      itemtype?: string;
    }>;
    recipe?: Array<{
      name?: string;
      image?: string;
      description?: string;
      recipeingredient?: string[];
      recipeinstructions?: string[];
      recipeyield?: string;
      preptime?: string;
      cooktime?: string;
      totaltime?: string;
    }>;
  };
}

interface GoogleCSEResponse {
  items?: GoogleCSEItem[];
  searchInformation?: {
    totalResults: string;
  };
}

export class GoogleCSEScraper {
  private static instance: GoogleCSEScraper;
  private requestCount = 0;
  private dailyQueries = 0;
  private lastResetDate: string;
  private apiKey: string | undefined;
  private cxId: string | undefined;

  private constructor() {
    this.apiKey = process.env.GOOGLE_API_KEY;
    this.cxId = process.env.GOOGLE_CSE_CX;
    this.lastResetDate = new Date().toDateString();
  }

  static getInstance(): GoogleCSEScraper {
    if (!GoogleCSEScraper.instance) {
      GoogleCSEScraper.instance = new GoogleCSEScraper();
    }
    return GoogleCSEScraper.instance;
  }

  /**
   * Check if API is configured
   */
  isConfigured(): boolean {
    return !!(this.apiKey && this.cxId);
  }

  /**
   * Check if daily limit reached
   */
  hasReachedLimit(): boolean {
    this.resetDailyCounterIfNeeded();
    return this.dailyQueries >= DAILY_LIMIT;
  }

  /**
   * Reset daily counter at midnight
   */
  private resetDailyCounterIfNeeded(): void {
    const today = new Date().toDateString();
    if (today !== this.lastResetDate) {
      this.dailyQueries = 0;
      this.lastResetDate = today;
      console.log('🔄 Google CSE daily counter reset');
    }
  }

  /**
   * Search for recipes using Google Custom Search
   */
  async searchRecipes(options: GoogleCSESearchOptions): Promise<Recipe[]> {
    if (!this.isConfigured()) {
      console.warn('⚠️  Google CSE not configured (missing API key or CX)');
      return [];
    }

    if (this.hasReachedLimit()) {
      console.warn(`⚠️  Google CSE daily limit reached (${DAILY_LIMIT}/day)`);
      return [];
    }

    try {
      console.log(`🔍 Google CSE: Searching for "${options.query}"`);

      const response = await axios.get<GoogleCSEResponse>(GOOGLE_CSE_API, {
        params: {
          key: this.apiKey,
          cx: this.cxId,
          q: `${options.query} recipe`,
          num: options.num || 5,
        },
        timeout: 10000,
      });

      this.requestCount++;
      this.dailyQueries++;

      if (!response.data?.items || response.data.items.length === 0) {
        console.log('⚠️  No recipes found via Google CSE');
        return [];
      }

      // Filter for items with Recipe schema markup
      const recipeItems = response.data.items.filter((item) =>
        this.hasRecipeSchema(item)
      );

      console.log(`✅ Found ${recipeItems.length} recipes with schema.org markup`);
      console.log(`   Remaining quota today: ${DAILY_LIMIT - this.dailyQueries}/${DAILY_LIMIT}`);

      const recipes: Recipe[] = [];
      for (const item of recipeItems) {
        const recipe = this.convertToRecipe(item);
        if (recipe) {
          recipes.push(recipe);
        }
      }

      return recipes;
    } catch (error: any) {
      console.error('❌ Google CSE search error:', error.message);
      return [];
    }
  }

  /**
   * Check if item has Recipe schema.org markup
   */
  private hasRecipeSchema(item: GoogleCSEItem): boolean {
    // Check for schema.org/Recipe in itemtype
    const hasRecipeItemType = item.pagemap?.metatags?.some(
      (tag) => tag.itemtype === 'http://schema.org/Recipe' || tag.itemtype === 'https://schema.org/Recipe'
    ) || false;

    // Check for Recipe data in pagemap
    const hasRecipeData = !!(item.pagemap?.recipe && item.pagemap.recipe.length > 0);

    // Check for recipe-related og:type
    const hasRecipeOgType = item.pagemap?.metatags?.some(
      (tag) => tag['og:type']?.toLowerCase().includes('recipe')
    ) || false;

    return hasRecipeItemType || hasRecipeData || hasRecipeOgType;
  }

  /**
   * Convert Google CSE item to Recipe format
   */
  private convertToRecipe(item: GoogleCSEItem): Recipe | null {
    // Try to extract from pagemap.recipe first (best data)
    if (item.pagemap?.recipe && item.pagemap.recipe.length > 0) {
      const recipeData = item.pagemap.recipe[0];

      // Parse ingredients
      const ingredients: RecipeIngredient[] = (recipeData.recipeingredient || []).map((text, index) => ({
        text,
        name: text.split(/\d/)[0]?.trim() || text,
        quantity: undefined,
        unit: undefined,
        notes: undefined,
        category: 'Other',
        order_index: index,
      }));

      // Parse instructions
      let instructions: InstructionStep[] = [];
      if (recipeData.recipeinstructions) {
        // Instructions might be an array of strings or a single string
        const instructionTexts = Array.isArray(recipeData.recipeinstructions)
          ? recipeData.recipeinstructions
          : [recipeData.recipeinstructions];

        instructions = instructionTexts.map((text, index) => ({
          step_number: index + 1,
          text,
        }));
      }

      // Parse times (ISO 8601 duration format: PT20M = 20 minutes)
      const parseISODuration = (duration?: string): number | undefined => {
        if (!duration) return undefined;
        const match = duration.match(/PT(\d+)M/);
        return match ? parseInt(match[1]) : undefined;
      };

      return {
        title: recipeData.name || item.title,
        description: recipeData.description || item.snippet,
        source_url: item.link,
        image_url: recipeData.image || item.pagemap?.metatags?.[0]?.['og:image'],
        ingredients,
        instructions,
        servings: recipeData.recipeyield ? parseInt(recipeData.recipeyield) : undefined,
        prep_time: parseISODuration(recipeData.preptime),
        cook_time: parseISODuration(recipeData.cooktime),
        total_time: parseISODuration(recipeData.totaltime),
        cuisine_type: undefined,
        tags: undefined,
        nutrition: undefined,
        publisher: 'Google Custom Search',
      };
    }

    // Fallback to basic metadata
    const title = item.pagemap?.metatags?.[0]?.['og:title'] || item.title;
    const description = item.pagemap?.metatags?.[0]?.['og:description'] || item.snippet;
    const image = item.pagemap?.metatags?.[0]?.['og:image'];

    // Basic recipe with minimal data (will trigger web scraping for full details)
    return {
      title,
      description,
      source_url: item.link,
      image_url: image,
      ingredients: [],
      instructions: [
        {
          step_number: 1,
          text: `Visit ${item.link} for full recipe details`,
        },
      ],
      servings: undefined,
      prep_time: undefined,
      cook_time: undefined,
      total_time: undefined,
      cuisine_type: undefined,
      tags: undefined,
      nutrition: undefined,
      publisher: 'Google Custom Search',
    };
  }

  /**
   * Get current quota usage
   */
  getQuotaInfo(): { used: number; remaining: number; limit: number } {
    this.resetDailyCounterIfNeeded();
    return {
      used: this.dailyQueries,
      remaining: DAILY_LIMIT - this.dailyQueries,
      limit: DAILY_LIMIT,
    };
  }

  /**
   * Get total request count
   */
  getRequestCount(): number {
    return this.requestCount;
  }

  /**
   * Reset request counter
   */
  resetCounter(): void {
    this.requestCount = 0;
    console.log('🔄 Google CSE counter reset');
  }
}

// Export singleton instance
export const googleCSE = GoogleCSEScraper.getInstance();
