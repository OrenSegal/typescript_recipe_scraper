/**
 * Image Handler - Cloud Storage Integration
 * Updated to use Cloudflare R2 + WebP conversion
 * Backward compatible with existing recipe scraper
 */

import { uploadRecipeImage } from './index.js';
import { config } from '../config.js';

/**
 * Process and upload image with automatic WebP conversion and CDN delivery
 * @param imageUrl The original public URL of the image
 * @param recipeId The UUID of the recipe
 * @returns The CDN URL of the processed image (WebP format)
 */
export async function processAndUploadImage(
  imageUrl: string,
  recipeId: string
): Promise<string | null> {
  if (!imageUrl) {
    console.log('[Image] No image URL provided, skipping.');
    return null;
  }

  // Handle non-string inputs gracefully
  if (typeof imageUrl !== 'string') {
    console.log(`[Image] Invalid image URL type: ${typeof imageUrl}, trying to extract URL property`);
    const imgObj = imageUrl as any;
    if (
      typeof imgObj === 'object' &&
      imgObj !== null &&
      'url' in imgObj &&
      typeof imgObj.url === 'string'
    ) {
      imageUrl = imgObj.url;
    } else {
      console.error(`[Image] Failed to extract valid URL from ${JSON.stringify(imageUrl)}`);
      return null;
    }
  }

  try {
    console.log(`[Image] Processing image for recipe ${recipeId}: ${imageUrl}`);

    // Use our new cloud storage integration
    // Automatically handles:
    // - Image download
    // - WebP conversion (50-70% size reduction)
    // - Thumbnail generation (150px, 500px, 1000px)
    // - Upload to Cloudflare R2
    // - CDN delivery
    // - Metadata storage in Supabase
    const result = await uploadRecipeImage(imageUrl, recipeId, 'Recipe Image');

    // Return the CDN WebP URL (best performance)
    const finalUrl =
      result.cdnUrls?.webp || result.webpUrl || result.originalUrl;

    console.log(`[Image] Successfully processed and uploaded to cloud storage`);
    console.log(`[Image] Original URL: ${imageUrl}`);
    console.log(`[Image] CDN WebP URL: ${finalUrl}`);
    console.log(
      `[Image] File size: ${formatBytes(result.metadata.size)} (WebP optimized)`
    );
    console.log(`[Image] Processing time: ${result.processingTime}ms`);

    if (result.thumbnails) {
      console.log(`[Image] Thumbnails generated:`);
      console.log(`  - Small (150px): ${result.thumbnails.small}`);
      console.log(`  - Medium (500px): ${result.thumbnails.medium}`);
      console.log(`  - Large (1000px): ${result.thumbnails.large}`);
    }

    return finalUrl;
  } catch (error) {
    console.error(`[Image] Failed to process image from ${imageUrl}:`, error);

    // Fallback: Try to use original URL directly
    console.log(`[Image] Attempting fallback to original URL...`);
    try {
      const response = await fetch(imageUrl, { method: 'HEAD' });
      if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.startsWith('image/')) {
          console.log(`[Image] Fallback successful, using original URL: ${imageUrl}`);
          return imageUrl;
        }
      }
    } catch (fallbackError) {
      console.error(`[Image] Fallback also failed:`, fallbackError);
    }

    return null;
  }
}

/**
 * Check if a URL is directly accessible as an image resource
 * @param url The URL to check
 * @returns True if the URL is accessible as an image
 */
export async function isDirectlyAccessibleImage(url: string): Promise<boolean> {
  if (!url || typeof url !== 'string') {
    return false;
  }

  try {
    const response = await fetch(url, { method: 'HEAD' });
    if (!response.ok) return false;

    const contentType = response.headers.get('content-type');
    return !!contentType && contentType.startsWith('image/');
  } catch (error) {
    return false;
  }
}

// Helper function
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}
