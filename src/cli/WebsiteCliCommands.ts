import * as fs from 'fs';
import * as path from 'path';
import { WebsiteManager, RecipeWebsite } from '../websiteManager.js';
import { BatchRecipeProcessor } from '../batchRecipeProcessor.js';
import { UnifiedScraper } from '../scrapers/UnifiedScraper.js';
import { DatabaseService } from '../services/DatabaseService.js';

export class WebsiteCliCommands {
  /**
   * Crawl and scrape all recipes from a website
   */
  static async crawlFullWebsite(domain: string, options: any): Promise<void> {
    console.log(`🕸️ Crawling website: ${domain}`);
    
    try {
      const websiteManager = new WebsiteManager('data/recipe-websites.csv');
      await websiteManager.loadWebsites();
      
      let website = await websiteManager.getWebsiteByDomain(domain);
      
      if (!website) {
        console.log(`❌ Website ${domain} not found in configuration. Add it first with 'add-website' command.`);
        return;
      }

      const scraper = new UnifiedScraper();
      const db = DatabaseService.getInstance();
      await db.initialize();

      // For now, we'll use a simple approach without SitemapCrawler
      // In a full implementation, you'd integrate with actual crawling logic
      let recipeUrls: string[] = [];
      
      if (options.sitemap && website.sitemapUrl) {
        console.log('📋 Sitemap crawling requested but not yet implemented');
        console.log('🔍 Falling back to test URL crawling...');
        recipeUrls = website.testRecipeUrl ? [website.testRecipeUrl] : [];
      } else {
        console.log('🔍 Using test URL for crawling...');
        recipeUrls = website.testRecipeUrl ? [website.testRecipeUrl] : [];
      }

      console.log(`📄 Found ${recipeUrls.length} potential recipe URLs`);

      // Apply limit if specified
      if (options.limit) {
        const limit = parseInt(options.limit);
        recipeUrls = recipeUrls.slice(0, limit);
        console.log(`🔢 Limited to ${limit} recipes`);
      }

      // Process recipes in batches
      const batchSize = parseInt(options.batchSize) || 10;
      const results = {
        total: recipeUrls.length,
        successful: 0,
        failed: 0,
        errors: [] as string[]
      };

      for (let i = 0; i < recipeUrls.length; i += batchSize) {
        const batch = recipeUrls.slice(i, i + batchSize);
        console.log(`\n🔄 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(recipeUrls.length/batchSize)} (${batch.length} recipes)`);

        await Promise.allSettled(batch.map(async (url) => {
          try {
            const result = await scraper.scrapeRecipe(url);
            if (result.success && result.recipe) {
              const savedRecipe = await db.saveRecipe(result.recipe);
              results.successful++;
              console.log(`✅ ${savedRecipe.title || url}`);
            } else {
              results.failed++;
              const reason = result.error || 'No recipe data';
              results.errors.push(`${reason}: ${url}`);
              console.log(`⚠️  Skipped: ${url} — ${reason}`);
            }
          } catch (error) {
            results.failed++;
            results.errors.push(`Error scraping ${url}: ${error}`);
            console.log(`❌ Failed: ${url}`);
          }
        }));

        // Progress update
        console.log(`📊 Progress: ${results.successful + results.failed}/${results.total} (${results.successful} successful, ${results.failed} failed)`);
      }

      // Save results if output directory specified
      if (options.output) {
        await this.saveResults(results, options.output, domain);
      }

      // Final summary
      console.log('\n🎉 Crawling Complete!');
      console.log(`✅ Successfully scraped: ${results.successful} recipes`);
      console.log(`❌ Failed: ${results.failed} recipes`);
      console.log(`📈 Success rate: ${((results.successful / results.total) * 100).toFixed(1)}%`);

    } catch (error) {
      console.error(`❌ Failed to crawl website: ${error}`);
      process.exit(1);
    }
  }

  /**
   * Add a new website to the configuration
   */
  static async addWebsite(domain: string, options: any): Promise<void> {
    console.log(`➕ Adding website: ${domain}`);
    
    try {
      const websiteManager = new WebsiteManager('data/recipe-websites.csv');
      await websiteManager.loadWebsites();

      // Check if website already exists
      const existing = await websiteManager.getWebsiteByDomain(domain);
      if (existing) {
        console.log(`⚠️ Website ${domain} already exists. Use 'list-websites' to see current configuration.`);
        return;
      }

      const website: RecipeWebsite = {
        name: options.name,
        domain: domain,
        mainUrl: options.url || `https://${domain}`,
        testRecipeUrl: options.testUrl,
        sitemapUrl: options.sitemap,
        status: 'active',
        crawlable: true,
        notes: `Added via CLI on ${new Date().toISOString()}`
      };

      websiteManager.addWebsite(website);
      await websiteManager.saveToCSV();

      console.log('✅ Website added successfully!');
      console.log(`Name: ${website.name}`);
      console.log(`Domain: ${website.domain}`);
      console.log(`Main URL: ${website.mainUrl}`);
      if (website.testRecipeUrl) console.log(`Test URL: ${website.testRecipeUrl}`);
      if (website.sitemapUrl) console.log(`Sitemap: ${website.sitemapUrl}`);

    } catch (error) {
      console.error(`❌ Failed to add website: ${error}`);
      process.exit(1);
    }
  }

  /**
   * List all configured websites
   */
  static async listWebsites(options: any): Promise<void> {
    console.log('📋 Configured Websites\n');
    
    try {
      const websiteManager = new WebsiteManager('data/recipe-websites.csv');
      await websiteManager.loadWebsites();

      let websites = await websiteManager.getAllWebsites();
      
      if (options.activeOnly) {
        websites = websites.filter(w => w.status === 'active');
      }

      if (websites.length === 0) {
        console.log('No websites configured. Use "add-website" to add some.');
        return;
      }

      switch (options.format) {
        case 'json':
          console.log(JSON.stringify(websites, null, 2));
          break;
        case 'csv':
          this.outputWebsitesCSV(websites);
          break;
        default:
          this.outputWebsitesTable(websites);
      }

    } catch (error) {
      console.error(`❌ Failed to list websites: ${error}`);
      process.exit(1);
    }
  }

  /**
   * Run batch processing on configured websites
   */
  static async batchProcess(options: any): Promise<void> {
    console.log('🔄 Starting batch processing...');
    
    try {
      const processor = new BatchRecipeProcessor();
      
      if (options.dryRun) {
        console.log('🔍 Dry run mode - showing what would be processed:');
        await this.showBatchPreview();
        return;
      }

      await processor.run();
      console.log('✅ Batch processing complete!');

    } catch (error) {
      console.error(`❌ Batch processing failed: ${error}`);
      process.exit(1);
    }
  }

  /**
   * Show batch processing preview
   */
  private static async showBatchPreview(): Promise<void> {
    const websiteManager = new WebsiteManager('data/recipe-websites.csv');
    await websiteManager.loadWebsites();
    const websites = await websiteManager.getActiveWebsites();

    console.log(`\nWould process ${websites.length} active websites:`);
    websites.forEach((website, index) => {
      console.log(`${index + 1}. ${website.name} (${website.domain})`);
      console.log(`   URL: ${website.mainUrl}`);
      if (website.testRecipeUrl) {
        console.log(`   Test: ${website.testRecipeUrl}`);
      }
      console.log('');
    });
  }

  /**
   * Output websites as table
   */
  private static outputWebsitesTable(websites: RecipeWebsite[]): void {
    console.log('Name'.padEnd(20) + 'Domain'.padEnd(25) + 'Status'.padEnd(10) + 'Crawlable');
    console.log('-'.repeat(70));
    
    websites.forEach(website => {
      const name = (website.name || '').padEnd(20).substring(0, 20);
      const domain = (website.domain || '').padEnd(25).substring(0, 25);
      const status = (website.status || '').padEnd(10);
      const crawlable = website.crawlable ? '✅' : '❌';
      
      console.log(`${name}${domain}${status}${crawlable}`);
    });
    
    console.log(`\nTotal: ${websites.length} websites`);
  }

  /**
   * Output websites as CSV
   */
  private static outputWebsitesCSV(websites: RecipeWebsite[]): void {
    const headers = ['name', 'domain', 'mainUrl', 'status', 'crawlable', 'testRecipeUrl', 'sitemapUrl'];
    console.log(headers.join(','));
    
    websites.forEach(website => {
      const row = headers.map(header => {
        const value = website[header as keyof RecipeWebsite];
        return JSON.stringify(value || '');
      });
      console.log(row.join(','));
    });
  }

  /**
   * Save crawling results to file
   */
  private static async saveResults(results: any, outputDir: string, domain: string): Promise<void> {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `crawl-results-${domain}-${timestamp}.json`;
    const filepath = path.join(outputDir, filename);

    fs.writeFileSync(filepath, JSON.stringify(results, null, 2));
    console.log(`📄 Results saved to: ${filepath}`);
  }
}
