import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config.js';
import { Recipe, RecipeIngredient as CoreRecipeIngredient, InstructionStep as CoreInstructionStep, DietaryRestriction } from '../types.js';
import { ParsedRecipeData, RawScrapedRecipe } from '../shared/types.js';
import { processAndSaveRecipe } from '../database.js';
import { getRecipeDietaryRestrictions } from '../enrichment/dietaryRestrictionRules.js';

export class DatabaseService {
  private static instance: DatabaseService;
  private supabase: SupabaseClient;
  private initialized = false;

  private constructor() {
    this.supabase = createClient(config.supabaseUrl!, config.supabaseServiceKey!);
  }

  static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      // Test connection
      const { error } = await this.supabase.from('recipes').select('count').limit(1);
      if (error) throw error;
      
      this.initialized = true;
      console.log('✅ Database connection initialized');
    } catch (error) {
      console.error('❌ Database initialization failed:', error);
      throw error;
    }
  }

  async saveRecipe(recipeData: ParsedRecipeData): Promise<Recipe & { id: string }>;
  async saveRecipe(recipeData: RawScrapedRecipe): Promise<Recipe & { id: string }>;
  async saveRecipe(recipeData: { recipe: ParsedRecipeData | RawScrapedRecipe }): Promise<Recipe & { id: string }>;
  async saveRecipe(recipeData: ParsedRecipeData | RawScrapedRecipe | { recipe: ParsedRecipeData | RawScrapedRecipe }): Promise<Recipe & { id: string }> {
    try {
      // Normalize incoming data to ParsedRecipeData
      const normalized: ParsedRecipeData = this.normalizeToParsedRecipe(recipeData);

      // Use the existing processAndSaveRecipe function
      await processAndSaveRecipe(normalized, normalized.source_url || '', {
        include_ai: true,
        include_nutrition: true,
        generate_embedding: true
      });

      // Return a properly typed recipe object with guaranteed id
      // Convert to the core rule types without assertions
      const ingredientsForRules: CoreRecipeIngredient[] = (normalized.ingredients || []).map((ing) => {
        const grams = ('grams' in ing && typeof (ing as { grams?: unknown }).grams === 'number')
          ? (ing as { grams: number }).grams
          : (('weight_grams' in ing && typeof (ing as { weight_grams?: unknown }).weight_grams === 'number')
              ? (ing as { weight_grams: number }).weight_grams
              : undefined);
        const quantity = Array.isArray(ing.quantity) ? ing.quantity[0] : ing.quantity;
        return {
          text: ing.text,
          name: ing.name,
          order_index: ing.order_index,
          unit: ing.unit,
          notes: ing.notes,
          quantity,
          grams,
          // Omit category if it's not one of the standardized enum values
        } as CoreRecipeIngredient;
      });

      const instructionsForRules: CoreInstructionStep[] = (normalized.instructions || []).map((ins) => {
        const tempF = typeof ins.temperature === 'number'
          ? (ins.temperature_unit === 'C'
              ? Math.round((ins.temperature * 9) / 5 + 32)
              : ins.temperature)
          : null;
        // Normalize tips to string | null
        const tips = Array.isArray(ins.tips)
          ? ins.tips.join(', ')
          : (typeof ins.tips === 'string' ? ins.tips : null);
        return {
          step_number: ins.step_number,
          text: ins.text,
          action: null,
          timer_min: [],
          temperature_f: tempF ?? undefined,
          equipment: ins.equipment ?? [],
          mentioned_ingredients: ins.ingredients_referenced ?? [],
          tips: tips ?? undefined,
        };
      });

      const suitable_for_diet: DietaryRestriction[] = getRecipeDietaryRestrictions(
        ingredientsForRules,
        instructionsForRules,
        normalized.title,
        (normalized.description ?? '') as string,
        normalized.tags ?? []
      );

      const cuisines = Array.isArray(normalized.cuisines)
        ? normalized.cuisines
        : normalized.cuisines
        ? [normalized.cuisines]
        : [];

      const cooking_method = Array.isArray(normalized.cooking_method)
        ? normalized.cooking_method
        : normalized.cooking_method
        ? [normalized.cooking_method]
        : [];

      // Normalize servings to a number
      const servings = typeof normalized.servings === 'number'
        ? normalized.servings
        : typeof normalized.servings === 'string'
        ? (Number.isFinite(Number(normalized.servings)) ? Math.round(Number(normalized.servings)) : undefined)
        : undefined;

      // Map *_minutes fields back to Recipe's times
      const prep_time_minutes = typeof normalized.prep_time_minutes === 'number' && Number.isFinite(normalized.prep_time_minutes)
        ? Math.max(0, Math.floor(normalized.prep_time_minutes))
        : undefined;
      const cook_time_minutes = typeof normalized.cook_time_minutes === 'number' && Number.isFinite(normalized.cook_time_minutes)
        ? Math.max(0, Math.floor(normalized.cook_time_minutes))
        : undefined;
      const total_time_minutes = typeof normalized.total_time_minutes === 'number' && Number.isFinite(normalized.total_time_minutes)
        ? Math.max(0, Math.floor(normalized.total_time_minutes))
        : (typeof prep_time_minutes === 'number' && typeof cook_time_minutes === 'number'
            ? prep_time_minutes + cook_time_minutes
            : undefined);

      const savedRecipe: Recipe & { id: string } = {
        // Generate a local id for return typing; real id comes from DB in other flows
        id: `recipe_${Date.now()}`,
        // Core required fields with safe defaults/normalization
        title: normalized.title || 'Untitled Recipe',
        description: (normalized.description ?? '') || '',
        source_url: normalized.source_url || '',
        image_url: normalized.image_url ?? '',
        ingredients: ingredientsForRules,
        instructions: instructionsForRules,
        // Omit nutrition here; normalization handled downstream
        nutrition: undefined,
        cuisines,
        meal_types: normalized.meal_types ?? [],
        tags: normalized.tags ?? [],
        cooking_method,
        suitable_for_diet,
        is_public: true,
        created_by: null,
        embedding: undefined,
        completeness_score: undefined,
        parsing_confidence: undefined,
        created_at: new Date().toISOString(),
        updated_at: undefined,
        servings,
        prep_time_minutes,
        cook_time_minutes,
        total_time_minutes,
        effort_level: (typeof normalized.effort_level === 'string'
          ? (Number.isFinite(Number(normalized.effort_level)) ? Math.round(Number(normalized.effort_level)) : null)
          : (typeof normalized.effort_level === 'number' ? normalized.effort_level : null)),
        author: normalized.author,
        publisher_website: undefined,
        health_score: undefined,
        recipe_yield: undefined,
        recipe_category: undefined,
        average_rating: undefined,
        review_count: undefined,
      };
      
      return savedRecipe;
    } catch (error) {
      console.error('Failed to save recipe:', error);
      throw error;
    }
  }

  private normalizeToParsedRecipe(
    data: ParsedRecipeData | RawScrapedRecipe | { recipe: ParsedRecipeData | RawScrapedRecipe }
  ): ParsedRecipeData {
    const isWrapped = (val: unknown): val is { recipe: ParsedRecipeData | RawScrapedRecipe } =>
      typeof val === 'object' && val !== null && 'recipe' in (val as Record<string, unknown>);

    const isParsedRecipeData = (val: unknown): val is ParsedRecipeData => {
      const maybe = val as ParsedRecipeData;
      const first = Array.isArray(maybe?.ingredients) ? maybe.ingredients[0] : undefined;
      return !!(first && typeof first === 'object' && 'text' in first && 'name' in first);
    };

    const payload: ParsedRecipeData | RawScrapedRecipe = isWrapped(data) ? data.recipe : data;

    // If it already matches ParsedRecipeData shape, return it directly
    if (isParsedRecipeData(payload)) return payload;

    // Otherwise, transform RawScrapedRecipe -> ParsedRecipeData
    const raw = payload as RawScrapedRecipe;
    const ingredients = (raw.ingredients || []).map((txt, idx) => ({
      text: txt,
      name: txt,
      order_index: idx,
    }));
    const instructions = (raw.instructions || []).map((txt, idx) => ({
      step_number: idx + 1,
      text: txt,
    }));

    // Carry over numeric times into *_minutes properties for ParsedRecipeData
    const prep_time_minutes = typeof raw.prep_time === 'number' && Number.isFinite(raw.prep_time)
      ? Math.max(0, Math.floor(raw.prep_time))
      : null;
    const cook_time_minutes = typeof raw.cook_time === 'number' && Number.isFinite(raw.cook_time)
      ? Math.max(0, Math.floor(raw.cook_time))
      : null;
    const total_time_minutes = typeof raw.total_time === 'number' && Number.isFinite(raw.total_time)
      ? Math.max(0, Math.floor(raw.total_time))
      : (typeof prep_time_minutes === 'number' && typeof cook_time_minutes === 'number'
          ? prep_time_minutes + cook_time_minutes
          : null);

    return {
      title: raw.title,
      source_url: raw.source_url,
      image_url: raw.image_url ?? undefined,
      ingredients,
      instructions,
      servings: typeof raw.servings === 'number' && Number.isFinite(raw.servings)
        ? Math.max(0, Math.floor(raw.servings))
        : undefined,
      prep_time_minutes,
      cook_time_minutes,
      total_time_minutes,
      description: raw.description ?? undefined,
      author: raw.author,
      publisher: raw.publisher,
      published_date: raw.published_date,
      tags: raw.tags,
      cuisines: [],
      meal_types: [],
      nutrition: null,
    };
  }

  async getRecipeById(id: string): Promise<Recipe | null> {
    try {
      const { data, error } = await this.supabase
        .from('recipes')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as Recipe;
    } catch (error) {
      console.error('Failed to get recipe:', error);
      return null;
    }
  }

  async getAllRecipes(): Promise<Recipe[]> {
    try {
      const { data, error } = await this.supabase
        .from('recipes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Recipe[];
    } catch (error) {
      console.error('Failed to get recipes:', error);
      return [];
    }
  }

  async deleteRecipe(id: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('recipes')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Failed to delete recipe:', error);
      return false;
    }
  }

  async getStatistics(): Promise<any> {
    try {
      const { data: recipes, error } = await this.supabase
        .from('recipes')
        .select('cuisine_type, total_time, dietary_restrictions, tags, created_at');

      if (error) throw error;

      const totalRecipes = recipes.length;
      const activeRecipes = recipes.length;
      const cuisines = [...new Set(recipes.map(r => r.cuisine_type).filter(Boolean))];
      const avgCookingTime = recipes.reduce((sum, r) => sum + (r.total_time || 0), 0) / totalRecipes;
      const allTags = recipes.flatMap(r => r.tags || []);
      const popularTags = [...new Set(allTags)].slice(0, 10);

      return {
        totalRecipes,
        activeRecipes,
        totalIngredients: totalRecipes * 8, // Estimate
        uniqueCuisines: cuisines.length,
        avgCookingTime: Math.round(avgCookingTime),
        popularTags,
        databaseSize: `${Math.round(totalRecipes * 2.5)}KB`,
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      console.error('Failed to get statistics:', error);
      return {
        totalRecipes: 0,
        activeRecipes: 0,
        totalIngredients: 0,
        uniqueCuisines: 0,
        avgCookingTime: 0,
        popularTags: [],
        databaseSize: '0KB',
        lastUpdated: new Date().toISOString()
      };
    }
  }

  async healthCheck(): Promise<any> {
    try {
      const startTime = Date.now();
      const { error } = await this.supabase.from('recipes').select('count').limit(1);
      const responseTime = Date.now() - startTime;

      return {
        connected: !error,
        responseTime: `${responseTime}ms`,
        version: 'Supabase',
        availableSpace: 'Unlimited',
        activeConnections: 1,
        issues: error ? [error.message] : []
      };
    } catch (error) {
      return {
        connected: false,
        responseTime: 'N/A',
        version: 'Unknown',
        availableSpace: 'Unknown',
        activeConnections: 0,
        issues: [String(error)]
      };
    }
  }
}
