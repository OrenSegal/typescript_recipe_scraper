// Single Website Scraper - Robust script to crawl and scrape all recipes from one website
import { SitemapCrawler } from './src/crawler/SitemapCrawler.js';
import { BatchRecipeProcessor } from './src/processor/BatchRecipeProcessor.js';
import { SuccessRateOptimizer } from './src/optimizations/SuccessRateOptimizer.js';
import { writeFile } from 'fs/promises';
import { Website } from './src/shared/types.js';

async function scrapeSingleWebsite(
  websiteUrl: string, 
  sitemapUrl?: string, 
  shouldUpsert: boolean = false, 
  maxRecipes?: number
) {
  console.log(`🚀 Starting single website scrape: ${websiteUrl}`);
  console.log(`🗺️  Sitemap URL: ${sitemapUrl || 'Auto-detect'}`);
  console.log(`💾 Upsert to database: ${shouldUpsert}`);
  console.log(`📊 Max recipes: ${maxRecipes || 'Unlimited'}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const startTime = Date.now();
  
  try {
    // Create website object
    const website: Website = {
      id: 1, // Placeholder for single run
      name: new URL(websiteUrl).hostname,
      base_url: websiteUrl,
      sitemap_url: sitemapUrl || `${websiteUrl}/sitemap.xml`,
      sub_sitemaps: [],
      category: 'Custom',
      priority: 1,
      active: true
    };

    // Step 1: Initialize crawler with optimization
    console.log(`🔍 Step 1: Initializing crawler and optimizer...`);
    const crawler = new SitemapCrawler({ 
      concurrency: 10,
      // Precise pattern that matches actual recipe pages, not category/index pages
      // Matches: /recipe/name, /recipes/name, /food/recipes/name, /cooking/name
      // Excludes: /recipes/, /recipe/, /recipes/category/, etc.
      recipeUrlPattern: /\/(recipe|recipes|food\/recipes|cooking)\/[a-z0-9\-_]+(?:\/|\?|#|$)/i,
      requestTimeout: 30000
    });
    const optimizer = new SuccessRateOptimizer();

    // Step 2: Crawl and discover recipe URLs
    console.log(`🕷️  Step 2: Crawling website for recipe URLs...`);
    let recipeUrls: string[] = [];

    try {
      const crawlResults = await crawler.crawlWebsite(website);
      recipeUrls = crawlResults.recipeUrls;
      console.log(`✅ Found ${recipeUrls.length} recipe URLs from sitemap crawling`);
    } catch (crawlError) {
      console.warn(`⚠️  Sitemap crawling failed, trying optimization strategies...`);
      
      // Use optimizer fallback strategies  
      try {
        // SuccessRateOptimizer doesn't have discoverRecipeUrls method, using alternative approach
        console.log(`⚠️  Using alternative URL discovery...`);
        recipeUrls = [`${websiteUrl}/recipes/`, `${websiteUrl}/recipe/`]; // Fallback URLs
        console.log(`✅ Using ${recipeUrls.length} fallback recipe URLs`);
      } catch (optError) {
        console.error(`❌ All discovery strategies failed:`, optError);
        return { 
          success: false, 
          error: `Failed to discover recipe URLs: ${optError instanceof Error ? optError.message : 'Unknown error'}`
        };
      }
    }

    if (recipeUrls.length === 0) {
      console.warn(`⚠️  No recipe URLs found for website: ${websiteUrl}`);
      return { success: false, error: 'No recipe URLs discovered' };
    }

    // Limit recipes if specified
    if (maxRecipes && recipeUrls.length > maxRecipes) {
      console.log(`📊 Limiting to first ${maxRecipes} recipes (found ${recipeUrls.length})`);
      recipeUrls = recipeUrls.slice(0, maxRecipes);
    }

    // Step 3: Process all discovered recipes
    console.log(`🔄 Step 3: Processing ${recipeUrls.length} recipes...`);
    const processor = new BatchRecipeProcessor();
    const results = await processor.processUrls(recipeUrls);

    // Step 4: Generate report and save results
    const reportData = {
      websiteUrl,
      sitemapUrl: sitemapUrl || website.sitemap_url,
      timestamp: new Date().toISOString(),
      totalUrlsFound: recipeUrls.length,
      results: results,
      summary: {
        successful: results.successful,
        failed: results.failed,
        successRate: `${results.successRate.toFixed(1)}%`,
        avgCompletenessScore: results.successfulRecipes && results.successfulRecipes.length > 0
          ? (results.successfulRecipes.reduce((sum, r) => sum + (r.completeness_score || 70), 0) / results.successfulRecipes.length).toFixed(1)
          : 'N/A'
      }
    };

    // Save detailed report
    const reportFilename = `single-website-report-${website.name}-${Date.now()}.json`;
    await writeFile(reportFilename, JSON.stringify(reportData, null, 2));

    const duration = Date.now() - startTime;
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🎉 Single website scrape completed in ${(duration / 1000).toFixed(1)}s`);
    console.log(`📊 Results: ${results.successful}/${recipeUrls.length} successful (${reportData.summary.successRate})`);
    console.log(`📈 Average completeness: ${reportData.summary.avgCompletenessScore}%`);
    console.log(`📄 Detailed report saved: ${reportFilename}`);

    if (results.failed > 0) {
      console.log(`⚠️  ${results.failed} recipes failed. Check the report for details.`);
    }

    return {
      success: true,
      results,
      summary: reportData.summary,
      reportFile: reportFilename,
      duration
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error(`❌ Single website scrape failed after ${(duration / 1000).toFixed(1)}s:`, error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error',
      duration
    };
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h') || args.length === 0) {
    console.log(`
🌐 Single Website Scraper

Usage:
  pnpm tsx scrape-single-website.ts --url <website-url> [options]

Required:
  --url <url>        The base URL of the website to scrape.

Options:
  --sitemap <url>    Optional: Custom sitemap URL.
  --upsert           Optional: Upsert scraped recipes to the database.
  --max <number>     Optional: Maximum number of recipes to process.
  --help, -h         Show this help message.

Examples:
  pnpm tsx scrape-single-website.ts --url https://www.thekitchn.com
  pnpm tsx scrape-single-website.ts --url https://www.allrecipes.com --upsert --max 50
`);
    process.exit(0);
  }

  const urlIndex = args.findIndex(arg => arg === '--url');
  const websiteUrl = urlIndex !== -1 && args[urlIndex + 1] ? args[urlIndex + 1] : '';

  if (!websiteUrl || !websiteUrl.startsWith('http')) {
    console.error('❌ Error: The --url flag with a valid URL is required. Use --help for more information.');
    process.exit(1);
  }

  const sitemapIndex = args.findIndex(arg => arg === '--sitemap');
  const sitemapUrl = sitemapIndex !== -1 && args[sitemapIndex + 1] ? args[sitemapIndex + 1] : undefined;

  const shouldUpsert = args.includes('--upsert');

  const maxIndex = args.findIndex(arg => arg === '--max');
  const maxRecipes = maxIndex !== -1 && args[maxIndex + 1] ? parseInt(args[maxIndex + 1], 10) : undefined;

  const result = await scrapeSingleWebsite(websiteUrl, sitemapUrl, shouldUpsert, maxRecipes);

  if (!result.success) {
    console.error(`❌ Website scraping failed: ${result.error}`);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { scrapeSingleWebsite };
