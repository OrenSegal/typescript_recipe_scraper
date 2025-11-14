// Batch Website Scraper - Robust script with timeout/stuck site handling and comprehensive error recovery
import { EnhancedCSVScraper } from './src/enhanced-csv-scraper.js';
import { writeFile, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import pLimit from 'p-limit';

interface BatchConfig {
  csvFiles: string[];
  maxTimePerSite: number;
  maxRetries: number;
  shouldUpsert: boolean;
  maxRecipesPerSite?: number;
  skipSites?: string[];
  resumeFrom?: string;
}

interface SiteProgress {
  name: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'timeout' | 'stuck';
  startTime?: number;
  endTime?: number;
  recipesProcessed: number;
  successRate: number;
  error?: string;
  retryCount: number;
}

class RobustBatchScraper {
  private config: BatchConfig;
  private progressFile: string;
  private progress: Map<string, SiteProgress> = new Map();
  private abortController = new AbortController();

  constructor(config: BatchConfig) {
    this.config = config;
    this.progressFile = `batch-progress-${Date.now()}.json`;
  }

  async scrapeBatch(): Promise<void> {
    console.log(`🚀 Starting robust batch scraping with timeout handling`);
    console.log(`⏱️  Max time per site: ${(this.config.maxTimePerSite / 1000 / 60).toFixed(1)} minutes`);
    console.log(`🔄 Max retries: ${this.config.maxRetries}`);
    console.log(`💾 Upsert to database: ${this.config.shouldUpsert}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
      // Initialize scraper
      const scraper = new EnhancedCSVScraper(this.config.csvFiles[0]);

      // Load websites from CSV files
      const allWebsites = await this.loadWebsitesFromCSVs();
      console.log(`📊 Total websites to process: ${allWebsites.length}`);

      // Filter and resume logic
      let websitesToProcess = allWebsites;
      if (this.config.skipSites?.length) {
        websitesToProcess = allWebsites.filter(site => 
          !this.config.skipSites?.includes(site.name.toLowerCase())
        );
        console.log(`⏭️  Skipping ${this.config.skipSites.length} sites, processing ${websitesToProcess.length}`);
      }

      if (this.config.resumeFrom) {
        const resumeIndex = websitesToProcess.findIndex(site => 
          site.name.toLowerCase() === this.config.resumeFrom?.toLowerCase()
        );
        if (resumeIndex >= 0) {
          websitesToProcess = websitesToProcess.slice(resumeIndex);
          console.log(`🔄 Resuming from "${this.config.resumeFrom}", ${websitesToProcess.length} sites remaining`);
        }
      }

      // Initialize progress tracking
      websitesToProcess.forEach(site => {
        this.progress.set(site.name, {
          name: site.name,
          status: 'pending',
          recipesProcessed: 0,
          successRate: 0,
          retryCount: 0
        });
      });

      // Process websites with concurrency control
      const concurrency = 3; // Process 3 websites simultaneously
      const limit = pLimit(concurrency);
      let successCount = 0;
      let failureCount = 0;
      let processedCount = 0;

      console.log(`🚀 Processing ${websitesToProcess.length} websites with concurrency: ${concurrency}`);

      const processWebsite = async (website: any, index: number) => {
        const progress = this.progress.get(website.name)!;
        
        console.log(`\n🔄 Processing ${index + 1}/${websitesToProcess.length}: ${website.name}`);
        console.log(`📊 Current stats: ${successCount} success, ${failureCount} failed`);

        let attempt = 0;
        let success = false;

        while (attempt <= this.config.maxRetries && !success) {
          attempt++;
          progress.retryCount = attempt - 1;
          progress.status = 'processing';
          progress.startTime = Date.now();

          console.log(`   Attempt ${attempt}/${this.config.maxRetries + 1}...`);

          try {
            // Process with timeout protection
            const result = await this.processWebsiteWithTimeout(scraper, website);
            
            if (result.success) {
              progress.status = 'completed';
              progress.recipesProcessed = result.recipesProcessed || 0;
              progress.successRate = result.successRate || 0;
              progress.endTime = Date.now();
              successCount++;
              success = true;
              
              console.log(`   ✅ Success: ${result.recipesProcessed} recipes, ${result.successRate}% success rate`);
            } else {
              throw new Error(result.error || 'Unknown processing error');
            }

          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.log(`   ❌ Attempt ${attempt} failed: ${errorMessage}`);
            
            progress.error = errorMessage;
            
            if (errorMessage.includes('timeout') || errorMessage.includes('stuck')) {
              progress.status = 'timeout';
              console.log(`   ⏱️  Site appears stuck/timeout - ${attempt <= this.config.maxRetries ? 'retrying' : 'giving up'}`);
            } else {
              progress.status = 'failed';
            }

            // Wait before retry (exponential backoff)
            if (attempt <= this.config.maxRetries) {
              const waitTime = Math.min(30000, 5000 * Math.pow(2, attempt - 1));
              console.log(`   ⏳ Waiting ${waitTime/1000}s before retry...`);
              await new Promise(resolve => setTimeout(resolve, waitTime));
            }
          }

          // Save progress after each attempt
          await this.saveProgress();
        }

        if (!success) {
          failureCount++;
          console.log(`   💀 All attempts failed for ${website.name}`);
        }

        processedCount++;
        // Log current progress
        const overallRate = processedCount > 0 ? (successCount / processedCount * 100).toFixed(1) : '0';
        console.log(`📈 Overall progress: ${processedCount}/${websitesToProcess.length} (${overallRate}% success)`);
        
        return { success, failureCount: success ? 0 : 1, successCount: success ? 1 : 0 };
      };

      // Process all websites concurrently with limit
      const results = await Promise.all(
        websitesToProcess.map((website, index) => 
          limit(() => processWebsite(website, index))
        )
      );

      // Aggregate results
      successCount = results.reduce((sum, result) => sum + result.successCount, 0);
      failureCount = results.reduce((sum, result) => sum + result.failureCount, 0);

      // Generate final report
      await this.generateFinalReport(successCount, failureCount);

    } catch (error) {
      console.error(`❌ Batch scraping failed:`, error);
      throw error;
    }
  }

  private async processWebsiteWithTimeout(scraper: EnhancedCSVScraper, website: any): Promise<{
    success: boolean;
    error?: string;
    recipesProcessed?: number;
    successRate?: number;
  }> {
    return new Promise(async (resolve) => {
      const timeoutId = setTimeout(() => {
        console.log(`   ⏱️  TIMEOUT: ${website.name} exceeded ${this.config.maxTimePerSite/1000/60} minutes`);
        resolve({ 
          success: false, 
          error: `Timeout after ${this.config.maxTimePerSite/1000/60} minutes - site appears stuck` 
        });
      }, this.config.maxTimePerSite);

      try {
        // Process single website using EnhancedCSVScraper
        const mainUrl: string = website['Main URL'];
        const domain: string = (() => {
          try { return new URL(mainUrl).hostname.replace(/^www\./, ''); } catch { return ''; }
        })();
        const websiteData = {
          category: website.Category || 'General',
          name: website['Website Name'],
          mainUrl,
          mainSitemap: website['Main Sitemap URL'],
          subSitemaps: typeof website['Sub-sitemap URLs'] === 'string' 
            ? website['Sub-sitemap URLs'].split(';').map(s => s.trim()).filter(s => s.length > 0)
            : (website['Sub-sitemap URLs'] || []),
          rowIndex: 0,
          // Required by WebsiteInput (extends RecipeWebsite)
          domain,
          status: 'active' as const,
          crawlable: true
        };
        
        const results = await scraper.processWebsite(websiteData);
        clearTimeout(timeoutId);

        if (results.success && results.recipesProcessed > 0) {
          const totalRecipes = results.recipesProcessed;
          const successRate = results.recipesFound > 0 ? (results.recipesProcessed / results.recipesFound * 100) : 0;
          
          resolve({
            success: true,
            recipesProcessed: totalRecipes,
            successRate: successRate
          });
        } else {
          resolve({ 
            success: false, 
            error: 'No recipes successfully processed' 
          });
        }

      } catch (error) {
        clearTimeout(timeoutId);
        resolve({ 
          success: false, 
          error: error instanceof Error ? error.message : 'Processing failed' 
        });
      }
    });
  }

  private async loadWebsitesFromCSVs(): Promise<any[]> {
    const allWebsites: any[] = [];
    
    for (const csvFile of this.config.csvFiles) {
      if (!existsSync(csvFile)) {
        console.warn(`⚠️  CSV file not found: ${csvFile}`);
        continue;
      }
      
      try {
        const content = await readFile(csvFile, 'utf-8');
        const lines = content.split('\n').filter(line => line.trim() && !line.startsWith('#'));
        const headers = lines[0].split(',').map(h => h.trim());
        
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(v => v.trim());
          const website: any = {};
          
          headers.forEach((header, idx) => {
            website[header] = values[idx] || '';
          });
          
          if (website['Website Name'] && website['Main URL']) {
            allWebsites.push(website);
          }
        }
      } catch (error) {
        console.warn(`⚠️  Failed to load CSV ${csvFile}:`, error);
      }
    }
    
    return allWebsites;
  }

  private async saveProgress(): Promise<void> {
    const progressData = {
      timestamp: new Date().toISOString(),
      config: this.config,
      progress: Array.from(this.progress.values())
    };
    
    try {
      await writeFile(this.progressFile, JSON.stringify(progressData, null, 2));
    } catch (error) {
      console.warn(`⚠️  Failed to save progress:`, error);
    }
  }

  private async generateFinalReport(successCount: number, failureCount: number): Promise<void> {
    const totalSites = successCount + failureCount;
    const successRate = totalSites > 0 ? (successCount / totalSites * 100).toFixed(1) : '0';
    
    const report = {
      timestamp: new Date().toISOString(),
      config: this.config,
      summary: {
        totalSites,
        successfulSites: successCount,
        failedSites: failureCount,
        overallSuccessRate: `${successRate}%`
      },
      siteDetails: Array.from(this.progress.values()),
      stuckSites: Array.from(this.progress.values()).filter(p => p.status === 'timeout' || p.status === 'stuck'),
      recommendations: this.generateRecommendations()
    };

    const reportFile = `batch-final-report-${Date.now()}.json`;
    await writeFile(reportFile, JSON.stringify(report, null, 2));

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🎉 Batch scraping completed!`);
    console.log(`📊 Results: ${successCount}/${totalSites} sites successful (${successRate}%)`);
    console.log(`⏱️  Stuck/timeout sites: ${report.stuckSites.length}`);
    console.log(`📄 Final report saved: ${reportFile}`);
    console.log(`📈 Progress tracking: ${this.progressFile}`);
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    const stuckSites = Array.from(this.progress.values()).filter(p => p.status === 'timeout');
    
    if (stuckSites.length > 0) {
      recommendations.push(`Consider increasing timeout from ${this.config.maxTimePerSite/1000/60} minutes for stuck sites`);
      recommendations.push(`Sites to investigate: ${stuckSites.map(s => s.name).join(', ')}`);
    }
    
    const failedSites = Array.from(this.progress.values()).filter(p => p.status === 'failed');
    if (failedSites.length > 5) {
      recommendations.push(`High failure rate (${failedSites.length} sites) - consider debugging common errors`);
    }
    
    recommendations.push(`Use --skip or --resume-from flags to handle problematic sites in future runs`);
    
    return recommendations;
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
🔄 Robust Batch Website Scraper

Usage:
  tsx scrape-batch-websites.ts [options]

Options:
  --csv <file>           CSV file(s) to process (can specify multiple times)
  --timeout <minutes>    Max time per site in minutes (default: 30)
  --retries <number>     Max retries per site (default: 2)
  --upsert              Upsert all scraped recipes to database
  --max-recipes <n>     Max recipes per site
  --skip <site1,site2>  Skip specific sites (comma-separated)
  --resume-from <site>  Resume from specific site
  --help, -h            Show this help message

Examples:
  tsx scrape-batch-websites.ts --csv data/Data.csv --timeout 45 --retries 3
  tsx scrape-batch-websites.ts --csv data/Data.csv --csv data/Data\ File.csv --upsert
  tsx scrape-batch-websites.ts --csv data/Data.csv --skip yummly.com,timeout-site.com
  tsx scrape-batch-websites.ts --csv data/Data.csv --resume-from allrecipes.com
`);
    process.exit(0);
  }

  // Parse configuration
  const config: BatchConfig = {
    csvFiles: [],
    maxTimePerSite: 30 * 60 * 1000, // 30 minutes default
    maxRetries: 2,
    shouldUpsert: false
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--csv':
        config.csvFiles.push(args[i + 1]);
        i++;
        break;
      case '--timeout':
        config.maxTimePerSite = parseInt(args[i + 1]) * 60 * 1000;
        i++;
        break;
      case '--retries':
        config.maxRetries = parseInt(args[i + 1]);
        i++;
        break;
      case '--upsert':
        config.shouldUpsert = true;
        break;
      case '--max-recipes':
        config.maxRecipesPerSite = parseInt(args[i + 1]);
        i++;
        break;
      case '--skip':
        config.skipSites = args[i + 1].split(',').map(s => s.trim().toLowerCase());
        i++;
        break;
      case '--resume-from':
        config.resumeFrom = args[i + 1];
        i++;
        break;
    }
  }

  // Default CSV files if none specified
  if (config.csvFiles.length === 0) {
    config.csvFiles = ['data/Data.csv', 'data/Data File.csv'];
  }

  console.log(`📋 Configuration:`);
  console.log(`   CSV files: ${config.csvFiles.join(', ')}`);
  console.log(`   Timeout per site: ${config.maxTimePerSite/1000/60} minutes`);
  console.log(`   Max retries: ${config.maxRetries}`);
  console.log(`   Skip sites: ${config.skipSites?.join(', ') || 'None'}`);

  const scraper = new RobustBatchScraper(config);
  await scraper.scrapeBatch();
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { RobustBatchScraper };
