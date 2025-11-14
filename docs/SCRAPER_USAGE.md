# Refactored Scraper Usage Guide

This guide demonstrates how to use the refactored API scrapers with the new `BaseScraper` pattern.

## ✅ Refactored Scrapers (5/16)

The following scrapers have been refactored to eliminate singleton boilerplate:

1. **SpoonacularScraper** - 150 requests/day free tier
2. **EdamamScraper** - 10k requests/month free tier
3. **TheMealDBScraper** - Unlimited free access
4. **RecipePuppyScraper** - Unlimited free access
5. ~~More coming soon~~ (11 remaining)

---

## 🚀 New Usage Pattern

### Before (Singleton Pattern - ❌ Don't use)

```typescript
// OLD WAY - Singleton (hard to test)
import { spoonacular } from './scrapers/SpoonacularScraper.js';

const recipes = await spoonacular.searchRecipes({ query: 'pasta' });
```

**Problems:**
- ❌ Can't inject configuration
- ❌ Hard to test (can't mock)
- ❌ Single global instance
- ❌ Hidden dependencies

### After (Dependency Injection - ✅ Use this)

```typescript
// NEW WAY - Dependency Injection (testable!)
import { ScraperFactory, ScraperType } from './core/ScraperFactory.js';
import { SpoonacularScraper } from './scrapers/SpoonacularScraper.js';

// Option 1: Use ScraperFactory (recommended)
const scraper = ScraperFactory.create(ScraperType.SPOONACULAR);
const result = await scraper.search('pasta');

// Option 2: Direct instantiation
const scraper2 = new SpoonacularScraper();
const result2 = await scraper2.search('pasta');

// Option 3: Custom configuration
const scraper3 = new SpoonacularScraper({
  maxRetries: 5,
  timeoutMs: 15000,
  rateLimit: {
    requestsPerMinute: 5,
    requestsPerDay: 100,
  },
});
```

---

## 📖 API Examples

### 1. Basic Search

```typescript
import { ScraperFactory, ScraperType } from './core/ScraperFactory.js';

const scraper = ScraperFactory.create(ScraperType.SPOONACULAR);

// Search returns ScraperResult with metadata
const result = await scraper.search('chicken pasta');

if (result.success) {
  console.log(`Found ${result.data.length} recipes`);
  console.log(`Source: ${result.metadata.source}`);
  console.log(`Duration: ${result.metadata.duration}ms`);

  result.data.forEach(recipe => {
    console.log(`- ${recipe.title}`);
  });
} else {
  console.error(`Error: ${result.error}`);
}
```

### 2. Get Single Recipe

```typescript
const scraper = ScraperFactory.create(ScraperType.EDAMAM);

// Scrape returns ScraperResult with single recipe
const result = await scraper.scrape('chocolate cake');

if (result.success && result.data) {
  const recipe = result.data;
  console.log(`Title: ${recipe.title}`);
  console.log(`Ingredients: ${recipe.ingredients.length}`);
  console.log(`Servings: ${recipe.servings}`);
}
```

### 3. Health Check

```typescript
const scraper = ScraperFactory.create(ScraperType.THEMEALDB);

// Check if API is accessible
const isHealthy = await scraper.healthCheck();
console.log(`API available: ${isHealthy}`);

// Get scraper metadata
const metadata = scraper.getMetadata();
console.log(`Name: ${metadata.name}`);
console.log(`Requires Auth: ${metadata.requiresAuth}`);
console.log(`Rate Limits: ${metadata.rateLimits?.requestsPerDay} req/day`);
```

### 4. Multiple Scrapers in Parallel

```typescript
import { ScraperFactory } from './core/ScraperFactory.js';

// Health check all scrapers
const healthStatuses = await ScraperFactory.healthCheckAll();

healthStatuses.forEach((isHealthy, type) => {
  console.log(`${type}: ${isHealthy ? '✅' : '❌'}`);
});

// Create multiple scrapers at once
const scrapers = ScraperFactory.createMultiple([
  ScraperType.SPOONACULAR,
  ScraperType.EDAMAM,
  ScraperType.THEMEALDB,
]);

// Search across multiple sources
const allRecipes = await Promise.all(
  Array.from(scrapers.values()).map(scraper =>
    scraper.search('pasta')
  )
);

const successfulResults = allRecipes.filter(r => r.success);
console.log(`Found recipes from ${successfulResults.length} sources`);
```

### 5. Custom Configuration for Testing

```typescript
import { SpoonacularScraper } from './scrapers/SpoonacularScraper.js';

// Mock configuration for testing
const testScraper = new SpoonacularScraper({
  maxRetries: 1,
  timeoutMs: 5000,
  rateLimit: {
    requestsPerMinute: 1, // Slow down for testing
    requestsPerDay: 10,
  },
});

// Now you can test without hitting real API limits
const result = await testScraper.search('test');
```

---

## 🧪 Testing Examples

### Unit Test with Mock Config

```typescript
import { describe, it, expect } from 'vitest';
import { SpoonacularScraper } from './scrapers/SpoonacularScraper.js';

describe('SpoonacularScraper', () => {
  it('should return recipes', async () => {
    // Create scraper with test config
    const scraper = new SpoonacularScraper({
      maxRetries: 1,
      timeoutMs: 5000,
    });

    const result = await scraper.search('pasta');

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.metadata?.source).toBe('spoonacular');
  });

  it('should handle errors gracefully', async () => {
    const scraper = new SpoonacularScraper({
      timeoutMs: 1, // Force timeout
    });

    const result = await scraper.search('pasta');

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
```

### Integration Test

```typescript
import { ScraperFactory, ScraperType } from './core/ScraperFactory.js';

async function testAllScrapers() {
  const scrapers = [
    ScraperType.SPOONACULAR,
    ScraperType.EDAMAM,
    ScraperType.THEMEALDB,
    ScraperType.RECIPE_PUPPY,
  ];

  for (const type of scrapers) {
    const scraper = ScraperFactory.create(type);
    const metadata = scraper.getMetadata();

    console.log(`\nTesting ${metadata.name}...`);

    // Health check
    const isHealthy = await scraper.healthCheck();
    console.log(`  Health: ${isHealthy ? '✅' : '❌'}`);

    if (isHealthy) {
      // Try search
      const result = await scraper.search('chicken');
      console.log(`  Search: ${result.success ? '✅' : '❌'}`);

      if (result.success && result.data) {
        console.log(`  Found: ${result.data.length} recipes`);
      }
    }
  }
}

testAllScrapers();
```

---

## 🎯 Best Practices

### 1. Always Check Results

```typescript
const result = await scraper.search('query');

if (result.success && result.data) {
  // Use result.data safely
  processRecipes(result.data);
} else {
  // Handle error
  console.error(`Search failed: ${result.error}`);
}
```

### 2. Use ScraperFactory for Consistency

```typescript
// ✅ Good - use factory
const scraper = ScraperFactory.create(ScraperType.SPOONACULAR);

// ⚠️ OK - direct instantiation
const scraper2 = new SpoonacularScraper();

// ❌ Bad - don't use getInstance() (doesn't exist anymore!)
// const scraper = SpoonacularScraper.getInstance(); // ERROR!
```

### 3. Configure Rate Limiting

```typescript
// For heavy usage, configure conservative rate limits
const scraper = new SpoonacularScraper({
  rateLimit: {
    requestsPerMinute: 5,  // Slower than default
    requestsPerDay: 100,   // Less than free tier limit
  },
});
```

### 4. Check Health Before Heavy Operations

```typescript
async function batchScrape(queries: string[]) {
  const scraper = ScraperFactory.create(ScraperType.EDAMAM);

  // Check if API is available first
  if (!(await scraper.healthCheck())) {
    throw new Error('Scraper not available');
  }

  // Proceed with batch operation
  return Promise.all(
    queries.map(q => scraper.search(q))
  );
}
```

---

## 🔄 Migration Guide

### From Singleton to DI

**Before:**
```typescript
import { spoonacular } from './scrapers/SpoonacularScraper.js';
const recipes = await spoonacular.searchRecipes({ query: 'pasta' });
```

**After:**
```typescript
import { ScraperFactory, ScraperType } from './core/ScraperFactory.js';
const scraper = ScraperFactory.create(ScraperType.SPOONACULAR);
const result = await scraper.search('pasta');
const recipes = result.success ? result.data : [];
```

### Key Changes

1. **Import** changes:
   - ✅ Import `ScraperFactory` or scraper class
   - ❌ Don't import singleton instance

2. **Instantiation** changes:
   - ✅ Use `ScraperFactory.create()` or `new Scraper()`
   - ❌ Don't use `getInstance()`

3. **Method** changes:
   - ✅ Use `scraper.search()` (returns `ScraperResult`)
   - ⚠️ Old `searchRecipes()` is now private

4. **Result** handling:
   - ✅ Check `result.success` and use `result.data`
   - ❌ Don't assume array is returned directly

---

## 📊 Benefits Summary

| Aspect | Before (Singleton) | After (DI) |
|--------|-------------------|------------|
| **Testability** | ❌ Hard to mock | ✅ Easy to inject mocks |
| **Flexibility** | ❌ One global instance | ✅ Multiple instances |
| **Configuration** | ❌ Hardcoded | ✅ Injected via constructor |
| **Type Safety** | ⚠️ Partial | ✅ Full TypeScript support |
| **Consistency** | ❌ Each scraper different | ✅ All follow IScraper |
| **Rate Limiting** | ⚠️ Manual | ✅ Automatic |
| **Error Handling** | ⚠️ Inconsistent | ✅ Structured ScraperResult |
| **Metadata** | ❌ None | ✅ Full metadata via getMetadata() |

---

## 🚧 Work in Progress

The following scrapers are **not yet refactored** and still use the old singleton pattern:

- WikidataScraper
- GoogleCSEScraper
- DummyJSONScraper
- MCPCookScraper
- HowToCookMCPScraper
- SocialMediaScraper
- UniversalRecipeScraper
- UnifiedScraper
- RobustMultiFallbackScraper
- EnhancedVideoRecipeScraper
- MultiSourceRecipeAggregator

These will be refactored in future updates to follow the same pattern.

---

## 💡 Tips

1. **Start with ScraperFactory** - It handles caching and provides a clean API
2. **Check health first** - Use `healthCheck()` before heavy operations
3. **Handle errors** - Always check `result.success` before using `result.data`
4. **Configure wisely** - Adjust rate limits based on your usage
5. **Use metadata** - Get scraper info with `getMetadata()`

Happy scraping! 🍝
