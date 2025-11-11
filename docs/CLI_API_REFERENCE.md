# Recipe Scraper Service - CLI & API Reference

A comprehensive TypeScript service for scraping, crawling, and processing recipes from websites and social media platforms. Supports both local CLI operations and deployed REST API server mode.

## 🚀 Quick Start

### Local Development (CLI)
```bash
# Install dependencies
pnpm install

# Build the project
pnpm run build

# Run CLI commands
pnpm run cli --help

# Start API server
pnpm run serve
```

### Docker Deployment
```bash
# Build and run with Docker
docker-compose up --build

# Or build manually
docker build -t recipe-scraper .
docker run -p 3000:3000 recipe-scraper
```

---

## 📋 CLI Commands Reference

### Installation & Setup
```bash
# Make CLI globally available
npm link
# or
pnpm link --global

# Now you can use 'recipe-scraper' command anywhere
recipe-scraper --help
```

### 🍽️ Recipe Commands

#### Scrape Single Recipe
```bash
recipe-scraper scrape-recipe <url> [options]

# Examples:
recipe-scraper scrape-recipe "https://allrecipes.com/recipe/213742/cheesy-chicken-broccoli-casserole/"
recipe-scraper scrape-recipe "https://foodnetwork.com/recipes/alton-brown/baked-macaroni-and-cheese-recipe-1939524" --no-enrich --output recipe.json
recipe-scraper scrape-recipe "https://bbcgoodfood.com/recipes/classic-lasagne" --format yaml --no-save

# Options:
--output, -o <file>     Output file path (JSON)
--no-enrich            Skip AI enrichment  
--no-save              Skip saving to database
--format <type>        Output format (json|csv|yaml) [default: json]
```

#### Database Management
```bash
# Export all recipes
recipe-scraper db export --format json --output recipes.json
recipe-scraper db export --format csv --output recipes.csv
recipe-scraper db export --format xlsx --output recipes.xlsx

# Database statistics
recipe-scraper db stats

# Health check
recipe-scraper db health
```

### 🌐 Website Commands

#### Crawl Full Website
```bash
recipe-scraper crawl-website <domain> [options]

# Examples:
recipe-scraper crawl-website allrecipes.com --depth 3 --limit 100
recipe-scraper crawl-website foodnetwork.com --sitemap --batch-size 5 --output ./results
recipe-scraper crawl-website bbcgoodfood.com --depth 2 --limit 50

# Options:
--depth, -d <number>      Maximum crawl depth [default: 3]
--limit, -l <number>      Maximum recipes to scrape
--sitemap                 Use sitemap for crawling (if available)
--output <dir>           Output directory for results
--batch-size <number>    Batch processing size [default: 10]
```

#### Website Management
```bash
# Add new website
recipe-scraper add-website <domain> --name "Website Name" [options]

# Examples:
recipe-scraper add-website epicurious.com --name "Epicurious" --url "https://epicurious.com" --test-url "https://epicurious.com/recipes/food/views/classic-beef-stew"

# List websites
recipe-scraper list-websites
recipe-scraper list-websites --active-only
recipe-scraper list-websites --format json
recipe-scraper list-websites --format csv

# Options for add-website:
--name, -n <name>        Website name (required)
--url, -u <url>          Main website URL
--test-url, -t <url>     Test recipe URL for validation
--sitemap <url>          Sitemap URL
```

#### Batch Processing
```bash
# Run batch processing
recipe-scraper batch-process
recipe-scraper batch-process --dry-run
recipe-scraper batch-process --parallel 5

# Options:
--config, -c <file>      Configuration file path
--dry-run               Show what would be processed without executing
--parallel <number>     Number of parallel workers [default: 3]
```

### 📱 Social Media Commands

#### Scrape Single Post
```bash
recipe-scraper scrape-social <url> [options]

# Examples:
recipe-scraper scrape-social "https://instagram.com/p/ABC123/" --ocr --transcript
recipe-scraper scrape-social "https://tiktok.com/@user/video/123" --platform tiktok
recipe-scraper scrape-social "https://youtube.com/watch?v=ABC123" --no-save

# Options:
--platform, -p <platform>  Platform (instagram|tiktok|youtube)
--ocr                      Enable OCR text extraction
--transcript               Enable video transcript extraction  
--no-save                  Skip saving to database
```

#### Scrape Full Account
```bash
recipe-scraper scrape-account <username> --platform <platform> [options]

# Examples:
recipe-scraper scrape-account "gordon_ramsay" --platform instagram --limit 50
recipe-scraper scrape-account "babish" --platform youtube --since 2024-01-01 --output ./social-results
recipe-scraper scrape-account "tasty" --platform tiktok --batch-size 3 --limit 30

# Options:
--platform, -p <platform>  Platform (instagram|tiktok|youtube) (required)
--limit, -l <number>       Maximum posts to scrape [default: 50]
--since <date>            Scrape posts since date (YYYY-MM-DD)
--output <dir>            Output directory for results
--batch-size <number>     Batch processing size [default: 5]
```

### 🖥️ Server Commands

#### Start API Server
```bash
recipe-scraper serve [options]

# Examples:
recipe-scraper serve --port 3000 --cors
recipe-scraper serve --host 0.0.0.0 --port 8080 --rate-limit 200

# Options:
--port, -p <number>      Server port [default: 3000]
--host, -h <host>        Server host [default: localhost]  
--cors                   Enable CORS
--rate-limit <number>    Rate limit per minute [default: 100]
```

---

## 🔌 REST API Reference

### Base URL
- **Local Development**: `http://localhost:3000`
- **Docker**: `http://localhost:3000`
- **Production**: `https://your-domain.com`

### 🏥 Health & Info Endpoints

#### Health Check
```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-08-07T18:30:00.000Z",
  "database": {
    "connected": true,
    "responseTime": "15ms",
    "version": "PostgreSQL 14.5"
  }
}
```

#### API Information
```http
GET /
```

#### API Documentation
```http
GET /api/docs
```

### 🍽️ Recipe API Endpoints

#### Scrape Single Recipe
```http
POST /api/recipes/scrape
Content-Type: application/json

{
  "url": "https://allrecipes.com/recipe/213742/cheesy-chicken-broccoli-casserole/",
  "enrich": true,
  "save": true
}
```

**Response:**
```json
{
  "success": true,
  "recipe": {
    "id": "uuid-here",
    "title": "Cheesy Chicken Broccoli Casserole",
    "ingredients": [...],
    "instructions": [...],
    "health_score": 75
  },
  "savedId": "uuid-here",
  "enriched": true,
  "saved": true,
  "timestamp": "2024-08-07T18:30:00.000Z"
}
```

#### Export Recipes
```http
GET /api/recipes/export?format=json&limit=100
GET /api/recipes/export?format=csv
GET /api/recipes/export?format=xlsx
```

#### Get Recipe Statistics
```http
GET /api/recipes/stats
```

#### Get Recipe by ID
```http
GET /api/recipes/{id}
```

#### Delete Recipe
```http
DELETE /api/recipes/{id}
```

### 🌐 Website API Endpoints

#### Crawl Website
```http
POST /api/websites/crawl
Content-Type: application/json

{
  "domain": "allrecipes.com",
  "depth": 3,
  "limit": 100,
  "useSitemap": false,
  "batchSize": 10
}
```

**Response (202 Accepted):**
```json
{
  "success": true,
  "message": "Crawling started",
  "jobId": "crawl-allrecipes.com-1691437800000",
  "estimatedUrls": 150,
  "startTime": "2024-08-07T18:30:00.000Z"
}
```

#### Add Website
```http
POST /api/websites
Content-Type: application/json

{
  "name": "Epicurious",
  "domain": "epicurious.com",
  "mainUrl": "https://epicurious.com",
  "testRecipeUrl": "https://epicurious.com/recipes/food/views/classic-beef-stew",
  "sitemapUrl": "https://epicurious.com/sitemap.xml",
  "notes": "High-quality recipe site"
}
```

#### List Websites
```http
GET /api/websites
GET /api/websites?activeOnly=true
```

#### Update Website
```http
PUT /api/websites/{domain}
Content-Type: application/json

{
  "status": "inactive",
  "notes": "Temporarily disabled"
}
```

#### Delete Website
```http
DELETE /api/websites/{domain}
```

#### Batch Processing
```http
POST /api/websites/batch
Content-Type: application/json

{
  "dryRun": false,
  "parallel": 3
}
```

### 📱 Social Media API Endpoints

#### Scrape Social Media Post
```http
POST /api/social/scrape
Content-Type: application/json

{
  "url": "https://instagram.com/p/ABC123/",
  "platform": "instagram",
  "enableOCR": true,
  "enableTranscription": false,
  "save": true
}
```

**Response:**
```json
{
  "success": true,
  "platform": "instagram",
  "recipe": {
    "title": "Instagram Recipe",
    "ingredients": [...],
    "instructions": [...],
    "hashtags": ["#recipe", "#cooking"],
    "ocr_text": "Text extracted from image"
  },
  "savedId": "uuid-here",
  "features": {
    "ocrEnabled": true,
    "transcriptionEnabled": false,
    "saved": true
  },
  "timestamp": "2024-08-07T18:30:00.000Z"
}
```

#### Scrape Social Media Account
```http
POST /api/social/account
Content-Type: application/json

{
  "username": "gordon_ramsay",
  "platform": "instagram",
  "limit": 50,
  "since": "2024-01-01",
  "batchSize": 5,
  "enableOCR": true,
  "enableTranscription": true
}
```

**Response (202 Accepted):**
```json
{
  "success": true,
  "message": "Account scraping started",
  "jobId": "account-instagram-gordon_ramsay-1691437800000",
  "account": {
    "username": "gordon_ramsay",
    "platform": "instagram",
    "limit": 50,
    "since": "2024-01-01"
  },
  "estimatedTime": "300 seconds",
  "startTime": "2024-08-07T18:30:00.000Z"
}
```

#### List Supported Platforms
```http
GET /api/social/platforms
```

#### Social Media Statistics
```http
GET /api/social/stats
```

---

## 🎯 Usage Examples

### Complete Website Crawling Workflow
```bash
# 1. Add a new website
recipe-scraper add-website "seriouseats.com" \
  --name "Serious Eats" \
  --url "https://seriouseats.com" \
  --test-url "https://seriouseats.com/best-chocolate-chip-cookies-recipe"

# 2. Crawl the website
recipe-scraper crawl-website "seriouseats.com" \
  --depth 3 \
  --limit 200 \
  --batch-size 15 \
  --output ./seriouseats-results

# 3. Check results
recipe-scraper db stats
```

### Social Media Recipe Discovery
```bash
# 1. Scrape a single TikTok recipe
recipe-scraper scrape-social "https://tiktok.com/@tasty/video/123456" \
  --platform tiktok \
  --ocr \
  --transcript

# 2. Scrape entire account
recipe-scraper scrape-account "babish" \
  --platform youtube \
  --limit 100 \
  --since "2024-01-01" \
  --batch-size 3

# 3. Export social media recipes
recipe-scraper db export --format json --output social-recipes.json
```

### API Integration Example
```javascript
// Scrape a recipe via API
const response = await fetch('http://localhost:3000/api/recipes/scrape', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    url: 'https://allrecipes.com/recipe/213742/cheesy-chicken-broccoli-casserole/',
    enrich: true,
    save: true
  })
});

const result = await response.json();
console.log('Scraped recipe:', result.recipe.title);
```

---

## 🔧 Configuration

### Environment Variables
```bash
# Required
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
DATABASE_URL=your_database_url

# Optional - AI Services  
GOOGLE_API_KEY=your_google_api_key
GOOGLE_VISION_API_KEY=your_vision_api_key
USDA_API_KEY=your_usda_api_key

# Optional - Configuration
MAX_RETRIES=3
TIMEOUT_MS=30000
CACHE_ENABLED=true
LITE_MODEL=false
```

### Website Configuration (CSV)
The system uses `data/recipe-websites.csv` for website configuration:

```csv
name,mainUrl,testRecipeUrl,status,domain,sitemapUrl,crawlable,notes
AllRecipes,https://allrecipes.com,https://allrecipes.com/recipe/213742/,active,allrecipes.com,https://allrecipes.com/sitemap.xml,true,Popular recipe site
Food Network,https://foodnetwork.com,https://foodnetwork.com/recipes/alton-brown/,active,foodnetwork.com,,true,Professional recipes
```

---

## 📊 Performance & Limits

### Rate Limits
- **API Server**: 100 requests/minute (configurable)
- **Social Media**: 30-second delays between batches
- **Website Crawling**: Respects robots.txt

### Batch Processing
- **Default Batch Size**: 10 recipes (websites), 5 posts (social media)
- **Parallel Processing**: Up to 3 concurrent workers
- **Memory Usage**: ~500MB for typical batch operations

### Supported Platforms
- ✅ **Websites**: Any site with structured recipe data
- ✅ **Instagram**: Posts, Reels, Stories  
- ✅ **TikTok**: Videos (requires yt-dlp)
- ✅ **YouTube**: Videos, Shorts
- 🔄 **Facebook**: Posts (limited)
- 🔄 **Twitter/X**: Tweets (limited)

---

## 🚨 Error Handling

### Common Error Codes
- **400**: Bad Request (missing parameters, invalid URL)
- **404**: Not Found (no recipe data, website not configured)
- **409**: Conflict (duplicate website)
- **429**: Rate Limited
- **500**: Internal Server Error

### Debugging
```bash
# Enable debug logging
export DEBUG=recipe-scraper:*

# Run with verbose output
recipe-scraper scrape-recipe <url> --verbose

# Check logs
tail -f logs/recipe-scraper.log
```

---

## 📈 Monitoring & Analytics

### Built-in Statistics
```bash
# CLI
recipe-scraper db stats

# API  
curl http://localhost:3000/api/recipes/stats
curl http://localhost:3000/api/social/stats
```

### Custom Monitoring
The service provides comprehensive logging and can integrate with monitoring systems like:
- Prometheus metrics
- New Relic APM
- DataDog
- Custom webhooks

---

## 🔒 Security & Best Practices

### API Security
- Rate limiting enabled by default
- CORS configurable for production
- Input validation on all endpoints
- SQL injection protection via parameterized queries

### Data Privacy
- Personal data anonymization
- Configurable data retention policies
- GDPR compliance features
- Secure credential management

### Production Deployment
```bash
# Use environment variables for secrets
# Enable HTTPS in production
# Configure proper rate limits
# Set up monitoring and alerting
# Regular database backups
```

---

## 🤝 Contributing & Support

### Development Setup
```bash
git clone <repo>
cd typescript_scraper_service
pnpm install
pnpm run build
pnpm test
```

### Adding New Platforms
1. Extend `SocialMediaScraper` class
2. Add platform detection in CLI/API
3. Update documentation
4. Add tests

For support, issues, or feature requests, please refer to the project repository.
