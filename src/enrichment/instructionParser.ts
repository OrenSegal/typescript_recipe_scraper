import { DataQualityLogger } from '../utils/dataQualityLogger.js';
import { RecipeIngredient, InstructionStep } from '../types.js';
import { CookingAction, KitchenEquipment } from '../../recipe-parsing-specification.js';
import { RobustExtractor } from '../utils/robustExtractor.js';
import { equipmentMatcher } from './comprehensiveEquipmentDatabase.js';
import { ingredientMatcher } from './comprehensiveIngredientDatabase.js';

/*
 * Comprehensive abbreviation expansion mapping for cooking instructions
 */
const COOKING_ABBREVIATIONS = {
  // Units and measurements
  'qt.': 'quart', 'qts.': 'quarts', 'quart.': 'quart',
  'pt.': 'pint', 'pts.': 'pints', 'pint.': 'pint', 
  'gal.': 'gallon', 'gals.': 'gallons', 'gallon.': 'gallon',
  'lb.': 'pound', 'lbs.': 'pounds', 'pound.': 'pound',
  'oz.': 'ounce', 'ozs.': 'ounces', 'ounce.': 'ounce',
  'tbsp.': 'tablespoon', 'tbsps.': 'tablespoons', 'tablespoon.': 'tablespoon',
  'tsp.': 'teaspoon', 'tsps.': 'teaspoons', 'teaspoon.': 'teaspoon',
  'c.': 'cup', 'cups.': 'cups', 'cup.': 'cup',
  'fl.': 'fluid', 'fl. oz.': 'fluid ounce', 'fl oz': 'fluid ounce',
  'sq.': 'square', 'sq': 'square',
  'in.': 'inch', 'ins.': 'inches', 'inch.': 'inch',
  'ft.': 'foot', 'feet.': 'feet', 'foot.': 'foot',
  'cm.': 'centimeter', 'cms.': 'centimeters',
  'mm.': 'millimeter', 'mms.': 'millimeters',
  'ml.': 'milliliter', 'mls.': 'milliliters',
  'l.': 'liter', 'ls.': 'liters',
  'g.': 'gram', 'gs.': 'grams', 'gr.': 'gram',
  'kg.': 'kilogram', 'kgs.': 'kilograms',
  'deg.': 'degrees', 'degrees.': 'degrees',
  
  // Cooking terms and equipment
  'temp.': 'temperature', 'temps.': 'temperatures',
  'min.': 'minute', 'mins.': 'minutes', 'minute.': 'minute',
  'hr.': 'hour', 'hrs.': 'hours', 'hour.': 'hour',
  'sec.': 'second', 'secs.': 'seconds', 'second.': 'second',
  'cooker.': 'cooker', 'pot.': 'pot', 'pan.': 'pan',
  'skillet.': 'skillet', 'dish.': 'dish',
  'oven.': 'oven', 'stove.': 'stove', 'burner.': 'burner',
  
  // Common cooking abbreviations
  'w/': 'with', 'w/o': 'without',
  '&': 'and', '+': 'and',
  'approx.': 'approximately', 'apx.': 'approximately',
  'etc.': 'etcetera', 'incl.': 'including',
  'prep.': 'prepare', 'prepped.': 'prepared',
  'refrig.': 'refrigerate', 'refridge.': 'refrigerate',
  'thru': 'through', 'til': 'until', "'til": 'until',
  
  // Recipe-specific abbreviations
  'recip.': 'recipe', 'recipie.': 'recipe', // Common misspelling
  'ingred.': 'ingredient', 'ingredts.': 'ingredients',
  'instruct.': 'instruction', 'instrs.': 'instructions',
  'serv.': 'serving', 'servs.': 'servings',
  
  // Brand and product abbreviations
  'pkg.': 'package', 'pkgs.': 'packages', 'package.': 'package',
  'cont.': 'container', 'conts.': 'containers',
  'btl.': 'bottle', 'btls.': 'bottles', 'bottle.': 'bottle',
  'can.': 'can', 'cans.': 'cans',
  'jar.': 'jar', 'jars.': 'jars',
  'box.': 'box', 'boxes.': 'boxes'
};

/*
 * Expand common cooking abbreviations in text
 * @param text - The text to expand abbreviations in
 * @returns Text with expanded abbreviations
 */
function expandAbbreviations(text: string): string {
  let expandedText = text;
  
  // Sort by length (longer first) to avoid partial matches
  const sortedAbbrevs = Object.entries(COOKING_ABBREVIATIONS)
    .sort(([a], [b]) => b.length - a.length);
  
  for (const [abbrev, expansion] of sortedAbbrevs) {
    // Use word boundary regex to match whole words/abbreviations
    const regex = new RegExp(`\\b${abbrev.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    expandedText = expandedText.replace(regex, expansion);
  }
  
  return expandedText;
}

/*
 * Enhanced text normalization for cooking instructions
 * @param text - The text to normalize
 * @returns Normalized text
 */
function normalizeInstructionText(text: string): string {
  let normalized = text;
  
  // Expand abbreviations first
  normalized = expandAbbreviations(normalized);
  
  // Fix common spacing issues around punctuation
  normalized = normalized.replace(/\s*,\s*/g, ', ');
  normalized = normalized.replace(/\s*\.\s*/g, '. ');
  normalized = normalized.replace(/\s*;\s*/g, '; ');
  normalized = normalized.replace(/\s*:\s*/g, ': ');
  
  // Fix temperature notation
  normalized = normalized.replace(/(\d+)\s*°\s*([CF])\b/g, '$1°$2');
  normalized = normalized.replace(/(\d+)\s*degrees?\s*([CF])\b/gi, '$1°$2');
  
  // Normalize fractions
  normalized = normalized.replace(/1\/2/g, '½');
  normalized = normalized.replace(/1\/3/g, '⅓');
  normalized = normalized.replace(/1\/4/g, '¼');
  normalized = normalized.replace(/3\/4/g, '¾');
  normalized = normalized.replace(/2\/3/g, '⅔');
  
  // Fix common hyphenation issues
  normalized = normalized.replace(/\b(\d+)\s*-\s*(\d+)\b/g, '$1-$2'); // "3 - 4 hours" → "3-4 hours"
  
  // Normalize multiple spaces
  normalized = normalized.replace(/\s+/g, ' ');
  
  // Trim and clean up
  normalized = normalized.trim();
  
  return normalized;
}

/*
 * Enhanced instruction processing using the parsing specification
 * Processes raw instruction strings into structured InstructionStep objects
 */

/*
 * Extract the primary cooking action from instruction text using robust NER-first approach
 * Returns only ONE main action per instruction for atomic format
 * @param instructionText - The instruction text to analyze
 * @returns The primary cooking action
 */
function extractCookingAction(instructionText: string): string {
  console.log(`🎯 Extracting cooking action from: "${instructionText}"`);
  
  try {
    const result = RobustExtractor.extractCookingActions(instructionText);
    
    if (result.primary.length > 0) {
      const action = result.primary[0]; // Take only the first action for atomic format
      console.log(`✅ Found primary action: "${action}" (method: ${result.method}, confidence: ${result.confidence})`);
      
      if (result.errors) {
        result.errors.forEach(error => 
          DataQualityLogger.getInstance().logIssue(instructionText, 'instruction-parser', `Error extracting cooking action: ${error}`)
        );
      }
      
      return action;
    }
    
    // Should not reach here due to fallback in RobustExtractor, but just in case
    DataQualityLogger.getInstance().logIssue('instructionParser', 'extractCookingAction', 'No cooking action found', { instructionText });
    return 'cook';
    
  } catch (error) {
    DataQualityLogger.getInstance().logIssue('instructionParser', 'extractCookingAction', `Error extracting cooking action: ${(error as Error).message}`, { instructionText });
    return 'cook';
  }
} // Default fallback action

/*
 * Extract timer information with enhanced parsing
 */
function extractTimerInfo(instructionText: string): number[] {
  const timers: number[] = [];
  
  // Enhanced time patterns
  const timePatterns = [
    // "for X minutes" or "for X-Y minutes"
    /for\s+(\d+)(?:\s*-\s*(\d+))?\s*(?:minutes?|mins?)/gi,
    // "X to Y minutes" or "X-Y minutes"
    /(\d+)(?:\s*(?:to|-)\s*(\d+))?\s*(?:minutes?|mins?)/gi,
    // "about X minutes" or "approximately X minutes"
    /(?:about|approximately|around)\s+(\d+)\s*(?:minutes?|mins?)/gi,
    // "until X minutes" or "after X minutes"
    /(?:until|after)\s+(\d+)\s*(?:minutes?|mins?)/gi,
    // Hours conversion
    /(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)/gi,
  ];
  
  for (const pattern of timePatterns) {
    const matches = [...instructionText.matchAll(pattern)];
    for (const match of matches) {
      const min1 = parseInt(match[1]);
      const min2 = match[2] ? parseInt(match[2]) : null;
      
      // Convert hours to minutes if needed
      const isHours = /hours?|hrs?/i.test(match[0]);
      const multiplier = isHours ? 60 : 1;
      
      if (min2) {
        timers.push(min1 * multiplier, min2 * multiplier);
      } else {
        timers.push(min1 * multiplier);
      }
    }
  }
  
  // Remove duplicates and sort
  const uniqueTimers = [...new Set(timers)].sort((a, b) => a - b);
  
  // Return up to 2 values (min, max)
  return uniqueTimers.slice(0, 2);
}

/*
 * Extract kitchen equipment mentioned in the instruction using robust NER-first approach
 * @param instructionText - The instruction text to analyze
 * @returns Array of kitchen equipment names
 */
function extractKitchenEquipment(instructionText: string): string[] {
  console.log(`🍳 Extracting equipment from: "${instructionText}"`);
  
  try {
    const result = RobustExtractor.extractKitchenEquipment(instructionText);
    
    console.log(`✅ Found equipment: [${result.primary.join(', ')}] (method: ${result.method}, confidence: ${result.confidence})`);
    
    if (result.errors) {
      result.errors.forEach(error => 
        DataQualityLogger.getInstance().logIssue('instructionParser', 'extractKitchenEquipment', error, { instructionText })
      );
    }
    
    return result.primary;
    
  } catch (error) {
    DataQualityLogger.getInstance().logIssue('instructionParser', 'extractKitchenEquipment', `Error extracting equipment: ${(error as Error).message}`, { instructionText });
    return [];
  }
}

/*
 * Generate common variations of ingredient names for fuzzy matching
 */
function generateIngredientVariations(ingredientName: string): string[] {
  const variations: string[] = [];
  const name = ingredientName.toLowerCase();
  
  // Add plurals and singulars
  if (name.endsWith('s') && name.length > 3) {
    variations.push(name.slice(0, -1)); // Remove 's'
  } else {
    variations.push(name + 's'); // Add 's'
  }
  
  // Common ingredient abbreviations and variations
  const commonVariations: { [key: string]: string[] } = {
    'chicken': ['chick', 'poultry'],
    'beef': ['meat', 'steak'],
    'pork': ['meat'],
    'onion': ['onions', 'yellow onion', 'white onion'],
    'garlic': ['garlic clove', 'clove'],
    'tomato': ['tomatoes', 'fresh tomato'],
    'potato': ['potatoes', 'spud'],
    'carrot': ['carrots'],
    'celery': ['celery stalk'],
    'bell pepper': ['pepper', 'capsicum'],
    'olive oil': ['oil'],
    'butter': ['unsalted butter', 'salted butter'],
    'flour': ['all-purpose flour', 'plain flour'],
    'sugar': ['granulated sugar', 'white sugar'],
    'salt': ['sea salt', 'kosher salt'],
    'pepper': ['black pepper', 'ground pepper']
  };
  
  // Add specific variations if they exist
  if (commonVariations[name]) {
    variations.push(...commonVariations[name]);
  }
  
  // Add variations without common descriptors
  const withoutDescriptors = name
    .replace(/\b(fresh|dried|ground|chopped|minced|sliced|diced)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  if (withoutDescriptors !== name && withoutDescriptors.length > 2) {
    variations.push(withoutDescriptors);
  }
  
  return [...new Set(variations)];
}

/*
 * Extract ingredients mentioned in instruction text using robust NER-first approach
 * @param instructionText - The instruction text to analyze
 * @param availableIngredients - List of ingredients in the recipe for reference matching
 * @returns Array of ingredient names mentioned in the instruction
 */
function extractMentionedIngredients(
  instructionText: string, 
  availableIngredients: RecipeIngredient[]
): string[] {
  console.log(`🥕 Extracting ingredients from: "${instructionText}"`);
  console.log(`📊 Available ingredients: [${availableIngredients.map(ing => ing.name).join(', ')}]`);
  
  try {
    // Convert available ingredients to string array for the robust extractor
    const availableIngredientNames = availableIngredients.map(ing => ing.name);
    
    const result = RobustExtractor.extractMentionedIngredients(instructionText, availableIngredientNames);
    
    console.log(`✅ Total ingredients extracted: ${result.primary.length} - [${result.primary.join(', ')}] (method: ${result.method}, confidence: ${result.confidence})`);
    
    if (result.errors) {
      result.errors.forEach(error => 
        DataQualityLogger.getInstance().logIssue('instructionParser', 'extractMentionedIngredients', error, { instructionText })
      );
    }
    
    return result.primary;
    
  } catch (error) {
    DataQualityLogger.getInstance().logIssue('instructionParser', 'extractMentionedIngredients', `Error parsing ingredients: ${(error as Error).message}`, { instructionText });
    return [];
  }
  

}

/*
 * Process a raw instruction string into a structured InstructionStep
 * @param instructionText - The raw instruction text
 * @param stepNumber - The step number in the recipe
 * @param availableIngredients - List of ingredients in the recipe for reference matching
 * @returns A structured InstructionStep object
 */
export function processInstruction(
  instructionText: string,
  stepNumber: number,
  availableIngredients: RecipeIngredient[] = []
): InstructionStep {
  try {
    // Apply enhanced normalization and abbreviation expansion
    const normalizedText = normalizeInstructionText(instructionText.trim());
    const text = normalizedText;
    
    console.log(`📝 Processing instruction ${stepNumber}: "${instructionText.trim()}"`);
    if (normalizedText !== instructionText.trim()) {
      console.log(`🔧 Normalized to: "${normalizedText}"`);
    }
    
    // Extract components using enhanced parsing for ATOMIC instruction format
    const action = extractCookingAction(text);
    const timer_min = extractTimerInfo(text);
    const equipment = extractKitchenEquipment(text) as KitchenEquipment[];
    const mentioned_ingredients = extractMentionedIngredients(text, availableIngredients);
    
    // Validate action against CookingAction enum
    const validActions = [
      'chop', 'dice', 'slice', 'mince', 'grate', 'peel', 'trim', 'clean', 'wash',
      'measure', 'weigh', 'sift', 'strain', 'drain', 'rinse',
      'mix', 'stir', 'whisk', 'beat', 'fold', 'combine', 'blend', 'puree',
      'knead', 'toss', 'incorporate',
      'heat', 'cook', 'boil', 'simmer', 'steam', 'poach', 'fry', 'saute',
      'roast', 'bake', 'broil', 'grill', 'braise', 'stew',
      'preheat', 'cool', 'chill', 'freeze', 'thaw', 'warm',
      'add', 'place', 'transfer', 'pour', 'spread', 'layer', 'arrange',
      'remove', 'set aside', 'reserve',
      'rest', 'marinate', 'proof', 'rise', 'set', 'stand', 'wait',
      'serve', 'garnish', 'season', 'taste', 'adjust', 'finish'
    ];
    const finalAction = validActions.includes(action) ? action as CookingAction : null;

    // Create atomic instruction with all components
    const instruction: InstructionStep = {
      step_number: stepNumber,
      text,
      action: finalAction, // ONE main action per instruction
      timer_min, // Timer ranges in minutes
      equipment, // ALL equipment mentioned
      mentioned_ingredients, // ALL ingredients mentioned
    };
    
    // Comprehensive logging for atomic instruction validation
    console.log(`✅ ATOMIC INSTRUCTION ${stepNumber} PARSED:`);
    console.log(`   🎯 Primary Action: "${finalAction || 'none'}"`);
    console.log(`   ⏱️  Timers: [${timer_min.join(', ')}] minutes`);
    console.log(`   🍳 Equipment: [${equipment.join(', ')}]`);
    console.log(`   🥕 Ingredients: [${mentioned_ingredients.join(', ')}]`);
    
    return instruction;
    
  } catch (error) {
    console.error(`❌ Failed to parse instruction ${stepNumber}: "${instructionText}"`, error);
    
    // Fallback to basic structure
    return {
      step_number: stepNumber,
      text: instructionText.trim(),
      action: null,
      timer_min: [],
      equipment: [],
      mentioned_ingredients: [],

    };
  }
}

/*
 * Process multiple instruction strings into structured InstructionStep objects
 * @param instructions - Array of raw instruction strings
 * @param availableIngredients - List of ingredients in the recipe for reference matching
 * @returns Array of structured InstructionStep objects
 */
export function processInstructions(
  instructions: string[],
  availableIngredients: RecipeIngredient[] = []
): InstructionStep[] {
  return instructions.map((instruction, index) => 
    processInstruction(instruction, index + 1, availableIngredients)
  );
}
