/*
 * Embedding Generation Utility for Supabase Edge Functions
 * 
 * Deno-compatible utility for generating embeddings using Google's Gemini embedding model
 */

/*
 * Generate embedding for text using Google's Gemini embedding model
 * Compatible with Deno runtime in Supabase Edge Functions
 */
export async function generateEmbedding(text: string): Promise<{ data: number[] | null; error: Error | null }> {
  const GOOGLE_API_KEY = Deno.env.get('EMBEDDING_API_KEY') || Deno.env.get('GOOGLE_API_KEY');
  
  if (!GOOGLE_API_KEY) {
    return {
      data: null,
      error: new Error('Gemini API key not available for embeddings')
    };
  }
  
  try {
    // Use Google's Gemini embedding API directly with fetch (Deno compatible)
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/embedding-001:embedContent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': GOOGLE_API_KEY,
      },
      body: JSON.stringify({
        model: 'models/embedding-001',
        content: {
          parts: [{ text }]
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini API responded with status ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    
    if (!result.embedding || !result.embedding.values) {
      throw new Error('No embedding values returned from Gemini API');
    }
    
    return {
      data: result.embedding.values,
      error: null
    };
  } catch (error) {
    console.warn(`Failed to generate Gemini embedding for text: "${text.substring(0, 50)}..."`, error);
    return {
      data: null,
      error: error instanceof Error ? error : new Error(String(error))
    };
  }
}

/*
 * Generate embedding for a complete recipe object
 * Compatible with Deno runtime in Supabase Edge Functions
 */
export async function generateRecipeEmbedding(recipe: {
  title: string;
  description?: string;
  ingredients?: Array<{ name?: string; name?: string; }>;
}): Promise<{ data: number[] | null; error: Error | null }> {
  // Create a comprehensive text representation of the recipe
  const textParts = [recipe.title];
  
  if (recipe.description) {
    textParts.push(recipe.description);
  }
  
  if (recipe.ingredients && recipe.ingredients.length > 0) {
    const ingredientNames = recipe.ingredients
      .map(ingredient => ingredient.name || ingredient.name)
      .filter(Boolean)
      .join(', ');
    textParts.push(`Ingredients: ${ingredientNames}`);
  }
  
  const fullText = textParts.join('. ');
  return await generateEmbedding(fullText);
}
