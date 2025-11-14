# 🚀 Production Deployment Guide

Complete guide for deploying the Recipe Scraper with Cloudflare R2 + Supabase infrastructure to production.

## 📋 Pre-Deployment Checklist

### 1. Infrastructure Setup

- [ ] Cloudflare R2 bucket created and configured
- [ ] Supabase project created
- [ ] Database migrations applied
- [ ] Environment variables configured
- [ ] Custom domain configured (optional but recommended)

### 2. Security

- [ ] API keys rotated and secured
- [ ] Row-level security policies enabled
- [ ] CORS configured properly
- [ ] Rate limiting enabled
- [ ] Backup strategy in place

### 3. Performance

- [ ] CDN configured
- [ ] Image optimization enabled (WebP, thumbnails)
- [ ] Database indexes created
- [ ] Connection pooling configured
- [ ] Caching strategy implemented

---

## 🛠️ Step-by-Step Deployment

### Phase 1: Infrastructure Setup (30 minutes)

#### 1.1 Set Up Cloudflare R2

```bash
# 1. Create Cloudflare account (if needed)
# Visit: https://dash.cloudflare.com/sign-up

# 2. Enable R2
# Go to R2 → Purchase R2 Plan (free!)

# 3. Create bucket
# Name: recipe-images-production
# Region: Automatic

# 4. Generate API credentials
# R2 → Manage API Tokens → Create API Token
# Permissions: Object Read & Write
# Scope: Specific bucket → recipe-images-production

# 5. Save credentials
export CLOUDFLARE_ACCOUNT_ID="your-account-id"
export CLOUDFLARE_ACCESS_KEY_ID="your-access-key"
export CLOUDFLARE_SECRET_ACCESS_KEY="your-secret-key"
```

#### 1.2 Configure Custom Domain (Recommended)

```bash
# 1. In Cloudflare R2 dashboard:
# Bucket → Settings → Connect Domain

# 2. Add subdomain:
# images.yourdomain.com

# 3. Cloudflare will automatically:
# - Create DNS records
# - Enable HTTPS
# - Configure CDN caching

# 4. Update environment:
export CLOUDFLARE_PUBLIC_DOMAIN="images.yourdomain.com"
```

#### 1.3 Set Up Supabase

```bash
# 1. Create Supabase project
# Visit: https://supabase.com/dashboard

# 2. Apply database migrations
cd supabase
supabase db push

# Or manually run:
psql $DATABASE_URL < migrations/20250114_create_recipe_images_table.sql

# 3. Enable Row Level Security
# Already configured in migration!

# 4. Save credentials
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
```

---

### Phase 2: Application Deployment (20 minutes)

#### 2.1 Environment Configuration

Create `.env.production`:

```bash
# Cloud Storage (Cloudflare R2)
CLOUD_STORAGE_PROVIDER=cloudflare-r2
CLOUDFLARE_ACCOUNT_ID=your-account-id
CLOUDFLARE_ACCESS_KEY_ID=your-access-key-id
CLOUDFLARE_SECRET_ACCESS_KEY=your-secret-access-key
CLOUDFLARE_BUCKET=recipe-images-production
CLOUDFLARE_PUBLIC_DOMAIN=images.yourdomain.com

# Database (Supabase)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key
DATABASE_URL=postgresql://postgres:password@db.project.supabase.co:5432/postgres

# Image Processing
STORAGE_MAX_FILE_SIZE=10485760
STORAGE_DEFAULT_QUALITY=80
STORAGE_CONVERT_TO_WEBP=true
STORAGE_GENERATE_THUMBNAILS=true
STORAGE_CDN_ENABLED=true

# Application
NODE_ENV=production
LOG_LEVEL=info
PORT=3000
```

#### 2.2 Build and Deploy

```bash
# 1. Install dependencies
pnpm install --production

# 2. Build TypeScript
pnpm run build

# 3. Test configuration
pnpm run storage:config

# 4. Run test upload
pnpm run storage:test

# 5. Start application
NODE_ENV=production pnpm run start:api
```

#### 2.3 Deploy to Platform

**Option A: Vercel**

```bash
# 1. Install Vercel CLI
npm i -g vercel

# 2. Deploy
vercel --prod

# 3. Set environment variables in dashboard
# Go to: Project → Settings → Environment Variables
# Add all variables from .env.production
```

**Option B: Railway**

```bash
# 1. Install Railway CLI
npm i -g @railway/cli

# 2. Login
railway login

# 3. Initialize
railway init

# 4. Add environment variables
railway variables set CLOUDFLARE_ACCOUNT_ID=...
# (repeat for all variables)

# 5. Deploy
railway up
```

**Option C: Docker**

```bash
# 1. Build image
docker build -t recipe-scraper-prod .

# 2. Run container
docker run -p 3000:3000 \
  --env-file .env.production \
  recipe-scraper-prod

# 3. Or use docker-compose
docker-compose -f docker-compose.prod.yml up -d
```

---

### Phase 3: Post-Deployment (15 minutes)

#### 3.1 Verify Deployment

```bash
# Test storage endpoint
curl -X POST https://your-domain.com/api/storage/test

# Test recipe scraping with image upload
curl -X POST https://your-domain.com/api/scrape \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/recipe"}'

# Check storage stats
curl https://your-domain.com/api/storage/stats
```

#### 3.2 Monitor Initial Traffic

```bash
# Check Cloudflare R2 dashboard for:
- Upload success rate
- Request patterns
- Storage usage

# Check Supabase dashboard for:
- Database queries
- Connection pool usage
- Error logs
```

#### 3.3 Set Up Monitoring (Recommended)

**Sentry for Error Tracking:**

```bash
npm install @sentry/node

# In your app:
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: 'production',
});
```

**CloudWatch/Logging:**

```typescript
// Log all storage operations
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
});

logger.info({
  event: 'image_uploaded',
  recipeId,
  size: result.metadata.size,
  processingTime: result.processingTime,
});
```

---

## 📊 Performance Optimization

### 1. Database Optimization

```sql
-- Ensure indexes are created
CREATE INDEX CONCURRENTLY idx_recipe_images_recipe_id
  ON recipe_images(recipe_id);

-- Enable connection pooling in Supabase dashboard
-- Settings → Database → Connection Pooling → Enabled

-- Monitor slow queries
SELECT * FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

### 2. CDN Optimization

```bash
# Configure cache headers (already set in code):
Cache-Control: public, max-age=31536000

# Cloudflare automatically:
- Caches images at 275+ locations
- Serves from nearest edge server
- Handles DDoS protection
```

### 3. Image Optimization

```typescript
// Already configured in code:
- WebP conversion (50-70% size reduction)
- Multi-size thumbnails (150px, 500px, 1000px)
- Quality optimization (80 default)
- Lazy loading support
```

---

## 🔒 Security Best Practices

### 1. API Key Management

```bash
# NEVER commit API keys to git
# Use environment variables or secrets manager

# Rotate keys regularly
# In Cloudflare: R2 → API Tokens → Regenerate

# In Supabase: Settings → API → Reset service role key
```

### 2. Row Level Security

```sql
-- Already configured in migration
-- Verify policies are active:
SELECT * FROM pg_policies WHERE tablename = 'recipe_images';

-- Test RLS:
SET ROLE anon;
SELECT * FROM recipe_images; -- Should only see public images
```

### 3. Rate Limiting

```typescript
// Add to your API endpoints
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});

app.use('/api/storage', limiter);
```

---

## 💰 Cost Monitoring

### Track Monthly Costs

**Cloudflare R2:**
```bash
# Check usage in dashboard:
# R2 → Bucket → Usage

# Expected costs (100k DAU):
# - Storage (1TB): $15/month
# - Operations: $0-5/month
# - Bandwidth: $0 (zero egress!)
# Total: ~$15-20/month
```

**Supabase:**
```bash
# Check usage in dashboard:
# Project → Settings → Billing

# Free tier limits:
# - Database: 500MB (upgrade at 400MB)
# - API requests: Unlimited

# Pro plan ($25/month):
# - Database: 8GB
# - Connection pooling
# - Point-in-time recovery
```

**Set Up Alerts:**
```bash
# Cloudflare: R2 → Notifications
# Alert when storage > 8GB (near free tier limit)

# Supabase: Settings → Notifications
# Alert when DB > 400MB
```

---

## 🔄 Backup Strategy

### 1. Database Backups

```bash
# Supabase Pro: Automatic daily backups
# Point-in-time recovery (7 days)

# Manual backup:
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql

# Automated backups:
# Use Supabase CLI or GitHub Actions
```

### 2. Image Backups

```bash
# Option 1: S3 replication
# R2 → Bucket → Settings → Replication
# Enable replication to second region

# Option 2: Periodic sync to backup bucket
aws s3 sync r2://recipe-images s3://backup-bucket \
  --endpoint-url https://account.r2.cloudflarestorage.com
```

---

## 📈 Scaling Guidelines

### 10k DAU → 50k DAU

1. **Upgrade Supabase to Pro** ($25/month)
   - Enables connection pooling
   - Better performance
   - Daily backups

2. **Monitor R2 usage**
   - Storage growth: ~100GB → 500GB
   - Still within free operations limits

3. **Add Redis cache** (optional)
   - Upstash Redis: $10/month
   - Cache database queries
   - Reduce Supabase load

### 50k DAU → 100k DAU

1. **Consider Supabase Team plan** ($599/month)
   - If DB > 8GB
   - Higher connection limits
   - Better support

2. **R2 costs increase**
   - Storage: ~1-3TB ($15-45/month)
   - Still $0 egress!

3. **Add read replicas**
   - Distribute read load
   - Faster global access

### 100k+ DAU

1. **Supabase Enterprise**
   - Dedicated resources
   - Custom pricing
   - SLA guarantees

2. **Multi-region deployment**
   - Deploy API in multiple regions
   - Use R2 + regional Supabase
   - Better global performance

---

## 🐛 Troubleshooting

### Common Issues

**1. Images not loading (404)**
```bash
# Check bucket is public
# R2 → Bucket → Settings → Public Access → Enabled

# Or use signed URLs
const signedUrl = await storage.getSignedUrl(key, 3600);
```

**2. Slow uploads**
```bash
# Check image size
# Compress images before upload if > 5MB

# Check network
# Ensure server has good connection to Cloudflare

# Enable compression
# Already handled by WebP conversion
```

**3. Database connection errors**
```bash
# Check connection pool
# Supabase: Settings → Database → Connection Pooling

# Reduce concurrent connections
# In code: set maxConnections limit

# Use PgBouncer
# Already included in Supabase Pro+
```

---

## ✅ Production Checklist

Before going live:

- [ ] All environment variables set correctly
- [ ] Database migrations applied
- [ ] R2 bucket configured with CDN
- [ ] Test upload successful
- [ ] Error tracking configured
- [ ] Backup strategy in place
- [ ] Rate limiting enabled
- [ ] Monitoring dashboards set up
- [ ] Cost alerts configured
- [ ] Documentation updated
- [ ] Team trained on monitoring
- [ ] Rollback plan documented

---

## 📚 Additional Resources

- [Cloudflare R2 Docs](https://developers.cloudflare.com/r2/)
- [Supabase Production Best Practices](https://supabase.com/docs/guides/platform/going-into-prod)
- [Image Optimization Guide](https://web.dev/fast/#optimize-your-images)
- [PostgreSQL Performance Tuning](https://wiki.postgresql.org/wiki/Performance_Optimization)

---

**Need help?** Check `CLOUD_STORAGE_SETUP.md` or `INFRASTRUCTURE_DECISION.md`

**Ready to deploy!** 🚀
