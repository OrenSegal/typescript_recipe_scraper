import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';
import { Recipe, RecipeIngredient } from '../types.js';
import { config } from '../config.js';


const AiEnrichmentSchema = z.object({
    suggested_tags: z.array(z.string()).describe("Array of 5-7 relevant tags like 'baking', 'vegetarian', 'quick-meal'."),
    meal_types: z.array(z.string()).describe("Array of meal types like 'Dinner', 'Dessert', 'Appetizer'."),
    cuisines: z.array(z.string()).describe("Array of cuisines like 'Italian', 'Mexican'. Return empty array if not obvious."),
    effort_level: z.enum(["Easy", "Medium", "Hard"]).describe("A single string representing the cooking difficulty."),
});

export async function getAiEnrichment(recipe: Partial<Recipe>): Promise<Partial<Recipe>> {
  if (!config.googleApiKey) {
    console.warn("GOOGLE_API_KEY is not set. Skipping AI enrichment.");
    return {};
  }
  
  const genAI = new GoogleGenerativeAI(config.googleApiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

  const prompt = `
    Analyze the following recipe and generate metadata.
    Recipe Title: ${recipe.title}
    Ingredients: ${recipe.ingredients?.join(', ')}

    Based on the title and ingredients, return a single, valid JSON object with the following keys and nothing else. Do not add any explanatory text before or after the JSON.
    - "suggested_tags": An array of 5-7 relevant string tags.
    - "meal_types": An array of appropriate meal type strings.
    - "cuisines": An array of cuisine strings. If the cuisine is not obvious, return an empty array [].
    - "effort_level": A single string: "Easy", "Medium", or "Hard".
  `;

  try {
    const result = await model.generateContent(prompt);
    let responseText = result.response.text();
    
    // Clean the response to extract only the JSON object
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("AI did not return a parsable JSON object.");
    }
    responseText = jsonMatch[0];
    
    const parsedJson = JSON.parse(responseText);
    const validation = AiEnrichmentSchema.safeParse(parsedJson);

    if (!validation.success) {
      console.warn("AI response failed Zod validation:", validation.error);
      return {};
    }

    const { suggested_tags, meal_types, cuisines, effort_level } = validation.data;
    
    // Convert effort_level string to integer for database compatibility
    const effortLevelMap: {[key: string]: number} = {
      'Easy': 1,
      'Medium': 2,
      'Hard': 3
    };
    
    const effortLevelInt = effortLevelMap[effort_level] || null;
    
    return {
      tags: [...new Set([...(recipe.tags || []), ...suggested_tags])],
      meal_types: [...new Set([...(recipe.meal_types || []), ...meal_types])],
      cuisines: [...new Set([...(recipe.cuisines || []), ...cuisines])],
      effort_level: effortLevelInt,
    };

  } catch (error) {
    if (error instanceof Error) {
        console.error(`Error fetching AI enrichment for "${recipe.title}":`, error.message);
    } else {
        console.error("An unknown error occurred during AI enrichment.", error);
    }
    return {};
  }
}