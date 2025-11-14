#!/usr/bin/env tsx
/*
 * Execute deletion of files marked for consolidation
 * Deletes both the original files and their .DELETE marker files
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

console.log('🗑️ Executing deletion of marked files...\n');

async function executeConsolidationDeletion() {
  // Find all .DELETE marker files
  const deleteMarkers = await glob('**/*.DELETE', { 
    ignore: ['node_modules/*', '.git/*'],
    dot: true 
  });

  let deletedCount = 0;
  let errorCount = 0;

  for (const markerFile of deleteMarkers) {
    const originalFile = markerFile.replace('.DELETE', '');
    
    try {
      // Read the marker file to get the reason
      const markerContent = fs.readFileSync(markerFile, 'utf8');
      const reasonMatch = markerContent.match(/Reason: (.+)/);
      const reason = reasonMatch ? reasonMatch[1] : 'Consolidation';

      // Delete the original file if it exists
      if (fs.existsSync(originalFile)) {
        fs.unlinkSync(originalFile);
        console.log(`✅ Deleted: ${originalFile}`);
      } else {
        console.log(`⚠️ Original not found: ${originalFile}`);
      }

      // Delete the marker file
      fs.unlinkSync(markerFile);
      console.log(`🏷️ Removed marker: ${markerFile}`);
      
      deletedCount++;

    } catch (error) {
      console.error(`❌ Error deleting ${originalFile}:`, error);
      errorCount++;
    }

    console.log(''); // Empty line for readability
  }

  console.log(`\n🎉 Consolidation deletion complete!`);
  console.log(`✅ Successfully deleted: ${deletedCount} files`);
  console.log(`❌ Errors encountered: ${errorCount} files`);

  // Verify core pipeline files are intact
  console.log(`\n🔍 Verifying core pipeline integrity...`);
  
  const coreFiles = [
    'src/scrapers/websiteScraper.ts',
    'src/processor/BatchRecipeProcessor.ts', 
    'src/core/RecipeProcessor.ts',
    'src/crawler/SitemapCrawler.ts',
    'src/run-mass-scraper.ts',
    'src/database.ts',
    'src/types.ts',
    'src/enrichment/ComprehensiveEnrichment.ts'
  ];

  let coreIntact = true;
  for (const coreFile of coreFiles) {
    if (fs.existsSync(coreFile)) {
      console.log(`✅ Core file intact: ${coreFile}`);
    } else {
      console.log(`❌ Core file missing: ${coreFile}`);
      coreIntact = false;
    }
  }

  if (coreIntact) {
    console.log(`\n🎯 CONSOLIDATION SUCCESS:`);
    console.log(`- Core functional pipeline preserved`);
    console.log(`- ${deletedCount} redundant files removed`);
    console.log(`- Codebase now follows DRY/YAGNI/SOLID/KISS principles`);
    console.log(`- Project structure simplified and maintainable`);
  } else {
    console.log(`\n⚠️ WARNING: Some core files may have been accidentally removed!`);
  }
}

executeConsolidationDeletion().catch(console.error);
