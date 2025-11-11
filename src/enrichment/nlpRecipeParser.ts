/**
 * NLP-based Recipe Parser with AI Fallback
 * Extracts recipe information from natural language text
 *
 * Strategy:
 * 1. Fast local parsing (Compromise NLP + regex) - FREE & INSTANT
 * 2. AI fallback (Google Gemini/OpenAI) - ACCURATE but costs money
 *
 * Uses local-first approach to minimize costs while ensuring high accuracy
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

export interface ParsingOptions {
  forceAI?: boolean; // Force AI parsing even if local confidence is high
  aiProvider?: 'gemini' | 'openai' | 'anthropic'; // AI provider to use
  confidenceThreshold?: number; // Minimum confidence to skip AI (default: 75)
}

/**
 * Parse recipe from natural language text
 * Handles plain text, social media captions, OCR output, transcripts
 *
 * Uses smart two-tier approach:
 * - Try local parsing first (fast, free)
 * - Fall back to AI if confidence is low (accurate, costs ~$0.001 per recipe)
 */
export async function parseRecipeFromNaturalLanguage(
  text: string,
  options: ParsingOptions = {}
): Promise<ParsedRecipe> {
  const cleaned = cleanText(text);

  const {
    forceAI = false,
    aiProvider = 'gemini',
    confidenceThreshold = 75
  } = options;

  // Step 1: Try fast local parsing first (unless forceAI is set)
  if (!forceAI) {
    const localParsed = parseWithLocalNLP(cleaned);
    const confidence = calculateParsingConfidence(localParsed);

    console.log(`🧠 Local parsing confidence: ${confidence}%`);

    // If confidence is high enough, return local result
    if (confidence >= confidenceThreshold) {
      console.log(`✅ Using local parsing (confidence: ${confidence}%)`);
      return localParsed;
    }

    // If AI is disabled or no API keys configured, return local result
    if (!isAIAvailable(aiProvider)) {
      console.log(`⚠️ AI parsing unavailable, using local result (confidence: ${confidence}%)`);
      return localParsed;
    }

    console.log(`🤖 Local confidence low (${confidence}%), falling back to AI...`);
  } else {
    console.log(`🤖 Force AI mode enabled, skipping local parsing`);
  }

  // Step 2: Use AI for difficult cases
  try {
    const aiParsed = await parseWithAI(cleaned, aiProvider);
    console.log(`✅ AI parsing complete`);
    return aiParsed;
  } catch (error: any) {
    console.warn(`⚠️ AI parsing failed: ${error.message}`);

    // Fallback to local parsing if AI fails
    const localParsed = parseWithLocalNLP(cleaned);
    console.log(`⚠️ Using local parsing as fallback`);
    return localParsed;
  }
}

/**
 * Local NLP parsing (fast, free, works offline)
 */
function parseWithLocalNLP(cleaned: string): ParsedRecipe {
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
 * AI-powered parsing (accurate, costs ~$0.001 per recipe)
 */
async function parseWithAI(
  text: string,
  provider: 'gemini' | 'openai' | 'anthropic'
): Promise<ParsedRecipe> {
  const prompt = `You are a professional recipe parser. Extract the recipe from the following text and return ONLY a valid JSON object with this exact structure:

{
  "title": "Recipe Name",
  "description": "Brief description",
  "ingredients": ["ingredient 1", "ingredient 2", ...],
  "instructions": ["step 1", "step 2", ...],
  "servings": 4,
  "prep_time": "15 minutes",
  "cook_time": "30 minutes",
  "total_time": "45 minutes"
}

Guidelines:
- Extract ALL ingredients with quantities (e.g., "2 cups flour", "1 tsp salt")
- Extract ALL cooking steps as separate array items
- Infer reasonable values for missing fields (e.g., servings: 4 if not specified)
- Use null for fields that cannot be determined
- Ensure JSON is valid and properly formatted

Text to parse:
"""
${text}
"""

Return ONLY the JSON object, no markdown formatting, no explanations.`;

  let result: string;

  switch (provider) {
    case 'gemini':
      result = await callGeminiAPI(prompt);
      break;
    case 'openai':
      result = await callOpenAIAPI(prompt);
      break;
    case 'anthropic':
      result = await callAnthropicAPI(prompt);
      break;
    default:
      throw new Error(`Unknown AI provider: ${provider}`);
  }

  // Parse JSON response
  try {
    // Clean up response (remove markdown code blocks if present)
    const cleaned = result
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const parsed = JSON.parse(cleaned);

    return {
      title: parsed.title || null,
      ingredients: Array.isArray(parsed.ingredients) ? parsed.ingredients : [],
      instructions: Array.isArray(parsed.instructions) ? parsed.instructions : [],
      servings: parsed.servings || null,
      prep_time: parsed.prep_time || null,
      cook_time: parsed.cook_time || null,
      total_time: parsed.total_time || null,
      description: parsed.description || null
    };
  } catch (error: any) {
    throw new Error(`Failed to parse AI response: ${error.message}`);
  }
}

/**
 * Call Google Gemini API
 */
async function callGeminiAPI(prompt: string): Promise<string> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_API_KEY not configured');
  }

  const model = process.env.LITE_MODEL || 'gemini-1.5-flash-latest';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1, // Low temperature for consistent parsing
        maxOutputTokens: 2048
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

/**
 * Call OpenAI API
 */
async function callOpenAIAPI(prompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini', // Cheap and fast
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 2048
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

/**
 * Call Anthropic Claude API
 */
async function callAnthropicAPI(prompt: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307', // Fastest and cheapest
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1
    })
  });

  if (!response.ok) {
    throw new Error(`Anthropic API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.content?.[0]?.text || '';
}

/**
 * Check if AI is available
 */
function isAIAvailable(provider: 'gemini' | 'openai' | 'anthropic'): boolean {
  switch (provider) {
    case 'gemini':
      return !!process.env.GOOGLE_API_KEY;
    case 'openai':
      return !!process.env.OPENAI_API_KEY;
    case 'anthropic':
      return !!process.env.ANTHROPIC_API_KEY;
    default:
      return false;
  }
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
