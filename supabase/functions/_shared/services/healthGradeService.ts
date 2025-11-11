// supabase/functions/_shared/services/healthGradeService.ts
import { Recipe } from '../models.ts';

// Heuristic-based scoring
const BASE_SCORE = 75;
const MAX_SCORE = 100;
const MIN_SCORE = 0;

// Keywords for categorization and scoring
const UNHEALTHY_KEYWORDS = [
  'fried', 'deep fry', 'creamy', 'cheesy', 'heavy cream', 'mayonnaise', 'bacon', 
  'sausage', 'processed', 'shortening', 'margarine', 'high fructose corn syrup',
  'sugar', 'white flour', 'white bread', 'white rice', 'pork rinds', 'cured meat'
];

const HEALTHY_KEYWORDS = [
  'vegetable', 'fruit', 'salad', 'grilled', 'steamed', 'baked', 'roasted',
  'whole grain', 'whole wheat', 'brown rice', 'quinoa', 'oats', 'lean protein',
  'chicken breast', 'fish', 'salmon', 'tuna', 'beans', 'lentils', 'chickpeas',
  'nuts', 'seeds', 'avocado', 'olive oil', 'fresh herbs'
];

/*
 * Calculates a health score (0-100) for a recipe based on its ingredients and nutrition facts.
 * @param recipe The recipe object containing nutrition and ingredient data.
 * @returns The calculated health score.
 */
export async function calculateHealthScore(recipe: Recipe): Promise<number> {
  let score = BASE_SCORE;

  // 1. Score based on Nutrition Facts (if available)
  if (recipe.nutrition) {
    const nutrition = recipe.nutrition;
    const servings = recipe.servings || 1;

    // Penalty for high Saturated Fat (> 10g per serving)
    if (nutrition.saturatedFat && (nutrition.saturatedFat / servings) > 10) {
      score -= 15;
    }
    // Penalty for high Sugar (> 15g per serving)
    if (nutrition.sugars && (nutrition.sugars / servings) > 15) {
      score -= 15;
    }
    // Penalty for high Sodium (> 800mg per serving)
    if (nutrition.sodium && (nutrition.sodium / servings) > 800) {
      score -= 10;
    }
    // Bonus for high Fiber (> 5g per serving)
    if (nutrition.fiber && (nutrition.fiber / servings) > 5) {
      score += 10;
    }
    // Bonus for high Protein (> 20g per serving)
    if (nutrition.protein && (nutrition.protein / servings) > 20) {
      score += 5;
    }
  }

  // 2. Score based on Ingredient analysis
  const ingredientTexts = recipe.ingredients.map(ing => ing.display_text.toLowerCase());
  
  let unhealthyCount = 0;
  let healthyCount = 0;

  for (const text of ingredientTexts) {
    if (UNHEALTHY_KEYWORDS.some(kw => text.includes(kw))) {
      unhealthyCount++;
    }
    if (HEALTHY_KEYWORDS.some(kw => text.includes(kw))) {
      healthyCount++;
    }
  }

  // Adjust score based on the ratio of healthy/unhealthy ingredients
  const totalIngredients = ingredientTexts.length || 1;
  const unhealthyRatio = unhealthyCount / totalIngredients;
  const healthyRatio = healthyCount / totalIngredients;

  if (unhealthyRatio > 0.3) {
    score -= 15; // More than 30% unhealthy ingredients
  } else if (unhealthyRatio > 0.15) {
    score -= 7;
  }

  if (healthyRatio > 0.5) {
    score += 15; // More than 50% healthy ingredients
  } else if (healthyRatio > 0.25) {
    score += 7;
  }
  
  // 3. Score based on Cooking Method
  const method = recipe.cookingMethod?.toLowerCase() || '';
  if (method.includes('fry')) {
    score -= 20;
  } else if (['grill', 'steam', 'bake', 'roast'].includes(method)) {
    score += 10;
  }

  // Clamp the score between MIN and MAX values
  return Math.max(MIN_SCORE, Math.min(MAX_SCORE, Math.round(score)));
}