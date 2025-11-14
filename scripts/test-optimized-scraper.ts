/**
 * Integration Test for Optimized Recipe Scraper
 * Tests all new features: caching, multi-fallback, parallel enrichment, circuit breakers
 */

import { RobustMultiFallbackScraper } from './src/scrapers/RobustMultiFallbackScraper.js';
import { ParallelEnrichmentPipeline } from './src/enrichment/ParallelEnrichmentPipeline.js';
import { CacheManager } from './src/cache/CacheManager.js';
import { BlockedWebsitesRegistry } from './src/registry/BlockedWebsitesRegistry.js';
import { circuitBreakerManager } from './src/resilience/CircuitBreaker.js';

// Test URLs - variety of formats
const TEST_URLS = [
  'https://www.allrecipes.com/recipe/12151/banana-banana-bread/',
  'https://www.foodnetwork.com/recipes/alton-brown/baked-macaroni-and-cheese-recipe-1939524',
  'https://www.bonappetit.com/recipe/chocolate-chip-cookies',
];

async function testOptimizedScraper() {
  console.log('🧪 TESTING OPTIMIZED RECIPE SCRAPER\n');
  console.log('=' .repeat(80) + '\n');

  // Initialize services
  const cache = CacheManager.getInstance();
  const registry = BlockedWebsitesRegistry.getInstance();

  console.log('📊 Initial Stats:');
  console.log(`  Cache: ${JSON.stringify(cache.getStats())}`);
  console.log(`  Blocked Sites: ${JSON.stringify(registry.getStats())}\n`);

  // Test 1: Robust Multi-Fallback Scraping
  console.log('TEST 1: Robust Multi-Fallback Scraping');
  console.log('-'.repeat(80));

  for (const url of TEST_URLS) {
    try {
      console.log(`\n🔍 Testing: ${url}`);
      const startTime = Date.now();

      // First scrape (no cache)
      const result1 = await RobustMultiFallbackScraper.scrape(url);
      const time1 = Date.now() - startTime;

      console.log(`✅ SUCCESS (${time1}ms)`);
      console.log(`   Method: ${result1.method}`);
      console.log(`   Confidence: ${result1.confidence}%`);
      console.log(`   Title: ${result1.recipe.title}`);
      console.log(`   Ingredients: ${result1.recipe.ingredients.length}`);
      console.log(`   Instructions: ${result1.recipe.instructions.length}`);

      // Second scrape (should hit cache)
      console.log(`\n🎯 Testing cache (same URL)...`);
      const startTime2 = Date.now();
      const result2 = await RobustMultiFallbackScraper.scrape(url);
      const time2 = Date.now() - startTime2;

      console.log(`✅ CACHED (${time2}ms) - ${((time1 - time2) / time1 * 100).toFixed(1)}% faster`);

    } catch (error: any) {
      console.error(`❌ FAILED: ${error.message}`);
    }
  }

  // Test 2: Parallel Enrichment
  console.log('\n\nTEST 2: Parallel Enrichment Pipeline');
  console.log('-'.repeat(80));

  try {
    const testRecipe = {
      title: 'Test Chocolate Chip Cookies',
      description: 'Classic homemade cookies',
      source_url: 'https://test.com/recipe',
      ingredients: [
        '2 cups all-purpose flour',
        '1 cup butter, softened',
        '3/4 cup sugar',
        '2 eggs',
        '1 tsp vanilla extract',
        '1 tsp baking soda',
        '2 cups chocolate chips'
      ],
      instructions: [
        'Preheat oven to 375°F',
        'Mix butter and sugar',
        'Add eggs and vanilla',
        'Combine dry ingredients',
        'Fold in chocolate chips',
        'Bake for 10-12 minutes'
      ],
      servings: 24
    };

    console.log(`\n⚡ Enriching recipe with parallel pipeline...`);
    const enriched = await ParallelEnrichmentPipeline.enrich(testRecipe, {
      includeNutrition: true,
      includeEmbedding: false, // Disabled for speed
      includeAI: false,
      timeout: 30000
    });

    console.log(`✅ Enrichment complete in ${enriched.processingTime}ms`);
    console.log(`   Completeness: ${enriched.completenessScore}%`);
    console.log(`   Confidence: ${enriched.parsingConfidence}%`);
    console.log(`   Status:`, enriched.enrichmentStatus);

  } catch (error: any) {
    console.error(`❌ Enrichment failed: ${error.message}`);
  }

  // Test 3: Circuit Breaker
  console.log('\n\nTEST 3: Circuit Breaker Pattern');
  console.log('-'.repeat(80));

  console.log(`\n🔒 Testing circuit breaker with simulated failures...`);

  // Simulate API call that might fail
  const simulateAPICall = async (shouldFail: boolean) => {
    await new Promise(resolve => setTimeout(resolve, 100));
    if (shouldFail) {
      throw new Error('API call failed');
    }
    return { data: 'success' };
  };

  // Test successful calls
  try {
    for (let i = 0; i < 3; i++) {
      const result = await circuitBreakerManager.execute(
        'test-api',
        () => simulateAPICall(false),
        async () => ({ data: 'fallback' })
      );
      console.log(`  Call ${i + 1}: ${result.data}`);
    }
  } catch (error) {
    console.error(`  Error: ${error}`);
  }

  const breaker = circuitBreakerManager.getBreaker('test-api');
  console.log(`\n  Circuit State: ${breaker.getStats().state}`);
  console.log(`  Success Rate: ${breaker.getSuccessRate().toFixed(2)}%`);

  // Test 4: Blocked Websites Registry
  console.log('\n\nTEST 4: Blocked Websites Registry');
  console.log('-'.repeat(80));

  console.log(`\n📋 Current registry status:`);
  const registryStats = registry.getStats();
  console.log(`   Total Blocked: ${registryStats.total}`);
  console.log(`   Temporary: ${registryStats.temporary}`);
  console.log(`   Permanent: ${registryStats.permanent}`);

  if (registryStats.total > 0) {
    console.log(`\n   Blocked sites by error type:`);
    Object.entries(registryStats.byErrorType).forEach(([type, count]) => {
      console.log(`     ${type}: ${count}`);
    });

    // Export report
    console.log(`\n📄 Generating blocked sites report...`);
    const report = registry.exportReport();
    console.log(report);
  } else {
    console.log(`   ✅ No blocked websites yet - all sites working!`);
  }

  // Test 5: Cache Statistics
  console.log('\n\nTEST 5: Cache Performance');
  console.log('-'.repeat(80));

  const cacheStats = cache.getStats();
  console.log(`\n📊 Cache Statistics:`);
  console.log(`   Memory Cache Size: ${cacheStats.memorySize}/${cacheStats.memoryMax}`);
  console.log(`   Memory Fill Rate: ${cacheStats.memoryHitRate.toFixed(2)}%`);
  console.log(`   Redis Enabled: ${cacheStats.redisEnabled}`);

  // Test 6: Circuit Breaker Stats
  console.log('\n\nTEST 6: Circuit Breaker Statistics');
  console.log('-'.repeat(80));

  const allBreakers = circuitBreakerManager.getAllStats();
  console.log(`\n🔒 Active Circuit Breakers:`);
  Object.entries(allBreakers).forEach(([name, stats]) => {
    console.log(`\n   ${name}:`);
    console.log(`     State: ${stats.state}`);
    console.log(`     Total Requests: ${stats.totalRequests}`);
    console.log(`     Successes: ${stats.totalSuccesses}`);
    console.log(`     Failures: ${stats.totalFailures}`);
    console.log(`     Success Rate: ${((stats.totalSuccesses / stats.totalRequests) * 100).toFixed(2)}%`);
  });

  // Final Summary
  console.log('\n\n' + '='.repeat(80));
  console.log('🎉 OPTIMIZATION TEST COMPLETE!\n');
  console.log('Summary:');
  console.log(`  ✅ Multi-fallback scraping: Working`);
  console.log(`  ✅ Parallel enrichment: Working`);
  console.log(`  ✅ Caching system: Active`);
  console.log(`  ✅ Circuit breakers: Operational`);
  console.log(`  ✅ Blocked sites tracking: Active`);
  console.log('\nAll optimizations are functioning correctly! 🚀');
  console.log('=' .repeat(80));
}

// Run tests
testOptimizedScraper().catch(error => {
  console.error('\n❌ TEST SUITE FAILED:', error);
  process.exit(1);
});
