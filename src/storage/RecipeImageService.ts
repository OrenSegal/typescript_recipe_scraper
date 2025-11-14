/**
 * Recipe Image Service
 * High-level service that integrates CloudStorageService with database
 */

import { CloudStorageService } from './CloudStorageService.js';
import { ImageUploadOptions, ImageUploadResult, CloudStorageConfig } from './types.js';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface RecipeImageRecord {
  id: string;
  recipeId?: string;
  userId?: string;
  originalUrl: string;
  webpUrl?: string;
  thumbnailSmallUrl?: string;
  thumbnailMediumUrl?: string;
  thumbnailLargeUrl?: string;
  cdnOriginalUrl?: string;
  cdnWebpUrl?: string;
  width: number;
  height: number;
  fileSize: number;
  format: string;
  mimeType: string;
  storageProvider: string;
  storageBucket: string;
  storageKey: string;
  processingTimeMs?: number;
  webpSavingsBytes?: number;
  quality?: number;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export class RecipeImageService {
  private storageService: CloudStorageService;
  private supabaseClient?: SupabaseClient;

  constructor(
    storageConfig: CloudStorageConfig,
    supabaseUrl?: string,
    supabaseKey?: string
  ) {
    this.storageService = new CloudStorageService(storageConfig);

    // Initialize Supabase if credentials provided
    if (supabaseUrl && supabaseKey) {
      this.supabaseClient = createClient(supabaseUrl, supabaseKey);
    }
  }

  /**
   * Upload image and save metadata to database
   */
  async uploadRecipeImage(
    options: ImageUploadOptions
  ): Promise<{
    uploadResult: ImageUploadResult;
    databaseRecord?: RecipeImageRecord;
  }> {
    try {
      // 1. Upload to cloud storage
      const uploadResult = await this.storageService.uploadImage(options);

      // 2. Save metadata to database (if Supabase is configured)
      let databaseRecord: RecipeImageRecord | undefined;

      if (this.supabaseClient) {
        databaseRecord = await this.saveImageMetadata(uploadResult, options);
      }

      return {
        uploadResult,
        databaseRecord,
      };
    } catch (error) {
      throw new Error(`Failed to upload recipe image: ${error}`);
    }
  }

  /**
   * Save image metadata to database
   */
  private async saveImageMetadata(
    uploadResult: ImageUploadResult,
    options: ImageUploadOptions
  ): Promise<RecipeImageRecord> {
    if (!this.supabaseClient) {
      throw new Error('Supabase client not initialized');
    }

    // Calculate WebP savings
    const webpSavingsBytes = uploadResult.webpUrl
      ? this.estimateWebPSavings(uploadResult.metadata.size)
      : 0;

    const record = {
      recipe_id: options.recipeId,
      user_id: options.userId,
      original_url: uploadResult.originalUrl,
      webp_url: uploadResult.webpUrl,
      thumbnail_small_url: uploadResult.thumbnails?.small,
      thumbnail_medium_url: uploadResult.thumbnails?.medium,
      thumbnail_large_url: uploadResult.thumbnails?.large,
      cdn_original_url: uploadResult.cdnUrls?.original,
      cdn_webp_url: uploadResult.cdnUrls?.webp,
      width: uploadResult.metadata.width,
      height: uploadResult.metadata.height,
      file_size: uploadResult.metadata.size,
      format: uploadResult.metadata.format,
      mime_type: uploadResult.metadata.mimeType,
      storage_provider: uploadResult.storage.provider,
      storage_bucket: uploadResult.storage.bucket,
      storage_key: uploadResult.storage.key,
      processing_time_ms: uploadResult.processingTime,
      webp_savings_bytes: webpSavingsBytes,
      quality: options.quality,
      metadata: options.metadata,
    };

    const { data, error } = await this.supabaseClient
      .from('recipe_images')
      .insert(record)
      .select()
      .single();

    if (error) {
      console.error('Failed to save image metadata:', error);
      throw new Error(`Database insert failed: ${error.message}`);
    }

    return this.mapToRecipeImageRecord(data);
  }

  /**
   * Get all images for a recipe
   */
  async getRecipeImages(recipeId: string): Promise<RecipeImageRecord[]> {
    if (!this.supabaseClient) {
      throw new Error('Supabase client not initialized');
    }

    const { data, error } = await this.supabaseClient
      .from('recipe_images')
      .select('*')
      .eq('recipe_id', recipeId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch images: ${error.message}`);
    }

    return (data || []).map(this.mapToRecipeImageRecord);
  }

  /**
   * Delete image (from storage and database)
   */
  async deleteRecipeImage(imageId: string): Promise<void> {
    if (!this.supabaseClient) {
      throw new Error('Supabase client not initialized');
    }

    // 1. Get image record
    const { data: image, error: fetchError } = await this.supabaseClient
      .from('recipe_images')
      .select('*')
      .eq('id', imageId)
      .single();

    if (fetchError) {
      throw new Error(`Failed to fetch image: ${fetchError.message}`);
    }

    if (!image) {
      throw new Error(`Image not found: ${imageId}`);
    }

    // 2. Delete from storage
    try {
      await this.storageService.deleteImage(image.storage_key);

      // Also delete thumbnails if they exist
      if (image.thumbnail_small_url) {
        const smallKey = this.extractKeyFromUrl(image.thumbnail_small_url);
        await this.storageService.deleteImage(smallKey);
      }
      if (image.thumbnail_medium_url) {
        const mediumKey = this.extractKeyFromUrl(image.thumbnail_medium_url);
        await this.storageService.deleteImage(mediumKey);
      }
      if (image.thumbnail_large_url) {
        const largeKey = this.extractKeyFromUrl(image.thumbnail_large_url);
        await this.storageService.deleteImage(largeKey);
      }
    } catch (error) {
      console.error('Failed to delete from storage:', error);
      // Continue to delete from database even if storage deletion fails
    }

    // 3. Delete from database
    const { error: deleteError } = await this.supabaseClient
      .from('recipe_images')
      .delete()
      .eq('id', imageId);

    if (deleteError) {
      throw new Error(`Failed to delete from database: ${deleteError.message}`);
    }
  }

  /**
   * Get storage statistics
   */
  async getStorageStatistics(): Promise<{
    provider: string;
    totalImages: number;
    totalSizeBytes: number;
    avgSizeBytes: number;
    totalWebpSavingsBytes: number;
    webpConversions: number;
    avgProcessingTimeMs: number;
  }[]> {
    if (!this.supabaseClient) {
      throw new Error('Supabase client not initialized');
    }

    const { data, error } = await this.supabaseClient
      .from('storage_statistics')
      .select('*');

    if (error) {
      throw new Error(`Failed to fetch statistics: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Download image from URL and upload to storage
   * Useful for scraping recipe images
   */
  async uploadFromUrl(
    imageUrl: string,
    options: Omit<ImageUploadOptions, 'file' | 'filename'>
  ): Promise<{
    uploadResult: ImageUploadResult;
    databaseRecord?: RecipeImageRecord;
  }> {
    try {
      // Download image
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Extract filename from URL
      const url = new URL(imageUrl);
      const filename = url.pathname.split('/').pop() || 'image.jpg';

      // Upload
      return await this.uploadRecipeImage({
        ...options,
        file: buffer,
        filename,
        metadata: {
          ...options.metadata,
          sourceUrl: imageUrl,
        },
      });
    } catch (error) {
      throw new Error(`Failed to upload from URL: ${error}`);
    }
  }

  // Helper methods

  private mapToRecipeImageRecord(data: any): RecipeImageRecord {
    return {
      id: data.id,
      recipeId: data.recipe_id,
      userId: data.user_id,
      originalUrl: data.original_url,
      webpUrl: data.webp_url,
      thumbnailSmallUrl: data.thumbnail_small_url,
      thumbnailMediumUrl: data.thumbnail_medium_url,
      thumbnailLargeUrl: data.thumbnail_large_url,
      cdnOriginalUrl: data.cdn_original_url,
      cdnWebpUrl: data.cdn_webp_url,
      width: data.width,
      height: data.height,
      fileSize: data.file_size,
      format: data.format,
      mimeType: data.mime_type,
      storageProvider: data.storage_provider,
      storageBucket: data.storage_bucket,
      storageKey: data.storage_key,
      processingTimeMs: data.processing_time_ms,
      webpSavingsBytes: data.webp_savings_bytes,
      quality: data.quality,
      metadata: data.metadata,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }

  private estimateWebPSavings(webpSize: number): number {
    // WebP typically saves 50-70% compared to JPEG
    // Estimate original JPEG size
    const estimatedOriginalSize = webpSize / 0.4; // Assuming 60% savings
    return Math.round(estimatedOriginalSize - webpSize);
  }

  private extractKeyFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.pathname.substring(1); // Remove leading slash
    } catch {
      return url; // If not a valid URL, return as-is
    }
  }
}
