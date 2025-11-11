/**
 * Multi-Source Recipe Aggregator
 * Combines multiple free APIs and web scraping for maximum coverage
 *
 * API Sources (all free tiers):
 * 1. TheMealDB (unlimited, 2.3M+ recipes)
 * 2. Spoonacular (150/day, premium data)
 * 3. Edamam (10k/month, nutrition focus)
 * 4. RecipePuppy (unlimited, aggregator)
 * 5. Wikidata SPARQL (unlimited, global coverage) - FIXED Q746549
 * 6. HowToCook MCP (unlimited, 200+ Chinese recipes)
 * 7. MCP-Cook (unlimited, 200+ food & cocktails)
 * 8. DummyJSON (unlimited, sample recipe data)
 * 9. Google Custom Search (100/day, schema.org markup)
 * 10. Web scraping (5-method fallback)
 *
 * Strategy: Enhanced search with fuzzy matching, synonyms, and intelligent fallback
 */

import { themealdb } from './TheMealDBScraper.js';
import { spoonacular } from './SpoonacularScraper.js';
import { edamam } from './EdamamScraper.js';
import { recipepuppy } from './RecipePuppyScraper.js';
import { wikidata } from './WikidataScraper.js';
import { howToCookMCP } from './HowToCookMCPScraper.js';
import { mcpCook } from './MCPCookScraper.js';
import { dummyJSON } from './DummyJSONScraper.js';
import { googleCSE } from './GoogleCSEScraper.js';
import { RobustMultiFallbackScraper } from './RobustMultiFallbackScraper.js';
import { recipeDeduplicator } from '../utils/recipeDeduplicator.js';
import { expandRecipeName, findCanonicalName } from '../utils/recipeSynonyms.js';
import { similarityScore, isCloseMatch, findBestMatch as fuzzyMatch } from '../utils/fuzzyMatcher.js';
import type { Recipe, RawScrapedRecipe, RecipeIngredient, InstructionStep } from '../shared/types.js';

interface RecipeSearchResult {
  recipe: Recipe | null;
  source: string;
  confidence: number;
  completeness: number;
  processingTime: number;
}

interface AggregatedResult {
  recipe: Recipe;
  sources: string[];
  combinedConfidence: number;
  combinedCompleteness: number;
  processingTime: number;
}

export class MultiSourceRecipeAggregator {
  private static instance: MultiSourceRecipeAggregator;

  private constructor() {}

  static getInstance(): MultiSourceRecipeAggregator {
    if (!MultiSourceRecipeAggregator.instance) {
      MultiSourceRecipeAggregator.instance = new MultiSourceRecipeAggregator();
    }
    return MultiSourceRecipeAggregator.instance;
  }

  /**
   * Normalize recipe names for better matching
   * Examples: "Chocolate Chip Cookies" → "chocolate chip cookie"
   */
  private normalizeRecipeName(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '') // Remove special chars
      .replace(/\s+/g, ' ') // Normalize spaces
      .replace(/ies$/i, 'y') // cookies → cookie
      .replace(/s$/i, ''); // Remove trailing s
  }

  /**
   * Generate alternative search queries for better matching
   * Now uses comprehensive synonym database and canonical forms
   */
  private generateSearchVariations(recipeName: string): string[] {
    // Use synonym expansion from recipeSynonyms.ts
    const variations = expandRecipeName(recipeName);

    // Add canonical form
    const canonical = findCanonicalName(recipeName);
    if (canonical !== recipeName) {
      variations.push(canonical);
    }

    // Limit to reasonable number to avoid too many API calls
    return [...new Set(variations)].slice(0, 10);
  }

  /**
   * Enhanced TheMealDB search with multiple query attempts
   */
  private async searchTheMealDBEnhanced(recipeName: string): Promise<RecipeSearchResult> {
    const startTime = Date.now();
    const variations = this.generateSearchVariations(recipeName);

    console.log(`🔍 Enhanced search for "${recipeName}"`);
    console.log(`   Trying ${variations.length} variations: [${variations.join(', ')}]`);

    // Try each variation until we find a match
    for (const query of variations) {
      try {
        const recipes = await themealdb.searchRecipes({ query });

        if (recipes.length > 0) {
          const recipe = recipes[0];
          const completeness = this.calculateCompleteness(recipe);

          console.log(`   ✅ Found match with query "${query}": ${recipe.title}`);

          return {
            recipe,
            source: 'themealdb',
            confidence: 95,
            completeness,
            processingTime: Date.now() - startTime
          };
        }
      } catch (error) {
        console.log(`   ⚠️  Query "${query}" failed:`, error);
      }
    }

    // Try category-based search as fallback (with stricter matching)
    const categoryKeywords = ['chicken', 'beef', 'pork', 'seafood', 'vegetarian', 'dessert', 'pasta'];
    for (const keyword of categoryKeywords) {
      if (recipeName.toLowerCase().includes(keyword)) {
        try {
          console.log(`   🔍 Trying category search: ${keyword}`);
          const recipes = await themealdb.searchRecipes({ category: keyword });

          if (recipes.length > 0) {
            // Find best match by title similarity with higher threshold
            const bestMatch = this.findBestMatchWithScore(recipeName, recipes, 0.65);
            if (bestMatch) {
              const completeness = this.calculateCompleteness(bestMatch.recipe);
              console.log(`   ✅ Found category match: ${bestMatch.recipe.title} (${(bestMatch.score * 100).toFixed(0)}% similarity)`);

              return {
                recipe: bestMatch.recipe,
                source: 'themealdb-category',
                confidence: Math.round(bestMatch.score * 100),
                completeness,
                processingTime: Date.now() - startTime
              };
            }
          }
        } catch (error) {
          // Continue to next category
        }
      }
    }

    console.log(`   ❌ No matches found in TheMealDB`);
    return {
      recipe: null,
      source: 'themealdb',
      confidence: 0,
      completeness: 0,
      processingTime: Date.now() - startTime
    };
  }

  /**
   * Find best matching recipe by title similarity
   */
  private findBestMatch(targetName: string, recipes: Recipe[]): Recipe | null {
    const result = this.findBestMatchWithScore(targetName, recipes, 0.5);
    return result ? result.recipe : null;
  }

  /**
   * Find best matching recipe with score returned
   */
  private findBestMatchWithScore(
    targetName: string,
    recipes: Recipe[],
    threshold: number = 0.5
  ): { recipe: Recipe; score: number } | null {
    const normalized = this.normalizeRecipeName(targetName);
    let bestMatch: Recipe | null = null;
    let bestScore = 0;

    for (const recipe of recipes) {
      const recipeNormalized = this.normalizeRecipeName(recipe.title);
      const score = this.calculateSimilarity(normalized, recipeNormalized);

      if (score > bestScore) {
        bestScore = score;
        bestMatch = recipe;
      }
    }

    // Only return if similarity is above threshold
    return bestScore >= threshold && bestMatch ? { recipe: bestMatch, score: bestScore } : null;
  }

  /**
   * Calculate string similarity (0-1)
   * Now uses Levenshtein distance for better accuracy
   */
  private calculateSimilarity(str1: string, str2: string): number {
    // Use advanced fuzzy matcher with Levenshtein distance
    return similarityScore(str1, str2);
  }

  /**
   * Calculate recipe completeness score (0-100)
   */
  private calculateCompleteness(recipe: Recipe): number {
    let score = 0;

    // Core data (60%)
    if (recipe.title) score += 10;
    if (recipe.ingredients && recipe.ingredients.length > 0) score += 25;
    if (recipe.instructions && recipe.instructions.length > 0) score += 25;

    // Metadata (20%)
    if (recipe.image_url) score += 5;
    if (recipe.servings) score += 5;
    if (recipe.prep_time || recipe.cook_time || recipe.total_time) score += 5;
    if (recipe.description) score += 5;

    // Enrichment (20%)
    if (recipe.nutrition) score += 10;
    if (recipe.tags && recipe.tags.length > 0) score += 5;
    if (recipe.cuisine_type) score += 5;

    return Math.min(score, 100);
  }

  /**
   * Merge recipes from multiple sources
   */
  private mergeRecipes(results: RecipeSearchResult[]): Recipe {
    const validResults = results.filter(r => r.recipe !== null);

    if (validResults.length === 0) {
      throw new Error('No valid recipes to merge');
    }

    // Start with the highest confidence result
    const primary = validResults.sort((a, b) => b.confidence - a.confidence)[0].recipe!;

    // Merge data from other sources
    const merged: Recipe = { ...primary };

    for (const result of validResults) {
      const recipe = result.recipe!;

      // Fill in missing data
      if (!merged.description && recipe.description) merged.description = recipe.description;
      if (!merged.image_url && recipe.image_url) merged.image_url = recipe.image_url;
      if (!merged.servings && recipe.servings) merged.servings = recipe.servings;
      if (!merged.prep_time && recipe.prep_time) merged.prep_time = recipe.prep_time;
      if (!merged.cook_time && recipe.cook_time) merged.cook_time = recipe.cook_time;
      if (!merged.total_time && recipe.total_time) merged.total_time = recipe.total_time;
      if (!merged.nutrition && recipe.nutrition) merged.nutrition = recipe.nutrition;
      if (!merged.cuisine_type && recipe.cuisine_type) merged.cuisine_type = recipe.cuisine_type;

      // Merge tags
      if (recipe.tags) {
        merged.tags = [...new Set([...(merged.tags || []), ...recipe.tags])];
      }

      // Use longer ingredients/instructions lists if available
      if (recipe.ingredients && recipe.ingredients.length > merged.ingredients.length) {
        merged.ingredients = recipe.ingredients;
      }
      if (recipe.instructions && recipe.instructions.length > merged.instructions.length) {
        merged.instructions = recipe.instructions;
      }
    }

    return merged;
  }

  /**
   * Search Spoonacular API
   */
  private async searchSpoonacular(recipeName: string): Promise<RecipeSearchResult> {
    const startTime = Date.now();

    if (!spoonacular.isConfigured() || spoonacular.hasReachedLimit()) {
      return { recipe: null, source: 'spoonacular', confidence: 0, completeness: 0, processingTime: 0 };
    }

    try {
      const recipes = await spoonacular.searchRecipes({ query: recipeName, number: 3 });

      if (recipes.length > 0) {
        const recipe = recipes[0];
        const completeness = this.calculateCompleteness(recipe);

        console.log(`   ✅ Spoonacular: Found "${recipe.title}" (${completeness}% complete)`);

        return {
          recipe,
          source: 'spoonacular',
          confidence: 90,
          completeness,
          processingTime: Date.now() - startTime
        };
      }
    } catch (error) {
      console.log(`   ⚠️  Spoonacular search failed:`, error);
    }

    return { recipe: null, source: 'spoonacular', confidence: 0, completeness: 0, processingTime: Date.now() - startTime };
  }

  /**
   * Search Edamam API
   */
  private async searchEdamam(recipeName: string): Promise<RecipeSearchResult> {
    const startTime = Date.now();

    if (!edamam.isConfigured() || edamam.hasReachedLimit()) {
      return { recipe: null, source: 'edamam', confidence: 0, completeness: 0, processingTime: 0 };
    }

    try {
      const recipes = await edamam.searchRecipes({ query: recipeName, to: 3 });

      if (recipes.length > 0) {
        const recipe = recipes[0];
        const completeness = this.calculateCompleteness(recipe);

        console.log(`   ✅ Edamam: Found "${recipe.title}" (${completeness}% complete)`);

        return {
          recipe,
          source: 'edamam',
          confidence: 85,
          completeness,
          processingTime: Date.now() - startTime
        };
      }
    } catch (error) {
      console.log(`   ⚠️  Edamam search failed:`, error);
    }

    return { recipe: null, source: 'edamam', confidence: 0, completeness: 0, processingTime: Date.now() - startTime };
  }

  /**
   * Search RecipePuppy API (completely free, no API key)
   */
  private async searchRecipePuppy(recipeName: string): Promise<RecipeSearchResult> {
    const startTime = Date.now();

    try {
      // Simplify query - RecipePuppy works better with simple keywords
      const simplifiedQuery = this.simplifyQuery(recipeName);
      const recipes = await recipepuppy.searchRecipes({ query: simplifiedQuery });

      if (recipes.length > 0) {
        // Find best match since RecipePuppy returns many results
        const bestMatch = this.findBestMatchWithScore(recipeName, recipes, 0.6);

        if (bestMatch) {
          const completeness = this.calculateCompleteness(bestMatch.recipe);
          console.log(`   ✅ RecipePuppy: Found "${bestMatch.recipe.title}" (${completeness}% complete, ${(bestMatch.score * 100).toFixed(0)}% match)`);

          return {
            recipe: bestMatch.recipe,
            source: 'recipepuppy',
            confidence: Math.round(bestMatch.score * 80), // Lower confidence due to basic data
            completeness,
            processingTime: Date.now() - startTime
          };
        }
      }
    } catch (error) {
      console.log(`   ⚠️  RecipePuppy search failed:`, error);
    }

    return { recipe: null, source: 'recipepuppy', confidence: 0, completeness: 0, processingTime: Date.now() - startTime };
  }

  /**
   * Simplify query for better API matching
   * Removes descriptors and focuses on core recipe name
   */
  private simplifyQuery(recipeName: string): string {
    return recipeName
      .toLowerCase()
      .replace(/\b(best|perfect|easy|simple|quick|homemade|classic|authentic|traditional|ultimate)\b/gi, '')
      .replace(/\b(recipe|recipes)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Search Wikidata SPARQL (completely free, unlimited)
   */
  private async searchWikidata(recipeName: string): Promise<RecipeSearchResult> {
    const startTime = Date.now();

    try {
      const simplifiedQuery = this.simplifyQuery(recipeName);
      const recipes = await wikidata.searchRecipes({ query: simplifiedQuery, limit: 5 });

      if (recipes.length > 0) {
        // Find best match by title similarity
        const bestMatch = this.findBestMatchWithScore(recipeName, recipes, 0.6);

        if (bestMatch) {
          const completeness = this.calculateCompleteness(bestMatch.recipe);
          console.log(`   ✅ Wikidata: Found "${bestMatch.recipe.title}" (${completeness}% complete, ${(bestMatch.score * 100).toFixed(0)}% match)`);

          return {
            recipe: bestMatch.recipe,
            source: 'wikidata',
            confidence: Math.round(bestMatch.score * 70), // Lower confidence - basic structured data
            completeness,
            processingTime: Date.now() - startTime
          };
        }
      }
    } catch (error) {
      console.log(`   ⚠️  Wikidata search failed:`, error);
    }

    return { recipe: null, source: 'wikidata', confidence: 0, completeness: 0, processingTime: Date.now() - startTime };
  }

  /**
   * Search HowToCook MCP Server (completely free, 200+ Chinese recipes)
   */
  private async searchHowToCook(recipeName: string): Promise<RecipeSearchResult> {
    const startTime = Date.now();

    try {
      const simplifiedQuery = this.simplifyQuery(recipeName);
      const recipes = await howToCookMCP.searchRecipes({ query: simplifiedQuery, limit: 5 });

      if (recipes.length > 0) {
        const bestMatch = this.findBestMatchWithScore(recipeName, recipes, 0.6);

        if (bestMatch) {
          const completeness = this.calculateCompleteness(bestMatch.recipe);
          console.log(`   ✅ HowToCook MCP: Found "${bestMatch.recipe.title}" (${completeness}% complete, ${(bestMatch.score * 100).toFixed(0)}% match)`);

          return {
            recipe: bestMatch.recipe,
            source: 'howtocook-mcp',
            confidence: Math.round(bestMatch.score * 85),
            completeness,
            processingTime: Date.now() - startTime
          };
        }
      }
    } catch (error) {
      console.log(`   ⚠️  HowToCook MCP search failed:`, error);
    }

    return { recipe: null, source: 'howtocook-mcp', confidence: 0, completeness: 0, processingTime: Date.now() - startTime };
  }

  /**
   * Search MCP-Cook Server (completely free, 200+ food & cocktail recipes)
   */
  private async searchMCPCook(recipeName: string): Promise<RecipeSearchResult> {
    const startTime = Date.now();

    try {
      const simplifiedQuery = this.simplifyQuery(recipeName);
      const recipes = await mcpCook.searchRecipes({ query: simplifiedQuery, limit: 5 });

      if (recipes.length > 0) {
        const bestMatch = this.findBestMatchWithScore(recipeName, recipes, 0.6);

        if (bestMatch) {
          const completeness = this.calculateCompleteness(bestMatch.recipe);
          console.log(`   ✅ MCP-Cook: Found "${bestMatch.recipe.title}" (${completeness}% complete, ${(bestMatch.score * 100).toFixed(0)}% match)`);

          return {
            recipe: bestMatch.recipe,
            source: 'mcp-cook',
            confidence: Math.round(bestMatch.score * 85),
            completeness,
            processingTime: Date.now() - startTime
          };
        }
      }
    } catch (error) {
      console.log(`   ⚠️  MCP-Cook search failed:`, error);
    }

    return { recipe: null, source: 'mcp-cook', confidence: 0, completeness: 0, processingTime: Date.now() - startTime };
  }

  /**
   * Search DummyJSON (completely free, sample recipe data)
   */
  private async searchDummyJSON(recipeName: string): Promise<RecipeSearchResult> {
    const startTime = Date.now();

    try {
      const simplifiedQuery = this.simplifyQuery(recipeName);
      const recipes = await dummyJSON.searchRecipes({ query: simplifiedQuery, limit: 5 });

      if (recipes.length > 0) {
        const bestMatch = this.findBestMatchWithScore(recipeName, recipes, 0.6);

        if (bestMatch) {
          const completeness = this.calculateCompleteness(bestMatch.recipe);
          console.log(`   ✅ DummyJSON: Found "${bestMatch.recipe.title}" (${completeness}% complete, ${(bestMatch.score * 100).toFixed(0)}% match)`);

          return {
            recipe: bestMatch.recipe,
            source: 'dummyjson',
            confidence: Math.round(bestMatch.score * 80), // Sample data, slightly lower confidence
            completeness,
            processingTime: Date.now() - startTime
          };
        }
      }
    } catch (error) {
      console.log(`   ⚠️  DummyJSON search failed:`, error);
    }

    return { recipe: null, source: 'dummyjson', confidence: 0, completeness: 0, processingTime: Date.now() - startTime };
  }

  /**
   * Search Google Custom Search (100/day free, schema.org filtering)
   */
  private async searchGoogleCSE(recipeName: string): Promise<RecipeSearchResult> {
    const startTime = Date.now();

    if (!googleCSE.isConfigured() || googleCSE.hasReachedLimit()) {
      return { recipe: null, source: 'google-cse', confidence: 0, completeness: 0, processingTime: 0 };
    }

    try {
      const simplifiedQuery = this.simplifyQuery(recipeName);
      const recipes = await googleCSE.searchRecipes({ query: simplifiedQuery, num: 5 });

      if (recipes.length > 0) {
        // Find best match by title similarity
        const bestMatch = this.findBestMatchWithScore(recipeName, recipes, 0.6);

        if (bestMatch) {
          const completeness = this.calculateCompleteness(bestMatch.recipe);
          console.log(`   ✅ Google CSE: Found "${bestMatch.recipe.title}" (${completeness}% complete, ${(bestMatch.score * 100).toFixed(0)}% match)`);

          return {
            recipe: bestMatch.recipe,
            source: 'google-cse',
            confidence: Math.round(bestMatch.score * 80), // Good confidence - schema.org data
            completeness,
            processingTime: Date.now() - startTime
          };
        }
      }
    } catch (error) {
      console.log(`   ⚠️  Google CSE search failed:`, error);
    }

    return { recipe: null, source: 'google-cse', confidence: 0, completeness: 0, processingTime: Date.now() - startTime };
  }

  /**
   * Main aggregation function - tries all sources and combines results
   */
  async aggregateRecipe(url: string, recipeName?: string): Promise<AggregatedResult> {
    const startTime = Date.now();
    const results: RecipeSearchResult[] = [];

    // Extract recipe name from URL if not provided
    if (!recipeName) {
      recipeName = this.extractRecipeNameFromUrl(url);
    }

    console.log(`\n🎯 MULTI-SOURCE AGGREGATION for: "${recipeName}"`);
    console.log(`   URL: ${url}`);

    // PHASE 1: API Search (TheMealDB + Spoonacular + Edamam)
    console.log('\n📍 PHASE 1: Multi-API Search');

    // Try TheMealDB first (free, unlimited)
    const themealdbResult = await this.searchTheMealDBEnhanced(recipeName);
    if (themealdbResult.recipe) {
      results.push(themealdbResult);
      console.log(`   ✅ TheMealDB: ${themealdbResult.completeness}% complete`);
    }

    // Try Spoonacular if TheMealDB incomplete (150/day free)
    if (!themealdbResult.recipe || themealdbResult.completeness < 80) {
      const spoonacularResult = await this.searchSpoonacular(recipeName);
      if (spoonacularResult.recipe) {
        results.push(spoonacularResult);
      }
    }

    // Try Edamam if still incomplete (10k/month free)
    if (results.length === 0 || results.every(r => r.completeness < 80)) {
      const edamamResult = await this.searchEdamam(recipeName);
      if (edamamResult.recipe) {
        results.push(edamamResult);
      }
    }

    // Try RecipePuppy as final API fallback (100% free, unlimited)
    if (results.length === 0 || results.every(r => r.completeness < 70)) {
      const recipepuppyResult = await this.searchRecipePuppy(recipeName);
      if (recipepuppyResult.recipe) {
        results.push(recipepuppyResult);
      }
    }

    // Try Wikidata SPARQL (100% free, unlimited, global coverage - FIXED)
    if (results.length === 0 || results.every(r => r.completeness < 70)) {
      const wikidataResult = await this.searchWikidata(recipeName);
      if (wikidataResult.recipe) {
        results.push(wikidataResult);
      }
    }

    // Try HowToCook MCP Server (100% free, 200+ Chinese recipes)
    if (results.length === 0 || results.every(r => r.completeness < 70)) {
      const howToCookResult = await this.searchHowToCook(recipeName);
      if (howToCookResult.recipe) {
        results.push(howToCookResult);
      }
    }

    // Try MCP-Cook Server (100% free, 200+ food & cocktails)
    if (results.length === 0 || results.every(r => r.completeness < 70)) {
      const mcpCookResult = await this.searchMCPCook(recipeName);
      if (mcpCookResult.recipe) {
        results.push(mcpCookResult);
      }
    }

    // Try DummyJSON (100% free, sample recipe data)
    if (results.length === 0 || results.every(r => r.completeness < 65)) {
      const dummyJSONResult = await this.searchDummyJSON(recipeName);
      if (dummyJSONResult.recipe) {
        results.push(dummyJSONResult);
      }
    }

    // Try Google CSE as final API attempt (100/day free, schema.org markup)
    // Only use if other sources failed - conserve quota
    if (results.length === 0 || results.every(r => r.completeness < 65)) {
      const googleCSEResult = await this.searchGoogleCSE(recipeName);
      if (googleCSEResult.recipe) {
        results.push(googleCSEResult);
      }
    }

    // PHASE 2: Web Scraping (if APIs didn't find it OR if data is incomplete)
    const needsWebScraping = results.length === 0 || results.every(r => r.completeness < 75);

    if (needsWebScraping) {
      console.log('\n📍 PHASE 2: Web Scraping');
      try {
        const webResult = await RobustMultiFallbackScraper.scrape(url);

        if (webResult.recipe) {
          // Convert RawScrapedRecipe to Recipe format
          const webRecipe = this.convertRawToRecipe(webResult.recipe);
          const completeness = this.calculateCompleteness(webRecipe);

          results.push({
            recipe: webRecipe,
            source: 'web-scraping',
            confidence: webResult.confidence,
            completeness,
            processingTime: webResult.processingTime
          });

          console.log(`   ✅ Web Scraping: ${completeness}% complete (${webResult.method})`);
        }
      } catch (error: any) {
        console.log(`   ❌ Web Scraping failed: ${error.message}`);
      }
    }

    // PHASE 2.5: Deduplication
    console.log(`\n🔍 DEDUPLICATION CHECK (${results.length} results)`);
    const uniqueResults: RecipeSearchResult[] = [];
    const rejectedSources: string[] = [];

    for (const result of results) {
      if (!result.recipe) continue;

      const dupeCheck = recipeDeduplicator.checkDuplicate(result.recipe);

      if (dupeCheck.isDuplicate) {
        rejectedSources.push(result.source);
        console.log(`   ⚠️  Rejected duplicate from ${result.source} (matched ${dupeCheck.matchType}, ${(dupeCheck.similarity! * 100).toFixed(0)}% similar)`);
      } else {
        // Not a duplicate, add to index and keep result
        recipeDeduplicator.addRecipe(result.recipe);
        uniqueResults.push(result);
      }
    }

    if (rejectedSources.length > 0) {
      console.log(`   ✅ Removed ${rejectedSources.length} duplicates: [${rejectedSources.join(', ')}]`);
      console.log(`   ✅ Kept ${uniqueResults.length} unique sources`);
    } else {
      console.log(`   ✅ No duplicates found - all ${results.length} sources are unique`);
    }

    // Use unique results for merging
    const finalResults = uniqueResults.length > 0 ? uniqueResults : results;

    // PHASE 3: Combine results
    if (finalResults.length === 0) {
      throw new Error('No recipes found from any source');
    }

    console.log(`\n📊 COMBINING ${finalResults.length} SOURCES`);
    const mergedRecipe = this.mergeRecipes(finalResults);
    const finalCompleteness = this.calculateCompleteness(mergedRecipe);

    const combinedConfidence = Math.round(
      finalResults.reduce((sum, r) => sum + r.confidence, 0) / finalResults.length
    );

    console.log(`   ✅ Final recipe: ${finalCompleteness}% complete, ${combinedConfidence}% confidence`);
    console.log(`   📚 Sources used: ${finalResults.map(r => r.source).join(', ')}`);

    return {
      recipe: mergedRecipe,
      sources: finalResults.map(r => r.source),
      combinedConfidence,
      combinedCompleteness: finalCompleteness,
      processingTime: Date.now() - startTime
    };
  }

  /**
   * Convert RawScrapedRecipe to Recipe format
   */
  private convertRawToRecipe(raw: RawScrapedRecipe): Recipe {
    // Convert string ingredients to RecipeIngredient objects
    const ingredients: RecipeIngredient[] = raw.ingredients.map((text, index) => ({
      text,
      name: text.replace(/^[\d\s\/\-\.]+/, '').trim(), // Remove quantities
      quantity: undefined,
      unit: undefined,
      notes: undefined,
      category: 'Other',
      order_index: index
    }));

    // Convert string instructions to InstructionStep objects
    const instructions: InstructionStep[] = raw.instructions.map((text, index) => ({
      step_number: index + 1,
      text
    }));

    return {
      title: raw.title,
      description: raw.description,
      source_url: raw.source_url,
      image_url: raw.image_url,
      ingredients,
      instructions,
      servings: raw.servings,
      prep_time: raw.prep_time,
      cook_time: raw.cook_time,
      total_time: raw.total_time,
      tags: raw.tags,
      nutrition: raw.nutrition,
      author: raw.author,
      publisher: raw.publisher,
      published_date: raw.published_date
    };
  }

  /**
   * Extract recipe name from URL
   */
  private extractRecipeNameFromUrl(url: string): string {
    const patterns = [
      /\/recipe[s]?\/([a-z0-9-]+)/i,
      /\/([a-z0-9-]+)-recipe/i,
      /\/([a-z0-9-]+)$/i
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1]
          .replace(/-/g, ' ')
          .replace(/\b\w/g, l => l.toUpperCase());
      }
    }

    return 'Unknown Recipe';
  }
}

// Export singleton instance
export const recipeAggregator = MultiSourceRecipeAggregator.getInstance();
