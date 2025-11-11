import { createServer } from 'http';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables for Node.js
dotenv.config();

// Config for Node.js environment
const config = {
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY
};

const supabase = createClient(config.supabaseUrl!, config.supabaseServiceKey!);

const server = createServer(async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.setHeader('Content-Type', 'application/json');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  try {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const recipeId = url.searchParams.get('id');
    
    if (recipeId) {
      // Fetch a specific recipe by ID
      const { data, error } = await supabase
        .from('recipes')
        .select('*')
        .eq('id', recipeId)
        .single();
      
      if (error) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: `Failed to fetch recipe: ${error.message}` }));
        return;
      }
      
      if (!data) {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: 'Recipe not found' }));
        return;
      }
      
      res.statusCode = 200;
      res.end(JSON.stringify({ recipe: data }));
    } else {
      // Fetch all recipes with pagination
      const page = parseInt(url.searchParams.get('page') || '1', 10);
      const limit = parseInt(url.searchParams.get('limit') || '10', 10);
      const offset = (page - 1) * limit;
      
      const { data, error, count } = await supabase
        .from('recipes')
        .select('*', { count: 'exact' })
        .range(offset, offset + limit - 1);
      
      if (error) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: `Failed to fetch recipes: ${error.message}` }));
        return;
      }
      
      res.statusCode = 200;
      res.end(JSON.stringify({
        recipes: data,
        pagination: {
          page,
          limit,
          total: count,
          totalPages: Math.ceil((count || 0) / limit)
        }
      }));
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    console.error('[API ERROR]', errorMessage);
    res.statusCode = 500;
    res.end(JSON.stringify({ error: errorMessage }));
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Recipe API server running on port ${PORT}`);
});
