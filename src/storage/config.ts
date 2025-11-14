/**
 * Cloud Storage Configuration Loader
 * Loads configuration from environment variables
 */

import { CloudStorageConfig } from './types.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Load cloud storage configuration from environment variables
 */
export function loadCloudStorageConfig(): CloudStorageConfig {
  const provider = (process.env.CLOUD_STORAGE_PROVIDER || 'cloudflare-r2') as
    | 'cloudflare-r2'
    | 'supabase';

  // Validate provider
  if (provider !== 'cloudflare-r2' && provider !== 'supabase') {
    throw new Error(
      `Invalid CLOUD_STORAGE_PROVIDER: ${provider}. Must be 'cloudflare-r2' or 'supabase'`
    );
  }

  const config: CloudStorageConfig = {
    provider,
    settings: {
      maxFileSize: parseInt(process.env.STORAGE_MAX_FILE_SIZE || '10485760'), // 10MB default
      allowedFormats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
      defaultQuality: parseInt(process.env.STORAGE_DEFAULT_QUALITY || '80'),
      generateThumbnails: process.env.STORAGE_GENERATE_THUMBNAILS !== 'false',
      convertToWebP: process.env.STORAGE_CONVERT_TO_WEBP !== 'false',
      cdnEnabled: process.env.STORAGE_CDN_ENABLED !== 'false',
    },
  };

  // Load provider-specific config
  if (provider === 'cloudflare-r2') {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const accessKeyId = process.env.CLOUDFLARE_ACCESS_KEY_ID;
    const secretAccessKey = process.env.CLOUDFLARE_SECRET_ACCESS_KEY;
    const bucket = process.env.CLOUDFLARE_BUCKET || 'recipe-images';

    if (!accountId || !accessKeyId || !secretAccessKey) {
      throw new Error(
        'Missing Cloudflare R2 credentials. Please set CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_ACCESS_KEY_ID, and CLOUDFLARE_SECRET_ACCESS_KEY'
      );
    }

    config.cloudflare = {
      accountId,
      accessKeyId,
      secretAccessKey,
      bucket,
      publicDomain: process.env.CLOUDFLARE_PUBLIC_DOMAIN,
      region: process.env.CLOUDFLARE_REGION || 'auto',
    };
  } else if (provider === 'supabase') {
    const url = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'recipe-images';

    if (!url || !serviceKey) {
      throw new Error(
        'Missing Supabase credentials. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'
      );
    }

    config.supabase = {
      url,
      serviceKey,
      bucket,
    };
  }

  return config;
}

/**
 * Get Supabase configuration for database operations
 */
export function getSupabaseConfig(): { url: string; serviceKey: string } {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      'Missing Supabase credentials. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'
    );
  }

  return { url, serviceKey };
}

/**
 * Validate configuration
 */
export function validateStorageConfig(config: CloudStorageConfig): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check provider-specific config
  if (config.provider === 'cloudflare-r2') {
    if (!config.cloudflare) {
      errors.push('Cloudflare R2 config is missing');
    } else {
      if (!config.cloudflare.accountId) errors.push('Missing CLOUDFLARE_ACCOUNT_ID');
      if (!config.cloudflare.accessKeyId) errors.push('Missing CLOUDFLARE_ACCESS_KEY_ID');
      if (!config.cloudflare.secretAccessKey)
        errors.push('Missing CLOUDFLARE_SECRET_ACCESS_KEY');
      if (!config.cloudflare.bucket) errors.push('Missing CLOUDFLARE_BUCKET');
    }
  } else if (config.provider === 'supabase') {
    if (!config.supabase) {
      errors.push('Supabase config is missing');
    } else {
      if (!config.supabase.url) errors.push('Missing SUPABASE_URL');
      if (!config.supabase.serviceKey) errors.push('Missing SUPABASE_SERVICE_ROLE_KEY');
      if (!config.supabase.bucket) errors.push('Missing SUPABASE_STORAGE_BUCKET');
    }
  }

  // Validate settings
  if (config.settings.maxFileSize <= 0) {
    errors.push('STORAGE_MAX_FILE_SIZE must be greater than 0');
  }
  if (config.settings.maxFileSize > 100 * 1024 * 1024) {
    errors.push('STORAGE_MAX_FILE_SIZE must be less than 100MB');
  }
  if (config.settings.defaultQuality < 1 || config.settings.defaultQuality > 100) {
    errors.push('STORAGE_DEFAULT_QUALITY must be between 1 and 100');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Print configuration summary (without sensitive data)
 */
export function printConfigSummary(config: CloudStorageConfig): void {
  console.log('\n📦 Cloud Storage Configuration');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Provider: ${config.provider}`);

  if (config.provider === 'cloudflare-r2' && config.cloudflare) {
    console.log(`Bucket: ${config.cloudflare.bucket}`);
    console.log(`Account ID: ${config.cloudflare.accountId}`);
    console.log(`Region: ${config.cloudflare.region}`);
    console.log(
      `Custom Domain: ${config.cloudflare.publicDomain || 'Not configured'}`
    );
    console.log(`Access Key: ${config.cloudflare.accessKeyId.substring(0, 10)}...`);
  } else if (config.provider === 'supabase' && config.supabase) {
    console.log(`Bucket: ${config.supabase.bucket}`);
    console.log(`URL: ${config.supabase.url}`);
    console.log(`Service Key: ${config.supabase.serviceKey.substring(0, 20)}...`);
  }

  console.log('\n⚙️  Settings:');
  console.log(`  Max File Size: ${formatBytes(config.settings.maxFileSize)}`);
  console.log(`  Default Quality: ${config.settings.defaultQuality}`);
  console.log(`  Convert to WebP: ${config.settings.convertToWebP ? '✅' : '❌'}`);
  console.log(
    `  Generate Thumbnails: ${config.settings.generateThumbnails ? '✅' : '❌'}`
  );
  console.log(`  CDN Enabled: ${config.settings.cdnEnabled ? '✅' : '❌'}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

// Helper function
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}
