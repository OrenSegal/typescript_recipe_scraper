import * as fs from 'fs';
import * as path from 'path';

export interface RecipeWebsite {
  name: string;
  mainUrl: string;
  testRecipeUrl?: string;
  status: 'active' | 'inactive';
  domain: string;
  sitemapUrl?: string;
  crawlable: boolean;
  notes?: string;
  lastCrawled?: Date;
  recipesFound?: number;
}

export interface WebsiteManagerConfig {
  csvFilePath: string;
  autoLoad?: boolean;
}

export class WebsiteManager {
  private websites: RecipeWebsite[] = [];
  private csvFilePath: string;
  private isLoaded = false;

  constructor(csvFilePath: string) {
    this.csvFilePath = csvFilePath;
  }

  /**
   * Load websites from CSV file
   */
  async loadWebsites(): Promise<void> {
    try {
      if (!fs.existsSync(this.csvFilePath)) {
        console.warn(`CSV file not found: ${this.csvFilePath}. Creating default websites list.`);
        this.createDefaultWebsites();
        return;
      }

      const csvContent = fs.readFileSync(this.csvFilePath, 'utf-8');
      const lines = csvContent.split('\n').filter(line => line.trim());
      
      // Skip header row
      const dataLines = lines.slice(1);
      
      this.websites = dataLines.map(line => {
        const columns = this.parseCsvLine(line);
        return this.parseWebsiteFromCsv(columns);
      }).filter(website => website !== null) as RecipeWebsite[];

      this.isLoaded = true;
      console.log(`✅ Loaded ${this.websites.length} websites from ${this.csvFilePath}`);
    } catch (error) {
      console.error(`❌ Failed to load websites from CSV: ${error}`);
      this.createDefaultWebsites();
    }
  }

  /**
   * Get all active websites
   */
  async getActiveWebsites(): Promise<RecipeWebsite[]> {
    if (!this.isLoaded) {
      await this.loadWebsites();
    }
    return this.websites.filter(website => website.status === 'active');
  }

  /**
   * Get all websites
   */
  async getAllWebsites(): Promise<RecipeWebsite[]> {
    if (!this.isLoaded) {
      await this.loadWebsites();
    }
    return [...this.websites];
  }

  /**
   * Get website by domain
   */
  async getWebsiteByDomain(domain: string): Promise<RecipeWebsite | undefined> {
    if (!this.isLoaded) {
      await this.loadWebsites();
    }
    return this.websites.find(website => website.domain === domain);
  }

  /**
   * Add a new website
   */
  addWebsite(website: RecipeWebsite): void {
    this.websites.push(website);
  }

  /**
   * Update website status
   */
  async updateSitemapUrl(domain: string, newSitemapUrl: string): Promise<boolean> {
    if (!this.isLoaded) {
      await this.loadWebsites();
    }
    const website = this.websites.find(w => w.domain === domain);
    if (website) {
      website.sitemapUrl = newSitemapUrl;
      await this.saveToCSV();
      return true;
    }
    return false;
  }

  /**
   * Update website status
   */
  updateWebsiteStatus(domain: string, status: 'active' | 'inactive'): boolean {
    const website = this.websites.find(w => w.domain === domain);
    if (website) {
      website.status = status;
      return true;
    }
    return false;
  }

  /**
   * Parse CSV line handling quoted values
   */
  private parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current.trim());
    return result;
  }

  /**
   * Parse website data from CSV columns
   */
  private parseWebsiteFromCsv(columns: string[]): RecipeWebsite | null {
    try {
      // Expected CSV format: name,mainUrl,testRecipeUrl,status,domain,sitemapUrl,crawlable,notes
      if (columns.length < 4) {
        console.warn(`Invalid CSV row: insufficient columns`);
        return null;
      }

      return {
        name: columns[0] || '',
        mainUrl: columns[1] || '',
        testRecipeUrl: columns[2] || undefined,
        status: (columns[3] as 'active' | 'inactive') || 'active',
        domain: columns[4] || this.extractDomain(columns[1]),
        sitemapUrl: columns[5] || undefined,
        crawlable: columns[6]?.toLowerCase() === 'true' || true,
        notes: columns[7] || undefined
      };
    } catch (error) {
      console.warn(`Failed to parse CSV row: ${error}`);
      return null;
    }
  }

  /**
   * Extract domain from URL
   */
  private extractDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  }

  /**
   * Create default websites list when CSV doesn't exist
   */
  private createDefaultWebsites(): void {
    this.websites = [
      {
        name: 'AllRecipes',
        mainUrl: 'https://www.allrecipes.com',
        testRecipeUrl: 'https://www.allrecipes.com/recipe/213742/cheesy-chicken-broccoli-casserole/',
        status: 'active',
        domain: 'allrecipes.com',
        crawlable: true,
        notes: 'Popular recipe site with good structured data'
      },
      {
        name: 'Food Network',
        mainUrl: 'https://www.foodnetwork.com',
        testRecipeUrl: 'https://www.foodnetwork.com/recipes/alton-brown/baked-macaroni-and-cheese-recipe-1939524',
        status: 'active',
        domain: 'foodnetwork.com',
        crawlable: true,
        notes: 'Professional recipes with detailed instructions'
      },
      {
        name: 'BBC Good Food',
        mainUrl: 'https://www.bbcgoodfood.com',
        testRecipeUrl: 'https://www.bbcgoodfood.com/recipes/classic-lasagne',
        status: 'active',
        domain: 'bbcgoodfood.com',
        crawlable: true,
        notes: 'UK-based recipe site with excellent quality'
      }
    ];

    this.isLoaded = true;
    console.log(`✅ Created default websites list with ${this.websites.length} websites`);
  }

  /**
   * Save current websites to CSV file
   */
  async saveToCSV(): Promise<void> {
    try {
      const header = 'name,mainUrl,testRecipeUrl,status,domain,sitemapUrl,crawlable,notes\n';
      const csvContent = header + this.websites.map(website => {
        return [
          `"${website.name}"`,
          `"${website.mainUrl}"`,
          `"${website.testRecipeUrl || ''}"`,
          website.status,
          `"${website.domain}"`,
          `"${website.sitemapUrl || ''}"`,
          website.crawlable,
          `"${website.notes || ''}"`
        ].join(',');
      }).join('\n');

      // Ensure directory exists
      const dir = path.dirname(this.csvFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(this.csvFilePath, csvContent);
      console.log(`✅ Saved ${this.websites.length} websites to ${this.csvFilePath}`);
    } catch (error) {
      console.error(`❌ Failed to save websites to CSV: ${error}`);
      throw error;
    }
  }
}
