#!/usr/bin/env node
/**
 * Production Recipe CLI Entry Point
 * 
 * Unified command-line interface replacing all scattered root-level scripts
 * Follows SOLID/DRY/KISS/YAGNI principles with consolidated, reusable services
 */

import { CLIService, CLICommand, CLIOptions } from '../services/CLIService.js';
import { LoggingUtils, StringUtils } from '../core/utils.js';
import { SUCCESS_MESSAGES, ERROR_MESSAGES } from '../shared/constants.js';

/**
 * Main CLI entry point
 */
async function main(): Promise<void> {
  try {
    // Parse command line arguments
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
      showUsage();
      process.exit(1);
    }

    const { command, options } = CLIService.parseArgs(args);
    
    if (!isValidCommand(command)) {
      console.error(`❌ Invalid command: ${command}`);
      showUsage();
      process.exit(1);
    }

    // Create CLI service and execute command
    const cliService = new CLIService();
    
    // Show header
    showHeader(command, options);
    
    // Execute command
    const result = await cliService.execute(command, options);
    
    // Show results
    if (result.success) {
      console.log(`✅ ${result.message}`);
      if (result.data && options.verbose) {
        console.log('\n📊 Results:');
        console.log(JSON.stringify(result.data, null, 2));
      }
      console.log(`⏱️  Duration: ${(result.duration / 1000).toFixed(2)}s`);
    } else {
      console.error(`❌ ${result.message}`);
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error instanceof Error ? error.message : error);
    if (process.env.NODE_ENV === 'development') {
      console.error(error);
    }
    process.exit(1);
  }
}

/**
 * Show CLI header
 */
function showHeader(command: CLICommand, options: CLIOptions): void {
  console.log('\n🍳 Production Recipe Scraper CLI');
  console.log('=====================================');
  console.log(`📋 Command: ${command}`);
  if (options.verbose) {
    console.log(`⚙️  Options:`, options);
  }
  console.log('');
}

/**
 * Show usage information
 */
function showUsage(): void {
  console.log('\n🍳 Production Recipe Scraper CLI');
  console.log('=====================================\n');
  
  console.log('📋 Available Commands:');
  console.log('  scrape-single-recipe    Scrape a single recipe from URL');
  console.log('  scrape-single-website   Scrape all recipes from a website');
  console.log('  scrape-batch-websites   Scrape multiple websites from CSV');
  console.log('  scrape-single-media     Scrape a social media recipe video');
  console.log('  scrape-media-account    Scrape all media from account/hashtag');
  console.log('  deploy-to-supabase      Deploy scraped data to Supabase');
  console.log('  validate-optimization   Validate optimization results');
  console.log('  run-comprehensive-optimization  Run comprehensive optimization');
  console.log('  test-ocr-integration    Test OCR integration functionality');
  console.log('  final-validation        Run final validation suite');
  console.log('  cleanup-codebase        Clean up codebase structure');
  console.log('  help                    Show detailed help information');
  
  console.log('\n⚙️  Common Options:');
  console.log('  --url <url>             Target URL for scraping');
  console.log('  --website <url>         Website URL for scraping');
  console.log('  --csv-file <path>       Path to CSV file with websites');
  console.log('  --account <name>        Account name or hashtag');
  console.log('  --platform <platform>   Social media platform (instagram/tiktok/youtube)');
  console.log('  --limit <number>        Limit number of items to process');
  console.log('  --environment <env>     Environment (development/staging/production)');
  console.log('  --output <directory>    Output directory for results');
  console.log('  --verbose               Enable verbose logging');
  console.log('  --dry-run              Run without making changes');
  console.log('  --force                 Force operation (bypass confirmations)');
  
  console.log('\n📚 Examples:');
  console.log('  recipe-cli scrape-single-recipe --url "https://food52.com/recipes/37819"');
  console.log('  recipe-cli scrape-single-website --website "https://food52.com"');
  console.log('  recipe-cli scrape-batch-websites --csv-file "data/websites.csv" --verbose');
  console.log('  recipe-cli scrape-single-media --url "https://instagram.com/p/xyz"');
  console.log('  recipe-cli scrape-media-account --account "foodnetwork" --platform instagram');
  console.log('  recipe-cli deploy-to-supabase --environment production');
  console.log('  recipe-cli final-validation --verbose');
  
  console.log('\n💡 For detailed help on any command:');
  console.log('  recipe-cli help');
  console.log('');
}

/**
 * Validate command
 */
function isValidCommand(command: string): command is CLICommand {
  const validCommands: CLICommand[] = [
    'scrape-single-recipe',
    'scrape-single-website', 
    'scrape-batch-websites',
    'scrape-single-media',
    'scrape-media-account',
    'deploy-to-supabase',
    'validate-optimization',
    'run-comprehensive-optimization',
    'test-ocr-integration',
    'final-validation',
    'cleanup-codebase',
    'help'
  ];
  
  return validCommands.includes(command as CLICommand);
}

// Run the CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}
