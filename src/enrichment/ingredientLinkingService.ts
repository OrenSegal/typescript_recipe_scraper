/*
 * Robust Ingredient Linking Service
 * 
 * Provides robust linking of parsed ingredients to a canonical master ingredients table
 * with comprehensive validation, fallback mechanisms, and detailed tracking.
 * 
 * Features:
 * - Master ingredients table with unique IDs
 * - Fuzzy matching with confidence scoring
 * - Validation notes tracking for debugging
 * - Fallback mechanisms for unmatched ingredients
 * - Performance optimized with caching
 */

import { RecipeIngredient } from '../shared/types.js';
import { ingredientMatcher, COMPREHENSIVE_INGREDIENT_DATABASE, IngredientMapping } from './comprehensiveIngredientDatabase.js';
import { createHash } from 'crypto';

// Master ingredient entry with unique ID and metadata
export interface MasterIngredient {
  id: string;
  canonical_name: string;
  category: string;
  aliases: string[];
  brands?: string[];
  regional_names?: string[];
  scientific_name?: string;
  nutritional_profile?: {
    density_g_ml?: number;
    common_units?: string[];
    conversion_factors?: Record<string, number>;
  };
  created_at: string;
  updated_at: string;
  usage_count: number;
}

// Ingredient linking result with validation info
export interface IngredientLinkingResult {
  success: boolean;
  master_ingredient_id?: string;
  canonical_name?: string;
  confidence_score: number;
  matching_method: 'exact' | 'alias' | 'fuzzy' | 'fallback';
  validation_notes: string[];
  fallback_used?: boolean;
  original_text: string;
}

// Batch linking results for performance tracking
export interface BatchLinkingResults {
  total_ingredients: number;
  successful_links: number;
  failed_links: number;
  confidence_scores: number[];
  average_confidence: number;
  validation_notes: string[];
  performance_metrics: {
    processing_time_ms: number;
    cache_hits: number;
    cache_misses: number;
  };
}

export class IngredientLinkingService {
  private static instance: IngredientLinkingService;
  private masterIngredientsCache: Map<string, MasterIngredient> = new Map();
  private linkingCache: Map<string, IngredientLinkingResult> = new Map();
  private performanceMetrics = {
    cache_hits: 0,
    cache_misses: 0,
    total_requests: 0
  };

  private constructor() {
    this.initializeMasterIngredientsTable();
  }

  /**
   * Singleton pattern for efficient resource usage
   */
  public static getInstance(): IngredientLinkingService {
    if (!IngredientLinkingService.instance) {
      IngredientLinkingService.instance = new IngredientLinkingService();
    }
    return IngredientLinkingService.instance;
  }

  /**
   * Initialize master ingredients table from comprehensive database
   */
  private initializeMasterIngredientsTable(): void {
    console.log('🔗 Initializing master ingredients table...');
    
    for (const ingredient of COMPREHENSIVE_INGREDIENT_DATABASE) {
      const masterIngredient: MasterIngredient = {
        id: this.generateIngredientId(ingredient.canonical_name),
        canonical_name: ingredient.canonical_name,
        category: ingredient.category,
        aliases: ingredient.aliases,
        brands: ingredient.brands,
        regional_names: ingredient.regional_names,
        scientific_name: ingredient.scientific_name,
        nutritional_profile: {
          common_units: ['cup', 'tablespoon', 'teaspoon', 'ounce', 'gram'],
          conversion_factors: {}
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        usage_count: 0
      };
      
      this.masterIngredientsCache.set(masterIngredient.id, masterIngredient);
    }
    
    console.log(`✅ Master ingredients table initialized with ${this.masterIngredientsCache.size} ingredients`);
  }

  /**
   * Generate consistent unique ID for ingredient
   */
  private generateIngredientId(canonicalName: string): string {
    return createHash('md5').update(canonicalName.toLowerCase().trim()).digest('hex').substring(0, 12);
  }

  /**
   * Link a single ingredient to master table with comprehensive validation
   */
  public async linkIngredient(
    ingredient: RecipeIngredient | string,
    options: {
      enableFuzzyMatching?: boolean;
      minConfidenceScore?: number;
      trackValidationNotes?: boolean;
    } = {}
  ): Promise<IngredientLinkingResult> {
    const startTime = Date.now();
    this.performanceMetrics.total_requests++;
    
    const ingredientText = typeof ingredient === 'string' ? ingredient : ingredient.name || ingredient.text;
    const cacheKey = `${ingredientText.toLowerCase()}_${JSON.stringify(options)}`;
    
    // Check cache first
    if (this.linkingCache.has(cacheKey)) {
      this.performanceMetrics.cache_hits++;
      return this.linkingCache.get(cacheKey)!;
    }
    this.performanceMetrics.cache_misses++;

    const result: IngredientLinkingResult = {
      success: false,
      confidence_score: 0,
      matching_method: 'fallback',
      validation_notes: [],
      original_text: ingredientText
    };

    const {
      enableFuzzyMatching = true,
      minConfidenceScore = 0.6,
      trackValidationNotes = true
    } = options;

    try {
      // Step 1: Try exact canonical name match
      const exactMatch = this.findExactMatch(ingredientText);
      if (exactMatch) {
        result.success = true;
        result.master_ingredient_id = exactMatch.id;
        result.canonical_name = exactMatch.canonical_name;
        result.confidence_score = 1.0;
        result.matching_method = 'exact';
        if (trackValidationNotes) {
          result.validation_notes.push(`Exact match found for "${ingredientText}"`);
        }
        
        // Update usage count
        exactMatch.usage_count++;
        exactMatch.updated_at = new Date().toISOString();
      }
      // Step 2: Try alias matching
      else {
        const aliasMatch = this.findAliasMatch(ingredientText);
        if (aliasMatch) {
          result.success = true;
          result.master_ingredient_id = aliasMatch.id;
          result.canonical_name = aliasMatch.canonical_name;
          result.confidence_score = 0.9;
          result.matching_method = 'alias';
          if (trackValidationNotes) {
            result.validation_notes.push(`Alias match found: "${ingredientText}" → "${aliasMatch.canonical_name}"`);
          }
          
          aliasMatch.usage_count++;
          aliasMatch.updated_at = new Date().toISOString();
        }
        // Step 3: Try fuzzy matching if enabled
        else if (enableFuzzyMatching) {
          const fuzzyMatch = this.findFuzzyMatch(ingredientText, minConfidenceScore);
          if (fuzzyMatch.ingredient && fuzzyMatch.score >= minConfidenceScore) {
            result.success = true;
            result.master_ingredient_id = fuzzyMatch.ingredient.id;
            result.canonical_name = fuzzyMatch.ingredient.canonical_name;
            result.confidence_score = fuzzyMatch.score;
            result.matching_method = 'fuzzy';
            if (trackValidationNotes) {
              result.validation_notes.push(
                `Fuzzy match found: "${ingredientText}" → "${fuzzyMatch.ingredient.canonical_name}" (confidence: ${fuzzyMatch.score.toFixed(2)})`
              );
            }
            
            fuzzyMatch.ingredient.usage_count++;
            fuzzyMatch.ingredient.updated_at = new Date().toISOString();
          }
          // Step 4: Fallback - create new master ingredient
          else {
            const fallbackIngredient = await this.createFallbackMasterIngredient(ingredientText);
            result.success = true;
            result.master_ingredient_id = fallbackIngredient.id;
            result.canonical_name = fallbackIngredient.canonical_name;
            result.confidence_score = 0.3;
            result.matching_method = 'fallback';
            result.fallback_used = true;
            if (trackValidationNotes) {
              result.validation_notes.push(
                `No match found for "${ingredientText}". Created fallback master ingredient.`,
                `Fallback ID: ${fallbackIngredient.id}`,
                `This ingredient should be reviewed and potentially linked manually.`
              );
            }
          }
        }
        // No match and fuzzy matching disabled
        else {
          result.success = false;
          result.confidence_score = 0;
          if (trackValidationNotes) {
            result.validation_notes.push(
              `No match found for "${ingredientText}"`,
              `Fuzzy matching is disabled`,
              `Consider enabling fuzzy matching or adding this ingredient to the master database`
            );
          }
        }
      }

    } catch (error) {
      result.success = false;
      result.confidence_score = 0;
      if (trackValidationNotes) {
        result.validation_notes.push(
          `Error linking ingredient "${ingredientText}": ${error instanceof Error ? error.message : String(error)}`
        );
      }
      console.error(`❌ Failed to link ingredient "${ingredientText}":`, error);
    }

    // Cache the result
    this.linkingCache.set(cacheKey, result);
    
    // Log performance for monitoring
    const processingTime = Date.now() - startTime;
    if (processingTime > 100) {
      console.warn(`⚠️ Slow ingredient linking: ${processingTime}ms for "${ingredientText}"`);
    }

    return result;
  }

  /**
   * Link multiple ingredients in batch for better performance
   */
  public async linkIngredientsBatch(
    ingredients: (RecipeIngredient | string)[],
    options: {
      enableFuzzyMatching?: boolean;
      minConfidenceScore?: number;
      trackValidationNotes?: boolean;
    } = {}
  ): Promise<BatchLinkingResults> {
    const startTime = Date.now();
    const results: IngredientLinkingResult[] = [];
    const validationNotes: string[] = [];

    console.log(`🔗 Batch linking ${ingredients.length} ingredients...`);

    // Process ingredients in parallel for better performance
    const linkingPromises = ingredients.map(ingredient => this.linkIngredient(ingredient, options));
    const individualResults = await Promise.all(linkingPromises);
    
    results.push(...individualResults);

    // Aggregate results
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    const confidenceScores = results.map(r => r.confidence_score);
    const averageConfidence = confidenceScores.reduce((sum, score) => sum + score, 0) / confidenceScores.length;

    // Collect validation notes
    results.forEach(result => {
      validationNotes.push(...result.validation_notes);
    });

    // Add batch-level validation notes
    if (failed.length > 0) {
      validationNotes.push(`${failed.length} ingredients failed to link successfully`);
      validationNotes.push(`Failed ingredients: ${failed.map(f => f.original_text).join(', ')}`);
    }

    if (averageConfidence < 0.7) {
      validationNotes.push(`Low average confidence score: ${averageConfidence.toFixed(2)}`);
      validationNotes.push(`Consider reviewing ingredient matching quality`);
    }

    const processingTime = Date.now() - startTime;

    const batchResults: BatchLinkingResults = {
      total_ingredients: ingredients.length,
      successful_links: successful.length,
      failed_links: failed.length,
      confidence_scores: confidenceScores,
      average_confidence: averageConfidence,
      validation_notes: validationNotes,
      performance_metrics: {
        processing_time_ms: processingTime,
        cache_hits: this.performanceMetrics.cache_hits,
        cache_misses: this.performanceMetrics.cache_misses
      }
    };

    console.log(`✅ Batch linking completed: ${successful.length}/${ingredients.length} successful (${(successful.length/ingredients.length*100).toFixed(1)}%)`);
    console.log(`📊 Average confidence: ${averageConfidence.toFixed(2)}, Processing time: ${processingTime}ms`);

    return batchResults;
  }

  /**
   * Find exact match in master ingredients table
   */
  private findExactMatch(ingredientText: string): MasterIngredient | null {
    const normalized = ingredientText.toLowerCase().trim();
    
    for (const [id, masterIngredient] of this.masterIngredientsCache) {
      if (masterIngredient.canonical_name.toLowerCase() === normalized) {
        return masterIngredient;
      }
    }
    
    return null;
  }

  /**
   * Find alias match in master ingredients table
   */
  private findAliasMatch(ingredientText: string): MasterIngredient | null {
    const normalized = ingredientText.toLowerCase().trim();
    
    for (const [id, masterIngredient] of this.masterIngredientsCache) {
      if (masterIngredient.aliases.some(alias => alias.toLowerCase() === normalized)) {
        return masterIngredient;
      }
    }
    
    return null;
  }

  /**
   * Find fuzzy match with confidence scoring
   */
  private findFuzzyMatch(ingredientText: string, minScore: number): { ingredient: MasterIngredient | null; score: number } {
    const normalized = ingredientText.toLowerCase().trim();
    let bestMatch: MasterIngredient | null = null;
    let bestScore = 0;

    for (const [id, masterIngredient] of this.masterIngredientsCache) {
      // Check against canonical name
      const canonicalScore = this.calculateSimilarity(normalized, masterIngredient.canonical_name.toLowerCase());
      if (canonicalScore > bestScore && canonicalScore >= minScore) {
        bestMatch = masterIngredient;
        bestScore = canonicalScore;
      }

      // Check against aliases
      for (const alias of masterIngredient.aliases) {
        const aliasScore = this.calculateSimilarity(normalized, alias.toLowerCase());
        if (aliasScore > bestScore && aliasScore >= minScore) {
          bestMatch = masterIngredient;
          bestScore = aliasScore;
        }
      }
    }

    return { ingredient: bestMatch, score: bestScore };
  }

  /**
   * Calculate text similarity using Levenshtein distance
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const substitutionCost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // insertion
          matrix[j - 1][i] + 1, // deletion
          matrix[j - 1][i - 1] + substitutionCost // substitution
        );
      }
    }

    const maxLength = Math.max(str1.length, str2.length);
    const distance = matrix[str2.length][str1.length];
    return maxLength === 0 ? 1 : 1 - distance / maxLength;
  }

  /**
   * Create fallback master ingredient for unmatched items
   */
  private async createFallbackMasterIngredient(ingredientText: string): Promise<MasterIngredient> {
    // Try to use existing ingredient matcher for category
    const category = ingredientMatcher.getCategory(ingredientText) || 'Other';
    
    const fallbackIngredient: MasterIngredient = {
      id: this.generateIngredientId(`fallback_${ingredientText}_${Date.now()}`),
      canonical_name: ingredientText.toLowerCase().trim(),
      category: category,
      aliases: [ingredientText],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      usage_count: 1
    };

    // Add to cache
    this.masterIngredientsCache.set(fallbackIngredient.id, fallbackIngredient);
    
    console.log(`🆕 Created fallback master ingredient: "${fallbackIngredient.canonical_name}" (ID: ${fallbackIngredient.id})`);
    
    return fallbackIngredient;
  }

  /**
   * Get master ingredient by ID
   */
  public getMasterIngredient(id: string): MasterIngredient | null {
    return this.masterIngredientsCache.get(id) || null;
  }

  /**
   * Get all master ingredients in category
   */
  public getMasterIngredientsByCategory(category: string): MasterIngredient[] {
    const results: MasterIngredient[] = [];
    
    for (const [id, ingredient] of this.masterIngredientsCache) {
      if (ingredient.category === category) {
        results.push(ingredient);
      }
    }
    
    return results.sort((a, b) => b.usage_count - a.usage_count);
  }

  /**
   * Get performance metrics for monitoring
   */
  public getPerformanceMetrics() {
    return {
      ...this.performanceMetrics,
      cache_size: this.linkingCache.size,
      master_ingredients_count: this.masterIngredientsCache.size,
      cache_hit_rate: this.performanceMetrics.total_requests > 0 
        ? (this.performanceMetrics.cache_hits / this.performanceMetrics.total_requests * 100).toFixed(2) + '%'
        : '0%'
    };
  }

  /**
   * Clear caches for memory management
   */
  public clearCaches(): void {
    this.linkingCache.clear();
    this.performanceMetrics.cache_hits = 0;
    this.performanceMetrics.cache_misses = 0;
    this.performanceMetrics.total_requests = 0;
    console.log('🧹 Ingredient linking caches cleared');
  }
}

// Export singleton instance
export const ingredientLinkingService = IngredientLinkingService.getInstance();
