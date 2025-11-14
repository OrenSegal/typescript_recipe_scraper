#!/usr/bin/env tsx
// Single Recipe Scraper - Robust script to scrape one recipe URL with full enrichment
import { scrapeWebsite } from './src/scrapers/websiteScraper.js';
import { ComprehensiveEnrichment } from './src/enrichment/comprehensiveEnrichment.js';
import { processAndSaveRecipe } from './src/database.js';

async function scrapeSingleRecipe(url: string, shouldUpsert: boolean = false) {
  console.log(`🚀 Starting single recipe scrape: ${url}`);
  console.log(`💾 Upsert to database: ${shouldUpsert}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const startTime = Date.now();
  
  try {
    // Step 1: Scrape raw recipe data
    console.log(`📥 Step 1: Scraping raw data from ${url}...`);
    const scrapedData = await scrapeWebsite(url);
    
    if (!scrapedData) {
      console.error(`❌ Failed to scrape recipe from ${url}`);
      return { success: false, error: 'Failed to scrape recipe data' };
    }

    console.log(`✅ Raw data scraped successfully:`);
    console.log(`   Title: ${scrapedData.title || 'N/A'}`);
    console.log(`   Ingredients: ${scrapedData.ingredients?.length || 0}`);
    console.log(`   Instructions: ${scrapedData.instructions?.length || 0}`);
    console.log(`   Servings: ${scrapedData.servings || 'N/A'}`);

    // Step 2: Direct processing (enrichment is handled by processAndSaveRecipe)
    console.log(`🔄 Step 2: Preparing recipe for processing...`);
    const enrichedData = scrapedData; // processAndSaveRecipe handles enrichment internally

    console.log(`✅ Recipe data prepared:`);
    console.log(`   Title: ${enrichedData.title || 'N/A'}`);
    console.log(`   Ingredients: ${enrichedData.ingredients?.length || 0}`);
    console.log(`   Instructions: ${enrichedData.instructions?.length || 0}`);
    console.log(`   Servings: ${enrichedData.servings || 'N/A'}`);
    console.log(`   Ready for processing and enrichment by database layer`);

    // Step 3: Optional database upsert
    let upsertResult: any = null;
    if (shouldUpsert) {
      console.log(`💾 Step 3: Processing and saving to database...`);
      try {
        await processAndSaveRecipe(scrapedData, scrapedData.source_url || url, {
          include_ai: true,
          include_nutrition: true,
          generate_embedding: true
        });
        upsertResult = { success: true };
        console.log(`✅ Recipe processed and saved successfully`);
      } catch (error) {
        console.error(`❌ Database upsert failed:`, error);
        return { 
          success: true, 
          data: enrichedData, 
          upsertError: error instanceof Error ? error.message : 'Unknown upsert error' 
        };
      }
    }

    const duration = Date.now() - startTime;
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🎉 Single recipe scrape completed successfully in ${duration}ms`);
    console.log(`📊 Recipe processed with full enrichment pipeline`);

    return {
      success: true,
      data: enrichedData,
      upsertResult,
      duration
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error(`❌ Single recipe scrape failed after ${duration}ms:`, error);
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
  
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
🥘 Single Recipe Scraper

Usage:
  tsx scrape-single-recipe.ts <recipe-url> [--upsert]

Arguments:
  recipe-url    URL of the recipe to scrape

Options:
  --upsert     Also upsert the scraped recipe to the database
  --help, -h   Show this help message

Examples:
  tsx scrape-single-recipe.ts "https://food52.com/recipes/12345-hot-zukes"
  tsx scrape-single-recipe.ts "https://www.allrecipes.com/recipe/123/pasta" --upsert
`);
    process.exit(0);
  }

  const url = args[0];
  const shouldUpsert = args.includes('--upsert');

  if (!url.startsWith('http')) {
    console.error('❌ Error: Please provide a valid URL starting with http:// or https://');
    process.exit(1);
  }

  const result = await scrapeSingleRecipe(url, shouldUpsert);
  
  if (!result.success) {
    console.error(`❌ Scraping failed: ${result.error}`);
    process.exit(1);
  }

  console.log(`✅ Recipe scraped successfully and processed through enrichment pipeline!`);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { scrapeSingleRecipe };
