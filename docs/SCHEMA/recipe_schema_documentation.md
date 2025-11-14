# Recipe Schema Documentation

This document outlines the schema structures for recipe data, including scraping instructions, validation using Zod, and Supabase database schemas.

## Table of Contents
1. [JSON Schemas](#json-schemas)
   - [Ingredients JSON Format](#ingredients-json-format)
   - [Instructions JSON Format](#instructions-json-format)
2. [Zod Validation Schemas](#zod-validation-schemas)
   - [Base Schema Definitions](#base-schema-definitions)
   - [Recipe Ingredient Schema](#recipe-ingredient-schema)
   - [Instruction Step Schema](#instruction-step-schema)
   - [Nutrition Schema](#nutrition-schema)
   - [Full Recipe Schema](#full-recipe-schema)
3. [Supabase Database Schema](#supabase-database-schema)
4. [Scraping Instructions](#scraping-instructions)
   - [General Approach](#general-approach)
   - [Ingredient Parsing](#ingredient-parsing)
   - [Instruction Parsing](#instruction-parsing)
   - [Additional Metadata Extraction](#additional-metadata-extraction)

## JSON Schemas

### Ingredients JSON Format

Ingredients should be stored in the following JSON format:

```json
[
  {
    "name": "1 quart (1L) homemade or store-bought low-sodium chicken stock",
    "unit": "quart",
    "quantity": 1,
    "notes": "low-sodium",
    "category": "Pantry Staples",
    "clean_name": "chicken stock"
  },
  {
    "name": "1 to 1 1/2 ounces powdered gelatin (4 to 6 packets; 30 to 45g), such as Knox (see note)",
    "unit": "ounces",
    "quantity": 1,
    "notes": "such as Knox",
    "category": "pantry staples",
    "clean_name": "Powdered Gelatin"
  },
  {
    "name": "1 pound (450g) ground beef chuck (about 20% fat)",
    "unit": "grams",
    "quantity": 450,
    "notes": "about 20% fat",
    "category": "meat",
    "clean_name": "ground beef chuck"
  }
]
```

### Instructions JSON Format

Instructions should be stored in the following JSON format:

```json
[
  {
    "step": 1,
    "text": "Adjust oven rack to lower-middle position and preheat oven to 300°F (150°C).",
    "action": "preheat",
    "timer_min": [],
    "mentioned_equipment": ["Oven"],
    "mentioned_ingredients": []
  },
  {
    "step": 2,
    "text": "Place stock in a medium bowl or 1-quart liquid measure and sprinkle with gelatin. Set aside.",
    "action": "Place",
    "timer_min": [],
    "mentioned_equipment": ["bowl"],
    "mentioned_ingredients": ["stock", "gelatin"]
  },
  {
    "step": 3,
    "text": "Heat olive oil in a large Dutch oven over high heat until shimmering for 5 minutes.",
    "action": "Heat",
    "timer_min": [5],
    "mentioned_equipment": ["Dutch oven"],
    "mentioned_ingredients": ["Olive oil"]
  }
]
```

## Zod Validation Schemas

### Base Schema Definitions

These are the TypeScript definitions for the Zod schemas used to validate recipe data:

```typescript
import { z } from 'zod';

// Schema for a single ingredient within a recipe.
export const RecipeIngredientSchema = z.object({
  name: z.string().min(1),
  quantity: z.number().nullable(),
  unit: z.string().nullable(),
  clean_name: z.string().min(1),
  notes: z.string().nullable(),
  category: z.string().nullable(),
  grams: z.number().nullable().optional(),
});
export type RecipeIngredient = z.infer<typeof RecipeIngredientSchema>;

// Schema for a single instruction step
export const InstructionStepSchema = z.object({
  step: z.number().int().positive(),
  text: z.string().min(1),
  mentioned_ingredients: z.array(z.string()).optional(),
  action: z.string().optional().nullable(),
  timer_min: z.array(z.number()).optional().default([]),
  mentioned_equipment: z.array(z.string()).optional(),
});
export type InstructionStep = z.infer<typeof InstructionStepSchema>;

// Schema for the nutrition information. All values are per serving.
export const NutritionSchema = z.object({
  calories: z.string().optional(),
  carbohydrateContent: z.string().optional(),
  proteinContent: z.string().optional(),
  fatContent: z.string().optional(),
  saturatedFatContent: z.string().optional(),
  cholesterolContent: z.string().optional(),
  sodiumContent: z.string().optional(),
  fiberContent: z.string().optional(),
  sugarContent: z.string().optional(),
});
export type Nutrition = z.infer<typeof NutritionSchema>;

// Schema for suitable diet types
export const DietaryRestrictionSchema = z.enum([
  // Common Allergies/Intolerances
  'Gluten-Free',
  'Dairy-Free',
  'Lactose-Intolerant',
  'Nut-Free',
  'Peanut-Free',
  'Soy-Free',
  'Egg-Free',
  'Shellfish-Free',
  'Fish-Free',
  
  // Common Diets
  'Vegetarian',
  'Vegan',
  'Pescatarian',
  'Ketogenic',
  'Paleo',
  'Low Carb',
  
  // Health/Preference Based
  'Sugar-Free',
  'Low Sodium',
  'Heart-Healthy',
  
  // Religious/Cultural
  'Kosher',
  'Halal',
]);
export type DietaryRestriction = z.infer<typeof DietaryRestrictionSchema>;
```

### Full Recipe Schema

```typescript
// The main Recipe schema for validation before database insertion
export const RecipeSchema = z.object({
  title: z.string().min(1, { message: 'Title cannot be empty' }),
  description: z.string().optional().nullable(),
  source_url: z.string().url(),
  image_url: z.string().url().optional().nullable(),
  servings: z.number().int().positive().optional().nullable(),
  prep_time_minutes: z.number().int().nonnegative().optional().nullable(),
  cook_time_minutes: z.number().int().nonnegative().optional().nullable(),
  total_time_minutes: z.number().int().nonnegative().optional().nullable(),
  ingredients: z.array(RecipeIngredientSchema).min(1, { message: "Recipe must have at least one ingredient." }),
  instructions: z.array(InstructionStepSchema).min(1, { message: "Recipe must have at least one instruction." }),
  nutrition: NutritionSchema.optional().nullable(),
  cuisines: z.array(z.string()).default([]),
  meal_types: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  author: z.string().min(1).default('Unknown'),
  publisher_website: z.string().optional().nullable(),
  effort_level: z.number().int().min(1).max(5).optional().nullable(),
  created_by: z.string().default('auto'),
  embedding: z.array(z.number()).optional().nullable(),
  health_score: z.number().min(0).max(100).optional().nullable(),
  cooking_method: z.string().optional().nullable(),
  suitable_for_diet: z.array(DietaryRestrictionSchema).default([]),
});
export type Recipe = z.infer<typeof RecipeSchema>;
```

## Supabase Database Schema

```sql
-- Create recipes table
CREATE TABLE recipes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  source_url TEXT NOT NULL UNIQUE,
  image_url TEXT,
  servings INTEGER,
  prep_time_minutes INTEGER,
  cook_time_minutes INTEGER,
  total_time_minutes INTEGER,
  ingredients JSONB NOT NULL,
  instructions JSONB NOT NULL,
  nutrition JSONB,
  cuisines TEXT[] DEFAULT '{}',
  meal_types TEXT[] DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  author TEXT DEFAULT 'Unknown',
  publisher_website TEXT,
  effort_level INTEGER CHECK (effort_level BETWEEN 1 AND 5),
  created_by TEXT DEFAULT 'auto',
  embedding vector(1536),
  health_score INTEGER CHECK (health_score BETWEEN 0 AND 100),
  cooking_method TEXT,
  suitable_for_diet TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_recipes_embedding ON recipes USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX idx_recipes_cuisines ON recipes USING GIN (cuisines);
CREATE INDEX idx_recipes_meal_types ON recipes USING GIN (meal_types);
CREATE INDEX idx_recipes_tags ON recipes USING GIN (tags);
CREATE INDEX idx_recipes_suitable_for_diet ON recipes USING GIN (suitable_for_diet);

-- Function to update timestamps automatically
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

-- Set trigger for timestamp updates
CREATE TRIGGER update_recipes_modtime
BEFORE UPDATE ON recipes
FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
```

## Scraping Instructions

### General Approach

1. Always prioritize structured data (JSON-LD, microdata) over HTML scraping.
2. Use libraries like Cheerio for HTML parsing when structured data is not available.
3. For each recipe, ensure the following data is extracted:
   - Basic information (title, description, image URL)
   - Time information (prep, cook, and total times)
   - Ingredients list
   - Instructions
   - Author information
   - Additional metadata if available

### Ingredient Parsing

1. Extract the raw ingredient text first.
2. Parse each ingredient string to extract:
   - Quantity (convert fractions to decimals)
   - Unit (standardize units when possible)
   - Clean name (ingredient name without quantities and units)
   - Notes (any additional information)
   - Category (if available or can be inferred)

Example parsing function:
```typescript
function parseIngredient(ingredientText: string): RecipeIngredient {
  // Extract quantity using regex
  const quantityMatch = ingredientText.match(/^(\d+(?:\s*\d+\/\d+)?|\d+\/\d+)/);
  const quantity = quantityMatch 
    ? parseFloat(eval(quantityMatch[0].replace(' ', '+').replace(/(\d+)\/(\d+)/g, '$1/$2')))
    : null;

  // Extract unit
  const commonUnits = ['cup', 'tablespoon', 'tbsp', 'teaspoon', 'tsp', 'ounce', 'oz', 'pound', 'lb', 'gram', 'g', 'kilogram', 'kg', 'ml', 'l', 'quart', 'gallon'];
  let unit = null;
  for (const u of commonUnits) {
    if (ingredientText.toLowerCase().includes(` ${u}`) || ingredientText.toLowerCase().includes(` ${u}s`)) {
      unit = u;
      break;
    }
  }

  // Extract clean name (remove quantity, unit, and parenthetical notes)
  let cleanName = ingredientText
    .replace(/^(\d+(?:\s*\d+\/\d+)?|\d+\/\d+)\s+/, '') // Remove quantity
    .replace(new RegExp(`\\b${unit}s?\\b`, 'i'), '') // Remove unit
    .replace(/\(.*?\)/g, '') // Remove parenthetical notes
    .replace(/,.*$/, '') // Remove anything after commas
    .trim();

  // Extract notes (anything in parentheses or after commas)
  const notesMatch = ingredientText.match(/\((.*?)\)/) || ingredientText.match(/,\s*(.*?)$/);
  const notes = notesMatch ? notesMatch[1].trim() : null;

  // Determine category (would typically use a lookup table)
  const category = determineCategory(cleanName);

  return {
    name: ingredientText.trim(),
    quantity,
    unit,
    clean_name: cleanName,
    notes,
    category,
    grams: null // Could be calculated with a conversion table if needed
  };
}

function determineCategory(ingredientName: string): string {
  // This would typically be a more complex function with a database of ingredients
  // Basic example:
  const categories = {
    'flour': 'Baking',
    'sugar': 'Baking',
    'salt': 'Pantry Staples',
    'pepper': 'Pantry Staples',
    'chicken': 'Poultry',
    'beef': 'Meat',
    'pork': 'Meat',
    'fish': 'Seafood',
    'milk': 'Dairy',
    'cheese': 'Dairy',
    'egg': 'Dairy',
    'olive oil': 'Pantry Staples',
    'vegetable oil': 'Pantry Staples',
    'carrot': 'Vegetables',
    'potato': 'Vegetables',
    'onion': 'Vegetables',
    'garlic': 'Vegetables',
    'tomato': 'Vegetables',
    'apple': 'Fruits',
    'banana': 'Fruits',
  };
  
  for (const [key, value] of Object.entries(categories)) {
    if (ingredientName.toLowerCase().includes(key)) {
      return value;
    }
  }
  
  return 'Other';
}
```

### Instruction Parsing

1. Extract the raw instruction steps.
2. For each step:
   - Assign a sequential step number
   - Parse out action verbs (first verb in the sentence or prominent cooking action)
   - Identify any timer information (minutes mentioned)
   - Extract mentioned equipment if possible
   - Extract mentioned ingredients if possible

Example parsing function:
```typescript
function parseInstructionStep(stepText: string, stepNumber: number): InstructionStep {
  // Common cooking action verbs
  const actionVerbs = [
    'preheat', 'heat', 'warm', 'place', 'put', 'add', 'mix', 'stir', 'whisk', 'beat', 
    'fold', 'pour', 'combine', 'blend', 'chop', 'dice', 'mince', 'slice', 'grate', 
    'shred', 'cook', 'simmer', 'boil', 'bake', 'roast', 'broil', 'grill', 'fry', 
    'sauté', 'toast', 'flip', 'turn', 'remove', 'drain', 'strain', 'serve', 'garnish',
    'sprinkle', 'season', 'marinate', 'chill', 'refrigerate', 'freeze', 'thaw', 'rest',
    'let', 'allow', 'transfer', 'spread', 'layer', 'roll', 'knead', 'shape'
  ];
  
  // Find the main action
  let action = null;
  for (const verb of actionVerbs) {
    if (stepText.toLowerCase().startsWith(verb) || stepText.toLowerCase().includes(` ${verb} `)) {
      action = verb;
      break;
    }
  }
  
  // Find timer information
  const timerRegex = /\b(\d+)\s*(?:min(?:ute)?s?|hours?|hrs?)\b/gi;
  const times: number[] = [];
  let match;
  while ((match = timerRegex.exec(stepText)) !== null) {
    times.push(parseInt(match[1], 10));
  }
  
  // Common kitchen equipment
  const equipment = [
    'oven', 'stove', 'microwave', 'blender', 'food processor', 'mixer', 'bowl', 'pan', 
    'pot', 'skillet', 'dutch oven', 'baking sheet', 'tray', 'dish', 'plate', 'cutting board',
    'knife', 'spatula', 'spoon', 'whisk', 'grater', 'peeler', 'measuring cup', 'measuring spoon',
    'thermometer', 'scale', 'timer', 'colander', 'strainer', 'sieve', 'ladle', 'tongs'
  ];
  
  // Find mentioned equipment
  const mentionedEquipment: string[] = [];
  for (const item of equipment) {
    if (stepText.toLowerCase().includes(item)) {
      mentionedEquipment.push(item.charAt(0).toUpperCase() + item.slice(1));
    }
  }
  
  // For a real implementation, ingredients would be passed in to check for mentions
  // This is just a placeholder
  const mentionedIngredients: string[] = [];
  
  return {
    step: stepNumber,
    text: stepText.trim(),
    action,
    timer_min: times,
    mentioned_equipment: mentionedEquipment,
    mentioned_ingredients: mentionedIngredients
  };
}
```

### Additional Metadata Extraction

#### Author Extraction

```typescript
function extractAuthor(html: string): string {
  const $ = cheerio.load(html);
  
  // Common patterns for author information
  const authorSelectors = [
    'span.author', 
    'a[rel="author"]', 
    '.byline', 
    '.author-name',
    'meta[name="author"]',
    '.recipe-author'
  ];
  
  let author = '';
  
  // Try structured data first
  const jsonLd = $('script[type="application/ld+json"]').html();
  if (jsonLd) {
    try {
      const data = JSON.parse(jsonLd);
      const graph = Array.isArray(data) ? data : (data['@graph'] || [data]);
      const recipe = graph.find(item => item['@type'] === 'Recipe');
      if (recipe?.author?.name) {
        return recipe.author.name;
      }
    } catch (e) {
      console.error('Error parsing JSON-LD for author:', e);
    }
  }
  
  // Try HTML selectors
  for (const selector of authorSelectors) {
    const el = $(selector).first();
    if (el.length > 0) {
      author = el.text().trim() || el.attr('content')?.trim() || '';
      if (author) break;
    }
  }
  
  // Look for "by [Name]" pattern
  if (!author) {
    const byMatch = $('body').text().match(/by\s+([A-Z][a-z]+\s+[A-Z][a-z]+)/);
    if (byMatch) {
      author = byMatch[1];
    }
  }
  
  return author || 'Unknown';
}
```

#### Health Score Calculation

```typescript
function calculateHealthScore(nutrition: Nutrition): number {
  if (!nutrition) return null;
  
  // Parse nutrition values to numbers
  const calories = parseInt(nutrition.calories || '0');
  const fat = parseInt(nutrition.fatContent || '0');
  const saturatedFat = parseInt(nutrition.saturatedFatContent || '0');
  const carbs = parseInt(nutrition.carbohydrateContent || '0');
  const protein = parseInt(nutrition.proteinContent || '0');
  const sodium = parseInt(nutrition.sodiumContent || '0');
  const fiber = parseInt(nutrition.fiberContent || '0');
  const sugar = parseInt(nutrition.sugarContent || '0');
  
  // Simple scoring algorithm (real one would be more sophisticated)
  let score = 50; // Start at neutral
  
  // Protein is good (up to a point)
  if (protein > 0) score += Math.min(protein, 30);
  
  // Fiber is good
  if (fiber > 0) score += Math.min(fiber * 2, 20);
  
  // Penalties for less healthy components
  if (saturatedFat > 0) score -= Math.min(saturatedFat * 2, 20);
  if (sodium > 200) score -= Math.min((sodium - 200) / 50, 20);
  if (sugar > 10) score -= Math.min((sugar - 10) * 2, 20);
  
  // Ensure score is between 0-100
  return Math.max(0, Math.min(100, score));
}
```

#### Cooking Method Detection

```typescript
function detectCookingMethod(instructions: InstructionStep[]): string {
  // Common cooking methods with their related keywords
  const cookingMethods = {
    'Baking': ['bake', 'roast', 'oven'],
    'Grilling': ['grill', 'barbecue', 'bbq'],
    'Frying': ['fry', 'pan-fry', 'deep-fry', 'shallow-fry'],
    'Sautéing': ['sauté', 'saute', 'stir-fry'],
    'Boiling': ['boil', 'simmer', 'poach'],
    'Steaming': ['steam', 'steamer'],
    'Broiling': ['broil', 'broiler'],
    'Slow Cooking': ['slow cook', 'slow cooker', 'crockpot', 'crock pot'],
    'Pressure Cooking': ['pressure cook', 'instant pot', 'pressure cooker'],
    'No-Cook': ['no cook', 'raw', 'uncooked']
  };
  
  // Count occurrences of each cooking method
  const methodCounts: Record<string, number> = {};
  
  for (const method of Object.keys(cookingMethods)) {
    methodCounts[method] = 0;
  }
  
  // Scan all instructions for cooking method keywords
  for (const instruction of instructions) {
    const text = instruction.text.toLowerCase();
    
    for (const [method, keywords] of Object.entries(cookingMethods)) {
      for (const keyword of keywords) {
        if (text.includes(keyword)) {
          methodCounts[method]++;
          break; // Count each method only once per instruction
        }
      }
    }
  }
  
  // Find the most common cooking method
  let primaryMethod = 'Other';
  let maxCount = 0;
  
  for (const [method, count] of Object.entries(methodCounts)) {
    if (count > maxCount) {
      maxCount = count;
      primaryMethod = method;
    }
  }
  
  return primaryMethod;
}
```

#### Dietary Restriction Detection

```typescript
function detectDietaryRestrictions(
  ingredients: RecipeIngredient[],
  instructions: InstructionStep[]
): string[] {
  // Lists of ingredients by category
  const glutenSources = ['wheat', 'flour', 'bread', 'pasta', 'couscous', 'barley', 'rye'];
  const dairySources = ['milk', 'cheese', 'butter', 'cream', 'yogurt'];
  const nutSources = ['almond', 'walnut', 'pecan', 'cashew', 'pistachio', 'hazelnut'];
  const animalProducts = ['meat', 'chicken', 'beef', 'pork', 'lamb', 'veal', 'turkey', 'duck'];
  const seafoodSources = ['fish', 'salmon', 'tuna', 'cod', 'shrimp', 'lobster', 'crab', 'mussel', 'clam'];
  const eggSources = ['egg', 'whites', 'yolk'];
  const soySources = ['soy', 'tofu', 'edamame', 'tempeh', 'miso'];
  
  // Check all ingredients and join them into a single string for easy searching
  const allIngredientsText = ingredients.map(i => 
    `${i.clean_name} ${i.name} ${i.notes || ''}`
  ).join(' ').toLowerCase();
  
  // All instruction text joined
  const allInstructionsText = instructions.map(i => i.text).join(' ').toLowerCase();
  
  // Combined text for searching
  const combinedText = `${allIngredientsText} ${allInstructionsText}`;
  
  // Check for dietary restrictions
  const restrictions: string[] = [];
  
  // Gluten-free check
  if (!glutenSources.some(s => combinedText.includes(s))) {
    restrictions.push('Gluten-Free');
  }
  
  // Dairy-free check
  if (!dairySources.some(s => combinedText.includes(s))) {
    restrictions.push('Dairy-Free');
    restrictions.push('Lactose-Intolerant');
  }
  
  // Nut-free check
  if (!nutSources.some(s => combinedText.includes(s))) {
    restrictions.push('Nut-Free');
    restrictions.push('Peanut-Free');
  }
  
  // Vegetarian check
  if (!animalProducts.some(s => combinedText.includes(s))) {
    restrictions.push('Vegetarian');
    
    // Vegan check (if vegetarian and no dairy/eggs)
    if (
      !dairySources.some(s => combinedText.includes(s)) &&
      !eggSources.some(s => combinedText.includes(s))
    ) {
      restrictions.push('Vegan');
    }
  }
  
  // Pescatarian check
  if (
    !animalProducts.some(s => combinedText.includes(s)) && 
    seafoodSources.some(s => combinedText.includes(s))
  ) {
    restrictions.push('Pescatarian');
  }
  
  // Egg-free check
  if (!eggSources.some(s => combinedText.includes(s))) {
    restrictions.push('Egg-Free');
  }
  
  // Soy-free check
  if (!soySources.some(s => combinedText.includes(s))) {
    restrictions.push('Soy-Free');
  }
  
  // Seafood-free check
  if (!seafoodSources.some(s => combinedText.includes(s))) {
    restrictions.push('Shellfish-Free');
    restrictions.push('Fish-Free');
  }
  
  return restrictions;
}
```
