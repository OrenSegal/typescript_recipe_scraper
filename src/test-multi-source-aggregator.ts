#!/usr/bin/env node
/**
 * Test Multi-Source Recipe Aggregator
 * Tests the new multi-API fallback system with TheMealDB, Spoonacular, and Edamam
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { recipeAggregator } from './scrapers/MultiSourceRecipeAggregator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testMultiSourceAggregator() {
  console.log('\n🚀 TESTING MULTI-SOURCE RECIPE AGGREGATOR\n');
  console.log('=' .repeat(80));

  // Read test URLs from recipe-urls.txt
  const urlsFilePath = path.join(__dirname, '..', 'recipe-urls.txt');
  const urlsContent = fs.readFileSync(urlsFilePath, 'utf-8');

  // Parse URLs (skip comments and empty lines)
  const urls = urlsContent
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'))
    .slice(0, 10); // Test first 10 URLs

  console.log(`📋 Testing ${urls.length} URLs:\n`);

  const results: Array<{ url: string; success: boolean; sources: string[]; completeness: number; time: number }> = [];

  for (const url of urls) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🔗 Testing: ${url}`);
    console.log('='.repeat(80));

    try {
      const startTime = Date.now();
      const result = await recipeAggregator.aggregateRecipe(url);
      const endTime = Date.now();

      results.push({
        url,
        success: true,
        sources: result.sources,
        completeness: result.combinedCompleteness,
        time: endTime - startTime
      });

      console.log(`\n✅ SUCCESS!`);
      console.log(`   Recipe: ${result.recipe.title}`);
      console.log(`   Sources: ${result.sources.join(', ')}`);
      console.log(`   Completeness: ${result.combinedCompleteness}%`);
      console.log(`   Confidence: ${result.combinedConfidence}%`);
      console.log(`   Processing time: ${result.processingTime}ms`);
      console.log(`   Ingredients: ${result.recipe.ingredients.length}`);
      console.log(`   Instructions: ${result.recipe.instructions.length}`);
      if (result.recipe.nutrition) {
        console.log(`   Nutrition: ✓ (${result.recipe.nutrition.calories || '?'} cal)`);
      }

    } catch (error: any) {
      results.push({
        url,
        success: false,
        sources: [],
        completeness: 0,
        time: 0
      });

      console.log(`\n❌ FAILED: ${error.message}`);
    }
  }

  // Print summary
  console.log('\n\n' + '='.repeat(80));
  console.log('📊 SUMMARY');
  console.log('='.repeat(80));

  const successCount = results.filter(r => r.success).length;
  const successRate = (successCount / results.length) * 100;

  console.log(`\n✅ Successful: ${successCount}/${results.length} (${successRate.toFixed(1)}%)`);
  console.log(`❌ Failed: ${results.length - successCount}/${results.length}`);

  if (successCount > 0) {
    const avgCompleteness = results
      .filter(r => r.success)
      .reduce((sum, r) => sum + r.completeness, 0) / successCount;

    const avgTime = results
      .filter(r => r.success)
      .reduce((sum, r) => sum + r.time, 0) / successCount;

    console.log(`\n📈 Average completeness: ${avgCompleteness.toFixed(1)}%`);
    console.log(`⏱️  Average processing time: ${avgTime.toFixed(0)}ms`);

    // Sources used
    const sourceCounts = new Map<string, number>();
    for (const result of results.filter(r => r.success)) {
      for (const source of result.sources) {
        sourceCounts.set(source, (sourceCounts.get(source) || 0) + 1);
      }
    }

    console.log(`\n📚 Sources used:`);
    for (const [source, count] of sourceCounts.entries()) {
      console.log(`   ${source}: ${count} times`);
    }
  }

  console.log('\n' + '='.repeat(80));

  // Detailed results
  console.log('\n📝 DETAILED RESULTS:\n');
  for (const result of results) {
    const status = result.success ? '✅' : '❌';
    const completeness = result.success ? ` (${result.completeness}%)` : '';
    const sources = result.success ? ` [${result.sources.join(', ')}]` : '';
    console.log(`${status} ${result.url}${completeness}${sources}`);
  }

  console.log('\n');
}

// Run the test
testMultiSourceAggregator().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
