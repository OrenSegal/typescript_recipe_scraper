#!/usr/bin/env node

/**
 * Integration Test for Enterprise Mass Scraper
 * Tests the consolidated workflow with a small sample
 */

import { SimplifiedEnterpriseScraper } from './simplified-enterprise-scraper.js';

async function testIntegration() {
  console.log(' === ENTERPRISE INTEGRATION TEST ===');
  
  try {
    // Test enterprise scraper initialization
    const scraper = new SimplifiedEnterpriseScraper({
      operationSize: 'small',
      maxSites: 2,
      maxUrlsPerSite: 3,
      enableGovernance: true,
      enableCompliance: true,
      priority: 5
    });
    
    console.log(' Enterprise scraper initialized successfully');
    
    // Test discovery phase only (no actual scraping)
    await scraper.run();
    
    console.log(' Discovery test completed successfully');
    console.log(' Integration test successful!');
    process.exit(0);
    
  } catch (error) {
    console.error(' Integration test failed:', error);
    console.error('❌ Integration test failed:', error);
    process.exit(1);
  }
}

// Run test if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testIntegration();
}

export { testIntegration };
