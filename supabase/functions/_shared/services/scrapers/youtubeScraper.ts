// src/scrapers/youtubeScraper.ts
import { exec } from 'child_process';
import { promisify } from 'util';
import type { RawRecipeData } from '../../types.ts';

const execAsync = promisify(exec);

function parseIngredientsFromTextBasic(content: string): string[] {
  // Enhanced ingredient extraction for YouTube recipe content
  const ingredientPatterns = [
    // Standard measurement patterns
    /\b(?:\d+\/\d+|\d+\.\d+|\d+)\s*(?:cup|cups|tbsp|tablespoon|tablespoons|tsp|teaspoon|teaspoons|oz|ounces|lb|lbs|pound|pounds|gram|grams|g|kg|ml|liter|liters)s?\s+[^\n\.!?]+/gi,
    // Ingredient lists (bullets, dashes)
    /(?:^|\n)[-•*]\s*([^\n]+)/gm,
    // "You'll need" or "Ingredients" sections
    /(?:ingredients?|you'?ll need):?\s*([\s\S]*?)(?:instructions?|directions?|method|steps?|$)/i
  ];

  let ingredients: string[] = [];
  
  for (const pattern of ingredientPatterns) {
    const matches = content.match(pattern);
    if (matches) {
      ingredients.push(...matches.map(m => m.trim()).filter(m => m.length > 2));
    }
  }

  // Clean up and deduplicate
  return Array.from(new Set(ingredients))
    .map(ing => ing.replace(/^[-•*]\s*/, '').trim())
    .filter(ing => ing.length > 2 && !ing.match(/^(instructions?|directions?|method|steps?)$/i))
    .slice(0, 25); // Limit to 25 ingredients
}

function parseInstructionsFromTextBasic(content: string): string[] {
  // Enhanced instruction extraction for YouTube recipe content
  const instructionPatterns = [
    // Numbered steps
    /(?:\d+[.))]|step\s*\d+:?)\s*([^\n]{20,})/gi,
    // Instructions section
    /(?:instructions?|directions?|method|steps?|how to):?\s*([\s\S]*?)(?:ingredients?|recipe|$)/i,
    // Long descriptive sentences (likely instructions)
    /(?:^|\n)([^\n]{30,}(?:cook|bake|mix|add|heat|stir|combine|place|put|pour|season)[^\n]*)/gim
  ];

  let instructions: string[] = [];
  
  for (const pattern of instructionPatterns) {
    const matches = content.match(pattern);
    if (matches) {
      instructions.push(...matches.map(m => m.trim()).filter(m => m.length > 10));
    }
  }

  // Clean up instructions
  return Array.from(new Set(instructions))
    .map(inst => inst.replace(/^\d+[.)]\s*|^step\s*\d+:?\s*/i, '').trim())
    .filter(inst => inst.length > 15)
    .slice(0, 20); // Limit to 20 instructions
}

// YouTube video metadata interface
interface YouTubeVideoData {
  title: string;
  description: string;
  thumbnail: string;
  uploader: string;
  duration?: number;
  upload_date?: string;
  view_count?: number;
  like_count?: number;
  transcript?: string;
}

/*
 * Fetches recipe data from a YouTube URL using yt-dlp.
 * This approach is more robust than play-dl and youtube-transcript dependencies.
 *
 * @param url The YouTube video URL.
 * @returns A Promise resolving to RawRecipeData or null if scraping fails.
 */
export async function scrapeYouTubeRecipe(url: string): Promise<RawRecipeData | null> {
  console.log(`INFO (youtubeScraper): Attempting to fetch YouTube data for: ${url}`);

  try {
    // Step 1: Extract video metadata using yt-dlp
    const videoData = await extractYouTubeData(url);
    
    console.log(`INFO (youtubeScraper): Video found: ${videoData.title}`);
    console.log(`INFO (youtubeScraper): Channel: ${videoData.uploader}`);
    console.log(`INFO (youtubeScraper): Duration: ${videoData.duration ? `${videoData.duration}s` : 'N/A'}`);

    // Step 2: Attempt to fetch transcript for better content analysis
    let transcript = '';
    try {
      transcript = await fetchYouTubeTranscript(url);
      console.log(`INFO (youtubeScraper): Transcript fetched, length: ${transcript.length}`);
    } catch (transcriptError) {
      console.warn(`WARN (youtubeScraper): Could not fetch transcript: ${transcriptError}`);
      // Continue without transcript
    }

    // Step 3: Combine description and transcript for content analysis
    const fullContent = `${videoData.description} ${transcript}`.trim();
    
    // Step 4: Parse ingredients and instructions
    const ingredientsRaw = parseIngredientsFromTextBasic(fullContent);
    const instructionsRaw = parseInstructionsFromTextBasic(fullContent);

    console.log(`INFO (youtubeScraper): Extracted ${ingredientsRaw.length} ingredients, ${instructionsRaw.length} instructions`);

    // Step 5: Extract cooking time from content
    const cookingTime = extractCookingTime(fullContent);

    // Step 6: Prepare raw recipe data
    const rawData: RawRecipeData = {
      title: videoData.title,
      description: videoData.description,
      sourceUrl: url,
      imageUrl: videoData.thumbnail || null,
      servingsRaw: extractServings(fullContent),
      totalTimeMinutesRaw: cookingTime || (videoData.duration ? Math.ceil(videoData.duration / 60) : null),
      prepTimeMinutesRaw: null,
      cookTimeMinutesRaw: cookingTime,
      cookingMethod: null, // To be inferred during enrichment
      ingredientsRaw,
      instructionsRaw,
      cuisinesRaw: [], // Could be inferred from title/description
      tagsRaw: ['youtube', videoData.uploader.replace(/\s+/g, '_').toLowerCase()],
      nutritionRaw: null
    };

    console.log(`SUCCESS (youtubeScraper): Recipe data prepared for: ${videoData.title}`);
    return rawData;

  } catch (error) {
    console.error(`ERROR (youtubeScraper): Failed to scrape ${url}:`, error);
    return null;
  }
}

async function extractYouTubeData(url: string): Promise<YouTubeVideoData> {
  const command = `yt-dlp --dump-json "${url}"`;
  
  try {
    const { stdout } = await execAsync(command, { 
      timeout: 30000, // 30 second timeout
      maxBuffer: 2 * 1024 * 1024 // 2MB buffer
    });
    
    const metadata = JSON.parse(stdout);
    
    return {
      title: metadata.title || 'YouTube Recipe Video',
      description: metadata.description || '',
      thumbnail: metadata.thumbnail || '',
      uploader: metadata.uploader || metadata.uploader_id || 'Unknown Channel',
      duration: metadata.duration,
      upload_date: metadata.upload_date,
      view_count: metadata.view_count,
      like_count: metadata.like_count
    };
  } catch (error) {
    throw new Error(`Failed to extract YouTube metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function fetchYouTubeTranscript(url: string): Promise<string> {
  const command = `yt-dlp --write-auto-sub --sub-lang en --sub-format ttml --skip-download "${url}" -o "/tmp/%(title)s.%(ext)s"`;
  
  try {
    await execAsync(command, { 
      timeout: 45000, // 45 second timeout for transcript
      maxBuffer: 5 * 1024 * 1024 // 5MB buffer
    });
    
    // This is a simplified approach - in production, you'd want to:
    // 1. Parse the actual subtitle files
    // 2. Extract text content
    // 3. Clean up timing markers
    // For now, return empty string as transcript fetching is complex
    return '';
  } catch (error) {
    throw new Error(`Failed to fetch transcript: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function extractCookingTime(text: string): number | null {
  const timePatterns = [
    /(?:cook|bake|roast|grill|sauté)(?:ing|ed)?\s+(?:for|about|around)?\s*(\d+)\s*(?:minute|min|hour|hr)s?/gi,
    /(\d+)\s*(?:minute|min|hour|hr)s?\s+(?:cook|bake|roast|grill|sauté)/gi,
    /total.*time.*?(\d+)\s*(?:minute|min|hour|hr)s?/gi
  ];

  for (const pattern of timePatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const timeValue = parseInt(match[1], 10);
      const unit = match[0].toLowerCase();
      
      // Convert hours to minutes if needed
      if (unit.includes('hour') || unit.includes('hr')) {
        return timeValue * 60;
      }
      return timeValue;
    }
  }
  
  return null;
}

function extractServings(text: string): number | null {
  const servingPatterns = [
    /(?:serves?|servings?|portions?|feeds?)\s*:?\s*(\d+)/i,
    /(?:for|makes?)\s*(\d+)\s*(?:people|persons?|servings?)/i,
    /(\d+)\s*(?:person|people|serving|portion)/i
  ];

  for (const pattern of servingPatterns) {
    const match = text.match(pattern);
    if (match) {
      const servings = parseInt(match[1], 10);
      if (servings > 0 && servings <= 20) {
        return servings;
      }
    }
  }

  return null;
}
