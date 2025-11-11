import type { DietaryRestriction } from '../types.js';

/*
 * Enhanced Diet Suitability Analysis System
 * Provides comprehensive dietary restriction analysis for recipes
 */

export interface IngredientDietaryFlags {
  vegan: boolean;
  vegetarian: boolean;
  gluten_free: boolean;
  dairy_free: boolean;
  lactose_free: boolean;
  nut_free: boolean;
  peanut_free: boolean;
  soy_free: boolean;
  egg_free: boolean;
  shellfish_free: boolean;
  fish_free: boolean;
  keto_friendly: boolean;
  paleo_friendly: boolean;
  halal: boolean;
  kosher: boolean;
}

export interface RecipeNutritionData {
  calories?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
  sodium_mg?: number;
  sugar_g?: number;
  fiber_g?: number;
}

export interface EnrichedIngredientForDiet {
  name: string;
  dietary_flags?: IngredientDietaryFlags;
  category?: string;
}

export class EnhancedDietSuitabilityAnalyzer {
  
  /*
   * Comprehensive ingredient categorization for dietary analysis
   */
  private static readonly INGREDIENT_CATEGORIES = {
    // Animal products
    meat: ['beef', 'pork', 'lamb', 'chicken', 'turkey', 'duck', 'bacon', 'ham', 'sausage', 'ground beef', 'ground turkey'],
    poultry: ['chicken', 'turkey', 'duck', 'goose', 'quail'],
    seafood: ['fish', 'salmon', 'tuna', 'cod', 'shrimp', 'crab', 'lobster', 'scallops', 'mussels', 'clams', 'oysters'],
    shellfish: ['shrimp', 'crab', 'lobster', 'scallops', 'mussels', 'clams', 'oysters', 'crawfish'],
    
    // Dairy products
    dairy: ['milk', 'cheese', 'butter', 'cream', 'yogurt', 'sour cream', 'cottage cheese', 'ricotta', 'mozzarella', 'cheddar', 'parmesan'],
    lactose_containing: ['milk', 'cream', 'ice cream', 'soft cheese', 'cottage cheese', 'ricotta'],
    
    // Allergens
    gluten_containing: ['wheat', 'flour', 'bread', 'pasta', 'couscous', 'barley', 'rye', 'bulgur', 'semolina', 'spelt'],
    nuts: ['almond', 'walnut', 'pecan', 'cashew', 'pistachio', 'hazelnut', 'brazil nut', 'macadamia'],
    peanuts: ['peanut', 'peanut butter', 'peanut oil'],
    soy: ['soy sauce', 'tofu', 'tempeh', 'soy milk', 'edamame', 'miso', 'soybean'],
    eggs: ['egg', 'eggs', 'egg white', 'egg yolk', 'mayonnaise'],
    
    // High carb foods (for keto analysis)
    high_carb: ['rice', 'pasta', 'bread', 'potato', 'sweet potato', 'quinoa', 'oats', 'corn', 'flour', 'sugar'],
    
    // High sugar foods
    high_sugar: ['sugar', 'honey', 'maple syrup', 'corn syrup', 'molasses', 'agave', 'brown sugar', 'powdered sugar'],
    
    // Non-paleo foods
    non_paleo: ['grains', 'legumes', 'beans', 'lentils', 'peanuts', 'dairy', 'processed foods'],
    
    // Religious dietary restrictions
    non_halal: ['pork', 'bacon', 'ham', 'alcohol', 'wine', 'beer', 'gelatin'],
    non_kosher: ['pork', 'shellfish', 'shrimp', 'crab', 'lobster', 'oyster', 'clam', 'mussel', 'scallop', 'mixing meat and dairy']
  };

  /*
   * Analyze comprehensive diet suitability for a recipe
   */
  public static analyzeDietSuitability(
    ingredients: EnrichedIngredientForDiet[],
    nutrition?: RecipeNutritionData
  ): DietaryRestriction[] {
    const suitableFor: DietaryRestriction[] = [];
    
    // Analyze each dietary restriction
    if (this.isVegan(ingredients)) {
      suitableFor.push('Vegan');
    }
    
    if (this.isVegetarian(ingredients)) {
      suitableFor.push('Vegetarian');
    }
    
    if (this.isGlutenFree(ingredients)) {
      suitableFor.push('Gluten-Free');
    }
    
    if (this.isDairyFree(ingredients)) {
      suitableFor.push('Dairy-Free');
    }
    
    if (this.isLactoseFree(ingredients)) {
      suitableFor.push('Lactose-Intolerant');
    }
    
    if (this.isNutFree(ingredients)) {
      suitableFor.push('Nut-Free');
    }
    
    if (this.isPeanutFree(ingredients)) {
      suitableFor.push('Peanut-Free');
    }
    
    if (this.isSoyFree(ingredients)) {
      suitableFor.push('Soy-Free');
    }
    
    if (this.isEggFree(ingredients)) {
      suitableFor.push('Egg-Free');
    }
    
    if (this.isShellfishFree(ingredients)) {
      suitableFor.push('Shellfish-Free');
    }
    
    if (this.isFishFree(ingredients)) {
      suitableFor.push('Fish-Free');
    }
    
    if (this.isPescatarian(ingredients)) {
      suitableFor.push('Pescatarian');
    }
    
    if (this.isKetogenic(ingredients, nutrition)) {
      suitableFor.push('Ketogenic');
    }
    
    if (this.isPaleo(ingredients)) {
      suitableFor.push('Paleo');
    }
    
    if (this.isLowCarb(ingredients, nutrition)) {
      suitableFor.push('Low Carb');
    }
    
    if (this.isSugarFree(ingredients, nutrition)) {
      suitableFor.push('Sugar-Free');
    }
    
    if (this.isLowSodium(nutrition)) {
      suitableFor.push('Low Sodium');
    }
    
    if (this.isHeartHealthy(ingredients, nutrition)) {
      suitableFor.push('Heart-Healthy');
    }
    
    if (this.isKosher(ingredients)) {
      suitableFor.push('Kosher');
    }
    
    if (this.isHalal(ingredients)) {
      suitableFor.push('Halal');
    }
    
    return suitableFor;
  }

  /*
   * Check if recipe is vegan (no animal products)
   */
  private static isVegan(ingredients: EnrichedIngredientForDiet[]): boolean {
    return !this.containsAnyIngredient(ingredients, [
      ...this.INGREDIENT_CATEGORIES.meat,
      ...this.INGREDIENT_CATEGORIES.poultry,
      ...this.INGREDIENT_CATEGORIES.seafood,
      ...this.INGREDIENT_CATEGORIES.dairy,
      ...this.INGREDIENT_CATEGORIES.eggs,
      'honey', 'gelatin'
    ]);
  }

  /*
   * Check if recipe is vegetarian (no meat/fish, but allows dairy/eggs)
   */
  private static isVegetarian(ingredients: EnrichedIngredientForDiet[]): boolean {
    return !this.containsAnyIngredient(ingredients, [
      ...this.INGREDIENT_CATEGORIES.meat,
      ...this.INGREDIENT_CATEGORIES.poultry,
      ...this.INGREDIENT_CATEGORIES.seafood
    ]);
  }

  /*
   * Check if recipe is pescatarian (no meat/poultry, but allows fish)
   */
  private static isPescatarian(ingredients: EnrichedIngredientForDiet[]): boolean {
    return !this.containsAnyIngredient(ingredients, [
      ...this.INGREDIENT_CATEGORIES.meat,
      ...this.INGREDIENT_CATEGORIES.poultry
    ]);
  }

  /*
   * Check if recipe is gluten-free
   */
  private static isGlutenFree(ingredients: EnrichedIngredientForDiet[]): boolean {
    return !this.containsAnyIngredient(ingredients, this.INGREDIENT_CATEGORIES.gluten_containing);
  }

  /*
   * Check if recipe is dairy-free
   */
  private static isDairyFree(ingredients: EnrichedIngredientForDiet[]): boolean {
    return !this.containsAnyIngredient(ingredients, this.INGREDIENT_CATEGORIES.dairy);
  }

  /*
   * Check if recipe is lactose-free (stricter than dairy-free)
   */
  private static isLactoseFree(ingredients: EnrichedIngredientForDiet[]): boolean {
    return !this.containsAnyIngredient(ingredients, this.INGREDIENT_CATEGORIES.lactose_containing);
  }

  /*
   * Check if recipe is nut-free
   */
  private static isNutFree(ingredients: EnrichedIngredientForDiet[]): boolean {
    return !this.containsAnyIngredient(ingredients, this.INGREDIENT_CATEGORIES.nuts);
  }

  /*
   * Check if recipe is peanut-free
   */
  private static isPeanutFree(ingredients: EnrichedIngredientForDiet[]): boolean {
    return !this.containsAnyIngredient(ingredients, this.INGREDIENT_CATEGORIES.peanuts);
  }

  /*
   * Check if recipe is soy-free
   */
  private static isSoyFree(ingredients: EnrichedIngredientForDiet[]): boolean {
    return !this.containsAnyIngredient(ingredients, this.INGREDIENT_CATEGORIES.soy);
  }

  /*
   * Check if recipe is egg-free
   */
  private static isEggFree(ingredients: EnrichedIngredientForDiet[]): boolean {
    return !this.containsAnyIngredient(ingredients, this.INGREDIENT_CATEGORIES.eggs);
  }

  /*
   * Check if recipe is shellfish-free
   */
  private static isShellfishFree(ingredients: EnrichedIngredientForDiet[]): boolean {
    return !this.containsAnyIngredient(ingredients, this.INGREDIENT_CATEGORIES.shellfish);
  }

  /*
   * Check if recipe is fish-free
   */
  private static isFishFree(ingredients: EnrichedIngredientForDiet[]): boolean {
    return !this.containsAnyIngredient(ingredients, this.INGREDIENT_CATEGORIES.seafood);
  }

  /*
   * Check if recipe is ketogenic (very low carb, high fat)
   */
  private static isKetogenic(ingredients: EnrichedIngredientForDiet[], nutrition?: RecipeNutritionData): boolean {
    // Check for high-carb ingredients
    if (this.containsAnyIngredient(ingredients, this.INGREDIENT_CATEGORIES.high_carb)) {
      return false;
    }
    
    // Check nutrition data if available
    if (nutrition && nutrition.carbs_g !== undefined) {
      return nutrition.carbs_g <= 20; // Typical keto limit
    }
    
    // If no nutrition data, be conservative
    return !this.containsAnyIngredient(ingredients, [
      ...this.INGREDIENT_CATEGORIES.high_carb,
      ...this.INGREDIENT_CATEGORIES.high_sugar
    ]);
  }

  /*
   * Check if recipe is paleo
   */
  private static isPaleo(ingredients: EnrichedIngredientForDiet[]): boolean {
    return !this.containsAnyIngredient(ingredients, [
      ...this.INGREDIENT_CATEGORIES.gluten_containing,
      ...this.INGREDIENT_CATEGORIES.dairy,
      ...this.INGREDIENT_CATEGORIES.soy,
      'beans', 'lentils', 'chickpeas', 'quinoa', 'rice', 'oats'
    ]);
  }

  /*
   * Check if recipe is low carb
   */
  private static isLowCarb(ingredients: EnrichedIngredientForDiet[], nutrition?: RecipeNutritionData): boolean {
    // Check nutrition data if available
    if (nutrition && nutrition.carbs_g !== undefined) {
      return nutrition.carbs_g <= 50; // Typical low-carb limit
    }
    
    // Check for major carb sources
    const majorCarbSources = ['rice', 'pasta', 'bread', 'potato', 'flour', 'sugar', 'quinoa'];
    return !this.containsAnyIngredient(ingredients, majorCarbSources);
  }

  /*
   * Check if recipe is sugar-free
   */
  private static isSugarFree(ingredients: EnrichedIngredientForDiet[], nutrition?: RecipeNutritionData): boolean {
    // Check nutrition data if available
    if (nutrition && nutrition.sugar_g !== undefined) {
      return nutrition.sugar_g <= 5; // Very low sugar
    }
    
    return !this.containsAnyIngredient(ingredients, this.INGREDIENT_CATEGORIES.high_sugar);
  }

  /*
   * Check if recipe is low sodium
   */
  private static isLowSodium(nutrition?: RecipeNutritionData): boolean {
    if (nutrition && nutrition.sodium_mg !== undefined) {
      return nutrition.sodium_mg <= 600; // Per serving
    }
    return false; // Can't determine without nutrition data
  }

  /*
   * Check if recipe is heart-healthy
   */
  private static isHeartHealthy(ingredients: EnrichedIngredientForDiet[], nutrition?: RecipeNutritionData): boolean {
    // Must be low sodium
    if (nutrition && nutrition.sodium_mg !== undefined && nutrition.sodium_mg > 600) {
      return false;
    }
    
    // Should not contain processed meats or high saturated fat items
    const unhealthyItems = ['bacon', 'sausage', 'processed meat', 'fried'];
    return !this.containsAnyIngredient(ingredients, unhealthyItems);
  }

  /*
   * Check if recipe is kosher
   */
  private static isKosher(ingredients: EnrichedIngredientForDiet[]): boolean {
    return !this.containsAnyIngredient(ingredients, this.INGREDIENT_CATEGORIES.non_kosher);
  }

  /*
   * Check if recipe is halal
   */
  private static isHalal(ingredients: EnrichedIngredientForDiet[]): boolean {
    return !this.containsAnyIngredient(ingredients, this.INGREDIENT_CATEGORIES.non_halal);
  }

  /*
   * Helper method to check if any ingredient contains specified items
   */
  private static containsAnyIngredient(ingredients: EnrichedIngredientForDiet[], searchItems: string[]): boolean {
    const allIngredientText = ingredients
      .map(ing => `${ing.name} ${ing.name}`.toLowerCase())
      .join(' ');
    
    return searchItems.some(item => 
      allIngredientText.includes(item.toLowerCase()) ||
      ingredients.some(ing => 
        ing.dietary_flags && this.checkDietaryFlags(ing.dietary_flags, item)
      )
    );
  }

  /*
   * Check dietary flags for specific restrictions
   */
  private static checkDietaryFlags(flags: IngredientDietaryFlags, restriction: string): boolean {
    switch (restriction) {
      case 'meat':
      case 'poultry':
      case 'seafood':
        return !flags.vegan && !flags.vegetarian;
      case 'dairy':
        return !flags.dairy_free;
      case 'gluten':
        return !flags.gluten_free;
      case 'nuts':
        return !flags.nut_free;
      case 'soy':
        return !flags.soy_free;
      case 'eggs':
        return !flags.egg_free;
      default:
        return false;
    }
  }

  /*
   * Convert legacy boolean diet suitability to DietaryRestriction array
   */
  public static convertLegacyDietSuitability(legacySuitability: any): DietaryRestriction[] {
    const suitable: DietaryRestriction[] = [];
    
    if (legacySuitability.vegan) suitable.push('Vegan');
    if (legacySuitability.vegetarian) suitable.push('Vegetarian');
    if (legacySuitability.gluten_free) suitable.push('Gluten-Free');
    if (legacySuitability.dairy_free) suitable.push('Dairy-Free');
    if (legacySuitability.nut_free) suitable.push('Nut-Free');
    if (legacySuitability.keto_friendly) suitable.push('Ketogenic');
    if (legacySuitability.paleo_friendly) suitable.push('Paleo');
    if (legacySuitability.low_sodium) suitable.push('Low Sodium');
    if (legacySuitability.low_sugar) suitable.push('Sugar-Free');
    if (legacySuitability.kosher) suitable.push('Kosher');
    if (legacySuitability.halal) suitable.push('Halal');
    
    return suitable;
  }
}
