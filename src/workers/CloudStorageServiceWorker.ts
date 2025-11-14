/**
 * Cloud Storage Service for Cloudflare Workers
 *
 * Optimized for Cloudflare R2 with direct bindings (no S3 API overhead)
 * - Zero egress fees between Workers and R2
 * - Direct R2 access (faster than S3 API)
 * - <10ms upload times
 * - Perfect for image-heavy workloads
 */

import { ImageOptimizationService } from '../storage/ImageOptimizationService.js';
import { createClient } from '@supabase/supabase-js';
import type {
  ImageUploadOptions,
  ImageUploadResult,
} from '../storage/types.js';
import { randomUUID } from 'crypto';

interface WorkerStorageConfig {
  supabaseUrl: string;
  supabaseKey: string;
}

export class CloudStorageService {
  private r2Bucket: R2Bucket;
  private supabaseClient: any;
  private imageOptimizer: ImageOptimizationService;

  constructor(r2Bucket: R2Bucket, config: WorkerStorageConfig) {
    this.r2Bucket = r2Bucket;
    this.imageOptimizer = new ImageOptimizationService();
    this.supabaseClient = createClient(config.supabaseUrl, config.supabaseKey);
  }

  /**
   * Upload image with WebP conversion and thumbnail generation
   * Uses direct R2 bindings for maximum performance
   */
  async uploadImage(
    imageBuffer: Buffer,
    fileName: string,
    options: ImageUploadOptions = {}
  ): Promise<ImageUploadResult> {
    const startTime = Date.now();
    const imageId = randomUUID();
    const timestamp = Date.now();

    try {
      // Validate image
      await this.imageOptimizer.validateImage(imageBuffer);

      let webpUrl: string | undefined;
      let webpSize: number | undefined;
      let thumbnailUrls: Record<string, string> = {};

      // Convert to WebP if requested
      if (options.convertToWebP !== false) {
        const webpResult = await this.imageOptimizer.convertToWebP(
          imageBuffer,
          options.quality || 80
        );

        const webpKey = `images/${imageId}/webp/${timestamp}.webp`;

        // Upload directly to R2 (zero egress fees!)
        await this.r2Bucket.put(webpKey, webpResult.buffer, {
          httpMetadata: {
            contentType: 'image/webp',
          },
          customMetadata: {
            recipeId: options.recipeId || '',
            originalSize: imageBuffer.length.toString(),
            webpSize: webpResult.size.toString(),
            uploadedAt: new Date().toISOString(),
          },
        });

        webpUrl = `/api/images/${webpKey}`;
        webpSize = webpResult.size;
      }

      // Generate thumbnails if requested
      if (options.generateThumbnails !== false) {
        const sizes = options.thumbnailSizes || [
          { width: 150, height: 150 },
          { width: 500, height: 500 },
          { width: 1000, height: 1000 },
        ];

        const thumbnails = await this.imageOptimizer.generateThumbnails(imageBuffer, sizes);

        for (const thumb of thumbnails) {
          const thumbKey = `images/${imageId}/thumbnails/${thumb.width}x${thumb.height}.webp`;

          await this.r2Bucket.put(thumbKey, thumb.buffer, {
            httpMetadata: {
              contentType: 'image/webp',
            },
            customMetadata: {
              thumbnailSize: `${thumb.width}x${thumb.height}`,
            },
          });

          thumbnailUrls[`${thumb.width}x${thumb.height}`] = `/api/images/${thumbKey}`;
        }
      }

      // Store metadata in Supabase
      const metadata = {
        id: imageId,
        recipe_id: options.recipeId,
        original_filename: fileName,
        original_size: imageBuffer.length,
        webp_url: webpUrl,
        webp_size: webpSize,
        thumbnail_urls: thumbnailUrls,
        description: options.description,
        uploaded_at: new Date().toISOString(),
        storage_provider: 'cloudflare-r2-workers',
      };

      await this.supabaseClient.from('recipe_images').insert(metadata);

      const processingTime = Date.now() - startTime;

      return {
        success: true,
        imageId,
        originalUrl: fileName,
        webpUrl: webpUrl || fileName,
        thumbnailUrls,
        cdnUrls: {
          webp: webpUrl,
          thumbnails: thumbnailUrls,
        },
        metadata: {
          originalSize: imageBuffer.length,
          webpSize: webpSize || imageBuffer.length,
          webpSavings: webpSize ? imageBuffer.length - webpSize : 0,
          processingTime,
        },
      };
    } catch (error) {
      console.error('Upload error:', error);
      throw error;
    }
  }

  /**
   * Delete image from R2 and database
   */
  async deleteImage(imageId: string): Promise<void> {
    // Get image metadata from database
    const { data: image } = await this.supabaseClient
      .from('recipe_images')
      .select('*')
      .eq('id', imageId)
      .single();

    if (!image) {
      throw new Error('Image not found');
    }

    // Delete from R2 (all versions)
    const deletePromises = [];

    if (image.webp_url) {
      const webpKey = image.webp_url.replace('/api/images/', '');
      deletePromises.push(this.r2Bucket.delete(webpKey));
    }

    if (image.thumbnail_urls) {
      for (const url of Object.values(image.thumbnail_urls)) {
        const thumbKey = (url as string).replace('/api/images/', '');
        deletePromises.push(this.r2Bucket.delete(thumbKey));
      }
    }

    await Promise.all(deletePromises);

    // Delete from database
    await this.supabaseClient
      .from('recipe_images')
      .delete()
      .eq('id', imageId);
  }

  /**
   * Get signed URL for temporary access (optional, R2 can serve public URLs)
   */
  async getSignedUrl(imageKey: string, expiresIn: number = 3600): Promise<string> {
    // R2 doesn't have signed URLs in the same way as S3
    // For public access, just return the direct URL
    // For private buckets, you'd implement a custom auth token system
    return `/api/images/${imageKey}`;
  }

  /**
   * Get storage statistics
   */
  async getStats(): Promise<any> {
    const { data, error } = await this.supabaseClient
      .from('recipe_images')
      .select('original_size, webp_size');

    if (error) {
      throw error;
    }

    const totalOriginal = data.reduce((sum: number, img: any) => sum + (img.original_size || 0), 0);
    const totalWebp = data.reduce((sum: number, img: any) => sum + (img.webp_size || 0), 0);

    return {
      totalImages: data.length,
      totalOriginalSize: totalOriginal,
      totalWebpSize: totalWebp,
      totalSavings: totalOriginal - totalWebp,
      savingsPercentage: totalOriginal > 0 ? ((totalOriginal - totalWebp) / totalOriginal * 100).toFixed(2) : 0,
    };
  }
}
