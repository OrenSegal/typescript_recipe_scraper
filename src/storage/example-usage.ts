/**
 * Cloud Storage Usage Examples
 * Demonstrates how to use the CloudStorageService
 */

import { CloudStorageService } from './CloudStorageService.js';
import { CloudStorageConfig } from './types.js';
import fs from 'fs/promises';
import path from 'path';

// ============================================
// OPTION 1: Cloudflare R2 (RECOMMENDED - $0/month)
// ============================================

async function exampleCloudflareR2() {
  console.log('📦 Example 1: Cloudflare R2 Storage\n');

  const config: CloudStorageConfig = {
    provider: 'cloudflare-r2',
    cloudflare: {
      accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
      accessKeyId: process.env.CLOUDFLARE_ACCESS_KEY_ID!,
      secretAccessKey: process.env.CLOUDFLARE_SECRET_ACCESS_KEY!,
      bucket: process.env.CLOUDFLARE_BUCKET || 'recipe-images',
      publicDomain: process.env.CLOUDFLARE_PUBLIC_DOMAIN, // e.g., 'images.yourdomain.com'
    },
    settings: {
      maxFileSize: 10 * 1024 * 1024, // 10MB
      allowedFormats: ['jpg', 'jpeg', 'png', 'webp'],
      defaultQuality: 80,
      generateThumbnails: true,
      convertToWebP: true,
      cdnEnabled: true,
    },
  };

  const storage = new CloudStorageService(config);

  // Upload an image
  try {
    // Read image from file (in real app, this would come from HTTP upload)
    const imagePath = './test-recipe-image.jpg';
    const imageBuffer = await fs.readFile(imagePath);

    console.log('📤 Uploading image to Cloudflare R2...');

    const result = await storage.uploadImage({
      file: imageBuffer,
      filename: 'delicious-pasta.jpg',
      recipeId: 'recipe-123',
      userId: 'user-456',
      generateThumbnails: true,
      convertToWebP: true,
      quality: 85,
      metadata: {
        recipeTitle: 'Delicious Pasta Carbonara',
        uploadedBy: 'chef@example.com',
      },
    });

    console.log('\n✅ Upload successful!\n');
    console.log('📊 Results:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🔗 Original URL: ${result.originalUrl}`);
    console.log(`🔗 WebP URL: ${result.webpUrl}`);
    console.log(`\n📐 Dimensions: ${result.metadata.width}x${result.metadata.height}`);
    console.log(`📦 Size: ${formatBytes(result.metadata.size)}`);
    console.log(`⏱️  Processing Time: ${result.processingTime}ms`);

    if (result.thumbnails) {
      console.log('\n🖼️  Thumbnails:');
      console.log(`  Small (150px): ${result.thumbnails.small}`);
      console.log(`  Medium (500px): ${result.thumbnails.medium}`);
      console.log(`  Large (1000px): ${result.thumbnails.large}`);
    }

    if (result.cdnUrls) {
      console.log('\n🌐 CDN URLs (cached):');
      console.log(`  Original: ${result.cdnUrls.original}`);
      console.log(`  WebP: ${result.cdnUrls.webp}`);
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Save metadata to database (pseudo-code)
    await saveImageMetadataToDatabase({
      recipeId: 'recipe-123',
      imageUrl: result.webpUrl || result.originalUrl,
      thumbnailUrls: result.thumbnails,
      metadata: result.metadata,
    });

  } catch (error) {
    console.error('❌ Upload failed:', error);
  }
}

// ============================================
// OPTION 2: Supabase Storage
// ============================================

async function exampleSupabaseStorage() {
  console.log('📦 Example 2: Supabase Storage\n');

  const config: CloudStorageConfig = {
    provider: 'supabase',
    supabase: {
      url: process.env.SUPABASE_URL!,
      serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
      bucket: 'recipe-images',
    },
    settings: {
      maxFileSize: 5 * 1024 * 1024, // 5MB (within free tier)
      allowedFormats: ['jpg', 'jpeg', 'png', 'webp'],
      defaultQuality: 80,
      generateThumbnails: true,
      convertToWebP: true,
      cdnEnabled: true,
    },
  };

  const storage = new CloudStorageService(config);

  // Upload logic is the same as above
  console.log('✅ Supabase storage configured');
}

// ============================================
// OPTION 3: Hybrid Approach (Best of Both)
// ============================================

async function exampleHybridApproach() {
  console.log('📦 Example 3: Hybrid Approach (R2 + Supabase)\n');

  // Primary: Cloudflare R2 for images
  const r2Config: CloudStorageConfig = {
    provider: 'cloudflare-r2',
    cloudflare: {
      accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
      accessKeyId: process.env.CLOUDFLARE_ACCESS_KEY_ID!,
      secretAccessKey: process.env.CLOUDFLARE_SECRET_ACCESS_KEY!,
      bucket: 'recipe-images',
      publicDomain: process.env.CLOUDFLARE_PUBLIC_DOMAIN,
    },
    settings: {
      maxFileSize: 10 * 1024 * 1024,
      allowedFormats: ['jpg', 'jpeg', 'png', 'webp'],
      defaultQuality: 80,
      generateThumbnails: true,
      convertToWebP: true,
      cdnEnabled: true,
    },
  };

  // Backup: Supabase for thumbnails only
  const supabaseConfig: CloudStorageConfig = {
    provider: 'supabase',
    supabase: {
      url: process.env.SUPABASE_URL!,
      serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
      bucket: 'recipe-thumbnails',
    },
    settings: {
      maxFileSize: 1 * 1024 * 1024,
      allowedFormats: ['webp'],
      defaultQuality: 80,
      generateThumbnails: true,
      convertToWebP: true,
      cdnEnabled: false,
    },
  };

  const r2Storage = new CloudStorageService(r2Config);
  const supabaseStorage = new CloudStorageService(supabaseConfig);

  console.log('✅ Hybrid storage configured (R2 + Supabase)');
  console.log('   → Full images: Cloudflare R2 ($0 egress)');
  console.log('   → Thumbnails: Supabase (backup)\n');

  // Upload to both (with fallback logic)
  const imagePath = './test-recipe-image.jpg';
  const imageBuffer = await fs.readFile(imagePath);

  try {
    // Try R2 first
    const result = await r2Storage.uploadImage({
      file: imageBuffer,
      filename: 'recipe.jpg',
      recipeId: 'recipe-789',
    });

    console.log('✅ Uploaded to Cloudflare R2');
    console.log(`🔗 URL: ${result.webpUrl}`);

    // Backup thumbnails to Supabase
    // (Optional - only if you want redundancy)

  } catch (error) {
    console.log('⚠️ R2 upload failed, falling back to Supabase');

    // Fallback to Supabase
    const result = await supabaseStorage.uploadImage({
      file: imageBuffer,
      filename: 'recipe.jpg',
      recipeId: 'recipe-789',
      generateThumbnails: false, // Only store original
    });

    console.log('✅ Uploaded to Supabase (fallback)');
  }
}

// ============================================
// OPTION 4: Integration with Recipe Service
// ============================================

async function exampleRecipeIntegration() {
  console.log('📦 Example 4: Recipe Service Integration\n');

  const storage = new CloudStorageService({
    provider: 'cloudflare-r2',
    cloudflare: {
      accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
      accessKeyId: process.env.CLOUDFLARE_ACCESS_KEY_ID!,
      secretAccessKey: process.env.CLOUDFLARE_SECRET_ACCESS_KEY!,
      bucket: 'recipe-images',
    },
    settings: {
      maxFileSize: 10 * 1024 * 1024,
      allowedFormats: ['jpg', 'jpeg', 'png', 'webp'],
      defaultQuality: 80,
      generateThumbnails: true,
      convertToWebP: true,
      cdnEnabled: true,
    },
  });

  // Simulate recipe scraping with image upload
  const recipe = {
    id: 'recipe-001',
    title: 'Classic Margherita Pizza',
    imageUrl: 'https://example.com/pizza.jpg',
  };

  console.log(`📸 Scraping recipe: ${recipe.title}`);

  // Download image from URL
  const response = await fetch(recipe.imageUrl);
  const arrayBuffer = await response.arrayBuffer();
  const imageBuffer = Buffer.from(arrayBuffer);

  // Upload to cloud storage
  const uploadResult = await storage.uploadImage({
    file: imageBuffer,
    filename: 'margherita-pizza.jpg',
    recipeId: recipe.id,
    convertToWebP: true,
    generateThumbnails: true,
    metadata: {
      recipeTitle: recipe.title,
      sourceUrl: recipe.imageUrl,
    },
  });

  console.log('✅ Recipe image uploaded');
  console.log(`🔗 CDN URL: ${uploadResult.cdnUrls?.webp || uploadResult.webpUrl}`);

  // Update recipe in database
  await updateRecipeInDatabase({
    id: recipe.id,
    imageUrl: uploadResult.webpUrl || uploadResult.originalUrl,
    thumbnails: uploadResult.thumbnails,
  });

  console.log('✅ Recipe updated in database\n');
}

// ============================================
// Helper Functions
// ============================================

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

async function saveImageMetadataToDatabase(data: any) {
  // Pseudo-code: Save to Supabase
  console.log('💾 Saving metadata to database...');
  // await supabase.from('recipe_images').insert(data);
}

async function updateRecipeInDatabase(data: any) {
  // Pseudo-code: Update recipe
  console.log('💾 Updating recipe in database...');
  // await supabase.from('recipes').update({ image_url: data.imageUrl }).eq('id', data.id);
}

// ============================================
// Run Examples
// ============================================

async function runExamples() {
  console.log('\n🚀 Cloud Storage Examples\n');
  console.log('═══════════════════════════════════════════\n');

  // Uncomment the example you want to run:

  // await exampleCloudflareR2();
  // await exampleSupabaseStorage();
  // await exampleHybridApproach();
  // await exampleRecipeIntegration();

  console.log('ℹ️  Uncomment the example you want to run in runExamples()\n');
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runExamples().catch(console.error);
}

export {
  exampleCloudflareR2,
  exampleSupabaseStorage,
  exampleHybridApproach,
  exampleRecipeIntegration,
};
