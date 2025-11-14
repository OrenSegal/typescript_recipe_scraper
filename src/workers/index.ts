/**
 * Cloudflare Workers Entry Point
 *
 * This worker provides the Recipe Scraper API with:
 * - Zero egress fees (Workers + R2 on same network)
 * - Global edge deployment (275+ locations)
 * - Ultra-low latency (<50ms globally)
 * - Auto-scaling to millions of requests
 *
 * Architecture: Cloudflare Workers + R2 + Supabase PostgreSQL
 * Cost: ~$45-55/month at 100k DAU
 */

import { RecipeScraperIntegration } from '../storage/RecipeScraperIntegration.js';
import { CloudStorageService } from './CloudStorageServiceWorker.js';
import { createClient } from '@supabase/supabase-js';

// Environment bindings (injected by Cloudflare)
interface Env {
  RECIPE_IMAGES: R2Bucket;  // R2 bucket binding - zero egress!
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SUPABASE_ANON_KEY: string;
  ENVIRONMENT: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Route handling
      if (url.pathname === '/health' || url.pathname === '/') {
        return handleHealth(env, corsHeaders);
      }

      if (url.pathname === '/api/scrape' && request.method === 'POST') {
        return handleScrape(request, env, corsHeaders);
      }

      if (url.pathname === '/api/upload' && request.method === 'POST') {
        return handleUpload(request, env, corsHeaders);
      }

      if (url.pathname.startsWith('/api/images/')) {
        return handleImageRequest(url, env, corsHeaders);
      }

      if (url.pathname === '/api/storage/stats') {
        return handleStorageStats(env, corsHeaders);
      }

      return new Response('Not Found', { status: 404, headers: corsHeaders });

    } catch (error) {
      console.error('Worker error:', error);
      return new Response(
        JSON.stringify({
          error: 'Internal Server Error',
          message: error instanceof Error ? error.message : 'Unknown error'
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
  },
};

/**
 * Health check endpoint
 */
async function handleHealth(env: Env, corsHeaders: Record<string, string>): Promise<Response> {
  return new Response(
    JSON.stringify({
      status: 'healthy',
      service: 'recipe-scraper-api',
      environment: env.ENVIRONMENT || 'production',
      timestamp: new Date().toISOString(),
      deployment: 'cloudflare-workers',
      storage: 'cloudflare-r2',
      database: 'supabase-postgresql',
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

/**
 * Handle recipe scraping with automatic image processing
 */
async function handleScrape(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const body = await request.json() as { url: string };

  if (!body.url) {
    return new Response(
      JSON.stringify({ error: 'URL is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Initialize storage service with R2 binding
  const storageService = new CloudStorageService(env.RECIPE_IMAGES, {
    supabaseUrl: env.SUPABASE_URL,
    supabaseKey: env.SUPABASE_SERVICE_ROLE_KEY,
  });

  // Initialize scraper integration
  const integration = new RecipeScraperIntegration(storageService);

  // Scrape recipe (this would call your existing scraper)
  // For now, return a stub - you'll integrate your actual scraper
  const recipe = {
    id: crypto.randomUUID(),
    title: 'Example Recipe',
    url: body.url,
    imageUrl: 'https://example.com/image.jpg',
  };

  // Process images with automatic WebP conversion
  const result = await integration.processRecipeImages(recipe);

  return new Response(
    JSON.stringify(result),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

/**
 * Handle direct image upload
 */
async function handleUpload(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const formData = await request.formData();
  const file = formData.get('image') as File;

  if (!file) {
    return new Response(
      JSON.stringify({ error: 'Image file is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const storageService = new CloudStorageService(env.RECIPE_IMAGES, {
    supabaseUrl: env.SUPABASE_URL,
    supabaseKey: env.SUPABASE_SERVICE_ROLE_KEY,
  });

  const buffer = await file.arrayBuffer();
  const result = await storageService.uploadImage(
    Buffer.from(buffer),
    file.name,
    {
      recipeId: formData.get('recipeId') as string || undefined,
      description: formData.get('description') as string || undefined,
      convertToWebP: true,
      generateThumbnails: true,
    }
  );

  return new Response(
    JSON.stringify(result),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

/**
 * Handle image retrieval from R2
 */
async function handleImageRequest(
  url: URL,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const imagePath = url.pathname.replace('/api/images/', '');

  // Get image directly from R2 (zero egress fees!)
  const object = await env.RECIPE_IMAGES.get(imagePath);

  if (!object) {
    return new Response('Image not found', { status: 404, headers: corsHeaders });
  }

  // Return image with appropriate caching headers
  return new Response(object.body, {
    headers: {
      ...corsHeaders,
      'Content-Type': object.httpMetadata?.contentType || 'image/webp',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'ETag': object.httpEtag,
    },
  });
}

/**
 * Get storage statistics
 */
async function handleStorageStats(
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  // Query storage stats from Supabase
  const { data, error } = await supabase
    .from('recipe_images')
    .select('*', { count: 'exact' });

  if (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({
      totalImages: data?.length || 0,
      timestamp: new Date().toISOString(),
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}
