// src/models/Ingredient.ts

/*
 * Represents a single ingredient in a recipe.
 * Mirrors IngredientModel from Python.
 */
export interface Ingredient {
  normalizedNutrition: any;
  id: string; // Defaulted by factory in Python (uuid.uuid4())
  name: string;
  cleanName: string;
  quantity?: number | string | null; // Python model allows float or str
  unit?: string | null;
  notes?: string | null;
  category?: string; // Default "Other" in Python
  categoryGroup?: string; // Default "Other" in Python
  validationNotes?: string[]; // Default factory list in Python
}
