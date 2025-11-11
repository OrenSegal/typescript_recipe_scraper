import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.43/deno-dom-wasm.ts";

interface RawScrapedRecipe {
  title: string;
  description?: string;
  image_url?: string;
  servings?: number | string;
  prep_time_minutes?: number;
  cook_time_minutes?: number;
  total_time_minutes?: number;
  ingredients: string[];
  instructions: string[];
  author?: string;
  source_url: string;
  effort_level?: string;
  cuisines?: string[];
  meal_types?: string[];
  tags?: string[];
  created_by?: string;
}

console.log('Recipe scraping function initialized with full pipeline integration');

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      },
    });
  }

  try {
    const { url, options = {} } = await req.json();

    const finalOptions = {
      include_ai: options?.include_ai_enrichment === true,
      include_nutrition: options?.include_nutrition === true,
      generate_embedding: options?.generate_embedding === true,
    };

    if (!url || typeof url !== 'string') {
      return new Response(JSON.stringify({ error: 'A valid URL is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    console.log(`[Edge Function] Scraping started for: ${url}`);
    console.log(`[Edge Function] Options:`, finalOptions);

    // 1. Scrape raw data using Deno-compatible scraping
    const rawScrapedData = await scrapeWebsite(url);
    console.log(`[Edge Function] Raw scraping completed for: ${rawScrapedData.title}`);

    // 2. For now, return the raw scraped data (full processing would require Supabase integration)
    // In a production environment, you'd integrate with Supabase here
    const response = {
      message: 'Recipe scraped successfully',
      recipe: {
        title: rawScrapedData.title,
        description: rawScrapedData.description,
        ingredients_count: rawScrapedData.ingredients.length,
        instructions_count: rawScrapedData.instructions.length,
        servings: rawScrapedData.servings,
        times: {
          prep: rawScrapedData.prep_time_minutes,
          cook: rawScrapedData.cook_time_minutes,
          total: rawScrapedData.total_time_minutes
        },
        author: rawScrapedData.author,
        url: rawScrapedData.source_url
      },
      raw_data: rawScrapedData // Include full raw data for debugging
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });

  } catch (error) {
    console.error('[Edge Function ERROR]', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    
    return new Response(JSON.stringify({ 
      error: errorMessage,
      details: error instanceof Error ? error.stack : 'No stack trace available'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
});

// Deno-compatible website scraping function with enhanced headers
async function scrapeWebsite(url: string): Promise<RawScrapedRecipe> {
  console.log(`[Scraper] Fetching HTML from: ${url}`);
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Cache-Control': 'max-age=0'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  
  const html = await response.text();
  console.log(`[Scraper] HTML fetched, length: ${html.length} characters`);
  
  return scrapeFromHtml(url, html);
}

// Deno-compatible HTML parsing function
function scrapeFromHtml(url: string, html: string): RawScrapedRecipe {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  if (!doc) {
    throw new Error('Failed to parse HTML document');
  }

  console.log(`[Scraper] Parsing recipe data from HTML`);
  
  // Try to extract JSON-LD structured data first
  const jsonLdScript = doc.querySelector('script[type="application/ld+json"]');
  if (jsonLdScript && jsonLdScript.textContent) {
    try {
      const jsonLd = JSON.parse(jsonLdScript.textContent);
      console.log(`[Scraper] Found JSON-LD structured data`);
      
      // Handle different JSON-LD structures
      const recipe = Array.isArray(jsonLd) ? 
        jsonLd.find(item => item['@type'] === 'Recipe') :
        jsonLd['@type'] === 'Recipe' ? jsonLd : jsonLd.recipe;
      
      if (recipe) {
        return parseJsonLdRecipe(recipe, url);
      }
    } catch (e) {
      console.warn(`[Scraper] Failed to parse JSON-LD:`, e);
    }
  }
  
  // Fallback to HTML parsing
  console.log(`[Scraper] Using HTML fallback parsing`);
  return parseHtmlRecipe(doc, url);
}

// Parse JSON-LD recipe data with enhanced Food Network support
function parseJsonLdRecipe(recipe: any, url: string): RawScrapedRecipe {
  console.log(`[JSON-LD Debug] Recipe keys:`, Object.keys(recipe));
  console.log(`[JSON-LD Debug] Author:`, recipe.author);
  console.log(`[JSON-LD Debug] Times - prep:`, recipe.prepTime, 'cook:', recipe.cookTime, 'total:', recipe.totalTime);
  console.log(`[JSON-LD Debug] Nutrition:`, recipe.nutrition);
  
  const ingredients = Array.isArray(recipe.recipeIngredient) ? 
    recipe.recipeIngredient : [];
  
  const instructions = Array.isArray(recipe.recipeInstructions) ?
    recipe.recipeInstructions.map((inst: any) => 
      typeof inst === 'string' ? inst : inst.text || inst.name || ''
    ).filter(Boolean) : [];
  
  // Enhanced author extraction for Food Network
  let author: string | undefined;
  if (typeof recipe.author === 'string') {
    author = recipe.author;
  } else if (recipe.author) {
    if (Array.isArray(recipe.author)) {
      // Handle array of authors
      const firstAuthor = recipe.author[0];
      author = typeof firstAuthor === 'string' ? firstAuthor : firstAuthor?.name;
    } else {
      // Handle object author
      author = recipe.author.name || recipe.author['@name'] || recipe.author.title;
    }
  }
  
  // Enhanced timing extraction
  const times = {
    prep: parseTimeToMinutes(recipe.prepTime) || parseTimeToMinutes(recipe.prepTime?.text),
    cook: parseTimeToMinutes(recipe.cookTime) || parseTimeToMinutes(recipe.cookTime?.text),
    total: parseTimeToMinutes(recipe.totalTime) || parseTimeToMinutes(recipe.totalTime?.text)
  };
  
  // Try alternative time field names for Food Network
  if (!times.prep && recipe.preparationTime) {
    times.prep = parseTimeToMinutes(recipe.preparationTime);
  }
  if (!times.cook && recipe.cookingMethod) {
    times.cook = parseTimeToMinutes(recipe.cookingMethod);
  }
  
  // Enhanced nutrition extraction with Food Network support
  let nutrition: any = {};
  if (recipe.nutrition) {
    nutrition = recipe.nutrition;
    console.log(`[JSON-LD Debug] Found nutrition data:`, nutrition);
    
    // Handle Food Network's nutrition structure
    if (typeof nutrition === 'object') {
      // Extract common nutrition fields
      const nutritionData: any = {};
      
      // Handle different nutrition field formats
      if (nutrition.calories || nutrition.Calories) {
        nutritionData.calories = parseInt(String(nutrition.calories || nutrition.Calories).replace(/\D/g, '')) || undefined;
      }
      if (nutrition.fatContent || nutrition.fat || nutrition.Fat) {
        nutritionData.fat_grams = parseFloat(String(nutrition.fatContent || nutrition.fat || nutrition.Fat).replace(/[^\d.]/g, '')) || undefined;
      }
      if (nutrition.saturatedFatContent || nutrition.saturatedFat) {
        nutritionData.saturated_fat_grams = parseFloat(String(nutrition.saturatedFatContent || nutrition.saturatedFat).replace(/[^\d.]/g, '')) || undefined;
      }
      if (nutrition.carbohydrateContent || nutrition.carbs || nutrition.Carbs) {
        nutritionData.carbohydrates_grams = parseFloat(String(nutrition.carbohydrateContent || nutrition.carbs || nutrition.Carbs).replace(/[^\d.]/g, '')) || undefined;
      }
      if (nutrition.sugarContent || nutrition.sugar || nutrition.Sugar) {
        nutritionData.sugar_grams = parseFloat(String(nutrition.sugarContent || nutrition.sugar || nutrition.Sugar).replace(/[^\d.]/g, '')) || undefined;
      }
      if (nutrition.proteinContent || nutrition.protein || nutrition.Protein) {
        nutritionData.protein_grams = parseFloat(String(nutrition.proteinContent || nutrition.protein || nutrition.Protein).replace(/[^\d.]/g, '')) || undefined;
      }
      if (nutrition.fiberContent || nutrition.fiber || nutrition.Fiber) {
        nutritionData.fiber_grams = parseFloat(String(nutrition.fiberContent || nutrition.fiber || nutrition.Fiber).replace(/[^\d.]/g, '')) || undefined;
      }
      if (nutrition.sodiumContent || nutrition.sodium || nutrition.Sodium) {
        nutritionData.sodium_milligrams = parseFloat(String(nutrition.sodiumContent || nutrition.sodium || nutrition.Sodium).replace(/[^\d.]/g, '')) || undefined;
      }
      if (nutrition.cholesterolContent || nutrition.cholesterol) {
        nutritionData.cholesterol_milligrams = parseFloat(String(nutrition.cholesterolContent || nutrition.cholesterol).replace(/[^\d.]/g, '')) || undefined;
      }
      
      nutrition = nutritionData;
      console.log(`[JSON-LD Debug] Processed nutrition data:`, nutrition);
    }
  } else {
    console.log(`[JSON-LD Debug] No nutrition data found in JSON-LD`);
  }
  
  // Enhanced categories and tags extraction
  let cuisines = recipe.recipeCuisine ? 
    (Array.isArray(recipe.recipeCuisine) ? recipe.recipeCuisine : [recipe.recipeCuisine]) : undefined;
  
  let mealTypes = recipe.recipeCategory ? 
    (Array.isArray(recipe.recipeCategory) ? recipe.recipeCategory : [recipe.recipeCategory]) : undefined;
    
  let tags = recipe.keywords ? 
    (Array.isArray(recipe.keywords) ? recipe.keywords : [recipe.keywords]) : undefined;
  
  // Handle Food Network's specific tag structure
  if (url.includes('foodnetwork.com') && tags) {
    // Clean up tags and separate meal types
    const cleanTags: string[] = [];
    const extractedMealTypes: string[] = [];
    
    tags.forEach((tag: any) => {
      const tagStr = typeof tag === 'string' ? tag : String(tag);
      const tagLower = tagStr.toLowerCase();
      
      // Check if it's a meal type
      if (tagLower.includes('breakfast') || tagLower.includes('lunch') || tagLower.includes('dinner') ||
          tagLower.includes('dessert') || tagLower.includes('appetizer') || tagLower.includes('side') ||
          tagLower.includes('main') || tagLower.includes('entree')) {
        extractedMealTypes.push(tagStr);
      } else {
        cleanTags.push(tagStr);
      }
    });
    
    mealTypes = extractedMealTypes.length > 0 ? extractedMealTypes : mealTypes;
    tags = cleanTags.length > 0 ? cleanTags : undefined;
  }
  
  console.log(`[JSON-LD Debug] Final extracted data:`, {
    author,
    times,
    cuisines,
    mealTypes,
    tagCount: tags?.length || 0
  });
  
  return {
    title: recipe.name || 'Untitled Recipe',
    description: recipe.description || undefined,
    image_url: typeof recipe.image === 'string' ? recipe.image : 
               Array.isArray(recipe.image) ? recipe.image[0] : 
               recipe.image?.url || undefined,
    servings: recipe.recipeYield || recipe.yield || undefined,
    prep_time_minutes: times.prep,
    cook_time_minutes: times.cook,
    total_time_minutes: times.total || (times.prep && times.cook ? times.prep + times.cook : undefined),
    ingredients,
    instructions,
    author,
    source_url: url,
    effort_level: recipe.difficulty || undefined,
    cuisines,
    meal_types: mealTypes,
    tags
  };
}

// Parse HTML recipe data (fallback) with Food Network-specific extraction
function parseHtmlRecipe(doc: Document, url: string): RawScrapedRecipe {
  console.log(`[Scraper] Using HTML fallback parsing for URL: ${url}`);
  
  const isFoodNetwork = url.includes('foodnetwork.com');
  
  // Extract title
  const titleSelectors = [
    'h1.o-AssetTitle__a-HeadlineText',  // Food Network specific
    'h1[data-module="RecipeTitle"]',
    'h1', '.recipe-title', '.entry-title'
  ];
  let title = 'Untitled Recipe';
  for (const selector of titleSelectors) {
    const titleEl = doc.querySelector(selector);
    if (titleEl?.textContent?.trim()) {
      title = titleEl.textContent.trim();
      break;
    }
  }
  
  // Extract description
  const descSelectors = [
    '.o-RecipeInfo__m-Description',  // Food Network specific
    '.recipe-description', '.recipe-summary', '[data-module="RecipeSummary"]', '.entry-summary'
  ];
  let description: string | undefined;
  for (const selector of descSelectors) {
    const descEl = doc.querySelector(selector);
    if (descEl?.textContent?.trim()) {
      description = descEl.textContent.trim();
      break;
    }
  }
  
  // Extract author (Food Network specific)
  let author: string | undefined;
  if (isFoodNetwork) {
    const authorSelectors = [
      '.o-Attribution__a-Name a',
      '.o-Attribution__a-Name',
      '.by-author a',
      '.recipe-by a'
    ];
    for (const selector of authorSelectors) {
      const authorEl = doc.querySelector(selector);
      if (authorEl?.textContent?.trim()) {
        author = authorEl.textContent.trim();
        break;
      }
    }
  }
  
  // Extract timing information (Food Network specific)
  let prep_time_minutes: number | undefined;
  let cook_time_minutes: number | undefined;
  let total_time_minutes: number | undefined;
  
  if (isFoodNetwork) {
    // Food Network uses specific data attributes and classes
    const timeSelectors = [
      '.o-RecipeInfo__a-Description.m-RecipeInfo__a-Description--Total',
      '.recipe-time .prep-time',
      '.recipe-time .cook-time',
      '.recipe-time .total-time',
      '[data-module="RecipeInfo"] .time'
    ];
    
    // Look for time elements
    const timeElements = doc.querySelectorAll('.o-RecipeInfo__a-Description');
    timeElements.forEach(el => {
      const text = el.textContent?.trim().toLowerCase() || '';
      const timeMatch = text.match(/(\d+)\s*(minute|min|hour|hr)/i);
      if (timeMatch) {
        const value = parseInt(timeMatch[1]);
        const unit = timeMatch[2].toLowerCase();
        const minutes = unit.startsWith('h') ? value * 60 : value;
        
        if (text.includes('prep')) {
          prep_time_minutes = minutes;
        } else if (text.includes('cook') || text.includes('bake')) {
          cook_time_minutes = minutes;
        } else if (text.includes('total')) {
          total_time_minutes = minutes;
        }
      }
    });
  }
  
  // Extract servings
  let servings: number | string | undefined;
  if (isFoodNetwork) {
    const servingSelectors = [
      '.o-RecipeInfo__a-Description.m-RecipeInfo__a-Description--Yield',
      '.recipe-yield',
      '.servings'
    ];
    for (const selector of servingSelectors) {
      const servingEl = doc.querySelector(selector);
      if (servingEl?.textContent?.trim()) {
        const servingText = servingEl.textContent.trim();
        const servingMatch = servingText.match(/(\d+)/); 
        if (servingMatch) {
          servings = parseInt(servingMatch[1]);
          break;
        }
      }
    }
  }
  
  // Extract image
  const imageSelectors = [
    '.m-MediaBlock__a-Image img',  // Food Network specific
    '.recipe-image img', '[data-module="RecipeLeadImage"] img', '.entry-image img', 'img[src*="recipe"]'
  ];
  let image: string | undefined;
  for (const selector of imageSelectors) {
    const imgEl = doc.querySelector(selector) as HTMLImageElement;
    if (imgEl?.src) {
      image = imgEl.src;
      break;
    }
  }
  
  // Extract ingredients
  const ingredientSelectors = [
    '.o-Ingredients__a-Ingredient',  // Food Network specific
    '.recipe-ingredients li',
    '[data-module="RecipeIngredients"] li',
    '.ingredients li',
    '.recipe-ingredient'
  ];
  const ingredients: string[] = [];
  for (const selector of ingredientSelectors) {
    const elements = doc.querySelectorAll(selector);
    if (elements.length > 0) {
      elements.forEach(el => {
        const text = el.textContent?.trim();
        if (text) ingredients.push(text);
      });
      break;
    }
  }
  
  // Extract instructions
  const instructionSelectors = [
    '.o-Method__m-Step',  // Food Network specific
    '.recipe-instructions li',
    '[data-module="RecipeInstructions"] li',
    '.instructions li',
    '.recipe-instruction',
    '.directions li'
  ];
  const instructions: string[] = [];
  for (const selector of instructionSelectors) {
    const elements = doc.querySelectorAll(selector);
    if (elements.length > 0) {
      elements.forEach(el => {
        const text = el.textContent?.trim();
        if (text) instructions.push(text);
      });
      break;
    }
  }
  
  // Extract categories/meal types (Food Network specific)
  let meal_types: string[] | undefined;
  let tags: string[] | undefined;
  
  if (isFoodNetwork) {
    // Look for category information
    const categorySelectors = [
      '.o-Capsule__a-Tag',
      '.recipe-categories a',
      '.recipe-tags a',
      '.categories a'
    ];
    
    const categories: string[] = [];
    const recipeTagsSet = new Set<string>();
    
    for (const selector of categorySelectors) {
      const elements = doc.querySelectorAll(selector);
      elements.forEach(el => {
        const text = el.textContent?.trim();
        if (text && !recipeTagsSet.has(text.toLowerCase())) {
          recipeTagsSet.add(text.toLowerCase());
          categories.push(text);
        }
      });
    }
    
    if (categories.length > 0) {
      // Separate meal types from general tags
      const mealTypeKeywords = ['breakfast', 'lunch', 'dinner', 'dessert', 'appetizer', 'snack', 'side dish', 'main course', 'entree'];
      const foundMealTypes = categories.filter(cat => 
        mealTypeKeywords.some(keyword => cat.toLowerCase().includes(keyword))
      );
      const foundTags = categories.filter(cat => 
        !mealTypeKeywords.some(keyword => cat.toLowerCase().includes(keyword))
      );
      
      meal_types = foundMealTypes.length > 0 ? foundMealTypes : undefined;
      tags = foundTags.length > 0 ? foundTags : undefined;
    }
  }
  
  // Extract nutrition information (Food Network specific)
  let nutrition: any = {};
  
  if (isFoodNetwork) {
    // Look for nutrition data in various Food Network structures
    const nutritionSelectors = [
      '.o-Nutrition__a-Description',  // Food Network specific
      '.nutrition-info',
      '.recipe-nutrition',
      '[data-module="NutritionInfo"]',
      '.nutritional-info'
    ];
    
    console.log(`[HTML Debug] Looking for Food Network nutrition data`);
    
    // Try to find nutrition elements
    for (const selector of nutritionSelectors) {
      const nutritionElements = doc.querySelectorAll(selector);
      if (nutritionElements.length > 0) {
        console.log(`[HTML Debug] Found ${nutritionElements.length} nutrition elements with selector: ${selector}`);
        
        nutritionElements.forEach(el => {
          const text = el.textContent?.trim().toLowerCase() || '';
          console.log(`[HTML Debug] Nutrition text: "${text}"`);
          
          // Parse nutrition values
          const caloriesMatch = text.match(/calories?[:\s]*(\d+)/i);
          if (caloriesMatch) {
            nutrition.calories = parseInt(caloriesMatch[1]);
          }
          
          const fatMatch = text.match(/(?:total\s*)?fat[:\s]*(\d+(?:\.\d+)?)\s*g/i);
          if (fatMatch) {
            nutrition.fat_grams = parseFloat(fatMatch[1]);
          }
          
          const saturatedFatMatch = text.match(/saturated\s*fat[:\s]*(\d+(?:\.\d+)?)\s*g/i);
          if (saturatedFatMatch) {
            nutrition.saturated_fat_grams = parseFloat(saturatedFatMatch[1]);
          }
          
          const carbsMatch = text.match(/(?:total\s*)?carbohydrates?[:\s]*(\d+(?:\.\d+)?)\s*g/i);
          if (carbsMatch) {
            nutrition.carbohydrates_grams = parseFloat(carbsMatch[1]);
          }
          
          const sugarMatch = text.match(/sugar[:\s]*(\d+(?:\.\d+)?)\s*g/i);
          if (sugarMatch) {
            nutrition.sugar_grams = parseFloat(sugarMatch[1]);
          }
          
          const proteinMatch = text.match(/protein[:\s]*(\d+(?:\.\d+)?)\s*g/i);
          if (proteinMatch) {
            nutrition.protein_grams = parseFloat(proteinMatch[1]);
          }
          
          const fiberMatch = text.match(/(?:dietary\s*)?fiber[:\s]*(\d+(?:\.\d+)?)\s*g/i);
          if (fiberMatch) {
            nutrition.fiber_grams = parseFloat(fiberMatch[1]);
          }
          
          const sodiumMatch = text.match(/sodium[:\s]*(\d+(?:\.\d+)?)\s*mg/i);
          if (sodiumMatch) {
            nutrition.sodium_milligrams = parseFloat(sodiumMatch[1]);
          }
          
          const cholesterolMatch = text.match(/cholesterol[:\s]*(\d+(?:\.\d+)?)\s*mg/i);
          if (cholesterolMatch) {
            nutrition.cholesterol_milligrams = parseFloat(cholesterolMatch[1]);
          }
        });
        break;
      }
    }
    
    console.log(`[HTML Debug] Extracted nutrition data:`, nutrition);
  }
  
  // Calculate total time if not found but prep and cook are available
  if (!total_time_minutes && prep_time_minutes && cook_time_minutes) {
    total_time_minutes = prep_time_minutes + cook_time_minutes;
  }
  
  return {
    title,
    description,
    image_url: image,
    servings,
    prep_time_minutes,
    cook_time_minutes,
    total_time_minutes,
    ingredients,
    instructions,
    author,
    source_url: url,
    effort_level: undefined,
    cuisines: undefined,
    meal_types,
    tags
  };
}

// Enhanced time parsing with debug logging and multiple format support
function parseTimeToMinutes(duration: string | undefined): number | undefined {
  if (!duration) {
    console.log(`[Time Debug] No duration provided`);
    return undefined;
  }
  
  console.log(`[Time Debug] Parsing duration: "${duration}"`);
  
  // Handle ISO 8601 format (PT30M, PT1H30M, etc.)
  const iso8601Match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (iso8601Match) {
    const hours = parseInt(iso8601Match[1] || '0');
    const minutes = parseInt(iso8601Match[2] || '0');
    const result = hours * 60 + minutes;
    console.log(`[Time Debug] ISO 8601 match: ${hours}h ${minutes}m = ${result} minutes`);
    return result;
  }
  
  // Handle common text formats like "30 minutes", "1 hour 30 minutes", "1h 30m"
  const textTimeMatch = duration.match(/(\d+)\s*(?:hours?|hrs?|h)\s*(?:and\s*)?(\d+)?\s*(?:minutes?|mins?|m)?|(?:^|\s)(\d+)\s*(?:minutes?|mins?|m)(?!\w)/i);
  if (textTimeMatch) {
    const hours = parseInt(textTimeMatch[1] || '0');
    const minutes = parseInt(textTimeMatch[2] || textTimeMatch[3] || '0');
    const result = hours * 60 + minutes;
    console.log(`[Time Debug] Text format match: ${hours}h ${minutes}m = ${result} minutes`);
    return result;
  }
  
  // Handle "X hour(s) Y minute(s)" format
  const longFormatMatch = duration.match(/(\d+)\s*hour?s?(?:\s*and\s*)?(\d+)?\s*minute?s?/i);
  if (longFormatMatch) {
    const hours = parseInt(longFormatMatch[1]);
    const minutes = parseInt(longFormatMatch[2] || '0');
    const result = hours * 60 + minutes;
    console.log(`[Time Debug] Long format match: ${hours}h ${minutes}m = ${result} minutes`);
    return result;
  }
  
  // Handle simple number formats (assume minutes)
  const numberMatch = duration.match(/\d+/);
  if (numberMatch) {
    const result = parseInt(numberMatch[0]);
    console.log(`[Time Debug] Simple number match: ${result} minutes`);
    return result;
  }
  
  console.log(`[Time Debug] No time format matched for: "${duration}"`);
  return undefined;
}
