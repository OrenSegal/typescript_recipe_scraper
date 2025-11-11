import { load } from 'cheerio';
import { USER_AGENT } from '../../types.ts';
import type { RawRecipeData } from '../../types.ts';

export async function scrapeWebsiteRecipe(url: string): Promise<RawRecipeData | null> {
  console.log(`INFO (websiteScraper): Fetching HTML for Cheerio parsing: ${url}`);
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(20000), // 20-second timeout
    });
    if (!response.ok) {
      console.warn(`WARN (websiteScraper): Fetch failed for ${url} with status ${response.status}`);
      return null;
    }
    const html = await response.text();
    const $ = load(html);

    let recipeSchema: any = null;
    $('script[type="application/ld+json"]').each((_, element) => {
      const scriptContent = $(element).html();
      if (!scriptContent) return;
      
      try {
        const json = JSON.parse(scriptContent);
        const graph = json['@graph'];
        const recipeNode = Array.isArray(graph)
          ? graph.find(node => node && (node['@type'] === 'Recipe' || (Array.isArray(node['@type']) && node['@type'].includes('Recipe'))))
          : (json && (json['@type'] === 'Recipe' ? json : null));
        
        if (recipeNode) {
          recipeSchema = recipeNode;
          return false; // Stop searching once found
        }
      } catch (e) { /* Ignore non-JSON script tags */ }
    });

    if (!recipeSchema || typeof recipeSchema !== 'object' || !recipeSchema.name) {
      console.warn(`WARN (websiteScraper): Could not find a valid Recipe JSON-LD schema on ${url}`);
      return null;
    }

    // Defensively map properties, handling various formats (string, array, object)
    const rawData: RawRecipeData = {
      title: recipeSchema.name,
      description: recipeSchema.description,
      sourceUrl: url,
      imageUrl: Array.isArray(recipeSchema.image) ? recipeSchema.image[0]?.url || recipeSchema.image[0] : recipeSchema.image?.url || recipeSchema.image,
      author: Array.isArray(recipeSchema.author) ? recipeSchema.author[0]?.name : recipeSchema.author?.name,
      servingsRaw: Array.isArray(recipeSchema.recipeYield) ? recipeSchema.recipeYield[0] : recipeSchema.recipeYield,
      totalTimeMinutesRaw: recipeSchema.totalTime,
      prepTimeMinutesRaw: recipeSchema.prepTime,
      cookTimeMinutesRaw: recipeSchema.cookTime,
      ingredientsRaw: recipeSchema.recipeIngredient,
      instructionsRaw: (recipeSchema.recipeInstructions || []).map((instr: any) => instr.text || instr).filter(Boolean),
      cuisinesRaw: recipeSchema.recipeCuisine,
      mealTypesRaw: recipeSchema.recipeCategory,
      cookingMethod: recipeSchema.cookingMethod,
    };

    console.log(`INFO (websiteScraper): Successfully parsed recipe schema for: ${rawData.title}`);
    return rawData;

  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error(`CRITICAL (websiteScraper): Scraping failed for ${url}:`, err.message);
    return null;
  }
}