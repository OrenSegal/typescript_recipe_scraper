/**
 * COMPLETE UNIFIED TYPE DEFINITIONS
 * 
 * Comprehensive type definitions combining all interfaces from types.ts and shared/types.ts
 * Includes all database compatibility fields and existing property variants
 * Single source of truth for the entire codebase following DRY/SOLID principles
 */

// Import Zod for schema validation
import { z } from 'zod';
import { CookingAction, IngredientCategory, KitchenEquipment, MeasurementUnit } from './constants.js';

// Import parsing specification types

// Re-export for convenience
export { IngredientCategory, MeasurementUnit, CookingAction, KitchenEquipment };

// ===== CORE ENUMS =====

export enum CookingMethod {
  BAKING = "Baking",
  GRILLING = "Grilling", 
  ROASTING = "Roasting",
  SAUTEING = "Sautéing",
  BOILING = "Boiling",
  STEAMING = "Steaming",
  FRYING = "Frying",
  BRAISING = "Braising",
  STEWING = "Stewing",
  RAW = "Raw"
}

export enum DifficultyLevel {
  BEGINNER = "Beginner",
  INTERMEDIATE = "Intermediate", 
  ADVANCED = "Advanced",
  EXPERT = "Expert"
}

export enum MealType {
  BREAKFAST = "Breakfast",
  BRUNCH = "Brunch",
  LUNCH = "Lunch",
  DINNER = "Dinner",
  DESSERT = "Dessert",
  SNACK = "Snack",
  APPETIZER = "Appetizer",
  SIDE_DISH = "Side Dish",
  BEVERAGE = "Beverage"
}

export enum DietaryRestriction {
  GLUTEN_FREE = "Gluten-Free",
  DAIRY_FREE = "Dairy-Free",
  LACTOSE_INTOLERANT = "Lactose-Intolerant",
  NUT_FREE = "Nut-Free",
  PEANUT_FREE = "Peanut-Free",
  SOY_FREE = "Soy-Free",
  EGG_FREE = "Egg-Free",
  SHELLFISH_FREE = "Shellfish-Free",
  FISH_FREE = "Fish-Free",
  VEGETARIAN = "Vegetarian",
  VEGAN = "Vegan",
  PESCATARIAN = "Pescatarian",
  KETOGENIC = "Ketogenic",
  PALEO = "Paleo",
  LOW_CARB = "Low Carb",
  SUGAR_FREE = "Sugar-Free",
  LOW_SODIUM = "Low Sodium",
  HEART_HEALTHY = "Heart-Healthy",
  KOSHER = "Kosher",
  HALAL = "Halal"
}

// ===== NUTRITION TYPES =====

export interface NutritionInfo {
  // Basic macronutrients
  calories?: number;
  protein_g?: number;
  carbohydrates_g?: number;
  fat_g?: number;
  
  // Detailed nutrients
  saturated_fat_g?: number;
  fiber_g?: number;
  sugar_g?: number;
  sodium_mg?: number;
  cholesterol_mg?: number;
  potassium_mg?: number;
  calcium_mg?: number;
  iron_mg?: number;
  vitamin_c_mg?: number;
  vitamin_a_iu?: number;
  
  // Serving information
  serving_size?: string;
  servings_per_recipe?: number;
  
  // Percentages
  protein_percent?: number;
  fat_percent?: number;
  carbs_percent?: number;
  fiber_percent?: number;
  sodium_percent?: number;
}

// Legacy compatibility (from types.ts)
export interface Nutrition {
  calories?: number | null;
  proteinG?: number | null;
  carbohydratesG?: number | null;
  fatG?: number | null;
  saturatedFatG?: number | null;
  fiberG?: number | null;
  sugarG?: number | null;
  sodiumMg?: number | null;
  cholesterolMg?: number | null;
  potassiumMg?: number | null;
  calciumMg?: number | null;
  ironMg?: number | null;
  vitaminCMg?: number | null;
  vitaminAIu?: number | null;
  servingSize?: string;
  servingsPerRecipe?: number;
  
  // Additional legacy fields
  protein?: string;
  carbohydrateG?: string;
  transFatG?: number | null;
  monounsaturatedFatG?: number | null;
  polyunsaturatedFatG?: number | null;
}

// ===== INGREDIENT TYPES =====

export interface RecipeIngredient {
  // Core identification
  id?: string;
  recipe_id?: string;
  
  // Core content
  text: string; // Original raw text
  name: string; // Clean parsed name
  
  // Quantity and measurement
  quantity?: number | number[]; // Support ranges [min, max]
  unit?: string;
  
  // Additional details
  notes?: string;
  category?: IngredientCategory | string;
  brand?: string;
  
  // Nutritional data
  grams?: number;
  weight_grams?: number; // Database compatibility
  calories_per_unit?: number;
  
  // Organization
  order_index: number;
  
  // Metadata
  is_optional?: boolean;
  substitutes?: string[];
}

// ===== INSTRUCTION TYPES =====

export interface InstructionStep {
  // Core identification
  id?: string;
  recipe_id?: string;
  
  // Step content (support both property names for compatibility)
  step_number: number;
  text: string;
  instruction?: string; // Alternative property name
  
  // Cooking details
  action?: CookingAction | null;
  timer_min?: number[]; // [min, max] range
  temperature_f?: number | null;
  temperature_c?: number | null;
  
  // Database compatibility fields
  cooking_time?: number;
  temperature?: number;
  temperature_unit?: 'F' | 'C';
  cooking_method?: CookingMethod;
  
  // Equipment and ingredients
  equipment?: string[];
  mentioned_equipment?: string[]; // Database compatibility
  mentioned_ingredients?: string[];
  ingredients_referenced?: string[]; // Alternative property name
  
  // Additional metadata
  tips?: string | string[];
  estimated_time?: number;
  effort_level?: string;
  
  // Media
  image_url?: string;
  video_url?: string;
  
  // Processing metadata
  critical_step?: boolean;
  technique_tags?: string[];
}

// ===== CORE RECIPE TYPE =====

export interface Recipe {
  // Core identification
  id?: string;
  
  // Basic content
  title: string;
  description?: string;
  source_url: string;
  image_url?: string;
  
  // Recipe content
  ingredients: RecipeIngredient[];
  instructions: InstructionStep[];
  
  // Timing and serving
  servings?: number | string; // Support both numeric and descriptive
  prep_time_minutes?: number;
  cook_time_minutes?: number;
  total_time_minutes?: number;
  
  // Legacy timing compatibility
  prep_time?: number;
  cook_time?: number;
  total_time?: number;
  
  // Classification and metadata
  difficulty_level?: DifficultyLevel | string;
  cuisine_type?: string | string[]; // Support both single and multiple
  cuisines?: string[]; // Database compatibility
  meal_types?: MealType[] | string[];
  dietary_restrictions?: DietaryRestriction[] | string[];
  suitable_for_diet?: DietaryRestriction[] | string[]; // Database compatibility
  tags?: string[];
  
  // Nutritional information (support both interfaces)
  nutrition?: NutritionInfo | Nutrition;
  health_score?: number; // 0-100
  
  // Quality and parsing metrics
  data_completeness_score?: number; // 0-1
  parsing_confidence?: number; // 0-1
  
  // Advanced enrichment
  cooking_methods?: CookingMethod[] | string[];
  cooking_method?: CookingMethod | string; // Single method compatibility
  embedding?: number[];
  
  // Author and publishing info
  author?: string;
  publisher?: string;
  published_date?: string;
  
  // Database metadata
  created_at?: string;
  updated_at?: string;
  created_by?: string | null;
  
  // Quality scores
  quality_score?: number;
  review_count?: number;
  
  // Social and sharing
  is_public?: boolean;
  view_count?: number;
  
  // Additional metadata
  recipe_yield?: string;
  equipment_needed?: string[];
  storage_instructions?: string;
  notes?: string;
  
  // Effort level compatibility
  effort_level?: string;
}

// ===== SCRAPING TYPES =====

export interface RawScrapedRecipe {
  title: string;
  ingredients: string[];
  instructions: string[];
  source_url: string;
  image_url?: string;
  servings?: string;
  prep_time?: string;
  cook_time?: string;
  description?: string;
  author?: string;
  publisher?: string;
  published_date?: string;
  tags?: string[];
  nutrition?: string[];
}

export interface ParsedRecipeData {
  title: string;
  ingredients: RecipeIngredient[];
  instructions: InstructionStep[];
  source_url: string;
  image_url?: string;
  servings?: number | string;
  prep_time?: number;
  cook_time?: number;
  total_time?: number;
  description?: string;
  cuisines?: string;
  meal_types?: string[];
  effort_level?: string;
  author?: string;
  publisher?: string;
  published_date?: string;
  tags?: string[];
  nutrition?: NutritionInfo;
}

// ===== WEBSITE AND CRAWLING TYPES =====

export interface Website {
  id: number;
  name: string;
  base_url: string;
  sitemap_url: string;
  sub_sitemaps?: string[];
  category: string;
  priority: number;
  active: boolean;
  notes?: string;
  last_scraped?: string;
  success_rate?: number;
  total_recipes?: number;
}

export interface CrawlResult {
  website: Website;
  recipeUrls: string[];
  errors: string[];
  length: number; // Required by SitemapCrawler
  stats: {
    totalUrls: number;
    filteredUrls: number;
    errorCount: number;
    processingTimeMs: number;
  };
}

export interface ScrapeResult {
  success: boolean;
  recipe?: ParsedRecipeData;
  error?: string;
  url: string;
  timestamp: string;
  processing_time?: number;
}

export interface BatchResult {
  website: Website;
  results: ScrapeResult[];
  success_count: number;
  failure_count: number;
  success_rate: number;
  total_time: number;
  errors: string[];
}

// ===== STATISTICS TYPES =====

export interface BatchStatistics {
  totalWebsites: number;
  totalRecipesScraped: number;
  successfulScrapes: number;
  failedScrapes: number;
  averageProcessingTime: number;
  startTime: number;
  endTime: number;
}

export interface MediaStatistics {
  totalProcessed: number;
  successfulExtractions: number;
  failedExtractions: number;
  totalProcessingTime: number;
  averageProcessingTime: number;
}

// ===== VIDEO/OCR TYPES =====

export interface VideoOCROutput {
  extractedText: string;
  ingredients: string[];
  instructions: string[];
  isRecipeContent: boolean;
  confidence: number;
  processingTime: number;
  frameCount: number;
}

export interface OCRFrame {
  framePath: string;
  timestamp: number;
  hasText: boolean;
  confidence: number;
}

export interface OCRResult {
  text: string;
  confidence: number;
  timestamp: number;
  source: 'google' | 'tesseract';
}

// ===== SOCIAL MEDIA TYPES =====

export interface SocialMediaConfig {
  enableTranscription: boolean;
  enableAdvancedOCR: boolean;
  ocrFrameInterval: number;
  maxVideoLength: number;
  recipeDetectionThreshold: number;
}

export interface VideoMetadata {
  title?: string;
  description?: string;
  duration?: number;
  views?: number;
  likes?: number;
  author?: string;
  published_date?: string;
  tags?: string[];
}

export interface TranscriptionResult {
  text: string;
  confidence: number;
  segments: Array<{
    text: string;
    start: number;
    end: number;
  }>;
}

// ===== ENRICHMENT TYPES =====

export interface EnrichmentResult {
  nutrition?: NutritionInfo;
  health_score?: number;
  cooking_method?: CookingMethod;
  effort_level?: string;
  cuisine_type?: string;
  meal_types?: string[];
  dietary_restrictions?: string[];
  embedding?: number[];
  quality_score?: number;
  processing_time?: number;
  errors?: string[];
}

export interface IngredientEnrichment {
  category: string;
  nutrition_per_100g?: Partial<NutritionInfo>;
  common_substitutes?: string[];
  storage_tips?: string[];
  preparation_methods?: string[];
}

export interface NutritionApiResponse {
  foods: Array<{
    food_name: string;
    serving_qty: number;
    serving_unit: string;
    nf_calories: number;
    nf_protein: number;
    nf_total_carbohydrate: number;
    nf_total_fat: number;
    nf_dietary_fiber: number;
    nf_sugars: number;
    nf_sodium: number;
  }>;
}

// ===== ERROR TYPES =====

export interface ProcessingError {
  code: string;
  message: string;
  details?: any;
  timestamp: string;
  source: string;
  recoverable: boolean;
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
  code: string;
}

// ===== CONFIGURATION TYPES =====

export interface ScrapingConfig {
  userAgent: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  concurrentRequests: number;
  respectRobotsTxt: boolean;
  rateLimitMs: number;
}

export interface EnrichmentConfig {
  enableNutritionEnrichment: boolean;
  enableHealthScoring: boolean;
  enableEmbeddings: boolean;
  enableAiEnhancement: boolean;
  nutritionApiKey?: string;
  openaiApiKey?: string;
  geminiApiKey?: string;
}

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
  maxConnections?: number;
  connectionTimeoutMillis?: number;
}

// ===== API TYPES =====

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

export interface PaginatedResponse<T = any> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
  command: string;
  fields?: any[];
}

export interface BulkInsertResult {
  successful: number;
  failed: number;
  errors: string[];
  total_time: number;
}

// ===== ZOD SCHEMAS FOR VALIDATION =====

// Enhanced validation patterns
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const URL_REGEX = /^https?:\/\/[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&\/=]*)$/;

export const RecipeIngredientSchema = z.object({
  text: z.string().min(1, "Ingredient text cannot be empty"),
  quantity: z.union([z.number(), z.array(z.number().min(0)).length(2)]).optional(),
  unit: z.string().optional(),
  name: z.string().min(1, "Clean ingredient name cannot be empty"),
  notes: z.string().optional(),
  category: z.string().optional(),
  grams: z.number().min(0).optional(),
  order_index: z.number().int().min(0),
});

export const InstructionStepSchema = z.object({
  step_number: z.number().int().positive(),
  text: z.string().min(1, "Instruction text cannot be empty"),
  action: z.string().nullable().optional(),
  timer_min: z.array(z.number().min(0)).max(2).default([]),
  temperature_f: z.number().min(32).max(500).nullable().optional(),
  equipment: z.array(z.string()).default([]),
  mentioned_ingredients: z.array(z.string()).default([]),
  tips: z.string().nullable().optional(),
});

export const NutritionSchema = z.object({
  calories: z.number().min(0).nullable().optional(),
  proteinG: z.number().min(0).nullable().optional(),
  carbohydratesG: z.number().min(0).nullable().optional(),
  fatG: z.number().min(0).nullable().optional(),
  saturatedFatG: z.number().min(0).nullable().optional(),
  fiberG: z.number().min(0).nullable().optional(),
  sugarG: z.number().min(0).nullable().optional(),
  sodiumMg: z.number().min(0).nullable().optional(),
  cholesterolMg: z.number().min(0).nullable().optional(),
  potassiumMg: z.number().min(0).nullable().optional(),
  calciumMg: z.number().min(0).nullable().optional(),
  ironMg: z.number().min(0).nullable().optional(),
  vitaminCMg: z.number().min(0).nullable().optional(),
  vitaminAIu: z.number().min(0).nullable().optional(),
});

export const DietaryRestrictionSchema = z.enum([
  'Gluten-Free', 'Dairy-Free', 'Lactose-Intolerant', 'Nut-Free', 'Peanut-Free',
  'Soy-Free', 'Egg-Free', 'Shellfish-Free', 'Fish-Free', 'Vegetarian', 'Vegan',
  'Pescatarian', 'Ketogenic', 'Paleo', 'Low Carb', 'Sugar-Free', 'Low Sodium',
  'Heart-Healthy', 'Kosher', 'Halal'
]);

export const RecipeSchema = z.object({
  title: z.string().min(1, { message: 'Title cannot be empty' }).max(200),
  description: z.string().max(1000).optional(),
  source_url: z.string().regex(URL_REGEX, { message: 'Invalid URL format' }),
  image_url: z.string().url().optional(),
  
  ingredients: z.array(RecipeIngredientSchema).min(1, { message: 'At least one ingredient is required' }),
  instructions: z.array(InstructionStepSchema).min(1, { message: 'At least one instruction is required' }),
  
  servings: z.union([z.number().int().positive(), z.string()]).optional(),
  prep_time_minutes: z.number().int().min(0).max(1440).optional(),
  cook_time_minutes: z.number().int().min(0).max(1440).optional(),
  total_time_minutes: z.number().int().min(0).max(1440).optional(),
  
  difficulty_level: z.string().optional(),
  cuisine_type: z.union([z.string(), z.array(z.string())]).optional(),
  meal_types: z.array(z.string()).optional(),
  dietary_restrictions: z.array(DietaryRestrictionSchema).optional(),
  tags: z.array(z.string()).optional(),
  
  nutrition: NutritionSchema.optional(),
  health_score: z.number().min(0).max(100).optional(),
  
  cooking_methods: z.array(z.string()).optional(),
  embedding: z.array(z.number()).optional(),
  
  author: z.string().optional(),
  publisher: z.string().optional(),
  published_date: z.string().optional(),
  
  quality_score: z.number().min(0).max(10).optional(),
  is_public: z.boolean().default(true),
});

// Export the inferred types
export type RecipeType = z.infer<typeof RecipeSchema>;
export type RecipeIngredientType = z.infer<typeof RecipeIngredientSchema>;
export type InstructionStepType = z.infer<typeof InstructionStepSchema>;
export type NutritionType = z.infer<typeof NutritionSchema>;
export type DietaryRestrictionType = z.infer<typeof DietaryRestrictionSchema>;

// ===== UTILITY TYPES =====

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

export type OptionalFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type NonEmptyArray<T> = [T, ...T[]];

export type StringKeyOf<T> = Extract<keyof T, string>;

export type ValueOf<T> = T[keyof T];

// ===== TYPE GUARDS =====

export function isValidRecipe(data: any): data is Recipe {
  try {
    RecipeSchema.parse(data);
    return true;
  } catch {
    return false;
  }
}

export function isValidUrl(value: any): value is string {
  return typeof value === 'string' && URL_REGEX.test(value);
}

export function isValidEmail(value: any): value is string {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return typeof value === 'string' && emailRegex.test(value);
}
