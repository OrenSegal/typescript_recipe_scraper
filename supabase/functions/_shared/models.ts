// supabase/functions/_shared/models.ts

/*
 * Represents nutritional information.
 * All properties are optional and can be null as they might not be available.
 */
export interface NutritionInformation {
  calories?: number | null;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
  sugars?: number | null;
  fiber?: number | null;
  sodium?: number | null;
  saturatedFat?: number | null;
  cholesterol?: number | null;
  transFat?: number | null;
}

/*
 * Represents a single instruction step for a recipe.
 * Aligns with the relational 'instructions' table schema.
 */
export interface Instruction {
  id: string;
  recipe_id: string;
  step_number: number;
  text: string;
}

/*

 * Represents an ingredient's usage within a specific recipe.
 * Aligns with the relational 'recipe_ingredients' table schema.
 */
export interface RecipeIngredient {
  id: string;
  recipe_id: string;
  ingredient_id: string; // Foreign key to the master 'ingredients' table
  display_text: string;  // The original text, e.g., "1 cup flour, sifted"
  name: string;          // The parsed clean name, e.g., "flour"
  quantity?: number | string | null;
  unit?: string | null;
  notes?: string | null;
}

/*
 * Represents a complete recipe object used throughout the application logic.
 * This is the single source of truth for the Recipe type.
 */
export interface Recipe {
  id: string;
  title: string;
  description?: string | null;
  sourceUrl: string; // Application-layer uses camelCase
  publisherWebsite?: string | null;
  author?: string | null;
  imageUrl?: string | null;
  servings?: number | null;
  yieldText?: string | null;
  prepTimeMinutes?: number | null;
  cookTimeMinutes?: number | null;
  totalTimeMinutes?: number | null;
  cookingMethod?: string | null;
  effortLevel?: number | null;
  healthScore?: number | null;
  cuisines?: string[];
  mealTypes?: string[];
  suitableForDiet?: string[];
  tags?: string[];
  notes?: string | null;
  isPublic?: boolean;
  publishDate?: string | null;
  embedding?: number[];
  createdBy?: string;
  
  // Relational data, populated during processing
  ingredients: RecipeIngredient[];
  instructions: Instruction[];
  nutrition?: NutritionInformation | null;
}