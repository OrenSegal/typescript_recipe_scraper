/**
 * Recipe Scraper Integration
 * Seamlessly integrates cloud storage with recipe scraping
 */

import { RecipeImageService } from './RecipeImageService.js';
import { loadCloudStorageConfig, getSupabaseConfig } from './config.js';
import { ImageUploadResult } from './types.js';

export interface ScrapedRecipe {
  id?: string;
  title: string;
  imageUrl?: string;
  images?: string[];
  [key: string]: any;
}

export interface ProcessedRecipe extends ScrapedRecipe {
  processedImages: {
    primary?: ImageUploadResult;
    gallery?: ImageUploadResult[];
  };
  metadata: {
    originalImageCount: number;
    uploadedImageCount: number;
    totalProcessingTime: number;
    webpSavings?: number;
  };
}

export class RecipeScraperIntegration {
  private imageService: RecipeImageService;

  constructor() {
    // Load configuration from environment
    const storageConfig = loadCloudStorageConfig();
    const supabaseConfig = getSupabaseConfig();

    // Initialize image service
    this.imageService = new RecipeImageService(
      storageConfig,
      supabaseConfig.url,
      supabaseConfig.serviceKey
    );
  }

  /**
   * Process a scraped recipe and upload its images
   */
  async processRecipeImages(recipe: ScrapedRecipe): Promise<ProcessedRecipe> {
    const startTime = Date.now();
    const processedRecipe: ProcessedRecipe = {
      ...recipe,
      processedImages: {},
      metadata: {
        originalImageCount: 0,
        uploadedImageCount: 0,
        totalProcessingTime: 0,
      },
    };

    try {
      // Process primary image
      if (recipe.imageUrl) {
        processedRecipe.metadata.originalImageCount++;

        try {
          const result = await this.imageService.uploadFromUrl(recipe.imageUrl, {
            recipeId: recipe.id,
            convertToWebP: true,
            generateThumbnails: true,
            metadata: {
              recipeTitle: recipe.title,
              type: 'primary',
            },
          });

          processedRecipe.processedImages.primary = result.uploadResult;
          processedRecipe.metadata.uploadedImageCount++;
          processedRecipe.metadata.webpSavings =
            (processedRecipe.metadata.webpSavings || 0) +
            this.estimateWebPSavings(result.uploadResult.metadata.size);

          // Update recipe with new image URL (prefer WebP)
          processedRecipe.imageUrl =
            result.uploadResult.cdnUrls?.webp ||
            result.uploadResult.webpUrl ||
            result.uploadResult.originalUrl;

          console.log(`✅ Uploaded primary image for: ${recipe.title}`);
        } catch (error) {
          console.error(`❌ Failed to upload primary image:`, error);
          // Keep original URL if upload fails
        }
      }

      // Process gallery images
      if (recipe.images && recipe.images.length > 0) {
        processedRecipe.metadata.originalImageCount += recipe.images.length;
        processedRecipe.processedImages.gallery = [];

        for (let i = 0; i < recipe.images.length; i++) {
          const imageUrl = recipe.images[i];

          try {
            const result = await this.imageService.uploadFromUrl(imageUrl, {
              recipeId: recipe.id,
              convertToWebP: true,
              generateThumbnails: true,
              metadata: {
                recipeTitle: recipe.title,
                type: 'gallery',
                index: i.toString(),
              },
            });

            processedRecipe.processedImages.gallery.push(result.uploadResult);
            processedRecipe.metadata.uploadedImageCount++;
            processedRecipe.metadata.webpSavings =
              (processedRecipe.metadata.webpSavings || 0) +
              this.estimateWebPSavings(result.uploadResult.metadata.size);

            console.log(
              `✅ Uploaded gallery image ${i + 1}/${recipe.images.length} for: ${recipe.title}`
            );
          } catch (error) {
            console.error(`❌ Failed to upload gallery image ${i + 1}:`, error);
            // Continue with other images
          }
        }

        // Update recipe with new gallery URLs (prefer WebP)
        processedRecipe.images = processedRecipe.processedImages.gallery.map(
          (img) => img.cdnUrls?.webp || img.webpUrl || img.originalUrl
        );
      }

      processedRecipe.metadata.totalProcessingTime = Date.now() - startTime;

      return processedRecipe;
    } catch (error) {
      console.error(`❌ Error processing recipe images:`, error);
      throw error;
    }
  }

  /**
   * Batch process multiple recipes
   */
  async processBatch(
    recipes: ScrapedRecipe[],
    options: {
      concurrency?: number;
      onProgress?: (processed: number, total: number) => void;
    } = {}
  ): Promise<ProcessedRecipe[]> {
    const { concurrency = 3, onProgress } = options;
    const results: ProcessedRecipe[] = [];
    let processed = 0;

    console.log(`\n📦 Processing ${recipes.length} recipes with concurrency ${concurrency}\n`);

    // Process in batches
    for (let i = 0; i < recipes.length; i += concurrency) {
      const batch = recipes.slice(i, i + concurrency);

      const batchResults = await Promise.allSettled(
        batch.map((recipe) => this.processRecipeImages(recipe))
      );

      for (const result of batchResults) {
        processed++;

        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          console.error(`❌ Failed to process recipe:`, result.reason);
        }

        if (onProgress) {
          onProgress(processed, recipes.length);
        }
      }

      // Progress update
      console.log(
        `\n📊 Progress: ${processed}/${recipes.length} recipes processed\n`
      );
    }

    // Print summary
    this.printBatchSummary(results);

    return results;
  }

  /**
   * Get storage statistics for a recipe
   */
  async getRecipeImageStats(recipeId: string) {
    const images = await this.imageService.getRecipeImages(recipeId);

    const totalSize = images.reduce((sum, img) => sum + img.fileSize, 0);
    const totalSavings = images.reduce(
      (sum, img) => sum + (img.webpSavingsBytes || 0),
      0
    );

    return {
      count: images.length,
      totalSize,
      totalSavings,
      savingsPercentage: totalSavings > 0 ? (totalSavings / (totalSize + totalSavings)) * 100 : 0,
      images,
    };
  }

  /**
   * Clean up images for a deleted recipe
   */
  async deleteRecipeImages(recipeId: string): Promise<void> {
    const images = await this.imageService.getRecipeImages(recipeId);

    console.log(`🗑️  Deleting ${images.length} images for recipe ${recipeId}`);

    for (const image of images) {
      try {
        await this.imageService.deleteRecipeImage(image.id);
        console.log(`  ✅ Deleted: ${image.id}`);
      } catch (error) {
        console.error(`  ❌ Failed to delete ${image.id}:`, error);
      }
    }

    console.log(`✅ Cleanup complete for recipe ${recipeId}\n`);
  }

  // Helper methods

  private estimateWebPSavings(webpSize: number): number {
    // WebP typically saves 50-70% compared to JPEG
    // Estimate original JPEG size
    const estimatedOriginalSize = webpSize / 0.4; // Assuming 60% savings
    return Math.round(estimatedOriginalSize - webpSize);
  }

  private printBatchSummary(results: ProcessedRecipe[]): void {
    const totalImages = results.reduce(
      (sum, r) => sum + r.metadata.originalImageCount,
      0
    );
    const uploadedImages = results.reduce(
      (sum, r) => sum + r.metadata.uploadedImageCount,
      0
    );
    const totalSavings = results.reduce(
      (sum, r) => sum + (r.metadata.webpSavings || 0),
      0
    );
    const avgProcessingTime =
      results.reduce((sum, r) => sum + r.metadata.totalProcessingTime, 0) /
      results.length;

    console.log('\n╔══════════════════════════════════════════════╗');
    console.log('║         BATCH PROCESSING SUMMARY             ║');
    console.log('╚══════════════════════════════════════════════╝');
    console.log(`📊 Recipes processed: ${results.length}`);
    console.log(`🖼️  Total images: ${totalImages}`);
    console.log(`✅ Uploaded: ${uploadedImages}/${totalImages}`);
    console.log(`💾 WebP savings: ${this.formatBytes(totalSavings)}`);
    console.log(`⏱️  Avg processing time: ${Math.round(avgProcessingTime)}ms`);
    console.log('═══════════════════════════════════════════════\n');
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }
}

/**
 * Quick helper for recipe scraping workflows
 */
export async function uploadRecipeImage(
  imageUrl: string,
  recipeId: string,
  recipeTitle: string
): Promise<ImageUploadResult> {
  const integration = new RecipeScraperIntegration();
  const result = await integration.processRecipeImages({
    id: recipeId,
    title: recipeTitle,
    imageUrl,
  });

  if (!result.processedImages.primary) {
    throw new Error('Failed to upload recipe image');
  }

  return result.processedImages.primary;
}
