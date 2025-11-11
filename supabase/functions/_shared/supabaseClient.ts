import { createClient } from '@supabase/supabase-js';

// Get environment variables from Deno runtime or process.env for local development
const getEnv = (key: string): string => {
  // Try Deno.env first
  try {
    // @ts-ignore - Deno is available at runtime
    if (typeof Deno !== 'undefined' && typeof Deno.env?.get === 'function') {
      // @ts-ignore
      return Deno.env.get(key) || '';
    }
  } catch (e) {
    // Ignore Deno not available error
  }
  
  // Fall back to process.env for local development
  // @ts-ignore - process is available in Node.js
  return typeof process !== 'undefined' && process.env?.[key] || '';
};

const supabaseUrl = getEnv('SUPABASE_URL');
const supabaseKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing required environment variables: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
}

// Initialize the Supabase client
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  global: {
    // Use the global fetch implementation
    fetch: (...args: Parameters<typeof fetch>) => fetch(...args),
  },
});