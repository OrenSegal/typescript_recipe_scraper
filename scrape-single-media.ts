// Single Media Recipe Scraper - Instagram/YouTube/TikTok recipe scraping
import { exec } from 'child_process';
import { promisify } from 'util';
import { ComprehensiveEnrichment } from './src/enrichment/comprehensiveEnrichment.js';
import { processAndSaveRecipe } from './src/database.js';
import { RawScrapedRecipe } from './src/scrapers/websiteScraper.js';
import { RecipeProcessor } from './src/core/RecipeProcessor.js';
import { 
  downloadVideoForOCR, 
  extractVideoFrames, 
  extractTextWithGoogleVision, 
  cleanupTempFiles, 
  deduplicateAndCombineText,
  checkOCRDependencies 
} from './src/utils/ocrHelpers.js';

const execAsync = promisify(exec);

interface MediaRecipeData {
  platform: 'instagram' | 'youtube' | 'tiktok';
  url: string;
  title: string;
  description: string;
  uploader: string;
  uploaderId?: string;
  thumbnail?: string;
  duration?: number;
  viewCount?: number;
  likeCount?: number;
  timestamp?: string;
}

async function scrapeSingleMediaRecipe(url: string, shouldUpsert: boolean = false) {
  console.log(`🚀 Starting single media recipe scrape: ${url}`);
  console.log(`💾 Upsert to database: ${shouldUpsert}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const startTime = Date.now();
  
  try {
    // Step 1: Detect platform and extract metadata
    console.log(`🔍 Step 1: Detecting platform and extracting metadata...`);
    const platform = detectPlatform(url);
    if (!platform) {
      throw new Error('Unsupported platform. Only Instagram, YouTube, and TikTok are supported.');
    }

    console.log(`📱 Platform detected: ${platform.toUpperCase()}`);

    // Step 2: Extract media metadata using yt-dlp
    console.log(`📥 Step 2: Extracting media metadata...`);
    const mediaData = await extractMediaData(url, platform);
    
    console.log(`✅ Media metadata extracted:`);
    console.log(`   Title: ${mediaData.title || 'N/A'}`);
    console.log(`   Uploader: ${mediaData.uploader || 'N/A'}`);
    console.log(`   Duration: ${mediaData.duration ? `${mediaData.duration}s` : 'N/A'}`);

    // Step 3: Validating recipe content...
    console.log('🔄 Step 3: Validating recipe content...');
  
    // Check if this is actually recipe content
    const isRecipeContent = validateRecipeContent(mediaData.title, mediaData.description || '');
  
    if (!isRecipeContent.isRecipe) {
      console.log(`❌ Content validation failed: ${isRecipeContent.reason}`);
      console.log(`🚫 REBUFFED: "${mediaData.title}" - Not a recipe`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('❌ Media scrape rejected: Content is not a recipe');
      process.exit(0);
    }
  
    console.log(`✅ Recipe validation passed: ${isRecipeContent.confidence}% confidence`);
    console.log(`🎯 Recipe signals: ${isRecipeContent.signals.join(', ')}`);
  
    // Step 4: Extracting recipe content...
    console.log('🔄 Step 4: Extracting recipe content...');
    const rawRecipeData = parseMediaToRecipe(mediaData);
  
    // ✅ Video text extraction (OCR) implementation complete
    console.log('📹 Extracting text from video frames (OCR)...');
    const videoText = await extractVideoText(url, platform);
    if (videoText && videoText.length > 0) {
      console.log(`📝 Video text extracted: ${videoText.substring(0, 100)}...`);
      // Enhance recipe data with video text
      const videoRecipeData = parseMediaToRecipe({ ...mediaData, description: videoText });
      rawRecipeData.ingredients.push(...videoRecipeData.ingredients);
      rawRecipeData.instructions.push(...videoRecipeData.instructions);
    }
  
    if (rawRecipeData.ingredients.length === 0 && rawRecipeData.instructions.length === 0) {
      console.log('❌ No recipe content found in video text or description');
      console.log(`🚫 REBUFFED: "${mediaData.title}" - No extractable recipe data`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('❌ Media scrape rejected: No recipe content extractable');
      process.exit(0);
    }
  
    console.log(`📋 Recipe content extracted:`);
    console.log(`   Ingredients: ${rawRecipeData.ingredients.length}`);
    console.log(`   Instructions: ${rawRecipeData.instructions.length}`);

    // Step 5: Comprehensive enrichment
    console.log(`🔄 Step 5: Running comprehensive enrichment...`);
    const enrichedData = await ComprehensiveEnrichment.enrichRecipe(rawRecipeData);

    // Step 6: Optional database upsert
    console.log(`✅ Enrichment completed:`);
    console.log(`   Health Score: ${enrichedData.health_score || 'N/A'}`);
    console.log(`   Cooking Method: ${enrichedData.cooking_method || 'N/A'}`);
    console.log(`   Meal Types: ${enrichedData.meal_types?.join(', ') || 'N/A'}`);
    console.log(`   completenessScore: ${enrichedData.completeness_score || 70}%`);

    // Step 5: Optional database upsert
    let upsertResult: { success: boolean; error?: string } | null = null;
    if (shouldUpsert) {
      console.log(`💾 Step 5: Upserting to database...`);
      try {
        await processAndSaveRecipe(rawRecipeData, url, {
          include_ai: true,
          include_nutrition: true,
          generate_embedding: true
        });
        upsertResult = { success: true };
        console.log(`✅ Recipe upserted successfully`);
      } catch (error) {
        console.error(`❌ Database upsert failed:`, error);
        return { 
          source_url: url, 
          data: enrichedData, 
          mediaData,
          upsertError: error instanceof Error ? error.message : 'Unknown upsert error' 
        };
      }
    }

    const duration = Date.now() - startTime;
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🎉 Single media recipe scrape completed successfully in ${duration}ms`);
    console.log(`📊 Final completeness score: ${enrichedData.completeness_score || 'N/A'}%`);

    return {
      success: true,
      platform,
      data: enrichedData,
      mediaData,
      upsertResult,
      duration
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error(`❌ Single media recipe scrape failed after ${duration}ms:`, error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error',
      duration
    };
  }
}

function detectPlatform(url: string): 'instagram' | 'youtube' | 'tiktok' | null {
  if (url.includes('instagram.com') || url.includes('instagr.am')) {
    return 'instagram';
  } else if (url.includes('youtube.com') || url.includes('youtu.be')) {
    return 'youtube';
  } else if (url.includes('tiktok.com')) {
    return 'tiktok';
  }
  return null;
}

async function extractMediaData(url: string, platform: string): Promise<MediaRecipeData> {
  const command = `yt-dlp --dump-json "${url}"`;
  
  try {
    const { stdout } = await execAsync(command, { 
      timeout: 30000, // 30 second timeout
      maxBuffer: 1024 * 1024 // 1MB buffer
    });
    
    const metadata = JSON.parse(stdout);
    
    return {
      platform: platform as any,
      url: url,
      title: metadata.title || `${platform} Recipe`,
      description: metadata.description || '',
      uploader: metadata.uploader || metadata.uploader_id || 'Unknown',
      uploaderId: metadata.uploader_id,
      thumbnail: metadata.thumbnail,
      duration: metadata.duration,
      viewCount: metadata.view_count,
      likeCount: metadata.like_count,
      timestamp: metadata.upload_date || new Date().toISOString()
    };
  } catch (error) {
    throw new Error(`Failed to extract ${platform} metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

interface RecipeValidationResult {
  isRecipe: boolean;
  confidence: number;
  reason: string;
  signals: string[];
}

function validateRecipeContent(title: string, description: string): RecipeValidationResult {
  const combinedText = `${title} ${description}`.toLowerCase();
  
  // Recipe signals (positive indicators)
  const recipeSignals = [
    'recipe', 'cook', 'bake', 'ingredient', 'instruction', 'step', 'prep', 'minutes',
    'cup', 'tablespoon', 'teaspoon', 'ounce', 'pound', 'gram', 'ml', 'liter',
    'mix', 'blend', 'stir', 'heat', 'boil', 'fry', 'grill', 'roast', 'sauté',
    'meal', 'dish', 'food', 'kitchen', 'chef', 'cooking', 'homemade', 'delicious',
    'mealprep', 'meal prep', 'how to make', 'easy recipe', 'quick recipe'
  ];
  
  // Non-recipe signals (negative indicators)
  const nonRecipeSignals = [
    'music video', 'official video', 'music', 'song', 'album', 'artist',
    'never gonna give you up', 'rick roll', 'rickroll',
    'movie', 'trailer', 'film', 'documentary',
    'news', 'politics', 'interview', 'podcast',
    'gaming', 'gameplay', 'review', 'unboxing',
    'tutorial' // unless cooking tutorial
  ];
  
  // Count positive and negative signals
  const positiveSignals = recipeSignals.filter(signal => combinedText.includes(signal));
  const negativeSignals = nonRecipeSignals.filter(signal => combinedText.includes(signal));
  
  // Special case: cooking tutorials are recipes
  if (combinedText.includes('tutorial') && 
      (combinedText.includes('cook') || combinedText.includes('recipe') || combinedText.includes('kitchen'))) {
    positiveSignals.push('cooking tutorial');
    // Remove tutorial from negative signals
    const tutorialIndex = negativeSignals.indexOf('tutorial');
    if (tutorialIndex > -1) {
      negativeSignals.splice(tutorialIndex, 1);
    }
  }
  
  // Calculate confidence score
  const positiveScore = positiveSignals.length * 10;
  const negativeScore = negativeSignals.length * -20; // Negative signals are more decisive
  const totalScore = positiveScore + negativeScore;
  
  // Determine if it's a recipe
  const isRecipe = totalScore >= 10 && negativeSignals.length === 0;
  const confidence = Math.max(0, Math.min(100, totalScore));
  
  let reason = '';
  if (!isRecipe) {
    if (negativeSignals.length > 0) {
      reason = `Contains non-recipe signals: ${negativeSignals.join(', ')}`;
    } else {
      reason = `Insufficient recipe signals (score: ${totalScore}, need: ≥10)`;
    }
  } else {
    reason = `Strong recipe indicators detected`;
  }
  
  return {
    isRecipe,
    confidence,
    reason,
    signals: positiveSignals
  };
}

// Video text extraction function with OCR integration
async function extractVideoText(url: string, platform: string): Promise<string | null> {
  console.log(`🔍 Attempting video text extraction for ${platform}...`);
  
  try {
    // Integrated OCR service with Google Vision API primary, Tesseract.js fallback
    const videoPath = await downloadVideoForOCR(url, platform);
    if (!videoPath) {
      console.log('❌ Failed to download video for OCR processing');
      return null;
    }

    const extractedFrames = await extractVideoFrames(videoPath);
    if (extractedFrames.length === 0) {
      console.log('❌ No frames extracted from video');
      await cleanupTempFiles([videoPath]);
      return null;
    }

    const ocrTexts: string[] = [];
    
    // Primary: Google Vision API (if API key available)
    if (process.env.GOOGLE_VISION_API_KEY) {
      console.log('🔍 Using Google Vision API for OCR...');
      for (const framePath of extractedFrames) {
        const text = await extractTextWithGoogleVision(framePath);
        if (text && text.trim().length > 0) {
          ocrTexts.push(text.trim());
        }
      }
    } else {
      // Fallback: Tesseract.js
      console.log('🔍 Using Tesseract.js for OCR (fallback)...');
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('eng');
      
      for (const framePath of extractedFrames) {
        try {
          const { data: { text } } = await worker.recognize(framePath);
          if (text && text.trim().length > 0) {
            ocrTexts.push(text.trim());
          }
        } catch (error) {
          console.log(`⚠️ OCR failed for frame ${framePath}:`, error);
        }
      }
      
      await worker.terminate();
    }

    // Cleanup temporary files
    await cleanupTempFiles([videoPath, ...extractedFrames]);
    
    // Combine and deduplicate extracted text
    const combinedText = deduplicateAndCombineText(ocrTexts);
    
    if (combinedText.length > 0) {
      console.log(`✅ Extracted ${combinedText.length} characters of text from video`);
      return combinedText;
    } else {
      console.log('ℹ️ No text found in video frames');
      return null;
    }
    
    console.log(`⚠️  OCR extraction not yet implemented - requires additional service setup`);
    return null;
    
  } catch (error) {
    console.warn(`⚠️  Video text extraction failed:`, error);
    return null;
  }
}

function parseMediaToRecipe(mediaData: any): RawScrapedRecipe {
  const description = mediaData.description;
  
  // Extract ingredients using pattern matching
  const ingredientPatterns = [
    /(?:ingredients?|you'?ll need):?\s*([\s\S]*?)(?:instructions?|directions?|method|steps?|recipe|how to|$)/i,
    /(?:^|\n)[-•*]\s*([^\n]+)/gm, // Bullet points
    /(?:\d+\s*(?:cup|tbsp|tsp|tablespoon|teaspoon|oz|lb|gram|g|kg|ml|liter|l)s?[^\n]*)/gi // Measurements
  ];

  let ingredients: string[] = [];
  
  for (const pattern of ingredientPatterns) {
    const matches = description.match(pattern);
    if (matches) {
      ingredients.push(...matches.map((m: string) => m.trim()).filter((m: string) => m.length > 2));
    }
  }

  // Remove duplicates and clean up
  ingredients = [...new Set(ingredients)]
    .map(ing => ing.replace(/^[-•*]\s*/, '').trim())
    .filter(ing => ing.length > 2 && !ing.match(/^(instructions?|directions?|method|steps?)$/i))
    .slice(0, 20); // Limit to 20 ingredients

  // Extract instructions
  const instructionPatterns = [
    /(?:instructions?|directions?|method|steps?|how to):?\s*([\s\S]*?)(?:ingredients?|recipe|$)/i,
    /(?:\d+\.|\d+\))\s*([^\n]+)/g, // Numbered steps
    /(?:^|\n)(?:step\s*\d+:?\s*)?([^\n]{20,})/gim // Long sentences (likely instructions)
  ];

  let instructions: string[] = [];
  
  for (const pattern of instructionPatterns) {
    const matches = description.match(pattern);
    if (matches) {
      instructions.push(...matches.map((m: string) => m.trim()).filter((m: string) => m.length > 10));
    }
  }

  // Clean up instructions
  instructions = [...new Set(instructions)]
    .map((inst: string) => inst.replace(/^\d+\.\s*|\d+\)\s*|^step\s*\d+:?\s*/i, '').trim())
    .filter((inst: string) => inst.length > 10)
    .slice(0, 15); // Limit to 15 instructions

  return {
    title: mediaData.title,
    description: mediaData.description,
    source_url: mediaData.url,
    image_url: mediaData.thumbnail || undefined,
    servings: extractServings(description) || undefined,
    total_time_minutes: mediaData.duration ? Math.ceil(mediaData.duration / 60) : undefined,
    prep_time_minutes: undefined,
    cook_time_minutes: undefined,
    ingredients: ingredients,
    instructions: instructions,
    cuisines: [],
    tags: [mediaData.platform],
    author: undefined
  };
}

function extractServings(description: string): number | null {
  const servingPatterns = [
    /(?:serves?|servings?|portions?)\s*:?\s*(\d+)/i,
    /(?:for|feeds?)\s*(\d+)\s*(?:people|persons?)/i,
    /(\d+)\s*(?:person|people|serving|portion)/i
  ];

  for (const pattern of servingPatterns) {
    const match = description.match(pattern);
    if (match) {
      const servings = parseInt(match[1], 10);
      if (servings > 0 && servings <= 20) {
        return servings;
      }
    }
  }

  return null;
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
📱 Single Media Recipe Scraper

Usage:
  tsx scrape-single-media.ts <media-url> [--upsert]

Arguments:
  media-url    URL of the Instagram, YouTube, or TikTok recipe video

Options:
  --upsert     Also upsert the scraped recipe to the database
  --help, -h   Show this help message

Supported Platforms:
  • Instagram: posts, reels, stories (if accessible)
  • YouTube: videos, shorts
  • TikTok: videos

Examples:
  tsx scrape-single-media.ts "https://www.instagram.com/p/ABC123/"
  tsx scrape-single-media.ts "https://www.youtube.com/watch?v=ABC123" --upsert
  tsx scrape-single-media.ts "https://www.tiktok.com/@user/video/123456789"

Requirements:
  • yt-dlp must be installed and available in PATH
  • For Instagram: May require login for private content
`);
    process.exit(0);
  }

  const url = args[0];
  const shouldUpsert = args.includes('--upsert');

  if (!url.startsWith('http')) {
    console.error('❌ Error: Please provide a valid URL starting with http:// or https://');
    process.exit(1);
  }

  const result = await scrapeSingleMediaRecipe(url, shouldUpsert);
  
  if (!result.success) {
    console.error(`❌ Media scraping failed: ${result.error}`);
    process.exit(1);
  }

  console.log(`✅ Media recipe scraped successfully from ${result.platform?.toUpperCase()}!`);
  console.log(`📊 Completeness: ${result.data?.completeness_score || 'N/A'}%`);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { scrapeSingleMediaRecipe };
