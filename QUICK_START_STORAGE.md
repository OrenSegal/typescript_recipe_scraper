# ⚡ Quick Start: Cloud Storage

Get started with cloud storage for recipe photos in under 5 minutes!

## 🎯 What You Get

✅ **Automatic WebP conversion** (50-70% file size reduction)
✅ **Multi-size thumbnails** (150px, 500px, 1000px)
✅ **Global CDN delivery** (<100ms latency worldwide)
✅ **Zero egress fees** with Cloudflare R2
✅ **Database metadata** tracking

---

## 🚀 5-Minute Setup

### Step 1: Install Dependencies (1 min)

```bash
pnpm install
```

### Step 2: Configure Environment (2 min)

```bash
# Copy example env file
cp .env.example .env

# Edit .env and add your Cloudflare R2 credentials:
CLOUD_STORAGE_PROVIDER=cloudflare-r2
CLOUDFLARE_ACCOUNT_ID=your-account-id
CLOUDFLARE_ACCESS_KEY_ID=your-access-key-id
CLOUDFLARE_SECRET_ACCESS_KEY=your-secret-access-key
CLOUDFLARE_BUCKET=recipe-images

# Add your Supabase credentials (for metadata):
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**Don't have credentials yet?** See [CLOUD_STORAGE_SETUP.md](./CLOUD_STORAGE_SETUP.md) for setup instructions.

### Step 3: Test Configuration (30 sec)

```bash
# Verify configuration
pnpm run storage:config

# Run test upload
pnpm run storage:test
```

### Step 4: Start Using! (1 min)

```typescript
import { uploadRecipeImage } from './src/storage';

// Upload a recipe image
const result = await uploadRecipeImage(
  'https://example.com/pasta.jpg',
  'recipe-123',
  'Delicious Pasta Carbonara'
);

console.log('WebP URL:', result.webpUrl);
console.log('Thumbnails:', result.thumbnails);
```

---

## 📦 Usage Examples

### Example 1: Simple Upload

```typescript
import { uploadRecipeImage } from './src/storage';

const result = await uploadRecipeImage(
  'https://example.com/image.jpg',
  'recipe-123',
  'Recipe Title'
);

console.log('Uploaded:', result.webpUrl);
```

### Example 2: Full Recipe Processing

```typescript
import { RecipeScraperIntegration } from './src/storage';

const integration = new RecipeScraperIntegration();

const result = await integration.processRecipeImages({
  id: 'recipe-123',
  title: 'Pasta Carbonara',
  imageUrl: 'https://example.com/pasta.jpg',
  images: [
    'https://example.com/step1.jpg',
    'https://example.com/step2.jpg',
  ]
});

// Access processed images
console.log('Primary:', result.processedImages.primary?.webpUrl);
console.log('Gallery:', result.processedImages.gallery);
console.log('Savings:', result.metadata.webpSavings, 'bytes');
```

### Example 3: Batch Processing

```typescript
import { RecipeScraperIntegration } from './src/storage';

const integration = new RecipeScraperIntegration();

const recipes = [
  { id: '1', title: 'Pasta', imageUrl: 'https://...' },
  { id: '2', title: 'Pizza', imageUrl: 'https://...' },
  { id: '3', title: 'Salad', imageUrl: 'https://...' },
];

const results = await integration.processBatch(recipes, {
  concurrency: 3,
  onProgress: (processed, total) => {
    console.log(`Progress: ${processed}/${total}`);
  }
});

console.log(`Processed ${results.length} recipes`);
```

### Example 4: Upload from Local File

```bash
# Using CLI
pnpm run storage upload path/to/image.jpg \
  --recipe-id recipe-123 \
  --title "My Recipe"
```

```typescript
// Using code
import { RecipeImageService } from './src/storage';
import { loadCloudStorageConfig, getSupabaseConfig } from './src/storage/config';
import fs from 'fs/promises';

const config = loadCloudStorageConfig();
const supabase = getSupabaseConfig();
const service = new RecipeImageService(config, supabase.url, supabase.serviceKey);

const imageBuffer = await fs.readFile('path/to/image.jpg');

const result = await service.uploadRecipeImage({
  file: imageBuffer,
  filename: 'pasta.jpg',
  recipeId: 'recipe-123',
  convertToWebP: true,
  generateThumbnails: true,
});

console.log('Uploaded:', result.uploadResult.webpUrl);
```

---

## 🛠️ CLI Commands

### Configuration
```bash
# Show current configuration
pnpm run storage:config

# Test storage with sample upload
pnpm run storage:test
```

### Upload
```bash
# Upload from URL
pnpm run storage upload https://example.com/image.jpg \
  --recipe-id recipe-123 \
  --title "Recipe Title"

# Upload from file
pnpm run storage upload path/to/image.jpg \
  --recipe-id recipe-123 \
  --title "Recipe Title"
```

### Manage
```bash
# List images for a recipe
pnpm run storage list recipe-123

# Delete an image
pnpm run storage delete image-uuid --force

# Show statistics
pnpm run storage:stats
```

---

## 📊 What Happens When You Upload

1. **Download** (if URL) or read file
2. **Validate** file type and size
3. **Optimize** original image
4. **Convert** to WebP (50-70% smaller!)
5. **Generate** 3 thumbnails (150px, 500px, 1000px)
6. **Upload** to Cloudflare R2
7. **Save** metadata to Supabase
8. **Return** URLs for all versions

Total time: **500ms - 2s** per image

---

## 🎨 Customize Settings

### In Code

```typescript
import { CloudStorageService } from './src/storage';

const service = new CloudStorageService({
  provider: 'cloudflare-r2',
  cloudflare: { /* ... */ },
  settings: {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    defaultQuality: 85,              // Higher quality
    generateThumbnails: true,
    convertToWebP: true,
    cdnEnabled: true,
  },
});
```

### In Environment

```bash
STORAGE_MAX_FILE_SIZE=10485760
STORAGE_DEFAULT_QUALITY=85
STORAGE_CONVERT_TO_WEBP=true
STORAGE_GENERATE_THUMBNAILS=true
STORAGE_CDN_ENABLED=true
```

---

## 💰 Cost Estimates

### Free Tier (0-10k users)
```
Cloudflare R2: $0/month (10GB free)
Supabase: $0/month (500MB DB free)
Total: $0/month ✅
```

### Growing (10k-50k users)
```
Cloudflare R2: ~$10/month (100-500GB)
Supabase Pro: $25/month
Total: ~$35/month ✅
```

### Scale (100k+ users)
```
Cloudflare R2: ~$40/month (1-3TB, zero egress!)
Supabase Team: $599/month
Total: ~$640/month ✅

Compare to alternatives: $1,500-2,000/month ❌
Savings: $900+ per month! 🎉
```

---

## 🔗 Integration with Recipe Scraper

### Automatic Integration

```typescript
// Your existing recipe scraper
const scrapedRecipe = await scrapeRecipe('https://example.com/recipe');

// Add image processing
import { RecipeScraperIntegration } from './src/storage';

const integration = new RecipeScraperIntegration();
const processedRecipe = await integration.processRecipeImages(scrapedRecipe);

// Save to database with processed images
await saveRecipe({
  ...processedRecipe,
  imageUrl: processedRecipe.imageUrl, // Now uses WebP from CDN!
});
```

---

## 📚 Next Steps

1. **Production Setup**: [PRODUCTION_DEPLOYMENT.md](./PRODUCTION_DEPLOYMENT.md)
2. **Detailed Setup**: [CLOUD_STORAGE_SETUP.md](./CLOUD_STORAGE_SETUP.md)
3. **Cost Analysis**: [INFRASTRUCTURE_DECISION.md](./INFRASTRUCTURE_DECISION.md)
4. **API Reference**: [src/storage/README.md](./src/storage/README.md)

---

## 🆘 Troubleshooting

### "Access Denied" Error
```bash
# Check your credentials
echo $CLOUDFLARE_ACCESS_KEY_ID
echo $CLOUDFLARE_SECRET_ACCESS_KEY

# Verify they're set in .env
```

### "Bucket Not Found"
```bash
# Ensure bucket name is correct
echo $CLOUDFLARE_BUCKET

# Check bucket exists in Cloudflare dashboard
```

### Images Not Loading
```bash
# Check if bucket is public
# R2 → Bucket → Settings → Public Access

# Or use signed URLs
const url = await service.getSignedUrl(key, 3600);
```

### WebP Conversion Failed
```bash
# Ensure Sharp is installed
pnpm install sharp --force

# On Linux, install system dependencies
sudo apt-get install libvips-dev
```

---

## ✨ Pro Tips

1. **Always use WebP** - 50-70% smaller files!
2. **Generate thumbnails** - Faster page loads
3. **Use CDN URLs** - Better performance
4. **Monitor costs** - Set up alerts
5. **Test locally first** - Use `storage:test`

---

**Ready to upload?** Run `pnpm run storage:test` to get started! 🚀
