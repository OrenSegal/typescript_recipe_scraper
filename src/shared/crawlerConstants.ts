/**
 * Shared crawler constants for reusability across all crawler components
 */

// Site configuration defaults
export const DEFAULT_SITE_CONFIG = {
  maxConcurrency: 3,
  minDelay: 2000,
  maxDelay: 5000,
  maxRetries: 3,
  timeout: 15000,
  userAgents: [
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  ]
} as const;

// Error types for adaptive responses
export const ERROR_TYPES = {
  RATE_LIMIT: 429,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  TIMEOUT: 'timeout',
  CONNECTION: 'connection',
  UNKNOWN: 'unknown'
} as const;

// Map numeric error codes to string keys for ADAPTATION_STRATEGIES
export const ERROR_TYPE_MAP = {
  429: 'RATE_LIMIT',
  403: 'FORBIDDEN', 
  404: 'NOT_FOUND',
  'timeout': 'TIMEOUT',
  'connection': 'CONNECTION',
  'unknown': 'UNKNOWN'
} as const;

// Error adaptation strategies
export const ADAPTATION_STRATEGIES = {
  [ERROR_TYPES.RATE_LIMIT]: {
    delayMultiplier: 2,
    minDelay: 10000,        // 10 seconds
    maxDelay: 20000,        // 20 seconds
    concurrencyDivisor: 2,  // Cut concurrency in half
    description: 'Rate limiting detected'
  },
  [ERROR_TYPES.FORBIDDEN]: {
    delayMultiplier: 3,
    minDelay: 15000,        // 15 seconds
    maxDelay: 30000,        // 30 seconds
    concurrencyDivisor: 4,  // Aggressive reduction
    description: 'Forbidden access detected'
  },
  [ERROR_TYPES.NOT_FOUND]: {
    delayMultiplier: 1,
    minDelay: 1000,         // 1 second
    maxDelay: 3000,         // 3 seconds
    concurrencyDivisor: 1,  // No reduction for 404s
    description: 'Not found errors detected'
  },
  [ERROR_TYPES.TIMEOUT]: {
    delayMultiplier: 1.5,
    minDelay: 5000,         // 5 seconds
    maxDelay: 15000,        // 15 seconds
    concurrencyDivisor: 1.5,
    description: 'Timeout errors detected'
  },
  [ERROR_TYPES.CONNECTION]: {
    delayMultiplier: 2,
    minDelay: 8000,         // 8 seconds
    maxDelay: 16000,        // 16 seconds
    concurrencyDivisor: 1.5,
    description: 'Connection issues detected'
  },
  [ERROR_TYPES.UNKNOWN]: {
    delayMultiplier: 1.2,
    minDelay: 3000,         // 3 seconds
    maxDelay: 8000,         // 8 seconds
    concurrencyDivisor: 1.2,
    description: 'Unknown errors detected'
  }
} as const;

// Recipe URL patterns for different sites
export const RECIPE_URL_PATTERNS = [
  /(\/recipe\/|\/recipes\/)/i,
  /\/recipe-/i,
  /\/recipes-/i,
  /\/cook\//i,
  /\/cooking\//i,
  /\/food\//i
] as const;

// Common sitemap patterns
export const SITEMAP_PATTERNS = [
  'sitemap.xml',
  'sitemap_index.xml',
  'recipe-sitemap.xml',
  'recipes-sitemap.xml',
  'post-sitemap.xml',
  'page-sitemap.xml',
  'category-sitemap.xml'
] as const;

// Website categories with priorities
export const WEBSITE_CATEGORIES = {
  'Major Recipe Sites': { priority: 1, description: 'High-volume, reliable recipe sites' },
  'Popular Food Blogs': { priority: 2, description: 'Well-known food blogging platforms' },
  'Baking & Dessert Sites': { priority: 3, description: 'Specialized baking and dessert sites' },
  'Specialty & Diet-Focused': { priority: 4, description: 'Diet-specific and specialty sites' },
  'Asian & International Cuisine': { priority: 5, description: 'International and ethnic cuisine' },
  'Indian Cuisine Sites': { priority: 6, description: 'Indian and South Asian cuisine' },
  'Mediterranean & Middle Eastern': { priority: 7, description: 'Mediterranean and Middle Eastern' },
  'International & Magazine Sites': { priority: 8, description: 'International magazines and media' },
  'Additional Popular Sites': { priority: 9, description: 'Additional popular recipe sites' }
} as const;

// Crawler operation modes
export const CRAWLER_MODES = {
  TEST: 'test',
  SAMPLE: 'sample', 
  FULL: 'full',
  ADAPTIVE: 'adaptive'
} as const;

// Statistics tracking
export const STATISTICS_KEYS = {
  TOTAL_SITES: 'totalSites',
  PROCESSED_SITES: 'processedSites',
  SUCCESSFUL_SITES: 'successfulSites',
  BLOCKED_SITES: 'blockedSites',
  TOTAL_RECIPES: 'totalRecipes',
  SUCCESSFUL_RECIPES: 'successfulRecipes',
  ADAPTATIONS: 'adaptations',
  START_TIME: 'startTime'
} as const;

// Batch processing constants
export const BATCH_CONSTANTS = {
  DEFAULT_BATCH_SIZE: 50,
  MIN_BATCH_SIZE: 10,
  MAX_BATCH_SIZE: 200,
  SITE_BATCH_SIZE: 5,
  PROGRESS_REPORT_INTERVAL: 10,
  INTER_SITE_DELAY: 2000,
  INTER_BATCH_DELAY: 1000
} as const;

// CSV parsing constants
export const CSV_CONSTANTS = {
  COLUMNS: {
    CATEGORY: 'Category',
    WEBSITE_NAME: 'Website Name',
    MAIN_URL: 'Main URL',
    MAIN_SITEMAP_URL: 'Main Sitemap URL',
    SUB_SITEMAP_URLS: 'Sub-sitemap URLs'
  },
  SEPARATOR: ';',
  ENCODING: 'utf-8'
} as const;

// Error thresholds and limits
export const ERROR_THRESHOLDS = {
  HIGH_ERROR_RATE: 0.4, // 40%
  BLOCKING_ERROR_RATE: 0.7, // 70%
  MIN_ATTEMPTS_FOR_ADAPTATION: 2,
  MAX_CONSECUTIVE_ERRORS: 5
} as const;

// Logging constants
export const LOG_SYMBOLS = {
  SUCCESS: '✅',
  FAILURE: '❌',
  WARNING: '⚠️',
  INFO: '📊',
  PROGRESS: '🔄',
  ADAPTATION: '🔄',
  BLOCKED: '🚫',
  TEST: '🔍',
  SITEMAP: '📄',
  RECIPE: '🍽️',
  TIME: '⏱️',
  SITE: '🌐',
  ERROR: '💥',
  REPORT: '📈'
} as const;

export type ErrorType = typeof ERROR_TYPES[keyof typeof ERROR_TYPES];
export type CrawlerMode = typeof CRAWLER_MODES[keyof typeof CRAWLER_MODES];
export type StatisticKey = typeof STATISTICS_KEYS[keyof typeof STATISTICS_KEYS];
