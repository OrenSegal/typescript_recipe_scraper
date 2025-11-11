// Local imports
import { generateUuid } from '../uuid.js';

// Types and models
import type { Recipe, RecipeIngredient } from '../models.js';
import type { RawRecipeData, FetchProcessOptions } from '../types.js';

// Services
import { supabase } from '../supabaseClient.js';
import { calculateRecipeNutrition } from '../utils/nutritionService.js';
import { enrichRecipeDataWithGemma } from '../utils/gemmaService.js';
import { calculateHealthScore } from '../services/healthGradeService.js';

export async function processUrls(urls: string[], options: FetchProcessOptions): Promise<(Recipe | null)[]> {
  const results = await Promise.allSettled(
    urls.map(url => fetchAndProcessRecipe(url, options))
  );

  return results.map(result => {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      console.error(`Error processing URL: ${result.reason}`);
      return null;
    }
  });
}


// Utils
import { toListOfStrings, calculateEffortLevel } from '../utils/miscUtils.js';
const parseIngredientStringDetailed = (ingredient: string): RecipeIngredient => ({
  id: generateUuid(),
  recipe_id: '', // This will be set by the caller
  ingredient_id: generateUuid(),
  display_text: ingredient,
  quantity: 0,
  unit: '',
  name: '',
  notes: ''
});


// Scrapers
import { parseDurationToMinutes } from '../utils/timeUtils.ts';
import { scrapeWebsiteRecipe } from '../services/scrapers/websiteScraper.ts';
import { scrapeYouTubeRecipe } from '../services/scrapers/youtubeScraper.ts';
import { scrapeSocialMediaRecipe } from '../services/scrapers/socialScraper.ts';
import { downloadImage, uploadImageToSupabase } from '../utils/networkUtils.ts';


/*
 * Identifies the source of a URL to dispatch the correct scraper.
 * @param url The URL to analyze.
 * @returns The source type: 'tiktok', 'instagram', 'youtube', or 'website'.
 */
function getUrlSourceType(url: string): 'tiktok' | 'instagram' | 'youtube' | 'website' {
  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.toLowerCase();
    const pathname = parsedUrl.pathname;

    if (hostname.includes('tiktok.com') && pathname.includes('/video/')) return 'tiktok';
    if (hostname.includes('instagram.com') && (pathname.includes('/reel/') || pathname.includes('/p/'))) return 'instagram';
    if ((hostname.includes('youtube.com') && (pathname.includes('/watch') || pathname.includes('/shorts/'))) || hostname.includes('youtu.be')) return 'youtube';
    
    return 'website';
  } catch (e) {
    console.error(`Error parsing URL for source type detection: ${url}`, e);
    return 'website'; // Default to website on parsing error
  }
}

/*
 * Constructs a concise text bundle from a recipe object, optimized for embedding.
 * @param recipe The processed recipe object.
 * @returns A single string containing key recipe information.
 */
function createTextBundleForEmbedding(recipe: Recipe): string {
    return [
      `Title: ${recipe.title || ''}`,
      recipe.description ? `Desc: ${recipe.description.substring(0, 150)}` : '',
      recipe.cuisines?.length ? `Cuisine: ${recipe.cuisines.join(', ')}` : '',
      recipe.mealTypes?.length ? `Meal: ${recipe.mealTypes.join(', ')}` : '',
      recipe.ingredients?.length ? `Ingredients: ${recipe.ingredients.slice(0, 7).map((i: RecipeIngredient) => i.display_text.split(',')[0]).join(', ')}` : '',
      recipe.tags?.length ? `Tags: ${recipe.tags.join(', ')}` : '',
    ].filter(Boolean).join('. ');
}


/*
 * The main orchestration function. It takes a URL, determines the source,
 * scrapes the raw data, processes it into a structured Recipe object, enriches
 * it with nutrition, AI data, and a health score, generates an embedding, and
 * handles image uploading.
 *
 * @param url The recipe URL to process.
 * @param options Configuration for the processing pipeline.
 * @returns A fully processed Recipe object or null if the process fails.
 */
export async function fetchAndProcessRecipe(
  url: string,
  options: FetchProcessOptions,
): Promise<Recipe | null> {
  const {
    includeNutrition,
    includeGemmaEnrichment,
    generateRecipeEmbeddingFlag,
  } = options;

  let rawData: RawRecipeData | null = null;
  const sourceType = getUrlSourceType(url);

  console.log(`INFO (processor): Processing URL: ${url} (Source: ${sourceType})`);

  //1. SCRAPING
  switch (sourceType) {
    case 'tiktok':
    case 'instagram':
      rawData = await scrapeSocialMediaRecipe(url, sourceType);
      break;
    case 'youtube':
      rawData = await scrapeYouTubeRecipe(url);
      break;
    case 'website':
      rawData = await scrapeWebsiteRecipe(url);
      break;
  }

  if (!rawData || !rawData.title) {
    console.warn(`WARN (processor): No raw data or title obtained for URL: ${url}`);
    return null;
  }

  //2. NORMALIZATION & STRUCTURING
  const recipeId = options.recipeIdOverride || generateUuid();
  const publisherWebsite = rawData.sourceUrl ? new URL(rawData.sourceUrl).origin : '';

  let recipe: Recipe = {
    id: recipeId,
    title: rawData.title || 'Untitled Recipe',
    description: rawData.description || '',
    sourceUrl: rawData.sourceUrl,
    publisherWebsite: publisherWebsite,
    author: rawData.author || '',
    imageUrl: rawData.imageUrl || '',
    servings: typeof rawData.servingsRaw === 'string' ? parseInt(rawData.servingsRaw.match(/\d+/)?.[0] || '1', 10) : (typeof rawData.servingsRaw === 'number' ? rawData.servingsRaw : 1),
    yieldText: typeof rawData.servingsRaw === 'string' ? rawData.servingsRaw : '',
    totalTimeMinutes: parseDurationToMinutes(rawData.totalTimeMinutesRaw) || 0,
    prepTimeMinutes: parseDurationToMinutes(rawData.prepTimeMinutesRaw) || 0,
    cookTimeMinutes: parseDurationToMinutes(rawData.cookTimeMinutesRaw) || 0,
    cookingMethod: rawData.cookingMethod || '',
    ingredients: (rawData.ingredientsRaw || []).map((ingStr: string) => ({
      ...parseIngredientStringDetailed(ingStr),
      recipe_id: recipeId,
      ingredient_id: generateUuid(),
    })),
    instructions: (rawData.instructionsRaw || []).map((text: string, i: number) => ({
      id: generateUuid(),
      recipe_id: recipeId,
      step_number: i + 1,
      text: text,
    })),
    cuisines: toListOfStrings(rawData.cuisinesRaw),
    mealTypes: toListOfStrings(rawData.mealTypesRaw),
    tags: toListOfStrings(rawData.tagsRaw),
    suitableForDiet: [],
    isPublic: true,
    createdBy: 'system',
  };

  //Image Processing
  if (recipe.imageUrl) {
    const imageBuffer = await downloadImage(recipe.imageUrl);
    if (imageBuffer) {
      recipe.imageUrl = await uploadImageToSupabase(imageBuffer, recipe.id, recipe.imageUrl);
    }
  }

  //Data Enrichment
  if (includeGemmaEnrichment) {
    console.log('INFO (processor): AI enrichment requested.');
    const enrichedData = await enrichRecipeDataWithGemma(recipe);
    Object.assign(recipe, enrichedData); // Merge results
  }

  recipe.effortLevel = calculateEffortLevel(recipe.totalTimeMinutes || 0, recipe.ingredients.length, recipe.instructions.length);

  if (includeNutrition && recipe.ingredients.length > 0) {
    const ingredientsForNutrition = recipe.ingredients.map(ing => ({
      name: ing.display_text,
      cleanName: ing.display_text.toLowerCase(), // Assuming ingredientParser provides this
      quantity: ing.quantity,
      unit: ing.unit,
  }));
  recipe.nutrition = await calculateRecipeNutrition(ingredientsForNutrition) || undefined;
}

  recipe.healthScore = await calculateHealthScore(recipe);

  //6. EMBEDDING GENERATION
  if (generateRecipeEmbeddingFlag) {
    console.log('INFO (processor): Embedding generation requested.');
    const textBundle = createTextBundleForEmbedding(recipe);
    try {
      const { data, error } = await supabase.functions.invoke('generate-embedding', {
        body: { text: textBundle },
      });
      if (error) throw error;
      recipe.embedding = data.embedding;
      console.log('INFO (processor): Embedding generated successfully.');
    } catch (e) {
      console.error(`ERROR (processor): Failed to invoke embedding function: ${e}`);
    }
  }

  console.log(`SUCCESS (processor): Finished processing recipe: "${recipe.title}"`);
  return recipe;
}