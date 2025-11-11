/**
 * GitHub Actions Integration Script
 * Runs the Universal Recipe Scraper with all optimizations
 * Supports: websites, TikTok, Instagram, YouTube, images, text
 */

import { UniversalRecipeScraper } from './src/scrapers/UniversalRecipeScraper.js';
import { ParallelEnrichmentPipeline } from './src/enrichment/ParallelEnrichmentPipeline.js';
import { CacheManager } from './src/cache/CacheManager.js';
import { BlockedWebsitesRegistry } from './src/registry/BlockedWebsitesRegistry.js';
import { circuitBreakerManager } from './src/resilience/CircuitBreaker.js';
import { promises as fs } from 'fs';
import path from 'path';

// Configuration
const CONFIG = {
  mode: process.env.MODE || 'sample',  // test | sample | full
  maxRecipes: parseInt(process.env.MAX_RECIPES || '10', 10),
  outputDir: process.env.OUTPUT_DIR || './scraping-results',
  inputFile: process.env.INPUT_FILE || './recipe-urls.txt',
  enableEnrichment: process.env.ENABLE_ENRICHMENT !== 'false',
  enableNutrition: process.env.ENABLE_NUTRITION !== 'false',
  enableEmbedding: process.env.ENABLE_EMBEDDING === 'true',
  enableAI: process.env.ENABLE_AI_ENRICHMENT === 'true',
  concurrency: parseInt(process.env.MAX_CONCURRENT_REQUESTS || '5', 10)
};

interface ScrapingResult {
  url: string;
  contentType: string;
  success: boolean;
  recipe?: any;
  error?: string;
  processingTime: number;
  extractionMethods?: string[];
  confidence?: number;
}

/**
 * Main scraping function
 */
async function runUniversalScraper() {
  console.log('🚀 STARTING UNIVERSAL RECIPE SCRAPER\n');
  console.log('='.repeat(80));
  console.log('Configuration:');
  console.log(`  Mode: ${CONFIG.mode}`);
  console.log(`  Max Recipes: ${CONFIG.maxRecipes}`);
  console.log(`  Concurrency: ${CONFIG.concurrency}`);
  console.log(`  Enrichment: ${CONFIG.enableEnrichment}`);
  console.log(`  Nutrition: ${CONFIG.enableNutrition}`);
  console.log(`  Embedding: ${CONFIG.enableEmbedding}`);
  console.log(`  AI: ${CONFIG.enableAI}`);
  console.log('='.repeat(80) + '\n');

  const startTime = Date.now();
  const results: ScrapingResult[] = [];

  try {
    // Step 1: Load URLs
    const urls = await loadInputUrls();
    console.log(`📋 Loaded ${urls.length} URLs to scrape\n`);

    // Step 2: Process URLs with concurrency limit
    const pLimit = (await import('p-limit')).default;
    const limit = pLimit(CONFIG.concurrency);

    const tasks = urls.map(url =>
      limit(() => scrapeAndEnrichRecipe(url, results))
    );

    await Promise.all(tasks);

    // Step 3: Generate report
    const report = generateReport(results, Date.now() - startTime);
    console.log('\n' + report);

    // Step 4: Save results
    await saveResults(results, report);

    // Step 5: Print statistics
    printStatistics();

    // Step 6: Check for failures
    const failedCount = results.filter(r => !r.success).length;
    if (failedCount > results.length * 0.5) {
      console.error('\n❌ CRITICAL: More than 50% of recipes failed!');
      process.exit(1);
    }

    console.log('\n✅ SCRAPING COMPLETE!\n');

  } catch (error: any) {
    console.error('\n❌ SCRAPING FAILED:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

/**
 * Load input URLs from file or environment
 */
async function loadInputUrls(): Promise<string[]> {
  // Check if input file exists
  try {
    const content = await fs.readFile(CONFIG.inputFile, 'utf-8');
    let urls = content.split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'));

    // Limit based on mode
    if (CONFIG.mode === 'test') {
      urls = urls.slice(0, 3);
    } else if (CONFIG.mode === 'sample') {
      urls = urls.slice(0, CONFIG.maxRecipes);
    }

    return urls;

  } catch (error) {
    console.log('⚠️  No input file found, using test URLs');

    // Default test URLs
    return [
      'https://www.allrecipes.com/recipe/12151/banana-banana-bread/',
      'https://www.foodnetwork.com/recipes/alton-brown/baked-macaroni-and-cheese-recipe-1939524',
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
    ].slice(0, CONFIG.mode === 'test' ? 3 : CONFIG.maxRecipes);
  }
}

/**
 * Scrape and enrich a single recipe
 */
async function scrapeAndEnrichRecipe(url: string, results: ScrapingResult[]): Promise<void> {
  const startTime = Date.now();

  console.log(`\n🔍 Processing: ${url}`);

  try {
    // Step 1: Scrape with Universal Scraper
    const scrapedResult = await UniversalRecipeScraper.scrape(url);

    console.log(`   ✅ Scraped (${scrapedResult.processingTime}ms)`);
    console.log(`      Content Type: ${scrapedResult.contentType}`);
    console.log(`      Method: ${scrapedResult.method}`);
    console.log(`      Confidence: ${scrapedResult.confidence}%`);
    console.log(`      Extraction Methods: [${scrapedResult.extractionMethods.join(', ')}]`);

    // Step 2: Enrich (optional)
    let enrichedRecipe: any = scrapedResult.recipe;

    if (CONFIG.enableEnrichment) {
      console.log('   ⚡ Enriching...');

      const enrichedResult = await ParallelEnrichmentPipeline.enrich(scrapedResult.recipe, {
        includeNutrition: CONFIG.enableNutrition,
        includeEmbedding: CONFIG.enableEmbedding,
        includeAI: CONFIG.enableAI,
        timeout: 30000
      });

      enrichedRecipe = enrichedResult.recipe as any;

      console.log(`   ✅ Enriched (${enrichedResult.processingTime}ms)`);
      console.log(`      Completeness: ${enrichedResult.completenessScore}%`);
    }

    // Record success
    results.push({
      url,
      contentType: scrapedResult.contentType,
      success: true,
      recipe: enrichedRecipe,
      processingTime: Date.now() - startTime,
      extractionMethods: scrapedResult.extractionMethods,
      confidence: scrapedResult.confidence
    });

  } catch (error: any) {
    console.error(`   ❌ Failed: ${error.message}`);

    results.push({
      url,
      contentType: 'unknown',
      success: false,
      error: error.message,
      processingTime: Date.now() - startTime
    });
  }
}

/**
 * Generate scraping report
 */
function generateReport(results: ScrapingResult[], totalTime: number): string {
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  // Group by content type
  const byContentType: Record<string, number> = {};
  successful.forEach(r => {
    byContentType[r.contentType] = (byContentType[r.contentType] || 0) + 1;
  });

  // Calculate average processing time
  const avgTime = successful.length > 0
    ? Math.round(successful.reduce((sum, r) => sum + r.processingTime, 0) / successful.length)
    : 0;

  // Calculate average confidence
  const avgConfidence = successful.length > 0
    ? Math.round(successful.reduce((sum, r) => sum + (r.confidence || 0), 0) / successful.length)
    : 0;

  const report = `
${'='.repeat(80)}
📊 SCRAPING REPORT
${'='.repeat(80)}

Summary:
  Total URLs: ${results.length}
  ✅ Successful: ${successful.length} (${((successful.length / results.length) * 100).toFixed(1)}%)
  ❌ Failed: ${failed.length} (${((failed.length / results.length) * 100).toFixed(1)}%)

Performance:
  Total Time: ${(totalTime / 1000).toFixed(2)}s
  Avg Time per Recipe: ${avgTime}ms
  Avg Confidence: ${avgConfidence}%

Content Types:
${Object.entries(byContentType).map(([type, count]) => `  ${type}: ${count}`).join('\n')}

${failed.length > 0 ? `
Failed URLs:
${failed.slice(0, 10).map(r => `  - ${r.url}\n    Error: ${r.error}`).join('\n')}
${failed.length > 10 ? `  ... and ${failed.length - 10} more` : ''}
` : ''}
${'='.repeat(80)}
`;

  return report;
}

/**
 * Save results to files
 */
async function saveResults(results: ScrapingResult[], report: string): Promise<void> {
  // Create output directory
  await fs.mkdir(CONFIG.outputDir, { recursive: true });

  // Save individual recipes
  const successful = results.filter(r => r.success);

  for (let i = 0; i < successful.length; i++) {
    const result = successful[i];
    const filename = `recipe-${i + 1}-${result.contentType}.json`;
    const filepath = path.join(CONFIG.outputDir, filename);

    await fs.writeFile(filepath, JSON.stringify(result.recipe, null, 2));
  }

  // Save summary
  const summaryPath = path.join(CONFIG.outputDir, 'summary.json');
  await fs.writeFile(summaryPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    mode: CONFIG.mode,
    results: results.map(r => ({
      url: r.url,
      contentType: r.contentType,
      success: r.success,
      error: r.error,
      processingTime: r.processingTime,
      confidence: r.confidence
    }))
  }, null, 2));

  // Save report
  const reportPath = path.join(CONFIG.outputDir, 'report.txt');
  await fs.writeFile(reportPath, report);

  console.log(`\n📁 Results saved to: ${CONFIG.outputDir}`);
  console.log(`   - ${successful.length} recipe JSON files`);
  console.log(`   - summary.json`);
  console.log(`   - report.txt`);
}

/**
 * Print system statistics
 */
function printStatistics(): void {
  console.log('\n📊 SYSTEM STATISTICS\n');

  // Cache stats
  const cache = CacheManager.getInstance();
  const cacheStats = cache.getStats();
  console.log('Cache:');
  console.log(`  Memory: ${cacheStats.memorySize}/${cacheStats.memoryMax}`);
  console.log(`  Hit Rate: ${cacheStats.memoryHitRate.toFixed(2)}%`);
  console.log(`  Redis: ${cacheStats.redisEnabled ? 'Active' : 'Disabled'}`);

  // Circuit breaker stats
  const breakers = circuitBreakerManager.getAllStats();
  console.log('\nCircuit Breakers:');
  Object.entries(breakers).forEach(([name, stats]) => {
    const successRate = stats.totalRequests > 0
      ? ((stats.totalSuccesses / stats.totalRequests) * 100).toFixed(2)
      : 'N/A';
    console.log(`  ${name}: ${stats.state} (${successRate}% success rate)`);
  });

  // Blocked sites
  const registry = BlockedWebsitesRegistry.getInstance();
  const blockStats = registry.getStats();
  console.log('\nBlocked Sites:');
  console.log(`  Total: ${blockStats.total}`);
  console.log(`  Permanent: ${blockStats.permanent}`);
  console.log(`  Temporary: ${blockStats.temporary}`);
}

// Run the scraper
runUniversalScraper();
