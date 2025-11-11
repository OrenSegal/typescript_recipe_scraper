import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { parseDurationToMinutes } from '../utils/timeUtils';
import type { Recipe } from '../models';

// Initialize the model directly within the function scope
let enrichmentModel: GenerativeModel | null = null;
const apiKey = (globalThis as any).Deno?.env.get('GOOGLE_API_KEY');

if (apiKey) {
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    enrichmentModel = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });
  } catch (e) {
    console.error('ERROR (GemmaService): Failed to initialize Google AI Model:', e as Error);
  }
} else {
  console.warn('WARN (GemmaService): GOOGLE_API_KEY not set. Gemma enrichment is disabled.');
}

/*
 * Creates a text bundle and identifies missing fields from a recipe object.
 * @param recipe The recipe object.
 * @returns An object with the text bundle and a list of missing field names.
 */
function createEnrichmentPayload(recipe: Recipe): { bundle: string; missing: Array<keyof Recipe> } {
    const bundle = [
        `Title: ${recipe.title}`,
        `Description: ${recipe.description || 'N/A'}`,
        `Ingredients: ${recipe.ingredients.map(i => i.display_text).join(', ')}`,
        `Instructions: ${recipe.instructions.map(i => i.text).join(' ')}`
    ].join('\n');

    const missing: Array<keyof Recipe> = [];
    if (!recipe.cookingMethod) missing.push('cookingMethod');
    if (!recipe.cuisines?.length) missing.push('cuisines');
    if (!recipe.mealTypes?.length) missing.push('mealTypes');
    if (!recipe.tags?.length) missing.push('tags');
    if (!recipe.suitableForDiet?.length) missing.push('suitableForDiet');
    if (!recipe.author) missing.push('author');
    
    return { bundle, missing };
}

/*
 * Enriches a recipe object with data from Google's Gemini model.
 */
export async function enrichRecipeDataWithGemma(recipe: Recipe): Promise<Partial<Recipe>> {
  const { bundle, missing } = createEnrichmentPayload(recipe);

  if (!enrichmentModel || missing.length === 0) {
    return {};
  }
  
  const prompt = `Analyze this recipe:\n---\n${bundle}\n---\nInfer these missing fields: ${missing.join(', ')}. Respond ONLY with valid JSON.`;
  
  try {
    const result = await enrichmentModel.generateContent({
        contents: [{ role: "user", parts: [{text: prompt}]}],
        generationConfig: { responseMimeType: "application/json" }
    });
    const rawText = result.response.text();
    const gemmaData = JSON.parse(rawText) as Partial<Recipe>;
    
    // Simple post-processing
    if (gemmaData.totalTimeMinutes) {
        gemmaData.totalTimeMinutes = parseDurationToMinutes(String(gemmaData.totalTimeMinutes)) ?? null;
    }
    if (gemmaData.prepTimeMinutes) gemmaData.prepTimeMinutes = parseDurationToMinutes(gemmaData.prepTimeMinutes);
    if (gemmaData.cookTimeMinutes) gemmaData.cookTimeMinutes = parseDurationToMinutes(gemmaData.cookTimeMinutes);

    console.log('INFO (GemmaService): Successfully enriched data:', gemmaData);
    return gemmaData;
  } catch (e) {
    console.error('ERROR (GemmaService): AI enrichment failed:', e);
    return {};
  }
}