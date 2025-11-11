import { z } from 'zod';

// Import the standardized parsing schemas
import { 
  IngredientSchema as ParsedIngredientSchema,
  InstructionSchema as ParsedInstructionSchema,
  IngredientCategory,
  MeasurementUnit,
  CookingAction,
  KitchenEquipment
} from '../recipe-parsing-specification.js';

// Enhanced validation patterns
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const URL_REGEX = /^https?:\/\/[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&\/=]*)$/;

// Schema for a single ingredient within a recipe.
// Extended to include the parsed specification fields
export const RecipeIngredientSchema = z.object({
  text: z.string().min(1, "Ingredient text cannot be empty"), // Original raw scraped string
  quantity: z.union([z.number(), z.array(z.number().min(0)).length(2)]).optional(), // Support ranges like [1, 1.5]
  unit: z.string().optional(),
  name: z.string().min(1, "Clean ingredient name cannot be empty"), // Non-branded product name
  notes: z.string().optional(), // Preparation notes, quality descriptors
  category: IngredientCategory.optional(), // Standardized ingredient category
  grams: z.number().min(0).optional(), // For nutrition calculations
  order_index: z.number().int().min(0), // Order index for sorting
  // Note: density_g_ml and substitutes moved to ingredients table as metadata
});
export type RecipeIngredient = z.infer<typeof RecipeIngredientSchema>;

// Schema for a single instruction step - aligned with parsing specification
export const InstructionStepSchema = z.object({
  step_number: z.number().int().positive(),
  text: z.string().min(1, "Instruction text cannot be empty"),
  action: CookingAction.nullable().default(null), // Primary cooking action
  timer_min: z.array(z.number().min(0)).max(2).default([]), // Time range in minutes [min, max]
  temperature_f: z.number().min(32).max(500).nullable().optional(), // Temperature in Fahrenheit
  equipment: z.array(z.string()).default([]), // Kitchen equipment mentioned
  mentioned_ingredients: z.array(z.string()).default([]), // Ingredients referenced

  tips: z.string().nullable().optional(), // Additional tips or notes
});
export type InstructionStep = z.infer<typeof InstructionStepSchema>;

// Schema for the nutrition information. All values are per serving in grams.
export const NutritionSchema = z.object({
  calories: z.number().min(0).nullable().optional(), // kcal (unchanged)
  proteinG: z.number().min(0).nullable().optional(),
  carbohydratesG: z.number().min(0).nullable().optional(),
  fatG: z.number().min(0).nullable().optional(),
  saturatedFatG: z.number().min(0).nullable().optional(),
  transFatG: z.number().min(0).nullable().optional(),
  cholesterolG: z.number().min(0).nullable().optional(), // converted from mg
  sodiumG: z.number().min(0).nullable().optional(), // converted from mg
  fiberG: z.number().min(0).nullable().optional(),
  sugarG: z.number().min(0).nullable().optional(),
  addedSugarG: z.number().min(0).nullable().optional(),
  vitaminAG: z.number().min(0).nullable().optional(), // converted from mcg
  vitaminCG: z.number().min(0).nullable().optional(), // converted from mg
  calciumG: z.number().min(0).nullable().optional(), // converted from mg
  ironG: z.number().min(0).nullable().optional(), // converted from mg
  potassiumG: z.number().min(0).nullable().optional(), // converted from mg
  // Legacy string fields for backward compatibility
  calories_legacy: z.string().optional(),
  carbohydrateG: z.string().optional(),
});
export type Nutrition = z.infer<typeof NutritionSchema>;

// The main Recipe schema for validation before database insertion
// Define dietary restrictions as Zod enum for validation
export const DietaryRestrictionSchema = z.enum([
  // Common Allergies/Intolerances
  'Gluten-Free',
  'Dairy-Free',
  'Lactose-Intolerant',
  'Nut-Free',
  'Peanut-Free',
  'Soy-Free',
  'Egg-Free',
  'Shellfish-Free',
  'Fish-Free',

  // Common Diets
  'Vegetarian',
  'Vegan',
  'Pescatarian',
  'Ketogenic',
  'Paleo',
  'Low Carb',

  // Health/Preference Based
  'Sugar-Free',
  'Low Sodium',
  'Heart-Healthy',

  // Religious/Cultural
  'Kosher',
  'Halal',
]);
export type DietaryRestriction = z.infer<typeof DietaryRestrictionSchema>;

// Comprehensive Recipe schema with all required fields
export const RecipeSchema = z.object({
  // Basic Information
  title: z.string().min(1, { message: 'Title cannot be empty' }).max(200),
  description: z.string().max(1000).optional().nullable(),
  source_url: z.string().regex(URL_REGEX, "Invalid URL format"),
  image_url: z.string().url("Invalid image URL format").optional().nullable().or(z.literal('')),
  
  // Timing and Servings
  servings: z.union([z.number().int().min(1).max(50), z.string().min(1).max(50)]).optional().nullable(),
  prep_time_minutes: z.number().int().min(0).max(1440).optional().nullable(), // Max 24 hours
  cook_time_minutes: z.number().int().min(0).max(1440).optional().nullable(),
  total_time_minutes: z.number().int().min(0).max(2880).optional().nullable(), // Max 48 hours
  
  // Recipe Content
  ingredients: z.array(RecipeIngredientSchema).min(1, { message: "Recipe must have at least one ingredient." }).max(50),
  instructions: z.array(InstructionStepSchema).min(1, { message: "Recipe must have at least one instruction." }).max(100),
  nutrition: NutritionSchema.optional().nullable(),
  
  // Classification and Metadata
  cuisines: z.array(z.string().min(1).max(50)).max(5).default([]),
  meal_types: z.array(z.string().min(1).max(30)).max(5).default([]),
  tags: z.array(z.string().min(1).max(30)).max(20).default([]),
  
  // Author and Source Information
  author: z.string().min(1).max(100).optional(),
  publisher_website: z.string().max(200).optional().nullable(),
  
  // Difficulty and Health Metrics
  effort_level: z.number().int().min(1).max(5).optional().nullable(),
  health_score: z.number().min(0).max(100).optional().nullable(),
  
  // Legacy compatibility fields
  dietary_restrictions: z.array(z.string()).optional().nullable(),
  
  // Cooking and Diet Information
  cooking_method: z.array(z.string().min(1).max(30)).max(5).default([]),
  suitable_for_diet: z.array(DietaryRestrictionSchema).max(18).default([]),
  
  // System Fields
  created_by: z.string().regex(UUID_REGEX, "Invalid UUID format").optional().nullable(),
  is_public: z.boolean().default(true),
  
  // AI and Search Enhancement
  embedding: z.array(z.number()).max(3072).optional().nullable(), // OpenAI embedding dimension
  
  // Data Quality and Completeness Metrics
  completeness_score: z.number().min(0).max(100).optional().nullable(),
  parsing_confidence: z.number().min(0).max(100).optional().nullable(),
  
  // Timestamps (handled by database)
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
  
  // Additional Metadata
  recipe_yield: z.string().max(50).optional().nullable(), // "4 servings", "1 loaf", etc.
  recipe_category: z.string().max(50).optional().nullable(), // "Main Course", "Dessert", etc.
  
  // Rating and Reviews (for future use)
  average_rating: z.number().min(0).max(5).optional().nullable(),
  review_count: z.number().int().min(0).optional().nullable(),

});
export type Recipe = z.infer<typeof RecipeSchema>;

export type RecipeWebsite = {
  testRecipeUrl?: string;
}

export { IngredientCategory };
