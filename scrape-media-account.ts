// Media Account/Tag Scraper - Batch scrape all recipe videos from Instagram/YouTube/TikTok accounts or hashtags
import { exec } from 'child_process';
import { promisify } from 'util';
import { scrapeSingleMediaRecipe } from './scrape-single-media.js';
import { writeFile } from 'fs/promises';

const execAsync = promisify(exec);

interface MediaAccountConfig {
  accountUrl: string;
  platform: 'instagram' | 'youtube' | 'tiktok';
  maxVideos: number;
  shouldUpsert: boolean;
  recipeKeywords: string[];
  minDuration?: number; // seconds
  maxDuration?: number; // seconds
}

interface VideoMetadata {
  url: string;
  title: string;
  description: string;
  duration?: number;
  uploadDate?: string;
  viewCount?: number;
  likeCount?: number;
}

async function scrapeMediaAccount(config: MediaAccountConfig) {
  console.log(`🚀 Starting media account/tag scrape: ${config.accountUrl}`);
  console.log(`📱 Platform: ${config.platform.toUpperCase()}`);
  console.log(`📊 Max videos: ${config.maxVideos}`);
  console.log(`🔍 Recipe keywords: ${config.recipeKeywords.join(', ')}`);
  console.log(`💾 Upsert to database: ${config.shouldUpsert}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const startTime = Date.now();
  
  try {
    // Step 1: Extract all video URLs from account/tag
    console.log(`🔍 Step 1: Discovering videos from ${config.platform} account/tag...`);
    const videoUrls = await discoverAccountVideos(config);
    
    console.log(`✅ Found ${videoUrls.length} total videos`);

    if (videoUrls.length === 0) {
      console.warn(`⚠️  No videos found for account/tag: ${config.accountUrl}`);
      return { success: false, error: 'No videos discovered' };
    }

    // Step 2: Filter videos for recipe content
    console.log(`🔍 Step 2: Filtering videos for recipe content...`);
    const videoMetadata = await getVideoMetadata(videoUrls.slice(0, Math.min(videoUrls.length, config.maxVideos * 3))); // Get 3x more for filtering
    const recipeVideos = filterRecipeVideos(videoMetadata, config);
    
    console.log(`✅ Filtered to ${recipeVideos.length} potential recipe videos`);
    console.log(`📊 Recipe detection rate: ${(recipeVideos.length / videoMetadata.length * 100).toFixed(1)}%`);

    if (recipeVideos.length === 0) {
      console.warn(`⚠️  No recipe videos detected. Try adjusting keywords or checking account content.`);
      return { success: false, error: 'No recipe videos detected after filtering' };
    }

    // Limit to max videos
    const videosToProcess = recipeVideos.slice(0, config.maxVideos);
    console.log(`📊 Processing ${videosToProcess.length} recipe videos...`);

    // Step 3: Process each recipe video
    const results = {
      successful: [] as any[],
      failed: [] as any[],
      videos: videosToProcess
    };

    for (let i = 0; i < videosToProcess.length; i++) {
      const video = videosToProcess[i];
      console.log(`\n🔄 Processing ${i + 1}/${videosToProcess.length}: ${video.title}`);
      console.log(`   URL: ${video.url}`);

      try {
        const recipeResult = await scrapeSingleMediaRecipe(video.url, config.shouldUpsert);
        
        if (recipeResult.success) {
          results.successful.push({
            ...recipeResult,
            videoMetadata: video
          });
          console.log(`   ✅ Success: ${recipeResult.data?.completeness_score || 'N/A'}% completeness`);
        } else {
          results.failed.push({
            url: video.url,
            title: video.title,
            error: recipeResult.error
          });
          console.log(`   ❌ Failed: ${recipeResult.error}`);
        }
      } catch (error) {
        results.failed.push({
          url: video.url,
          title: video.title,
          error: error instanceof Error ? error.message : 'Unknown processing error'
        });
        console.log(`   ❌ Processing error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      // Rate limiting: wait between requests
      if (i < videosToProcess.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
      }
    }

    // Step 4: Generate comprehensive report
    const report = {
      account: config.accountUrl,
      platform: config.platform,
      timestamp: new Date().toISOString(),
      config,
      discovery: {
        totalVideosFound: videoUrls.length,
        videosAnalyzed: videoMetadata.length,
        recipeVideosDetected: recipeVideos.length,
        recipeDetectionRate: `${(recipeVideos.length / videoMetadata.length * 100).toFixed(1)}%`
      },
      processing: {
        videosProcessed: videosToProcess.length,
        successful: results.successful.length,
        failed: results.failed.length,
        successRate: `${(results.successful.length / videosToProcess.length * 100).toFixed(1)}%`,
        avgCompletenessScore: results.successful.length > 0
          ? (results.successful.reduce((sum, r) => sum + (r.data?.completenessScore || 0), 0) / results.successful.length).toFixed(1)
          : 'N/A'
      },
      results
    };

    // Save detailed report
    const reportFilename = `media-account-report-${config.platform}-${Date.now()}.json`;
    await writeFile(reportFilename, JSON.stringify(report, null, 2));

    const duration = Date.now() - startTime;
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🎉 Media account scrape completed in ${(duration / 1000).toFixed(1)}s`);
    console.log(`📊 Results: ${results.successful.length}/${videosToProcess.length} successful (${report.processing.successRate})`);
    console.log(`📈 Average completeness: ${report.processing.avgCompletenessScore}%`);
    console.log(`📄 Detailed report saved: ${reportFilename}`);

    if (results.failed.length > 0) {
      console.log(`⚠️  ${results.failed.length} recipes failed. Check the report for details.`);
    }

    return {
      success: true,
      report,
      reportFile: reportFilename,
      duration
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error(`❌ Media account scrape failed after ${(duration / 1000).toFixed(1)}s:`, error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error',
      duration
    };
  }
}

async function discoverAccountVideos(config: MediaAccountConfig): Promise<string[]> {
  const { accountUrl, platform, maxVideos } = config;
  
  // Construct yt-dlp command for different platforms
  let command = '';
  const videoLimit = maxVideos * 5; // Get 5x more for better filtering
  
  switch (platform) {
    case 'instagram':
      command = `yt-dlp --flat-playlist --playlist-end ${videoLimit} --get-url "${accountUrl}"`;
      break;
    case 'youtube':
      // For YouTube channels or playlists
      if (accountUrl.includes('/playlist?')) {
        command = `yt-dlp --flat-playlist --playlist-end ${videoLimit} --get-url "${accountUrl}"`;
      } else if (accountUrl.includes('/channel/') || accountUrl.includes('/c/') || accountUrl.includes('/@')) {
        command = `yt-dlp --flat-playlist --playlist-end ${videoLimit} --get-url "${accountUrl}/videos"`;
      } else {
        throw new Error('Invalid YouTube URL. Please provide a channel URL or playlist URL.');
      }
      break;
    case 'tiktok':
      // For TikTok users
      command = `yt-dlp --flat-playlist --playlist-end ${videoLimit} --get-url "${accountUrl}"`;
      break;
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }

  try {
    console.log(`   Running: ${command.replace(accountUrl, '[URL_HIDDEN]')}`);
    const { stdout } = await execAsync(command, { 
      timeout: 120000, // 2 minute timeout
      maxBuffer: 5 * 1024 * 1024 // 5MB buffer
    });
    
    const urls = stdout.trim().split('\n').filter(url => url.trim() && url.startsWith('http'));
    return urls;
  } catch (error) {
    throw new Error(`Failed to discover videos from ${platform}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function getVideoMetadata(urls: string[]): Promise<VideoMetadata[]> {
  const metadata: VideoMetadata[] = [];
  const batchSize = 5; // Process in small batches to avoid overwhelming
  
  console.log(`   Analyzing metadata for ${urls.length} videos...`);
  
  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize);
    console.log(`   Batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(urls.length / batchSize)}: Processing ${batch.length} videos...`);
    
    const batchPromises = batch.map(async (url) => {
      try {
        const command = `yt-dlp --dump-json "${url}"`;
        const { stdout } = await execAsync(command, { 
          timeout: 30000, // 30 second timeout per video
          maxBuffer: 1024 * 1024 // 1MB buffer
        });
        
        const data = JSON.parse(stdout);
        return {
          url: url,
          title: data.title || '',
          description: data.description || '',
          duration: data.duration,
          uploadDate: data.upload_date,
          viewCount: data.view_count,
          likeCount: data.like_count
        };
      } catch (error) {
        console.warn(`     ⚠️ Failed to get metadata for video: ${error instanceof Error ? error.message : 'Unknown error'}`);
        return null;
      }
    });
    
    const batchResults = await Promise.all(batchPromises);
    metadata.push(...batchResults.filter(result => result !== null) as VideoMetadata[]);
    
    // Rate limiting between batches
    if (i + batchSize < urls.length) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // 5 second delay between batches
    }
  }
  
  return metadata;
}

function filterRecipeVideos(videos: VideoMetadata[], config: MediaAccountConfig): VideoMetadata[] {
  const { recipeKeywords, minDuration, maxDuration } = config;
  
  return videos.filter(video => {
    // Check duration constraints
    if (minDuration && video.duration && video.duration < minDuration) return false;
    if (maxDuration && video.duration && video.duration > maxDuration) return false;
    
    // Check for recipe keywords in title and description
    const content = `${video.title} ${video.description}`.toLowerCase();
    const hasRecipeKeyword = recipeKeywords.some(keyword => 
      content.includes(keyword.toLowerCase())
    );
    
    // Additional recipe indicators
    const recipeIndicators = [
      'recipe', 'cook', 'bake', 'ingredient', 'instruction', 'step', 'kitchen',
      'food', 'dish', 'meal', 'prep', 'make', 'tutorial', 'how to', 'easy'
    ];
    
    const hasRecipeIndicator = recipeIndicators.some(indicator =>
      content.includes(indicator)
    );
    
    return hasRecipeKeyword || hasRecipeIndicator;
  });
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
👥 Media Account/Tag Recipe Scraper

Usage:
  tsx scrape-media-account.ts <account-url> [options]

Arguments:
  account-url    URL of the Instagram, YouTube, or TikTok account/tag

Options:
  --platform <name>        Platform: instagram, youtube, or tiktok (auto-detected if not specified)
  --max-videos <number>    Maximum number of recipe videos to process (default: 50)
  --keywords <word1,word2> Recipe keywords to filter by (default: recipe,cooking,baking,food)
  --min-duration <sec>     Minimum video duration in seconds
  --max-duration <sec>     Maximum video duration in seconds
  --upsert                 Upsert all scraped recipes to database
  --help, -h               Show this help message

Supported Account Types:
  • Instagram: User profiles (@username or full URL)
  • YouTube: Channels, user pages, or playlists
  • TikTok: User profiles (@username or full URL)

Examples:
  tsx scrape-media-account.ts "https://www.instagram.com/gordonramsay/"
  tsx scrape-media-account.ts "https://www.youtube.com/@BingingWithBabish" --max-videos 20
  tsx scrape-media-account.ts "https://www.tiktok.com/@gordon_ramsayofficial" --keywords "recipe,cook,chef" --upsert
  tsx scrape-media-account.ts "https://youtube.com/playlist?list=PLAb..." --platform youtube --min-duration 60

Requirements:
  • yt-dlp must be installed and available in PATH
  • For Instagram: May require login for private accounts
  • Large accounts may take significant time to process
`);
    process.exit(0);
  }

  const accountUrl = args[0];
  
  // Default config
  const config: MediaAccountConfig = {
    accountUrl,
    platform: detectPlatform(accountUrl),
    maxVideos: 50,
    shouldUpsert: false,
    recipeKeywords: ['recipe', 'cooking', 'baking', 'food', 'chef', 'kitchen']
  };

  // Parse arguments
  for (let i = 1; i < args.length; i++) {
    switch (args[i]) {
      case '--platform':
        config.platform = args[i + 1] as any;
        i++;
        break;
      case '--max-videos':
        config.maxVideos = parseInt(args[i + 1], 10);
        i++;
        break;
      case '--keywords':
        config.recipeKeywords = args[i + 1].split(',').map(k => k.trim());
        i++;
        break;
      case '--min-duration':
        config.minDuration = parseInt(args[i + 1], 10);
        i++;
        break;
      case '--max-duration':
        config.maxDuration = parseInt(args[i + 1], 10);
        i++;
        break;
      case '--upsert':
        config.shouldUpsert = true;
        break;
    }
  }

  if (!accountUrl.startsWith('http')) {
    console.error('❌ Error: Please provide a valid account URL starting with http:// or https://');
    process.exit(1);
  }

  if (!config.platform) {
    console.error('❌ Error: Could not detect platform. Please specify --platform instagram|youtube|tiktok');
    process.exit(1);
  }

  console.log(`📋 Configuration:`);
  console.log(`   Account: ${config.accountUrl}`);
  console.log(`   Platform: ${config.platform}`);
  console.log(`   Max videos: ${config.maxVideos}`);
  console.log(`   Keywords: ${config.recipeKeywords.join(', ')}`);

  const result = await scrapeMediaAccount(config);
  
  if (!result.success) {
    console.error(`❌ Account scraping failed: ${result.error}`);
    process.exit(1);
  }

  console.log(`✅ Account scraped successfully! Success rate: ${result.report?.processing.successRate}`);
}

function detectPlatform(url: string): 'instagram' | 'youtube' | 'tiktok' {
  if (url.includes('instagram.com') || url.includes('instagr.am')) {
    return 'instagram';
  } else if (url.includes('youtube.com') || url.includes('youtu.be')) {
    return 'youtube';
  } else if (url.includes('tiktok.com')) {
    return 'tiktok';
  }
  throw new Error('Unsupported platform. Only Instagram, YouTube, and TikTok are supported.');
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { scrapeMediaAccount };
