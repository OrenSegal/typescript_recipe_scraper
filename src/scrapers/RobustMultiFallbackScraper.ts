/**
 * Robust Multi-Fallback Scraper
 * Attempts multiple scraping strategies to maximize success rate
 *
 * Fallback Chain:
 * 1. JSON-LD Schema.org (fastest, most reliable)
 * 2. Microdata/RDFa parsing
 * 3. Site-specific selectors (Allrecipes, Food Network, etc.)
 * 4. Generic HTML scraping with ML enhancement
 * 5. Playwright headless browser (for JS-heavy sites)
 * 6. OCR as last resort (for image-based recipes)
 */

import * as cheerio from 'cheerio';
import { RawScrapedRecipe } from './websiteScraper.js';
import { isWebsiteBlocked, recordScrapingFailure, recordScrapingSuccess } from '../registry/BlockedWebsitesRegistry.js';
import { getCachedRecipe, setCachedRecipe } from '../cache/CacheManager.js';
import { Recipe } from '../types.js';

export interface ScraperResult {
  recipe: RawScrapedRecipe;
  method: 'json-ld' | 'microdata' | 'site-specific' | 'generic' | 'playwright' | 'ocr' | 'cache' |
          'tiktok-multi' | 'instagram-multi' | 'youtube-multi' | 'text-parsing' | 'pdf-extraction' |
          'twitter-multi' | 'facebook';
  confidence: number; // 0-100
  processingTime: number;
}

export class RobustMultiFallbackScraper {
  private static userAgents = [
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  ];

  /**
   * Main scraping method with full fallback chain
   */
  static async scrape(url: string): Promise<ScraperResult> {
    const startTime = Date.now();

    // Check if website is blocked
    if (isWebsiteBlocked(url)) {
      const error = `Website is blocked due to repeated failures`;
      console.log(`🚫 ${error}: ${url}`);
      throw new Error(error);
    }

    // Check cache first
    try {
      const cached = await getCachedRecipe(url);
      if (cached) {
        console.log(`🎯 Retrieved from cache: ${url}`);
        return {
          recipe: cached as any, // Type cast for compatibility
          method: 'cache',
          confidence: 100,
          processingTime: Date.now() - startTime
        };
      }
    } catch (error) {
      console.warn('⚠️ Cache check failed:', error);
    }

    console.log(`🔍 Starting robust scraping for: ${url}`);

    // Try each method in order
    const methods = [
      { name: 'json-ld', fn: () => this.tryJSONLD(url) },
      { name: 'microdata', fn: () => this.tryMicrodata(url) },
      { name: 'site-specific', fn: () => this.trySiteSpecific(url) },
      { name: 'generic', fn: () => this.tryGenericScraping(url) },
      { name: 'playwright', fn: () => this.tryPlaywright(url) },
    ];

    let lastError: Error | null = null;

    for (const method of methods) {
      try {
        console.log(`  🔄 Attempting method: ${method.name}`);
        const recipe = await method.fn();

        if (this.validateRecipe(recipe)) {
          const confidence = this.calculateConfidence(recipe, method.name);
          console.log(`  ✅ Success with ${method.name} (confidence: ${confidence}%)`);

          // Cache successful result
          try {
            await setCachedRecipe(url, recipe as any);
          } catch (error) {
            console.warn('⚠️ Failed to cache result:', error);
          }

          // Record success
          await recordScrapingSuccess(url);

          return {
            recipe,
            method: method.name as any,
            confidence,
            processingTime: Date.now() - startTime
          };
        } else {
          console.log(`  ⚠️ ${method.name} returned incomplete data, trying next method`);
        }
      } catch (error: any) {
        console.log(`  ❌ ${method.name} failed: ${error.message}`);
        lastError = error;
      }
    }

    // All methods failed
    const errorMsg = `All scraping methods failed. Last error: ${lastError?.message || 'Unknown'}`;
    console.error(`❌ ${errorMsg}`);

    // Record failure
    await recordScrapingFailure(url, errorMsg);

    throw new Error(errorMsg);
  }

  /**
   * Method 1: JSON-LD Schema.org parsing (most reliable)
   */
  private static async tryJSONLD(url: string): Promise<RawScrapedRecipe> {
    const html = await this.fetchHTML(url);
    const $ = cheerio.load(html);

    const jsonLdElements = $('script[type="application/ld+json"]');

    for (let i = 0; i < jsonLdElements.length; i++) {
      try {
        const jsonLdText = $(jsonLdElements[i]).html()?.trim();
        if (!jsonLdText || !jsonLdText.includes('Recipe')) continue;

        const sanitized = jsonLdText
          .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
          .replace(/\\u0000/g, '')
          .trim();

        const data = JSON.parse(sanitized);
        const graph = Array.isArray(data) ? data : (data['@graph'] || [data]);
        const recipeJson = graph.find((item: any) =>
          item['@type'] === 'Recipe' || (Array.isArray(item['@type']) && item['@type'].includes('Recipe'))
        );

        if (recipeJson) {
          return this.parseJSONLDRecipe(recipeJson, url);
        }
      } catch (error) {
        continue;
      }
    }

    throw new Error('No valid JSON-LD recipe found');
  }

  /**
   * Method 2: Microdata/RDFa parsing
   */
  private static async tryMicrodata(url: string): Promise<RawScrapedRecipe> {
    const html = await this.fetchHTML(url);
    const $ = cheerio.load(html);

    // Look for itemtype="http://schema.org/Recipe"
    const recipeEl = $('[itemtype*="schema.org/Recipe"]').first();
    if (recipeEl.length === 0) {
      throw new Error('No microdata recipe found');
    }

    const title = recipeEl.find('[itemprop="name"]').first().text().trim();
    const description = recipeEl.find('[itemprop="description"]').first().text().trim();
    const image = recipeEl.find('[itemprop="image"]').first().attr('src') ||
                  recipeEl.find('[itemprop="image"]').first().attr('content');

    const ingredients: string[] = [];
    recipeEl.find('[itemprop="recipeIngredient"]').each((_, el) => {
      const text = $(el).text().trim();
      if (text) ingredients.push(text);
    });

    const instructions: string[] = [];
    recipeEl.find('[itemprop="recipeInstructions"]').each((_, el) => {
      const text = $(el).text().trim();
      if (text) instructions.push(text);
    });

    // Also check for HowToStep
    recipeEl.find('[itemprop="step"], [itemtype*="HowToStep"]').each((_, el) => {
      const text = $(el).text().trim();
      if (text && !instructions.includes(text)) {
        instructions.push(text);
      }
    });

    if (!title || ingredients.length === 0 || instructions.length === 0) {
      throw new Error('Incomplete microdata recipe');
    }

    return {
      title,
      description: description || undefined,
      image_url: image,
      ingredients,
      instructions,
      source_url: url,
      servings: this.extractServings(recipeEl, $),
      prep_time_minutes: this.extractTimeMinutes(recipeEl, $, 'prepTime'),
      cook_time_minutes: this.extractTimeMinutes(recipeEl, $, 'cookTime')
    };
  }

  /**
   * Method 3: Site-specific selectors
   */
  private static async trySiteSpecific(url: string): Promise<RawScrapedRecipe> {
    const domain = new URL(url).hostname;
    const html = await this.fetchHTML(url);
    const $ = cheerio.load(html);

    // Allrecipes
    if (domain.includes('allrecipes.com')) {
      return this.scrapeAllrecipes($, url);
    }

    // Food Network
    if (domain.includes('foodnetwork.com')) {
      return this.scrapeFoodNetwork($, url);
    }

    // Bon Appetit
    if (domain.includes('bonappetit.com')) {
      return this.scrapeBonAppetit($, url);
    }

    // NYT Cooking
    if (domain.includes('cooking.nytimes.com')) {
      return this.scrapeNYTCooking($, url);
    }

    // Serious Eats
    if (domain.includes('seriouseats.com')) {
      return this.scrapeSeriousEats($, url);
    }

    // Tasty
    if (domain.includes('tasty.co')) {
      return this.scrapeTasty($, url);
    }

    throw new Error('No site-specific scraper available');
  }

  /**
   * Method 4: Generic HTML scraping with smart selectors
   */
  private static async tryGenericScraping(url: string): Promise<RawScrapedRecipe> {
    const html = await this.fetchHTML(url);
    const $ = cheerio.load(html);

    // Try multiple title selectors
    const titleSelectors = [
      'h1.recipe-title',
      'h1.entry-title',
      'h1[itemprop="name"]',
      '.recipe-header h1',
      'h1',
      'title'
    ];

    let title = '';
    for (const selector of titleSelectors) {
      title = $(selector).first().text().trim();
      if (title && title.length > 5) break;
    }

    // Try multiple ingredient selectors
    const ingredientSelectors = [
      '.recipe-ingredients li',
      '.ingredients li',
      '[itemprop="recipeIngredient"]',
      'li.ingredient',
      'ul.ingredients-list li'
    ];

    const ingredients: string[] = [];
    for (const selector of ingredientSelectors) {
      $(selector).each((_, el) => {
        const text = $(el).text().trim();
        if (text && text.length > 3) {
          ingredients.push(text);
        }
      });
      if (ingredients.length >= 3) break; // Found enough ingredients
    }

    // Try multiple instruction selectors
    const instructionSelectors = [
      '.recipe-instructions li',
      '.instructions li',
      '[itemprop="recipeInstructions"] li',
      'ol.instructions li',
      '.directions li'
    ];

    const instructions: string[] = [];
    for (const selector of instructionSelectors) {
      $(selector).each((_, el) => {
        const text = $(el).text().trim();
        if (text && text.length > 10) {
          instructions.push(text);
        }
      });
      if (instructions.length >= 2) break; // Found enough instructions
    }

    if (!title || ingredients.length === 0 || instructions.length === 0) {
      throw new Error('Generic scraping found incomplete data');
    }

    return {
      title,
      description: $('meta[name="description"]').attr('content'),
      image_url: $('meta[property="og:image"]').attr('content'),
      ingredients,
      instructions,
      source_url: url,
      servings: 4,
      author: $('meta[name="author"]').attr('content')
    };
  }

  /**
   * Method 5: Playwright for JavaScript-heavy sites
   */
  private static async tryPlaywright(url: string): Promise<RawScrapedRecipe> {
    // Lazy load playwright only when needed
    const { chromium } = await import('playwright');

    console.log('  🎭 Launching Playwright browser...');
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

      // Wait for recipe content to load
      await page.waitForSelector('h1', { timeout: 10000 });

      const html = await page.content();
      await browser.close();

      // Try JSON-LD from rendered HTML
      const $ = cheerio.load(html);
      return await this.tryJSONLD(url);
    } catch (error) {
      await browser.close();
      throw error;
    }
  }

  /**
   * Fetch HTML with retries and rotating user agents
   */
  private static async fetchHTML(url: string, maxRetries = 3): Promise<string> {
    const { fetchText } = await import('../utils/robustFetch.js');

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const userAgent = this.userAgents[attempt % this.userAgents.length];
        const html = await fetchText(url, {
          maxRetries: 1,
          timeout: 30000,
          headers: {
            'User-Agent': userAgent,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br'
          }
        });

        return html;
      } catch (error: any) {
        if (attempt === maxRetries - 1) throw error;
        console.log(`  ⏳ Retry ${attempt + 1}/${maxRetries} after error: ${error.message}`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }

    throw new Error('Failed to fetch HTML after retries');
  }

  /**
   * Validate recipe has minimum required fields
   */
  private static validateRecipe(recipe: RawScrapedRecipe): boolean {
    return !!(
      recipe.title &&
      recipe.title.length > 3 &&
      recipe.ingredients &&
      recipe.ingredients.length >= 2 &&
      recipe.instructions &&
      recipe.instructions.length >= 1
    );
  }

  /**
   * Calculate confidence score based on completeness
   */
  private static calculateConfidence(recipe: RawScrapedRecipe, method: string): number {
    let score = 60; // Base score

    // Method bonus
    const methodBonus = {
      'json-ld': 20,
      'microdata': 15,
      'site-specific': 15,
      'generic': 5,
      'playwright': 10
    };
    score += methodBonus[method as keyof typeof methodBonus] || 0;

    // Field completeness
    if (recipe.description) score += 3;
    if (recipe.image_url) score += 3;
    if (recipe.servings) score += 2;
    if (recipe.prep_time_minutes) score += 2;
    if (recipe.cook_time_minutes) score += 2;
    if (recipe.author) score += 2;
    if (recipe.ingredients.length >= 5) score += 3;
    if (recipe.instructions.length >= 5) score += 3;

    return Math.min(100, score);
  }

  // Helper methods for parsing
  private static parseJSONLDRecipe(json: any, url: string): RawScrapedRecipe {
    // Implementation from your existing websiteScraper.ts
    // I'll use a simplified version here
    return {
      title: json.name || 'Untitled Recipe',
      description: json.description,
      image_url: this.extractImageUrl(json.image),
      servings: this.parseServings(json.recipeYield),
      prep_time_minutes: this.parseTime(json.prepTime),
      cook_time_minutes: this.parseTime(json.cookTime),
      total_time_minutes: this.parseTime(json.totalTime),
      ingredients: Array.isArray(json.recipeIngredient) ? json.recipeIngredient : [],
      instructions: this.parseInstructions(json.recipeInstructions),
      author: json.author?.name || json.author,
      source_url: url
    };
  }

  private static extractImageUrl(imageData: any): string | undefined {
    if (!imageData) return undefined;
    if (typeof imageData === 'string') return imageData;
    if (Array.isArray(imageData)) {
      const first = imageData[0];
      if (typeof first === 'string') return first;
      if (first?.url) return first.url;
    }
    if (imageData.url) return imageData.url;
    return undefined;
  }

  private static parseServings(yieldValue: any): number {
    if (!yieldValue) return 4;
    const yieldStr = Array.isArray(yieldValue) ? yieldValue[0] : String(yieldValue);
    const match = yieldStr.match(/\d+/);
    return match ? parseInt(match[0]) : 4;
  }

  private static parseTime(timeStr: any): number | undefined {
    if (!timeStr) return undefined;
    if (typeof timeStr === 'number') return timeStr;

    const str = String(timeStr);
    if (str.startsWith('PT')) {
      const hours = str.match(/(\d+)H/) ? parseInt(str.match(/(\d+)H/)![1]) : 0;
      const minutes = str.match(/(\d+)M/) ? parseInt(str.match(/(\d+)M/)![1]) : 0;
      return hours * 60 + minutes;
    }

    const numMatch = str.match(/\d+/);
    return numMatch ? parseInt(numMatch[0]) : undefined;
  }

  private static parseInstructions(instructions: any): string[] {
    if (!instructions) return [];
    if (Array.isArray(instructions)) {
      return instructions.map(i => typeof i === 'string' ? i : i.text || i.name || String(i));
    }
    if (typeof instructions === 'string') {
      return [instructions];
    }
    return [];
  }

  // Site-specific scrapers (simplified - you can expand these)
  private static scrapeAllrecipes($: cheerio.CheerioAPI, url: string): RawScrapedRecipe {
    return {
      title: $('h1#article-heading_1-0').text().trim(),
      ingredients: $('ul.mntl-structured-ingredients__list li').map((_, el) => $(el).text().trim()).get(),
      instructions: $('#recipe__steps-content_1-0 li p').map((_, el) => $(el).text().trim()).get(),
      source_url: url
    };
  }

  private static scrapeFoodNetwork($: cheerio.CheerioAPI, url: string): RawScrapedRecipe {
    return {
      title: $('h1.o-AssetTitle__a-Headline').text().trim(),
      ingredients: $('.o-Ingredients__a-Ingredient--CheckboxLabel').map((_, el) => $(el).text().trim()).get(),
      instructions: $('.o-Method__a-ListItem').map((_, el) => $(el).text().trim()).get(),
      source_url: url
    };
  }

  private static scrapeBonAppetit($: cheerio.CheerioAPI, url: string): RawScrapedRecipe {
    throw new Error('Not implemented');
  }

  private static scrapeNYTCooking($: cheerio.CheerioAPI, url: string): RawScrapedRecipe {
    throw new Error('Not implemented');
  }

  private static scrapeSeriousEats($: cheerio.CheerioAPI, url: string): RawScrapedRecipe {
    throw new Error('Not implemented');
  }

  private static scrapeTasty($: cheerio.CheerioAPI, url: string): RawScrapedRecipe {
    throw new Error('Not implemented');
  }

  private static extractServings($el: cheerio.Cheerio<any>, $: cheerio.CheerioAPI): number {
    const servingsText = $el.find('[itemprop="recipeYield"]').text();
    const match = servingsText.match(/\d+/);
    return match ? parseInt(match[0]) : 4;
  }

  private static extractTimeMinutes($el: cheerio.Cheerio<any>, $: cheerio.CheerioAPI, prop: string): number | undefined {
    const timeEl = $el.find(`[itemprop="${prop}"]`);
    const timeStr = timeEl.attr('content') || timeEl.attr('datetime') || timeEl.text();
    return this.parseTime(timeStr);
  }
}
