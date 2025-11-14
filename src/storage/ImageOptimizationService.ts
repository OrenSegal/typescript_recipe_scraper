/**
 * Image Optimization Service
 * Handles WebP conversion, resizing, and optimization
 */

import sharp from 'sharp';
import { DEFAULT_THUMBNAIL_SIZES, ThumbnailSize } from './types.js';

export interface OptimizationResult {
  buffer: Buffer;
  width: number;
  height: number;
  size: number;
  format: string;
}

export class ImageOptimizationService {
  /**
   * Convert image to WebP format with optimization
   */
  async convertToWebP(
    inputBuffer: Buffer,
    quality: number = 80
  ): Promise<OptimizationResult> {
    try {
      const startTime = Date.now();

      const pipeline = sharp(inputBuffer);
      const metadata = await pipeline.metadata();

      const webpBuffer = await pipeline
        .webp({ quality, effort: 6 }) // effort: 0-6, higher = better compression
        .toBuffer();

      const optimizedMetadata = await sharp(webpBuffer).metadata();

      console.log(
        `✅ WebP conversion: ${this.formatBytes(inputBuffer.length)} → ${this.formatBytes(webpBuffer.length)} (${this.calculateSavings(inputBuffer.length, webpBuffer.length)}% savings) in ${Date.now() - startTime}ms`
      );

      return {
        buffer: webpBuffer,
        width: optimizedMetadata.width || 0,
        height: optimizedMetadata.height || 0,
        size: webpBuffer.length,
        format: 'webp',
      };
    } catch (error) {
      throw new Error(`WebP conversion failed: ${error}`);
    }
  }

  /**
   * Generate multiple thumbnail sizes
   */
  async generateThumbnails(
    inputBuffer: Buffer,
    sizes: ThumbnailSize[] = DEFAULT_THUMBNAIL_SIZES
  ): Promise<Record<string, OptimizationResult>> {
    try {
      const thumbnails: Record<string, OptimizationResult> = {};

      for (const size of sizes) {
        const thumbnail = await this.resizeImage(
          inputBuffer,
          size.width,
          size.height,
          size.quality
        );
        thumbnails[size.name] = thumbnail;
      }

      return thumbnails;
    } catch (error) {
      throw new Error(`Thumbnail generation failed: ${error}`);
    }
  }

  /**
   * Resize image to specific dimensions
   */
  async resizeImage(
    inputBuffer: Buffer,
    width: number,
    height?: number,
    quality: number = 80
  ): Promise<OptimizationResult> {
    try {
      const pipeline = sharp(inputBuffer);

      const resized = await pipeline
        .resize(width, height, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality })
        .toBuffer();

      const metadata = await sharp(resized).metadata();

      return {
        buffer: resized,
        width: metadata.width || 0,
        height: metadata.height || 0,
        size: resized.length,
        format: 'webp',
      };
    } catch (error) {
      throw new Error(`Image resize failed: ${error}`);
    }
  }

  /**
   * Optimize existing image (compress without format change)
   */
  async optimizeImage(
    inputBuffer: Buffer,
    quality: number = 80
  ): Promise<OptimizationResult> {
    try {
      const pipeline = sharp(inputBuffer);
      const metadata = await pipeline.metadata();

      let optimized: Buffer;

      switch (metadata.format) {
        case 'jpeg':
        case 'jpg':
          optimized = await pipeline.jpeg({ quality, mozjpeg: true }).toBuffer();
          break;
        case 'png':
          optimized = await pipeline
            .png({ quality, compressionLevel: 9 })
            .toBuffer();
          break;
        case 'webp':
          optimized = await pipeline.webp({ quality }).toBuffer();
          break;
        default:
          optimized = inputBuffer;
      }

      const optimizedMetadata = await sharp(optimized).metadata();

      return {
        buffer: optimized,
        width: optimizedMetadata.width || 0,
        height: optimizedMetadata.height || 0,
        size: optimized.length,
        format: optimizedMetadata.format || 'unknown',
      };
    } catch (error) {
      throw new Error(`Image optimization failed: ${error}`);
    }
  }

  /**
   * Get image metadata without processing
   */
  async getMetadata(inputBuffer: Buffer): Promise<{
    width: number;
    height: number;
    format: string;
    size: number;
    hasAlpha: boolean;
  }> {
    try {
      const metadata = await sharp(inputBuffer).metadata();

      return {
        width: metadata.width || 0,
        height: metadata.height || 0,
        format: metadata.format || 'unknown',
        size: inputBuffer.length,
        hasAlpha: metadata.hasAlpha || false,
      };
    } catch (error) {
      throw new Error(`Failed to get image metadata: ${error}`);
    }
  }

  /**
   * Validate image file
   */
  async validateImage(
    inputBuffer: Buffer,
    maxSizeMB: number = 10
  ): Promise<{ valid: boolean; error?: string }> {
    try {
      // Check file size
      const maxBytes = maxSizeMB * 1024 * 1024;
      if (inputBuffer.length > maxBytes) {
        return {
          valid: false,
          error: `File too large: ${this.formatBytes(inputBuffer.length)} (max: ${maxSizeMB}MB)`,
        };
      }

      // Try to read metadata
      const metadata = await sharp(inputBuffer).metadata();

      // Check if it's a valid image format
      const validFormats = ['jpeg', 'jpg', 'png', 'webp', 'gif', 'svg'];
      if (!metadata.format || !validFormats.includes(metadata.format)) {
        return {
          valid: false,
          error: `Unsupported format: ${metadata.format}`,
        };
      }

      // Check dimensions
      if (!metadata.width || !metadata.height) {
        return {
          valid: false,
          error: 'Invalid image dimensions',
        };
      }

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: `Invalid image file: ${error}`,
      };
    }
  }

  /**
   * Create a blurred placeholder (for lazy loading)
   */
  async createPlaceholder(
    inputBuffer: Buffer,
    size: number = 20
  ): Promise<OptimizationResult> {
    try {
      const blurred = await sharp(inputBuffer)
        .resize(size, size, { fit: 'inside' })
        .blur(10)
        .webp({ quality: 30 })
        .toBuffer();

      const metadata = await sharp(blurred).metadata();

      return {
        buffer: blurred,
        width: metadata.width || 0,
        height: metadata.height || 0,
        size: blurred.length,
        format: 'webp',
      };
    } catch (error) {
      throw new Error(`Placeholder creation failed: ${error}`);
    }
  }

  // Helper methods
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }

  private calculateSavings(original: number, optimized: number): number {
    return Math.round(((original - optimized) / original) * 100);
  }
}
