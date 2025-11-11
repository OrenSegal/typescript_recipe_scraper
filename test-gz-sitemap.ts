#!/usr/bin/env tsx
// Test script to verify .xml.gz sitemap support

import { SitemapCrawler } from './src/crawler/SitemapCrawler.js';
import { Website } from './src/shared/types.js';

async function testGzSitemapSupport() {
  console.log('🧪 Testing .xml.gz sitemap support...');
  
  const crawler = new SitemapCrawler({
    concurrency: 5,
    recipeUrlPattern: /\/recipe\/\d+\//i,
    requestTimeout: 30000
  });

  // Test with a site that might have .gz sitemaps
  const testWebsite: Website = {
    id: 1,
    name: 'Test Food Network',
    base_url: 'https://www.foodnetwork.com',
    sitemap_url: 'https://www.foodnetwork.com/sitemaps/sitemap_food_2.xml.gz',
    sub_sitemaps: [],
    category: 'Test',
    priority: 10,
    active: true
  };

  try {
    console.log(`🔍 Testing direct .xml.gz sitemap: ${testWebsite.sitemap_url}`);
    const result = await crawler.crawlWebsite(testWebsite);
    
    console.log(`✅ Crawl completed for ${testWebsite.name}`);
    console.log(`📊 URLs found: ${result.recipeUrls.length}`);
    console.log(`❌ Errors: ${result.errors.length}`);
    
    if (result.errors.length > 0) {
      console.log('🚨 Errors encountered:');
      result.errors.forEach(error => console.log(`  - ${error}`));
    }
    
    if (result.recipeUrls.length > 0) {
      console.log('🎉 Sample URLs found:');
      result.recipeUrls.slice(0, 3).forEach(url => console.log(`  - ${url}`));
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testGzSitemapSupport().catch(console.error);
