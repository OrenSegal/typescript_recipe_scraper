export const USER_AGENT = 'Mozilla/5.0 (compatible; RecipeScraper/1.0; +https://my-app.com/bot)';
export const REQUEST_TIMEOUT = 20;

export interface RawRecipeData {
  title?: string | null;
  description?: string | null;
  sourceUrl: string;
  imageUrl?: string | null;
  author?: string | null;
  servingsRaw?: string | number | null;
  totalTimeMinutesRaw?: string | number | null;
  prepTimeMinutesRaw?: string | number | null;
  cookTimeMinutesRaw?: string | number | null;
  ingredientsRaw?: string[];
  instructionsRaw?: string[];
  cuisinesRaw?: string | string[];
  mealTypesRaw?: string | string[];
  tagsRaw?: string[] | string | null;
  nutritionRaw?: Record<string, any> | null;
  cookingMethod?: string | null;
}

// Configuration options for the main processing function.
export interface FetchProcessOptions {
  recipeIdOverride?: string | null;
  includeNutrition?: boolean;
  includeGemmaEnrichment?: boolean;
  generateRecipeEmbeddingFlag?: boolean;
}