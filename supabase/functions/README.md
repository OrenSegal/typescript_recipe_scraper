# Supabase Edge Functions

This directory contains the Edge Functions for the TypeScript Scraper Service.

## Available Functions

1. **scrape-function**
   - Handles web scraping of recipe data
   - Accepts a URL and returns structured recipe data
   - Can generate embeddings using the embed-function

2. **embed-function**
   - Generates embeddings for recipe data
   - Used internally by scrape-function
   - Can be called directly for custom embedding needs

## Development Setup

1. Install the Supabase CLI:
   ```bash
   brew install supabase/tap/supabase
   ```

2. Log in to your Supabase account:
   ```bash
   supabase login
   ```

3. Link your project (if not already linked):
   ```bash
   supabase link --project-ref your-project-ref
   ```

4. Set up environment variables in `.env` files in each function directory.

## Deployment

Deploy all functions:
```bash
supabase functions deploy --project-ref your-project-ref
```

Deploy a specific function:
```bash
supabase functions deploy function-name --project-ref your-project-ref
```

## Testing Locally

1. Start the Supabase emulator:
   ```bash
   supabase start
   ```

2. Test a function locally:
   ```bash
   supabase functions serve function-name
   ```

## Environment Variables

Required environment variables for all functions:
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key

Optional environment variables:
- `GOOGLE_API_KEY`: For Google services (if used)
- `USDA_API_KEY`: For USDA API (if used)
- `IMGUR_CLIENT_ID`: For Imgur uploads (if used)
