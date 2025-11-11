// src/models/Nutrition.ts

/*
 * Represents nutritional information for a recipe.
 * Mirrorks NutritionInformationModel from Python.
 */
export interface NutritionInformation {
  calories?: number | null;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
  sugars?: number | null;
  fiber?: number | null;
  sodium?: number | null;
  saturatedFat?: number | null; // Corresponds to saturated_fat (alias saturatedFat)
  cholesterol?: number | null;
  transFat?: number | null; // Corresponds to trans_fat (alias transFat)
}
