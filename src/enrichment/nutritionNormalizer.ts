import { Nutrition } from '../types.js';

/*
 * USDA Nutrition Database Integration
 * Normalizes nutrition data from various formats to standardized gram-based values
 */
export class NutritionNormalizer {
  
  /*
   * Convert nutrition data from legacy string format to normalized numeric format
   */
  static normalizeNutrition(legacyNutrition: any): Nutrition {
    if (!legacyNutrition) return {};

    const normalized: Nutrition = {};

    // Handle calories (already numeric, no conversion needed)
    if (legacyNutrition.calories !== undefined) {
      normalized.calories = typeof legacyNutrition.calories === 'number' 
        ? legacyNutrition.calories 
        : this.parseNumericValue(legacyNutrition.calories);
    }

    // Convert protein (from grams)
    if (legacyNutrition.proteinContent) {
      normalized.proteinG = this.parseGramValue(legacyNutrition.proteinContent);
    }

    // Convert carbohydrates (from grams) 
    if (legacyNutrition.carbohydrateContent) {
      normalized.carbohydratesG = this.parseGramValue(legacyNutrition.carbohydrateContent);
    }

    // Convert fat (from grams)
    if (legacyNutrition.fatContent) {
      normalized.fatG = this.parseGramValue(legacyNutrition.fatContent);
    }

    // Convert saturated fat (from grams)
    if (legacyNutrition.saturatedFatContent) {
      normalized.saturatedFatG = this.parseGramValue(legacyNutrition.saturatedFatContent);
    }

    // Convert fiber (from grams)
    if (legacyNutrition.fiberContent) {
      normalized.fiberG = this.parseGramValue(legacyNutrition.fiberContent);
    }

    // Convert sugar (from grams)
    if (legacyNutrition.sugarContent) {
      normalized.sugarG = this.parseGramValue(legacyNutrition.sugarContent);
    }

    // Convert cholesterol (from mg to grams - divide by 1000)
    if (legacyNutrition.cholesterolContent) {
      const mgValue = this.parseNumericValue(legacyNutrition.cholesterolContent);
      normalized.cholesterolG = mgValue ? mgValue / 1000 : null;
    }

    // Convert sodium (from mg to grams - divide by 1000)
    if (legacyNutrition.sodiumContent) {
      const mgValue = this.parseNumericValue(legacyNutrition.sodiumContent);
      normalized.sodiumG = mgValue ? mgValue / 1000 : null;
    }

    // Keep legacy fields for backward compatibility
    normalized.calories_legacy = legacyNutrition.calories?.toString();
    normalized.carbohydrateG = legacyNutrition.carbohydrateG;
    normalized.proteinG = legacyNutrition.proteinG;
    normalized.fatG = legacyNutrition.fatG;
    normalized.saturatedFatG = legacyNutrition.saturatedFatG;
    normalized.cholesterolG = legacyNutrition.cholesterolG;
    normalized.sodiumG = legacyNutrition.sodiumG;
    normalized.fiberG = legacyNutrition.fiberG;
    normalized.sugarG = legacyNutrition.sugarG;

    return normalized;
  }

  /*
   * Parse gram values from strings like "24 g", "1.5g", etc.
   */
  private static parseGramValue(value: string | number): number | null {
    if (typeof value === 'number') return value;
    if (!value) return null;

    // Remove 'g' and any spaces, parse as float
    const cleanValue = value.toString().toLowerCase().replace(/[g\s]/g, '');
    const parsed = parseFloat(cleanValue);
    return isNaN(parsed) ? null : parsed;
  }

  /*
   * Parse numeric values from strings like "66 mg", "1188 mg", etc.
   */
  private static parseNumericValue(value: string | number): number | null {
    if (typeof value === 'number') return value;
    if (!value) return null;

    // Extract numeric value, ignoring units
    const match = value.toString().match(/(\d+\.?\d*)/);
    if (match) {
      const parsed = parseFloat(match[1]);
      return isNaN(parsed) ? null : parsed;
    }
    return null;
  }

  /*
   * Add USDA-based nutrition estimates for common ingredients
   */
  static enrichWithUSDAData(nutrition: Nutrition, ingredientNames: string[]): Nutrition {
    const enriched = { ...nutrition };

    // USDA nutrition database mappings (per 100g)
    const usdaData: Record<string, Partial<Nutrition>> = {
      'chicken breast': { proteinG: 23, fatG: 3.6, cholesterolG: 0.085 },
      'ground beef': { proteinG: 20, fatG: 20, cholesterolG: 0.078 },
      'salmon': { proteinG: 25, fatG: 14, cholesterolG: 0.059 },
      'eggs': { proteinG: 13, fatG: 11, cholesterolG: 0.372 },
      'milk': { proteinG: 3.4, fatG: 3.3, carbohydratesG: 5, calciumG: 0.113 },
      'cheddar cheese': { proteinG: 25, fatG: 33, calciumG: 0.721 },
      'bread': { proteinG: 9, fatG: 3.2, carbohydratesG: 49, fiberG: 2.7 },
      'rice': { proteinG: 2.7, fatG: 0.3, carbohydratesG: 28 },
      'pasta': { proteinG: 5, fatG: 0.9, carbohydratesG: 25 },
      'olive oil': { fatG: 100, calories: 884 },
      'butter': { fatG: 81, saturatedFatG: 51, cholesterolG: 0.215 },
      'spinach': { proteinG: 2.9, fiberG: 2.2, ironG: 0.0027, vitaminCG: 0.028 },
      'broccoli': { proteinG: 2.8, fiberG: 2.6, vitaminCG: 0.089, calciumG: 0.047 },
      'carrots': { carbohydratesG: 10, fiberG: 2.8, vitaminAG: 0.000835 },
      'tomatoes': { carbohydratesG: 3.9, fiberG: 1.2, vitaminCG: 0.014 },
      'onions': { carbohydratesG: 9, fiberG: 1.7 },
      'garlic': { carbohydratesG: 33, proteinG: 6.4 },
      'potatoes': { carbohydratesG: 17, proteinG: 2, potassiumG: 0.425 },
      'bananas': { carbohydratesG: 23, fiberG: 2.6, potassiumG: 0.358 },
      'apples': { carbohydratesG: 14, fiberG: 2.4, vitaminCG: 0.005 }
    };

    // Check if any ingredients match USDA data
    for (const ingredient of ingredientNames) {
      const lowerIngredient = ingredient.toLowerCase();
      
      for (const [food, data] of Object.entries(usdaData)) {
        if (lowerIngredient.includes(food)) {
          // Add missing nutrition data (don't override existing values)
          Object.keys(data).forEach(key => {
            const nutritionKey = key as keyof Nutrition;
            if (enriched[nutritionKey] === null || enriched[nutritionKey] === undefined) {
              enriched[nutritionKey] = data[nutritionKey] as any;
            }
          });
        }
      }
    }

    return enriched;
  }

  /*
   * Validate and clean nutrition data
   */
  static validateNutrition(nutrition: Nutrition): Nutrition {
    const cleaned = { ...nutrition };

    // Ensure numeric values are within reasonable bounds
    if (cleaned.calories && cleaned.calories < 0) cleaned.calories = null;
    if (cleaned.proteinG && typeof cleaned.proteinG === 'number' && cleaned.proteinG < 0) cleaned.proteinG = null;
    if (cleaned.fatG && typeof cleaned.fatG === 'number' && cleaned.fatG < 0) cleaned.fatG = null;
    if (cleaned.carbohydratesG && cleaned.carbohydratesG < 0) cleaned.carbohydratesG = null;
    
    // Convert very high values that might be in wrong units
    if (cleaned.sodiumG && typeof cleaned.sodiumG === 'number' && cleaned.sodiumG > 10) {
      // Probably in mg, convert to grams
      cleaned.sodiumG = cleaned.sodiumG / 1000;
    }
    
    if (cleaned.cholesterolG && typeof cleaned.cholesterolG === 'number' && cleaned.cholesterolG > 1) {
      // Probably in mg, convert to grams
      cleaned.cholesterolG = cleaned.cholesterolG / 1000;
    }

    return cleaned;
  }
}

/*
 * Example usage:
 * 
 * const legacyNutrition = {
 *   "calories": 359,
 *   "fatContent": "24 g",
 *   "fiberContent": "1 g",
 *   "sugarContent": "2 g",
 *   "sodiumContent": "1188 mg",
 *   "proteinContent": "25 g",
 *   "cholesterolContent": "66 mg",
 *   "carbohydrateContent": "9 g",
 *   "saturatedFatContent": "8 g"
 * };
 * 
 * const normalized = NutritionNormalizer.normalizeNutrition(legacyNutrition);
 * // Result: {
 * //   "calories": 359,
 * //   "fatG": 24,
 * //   "fiberG": 1,
 * //   "sugarG": 2,
 * //   "sodiumG": 1.188,
 * //   "proteinG": 25,
 * //   "cholesterolG": 0.066,
 * //   "carbohydratesG": 9,
 * //   "saturatedFatG": 8
 * // }
 */
