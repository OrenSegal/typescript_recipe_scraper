/**
 * Cloud Storage Service
 * Primary: Cloudflare R2 (S3-compatible)
 * Fallback: Supabase Storage
 * Optional: Firebase Storage
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createClient } from '@supabase/supabase-js';
import { ImageOptimizationService } from './ImageOptimizationService.js';
import {
  CloudStorageConfig,
  ImageUploadOptions,
  ImageUploadResult,
  ImageMetadata,
} from './types.js';
import { randomUUID } from 'crypto';
import path from 'path';

export class CloudStorageService {
  private r2Client?: S3Client;
  private supabaseClient?: any;
  private firebaseStorage?: any;
  private imageOptimizer: ImageOptimizationService;
  private config: CloudStorageConfig;

  constructor(config: CloudStorageConfig) {
    this.config = config;
    this.imageOptimizer = new ImageOptimizationService();

    // Initialize based on provider
    this.initializeProvider();
  }

  private initializeProvider(): void {
    switch (this.config.provider) {
      case 'cloudflare-r2':
        this.initializeR2();
        break;
      case 'supabase':
        this.initializeSupabase();
        break;
      case 'firebase':
        this.initializeFirebase();
        break;
    }
  }

  /**
   * Initialize Cloudflare R2 (S3-compatible)
   */
  private initializeR2(): void {
    if (!this.config.cloudflare) {
      throw new Error('Cloudflare R2 config is required');
    }

    const { accountId, accessKeyId, secretAccessKey, region = 'auto' } = this.config.cloudflare;

    this.r2Client = new S3Client({
      region,
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    console.log('✅ Cloudflare R2 initialized');
  }

  /**
   * Initialize Supabase Storage
   */
  private initializeSupabase(): void {
    if (!this.config.supabase) {
      throw new Error('Supabase config is required');
    }

    const { url, serviceKey } = this.config.supabase;

    this.supabaseClient = createClient(url, serviceKey);
    console.log('✅ Supabase Storage initialized');
  }

  /**
   * Initialize Firebase Storage
   */
  private initializeFirebase(): void {
    // Placeholder for Firebase implementation
    console.log('⚠️ Firebase Storage not implemented yet');
  }

  /**
   * Upload image with optimization and CDN integration
   */
  async uploadImage(options: ImageUploadOptions): Promise<ImageUploadResult> {
    const startTime = Date.now();

    try {
      // 1. Validate image
      const validation = await this.imageOptimizer.validateImage(
        options.file,
        this.config.settings.maxFileSize / (1024 * 1024)
      );

      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // 2. Get original metadata
      const originalMetadata = await this.imageOptimizer.getMetadata(options.file);

      // 3. Generate unique ID and paths
      const imageId = randomUUID();
      const basePath = this.generateBasePath(options.recipeId, options.userId);
      const ext = path.extname(options.filename);
      const name = path.basename(options.filename, ext);

      // 4. Convert to WebP (if enabled)
      let webpBuffer: Buffer | undefined;
      let webpUrl: string | undefined;

      if (
        this.config.settings.convertToWebP &&
        options.convertToWebP !== false
      ) {
        const webpResult = await this.imageOptimizer.convertToWebP(
          options.file,
          options.quality || this.config.settings.defaultQuality
        );
        webpBuffer = webpResult.buffer;

        // Upload WebP version
        const webpKey = `${basePath}/${imageId}_${name}.webp`;
        webpUrl = await this.uploadToProvider(
          webpBuffer,
          webpKey,
          'image/webp',
          options.metadata
        );
      }

      // 5. Upload original (optimized)
      const optimized = await this.imageOptimizer.optimizeImage(
        options.file,
        options.quality || this.config.settings.defaultQuality
      );
      const originalKey = `${basePath}/${imageId}_${name}${ext}`;
      const originalUrl = await this.uploadToProvider(
        optimized.buffer,
        originalKey,
        `image/${originalMetadata.format}`,
        options.metadata
      );

      // 6. Generate thumbnails (if enabled)
      let thumbnails:
        | {
            small: string;
            medium: string;
            large: string;
          }
        | undefined;

      if (
        this.config.settings.generateThumbnails &&
        options.generateThumbnails !== false
      ) {
        const thumbs = await this.imageOptimizer.generateThumbnails(
          webpBuffer || options.file
        );

        const smallKey = `${basePath}/thumbs/${imageId}_small.webp`;
        const mediumKey = `${basePath}/thumbs/${imageId}_medium.webp`;
        const largeKey = `${basePath}/thumbs/${imageId}_large.webp`;

        const [smallUrl, mediumUrl, largeUrl] = await Promise.all([
          this.uploadToProvider(thumbs.small.buffer, smallKey, 'image/webp'),
          this.uploadToProvider(thumbs.medium.buffer, mediumKey, 'image/webp'),
          this.uploadToProvider(thumbs.large.buffer, largeKey, 'image/webp'),
        ]);

        thumbnails = {
          small: smallUrl,
          medium: mediumUrl,
          large: largeUrl,
        };
      }

      // 7. Generate CDN URLs
      const cdnUrls = this.generateCDNUrls(originalUrl, webpUrl);

      const processingTime = Date.now() - startTime;

      return {
        success: true,
        originalUrl,
        webpUrl,
        thumbnails,
        cdnUrls,
        metadata: {
          size: optimized.size,
          width: originalMetadata.width,
          height: originalMetadata.height,
          format: originalMetadata.format,
          mimeType: `image/${originalMetadata.format}`,
        },
        storage: {
          provider: this.config.provider,
          bucket: this.getBucketName(),
          key: originalKey,
        },
        uploadedAt: new Date(),
        processingTime,
      };
    } catch (error) {
      throw new Error(`Image upload failed: ${error}`);
    }
  }

  /**
   * Upload to selected provider
   */
  private async uploadToProvider(
    buffer: Buffer,
    key: string,
    contentType: string,
    metadata?: Record<string, string>
  ): Promise<string> {
    switch (this.config.provider) {
      case 'cloudflare-r2':
        return this.uploadToR2(buffer, key, contentType, metadata);
      case 'supabase':
        return this.uploadToSupabase(buffer, key, contentType);
      case 'firebase':
        return this.uploadToFirebase(buffer, key, contentType);
      default:
        throw new Error(`Unsupported provider: ${this.config.provider}`);
    }
  }

  /**
   * Upload to Cloudflare R2
   */
  private async uploadToR2(
    buffer: Buffer,
    key: string,
    contentType: string,
    metadata?: Record<string, string>
  ): Promise<string> {
    if (!this.r2Client || !this.config.cloudflare) {
      throw new Error('R2 client not initialized');
    }

    const command = new PutObjectCommand({
      Bucket: this.config.cloudflare.bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      Metadata: metadata,
      CacheControl: 'public, max-age=31536000', // 1 year
    });

    await this.r2Client.send(command);

    // Generate public URL
    if (this.config.cloudflare.publicDomain) {
      return `https://${this.config.cloudflare.publicDomain}/${key}`;
    } else {
      // R2.dev URL (if custom domain not configured)
      return `https://pub-${this.config.cloudflare.accountId}.r2.dev/${key}`;
    }
  }

  /**
   * Upload to Supabase Storage
   */
  private async uploadToSupabase(
    buffer: Buffer,
    key: string,
    contentType: string
  ): Promise<string> {
    if (!this.supabaseClient || !this.config.supabase) {
      throw new Error('Supabase client not initialized');
    }

    const { data, error } = await this.supabaseClient.storage
      .from(this.config.supabase.bucket)
      .upload(key, buffer, {
        contentType,
        cacheControl: '31536000', // 1 year
        upsert: true,
      });

    if (error) {
      throw new Error(`Supabase upload failed: ${error.message}`);
    }

    // Get public URL
    const { data: publicUrlData } = this.supabaseClient.storage
      .from(this.config.supabase.bucket)
      .getPublicUrl(key);

    return publicUrlData.publicUrl;
  }

  /**
   * Upload to Firebase Storage (placeholder)
   */
  private async uploadToFirebase(
    buffer: Buffer,
    key: string,
    contentType: string
  ): Promise<string> {
    throw new Error('Firebase Storage not implemented yet');
  }

  /**
   * Generate base path for organization
   */
  private generateBasePath(recipeId?: string, userId?: string): string {
    const parts = ['images'];

    if (recipeId) {
      parts.push('recipes', recipeId);
    } else if (userId) {
      parts.push('users', userId);
    } else {
      parts.push('general');
    }

    return parts.join('/');
  }

  /**
   * Generate CDN URLs
   */
  private generateCDNUrls(
    originalUrl: string,
    webpUrl?: string
  ): { original: string; webp?: string } {
    if (!this.config.settings.cdnEnabled) {
      return { original: originalUrl, webp: webpUrl };
    }

    // Cloudflare R2 automatically uses CDN
    if (this.config.provider === 'cloudflare-r2') {
      return { original: originalUrl, webp: webpUrl };
    }

    // For other providers, return URLs as-is (can add CDN layer later)
    return { original: originalUrl, webp: webpUrl };
  }

  /**
   * Get bucket name
   */
  private getBucketName(): string {
    switch (this.config.provider) {
      case 'cloudflare-r2':
        return this.config.cloudflare?.bucket || '';
      case 'supabase':
        return this.config.supabase?.bucket || '';
      case 'firebase':
        return this.config.firebase?.storageBucket || '';
      default:
        return '';
    }
  }

  /**
   * Delete image
   */
  async deleteImage(key: string): Promise<void> {
    switch (this.config.provider) {
      case 'cloudflare-r2':
        await this.deleteFromR2(key);
        break;
      case 'supabase':
        await this.deleteFromSupabase(key);
        break;
      default:
        throw new Error('Delete not implemented for this provider');
    }
  }

  private async deleteFromR2(key: string): Promise<void> {
    if (!this.r2Client || !this.config.cloudflare) {
      throw new Error('R2 client not initialized');
    }

    const command = new DeleteObjectCommand({
      Bucket: this.config.cloudflare.bucket,
      Key: key,
    });

    await this.r2Client.send(command);
  }

  private async deleteFromSupabase(key: string): Promise<void> {
    if (!this.supabaseClient || !this.config.supabase) {
      throw new Error('Supabase client not initialized');
    }

    const { error } = await this.supabaseClient.storage
      .from(this.config.supabase.bucket)
      .remove([key]);

    if (error) {
      throw new Error(`Supabase delete failed: ${error.message}`);
    }
  }

  /**
   * Get signed URL for temporary access
   */
  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    if (this.config.provider === 'cloudflare-r2' && this.r2Client && this.config.cloudflare) {
      const command = new GetObjectCommand({
        Bucket: this.config.cloudflare.bucket,
        Key: key,
      });

      return await getSignedUrl(this.r2Client, command, { expiresIn });
    }

    throw new Error('Signed URLs only supported for Cloudflare R2');
  }
}
