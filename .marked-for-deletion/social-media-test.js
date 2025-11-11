// @ts-check
/*
 * Social Media Recipe Scraping Test
 * Directly tests the enhanced completeness score with social media recipes
 */
import { RecipeProcessor } from '../core/RecipeProcessor.js';
import { StreamlinedWorkflow } from '../core/StreamlinedWorkflow.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ComprehensiveEnrichment } from '../enrichment/comprehensiveEnrichment.js';

// Get directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
 * Test function to evaluate recipe completeness scoring
 */
async function testSocialMediaRecipes() {
  console.log('🧪 Starting Enhanced Completeness Score Test');
  console.log('==========================================');

  // Initialize processor and workflow
  const recipeProcessor = RecipeProcessor.getInstance();
  const workflow = new StreamlinedWorkflow({
    enableEnrichment: true,
    enableEmbedding: true,
    enableValidation: true,
    enableNutrition: true
  });

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
      // Convert null description to undefined to fix type incompatibility
      const normalizedRecipe = {
        ...rawRecipe,
        description: rawRecipe.description || undefined  // Convert null to undefined if necessary
      };

      // Use the workflow to process, which includes enrichment and completeness scoring
      const processingOptions = {
        include_ai: true,
        include_nutrition: true,
        generate_embedding: true
      };
      
      const result = await workflow.processRecipe(normalizedRecipe, rawRecipe.source_url, processingOptions);
      
      console.log(`📋 Recipe Title: ${result?.title || 'Unknown'}`);
      console.log(`🧂 Ingredients: ${result?.ingredients?.length || 0}`);
      console.log(`📝 Instructions: ${result?.instructions?.length || 0}`);
      console.log(`📊 Completeness Score: ${result?.completeness_score || 0}%`);
      
      // Check if we achieved 100% completeness
      if (result && result.completeness_score === 100) {
        console.log(`🎉 PERFECT! Achieved 100% completeness for ${platform} recipe`);
      } else if (result) {
        console.log(`📈 Partial completion: ${result.completeness_score || 0}% for ${platform} recipe`);
        
        // Log missing components to help diagnose what's needed for 100%
        const missingComponents = [];
        
        if (!result.title) missingComponents.push('title');
        if (!result.description) missingComponents.push('description');
        if (!result.ingredients || result.ingredients.length === 0) missingComponents.push('ingredients');
        if (!result.instructions || result.instructions.length === 0) missingComponents.push('instructions');
        if (!result.prep_time_minutes) missingComponents.push('prep_time_minutes');
        if (!result.cook_time_minutes) missingComponents.push('cook_time_minutes');
        if (!result.servings) missingComponents.push('servings');
        if (!result.cuisine_type || result.cuisine_type.length === 0) missingComponents.push('cuisine_type');
        if (!result.tags || result.tags.length === 0) missingComponents.push('tags');
        if (!result.effort_level) missingComponents.push('effort_level');
        if (!result.dietary_restrictions || result.dietary_restrictions.length === 0) missingComponents.push('dietary_restrictions');
        
        console.log(`Missing components: ${missingComponents.join(', ')}`);
      }
      
      // Save result to file for analysis
      fs.writeFileSync(
        path.join(resultsDir, `${platform}-recipe-enrichment.json`),
        JSON.stringify(result, null, 2)
      );
      console.log(`💾 Result saved to ${path.join(resultsDir, `${platform}-recipe-enrichment.json`)}`);
      
    } catch (error) {
      console.error(`❌ Error processing ${platform} recipe:`, error);
    }
  }
  
  console.log('\n✅ Completeness score testing completed');
}

// Run the test
testSocialMediaRecipes().catch(console.error);
