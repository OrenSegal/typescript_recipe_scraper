#!/usr/bin/env node

/**
 * Enhanced Mass Recipe Scraper v2
 * Features:
 * - Intelligent rate limiting with per-domain tracking
 * - Automatic error recovery and retry logic  
 * - Real-time Supabase upserting
 * - Comprehensive monitoring and reporting
 */

import { AdaptiveCrawler } from './infrastructure/crawlers/AdaptiveCrawler.js';
import { WebsiteManager } from './manager/WebsiteManager.js';
import { Website } from './shared/types.js';
import * as fs from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import * as path from 'path';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';

// Load environment variables and define paths
config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CSV_FILE_PATH = path.resolve(__dirname, '../../data/Data.csv');

interface ScrapingReport {
  startTime: string;
  endTime?: string;
  websites: Array<{
    name: string;
    sitemapUrl: string;
    recipesFound: number;
    recipesScraped: number;
    successRate: number;
    errors: Record<string, number>;
  }>;
  totalRecipes: number;
  totalSuccessful: number;
  overallSuccessRate: number;
}

class MassScraperV2 {
  private crawler: AdaptiveCrawler;
  private report: ScrapingReport;
  private resultsDir: string;

  constructor() {
    // Initialize crawler with optimized settings
    this.crawler = new AdaptiveCrawler({
      maxConcurrency: 5,
      maxRetries: 3,
      enableUpsert: true, // Enable real-time database upserting
      timeout: 30000,
      respectRobotsTxt: true
    });

    this.resultsDir = path.join(process.cwd(), 'results');
    this.report = this.initReport();
    
    // Ensure results directory exists
    if (!existsSync(this.resultsDir)) {
      mkdirSync(this.resultsDir, { recursive: true });
    }
  }

  private initReport(): ScrapingReport {
    return {
      startTime: new Date().toISOString(),
      websites: [],
      totalRecipes: 0,
      totalSuccessful: 0,
      overallSuccessRate: 0
    };
  }

  /**
   * Run the mass scraping pipeline
   */
  async run(quickMode: boolean = false): Promise<void> {
    console.log(`
╔══════════════════════════════════════════╗
║     MASS RECIPE SCRAPER V2 - ENHANCED    ║
║         With Intelligent Rate Limiting    ║
╚══════════════════════════════════════════╝
`);

    // Check Supabase configuration
    this.checkSupabaseConfig();

    // Load websites from CSV
    const websiteManager = new WebsiteManager();
    try {
        await websiteManager.loadFromCSV(CSV_FILE_PATH);
    } catch (error) {
        console.error(`❌ Fatal Error: Could not load websites from ${CSV_FILE_PATH}. Make sure the file exists.`);
        process.exit(1);
    }
    const allWebsites = websiteManager.getHighPriorityWebsites(); // Or getAllWebsites()

    const websitesToCrawl = quickMode 
      ? allWebsites.slice(0, 3)  // Quick mode: first 3 sites
      : allWebsites;             // Full mode: all high-priority sites

    console.log(`🎯 Scraping ${websitesToCrawl.length} websites in ${quickMode ? 'QUICK' : 'FULL'} mode\n`);

    // Process each website
    for (const website of websitesToCrawl) {
      await this.processWebsite(website);
    }

    // Finalize and save report
    this.finalizeReport();
    await this.saveReport();

    // Display final statistics
    this.displayFinalStats();
  }

  /**
   * Check if Supabase is properly configured
   */
  private checkSupabaseConfig(): void {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.warn(`
⚠️  WARNING: Supabase credentials not found in .env
   Recipes will be scraped but NOT saved to database.
   To enable database saving, add:
   - SUPABASE_URL
   - SUPABASE_SERVICE_KEY
`);
    } else {
      console.log('✅ Supabase configured - recipes will be saved to database\n');
    }
  }

  /**
   * Process a single website
   */
  private async processWebsite(website: Website): Promise<void> {
    console.log(`
${'═'.repeat(50)}`);
    console.log(`📍 Processing: ${website.name}`);
    console.log(`   Category: ${website.category}`);
    console.log(`   Sitemap: ${website.sitemap_url}`);
    console.log(`${'═'.repeat(50)}\n`);

    const websiteReport = {
      name: website.name,
      sitemapUrl: website.sitemap_url,
      recipesFound: 0,
      recipesScraped: 0,
      successRate: 0,
      errors: {} as Record<string, number>
    };

    try {
      // Step 1: Crawl sitemap to find recipe URLs
      console.log('🔍 Crawling sitemap...');
      const recipeUrls = await this.crawler.crawlSitemap(website.sitemap_url);
      websiteReport.recipesFound = recipeUrls.length;
      console.log(`✅ Found ${recipeUrls.length} recipe URLs\n`);

      if (recipeUrls.length === 0) {
        console.log('⚠️  No recipes found in sitemap, trying homepage crawl...');
        const homepageUrl = new URL(website.base_url).origin;
        const homepageRecipes = await this.crawler.crawlPage(homepageUrl);
        websiteReport.recipesFound = homepageRecipes.length;
        
        if (homepageRecipes.length > 0) {
          console.log(`✅ Found ${homepageRecipes.length} recipes on homepage`);
          recipeUrls.push(...homepageRecipes);
        }
      }

      // Step 2: Scrape recipes in batches
      if (recipeUrls.length > 0) {
        console.log('🚀 Starting recipe scraping...\\n');
        
        // Limit recipes in quick mode
        const urlsToScrape = process.argv.includes('--quick') 
          ? recipeUrls.slice(0, 10)
          : recipeUrls.slice(0, 100); // Cap at 100 per site for now

        const results = await this.crawler.batchScrape(urlsToScrape, 5);
        
        // Count successful scrapes
        const successful = results.filter(r => r.success).length;
        websiteReport.recipesScraped = successful;
        websiteReport.successRate = (successful / urlsToScrape.length) * 100;

        // Update totals
        this.report.totalRecipes += urlsToScrape.length;
        this.report.totalSuccessful += successful;
      }

      // Get crawler stats for this website
      const crawlerStats = this.crawler.getStats();
      crawlerStats.errors.forEach((count, errorType) => {
        websiteReport.errors[errorType] = count;
      });

    } catch (error) {
      console.error(`❌ Error processing ${website.name}:`, error);
      websiteReport.errors['FatalError'] = 1;
    }

    this.report.websites.push(websiteReport);
    
    // Display website summary
    console.log(`
📊 ${website.name} Summary:`);
    console.log(`   Recipes found: ${websiteReport.recipesFound}`);
    console.log(`   Recipes scraped: ${websiteReport.recipesScraped}`);
    console.log(`   Success rate: ${websiteReport.successRate.toFixed(2)}%`);
    
    if (Object.keys(websiteReport.errors).length > 0) {
      console.log(`   Errors:`, websiteReport.errors);
    }
  }

  /**
   * Finalize the report
   */
  private finalizeReport(): void {
    this.report.endTime = new Date().toISOString();
    this.report.overallSuccessRate = this.report.totalRecipes > 0
      ? (this.report.totalSuccessful / this.report.totalRecipes) * 100
      : 0;
  }

  /**
   * Save report to file
   */
  private async saveReport(): Promise<void> {
    const reportPath = path.join(this.resultsDir, 'scraping_report_v2.json');
    await fs.writeFile(reportPath, JSON.stringify(this.report, null, 2));
    console.log(`\n📄 Report saved to: ${reportPath}`);
  }

  /**
   * Display final statistics
   */
  private displayFinalStats(): void {
    const crawlerReport = this.crawler.generateReport();
    
    console.log(`
╔══════════════════════════════════════════╗
║           FINAL STATISTICS               ║
╚══════════════════════════════════════════╝

Total Recipes Attempted: ${this.report.totalRecipes}
Successfully Scraped: ${this.report.totalSuccessful}
Overall Success Rate: ${this.report.overallSuccessRate.toFixed(2)}%

Top Performing Sites:
`);

    // Sort websites by success rate
    const sortedWebsites = [...this.report.websites]
      .sort((a, b) => b.successRate - a.successRate)
      .slice(0, 5);

    sortedWebsites.forEach((site, index) => {
      console.log(`  ${index + 1}. ${site.name}: ${site.successRate.toFixed(2)}% (${site.recipesScraped}/${site.recipesFound})`);
    });

    console.log('\n' + crawlerReport);

    // Check database status
    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
      console.log(`
✅ All successfully scraped recipes have been saved to Supabase.
   You can query them using the Supabase dashboard or API.
`);
    }
  }
}

// Main execution
async function main() {
  const quickMode = process.argv.includes('--quick');
  const scraper = new MassScraperV2();
  
  try {
    await scraper.run(quickMode);
    process.exit(0);
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}