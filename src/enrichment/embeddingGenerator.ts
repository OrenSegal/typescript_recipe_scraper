// Import types only if needed for type checking, attempt dynamic import at runtime
import type { Recipe } from '../types.js';

// Flag to determine if we should even attempt to load transformers
const ENABLE_EMBEDDINGS = true; // Re-enabled since we've addressed the sharp dependency issues

// Use a singleton pattern but make it entirely optional
class EmbeddingPipeline {
  static task: 'feature-extraction' = 'feature-extraction';
  static model = 'Xenova/all-MiniLM-L6-v2';
  static instance: any | null = null;

  static async getInstance(progress_callback?: Function) {
    if (!ENABLE_EMBEDDINGS) {
      console.log('[Embeddings] Embeddings are disabled, skipping model loading');
      return null;
    }

    if (this.instance === null) {
      try {
        console.log('[Embeddings] Attempting to load model...');
        // Dynamically import to prevent build-time dependency issues
        // @ts-ignore - @xenova/transformers may not be installed (optional dependency)
        const transformers = await import('@xenova/transformers').catch(err => {
          console.warn('[Embeddings] Failed to load transformers module:', err.message);
          return null;
        });
        
        if (!transformers) return null;
        
        this.instance = await transformers.pipeline(this.task, this.model, { progress_callback });
        console.log('[Embeddings] Model loaded successfully.');
      } catch (error) {
        console.warn('[Embeddings] Error loading model:', error instanceof Error ? error.message : String(error));
        return null;
      }
    }
    return this.instance;
  }
}

/*
 * Generates a 384-dimension vector embedding for a recipe.
 * When embeddings are disabled, returns null.
 * @param recipe The recipe data.
 * @returns A promise that resolves to an array of numbers (the vector) or null.
 */
export async function generateRecipeEmbedding(recipe: Partial<Recipe>): Promise<number[] | null> {
  // Early return if embeddings are disabled
  if (!ENABLE_EMBEDDINGS) {
    console.log('[Embeddings] Embeddings are disabled, skipping generation');
    return null;
  }
  
  try {
    if (!recipe.title || !recipe.ingredients || recipe.ingredients.length === 0) {
      console.warn('[Embeddings] Cannot generate embedding: missing title or ingredients.');
      return null;
    }

    const ingredientsText = recipe.ingredients.join(', ');
    const textToEmbed = `Recipe: ${recipe.title}. Cuisine: ${recipe.cuisines?.join(', ')}. Ingredients: ${ingredientsText}.`;

    const extractor = await EmbeddingPipeline.getInstance();
    
    if (!extractor) {
      console.log('[Embeddings] Embedding model not available, skipping generation');
      return null;
    }

    const output = await extractor(textToEmbed, { pooling: 'mean', normalize: true });
    console.log('[Embeddings] Successfully generated embedding');
    return Array.from(output.data);
    
  } catch (error) {
    if (error instanceof Error) {
      console.error('[Embeddings] Failed to generate embedding:', error.message);
    } else {
      console.error('[Embeddings] Failed to generate embedding with unknown error');
    }
    return null;
  }
}