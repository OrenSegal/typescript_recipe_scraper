# Project Reorganization Plan

## Current Issues
- Scattered modules across 20+ directories
- Duplicate functionality in multiple places
- Poor separation of concerns
- Low crawl success rate (28.57%)
- Rate limiting issues (429 errors)

## New Structure (DRY, YAGNI, KISS, SOLID, Reusability)

```
src/
├── core/                     # Core business logic (SOLID - Single Responsibility)
│   ├── models/              # Data models and types
│   │   ├── Recipe.ts        # Recipe type definitions
│   │   ├── Ingredient.ts    # Ingredient types
│   │   └── index.ts         # Export all types
│   ├── services/            # Business services
│   │   ├── RecipeService.ts # Recipe processing logic
│   │   ├── DatabaseService.ts # Database operations
│   │   └── EnrichmentService.ts # Data enrichment
│   └── constants.ts         # Shared constants
│
├── infrastructure/          # External integrations (SOLID - Dependency Inversion)
│   ├── scrapers/           # Web scrapers
│   │   ├── UnifiedScraper.ts # Single scraper for all sites
│   │   └── SocialMediaScraper.ts # Social media scraping
│   ├── crawlers/           # Site crawlers
│   │   └── AdaptiveCrawler.ts # Smart crawler with rate limiting
│   ├── database/           # Database layer
│   │   └── SupabaseClient.ts # Supabase operations
│   └── api/                # REST API
│       └── server.ts       # API server
│
├── application/            # Application layer (KISS)
│   ├── cli/               # CLI commands
│   │   └── index.ts       # Unified CLI entry
│   └── workflows/         # Business workflows
│       └── RecipePipeline.ts # Complete pipeline
│
├── shared/                # Shared utilities (DRY)
│   ├── utils/            # Utility functions
│   ├── parsers/          # Parsing logic
│   └── validators/       # Validation logic
│
└── index.ts              # Main entry point
```

## Key Improvements

### 1. Rate Limiting Solution
- Implement exponential backoff with jitter
- Add request queuing with configurable concurrency
- Respect robots.txt and rate limit headers
- Add proxy rotation support

### 2. Data Wholeness
- Validate all required fields before processing
- Add fallback extraction methods
- Implement retry logic for failed extractions
- Cache successful patterns per site

### 3. Success Rate Improvements
- Site-specific selectors with fallback to generic
- Better error categorization and handling
- Implement browser automation for JS-heavy sites
- Add User-Agent rotation

### 4. Database Integration
- Batch upserts with conflict resolution
- Transaction support for data integrity
- Automatic retry on connection failures
- Connection pooling

## Migration Steps
1. Create new directory structure
2. Move and consolidate files
3. Update imports
4. Remove redundant code
5. Add comprehensive tests
6. Update documentation
