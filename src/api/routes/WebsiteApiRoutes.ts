import { Router, Request, Response } from 'express';
import { WebsiteManager, RecipeWebsite } from '../../websiteManager.js';
import { UnifiedScraper } from '../../scrapers/UnifiedScraper.js';
import { BatchRecipeProcessor } from '../../batchRecipeProcessor.js';
import { DatabaseService } from '../../services/DatabaseService.js';
import { SitemapCrawler } from '../../crawler/SitemapCrawler.js';
import { ComprehensiveEnrichment } from '../../enrichment/comprehensiveEnrichment.js';
import pLimit from 'p-limit';

const router = Router();

/**
 * POST /api/websites/crawl
 * Crawl and scrape all recipes from a website
 */
router.post('/crawl', async (req: Request, res: Response) => {
  try {
    const { domain, depth = 3, limit, useSitemap = false, batchSize = 10 } = req.body;

    if (!domain) {
      return res.status(400).json({
        error: 'Missing required parameter: domain',
        timestamp: new Date().toISOString()
      });
    }

    const websiteManager = new WebsiteManager('data/recipe-websites.csv');
    await websiteManager.loadWebsites();
    
    const website = await websiteManager.getWebsiteByDomain(domain);
    if (!website) {
      return res.status(404).json({
        error: 'Website not found in configuration',
        domain,
        message: 'Add the website first using POST /api/websites',
        timestamp: new Date().toISOString()
      });
    }

    const scraper = new UnifiedScraper();
    const db = DatabaseService.getInstance();

    // Get recipe URLs using SitemapCrawler or depth-based crawling
    let recipeUrls: string[] = [];
    
    const crawler = new SitemapCrawler({
      concurrency: 10,
      requestTimeout: 30000,
      // Use a more precise pattern that ensures we're getting actual recipe pages, not category pages
      // This pattern matches common recipe URL structures like:
      // /recipe/recipe-name, /recipes/recipe-name, /food/recipes/recipe-name
      // But excludes category pages like /recipes/ or /recipes/category/
      recipeUrlPattern: /\/(recipe|recipes|food\/recipes)\/[a-z0-9\-]+(?:\/|$)/i
    });

    if (useSitemap && website.sitemapUrl) {
      console.log(`🕷️ Crawling sitemap: ${website.sitemapUrl}`);
      try {
        const crawlResult = await crawler.crawlWebsite({
          ...website,
          'Main Sitemap URL': website.sitemapUrl
        } as any);
        recipeUrls = crawlResult.recipeUrls || [];
        console.log(`✅ Found ${recipeUrls.length} recipe URLs from sitemap`);
      } catch (error) {
        console.error(`❌ Sitemap crawling failed, falling back to main URL:`, error);
        // Fall back to scraping main URL
        recipeUrls = [website.mainUrl];
      }
    } else {
      console.log(`🕷️ Using main URL for crawling: ${website.mainUrl}`);
      // For depth-based crawling, start with main URL and discover linked recipes
      recipeUrls = await crawlPagesWithDepth(website.mainUrl, depth || 3, limit);
      console.log(`✅ Found ${recipeUrls.length} recipe URLs via depth crawl`);
    }

    // Apply limit if specified
    if (limit && recipeUrls.length > limit) {
      recipeUrls = recipeUrls.slice(0, limit);
    }

    // Process recipes in batches
    const results = {
      domain,
      website: website.name,
      totalUrls: recipeUrls.length,
      successful: 0,
      failed: 0,
      startTime: new Date().toISOString(),
      endTime: null as string | null,
      recipes: [] as any[],
      errors: [] as string[]
    };

    // Create job ID for tracking
    const jobId = `crawl-${domain}-${Date.now()}`;
    
    // Store job info (in production, use Redis or similar)
    (global as any).crawlJobs = (global as any).crawlJobs || {};
    (global as any).crawlJobs[jobId] = {
      ...results,
      status: 'processing',
      progress: 0
    };

    // Send initial response with job started
    res.status(202).json({
      success: true,
      message: 'Crawling started',
      jobId,
      estimatedUrls: recipeUrls.length,
      startTime: results.startTime,
      statusUrl: `/api/websites/crawl/status/${jobId}`
    });

    // Process in background with robust error handling
    processCrawlInBackground(jobId, recipeUrls, scraper, db, results, batchSize).catch(error => {
      console.error(`❌ Background crawl failed for ${jobId}:`, error);
      if ((global as any).crawlJobs && (global as any).crawlJobs[jobId]) {
        (global as any).crawlJobs[jobId].status = 'failed';
        (global as any).crawlJobs[jobId].error = String(error);
      }
    });

  } catch (error) {
    console.error('Website crawling error:', error);
    res.status(500).json({
      error: 'Failed to start website crawling',
      message: String(error),
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/websites
 * Add a new website to the configuration
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, domain, mainUrl, testRecipeUrl, sitemapUrl, notes } = req.body;

    if (!name || !domain) {
      return res.status(400).json({
        error: 'Missing required parameters: name, domain',
        timestamp: new Date().toISOString()
      });
    }

    const websiteManager = new WebsiteManager('data/recipe-websites.csv');
    await websiteManager.loadWebsites();

    // Check if website already exists
    const existing = await websiteManager.getWebsiteByDomain(domain);
    if (existing) {
      return res.status(409).json({
        error: 'Website already exists',
        domain,
        existing,
        timestamp: new Date().toISOString()
      });
    }

    const website: RecipeWebsite = {
      name,
      domain,
      mainUrl: mainUrl || `https://${domain}`,
      testRecipeUrl,
      sitemapUrl,
      status: 'active',
      crawlable: true,
      notes: notes || `Added via API on ${new Date().toISOString()}`
    };

    websiteManager.addWebsite(website);
    await websiteManager.saveToCSV();

    res.status(201).json({
      success: true,
      message: 'Website added successfully',
      website,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Website addition error:', error);
    res.status(500).json({
      error: 'Failed to add website',
      message: String(error),
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/websites
 * List all configured websites
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { activeOnly = false } = req.query;

    const websiteManager = new WebsiteManager('data/recipe-websites.csv');
    await websiteManager.loadWebsites();

    let websites = await websiteManager.getAllWebsites();
    
    if (activeOnly === 'true') {
      websites = websites.filter(w => w.status === 'active');
    }

    res.json({
      success: true,
      count: websites.length,
      websites,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Website listing error:', error);
    res.status(500).json({
      error: 'Failed to list websites',
      message: String(error),
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * PUT /api/websites/:domain
 * Update a website configuration
 */
router.put('/:domain', async (req: Request, res: Response) => {
  try {
    const { domain } = req.params;
    const updates = req.body;

    const websiteManager = new WebsiteManager('data/recipe-websites.csv');
    await websiteManager.loadWebsites();

    const websites = await websiteManager.getAllWebsites();
    const websiteIndex = websites.findIndex(w => w.domain === domain);

    if (websiteIndex === -1) {
      return res.status(404).json({
        error: 'Website not found',
        domain,
        timestamp: new Date().toISOString()
      });
    }

    // Update website properties
    const website = websites[websiteIndex];
    Object.assign(website, updates);
    
    await websiteManager.saveToCSV();

    res.json({
      success: true,
      message: 'Website updated successfully',
      website,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Website update error:', error);
    res.status(500).json({
      error: 'Failed to update website',
      message: String(error),
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * DELETE /api/websites/:domain
 * Remove a website from configuration
 */
router.delete('/:domain', async (req: Request, res: Response) => {
  try {
    const { domain } = req.params;

    const websiteManager = new WebsiteManager('data/recipe-websites.csv');
    await websiteManager.loadWebsites();

    const websites = await websiteManager.getAllWebsites();
    const websiteIndex = websites.findIndex(w => w.domain === domain);

    if (websiteIndex === -1) {
      return res.status(404).json({
        error: 'Website not found',
        domain,
        timestamp: new Date().toISOString()
      });
    }

    // Remove website
    const removedWebsite = websites.splice(websiteIndex, 1)[0];
    await websiteManager.saveToCSV();

    res.json({
      success: true,
      message: 'Website removed successfully',
      removedWebsite,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Website deletion error:', error);
    res.status(500).json({
      error: 'Failed to delete website',
      message: String(error),
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/websites/batch
 * Run batch processing on configured websites
 */
router.post('/batch', async (req: Request, res: Response) => {
  try {
    const { dryRun = false, parallel = 3 } = req.body;

    if (dryRun) {
      const websiteManager = new WebsiteManager('data/recipe-websites.csv');
      await websiteManager.loadWebsites();
      const websites = await websiteManager.getActiveWebsites();

      return res.json({
        success: true,
        dryRun: true,
        message: 'Batch processing preview',
        websitesToProcess: websites.map(w => ({
          name: w.name,
          domain: w.domain,
          mainUrl: w.mainUrl,
          testRecipeUrl: w.testRecipeUrl
        })),
        estimatedTotal: websites.length,
        timestamp: new Date().toISOString()
      });
    }

    // Start batch processing
    res.status(202).json({
      success: true,
      message: 'Batch processing started',
      jobId: `batch-${Date.now()}`,
      startTime: new Date().toISOString()
    });

    // Run batch processing in background
    const processor = new BatchRecipeProcessor();
    processor.run().catch(error => {
      console.error('Batch processing failed:', error);
    });

  } catch (error) {
    console.error('Batch processing error:', error);
    res.status(500).json({
      error: 'Failed to start batch processing',
      message: String(error),
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Helper function to crawl pages with depth limit
 */
async function crawlPagesWithDepth(
  startUrl: string,
  maxDepth: number,
  limit?: number
): Promise<string[]> {
  const visited = new Set<string>();
  const toVisit: { url: string; depth: number }[] = [{ url: startUrl, depth: 0 }];
  const recipeUrls: string[] = [];
  const recipePattern = /(recipe|recipes|cooking|dish|meal)/i;
  
  const concurrencyLimit = pLimit(5);
  
  while (toVisit.length > 0 && (!limit || recipeUrls.length < limit)) {
    const batch = toVisit.splice(0, 10);
    
    await Promise.all(batch.map(({ url, depth }) => 
      concurrencyLimit(async () => {
        if (visited.has(url) || depth > maxDepth) return;
        visited.add(url);
        
        try {
          const response = await fetch(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; RecipeCrawler/1.0)'
            }
          });
          
          if (!response.ok) return;
          
          const html = await response.text();
          
          // Check if this is a recipe page
          if (recipePattern.test(url) || recipePattern.test(html.substring(0, 5000))) {
            recipeUrls.push(url);
          }
          
          // Extract links for further crawling
          if (depth < maxDepth) {
            const linkPattern = /<a[^>]+href="([^"]+)"/gi;
            let match;
            while ((match = linkPattern.exec(html)) !== null) {
              try {
                const linkedUrl = new URL(match[1], url).href;
                const linkedDomain = new URL(linkedUrl).hostname;
                const baseDomain = new URL(url).hostname;
                
                // Only follow links on same domain
                if (linkedDomain === baseDomain && !visited.has(linkedUrl)) {
                  toVisit.push({ url: linkedUrl, depth: depth + 1 });
                }
              } catch {}
            }
          }
        } catch (error) {
          console.error(`Error crawling ${url}:`, error);
        }
      })
    ));
  }
  
  return recipeUrls;
}

/**
 * Helper function to process crawling in background with enrichment
 */
async function processCrawlInBackground(
  jobId: string,
  recipeUrls: string[],
  scraper: UnifiedScraper,
  db: DatabaseService,
  results: any,
  batchSize: number
): Promise<void> {
  const concurrencyLimit = pLimit(batchSize || 10);
  
  // Process all URLs with concurrency control and enrichment
  await Promise.all(
    recipeUrls.map((url, index) => 
      concurrencyLimit(async () => {
        try {
          // Update progress
          if ((global as any).crawlJobs && (global as any).crawlJobs[jobId]) {
            (global as any).crawlJobs[jobId].progress = Math.round((index / recipeUrls.length) * 100);
          }
          
          // Scrape recipe with retries
          let scrapingResult;
          let retries = 3;
          while (retries > 0) {
            scrapingResult = await scraper.scrapeRecipe(url);
            if (scrapingResult.success && scrapingResult.recipe) break;
            retries--;
            if (retries > 0) {
              console.log(`⚠️ Retry ${4 - retries}/3 for ${url}`);
              await new Promise(resolve => setTimeout(resolve, 2000 * (4 - retries)));
            }
          }
          
          if (scrapingResult?.success && scrapingResult.recipe) {
            // Enrich recipe before saving
            const enrichedRecipe = await ComprehensiveEnrichment.enrichRecipe(scrapingResult.recipe);
            
            // Save with deduplication
            const savedRecipe = await db.saveRecipe(enrichedRecipe);
            
            results.successful++;
            results.recipes.push(savedRecipe);
            console.log(`✅ Saved: ${savedRecipe.title || url}`);
          } else {
            results.failed++;
            results.errors.push(`Failed after retries: ${url} - ${scrapingResult?.error || 'No recipe data'}`);
            console.log(`❌ Failed: ${url}`);
          }
        } catch (error) {
          results.failed++;
          results.errors.push(`Error processing ${url}: ${error}`);
          console.error(`❌ Error: ${url}`, error);
        }
      })
    )
  );
  
  results.endTime = new Date().toISOString();
  
  // Update final job status
  if ((global as any).crawlJobs && (global as any).crawlJobs[jobId]) {
    (global as any).crawlJobs[jobId] = {
      ...results,
      status: 'completed',
      progress: 100
    };
  }
  
  console.log(`\n✅ Crawling completed for ${jobId}:`);
  console.log(`   - Successful: ${results.successful}`);
  console.log(`   - Failed: ${results.failed}`);
  console.log(`   - Duration: ${((Date.now() - new Date(results.startTime).getTime()) / 1000).toFixed(1)}s`);
  
  // Clean up job after 1 hour
  setTimeout(() => {
    if ((global as any).crawlJobs && (global as any).crawlJobs[jobId]) {
      delete (global as any).crawlJobs[jobId];
    }
  }, 3600000);
}

export { router as WebsiteApiRoutes };
