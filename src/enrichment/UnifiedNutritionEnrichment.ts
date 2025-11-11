/**
 * Unified Nutrition Enrichment Service
 *
 * Combines multiple nutrition APIs with intelligent fallback:
 * 1. USDA FoodData Central (primary)
 * 2. Edamam Nutrition API (fallback)
 * 3. Local nutrition database (final fallback)
 *
 * Ensures robust nutrition data retrieval with caching
 */

import { Recipe, NutritionInfo, RecipeIngredient } from '../shared/types.js';
import { processIngredient } from './ingredientParser.js';
import axios from 'axios';

// =============================================================================
// Configuration
// =============================================================================

const USDA_API_URL = 'https://api.nal.usda.gov/fdc/v1/foods/search';
const EDAMAM_NUTRITION_URL = 'https://api.edamam.com/api/nutrition-data';

const config = {
  usdaApiKey: process.env.USDA_API_KEY,
  edamamAppId: process.env.EDAMAM_APP_ID,
  edamamAppKey: process.env.EDAMAM_APP_KEY,
  cacheEnabled: true,
  cacheTTL: 1000 * 60 * 60 * 24, // 24 hours
  timeout: 10000,
  maxRetries: 2,
};

// =============================================================================
// Types
// =============================================================================

interface NutritionData {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber: number;
  sugar: number;
  sodium: number;
  cholesterol: number;
  saturatedFat: number;
  transFat?: number;
  calcium?: number;
  iron?: number;
  potassium?: number;
  vitaminA?: number;
  vitaminC?: number;
  vitaminD?: number;
}

interface IngredientWithGrams {
  name: string;
  grams: number;
  originalText: string;
}

// =============================================================================
// In-Memory Cache
// =============================================================================

const nutritionCache = new Map<string, { data: NutritionData; timestamp: number }>();

function getCachedNutrition(key: string): NutritionData | null {
  if (!config.cacheEnabled) return null;

  const cached = nutritionCache.get(key);
  if (!cached) return null;

  const age = Date.now() - cached.timestamp;
  if (age > config.cacheTTL) {
    nutritionCache.delete(key);
    return null;
  }

  return cached.data;
}

function setCachedNutrition(key: string, data: NutritionData): void {
  if (!config.cacheEnabled) return;
  nutritionCache.set(key, { data, timestamp: Date.now() });
}

// =============================================================================
// USDA FoodData Central Integration
// =============================================================================

async function getUSDANutrition(
  ingredientName: string,
  grams: number
): Promise<NutritionData | null> {
  if (!config.usdaApiKey) {
    console.warn('⚠️  USDA API key not configured');
    return null;
  }

  const cacheKey = `usda:${ingredientName}:${grams}`;
  const cached = getCachedNutrition(cacheKey);
  if (cached) {
    console.log(`✅ Cache hit for ${ingredientName} (USDA)`);
    return cached;
  }

  try {
    const url = `${USDA_API_URL}?query=${encodeURIComponent(ingredientName)}&dataType=Foundation,SR%20Legacy&pageSize=1&api_key=${config.usdaApiKey}`;

    const response = await axios.get(url, { timeout: config.timeout });
    const food = response.data.foods?.[0];

    if (!food || !food.foodNutrients) {
      console.log(`⚠️  No USDA data for: ${ingredientName}`);
      return null;
    }

    const getNutrient = (nutrientId: number): number => {
      const nutrient = food.foodNutrients.find((n: any) => n.nutrientId === nutrientId);
      // USDA data is per 100g, scale to actual weight
      return nutrient ? (nutrient.value / 100) * grams : 0;
    };

    const nutrition: NutritionData = {
      calories: getNutrient(1008),
      protein: getNutrient(1003),
      fat: getNutrient(1004),
      carbs: getNutrient(1005),
      fiber: getNutrient(1079),
      sugar: getNutrient(2000),
      sodium: getNutrient(1093),
      cholesterol: getNutrient(1253),
      saturatedFat: getNutrient(1258),
      transFat: getNutrient(1257),
      calcium: getNutrient(1087),
      iron: getNutrient(1089),
      potassium: getNutrient(1092),
      vitaminA: getNutrient(1106),
      vitaminC: getNutrient(1162),
      vitaminD: getNutrient(1114),
    };

    setCachedNutrition(cacheKey, nutrition);
    console.log(`✅ USDA nutrition for ${ingredientName}`);
    return nutrition;
  } catch (error: any) {
    console.error(`❌ USDA API error for ${ingredientName}:`, error.message);
    return null;
  }
}

// =============================================================================
// Edamam Nutrition API Integration
// =============================================================================

async function getEdamamNutrition(
  ingredientText: string,
  grams: number
): Promise<NutritionData | null> {
  if (!config.edamamAppId || !config.edamamAppKey) {
    console.warn('⚠️  Edamam API credentials not configured');
    return null;
  }

  const cacheKey = `edamam:${ingredientText}:${grams}`;
  const cached = getCachedNutrition(cacheKey);
  if (cached) {
    console.log(`✅ Cache hit for ${ingredientText} (Edamam)`);
    return cached;
  }

  try {
    // Edamam expects ingredient in format: "quantity unit ingredient"
    // e.g., "100g chicken breast"
    const formattedIngredient = `${grams}g ${ingredientText}`;

    const url = `${EDAMAM_NUTRITION_URL}?app_id=${config.edamamAppId}&app_key=${config.edamamAppKey}&ingr=${encodeURIComponent(formattedIngredient)}`;

    const response = await axios.get(url, { timeout: config.timeout });
    const data = response.data;

    if (!data || !data.totalNutrients) {
      console.log(`⚠️  No Edamam data for: ${ingredientText}`);
      return null;
    }

    const getNutrient = (code: string): number => {
      return data.totalNutrients[code]?.quantity || 0;
    };

    const nutrition: NutritionData = {
      calories: data.calories || 0,
      protein: getNutrient('PROCNT'),
      fat: getNutrient('FAT'),
      carbs: getNutrient('CHOCDF'),
      fiber: getNutrient('FIBTG'),
      sugar: getNutrient('SUGAR'),
      sodium: getNutrient('NA'),
      cholesterol: getNutrient('CHOLE'),
      saturatedFat: getNutrient('FASAT'),
      transFat: getNutrient('FATRN'),
      calcium: getNutrient('CA'),
      iron: getNutrient('FE'),
      potassium: getNutrient('K'),
      vitaminA: getNutrient('VITA_RAE'),
      vitaminC: getNutrient('VITC'),
      vitaminD: getNutrient('VITD'),
    };

    setCachedNutrition(cacheKey, nutrition);
    console.log(`✅ Edamam nutrition for ${ingredientText}`);
    return nutrition;
  } catch (error: any) {
    console.error(`❌ Edamam API error for ${ingredientText}:`, error.message);
    return null;
  }
}

// =============================================================================
// Local Nutrition Database (Fallback)
// =============================================================================

const localNutritionDB: Record<string, Partial<NutritionData>> = {
  // Common ingredients with approximate nutrition per 100g
  'chicken breast': { calories: 165, protein: 31, fat: 3.6, carbs: 0 },
  'ground beef': { calories: 250, protein: 26, fat: 17, carbs: 0 },
  'salmon': { calories: 208, protein: 20, fat: 13, carbs: 0 },
  'eggs': { calories: 155, protein: 13, fat: 11, carbs: 1.1 },
  'milk': { calories: 61, protein: 3.2, fat: 3.3, carbs: 4.8 },
  'rice': { calories: 130, protein: 2.7, fat: 0.3, carbs: 28 },
  'pasta': { calories: 131, protein: 5, fat: 1.1, carbs: 25 },
  'bread': { calories: 265, protein: 9, fat: 3.2, carbs: 49 },
  'butter': { calories: 717, protein: 0.9, fat: 81, carbs: 0.1 },
  'olive oil': { calories: 884, protein: 0, fat: 100, carbs: 0 },
  'sugar': { calories: 387, protein: 0, fat: 0, carbs: 100 },
  'flour': { calories: 364, protein: 10, fat: 1, carbs: 76 },
  'tomato': { calories: 18, protein: 0.9, fat: 0.2, carbs: 3.9 },
  'onion': { calories: 40, protein: 1.1, fat: 0.1, carbs: 9.3 },
  'garlic': { calories: 149, protein: 6.4, fat: 0.5, carbs: 33 },
  'potato': { calories: 77, protein: 2, fat: 0.1, carbs: 17 },
  'carrot': { calories: 41, protein: 0.9, fat: 0.2, carbs: 9.6 },
  'broccoli': { calories: 34, protein: 2.8, fat: 0.4, carbs: 7 },
  'spinach': { calories: 23, protein: 2.9, fat: 0.4, carbs: 3.6 },
  'cheese': { calories: 402, protein: 25, fat: 33, carbs: 1.3 },
};

function getLocalNutrition(
  ingredientName: string,
  grams: number
): NutritionData | null {
  const normalized = ingredientName.toLowerCase().trim();

  // Try exact match first
  let baseNutrition = localNutritionDB[normalized];

  // Try partial matches
  if (!baseNutrition) {
    for (const [key, value] of Object.entries(localNutritionDB)) {
      if (normalized.includes(key) || key.includes(normalized)) {
        baseNutrition = value;
        break;
      }
    }
  }

  if (!baseNutrition) {
    console.log(`⚠️  No local data for: ${ingredientName}`);
    return null;
  }

  // Scale from 100g to actual weight
  const scaleFactor = grams / 100;

  const nutrition: NutritionData = {
    calories: (baseNutrition.calories || 0) * scaleFactor,
    protein: (baseNutrition.protein || 0) * scaleFactor,
    fat: (baseNutrition.fat || 0) * scaleFactor,
    carbs: (baseNutrition.carbs || 0) * scaleFactor,
    fiber: (baseNutrition.fiber || 0) * scaleFactor,
    sugar: (baseNutrition.sugar || 0) * scaleFactor,
    sodium: (baseNutrition.sodium || 0) * scaleFactor,
    cholesterol: (baseNutrition.cholesterol || 0) * scaleFactor,
    saturatedFat: (baseNutrition.saturatedFat || 0) * scaleFactor,
  };

  console.log(`✅ Local nutrition estimate for ${ingredientName}`);
  return nutrition;
}

// =============================================================================
// Unified Nutrition Retrieval with Fallback Chain
// =============================================================================

async function getNutritionWithFallback(
  ingredient: IngredientWithGrams
): Promise<NutritionData | null> {
  console.log(`🔍 Fetching nutrition for: ${ingredient.name} (${ingredient.grams}g)`);

  // Try USDA first (most accurate)
  let nutrition = await getUSDANutrition(ingredient.name, ingredient.grams);
  if (nutrition) return nutrition;

  // Fall back to Edamam
  nutrition = await getEdamamNutrition(ingredient.originalText, ingredient.grams);
  if (nutrition) return nutrition;

  // Final fallback to local database
  nutrition = getLocalNutrition(ingredient.name, ingredient.grams);
  if (nutrition) return nutrition;

  console.warn(`⚠️  No nutrition data available for: ${ingredient.name}`);
  return null;
}

// =============================================================================
// Main Enrichment Function
// =============================================================================

export async function enrichRecipeWithNutrition(
  recipe: Recipe
): Promise<Recipe> {
  console.log(`\n🍽️  Enriching recipe with nutrition: ${recipe.title || 'Untitled'}`);

  if (!recipe.ingredients || recipe.ingredients.length === 0) {
    console.warn('⚠️  No ingredients to process');
    return recipe;
  }

  // Step 1: Process ingredients to extract weights
  console.log(`📋 Processing ${recipe.ingredients.length} ingredients...`);

  const processedIngredients: IngredientWithGrams[] = [];

  for (const ingredient of recipe.ingredients) {
    try {
      const processed = await processIngredient(ingredient);

      if (processed && processed.grams && processed.name) {
        processedIngredients.push({
          name: processed.name,
          grams: processed.grams,
          originalText: ingredient.text || ingredient.name,
        });
      }
    } catch (error) {
      console.error(`❌ Failed to process ingredient: ${ingredient.name}`, error);
    }
  }

  console.log(`✅ Processed ${processedIngredients.length}/${recipe.ingredients.length} ingredients`);

  // Step 2: Fetch nutrition for each ingredient with fallback
  const totals: NutritionData = {
    calories: 0,
    protein: 0,
    fat: 0,
    carbs: 0,
    fiber: 0,
    sugar: 0,
    sodium: 0,
    cholesterol: 0,
    saturatedFat: 0,
    transFat: 0,
    calcium: 0,
    iron: 0,
    potassium: 0,
    vitaminA: 0,
    vitaminC: 0,
    vitaminD: 0,
  };

  let successCount = 0;

  for (const ingredient of processedIngredients) {
    const nutrition = await getNutritionWithFallback(ingredient);

    if (nutrition) {
      successCount++;
      totals.calories += nutrition.calories;
      totals.protein += nutrition.protein;
      totals.fat += nutrition.fat;
      totals.carbs += nutrition.carbs;
      totals.fiber += nutrition.fiber;
      totals.sugar += nutrition.sugar;
      totals.sodium += nutrition.sodium;
      totals.cholesterol += nutrition.cholesterol;
      totals.saturatedFat += nutrition.saturatedFat;
      totals.transFat = (totals.transFat || 0) + (nutrition.transFat || 0);
      totals.calcium = (totals.calcium || 0) + (nutrition.calcium || 0);
      totals.iron = (totals.iron || 0) + (nutrition.iron || 0);
      totals.potassium = (totals.potassium || 0) + (nutrition.potassium || 0);
      totals.vitaminA = (totals.vitaminA || 0) + (nutrition.vitaminA || 0);
      totals.vitaminC = (totals.vitaminC || 0) + (nutrition.vitaminC || 0);
      totals.vitaminD = (totals.vitaminD || 0) + (nutrition.vitaminD || 0);
    }
  }

  console.log(`✅ Found nutrition data for ${successCount}/${processedIngredients.length} ingredients`);

  // Step 3: Calculate per-serving nutrition
  const servings = recipe.servings || 1;

  const nutrition: NutritionInfo = {
    calories: Math.round(totals.calories / servings),
    protein_g: Math.round(totals.protein / servings * 10) / 10,
    fat_g: Math.round(totals.fat / servings * 10) / 10,
    carbohydrates_g: Math.round(totals.carbs / servings * 10) / 10,
    fiber_g: Math.round(totals.fiber / servings * 10) / 10,
    sugar_g: Math.round(totals.sugar / servings * 10) / 10,
    sodium_mg: Math.round(totals.sodium / servings * 10) / 10,
    cholesterol_mg: Math.round(totals.cholesterol / servings * 10) / 10,
    calcium_mg: Math.round((totals.calcium || 0) / servings * 10) / 10,
    iron_mg: Math.round((totals.iron || 0) / servings * 10) / 10,
    potassium_mg: Math.round((totals.potassium || 0) / servings * 10) / 10,
    vitamin_a_iu: Math.round((totals.vitaminA || 0) / servings * 10) / 10,
    vitamin_c_mg: Math.round((totals.vitaminC || 0) / servings * 10) / 10,
  };

  console.log(`📊 Per serving (${servings} servings):`, {
    calories: nutrition.calories,
    protein: nutrition.protein_g,
    fat: nutrition.fat_g,
    carbs: nutrition.carbohydrates_g,
  });

  return {
    ...recipe,
    nutrition,
  };
}

// =============================================================================
// Cache Management
// =============================================================================

export function clearNutritionCache(): void {
  nutritionCache.clear();
  console.log('🗑️  Nutrition cache cleared');
}

export function getNutritionCacheStats(): { size: number; entries: string[] } {
  return {
    size: nutritionCache.size,
    entries: Array.from(nutritionCache.keys()).slice(0, 10),
  };
}

// =============================================================================
// Backward Compatibility Exports
// =============================================================================

/**
 * Backward compatibility: alias for enrichRecipeWithNutrition
 * @deprecated Use enrichRecipeWithNutrition instead
 */
export const getNutritionEnrichment = enrichRecipeWithNutrition;
