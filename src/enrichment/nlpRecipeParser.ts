/**
 * NLP-based Recipe Parser
 * Extracts recipe information from natural language text
 * Uses: Compromise NLP + regex patterns + heuristics
 */

import nlp from 'compromise';

export interface ParsedRecipe {
  title: string | null;
  ingredients: string[];
  instructions: string[];
  servings: number | null;
  prep_time: string | null;
  cook_time: string | null;
  total_time: string | null;
  description: string | null;
}

/**
 * Parse recipe from natural language text
 * Handles plain text, social media captions, OCR output, transcripts
 */
export async function parseRecipeFromNaturalLanguage(text: string): Promise<ParsedRecipe> {
  const cleaned = cleanText(text);

  return {
    title: extractTitle(cleaned),
    ingredients: extractIngredients(cleaned),
    instructions: extractInstructions(cleaned),
    servings: extractServings(cleaned),
    prep_time: extractTime(cleaned, 'prep'),
    cook_time: extractTime(cleaned, 'cook'),
    total_time: extractTime(cleaned, 'total'),
    description: extractDescription(cleaned)
  };
}

/**
 * Clean and normalize text
 * Preserves line breaks for ingredient/instruction parsing
 */
function cleanText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')  // Normalize line endings
    .replace(/\n{3,}/g, '\n\n')  // Collapse excessive newlines
    .split('\n')  // Process line by line
    .map(line => line.replace(/\s+/g, ' ').trim())  // Normalize whitespace within each line
    .join('\n')
    .trim();
}

/**
 * Extract recipe title
 * Looks for: Recipe for X, X Recipe, How to Make X
 */
function extractTitle(text: string): string | null {
  const lines = text.split('\n');

  // Check first few lines for title
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const line = lines[i].trim();

    // Skip empty lines
    if (!line) continue;

    // Look for title patterns
    const titlePatterns = [
      /^(?:recipe\s+for\s+)?(.+?)(?:\s+recipe)?$/i,
      /^how\s+to\s+make\s+(.+)$/i,
      /^(.+?)(?:\s*\|\s*\w+)?$/i // Generic first line
    ];

    for (const pattern of titlePatterns) {
      const match = line.match(pattern);
      if (match && match[1].length < 100 && match[1].length > 5) {
        return match[1].trim();
      }
    }
  }

  // Fallback: Use NLP to find main noun phrase in first line
  const firstLine = lines[0]?.trim();
  if (firstLine && firstLine.length < 100) {
    return firstLine;
  }

  return null;
}

/**
 * Extract ingredients from text
 * Looks for: ingredient lists, quantities, units
 */
function extractIngredients(text: string): string[] {
  const ingredients: string[] = [];

  // Split into sections
  const sections = text.split(/\n\s*\n/);

  for (const section of sections) {
    const lines = section.split('\n');

    // Check if this section looks like ingredients
    if (isIngredientSection(section)) {
      for (const line of lines) {
        const cleaned = line.trim();

        // Skip section headers
        if (isSectionHeader(cleaned)) continue;

        // Extract ingredient if line looks like an ingredient
        if (isIngredientLine(cleaned)) {
          // Clean up the ingredient line (remove bullets, list numbers)
          const ingredient = cleaned
            .replace(/^[•\-*]\s*/, '')  // Remove bullet points
            .replace(/^\d+[\.)]\s*/, '')  // Remove list numbers
            .trim();

          if (ingredient.length > 0) {
            ingredients.push(ingredient);
          }
        }
      }
    }
  }

  // If no ingredients found, try alternative patterns
  if (ingredients.length === 0) {
    const altIngredients = extractIngredientsAlternative(text);
    ingredients.push(...altIngredients);
  }

  return ingredients;
}

/**
 * Check if section is likely ingredients
 */
function isIngredientSection(section: string): boolean {
  const lowerSection = section.toLowerCase();
  return (
    lowerSection.includes('ingredient') ||
    lowerSection.includes('you\'ll need') ||
    lowerSection.includes('what you need') ||
    lowerSection.includes('shopping list') ||
    (hasMultipleQuantities(section) && !lowerSection.includes('step'))
  );
}

/**
 * Check if line is a section header
 */
function isSectionHeader(line: string): boolean {
  const lowerLine = line.toLowerCase();
  return (
    lowerLine.match(/^(ingredients?|instructions?|directions?|method|steps?):?\s*$/i) !== null ||
    line.length < 5
  );
}

/**
 * Check if line looks like an ingredient
 */
function isIngredientLine(line: string): boolean {
  if (line.length < 3 || line.length > 200) return false;

  // Common patterns
  const patterns = [
    /^\d+/, // Starts with number
    /^[•\-*]/, // Bullet point
    /\d+\s*(cup|tbsp|tsp|oz|lb|g|kg|ml|l|teaspoon|tablespoon|pound|ounce|gram)/i, // Has unit
    /^(a|an|the)\s+\w+/i, // Starts with article
  ];

  return patterns.some(pattern => pattern.test(line));
}

/**
 * Alternative ingredient extraction
 */
function extractIngredientsAlternative(text: string): string[] {
  const ingredients: string[] = [];
  const lines = text.split('\n');

  for (const line of lines) {
    const cleaned = line.trim();

    // Look for lines with quantities and food items
    if (hasQuantityAndFood(cleaned)) {
      ingredients.push(cleaned);
    }
  }

  return ingredients;
}

/**
 * Check if text has multiple quantities
 */
function hasMultipleQuantities(text: string): boolean {
  const quantityPattern = /\d+\s*(cup|tbsp|tsp|oz|lb|g|kg|ml|l)/gi;
  const matches = text.match(quantityPattern);
  return (matches?.length || 0) >= 3;
}

/**
 * Check if line has quantity and food item
 */
function hasQuantityAndFood(line: string): boolean {
  const hasQuantity = /\d+/.test(line);
  const hasUnit = /(cup|tbsp|tsp|oz|lb|g|kg|ml|l|teaspoon|tablespoon|pound|ounce|gram)/i.test(line);
  const hasFood = /(flour|sugar|butter|egg|milk|water|salt|pepper|oil|chicken|beef|rice)/i.test(line);

  return hasQuantity && (hasUnit || hasFood);
}

/**
 * Extract cooking instructions
 * Looks for: numbered steps, action verbs, imperative sentences
 */
function extractInstructions(text: string): string[] {
  const instructions: string[] = [];

  // Split into sections
  const sections = text.split(/\n\s*\n/);

  for (const section of sections) {
    const lines = section.split('\n');

    // Check if this section looks like instructions
    if (isInstructionSection(section)) {
      for (const line of lines) {
        const cleaned = line.trim();

        // Skip section headers
        if (isSectionHeader(cleaned)) continue;

        // Extract instruction if line looks like a step
        if (isInstructionLine(cleaned)) {
          // Remove step numbers
          const instruction = cleaned.replace(/^\d+[\.)]\s*/, '').trim();
          if (instruction.length > 10) {
            instructions.push(instruction);
          }
        }
      }
    }
  }

  // If no instructions found, try alternative extraction
  if (instructions.length === 0) {
    const altInstructions = extractInstructionsAlternative(text);
    instructions.push(...altInstructions);
  }

  return instructions;
}

/**
 * Check if section is likely instructions
 */
function isInstructionSection(section: string): boolean {
  const lowerSection = section.toLowerCase();
  return (
    lowerSection.includes('instruction') ||
    lowerSection.includes('direction') ||
    lowerSection.includes('method') ||
    lowerSection.includes('step') ||
    lowerSection.includes('how to make') ||
    hasMultipleActionVerbs(section)
  );
}

/**
 * Check if line looks like an instruction
 */
function isInstructionLine(line: string): boolean {
  if (line.length < 10 || line.length > 500) return false;

  // Common patterns
  const patterns = [
    /^\d+[\.)]\s*/, // Numbered step
    /^(first|second|third|then|next|finally)/i, // Sequence words
    /^[•\-*]\s*/, // Bullet point
    /^(heat|cook|bake|mix|stir|add|pour|place|cut|chop|slice|dice|sauté|fry)/i // Action verbs
  ];

  return patterns.some(pattern => pattern.test(line));
}

/**
 * Alternative instruction extraction
 */
function extractInstructionsAlternative(text: string): string[] {
  const instructions: string[] = [];
  const lines = text.split('\n');

  // Look for sentences with action verbs
  const doc = nlp(text);
  const sentences = doc.sentences().out('array');

  for (const sentence of sentences) {
    if (hasActionVerb(sentence) && sentence.length > 15 && sentence.length < 500) {
      instructions.push(sentence.trim());
    }
  }

  return instructions;
}

/**
 * Check if text has multiple action verbs
 */
function hasMultipleActionVerbs(text: string): boolean {
  const actionVerbs = /\b(heat|cook|bake|mix|stir|add|pour|place|cut|chop|slice|dice|sauté|fry|boil|simmer|roast|grill|blend|whisk|combine|preheat)\b/gi;
  const matches = text.match(actionVerbs);
  return (matches?.length || 0) >= 3;
}

/**
 * Check if sentence has action verb
 */
function hasActionVerb(sentence: string): boolean {
  const actionVerbs = /\b(heat|cook|bake|mix|stir|add|pour|place|cut|chop|slice|dice|sauté|fry|boil|simmer|roast|grill|blend|whisk|combine|preheat|prepare|season|serve|garnish|remove|transfer|drain|rinse|wash|peel|core|seed|mince|crush|mash|knead|roll|fold|spread|brush|coat|marinate|refrigerate|freeze|thaw|defrost)\b/i;
  return actionVerbs.test(sentence);
}

/**
 * Extract servings
 */
function extractServings(text: string): number | null {
  const patterns = [
    /(?:serves?|serving|servings?|makes?|yield|feeds?)[\s:]*(\d+)/i,
    /(\d+)\s*(?:servings?|portions?|people)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > 0 && num < 100) {
        return num;
      }
    }
  }

  return null;
}

/**
 * Extract time (prep, cook, total)
 */
function extractTime(text: string, type: 'prep' | 'cook' | 'total'): string | null {
  const typePatterns: Record<string, RegExp[]> = {
    prep: [
      /prep(?:\s+time)?[\s:]*(\d+\s*(?:min|minute|minutes|hr|hour|hours))/i,
      /preparation(?:\s+time)?[\s:]*(\d+\s*(?:min|minute|minutes|hr|hour|hours))/i,
    ],
    cook: [
      /cook(?:ing)?(?:\s+time)?[\s:]*(\d+\s*(?:min|minute|minutes|hr|hour|hours))/i,
      /bake[\s:]*(\d+\s*(?:min|minute|minutes|hr|hour|hours))/i,
    ],
    total: [
      /total(?:\s+time)?[\s:]*(\d+\s*(?:min|minute|minutes|hr|hour|hours))/i,
      /ready in[\s:]*(\d+\s*(?:min|minute|minutes|hr|hour|hours))/i,
    ]
  };

  const patterns = typePatterns[type] || [];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }

  return null;
}

/**
 * Extract description
 */
function extractDescription(text: string): string | null {
  const lines = text.split('\n');

  // Look for description after title, before ingredients
  for (let i = 1; i < Math.min(10, lines.length); i++) {
    const line = lines[i].trim();

    // Skip empty lines and section headers
    if (!line || isSectionHeader(line)) continue;

    // If line is not an ingredient or instruction, likely description
    if (!isIngredientLine(line) && !isInstructionLine(line) && line.length > 20 && line.length < 500) {
      return line;
    }
  }

  return null;
}

/**
 * Calculate confidence score for parsed recipe
 */
export function calculateParsingConfidence(recipe: ParsedRecipe): number {
  let score = 0;

  // Title (20 points)
  if (recipe.title && recipe.title.length > 5) score += 20;

  // Ingredients (30 points)
  if (recipe.ingredients.length >= 3) score += 30;
  else if (recipe.ingredients.length >= 1) score += 15;

  // Instructions (30 points)
  if (recipe.instructions.length >= 3) score += 30;
  else if (recipe.instructions.length >= 1) score += 15;

  // Metadata (20 points)
  if (recipe.servings) score += 5;
  if (recipe.prep_time) score += 5;
  if (recipe.cook_time) score += 5;
  if (recipe.description) score += 5;

  return Math.min(100, score);
}
