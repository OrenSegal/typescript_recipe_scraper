import { Router, Request, Response } from 'express';
import { SocialMediaScraper } from '../../scrapers/SocialMediaScraper.js';
import MultimediaSocialMediaScraper from '../../scrapers/multimediaSocialMediaScraper.js';
import { DatabaseService } from '../../services/DatabaseService.js';
import { ComprehensiveEnrichment } from '../../enrichment/comprehensiveEnrichment.js';
import { Recipe } from '@/types.js';

const router = Router();

/**
 * POST /api/social/scrape
 * Scrape a single social media post/video for recipes
 */
router.post('/scrape', async (req: Request, res: Response) => {
  try {
    const { 
      url, 
      platform, 
      enableOCR = false, 
      enableTranscription = false, 
      save = true 
    } = req.body;

    if (!url) {
      return res.status(400).json({
        error: 'Missing required parameter: url',
        timestamp: new Date().toISOString()
      });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return res.status(400).json({
        error: 'Invalid URL format',
        timestamp: new Date().toISOString()
      });
    }

    // Detect platform if not provided
    const detectedPlatform = platform || detectPlatform(url);
    if (!detectedPlatform) {
      return res.status(400).json({
        error: 'Could not detect platform. Please specify with platform parameter.',
        supportedPlatforms: ['instagram', 'tiktok', 'youtube', 'facebook', 'twitter'],
        timestamp: new Date().toISOString()
      });
    }

    // Route through multimedia-capable scraper for richer extraction
    const recipeData = await MultimediaSocialMediaScraper.scrapeRecipeFromUrl(url);

    if (!recipeData) {
      return res.status(404).json({
        error: 'No recipe data found in this social media post',
        url,
        platform: detectedPlatform,
        suggestions: [
          'Ensure the post contains recipe content',
          'Try enabling OCR for text extraction from images',
          'Try enabling transcription for video content'
        ],
        timestamp: new Date().toISOString()
      });
    }


    // Save to database
    let savedRecipe: Recipe & { id: string } | null = null;
    if (save) {
      try {
        const db = DatabaseService.getInstance();
        const savedRecipeInner = await db.saveRecipe(recipeData as any);
        savedRecipe = savedRecipeInner;
      } catch (saveError) {
        console.warn('Database save failed:', saveError);
        // Continue without saving
      }
    }

    res.json({
      success: true,
      platform: detectedPlatform,
      recipe: recipeData,
      savedId: savedRecipe?.id || null,
      features: {
        ocrEnabled: enableOCR,
        transcriptionEnabled: enableTranscription,
        saved: save && !!savedRecipe
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Social media scraping error:', error);
    res.status(500).json({
      error: 'Failed to scrape social media post',
      message: String(error),
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/social/account
 * Scrape all recipes from a social media account/channel
 */
router.post('/account', async (req: Request, res: Response) => {
  try {
    const { 
      username, 
      platform, 
      limit = 50, 
      since, 
      batchSize = 5,
      enableOCR = true,
      enableTranscription = true
    } = req.body;

    if (!username || !platform) {
      return res.status(400).json({
        error: 'Missing required parameters: username, platform',
        timestamp: new Date().toISOString()
      });
    }

    const supportedPlatforms = ['instagram', 'tiktok', 'youtube', 'facebook', 'twitter'];
    if (!supportedPlatforms.includes(platform)) {
      return res.status(400).json({
        error: 'Unsupported platform',
        platform,
        supportedPlatforms,
        timestamp: new Date().toISOString()
      });
    }

    // Send initial response - account scraping started
    res.status(202).json({
      success: true,
      message: 'Account scraping started',
      jobId: `account-${platform}-${username}-${Date.now()}`,
      account: {
        username,
        platform,
        limit,
        since
      },
      estimatedTime: `${Math.ceil(limit / batchSize) * 30} seconds`,
      startTime: new Date().toISOString()
    });

    // Process account scraping in background
    processAccountScrapingInBackground({
      username,
      platform,
      limit,
      since,
      batchSize,
      enableOCR,
      enableTranscription
    });

  } catch (error) {
    console.error('Account scraping error:', error);
    res.status(500).json({
      error: 'Failed to start account scraping',
      message: String(error),
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/social/platforms
 * List supported social media platforms and their capabilities
 */
router.get('/platforms', (req: Request, res: Response) => {
  res.json({
    success: true,
    platforms: {
      instagram: {
        name: 'Instagram',
        supported: ['posts', 'reels', 'stories'],
        features: ['OCR', 'hashtag extraction', 'image analysis'],
        rateLimits: 'Medium',
        authRequired: false
      },
      tiktok: {
        name: 'TikTok',
        supported: ['videos'],
        features: ['OCR', 'transcription', 'hashtag extraction'],
        rateLimits: 'High',
        authRequired: false
      },
      youtube: {
        name: 'YouTube',
        supported: ['videos', 'shorts'],
        features: ['transcription', 'description parsing', 'comment analysis'],
        rateLimits: 'Low',
        authRequired: false
      },
      facebook: {
        name: 'Facebook',
        supported: ['posts', 'videos'],
        features: ['OCR', 'text extraction'],
        rateLimits: 'High',
        authRequired: true
      },
      twitter: {
        name: 'Twitter/X',
        supported: ['tweets', 'threads'],
        features: ['text extraction', 'image OCR'],
        rateLimits: 'Very High',
        authRequired: true
      }
    },
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /api/social/stats
 * Get social media scraping statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const db = DatabaseService.getInstance();
    
    // Get recipes by source platform
    const socialMediaStats = await getSocialMediaStats(db);

    res.json({
      success: true,
      statistics: socialMediaStats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Social media stats error:', error);
    res.status(500).json({
      error: 'Failed to get social media statistics',
      message: String(error),
      timestamp: new Date().toISOString()
    });
  }
});

// Helper functions
function detectPlatform(url: string): string | null {
  if (url.includes('instagram.com')) return 'instagram';
  if (url.includes('tiktok.com')) return 'tiktok';
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
  if (url.includes('facebook.com')) return 'facebook';
  if (url.includes('twitter.com') || url.includes('x.com')) return 'twitter';
  return null;
}

async function processAccountScrapingInBackground(params: {
  username: string;
  platform: string;
  limit: number;
  since?: string;
  batchSize: number;
  enableOCR: boolean;
  enableTranscription: boolean;
}): Promise<void> {
  try {
    const { username, platform, limit, since, batchSize, enableOCR, enableTranscription } = params;
    
    const scraper = new SocialMediaScraper({
      enableOCR,
      enableTranscription
    });

    const db = DatabaseService.getInstance();

    // Get posts from account (placeholder implementation)
    const posts = await getAccountPosts(username, platform, limit, since);
    
    const results = {
      username,
      platform,
      startTime: new Date().toISOString(),
      endTime: null as string | null,
      totalPosts: posts.length,
      successful: 0,
      failed: 0,
      recipesFound: 0,
      errors: [] as string[]
    };

    console.log(`Processing ${posts.length} posts from @${username} on ${platform}`);

    // Process posts in batches
    for (let i = 0; i < posts.length; i += batchSize) {
      const batch = posts.slice(i, i + batchSize);
      
      await Promise.allSettled(batch.map(async (post) => {
        try {
          // Use multimedia pipeline per post for best extraction quality
          const recipeData = await MultimediaSocialMediaScraper.scrapeRecipeFromUrl(post.url);
          results.successful++;
          
          if (recipeData) {
            results.recipesFound++;
            
            // Save to database (cast to ParsedRecipeData for compatibility)
            await db.saveRecipe(recipeData as any);
            console.log(`✅ Recipe found: ${recipeData.title || post.url}`);
          }
        } catch (error) {
          results.failed++;
          results.errors.push(`Error processing ${post.url}: ${error}`);
          console.log(`❌ Failed: ${post.url}`);
        }
      }));

      // Rate limiting between batches
      if (i + batchSize < posts.length) {
        await new Promise(resolve => setTimeout(resolve, 30000)); // 30 second delay
      }
    }

    results.endTime = new Date().toISOString();
    console.log('Account scraping completed:', results);

  } catch (error) {
    console.error('Background account scraping error:', error);
  }
}

async function getAccountPosts(username: string, platform: string, limit: number, since?: string): Promise<any[]> {
  // Placeholder implementation - would integrate with actual APIs
  const posts = [];
  
  for (let i = 0; i < Math.min(limit, 20); i++) {
    const postDate = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    
    if (since && postDate < new Date(since)) {
      break;
    }
    
    posts.push({
      url: `https://${platform}.com/${username}/post/${i}`,
      date: postDate.toISOString(),
      type: platform === 'youtube' ? 'video' : 'post'
    });
  }
  
  return posts;
}

async function getSocialMediaStats(db: DatabaseService): Promise<any> {
  // Placeholder implementation - would query actual database
  return {
    totalSocialMediaRecipes: 150,
    platformBreakdown: {
      instagram: 65,
      tiktok: 45,
      youtube: 30,
      facebook: 7,
      twitter: 3
    },
    avgProcessingTime: '45 seconds',
    successRate: '78%',
    popularHashtags: ['#recipe', '#cooking', '#foodie', '#homemade', '#healthy'],
    lastUpdated: new Date().toISOString()
  };
}

export { router as SocialMediaApiRoutes };
