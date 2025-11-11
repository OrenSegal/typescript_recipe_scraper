/*
 * Embedding Generation Utility
 * 
 * Standalone utility for generating embeddings using Google's Gemini embedding model
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

/*
 * Generate embedding for text using Google's Gemini embedding model
 */
export async function generateEmbedding(text: string): Promise<number[] | null> {
  const GOOGLE_API_KEY = process.env.EMBEDDING_API_KEY || process.env.GOOGLE_API_KEY;
  if (!GOOGLE_API_KEY) {
    console.warn('⚠️ Gemini API key not available for embeddings');
    return null;
  }
  
  try {
    // Use Google's Gemini embedding API with gemini-embedding-001 model
    const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);
    
    // Get the embedding model
    const model = genAI.getGenerativeModel({ model: 'gemini-embedding-001' });
    
    // Generate embedding using the embedContent method
    const result = await model.embedContent(text);
    
    if (!result.embedding || !result.embedding.values) {
      throw new Error('No embedding values returned from Gemini API');
    }
    
    return result.embedding.values;
  } catch (error) {
    console.warn(`Failed to generate Gemini embedding for text: "${text.substring(0, 50)}..."`, error);
    return null;
  }
}

/*
 * Generate embedding for a complete recipe object
 */
export async function generateRecipeEmbedding(recipe: {
  title: string;
  description?: string;
  ingredients?: Array<{ name?: string; }>;
}): Promise<number[] | null> {
  // Create a comprehensive text representation of the recipe
  const textParts = [recipe.title];
  
  if (recipe.description) {
    textParts.push(recipe.description);
  }
  
  if (recipe.ingredients && recipe.ingredients.length > 0) {
    const ingredientText = recipe.ingredients
      .map(ing => ing.name || ing.name || '')
      .filter(name => name.length > 0)
      .join(', ');
    if (ingredientText) {
      textParts.push(`Ingredients: ${ingredientText}`);
    }
  }
  
  const combinedText = textParts.join('. ');
  return generateEmbedding(combinedText);
}
