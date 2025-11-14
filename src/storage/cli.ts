#!/usr/bin/env node
/**
 * Cloud Storage CLI Tool
 * Test and manage cloud storage from command line
 */

import { Command } from 'commander';
import { RecipeImageService } from './RecipeImageService.js';
import { RecipeScraperIntegration } from './RecipeScraperIntegration.js';
import {
  loadCloudStorageConfig,
  getSupabaseConfig,
  validateStorageConfig,
  printConfigSummary,
} from './config.js';
import fs from 'fs/promises';
import { existsSync } from 'fs';

const program = new Command();

program
  .name('storage-cli')
  .description('Cloud Storage CLI for Recipe Photos')
  .version('1.0.0');

// Config command
program
  .command('config')
  .description('Show current storage configuration')
  .action(async () => {
    try {
      const config = loadCloudStorageConfig();
      const validation = validateStorageConfig(config);

      printConfigSummary(config);

      if (!validation.valid) {
        console.log('❌ Configuration errors:');
        validation.errors.forEach((err) => console.log(`  - ${err}`));
        process.exit(1);
      } else {
        console.log('✅ Configuration is valid!\n');
      }
    } catch (error) {
      console.error('❌ Error loading configuration:', error);
      process.exit(1);
    }
  });

// Upload command
program
  .command('upload')
  .description('Upload an image file or URL')
  .argument('<source>', 'File path or URL')
  .option('-r, --recipe-id <id>', 'Recipe ID')
  .option('-t, --title <title>', 'Recipe title')
  .option('-w, --webp', 'Convert to WebP', true)
  .option('-T, --thumbnails', 'Generate thumbnails', true)
  .option('-q, --quality <number>', 'Image quality (1-100)', '80')
  .action(async (source, options) => {
    try {
      console.log(`📤 Uploading: ${source}\n`);

      const config = loadCloudStorageConfig();
      const supabaseConfig = getSupabaseConfig();
      const service = new RecipeImageService(
        config,
        supabaseConfig.url,
        supabaseConfig.serviceKey
      );

      let result;

      if (source.startsWith('http://') || source.startsWith('https://')) {
        // Upload from URL
        result = await service.uploadFromUrl(source, {
          recipeId: options.recipeId,
          convertToWebP: options.webp,
          generateThumbnails: options.thumbnails,
          quality: parseInt(options.quality),
          metadata: {
            recipeTitle: options.title || 'Untitled',
            uploadedVia: 'cli',
          },
        });
      } else {
        // Upload from file
        if (!existsSync(source)) {
          console.error(`❌ File not found: ${source}`);
          process.exit(1);
        }

        const buffer = await fs.readFile(source);
        const filename = source.split('/').pop() || 'image.jpg';

        result = await service.uploadRecipeImage({
          file: buffer,
          filename,
          recipeId: options.recipeId,
          convertToWebP: options.webp,
          generateThumbnails: options.thumbnails,
          quality: parseInt(options.quality),
          metadata: {
            recipeTitle: options.title || 'Untitled',
            uploadedVia: 'cli',
          },
        });
      }

      console.log('✅ Upload successful!\n');
      console.log('📊 Results:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`🔗 Original: ${result.uploadResult.originalUrl}`);
      if (result.uploadResult.webpUrl) {
        console.log(`🔗 WebP: ${result.uploadResult.webpUrl}`);
      }
      if (result.uploadResult.thumbnails) {
        console.log('\n🖼️  Thumbnails:');
        console.log(`  Small: ${result.uploadResult.thumbnails.small}`);
        console.log(`  Medium: ${result.uploadResult.thumbnails.medium}`);
        console.log(`  Large: ${result.uploadResult.thumbnails.large}`);
      }
      console.log(
        `\n📐 Size: ${result.uploadResult.metadata.width}x${result.uploadResult.metadata.height}`
      );
      console.log(`📦 File size: ${formatBytes(result.uploadResult.metadata.size)}`);
      console.log(`⏱️  Processing time: ${result.uploadResult.processingTime}ms`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      if (result.databaseRecord) {
        console.log(`💾 Saved to database with ID: ${result.databaseRecord.id}\n`);
      }
    } catch (error) {
      console.error('❌ Upload failed:', error);
      process.exit(1);
    }
  });

// List command
program
  .command('list')
  .description('List images for a recipe')
  .argument('<recipe-id>', 'Recipe ID')
  .action(async (recipeId) => {
    try {
      const config = loadCloudStorageConfig();
      const supabaseConfig = getSupabaseConfig();
      const service = new RecipeImageService(
        config,
        supabaseConfig.url,
        supabaseConfig.serviceKey
      );

      const images = await service.getRecipeImages(recipeId);

      if (images.length === 0) {
        console.log(`\n📭 No images found for recipe: ${recipeId}\n`);
        return;
      }

      console.log(`\n📸 Found ${images.length} image(s) for recipe: ${recipeId}\n`);

      images.forEach((img, i) => {
        console.log(`${i + 1}. Image ID: ${img.id}`);
        console.log(`   Original: ${img.originalUrl}`);
        if (img.webpUrl) console.log(`   WebP: ${img.webpUrl}`);
        console.log(`   Size: ${img.width}x${img.height} (${formatBytes(img.fileSize)})`);
        console.log(`   Provider: ${img.storageProvider}`);
        console.log(`   Created: ${img.createdAt.toISOString()}`);
        console.log('');
      });
    } catch (error) {
      console.error('❌ Error listing images:', error);
      process.exit(1);
    }
  });

// Delete command
program
  .command('delete')
  .description('Delete an image')
  .argument('<image-id>', 'Image ID')
  .option('-f, --force', 'Skip confirmation', false)
  .action(async (imageId, options) => {
    try {
      if (!options.force) {
        console.log(`\n⚠️  Are you sure you want to delete image ${imageId}?`);
        console.log('   Use --force to skip this confirmation\n');
        process.exit(0);
      }

      const config = loadCloudStorageConfig();
      const supabaseConfig = getSupabaseConfig();
      const service = new RecipeImageService(
        config,
        supabaseConfig.url,
        supabaseConfig.serviceKey
      );

      await service.deleteRecipeImage(imageId);
      console.log(`\n✅ Image deleted: ${imageId}\n`);
    } catch (error) {
      console.error('❌ Delete failed:', error);
      process.exit(1);
    }
  });

// Stats command
program
  .command('stats')
  .description('Show storage statistics')
  .action(async () => {
    try {
      const config = loadCloudStorageConfig();
      const supabaseConfig = getSupabaseConfig();
      const service = new RecipeImageService(
        config,
        supabaseConfig.url,
        supabaseConfig.serviceKey
      );

      const stats = await service.getStorageStatistics();

      console.log('\n📊 Storage Statistics\n');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      for (const stat of stats) {
        console.log(`\n${stat.provider.toUpperCase()}:`);
        console.log(`  Total images: ${stat.totalImages}`);
        console.log(`  Total size: ${formatBytes(stat.totalSizeBytes)}`);
        console.log(`  Avg size: ${formatBytes(stat.avgSizeBytes)}`);
        console.log(`  WebP savings: ${formatBytes(stat.totalWebpSavingsBytes)}`);
        console.log(`  WebP conversions: ${stat.webpConversions}`);
        console.log(`  Avg processing time: ${stat.avgProcessingTimeMs}ms`);
      }

      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    } catch (error) {
      console.error('❌ Error fetching stats:', error);
      process.exit(1);
    }
  });

// Test command
program
  .command('test')
  .description('Test storage configuration with a sample upload')
  .action(async () => {
    try {
      console.log('\n🧪 Testing storage configuration...\n');

      const config = loadCloudStorageConfig();
      printConfigSummary(config);

      const validation = validateStorageConfig(config);
      if (!validation.valid) {
        console.log('❌ Configuration errors:');
        validation.errors.forEach((err) => console.log(`  - ${err}`));
        process.exit(1);
      }

      console.log('✅ Configuration valid\n');
      console.log('📥 Downloading test image...\n');

      // Download a test image
      const testImageUrl =
        'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800';

      const integration = new RecipeScraperIntegration();
      const result = await integration.processRecipeImages({
        id: 'test-recipe',
        title: 'Test Recipe',
        imageUrl: testImageUrl,
      });

      if (result.processedImages.primary) {
        console.log('✅ Test upload successful!\n');
        console.log(`🔗 WebP URL: ${result.processedImages.primary.webpUrl}`);
        console.log(`💾 Savings: ${formatBytes(result.metadata.webpSavings || 0)}`);
        console.log(`⏱️  Processing time: ${result.metadata.totalProcessingTime}ms\n`);
        console.log('🎉 Storage is working correctly!\n');
      } else {
        console.error('❌ Test upload failed\n');
        process.exit(1);
      }
    } catch (error) {
      console.error('❌ Test failed:', error);
      process.exit(1);
    }
  });

// Helper function
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

// Parse and execute
program.parse();
