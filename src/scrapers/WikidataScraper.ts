/**
 * Wikidata SPARQL Recipe Scraper
 * 100% FREE - No API key, unlimited requests
 *
 * Wikidata is a free knowledge base with structured recipe data
 * Query using SPARQL for dishes, ingredients, cuisines, and more
 *
 * Docs: https://www.wikidata.org/wiki/Wikidata:SPARQL_query_service
 */

import axios from 'axios';
import type { Recipe, RecipeIngredient, InstructionStep } from '../shared/types.js';

const WIKIDATA_ENDPOINT = 'https://query.wikidata.org/sparql';

export interface WikidataSearchOptions {
  query?: string; // Recipe name search
  cuisine?: string; // Cuisine type (e.g., "Italian", "Chinese")
  limit?: number; // Max results (default: 10)
}

interface WikidataBinding {
  recipe: { value: string };
  recipeLabel: { value: string };
  image?: { value: string };
  description?: { value: string };
  cuisine?: { value: string };
  cuisineLabel?: { value: string };
  ingredients?: { value: string };
  ingredientsLabel?: { value: string };
  country?: { value: string };
  countryLabel?: { value: string };
}

interface WikidataResponse {
  head: { vars: string[] };
  results: { bindings: WikidataBinding[] };
}

export class WikidataScraper {
  private static instance: WikidataScraper;
  private requestCount = 0;

  private constructor() {}

  static getInstance(): WikidataScraper {
    if (!WikidataScraper.instance) {
      WikidataScraper.instance = new WikidataScraper();
    }
    return WikidataScraper.instance;
  }

  /**
   * Search for recipes using SPARQL
   */
  async searchRecipes(options: WikidataSearchOptions): Promise<Recipe[]> {
    try {
      const limit = options.limit || 10;
      const query = this.buildSPARQLQuery(options.query, options.cuisine, limit);

      console.log(`🌐 Wikidata SPARQL query: ${options.query || 'all dishes'}`);

      const response = await axios.get<WikidataResponse>(WIKIDATA_ENDPOINT, {
        params: {
          query,
          format: 'json'
        },
        headers: {
          'User-Agent': 'RecipeScraperBot/1.0 (https://github.com/your-repo)',
          'Accept': 'application/sparql-results+json'
        },
        timeout: 15000
      });

      this.requestCount++;

      if (!response.data?.results?.bindings || response.data.results.bindings.length === 0) {
        console.log('⚠️  No recipes found in Wikidata');
        return [];
      }

      console.log(`✅ Found ${response.data.results.bindings.length} recipes from Wikidata`);

      // Group by recipe (multiple ingredients per recipe)
      const recipeMap = this.groupByRecipe(response.data.results.bindings);

      const recipes: Recipe[] = [];
      for (const [recipeId, bindings] of recipeMap) {
        const recipe = this.convertToRecipe(bindings);
        if (recipe) {
          recipes.push(recipe);
        }
      }

      return recipes;
    } catch (error: any) {
      console.error('❌ Wikidata SPARQL error:', error.message);
      return [];
    }
  }

  /**
   * Build SPARQL query for recipe search
   */
  private buildSPARQLQuery(recipeName?: string, cuisine?: string, limit: number = 10): string {
    let query = `
SELECT DISTINCT ?recipe ?recipeLabel ?image ?description
                ?cuisine ?cuisineLabel
                ?ingredients ?ingredientsLabel
                ?country ?countryLabel
WHERE {
  # Recipe is instance of "dish" (Q746549) or "recipe" (Q219239)
  { ?recipe wdt:P31 wd:Q746549 . }  # dish
  UNION
  { ?recipe wdt:P31 wd:Q219239 . }  # recipe

  # Optional: Image
  OPTIONAL { ?recipe wdt:P18 ?image. }

  # Optional: Cuisine
  OPTIONAL { ?recipe wdt:P2012 ?cuisine. }

  # Optional: Ingredients (has parts)
  OPTIONAL { ?recipe wdt:P527 ?ingredients. }

  # Optional: Country of origin
  OPTIONAL { ?recipe wdt:P495 ?country. }

  # Optional: Description
  OPTIONAL { ?recipe schema:description ?description. FILTER(LANG(?description) = "en") }
`;

    // Add text search filter if recipe name provided
    if (recipeName) {
      const searchTerm = recipeName.toLowerCase();
      query += `
  # Text search on label
  ?recipe rdfs:label ?label.
  FILTER(LANG(?label) = "en")
  FILTER(CONTAINS(LCASE(?label), "${searchTerm}"))
`;
    }

    // Add cuisine filter
    if (cuisine) {
      query += `
  # Filter by cuisine type
  FILTER(CONTAINS(LCASE(?cuisineLabel), "${cuisine.toLowerCase()}"))
`;
    }

    query += `
  # Get labels in English
  SERVICE wikibase:label {
    bd:serviceParam wikibase:language "en".
  }
}
LIMIT ${limit}
`;

    return query;
  }

  /**
   * Group SPARQL results by recipe ID (handle multiple ingredients)
   */
  private groupByRecipe(bindings: WikidataBinding[]): Map<string, WikidataBinding[]> {
    const recipeMap = new Map<string, WikidataBinding[]>();

    for (const binding of bindings) {
      const recipeId = binding.recipe.value;

      if (!recipeMap.has(recipeId)) {
        recipeMap.set(recipeId, []);
      }

      recipeMap.get(recipeId)!.push(binding);
    }

    return recipeMap;
  }

  /**
   * Convert Wikidata SPARQL results to Recipe format
   */
  private convertToRecipe(bindings: WikidataBinding[]): Recipe | null {
    if (bindings.length === 0) return null;

    const first = bindings[0];
    const title = first.recipeLabel?.value;

    if (!title) return null;

    // Extract unique ingredients
    const ingredientSet = new Set<string>();
    for (const binding of bindings) {
      if (binding.ingredientsLabel?.value) {
        ingredientSet.add(binding.ingredientsLabel.value);
      }
    }

    const ingredients: RecipeIngredient[] = Array.from(ingredientSet).map((name, index) => ({
      text: name,
      name,
      quantity: undefined,
      unit: undefined,
      notes: undefined,
      category: 'Other',
      order_index: index
    }));

    // Wikidata typically doesn't have detailed instructions
    // Link to Wikipedia article for full recipe
    const wikidataId = first.recipe.value.split('/').pop();
    const wikipediaUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;

    const instructions: InstructionStep[] = [
      {
        step_number: 1,
        text: `See full recipe and preparation instructions at Wikipedia: ${wikipediaUrl}`
      }
    ];

    // Extract cuisine type
    const cuisine = first.cuisineLabel?.value || first.countryLabel?.value;

    // Extract tags
    const tags: string[] = [];
    if (first.cuisineLabel?.value) tags.push(first.cuisineLabel.value);
    if (first.countryLabel?.value) tags.push(first.countryLabel.value);

    return {
      title,
      description: first.description?.value,
      source_url: wikipediaUrl,
      image_url: first.image?.value,
      ingredients,
      instructions,
      servings: undefined,
      prep_time: undefined,
      cook_time: undefined,
      total_time: undefined,
      cuisine_type: cuisine,
      tags: tags.length > 0 ? tags : undefined,
      nutrition: undefined,
      publisher: 'Wikidata'
    };
  }

  /**
   * Search by cuisine type
   */
  async searchByCuisine(cuisine: string, limit: number = 10): Promise<Recipe[]> {
    return this.searchRecipes({ cuisine, limit });
  }

  /**
   * Get random recipes from Wikidata
   */
  async getRandomRecipes(limit: number = 10): Promise<Recipe[]> {
    const query = `
SELECT DISTINCT ?recipe ?recipeLabel ?image ?description
                ?cuisine ?cuisineLabel
WHERE {
  # Recipe is instance of "dish"
  ?recipe wdt:P31 wd:Q9034098.

  # Optional: Image (prioritize recipes with images)
  OPTIONAL { ?recipe wdt:P18 ?image. }

  # Optional: Cuisine
  OPTIONAL { ?recipe wdt:P2012 ?cuisine. }

  # Optional: Description
  OPTIONAL { ?recipe schema:description ?description. FILTER(LANG(?description) = "en") }

  # Get labels in English
  SERVICE wikibase:label {
    bd:serviceParam wikibase:language "en".
  }
}
ORDER BY MD5(CONCAT(STR(?recipe), STR(NOW())))
LIMIT ${limit}
`;

    try {
      const response = await axios.get<WikidataResponse>(WIKIDATA_ENDPOINT, {
        params: { query, format: 'json' },
        headers: {
          'User-Agent': 'RecipeScraperBot/1.0',
          'Accept': 'application/sparql-results+json'
        },
        timeout: 15000
      });

      this.requestCount++;

      if (!response.data?.results?.bindings) return [];

      const recipes: Recipe[] = [];
      for (const binding of response.data.results.bindings) {
        const recipe = this.convertToRecipe([binding]);
        if (recipe) recipes.push(recipe);
      }

      return recipes;
    } catch (error: any) {
      console.error('❌ Wikidata random recipes error:', error.message);
      return [];
    }
  }

  /**
   * Get request count for monitoring
   */
  getRequestCount(): number {
    return this.requestCount;
  }

  /**
   * Reset request counter
   */
  resetCounter(): void {
    this.requestCount = 0;
    console.log('🔄 Wikidata counter reset');
  }
}

// Export singleton instance
export const wikidata = WikidataScraper.getInstance();
