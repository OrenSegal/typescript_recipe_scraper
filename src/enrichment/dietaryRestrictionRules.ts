import { RecipeIngredient, InstructionStep, DietaryRestriction } from '../types.js';

/*
 * Comprehensive dietary restriction rules and filtering system
 */

// Ingredient-based restriction rules
const RESTRICTION_RULES: { [key in DietaryRestriction]: {
  forbidden: string[];
  allowed: string[];
  keywords: string[];
  instructionKeywords: string[];
}} = {
  'Vegetarian': {
    forbidden: [
      'beef', 'pork', 'chicken', 'turkey', 'duck', 'lamb', 'veal', 'venison',
      'fish', 'salmon', 'tuna', 'cod', 'shrimp', 'crab', 'lobster', 'clams',
      'mussels', 'oysters', 'scallops', 'anchovies', 'sardines', 'bacon',
      'ham', 'sausage', 'pepperoni', 'prosciutto', 'chorizo', 'ground beef',
      'ground turkey', 'ground chicken', 'meat', 'poultry', 'seafood',
      'gelatin', 'lard', 'tallow', 'chicken stock', 'beef stock', 'fish sauce',
      'worcestershire sauce', 'caesar dressing'
    ],
    allowed: [
      'vegetables', 'fruits', 'grains', 'legumes', 'nuts', 'seeds', 'dairy',
      'eggs', 'milk', 'cheese', 'yogurt', 'butter', 'cream', 'tofu', 'tempeh'
    ],
    keywords: ['vegetarian', 'veggie', 'meatless'],
    instructionKeywords: []
  },

  'Vegan': {
    forbidden: [
      'beef', 'pork', 'chicken', 'turkey', 'duck', 'lamb', 'veal', 'venison',
      'fish', 'salmon', 'tuna', 'cod', 'shrimp', 'crab', 'lobster', 'clams',
      'mussels', 'oysters', 'scallops', 'anchovies', 'sardines', 'bacon',
      'ham', 'sausage', 'pepperoni', 'prosciutto', 'chorizo', 'ground beef',
      'ground turkey', 'ground chicken', 'meat', 'poultry', 'seafood',
      'milk', 'cheese', 'yogurt', 'butter', 'cream', 'eggs', 'egg',
      'honey', 'gelatin', 'lard', 'tallow', 'whey', 'casein', 'lactose',
      'chicken stock', 'beef stock', 'fish sauce', 'worcestershire sauce',
      'caesar dressing', 'mayonnaise', 'ice cream'
    ],
    allowed: [
      'vegetables', 'fruits', 'grains', 'legumes', 'nuts', 'seeds',
      'tofu', 'tempeh', 'nutritional yeast', 'plant milk', 'coconut milk',
      'almond milk', 'soy milk', 'oat milk', 'vegan cheese', 'vegan butter'
    ],
    keywords: ['vegan', 'plant-based', 'dairy-free', 'egg-free'],
    instructionKeywords: []
  },

  'Gluten-Free': {
    forbidden: [
      'wheat', 'barley', 'rye', 'spelt', 'kamut', 'farro', 'bulgur',
      'semolina', 'durum', 'flour', 'bread', 'pasta', 'noodles',
      'crackers', 'cookies', 'cake', 'muffins', 'bagels', 'pizza dough',
      'breadcrumbs', 'panko', 'coating', 'batter', 'beer', 'ale',
      'malt', 'brewer\'s yeast', 'soy sauce', 'teriyaki sauce',
      'worcestershire sauce', 'some seasonings', 'some broths'
    ],
    allowed: [
      'rice', 'quinoa', 'corn', 'potatoes', 'sweet potatoes', 'beans',
      'lentils', 'chickpeas', 'nuts', 'seeds', 'fruits', 'vegetables',
      'meat', 'fish', 'poultry', 'dairy', 'eggs', 'gluten-free flour',
      'almond flour', 'coconut flour', 'rice flour', 'tapioca flour'
    ],
    keywords: ['gluten-free', 'gluten free', 'celiac', 'wheat-free'],
    instructionKeywords: []
  },

  'Dairy-Free': {
    forbidden: [
      'milk', 'cheese', 'yogurt', 'butter', 'cream', 'ice cream',
      'sour cream', 'cottage cheese', 'ricotta', 'mozzarella', 'cheddar',
      'parmesan', 'swiss', 'goat cheese', 'feta', 'cream cheese',
      'whey', 'casein', 'lactose', 'buttermilk', 'half and half',
      'heavy cream', 'light cream', 'condensed milk', 'evaporated milk'
    ],
    allowed: [
      'plant milk', 'almond milk', 'soy milk', 'oat milk', 'coconut milk',
      'rice milk', 'cashew milk', 'vegan cheese', 'vegan butter',
      'coconut cream', 'nutritional yeast'
    ],
    keywords: ['dairy-free', 'dairy free', 'lactose-free', 'non-dairy'],
    instructionKeywords: []
  },

  'Nut-Free': {
    forbidden: [
      'almonds', 'walnuts', 'pecans', 'cashews', 'pistachios', 'hazelnuts',
      'brazil nuts', 'macadamia nuts', 'pine nuts', 'chestnuts',
      'almond flour', 'almond milk', 'almond butter', 'peanut butter',
      'peanuts', 'peanut oil', 'tree nuts', 'nut butter', 'nutella',
      'marzipan', 'nougat', 'praline'
    ],
    allowed: [
      'seeds', 'sunflower seeds', 'pumpkin seeds', 'sesame seeds',
      'chia seeds', 'flax seeds', 'tahini', 'sunflower butter'
    ],
    keywords: ['nut-free', 'nut free', 'tree nut free'],
    instructionKeywords: []
  },

  'Egg-Free': {
    forbidden: [
      'eggs', 'egg', 'egg whites', 'egg yolks', 'whole eggs',
      'scrambled eggs', 'fried eggs', 'boiled eggs', 'poached eggs',
      'mayonnaise', 'aioli', 'hollandaise', 'caesar dressing',
      'custard', 'meringue', 'eggnog', 'quiche', 'frittata'
    ],
    allowed: [
      'flax eggs', 'chia eggs', 'applesauce', 'banana', 'aquafaba',
      'egg replacer', 'vegan mayonnaise'
    ],
    keywords: ['egg-free', 'egg free', 'no eggs'],
    instructionKeywords: []
  },

  'Soy-Free': {
    forbidden: [
      'soy sauce', 'tofu', 'tempeh', 'miso', 'edamame', 'soy milk',
      'soybean oil', 'soy protein', 'soy flour', 'tamari', 'shoyu',
      'teriyaki sauce', 'hoisin sauce', 'some vegetable oils'
    ],
    allowed: [
      'coconut aminos', 'liquid aminos', 'almond milk', 'oat milk',
      'rice milk', 'coconut milk', 'olive oil', 'avocado oil'
    ],
    keywords: ['soy-free', 'soy free', 'no soy'],
    instructionKeywords: []
  },

  'Shellfish-Free': {
    forbidden: [
      'shrimp', 'crab', 'lobster', 'crawfish', 'crayfish', 'clams',
      'mussels', 'oysters', 'scallops', 'abalone', 'sea urchin',
      'shellfish', 'crustaceans', 'mollusks', 'seafood mix'
    ],
    allowed: [
      'fish', 'salmon', 'tuna', 'cod', 'halibut', 'sea bass', 'trout'
    ],
    keywords: ['shellfish-free', 'shellfish free', 'no shellfish'],
    instructionKeywords: []
  },

  'Fish-Free': {
    forbidden: [
      'fish', 'salmon', 'tuna', 'cod', 'halibut', 'sea bass', 'trout',
      'mackerel', 'sardines', 'anchovies', 'herring', 'flounder',
      'sole', 'snapper', 'grouper', 'mahi mahi', 'swordfish',
      'fish sauce', 'worcestershire sauce', 'caesar dressing'
    ],
    allowed: [
      'meat', 'poultry', 'chicken', 'beef', 'pork', 'turkey'
    ],
    keywords: ['fish-free', 'fish free', 'no fish'],
    instructionKeywords: []
  },

  'Sugar-Free': {
    forbidden: [
      'sugar', 'brown sugar', 'white sugar', 'cane sugar', 'coconut sugar',
      'maple syrup', 'honey', 'agave', 'corn syrup', 'high fructose corn syrup',
      'molasses', 'caramel', 'candy', 'chocolate chips', 'frosting',
      'icing', 'jam', 'jelly', 'marmalade', 'sweet', 'dessert'
    ],
    allowed: [
      'stevia', 'erythritol', 'xylitol', 'monk fruit', 'sugar-free sweeteners',
      'fresh fruits', 'vegetables'
    ],
    keywords: ['sugar-free', 'sugar free', 'no sugar', 'unsweetened'],
    instructionKeywords: []
  },

  'Low Carb': {
    forbidden: [
      'bread', 'pasta', 'rice', 'noodles', 'flour', 'wheat', 'oats',
      'quinoa', 'barley', 'potatoes', 'sweet potatoes', 'corn',
      'sugar', 'honey', 'maple syrup', 'fruits', 'beans', 'lentils',
      'chickpeas', 'crackers', 'cookies', 'cake', 'muffins'
    ],
    allowed: [
      'meat', 'fish', 'poultry', 'eggs', 'cheese', 'nuts', 'seeds',
      'leafy greens', 'broccoli', 'cauliflower', 'zucchini', 'peppers',
      'avocado', 'olive oil', 'butter', 'coconut oil'
    ],
    keywords: ['low carb', 'low-carb', 'keto', 'ketogenic', 'atkins'],
    instructionKeywords: []
  },

  'Kosher': {
    forbidden: [
      'pork', 'ham', 'bacon', 'sausage', 'pepperoni', 'prosciutto',
      'shellfish', 'shrimp', 'crab', 'lobster', 'clams', 'mussels',
      'oysters', 'scallops', 'rabbit', 'game birds', 'mixing meat and dairy'
    ],
    allowed: [
      'beef', 'chicken', 'turkey', 'lamb', 'fish with scales',
      'salmon', 'tuna', 'cod', 'kosher certified products'
    ],
    keywords: ['kosher', 'kosher certified', 'pareve', 'fleishig', 'milchig'],
    instructionKeywords: ['separate meat and dairy', 'kosher preparation']
  },

  'Halal': {
    forbidden: [
      'pork', 'ham', 'bacon', 'sausage', 'pepperoni', 'prosciutto',
      'alcohol', 'wine', 'beer', 'rum', 'vodka', 'whiskey', 'brandy',
      'cooking wine', 'vanilla extract', 'gelatin', 'lard'
    ],
    allowed: [
      'halal certified meat', 'chicken', 'beef', 'lamb', 'fish',
      'vegetables', 'fruits', 'grains', 'dairy', 'eggs'
    ],
    keywords: ['halal', 'halal certified', 'islamic', 'muslim'],
    instructionKeywords: ['halal preparation', 'no alcohol']
  },

  'Lactose-Intolerant': {
    forbidden: [
      'milk', 'cheese', 'yogurt', 'butter', 'cream', 'ice cream',
      'lactose', 'whey', 'casein', 'buttermilk', 'condensed milk'
    ],
    allowed: [
      'lactose-free milk', 'plant milk', 'almond milk', 'soy milk',
      'oat milk', 'coconut milk', 'lactose-free cheese'
    ],
    keywords: ['lactose-free', 'lactose intolerant', 'dairy-free'],
    instructionKeywords: []
  },

  'Peanut-Free': {
    forbidden: [
      'peanuts', 'peanut butter', 'peanut oil', 'groundnuts',
      'arachis oil', 'mixed nuts', 'trail mix'
    ],
    allowed: [
      'tree nuts', 'almonds', 'walnuts', 'cashews', 'sunflower seeds',
      'sunflower butter', 'tahini'
    ],
    keywords: ['peanut-free', 'peanut free', 'no peanuts'],
    instructionKeywords: []
  },

  'Pescatarian': {
    forbidden: [
      'beef', 'pork', 'chicken', 'turkey', 'duck', 'lamb', 'veal',
      'bacon', 'ham', 'sausage', 'pepperoni', 'meat', 'poultry'
    ],
    allowed: [
      'fish', 'salmon', 'tuna', 'cod', 'shrimp', 'crab', 'lobster',
      'seafood', 'vegetables', 'fruits', 'dairy', 'eggs'
    ],
    keywords: ['pescatarian', 'fish only', 'no meat'],
    instructionKeywords: []
  },

  'Ketogenic': {
    forbidden: [
      'bread', 'pasta', 'rice', 'potatoes', 'sugar', 'honey',
      'fruits', 'beans', 'lentils', 'oats', 'quinoa', 'corn'
    ],
    allowed: [
      'meat', 'fish', 'eggs', 'cheese', 'butter', 'oils',
      'nuts', 'seeds', 'leafy greens', 'avocado'
    ],
    keywords: ['keto', 'ketogenic', 'low carb', 'high fat'],
    instructionKeywords: []
  },

  'Paleo': {
    forbidden: [
      'grains', 'legumes', 'dairy', 'processed foods', 'sugar',
      'bread', 'pasta', 'beans', 'lentils', 'peanuts'
    ],
    allowed: [
      'meat', 'fish', 'eggs', 'vegetables', 'fruits', 'nuts',
      'seeds', 'coconut oil', 'olive oil'
    ],
    keywords: ['paleo', 'paleolithic', 'caveman diet'],
    instructionKeywords: []
  },

  'Low Sodium': {
    forbidden: [
      'salt', 'soy sauce', 'fish sauce', 'processed foods',
      'canned foods', 'pickles', 'olives', 'bacon'
    ],
    allowed: [
      'fresh herbs', 'spices', 'lemon', 'vinegar', 'fresh foods',
      'low sodium alternatives'
    ],
    keywords: ['low sodium', 'no salt', 'heart healthy'],
    instructionKeywords: []
  },

  'Heart-Healthy': {
    forbidden: [
      'saturated fat', 'trans fat', 'high sodium', 'processed meats',
      'fried foods', 'butter', 'lard'
    ],
    allowed: [
      'lean proteins', 'fish', 'whole grains', 'fruits', 'vegetables',
      'olive oil', 'nuts', 'seeds'
    ],
    keywords: ['heart healthy', 'heart-healthy', 'low cholesterol'],
    instructionKeywords: []
  }
};

/*
 * Check if an ingredient violates a dietary restriction
 */
function ingredientViolatesRestriction(
  ingredient: RecipeIngredient,
  restriction: DietaryRestriction
): boolean {
  const rules = RESTRICTION_RULES[restriction];
  const ingredientText = (ingredient.name).toLowerCase();
  
  // Check forbidden ingredients
  return rules.forbidden.some(forbidden => 
    ingredientText.includes(forbidden.toLowerCase())
  );
}

/*
 * Check if instructions violate a dietary restriction
 */
function instructionsViolateRestriction(
  instructions: InstructionStep[],
  restriction: DietaryRestriction
): boolean {
  const rules = RESTRICTION_RULES[restriction];
  const instructionText = instructions.map(inst => inst.text).join(' ').toLowerCase();
  
  // Check forbidden instruction keywords
  return rules.instructionKeywords.some(keyword => 
    instructionText.includes(keyword.toLowerCase())
  );
}

/*
 * Check if recipe explicitly mentions being suitable for a restriction
 */
function recipeExplicitlyMentionsRestriction(
  title: string,
  description: string,
  tags: string[],
  restriction: DietaryRestriction
): boolean {
  const rules = RESTRICTION_RULES[restriction];
  const allText = (title + ' ' + description + ' ' + tags.join(' ')).toLowerCase();
  
  return rules.keywords.some(keyword => 
    allText.includes(keyword.toLowerCase())
  );
}

/*
 * Determine if a recipe is suitable for a dietary restriction
 */
export function isRecipeSuitableForRestriction(
  ingredients: RecipeIngredient[],
  instructions: InstructionStep[],
  title: string,
  description: string = '',
  tags: string[] = [],
  restriction: DietaryRestriction
): boolean {
  // If recipe explicitly mentions the restriction, it's likely suitable
  if (recipeExplicitlyMentionsRestriction(title, description, tags, restriction)) {
    return true;
  }
  
  // Check if any ingredients violate the restriction
  const hasViolatingIngredients = ingredients.some(ingredient => 
    ingredientViolatesRestriction(ingredient, restriction)
  );
  
  if (hasViolatingIngredients) {
    return false;
  }
  
  // Check if instructions violate the restriction
  const hasViolatingInstructions = instructionsViolateRestriction(instructions, restriction);
  
  if (hasViolatingInstructions) {
    return false;
  }
  
  return true;
}

/*
 * Get all dietary restrictions a recipe is suitable for
 */
export function getRecipeDietaryRestrictions(
  ingredients: RecipeIngredient[],
  instructions: InstructionStep[],
  title: string,
  description: string = '',
  tags: string[] = []
): DietaryRestriction[] {
  const suitableRestrictions: DietaryRestriction[] = [];
  
  // Check each restriction
  Object.keys(RESTRICTION_RULES).forEach(restriction => {
    const dietaryRestriction = restriction as DietaryRestriction;
    
    if (isRecipeSuitableForRestriction(
      ingredients,
      instructions,
      title,
      description,
      tags,
      dietaryRestriction
    )) {
      suitableRestrictions.push(dietaryRestriction);
    }
  });
  
  // Limit to maximum of 10 restrictions to comply with schema
  return suitableRestrictions.slice(0, 10);
}

/*
 * Get detailed analysis of why a recipe does/doesn't meet a restriction
 */
export function analyzeRecipeForRestriction(
  ingredients: RecipeIngredient[],
  instructions: InstructionStep[],
  title: string,
  description: string = '',
  tags: string[] = [],
  restriction: DietaryRestriction
): {
  suitable: boolean;
  violatingIngredients: string[];
  violatingInstructions: string[];
  explicitMention: boolean;
} {
  const rules = RESTRICTION_RULES[restriction];
  
  const violatingIngredients = ingredients
    .filter(ingredient => ingredientViolatesRestriction(ingredient, restriction))
    .map(ingredient => ingredient.name);
  
  const violatingInstructions = instructions
    .filter(instruction => 
      rules.instructionKeywords.some(keyword => 
        instruction.text.toLowerCase().includes(keyword.toLowerCase())
      )
    )
    .map(instruction => instruction.text);
  
  const explicitMention = recipeExplicitlyMentionsRestriction(title, description, tags, restriction);
  
  const suitable = violatingIngredients.length === 0 && 
                  violatingInstructions.length === 0;
  
  return {
    suitable,
    violatingIngredients,
    violatingInstructions,
    explicitMention
  };
}
