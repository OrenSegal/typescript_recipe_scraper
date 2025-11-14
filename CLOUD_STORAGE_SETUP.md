# ☁️ Cloud Storage Setup Guide

Complete guide to setting up photo storage for the Recipe Scraper Service.

> **📢 FINAL ARCHITECTURE DECISION:**
> After analyzing scaling requirements for 10k-100k DAU, we've finalized on:
> **Cloudflare R2 + Supabase PostgreSQL**
>
> **Firebase Storage has been removed** due to high egress costs ($900+/month at scale).
> See [INFRASTRUCTURE_DECISION.md](./INFRASTRUCTURE_DECISION.md) for full analysis.

## 📋 Table of Contents

1. [Quick Start](#quick-start)
2. [Cloudflare R2 Setup](#cloudflare-r2-setup) ⭐ **Recommended**
3. [Supabase Storage Setup](#supabase-storage-setup) (Fallback)
4. [Testing the Integration](#testing)
5. [Troubleshooting](#troubleshooting)

---

## 🚀 Quick Start

### Step 1: Install Dependencies

```bash
pnpm install
```

This will install:
- `@aws-sdk/client-s3` - S3-compatible client for R2
- `@aws-sdk/s3-request-presigner` - Signed URLs
- `sharp` - Image optimization & WebP conversion

### Step 2: Choose Your Provider

**Final Architecture: Cloudflare R2 + Supabase PostgreSQL**

| Provider | Free Storage | Free Bandwidth | Egress Fees | Cost at 100k DAU |
|----------|--------------|----------------|-------------|------------------|
| **Cloudflare R2** ⭐ | 10 GB | **UNLIMITED** | **$0** | **$40/month** |
| Supabase | 1 GB | 2 GB/month | $0.09/GB | $900+/month |

### Step 3: Configure Environment

Copy `.env.example` to `.env` and add your credentials:

```bash
cp .env.example .env
```

---

## 🔷 Cloudflare R2 Setup (Recommended)

### Why Cloudflare R2?

✅ **$0/month** for most use cases
✅ **Zero egress fees** (save $100s on bandwidth)
✅ **S3-compatible API** (easy to use)
✅ **Global CDN** included
✅ **10GB free storage** forever

### Step-by-Step Setup

#### 1. Create Cloudflare Account

Visit: https://dash.cloudflare.com/sign-up

- Sign up for free (no credit card required)
- Verify your email

#### 2. Enable R2 Storage

1. Go to **R2** in the left sidebar
2. Click **Purchase R2 Plan** (it's free!)
3. Accept the terms

#### 3. Create R2 Bucket

```bash
# In Cloudflare Dashboard:
1. Click "Create Bucket"
2. Name: "recipe-images" (or your choice)
3. Region: "Automatic" (recommended)
4. Click "Create Bucket"
```

#### 4. Generate API Credentials

```bash
# In Cloudflare Dashboard:
1. Go to R2 → Manage R2 API Tokens
2. Click "Create API Token"
3. Token name: "recipe-scraper-production"
4. Permissions: "Object Read & Write"
5. Apply to: "Specific bucket" → "recipe-images"
6. Click "Create API Token"

# Copy these values:
- Access Key ID: abc123...
- Secret Access Key: xyz789...
```

#### 5. Get Your Account ID

```bash
# In Cloudflare Dashboard:
1. Go to R2
2. Copy your Account ID from the top right
   Example: a1b2c3d4e5f6g7h8
```

#### 6. Configure Environment Variables

Add to your `.env` file:

```bash
# Cloudflare R2 Configuration
CLOUD_STORAGE_PROVIDER=cloudflare-r2
CLOUDFLARE_ACCOUNT_ID=a1b2c3d4e5f6g7h8
CLOUDFLARE_ACCESS_KEY_ID=abc123...
CLOUDFLARE_SECRET_ACCESS_KEY=xyz789...
CLOUDFLARE_BUCKET=recipe-images
```

#### 7. (Optional) Set Up Custom Domain for CDN

For production, use a custom domain for better performance:

```bash
# In Cloudflare Dashboard:
1. Go to your bucket → Settings
2. Click "Connect Domain"
3. Add subdomain: "images.yourdomain.com"
4. Cloudflare will handle DNS automatically

# Update .env:
CLOUDFLARE_PUBLIC_DOMAIN=images.yourdomain.com
```

#### 8. Test the Connection

```bash
npx tsx src/storage/example-usage.ts
```

---

## 🟢 Supabase Storage Setup

### Step-by-Step Setup

#### 1. Create Storage Bucket

```bash
# In Supabase Dashboard:
1. Go to Storage → Buckets
2. Click "New Bucket"
3. Name: "recipe-images"
4. Public: Yes (or use signed URLs)
5. Allowed MIME types: image/jpeg, image/png, image/webp
6. Max file size: 10MB
7. Click "Create Bucket"
```

#### 2. Configure Environment

Already configured if you're using Supabase! Just add:

```bash
CLOUD_STORAGE_PROVIDER=supabase
SUPABASE_STORAGE_BUCKET=recipe-images
```

#### 3. Set Storage Policies (Optional)

For authenticated uploads:

```sql
-- Allow authenticated users to upload
CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'recipe-images');

-- Allow public reads
CREATE POLICY "Allow public reads"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'recipe-images');
```

---

## 🟠 Firebase Storage Setup

### Step-by-Step Setup

#### 1. Create Firebase Project

1. Go to https://console.firebase.google.com/
2. Click "Add Project"
3. Follow the setup wizard

#### 2. Enable Storage

```bash
# In Firebase Console:
1. Go to Storage → Get Started
2. Choose "Start in production mode"
3. Select a region (us-central1 recommended)
4. Click "Done"
```

#### 3. Download Service Account Key

```bash
# In Firebase Console:
1. Go to Project Settings → Service Accounts
2. Click "Generate New Private Key"
3. Download JSON file
4. Save as: firebase-credentials.json in project root
```

#### 4. Configure Environment

```bash
CLOUD_STORAGE_PROVIDER=firebase
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_STORAGE_BUCKET=your-project.appspot.com
FIREBASE_CREDENTIALS_PATH=./firebase-credentials.json
```

---

## 🧪 Testing the Integration

### Test 1: Upload a Single Image

```bash
# Create a test image (or use your own)
curl -o test-image.jpg https://images.unsplash.com/photo-1546069901-ba9599a7e63c

# Run the test
npx tsx src/storage/example-usage.ts
```

### Test 2: Check WebP Conversion

```bash
# The upload should show:
✅ WebP conversion: 2.5 MB → 850 KB (66% savings)
```

### Test 3: Verify CDN URLs

```bash
# Open the URLs in your browser:
🔗 Original URL: https://...
🔗 WebP URL: https://...
🖼️  Thumbnails:
  Small (150px): https://...
  Medium (500px): https://...
  Large (1000px): https://...
```

### Test 4: Performance Test

```typescript
// test-storage-performance.ts
import { CloudStorageService } from './src/storage/CloudStorageService.js';

const storage = new CloudStorageService(/* config */);

const start = Date.now();
const result = await storage.uploadImage({
  file: imageBuffer,
  filename: 'test.jpg',
  convertToWebP: true,
  generateThumbnails: true,
});
const elapsed = Date.now() - start;

console.log(`Upload completed in ${elapsed}ms`);
// Expected: 500ms - 2000ms depending on image size
```

---

## 📊 Cost Estimates

### Scenario: 10,000 Photos/Month (~100MB average each)

#### Cloudflare R2:
```
Storage: 1 TB = $15/month
Operations: Within free tier = $0
Bandwidth: UNLIMITED = $0
────────────────────────────
Total: $15/month ✅
```

#### Supabase:
```
Storage: 1 TB = $25/month
Bandwidth: 1 TB = $90/month
────────────────────────────
Total: $115/month ❌
```

#### Firebase:
```
Storage: 1 TB = $25/month
Bandwidth: 1 TB = $120/month
────────────────────────────
Total: $145/month ❌
```

**Savings with R2: $100-130/month!**

---

## 🔧 Troubleshooting

### Issue: "Access Denied" Error

**Solution:**
```bash
# Check your credentials
echo $CLOUDFLARE_ACCESS_KEY_ID
echo $CLOUDFLARE_SECRET_ACCESS_KEY

# Verify bucket permissions in Cloudflare dashboard
# Ensure API token has "Object Read & Write" permissions
```

### Issue: "Bucket Not Found"

**Solution:**
```bash
# Verify bucket name matches exactly
CLOUDFLARE_BUCKET=recipe-images  # must match dashboard

# Check your account ID is correct
CLOUDFLARE_ACCOUNT_ID=...
```

### Issue: Images Not Loading (404)

**Solution:**
```bash
# Option 1: Use custom domain (recommended)
CLOUDFLARE_PUBLIC_DOMAIN=images.yourdomain.com

# Option 2: Enable public access on bucket
# In Cloudflare Dashboard:
# Bucket Settings → Public Access → Enable

# Option 3: Use signed URLs
const signedUrl = await storage.getSignedUrl(key, 3600);
```

### Issue: WebP Conversion Failed

**Solution:**
```bash
# Ensure Sharp is properly installed
pnpm install sharp --force

# On Linux, you may need system dependencies:
apt-get install libvips-dev

# On macOS:
brew install vips
```

### Issue: Slow Upload Speed

**Possible causes:**
1. Large image size (>5MB) - optimize before upload
2. Network latency - use regional buckets
3. Too many thumbnails - reduce sizes

**Solution:**
```typescript
// Optimize before upload
const optimized = await imageOptimizer.optimizeImage(buffer, 80);

// Reduce thumbnail count
generateThumbnails: false,  // or only generate on-demand
```

---

## 🎯 Best Practices

### 1. Use WebP Format
```typescript
convertToWebP: true,  // 50-70% file size reduction!
```

### 2. Generate Thumbnails
```typescript
generateThumbnails: true,  // Faster page loads
```

### 3. Set Appropriate Cache Headers
```typescript
// Already configured in CloudStorageService:
CacheControl: 'public, max-age=31536000',  // 1 year
```

### 4. Use Custom Domain for CDN
```bash
# Better performance + SEO
CLOUDFLARE_PUBLIC_DOMAIN=images.yourdomain.com
```

### 5. Implement Lazy Loading
```html
<img
  src="placeholder-20px.webp"
  data-src="full-image.webp"
  loading="lazy"
/>
```

### 6. Monitor Storage Usage
```bash
# Check Cloudflare R2 dashboard regularly
# Set up alerts for 80% storage usage
```

---

## 📚 Additional Resources

- [Cloudflare R2 Docs](https://developers.cloudflare.com/r2/)
- [Supabase Storage Docs](https://supabase.com/docs/guides/storage)
- [Firebase Storage Docs](https://firebase.google.com/docs/storage)
- [Sharp Image Processing](https://sharp.pixelplumbing.com/)
- [WebP Format Guide](https://developers.google.com/speed/webp)

---

## 🆘 Need Help?

1. Check the [Troubleshooting](#troubleshooting) section above
2. Review example usage in `src/storage/example-usage.ts`
3. Run the test suite: `pnpm test`
4. Open an issue on GitHub

---

**Next Steps:**

1. ✅ Set up Cloudflare R2 (10 minutes)
2. ✅ Configure environment variables
3. ✅ Test with a sample image
4. ✅ Integrate with your recipe scraper
5. ✅ Deploy to production!

**Total setup time: ~15 minutes** ⏱️
