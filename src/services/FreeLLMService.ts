/**
 * Free LLM Service
 * Integrates multiple free LLM APIs as fallbacks for recipe enhancement
 *
 * Free LLM APIs used:
 * 1. Hugging Face Inference API (Free tier: 30k characters/month)
 * 2. Together AI (Free tier: $25 credits)
 * 3. Groq (Free tier: High rate limits)
 * 4. Ollama (Local, completely free)
 */

import { Recipe } from '../types.js';

export interface LLMResponse {
  success: boolean;
  data?: any;
  error?: string;
  provider: string;
  tokensUsed?: number;
}

export interface RecipeEnhancementRequest {
  recipe: Partial<Recipe>;
  fields: ('description' | 'tags' | 'cuisines' | 'meal_types' | 'cooking_tips')[];
}

export class FreeLLMService {

  private static providers = [
    { name: 'groq', enabled: !!process.env.GROQ_API_KEY },
    { name: 'together', enabled: !!process.env.TOGETHER_API_KEY },
    { name: 'huggingface', enabled: !!process.env.HUGGINGFACE_API_KEY },
    { name: 'ollama', enabled: process.env.USE_OLLAMA === 'true' }
  ];

  /**
   * Enhance recipe using free LLMs with fallback chain
   */
  static async enhanceRecipe(request: RecipeEnhancementRequest): Promise<LLMResponse> {
    console.log(`🤖 Enhancing recipe "${request.recipe.title}" with free LLMs...`);

    // Try each provider in order until one succeeds
    for (const provider of this.providers) {
      if (!provider.enabled) {
        console.log(`⏭️  Skipping ${provider.name} (not configured)`);
        continue;
      }

      try {
        console.log(`🔄 Trying ${provider.name}...`);
        const response = await this.callProvider(provider.name, request);

        if (response.success) {
          console.log(`✅ Successfully enhanced with ${provider.name}`);
          return response;
        }
      } catch (error) {
        console.warn(`⚠️  ${provider.name} failed:`, error);
        continue;
      }
    }

    return {
      success: false,
      error: 'All LLM providers failed or none configured',
      provider: 'none'
    };
  }

  /**
   * Call specific LLM provider
   */
  private static async callProvider(
    providerName: string,
    request: RecipeEnhancementRequest
  ): Promise<LLMResponse> {

    switch (providerName) {
      case 'groq':
        return await this.callGroq(request);
      case 'together':
        return await this.callTogether(request);
      case 'huggingface':
        return await this.callHuggingFace(request);
      case 'ollama':
        return await this.callOllama(request);
      default:
        throw new Error(`Unknown provider: ${providerName}`);
    }
  }

  /**
   * Groq API (Free tier: Fastest inference, high rate limits)
   * Models: llama3-8b-8192, mixtral-8x7b-32768, gemma-7b-it
   */
  private static async callGroq(request: RecipeEnhancementRequest): Promise<LLMResponse> {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error('GROQ_API_KEY not set');

    const prompt = this.buildPrompt(request);

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama3-8b-8192', // Fast and free
        messages: [
          {
            role: 'system',
            content: 'You are a culinary expert helping to enhance recipe data. Respond with valid JSON only.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      throw new Error(`Groq API error: ${response.statusText}`);
    }

    const result = await response.json();
    const content = result.choices[0]?.message?.content;

    if (!content) {
      throw new Error('No content in Groq response');
    }

    // Parse JSON response
    const enhancedData = JSON.parse(content);

    return {
      success: true,
      data: enhancedData,
      provider: 'groq',
      tokensUsed: result.usage?.total_tokens
    };
  }

  /**
   * Together AI (Free tier: $25 credits, many open models)
   * Models: Llama-2-7B, Mistral-7B, etc.
   */
  private static async callTogether(request: RecipeEnhancementRequest): Promise<LLMResponse> {
    const apiKey = process.env.TOGETHER_API_KEY;
    if (!apiKey) throw new Error('TOGETHER_API_KEY not set');

    const prompt = this.buildPrompt(request);

    const response = await fetch('https://api.together.xyz/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
        messages: [
          {
            role: 'system',
            content: 'You are a culinary expert. Respond with valid JSON only.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      throw new Error(`Together API error: ${response.statusText}`);
    }

    const result = await response.json();
    const content = result.choices[0]?.message?.content;

    if (!content) {
      throw new Error('No content in Together response');
    }

    const enhancedData = JSON.parse(content);

    return {
      success: true,
      data: enhancedData,
      provider: 'together',
      tokensUsed: result.usage?.total_tokens
    };
  }

  /**
   * Hugging Face Inference API (Free tier: 30k chars/month)
   * Models: gpt2, bloom, flan-t5, etc.
   */
  private static async callHuggingFace(request: RecipeEnhancementRequest): Promise<LLMResponse> {
    const apiKey = process.env.HUGGINGFACE_API_KEY;
    if (!apiKey) throw new Error('HUGGINGFACE_API_KEY not set');

    const prompt = this.buildPrompt(request);

    // Use Mistral-7B-Instruct model on Hugging Face
    const response = await fetch(
      'https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.1',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: {
            max_new_tokens: 1000,
            temperature: 0.3,
            return_full_text: false
          }
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Hugging Face API error: ${response.statusText}`);
    }

    const result = await response.json();
    const content = result[0]?.generated_text;

    if (!content) {
      throw new Error('No content in Hugging Face response');
    }

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not extract JSON from Hugging Face response');
    }

    const enhancedData = JSON.parse(jsonMatch[0]);

    return {
      success: true,
      data: enhancedData,
      provider: 'huggingface'
    };
  }

  /**
   * Ollama (Local LLM, completely free but requires local setup)
   * Models: llama2, mistral, phi, etc.
   */
  private static async callOllama(request: RecipeEnhancementRequest): Promise<LLMResponse> {
    const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
    const model = process.env.OLLAMA_MODEL || 'llama2';

    const prompt = this.buildPrompt(request);

    const response = await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model,
        prompt: `You are a culinary expert. ${prompt}\n\nRespond with valid JSON only.`,
        stream: false,
        options: {
          temperature: 0.3,
          num_predict: 1000
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const result = await response.json();
    const content = result.response;

    if (!content) {
      throw new Error('No content in Ollama response');
    }

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not extract JSON from Ollama response');
    }

    const enhancedData = JSON.parse(jsonMatch[0]);

    return {
      success: true,
      data: enhancedData,
      provider: 'ollama'
    };
  }

  /**
   * Build prompt for LLM based on requested fields
   */
  private static buildPrompt(request: RecipeEnhancementRequest): string {
    const { recipe, fields } = request;

    let prompt = `Enhance this recipe with the following information:\n\n`;
    prompt += `Title: ${recipe.title}\n`;
    prompt += `Ingredients: ${recipe.ingredients?.map((i: any) => typeof i === 'string' ? i : i.text || i.name).join(', ')}\n`;
    prompt += `Instructions: ${recipe.instructions?.map((i: any) => typeof i === 'string' ? i : i.text).join(' ')}\n\n`;

    prompt += `Please provide the following fields in JSON format:\n`;

    if (fields.includes('description')) {
      prompt += `- "description": A compelling 2-3 sentence description of the recipe\n`;
    }
    if (fields.includes('tags')) {
      prompt += `- "tags": Array of 5-10 relevant tags (e.g., "comfort-food", "quick-meal", "family-friendly")\n`;
    }
    if (fields.includes('cuisines')) {
      prompt += `- "cuisines": Array of 1-3 cuisine types (e.g., "Italian", "Mexican", "Asian")\n`;
    }
    if (fields.includes('meal_types')) {
      prompt += `- "meal_types": Array of meal types (e.g., "breakfast", "lunch", "dinner", "dessert")\n`;
    }
    if (fields.includes('cooking_tips')) {
      prompt += `- "cooking_tips": Array of 2-3 helpful cooking tips for this recipe\n`;
    }

    prompt += `\nRespond with ONLY the JSON object, no additional text.`;

    return prompt;
  }

  /**
   * Check which providers are available
   */
  static getAvailableProviders(): string[] {
    return this.providers
      .filter(p => p.enabled)
      .map(p => p.name);
  }

  /**
   * Test all configured providers
   */
  static async testProviders(): Promise<{ [key: string]: boolean }> {
    const results: { [key: string]: boolean } = {};

    const testRecipe: RecipeEnhancementRequest = {
      recipe: {
        title: 'Chocolate Chip Cookies',
        ingredients: ['flour', 'butter', 'chocolate chips', 'sugar', 'eggs'],
        instructions: ['Mix ingredients', 'Bake at 350F for 12 minutes']
      },
      fields: ['tags']
    };

    for (const provider of this.providers) {
      if (!provider.enabled) {
        results[provider.name] = false;
        continue;
      }

      try {
        const response = await this.callProvider(provider.name, testRecipe);
        results[provider.name] = response.success;
      } catch (error) {
        console.error(`Provider ${provider.name} test failed:`, error);
        results[provider.name] = false;
      }
    }

    return results;
  }
}

export default FreeLLMService;
