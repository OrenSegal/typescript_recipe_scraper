import { RecipeIngredient, Nutrition } from '../types.js';

/*
 * USDA FoodData Central API integration for accurate nutrition data
 */

const USDA_API_BASE = 'https://api.nal.usda.gov/fdc/v1';
const USDA_API_KEY = process.env.USDA_API_KEY; // User needs to get this from USDA

interface USDAFood {
  fdcId: number;
  description: string;
  foodNutrients: {
    nutrientId: number;
    nutrientName: string;
    value: number;
    unitName: string;
  }[];
}

interface NutrientMapping {
  [key: string]: number; // nutrientId -> value per 100g
}

// Common ingredient name mappings to USDA food descriptions
const INGREDIENT_MAPPINGS: { [key: string]: string } = {
  // Proteins
  'chicken breast': 'Chicken, broilers or fryers, breast, meat only, raw',
  'ground beef': 'Beef, ground, 80% lean meat / 20% fat, raw',
  'salmon': 'Fish, salmon, Atlantic, farmed, raw',
  'eggs': 'Egg, whole, raw, fresh',
  'egg': 'Egg, whole, raw, fresh',
  
  // Dairy
  'milk': 'Milk, reduced fat, fluid, 2% milkfat',
  'butter': 'Butter, salted',
  'cheese': 'Cheese, cheddar',
  'cream cheese': 'Cheese, cream',
  'yogurt': 'Yogurt, plain, whole milk',
  
  // Grains
  'flour': 'Wheat flour, white, all-purpose, enriched, bleached',
  'rice': 'Rice, white, long-grain, regular, raw, enriched',
  'pasta': 'Pasta, dry, enriched',
  'bread': 'Bread, white, commercially prepared',
  'oats': 'Cereals, oats, regular and quick, not fortified, dry',
  
  // Vegetables
  'onion': 'Onions, raw',
  'garlic': 'Garlic, raw',
  'tomato': 'Tomatoes, red, ripe, raw, year round average',
  'carrot': 'Carrots, raw',
  'potato': 'Potatoes, flesh and skin, raw',
  'bell pepper': 'Peppers, sweet, red, raw',
  'spinach': 'Spinach, raw',
  'broccoli': 'Broccoli, raw',
  
  // Fruits
  'apple': 'Apples, raw, with skin',
  'banana': 'Bananas, raw',
  'lemon': 'Lemons, raw, without peel',
  'orange': 'Oranges, raw, all commercial varieties',
  
  // Oils and fats
  'olive oil': 'Oil, olive, salad or cooking',
  'vegetable oil': 'Oil, soybean, salad or cooking',
  'coconut oil': 'Oil, coconut',
  
  // Seasonings
  'salt': 'Salt, table',
  'black pepper': 'Spices, pepper, black',
  'sugar': 'Sugars, granulated',
  'honey': 'Honey'
};

// USDA nutrient IDs for key nutrients
const NUTRIENT_IDS = {
  ENERGY: 1008, // kcal
  PROTEIN: 1003, // g
  FAT: 1004, // g
  CARBS: 1005, // g
  FIBER: 1079, // g
  SUGAR: 2000, // g
  SODIUM: 1093, // mg
  CHOLESTEROL: 1253, // mg
  SATURATED_FAT: 1258, // g
  CALCIUM: 1087, // mg
  IRON: 1089, // mg
  VITAMIN_C: 1162, // mg
  VITAMIN_A: 1106 // IU
};

/*
 * Search for food in USDA database
 */
async function searchUSDAFood(query: string): Promise<USDAFood | null> {
  if (!USDA_API_KEY) {
    console.warn('[USDA] API key not configured, skipping nutrition lookup');
    return null;
  }
  
  try {
    const searchUrl = `${USDA_API_BASE}/foods/search?query=${encodeURIComponent(query)}&api_key=${USDA_API_KEY}&pageSize=1`;
    const response = await fetch(searchUrl);
    
    if (!response.ok) {
      console.error(`[USDA] Search failed: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    
    if (data.foods && data.foods.length > 0) {
      const food = data.foods[0];
      
      // Get detailed nutrition data
      const detailUrl = `${USDA_API_BASE}/food/${food.fdcId}?api_key=${USDA_API_KEY}`;
      const detailResponse = await fetch(detailUrl);
      
      if (detailResponse.ok) {
        return await detailResponse.json();
      }
    }
    
    return null;
  } catch (error) {
    console.error('[USDA] API error:', error);
    return null;
  }
}

/*
 * Extract nutrition values from USDA food data
 */
function extractNutritionFromUSDA(food: USDAFood): NutrientMapping {
  const nutrients: NutrientMapping = {};
  
  food.foodNutrients.forEach(nutrient => {
    nutrients[nutrient.nutrientId] = nutrient.value;
  });
  
  return nutrients;
}

/*
 * Parse ingredient quantity and unit
 */
function parseIngredientQuantity(ingredient: RecipeIngredient): { amount: number; unit: string } {
  const text = ingredient.name.toLowerCase();
  
  // Common quantity patterns
  const patterns = [
    /(\d+(?:\.\d+)?)\s*(cups?|cup|c\b)/,
    /(\d+(?:\.\d+)?)\s*(tablespoons?|tbsp|tbs)/,
    /(\d+(?:\.\d+)?)\s*(teaspoons?|tsp|ts)/,
    /(\d+(?:\.\d+)?)\s*(pounds?|lbs?|lb\b)/,
    /(\d+(?:\.\d+)?)\s*(ounces?|ozs?|oz\b)/,
    /(\d+(?:\.\d+)?)\s*(grams?|g\b)/,
    /(\d+(?:\.\d+)?)\s*(kilograms?|kg\b)/,
    /(\d+(?:\.\d+)?)\s*(liters?|l\b)/,
    /(\d+(?:\.\d+)?)\s*(milliliters?|ml\b)/,
    /(\d+(?:\.\d+)?)\s*(pieces?|pcs?)/,
    /(\d+(?:\.\d+)?)\s*(cloves?)/,
    /(\d+(?:\.\d+)?)\s*(slices?)/
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return {
        amount: parseFloat(match[1]),
        unit: match[2]
      };
    }
  }
  
  // Default fallback
  return { amount: 1, unit: 'serving' };
}

/*
 * Convert units to grams for nutrition calculation
 */
function convertToGrams(amount: number, unit: string, ingredientType: string): number {
  const conversions: { [key: string]: number } = {
    // Volume to weight conversions (approximate)
    'cup': 240, // ml, varies by ingredient
    'c': 240,
    'tablespoon': 15,
    'tbsp': 15,
    'tbs': 15,
    'teaspoon': 5,
    'tsp': 5,
    'ts': 5,
    
    // Weight conversions
    'pound': 453.592,
    'lb': 453.592,
    'lbs': 453.592,
    'ounce': 28.3495,
    'oz': 28.3495,
    'gram': 1,
    'g': 1,
    'kilogram': 1000,
    'kg': 1000,
    
    // Liquid conversions
    'liter': 1000, // assuming 1g/ml density
    'l': 1000,
    'milliliter': 1,
    'ml': 1,
    
    // Piece conversions (very approximate)
    'piece': 100,
    'pcs': 100,
    'clove': 3, // garlic clove
    'slice': 25 // bread slice
  };
  
  // Ingredient-specific volume conversions
  const ingredientConversions: { [key: string]: { [unit: string]: number } } = {
    'flour': { 'cup': 120, 'c': 120 },
    'sugar': { 'cup': 200, 'c': 200 },
    'butter': { 'cup': 227, 'c': 227, 'tablespoon': 14, 'tbsp': 14 },
    'milk': { 'cup': 240, 'c': 240 },
    'water': { 'cup': 240, 'c': 240 },
    'oil': { 'cup': 218, 'c': 218, 'tablespoon': 13.6, 'tbsp': 13.6 }
  };
  
  // Check ingredient-specific conversions first
  if (ingredientConversions[ingredientType] && ingredientConversions[ingredientType][unit]) {
    return amount * ingredientConversions[ingredientType][unit];
  }
  
  // Use general conversions
  return amount * (conversions[unit] || 100); // Default 100g if unknown
}

/*
 * Get nutrition data for a single ingredient
 */
async function getIngredientNutrition(ingredient: RecipeIngredient): Promise<NutrientMapping | null> {
  const cleanName = ingredient.name.toLowerCase();
  
  // Try direct mapping first
  let searchTerm = INGREDIENT_MAPPINGS[cleanName];
  
  // If no direct mapping, use the clean name
  if (!searchTerm) {
    searchTerm = cleanName.replace(/[^\w\s]/g, '').trim();
  }
  
  const usdaFood = await searchUSDAFood(searchTerm);
  if (!usdaFood) {
    console.warn(`[USDA] No nutrition data found for: ${cleanName}`);
    return null;
  }
  
  return extractNutritionFromUSDA(usdaFood);
}

/*
 * Calculate total recipe nutrition from ingredients
 */
export async function calculateRecipeNutritionFromUSDA(
  ingredients: RecipeIngredient[],
  servings: number = 1
): Promise<Nutrition> {
  const totalNutrients: NutrientMapping = {};
  
  console.log(`[USDA] Calculating nutrition for ${ingredients.length} ingredients`);
  
  for (const ingredient of ingredients) {
    const nutrition = await getIngredientNutrition(ingredient);
    if (!nutrition) continue;
    
    const { amount, unit } = parseIngredientQuantity(ingredient);
    const gramsAmount = convertToGrams(amount, unit, ingredient.name);
    
    // Scale nutrition values based on actual amount (USDA values are per 100g)
    const scaleFactor = gramsAmount / 100;
    
    Object.entries(nutrition).forEach(([nutrientId, value]) => {
      const id = parseInt(nutrientId);
      totalNutrients[id] = (totalNutrients[id] || 0) + (value * scaleFactor);
    });
    
    console.log(`[USDA] Added nutrition for ${ingredient.name}: ${gramsAmount}g`);
  }
  
  // Convert to per-serving values
  const perServingNutrients: NutrientMapping = {};
  Object.entries(totalNutrients).forEach(([nutrientId, value]) => {
    perServingNutrients[parseInt(nutrientId)] = value / servings;
  });
  
  // Map to our Nutrition interface
  return {
    calories: Math.round(perServingNutrients[NUTRIENT_IDS.ENERGY] || 0),
    proteinG: Math.round(perServingNutrients[NUTRIENT_IDS.PROTEIN] || 0),
    fatG: Math.round(perServingNutrients[NUTRIENT_IDS.FAT] || 0),
    saturatedFatG: Math.round(perServingNutrients[NUTRIENT_IDS.SATURATED_FAT] || 0),
    carbohydratesG: Math.round(perServingNutrients[NUTRIENT_IDS.CARBS] || 0),
    fiberG: Math.round(perServingNutrients[NUTRIENT_IDS.FIBER] || 0),
    sugarG: Math.round(perServingNutrients[NUTRIENT_IDS.SUGAR] || 0),
    sodiumG: Math.round(perServingNutrients[NUTRIENT_IDS.SODIUM] || 0),
    cholesterolG: Math.round(perServingNutrients[NUTRIENT_IDS.CHOLESTEROL] || 0)
  };
}
