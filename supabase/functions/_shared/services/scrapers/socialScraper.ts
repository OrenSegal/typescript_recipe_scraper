
import { USER_AGENT } from "../../types.ts";
import { RawRecipeData } from "./websiteScraper.ts";

export async function scrapeSocialMediaRecipe(url: string, sourceType: 'tiktok' | 'instagram'): Promise<RawRecipeData | null> {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      console.error(`ERROR (${sourceType}Scraper): Failed to fetch URL ${url}. Status: ${response.status}`);
      return null;
    }

    const html = await response.text();
    
    // Use optional chaining `?.[1]` to safely access match groups
    const descriptionMatch = html.match(/<meta\s+property="og:description"\s+content="([^"]*)"/);
    const description = descriptionMatch?.[1] ?? ''; // Provide a default empty string

    const titleMatch = html.match(/<title>([^<]+)<\/title>/);
    const rawTitle = titleMatch?.[1]; // Safely access the match
    
    let title = 'Social Media Recipe'; // Default title
    if (rawTitle) {
      title = rawTitle.split(' on TikTok')[0]?.split(' on Instagram')[0] ?? rawTitle;
      title = title.replace(/#(\w+)/g, '').replace(/@(\w+)/g, '').trim();
    }

    const imageUrlMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]*)"/);

    const rawData: RawRecipeData = {
      title,
      description,
      sourceUrl: url,
      imageUrl: imageUrlMatch?.[1] || null, // Use undefined for missing optional fields
      ingredientsRaw: parseIngredientsFromTextBasic(description),
      instructionsRaw: parseInstructionsFromTextBasic(description),
      author: new URL(url).hostname,
    };
    
    console.log(`INFO (${sourceType}Scraper): Successfully scraped ${url}`);
    return rawData;

  } catch (error) {
    console.error(`CRITICAL (${sourceType}Scraper): Error scraping ${url}:`, error);
    return null;
  }
}

function parseIngredientsFromTextBasic(description: string): string[] | undefined {
  throw new Error(`Function not implemented: ${description}`);
}


function parseInstructionsFromTextBasic(description: string): string[] | undefined {
  throw new Error(`Function not implemented: ${description}`);
}
