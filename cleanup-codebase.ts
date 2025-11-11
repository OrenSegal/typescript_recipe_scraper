/*
 * Codebase Cleanup Script
 * 
 * Removes redundant and duplicate files to streamline the codebase
 * Keeps only files relevant to the core workflow:
 * - Crawling & Scraping
 * - Parsing & Formatting
 * - Data Enrichment
 * - Embedding Generation
 * - Supabase Upserting
 */

import { promises as fs } from 'fs';
import { join } from 'path';

interface CleanupConfig {
  dryRun: boolean;
  verbose: boolean;
}

class CodebaseCleanup {
  private config: CleanupConfig;
  private rootDir: string;
  private filesToRemove: string[] = [];
  private filesToKeep: string[] = [];

  constructor(config: Partial<CleanupConfig> = {}) {
    this.config = {
      dryRun: true,
      verbose: true,
      ...config
    };
    this.rootDir = process.cwd();
  }

  /*
   * Run the complete cleanup process
   */
  async cleanup(): Promise<void> {
    console.log('🧹 CODEBASE CLEANUP STARTING');
    console.log('============================\n');
    
    if (this.config.dryRun) {
      console.log('🔍 DRY RUN MODE - No files will be deleted\n');
    }

    try {
      // Identify files to remove and keep
      await this.identifyFiles();
      
      // Display cleanup plan
      this.displayCleanupPlan();
      
      // Execute cleanup (if not dry run)
      if (!this.config.dryRun) {
        await this.executeCleanup();
      }
      
      console.log('\n✅ Cleanup completed successfully!');
      
    } catch (error) {
      console.error('❌ Cleanup failed:', error);
      throw error;
    }
  }

  /*
   * Identify files to remove and keep
   */
  private async identifyFiles(): Promise<void> {
    console.log('🔍 Analyzing codebase structure...\n');

    // Files to KEEP (core workflow)
    const keepPatterns = [
      // Core system files
      'src/core/StreamlinedWorkflow.ts',
      'src/core/DatabaseService.ts',
      'src/core/RecipeProcessor.ts',
      'src/core/RecipeService.ts',
      'src/ProductionPipeline.ts',
      
      // Essential scraping
      'src/scrapers/websiteScraper.ts',
      'src/scrapers/SocialMediaScraper.ts',
      'src/scrapers/UnifiedScraper.ts',
      
      // Enhanced parsing (100% working)
      'src/enrichment/ingredientParser.ts',
      'src/enrichment/comprehensiveEnrichment.ts',
      'src/enrichment/embeddingGenerator.ts',
      'src/enrichment/enhancedDietSuitability.ts',
      'src/enrichment/smartCategorization.ts',
      'src/enrichment/nutritionEnrichment.ts',
      
      // Database and types
      'src/database.ts',
      'src/types.ts',
      'src/config.ts',
      
      // Essential specifications
      'recipe-parsing-specification.ts',
      
      // Production pipeline
      'streamlined-pipeline-example.ts',
      'robust-end-to-end-pipeline.ts',
      
      // Package files
      'package.json',
      'package-lock.json',
      'tsconfig.json',
      'tsconfig.build.json',
      '.env',
      '.gitignore',
      'README.md'
    ];

    // Files to REMOVE (redundant/test files)
    const removePatterns = [
      // Test files
      'test-*.ts',
      'src/*/*.test.ts',
      'src/test/*/*',
      
      // Debug files
      'src/debug-*.ts',
      'src/validate-*.ts',
      'src/repair-*.ts',
      
      // Redundant parsing files
      'src/enrichment/productionNERParser.ts',
      'src/enrichment/alternativeEmbeddingGenerator.ts',
      'src/enrichment/robustAuthorExtraction.ts',
      
      // Documentation files (keep only essential)
      'deep-research-spec.md',
      'gemini-embedding.md',
      'parsing_formats.md',
      'recipe-parsing-guide.md',
      'recipe_schema_documentation.md',
      'specifcation.md',
      'supabase_scheme.md',
      
      // Old pipeline files
      'local-processor.ts',
      'run-local.ts',
      'scrape-all.ts',
      'upsert-all-websites.ts',
      
      // Stats and logs
      '*.json',
      'digest.txt',
      'model.nlp',
      
      // Build artifacts
      'dist/*/*',
      'node_modules/*/*',
      '.tsbuildinfo'
    ];

    // Scan for files to keep
    for (const pattern of keepPatterns) {
      const files = await this.findFiles(pattern);
      this.filesToKeep.push(...files);
    }

    // Scan for files to remove
    for (const pattern of removePatterns) {
      const files = await this.findFiles(pattern);
      // Only add if not in keep list
      const filtered = files.filter(file => !this.filesToKeep.includes(file));
      this.filesToRemove.push(...filtered);
    }

    // Remove duplicates
    this.filesToKeep = [...new Set(this.filesToKeep)];
    this.filesToRemove = [...new Set(this.filesToRemove)];
  }

  /*
   * Find files matching pattern
   */
  private async findFiles(pattern: string): Promise<string[]> {
    const files: string[] = [];
    
    try {
      if (pattern.includes('**')) {
        // Recursive pattern - implement basic glob matching
        const basePath = pattern.split('**')[0];
        const suffix = pattern.split('**')[1] || '';
        files.push(...await this.findFilesRecursive(basePath, suffix));
      } else if (pattern.includes('*')) {
        // Simple wildcard pattern
        const dir = pattern.includes('/') ? pattern.substring(0, pattern.lastIndexOf('/')) : '.';
        const namePattern = pattern.includes('/') ? pattern.substring(pattern.lastIndexOf('/') + 1) : pattern;
        files.push(...await this.findFilesInDir(dir, namePattern));
      } else {
        // Exact file path
        const fullPath = join(this.rootDir, pattern);
        try {
          await fs.access(fullPath);
          files.push(pattern);
        } catch {
          // File doesn't exist, skip
        }
      }
    } catch (error) {
      if (this.config.verbose) {
        console.warn(`⚠️ Error scanning pattern ${pattern}:`, error);
      }
    }
    
    return files;
  }

  /*
   * Find files recursively
   */
  private async findFilesRecursive(basePath: string, suffix: string): Promise<string[]> {
    const files: string[] = [];
    const fullBasePath = join(this.rootDir, basePath);
    
    try {
      const entries = await fs.readdir(fullBasePath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = join(basePath, entry.name);
        
        if (entry.isDirectory()) {
          files.push(...await this.findFilesRecursive(fullPath, suffix));
        } else if (entry.isFile() && entry.name.endsWith(suffix.replace('*', ''))) {
          files.push(fullPath);
        }
      }
    } catch {
      // Directory doesn't exist or can't be read
    }
    
    return files;
  }

  /*
   * Find files in directory matching pattern
   */
  private async findFilesInDir(dir: string, namePattern: string): Promise<string[]> {
    const files: string[] = [];
    const fullDirPath = join(this.rootDir, dir);
    
    try {
      const entries = await fs.readdir(fullDirPath);
      
      for (const entry of entries) {
        if (this.matchesPattern(entry, namePattern)) {
          files.push(join(dir, entry));
        }
      }
    } catch {
      // Directory doesn't exist or can't be read
    }
    
    return files;
  }

  /*
   * Check if filename matches pattern
   */
  private matchesPattern(filename: string, pattern: string): boolean {
    if (pattern === '*') return true;
    if (pattern.startsWith('*')) {
      return filename.endsWith(pattern.substring(1));
    }
    if (pattern.endsWith('*')) {
      return filename.startsWith(pattern.substring(0, pattern.length - 1));
    }
    return filename === pattern;
  }

  /*
   * Display cleanup plan
   */
  private displayCleanupPlan(): void {
    console.log('📋 CLEANUP PLAN:');
    console.log('================\n');
    
    console.log(`✅ Files to KEEP (${this.filesToKeep.length}):`);
    if (this.config.verbose) {
      this.filesToKeep.sort().forEach(file => {
        console.log(`   ✓ ${file}`);
      });
    } else {
      console.log(`   ${this.filesToKeep.length} core workflow files`);
    }
    
    console.log(`\n🗑️  Files to REMOVE (${this.filesToRemove.length}):`);
    if (this.config.verbose) {
      this.filesToRemove.sort().forEach(file => {
        console.log(`   ✗ ${file}`);
      });
    } else {
      console.log(`   ${this.filesToRemove.length} redundant/test files`);
    }
    
    const totalSize = this.filesToKeep.length + this.filesToRemove.length;
    const keepPercentage = totalSize > 0 ? (this.filesToKeep.length / totalSize * 100).toFixed(1) : '0';
    
    console.log(`\n📊 SUMMARY:`);
    console.log(`   Keeping: ${keepPercentage}% of analyzed files`);
    console.log(`   Removing: ${(100 - parseFloat(keepPercentage)).toFixed(1)}% of analyzed files`);
  }

  /*
   * Execute the cleanup
   */
  private async executeCleanup(): Promise<void> {
    console.log('\n🗑️ EXECUTING CLEANUP...');
    
    let removedCount = 0;
    let errorCount = 0;
    
    for (const file of this.filesToRemove) {
      try {
        const fullPath = join(this.rootDir, file);
        await fs.unlink(fullPath);
        removedCount++;
        
        if (this.config.verbose) {
          console.log(`   ✗ Removed: ${file}`);
        }
      } catch (error) {
        errorCount++;
        if (this.config.verbose) {
          console.warn(`   ⚠️ Failed to remove ${file}:`, error);
        }
      }
    }
    
    console.log(`\n📊 CLEANUP RESULTS:`);
    console.log(`   ✅ Successfully removed: ${removedCount} files`);
    console.log(`   ❌ Failed to remove: ${errorCount} files`);
  }
}

// Run cleanup if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const dryRun = process.argv.includes('--dry-run') || !process.argv.includes('--execute');
  const verbose = process.argv.includes('--verbose');
  
  console.log('🧹 Starting codebase cleanup...\n');
  
  const cleanup = new CodebaseCleanup({ dryRun, verbose });
  
  cleanup.cleanup()
    .then(() => {
      if (dryRun) {
        console.log('\n💡 To execute cleanup, run: npx tsx cleanup-codebase.ts --execute');
      }
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Cleanup failed:', error);
      process.exit(1);
    });
}

export { CodebaseCleanup };
