import { Ingredient } from './Ingredient.js';
import { Instruction } from './Instruction.js';
import { NutritionInformation } from './Nutrition.js';

/*
 * Represents a full recipe.
 * Mirrors RecipeModel from Python.
 * Note: Pydantic's HttpUrl is typed as string here. Validation would be runtime.
 */
export interface Recipe {
  meal_types: any;
  image_url: any;
  effort_level: number;
  total_time_minutes(total_time_minutes: any, length: number, length1: number): any;
  health_score: number;
  id: string; // Defaulted by factory in Python (uuid.uuid4())
  title: string;
  description?: string | null;
  sourceUrl: string; // Was AnyHttpUrl
  publisherWebsite?: string | null; // Was AnyHttpUrl
  imageUrl?: string | null; // Was AnyHttpUrl
  servings?: number | null;
  yieldText?: string | null; // e.g., "Makes 12 cookies"
  totalTimeMinutes?: number | null;
  prepTimeMinutes?: number | null;
  cookTimeMinutes?: number | null;
  cookingMethod?: string | null; // e.g., Bake, Fry, Roast
  ingredients: Ingredient[]; // In Python, List[Dict[str, Any]], but we use strong types
  instructions: Instruction[]; // In Python, List[Dict[str, Any]], but we use strong types
  cuisines?: string[]; // Default factory list in Python
  mealTypes?: string[]; // Default factory list in Python
  tags?: string[]; // Default factory list in Python
  suitableForDiet?: string[]; // Default factory list in Python
  effortLevel?: number; // Default 3, ge=1, le=5 in Python
  nutrition?: NutritionInformation | null; // NutritionInformationModel-like dict in Python
  notes?: string | null;
  createdBy?: string | null; // User ID
  isPublic?: boolean; // Default true in Python
  publishDate?: Date | null; // Publication date from source
  author?: string | null;
  healthScore?: number | null; // Default None, ge=0, le=100 in Python
  embedding?: number[] | null; // Vector embedding
  updatedAt?: Date; // Default factory "now()" in Python - will be handled by DB or service
  createdAt?: Date; // Default factory "now()" in Python - will be handled by DB or service
}

/*
 * Helper function to create a default empty recipe.
 * This can be used for initialization or testing.
 * Note: The Python model has a validator for total_time_minutes.
 * That logic would need to be implemented in the service layer in TypeScript if required.
 */
export function createDefaultRecipe(): Partial<Recipe> {
  return {
    id: '', // Typically generated on creation
    title: '',
    sourceUrl: '',
    ingredients: [],
    instructions: [],
    cuisines: [],
    mealTypes: [],
    tags: [],
    suitableForDiet: [],
    isPublic: true,
    effortLevel: 3,
    // `updatedAt` would be set by the database or service
  };
}
