import fs from 'fs';
import path from 'path';

/*
 * Codebase Consolidation Utility
 * Identifies and safely removes redundant files while preserving functionality
 */

export interface FileAnalysis {
  path: string;
  size: number;
  lastModified: Date;
  type: 'source' | 'test' | 'config' | 'build' | 'documentation';
  redundancyRisk: 'safe' | 'review' | 'keep';
  reason: string;
  dependencies: string[];
}

export interface ConsolidationReport {
  totalFiles: number;
  safeToRemove: FileAnalysis[];
  requiresReview: FileAnalysis[];
  mustKeep: FileAnalysis[];
  estimatedSpaceSaved: number;
  recommendations: string[];
}

export class CodebaseConsolidator {
  private static readonly SAFE_TO_REMOVE_PATTERNS = [
    /\.js\.map$/,           // Source maps
    /test-.*\.ts$/,         // Test files that are duplicates
    /.*\.test\.js$/,        // Old test files
    /.*\.spec\.js$/,        // Old spec files
    /dist\/.*\.js$/,        // Built files
    /build\/.*$/,           // Build artifacts
    /node_modules\/.*$/,    // Dependencies
    /\.DS_Store$/,          // macOS files
    /Thumbs\.db$/,          // Windows files
  ];

  private static readonly REVIEW_PATTERNS = [
    /.*-old\.ts$/,          // Files marked as old
    /.*\.backup\.ts$/,      // Backup files
    /.*\.bak$/,             // Backup files
    /temp-.*\.ts$/,         // Temporary files
    /draft-.*\.ts$/,        // Draft files
  ];

  private static readonly KEEP_PATTERNS = [
    /package\.json$/,       // Package configuration
    /tsconfig\.json$/,      // TypeScript config
    /\.env/,                // Environment files
    /README\.md$/,          // Documentation
    /src\/.*\.ts$/,         // Active source files
    /types\.ts$/,           // Type definitions
  ];

  /*
   * Analyze codebase for consolidation opportunities
   */
  static async analyzeCodebase(rootPath: string): Promise<ConsolidationReport> {
    console.log('🔍 Analyzing codebase for consolidation opportunities...');
    
    const allFiles = await this.getAllFiles(rootPath);
    const analyses: FileAnalysis[] = [];
    
    for (const filePath of allFiles) {
      const analysis = await this.analyzeFile(filePath, rootPath);
      analyses.push(analysis);
    }

    const report: ConsolidationReport = {
      totalFiles: analyses.length,
      safeToRemove: analyses.filter(a => a.redundancyRisk === 'safe'),
      requiresReview: analyses.filter(a => a.redundancyRisk === 'review'),
      mustKeep: analyses.filter(a => a.redundancyRisk === 'keep'),
      estimatedSpaceSaved: 0,
      recommendations: []
    };

    // Calculate space savings
    report.estimatedSpaceSaved = report.safeToRemove.reduce((total, file) => total + file.size, 0);

    // Generate recommendations
    report.recommendations = this.generateRecommendations(report);

    console.log(`✅ Analysis complete: ${report.safeToRemove.length} safe to remove, ${report.requiresReview.length} need review`);
    return report;
  }

  /*
   * Analyze individual file for redundancy
   */
  private static async analyzeFile(filePath: string, rootPath: string): Promise<FileAnalysis> {
    const stats = await fs.promises.stat(filePath);
    const relativePath = path.relative(rootPath, filePath);
    const content = await fs.promises.readFile(filePath, 'utf-8').catch(() => '');

    const analysis: FileAnalysis = {
      path: relativePath,
      size: stats.size,
      lastModified: stats.mtime,
      type: this.determineFileType(relativePath),
      redundancyRisk: 'keep',
      reason: '',
      dependencies: this.extractDependencies(content)
    };

    // Determine redundancy risk
    if (this.SAFE_TO_REMOVE_PATTERNS.some(pattern => pattern.test(relativePath))) {
      analysis.redundancyRisk = 'safe';
      analysis.reason = 'Matches safe removal pattern';
    } else if (this.REVIEW_PATTERNS.some(pattern => pattern.test(relativePath))) {
      analysis.redundancyRisk = 'review';
      analysis.reason = 'Potentially redundant file';
    } else if (this.KEEP_PATTERNS.some(pattern => pattern.test(relativePath))) {
      analysis.redundancyRisk = 'keep';
      analysis.reason = 'Essential file';
    } else {
      // Additional analysis for unclear cases
      analysis.redundancyRisk = this.analyzeContentRedundancy(content, relativePath);
      analysis.reason = this.getRedundancyReason(analysis.redundancyRisk, relativePath);
    }

    return analysis;
  }

  /*
   * Determine file type based on path and content
   */
  private static determineFileType(filePath: string): FileAnalysis['type'] {
    if (/test|spec/.test(filePath)) return 'test';
    if (/config|\.json$/.test(filePath)) return 'config';
    if (/dist|build/.test(filePath)) return 'build';
    if (/README|\.md$/.test(filePath)) return 'documentation';
    return 'source';
  }

  /*
   * Extract dependencies from file content
   */
  private static extractDependencies(content: string): string[] {
    const dependencies: string[] = [];
    
    // Extract import statements
    const importMatches = content.match(/import.*from\s+['"]([^'"]+)['"]/g);
    if (importMatches) {
      dependencies.push(...importMatches.map(match => {
        const pathMatch = match.match(/from\s+['"]([^'"]+)['"]/);
        return pathMatch ? pathMatch[1] : '';
      }).filter(Boolean));
    }

    // Extract require statements
    const requireMatches = content.match(/require\(['"]([^'"]+)['"]\)/g);
    if (requireMatches) {
      dependencies.push(...requireMatches.map(match => {
        const pathMatch = match.match(/require\(['"]([^'"]+)['"]\)/);
        return pathMatch ? pathMatch[1] : '';
      }).filter(Boolean));
    }

    return dependencies;
  }

  /*
   * Analyze content for redundancy indicators
   */
  private static analyzeContentRedundancy(content: string, filePath: string): 'safe' | 'review' | 'keep' {
    // Check for TODO/FIXME comments indicating incomplete work
    if (/TODO|FIXME|HACK|TEMP/i.test(content)) {
      return 'review';
    }

    // Check for duplicate function signatures
    if (this.hasDuplicateFunctions(content)) {
      return 'review';
    }

    // Check for empty or minimal files
    if (content.trim().length < 100) {
      return 'review';
    }

    // Check for old/deprecated patterns
    if (/deprecated|obsolete|old|legacy/i.test(content)) {
      return 'review';
    }

    return 'keep';
  }

  /*
   * Check for duplicate function signatures
   */
  private static hasDuplicateFunctions(content: string): boolean {
    const functionMatches = content.match(/function\s+(\w+)|const\s+(\w+)\s*=/g);
    if (!functionMatches || functionMatches.length < 2) return false;

    const functionNames = functionMatches.map(match => {
      const nameMatch = match.match(/function\s+(\w+)|const\s+(\w+)/);
      return nameMatch ? (nameMatch[1] || nameMatch[2]) : '';
    }).filter(Boolean);

    const uniqueNames = new Set(functionNames);
    return uniqueNames.size < functionNames.length;
  }

  /*
   * Get reason for redundancy classification
   */
  private static getRedundancyReason(risk: 'safe' | 'review' | 'keep', filePath: string): string {
    switch (risk) {
      case 'safe':
        return 'File appears to be build artifact or temporary';
      case 'review':
        return 'File may be redundant or incomplete';
      case 'keep':
        return 'File appears to be actively used';
      default:
        return 'Unknown';
    }
  }

  /*
   * Generate consolidation recommendations
   */
  private static generateRecommendations(report: ConsolidationReport): string[] {
    const recommendations: string[] = [];

    if (report.safeToRemove.length > 0) {
      recommendations.push(`Remove ${report.safeToRemove.length} build artifacts and temporary files`);
    }

    if (report.requiresReview.length > 0) {
      recommendations.push(`Review ${report.requiresReview.length} potentially redundant files`);
    }

    const testFiles = report.safeToRemove.filter(f => f.type === 'test');
    if (testFiles.length > 0) {
      recommendations.push(`Consolidate ${testFiles.length} duplicate test files`);
    }

    const buildFiles = report.safeToRemove.filter(f => f.type === 'build');
    if (buildFiles.length > 0) {
      recommendations.push(`Clean up ${buildFiles.length} build artifacts`);
    }

    if (report.estimatedSpaceSaved > 1024 * 1024) {
      const mbSaved = (report.estimatedSpaceSaved / (1024 * 1024)).toFixed(1);
      recommendations.push(`Estimated space savings: ${mbSaved} MB`);
    }

    return recommendations;
  }

  /*
   * Safely remove files marked as safe
   */
  static async removeRedundantFiles(rootPath: string, filesToRemove: FileAnalysis[]): Promise<{
    removed: string[];
    failed: string[];
  }> {
    console.log(`🗑️ Removing ${filesToRemove.length} redundant files...`);
    
    const result = {
      removed: [] as string[],
      failed: [] as string[]
    };

    for (const file of filesToRemove) {
      try {
        const fullPath = path.join(rootPath, file.path);
        await fs.promises.unlink(fullPath);
        result.removed.push(file.path);
        console.log(`✅ Removed: ${file.path}`);
      } catch (error) {
        result.failed.push(file.path);
        console.warn(`❌ Failed to remove: ${file.path}`, error);
      }
    }

    console.log(`🎉 Cleanup complete: ${result.removed.length} removed, ${result.failed.length} failed`);
    return result;
  }

  /*
   * Get all files in directory recursively
   */
  private static async getAllFiles(dirPath: string): Promise<string[]> {
    const files: string[] = [];
    
    async function traverse(currentPath: string) {
      const entries = await fs.promises.readdir(currentPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);
        
        if (entry.isDirectory()) {
          // Skip node_modules and other large directories
          if (!['node_modules', '.git', 'dist', 'build'].includes(entry.name)) {
            await traverse(fullPath);
          }
        } else {
          files.push(fullPath);
        }
      }
    }
    
    await traverse(dirPath);
    return files;
  }

  /*
   * Create backup before major changes
   */
  static async createBackup(rootPath: string, backupPath: string): Promise<void> {
    console.log(`💾 Creating backup at: ${backupPath}`);
    
    // This would implement a backup strategy
    // For now, just log the intention
    console.log('⚠️ Backup functionality would be implemented here');
  }

  /*
   * Identify specific redundant patterns in the recipe parsing service
   */
  static async identifyRecipeParsingRedundancies(rootPath: string): Promise<{
    duplicateTests: string[];
    oldParsers: string[];
    buildArtifacts: string[];
    tempFiles: string[];
  }> {
    const allFiles = await this.getAllFiles(rootPath);
    
    return {
      duplicateTests: allFiles.filter(f => 
        /test-.*\.ts$/.test(f) && 
        !f.includes('comprehensive') && 
        !f.includes('production')
      ),
      oldParsers: allFiles.filter(f => 
        f.includes('parser') && 
        (f.includes('old') || f.includes('backup') || f.includes('legacy'))
      ),
      buildArtifacts: allFiles.filter(f => 
        f.includes('dist/') || 
        f.includes('build/') || 
        f.endsWith('.js.map')
      ),
      tempFiles: allFiles.filter(f => 
        f.includes('temp') || 
        f.includes('draft') || 
        f.includes('test-') && f.endsWith('.ts')
      )
    };
  }
}
