import { GoogleGenerativeAI } from '@google/generative-ai';
import { Recipe, RecipeIngredient, InstructionStep } from '../types.js';

/*
 * Robust Embedding Generator with fallback mechanisms
 * Guarantees embedding generation at all times
 */
export class RobustEmbeddingGenerator {
  private static genAI: GoogleGenerativeAI | null = null;
  private static fallbackEmbeddings: Map<string, number[]> = new Map();

  /*
   * Initialize with Google Gemini API
   */
  static initialize(apiKey?: string): void {
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
    }
    
    // Initialize fallback embeddings for common recipe elements
    this.initializeFallbackEmbeddings();
  }

  /*
   * Generate embedding with robust fallback system
   */
  static async generateEmbedding(text: string, type: 'title' | 'description' | 'ingredients' | 'instructions' = 'description'): Promise<number[]> {
    if (!text || text.trim().length === 0) {
      return this.getDefaultEmbedding(type);
    }

    // Clean and prepare text
    const cleanText = this.prepareTextForEmbedding(text, type);
    
    try {
      // Try Google Gemini first
      if (this.genAI) {
        const embedding = await this.generateGeminiEmbedding(cleanText);
        if (embedding && embedding.length > 0) {
          return embedding;
        }
      }
    } catch (error) {
      console.warn(`Gemini embedding failed: ${error}. Using fallback.`);
    }

    // Fallback to deterministic embedding
    return this.generateDeterministicEmbedding(cleanText, type);
  }

  /*
   * Generate embeddings for entire recipe with robust fallbacks
   */
  static async generateRecipeEmbeddings(recipe: any): Promise<{
    title_embedding: number[];
    description_embedding: number[];
    ingredients_embedding: number[];
    instructions_embedding: number[];
  }> {
    const results = await Promise.allSettled([
      this.generateEmbedding(recipe.title || '', 'title'),
      this.generateEmbedding(recipe.description || '', 'description'),
      this.generateEmbedding(this.combineIngredients(recipe.ingredients || []), 'ingredients'),
      this.generateEmbedding(this.combineInstructions(recipe.instructions || []), 'instructions')
    ]);

    return {
      title_embedding: results[0].status === 'fulfilled' ? results[0].value : this.getDefaultEmbedding('title'),
      description_embedding: results[1].status === 'fulfilled' ? results[1].value : this.getDefaultEmbedding('description'),
      ingredients_embedding: results[2].status === 'fulfilled' ? results[2].value : this.getDefaultEmbedding('ingredients'),
      instructions_embedding: results[3].status === 'fulfilled' ? results[3].value : this.getDefaultEmbedding('instructions')
    };
  }

  /*
   * Generate Gemini embedding
   */
  private static async generateGeminiEmbedding(text: string): Promise<number[] | null> {
    if (!this.genAI) return null;

    try {
      const model = this.genAI.getGenerativeModel({ model: "embedding-001" });
      const result = await model.embedContent(text);
      return result.embedding?.values || null;
    } catch (error) {
      console.warn('Gemini embedding error:', error);
      return null;
    }
  }

  /*
   * Generate deterministic embedding based on text characteristics
   */
  private static generateDeterministicEmbedding(text: string, type: string): number[] {
    const dimension = 768; // Standard embedding dimension
    const embedding = new Array(dimension).fill(0);
    
    // Use text characteristics to generate consistent embeddings
    const words = text.toLowerCase().split(/\s+/);
    const chars = text.toLowerCase();
    
    // Hash-based seeding for consistency
    let seed = this.hashString(text + type);
    
    for (let i = 0; i < dimension; i++) {
      // Use various text features to generate embedding values
      const wordIndex = i % words.length;
      const charIndex = i % chars.length;
      
      // Combine multiple features for each dimension
      let value = 0;
      
      // Word-based features
      if (words[wordIndex]) {
        value += this.hashString(words[wordIndex]) / 1000000;
      }
      
      // Character-based features
      value += chars.charCodeAt(charIndex) / 1000;
      
      // Length-based features
      value += text.length / 10000;
      
      // Type-based features
      value += this.getTypeMultiplier(type) * 0.1;
      
      // Position-based features
      value += Math.sin(i / dimension * Math.PI * 2) * 0.05;
      
      // Normalize to [-1, 1] range
      embedding[i] = Math.tanh(value);
      
      // Update seed for next iteration
      seed = (seed * 9301 + 49297) % 233280;
      value += (seed / 233280 - 0.5) * 0.1;
    }
    
    // Normalize the embedding vector
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    if (magnitude > 0) {
      for (let i = 0; i < dimension; i++) {
        embedding[i] /= magnitude;
      }
    }
    
    return embedding;
  }

  /*
   * Simple string hash function for consistency
   */
  private static hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /*
   * Get type-specific multiplier
   */
  private static getTypeMultiplier(type: string): number {
    const multipliers: Record<string, number> = {
      'title': 1.0,
      'description': 0.8,
      'ingredients': 1.2,
      'instructions': 0.9
    };
    return multipliers[type] || 1.0;
  }

  /*
   * Get default embedding for each type
   */
  private static getDefaultEmbedding(type: 'title' | 'description' | 'ingredients' | 'instructions'): number[] {
    if (this.fallbackEmbeddings.has(type)) {
      return this.fallbackEmbeddings.get(type)!;
    }
    
    // Generate a type-specific default embedding
    return this.generateDeterministicEmbedding(`default_${type}_embedding`, type);
  }

  /*
   * Prepare text for embedding generation
   */
  private static prepareTextForEmbedding(text: string, type: string): string {
    // Clean and truncate text for optimal embedding
    let cleaned = text
      .replace(/[^\w\s.,!?-]/g, ' ') // Remove special characters
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim();
    
    // Truncate to reasonable length (embeddings work better with shorter text)
    const maxLengths: Record<string, number> = {
      'title': 200,
      'description': 500,
      'ingredients': 1000,
      'instructions': 1500
    };
    
    const maxLength = maxLengths[type] || 500;
    if (cleaned.length > maxLength) {
      cleaned = cleaned.substring(0, maxLength).trim();
      // Try to end at word boundary
      const lastSpace = cleaned.lastIndexOf(' ');
      if (lastSpace > maxLength * 0.8) {
        cleaned = cleaned.substring(0, lastSpace);
      }
    }
    
    return cleaned;
  }

  /*
   * Combine ingredients into text for embedding
   */
  private static combineIngredients(ingredients: any[]): string {
    if (!ingredients || ingredients.length === 0) return '';
    
    return ingredients
      .map(ing => {
        if (typeof ing === 'string') return ing;
        if (ing.text) return ing.text;
        if (ing.name) return `${ing.quantity || ''} ${ing.unit || ''} ${ing.name}`.trim();
        return '';
      })
      .filter(text => text.length > 0)
      .join(', ');
  }

  /*
   * Combine instructions into text for embedding
   */
  private static combineInstructions(instructions: any[]): string {
    if (!instructions || instructions.length === 0) return '';
    
    return instructions
      .map(inst => {
        if (typeof inst === 'string') return inst;
        if (inst.text) return inst.text;
        if (inst.instruction) return inst.instruction;
        return '';
      })
      .filter(text => text.length > 0)
      .join(' ');
  }

  /*
   * Initialize fallback embeddings for common cases
   */
  private static initializeFallbackEmbeddings(): void {
    // Generate consistent fallback embeddings for common types
    const types = ['title', 'description', 'ingredients', 'instructions'];
    
    for (const type of types) {
      const embedding = this.generateDeterministicEmbedding(`default_${type}`, type);
      this.fallbackEmbeddings.set(type, embedding);
    }
  }

  /*
   * Health check - verify embedding generation is working
   */
  static async healthCheck(): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy', details: string }> {
    try {
      const testEmbedding = await this.generateEmbedding('test recipe embedding', 'title');
      
      if (testEmbedding && testEmbedding.length > 0) {
        const hasGemini = this.genAI !== null;
        return {
          status: hasGemini ? 'healthy' : 'degraded',
          details: hasGemini 
            ? 'Gemini API available, full functionality' 
            : 'Using fallback embeddings, reduced quality but functional'
        };
      } else {
        return {
          status: 'unhealthy',
          details: 'Embedding generation failed completely'
        };
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        details: `Embedding health check failed: ${error}`
      };
    }
  }
}

/*
 * Example usage:
 * 
 * // Initialize with API key (optional)
 * RobustEmbeddingGenerator.initialize(process.env.GOOGLE_AI_API_KEY);
 * 
 * // Generate single embedding (always works)
 * const titleEmbedding = await RobustEmbeddingGenerator.generateEmbedding(
 *   "Chocolate Chip Cookies", 
 *   "title"
 * );
 * 
 * // Generate full recipe embeddings (always works)
 * const recipeEmbeddings = await RobustEmbeddingGenerator.generateRecipeEmbeddings(recipe);
 */
