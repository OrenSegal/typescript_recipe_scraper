// src/scrapers/instagramScraper.ts
import { exec } from 'child_process';
import { promisify } from 'util';
import type { RawRecipeData } from '../../types.ts';

const execAsync = promisify(exec);

function parseIngredientsFromTextBasic(description: string): string[] {
  // Basic ingredient extraction from Instagram captions
  const ingredients = description.match(/\b(?:cup|tbsp|tsp|oz|lb|gram|ml|liter)s?\s+[^\n\.!?#@]+/gi) || [];
  const hashtagIngredients = description.match(/#\w+/g)?.filter(tag => 
    /(?:ingredient|food|recipe|cooking)/i.test(tag)
  ) || [];
  
  return [...ingredients, ...hashtagIngredients.map(tag => tag.replace('#', ''))]
    .map(ing => ing.trim())
    .filter(ing => ing.length > 0)
    .slice(0, 20); // Limit to 20 ingredients
}

function parseInstructionsFromTextBasic(description: string): string[] {
  // Basic instruction extraction from Instagram captions
  const sentences = description.split(/[.!?]+/).filter(s => s.trim().length > 15);
  const steps = description.match(/(?:step\s*\d+|\d+[.))]\s*[^\n]+)/gi) || [];
  
  return [...sentences, ...steps]
    .map(s => s.trim())
    .filter(s => s.length > 10)
    .slice(0, 15); // Limit to 15 instructions
}

// Partial interface for expected yt-dlp JSON output for Instagram
// This will likely be very similar to TikTok's if yt-dlp processes it.
// Fields like 'caption' might be in 'description'.
interface YtDlpInstagramOutput {
  title?: string; // yt-dlp might generate a title
  description?: string; // This would be the Instagram caption
  thumbnail?: string;
  uploader?: string; // Instagram username
  uploader_id?: string;
  upload_date?: string; // YYYYMMDD format
  tags?: string[]; // Hashtags might be parsed into tags
  webpage_url?: string; // The original URL
  // Add other fields if discovered from yt-dlp output for Instagram
}


/*
 * Fetches recipe data from an Instagram Reel URL, primarily using yt-dlp.
 * Note: Instagram scraping is notoriously difficult and unstable.
 * This approach relies on yt-dlp's capabilities for Instagram, which may be limited
 * or require updates to yt-dlp.
 *
 * @param url The Instagram Reel URL.
 * @returns A Promise resolving to RawRecipeData or null if scraping fails.
 */
export async function scrapeInstagramReel(url: string): Promise<RawRecipeData | null> {
  console.log(`INFO (instagramScraper): Attempting to fetch Instagram Reel data for: ${url} using yt-dlp`);

  if (!url.includes('/reel/')) {
    console.warn(`WARN (instagramScraper): URL ${url} does not appear to be a Reel. yt-dlp might still work for public posts.`);
  }

  try {
    const command = `yt-dlp --dump-json --no-warnings --encoding utf-8 "${url}"`;
    const { stdout, stderr } = await execAsync(command, {
        maxBuffer: 1024 * 1024 * 5 // 5MB
    });

    if (stderr && !stderr.toLowerCase().includes('warning')) {
      const criticalErrorPattern = /error|failed|unable to extract|unsupported url/i;
      if (criticalErrorPattern.test(stderr)) {
        console.error(`ERROR (instagramScraper): yt-dlp command error for ${url}: ${stderr}`);
        // If yt-dlp explicitly says "Unsupported URL", it's a clear failure for this method.
        if (stderr.toLowerCase().includes('unsupported url')) return null;
      } else {
        console.warn(`WARN (instagramScraper): yt-dlp command stderr for ${url}: ${stderr}`);
      }
    }

    const videoInfo = JSON.parse(stdout) as YtDlpInstagramOutput;

    const caption = videoInfo.description || ''; // yt-dlp usually puts caption in description for IG

    let title = videoInfo.title;
    // If yt-dlp's title is generic or missing, try to derive from caption's first line
    if (!title || title === videoInfo.uploader || title.startsWith('Instagram post by')) {
      const captionLines = caption.split('\n');
      if (captionLines.length > 0 && captionLines[0]!.trim()) {
        title = captionLines[0]!.trim().substring(0, 150);
      } else {
        title = `Instagram Reel by ${videoInfo.uploader || 'Unknown'}`;
      }
    }

    const ingredientsRaw = parseIngredientsFromTextBasic(caption);
    const instructionsRaw = parseInstructionsFromTextBasic(caption);

    // Hashtags from yt-dlp are often in 'tags'. If not, try parsing from caption.
    let tags = videoInfo.tags || [];
    if (tags.length === 0 && caption) {
        const hashtagRegex = /#(\w+)/g;
        let match;
        while((match = hashtagRegex.exec(caption)) !== null) {
            tags.push(match[1]!);
        }
    }


    const rawData: RawRecipeData = {
      title,
      description: caption,
      sourceUrl: videoInfo.webpage_url || url,
      imageUrl: videoInfo.thumbnail || null,
      servingsRaw: null,
      totalTimeMinutesRaw: null,
      prepTimeMinutesRaw: null,
      cookTimeMinutesRaw: null,
      cookingMethod: null,
      ingredientsRaw,
      instructionsRaw,
      cuisinesRaw: [],
      mealTypesRaw: [],
      tagsRaw: tags,
      author: videoInfo.uploader || videoInfo.uploader_id || null,
      nutritionRaw: {},
      // upload_date: videoInfo.upload_date, // Already string YYYYMMDD if present
    };

    console.log(`INFO (instagramScraper): Successfully processed Instagram URL (via yt-dlp): ${url}. Title: ${rawData.title}`);
    return rawData;

  } catch (error: any) {
    if (error.killed === false && typeof error.code === 'number' && error.code !== 0) {
        console.error(`ERROR (instagramScraper): yt-dlp failed for Instagram URL ${url}. Exit code: ${error.code}.`);
        if (error.stderr) console.error(`yt-dlp stderr: ${error.stderr}`);
        if (error.stdout) console.warn(`yt-dlp stdout (on error): ${error.stdout.substring(0,200)}...`);
    } else if (error instanceof SyntaxError) {
        console.error(`ERROR (instagramScraper): Failed to decode JSON from yt-dlp output for IG URL ${url}: ${error.message}`);
    } else if (error.message && error.message.toLowerCase().includes('command not found')) {
        console.error(`ERROR (instagramScraper): yt-dlp command not found. Ensure it is installed and in PATH.`);
    }
    else {
        console.error(`ERROR (instagramScraper): An unexpected error occurred while processing Instagram URL ${url}:`, error);
    }
    console.warn("WARN (instagramScraper): Instagram scraping with yt-dlp is often unreliable. Consider alternative methods if this fails frequently.");
    return null;
  }
}
