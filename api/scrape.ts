import express, { Request, Response, Application } from 'express';
import { scrapeWebsite } from '../src/scrapers/websiteScraper.js';
import { processAndSaveRecipe } from '../src/database.js';

const app = express();
app.use(express.json());

// Recipe scraping endpoint
app.post('/api/scrape', async (req: express.Request, res: express.Response) => {
  try {
    const { url, options } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'A valid URL is required' });
    }

    const finalOptions = {
        include_ai: options?.include_ai_enrichment === true,
        include_nutrition: options?.include_nutrition === true,
        generate_embedding: options?.generate_embedding === true,
    };

    console.log(`[API] Scraping started for: ${url}`);
    
    // 1. Get the raw, unstructured data from the scraper.
    const rawRecipe = await scrapeWebsite(url);

    // 2. Pass the raw data to the orchestrator to be processed and saved.
    // Note: processAndSaveRecipe may return void, so we handle that case
    await processAndSaveRecipe(rawRecipe, url, finalOptions);

    // Since processAndSaveRecipe returns void, we just confirm success
    return res.status(201).json({ 
      message: 'Recipe processed successfully', 
      url: url,
      processed_at: new Date().toISOString()
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    console.error('[API ERROR]', errorMessage);
    return res.status(500).json({ error: errorMessage });
  }
});

// Health check endpoint
app.get('/api/health', (req: express.Request, res: express.Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Recipe scraping API server running on port ${PORT}`);
});