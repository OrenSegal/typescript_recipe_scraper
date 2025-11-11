#!/usr/bin/env node

/**
 * Unified Crawler - Single Entry Point with All Workarounds
 * Consolidates all crawler functionality into one modular, reusable system
 */

import 'dotenv/config';
import { Command } from 'commander';
import { UnifiedCrawler, type CrawlerOptions } from './src/crawler/UnifiedCrawler.js';
import { CRAWLER_MODES, BATCH_CONSTANTS, LOG_SYMBOLS } from './src/shared/crawlerConstants.js';

const program = new Command();

// Default CSV paths
const DEFAULT_CSV_PATHS = [
  '/Users/orensegal/Documents/GitHub/typescript_scraper_service/data/Data.csv',
  '/Users/orensegal/Documents/GitHub/typescript_scraper_service/data/Data File.csv'
];

program
  .name('unified-crawler')
  .description('Unified crawler with real-time error adaptation and all workarounds')
  .version('1.0.0');

program
  .command('crawl')
  .description('Run adaptive crawling with real-time error correction')
  .option('-m, --mode <mode>', 'Crawler mode (test|sample|full|adaptive)', CRAWLER_MODES.ADAPTIVE)
  .option('-s, --max-sites <number>', 'Maximum number of sites to process', '50')
  .option('-r, --max-recipes <number>', 'Maximum recipes per site', '10')
  .option('-b, --batch-size <number>', 'Batch size for processing', BATCH_CONSTANTS.DEFAULT_BATCH_SIZE.toString())
  .option('--csv <paths>', 'Comma-separated CSV file paths', DEFAULT_CSV_PATHS.join(','))
  .option('--test-urls <urls>', 'Comma-separated test URLs for testing mode')
  .action(async (options) => {
    try {
      console.log(`${LOG_SYMBOLS.PROGRESS} Starting Unified Crawler...`);
      console.log(`${LOG_SYMBOLS.INFO} Mode: ${options.mode}`);
      console.log(`${LOG_SYMBOLS.INFO} Max sites: ${options.maxSites}`);
      console.log(`${LOG_SYMBOLS.INFO} Max recipes per site: ${options.maxRecipes}`);
      console.log('');

      const crawlerOptions: CrawlerOptions = {
        mode: options.mode as any,
        maxSites: parseInt(options.maxSites),
        maxRecipesPerSite: parseInt(options.maxRecipes),
        batchSize: parseInt(options.batchSize),
        csvPaths: options.testUrls ? [] : options.csv.split(',').map((p: string) => p.trim()),
        testUrls: options.testUrls ? options.testUrls.split(',').map((u: string) => u.trim()) : []
      };

      const crawler = new UnifiedCrawler(crawlerOptions);
      await crawler.runCrawler();
      
      console.log(`\n${LOG_SYMBOLS.SUCCESS} Unified crawling complete!`);
      process.exit(0);
      
    } catch (error: any) {
      console.error(`${LOG_SYMBOLS.ERROR} Crawling failed:`, error.message);
      process.exit(1);
    }
  });

program
  .command('test')
  .description('Quick test mode - sample a few sites for validation')
  .option('-s, --sites <number>', 'Number of sites to test', '5')
  .action(async (options) => {
    try {
      console.log(`${LOG_SYMBOLS.TEST} Running quick test mode...`);
      
      const crawler = new UnifiedCrawler({
        mode: CRAWLER_MODES.TEST,
        maxSites: parseInt(options.sites),
        maxRecipesPerSite: 3,
        csvPaths: DEFAULT_CSV_PATHS
      });
      
      await crawler.runCrawler();
      process.exit(0);
      
    } catch (error: any) {
      console.error(`${LOG_SYMBOLS.ERROR} Test failed:`, error.message);
      process.exit(1);
    }
  });

program
  .command('sample')
  .description('Sample mode - test representative sites from each category')
  .option('-r, --recipes <number>', 'Recipes per site to test', '5')
  .action(async (options) => {
    try {
      console.log(`${LOG_SYMBOLS.INFO} Running sample mode...`);
      
      const crawler = new UnifiedCrawler({
        mode: CRAWLER_MODES.SAMPLE,
        maxSites: 20, // Sample from different categories
        maxRecipesPerSite: parseInt(options.recipes),
        csvPaths: DEFAULT_CSV_PATHS
      });
      
      await crawler.runCrawler();
      process.exit(0);
      
    } catch (error: any) {
      console.error(`${LOG_SYMBOLS.ERROR} Sampling failed:`, error.message);
      process.exit(1);
    }
  });

program
  .command('full')
  .description('Full crawling mode - comprehensive crawling of all sites')
  .option('-r, --max-recipes <number>', 'Maximum recipes per site', '100')
  .option('-b, --batch-size <number>', 'Batch size', '50')
  .action(async (options) => {
    try {
      console.log(`${LOG_SYMBOLS.PROGRESS} Running full crawling mode...`);
      console.log(`${LOG_SYMBOLS.WARNING} This will process ALL sites in the CSV files.`);
      
      const crawler = new UnifiedCrawler({
        mode: CRAWLER_MODES.FULL,
        maxRecipesPerSite: parseInt(options.maxRecipes),
        batchSize: parseInt(options.batchSize),
        csvPaths: DEFAULT_CSV_PATHS
      });
      
      await crawler.runCrawler();
      process.exit(0);
      
    } catch (error: any) {
      console.error(`${LOG_SYMBOLS.ERROR} Full crawling failed:`, error.message);
      process.exit(1);
    }
  });

program
  .command('urls')
  .description('Test specific URLs')
  .argument('<urls...>', 'URLs to test')
  .action(async (urls) => {
    try {
      console.log(`${LOG_SYMBOLS.TEST} Testing specific URLs...`);
      
      const crawler = new UnifiedCrawler({
        mode: CRAWLER_MODES.TEST,
        testUrls: urls
      });
      
      await crawler.runCrawler();
      process.exit(0);
      
    } catch (error: any) {
      console.error(`${LOG_SYMBOLS.ERROR} URL testing failed:`, error.message);
      process.exit(1);
    }
  });

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log(`\n${LOG_SYMBOLS.WARNING} Graceful shutdown requested...`);
  process.exit(0);
});

// Parse command line arguments
program.parse();

// If no command provided, show help
if (!process.argv.slice(2).length) {
  program.outputHelp();
  console.log(`\n${LOG_SYMBOLS.INFO} Examples:`);
  console.log('  unified-crawler test                    # Quick test of 5 sites');
  console.log('  unified-crawler sample -r 10           # Sample 20 sites, 10 recipes each');
  console.log('  unified-crawler crawl -m adaptive -s 25 # Adaptive crawl of 25 sites');
  console.log('  unified-crawler full                    # Full crawl of all CSV sites');
  console.log('  unified-crawler urls https://site1.com https://site2.com # Test specific URLs');
  process.exit(1);
}
