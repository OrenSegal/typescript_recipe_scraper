# Migration Guide: Enhanced Video & Nutrition System

## Overview

This guide documents the consolidation of video scraping and nutrition enrichment into unified, robust systems.

## What Changed

### ✅ New Unified Systems

#### 1. **UnifiedNutritionEnrichment** (Replaces multiple nutrition files)
- **Location**: `src/enrichment/UnifiedNutritionEnrichment.ts`
- **Replaces**:
  - `src/enrichment/nutritionEnrichment.ts` (DEPRECATED)
  - `src/enrichment/usdaNutritionIntegration.ts` (DEPRECATED)

**Key Features**:
- 3-tier fallback chain: USDA → Edamam → Local DB
- Smart caching with 24-hour TTL
- Automatic ingredient parsing and gram conversion
- Per-serving nutrition calculation
- 16 nutrition metrics tracked

**Usage**:
```typescript
import { enrichRecipeWithNutrition } from './enrichment/UnifiedNutritionEnrichment.js';

const enrichedRecipe = await enrichRecipeWithNutrition(recipe);
// Recipe now has complete nutrition data
```

#### 2. **EnhancedVideoRecipeScraper** (Replaces SocialMediaScraper)
- **Location**: `src/scrapers/EnhancedVideoRecipeScraper.ts`
- **Replaces**:
  - `src/scrapers/SocialMediaScraper.ts` (DEPRECATED - still in use by legacy services)

**Key Features**:
- Unified support for YouTube, TikTok, Instagram
- Multi-modal extraction:
  - Audio transcription (Google Speech + Whisper)
  - Video OCR (frame-by-frame text extraction)
  - Caption reading
  - Metadata extraction
- NLP-based recipe parsing
- Automatic nutrition enrichment
- Robust error handling with graceful fallbacks

**Usage**:
```typescript
import { enhancedVideoScraper } from './scrapers/EnhancedVideoRecipeScraper.js';

const recipe = await enhancedVideoScraper.scrapeRecipe(videoUrl);
// Returns fully enriched Recipe with ingredients, instructions, and nutrition
```

## Migration Steps

### For New Code

**Use the new unified systems directly:**

```typescript
// ✅ CORRECT - Use new unified system
import { enhancedVideoScraper } from './scrapers/EnhancedVideoRecipeScraper.js';
import { enrichRecipeWithNutrition } from './enrichment/UnifiedNutritionEnrichment.js';

// Scrape video
const recipe = await enhancedVideoScraper.scrapeRecipe(url);

// Recipe is automatically enriched with nutrition
console.log(recipe.nutrition);
```

### For Existing Code

**Option 1: Use UniversalRecipeScraper (Recommended)**

The UniversalRecipeScraper already integrates the enhanced systems:

```typescript
import { UniversalRecipeScraper } from './scrapers/UniversalRecipeScraper.js';

// Automatically uses EnhancedVideoRecipeScraper for video URLs
const result = await UniversalRecipeScraper.scrape(videoUrl);
```

**Option 2: Direct Migration**

If using old SocialMediaScraper:

```typescript
// ❌ OLD - Deprecated
import { SocialMediaScraper } from './scrapers/SocialMediaScraper.js';
const scraper = new SocialMediaScraper();
const recipe = await scraper.scrapeRecipe(url);

// ✅ NEW - Enhanced
import { enhancedVideoScraper } from './scrapers/EnhancedVideoRecipeScraper.js';
const recipe = await enhancedVideoScraper.scrapeRecipe(url);
```

## API Differences

### Recipe Type Changes

The enhanced scraper returns `Recipe` (structured) instead of `RawScrapedRecipe` (flat).

**Conversion Helper** (if needed):
```typescript
// Convert Recipe to RawScrapedRecipe
function convertRecipeToRaw(recipe: Recipe): RawScrapedRecipe {
  return {
    title: recipe.title,
    description: recipe.description,
    source_url: recipe.source_url,
    image_url: recipe.image_url,
    ingredients: recipe.ingredients.map(ing => ing.text || ing.name),
    instructions: recipe.instructions.map(inst => inst.text),
    servings: recipe.servings,
    prep_time: recipe.prep_time,
    cook_time: recipe.cook_time,
    total_time: recipe.total_time,
    author: recipe.author,
    nutrition: recipe.nutrition,
  };
}
```

## Configuration

### Environment Variables

```bash
# Nutrition APIs
USDA_API_KEY=your_usda_key          # Primary nutrition source
EDAMAM_APP_ID=your_edamam_id        # Fallback nutrition
EDAMAM_APP_KEY=your_edamam_key

# Video Processing
GOOGLE_VISION_API_KEY=your_key      # OCR
GOOGLE_SPEECH_API_KEY=your_key      # Transcription
OPENAI_API_KEY=your_key             # Whisper transcription (fallback)

# Optional
FFMPEG_PATH=ffmpeg                  # Path to FFmpeg
```

### Default Configuration

Both systems work with graceful degradation if APIs are unavailable:

- **Nutrition**: Falls back through USDA → Edamam → Local DB
- **Video**: Falls back through Transcription → OCR → Metadata only

## Deprecation Timeline

### Immediately Available
- ✅ UnifiedNutritionEnrichment
- ✅ EnhancedVideoRecipeScraper
- ✅ Integration in UniversalRecipeScraper

### Deprecated (Still Functional)
- ⚠️  SocialMediaScraper (use EnhancedVideoRecipeScraper)
- ⚠️  nutritionEnrichment.ts (use UnifiedNutritionEnrichment)
- ⚠️  usdaNutritionIntegration.ts (use UnifiedNutritionEnrichment)

### Future Removal (v2.0)
These deprecated files will be removed in the next major version. Please migrate before then.

## Testing

Run the test suites to verify functionality:

```bash
# Test enhanced video scraper
npx tsx test-enhanced-video.ts

# Test universal scraper (includes video)
pnpm run test:universal

# Test MCP scrapers
npx tsx test-mcp-scrapers.ts
```

## Benefits of Migration

### Performance
- **Caching**: 24-hour nutrition data cache reduces API calls
- **Parallel Processing**: Multiple data sources processed concurrently
- **Smart Fallbacks**: Continues working even when APIs are down

### Accuracy
- **Multi-Modal**: Combines audio, video, and text analysis
- **NLP Parsing**: Better ingredient and instruction extraction
- **Gram Conversion**: More accurate nutrition calculations

### Robustness
- **3-Tier Fallback**: Never fails completely on nutrition
- **Error Handling**: Graceful degradation throughout
- **Type Safety**: Full TypeScript type coverage

## Support

For issues or questions:
1. Check the test files for usage examples
2. Review the inline documentation in the source files
3. Open an issue on GitHub

## Files to Remove (Safe to Delete)

These files are no longer used and can be safely deleted:

```bash
rm src/enrichment/nutritionEnrichment.ts
rm src/enrichment/usdaNutritionIntegration.ts
```

**Note**: Do not delete `SocialMediaScraper.ts` yet as it's still used by:
- `MediaScrapingService.ts`
- `SocialMediaApiRoutes.ts`
- `SocialMediaCliCommands.ts`

These will be migrated in a future update.
