/**
 * Recipe Deduplication System
 * Prevents duplicate recipes from multiple API sources
 *
 * Detection Methods:
 * 1. Title normalization and matching
 * 2. URL fingerprinting (domain + path)
 * 3. Ingredient-based Jaccard similarity
 * 4. Composite scoring for fuzzy duplicates
 *
 * Threshold: 85% similarity = duplicate
 */

import type { Recipe } from '../shared/types.js';

interface DuplicationResult {
  isDuplicate: boolean;
  matchedRecipe?: Recipe;
  matchType?: 'title' | 'url' | 'ingredients' | 'composite';
  similarity?: number;
}

export class RecipeDeduplicator {
  private seenRecipes: Map<string, Recipe> = new Map();
  private titleIndex: Map<string, Recipe> = new Map();
  private urlIndex: Map<string, Recipe> = new Map();

  // Configuration
  private readonly SIMILARITY_THRESHOLD = 0.85;
  private readonly INGREDIENT_THRESHOLD = 0.75;

  /**
   * Check if recipe is a duplicate
   */
  checkDuplicate(recipe: Recipe): DuplicationResult {
    // Method 1: Title-based matching
    const titleMatch = this.checkTitleDuplicate(recipe);
    if (titleMatch.isDuplicate) {
      return titleMatch;
    }

    // Method 2: URL-based matching
    const urlMatch = this.checkUrlDuplicate(recipe);
    if (urlMatch.isDuplicate) {
      return urlMatch;
    }

    // Method 3: Ingredient-based similarity
    const ingredientMatch = this.checkIngredientSimilarity(recipe);
    if (ingredientMatch.isDuplicate) {
      return ingredientMatch;
    }

    // Method 4: Composite scoring (title + ingredients)
    const compositeMatch = this.checkCompositeSimilarity(recipe);
    if (compositeMatch.isDuplicate) {
      return compositeMatch;
    }

    // Not a duplicate
    return { isDuplicate: false };
  }

  /**
   * Add recipe to the deduplication index
   */
  addRecipe(recipe: Recipe): void {
    const normalizedTitle = this.normalizeTitle(recipe.title);
    const urlKey = this.getUrlFingerprint(recipe.source_url);

    // Add to all indexes
    this.seenRecipes.set(normalizedTitle, recipe);
    this.titleIndex.set(normalizedTitle, recipe);

    if (urlKey) {
      this.urlIndex.set(urlKey, recipe);
    }
  }

  /**
   * Check for title-based duplicates
   */
  private checkTitleDuplicate(recipe: Recipe): DuplicationResult {
    const normalizedTitle = this.normalizeTitle(recipe.title);

    if (this.titleIndex.has(normalizedTitle)) {
      const existingRecipe = this.titleIndex.get(normalizedTitle)!;

      console.log(`⚠️  Title duplicate found:`);
      console.log(`   New: "${recipe.title}" (${recipe.publisher || 'unknown'})`);
      console.log(`   Existing: "${existingRecipe.title}" (${existingRecipe.publisher || 'unknown'})`);

      return {
        isDuplicate: true,
        matchedRecipe: existingRecipe,
        matchType: 'title',
        similarity: 1.0
      };
    }

    return { isDuplicate: false };
  }

  /**
   * Check for URL-based duplicates
   */
  private checkUrlDuplicate(recipe: Recipe): DuplicationResult {
    if (!recipe.source_url) {
      return { isDuplicate: false };
    }

    const urlKey = this.getUrlFingerprint(recipe.source_url);

    if (urlKey && this.urlIndex.has(urlKey)) {
      const existingRecipe = this.urlIndex.get(urlKey)!;

      console.log(`⚠️  URL duplicate found:`);
      console.log(`   URL: ${recipe.source_url}`);
      console.log(`   Sources: ${recipe.publisher} vs ${existingRecipe.publisher}`);

      return {
        isDuplicate: true,
        matchedRecipe: existingRecipe,
        matchType: 'url',
        similarity: 1.0
      };
    }

    return { isDuplicate: false };
  }

  /**
   * Check for ingredient-based similarity
   */
  private checkIngredientSimilarity(recipe: Recipe): DuplicationResult {
    let bestMatch: Recipe | null = null;
    let bestScore = 0;

    // Compare against all existing recipes
    for (const [_, existingRecipe] of this.seenRecipes) {
      const similarity = this.calculateIngredientSimilarity(recipe, existingRecipe);

      if (similarity > bestScore) {
        bestScore = similarity;
        bestMatch = existingRecipe;
      }
    }

    // Check if similarity exceeds threshold
    if (bestScore >= this.INGREDIENT_THRESHOLD) {
      console.log(`⚠️  Ingredient duplicate found (${(bestScore * 100).toFixed(0)}% similar):`);
      console.log(`   New: "${recipe.title}"`);
      console.log(`   Existing: "${bestMatch!.title}"`);

      return {
        isDuplicate: true,
        matchedRecipe: bestMatch!,
        matchType: 'ingredients',
        similarity: bestScore
      };
    }

    return { isDuplicate: false };
  }

  /**
   * Check composite similarity (title + ingredients)
   */
  private checkCompositeSimilarity(recipe: Recipe): DuplicationResult {
    let bestMatch: Recipe | null = null;
    let bestScore = 0;

    for (const [_, existingRecipe] of this.seenRecipes) {
      // Calculate title similarity
      const titleSimilarity = this.calculateTitleSimilarity(recipe.title, existingRecipe.title);

      // Calculate ingredient similarity
      const ingredientSimilarity = this.calculateIngredientSimilarity(recipe, existingRecipe);

      // Weighted composite score (60% title, 40% ingredients)
      const compositeScore = (titleSimilarity * 0.6) + (ingredientSimilarity * 0.4);

      if (compositeScore > bestScore) {
        bestScore = compositeScore;
        bestMatch = existingRecipe;
      }
    }

    if (bestScore >= this.SIMILARITY_THRESHOLD) {
      console.log(`⚠️  Composite duplicate found (${(bestScore * 100).toFixed(0)}% similar):`);
      console.log(`   New: "${recipe.title}"`);
      console.log(`   Existing: "${bestMatch!.title}"`);

      return {
        isDuplicate: true,
        matchedRecipe: bestMatch!,
        matchType: 'composite',
        similarity: bestScore
      };
    }

    return { isDuplicate: false };
  }

  /**
   * Normalize recipe title for matching
   */
  private normalizeTitle(title: string): string {
    return title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '') // Remove special chars
      .replace(/\s+/g, ' ') // Normalize spaces
      .replace(/\b(the|a|an)\b/g, '') // Remove articles
      .replace(/\b(recipe|recipes)\b/g, '') // Remove "recipe"
      .replace(/\b(best|perfect|easy|simple|ultimate|classic)\b/g, '') // Remove descriptors
      .replace(/ies$/i, 'y') // cookies → cookie
      .replace(/s$/i, '') // Remove trailing s
      .trim();
  }

  /**
   * Get URL fingerprint (domain + path)
   */
  private getUrlFingerprint(url: string): string | null {
    try {
      const urlObj = new URL(url);
      // Use domain + pathname (ignore query params and hash)
      return `${urlObj.hostname}${urlObj.pathname}`;
    } catch {
      return null;
    }
  }

  /**
   * Calculate Jaccard similarity between ingredient sets
   */
  private calculateIngredientSimilarity(recipe1: Recipe, recipe2: Recipe): number {
    // Extract ingredient names
    const ingredients1 = new Set(
      recipe1.ingredients.map(i => this.normalizeIngredient(i.name || i.text))
    );

    const ingredients2 = new Set(
      recipe2.ingredients.map(i => this.normalizeIngredient(i.name || i.text))
    );

    // Calculate Jaccard similarity: |A ∩ B| / |A ∪ B|
    const intersection = new Set([...ingredients1].filter(x => ingredients2.has(x)));
    const union = new Set([...ingredients1, ...ingredients2]);

    if (union.size === 0) return 0;

    return intersection.size / union.size;
  }

  /**
   * Normalize ingredient name for comparison
   */
  private normalizeIngredient(ingredient: string): string {
    return ingredient
      .toLowerCase()
      .trim()
      .replace(/[^\w\s]/g, '') // Remove special chars
      .replace(/\d+/g, '') // Remove numbers
      .replace(/\s+/g, ' ') // Normalize spaces
      .replace(/\b(cup|cups|tablespoon|tablespoons|teaspoon|teaspoons|pound|pounds|ounce|ounces|gram|grams|kg|lb|oz|tsp|tbsp)\b/g, '') // Remove units
      .replace(/\b(fresh|dried|chopped|minced|diced|sliced|whole|ground)\b/g, '') // Remove modifiers
      .trim();
  }

  /**
   * Calculate Levenshtein distance-based title similarity
   */
  private calculateTitleSimilarity(title1: string, title2: string): number {
    const norm1 = this.normalizeTitle(title1);
    const norm2 = this.normalizeTitle(title2);

    // Use Levenshtein distance
    const distance = this.levenshteinDistance(norm1, norm2);
    const maxLength = Math.max(norm1.length, norm2.length);

    if (maxLength === 0) return 0;

    // Convert distance to similarity score (0-1)
    return 1 - (distance / maxLength);
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;

    // Create matrix
    const matrix: number[][] = [];
    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }

    // Fill matrix
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }

    return matrix[len1][len2];
  }

  /**
   * Get statistics about deduplication
   */
  getStats(): {
    totalRecipes: number;
    titleIndexSize: number;
    urlIndexSize: number;
  } {
    return {
      totalRecipes: this.seenRecipes.size,
      titleIndexSize: this.titleIndex.size,
      urlIndexSize: this.urlIndex.size
    };
  }

  /**
   * Clear all indexes (for testing)
   */
  clear(): void {
    this.seenRecipes.clear();
    this.titleIndex.clear();
    this.urlIndex.clear();
  }
}

// Export singleton instance
export const recipeDeduplicator = new RecipeDeduplicator();
