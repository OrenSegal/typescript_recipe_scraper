/*
 * BatchRecipeProcessor.ts
 * Processes recipes in batches, collects stats, and manages a QA feedback loop
 */
import { scrapeWebsite } from '../scrapers/websiteScraper.js';
import pLimit from 'p-limit';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { RecipeProcessor } from '../core/RecipeProcessor.js';
const sleep = promisify(setTimeout);
export class BatchRecipeProcessor {
    options;
    constructor(options = {}) {
        this.options = {
            maxConcurrency: options.maxConcurrency || 10,
            delay: options.delay || 200,
            batchSize: options.batchSize || 100,
            qaLogPath: options.qaLogPath || './qa_log.json'
        };
    }
    /*
     * Process a list of recipe URLs in batches
     */
    async processUrls(urls) {
        const startTime = Date.now();
        let totalProcessed = 0;
        let successful = 0;
        let failed = 0;
        const errors = [];
        const successfulRecipes = [];
        console.log(`🚀 Starting batch processing of ${urls.length} URLs...`);
        const limit = pLimit(this.options.maxConcurrency);
        for (let i = 0; i < urls.length; i += this.options.batchSize) {
            const batch = urls.slice(i, i + this.options.batchSize);
            console.log(`Processing batch ${i / this.options.batchSize + 1} of ${Math.ceil(urls.length / this.options.batchSize)}...`);
            await Promise.all(batch.map(url => limit(async () => {
                try {
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
                        ingredients: parsedRecipeData.ingredients.map(ing => typeof ing === 'object' && ing && 'text' in ing ? String(ing.text) : String(ing)).filter(text => text && text.length > 0),
                        // Convert structured instructions back to raw strings  
                        instructions: parsedRecipeData.instructions.map(inst => typeof inst === 'object' && inst && 'text' in inst ? String(inst.text) : String(inst)).filter(text => text && text.length > 0),
                        author: parsedRecipeData.author
                    };
                    const recipeProcessor = RecipeProcessor.getInstance();
                    const { recipe: enrichedRecipe } = await recipeProcessor.processRecipe(rawRecipe, url);
                    // Basic QA check
                    if (this.isRecipeValid(enrichedRecipe)) {
                        successful++;
                        successfulRecipes.push(enrichedRecipe);
                    }
                    else {
                        failed++;
                        const errorMsg = 'QA validation failed: Missing critical data';
                        errors.push({ url, error: errorMsg });
                        this.logForQA(url, enrichedRecipe, errorMsg);
                    }
                }
                catch (error) {
                    const err = error;
                    failed++;
                    errors.push({ url, error: err.message });
                    this.logForQA(url, null, err.message);
                }
                totalProcessed++;
                await sleep(this.options.delay);
            })));
            console.log(`Batch ${i / this.options.batchSize + 1} complete. Progress: ${totalProcessed}/${urls.length}`);
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
    isRecipeValid(recipe) {
        // Must have a title, at least one ingredient, and at least one instruction
        return !!recipe.title &&
            recipe.ingredients.length > 0 &&
            recipe.instructions.length > 0;
    }
    /*
     * Log failed recipes for manual review and QA
     */
    async logForQA(url, recipe, error) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            url,
            error,
            parsedData: recipe
        };
        try {
            await fs.promises.appendFile(path.resolve(this.options.qaLogPath), JSON.stringify(logEntry) + '\n');
        }
        catch (err) {
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
