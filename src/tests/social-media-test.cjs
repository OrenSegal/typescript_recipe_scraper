/*
 * Social Media Recipe Scraping Test (CommonJS version)
 * Directly tests the enhanced completeness score with social media recipes
 */
const path = require('path');
const fs = require('fs');

// Mock recipe data representing what would be scraped from social media
const mockInstagramRecipe = {
  title: "Creamy Garlic Parmesan Pasta",
  description: "Quick and delicious creamy pasta with garlic and parmesan cheese. Perfect for weeknight dinners!",
  ingredients: [
    "8 oz fettuccine pasta",
    "2 tablespoons butter",
    "4 cloves garlic, minced",
    "1 cup heavy cream",
    "1 cup grated parmesan cheese",
    "Salt and pepper to taste",
    "Fresh parsley for garnish"
  ],
  instructions: [
    "Boil pasta according to package directions until al dente.",
    "While pasta cooks, melt butter in a large skillet over medium heat.",
    "Add minced garlic and cook until fragrant, about 30 seconds.",
    "Pour in heavy cream and bring to a simmer.",
    "Reduce heat and stir in parmesan cheese until melted and sauce is smooth.",
    "Season with salt and pepper to taste.",
    "Drain pasta and add to the sauce, tossing to coat.",
    "Serve garnished with fresh parsley and additional parmesan if desired."
  ],
  image_url: "https://example.com/pasta-image.jpg",
  source_url: "https://www.instagram.com/reel/sample-id/"
};

const mockTikTokRecipe = {
  title: "Easy 3-Ingredient Cookies",
  description: "Super simple cookies made with just 3 ingredients! No mixer needed.",
  ingredients: [
    "1 cup peanut butter",
    "1 cup sugar",
    "1 egg"
  ],
  instructions: [
    "Preheat oven to 350°F (175°C).",
    "Mix all ingredients in a bowl until well combined.",
    "Form into 1-inch balls and place on baking sheet.",
    "Press down with a fork to create criss-cross pattern.",
    "Bake for 10-12 minutes until edges are slightly brown.",
    "Let cool on baking sheet for 5 minutes before transferring to cooling rack."
  ],
  image_url: "https://example.com/cookies-image.jpg",
  source_url: "https://www.tiktok.com/@user/video/sample-id"
};

const mockYouTubeRecipe = {
  title: "The Best Chocolate Cake",
  description: "Rich, moist chocolate cake that's perfect for any occasion.",
  ingredients: [
    "2 cups all-purpose flour",
    "2 cups sugar",
    "3/4 cup unsweetened cocoa powder",
    "2 teaspoons baking soda",
    "1 teaspoon salt",
    "2 eggs",
    "1 cup buttermilk",
    "1/2 cup vegetable oil",
    "2 teaspoons vanilla extract",
    "1 cup hot coffee"
  ],
  instructions: [
    "Preheat oven to 350°F (175°C). Grease and flour two 9-inch round cake pans.",
    "In a large bowl, combine flour, sugar, cocoa, baking soda, and salt.",
    "Add eggs, buttermilk, oil, and vanilla; beat on medium speed for 2 minutes.",
    "Stir in hot coffee (batter will be thin). Pour into prepared pans.",
    "Bake for 30-35 minutes until a toothpick inserted comes out clean.",
    "Cool in pans for 10 minutes, then remove to wire racks to cool completely."
  ],
  image_url: "https://example.com/chocolate-cake-image.jpg",
  source_url: "https://www.youtube.com/watch?v=sample-id"
};

/*
 * Direct test function (no imports) to process recipes
 * This version simulates the core workflow without relying on module imports
 */
async function testSocialMediaRecipes() {
  console.log('🧪 Starting Social Media Recipe Test (CommonJS Version)');
  console.log('===================================================');

  const mockRecipes = {
    instagram: mockInstagramRecipe,
    tiktok: mockTikTokRecipe,
    youtube: mockYouTubeRecipe
  };

  // Create results directory
  const resultsDir = path.join(process.cwd(), 'test-results');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir);
  }

  // Process each recipe
  for (const [platform, rawRecipe] of Object.entries(mockRecipes)) {
    console.log(`\n📱 Testing ${platform.toUpperCase()} recipe completeness`);
    console.log('-'.repeat(45));

    try {
      // MANUAL TEST: Log recipe structure to analyze what fields are missing
      const requiredFields = [
        "title", "description", "ingredients", "instructions", "prep_time_minutes",
        "cook_time_minutes", "servings", "cuisine_type", "tags", 
        "effort_level", "dietary_restrictions"
      ];
      
      // Check what's already present in the raw recipe
      const presentFields = [];
      const missingFields = [];
      
      for (const field of requiredFields) {
        if (rawRecipe[field]) {
          if (Array.isArray(rawRecipe[field])) {
            if (rawRecipe[field].length > 0) {
              presentFields.push(`${field} (${rawRecipe[field].length} items)`);
            } else {
              missingFields.push(`${field} (empty array)`);
            }
          } else {
            presentFields.push(field);
          }
        } else {
          missingFields.push(field);
        }
      }
      
      console.log('✅ Present fields:');
      console.log(presentFields.join(', '));
      console.log('\n❌ Missing fields that would impact completeness:');
      console.log(missingFields.join(', '));
      
      // Calculate a mock completeness score based on present fields
      const totalFields = requiredFields.length;
      const presentCount = presentFields.length;
      const completenessScore = Math.round((presentCount / totalFields) * 100);
      
      console.log(`\n📊 Estimated Raw Completeness: ${completenessScore}%`);
      
      console.log('\n💡 To achieve 100% completeness, add these fields:');
      missingFields.forEach(field => {
        console.log(`  - ${field}`);
      });
      
      // Write the raw recipe to a file for examination
      fs.writeFileSync(
        path.join(resultsDir, `${platform}-recipe-raw.json`),
        JSON.stringify(rawRecipe, null, 2)
      );
      
      // Write an enhanced version with mock completeness data
      const enhancedRecipe = { 
        ...rawRecipe,
        prep_time_minutes: rawRecipe.prep_time_minutes || 15,
        cook_time_minutes: rawRecipe.cook_time_minutes || 25,
        servings: rawRecipe.servings || 4,
        cuisine_type: rawRecipe.cuisine_type || ["American"],
        tags: rawRecipe.tags || ["easy", "quick", "family-friendly"],
        effort_level: rawRecipe.effort_level || "easy",
        dietary_restrictions: rawRecipe.dietary_restrictions || []
      };
      
      fs.writeFileSync(
        path.join(resultsDir, `${platform}-recipe-enhanced.json`),
        JSON.stringify(enhancedRecipe, null, 2)
      );
      console.log(`💾 Raw and enhanced recipes saved to ${resultsDir}`);
      
    } catch (error) {
      console.error(`❌ Error processing ${platform} recipe:`, error);
    }
  }
  
  console.log('\n🏁 Test completed. Examine the test-results directory for output.');
}

// Run the test
testSocialMediaRecipes().catch(console.error);
