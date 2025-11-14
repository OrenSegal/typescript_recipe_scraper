/**
 * Comprehensive Recipe Scraper Test Suite
 * Tests 20+ recipe URLs from various websites
 * Validates scraping quality, performance, and reliability
 */

import { UniversalRecipeScraper } from './src/scrapers/UniversalRecipeScraper.js';

interface TestCase {
  name: string;
  url: string;
  type: 'website' | 'youtube' | 'text';
  minIngredients?: number;
  minInstructions?: number;
}

// Comprehensive test cases from various sources
const TEST_CASES: TestCase[] = [
  // Popular Recipe Websites
  {
    name: 'Food Network - Mac and Cheese',
    url: 'https://www.foodnetwork.com/recipes/alton-brown/baked-macaroni-and-cheese-recipe-1939524',
    type: 'website',
    minIngredients: 8,
    minInstructions: 3
  },
  {
    name: 'BBC Good Food - Spaghetti Carbonara',
    url: 'https://www.bbcgoodfood.com/recipes/ultimate-spaghetti-carbonara-recipe',
    type: 'website',
    minIngredients: 5,
    minInstructions: 3
  },
  {
    name: 'Simply Recipes - Chocolate Chip Cookies',
    url: 'https://www.simplyrecipes.com/recipes/chocolate_chip_cookies/',
    type: 'website',
    minIngredients: 8,
    minInstructions: 5
  },
  {
    name: 'Serious Eats - Best Burger',
    url: 'https://www.seriouseats.com/best-burger-recipe',
    type: 'website',
    minIngredients: 3,
    minInstructions: 4
  },
  {
    name: 'AllRecipes - Banana Bread',
    url: 'https://www.allrecipes.com/recipe/20144/banana-banana-bread/',
    type: 'website',
    minIngredients: 6,
    minInstructions: 3
  },
  {
    name: 'NYT Cooking - No-Knead Bread',
    url: 'https://cooking.nytimes.com/recipes/11376-no-knead-bread',
    type: 'website',
    minIngredients: 4,
    minInstructions: 4
  },
  {
    name: 'Epicurious - Chicken Tikka Masala',
    url: 'https://www.epicurious.com/recipes/food/views/chicken-tikka-masala-51171400',
    type: 'website',
    minIngredients: 10,
    minInstructions: 5
  },
  {
    name: 'Food52 - Roast Chicken',
    url: 'https://food52.com/recipes/52720-julia-turshen-s-one-pan-roast-chicken',
    type: 'website',
    minIngredients: 5,
    minInstructions: 3
  },
  {
    name: 'King Arthur Baking - Pizza Dough',
    url: 'https://www.kingarthurbaking.com/recipes/the-easiest-pizza-youll-ever-make-recipe',
    type: 'website',
    minIngredients: 5,
    minInstructions: 4
  },
  {
    name: 'The Kitchn - Scrambled Eggs',
    url: 'https://www.thekitchn.com/how-to-make-scrambled-eggs-cooking-lessons-from-the-kitchn-107999',
    type: 'website',
    minIngredients: 3,
    minInstructions: 3
  },
  {
    name: 'Budget Bytes - Beans and Rice',
    url: 'https://www.budgetbytes.com/basic-beans-and-rice/',
    type: 'website',
    minIngredients: 5,
    minInstructions: 3
  },
  {
    name: 'Tasty - Brownie Recipe',
    url: 'https://tasty.co/recipe/the-best-fudgy-brownies',
    type: 'website',
    minIngredients: 7,
    minInstructions: 4
  },
  {
    name: 'Delish - Pancakes',
    url: 'https://www.delish.com/cooking/recipe-ideas/a19660089/easy-pancake-recipe/',
    type: 'website',
    minIngredients: 6,
    minInstructions: 3
  },
  {
    name: 'Martha Stewart - Apple Pie',
    url: 'https://www.marthastewart.com/338186/marthas-apple-pie',
    type: 'website',
    minIngredients: 6,
    minInstructions: 4
  },
  {
    name: 'Minimalist Baker - Vegan Chili',
    url: 'https://minimalistbaker.com/1-pot-red-lentil-chili/',
    type: 'website',
    minIngredients: 8,
    minInstructions: 4
  },

  // YouTube Cooking Videos
  {
    name: 'YouTube - Binging with Babish',
    url: 'https://www.youtube.com/watch?v=Upqp21Dm5vg',
    type: 'youtube',
    minIngredients: 0, // May not have structured recipe
    minInstructions: 0
  },
  {
    name: 'YouTube - Gordon Ramsay',
    url: 'https://www.youtube.com/watch?v=PUP7U5vTMM0',
    type: 'youtube',
    minIngredients: 0,
    minInstructions: 0
  },

  // Plain Text Recipes
  {
    name: 'Plain Text - Classic Chocolate Cake',
    url: `Classic Chocolate Cake

A rich and moist chocolate cake perfect for any celebration.

Ingredients:
- 2 cups all-purpose flour
- 2 cups sugar
- 3/4 cup cocoa powder
- 2 teaspoons baking soda
- 1 teaspoon baking powder
- 1 teaspoon salt
- 2 eggs
- 1 cup strong black coffee
- 1 cup buttermilk
- 1/2 cup vegetable oil
- 2 teaspoons vanilla extract

Instructions:
1. Preheat oven to 350°F (175°C)
2. Grease and flour two 9-inch cake pans
3. Mix all dry ingredients in a large bowl
4. Add eggs, coffee, buttermilk, oil and vanilla
5. Beat on medium speed for 2 minutes
6. Pour batter into prepared pans
7. Bake for 30-35 minutes until toothpick comes out clean
8. Cool in pans for 10 minutes, then turn out onto wire racks

Serves: 12 slices
Prep time: 15 minutes
Cook time: 35 minutes
Total time: 50 minutes`,
    type: 'text',
    minIngredients: 10,
    minInstructions: 7
  },
  {
    name: 'Plain Text - Quick Pasta',
    url: `Quick Garlic Pasta

Simple 15-minute pasta dish with garlic and olive oil.

Ingredients:
- 1 pound spaghetti
- 1/2 cup olive oil
- 6 cloves garlic, sliced
- 1/2 teaspoon red pepper flakes
- Salt and pepper to taste
- Fresh parsley, chopped
- Parmesan cheese, grated

Instructions:
1. Cook pasta according to package directions
2. While pasta cooks, heat olive oil in large skillet
3. Add garlic and cook until golden, about 2 minutes
4. Add red pepper flakes
5. Drain pasta and add to skillet
6. Toss with oil and garlic
7. Season with salt and pepper
8. Top with parsley and parmesan

Serves 4
Prep time: 5 minutes
Cook time: 10 minutes`,
    type: 'text',
    minIngredients: 6,
    minInstructions: 7
  },
  {
    name: 'Plain Text - Easy Salad',
    url: `Caesar Salad

Crispy romaine with classic Caesar dressing.

You'll need:
• 1 large head romaine lettuce
• 1/2 cup Caesar dressing
• 1/2 cup croutons
• 1/4 cup parmesan cheese
• Black pepper

Steps:
1. Wash and chop romaine
2. Toss with dressing
3. Add croutons
4. Sprinkle with parmesan
5. Season with pepper

Makes 4 servings
Ready in 10 minutes`,
    type: 'text',
    minIngredients: 5,
    minInstructions: 5
  },
  {
    name: 'Plain Text - Smoothie Bowl',
    url: `Berry Smoothie Bowl

Healthy breakfast bowl packed with antioxidants.

Ingredients:
2 cups frozen mixed berries
1 banana
1/2 cup almond milk
1 tablespoon honey
Toppings: granola, fresh berries, coconut flakes

Method:
First, add frozen berries, banana, and almond milk to blender.
Then, blend until smooth and thick.
Next, pour into bowl.
Finally, top with granola, fresh berries, and coconut.

Serves 2 | Takes about 5 minutes`,
    type: 'text',
    minIngredients: 4,
    minInstructions: 4
  }
];

interface TestResult {
  name: string;
  url: string;
  success: boolean;
  duration: number;
  confidence: number;
  ingredientCount: number;
  instructionCount: number;
  contentType: string;
  method: string;
  error?: string;
  meetsMinimums?: boolean;
}

/**
 * Run comprehensive test suite
 */
async function runComprehensiveTests() {
  console.log('🧪 COMPREHENSIVE RECIPE SCRAPER TEST SUITE');
  console.log('='.repeat(100));
  console.log(`Testing ${TEST_CASES.length} recipes from various sources\n`);

  const results: TestResult[] = [];
  let passCount = 0;
  let failCount = 0;

  for (let i = 0; i < TEST_CASES.length; i++) {
    const testCase = TEST_CASES[i];
    const testNum = i + 1;

    console.log(`\n[${testNum}/${TEST_CASES.length}] Testing: ${testCase.name}`);
    console.log('-'.repeat(100));
    console.log(`URL: ${testCase.url.substring(0, 80)}${testCase.url.length > 80 ? '...' : ''}`);
    console.log(`Type: ${testCase.type}`);

    const startTime = Date.now();

    try {
      const result = await UniversalRecipeScraper.scrape(testCase.url);
      const duration = Date.now() - startTime;

      const ingredientCount = result.recipe.ingredients?.length || 0;
      const instructionCount = result.recipe.instructions?.length || 0;

      const meetsMinIngredients = !testCase.minIngredients || ingredientCount >= testCase.minIngredients;
      const meetsMinInstructions = !testCase.minInstructions || instructionCount >= testCase.minInstructions;
      const meetsMinimums = meetsMinIngredients && meetsMinInstructions;

      const testResult: TestResult = {
        name: testCase.name,
        url: testCase.url.substring(0, 100),
        success: true,
        duration,
        confidence: result.confidence,
        ingredientCount,
        instructionCount,
        contentType: result.contentType,
        method: result.method,
        meetsMinimums
      };

      results.push(testResult);

      if (meetsMinimums) {
        passCount++;
        console.log(`✅ PASS (${duration}ms)`);
      } else {
        console.log(`⚠️  PARTIAL PASS (${duration}ms)`);
        if (!meetsMinIngredients) {
          console.log(`   Expected ≥${testCase.minIngredients} ingredients, got ${ingredientCount}`);
        }
        if (!meetsMinInstructions) {
          console.log(`   Expected ≥${testCase.minInstructions} instructions, got ${instructionCount}`);
        }
      }

      console.log(`   Confidence: ${result.confidence}%`);
      console.log(`   Method: ${result.method}`);
      console.log(`   Title: ${result.recipe.title}`);
      console.log(`   Ingredients: ${ingredientCount}`);
      console.log(`   Instructions: ${instructionCount}`);

    } catch (error: any) {
      const duration = Date.now() - startTime;
      failCount++;

      const testResult: TestResult = {
        name: testCase.name,
        url: testCase.url.substring(0, 100),
        success: false,
        duration,
        confidence: 0,
        ingredientCount: 0,
        instructionCount: 0,
        contentType: testCase.type,
        method: 'failed',
        error: error.message,
        meetsMinimums: false
      };

      results.push(testResult);
      console.log(`❌ FAIL (${duration}ms)`);
      console.log(`   Error: ${error.message}`);
    }
  }

  // Print detailed summary
  console.log('\n\n' + '='.repeat(100));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(100));

  console.log(`\n📈 Overall Results:`);
  console.log(`   Total Tests: ${TEST_CASES.length}`);
  console.log(`   ✅ Passed: ${passCount} (${((passCount / TEST_CASES.length) * 100).toFixed(1)}%)`);
  console.log(`   ❌ Failed: ${failCount} (${((failCount / TEST_CASES.length) * 100).toFixed(1)}%)`);

  // Calculate averages
  const successfulResults = results.filter(r => r.success);
  if (successfulResults.length > 0) {
    const avgDuration = successfulResults.reduce((sum, r) => sum + r.duration, 0) / successfulResults.length;
    const avgConfidence = successfulResults.reduce((sum, r) => sum + r.confidence, 0) / successfulResults.length;
    const avgIngredients = successfulResults.reduce((sum, r) => sum + r.ingredientCount, 0) / successfulResults.length;
    const avgInstructions = successfulResults.reduce((sum, r) => sum + r.instructionCount, 0) / successfulResults.length;

    console.log(`\n⚡ Performance Metrics (Successful Tests):`);
    console.log(`   Average Duration: ${avgDuration.toFixed(0)}ms`);
    console.log(`   Average Confidence: ${avgConfidence.toFixed(1)}%`);
    console.log(`   Average Ingredients: ${avgIngredients.toFixed(1)}`);
    console.log(`   Average Instructions: ${avgInstructions.toFixed(1)}`);
  }

  // Group by content type
  console.log(`\n🗂️  Results by Content Type:`);
  const byType = new Map<string, TestResult[]>();
  results.forEach(r => {
    if (!byType.has(r.contentType)) {
      byType.set(r.contentType, []);
    }
    byType.get(r.contentType)!.push(r);
  });

  byType.forEach((typeResults, contentType) => {
    const typePass = typeResults.filter(r => r.meetsMinimums).length;
    const typeTotal = typeResults.length;
    const typeSuccessRate = ((typePass / typeTotal) * 100).toFixed(1);
    console.log(`   ${contentType}: ${typePass}/${typeTotal} passed (${typeSuccessRate}%)`);
  });

  // Group by method
  console.log(`\n🔧 Results by Scraping Method:`);
  const byMethod = new Map<string, number>();
  results.forEach(r => {
    byMethod.set(r.method, (byMethod.get(r.method) || 0) + 1);
  });

  byMethod.forEach((count, method) => {
    console.log(`   ${method}: ${count} recipes`);
  });

  // Show failed tests
  if (failCount > 0) {
    console.log(`\n❌ Failed Tests:`);
    results.filter(r => !r.success).forEach(r => {
      console.log(`   • ${r.name}`);
      console.log(`     Error: ${r.error}`);
    });
  }

  // Show partially successful tests
  const partialPass = results.filter(r => r.success && !r.meetsMinimums);
  if (partialPass.length > 0) {
    console.log(`\n⚠️  Partially Successful Tests (need improvement):`);
    partialPass.forEach(r => {
      console.log(`   • ${r.name} (${r.ingredientCount} ingredients, ${r.instructionCount} instructions)`);
    });
  }

  console.log('\n' + '='.repeat(100));
  console.log(`\n🎯 Final Score: ${passCount}/${TEST_CASES.length} tests passed (${((passCount / TEST_CASES.length) * 100).toFixed(1)}%)\n`);

  // Return exit code
  return failCount === 0 ? 0 : 1;
}

// Run tests
runComprehensiveTests()
  .then(exitCode => {
    process.exit(exitCode);
  })
  .catch(error => {
    console.error('\n💥 Test suite crashed:', error);
    process.exit(1);
  });
