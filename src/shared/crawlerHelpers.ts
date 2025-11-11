import fs from 'fs/promises';
import { parse } from 'csv-parse/sync';
import { 
  CSV_CONSTANTS, 
  WEBSITE_CATEGORIES, 
  RECIPE_URL_PATTERNS, 
  SITEMAP_PATTERNS,
  LOG_SYMBOLS 
} from './crawlerConstants.js';

// Types
export interface WebsiteData {
  category: string;
  name: string;
  url: string;
  domain: string;
  sitemapUrl?: string;
  subSitemaps?: string[];
  priority?: number;
}

export interface CrawlerStatistics {
  totalSites: number;
  processedSites: number;
  successfulSites: number;
  blockedSites: number;
  totalRecipes: number;
  successfulRecipes: number;
  adaptations: number;
  startTime: number;
}

/**
 * Parse CSV files and extract unique website data
 */
export async function parseWebsiteDataFromCSV(csvPaths: string[]): Promise<WebsiteData[]> {
  console.log(`${LOG_SYMBOLS.INFO} Parsing website data from ${csvPaths.length} CSV files...\n`);
  const websites = new Map<string, WebsiteData>();
  
  for (const csvPath of csvPaths) {
    try {
      const csvContent = await fs.readFile(csvPath, CSV_CONSTANTS.ENCODING);
      const records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      });
      
      console.log(`${LOG_SYMBOLS.SUCCESS} Loaded ${records.length} websites from ${csvPath.split('/').pop()}`);
      
      for (const record of records) {
        try {
          const csvRecord = record as any; // Type assertion for CSV record
          const domain = new URL(csvRecord[CSV_CONSTANTS.COLUMNS.MAIN_URL]).hostname;
          
          if (!websites.has(domain)) {
            const subSitemaps = csvRecord[CSV_CONSTANTS.COLUMNS.SUB_SITEMAP_URLS]
              ?.split(CSV_CONSTANTS.SEPARATOR)
              .map((s: string) => s.trim())
              .filter(Boolean) || [];
            
            websites.set(domain, {
              category: csvRecord[CSV_CONSTANTS.COLUMNS.CATEGORY],
              name: csvRecord[CSV_CONSTANTS.COLUMNS.WEBSITE_NAME],
              url: csvRecord[CSV_CONSTANTS.COLUMNS.MAIN_URL],
              domain: domain,
              sitemapUrl: csvRecord[CSV_CONSTANTS.COLUMNS.MAIN_SITEMAP_URL],
              subSitemaps: subSitemaps,
              priority: WEBSITE_CATEGORIES[csvRecord[CSV_CONSTANTS.COLUMNS.CATEGORY] as keyof typeof WEBSITE_CATEGORIES]?.priority || 10
            });
          }
        } catch (error: unknown) {
          console.error(`${LOG_SYMBOLS.ERROR} Error parsing record:`, error);
        }
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`${LOG_SYMBOLS.ERROR} Error reading CSV file ${csvPath}:`, errorMessage);
    }
  }
  
  const uniqueWebsites = Array.from(websites.values());
  console.log(`\n${LOG_SYMBOLS.SUCCESS} Total unique websites: ${uniqueWebsites.length}\n`);
  return uniqueWebsites;
}

/**
 * Sort websites by category priority and name
 */
export function sortWebsitesByPriority(websites: WebsiteData[]): WebsiteData[] {
  return websites.sort((a, b) => {
    if (a.priority !== b.priority) {
      return (a.priority || 10) - (b.priority || 10);
    }
    return a.name.localeCompare(b.name);
  });
}

/**
 * Generate sample recipe URLs for testing a website
 */
export function generateSampleRecipeUrls(website: WebsiteData, count: number = 5): string[] {
  const baseUrl = website.url.replace(/\/$/, ''); // Remove trailing slash
  
  const commonPaths = [
    '/recipe/test-recipe',
    '/recipes/sample-recipe', 
    '/recipe/chicken-dinner',
    '/recipes/chocolate-cake',
    '/recipe/pasta-sauce',
    '/recipe/beef-stew',
    '/recipes/apple-pie',
    '/recipe/tomato-soup'
  ];
  
  return commonPaths.slice(0, count).map(path => `${baseUrl}${path}`);
}

/**
 * Generate sitemap URLs based on common patterns
 */
export function generateSitemapUrls(website: WebsiteData): string[] {
  const baseUrl = website.url.replace(/\/$/, '');
  const urls: string[] = [];
  
  // Add explicitly provided sitemap
  if (website.sitemapUrl) {
    urls.push(website.sitemapUrl);
  }
  
  // Add sub-sitemaps
  if (website.subSitemaps?.length) {
    urls.push(...website.subSitemaps);
  }
  
  // Generate common sitemap patterns if none provided
  if (urls.length === 0) {
    for (const pattern of SITEMAP_PATTERNS) {
      urls.push(`${baseUrl}/${pattern}`);
    }
  }
  
  return urls;
}

/**
 * Check if URL matches recipe patterns
 */
export function isRecipeUrl(url: string): boolean {
  return RECIPE_URL_PATTERNS.some(pattern => pattern.test(url));
}

/**
 * Format elapsed time in human-readable format
 */
export function formatElapsedTime(startTime: number): string {
  const elapsed = (Date.now() - startTime) / 1000;
  
  if (elapsed < 60) {
    return `${elapsed.toFixed(1)}s`;
  } else if (elapsed < 3600) {
    return `${(elapsed / 60).toFixed(1)}m`;
  } else {
    return `${(elapsed / 3600).toFixed(1)}h`;
  }
}

/**
 * Calculate success rate percentage
 */
export function calculateSuccessRate(successful: number, total: number): number {
  return total > 0 ? (successful / total * 100) : 0;
}

/**
 * Create progress bar string
 */
export function createProgressBar(current: number, total: number, width: number = 20): string {
  const progress = current / total;
  const filled = Math.floor(progress * width);
  const empty = width - filled;
  
  return `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${current}/${total}`;
}

/**
 * Initialize crawler statistics
 */
export function initializeStatistics(): CrawlerStatistics {
  return {
    totalSites: 0,
    processedSites: 0,
    successfulSites: 0,
    blockedSites: 0,
    totalRecipes: 0,
    successfulRecipes: 0,
    adaptations: 0,
    startTime: Date.now()
  };
}

/**
 * Generate comprehensive progress report
 */
export function generateProgressReport(stats: CrawlerStatistics): string {
  const elapsed = formatElapsedTime(stats.startTime);
  const siteSuccessRate = calculateSuccessRate(stats.successfulSites, stats.processedSites);
  const recipeSuccessRate = calculateSuccessRate(stats.successfulRecipes, stats.totalRecipes);
  const siteProgress = createProgressBar(stats.processedSites, stats.totalSites);
  
  return `
${'='.repeat(60)}
${LOG_SYMBOLS.REPORT} CRAWLER PROGRESS REPORT
${'='.repeat(60)}
${LOG_SYMBOLS.TIME} Elapsed time: ${elapsed}
${LOG_SYMBOLS.SITE} Sites: ${siteProgress}
${LOG_SYMBOLS.SUCCESS} Site success rate: ${siteSuccessRate.toFixed(1)}%
${LOG_SYMBOLS.RECIPE} Total recipes processed: ${stats.totalRecipes}
${LOG_SYMBOLS.SUCCESS} Recipe success rate: ${recipeSuccessRate.toFixed(1)}%
${LOG_SYMBOLS.ADAPTATION} Real-time adaptations: ${stats.adaptations}
${LOG_SYMBOLS.BLOCKED} Blocked sites: ${stats.blockedSites}
${'='.repeat(60)}
`;
}

/**
 * Generate final comprehensive report
 */
export function generateFinalReport(stats: CrawlerStatistics, errorReport: string): string {
  const elapsed = formatElapsedTime(stats.startTime);
  const siteSuccessRate = calculateSuccessRate(stats.successfulSites, stats.totalSites);
  const recipeSuccessRate = calculateSuccessRate(stats.successfulRecipes, stats.totalRecipes);
  const avgRecipesPerMinute = stats.totalRecipes / ((Date.now() - stats.startTime) / 1000 / 60);
  
  return `
${'='.repeat(80)}
${LOG_SYMBOLS.REPORT} FINAL CONSOLIDATED CRAWLER REPORT
${'='.repeat(80)}
${LOG_SYMBOLS.TIME} Total time: ${elapsed}
${LOG_SYMBOLS.SITE} Total websites: ${stats.totalSites}
${LOG_SYMBOLS.SUCCESS} Successfully crawled: ${stats.successfulSites} (${siteSuccessRate.toFixed(1)}%)
${LOG_SYMBOLS.BLOCKED} Blocked sites: ${stats.blockedSites}
${LOG_SYMBOLS.RECIPE} Total recipes processed: ${stats.totalRecipes}
${LOG_SYMBOLS.SUCCESS} Successful recipes: ${stats.successfulRecipes} (${recipeSuccessRate.toFixed(1)}%)
${LOG_SYMBOLS.ADAPTATION} Real-time adaptations: ${stats.adaptations}
${LOG_SYMBOLS.INFO} Average recipes per minute: ${avgRecipesPerMinute.toFixed(1)}

${errorReport}

${LOG_SYMBOLS.SUCCESS} Modular Features:
  • Unified crawler architecture with shared constants
  • Reusable helper functions across all crawler modes
  • Real-time error adaptation with immediate correction
  • Automatic rate limit adjustment and site-specific configs
  • Progressive batch processing with dynamic sizing
  • Comprehensive statistics tracking and reporting
${'='.repeat(80)}
`;
}

/**
 * Sleep utility for delays
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Safe URL parsing
 */
export function safeParseUrl(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

/**
 * Extract domain from URL
 */
export function extractDomain(url: string): string | null {
  const parsedUrl = safeParseUrl(url);
  return parsedUrl?.hostname || null;
}

/**
 * Chunk array into smaller batches
 */
export function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}
