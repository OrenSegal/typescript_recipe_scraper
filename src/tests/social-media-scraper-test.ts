const { SocialMediaScraper } = require('../scrapers/SocialMediaScraper');
const { UnifiedScraper } = require('../scrapers/UnifiedScraper');
const { RecipeProcessor } = require('../core/RecipeProcessor');
const { StreamlinedWorkflow } = require('../core/StreamlinedWorkflow');
const { DatabaseService } = require('../services/DatabaseService');
const fs = require('fs');
const path = require('path');

/*
 * Test script for verifying social media recipe scraping and completeness score
 */
async function testSocialMediaRecipes() {
  console.log('🧪 Starting Social Media Recipe Test');
  console.log('====================================');

  try {
    // Initialize services
    const recipeProcessor = RecipeProcessor.getInstance();
    const databaseService = DatabaseService.getInstance();
    const socialMediaScraper = new SocialMediaScraper();
    const unifiedScraper = new UnifiedScraper();
    
    // Test URLs
    const testUrls = {
      instagram: 'https://www.instagram.com/p/CvTO-KrLOnW/',
      tiktok: 'https://www.tiktok.com/@recipes/video/7312508978880154888',
      youtube: 'https://www.youtube.com/watch?v=OTAwvdRJn6M'
    };
    
    // Process each platform
    for (const [platform, url] of Object.entries(testUrls)) {
      console.log(`\n📱 Testing ${platform.toUpperCase()} recipe scraping`);
      console.log('-'.repeat(40));
      console.log(`URL: ${url}`);
      
      try {
        // Create workflow for this recipe
        const workflow = new StreamlinedWorkflow({
          enableAIEnrichment: true,
          enableNutrition: true,
          enableEmbedding: true,
          saveToDatabase: false, // Don't save to DB during testing
          verbose: true
        });
        
        let recipeData;
        let processingResult;
        
        console.log(`⏳ Scraping ${platform} content...`);
        
        // Scrape based on platform
        switch (platform) {
          case 'instagram':
            recipeData = await socialMediaScraper.scrapeInstagramReel(url);
            break;
          case 'tiktok':
            recipeData = await socialMediaScraper.scrapeTikTokPost(url);
            break;
          case 'youtube':
            recipeData = await socialMediaScraper.scrapeYouTubeVideo(url);
            break;
        }
        
        if (!recipeData) {
          console.error(`❌ Failed to scrape ${platform} content`);
          continue;
        }
        
        console.log(`✅ Successfully scraped ${platform} content`);
        console.log(`📋 Recipe Title: ${recipeData.title || 'Unknown'}`);
        console.log(`🧂 Ingredients: ${recipeData.ingredients.length}`);
        console.log(`📝 Instructions: ${recipeData.instructions.length}`);
        
        // Process through workflow
        console.log(`⏳ Processing recipe through workflow...`);
        const result = await workflow.processRecipe(recipeData, url);
        
        // Log completeness score
        console.log(`📊 Completeness Score: ${result.recipe.completeness_score}%`);
        console.log(`🧠 Parsing Confidence: ${result.recipe.parsing_confidence}%`);
        
        // Check if we achieved 100% completeness
        if (result.recipe.completeness_score === 100) {
          console.log(`🎉 PERFECT! Achieved 100% completeness for ${platform} recipe`);
        } else {
          console.log(`📈 Partial completion: ${result.recipe.completeness_score}% for ${platform} recipe`);
          
          // Log missing components to help diagnose what's needed for 100%
          const missingComponents = [];
          
          if (!result.recipe.title) missingComponents.push('title');
          if (!result.recipe.description) missingComponents.push('description');
          if (!result.recipe.ingredients || result.recipe.ingredients.length === 0) missingComponents.push('ingredients');
          if (!result.recipe.instructions || result.recipe.instructions.length === 0) missingComponents.push('instructions');
          if (!result.recipe.prep_time_minutes) missingComponents.push('prep_time_minutes');
          if (!result.recipe.cook_time_minutes) missingComponents.push('cook_time_minutes');
          if (!result.recipe.servings) missingComponents.push('servings');
          if (!result.recipe.cuisine_type || result.recipe.cuisine_type.length === 0) missingComponents.push('cuisine_type');
          if (!result.recipe.tags || result.recipe.tags.length === 0) missingComponents.push('tags');
          if (!result.recipe.effort_level) missingComponents.push('effort_level');
          if (!result.recipe.dietary_restrictions || result.recipe.dietary_restrictions.length === 0) missingComponents.push('dietary_restrictions');
          
          console.log(`Missing components: ${missingComponents.join(', ')}`);
        }
        
        // Save result to JSON file for inspection
        const resultsDir = path.join(process.cwd(), 'test-results');
        if (!fs.existsSync(resultsDir)) {
          fs.mkdirSync(resultsDir);
        }
        
        const outputPath = path.join(resultsDir, `${platform}-recipe-result.json`);
        fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
        console.log(`💾 Result saved to ${outputPath}`);
        
      } catch (error) {
        console.error(`❌ Error processing ${platform} recipe:`, error);
      }
    }
    
    console.log('\n✅ Social media recipe testing completed');
    
  } catch (error) {
    console.error('❌ Test failed with error:', error);
  }
}

// Run the test
testSocialMediaRecipes().catch(console.error);

module.exports = { testSocialMediaRecipes };
