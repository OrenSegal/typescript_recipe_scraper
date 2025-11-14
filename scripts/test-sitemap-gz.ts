import { EnhancedCSVScraper } from './src/enhanced-csv-scraper.js';
import { describe, it, expect } from 'vitest';
import path from 'path';
// Define the type locally for the test
interface WebsiteInput {
  rowIndex: number;
  name: string;
  mainUrl: string;
  mainSitemap: string;
  subSitemaps?: string[];
  category: string;
  domain: string;
  status: 'active' | 'inactive';
  crawlable: boolean;
}

describe('EnhancedCSVScraper Sitemap Validation', () => {
  it('should find a working sitemap for a website with a broken initial sitemap', async () => {
    // Provide a dummy path for the constructor
    const scraper = new EnhancedCSVScraper(path.resolve(__dirname, 'dummy.csv'));
    const website: WebsiteInput = {
      rowIndex: 0,
      name: 'sallysbakingaddiction.com',
      mainUrl: 'https://sallysbakingaddiction.com',
      mainSitemap: 'https://sallysbakingaddiction.com/sitemap.xml', // This is a known bad URL
      category: 'Food Blogs',
      domain: 'sallysbakingaddiction.com',
      status: 'active',
      crawlable: true
    };

    const result = await scraper.validateAndFixSitemap(website);

    expect(result.isValid).toBe(true);
    expect(result.workingSitemap).toBe('https://sallysbakingaddiction.com/post-sitemap.xml');
  }, 30000);
});
