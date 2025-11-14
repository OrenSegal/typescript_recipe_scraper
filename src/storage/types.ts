/**
 * Cloud Storage Types & Interfaces
 * Supports: Cloudflare R2, Supabase Storage
 */

export interface ImageUploadOptions {
  /** Original file buffer */
  file: Buffer;
  /** Original filename */
  filename: string;
  /** Recipe ID for organization */
  recipeId?: string;
  /** User ID for tracking */
  userId?: string;
  /** Generate thumbnails */
  generateThumbnails?: boolean;
  /** Convert to WebP */
  convertToWebP?: boolean;
  /** Quality for WebP (1-100) */
  quality?: number;
  /** Metadata to attach */
  metadata?: Record<string, string>;
}

export interface ImageUploadResult {
  /** Success status */
  success: boolean;
  /** Original image URL */
  originalUrl: string;
  /** WebP version URL */
  webpUrl?: string;
  /** Thumbnail URLs */
  thumbnails?: {
    small: string; // 150px
    medium: string; // 500px
    large: string; // 1000px
  };
  /** CDN URLs (cached) */
  cdnUrls?: {
    original: string;
    webp?: string;
  };
  /** File metadata */
  metadata: {
    size: number; // bytes
    width: number;
    height: number;
    format: string;
    mimeType: string;
  };
  /** Storage info */
  storage: {
    provider: 'cloudflare-r2' | 'supabase' | 'firebase';
    bucket: string;
    key: string;
    region?: string;
  };
  /** Upload time */
  uploadedAt: Date;
  /** Processing time in ms */
  processingTime: number;
}

export interface ImageMetadata {
  id: string;
  recipeId?: string;
  userId?: string;
  originalUrl: string;
  webpUrl?: string;
  thumbnails?: {
    small: string;
    medium: string;
    large: string;
  };
  width: number;
  height: number;
  size: number;
  format: string;
  storage: {
    provider: string;
    bucket: string;
    key: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface CloudStorageConfig {
  /** Provider selection */
  provider: 'cloudflare-r2' | 'supabase' | 'firebase';

  /** Cloudflare R2 Config */
  cloudflare?: {
    accountId: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucket: string;
    publicDomain?: string; // e.g., images.yourdomain.com
    region?: string; // default: 'auto'
  };

  /** Supabase Config */
  supabase?: {
    url: string;
    serviceKey: string;
    bucket: string;
  };

  /** Firebase Config */
  firebase?: {
    projectId: string;
    storageBucket: string;
    credentials: any;
  };

  /** Global settings */
  settings: {
    maxFileSize: number; // bytes, default: 10MB
    allowedFormats: string[]; // default: ['jpg', 'jpeg', 'png', 'webp']
    defaultQuality: number; // 1-100, default: 80
    generateThumbnails: boolean; // default: true
    convertToWebP: boolean; // default: true
    cdnEnabled: boolean; // default: true
  };
}

export interface ThumbnailSize {
  name: 'small' | 'medium' | 'large';
  width: number;
  height?: number; // auto if not specified
  quality: number;
}

export const DEFAULT_THUMBNAIL_SIZES: ThumbnailSize[] = [
  { name: 'small', width: 150, quality: 80 },
  { name: 'medium', width: 500, quality: 85 },
  { name: 'large', width: 1000, quality: 90 },
];

export interface StorageStats {
  totalImages: number;
  totalSize: number; // bytes
  byProvider: Record<string, { count: number; size: number }>;
  byFormat: Record<string, { count: number; size: number }>;
  savings: {
    webpConversion: number; // bytes saved
    thumbnails: number;
    total: number;
  };
}
