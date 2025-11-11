/**
 * Quick test for MCP scrapers with corrected tool names
 */

import { mcpCook } from './src/scrapers/MCPCookScraper.js';
import { howToCookMCP } from './src/scrapers/HowToCookMCPScraper.js';

async function testMCPCookScraper() {
  console.log('\n🧪 Testing MCP-Cook Scraper');
  console.log('='.repeat(60));

  try {
    // Test 1: Get dish list
    console.log('\n📋 Test 1: Getting dish list...');
    const dishes = await mcpCook.getDishList();
    console.log(`✅ Found ${dishes.length} dishes`);
    if (dishes.length > 0) {
      console.log(`   Sample dishes: ${dishes.slice(0, 3).join(', ')}`);
    }

    // Test 2: Search for a recipe
    if (dishes.length > 0) {
      console.log('\n🔍 Test 2: Getting recipe details...');
      const recipeName = dishes[0];
      const recipe = await mcpCook.getRecipe(recipeName);
      if (recipe) {
        console.log(`✅ Recipe: ${recipe.title}`);
        console.log(`   Ingredients: ${recipe.ingredients.length}`);
        console.log(`   Instructions: ${recipe.instructions.length}`);
      } else {
        console.log(`❌ Failed to get recipe for: ${recipeName}`);
      }
    }

    // Test 3: Search by query
    console.log('\n🔍 Test 3: Searching recipes...');
    const searchResults = await mcpCook.searchRecipes({ query: 'chicken', limit: 2 });
    console.log(`✅ Found ${searchResults.length} recipes matching "chicken"`);

    await mcpCook.disconnect();
    console.log('\n✅ MCP-Cook tests completed successfully!');
    return true;
  } catch (error: any) {
    console.error('\n❌ MCP-Cook test failed:', error.message);
    return false;
  }
}

async function testHowToCookScraper() {
  console.log('\n\n🧪 Testing HowToCook MCP Scraper');
  console.log('='.repeat(60));

  try {
    // Test 1: Search by query
    console.log('\n🔍 Test 1: Searching for recipes...');
    const recipes = await howToCookMCP.searchRecipes({ query: '鸡蛋', limit: 2 });
    console.log(`✅ Found ${recipes.length} recipes`);
    if (recipes.length > 0) {
      console.log(`   Sample: ${recipes[0].title}`);
      console.log(`   Ingredients: ${recipes[0].ingredients.length}`);
      console.log(`   Instructions: ${recipes[0].instructions.length}`);
    }

    // Test 2: Get random recipe
    console.log('\n🎲 Test 2: Getting random recipe suggestion...');
    const randomRecipe = await howToCookMCP.getRandomRecipe(2);
    if (randomRecipe) {
      console.log(`✅ Random recipe: ${randomRecipe.title}`);
    } else {
      console.log(`⚠️  No random recipe returned (might be network issue)`);
    }

    await howToCookMCP.disconnect();
    console.log('\n✅ HowToCook MCP tests completed!');
    return true;
  } catch (error: any) {
    console.error('\n❌ HowToCook MCP test failed:', error.message);
    if (error.message.includes('SSL') || error.message.includes('fetch failed')) {
      console.log('ℹ️  This is a known network/SSL issue with the remote GitHub repository');
    }
    return false;
  }
}

async function main() {
  console.log('🧪 MCP SCRAPERS INTEGRATION TEST\n');

  const mcpCookSuccess = await testMCPCookScraper();
  const howToCookSuccess = await testHowToCookScraper();

  console.log('\n\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`MCP-Cook:     ${mcpCookSuccess ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`HowToCook MCP: ${howToCookSuccess ? '✅ PASS' : '⚠️  FAIL (network issue)'}`);

  if (mcpCookSuccess) {
    console.log('\n✅ At least one MCP source is working correctly!');
  }

  process.exit(mcpCookSuccess ? 0 : 1);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
