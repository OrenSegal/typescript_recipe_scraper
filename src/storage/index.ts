/**
 * Cloud Storage Module - Main Export
 * Cloudflare R2 + Supabase PostgreSQL Architecture
 */

// Core Services
export { CloudStorageService } from './CloudStorageService.js';
export { ImageOptimizationService } from './ImageOptimizationService.js';
export { RecipeImageService } from './RecipeImageService.js';

// Integration
export {
  RecipeScraperIntegration,
  uploadRecipeImage,
  type ScrapedRecipe,
  type ProcessedRecipe,
} from './RecipeScraperIntegration.js';

// Configuration
export {
  loadCloudStorageConfig,
  getSupabaseConfig,
  validateStorageConfig,
  printConfigSummary,
} from './config.js';

// Types
export type {
  ImageUploadOptions,
  ImageUploadResult,
  ImageMetadata,
  CloudStorageConfig,
  ThumbnailSize,
  StorageStats,
} from './types.js';

export { DEFAULT_THUMBNAIL_SIZES } from './types.js';

/**
 * Quick Start Example:
 *
 * ```typescript
 * import { RecipeScraperIntegration } from './storage';
 *
 * const integration = new RecipeScraperIntegration();
 *
 * // Process a scraped recipe
 * const result = await integration.processRecipeImages({
 *   id: 'recipe-123',
 *   title: 'Delicious Pasta',
 *   imageUrl: 'https://example.com/pasta.jpg'
 * });
 *
 * console.log('WebP URL:', result.processedImages.primary?.webpUrl);
 * ```
 *
 * Or use the simple helper:
 *
 * ```typescript
 * import { uploadRecipeImage } from './storage';
 *
 * const result = await uploadRecipeImage(
 *   'https://example.com/image.jpg',
 *   'recipe-123',
 *   'Recipe Title'
 * );
 * ```
 */
