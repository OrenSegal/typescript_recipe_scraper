
import { Recipe, Nutrition, RecipeIngredient } from '../types.js';
import { processIngredient } from './ingredientParser.js';

const USDA_API_URL = 'https://api.nal.usda.gov/fdc/v1/foods/search';
const usdaApiKey = process.env.USDA_API_KEY;

// Type for the nutrition data returned for a single ingredient
interface IngredientNutrition {
    calories: number; protein: number; fat: number; carbs: number;
    fiber: number; sugar: number; sodium: number; cholesterol: number; saturatedFat: number;
}

async function getNutritionForIngredient(cleanName: string, grams: number): Promise<IngredientNutrition | null> {
    if (!usdaApiKey) return null;

    try {
        const response = await fetch(`${USDA_API_URL}?query=${encodeURIComponent(cleanName)}&dataType=Foundation,SR%20Legacy&pageSize=1&api_key=${usdaApiKey}`);
        const data: any = await response.json();
        const food = data.foods?.[0];

        if (!food || !food.foodNutrients) return null;

        const getNutrientValue = (nutrientId: number) => {
            const nutrient = food.foodNutrients.find((n: any) => n.nutrientId === nutrientId);
            // Nutrition data is per 100g, so we scale it by the ingredient's actual weight.
            return nutrient ? (nutrient.value / 100) * grams : 0;
        };

        return {
            calories: getNutrientValue(1008),
            protein: getNutrientValue(1003),
            fat: getNutrientValue(1004),
            carbs: getNutrientValue(1005),
            fiber: getNutrientValue(1079),
            sugar: getNutrientValue(2000), // Sugars, total including NLEA
            sodium: getNutrientValue(1093),
            cholesterol: getNutrientValue(1253),
            saturatedFat: getNutrientValue(1258),
        };
    } catch (error) {
        console.error(`Failed to fetch nutrition for ${cleanName}`, error);
        return null;
    }
}

export async function getNutritionEnrichment(recipe: { ingredients?: string[], servings?: number | null }): Promise<{ nutrition?: Nutrition; ingredients?: RecipeIngredient[] }> {
    if (!usdaApiKey || !recipe.ingredients) return {};

    const totals: IngredientNutrition = {
        calories: 0, protein: 0, fat: 0, carbs: 0, fiber: 0,
        sugar: 0, sodium: 0, cholesterol: 0, saturatedFat: 0
    };

    // First, process all ingredients to parse them and get their weight in grams
    const processedIngredients = await Promise.all(recipe.ingredients.map(async (ingredientText, index) => {
      const processed = await processIngredient({ name: ingredientText });
      if (processed) {
        processed.order_index = index;
      }
      return processed;
    }));

    const ingredientsForNutrition = processedIngredients
      .filter((ing): ing is RecipeIngredient => ing !== null)
      .map((ingredient) => {
        if (ingredient.grams && ingredient.name) {
            return { name: ingredient.name, grams: ingredient.grams };
        }
        return null;
      })
      .filter((ing): ing is { name: string; grams: number } => ing !== null);

    // Then, fetch nutrition for each processed ingredient
    for (const ingredient of ingredientsForNutrition) {
        const nutritionData = await getNutritionForIngredient(ingredient.name, ingredient.grams);
        if (nutritionData) {
            totals.calories += nutritionData.calories;
            totals.protein += nutritionData.protein;
            totals.fat += nutritionData.fat;
            totals.carbs += nutritionData.carbs;
            totals.fiber += nutritionData.fiber;
            totals.sugar += nutritionData.sugar;
            totals.sodium += nutritionData.sodium;
            totals.cholesterol += nutritionData.cholesterol;
            totals.saturatedFat += nutritionData.saturatedFat;
        }
    }

    const servings = recipe.servings || 1;
    const finalNutrition: Nutrition = {
        calories: Math.round(totals.calories / servings),
        proteinG: Math.round(totals.protein / servings),
        fatG: Math.round(totals.fat / servings),
        saturatedFatG: Math.round(totals.saturatedFat / servings),
        cholesterolG: Math.round(totals.cholesterol / servings),
        sodiumG: Math.round(totals.sodium / servings),
        carbohydratesG: Math.round(totals.carbs / servings),
        fiberG: Math.round(totals.fiber / servings),
        sugarG: Math.round(totals.sugar / servings),
    };

    return { nutrition: finalNutrition, ingredients: processedIngredients.filter((i): i is RecipeIngredient => i !== null) };
}