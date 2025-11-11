/**
 * Deduplication and Multi-Source Test
 * Tests the expanded 7-API aggregator with deduplication
 */

import { recipeAggregator } from './src/scrapers/MultiSourceRecipeAggregator.js';
import { recipeDeduplicator } from './src/utils/recipeDeduplicator.js';

interface TestResult {
  recipeName: string;
  url: string;
  success: boolean;
  sources: string[];
  completeness: number;
  confidence: number;
  duplicatesRemoved: number;
  processingTime: number;
  error?: string;
}

async function testRecipe(url: string, recipeName?: string): Promise<TestResult> {
  try {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Testing: ${recipeName || url}`);
    console.log(`${'='.repeat(80)}`);

    const startTime = Date.now();

    // Clear deduplicator for clean test
    recipeDeduplicator.clear();

    const result = await recipeAggregator.aggregateRecipe(url, recipeName);

    const processingTime = Date.now() - startTime;

    console.log(`\n✅ SUCCESS`);
    console.log(`   Title: ${result.recipe.title}`);
    console.log(`   Sources: ${result.sources.join(', ')}`);
    console.log(`   Completeness: ${result.combinedCompleteness}%`);
    console.log(`   Confidence: ${result.combinedConfidence}%`);
    console.log(`   Processing Time: ${processingTime}ms`);

    return {
      recipeName: recipeName || url,
      url,
      success: true,
      sources: result.sources,
      completeness: result.combinedCompleteness,
      confidence: result.combinedConfidence,
      duplicatesRemoved: 0, // Will be calculated from logs
      processingTime
    };
  } catch (error: any) {
    console.log(`\n❌ FAILED: ${error.message}`);

    return {
      recipeName: recipeName || url,
      url,
      success: false,
      sources: [],
      completeness: 0,
      confidence: 0,
      duplicatesRemoved: 0,
      processingTime: 0,
      error: error.message
    };
  }
}

async function runTests() {
  console.log('\n🚀 MULTI-SOURCE AGGREGATOR + DEDUPLICATION TEST');
  console.log('Testing 7 API sources with deduplication\n');

  const testCases = [
    {
      name: 'Chicken Tikka Masala',
      url: 'https://www.seriouseats.com/chicken-tikka-masala-recipe'
    },
    {
      name: 'Spaghetti Carbonara',
      url: 'https://www.bonappetit.com/recipe/spaghetti-carbonara'
    },
    {
      name: 'Beef Wellington',
      url: 'https://www.gordonramsay.com/gr/recipes/beef-wellington/'
    },
    {
      name: 'Lasagne',
      url: 'https://www.bbcgoodfood.com/recipes/lasagne'
    },
    {
      name: 'Chocolate Chip Cookies',
      url: 'https://www.bonappetit.com/recipe/bas-best-chocolate-chip-cookies'
    }
  ];

  const results: TestResult[] = [];

  for (const testCase of testCases) {
    const result = await testRecipe(testCase.url, testCase.name);
    results.push(result);

    // Wait between requests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Print summary
  console.log(`\n${'='.repeat(80)}`);
  console.log('📊 TEST SUMMARY');
  console.log(`${'='.repeat(80)}\n`);

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`Total Tests: ${results.length}`);
  console.log(`Successful: ${successful.length} (${((successful.length / results.length) * 100).toFixed(0)}%)`);
  console.log(`Failed: ${failed.length}`);

  if (successful.length > 0) {
    console.log(`\n✅ SUCCESSFUL TESTS:\n`);

    // Source distribution
    const sourceCounts = new Map<string, number>();
    successful.forEach(r => {
      r.sources.forEach(source => {
        sourceCounts.set(source, (sourceCounts.get(source) || 0) + 1);
      });
    });

    console.log('Source Distribution:');
    for (const [source, count] of Array.from(sourceCounts.entries()).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${source}: ${count} recipes`);
    }

    // Averages
    const avgCompleteness = successful.reduce((sum, r) => sum + r.completeness, 0) / successful.length;
    const avgConfidence = successful.reduce((sum, r) => sum + r.confidence, 0) / successful.length;
    const avgTime = successful.reduce((sum, r) => sum + r.processingTime, 0) / successful.length;
    const avgSources = successful.reduce((sum, r) => sum + r.sources.length, 0) / successful.length;

    console.log(`\nAverages:`);
    console.log(`  Completeness: ${avgCompleteness.toFixed(1)}%`);
    console.log(`  Confidence: ${avgConfidence.toFixed(1)}%`);
    console.log(`  Processing Time: ${avgTime.toFixed(0)}ms`);
    console.log(`  Sources per Recipe: ${avgSources.toFixed(1)}`);

    // New source utilization
    const newSources = ['wikidata', 'cook-mcp', 'google-cse'];
    const newSourceHits = successful.filter(r =>
      r.sources.some(s => newSources.includes(s))
    );

    console.log(`\nNew Source Utilization:`);
    console.log(`  Recipes using new sources: ${newSourceHits.length}/${successful.length}`);
    console.log(`  Utilization rate: ${((newSourceHits.length / successful.length) * 100).toFixed(0)}%`);
  }

  if (failed.length > 0) {
    console.log(`\n❌ FAILED TESTS:\n`);
    failed.forEach(r => {
      console.log(`  ${r.recipeName}: ${r.error}`);
    });
  }

  // Deduplication stats
  console.log(`\n🔍 DEDUPLICATION STATS:\n`);
  const stats = recipeDeduplicator.getStats();
  console.log(`  Total unique recipes indexed: ${stats.totalRecipes}`);
  console.log(`  Title index size: ${stats.titleIndexSize}`);
  console.log(`  URL index size: ${stats.urlIndexSize}`);

  console.log(`\n✅ TEST COMPLETE\n`);

  // Final verdict
  const successRate = (successful.length / results.length) * 100;
  if (successRate >= 80) {
    console.log(`🎉 SUCCESS: ${successRate.toFixed(0)}% success rate (target: 80%+)`);
  } else {
    console.log(`⚠️  WARNING: ${successRate.toFixed(0)}% success rate (target: 80%+)`);
  }
}

// Run tests
runTests().catch(console.error);
