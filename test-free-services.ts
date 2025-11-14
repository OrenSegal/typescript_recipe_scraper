/**
 * Test script for free LLMs and APIs
 * Run with: npx tsx test-free-services.ts
 */

import { FreeLLMService } from './src/services/FreeLLMService.js';
import { FreeAPIService } from './src/services/FreeAPIService.js';

async function main() {
  console.log('🚀 Testing Free Services Integration\n');
  console.log('='.repeat(60));

  // Test 1: Check which LLM providers are available
  console.log('\n📋 Step 1: Checking Available LLM Providers');
  console.log('-'.repeat(60));
  const availableProviders = FreeLLMService.getAvailableProviders();

  if (availableProviders.length === 0) {
    console.log('⚠️  No LLM providers configured!');
    console.log('💡 See FREE_APIS_SETUP.md for setup instructions');
  } else {
    console.log(`✅ Found ${availableProviders.length} provider(s):`, availableProviders.join(', '));
  }

  // Test 2: Test LLM providers
  console.log('\n📋 Step 2: Testing LLM Providers');
  console.log('-'.repeat(60));

  if (availableProviders.length > 0) {
    console.log('Testing LLM enhancement with sample recipe...');

    try {
      const llmResult = await FreeLLMService.enhanceRecipe({
        recipe: {
          title: 'Chocolate Chip Cookies',
          ingredients: ['2 cups flour', '1 cup butter', '2 cups chocolate chips', '1 cup sugar'],
          instructions: ['Preheat oven to 350F', 'Mix all ingredients', 'Bake for 12 minutes']
        },
        fields: ['tags']
      });

      if (llmResult.success) {
        console.log(`✅ Success! Provider: ${llmResult.provider}`);
        console.log('📝 Generated data:', JSON.stringify(llmResult.data, null, 2));
        if (llmResult.tokensUsed) {
          console.log(`📊 Tokens used: ${llmResult.tokensUsed}`);
        }
      } else {
        console.log('❌ LLM enhancement failed:', llmResult.error);
      }
    } catch (error) {
      console.log('❌ LLM test error:', error);
    }
  } else {
    console.log('⏭️  Skipping LLM tests (no providers configured)');
  }

  // Test 3: Test detailed provider availability
  console.log('\n📋 Step 3: Testing Individual LLM Providers');
  console.log('-'.repeat(60));

  if (availableProviders.length > 0) {
    const providerTests = await FreeLLMService.testProviders();

    for (const [provider, success] of Object.entries(providerTests)) {
      const status = success ? '✅' : '❌';
      console.log(`${status} ${provider}: ${success ? 'working' : 'failed'}`);
    }
  } else {
    console.log('⏭️  No providers to test');
  }

  // Test 4: Test nutrition APIs
  console.log('\n📋 Step 4: Testing Nutrition APIs');
  console.log('-'.repeat(60));

  console.log('Testing nutrition lookup for "banana"...');

  try {
    const nutritionResult = await FreeAPIService.getNutrition({
      ingredientName: 'banana',
      quantity: 100,
      unit: 'g'
    });

    if (nutritionResult.success) {
      console.log(`✅ Success! Provider: ${nutritionResult.provider}`);
      console.log('📊 Nutrition data:', JSON.stringify(nutritionResult.data, null, 2));
      if (nutritionResult.cached) {
        console.log('💾 Data was cached');
      }
    } else {
      console.log('❌ Nutrition lookup failed:', nutritionResult.error);
    }
  } catch (error) {
    console.log('❌ Nutrition test error:', error);
  }

  // Test 5: Test recipe search APIs
  console.log('\n📋 Step 5: Testing Recipe Search APIs');
  console.log('-'.repeat(60));

  console.log('Testing recipe search for "chicken"...');

  try {
    const recipeResult = await FreeAPIService.searchRecipesByIngredient('chicken');

    if (recipeResult.success) {
      console.log(`✅ Success! Provider: ${recipeResult.provider}`);
      const recipes = recipeResult.data as any[];
      console.log(`📚 Found ${recipes.length} recipes`);

      if (recipes.length > 0) {
        console.log('📝 Sample recipes:');
        recipes.slice(0, 3).forEach((recipe: any, index: number) => {
          console.log(`   ${index + 1}. ${recipe.strMeal || recipe.title || 'Unknown'}`);
        });
      }
    } else {
      console.log('❌ Recipe search failed:', recipeResult.error);
    }
  } catch (error) {
    console.log('❌ Recipe search error:', error);
  }

  // Test 6: Test all API providers
  console.log('\n📋 Step 6: Testing All API Providers');
  console.log('-'.repeat(60));

  const apiTests = await FreeAPIService.testAPIs();

  for (const [api, success] of Object.entries(apiTests)) {
    const status = success ? '✅' : '❌';
    console.log(`${status} ${api}: ${success ? 'working' : 'failed'}`);
  }

  // Test 7: Cache statistics
  console.log('\n📋 Step 7: Cache Statistics');
  console.log('-'.repeat(60));

  const cacheStats = FreeAPIService.getCacheStats();
  console.log(`💾 Cache entries: ${cacheStats.size}`);
  console.log(`⏱️  Cache TTL: ${cacheStats.ttl / 1000 / 60} minutes`);

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Summary');
  console.log('='.repeat(60));

  const workingLLMs = Object.values(await FreeLLMService.testProviders()).filter(Boolean).length;
  const workingAPIs = Object.values(await FreeAPIService.testAPIs()).filter(Boolean).length;

  console.log(`\n✅ Working LLM providers: ${workingLLMs}`);
  console.log(`✅ Working API services: ${workingAPIs}`);

  if (workingLLMs === 0 && workingAPIs === 0) {
    console.log('\n⚠️  No services are working!');
    console.log('💡 Please configure at least one free service');
    console.log('📖 See FREE_APIS_SETUP.md for instructions');
  } else if (workingLLMs === 0) {
    console.log('\n⚠️  No LLM providers configured');
    console.log('💡 Consider adding Groq (fastest) or Ollama (local, free)');
  } else if (workingAPIs === 0) {
    console.log('\n⚠️  No API services working');
    console.log('💡 OpenFoodFacts requires no API key and should always work');
  } else {
    console.log('\n🎉 All configured services are working!');
    console.log('🚀 Your recipe scraper is ready to use free AI/APIs');
  }

  console.log('\n' + '='.repeat(60));
  console.log('✨ Test Complete!');
  console.log('='.repeat(60) + '\n');
}

main().catch(console.error);
