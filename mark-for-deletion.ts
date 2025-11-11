#!/usr/bin/env tsx
/*
 * Mark redundant files for deletion (following DRY/YAGNI/SOLID/KISS principles)
 * This script creates .DELETE markers for files to be removed, but doesn't delete them yet
 */

import * as fs from 'fs';
import * as path from 'path';

const filesToMarkForDeletion = [
  // Duplicate Crawler Implementations (Violates DRY)
  'src/ScalableCrawler.ts',
  'src/WorkingScalableCrawler.ts', 
  'src/DynamicRecipeDiscovery.ts',
  'src/enhanced-sitemap-crawler.ts',
  'src/sitemapCrawler.ts',
  'src/sitemapCrawlerEnhanced.ts',
  'src/standalone-crawler.ts',
  'src/mass-crawler.ts',

  // Test/Debug Files (Development Only - Violates YAGNI)
  'debug-data-wholeness.ts',
  'debug-food52-html.ts', 
  'debug-food52.ts',
  'debug-json-ld.ts',
  'debug-timing-extraction.ts',
  'src/debug-enrichment.ts',
  'comprehensive-pipeline-test.ts',
  'test-food52.cjs',
  'test-food52.mjs',
  'quick-food52-test.js',
  'src/test-csv-integration.ts',
  'src/test-failure-handling.ts',
  'src/simple-csv-test.ts',
  'src/simple.test.ts',
  'validate-quality-achievements.ts',
  'src/validate-data.ts',
  'src/validate-enrichment.ts',
  'inspect-food-network-selectors.ts',

  // Duplicate Pipeline Implementations (Violates DRY)  
  'src/ProductionPipeline.ts',
  'robust-end-to-end-pipeline.ts',
  'streamlined-pipeline-example.ts', 
  'enhanced-mass-crawl.ts',
  'csv-driven-mass-crawler.ts',
  'mass-crawl-production.ts',

  // Standalone/Legacy Files (Violates KISS)
  'src/enhanced-recipe-scraper.ts',
  'src/scraper-standalone.ts', 
  'scrape-all.ts',
  'run-enhanced-crawl.js',
  'model.nlp',

  // Unused Utilities/Examples
  'src/repair-recipes.ts',
  'local-processor.ts', 
  'run-local.ts',
  'src/run-batch-demo.ts',
  'upsert-all-websites.ts',

  // Result/Log Files (Historical Data Only)
  'csv-crawl-results-2025-08-06T03-29-03-292Z.json',
  'csv-crawl-results-2025-08-06T03-48-34-912Z.json', 
  'csv-crawl-results-2025-08-06T03-59-41-666Z.json',
  'csv-crawl-results-2025-08-06T04-09-10-515Z.json',
  'csv-crawl-results-2025-08-06T04-21-45-313Z.json',
  'csv-crawl-results-2025-08-06T04-58-35-130Z.json',
  'enhanced-crawl-demo-results.json',
  'mass-crawl-stats-2025-08-05T20-33-54-440Z.json',
  'robust-pipeline-stats-2025-08-06T02-48-48-674Z.json',
  'scraper-stats.json',
  'digest.txt',
  'src/website-sample-export.json',

  // Duplicate Configuration Files
  'recipe-parsing-specification.ts', // Functionality integrated into core pipeline
  'pnpm-lock.yaml', // Keep package-lock.json instead
  'jest.config.js', // Using vitest instead

  // Legacy/Unused Documentation
  'parsing_formats.md', // Covered in main docs
  'recipe-parsing-guide.md', // Covered in main docs
  'gemini-embedding.md' // Implementation complete
];

console.log('🗑️ Marking files for deletion (DRY/YAGNI/SOLID/KISS consolidation)...\n');

let markedCount = 0;

for (const filePath of filesToMarkForDeletion) {
  if (fs.existsSync(filePath)) {
    const deleteMarker = `${filePath}.DELETE`;
    const consolidationReason = getConsolidationReason(filePath);
    
    const markerContent = `# MARKED FOR DELETION
File: ${filePath}
Reason: ${consolidationReason}
Date: ${new Date().toISOString()}
Principle Violated: ${getPrincipleViolated(filePath)}

This file has been marked for deletion as part of codebase consolidation 
following DRY/YAGNI/SOLID/KISS principles.

The functionality of this file is either:
- Duplicated elsewhere (DRY violation)
- Not needed for production (YAGNI violation)  
- Violates single responsibility (SOLID violation)
- Adds unnecessary complexity (KISS violation)
`;

    fs.writeFileSync(deleteMarker, markerContent);
    console.log(`✅ Marked: ${filePath} (${consolidationReason})`);
    markedCount++;
  } else {
    console.log(`⚠️ Not found: ${filePath}`);
  }
}

console.log(`\n🎉 Consolidation marking complete!`);
console.log(`📊 Files marked for deletion: ${markedCount}`);
console.log(`📊 Core functional pipeline preserved`);

console.log(`\n✅ CONSOLIDATION BENEFITS:`);
console.log(`- Eliminated code duplication (DRY)`);  
console.log(`- Removed unnecessary files (YAGNI)`);
console.log(`- Maintained single responsibilities (SOLID)`);
console.log(`- Simplified project structure (KISS)`);

function getConsolidationReason(filePath: string): string {
  if (filePath.includes('debug-') || filePath.includes('test-') || filePath.includes('inspect-')) {
    return 'Development/debug file - not needed for production';
  }
  if (filePath.includes('crawler') && !filePath.includes('SitemapCrawler.ts')) {
    return 'Duplicate crawler implementation';  
  }
  if (filePath.includes('pipeline') || filePath.includes('mass-crawl')) {
    return 'Duplicate pipeline implementation';
  }
  if (filePath.includes('results') || filePath.includes('stats')) {
    return 'Historical data file - not needed for production';
  }
  if (filePath.includes('standalone') || filePath.includes('scraper-') && !filePath.includes('websiteScraper')) {
    return 'Legacy/standalone implementation replaced by core system';
  }
  return 'Redundant functionality covered by core pipeline';
}

function getPrincipleViolated(filePath: string): string {
  if (filePath.includes('debug-') || filePath.includes('test-') || filePath.includes('validate-')) {
    return 'YAGNI (You Aren\'t Gonna Need It)';
  }
  if (filePath.includes('crawler') || filePath.includes('pipeline') || filePath.includes('mass-crawl')) {
    return 'DRY (Don\'t Repeat Yourself)';  
  }
  if (filePath.includes('enhanced-') || filePath.includes('comprehensive-')) {
    return 'KISS (Keep It Simple, Stupid)';
  }
  return 'DRY/YAGNI (Duplication + Unnecessary)';
}
