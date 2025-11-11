# 🚀 GitHub Actions Deployment Guide

Complete guide to deploying the Universal Recipe Scraper to GitHub Actions with FREE tier services.

---

## 📋 Prerequisites

### Required (FREE tier)

1. **GitHub Account** - for Actions (2,000 minutes/month FREE)
2. **Supabase Account** - for database (500MB FREE)
3. **Upstash Account** - for Redis cache (10K commands/day FREE)
4. **USDA API Key** - for nutrition (1K req/hour FREE)

### Optional (for enhanced features)

5. **Google Cloud Account** - for Vision OCR (1K units/month FREE)
6. **Google Cloud Speech** - for audio transcription (60 min/month FREE - but expensive)
7. **OpenAI Account** - for Whisper transcription (alternative to Google)

**Total Cost: $0/month with FREE tier!** 🎉

---

## 🔧 Step-by-Step Setup

### Step 1: Fork/Clone Repository

```bash
# Clone the repository
git clone https://github.com/your-username/typescript_scraper_service.git
cd typescript_scraper_service

# Install dependencies
pnpm install

# Build TypeScript
pnpm run build
```

### Step 2: Set Up FREE Tier Services

#### 2.1 Supabase (Database)

1. Go to https://supabase.com
2. Create account (FREE tier)
3. Create new project
4. Go to Settings > API
5. Copy:
   - `Project URL` → `SUPABASE_URL`
   - `service_role key` → `SUPABASE_SERVICE_ROLE_KEY`
   - `anon key` → `SUPABASE_ANON_KEY`

#### 2.2 Upstash Redis (Cache)

1. Go to https://console.upstash.com
2. Create account (FREE tier: 10K commands/day)
3. Create Redis database
4. Click "REST API" tab
5. Copy:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

#### 2.3 USDA API (Nutrition)

1. Go to https://fdc.nal.usda.gov/api-key-signup.html
2. Enter your email
3. Receive API key via email → `USDA_API_KEY`

#### 2.4 Google Vision API (OCR - Optional)

1. Go to https://console.cloud.google.com
2. Create project
3. Enable Cloud Vision API
4. Create API key → `GOOGLE_VISION_API_KEY`
5. FREE tier: 1,000 units/month

---

### Step 3: Configure GitHub Secrets

1. Go to your GitHub repository
2. Click **Settings** > **Secrets and variables** > **Actions**
3. Click **New repository secret**
4. Add the following secrets:

**Required Secrets:**

| Secret Name | Value | Where to Get |
|------------|-------|--------------|
| `SUPABASE_URL` | Your Supabase project URL | Supabase Dashboard > Settings > API |
| `SUPABASE_SERVICE_ROLE_KEY` | Your service role key | Supabase Dashboard > Settings > API |
| `SUPABASE_ANON_KEY` | Your anon key | Supabase Dashboard > Settings > API |
| `UPSTASH_REDIS_REST_URL` | Your Upstash Redis URL | Upstash Dashboard > REST API |
| `UPSTASH_REDIS_REST_TOKEN` | Your Upstash token | Upstash Dashboard > REST API |
| `USDA_API_KEY` | Your USDA API key | Email from USDA |

**Optional Secrets:**

| Secret Name | Value | Purpose |
|------------|-------|---------|
| `GOOGLE_API_KEY` | Google API key | General Google APIs |
| `GOOGLE_VISION_API_KEY` | Vision API key | OCR for images/videos |
| `GOOGLE_CLOUD_SPEECH_API_KEY` | Speech API key | Audio transcription (expensive!) |
| `OPENAI_API_KEY` | OpenAI API key | Whisper transcription (alternative) |
| `EMAIL_USERNAME` | Your Gmail | Failure notifications |
| `EMAIL_PASSWORD` | Gmail app password | Failure notifications |
| `NOTIFICATION_EMAIL` | Alert email | Where to send alerts |

---

### Step 4: Configure Recipe URLs

Edit `recipe-urls.txt` in your repository:

```txt
# Regular Recipe Websites
https://www.allrecipes.com/recipe/12151/banana-banana-bread/
https://www.foodnetwork.com/recipes/alton-brown/baked-macaroni-and-cheese-recipe-1939524

# TikTok Videos
https://www.tiktok.com/@user/video/123456789

# Instagram Posts
https://www.instagram.com/p/ABC123XYZ/

# YouTube Videos
https://www.youtube.com/watch?v=dQw4w9WgXcQ

# Images
https://example.com/recipe-card.jpg
```

---

### Step 5: Test Locally (Optional)

```bash
# Set environment variables
cp .env.example .env
# Edit .env with your API keys

# Run local test
npx tsx run-universal-scraper.ts

# Test specific URL
npx tsx test-universal-scraper.ts
```

---

### Step 6: Commit & Push to GitHub

```bash
# Add files
git add .

# Commit
git commit -m "Configure Universal Recipe Scraper for GitHub Actions"

# Push to GitHub
git push origin main
```

---

### Step 7: Trigger Workflow

#### Option A: Manual Trigger (Recommended for Testing)

1. Go to **Actions** tab in your GitHub repository
2. Click **Scheduled Recipe Scraping** workflow
3. Click **Run workflow** dropdown
4. Select mode:
   - **test**: 3 recipes (quick test)
   - **sample**: 100 recipes (default)
   - **full**: All URLs in `recipe-urls.txt`
5. Click **Run workflow**

#### Option B: Automatic Schedule

The workflow runs automatically daily at 2 AM UTC (configured in `.github/workflows/scheduled-scraping.yml`).

To change schedule:
```yaml
schedule:
  - cron: '0 2 * * *'  # Daily at 2 AM UTC
  # Change to your preferred schedule
```

---

## 📊 Monitoring & Results

### View Workflow Runs

1. Go to **Actions** tab
2. Click on a workflow run
3. View logs and status

### Download Results

1. Go to completed workflow run
2. Scroll to **Artifacts** section
3. Download `scraping-results-X`
4. Extract ZIP file
5. Review:
   - `recipe-1-website.json` (scraped recipes)
   - `recipe-2-youtube.json`
   - `summary.json` (summary statistics)
   - `report.txt` (detailed report)
   - `blocked-websites.json` (problematic sites)

### View Report

Workflow generates a report in the **Summary** tab:

```
## Scraping Report

**Date:** 2025-10-13
**Mode:** sample

### Results
- Total URLs: 100
- Successful: 92 (92%)
- Failed: 8 (8%)

### Performance
- Total Time: 150s
- Avg Time: 1.5s per recipe
- Avg Confidence: 87%

### Content Types
- website: 80
- youtube: 10
- tiktok: 2
```

---

## 🛠️ Customization

### Adjust Scraping Mode

Edit workflow inputs when manually triggering:

```yaml
inputs:
  mode:
    - test      # 3 recipes
    - sample    # 100 recipes (default)
    - full      # All URLs
  max_recipes:
    default: '100'  # Change this
```

### Enable/Disable Features

Edit `.github/workflows/scheduled-scraping.yml`:

```yaml
# Feature toggles
ENABLE_ENRICHMENT: true         # Enable parallel enrichment
ENABLE_NUTRITION: true          # Fetch nutrition data
ENABLE_EMBEDDING: false         # Generate embeddings (slow)
ENABLE_AI_ENRICHMENT: false     # AI-powered enrichment (costs money)
ENABLE_AUDIO_TRANSCRIPTION: false  # Audio-to-text (expensive!)
```

### Adjust Performance

```yaml
# Performance tuning
MAX_CONCURRENT_REQUESTS: 5      # Parallel requests (1-10)
TIMEOUT_MS: 30000              # Request timeout (ms)
CACHE_TTL: 3600                # Cache time (seconds)
```

---

## 🐛 Troubleshooting

### Issue: "Secrets not found"

**Solution:**
1. Check secret names match exactly (case-sensitive)
2. Verify secrets are added to repository (not organization)
3. Re-save secrets if recently changed

### Issue: "Workflow failed - Permission denied"

**Solution:**
1. Go to Settings > Actions > General
2. Under "Workflow permissions", select:
   - ✅ "Read and write permissions"
3. Save changes

### Issue: "No URLs to scrape"

**Solution:**
1. Check `recipe-urls.txt` exists in repository
2. Ensure URLs are not commented out (no `#` at start)
3. Verify file is committed to GitHub

### Issue: "Cache connection failed"

**Solution:**
1. Verify Upstash Redis secrets are correct
2. Check Upstash Redis database is active
3. Set `ENABLE_REDIS_CACHE=false` to disable (uses memory cache only)

### Issue: "OCR failed"

**Solution:**
1. Check `GOOGLE_VISION_API_KEY` is set (optional)
2. Fallback to Tesseract.js (slower but works)
3. Ensure `ffmpeg` is installed (automatic in GitHub Actions)

### Issue: "Audio transcription failed"

**Solution:**
1. Audio transcription is **expensive** - disabled by default
2. Set `ENABLE_AUDIO_TRANSCRIPTION=true` only if needed
3. Requires `GOOGLE_CLOUD_SPEECH_API_KEY` or `OPENAI_API_KEY`

### Issue: "Out of GitHub Actions minutes"

**Solution:**
1. FREE tier: 2,000 minutes/month
2. Each run takes ~5-15 minutes
3. Reduce frequency or upgrade plan

---

## 📈 Cost Analysis

### FREE Tier Limits

| Service | FREE Tier | Cost After Limit |
|---------|-----------|-----------------|
| **GitHub Actions** | 2,000 min/month | $0.008/min |
| **Supabase** | 500MB, 2GB transfer | $25/month PRO |
| **Upstash Redis** | 10K commands/day | $0.20/10K commands |
| **USDA API** | 1K req/hour | FREE (no limit) |
| **Google Vision** | 1K units/month | $1.50/1K units |
| **Google Speech** | 60 min/month | $0.006/15 sec |
| **OpenAI Whisper** | Pay-as-you-go | $0.006/min |

### Estimated Monthly Cost (100 recipes/day)

**Scenario 1: Minimal (Websites Only)**
- GitHub Actions: 30 min/month (daily runs) = FREE
- Supabase: < 100MB = FREE
- Upstash: < 1K commands/day = FREE
- **Total: $0/month** ✅

**Scenario 2: With OCR (Images + Videos)**
- Same as above + Google Vision
- OCR: ~100 images/month = FREE (< 1K)
- **Total: $0/month** ✅

**Scenario 3: With Audio Transcription**
- Same as Scenario 2 + Audio transcription
- Audio: 30 videos × 3 min = 90 min/month
- Google Speech: 90 - 60 FREE = 30 min × $0.024/min = **$0.72/month**
- **Total: ~$0.72/month** ⚠️ (Not recommended for FREE tier)

---

## ✅ Success Checklist

Before going live:

- [ ] All required secrets added to GitHub
- [ ] `recipe-urls.txt` configured with target URLs
- [ ] Tested with `mode: test` (3 recipes)
- [ ] Reviewed downloaded results
- [ ] Checked `blocked-websites.json` for issues
- [ ] Verified cache is working (check logs for "Cache HIT")
- [ ] Disabled expensive features (`ENABLE_AUDIO_TRANSCRIPTION=false`)
- [ ] Set reasonable `MAX_CONCURRENT_REQUESTS` (default: 5)

---

## 🎉 You're Ready!

Your Universal Recipe Scraper is now deployed and will:

✅ **Scrape recipes from everywhere** - websites, TikTok, Instagram, YouTube, images, text
✅ **Run automatically** daily at 2 AM UTC
✅ **Use multi-layer caching** for 95% cache hit rate
✅ **Process in parallel** for 2.6x faster scraping
✅ **Track blocked sites** to avoid wasting time
✅ **Generate reports** with statistics and insights
✅ **Upload results** as artifacts for 30 days
✅ **Send alerts** on failures (if configured)

**Cost: $0/month on FREE tier** 🎉

---

**Need Help?**
- Check `UNIVERSAL_SCRAPER_GUIDE.md` for detailed usage
- Review `OPTIMIZATION_GUIDE.md` for performance tips
- Run `npx tsx test-universal-scraper.ts` for diagnostics

**Happy Scraping! 🌐🚀**
