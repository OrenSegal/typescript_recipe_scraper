/**
 * UNIFIED CONSTANTS
 * 
 * Single source of truth for all application constants
 * Following DRY, YAGNI, and KISS principles
 */

import { BatchScrapingConfig } from '@/services/BatchScrapingService.js';
import { MediaScrapingConfig } from '@/services/MediaScrapingService.js';
import { ScrapingConfig } from './types.js';

// ===== SCRAPING CONFIGURATION (YAGNI - Only essential config) =====

export const DEFAULT_SCRAPING_CONFIG: ScrapingConfig = {
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  timeout: 15000,
  retryAttempts: 3,
  retryDelay: 1000,
  concurrentRequests: 10,
  respectRobotsTxt: true,
  rateLimitMs: 500
};

export const DEFAULT_BATCH_CONFIG: BatchScrapingConfig = {
  maxConcurrency: 5,
  timeoutMs: 30000,
  retryAttempts: 3,
  progressReportInterval: 10, // Report progress every 10 processed items
  saveResults: true,
  batchSize: 50,
  enableHealthCheck: true,
  outputDirectory: './batch-results',
  logLevel: 'info'
};

export const DEFAULT_MEDIA_CONFIG: MediaScrapingConfig = {
  enableOCR: true,
  enableTranscription: true,
  maxVideoLength: 300, // 5 minutes
  frameExtractionInterval: 30,
  ocrConfidenceThreshold: 0.7,
  recipeContentThreshold: 0.5,
  saveResults: true,
  outputDirectory: './media-results',
  logLevel: 'info'
};

// ===== COOKING METHODS (KISS - Simple arrays) =====

export const COOKING_METHODS = [
  'Baking',
  'Roasting', 
  'Grilling',
  'Frying',
  'Steaming',
  'Boiling',
  'Slow Cooking',
  'No Cook',
  'Sautéing',
  'Braising',
  'Stewing',
  'Poaching',
  'Broiling'
] as const;

export const COOKING_ACTIONS = [
  'slice', 'mix', 'stir', 'whisk', 'beat', 'chop', 'dice', 'mince',
  'bake', 'roast', 'broil', 'grill', 'sauté', 'fry', 'pan-fry',
  'deep-fry', 'boil', 'steam', 'poach', 'simmer', 'braise', 'stew',
  'marinate', 'season', 'garnish', 'serve', 'chill', 'freeze',
  'thaw', 'drain', 'strain', 'blend', 'process', 'knead',
  'fold', 'combine', 'toss', 'coat', 'brush', 'sprinkle',
  'spread', 'layer', 'arrange', 'wrap', 'cover', 'uncover',
  'preheat', 'heat', 'warm', 'cool', 'rest'
] as const;

export const KITCHEN_EQUIPMENT = [
  'oven', 'stovetop', 'microwave', 'grill', 'slow cooker', 'pressure cooker',
  'air fryer', 'toaster oven', 'blender', 'food processor', 'mixer',
  'whisk', 'spatula', 'wooden spoon', 'ladle', 'tongs', 'strainer',
  'colander', 'cutting board', 'knife', 'measuring cups', 'measuring spoons',
  'mixing bowl', 'baking sheet', 'cake pan', 'loaf pan', 'muffin tin',
  'casserole dish', 'roasting pan', 'skillet', 'saucepan', 'stockpot',
  'dutch oven', 'wok', 'steamer', 'double boiler'
] as const;

// ===== INGREDIENT CATEGORIES (DRY - Single definition) =====

export const INGREDIENT_CATEGORIES = [
  'Pantry Staples',
  'Meat',
  'Poultry', 
  'Seafood',
  'Dairy',
  'Vegetables',
  'Fruits',
  'Grains',
  'Legumes',
  'Nuts & Seeds',
  'Herbs & Spices',
  'Oils & Fats',
  'Beverages',
  'Baking Essentials',
  'Condiments',
  'Frozen',
  'Canned',
  'Other'
] as const;

// ===== MEASUREMENT UNITS (Comprehensive list) =====

export const MEASUREMENT_UNITS = [
  // Volume - US
  'teaspoon', 'tsp', 'tablespoon', 'tbsp', 'fluid ounce', 'fl oz',
  'cup', 'pint', 'quart', 'gallon',
  
  // Volume - Metric
  'milliliter', 'ml', 'liter', 'l',
  
  // Weight - US
  'ounce', 'oz', 'pound', 'lb',
  
  // Weight - Metric
  'gram', 'g', 'kilogram', 'kg',
  
  // Count/Other
  'piece', 'pieces', 'slice', 'slices', 'clove', 'cloves',
  'head', 'bunch', 'sprig', 'sprigs', 'leaf', 'leaves',
  'pinch', 'dash', 'splash', 'handful', 'can', 'jar',
  'package', 'pkg', 'bottle'
] as const;

// ===== DIETARY RESTRICTIONS (Comprehensive) =====

export const DIETARY_RESTRICTIONS = [
  'Gluten-Free',
  'Dairy-Free', 
  'Lactose-Intolerant',
  'Nut-Free',
  'Peanut-Free',
  'Soy-Free',
  'Egg-Free',
  'Shellfish-Free',
  'Fish-Free',
  'Vegetarian',
  'Vegan',
  'Pescatarian',
  'Ketogenic',
  'Paleo',
  'Low Carb',
  'Sugar-Free',
  'Low Sodium',
  'Heart-Healthy',
  'Kosher',
  'Halal'
] as const;

// ===== MEAL TYPES =====

export const MEAL_TYPES = [
  'Breakfast',
  'Lunch', 
  'Dinner',
  'Snack',
  'Dessert',
  'Appetizer',
  'Side Dish',
  'Main Course',
  'Beverage',
  'Salad',
  'Soup',
  'Bread',
  'Sauce',
  'Marinade'
] as const;

// ===== CUISINE TYPES =====

export const CUISINE_TYPES = [
  'American',
  'Italian',
  'Mexican',
  'Chinese',
  'French',
  'Indian',
  'Japanese',
  'Thai',
  'Greek',
  'Spanish',
  'Mediterranean',
  'Middle Eastern',
  'Korean',
  'Vietnamese',
  'German',
  'British',
  'Russian',
  'Brazilian',
  'Moroccan',
  'Ethiopian',
  'International',
  'Fusion'
] as const;

// ===== TIME CONSTANTS (YAGNI - Only what's needed) =====

export const TIME_CONSTANTS = {
  MINUTE_MS: 60 * 1000,
  HOUR_MS: 60 * 60 * 1000,
  DAY_MS: 24 * 60 * 60 * 1000,
  DEFAULT_TIMEOUT: 30000,
  RATE_LIMIT_DELAY: 500,
  MAX_RETRIES: 3
} as const;

// ===== DATABASE CONSTANTS =====

export const DATABASE_CONSTANTS = {
  MAX_CONNECTIONS: 20,
  CONNECTION_TIMEOUT: 30000,
  QUERY_TIMEOUT: 60000,
  BATCH_SIZE: 100,
  MAX_BATCH_SIZE: 1000
} as const;

// ===== API CONSTANTS =====

export const API_CONSTANTS = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  DEFAULT_TIMEOUT: 30000,
  MAX_RETRIES: 3,
  RATE_LIMIT_WINDOW: 60000, // 1 minute
  RATE_LIMIT_MAX_REQUESTS: 100
} as const;

// ===== VALIDATION PATTERNS =====

export const VALIDATION_PATTERNS = {
  UUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  URL: /^https?:\/\/[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&\/=]*)$/,
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE: /^\+?[\d\s\-\(\)]{10,}$/,
  POSITIVE_NUMBER: /^\d*\.?\d+$/,
  FRACTION: /^\d+\/\d+$/,
  MIXED_NUMBER: /^\d+\s+\d+\/\d+$/
} as const;

// ===== ERROR CODES (SOLID - Single responsibility) =====

export const ERROR_CODES = {
  // Validation Errors
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  
  // Scraping Errors  
  SCRAPING_FAILED: 'SCRAPING_FAILED',
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  PARSING_ERROR: 'PARSING_ERROR',
  
  // Database Errors
  DATABASE_ERROR: 'DATABASE_ERROR',
  CONNECTION_FAILED: 'CONNECTION_FAILED',
  QUERY_FAILED: 'QUERY_FAILED',
  
  // Processing Errors
  PROCESSING_FAILED: 'PROCESSING_FAILED',
  ENRICHMENT_FAILED: 'ENRICHMENT_FAILED',
  
  // System Errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  EXTERNAL_API_ERROR: 'EXTERNAL_API_ERROR'
} as const;

// Export type definitions derived from constants for type safety
export type CookingMethod = typeof COOKING_METHODS[number];
export type CookingAction = typeof COOKING_ACTIONS[number]; 
export type KitchenEquipment = typeof KITCHEN_EQUIPMENT[number];
export type IngredientCategory = typeof INGREDIENT_CATEGORIES[number];
export type MeasurementUnit = typeof MEASUREMENT_UNITS[number];
export type DietaryRestriction = typeof DIETARY_RESTRICTIONS[number];
export type MealType = typeof MEAL_TYPES[number];
export type CuisineType = typeof CUISINE_TYPES[number];
export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];
