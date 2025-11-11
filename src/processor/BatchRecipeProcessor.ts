/*
 * BatchRecipeProcessor.ts
 * Processes recipes in batches, collects stats, and manages a QA feedback loop
 */

import { scrapeWebsite } from '../scrapers/websiteScraper.js';
import { Recipe } from '../types.js';
import pLimit from 'p-limit';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { RecipeProcessor } from '../core/RecipeProcessor.js';

const sleep = promisify(setTimeout);

export interface BatchOptions {
  maxConcurrency?: number;
  delay?: number;
  batchSize?: number;
  qaLogPath?: string;
}

export interface BatchResult {
  totalProcessed: number;
  successful: number;
  failed: number;
  successRate: number;
  processingTimeMs: number;
  errors: { url: string; error: string }[];
  successfulRecipes: Recipe[];
}

export class BatchRecipeProcessor {
  private options: Required<BatchOptions>;
  private siteLimiters: Map<string, any> = new Map();
  
  constructor(options: BatchOptions = {}) {
    this.options = {
      maxConcurrency: options.maxConcurrency || 5, // Reduced default concurrency
      delay: options.delay || 500, // Increased default delay
      batchSize: options.batchSize || 50, // Smaller default batch size
      qaLogPath: options.qaLogPath || './qa_log.json'
    };
  }
  
  /**
   * Get or create a rate limiter for a specific site
   */
  private getSiteLimiter(url: string): any {
    try {
      const hostname = new URL(url).hostname;
      
      if (!this.siteLimiters.has(hostname)) {
        // Import getSiteConfig dynamically
        const { getSiteConfig } = require('../utils/robustFetch.js');
        const siteConfig = getSiteConfig(url);
        
        // Use site-specific concurrency or fall back to default
        const concurrency = Math.min(
          siteConfig.maxConcurrency || 3,
          this.options.maxConcurrency
        );
        
        this.siteLimiters.set(hostname, pLimit(concurrency));
        console.log(`🔧 Created rate limiter for ${hostname} with concurrency: ${concurrency}`);
      }
      
      return this.siteLimiters.get(hostname);
    } catch (error) {
      console.warn(`⚠️ Could not create site-specific limiter for ${url}, using default`);
      return pLimit(2); // Conservative fallback
    }
  }
  
  /*
   * Process a list of recipe URLs in batches
   */
  async processUrls(urls: string[]): Promise<BatchResult> {
    const startTime = Date.now();
    let totalProcessed = 0;
    let successful = 0;
    let failed = 0;
    const errors: { url: string; error: string }[] = [];
    const successfulRecipes: Recipe[] = [];
    
    console.log(`🚀 Starting batch processing of ${urls.length} URLs...`);
    
    // Group URLs by domain for better rate limiting
    const urlsByDomain = new Map<string, string[]>();
    for (const url of urls) {
      try {
        const hostname = new URL(url).hostname;
        if (!urlsByDomain.has(hostname)) {
          urlsByDomain.set(hostname, []);
        }
        urlsByDomain.get(hostname)!.push(url);
      } catch (error) {
        console.warn(`⚠️ Invalid URL: ${url}`);
        errors.push({ url, error: 'Invalid URL format' });
      }
    }
    
    console.log(`📊 URLs distributed across ${urlsByDomain.size} domains`);
    for (const [domain, domainUrls] of urlsByDomain.entries()) {
      console.log(`  • ${domain}: ${domainUrls.length} URLs`);
    }
    
    // Process URLs with site-specific rate limiting
    for (let i = 0; i < urls.length; i += this.options.batchSize) {
      const batch = urls.slice(i, i + this.options.batchSize);
      console.log(`\n📦 Processing batch ${Math.floor(i / this.options.batchSize) + 1} of ${Math.ceil(urls.length / this.options.batchSize)}...`);
      
      await Promise.all(batch.map(url => {
        const siteLimiter = this.getSiteLimiter(url);
        return siteLimiter(async () => {
        try {
          console.log(`🔍 Processing: ${url}`);
          const parsedRecipeData = await scrapeWebsite(url);
          
          // Convert ParsedRecipeData to RawScrapedRecipe format for RecipeProcessor
          const rawRecipe = {
            title: parsedRecipeData.title,
            description: parsedRecipeData.description || '',
            source_url: url,
            image_url: parsedRecipeData.image_url,
            servings: parsedRecipeData.servings,
            prep_time_minutes: parsedRecipeData.prep_time_minutes,
            cook_time_minutes: parsedRecipeData.cook_time_minutes,
            total_time_minutes: parsedRecipeData.total_time_minutes,
            // Convert structured ingredients back to raw strings
            ingredients: parsedRecipeData.ingredients.map(ing => 
              typeof ing === 'object' && ing && 'text' in ing ? (ing as any).text : String(ing)
            ).filter(text => text && text.length > 0),
            // Convert structured instructions back to raw strings  
            instructions: parsedRecipeData.instructions.map(inst => 
              typeof inst === 'object' && inst && 'text' in inst ? (inst as any).text : String(inst)
            ).filter(text => text && text.length > 0),
            author: parsedRecipeData.author
          };
          
          const recipeProcessor = RecipeProcessor.getInstance();
          const { recipe: enrichedRecipe } = await recipeProcessor.processRecipe(rawRecipe, url);

          // Basic QA check
          if (this.isRecipeValid(enrichedRecipe)) {
            successful++;
            successfulRecipes.push(enrichedRecipe);
          } else {
            failed++;
            const errorMsg = 'QA validation failed: Missing critical data';
            errors.push({ url, error: errorMsg });
            this.logForQA(url, enrichedRecipe, errorMsg);
          }
          
        } catch (error) {
          const err = error as Error;
          failed++;
          errors.push({ url, error: err.message });
          this.logForQA(url, null, err.message);
        }
        
        totalProcessed++;
        await sleep(this.options.delay);
      });
      }));
      
      console.log(`Batch ${Math.floor(i / this.options.batchSize) + 1} complete. Progress: ${totalProcessed}/${urls.length}`);
    }
    
    const processingTimeMs = Date.now() - startTime;
    const successRate = totalProcessed > 0 ? (successful / totalProcessed) * 100 : 0;
    
    console.log(`✅ Batch processing complete in ${processingTimeMs / 1000}s`);
    console.log(`📊 Stats: ${successful} successful, ${failed} failed (${successRate.toFixed(2)}% success rate)`);
    
    return {
      totalProcessed,
      successful,
      failed,
      successRate,
      processingTimeMs,
      errors,
      successfulRecipes
    };
  }
  
  /*
   * Basic validation to check if a parsed recipe is usable
   */
  private isRecipeValid(recipe: Recipe): boolean {
    // Must have a title, at least one ingredient, and at least one instruction
    return !!recipe.title && 
           recipe.ingredients.length > 0 && 
           recipe.instructions.length > 0;
  }
  
  /*
   * Log failed recipes for manual review and QA
   */
  private async logForQA(url: string, recipe: Recipe | null, error: string): Promise<void> {
    const logEntry = {
      timestamp: new Date().toISOString(),
      url,
      error,
      parsedData: recipe
    };
    
    try {
      await fs.promises.appendFile(
        path.resolve(this.options.qaLogPath),
        JSON.stringify(logEntry) + '\n'
      );
    } catch (err) {
      console.error(`❌ Failed to write to QA log:`, err);
    }
  }
}

// Example usage:
/*
const processor = new BatchRecipeProcessor();
const urls = ['url1', 'url2', ...];
const result = await processor.processUrls(urls);
console.log(result);
*/
