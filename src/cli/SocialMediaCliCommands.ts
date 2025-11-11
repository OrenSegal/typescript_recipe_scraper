import * as fs from 'fs';
import * as path from 'path';
import { SocialMediaScraper } from '../scrapers/SocialMediaScraper.js';
import { DatabaseService } from '../services/DatabaseService.js';
import { ComprehensiveEnrichment } from '../enrichment/comprehensiveEnrichment.js';

export class SocialMediaCliCommands {
  /**
   * Scrape a single social media post/video for recipes
   */
  static async scrapeSinglePost(url: string, options: any): Promise<void> {
    console.log(`📱 Scraping social media post: ${url}`);
    
    try {
      const platform = options.platform || this.detectPlatform(url);
      if (!platform) {
        console.error('❌ Could not detect platform. Please specify with --platform flag.');
        return;
      }

      console.log(`🎯 Detected platform: ${platform.toUpperCase()}`);

      const scraper = new SocialMediaScraper({
        enableOCR: options.ocr || false,
        enableTranscription: options.transcript || false
      });

      const recipeData = await scraper.scrapeRecipe(url);
      
      if (!recipeData) {
        console.error('❌ No recipe data found in this post');
        return;
      }

      console.log(`✅ Successfully scraped: ${recipeData.title || 'Social Media Recipe'}`);

      // AI Enrichment
      console.log('🧠 Enriching recipe with AI...');
      const enrichedData = await ComprehensiveEnrichment.enrichRecipe(recipeData);
      Object.assign(recipeData, enrichedData);

      // Save to database
      if (!options.noSave) {
        console.log('💾 Saving to database...');
        const db = DatabaseService.getInstance();
        await db.initialize();
        const savedRecipe = await db.saveRecipe(recipeData as any);
        console.log(`✅ Recipe saved with ID: ${savedRecipe.id}`);
      }

      // Display summary
      this.displaySocialMediaRecipeSummary(recipeData, platform);

    } catch (error) {
      console.error(`❌ Failed to scrape social media post: ${error}`);
      process.exit(1);
    }
  }

  /**
   * Scrape all recipes from a social media account/channel
   */
  static async scrapeFullAccount(username: string, options: any): Promise<void> {
    console.log(`👤 Scraping account: @${username} on ${options.platform.toUpperCase()}`);
    
    try {
      const scraper = new SocialMediaScraper({
        enableOCR: true,
        enableTranscription: true
      });

      const db = DatabaseService.getInstance();
      await db.initialize();
      const enrichment = new ComprehensiveEnrichment();

      // Get posts from account
      console.log('🔍 Fetching posts from account...');
      const posts = await this.getAccountPosts(username, options);
      
      console.log(`📄 Found ${posts.length} posts to process`);

      // Process posts in batches
      const batchSize = parseInt(options.batchSize) || 5;
      const results = {
        total: posts.length,
        successful: 0,
        failed: 0,
        recipesFound: 0,
        errors: [] as string[]
      };

      for (let i = 0; i < posts.length; i += batchSize) {
        const batch = posts.slice(i, i + batchSize);
        console.log(`\n🔄 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(posts.length/batchSize)} (${batch.length} posts)`);

        await Promise.allSettled(batch.map(async (post) => {
          try {
            const recipeData = await scraper.scrapeRecipe(post.url);
            results.successful++;
            
            if (recipeData) {
              results.recipesFound++;
              
              // Enrich recipe
              const enrichedData = await ComprehensiveEnrichment.enrichRecipe(recipeData);
              Object.assign(recipeData, enrichedData);
              
              // Save to database
              await db.saveRecipe(recipeData as any);
              console.log(`✅ Recipe: ${recipeData.title || post.url}`);
            } else {
              console.log(`📄 No recipe: ${post.url}`);
            }
          } catch (error) {
            results.failed++;
            results.errors.push(`Error processing ${post.url}: ${error}`);
            console.log(`❌ Failed: ${post.url}`);
          }
        }));

        // Progress update
        console.log(`📊 Progress: ${results.successful + results.failed}/${results.total} (${results.recipesFound} recipes found)`);
        
        // Rate limiting - wait between batches
        if (i + batchSize < posts.length) {
          console.log('⏳ Waiting 30s to respect rate limits...');
          await new Promise(resolve => setTimeout(resolve, 30000));
        }
      }

      // Save results if output directory specified
      if (options.output) {
        await this.saveAccountResults(results, options.output, username, options.platform);
      }

      // Final summary
      console.log('\n🎉 Account Scraping Complete!');
      console.log(`📱 Processed: ${results.successful} posts`);
      console.log(`🍳 Recipes found: ${results.recipesFound}`);
      console.log(`❌ Failed: ${results.failed} posts`);
      console.log(`📈 Recipe discovery rate: ${((results.recipesFound / results.total) * 100).toFixed(1)}%`);

    } catch (error) {
      console.error(`❌ Failed to scrape account: ${error}`);
      process.exit(1);
    }
  }

  /**
   * Get posts from social media account
   */
  private static async getAccountPosts(username: string, options: any): Promise<any[]> {
    // This would integrate with actual social media APIs or scrapers
    // For now, return a placeholder structure
    const posts = [];
    const limit = parseInt(options.limit) || 50;
    
    // Simulate getting posts from different platforms
    switch (options.platform) {
      case 'instagram':
        // Would integrate with Instagram Graph API or scraper
        for (let i = 0; i < Math.min(limit, 20); i++) {
          posts.push({
            url: `https://instagram.com/p/example${i}/`,
            type: 'reel',
            caption: `Sample post ${i} from @${username}`,
            date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString()
          });
        }
        break;
        
      case 'tiktok':
        // Would integrate with TikTok API or scraper
        for (let i = 0; i < Math.min(limit, 30); i++) {
          posts.push({
            url: `https://tiktok.com/@${username}/video/example${i}`,
            type: 'video',
            description: `Sample TikTok ${i} from @${username}`,
            date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString()
          });
        }
        break;
        
      case 'youtube':
        // Would integrate with YouTube Data API
        for (let i = 0; i < Math.min(limit, 50); i++) {
          posts.push({
            url: `https://youtube.com/watch?v=example${i}`,
            type: 'video',
            title: `Sample Video ${i} from ${username}`,
            date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString()
          });
        }
        break;
    }

    // Filter by date if specified
    if (options.since) {
      const sinceDate = new Date(options.since);
      return posts.filter(post => new Date(post.date) >= sinceDate);
    }

    return posts;
  }

  /**
   * Detect social media platform from URL
   */
  private static detectPlatform(url: string): string | null {
    if (url.includes('instagram.com')) return 'instagram';
    if (url.includes('tiktok.com')) return 'tiktok';
    if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
    if (url.includes('facebook.com')) return 'facebook';
    if (url.includes('twitter.com') || url.includes('x.com')) return 'twitter';
    return null;
  }

  /**
   * Display social media recipe summary
   */
  private static displaySocialMediaRecipeSummary(recipe: any, platform: string): void {
    console.log('\n📱 Social Media Recipe Summary:');
    console.log(`Platform: ${platform.toUpperCase()}`);
    console.log(`Title: ${recipe.title || 'N/A'}`);
    console.log(`Source: ${recipe.source_url || 'N/A'}`);
    console.log(`Ingredients: ${recipe.ingredients?.length || 0}`);
    console.log(`Instructions: ${recipe.instructions?.length || 0} steps`);
    
    if (recipe.video_url) {
      console.log(`Video: ${recipe.video_url}`);
    }
    
    if (recipe.transcript) {
      console.log(`Transcript: ${recipe.transcript.length} characters`);
    }
    
    if (recipe.ocr_text) {
      console.log(`OCR Text: ${recipe.ocr_text.length} characters`);
    }
    
    if (recipe.hashtags && recipe.hashtags.length > 0) {
      console.log(`Hashtags: ${recipe.hashtags.slice(0, 5).join(', ')}`);
    }
  }

  /**
   * Save account scraping results
   */
  private static async saveAccountResults(
    results: any, 
    outputDir: string, 
    username: string, 
    platform: string
  ): Promise<void> {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `account-results-${platform}-${username}-${timestamp}.json`;
    const filepath = path.join(outputDir, filename);

    const reportData = {
      username,
      platform,
      timestamp: new Date().toISOString(),
      summary: {
        totalPosts: results.total,
        successfulPosts: results.successful,
        failedPosts: results.failed,
        recipesFound: results.recipesFound,
        recipeDiscoveryRate: `${((results.recipesFound / results.total) * 100).toFixed(1)}%`
      },
      errors: results.errors
    };

    fs.writeFileSync(filepath, JSON.stringify(reportData, null, 2));
    console.log(`📄 Account results saved to: ${filepath}`);
  }
}
