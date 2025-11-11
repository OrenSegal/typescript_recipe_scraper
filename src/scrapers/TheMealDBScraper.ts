/**
 * TheMealDB MCP Client
 * Free, unlimited recipe API access to 2.3M+ recipes
 * Documentation: https://www.themealdb.com/api.php
 */

import axios from 'axios';
import type { Recipe, RecipeIngredient, InstructionStep } from '../shared/types.js';

const BASE_URL = 'https://www.themealdb.com/api/json/v1/1';

export interface TheMealDBRecipe {
  idMeal: string;
  strMeal: string;
  strCategory: string;
  strArea: string;
  strInstructions: string;
  strMealThumb: string;
  strYoutube?: string;
  strSource?: string;
  strTags?: string;
  [key: string]: string | undefined;
}

export interface TheMealDBSearchOptions {
  query?: string;       // Search by recipe name
  category?: string;    // Filter by category (e.g., 'Seafood', 'Vegetarian')
  area?: string;        // Filter by cuisine (e.g., 'Italian', 'Mexican')
  ingredient?: string;  // Search by main ingredient
  random?: boolean;     // Get random recipe
  letter?: string;      // Search by first letter
}

export class TheMealDBScraper {
  private static instance: TheMealDBScraper;

  private constructor() {}

  static getInstance(): TheMealDBScraper {
    if (!TheMealDBScraper.instance) {
      TheMealDBScraper.instance = new TheMealDBScraper();
    }
    return TheMealDBScraper.instance;
  }

  /**
   * Search recipes using TheMealDB API
   */
  async searchRecipes(options: TheMealDBSearchOptions): Promise<Recipe[]> {
    try {
      let url = '';

      if (options.random) {
        url = `${BASE_URL}/random.php`;
      } else if (options.query) {
        url = `${BASE_URL}/search.php?s=${encodeURIComponent(options.query)}`;
      } else if (options.ingredient) {
        url = `${BASE_URL}/filter.php?i=${encodeURIComponent(options.ingredient)}`;
      } else if (options.category) {
        url = `${BASE_URL}/filter.php?c=${encodeURIComponent(options.category)}`;
      } else if (options.area) {
        url = `${BASE_URL}/filter.php?a=${encodeURIComponent(options.area)}`;
      } else if (options.letter) {
        url = `${BASE_URL}/search.php?f=${options.letter}`;
      } else {
        throw new Error('At least one search parameter is required');
      }

      console.log(`🌐 TheMealDB API request: ${url}`);

      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Universal-Recipe-Scraper/1.0'
        }
      });

      if (!response.data || !response.data.meals) {
        console.log('⚠️  No recipes found in TheMealDB');
        return [];
      }

      const meals: TheMealDBRecipe[] = response.data.meals;

      // If we got filter results (only id and name), fetch full details
      if (meals[0] && !meals[0].strInstructions) {
        console.log(`📥 Fetching full details for ${meals.length} recipes...`);
        const detailedRecipes = await Promise.all(
          meals.slice(0, 10).map(meal => this.getRecipeById(meal.idMeal))
        );
        return detailedRecipes.filter((r: Recipe | null): r is Recipe => r !== null);
      }

      // Convert to our Recipe format
      const recipes = meals.map(meal => this.convertToRecipe(meal));
      console.log(`✅ Found ${recipes.length} recipes from TheMealDB`);

      return recipes;

    } catch (error: any) {
      console.error('❌ TheMealDB API error:', error.message);
      return [];
    }
  }

  /**
   * Get a specific recipe by ID
   */
  async getRecipeById(id: string): Promise<Recipe | null> {
    try {
      const url = `${BASE_URL}/lookup.php?i=${id}`;
      const response = await axios.get(url, { timeout: 10000 });

      if (!response.data?.meals?.[0]) {
        return null;
      }

      return this.convertToRecipe(response.data.meals[0]);

    } catch (error: any) {
      console.error(`❌ Error fetching recipe ${id}:`, error.message);
      return null;
    }
  }

  /**
   * Get random recipe
   */
  async getRandomRecipe(): Promise<Recipe | null> {
    const recipes = await this.searchRecipes({ random: true });
    return recipes[0] || null;
  }

  /**
   * List all available categories
   */
  async getCategories(): Promise<string[]> {
    try {
      const response = await axios.get(`${BASE_URL}/categories.php`);
      return response.data.categories.map((cat: any) => cat.strCategory);
    } catch (error) {
      console.error('❌ Error fetching categories:', error);
      return [];
    }
  }

  /**
   * List all available cuisines/areas
   */
  async getAreas(): Promise<string[]> {
    try {
      const response = await axios.get(`${BASE_URL}/list.php?a=list`);
      return response.data.meals.map((area: any) => area.strArea);
    } catch (error) {
      console.error('❌ Error fetching areas:', error);
      return [];
    }
  }

  /**
   * Convert TheMealDB recipe format to our standard Recipe format
   */
  private convertToRecipe(meal: TheMealDBRecipe): Recipe {
    // Extract ingredients and measurements
    const ingredients: RecipeIngredient[] = [];
    for (let i = 1; i <= 20; i++) {
      const ingredient = meal[`strIngredient${i}`];
      const measure = meal[`strMeasure${i}`];

      if (ingredient && ingredient.trim()) {
        ingredients.push({
          text: `${measure?.trim() || ''} ${ingredient.trim()}`.trim(),
          name: ingredient.trim(),
          quantity: undefined,
          unit: measure?.trim() || undefined,
          notes: undefined,
          category: 'Other',
          order_index: i - 1
        });
      }
    }

    // Parse instructions into steps
    const instructionsText = meal.strInstructions || '';
    const instructions: InstructionStep[] = instructionsText
      .split(/\r?\n/)
      .filter(line => line.trim())
      .map((step, index) => ({
        step_number: index + 1,
        text: step.trim(),
        action: null,
        timer_min: [],
        equipment: [],
        mentioned_ingredients: []
      }));

    // Parse tags
    const tags = meal.strTags
      ? meal.strTags.split(',').map(tag => tag.trim())
      : [];

    // Add category and area as tags
    if (meal.strCategory) tags.push(meal.strCategory);
    if (meal.strArea) tags.push(meal.strArea);

    const recipe: Recipe = {
      title: meal.strMeal,
      description: `${meal.strArea || 'International'} ${meal.strCategory || 'dish'}`,
      source_url: meal.strSource || `https://www.themealdb.com/meal/${meal.idMeal}`,
      image_url: meal.strMealThumb,
      ingredients,
      instructions,

      // Metadata
      servings: undefined,
      prep_time: undefined,
      cook_time: undefined,
      total_time: undefined,

      // Classification
      cuisine_type: meal.strArea,
      tags,

      // Nutrition (not provided by TheMealDB)
      nutrition: undefined
    };

    return recipe;
  }

  /**
   * Check if TheMealDB API is available
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await axios.get(`${BASE_URL}/random.php`, {
        timeout: 5000
      });
      return !!response.data?.meals;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get statistics about TheMealDB
   */
  async getStats(): Promise<{
    categories: number;
    areas: number;
    available: boolean;
  }> {
    try {
      const [categories, areas, available] = await Promise.all([
        this.getCategories(),
        this.getAreas(),
        this.healthCheck()
      ]);

      return {
        categories: categories.length,
        areas: areas.length,
        available
      };
    } catch (error) {
      return {
        categories: 0,
        areas: 0,
        available: false
      };
    }
  }
}

// Export singleton instance
export const themealdb = TheMealDBScraper.getInstance();
