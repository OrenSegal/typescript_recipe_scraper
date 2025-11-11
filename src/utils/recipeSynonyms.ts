/**
 * Comprehensive Recipe Synonym Database
 * Maps recipe name variations to canonical forms
 */

export interface SynonymMapping {
  canonical: string;
  synonyms: string[];
}

/**
 * Main ingredients and their common variations
 */
export const INGREDIENT_SYNONYMS: Record<string, string[]> = {
  // Proteins
  'chicken': ['poultry', 'hen', 'fowl'],
  'beef': ['steak', 'ground beef', 'minced beef', 'hamburger'],
  'pork': ['pig', 'ham', 'bacon'],
  'fish': ['seafood', 'salmon', 'tuna', 'cod', 'halibut'],
  'shrimp': ['prawn', 'scampi'],
  'lamb': ['mutton'],

  // Starches
  'pasta': ['noodles', 'spaghetti', 'penne', 'macaroni', 'linguine', 'fettuccine'],
  'rice': ['basmati', 'jasmine', 'arborio', 'wild rice'],
  'potato': ['potatoes', 'spud', 'tater'],
  'bread': ['loaf', 'baguette', 'roll'],

  // Vegetables
  'pepper': ['bell pepper', 'capsicum'],
  'eggplant': ['aubergine'],
  'zucchini': ['courgette'],
  'cilantro': ['coriander'],
  'scallion': ['green onion', 'spring onion'],

  // Cooking methods
  'fried': ['pan-fried', 'deep-fried', 'stir-fried'],
  'baked': ['roasted', 'oven-baked'],
  'grilled': ['barbecued', 'bbq', 'charred'],
  'boiled': ['poached', 'simmered'],

  // Dishes
  'pie': ['tart', 'quiche'],
  'soup': ['stew', 'chowder', 'bisque', 'broth'],
  'salad': ['slaw', 'greens'],
  'sandwich': ['burger', 'sub', 'panini', 'wrap']
};

/**
 * Recipe name variations and their canonical forms
 */
export const RECIPE_SYNONYMS: SynonymMapping[] = [
  // Breakfast
  {
    canonical: 'pancakes',
    synonyms: ['flapjacks', 'hotcakes', 'griddlecakes']
  },
  {
    canonical: 'french toast',
    synonyms: ['eggy bread', 'pain perdu']
  },
  {
    canonical: 'omelet',
    synonyms: ['omelette', 'frittata']
  },

  // Italian
  {
    canonical: 'spaghetti carbonara',
    synonyms: ['carbonara', 'pasta carbonara']
  },
  {
    canonical: 'lasagna',
    synonyms: ['lasagne', 'meat lasagna', 'veggie lasagna']
  },
  {
    canonical: 'pizza margherita',
    synonyms: ['margherita pizza', 'margarita pizza']
  },
  {
    canonical: 'risotto',
    synonyms: ['mushroom risotto', 'seafood risotto']
  },

  // Asian
  {
    canonical: 'pad thai',
    synonyms: ['thai noodles', 'phat thai']
  },
  {
    canonical: 'fried rice',
    synonyms: ['egg fried rice', 'vegetable fried rice', 'chicken fried rice']
  },
  {
    canonical: 'spring rolls',
    synonyms: ['egg rolls', 'summer rolls']
  },
  {
    canonical: 'dumplings',
    synonyms: ['gyoza', 'potstickers', 'wontons']
  },

  // Indian
  {
    canonical: 'chicken tikka masala',
    synonyms: ['tikka masala', 'butter chicken']
  },
  {
    canonical: 'biryani',
    synonyms: ['chicken biryani', 'veg biryani', 'biriyani']
  },
  {
    canonical: 'naan',
    synonyms: ['naan bread', 'garlic naan']
  },

  // American
  {
    canonical: 'mac and cheese',
    synonyms: ['macaroni and cheese', 'mac n cheese', 'cheese pasta']
  },
  {
    canonical: 'grilled cheese',
    synonyms: ['cheese toastie', 'grilled cheese sandwich']
  },
  {
    canonical: 'buffalo wings',
    synonyms: ['chicken wings', 'hot wings']
  },

  // British
  {
    canonical: 'fish and chips',
    synonyms: ['fish n chips', 'fried fish']
  },
  {
    canonical: 'shepherd\'s pie',
    synonyms: ['cottage pie', 'shepherds pie']
  },
  {
    canonical: 'bangers and mash',
    synonyms: ['sausage and mash', 'sausages and potatoes']
  },

  // French
  {
    canonical: 'beef bourguignon',
    synonyms: ['boeuf bourguignon', 'beef burgundy']
  },
  {
    canonical: 'ratatouille',
    synonyms: ['vegetable stew']
  },
  {
    canonical: 'crème brûlée',
    synonyms: ['creme brulee', 'burnt cream']
  },

  // Mexican
  {
    canonical: 'tacos',
    synonyms: ['beef tacos', 'chicken tacos', 'fish tacos']
  },
  {
    canonical: 'burritos',
    synonyms: ['burrito bowl']
  },
  {
    canonical: 'quesadilla',
    synonyms: ['cheese quesadilla']
  },
  {
    canonical: 'guacamole',
    synonyms: ['avocado dip', 'guac']
  },

  // Desserts
  {
    canonical: 'chocolate chip cookies',
    synonyms: ['choc chip cookies', 'chocolate cookies']
  },
  {
    canonical: 'brownies',
    synonyms: ['chocolate brownies', 'fudge brownies']
  },
  {
    canonical: 'cheesecake',
    synonyms: ['new york cheesecake', 'cheese cake']
  },
  {
    canonical: 'tiramisu',
    synonyms: ['italian dessert']
  },
  {
    canonical: 'apple pie',
    synonyms: ['apple tart']
  }
];

/**
 * Get all synonym variations for a recipe name
 */
export function getRecipeSynonyms(recipeName: string): string[] {
  const normalized = recipeName.toLowerCase().trim();
  const variations: string[] = [recipeName];

  // Find matching synonym group
  for (const group of RECIPE_SYNONYMS) {
    if (
      group.canonical.toLowerCase() === normalized ||
      group.synonyms.some(syn => syn.toLowerCase() === normalized)
    ) {
      variations.push(group.canonical);
      variations.push(...group.synonyms);
      break;
    }
  }

  // Apply ingredient synonyms
  for (const [canonical, synonyms] of Object.entries(INGREDIENT_SYNONYMS)) {
    if (normalized.includes(canonical)) {
      for (const synonym of synonyms) {
        const replaced = normalized.replace(canonical, synonym);
        variations.push(replaced);
      }
    }
  }

  // Remove duplicates and return
  return [...new Set(variations)];
}

/**
 * Expand a recipe name to all possible variations
 */
export function expandRecipeName(recipeName: string): string[] {
  const variations: string[] = [];
  const normalized = recipeName.toLowerCase().trim();

  // Add original
  variations.push(recipeName);

  // Remove common descriptors
  const withoutDescriptors = normalized
    .replace(/\b(best|perfect|easy|simple|quick|homemade|classic|authentic|traditional|ultimate)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (withoutDescriptors !== normalized) {
    variations.push(withoutDescriptors);
  }

  // Remove "recipe" word
  const withoutRecipe = normalized.replace(/\b(recipe|recipes)\b/gi, '').trim();
  if (withoutRecipe !== normalized) {
    variations.push(withoutRecipe);
  }

  // Add synonym variations
  variations.push(...getRecipeSynonyms(recipeName));

  // Singular/plural variations
  if (normalized.endsWith('ies')) {
    variations.push(normalized.replace(/ies$/, 'y'));
  }
  if (normalized.endsWith('s') && !normalized.endsWith('ss')) {
    variations.push(normalized.replace(/s$/, ''));
  }

  // Remove duplicates
  return [...new Set(variations)].filter(v => v.length > 2);
}

/**
 * Find canonical recipe name from any variation
 */
export function findCanonicalName(recipeName: string): string {
  const normalized = recipeName.toLowerCase().trim();

  for (const group of RECIPE_SYNONYMS) {
    if (
      group.canonical.toLowerCase() === normalized ||
      group.synonyms.some(syn => syn.toLowerCase() === normalized)
    ) {
      return group.canonical;
    }
  }

  return recipeName; // Return original if no canonical form found
}
