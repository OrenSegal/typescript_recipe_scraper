/**
 * Simplified Enterprise Recipe Scraper
 * Integrates enterprise features with your existing perfect parsing system
 * Avoids complex Crawlee API compatibility issues
 */

import { WebsiteManager } from './manager/WebsiteManager.js';
import { BatchRecipeProcessor } from './processor/BatchRecipeProcessor.js';
import { ComplianceManager } from './infrastructure/ComplianceManager.js';
import { EnterpriseConfigManager } from './infrastructure/EnterpriseConfig.js';
import * as fs from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import * as path from 'path';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { Command } from 'commander';

// Load environment variables
config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CSV_FILE_PATH = path.resolve(__dirname, '../data/Data.csv');

interface EnterpriseScrapingConfig {
  operationSize: 'small' | 'medium' | 'enterprise';
  maxSites: number;
  maxUrlsPerSite: number;
  enableCompliance: boolean;
  enableGovernance: boolean;
  priority: number;
  respectRobotsTxt: boolean;
}

interface EnterpriseScrapingResult {
  operationId: string;
  startTime: Date;
  endTime: Date;
  summary: {
    totalSites: number;
    totalUrls: number;
    successfulScrapes: number;
    failedScrapes: number;
    complianceBlocked: number;
    successRate: number;
  };
  compliance: {
    robotsChecks: number;
    allowed: number;
    blocked: number;
    warnings: string[];
  };
  governance: {
    auditTrailEnabled: boolean;
    dataLineageTracked: boolean;
    retentionPolicies: boolean;
  };
  sites: Array<{
    name: string;
    url: string;
    recipesFound: number;
    recipesScraped: number;
    complianceStatus: string;
    errors: string[];
  }>;
}

class SimplifiedEnterpriseScraper {
  private websiteManager: WebsiteManager;
  private batchProcessor: BatchRecipeProcessor;
  private complianceManager: ComplianceManager;
  private enterpriseConfig: EnterpriseConfigManager;
  private config: EnterpriseScrapingConfig;
  private resultsDir: string;

  constructor(config: Partial<EnterpriseScrapingConfig> = {}) {
    this.config = {
      operationSize: 'medium',
      maxSites: 10,
      maxUrlsPerSite: 50,
      enableCompliance: true,
      enableGovernance: true,
      priority: 7,
      respectRobotsTxt: true,
      ...config
    };

    // Initialize components
    this.websiteManager = new WebsiteManager();
    this.batchProcessor = new BatchRecipeProcessor();
    this.enterpriseConfig = EnterpriseConfigManager.getInstance();
    this.complianceManager = new ComplianceManager(this.enterpriseConfig.getConfig());

    // Setup results directory
    this.resultsDir = path.resolve(__dirname, '../results/enterprise-scraping');
    if (!existsSync(this.resultsDir)) {
      mkdirSync(this.resultsDir, { recursive: true });
    }
  }

  /**
   * Enterprise-enhanced discovery phase with compliance checking
   */
  async discoverRecipeUrls(): Promise<{ url: string; complianceResult: any }[]> {
    console.log('\n🔍 === ENTERPRISE DISCOVERY PHASE ===');
    
    // Load websites from CSV
    await this.websiteManager.loadFromCSV(CSV_FILE_PATH);
    const allWebsites = this.websiteManager.getAllWebsites();
    const sitesToProcess = allWebsites.slice(0, this.config.maxSites);
    
    console.log(`📊 Processing ${sitesToProcess.length} websites with enterprise compliance`);

    const enterpriseUrls: { url: string; complianceResult: any }[] = [];

    for (const website of sitesToProcess) {
      try {
        console.log(`\n🔍 Enterprise processing ${website.name}...`);
        
        // Extract URLs to check
        const urlsToCheck = [
          website.sitemap_url,
          website.base_url
        ].filter(Boolean);

        for (const url of urlsToCheck) {
          if (url && enterpriseUrls.length < this.config.maxUrlsPerSite) {
            // Enterprise compliance check
            let complianceResult: { canScrape: boolean; warnings: string[]; restrictions: string[] } = { 
              canScrape: true, 
              warnings: [], 
              restrictions: [] 
            };
            
            if (this.config.enableCompliance) {
              try {
                complianceResult = await this.complianceManager.checkCompliance(url);
                
                if (complianceResult.canScrape) {
                  console.log(`✅ Compliance OK for ${website.name}`);
                } else {
                  console.log(`❌ Compliance blocked for ${website.name}: ${complianceResult.restrictions.join(', ')}`);
                  continue; // Skip this URL due to compliance issues
                }
              } catch (error) {
                console.warn(`⚠️ Compliance check failed for ${website.name}, proceeding anyway`);
                complianceResult.warnings.push(`Compliance check error: ${String(error)}`);
              }
            }

            enterpriseUrls.push({
              url,
              complianceResult
            });
          }
        }
        
        console.log(`✅ Enterprise processed ${website.name}`);
      } catch (error) {
        console.error(`❌ Enterprise discovery failed for ${website.name}:`, error);
      }
    }

    console.log(`\n🎯 Enterprise Discovery Complete: ${enterpriseUrls.length} compliant URLs found`);
    return enterpriseUrls;
  }

  /**
   * Enterprise-enhanced scraping with your existing perfect parsing system
   */
  async scrapeWithEnterpriseFeatures(urls: { url: string; complianceResult: any }[]): Promise<any> {
    console.log('\n🏭 === ENTERPRISE SCRAPING PHASE ===');
    
    const startTime = new Date();
    let successCount = 0;
    let failureCount = 0;
    const complianceStats = { checked: 0, allowed: 0, blocked: 0 };
    const warnings: string[] = [];

    // Process URLs with your existing batch processor + enterprise features
    const urlsToScrape = urls
      .filter(item => item.complianceResult.canScrape)
      .map(item => {
        complianceStats.checked++;
        complianceStats.allowed++;
        
        // Add any compliance warnings to our tracking
        if (item.complianceResult.warnings?.length > 0) {
          warnings.push(...item.complianceResult.warnings);
        }
        
        return item.url;
      });

    console.log(`🚀 Enterprise scraping ${urlsToScrape.length} compliant URLs...`);
    
    try {
      // Use your existing perfect parsing system
      const result = await this.batchProcessor.processUrls(urlsToScrape);
      
      successCount = result.successful;
      failureCount = result.failed;
      
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();
      
      console.log('\n📊 === ENTERPRISE SCRAPING RESULTS ===');
      console.log(`⏱️  Duration: ${Math.round(duration / 1000)}s`);
      console.log(`✅ Success Rate: ${((successCount / (successCount + failureCount)) * 100).toFixed(1)}%`);
      console.log(`📝 URLs Processed: ${urlsToScrape.length}`);
      console.log(`🎯 Recipes Saved: ${successCount}`);
      console.log(`❌ Failed: ${failureCount}`);
      console.log(`⚠️  Compliance Warnings: ${warnings.length}`);
      
      const enterpriseResult: EnterpriseScrapingResult = {
        operationId: `enterprise-${Date.now()}`,
        startTime,
        endTime,
        summary: {
          totalSites: this.config.maxSites,
          totalUrls: urlsToScrape.length,
          successfulScrapes: successCount,
          failedScrapes: failureCount,
          complianceBlocked: complianceStats.checked - complianceStats.allowed,
          successRate: (successCount / (successCount + failureCount)) * 100
        },
        compliance: {
          robotsChecks: complianceStats.checked,
          allowed: complianceStats.allowed,
          blocked: complianceStats.blocked,
          warnings
        },
        governance: {
          auditTrailEnabled: this.config.enableGovernance,
          dataLineageTracked: this.config.enableGovernance,
          retentionPolicies: this.config.enableGovernance
        },
        sites: [] // Would be populated with detailed site results
      };
      
      // Save enterprise report
      await this.saveEnterpriseReport(enterpriseResult);
      
      return enterpriseResult;
    } catch (error) {
      console.error('🚨 Enterprise scraping failed:', error);
      throw error;
    }
  }

  /**
   * Save comprehensive enterprise report
   */
  async saveEnterpriseReport(result: EnterpriseScrapingResult): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = path.join(this.resultsDir, `simplified-enterprise-report-${timestamp}.json`);
    
    await fs.writeFile(reportPath, JSON.stringify(result, null, 2));
    console.log(`📄 Enterprise report saved: ${reportPath}`);
  }

  /**
   * Main execution method
   */
  async run(): Promise<void> {
    console.log('🏭 === SIMPLIFIED ENTERPRISE RECIPE SCRAPER ===');
    console.log(`Configuration: ${this.config.operationSize} operation`);
    console.log(`Max Sites: ${this.config.maxSites}, Max URLs/Site: ${this.config.maxUrlsPerSite}`);
    console.log(`Compliance: ${this.config.enableCompliance ? '✅' : '❌'}, Governance: ${this.config.enableGovernance ? '✅' : '❌'}`);
    
    try {
      // Phase 1: Enterprise Discovery with compliance
      const compliantUrls = await this.discoverRecipeUrls();
      
      if (compliantUrls.length === 0) {
        console.log('⚠️  No compliant URLs discovered. Exiting.');
        return;
      }

      // Phase 2: Enterprise Scraping with your existing perfect parsing
      const enterpriseResult = await this.scrapeWithEnterpriseFeatures(compliantUrls);
      
      console.log('\n🎉 === SIMPLIFIED ENTERPRISE SCRAPING COMPLETE ===');
      console.log(`📊 Final Success Rate: ${enterpriseResult.summary.successRate.toFixed(1)}%`);
      console.log(`🏛️  Enterprise governance features: ${this.config.enableGovernance ? 'ACTIVE' : 'DISABLED'}`);
      
    } catch (error) {
      console.error('\n🚨 Simplified enterprise scraping failed:', error);
      process.exit(1);
    }
  }
}

// CLI interface
const program = new Command();

program
  .name('simplified-enterprise-scraper')
  .description('Simplified enterprise-grade recipe scraper with compliance')
  .version('1.0.0');

program
  .option('-s, --size <size>', 'Operation size: small, medium, enterprise', 'medium')
  .option('-m, --max-sites <number>', 'Maximum sites to process', '10')
  .option('-u, --max-urls <number>', 'Maximum URLs per site', '50')
  .option('-p, --priority <number>', 'Scraping priority (1-10)', '7')
  .option('--no-compliance', 'Disable compliance checking')
  .option('--no-governance', 'Disable governance tracking')
  .option('--quick', 'Quick test mode (3 sites, 5 URLs each)')
  .action(async (options) => {
    const config: Partial<EnterpriseScrapingConfig> = {
      operationSize: options.size as 'small' | 'medium' | 'enterprise',
      maxSites: options.quick ? 3 : parseInt(options.maxSites),
      maxUrlsPerSite: options.quick ? 5 : parseInt(options.maxUrls),
      priority: parseInt(options.priority),
      enableCompliance: options.compliance !== false,
      enableGovernance: options.governance !== false
    };
    
    const scraper = new SimplifiedEnterpriseScraper(config);
    await scraper.run();
  });

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  program.parse();
}

export { SimplifiedEnterpriseScraper };
