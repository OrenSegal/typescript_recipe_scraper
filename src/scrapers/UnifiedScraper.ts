/*
 * Unified Recipe Scraper
 * 
 * Combines website scraping and social media scraping into a single interface
 * Supports: Websites, Instagram Reels, TikTok Posts, YouTube Videos
 */

import { scrapeWebsite } from './websiteScraper.js';
import { ParsedRecipeData, RawScrapedRecipe } from '../shared/types.js';
import { SocialMediaScraper } from './SocialMediaScraper.js';

export interface ScrapingResult {
  success: boolean;
  recipe: RawScrapedRecipe | null;
  source: 'website' | 'instagram' | 'tiktok' | 'youtube';
  error?: string;
  processingTime: number;
}

export class UnifiedScraper {
  private socialMediaScraper: SocialMediaScraper;

  constructor() {
    this.socialMediaScraper = new SocialMediaScraper({
      enableTranscription: true,
      enableOCR: true,
      maxRetries: 3,
      timeoutMs: 30000
    });
  }

  /*
   * Scrape recipe from any supported URL
   */
  async scrapeRecipe(url: string): Promise<ScrapingResult> {
    const startTime = Date.now();
    
    try {
      console.log(`🔍 Scraping recipe from: ${url}`);
      
      const source = this.detectSource(url);
      let recipe: RawScrapedRecipe | null = null;
      
      switch (source) {
        case 'website':
          recipe = await this.scrapeWebsite(url);
          break;
        case 'instagram':
        case 'tiktok':
        case 'youtube':
          recipe = await this.socialMediaScraper.scrapeRecipe(url);
          break;
        default:
          throw new Error(`Unsupported URL format: ${url}`);
      }
      
      const processingTime = Date.now() - startTime;
      
      if (recipe) {
        console.log(`✅ Successfully scraped ${source} recipe: ${recipe.title} (${processingTime}ms)`);
        return {
          success: true,
          recipe,
          source,
          processingTime
        };
      } else {
        throw new Error('Failed to extract recipe data');
      }
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      console.error(`❌ Failed to scrape ${url}: ${errorMessage} (${processingTime}ms)`);
      
      return {
        success: false,
        recipe: null,
        source: this.detectSource(url),
        error: errorMessage,
        processingTime
      };
    }
  }

  /*
   * Scrape multiple URLs in parallel
   */
  async scrapeMultiple(urls: string[], maxConcurrency: number = 5): Promise<ScrapingResult[]> {
    console.log(`🚀 Scraping ${urls.length} URLs with max concurrency: ${maxConcurrency}`);
    
    const results: ScrapingResult[] = [];
    const batches = this.chunkArray(urls, maxConcurrency);
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`📦 Processing batch ${i + 1}/${batches.length} (${batch.length} URLs)`);
      
      const batchPromises = batch.map(url => this.scrapeRecipe(url));
      const batchResults = await Promise.allSettled(batchPromises);
      
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({
            success: false,
            recipe: null,
            source: 'website',
            error: result.reason?.message || 'Promise rejected',
            processingTime: 0
          });
        }
      }
      
      // Brief pause between batches
      if (i < batches.length - 1) {
        await this.sleep(1000);
      }
    }
    
    this.logScrapingStats(results);
    return results;
  }

  /*
   * Detect source type from URL
   */
  private detectSource(url: string): 'website' | 'instagram' | 'tiktok' | 'youtube' {
    if (url.includes('instagram.com') || url.includes('instagr.am')) {
      return 'instagram';
    }
    if (url.includes('tiktok.com') || url.includes('vm.tiktok.com')) {
      return 'tiktok';
    }
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      return 'youtube';
    }
    return 'website';
  }

  /*
   * Scrape website using existing websiteScraper
   */
  private async scrapeWebsite(url: string): Promise<RawScrapedRecipe | null> {
    try {
      const parsedRecipe = await scrapeWebsite(url);
      
      // Ensure recipe has source_url
      if (parsedRecipe && !parsedRecipe.source_url) {
        parsedRecipe.source_url = url;
      }
      
      // Convert ParsedRecipeData to RawScrapedRecipe
      if (parsedRecipe) {
        // Convert structured ingredients to string array for RawScrapedRecipe
        const ingredientsAsStrings = parsedRecipe.ingredients.map((ing: any) => 
          typeof ing === 'object' && ing && 'name' in ing ? String(ing.name || ing.text || ing) : String(ing)
        );
        
        // Convert structured instructions to string array for RawScrapedRecipe
        const instructionsAsStrings = parsedRecipe.instructions.map((inst: any) => 
          typeof inst === 'object' && inst && 'text' in inst ? String(inst.text || inst.instruction || inst) : String(inst)
        );
        
        // Create a RawScrapedRecipe from the ParsedRecipeData
        const rawRecipe: RawScrapedRecipe = {
          ...parsedRecipe,
          ingredients: ingredientsAsStrings,
          instructions: instructionsAsStrings,
          servings: parsedRecipe.servings || undefined,
        };
        
        return rawRecipe;
      }
      
      return null;
    } catch (error) {
      console.error(`❌ Website scraping failed for ${url}:`, error);
      return null;
    }
  }

  /*
   * Log scraping statistics
   */
  private logScrapingStats(results: ScrapingResult[]): void {
    const total = results.length;
    const successful = results.filter(r => r.success).length;
    const failed = total - successful;
    
    const sourceStats = results.reduce((acc, result) => {
      acc[result.source] = (acc[result.source] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const avgProcessingTime = results.reduce((sum, r) => sum + r.processingTime, 0) / total;
    
    console.log('\n📊 SCRAPING STATISTICS:');
    console.log(`📈 Total URLs: ${total}`);
    console.log(`✅ Successful: ${successful} (${((successful / total) * 100).toFixed(1)}%)`);
    console.log(`❌ Failed: ${failed} (${((failed / total) * 100).toFixed(1)}%)`);
    console.log(`⚡ Average Processing Time: ${avgProcessingTime.toFixed(0)}ms`);
    
    console.log('\n📱 Source Breakdown:');
    Object.entries(sourceStats).forEach(([source, count]) => {
      console.log(`   ${source}: ${count} URLs`);
    });
    
    if (failed > 0) {
      console.log('\n🚨 Common Errors:');
      const errors = results
        .filter(r => !r.success && r.error)
        .map(r => r.error!)
        .reduce((acc, error) => {
          acc[error] = (acc[error] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
      
      Object.entries(errors)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .forEach(([error, count]) => {
          console.log(`   ${count}x: ${error}`);
        });
    }
  }

  /*
   * Validate scraped recipe meets minimum requirements
   */
  validateRecipe(recipe: RawScrapedRecipe): boolean {
    if (!recipe.title || recipe.title.trim().length === 0) return false;
    if (!recipe.ingredients || recipe.ingredients.length === 0) return false;
    if (!recipe.instructions || recipe.instructions.length === 0) return false;
    if (!recipe.source_url) return false;
    
    return true;
  }

  /*
   * Get supported platforms
   */
  getSupportedPlatforms(): string[] {
    return ['websites', 'instagram', 'tiktok', 'youtube'];
  }

  /*
   * Check if URL is supported
   */
  isUrlSupported(url: string): boolean {
    try {
      new URL(url); // Validate URL format
      const source = this.detectSource(url);
      return ['website', 'instagram', 'tiktok', 'youtube'].includes(source);
    } catch {
      return false;
    }
  }

  /*
   * Utility: Split array into chunks
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /*
   * Utility: Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
