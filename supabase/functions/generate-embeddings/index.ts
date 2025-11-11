import { serve } from 'https://deno.land/std@0.192.0/http/server.ts';
import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai@0.24.1';

console.log('INFO: "generate-embedding" function initialized.');

/*
 * This function provides a dedicated endpoint to generate vector embeddings.
 * It acts as a proxy to the pg_vectorize 'embed' remote procedure call (RPC)
 * in the Supabase database, ensuring consistent model usage and security.
 *
 * Prerequisite: `vector` and `vectorize` extensions enabled in Supabase,
 * and `vectorize.init()` has been run.
 */
serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  try {
    if (req.method !== 'POST') {
      throw new Error(`Method ${req.method} not allowed. Please use POST.`);
    }

    const { text } = await req.json();

    if (!text || typeof text !== 'string' || text.trim() === '') {
      throw new Error('Request body must contain a non-empty "text" property of type string.');
    }

    console.log(`INFO: Generating embedding for text starting with: "${text.substring(0, 50)}..."`);

    // Call the database function to generate the embedding.
    const embedding = await generateEmbedding(text);

    if (!embedding) {
      console.error('Embedding RPC Error:', 'Failed to generate embedding');
      throw new Error(`Failed to generate embedding`);
    }

    console.log('INFO: Embedding generated successfully.');

    return new Response(
      JSON.stringify({ embedding }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      }
    );
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
    console.error('CRITICAL ERROR in generate-embedding:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 400, // Client-side errors (bad request)
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }

async function generateEmbedding(text: string): Promise<number[] | null> {
  const GOOGLE_API_KEY = Deno.env.get('EMBEDDING_API_KEY') || Deno.env.get('GOOGLE_API_KEY');
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
});