/**
 * Expanded Sources Test
 * Tests additional recipe websites and MCP sources
 */

import { UniversalRecipeScraper } from './src/scrapers/UniversalRecipeScraper.js';
import { mcpCook } from './src/scrapers/MCPCookScraper.js';
import { howToCookMCP } from './src/scrapers/HowToCookMCPScraper.js';
import { recipeAggregator } from './src/scrapers/MultiSourceRecipeAggregator.js';
import { EnhancedLogger } from './src/utils/EnhancedLogger.js';
import * as fs from 'fs/promises';

// Configure enhanced logging
EnhancedLogger.configure({
  enableConsole: true,
  enableFile: true,
  minLevel: 'info',
  logFile: 'logs/expanded-test.log',
});

const logger = EnhancedLogger.scope('ExpandedTest');

interface TestResult {
  source: string;
  type: 'website' | 'mcp' | 'aggregator';
  success: boolean;
  recipesFound: number;
  sampleTitle?: string;
  error?: string;
  duration: number;
}

// Expanded list of recipe websites
const RECIPE_WEBSITES = [
  // Popular Recipe Sites
  { url: 'https://www.seriouseats.com/perfect-chocolate-chip-cookies-recipe', name: 'Serious Eats' },
  { url: 'https://www.bonappetit.com/recipe/classic-brownies', name: 'Bon Appétit' },
  { url: 'https://www.foodnetwork.com/recipes/ree-drummond/perfect-pancakes-recipe-1943482', name: 'Food Network' },
  { url: 'https://www.allrecipes.com/recipe/10813/best-chocolate-chip-cookies/', name: 'AllRecipes' },

  // Food Blogs
  { url: 'https://smittenkitchen.com/2009/05/best-blueberry-muffins/', name: 'Smitten Kitchen' },
  { url: 'https://minimalistbaker.com/5-ingredient-peanut-butter-cookies/', name: 'Minimalist Baker' },
  { url: 'https://www.budgetbytes.com/basic-chicken-stir-fry/', name: 'Budget Bytes' },
  { url: 'https://pinchofyum.com/the-best-soft-chocolate-chip-cookies', name: 'Pinch of Yum' },
  { url: 'https://www.gimmesomeoven.com/best-chocolate-chip-cookies/', name: 'Gimme Some Oven' },

  // International
  { url: 'https://www.bbcgoodfood.com/recipes/classic-lasagne', name: 'BBC Good Food' },
  { url: 'https://cooking.nytimes.com/recipes/1024654-chocolate-chip-cookies', name: 'NY Times Cooking' },

  // Specialty Diets
  { url: 'https://minimalistbaker.com/easy-vegan-fried-rice/', name: 'Vegan - Minimalist Baker' },
  { url: 'https://www.paleoleap.com/easy-paleo-chicken-stir-fry/', name: 'Paleo Leap' },

  // Recipe Aggregators
  { url: 'https://www.yummly.com/recipe/Chocolate-Chip-Cookies-2650891', name: 'Yummly' },
  { url: 'https://www.epicurious.com/recipes/food/views/classic-brownies', name: 'Epicurious' },
];

// MCP Source Tests
const MCP_TESTS = [
  {
    name: 'MCP-Cook: Get Dish List',
    fn: async () => {
      const dishes = await mcpCook.getDishList();
      return { recipesFound: dishes.length, sampleTitle: dishes[0] };
    },
  },
  {
    name: 'MCP-Cook: Search "chicken"',
    fn: async () => {
      const recipes = await mcpCook.searchRecipes({ query: 'chicken', limit: 5 });
      return { recipesFound: recipes.length, sampleTitle: recipes[0]?.title };
    },
  },
  {
    name: 'MCP-Cook: Get Random Recipes',
    fn: async () => {
      const recipes = await mcpCook.getRandomRecipes(1);
      return { recipesFound: recipes.length, sampleTitle: recipes[0]?.title };
    },
  },
  {
    name: 'HowToCook MCP: Search "鸡蛋" (egg)',
    fn: async () => {
      const recipes = await howToCookMCP.searchRecipes({ query: '鸡蛋', limit: 3 });
      return { recipesFound: recipes.length, sampleTitle: recipes[0]?.title };
    },
  },
  {
    name: 'HowToCook MCP: Random Recipe',
    fn: async () => {
      const recipe = await howToCookMCP.getRandomRecipe(2);
      return { recipesFound: recipe ? 1 : 0, sampleTitle: recipe?.title };
    },
  },
];

// Multi-Source Aggregator Tests (using real URLs)
const AGGREGATOR_TESTS = [
  { url: 'https://www.allrecipes.com/recipe/10813/best-chocolate-chip-cookies/', name: 'chocolate chip cookies' },
  { url: 'https://www.bonappetit.com/recipe/spaghetti-carbonara', name: 'spaghetti carbonara' },
  { url: 'https://www.seriouseats.com/chicken-tikka-masala', name: 'chicken tikka masala' },
];

async function testWebsite(site: { url: string; name: string }): Promise<TestResult> {
  const startTime = Date.now();
  logger.info(`Testing website: ${site.name}`);

  try {
    const result = await UniversalRecipeScraper.scrape(site.url);
    const duration = Date.now() - startTime;

    if (result.recipe) {
      logger.success(`${site.name} succeeded`, {
        title: result.recipe.title,
        ingredients: Array.isArray(result.recipe.ingredients)
          ? result.recipe.ingredients.length
          : 0,
      });

      return {
        source: site.name,
        type: 'website',
        success: true,
        recipesFound: 1,
        sampleTitle: result.recipe.title,
        duration,
      };
    } else {
      logger.warn(`${site.name} returned no recipe`);
      return {
        source: site.name,
        type: 'website',
        success: false,
        recipesFound: 0,
        error: 'No recipe returned',
        duration,
      };
    }
  } catch (error: any) {
    const duration = Date.now() - startTime;
    logger.error(`${site.name} failed`, { error: error.message });

    return {
      source: site.name,
      type: 'website',
      success: false,
      recipesFound: 0,
      error: error.message,
      duration,
    };
  }
}

async function testMCPSource(test: { name: string; fn: () => Promise<any> }): Promise<TestResult> {
  const startTime = Date.now();
  logger.info(`Testing MCP: ${test.name}`);

  try {
    const result = await test.fn();
    const duration = Date.now() - startTime;

    logger.success(`${test.name} succeeded`, result);

    return {
      source: test.name,
      type: 'mcp',
      success: true,
      recipesFound: result.recipesFound,
      sampleTitle: result.sampleTitle,
      duration,
    };
  } catch (error: any) {
    const duration = Date.now() - startTime;
    logger.error(`${test.name} failed`, { error: error.message });

    return {
      source: test.name,
      type: 'mcp',
      success: false,
      recipesFound: 0,
      error: error.message,
      duration,
    };
  }
}

async function testAggregator(test: { url: string; name: string }): Promise<TestResult> {
  const startTime = Date.now();
  logger.info(`Testing aggregator: "${test.name}"`);

  try {
    const result = await recipeAggregator.aggregateRecipe(test.url, test.name);
    const duration = Date.now() - startTime;

    if (result.recipe) {
      logger.success(`Aggregator found recipe for "${test.name}"`, {
        title: result.recipe.title,
        sources: result.sources,
      });

      return {
        source: `Aggregator: ${test.name}`,
        type: 'aggregator',
        success: true,
        recipesFound: 1,
        sampleTitle: result.recipe.title,
        duration,
      };
    } else {
      logger.warn(`Aggregator found no recipe for "${test.name}"`);
      return {
        source: `Aggregator: ${test.name}`,
        type: 'aggregator',
        success: false,
        recipesFound: 0,
        error: 'No recipe found',
        duration,
      };
    }
  } catch (error: any) {
    const duration = Date.now() - startTime;
    logger.error(`Aggregator failed for "${test.name}"`, { error: error.message });

    return {
      source: `Aggregator: ${test.name}`,
      type: 'aggregator',
      success: false,
      recipesFound: 0,
      error: error.message,
      duration,
    };
  }
}

async function main() {
  console.log('\n🌍 EXPANDED SOURCES TEST SUITE');
  console.log('Testing additional websites and MCP sources\n');

  const allResults: TestResult[] = [];

  // Test Recipe Websites
  console.log('\n\n📰 TESTING RECIPE WEBSITES');
  console.log('='.repeat(80));
  for (const site of RECIPE_WEBSITES) {
    const result = await testWebsite(site);
    allResults.push(result);

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Test MCP Sources
  console.log('\n\n🔌 TESTING MCP SOURCES');
  console.log('='.repeat(80));
  for (const test of MCP_TESTS) {
    const result = await testMCPSource(test);
    allResults.push(result);

    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Test Multi-Source Aggregator
  console.log('\n\n🔍 TESTING MULTI-SOURCE AGGREGATOR');
  console.log('='.repeat(80));
  for (const test of AGGREGATOR_TESTS) {
    const result = await testAggregator(test);
    allResults.push(result);

    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Cleanup MCP connections
  try {
    await mcpCook.disconnect();
    await howToCookMCP.disconnect();
  } catch (e) {
    // Ignore cleanup errors
  }

  // Generate comprehensive report
  console.log('\n\n' + '='.repeat(80));
  console.log('📊 COMPREHENSIVE TEST REPORT');
  console.log('='.repeat(80));

  const successful = allResults.filter(r => r.success);
  const failed = allResults.filter(r => !r.success);

  console.log(`\n📈 Overall Stats:`);
  console.log(`   Total Tests: ${allResults.length}`);
  console.log(`   ✅ Successful: ${successful.length} (${((successful.length / allResults.length) * 100).toFixed(1)}%)`);
  console.log(`   ❌ Failed: ${failed.length}`);
  console.log(`   📦 Total Recipes Found: ${allResults.reduce((sum, r) => sum + r.recipesFound, 0)}`);

  // Breakdown by type
  console.log(`\n📊 By Source Type:`);
  const byType = {
    website: allResults.filter(r => r.type === 'website'),
    mcp: allResults.filter(r => r.type === 'mcp'),
    aggregator: allResults.filter(r => r.type === 'aggregator'),
  };

  for (const [type, results] of Object.entries(byType)) {
    const typeSuccess = results.filter(r => r.success);
    console.log(`   ${type.toUpperCase()}: ${typeSuccess.length}/${results.length} successful`);
  }

  // Performance stats
  const avgDuration = successful.reduce((sum, r) => sum + r.duration, 0) / successful.length;
  console.log(`\n⏱️  Performance:`);
  console.log(`   Average Duration: ${avgDuration.toFixed(0)}ms`);
  console.log(`   Fastest: ${Math.min(...successful.map(r => r.duration))}ms`);
  console.log(`   Slowest: ${Math.max(...successful.map(r => r.duration))}ms`);

  // Top performers
  console.log(`\n🏆 Top 5 Fastest Sources:`);
  const topPerformers = [...successful]
    .sort((a, b) => a.duration - b.duration)
    .slice(0, 5);

  for (const performer of topPerformers) {
    console.log(`   ${performer.duration}ms - ${performer.source}`);
  }

  // Failed tests details
  if (failed.length > 0) {
    console.log(`\n❌ Failed Tests (${failed.length}):`);
    for (const result of failed.slice(0, 10)) {
      console.log(`   - ${result.source}`);
      console.log(`     Error: ${result.error}`);
    }
    if (failed.length > 10) {
      console.log(`   ... and ${failed.length - 10} more`);
    }
  }

  // Sample successful recipes
  console.log(`\n📖 Sample Successful Recipes:`);
  const samples = successful.filter(r => r.sampleTitle).slice(0, 10);
  for (const sample of samples) {
    console.log(`   - ${sample.sampleTitle} (from ${sample.source})`);
  }

  // Save detailed report
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total: allResults.length,
      successful: successful.length,
      failed: failed.length,
      successRate: `${((successful.length / allResults.length) * 100).toFixed(1)}%`,
      totalRecipes: allResults.reduce((sum, r) => sum + r.recipesFound, 0),
      avgDuration: `${avgDuration.toFixed(0)}ms`,
      byType: {
        website: `${byType.website.filter(r => r.success).length}/${byType.website.length}`,
        mcp: `${byType.mcp.filter(r => r.success).length}/${byType.mcp.length}`,
        aggregator: `${byType.aggregator.filter(r => r.success).length}/${byType.aggregator.length}`,
      },
    },
    results: allResults,
  };

  await fs.writeFile(
    'test-results-expanded-sources.json',
    JSON.stringify(report, null, 2)
  );

  console.log('\n💾 Detailed report saved to: test-results-expanded-sources.json');

  // Save enhanced logs
  await EnhancedLogger.saveLogs('logs/expanded-test-detailed.json');

  // Exit with appropriate code
  const exitCode = successful.length >= allResults.length * 0.5 ? 0 : 1;
  console.log(`\n${exitCode === 0 ? '✅' : '❌'} Tests ${exitCode === 0 ? 'PASSED' : 'FAILED'} (50% threshold)`);

  process.exit(exitCode);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
