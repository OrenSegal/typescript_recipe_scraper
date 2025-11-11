import nlp from 'compromise';
import { DataQualityLogger } from './dataQualityLogger.js';

// Hardcoded fallback data
const COOKING_ACTIONS = [
  'chop', 'dice', 'slice', 'mince', 'grate', 'peel', 'trim', 'clean', 'wash',
  'measure', 'weigh', 'sift', 'strain', 'drain', 'rinse', 'squeeze',
  'mix', 'stir', 'whisk', 'beat', 'fold', 'combine', 'blend', 'puree',
  'knead', 'toss', 'incorporate', 'cream', 'whip', 'mash',
  'heat', 'cook', 'boil', 'simmer', 'steam', 'poach', 'fry', 'saute',
  'roast', 'bake', 'broil', 'grill', 'braise', 'stew', 'sear', 'brown',
  'preheat', 'cool', 'chill', 'freeze', 'thaw', 'warm', 'reheat',
  'add', 'place', 'transfer', 'pour', 'spread', 'layer', 'arrange',
  'remove', 'set aside', 'reserve', 'discard', 'separate',
  'rest', 'marinate', 'proof', 'rise', 'set', 'stand', 'wait', 'let',
  'serve', 'garnish', 'season', 'taste', 'adjust', 'finish', 'plate'
];

const KITCHEN_EQUIPMENT = [
  'pan', 'pot', 'skillet', 'saucepan', 'stockpot', 'dutch oven', 'wok',
  'bowl', 'mixing bowl', 'serving bowl', 'large bowl', 'medium bowl', 'small bowl',
  'knife', 'chef knife', 'paring knife', 'bread knife', 'cutting board',
  'spoon', 'wooden spoon', 'slotted spoon', 'ladle', 'spatula', 'whisk',
  'fork', 'tongs', 'peeler', 'grater', 'zester', 'can opener',
  'oven', 'stovetop', 'burner', 'microwave', 'toaster', 'blender', 'food processor',
  'mixer', 'stand mixer', 'hand mixer', 'immersion blender',
  'baking sheet', 'baking dish', 'casserole dish', 'roasting pan',
  'measuring cup', 'measuring spoon', 'scale', 'thermometer',
  'strainer', 'colander', 'sieve', 'fine mesh strainer',
  'plate', 'platter', 'serving dish', 'ramekin', 'muffin tin'
];

const COMMON_INGREDIENTS = [
  'salt', 'pepper', 'black pepper', 'white pepper', 'garlic', 'onion', 'oil', 'olive oil',
  'butter', 'flour', 'sugar', 'brown sugar', 'eggs', 'milk', 'water', 'cream',
  'cheese', 'parmesan', 'cheddar', 'mozzarella', 'tomato', 'tomatoes', 'lemon',
  'lime', 'herbs', 'parsley', 'basil', 'oregano', 'thyme', 'rosemary',
  'chicken', 'beef', 'pork', 'fish', 'shrimp', 'salmon', 'tuna',
  'rice', 'pasta', 'bread', 'potatoes', 'carrots', 'celery', 'bell pepper',
  'mushrooms', 'spinach', 'lettuce', 'cucumber', 'avocado', 'apple', 'banana'
];

export interface ExtractionResult<T> {
  primary: T[];
  confidence: number;
  method: 'ner' | 'nlp' | 'hardcoded_fallback';
  errors?: string[];
}

export class RobustExtractor {
  /*
   * Extract cooking actions using NER-first approach with hardcoded fallback
   */
  static extractCookingActions(text: string): ExtractionResult<string> {
    try {
      // Method 1: NLP-based verb extraction
      const doc = nlp(text.toLowerCase());
      const verbs = doc.verbs().out('array');
      
      const nlpActions = verbs.filter((verb: string) => 
        COOKING_ACTIONS.some((action: string) => 
          verb.includes(action) || action.includes(verb) || 
          this.calculateSimilarity(verb, action) > 0.8
        )
      );

      if (nlpActions.length > 0) {
        return {
          primary: nlpActions.slice(0, 1), // Return only the first (primary) action
          confidence: 0.9,
          method: 'nlp'
        };
      }

      // Method 2: Hardcoded pattern matching fallback
      const hardcodedActions = COOKING_ACTIONS.filter(action => {
        const regex = new RegExp(`\\b${action}\\b`, 'i');
        return regex.test(text);
      });

      if (hardcodedActions.length > 0) {
        return {
          primary: hardcodedActions.slice(0, 1), // Return only the first action
          confidence: 0.7,
          method: 'hardcoded_fallback'
        };
      }

      // Default fallback
      DataQualityLogger.getInstance().logIssue('RobustExtractor',
          'extractCookingActions',
          'No cooking action found',
          { text }
        );
      
      return {
        primary: ['cook'],
        confidence: 0.3,
        method: 'hardcoded_fallback',
        errors: ['No specific cooking action detected, using default']
      };

    } catch (error) {
      DataQualityLogger.getInstance().logIssue('RobustExtractor', 'extractCookingActions', `Error in extractCookingActions: ${(error as Error).message}`, { text });
      return {
        primary: ['cook'],
        confidence: 0.1,
        method: 'hardcoded_fallback',
        errors: [(error as Error).message]
      };
    }
  }

  /*
   * Extract kitchen equipment using NER-first approach with hardcoded fallback
   */
  static extractKitchenEquipment(text: string): ExtractionResult<string> {
    try {
      // Method 1: NLP-based noun extraction
      const doc = nlp(text.toLowerCase());
      const nouns = doc.nouns().out('array') as string[];
      
      const nlpEquipment = nouns.filter((noun: string) =>
        KITCHEN_EQUIPMENT.some((equipment: string) =>
          noun.includes(equipment) ||
          equipment.includes(noun) ||
          this.calculateSimilarity(noun, equipment) > 0.8
        )
      );

      if (nlpEquipment.length > 0) {
        return {
          primary: [...new Set(nlpEquipment)], // Remove duplicates
          confidence: 0.9,
          method: 'nlp'
        };
      }

      // Method 2: Hardcoded pattern matching fallback
      const hardcodedEquipment = KITCHEN_EQUIPMENT.filter(equipment => {
        const regex = new RegExp(`\\b${equipment}\\b`, 'i');
        return regex.test(text);
      });

      return {
        primary: [...new Set(hardcodedEquipment)],
        confidence: hardcodedEquipment.length > 0 ? 0.7 : 0.1,
        method: 'hardcoded_fallback',
        errors: hardcodedEquipment.length === 0 ? ['No equipment detected'] : undefined
      };

    } catch (error) {
      DataQualityLogger.getInstance().logIssue('RobustExtractor', 'extractKitchenEquipment', `Error in extractKitchenEquipment: ${(error as Error).message}`, { text });
      return {
        primary: [],
        confidence: 0.1,
        method: 'hardcoded_fallback',
        errors: [(error as Error).message]
      };
    }
  }

  /*
   * Extract mentioned ingredients using NER-first approach with hardcoded fallback
   */
  static extractMentionedIngredients(text: string, availableIngredients: string[] = []): ExtractionResult<string> {
    try {
      const mentioned: string[] = [];

      // Method 1: Direct matching with available ingredients (highest confidence)
      for (const ingredient of availableIngredients) {
        const ingredientName = ingredient.toLowerCase();
        if (text.toLowerCase().includes(ingredientName)) {
          mentioned.push(ingredient);
        }
      }

      if (mentioned.length > 0) {
        return {
          primary: [...new Set(mentioned)],
          confidence: 0.95,
          method: 'ner'
        };
      }

      // Method 2: NLP-based food entity extraction
      const doc = nlp(text.toLowerCase());
      const nouns = doc.nouns().out('array') as string[];
      
      const nlpIngredients = nouns.filter((noun: string) => 
        COMMON_INGREDIENTS.some((ingredient: string) => 
          noun.includes(ingredient) || ingredient.includes(noun) ||
          this.calculateSimilarity(noun, ingredient) > 0.7
        )
      );

      if (nlpIngredients.length > 0) {
        return {
          primary: [...new Set(nlpIngredients)],
          confidence: 0.8,
          method: 'nlp'
        };
      }

      // Method 3: Hardcoded pattern matching fallback
      const hardcodedIngredients = COMMON_INGREDIENTS.filter(ingredient => {
        const regex = new RegExp(`\\b${ingredient}\\b`, 'i');
        return regex.test(text);
      });

      if (hardcodedIngredients.length === 0) {
        DataQualityLogger.getInstance().logIssue('RobustExtractor', 'extractMentionedIngredients', 'No ingredients detected', { text });
      }

      return {
        primary: [...new Set(hardcodedIngredients)],
        confidence: hardcodedIngredients.length > 0 ? 0.6 : 0.1,
        method: 'hardcoded_fallback',
        errors: hardcodedIngredients.length === 0 ? ['No ingredients detected'] : undefined
      };

    } catch (error) {
      DataQualityLogger.getInstance().logIssue('RobustExtractor', 'extractMentionedIngredients', `Error in extractMentionedIngredients: ${(error as Error).message}`, { text });
      return {
        primary: [],
        confidence: 0.1,
        method: 'hardcoded_fallback',
        errors: [(error as Error).message]
      };
    }
  }

  /*
   * Calculate string similarity using Levenshtein distance
   */
  private static calculateSimilarity(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;
    
    if (len1 === 0) return len2 === 0 ? 1 : 0;
    if (len2 === 0) return 0;
    
    const matrix = Array(len1 + 1).fill(null).map(() => Array(len2 + 1).fill(null));
    
    for (let i = 0; i <= len1; i++) matrix[i][0] = i;
    for (let j = 0; j <= len2; j++) matrix[0][j] = j;
    
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }
    
    const maxLen = Math.max(len1, len2);
    return (maxLen - matrix[len1][len2]) / maxLen;
  }
}
