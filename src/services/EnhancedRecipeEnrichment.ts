/**
 * Enhanced Recipe Enrichment Integration
 * Combines free LLM and API services with existing enrichment pipeline
 *
 * This module integrates:
 * - Free LLM enhancement (descriptions, tags, cuisines)
 * - Free nutrition APIs (with fallback chain)
 * - Existing NLP enrichment
 * - Validation and quality scoring
 */

import { Recipe } from '../types.js';
import { RawScrapedRecipe } from '../scrapers/websiteScraper.js';
import { ComprehensiveEnrichment } from '../enrichment/comprehensiveEnrichment.js';
import { FreeLLMService } from './FreeLLMService.js';
import { FreeAPIService } from './FreeAPIService.js';

export interface EnhancementOptions {
  useLLM?: boolean;              // Use free LLM for enhancement (default: true)
  useFreeNutritionAPIs?: boolean; // Use free nutrition APIs (default: true)
  useExistingEnrichment?: boolean; // Use existing enrichment pipeline (default: true)
  llmFields?: ('description' | 'tags' | 'cuisines' | 'meal_types' | 'cooking_tips')[];
  maxRetries?: number;            // Max retries for API calls (default: 2)
}

export interface EnhancementResult {
  recipe: Partial<Recipe>;
  success: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    llmUsed: boolean;
    llmProvider?: string;
    nutritionAPIsUsed: string[];
    enrichmentTimeMs: number;
    completenessScore: number;
  };
}

export class EnhancedRecipeEnrichment {

  /**
   * Enhance recipe using free services + existing enrichment
   */
  static async enhanceRecipe(
    rawRecipe: RawScrapedRecipe,
    options: EnhancementOptions = {}
  ): Promise<EnhancementResult> {

    const startTime = Date.now();
    const errors: string[] = [];
    const warnings: string[] = [];
    const stats = {
      llmUsed: false,
      llmProvider: undefined as string | undefined,
      nutritionAPIsUsed: [] as string[],
      enrichmentTimeMs: 0,
      completenessScore: 0
    };

    console.log(`\n🚀 Enhanced Recipe Enrichment: "${rawRecipe.title}"`);
    console.log('='.repeat(60));

    // Default options
    const {
      useLLM = true,
      useFreeNutritionAPIs = true,
      useExistingEnrichment = true,
      llmFields = ['description', 'tags', 'cuisines', 'meal_types'],
      maxRetries = 2
    } = options;

    let recipe: Partial<Recipe> = { ...rawRecipe };

    // Step 1: Existing enrichment pipeline (ingredients, instructions, etc.)
    if (useExistingEnrichment) {
      console.log('\n📋 Step 1: Running existing enrichment pipeline...');
      try {
        const enriched = await ComprehensiveEnrichment.enrichRecipe(rawRecipe);
        recipe = { ...recipe, ...enriched };
        console.log('✅ Existing enrichment completed');
      } catch (error) {
        const errorMsg = `Existing enrichment failed: ${error}`;
        errors.push(errorMsg);
        console.error('❌', errorMsg);
      }
    }

    // Step 2: Free LLM enhancement for missing fields
    if (useLLM) {
      console.log('\n🤖 Step 2: Free LLM enhancement...');

      // Determine which fields need enhancement
      const fieldsToEnhance = llmFields.filter(field => {
        switch (field) {
          case 'description':
            return !recipe.description || recipe.description.length < 50;
          case 'tags':
            return !recipe.tags || recipe.tags.length === 0;
          case 'cuisines':
            return !recipe.cuisines || recipe.cuisines.length === 0;
          case 'meal_types':
            return !recipe.meal_types || recipe.meal_types.length === 0;
          default:
            return true;
        }
      });

      if (fieldsToEnhance.length > 0) {
        console.log(`   Enhancing fields: ${fieldsToEnhance.join(', ')}`);

        try {
          const llmResult = await FreeLLMService.enhanceRecipe({
            recipe,
            fields: fieldsToEnhance as any
          });

          if (llmResult.success && llmResult.data) {
            // Merge LLM enhancements
            if (llmResult.data.description && fieldsToEnhance.includes('description')) {
              recipe.description = llmResult.data.description;
              console.log(`   ✅ Description: "${recipe.description.substring(0, 50)}..."`);
            }

            if (llmResult.data.tags && fieldsToEnhance.includes('tags')) {
              recipe.tags = [...(recipe.tags || []), ...llmResult.data.tags];
              console.log(`   ✅ Tags: ${recipe.tags.length} total`);
            }

            if (llmResult.data.cuisines && fieldsToEnhance.includes('cuisines')) {
              recipe.cuisines = [...(recipe.cuisines || []), ...llmResult.data.cuisines];
              console.log(`   ✅ Cuisines: ${recipe.cuisines.join(', ')}`);
            }

            if (llmResult.data.meal_types && fieldsToEnhance.includes('meal_types')) {
              recipe.meal_types = [...(recipe.meal_types || []), ...llmResult.data.meal_types];
              console.log(`   ✅ Meal types: ${recipe.meal_types.join(', ')}`);
            }

            if (llmResult.data.cooking_tips) {
              (recipe as any).cooking_tips = llmResult.data.cooking_tips;
              console.log(`   ✅ Cooking tips: ${llmResult.data.cooking_tips.length} tips`);
            }

            stats.llmUsed = true;
            stats.llmProvider = llmResult.provider;
            console.log(`✅ LLM enhancement completed (provider: ${llmResult.provider})`);
          } else {
            warnings.push(`LLM enhancement failed: ${llmResult.error}`);
            console.warn(`⚠️  LLM enhancement failed: ${llmResult.error}`);
          }
        } catch (error) {
          warnings.push(`LLM enhancement error: ${error}`);
          console.error('⚠️  LLM enhancement error:', error);
        }
      } else {
        console.log('   ⏭️  All LLM fields already complete');
      }
    }

    // Step 3: Free nutrition APIs for ingredients
    if (useFreeNutritionAPIs && recipe.ingredients) {
      console.log('\n🥗 Step 3: Free nutrition API enhancement...');

      let enrichedCount = 0;
      const ingredientsArray = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];

      for (const ingredient of ingredientsArray) {
        // Skip if ingredient already has nutrition data
        if ((ingredient as any).nutrition) {
          continue;
        }

        try {
          const ingredientName = typeof ingredient === 'string'
            ? ingredient
            : (ingredient as any).name || (ingredient as any).text;

          if (!ingredientName) continue;

          // Try to get nutrition data from free APIs
          const nutritionResult = await FreeAPIService.getNutrition({
            ingredientName,
            quantity: (ingredient as any).quantity?.[0] || 100,
            unit: (ingredient as any).unit || 'g'
          });

          if (nutritionResult.success && nutritionResult.data) {
            (ingredient as any).nutrition = nutritionResult.data;

            if (!stats.nutritionAPIsUsed.includes(nutritionResult.provider)) {
              stats.nutritionAPIsUsed.push(nutritionResult.provider);
            }

            enrichedCount++;
          }
        } catch (error) {
          // Silently continue - nutrition is optional
        }
      }

      if (enrichedCount > 0) {
        console.log(`✅ Enriched ${enrichedCount}/${ingredientsArray.length} ingredients with nutrition data`);
        console.log(`   APIs used: ${stats.nutritionAPIsUsed.join(', ')}`);
      } else {
        console.log('   ℹ️  No ingredients enriched with nutrition data');
      }
    }

    // Step 4: Calculate final completeness score
    stats.completenessScore = this.calculateCompleteness(recipe);
    stats.enrichmentTimeMs = Date.now() - startTime;

    console.log('\n📊 Enhancement Summary:');
    console.log('='.repeat(60));
    console.log(`   Completeness: ${stats.completenessScore}%`);
    console.log(`   LLM used: ${stats.llmUsed ? 'Yes (' + stats.llmProvider + ')' : 'No'}`);
    console.log(`   Nutrition APIs: ${stats.nutritionAPIsUsed.length > 0 ? stats.nutritionAPIsUsed.join(', ') : 'None'}`);
    console.log(`   Time: ${stats.enrichmentTimeMs}ms`);
    console.log(`   Errors: ${errors.length}`);
    console.log(`   Warnings: ${warnings.length}`);
    console.log('='.repeat(60) + '\n');

    return {
      recipe,
      success: errors.length === 0,
      errors,
      warnings,
      stats
    };
  }

  /**
   * Calculate recipe completeness score (0-100%)
   */
  private static calculateCompleteness(recipe: Partial<Recipe>): number {
    const fields = {
      // Required fields (5 points each)
      required: [
        'title', 'ingredients', 'instructions', 'source_url'
      ],
      // Important fields (3 points each)
      important: [
        'description', 'author', 'prep_time_minutes',
        'cook_time_minutes', 'servings', 'image_url'
      ],
      // Optional fields (1 point each)
      optional: [
        'cuisines', 'meal_types', 'tags', 'nutrition',
        'cooking_method', 'suitable_for_diet'
      ]
    };

    let score = 0;
    let maxScore =
      fields.required.length * 5 +
      fields.important.length * 3 +
      fields.optional.length * 1;

    // Check required fields
    for (const field of fields.required) {
      const value = recipe[field as keyof Recipe];
      if (value && (Array.isArray(value) ? value.length > 0 : String(value).length > 0)) {
        score += 5;
      }
    }

    // Check important fields
    for (const field of fields.important) {
      const value = recipe[field as keyof Recipe];
      if (value && (Array.isArray(value) ? value.length > 0 : String(value).length > 0)) {
        score += 3;
      }
    }

    // Check optional fields
    for (const field of fields.optional) {
      const value = recipe[field as keyof Recipe];
      if (value && (Array.isArray(value) ? value.length > 0 : String(value).length > 0)) {
        score += 1;
      }
    }

    return Math.round((score / maxScore) * 100);
  }

  /**
   * Batch enhance multiple recipes
   */
  static async enhanceRecipeBatch(
    recipes: RawScrapedRecipe[],
    options: EnhancementOptions = {}
  ): Promise<EnhancementResult[]> {

    console.log(`\n🔄 Batch enhancing ${recipes.length} recipes...`);

    const results: EnhancementResult[] = [];

    for (let i = 0; i < recipes.length; i++) {
      console.log(`\n[${i + 1}/${recipes.length}] Processing: ${recipes[i].title}`);

      const result = await this.enhanceRecipe(recipes[i], options);
      results.push(result);

      // Small delay to avoid rate limits
      if (i < recipes.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Summary
    const successful = results.filter(r => r.success).length;
    const avgCompleteness = results.reduce((sum, r) => sum + r.stats.completenessScore, 0) / results.length;
    const totalTime = results.reduce((sum, r) => sum + r.stats.enrichmentTimeMs, 0);

    console.log('\n📊 Batch Enhancement Summary:');
    console.log('='.repeat(60));
    console.log(`   Total recipes: ${recipes.length}`);
    console.log(`   Successful: ${successful}/${recipes.length} (${(successful/recipes.length*100).toFixed(1)}%)`);
    console.log(`   Avg completeness: ${avgCompleteness.toFixed(1)}%`);
    console.log(`   Total time: ${totalTime}ms (${(totalTime/results.length).toFixed(0)}ms avg)`);
    console.log('='.repeat(60) + '\n');

    return results;
  }
}

export default EnhancedRecipeEnrichment;
