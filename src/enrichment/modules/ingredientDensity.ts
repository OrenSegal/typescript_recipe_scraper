/**
 * Ingredient Density Module
 *
 * Handles ingredient density lookups and calculations
 * Single Responsibility: Manage density data and conversions
 */

import { INGREDIENT_DENSITIES } from '../../shared/constants.js';

/**
 * Get density for an ingredient from the hierarchical INGREDIENT_DENSITIES structure
 * @param ingredient - The ingredient name
 * @returns Density in g/ml, or null if not found
 */
export function getDensityForIngredient(ingredient: string): number | null {
  const lowerIngredient = ingredient.toLowerCase();

  // Search through all density categories
  for (const categoryKey of Object.keys(INGREDIENT_DENSITIES)) {
    const category = INGREDIENT_DENSITIES[categoryKey as keyof typeof INGREDIENT_DENSITIES];
    for (const [item, density] of Object.entries(category)) {
      if (lowerIngredient.includes(item.toLowerCase())) {
        return density;
      }
    }
  }

  // Default density for water-based ingredients if no match found
  return 1.0;
}

/**
 * Get ingredient density with fallback logic
 * Enhanced version with more granular lookup
 * @param ingredient - The ingredient name
 * @returns Density in g/ml
 */
export function getIngredientDensity(ingredient: string): number {
  const lowerIngredient = ingredient.toLowerCase();

  // Comprehensive density mapping (organized by category for better maintainability)
  const densityMap: Record<string, number> = {
    // Liquids & Semi-liquids
    'water': 1.0,
    'milk': 1.03,
    'cream': 0.994,
    'heavy cream': 1.01,
    'oil': 0.92,
    'olive oil': 0.92,
    'vegetable oil': 0.92,
    'honey': 1.42,
    'maple syrup': 1.32,
    'molasses': 1.4,
    'corn syrup': 1.38,

    // Powders & Dry Goods
    'flour': 0.528,
    'all-purpose flour': 0.528,
    'bread flour': 0.545,
    'cake flour': 0.496,
    'sugar': 0.845,
    'brown sugar': 0.721,
    'powdered sugar': 0.560,
    'cocoa powder': 0.528,
    'baking powder': 0.912,
    'baking soda': 2.2,
    'salt': 2.16,
    'yeast': 0.768,

    // Grains & Cereals
    'rice': 0.753,
    'oats': 0.41,
    'quinoa': 0.753,

    // Nuts & Seeds
    'almonds': 0.641,
    'walnuts': 0.521,
    'pecans': 0.433,

    // Fats & Dairy
    'butter': 0.959,
    'margarine': 0.959,
    'cheese': 1.15,
    'yogurt': 1.04,
    'sour cream': 1.02,

    // Produce
    'tomato': 0.99,
    'onion': 0.96,
    'garlic': 1.05,
    'potato': 0.79,
  };

  // Exact match
  if (densityMap[lowerIngredient]) {
    return densityMap[lowerIngredient];
  }

  // Partial match
  for (const [key, density] of Object.entries(densityMap)) {
    if (lowerIngredient.includes(key)) {
      return density;
    }
  }

  // Use INGREDIENT_DENSITIES from constants as fallback
  const constantDensity = getDensityForIngredient(ingredient);
  if (constantDensity !== null && constantDensity !== 1.0) {
    return constantDensity;
  }

  // Default density (water)
  return 1.0;
}
