/**
 * Ingredient Unit Handling Module
 *
 * Handles unit normalization, extraction, and conversions
 * Single Responsibility: Manage units and mass calculations
 */

import Qty from 'js-quantities';
import { getDensityForIngredient, getIngredientDensity } from './ingredientDensity.js';

/**
 * Convert quantity to grams
 * @param quantity - Numeric quantity (or array of quantities)
 * @param unit - Unit of measurement
 * @param ingredient - Ingredient name for density lookup
 * @returns Mass in grams, or null if conversion fails
 */
export function getGrams(
  quantity: number | number[],
  unit: string | null,
  ingredient: string
): number | null {
  if (quantity === null || unit === null) return null;

  // Handle quantity arrays by using the first value (robust type handling)
  const quantityValue = Array.isArray(quantity) ? quantity[0] : quantity;

  // Type guard to ensure we have a valid number
  if (typeof quantityValue !== 'number' || !isFinite(quantityValue) || quantityValue <= 0) {
    return null;
  }

  try {
    const qty = Qty(quantityValue, unit);
    if (qty.kind() === 'mass') {
      return qty.to('g').scalar;
    }
    if (qty.kind() === 'volume') {
      const density = getDensityForIngredient(ingredient);
      return density ? qty.to('ml').scalar * density : null;
    }
    return null;
  } catch (e) {
    if (ingredient.toLowerCase().includes('egg') && typeof quantity === 'number') {
      return quantity * 50; // Approx. 50g per large egg
    }
    return null;
  }
}

/**
 * Calculate mass in grams from quantity, unit, and ingredient
 * Enhanced version with better error handling
 * @param quantity - Numeric quantity
 * @param unit - Unit of measurement
 * @param ingredient - Ingredient name
 * @returns Mass in grams, or null if conversion fails
 */
export function calculateGrams(
  quantity: number | number[] | null,
  unit: string | null,
  ingredient: string
): number | null {
  if (!quantity || quantity === null) return null;
  if (!unit || unit === null) return null;

  const qty = Array.isArray(quantity) ? quantity[0] : quantity;
  if (typeof qty !== 'number' || !isFinite(qty) || qty <= 0) return null;

  const normalizedUnit = normalizeUnit(unit);

  try {
    // Try using js-quantities for standard conversions
    const qtyObj = Qty(qty, normalizedUnit);

    // Direct mass conversion
    if (qtyObj.kind() === 'mass') {
      return qtyObj.to('g').scalar;
    }

    // Volume to mass conversion (requires density)
    if (qtyObj.kind() === 'volume') {
      const density = getIngredientDensity(ingredient);
      const volumeInMl = qtyObj.to('ml').scalar;
      return volumeInMl * density;
    }

    // Dimensionless or count-based (e.g., "2 eggs")
    return handleCountBasedQuantity(qty, normalizedUnit, ingredient);
  } catch (error) {
    // Fallback for non-standard units
    return handleNonStandardUnits(qty, normalizedUnit, ingredient);
  }
}

/**
 * Handle count-based quantities (e.g., "2 eggs")
 */
function handleCountBasedQuantity(
  quantity: number,
  unit: string,
  ingredient: string
): number | null {
  const lowerIngredient = ingredient.toLowerCase();
  const lowerUnit = unit.toLowerCase();

  // Common count-based ingredients with average weights
  const countWeights: Record<string, number> = {
    'egg': 50,
    'large egg': 50,
    'medium egg': 44,
    'small egg': 38,
    'clove': 3, // garlic clove
    'garlic clove': 3,
    'slice': 30, // bread slice
    'sheet': 3, // phyllo sheet
    'can': 400, // average can size
    'package': 200, // average package
  };

  // Check if it's a count-based unit
  if (lowerUnit === '' || lowerUnit === 'whole' || lowerUnit === 'piece') {
    for (const [item, weight] of Object.entries(countWeights)) {
      if (lowerIngredient.includes(item)) {
        return quantity * weight;
      }
    }
  }

  return null;
}

/**
 * Handle non-standard units (e.g., "pinch", "dash")
 */
function handleNonStandardUnits(
  quantity: number,
  unit: string,
  ingredient: string
): number | null {
  const lowerUnit = unit.toLowerCase();

  // Approximate conversions for non-standard units
  const approximateWeights: Record<string, number> = {
    'pinch': 0.3,
    'dash': 0.6,
    'smidgen': 0.15,
    'drop': 0.05,
    'handful': 40,
    'bunch': 100,
    'sprig': 5,
    'leaf': 2,
    'clove': 3,
  };

  if (approximateWeights[lowerUnit]) {
    return quantity * approximateWeights[lowerUnit];
  }

  return null;
}

/**
 * Normalize unit names to standard formats
 * @param unit - Raw unit string
 * @returns Normalized unit string
 */
export function normalizeUnit(unit: string): string {
  if (!unit) return '';

  const normalized = unit.toLowerCase().trim();

  // Map common variations to standard forms
  const unitMap: Record<string, string> = {
    // Volume
    'cup': 'cup',
    'cups': 'cup',
    'c': 'cup',
    'tablespoon': 'tbsp',
    'tablespoons': 'tbsp',
    'tbsp': 'tbsp',
    'tbs': 'tbsp',
    'tb': 'tbsp',
    'teaspoon': 'tsp',
    'teaspoons': 'tsp',
    'tsp': 'tsp',
    'milliliter': 'ml',
    'milliliters': 'ml',
    'ml': 'ml',
    'liter': 'l',
    'liters': 'l',
    'l': 'l',
    'fluid ounce': 'fl oz',
    'fluid ounces': 'fl oz',
    'fl oz': 'fl oz',
    'floz': 'fl oz',
    'pint': 'pint',
    'pints': 'pint',
    'quart': 'quart',
    'quarts': 'quart',
    'gallon': 'gallon',
    'gallons': 'gallon',

    // Mass
    'gram': 'g',
    'grams': 'g',
    'g': 'g',
    'kilogram': 'kg',
    'kilograms': 'kg',
    'kg': 'kg',
    'ounce': 'oz',
    'ounces': 'oz',
    'oz': 'oz',
    'pound': 'lb',
    'pounds': 'lb',
    'lb': 'lb',
    'lbs': 'lb',

    // Count/Other
    'piece': '',
    'pieces': '',
    'whole': '',
    'clove': 'clove',
    'cloves': 'clove',
    'pinch': 'pinch',
    'pinches': 'pinch',
    'dash': 'dash',
    'dashes': 'dash',
  };

  return unitMap[normalized] || normalized;
}

/**
 * Extract unit from ingredient text
 * @param text - Raw ingredient text
 * @returns Extracted unit, or null if not found
 */
export function extractUnitFromText(text: string): string | null {
  const lowerText = text.toLowerCase();

  // Common unit patterns
  const unitPatterns = [
    /(\d+)\s*(cup|cups|c)\b/,
    /(\d+)\s*(tablespoon|tablespoons|tbsp|tbs|tb)\b/,
    /(\d+)\s*(teaspoon|teaspoons|tsp)\b/,
    /(\d+)\s*(gram|grams|g)\b/,
    /(\d+)\s*(kilogram|kilograms|kg)\b/,
    /(\d+)\s*(ounce|ounces|oz)\b/,
    /(\d+)\s*(pound|pounds|lb|lbs)\b/,
    /(\d+)\s*(ml|milliliter|milliliters)\b/,
    /(\d+)\s*(liter|liters|l)\b/,
    /(\d+)\s*(pinch|pinches)\b/,
    /(\d+)\s*(dash|dashes)\b/,
  ];

  for (const pattern of unitPatterns) {
    const match = lowerText.match(pattern);
    if (match) {
      return normalizeUnit(match[2]);
    }
  }

  return null;
}

/**
 * Extract explicit gram measurements from parenthetical notation
 * e.g., "(200g)" -> 200
 */
export function extractExplicitGrams(text: string): number | null {
  // Match patterns like (200g) or (200 g) or (200 grams)
  const gramMatch = text.match(/\((\d+)\s*(?:g|grams?)\)/i);
  if (gramMatch) {
    return parseFloat(gramMatch[1]);
  }
  return null;
}
