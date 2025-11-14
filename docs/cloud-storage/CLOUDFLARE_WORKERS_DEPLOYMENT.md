# Cloudflare Workers Deployment Guide

## Why Cloudflare Workers?

**Optimized for image-heavy recipe scraping:**
- ✅ **Zero egress fees** between Workers and R2 (same network!)
- ✅ **Ultra-fast uploads** - <10ms to R2
- ✅ **Global edge deployment** - 275+ locations
- ✅ **3M requests/month FREE** tier
- ✅ **Cost: ~$45-55/month** at 100k DAU

**vs Vercel:** Saves $15-20/month, faster R2 access
**vs Supabase Edge:** Better R2 integration, more generous free tier

---

## Prerequisites

1. **Cloudflare Account** (free)
   - Sign up at https://dash.cloudflare.com/sign-up

2. **Wrangler CLI** (already installed)
   ```bash
   pnpm install  # Wrangler is in devDependencies
   ```

3. **Cloudflare R2 Bucket** (see setup below)

4. **Supabase Project** (for PostgreSQL database)

---

## Quick Start (5 Minutes)

### 1. Authenticate with Cloudflare

```bash
npx wrangler login
```

This opens a browser to authorize Wrangler.

### 2. Create R2 Bucket

```bash
npx wrangler r2 bucket create recipe-images
npx wrangler r2 bucket create recipe-images-dev
```

### 3. Configure `wrangler.toml`

Update your account ID in `wrangler.toml`:

```toml
# Get your account ID from: https://dash.cloudflare.com/
account_id = "your-account-id-here"
```

Find your account ID:
```bash
npx wrangler whoami
```

### 4. Set Secrets

```bash
# Supabase credentials
npx wrangler secret put SUPABASE_URL
# Paste: https://yourproject.supabase.co

npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
# Paste from Supabase dashboard → Settings → API

npx wrangler secret put SUPABASE_ANON_KEY
# Paste from Supabase dashboard → Settings → API
```

### 5. Deploy!

```bash
pnpm run deploy:worker
```

Your API is now live at: `https://recipe-scraper-api.your-subdomain.workers.dev`

---

## Development

### Local Development

```bash
pnpm run dev:worker
```

This starts a local dev server at `http://localhost:8787`

**Features:**
- Hot reload on code changes
- Local R2 simulation
- Access to environment variables
- Full debugging support

### Test the API

```bash
# Health check
curl http://localhost:8787/health

# Upload image
curl -X POST http://localhost:8787/api/upload \
  -F "image=@test-image.jpg" \
  -F "recipeId=recipe-123"

# Get storage stats
curl http://localhost:8787/api/storage/stats
```

---

## Production Deployment

### Option 1: Custom Domain

1. Add a route in `wrangler.toml`:

```toml
[[routes]]
pattern = "api.yourdomain.com/*"
zone_name = "yourdomain.com"
```

2. Deploy:

```bash
pnpm run deploy:worker
```

3. Add DNS record in Cloudflare:
   - Type: `AAAA`
   - Name: `api`
   - Content: `100::` (Workers placeholder)
   - Proxy: ✅ Enabled

### Option 2: workers.dev Subdomain

Keep the default `*.workers.dev` subdomain (easiest):

```toml
workers_dev = true
```

Your API will be at: `https://recipe-scraper-api.your-subdomain.workers.dev`

---

## Environment Management

### Development

```bash
npx wrangler dev
```

Uses the `[env.development]` configuration from `wrangler.toml`.

### Staging

```bash
npx wrangler deploy --env staging
```

Deploys to: `recipe-scraper-api-staging.workers.dev`

### Production

```bash
npx wrangler deploy
```

Deploys to: `recipe-scraper-api.workers.dev` or your custom domain.

---

## API Endpoints

Once deployed, your Workers API provides:

### `GET /health`
Health check endpoint

**Response:**
```json
{
  "status": "healthy",
  "service": "recipe-scraper-api",
  "deployment": "cloudflare-workers",
  "storage": "cloudflare-r2"
}
```

### `POST /api/scrape`
Scrape a recipe with automatic image processing

**Request:**
```json
{
  "url": "https://example.com/recipe"
}
```

**Response:**
```json
{
  "success": true,
  "imageId": "uuid",
  "webpUrl": "/api/images/...",
  "thumbnailUrls": {...},
  "metadata": {
    "webpSavings": 456789,
    "processingTime": 1234
  }
}
```

### `POST /api/upload`
Direct image upload

**Request:** (multipart/form-data)
- `image`: File
- `recipeId`: string (optional)
- `description`: string (optional)

**Response:**
```json
{
  "success": true,
  "imageId": "uuid",
  "webpUrl": "/api/images/...",
  "thumbnailUrls": {...}
}
```

### `GET /api/images/{path}`
Retrieve image from R2

**Features:**
- Zero egress fees (Workers + R2 same network!)
- Automatic caching headers
- Global CDN delivery
- WebP format (optimized)

### `GET /api/storage/stats`
Storage statistics

**Response:**
```json
{
  "totalImages": 1234,
  "totalOriginalSize": 987654321,
  "totalWebpSize": 345678901,
  "totalSavings": 641975420,
  "savingsPercentage": "65.02"
}
```

---

## Cost Breakdown

### Free Tier
- **100,000 requests/day** (~3M/month)
- **10ms CPU time** per request
- **R2:** 10GB storage free
- **R2:** Zero egress fees (unlimited bandwidth!)

### Paid Usage (after free tier)

| Resource | Free Tier | Paid Rate |
|----------|-----------|-----------|
| Requests | 3M/month | $0.50/million |
| CPU Time | Included | $0.02/million GB-s |
| R2 Storage | 10GB | $0.015/GB/month |
| R2 Operations | 1M/month | $4.50/million writes |
| Egress | **FREE** | **FREE** ⭐ |

### Example Cost (100k DAU)

**Assumptions:**
- 10M requests/month (100k DAU × 3 requests/day × 30 days)
- 50GB image storage
- 5M image uploads/month

**Calculation:**
```
Workers:
  Requests: (10M - 3M free) × $0.50/M = $3.50
  CPU: ~$2.00

R2:
  Storage: (50GB - 10GB free) × $0.015 = $0.60
  Writes: (5M - 1M free) × $4.50/M = $18.00
  Egress: $0 (FREE!)

Supabase PostgreSQL: $25/month (Pro plan)

TOTAL: ~$49/month
```

**vs Vercel:** $60-80/month
**vs Firebase:** $900+/month

**Savings: $11-31/month (23-50% cheaper)**

---

## Monitoring & Debugging

### View Logs

```bash
npx wrangler tail
```

Real-time logs from production Workers.

### Analytics Dashboard

Visit: https://dash.cloudflare.com → Workers & Pages → Your Worker → Metrics

**Metrics available:**
- Requests per second
- Success rate
- CPU time usage
- Errors
- Request latency

### R2 Storage Dashboard

Visit: https://dash.cloudflare.com → R2 → recipe-images

**Metrics:**
- Storage usage
- Number of objects
- Class A/B operations

---

## Performance Optimization

### 1. Edge Caching

Workers run at the edge (275+ locations). Images are served from the nearest location to users.

### 2. Direct R2 Access

Using R2 bindings (not S3 API) means:
- **No network latency** - same data center
- **No egress fees** - free bandwidth
- **Faster uploads** - <10ms typically

### 3. WebP Conversion

Automatic WebP conversion reduces file sizes by 50-70%, saving:
- Storage costs
- Transfer time
- User bandwidth

---

## Troubleshooting

### Error: "R2 bucket not found"

Check bucket binding in `wrangler.toml`:
```toml
[[r2_buckets]]
binding = "RECIPE_IMAGES"
bucket_name = "recipe-images"  # Must match created bucket
```

### Error: "Missing secrets"

Set all required secrets:
```bash
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put SUPABASE_ANON_KEY
```

### Error: "CPU time exceeded"

Optimize image processing or upgrade to paid plan for higher limits.

### R2 Access Denied

Ensure R2 bucket exists and binding name matches `wrangler.toml`.

---

## Migration from Vercel

### What Changes

1. **Removed:** `vercel.json` configuration
2. **Added:** `wrangler.toml` configuration
3. **Updated:** API entry point to Workers format
4. **Optimized:** Direct R2 bindings instead of S3 API

### What Stays the Same

- ✅ Recipe scraping logic
- ✅ Image optimization code
- ✅ Supabase database
- ✅ API endpoint structure
- ✅ WebP conversion

### Migration Steps

1. Deploy to Workers (as above)
2. Test all endpoints
3. Update DNS (if using custom domain)
4. Monitor for 24-48 hours
5. Decommission Vercel deployment

---

## Advanced Features

### Custom Middleware

Add authentication, rate limiting, etc. in `src/workers/index.ts`:

```typescript
// Rate limiting
if (tooManyRequests) {
  return new Response('Rate limit exceeded', { status: 429 });
}

// Authentication
const apiKey = request.headers.get('X-API-Key');
if (!isValidKey(apiKey)) {
  return new Response('Unauthorized', { status: 401 });
}
```

### Durable Objects

For stateful operations (e.g., upload queues), add Durable Objects:

```toml
[[durable_objects.bindings]]
name = "UPLOAD_QUEUE"
class_name = "UploadQueue"
```

### KV Storage

For caching frequently accessed data:

```toml
[[kv_namespaces]]
binding = "CACHE"
id = "your-kv-namespace-id"
```

---

## Best Practices

1. **Use R2 bindings** - Faster than S3 API
2. **Enable caching headers** - Reduce repeated requests
3. **Optimize images** - WebP conversion is crucial
4. **Monitor costs** - Use Cloudflare dashboard
5. **Set up alerts** - Get notified of errors
6. **Use staging environment** - Test before production
7. **Keep secrets secure** - Never commit to git

---

## Support & Resources

- **Cloudflare Workers Docs:** https://developers.cloudflare.com/workers/
- **R2 Documentation:** https://developers.cloudflare.com/r2/
- **Wrangler CLI:** https://developers.cloudflare.com/workers/wrangler/
- **Discord:** https://discord.gg/cloudflaredev
- **Community:** https://community.cloudflare.com/

---

## Summary

**Cloudflare Workers + R2 + Supabase** provides:

✅ Best performance for image-heavy workloads
✅ Zero egress fees (unlimited bandwidth)
✅ Lowest cost at scale (~$49/month vs $60-900+)
✅ Global edge deployment
✅ Simple deployment with Wrangler

**Perfect for recipe scraping with image processing!** 🚀
