/**
 * Real Recipe Video Test Suite
 * Tests with actual recipe videos from YouTube, TikTok, Instagram
 */

import { enhancedVideoScraper } from './src/scrapers/EnhancedVideoRecipeScraper.js';
import { UniversalRecipeScraper } from './src/scrapers/UniversalRecipeScraper.js';
import * as fs from 'fs/promises';

interface TestResult {
  url: string;
  platform: string;
  success: boolean;
  title?: string;
  ingredients?: number;
  instructions?: number;
  hasNutrition?: boolean;
  error?: string;
  processingTime?: number;
}

const REAL_RECIPE_URLS = {
  youtube: [
    'https://www.youtube.com/watch?v=rP8vYfNz7ZI', // Tasty: 3-Ingredient Breakfast Recipes
    'https://www.youtube.com/watch?v=VgP-BZWfUCw', // Joshua Weissman: Perfect Pizza
    'https://www.youtube.com/watch?v=lsBV5NMeUWM', // Binging with Babish: Chocolate Chip Cookies
    'https://www.youtube.com/watch?v=weFT03Mcah0', // Gordon Ramsay: Scrambled Eggs
  ],
  websites: [
    'https://www.seriouseats.com/perfect-chocolate-chip-cookies-recipe',
    'https://www.bonappetit.com/recipe/classic-brownies',
    'https://www.foodnetwork.com/recipes/ree-drummond/perfect-pancakes-recipe-1943482',
    'https://www.allrecipes.com/recipe/10813/best-chocolate-chip-cookies/',
    'https://smittenkitchen.com/2009/05/best-blueberry-muffins/',
    'https://minimalistbaker.com/5-ingredient-peanut-butter-cookies/',
  ],
};

async function testRecipeVideo(url: string, platform: string): Promise<TestResult> {
  const startTime = Date.now();

  try {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🧪 Testing ${platform.toUpperCase()}: ${url}`);
    console.log(`${'='.repeat(80)}\n`);

    const recipe = await enhancedVideoScraper.scrapeRecipe(url);

    if (!recipe) {
      return {
        url,
        platform,
        success: false,
        error: 'Scraper returned null',
        processingTime: Date.now() - startTime,
      };
    }

    const result: TestResult = {
      url,
      platform,
      success: true,
      title: recipe.title,
      ingredients: recipe.ingredients.length,
      instructions: recipe.instructions.length,
      hasNutrition: !!recipe.nutrition,
      processingTime: Date.now() - startTime,
    };

    console.log('\n✅ SUCCESS!');
    console.log(`   📝 Title: ${recipe.title}`);
    console.log(`   🥗 Ingredients: ${recipe.ingredients.length}`);
    console.log(`   📋 Instructions: ${recipe.instructions.length}`);
    console.log(`   🍎 Nutrition: ${recipe.nutrition ? 'YES' : 'NO'}`);
    if (recipe.nutrition?.calories) {
      console.log(`      - Calories: ${recipe.nutrition.calories}`);
      console.log(`      - Protein: ${recipe.nutrition.protein_g}g`);
      console.log(`      - Fat: ${recipe.nutrition.fat_g}g`);
      console.log(`      - Carbs: ${recipe.nutrition.carbohydrates_g}g`);
    }
    console.log(`   ⏱️  Processing Time: ${result.processingTime}ms`);

    return result;

  } catch (error: any) {
    console.log(`\n❌ FAILED: ${error.message}`);
    return {
      url,
      platform,
      success: false,
      error: error.message,
      processingTime: Date.now() - startTime,
    };
  }
}

async function testRecipeWebsite(url: string): Promise<TestResult> {
  const startTime = Date.now();

  try {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🧪 Testing WEBSITE: ${url}`);
    console.log(`${'='.repeat(80)}\n`);

    const result = await UniversalRecipeScraper.scrape(url);

    if (!result.recipe) {
      return {
        url,
        platform: 'website',
        success: false,
        error: 'No recipe returned',
        processingTime: Date.now() - startTime,
      };
    }

    const testResult: TestResult = {
      url,
      platform: 'website',
      success: true,
      title: result.recipe.title,
      ingredients: Array.isArray(result.recipe.ingredients)
        ? result.recipe.ingredients.length
        : 0,
      instructions: Array.isArray(result.recipe.instructions)
        ? result.recipe.instructions.length
        : 0,
      hasNutrition: !!result.recipe.nutrition,
      processingTime: Date.now() - startTime,
    };

    console.log('\n✅ SUCCESS!');
    console.log(`   📝 Title: ${result.recipe.title}`);
    console.log(`   🥗 Ingredients: ${testResult.ingredients}`);
    console.log(`   📋 Instructions: ${testResult.instructions}`);
    console.log(`   📊 Confidence: ${result.confidence}%`);
    console.log(`   🔧 Method: ${result.method}`);
    console.log(`   ⏱️  Processing Time: ${testResult.processingTime}ms`);

    return testResult;

  } catch (error: any) {
    console.log(`\n❌ FAILED: ${error.message}`);
    return {
      url,
      platform: 'website',
      success: false,
      error: error.message,
      processingTime: Date.now() - startTime,
    };
  }
}

async function main() {
  console.log('\n🎬 REAL RECIPE TEST SUITE');
  console.log('Testing with actual recipe videos and websites\n');

  const allResults: TestResult[] = [];

  // Test YouTube Videos
  console.log('\n\n📹 YOUTUBE RECIPE VIDEOS');
  console.log('='.repeat(80));
  for (const url of REAL_RECIPE_URLS.youtube) {
    const result = await testRecipeVideo(url, 'youtube');
    allResults.push(result);

    // Add delay between tests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Test Recipe Websites
  console.log('\n\n🌐 RECIPE WEBSITES');
  console.log('='.repeat(80));
  for (const url of REAL_RECIPE_URLS.websites) {
    const result = await testRecipeWebsite(url);
    allResults.push(result);

    // Add delay between tests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Generate Summary Report
  console.log('\n\n' + '='.repeat(80));
  console.log('📊 TEST SUMMARY REPORT');
  console.log('='.repeat(80));

  const successful = allResults.filter(r => r.success);
  const failed = allResults.filter(r => !r.success);
  const withNutrition = allResults.filter(r => r.hasNutrition);

  console.log(`\nTotal Tests: ${allResults.length}`);
  console.log(`✅ Successful: ${successful.length} (${((successful.length / allResults.length) * 100).toFixed(1)}%)`);
  console.log(`❌ Failed: ${failed.length}`);
  console.log(`🍎 With Nutrition: ${withNutrition.length} (${((withNutrition.length / allResults.length) * 100).toFixed(1)}%)`);

  // Platform breakdown
  console.log('\n📊 By Platform:');
  const platforms = [...new Set(allResults.map(r => r.platform))];
  for (const platform of platforms) {
    const platformResults = allResults.filter(r => r.platform === platform);
    const platformSuccess = platformResults.filter(r => r.success);
    console.log(`   ${platform.toUpperCase()}: ${platformSuccess.length}/${platformResults.length} successful`);
  }

  // Average processing time
  const avgTime = successful.reduce((sum, r) => sum + (r.processingTime || 0), 0) / successful.length;
  console.log(`\n⏱️  Average Processing Time: ${avgTime.toFixed(0)}ms`);

  // Ingredients and Instructions stats
  const avgIngredients = successful.reduce((sum, r) => sum + (r.ingredients || 0), 0) / successful.length;
  const avgInstructions = successful.reduce((sum, r) => sum + (r.instructions || 0), 0) / successful.length;
  console.log(`🥗 Average Ingredients: ${avgIngredients.toFixed(1)}`);
  console.log(`📋 Average Instructions: ${avgInstructions.toFixed(1)}`);

  // Failed tests details
  if (failed.length > 0) {
    console.log('\n❌ Failed Tests:');
    for (const result of failed) {
      console.log(`   - ${result.platform}: ${result.url}`);
      console.log(`     Error: ${result.error}`);
    }
  }

  // Save detailed results to file
  const reportData = {
    timestamp: new Date().toISOString(),
    summary: {
      total: allResults.length,
      successful: successful.length,
      failed: failed.length,
      successRate: ((successful.length / allResults.length) * 100).toFixed(1) + '%',
      withNutrition: withNutrition.length,
      avgProcessingTime: avgTime.toFixed(0) + 'ms',
      avgIngredients: avgIngredients.toFixed(1),
      avgInstructions: avgInstructions.toFixed(1),
    },
    results: allResults,
  };

  await fs.writeFile(
    'test-results-real-recipes.json',
    JSON.stringify(reportData, null, 2)
  );

  console.log('\n💾 Detailed results saved to: test-results-real-recipes.json');

  // Exit with appropriate code
  const exitCode = successful.length >= allResults.length * 0.7 ? 0 : 1;
  console.log(`\n${exitCode === 0 ? '✅' : '❌'} Tests ${exitCode === 0 ? 'PASSED' : 'FAILED'} (70% threshold)`);

  process.exit(exitCode);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
