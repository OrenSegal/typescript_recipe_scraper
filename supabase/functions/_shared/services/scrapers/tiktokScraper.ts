// src/scrapers/tiktokScraper.ts
import { exec } from 'child_process';
import { promisify } from 'util';
import type { RawRecipeData } from '../../types.ts'; 

const execAsync = promisify(exec);

function parseIngredientsFromTextBasic(description: string): string[] {
  // Basic ingredient extraction from social media text
  const ingredients = description.match(/\b(?:cup|tbsp|tsp|oz|lb|gram|ml|liter)s?\s+[^\n\.!?]+/gi) || [];
  return ingredients.map(ing => ing.trim()).filter(ing => ing.length > 0);
}

function parseInstructionsFromTextBasic(description: string): string[] {
  // Basic instruction extraction from social media text
  const sentences = description.split(/[.!?]+/).filter(s => s.trim().length > 10);
  return sentences.map(s => s.trim()).filter(s => s.length > 0);
}

// Partial interface for expected yt-dlp JSON output for TikTok
interface YtDlpTikTokOutput {
  title?: string;
  fulltitle?: string;
  description?: string;
  thumbnail?: string;
  uploader?: string;
  uploader_id?: string;
  tags?: string[];
  // Add other fields if needed
}

/*
 * Fetches recipe data from a TikTok URL using yt-dlp.
 *
 * @param url The TikTok video URL.
 * @returns A Promise resolving to RawRecipeData or null if scraping fails.
 */
export async function scrapeTikTokRecipe(url: string): Promise<RawRecipeData | null> {
  console.log(`INFO (tiktokScraper): Attempting to fetch TikTok data for: ${url} using yt-dlp`);

  try {
    // Command to get JSON output from yt-dlp
    // Added --encoding utf-8, --no-warnings as in Python version
    // Ensure yt-dlp is in PATH or provide full path if bundled/layered in Vercel
    const command = `yt-dlp --dump-json --no-warnings --encoding utf-8 "${url}"`;

    const { stdout, stderr } = await execAsync(command, {
        maxBuffer: 1024 * 1024 * 5 // 5MB buffer, yt-dlp JSON can sometimes be large
    });

    if (stderr && !stderr.toLowerCase().includes('warning')) { // Ignore warnings but log other stderr
      // Check if stderr contains actual error messages vs warnings
      // yt-dlp sometimes outputs non-fatal info to stderr
      const criticalErrorPattern = /error|failed|unable to extract/i;
      if (criticalErrorPattern.test(stderr)) {
        console.error(`ERROR (tiktokScraper): yt-dlp command error for ${url}: ${stderr}`);
        // return null; // Decide if all stderr is fatal. Python version checked return code.
      } else {
        console.warn(`WARN (tiktokScraper): yt-dlp command stderr for ${url}: ${stderr}`);
      }
    }

    const videoInfo = JSON.parse(stdout) as YtDlpTikTokOutput;

    let title = videoInfo.title || videoInfo.fulltitle;
    if (!title || title === url || title === videoInfo.uploader) {
      const descLines = videoInfo.description?.split('\n') || [];
      if (descLines.length > 0 && descLines[0]!.trim()) {
        title = descLines[0]!.trim().substring(0, 150);
      } else {
        title = `TikTok Video by ${videoInfo.uploader || videoInfo.uploader_id || 'Unknown'}`;
      }
    }

    const description = videoInfo.description || '';
    const ingredientsRaw = parseIngredientsFromTextBasic(description);
    const instructionsRaw = parseInstructionsFromTextBasic(description);

    const rawData: RawRecipeData = {
      title,
      description,
      sourceUrl: url,
      imageUrl: videoInfo.thumbnail || null,
      servingsRaw: null, // Typically not available
      totalTimeMinutesRaw: null,
      prepTimeMinutesRaw: null,
      cookTimeMinutesRaw: null,
      cookingMethod: null, // To be inferred later
      ingredientsRaw,
      instructionsRaw,
      cuisinesRaw: [],
      mealTypesRaw: [],
      tagsRaw: videoInfo.tags || [],
      author: videoInfo.uploader || videoInfo.uploader_id || null,
      nutritionRaw: {}, // TikTok doesn't provide this
    };

    console.log(`INFO (tiktokScraper): Successfully processed TikTok URL: ${url}. Title: ${rawData.title}`);
    return rawData;

  } catch (error: any) {
    // Handle errors from execAsync (e.g., command not found, non-zero exit code)
    // or JSON.parse errors
    if (error.killed === false && typeof error.code === 'number' && error.code !== 0) {
        console.error(`ERROR (tiktokScraper): yt-dlp failed for ${url}. Exit code: ${error.code}.`);
        if (error.stderr) console.error(`yt-dlp stderr: ${error.stderr}`);
        if (error.stdout) console.warn(`yt-dlp stdout (on error): ${error.stdout.substring(0, 200)}...`);
    } else if (error instanceof SyntaxError) {
        console.error(`ERROR (tiktokScraper): Failed to decode JSON from yt-dlp output for ${url}: ${error.message}`);
    } else if (error.message && error.message.toLowerCase().includes('command not found')) {
        console.error(`ERROR (tiktokScraper): yt-dlp command not found. Ensure it is installed and in PATH.`);
        // This is a critical setup error for Vercel.
    }
    else {
        console.error(`ERROR (tiktokScraper): An unexpected error occurred while processing TikTok URL ${url} with yt-dlp:`, error);
    }
    return null;
  }
}
