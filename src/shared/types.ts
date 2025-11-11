/**
 * Production Type Definitions
 * 
 * Centralized type definitions following DRY principle
 * Single source of truth for all TypeScript interfaces and types
 */

import { CookingMethod, RecipeCategory, EffortLevel } from './constants.js';

// ===== CORE RECIPE TYPES =====
export interface Recipe {
  id?: string;
  title: string;
  description?: string;
  source_url: string;
  image_url?: string;
  
  // Content
  ingredients: RecipeIngredient[];
  instructions: InstructionStep[];
  
  // Metadata
  servings?: number;
  prep_time?: number; // minutes
  cook_time?: number; // minutes  
  total_time?: number; // minutes
  
  // Classification
  effort_level?: string;
  cuisine_type?: string;
  meal_types?: string[];
  dietary_restrictions?: string[];
  tags?: string[];
  
  // Nutritional information
  nutrition?: NutritionInfo;
  health_score?: number; // 0-100
  
  // Quality metrics
  data_completeness_score?: number; // 0-1
  parsing_confidence?: number; // 0-1
  
  // Enrichment
  cooking_method?: CookingMethod;
  embedding?: number[];
  
  // Metadata
  author?: string;
  publisher?: string;
  published_date?: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface RecipeIngredient {
  id?: string;
  recipe_id?: string;
  
  // Core data
  text: string;
  name: string;
  quantity?: number | number[]; // Support ranges like [1, 1.5]
  unit?: string;
  notes?: string;
  
  // Classification
  category?: string;
  brand?: string;
  
  // Nutritional data
  calories_per_unit?: number;
  weight_grams?: number;
  
  // Metadata
  order_index: number;
  is_optional?: boolean;
  substitutes?: string[];
}

export interface InstructionStep {
  id?: string;
  recipe_id?: string;
  
  // Core data
  step_number: number;
  instruction?: string;
  text: string;
  
  // Enhanced data
  cooking_method?: CookingMethod;
  cooking_time?: number; // minutes
  temperature?: number;
  temperature_unit?: 'F' | 'C';
  equipment?: string[];
  ingredients_referenced?: string[];
  
  // Media
  image_url?: string;
  video_url?: string;
  
  // Metadata
  estimated_time?: number; // minutes
  effort_level?: string;
  tips?: string | string[] | null; // Support multiple formats for compatibility
}

export interface NutritionInfo {
  serving_size?: string;
  servings_per_recipe?: number;
  
  // Macronutrients (support null for compatibility)
  calories?: number | null;
  protein_g?: number | null;
  carbohydrates_g?: number | null;
  fat_g?: number | null;
  fiber_g?: number | null;
  sugar_g?: number | null;
  
  // Micronutrients (support null for compatibility)
  sodium_mg?: number | null;
  cholesterol_mg?: number | null;
  potassium_mg?: number | null;
  calcium_mg?: number | null;
  iron_mg?: number | null;
  vitamin_c_mg?: number | null;
  vitamin_a_iu?: number | null;
  
  // Percentages (daily values)
  protein_percent?: number | null;
  fat_percent?: number | null;
  carbs_percent?: number | null;
  fiber_percent?: number | null;
  sodium_percent?: number | null;
}

// ===== SCRAPING TYPES =====
export interface RawScrapedRecipe {
  title: string;
  ingredients: string[];
  instructions: string[];
  source_url: string;
  image_url?: string;
  servings?: number; // integer
  prep_time?: number; // minutes (integer)
  cook_time?: number; // minutes (integer)
  total_time?: number; // minutes (integer)
  description?: string;
  author?: string;
  publisher?: string;
  published_date?: string;
  tags?: string[];
  nutrition?: NutritionInfo;
}

export interface ParsedRecipeData {
  title: string;
  ingredients: RecipeIngredient[];
  instructions: InstructionStep[];
  source_url: string;
  image_url?: string | null; // Support null for compatibility
  servings?: number | string | null; // Support null for compatibility
  
  // Support both property name formats for timing
  prep_time_minutes?: number | null; // Alternative property name
  cook_time_minutes?: number | null; // Alternative property name
  total_time_minutes?: number | null; // Alternative property name
  
  description?: string | null; // Support null for compatibility
  cuisines?: string | string[]; // Support both single string and array
  meal_types?: string[];
  effort_level?: string | number | null; // Support both string and number types
  author?: string;
  publisher?: string;
  published_date?: string;
  tags?: string[];
  nutrition?: NutritionInfo | null; // Support null for compatibility
  
  // Additional database compatibility fields
  created_by?: string | null;
  cooking_method?: string | string[]; // Support cooking methods
    
}

// ===== WEBSITE SCRAPING TYPES =====
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

// ===== OCR TYPES =====
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

// ===== DATABASE TYPES =====
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

// ===== UTILITY TYPES =====
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

export type OptionalFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type NonEmptyArray<T> = [T, ...T[]];

export type StringKeyOf<T> = Extract<keyof T, string>;

export type ValueOf<T> = T[keyof T];

// ===== BRAND TYPES FOR TYPE SAFETY =====
export type RecipeId = string & { __brand: 'RecipeId' };
export type WebsiteId = number & { __brand: 'WebsiteId' };
export type UserId = string & { __brand: 'UserId' };
export type Url = string & { __brand: 'Url' };
export type EmailAddress = string & { __brand: 'EmailAddress' };

// ===== DISCRIMINATED UNIONS =====
export type ProcessingStatus = 
  | { status: 'pending'; startedAt?: never; completedAt?: never; error?: never }
  | { status: 'processing'; startedAt: string; completedAt?: never; error?: never }
  | { status: 'completed'; startedAt: string; completedAt: string; error?: never }
  | { status: 'failed'; startedAt: string; completedAt: string; error: string };

export type EnrichmentStep =
  | { type: 'nutrition'; data: NutritionInfo }
  | { type: 'health_score'; data: { score: number; factors: string[] } }
  | { type: 'cooking_method'; data: { method: CookingMethod; confidence: number } }
  | { type: 'embedding'; data: { vector: number[]; model: string } };

// ===== FUNCTION TYPES =====
export type ScrapingFunction = (url: string) => Promise<RawScrapedRecipe | null>;
export type ParsingFunction = (raw: RawScrapedRecipe) => Promise<ParsedRecipeData>;
export type EnrichmentFunction = (recipe: ParsedRecipeData) => Promise<EnrichmentResult>;
export type ValidationFunction<T> = (data: T) => { isValid: boolean; errors: ValidationError[] };

// ===== EVENT TYPES =====
export interface ScrapingEvent {
  type: 'scraping_started' | 'scraping_completed' | 'scraping_failed';
  recipeUrl: string;
  timestamp: string;
  data?: any;
  error?: string;
}

export interface BatchEvent {
  type: 'batch_started' | 'batch_progress' | 'batch_completed' | 'batch_failed';
  batchId: string;
  website?: Website;
  progress?: number;
  timestamp: string;
  data?: any;
  error?: string;
}

// ===== EXPORT TYPE GUARDS =====
export function isValidRecipe(data: any): data is Recipe {
  return data && 
    typeof data.title === 'string' && 
    Array.isArray(data.ingredients) && 
    Array.isArray(data.instructions) &&
    typeof data.source_url === 'string';
}

export function isValidUrl(value: any): value is Url {
  return typeof value === 'string' && /^https?:\/\/.+/.test(value);
}

export function isValidEmail(value: any): value is EmailAddress {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
