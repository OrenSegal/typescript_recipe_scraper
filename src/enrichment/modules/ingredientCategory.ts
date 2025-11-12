/**
 * Ingredient Categorization Module
 *
 * Handles ingredient category classification and validation
 * Single Responsibility: Categorize ingredients
 */

import { INGREDIENT_CATEGORIES } from '../../shared/constants.js';

/**
 * Valid ingredient categories (type-safe)
 */
export type IngredientCategory =
  | 'Pantry Staples'
  | 'Meat'
  | 'Poultry'
  | 'Seafood'
  | 'Dairy'
  | 'Vegetables'
  | 'Fruits'
  | 'Herbs & Spices'
  | 'Grains & Cereals'
  | 'Legumes'
  | 'Nuts & Seeds'
  | 'Oils & Fats'
  | 'Condiments & Sauces'
  | 'Beverages'
  | 'Baking Essentials'
  | 'Frozen Foods'
  | 'Canned Goods'
  | 'Other';

/**
 * Determine ingredient category using comprehensive database
 * @param cleanName - The cleaned ingredient name
 * @returns Category name
 */
export function categorizeIngredient(cleanName: string): string {
  const lowerName = cleanName.toLowerCase();

  // Priority categorization for specific ingredients that need precise classification
  const priorityCategories: Record<string, string> = {
    // Beverages
    'wine': 'Beverages',
    'white wine': 'Beverages',
    'red wine': 'Beverages',
    'beer': 'Beverages',
    'champagne': 'Beverages',

    // Baking Essentials
    'all-purpose flour': 'Baking Essentials',
    'bread flour': 'Baking Essentials',
    'cake flour': 'Baking Essentials',
    'self-rising flour': 'Baking Essentials',
    'baking powder': 'Baking Essentials',
    'baking soda': 'Baking Essentials',
    'vanilla extract': 'Baking Essentials'
  };

  // Check priority categories first
  for (const [ingredient, category] of Object.entries(priorityCategories)) {
    if (lowerName === ingredient || lowerName.includes(ingredient)) {
      return category;
    }
  }

  // Create a flat mapping from the hierarchical INGREDIENT_CATEGORIES structure
  const flatMapping: Record<string, string> = {};

  // Map proteins
  INGREDIENT_CATEGORIES.PROTEINS.MEAT.forEach(item => flatMapping[item] = 'Meat');
  INGREDIENT_CATEGORIES.PROTEINS.POULTRY.forEach(item => flatMapping[item] = 'Poultry');
  INGREDIENT_CATEGORIES.PROTEINS.SEAFOOD.forEach(item => flatMapping[item] = 'Seafood');

  // Map dairy
  INGREDIENT_CATEGORIES.DAIRY.forEach(item => flatMapping[item] = 'Dairy');

  // Map produce
  INGREDIENT_CATEGORIES.PRODUCE.VEGETABLES.forEach(item => flatMapping[item] = 'Vegetables');
  INGREDIENT_CATEGORIES.PRODUCE.FRUITS.forEach(item => flatMapping[item] = 'Fruits');
  INGREDIENT_CATEGORIES.PRODUCE.HERBS.forEach(item => flatMapping[item] = 'Herbs & Spices');

  // Map grains & legumes
  INGREDIENT_CATEGORIES.GRAINS_LEGUMES.GRAINS.forEach(item => flatMapping[item] = 'Grains & Cereals');
  INGREDIENT_CATEGORIES.GRAINS_LEGUMES.LEGUMES.forEach(item => flatMapping[item] = 'Legumes');

  // Map nuts & seeds
  INGREDIENT_CATEGORIES.NUTS_SEEDS.forEach(item => flatMapping[item] = 'Nuts & Seeds');

  // Map oils & fats
  INGREDIENT_CATEGORIES.OILS_FATS.forEach(item => flatMapping[item] = 'Oils & Fats');

  // Map pantry staples
  INGREDIENT_CATEGORIES.PANTRY.BAKING.forEach(item => flatMapping[item] = 'Baking Essentials');
  INGREDIENT_CATEGORIES.PANTRY.CONDIMENTS.forEach(item => flatMapping[item] = 'Condiments & Sauces');
  INGREDIENT_CATEGORIES.PANTRY.SPICES.forEach(item => flatMapping[item] = 'Herbs & Spices');
  INGREDIENT_CATEGORIES.PANTRY.CANNED.forEach(item => flatMapping[item] = 'Canned Goods');

  // Check exact match first
  if (flatMapping[lowerName]) {
    return flatMapping[lowerName];
  }

  // Check partial match
  for (const [ingredient, category] of Object.entries(flatMapping)) {
    if (lowerName.includes(ingredient.toLowerCase())) {
      return category;
    }
  }

  // Fallback to 'Other'
  return 'Other';
}

/**
 * Validate and normalize category name
 * @param category - Category to validate
 * @returns Valid category name
 */
export function validateCategory(category: string): IngredientCategory {
  const validCategories: IngredientCategory[] = [
    'Pantry Staples', 'Meat', 'Poultry', 'Seafood', 'Dairy',
    'Vegetables', 'Fruits', 'Herbs & Spices', 'Grains & Cereals',
    'Legumes', 'Nuts & Seeds', 'Oils & Fats', 'Condiments & Sauces',
    'Beverages', 'Baking Essentials', 'Frozen Foods', 'Canned Goods', 'Other'
  ];

  if (validCategories.includes(category as IngredientCategory)) {
    return category as IngredientCategory;
  }

  return 'Other';
}
