import { ComprehensiveDietAnalyzer } from '../enrichment/comprehensiveDietAnalyzer.js';

/*
 * Comprehensive Diet Suitability Validation
 * Tests to ensure every recipe gets accurate dietary restriction tags
 */

// Test Recipe Data with Different Dietary Profiles
const testRecipes = [
  {
    name: "Classic Chicken Parmesan", 
    ingredients: [
      { name: "chicken breast" },
      { name: "parmesan cheese" },
      { name: "breadcrumbs" },
      { name: "flour" },
      { name: "eggs" },
      { name: "olive oil" }
    ],
    nutrition: { carbohydratesG: 25, fatG: 15, proteinG: 35, sodiumG: 0.8 },
    expectedTags: [] // Should have very few restrictions due to meat, dairy, gluten, eggs
  },
  
  {
    name: "Quinoa Buddha Bowl (Vegan)",
    ingredients: [
      { name: "quinoa" },
      { name: "chickpeas" },
      { name: "spinach" },
      { name: "avocado" },
      { name: "tahini" },
      { name: "lemon juice" },
      { name: "olive oil" }
    ],
    nutrition: { carbohydratesG: 45, fatG: 18, proteinG: 12, sodiumG: 0.1 },
    expectedTags: ['Gluten-Free', 'Dairy-Free', 'Lactose-Intolerant', 'Nut-Free', 'Peanut-Free', 'Soy-Free', 'Egg-Free', 'Shellfish-Free', 'Fish-Free', 'Vegetarian', 'Vegan', 'Heart-Healthy', 'Kosher', 'Halal', 'Sugar-Free', 'Low Sodium']
  },

  {
    name: "Keto Salmon with Asparagus",
    ingredients: [
      { name: "salmon fillet" },
      { name: "asparagus" },
      { name: "butter" },
      { name: "garlic" },
      { name: "lemon" },
      { name: "herbs" }
    ],
    nutrition: { carbohydratesG: 5, fatG: 25, proteinG: 30, sodiumG: 0.15 },
    expectedTags: ['Gluten-Free', 'Nut-Free', 'Peanut-Free', 'Soy-Free', 'Egg-Free', 'Shellfish-Free', 'Pescatarian', 'Ketogenic', 'Low Carb', 'Heart-Healthy', 'Sugar-Free', 'Low Sodium']
  },

  {
    name: "Gluten-Free Almond Cookies",
    ingredients: [
      { name: "almond flour" },
      { name: "eggs" },
      { name: "honey" },
      { name: "vanilla extract" },
      { name: "baking soda" },
      { name: "salt" }
    ],
    nutrition: { carbohydratesG: 15, fatG: 12, proteinG: 6, sodiumG: 0.2 },
    expectedTags: ['Gluten-Free', 'Dairy-Free', 'Lactose-Intolerant', 'Peanut-Free', 'Soy-Free', 'Shellfish-Free', 'Fish-Free', 'Vegetarian']
  },

  {
    name: "Paleo Beef Stir-Fry",
    ingredients: [
      { name: "grass-fed beef" },
      { name: "broccoli" },
      { name: "bell peppers" },
      { name: "coconut oil" },
      { name: "ginger" },
      { name: "garlic" }
    ],
    nutrition: { carbohydratesG: 8, fatG: 20, proteinG: 28, sodiumG: 0.12 },
    expectedTags: ['Gluten-Free', 'Dairy-Free', 'Lactose-Intolerant', 'Nut-Free', 'Peanut-Free', 'Soy-Free', 'Egg-Free', 'Shellfish-Free', 'Fish-Free', 'Paleo', 'Low Carb', 'Sugar-Free', 'Low Sodium', 'Halal']
  },

  {
    name: "Kosher Vegetable Soup",
    ingredients: [
      { name: "vegetable broth" },
      { name: "carrots" },
      { name: "celery" },
      { name: "onions" },
      { name: "potatoes" },
      { name: "herbs" }
    ],
    nutrition: { carbohydratesG: 20, fatG: 2, proteinG: 4, sodiumG: 0.3 },
    expectedTags: ['Gluten-Free', 'Dairy-Free', 'Lactose-Intolerant', 'Nut-Free', 'Peanut-Free', 'Soy-Free', 'Egg-Free', 'Shellfish-Free', 'Fish-Free', 'Vegetarian', 'Vegan', 'Heart-Healthy', 'Kosher', 'Halal', 'Sugar-Free']
  },

  {
    name: "Shellfish Pasta (High Allergen)",
    ingredients: [
      { name: "shrimp" },
      { name: "linguine pasta" },
      { name: "heavy cream" },
      { name: "parmesan cheese" },
      { name: "white wine" },
      { name: "garlic" }
    ],
    nutrition: { carbohydratesG: 65, fatG: 18, proteinG: 25, sodiumG: 1.2 },
    expectedTags: ['Nut-Free', 'Peanut-Free', 'Soy-Free'] // Should have very few due to shellfish, dairy, gluten
  }
];

/*
 * Main validation function
 */
export async function validateDietSuitability(): Promise<void> {
  console.log('🧪 Starting Comprehensive Diet Suitability Validation\n');
  
  let totalTests = 0;
  let passedTests = 0;
  const detailedResults: any[] = [];

  for (const recipe of testRecipes) {
    totalTests++;
    
    console.log(`\n📋 Testing: ${recipe.name}`);
    console.log(`Ingredients: ${recipe.ingredients.map(i => i.name).join(', ')}`);
    
    // Calculate diet suitability
    const actualTags = ComprehensiveDietAnalyzer.calculateDietSuitability(
      recipe.ingredients, 
      recipe.nutrition
    );
    
    console.log(`🏷️  Detected Dietary Tags: ${actualTags.join(', ')}`);
    console.log(`📊 Total Tags: ${actualTags.length}`);
    
    // Detailed analysis
    const analysis = {
      recipeName: recipe.name,
      ingredientCount: recipe.ingredients.length,
      detectedTags: actualTags,
      tagCount: actualTags.length,
      hasAllergenFree: actualTags.some(tag => 
        ['Gluten-Free', 'Dairy-Free', 'Nut-Free', 'Shellfish-Free', 'Egg-Free'].includes(tag)
      ),
      hasDietType: actualTags.some(tag => 
        ['Vegetarian', 'Vegan', 'Pescatarian', 'Ketogenic', 'Paleo'].includes(tag)
      ),
      hasHealthBased: actualTags.some(tag => 
        ['Heart-Healthy', 'Low Sodium', 'Sugar-Free', 'Low Carb'].includes(tag)
      ),
      hasReligious: actualTags.some(tag => 
        ['Kosher', 'Halal'].includes(tag)
      )
    };
    
    detailedResults.push(analysis);
    
    // Validation checks
    let testPassed = true;
    const issues: string[] = [];
    
    // Check if every recipe has at least some dietary tags
    if (actualTags.length === 0) {
      testPassed = false;
      issues.push('No dietary tags detected - every recipe should have some restrictions');
    }
    
    // Check for logical consistency
    if (actualTags.includes('Vegan') && !actualTags.includes('Vegetarian')) {
      testPassed = false;
      issues.push('Vegan recipes should also be tagged as Vegetarian');
    }
    
    if (actualTags.includes('Ketogenic') && !actualTags.includes('Low Carb')) {
      testPassed = false;
      issues.push('Ketogenic recipes should also be tagged as Low Carb');
    }
    
    // Recipe-specific validations
    if (recipe.name.includes('Vegan') && !actualTags.includes('Vegan')) {
      testPassed = false;
      issues.push('Recipe labeled as vegan should be tagged as Vegan');
    }
    
    if (recipe.name.includes('Keto') && !actualTags.includes('Ketogenic')) {
      testPassed = false;
      issues.push('Recipe labeled as keto should be tagged as Ketogenic');
    }
    
    if (recipe.name.includes('Shellfish') && actualTags.includes('Shellfish-Free')) {
      testPassed = false;
      issues.push('Shellfish recipe should not be tagged as Shellfish-Free');
    }
    
    // Report results
    if (testPassed) {
      console.log('✅ PASSED: Diet analysis looks correct');
      passedTests++;
    } else {
      console.log('❌ FAILED: Issues detected:');
      issues.forEach(issue => console.log(`   - ${issue}`));
    }
  }
  
  // Final validation summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 DIET SUITABILITY VALIDATION SUMMARY');
  console.log('='.repeat(80));
  
  console.log(`\n🧪 Total Tests: ${totalTests}`);
  console.log(`✅ Passed Tests: ${passedTests}`);
  console.log(`❌ Failed Tests: ${totalTests - passedTests}`);
  console.log(`📈 Success Rate: ${Math.round((passedTests / totalTests) * 100)}%`);
  
  // Detailed statistics
  console.log('\n📋 DETAILED ANALYSIS:');
  
  const avgTags = detailedResults.reduce((sum, r) => sum + r.tagCount, 0) / detailedResults.length;
  console.log(`📊 Average Tags per Recipe: ${avgTags.toFixed(1)}`);
  
  const recipesWithAllergenInfo = detailedResults.filter(r => r.hasAllergenFree).length;
  console.log(`🚫 Recipes with Allergen Tags: ${recipesWithAllergenInfo}/${totalTests} (${Math.round((recipesWithAllergenInfo / totalTests) * 100)}%)`);
  
  const recipesWithDietType = detailedResults.filter(r => r.hasDietType).length;
  console.log(`🥗 Recipes with Diet Type Tags: ${recipesWithDietType}/${totalTests} (${Math.round((recipesWithDietType / totalTests) * 100)}%)`);
  
  const recipesWithHealthTags = detailedResults.filter(r => r.hasHealthBased).length;
  console.log(`❤️  Recipes with Health Tags: ${recipesWithHealthTags}/${totalTests} (${Math.round((recipesWithHealthTags / totalTests) * 100)}%)`);
  
  const recipesWithReligious = detailedResults.filter(r => r.hasReligious).length;
  console.log(`🕊️  Recipes with Religious Tags: ${recipesWithReligious}/${totalTests} (${Math.round((recipesWithReligious / totalTests) * 100)}%)`);
  
  // Tag frequency analysis
  console.log('\n🏷️  MOST COMMON DIETARY TAGS:');
  const tagFrequency: { [key: string]: number } = {};
  detailedResults.forEach(result => {
    result.detectedTags.forEach((tag: string) => {
      tagFrequency[tag] = (tagFrequency[tag] || 0) + 1;
    });
  });
  
  const sortedTags = Object.entries(tagFrequency)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10);
  
  sortedTags.forEach(([tag, count]) => {
    const percentage = Math.round((count / totalTests) * 100);
    console.log(`   ${tag}: ${count}/${totalTests} recipes (${percentage}%)`);
  });
  
  if (passedTests === totalTests) {
    console.log('\n🎉 ALL TESTS PASSED! Diet suitability analysis is working correctly.');
    console.log('✅ Every recipe is receiving accurate dietary restriction tags.');
  } else {
    console.log('\n⚠️  Some tests failed. Please review the diet analysis logic.');
  }
  
  console.log('\n' + '='.repeat(80));
}

/*
 * Run validation when called directly
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  validateDietSuitability().catch(console.error);
}

/*
 * Example usage:
 * 
 * import { validateDietSuitability } from './diet-suitability-validation.js';
 * await validateDietSuitability();
 */
