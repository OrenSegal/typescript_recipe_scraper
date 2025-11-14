/**
 * Enhanced Recipe Scraping Example
 * Demonstrates using free LLM and API services with the recipe scraper
 *
 * Run with: npx tsx examples/enhanced-scraping-example.ts
 */

import { EnhancedRecipeEnrichment } from '../src/services/EnhancedRecipeEnrichment.js';
import { RawScrapedRecipe } from '../src/scrapers/websiteScraper.js';

// Example 1: Basic recipe enhancement with free services
async function example1_BasicEnhancement() {
  console.log('\n' + '='.repeat(70));
  console.log('EXAMPLE 1: Basic Recipe Enhancement');
  console.log('='.repeat(70));

  const rawRecipe: RawScrapedRecipe = {
    title: 'Classic Chocolate Chip Cookies',
    ingredients: [
      '2 cups all-purpose flour',
      '1 cup butter, softened',
      '2 cups chocolate chips',
      '1 cup granulated sugar',
      '1/2 cup brown sugar',
      '2 large eggs',
      '1 tsp vanilla extract',
      '1 tsp baking soda',
      '1/2 tsp salt'
    ],
    instructions: [
      'Preheat oven to 350°F (175°C)',
      'Mix butter and sugars until creamy',
      'Beat in eggs and vanilla',
      'In separate bowl, combine flour, baking soda, and salt',
      'Gradually mix dry ingredients into wet ingredients',
      'Fold in chocolate chips',
      'Drop rounded tablespoons onto baking sheet',
      'Bake for 10-12 minutes until golden brown',
      'Cool on baking sheet for 5 minutes'
    ],
    source_url: 'https://example.com/chocolate-chip-cookies',
    servings: 24,
    prep_time_minutes: 15,
    cook_time_minutes: 12
  };

  const result = await EnhancedRecipeEnrichment.enhanceRecipe(rawRecipe, {
    useLLM: true,                    // Use free LLM for descriptions/tags
    useFreeNutritionAPIs: true,      // Use free nutrition APIs
    useExistingEnrichment: true,     // Use existing NLP enrichment
    llmFields: ['description', 'tags', 'cuisines', 'meal_types']
  });

  console.log('\n✨ Enhanced Recipe:');
  console.log('Title:', result.recipe.title);
  console.log('Description:', result.recipe.description);
  console.log('Tags:', result.recipe.tags?.join(', '));
  console.log('Cuisines:', result.recipe.cuisines?.join(', '));
  console.log('Meal Types:', result.recipe.meal_types?.join(', '));
  console.log('Completeness:', result.stats.completenessScore + '%');

  return result;
}

// Example 2: Enhancement with minimal free services (no LLM)
async function example2_MinimalEnhancement() {
  console.log('\n' + '='.repeat(70));
  console.log('EXAMPLE 2: Minimal Enhancement (Nutrition Only)');
  console.log('='.repeat(70));

  const rawRecipe: RawScrapedRecipe = {
    title: 'Simple Banana Smoothie',
    ingredients: [
      '2 ripe bananas',
      '1 cup milk',
      '1/2 cup Greek yogurt',
      '1 tablespoon honey',
      '1/2 teaspoon vanilla extract'
    ],
    instructions: [
      'Add all ingredients to blender',
      'Blend until smooth',
      'Serve immediately'
    ],
    source_url: 'https://example.com/banana-smoothie',
    servings: 2,
    prep_time_minutes: 5
  };

  const result = await EnhancedRecipeEnrichment.enhanceRecipe(rawRecipe, {
    useLLM: false,                   // Don't use LLM
    useFreeNutritionAPIs: true,      // Only use nutrition APIs
    useExistingEnrichment: true
  });

  console.log('\n✨ Enhanced Recipe:');
  console.log('Title:', result.recipe.title);
  console.log('Nutrition APIs used:', result.stats.nutritionAPIsUsed.join(', '));
  console.log('Completeness:', result.stats.completenessScore + '%');

  return result;
}

// Example 3: Batch enhancement
async function example3_BatchEnhancement() {
  console.log('\n' + '='.repeat(70));
  console.log('EXAMPLE 3: Batch Recipe Enhancement');
  console.log('='.repeat(70));

  const recipes: RawScrapedRecipe[] = [
    {
      title: 'Quick Pasta Carbonara',
      ingredients: ['400g spaghetti', '200g bacon', '4 eggs', '100g parmesan', 'black pepper'],
      instructions: ['Cook pasta', 'Fry bacon', 'Mix eggs and cheese', 'Combine all'],
      source_url: 'https://example.com/carbonara',
      servings: 4,
      prep_time_minutes: 10,
      cook_time_minutes: 15
    },
    {
      title: 'Caesar Salad',
      ingredients: ['romaine lettuce', 'croutons', 'parmesan', 'caesar dressing', 'lemon'],
      instructions: ['Wash lettuce', 'Tear into pieces', 'Add toppings', 'Toss with dressing'],
      source_url: 'https://example.com/caesar-salad',
      servings: 4,
      prep_time_minutes: 10
    },
    {
      title: 'Grilled Chicken',
      ingredients: ['4 chicken breasts', 'olive oil', 'garlic', 'herbs', 'salt', 'pepper'],
      instructions: ['Marinate chicken', 'Preheat grill', 'Grill 6-8 min per side'],
      source_url: 'https://example.com/grilled-chicken',
      servings: 4,
      prep_time_minutes: 15,
      cook_time_minutes: 16
    }
  ];

  const results = await EnhancedRecipeEnrichment.enhanceRecipeBatch(recipes, {
    useLLM: true,
    useFreeNutritionAPIs: true,
    llmFields: ['description', 'tags', 'cuisines']
  });

  console.log('\n✨ Batch Results:');
  results.forEach((result, index) => {
    console.log(`\n${index + 1}. ${result.recipe.title}`);
    console.log(`   Completeness: ${result.stats.completenessScore}%`);
    console.log(`   LLM: ${result.stats.llmUsed ? result.stats.llmProvider : 'Not used'}`);
    console.log(`   Success: ${result.success ? '✅' : '❌'}`);
  });

  return results;
}

// Example 4: Error handling and fallbacks
async function example4_ErrorHandling() {
  console.log('\n' + '='.repeat(70));
  console.log('EXAMPLE 4: Error Handling & Fallbacks');
  console.log('='.repeat(70));

  const incompleteRecipe: RawScrapedRecipe = {
    title: 'Mystery Recipe',
    ingredients: ['ingredient 1', 'ingredient 2'],  // Vague ingredients
    instructions: ['step 1'],                        // Minimal instructions
    source_url: 'https://example.com/mystery'
  };

  console.log('\n📝 Testing with incomplete recipe data...');

  const result = await EnhancedRecipeEnrichment.enhanceRecipe(incompleteRecipe, {
    useLLM: true,
    useFreeNutritionAPIs: true,
    useExistingEnrichment: true
  });

  console.log('\n✨ Results:');
  console.log('Success:', result.success);
  console.log('Completeness:', result.stats.completenessScore + '%');
  console.log('Errors:', result.errors.length);
  console.log('Warnings:', result.warnings.length);

  if (result.errors.length > 0) {
    console.log('\n❌ Errors:');
    result.errors.forEach(err => console.log('  -', err));
  }

  if (result.warnings.length > 0) {
    console.log('\n⚠️  Warnings:');
    result.warnings.forEach(warn => console.log('  -', warn));
  }

  return result;
}

// Example 5: Custom LLM fields
async function example5_CustomFields() {
  console.log('\n' + '='.repeat(70));
  console.log('EXAMPLE 5: Custom LLM Enhancement Fields');
  console.log('='.repeat(70));

  const rawRecipe: RawScrapedRecipe = {
    title: 'Homemade Pizza',
    ingredients: [
      'pizza dough',
      'tomato sauce',
      'mozzarella cheese',
      'fresh basil',
      'olive oil'
    ],
    instructions: [
      'Roll out dough',
      'Spread sauce',
      'Add cheese and toppings',
      'Bake at 450°F for 12-15 minutes'
    ],
    source_url: 'https://example.com/pizza',
    servings: 4
  };

  const result = await EnhancedRecipeEnrichment.enhanceRecipe(rawRecipe, {
    useLLM: true,
    llmFields: ['description', 'tags', 'cuisines', 'meal_types', 'cooking_tips']
  });

  console.log('\n✨ Enhanced with Custom Fields:');
  console.log('Description:', result.recipe.description);
  console.log('Tags:', result.recipe.tags?.join(', '));
  console.log('Cuisines:', result.recipe.cuisines?.join(', '));
  console.log('Cooking Tips:', (result.recipe as any).cooking_tips?.join('\n  • '));

  return result;
}

// Main execution
async function main() {
  console.log('\n🍳 Enhanced Recipe Scraping Examples');
  console.log('Using FREE LLM and API services');
  console.log('='.repeat(70));

  try {
    // Run all examples
    await example1_BasicEnhancement();
    await new Promise(resolve => setTimeout(resolve, 1000));

    await example2_MinimalEnhancement();
    await new Promise(resolve => setTimeout(resolve, 1000));

    await example3_BatchEnhancement();
    await new Promise(resolve => setTimeout(resolve, 1000));

    await example4_ErrorHandling();
    await new Promise(resolve => setTimeout(resolve, 1000));

    await example5_CustomFields();

    console.log('\n' + '='.repeat(70));
    console.log('✅ All examples completed!');
    console.log('='.repeat(70) + '\n');

    console.log('💡 Tips:');
    console.log('  • Set GROQ_API_KEY in .env for fastest LLM enhancement');
    console.log('  • Set USDA_API_KEY in .env for best nutrition data');
    console.log('  • OpenFoodFacts works without any API keys!');
    console.log('  • See FREE_APIS_SETUP.md for complete setup guide');

  } catch (error) {
    console.error('\n❌ Error running examples:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export {
  example1_BasicEnhancement,
  example2_MinimalEnhancement,
  example3_BatchEnhancement,
  example4_ErrorHandling,
  example5_CustomFields
};
