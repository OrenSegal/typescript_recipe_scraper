#!/usr/bin/env node

import { Command } from 'commander';
import { RecipeCliCommands } from './RecipeCliCommands.js';
import { SocialMediaCliCommands } from './SocialMediaCliCommands.js';
import { WebsiteCliCommands } from './WebsiteCliCommands.js';

const program = new Command();

program
  .name('recipe-scraper')
  .description('TypeScript Recipe Scraper Service - CLI for scraping, crawling, and processing recipes')
  .version('1.0.0');

// Single Recipe Commands
program
  .command('scrape-recipe <url>')
  .description('Scrape a single recipe from a URL')
  .option('-o, --output <file>', 'Output file path (JSON)')
  .option('--no-enrich', 'Skip AI enrichment')
  .option('--no-save', 'Skip saving to database')
  .option('--format <type>', 'Output format (json|csv|yaml)', 'json')
  .action(async (url, options) => {
    await RecipeCliCommands.scrapeSingleRecipe(url, options);
  });

// Website Crawling Commands
program
  .command('crawl-website <domain>')
  .description('Crawl and scrape all recipes from a website')
  .option('-d, --depth <number>', 'Maximum crawl depth', '3')
  .option('-l, --limit <number>', 'Maximum recipes to scrape')
  .option('--sitemap', 'Use sitemap for crawling (if available)')
  .option('--output <dir>', 'Output directory for results')
  .option('--batch-size <number>', 'Batch processing size', '10')
  .action(async (domain, options) => {
    await WebsiteCliCommands.crawlFullWebsite(domain, options);
  });

program
  .command('add-website <domain>')
  .description('Add a new website to the scraping list')
  .requiredOption('-n, --name <name>', 'Website name')
  .option('-u, --url <url>', 'Main website URL')
  .option('-t, --test-url <url>', 'Test recipe URL for validation')
  .option('--sitemap <url>', 'Sitemap URL')
  .action(async (domain: string, options: any) => {
    await WebsiteCliCommands.addWebsite(domain, options);
  });

program
  .command('list-websites')
  .description('List all configured websites')
  .option('-a, --active-only', 'Show only active websites')
  .option('--format <type>', 'Output format (table|json|csv)', 'table')
  .action(async (options) => {
    await WebsiteCliCommands.listWebsites(options);
  });

// Social Media Commands
program
  .command('scrape-social <url>')
  .description('Scrape a single social media post/video for recipes')
  .option('-p, --platform <platform>', 'Platform (instagram|tiktok|youtube)')
  .option('--ocr', 'Enable OCR text extraction')
  .option('--transcript', 'Enable video transcript extraction')
  .option('--no-save', 'Skip saving to database')
  .action(async (url, options) => {
    await SocialMediaCliCommands.scrapeSinglePost(url, options);
  });

program
  .command('scrape-account <username>')
  .description('Scrape all recipes from a social media account/channel')
  .requiredOption('-p, --platform <platform>', 'Platform (instagram|tiktok|youtube)')
  .option('-l, --limit <number>', 'Maximum posts to scrape', '50')
  .option('--since <date>', 'Scrape posts since date (YYYY-MM-DD)')
  .option('--output <dir>', 'Output directory for results')
  .option('--batch-size <number>', 'Batch processing size', '5')
  .action(async (username: string, options: any) => {
    await SocialMediaCliCommands.scrapeFullAccount(username, options);
  });

// Batch Processing Commands
program
  .command('batch-process')
  .description('Run batch processing on configured websites')
  .option('-c, --config <file>', 'Configuration file path')
  .option('--dry-run', 'Show what would be processed without executing')
  .option('--parallel <number>', 'Number of parallel workers', '3')
  .action(async (options) => {
    await WebsiteCliCommands.batchProcess(options);
  });

// Database Commands
const db = program
  .command('db')
  .description('Database management commands');

db
  .command('export')
  .description('Export all recipes from database')
  .option('-f, --format <type>', 'Export format (json|csv|xlsx)', 'json')
  .option('-o, --output <file>', 'Output file path')
  .action(async (options) => {
    await RecipeCliCommands.exportDatabase(options);
  });

db
  .command('stats')
  .description('Show database statistics')
  .action(async () => {
    await RecipeCliCommands.databaseStats();
  });

db
  .command('health')
  .description('Check database health and connectivity')
  .action(async () => {
    await RecipeCliCommands.databaseHealth();
  });

// Server Commands
program
  .command('serve')
  .description('Start the REST API server')
  .option('-p, --port <number>', 'Server port', '3000')
  .option('-h, --host <host>', 'Server host', 'localhost')
  .option('--cors', 'Enable CORS')
  .option('--rate-limit <number>', 'Rate limit per minute', '100')
  .action(async (options) => {
    const { startServer } = await import('../api/server.js');
    await startServer(options);
  });

// Error handling
program.configureOutput({
  outputError: (str: string, write: (str: string) => void) => {
    write(`❌ Error: ${str}`);
  }
});

program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
