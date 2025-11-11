/**
 * TYPE MIGRATION SCRIPT
 * 
 * This script helps migrate from old type files to unified core types
 * Run this to identify files that need import updates
 */

import fs from 'fs';
import path from 'path';

interface MigrationTask {
  file: string;
  oldImports: string[];
  newImports: string[];
  conflicts: string[];
}

const OLD_TYPE_IMPORTS = [
  "from '../types.js'",
  "from './types.js'", 
  "from '../../types.js'",
  "from '../shared/types.js'",
  "from './shared/types.js'",
  "from '../../shared/types.js'"
];

const NEW_CORE_IMPORT = "from './core/types.js'";
const NEW_CORE_IMPORT_ALT = "from '../core/types.js'";
const NEW_CORE_IMPORT_ALT2 = "from '../../core/types.js'";

export class TypeMigrationAnalyzer {
  private basePath: string;
  private migrationTasks: MigrationTask[] = [];

  constructor(basePath: string = '/Users/orensegal/Documents/GitHub/typescript_scraper_service/src') {
    this.basePath = basePath;
  }

  analyzeDirectory(dirPath: string): void {
    const fullPath = path.join(this.basePath, dirPath);
    
    if (!fs.existsSync(fullPath)) {
      console.log(`Directory not found: ${fullPath}`);
      return;
    }

    const entries = fs.readdirSync(fullPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const entryPath = path.join(fullPath, entry.name);
      
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        this.analyzeDirectory(path.join(dirPath, entry.name));
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.js'))) {
        this.analyzeFile(entryPath, path.join(dirPath, entry.name));
      }
    }
  }

  private analyzeFile(filePath: string, relativePath: string): void {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const oldImports: string[] = [];
      const conflicts: string[] = [];

      // Check for old import patterns
      for (const importPattern of OLD_TYPE_IMPORTS) {
        if (content.includes(importPattern)) {
          oldImports.push(importPattern);
        }
      }

      // Check for type conflicts (types defined locally vs in unified types)
      const typeConflicts = [
        'interface Recipe',
        'interface RecipeIngredient',
        'interface InstructionStep',
        'interface Website',
        'interface CrawlResult',
        'type Recipe =',
        'type RecipeIngredient =',
        'type InstructionStep ='
      ];

      for (const conflict of typeConflicts) {
        if (content.includes(conflict)) {
          conflicts.push(conflict);
        }
      }

      if (oldImports.length > 0 || conflicts.length > 0) {
        this.migrationTasks.push({
          file: relativePath,
          oldImports,
          newImports: this.determineNewImports(relativePath),
          conflicts
        });
      }
    } catch (error) {
      console.error(`Error analyzing file ${filePath}:`, error);
    }
  }

  private determineNewImports(relativePath: string): string[] {
    const depth = relativePath.split('/').length - 1;
    
    if (depth === 0) {
      return [NEW_CORE_IMPORT];
    } else if (depth === 1) {
      return [NEW_CORE_IMPORT_ALT];
    } else {
      return [NEW_CORE_IMPORT_ALT2];
    }
  }

  generateReport(): void {
    console.log('\n=== TYPE MIGRATION ANALYSIS REPORT ===\n');
    
    if (this.migrationTasks.length === 0) {
      console.log('✅ No migration tasks found. All files are already using unified types.');
      return;
    }

    console.log(`Found ${this.migrationTasks.length} files that need migration:\n`);

    for (const task of this.migrationTasks) {
      console.log(`📄 ${task.file}`);
      
      if (task.oldImports.length > 0) {
        console.log('  📥 Old imports to replace:');
        task.oldImports.forEach(imp => console.log(`    - ${imp}`));
        console.log('  📤 New import to use:');
        task.newImports.forEach(imp => console.log(`    + ${imp}`));
      }
      
      if (task.conflicts.length > 0) {
        console.log('  ⚠️  Type conflicts to resolve:');
        task.conflicts.forEach(conflict => console.log(`    - ${conflict}`));
      }
      
      console.log('');
    }

    this.generatePriorityList();
  }

  private generatePriorityList(): void {
    console.log('\n=== MIGRATION PRIORITY ===\n');
    
    const highPriority = this.migrationTasks.filter(task => 
      task.conflicts.some(conflict => 
        conflict.includes('interface Recipe') || 
        conflict.includes('interface RecipeIngredient') ||
        conflict.includes('interface InstructionStep')
      )
    );

    const mediumPriority = this.migrationTasks.filter(task => 
      !highPriority.includes(task) && task.conflicts.length > 0
    );

    const lowPriority = this.migrationTasks.filter(task => 
      task.conflicts.length === 0 && task.oldImports.length > 0
    );

    if (highPriority.length > 0) {
      console.log('🔴 HIGH PRIORITY (Core type conflicts):');
      highPriority.forEach(task => console.log(`  - ${task.file}`));
      console.log('');
    }

    if (mediumPriority.length > 0) {
      console.log('🟡 MEDIUM PRIORITY (Other conflicts):');
      mediumPriority.forEach(task => console.log(`  - ${task.file}`));
      console.log('');
    }

    if (lowPriority.length > 0) {
      console.log('🟢 LOW PRIORITY (Import updates only):');
      lowPriority.forEach(task => console.log(`  - ${task.file}`));
      console.log('');
    }
  }

  getMigrationTasks(): MigrationTask[] {
    return this.migrationTasks;
  }
}

// Export the analyzer for use in migration scripts
export function runMigrationAnalysis(): MigrationTask[] {
  const analyzer = new TypeMigrationAnalyzer();
  analyzer.analyzeDirectory('');
  analyzer.generateReport();
  return analyzer.getMigrationTasks();
}
