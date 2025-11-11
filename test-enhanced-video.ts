/**
 * Quick test for Enhanced Video Recipe Scraper
 */

import { enhancedVideoScraper } from './src/scrapers/EnhancedVideoRecipeScraper.js';

async function testEnhancedVideoScraper() {
  console.log('\n🧪 Testing Enhanced Video Recipe Scraper');
  console.log('='.repeat(60));

  // Test with a simple YouTube video URL (using oEmbed, no API key needed)
  const testUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

  try {
    console.log(`\n📹 Testing YouTube metadata extraction: ${testUrl}`);

    const recipe = await enhancedVideoScraper.scrapeRecipe(testUrl);

    if (recipe) {
      console.log('\n✅ Recipe scraped successfully!');
      console.log(`   Title: ${recipe.title}`);
      console.log(`   Source: ${recipe.source_url}`);
      console.log(`   Author: ${recipe.author}`);
      console.log(`   Ingredients: ${recipe.ingredients.length}`);
      console.log(`   Instructions: ${recipe.instructions.length}`);

      if (recipe.nutrition) {
        console.log(`   Nutrition: ✅ Enriched`);
        console.log(`      Calories: ${recipe.nutrition.calories}`);
        console.log(`      Protein: ${recipe.nutrition.protein_g}g`);
      } else {
        console.log(`   Nutrition: ⚠️  Not enriched (expected for test)`);
      }
    } else {
      console.log('\n❌ Recipe returned null');
    }

    console.log('\n✅ Enhanced Video Scraper test completed!');
    return true;

  } catch (error: any) {
    console.error('\n❌ Enhanced Video Scraper test failed:', error.message);
    console.log('ℹ️  This is expected if OCR/Transcription APIs are not configured');
    console.log('ℹ️  The scraper should still work for metadata extraction');
    return false;
  }
}

testEnhancedVideoScraper()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
