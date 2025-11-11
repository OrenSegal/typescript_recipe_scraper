/*
 * run-mass-scraper.ts
 * Orchestrates the entire mass scraping pipeline.
 */

import { WebsiteManager } from './manager/WebsiteManager.js';
import { BatchRecipeProcessor } from './processor/BatchRecipeProcessor.js';
import { QAAnalyzer } from './analyzer/QAAnalyzer.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { CrawlResult, SitemapCrawler } from './crawler/SitemapCrawler.js';

// --- Configuration ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CSV_FILE_PATH = path.resolve(__dirname, '../data/Data.csv');
const QA_LOG_PATH = path.resolve(__dirname, '../../qa_log.json');
const MAX_SITES_TO_CRAWL = 10; // To prevent crawling all ~100 sites on a test run
const MAX_URLS_PER_SITE = 50; // Limit URLs per site for a manageable test run

/*
 * Main function to run the mass scraping and analysis pipeline
 */
async function main() {
  console.log('🚀 Starting Mass Recipe Scraping Pipeline...');

  // --- 1. Load Websites from CSV ---
  console.log('\n--- Step 1: Loading Websites ---');
  const websiteManager = new WebsiteManager();
  await websiteManager.loadFromCSV(CSV_FILE_PATH);
  const allWebsites = websiteManager.getAllWebsites();
  console.log(`✅ Loaded ${allWebsites.length} websites.`);

  // --- 2. Crawl Sitemaps for Recipe URLs ---
  console.log('\n--- Step 2: Crawling Sitemaps ---');
  const crawler = new SitemapCrawler({ concurrency: 5 });
  const sitesToCrawl = allWebsites.slice(0, MAX_SITES_TO_CRAWL);
  console.log(`\nCrawling ${sitesToCrawl.length} websites...`);
  const crawlPromises = sitesToCrawl.map(website => 
      crawler.crawlWebsite(website, MAX_URLS_PER_SITE)
  );
  const crawlResults = await Promise.all(crawlPromises);
  const recipeUrls = crawlResults.map((result: CrawlResult) => result.recipeUrls).flat();
  console.log(`✅ Found ${recipeUrls.length} potential recipe URLs.`);

  if (recipeUrls.length === 0) {
    console.log('No recipe URLs found. Exiting.');
    return;
  }

  // --- 3. Process Recipes in Batches ---
  console.log('\n--- Step 3: Processing Recipes ---');
  const batchProcessor = new BatchRecipeProcessor({ qaLogPath: QA_LOG_PATH });
  const batchResult = await batchProcessor.processUrls(recipeUrls);
  console.log(`✅ Batch processing finished.`);

  // --- 4. Analyze QA Log ---
  console.log('\n--- Step 4: Analyzing Results ---');
  if (batchResult.failed > 0) {
    const qaAnalyzer = new QAAnalyzer();
    await qaAnalyzer.loadLogFile(QA_LOG_PATH);
    const analysis = qaAnalyzer.analyze();
    qaAnalyzer.printAnalysis(analysis);
    console.log(`✅ QA analysis complete. See report above.`);
  } else {
    console.log('✅ No errors to analyze. Great success!');
  }
  
  console.log('\n🎉 Mass Recipe Scraping Pipeline Finished! 🎉');
}

main().catch(err => {
  console.error('\n🚨 A critical error occurred in the pipeline:', err);
  process.exit(1);
});
