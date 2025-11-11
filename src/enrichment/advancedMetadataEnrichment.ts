import * as cheerio from 'cheerio';
import { RecipeIngredient, InstructionStep, Nutrition } from '../types.js';

/*
 * Extract author information from HTML content, prioritizing structured data
 * then falling back to common author patterns in HTML
 */
export function extractAuthor(html: string): string {
  const $ = cheerio.load(html);
  
  // Common patterns for author information - more specific and prioritized
  const authorSelectors = [
    '.recipe-byline .author-name',
    '.author-byline .author',
    'span[itemprop="author"] span[itemprop="name"]',
    'a[rel="author"]', 
    '.byline .author', 
    '.recipe-author',
    'meta[name="author"]'
  ];
  
  let author = '';
  
  // Try structured data first (highest priority)
  const jsonLdElements = $('script[type="application/ld+json"]');
  if (jsonLdElements.length > 0) {
    for (let i = 0; i < jsonLdElements.length; i++) {
      const jsonLd = $(jsonLdElements[i]).html();
      if (jsonLd) {
        try {
          const data = JSON.parse(jsonLd);
          const graph = Array.isArray(data) ? data : (data['@graph'] || [data]);
          const recipe = graph.find((item: any) => item['@type'] === 'Recipe' || 
            (Array.isArray(item['@type']) && item['@type'].includes('Recipe')));
          
          if (recipe?.author?.name) {
            const authorName = recipe.author.name.trim();
            // Validation check to prevent navigation elements being misidentified as authors
            if (isValidAuthorName(authorName)) {
              return authorName;
            }
          } else if (typeof recipe?.author === 'string') {
            const authorName = recipe.author.trim();
            if (isValidAuthorName(authorName)) {
              return authorName;
            }
          }
        } catch (e) {
          console.error('Error parsing JSON-LD for author:', e);
        }
      }
    }
  }
  
  // Try HTML selectors - more specific ones first
  for (const selector of authorSelectors) {
    const el = $(selector).first();
    if (el.length > 0) {
      author = el.text().trim() || el.attr('content')?.trim() || '';
      // Validate the author name
      if (author && isValidAuthorName(author)) break;
      else author = ''; // Reset if invalid
    }
  }
  
  // Look for "by [Name]" pattern with more specific validation
  if (!author) {
    // Look for a proper name format: Capital letter followed by lowercase, with possible spaces and another word
    const byPattern = /by\s+([A-Z][a-z]+(?:\s+[A-Z][a-zA-Z\-']+){1,2})/;
    
    // Find paragraphs near the top of the recipe that often contain attribution
    const headerSection = $('header').text() || '';
    const topParagraphs = $('article p:lt(3)').text() || '';
    const metaSection = $('meta[property="og:description"]').attr('content') || '';
    
    // Combine likely sections where author attribution appears
    const attributionText = headerSection + ' ' + topParagraphs + ' ' + metaSection;
    const match = attributionText.match(byPattern);
    
    if (match && match[1]) {
      author = match[1].trim();
      if (!isValidAuthorName(author)) author = '';
    }
  }
  
  return author || 'Unknown';
}

/*
 * Validate if a string looks like a proper author name
 * This helps filter out navigation elements and other false positives
 */
function isValidAuthorName(name: string): boolean {
  // Check if name is too short
  if (!name || name.length < 3) return false;
  
  // Check if name contains unwanted terms that indicate it's not an author
  const invalidTerms = [
    'recipe', 'course', 'ingredient', 'equipment', 'menu', 'navigation', 
    'home', 'about', 'contact', 'blog', 'category', 'tag', 'share', 'print',
    'directions', 'steps', 'prep', 'cook', 'time', 'servings', 'yield'
  ];
  
  const lowerName = name.toLowerCase();
  if (invalidTerms.some(term => lowerName.includes(term))) {
    return false;
  }
  
  // Check if it's just a single word that's not a proper name
  if (!name.includes(' ') && name.length < 5) {
    return false;
  }
  
  // Check if it starts with a capital letter (most names do)
  if (!/^[A-Z]/.test(name)) {
    return false;
  }
  
  return true;
}

/*
 * Calculate a health score (0-100) based on nutrition information
 */
export function calculateHealthScore(nutrition: Nutrition | null | undefined): number | null {
  if (!nutrition) return null;
  
  // Parse nutrition values to numbers, removing units like "g" or "mg"
  const parseNutritionValue = (value: string | number | null | undefined): number => {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') return value;
    const match = value.match(/(\d+(?:\.\d+)?)/);
    return match ? parseFloat(match[1]) : 0;
  };

  const calories = parseNutritionValue(nutrition.calories);
  const fat = parseNutritionValue(nutrition.fatG);
  const saturatedFat = parseNutritionValue(nutrition.saturatedFatG);
  const carbs = parseNutritionValue(nutrition.carbohydratesG);
  const protein = parseNutritionValue(nutrition.proteinG);
  const sodium = parseNutritionValue(nutrition.sodiumG);
  const fiber = parseNutritionValue(nutrition.fiberG);
  const sugar = parseNutritionValue(nutrition.sugarG);
  
  // If we don't have enough nutrition data, don't calculate a score
  if (calories === 0 && fat === 0 && carbs === 0 && protein === 0) {
    return null;
  }
  
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
  return Math.max(0, Math.min(100, Math.round(score)));
}

/*
 * Detect the primary cooking method from instruction steps
 */
export function detectCookingMethod(instructions: InstructionStep[]): string | null {
  if (!instructions || instructions.length === 0) return null;
  
  // Common cooking methods with their related keywords
  const cookingMethods: Record<string, string[]> = {
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
    if (!instruction.text) continue;
    
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
  let primaryMethod = null;
  let maxCount = 0;
  
  for (const [method, count] of Object.entries(methodCounts)) {
    if (count > maxCount) {
      maxCount = count;
      primaryMethod = method;
    }
  }
  
  return maxCount > 0 ? primaryMethod : null;
}

/*
 * Detect dietary restrictions that the recipe is suitable for
 */
export function detectDietaryRestrictions(
  ingredients: RecipeIngredient[],
  instructions: InstructionStep[]
): string[] {
  if (!ingredients || ingredients.length === 0) return [];
  
  // Lists of ingredients by category
  const glutenSources = ['wheat', 'flour', 'bread', 'pasta', 'couscous', 'barley', 'rye'];
  const dairySources = ['milk', 'cheese', 'butter', 'cream', 'yogurt'];
  const nutSources = ['almond', 'walnut', 'pecan', 'cashew', 'pistachio', 'hazelnut', 'peanut', 'nut'];
  const animalProducts = ['meat', 'chicken', 'beef', 'pork', 'lamb', 'veal', 'turkey', 'duck'];
  const seafoodSources = ['fish', 'salmon', 'tuna', 'cod', 'shrimp', 'lobster', 'crab', 'mussel', 'clam', 'seafood', 'shellfish'];
  const eggSources = ['egg', 'whites', 'yolk'];
  const soySources = ['soy', 'tofu', 'edamame', 'tempeh', 'miso'];
  const sugarSources = ['sugar', 'honey', 'maple syrup', 'corn syrup', 'agave'];
  
  // Check all ingredients and join them into a single string for easy searching
  const allIngredientsText = ingredients.map(i => 
    `${i.name || ''} ${i.notes || ''}`
  ).join(' ').toLowerCase();
  
  // All instruction text joined
  const allInstructionsText = instructions && instructions.length > 0 
    ? instructions.map(i => i.text || '').join(' ').toLowerCase()
    : '';
  
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
  
  // Sugar-free check
  if (!sugarSources.some(s => combinedText.includes(s))) {
    restrictions.push('Sugar-Free');
  }
  
  // Low Carb check - simple heuristic
  if (
    !['pasta', 'bread', 'rice', 'potato', 'flour', 'sugar'].some(s => combinedText.includes(s))
  ) {
    restrictions.push('Low Carb');
  }
  
  return restrictions;
}
