import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface FailureLog {
  timestamp: string;
  website: string;
  url: string;
  failureType: 'sitemap_access' | 'recipe_extraction' | 'parsing_error' | 'timeout' | 'network_error' | 'invalid_response';
  errorMessage: string;
  statusCode?: number;
  retryCount?: number;
  category?: string;
}

export interface FailureSummary {
  totalFailures: number;
  failuresByType: Record<string, number>;
  failuresByWebsite: Record<string, number>;
  failuresByCategory: Record<string, number>;
  mostCommonErrors: Array<{ error: string; count: number }>;
  problematicWebsites: Array<{ website: string; failures: number; lastError: string }>;
}

export class FailureLogger {
  private logFile: string;
  private failures: FailureLog[] = [];

  constructor(logDir: string = path.join(__dirname, 'logs')) {
    // Ensure log directory exists
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.logFile = path.join(logDir, `scraping-failures-${timestamp}.json`);
  }

  /*
   * Log a failure
   */
  logFailure(failure: Omit<FailureLog, 'timestamp'>): void {
    const failureWithTimestamp: FailureLog = {
      ...failure,
      timestamp: new Date().toISOString()
    };

    this.failures.push(failureWithTimestamp);

    // Also log to console for immediate visibility
    console.warn(`❌ FAILURE [${failure.failureType}] ${failure.website}: ${failure.errorMessage}`);

    // Write to file immediately for persistence
    this.writeToFile();
  }

  /*
   * Log sitemap access failure
   */
  logSitemapFailure(website: string, url: string, error: string, statusCode?: number, category?: string): void {
    this.logFailure({
      website,
      url,
      failureType: 'sitemap_access',
      errorMessage: error,
      statusCode,
      category
    });
  }

  /*
   * Log recipe extraction failure
   */
  logRecipeFailure(website: string, url: string, error: string, category?: string): void {
    this.logFailure({
      website,
      url,
      failureType: 'recipe_extraction',
      errorMessage: error,
      category
    });
  }

  /*
   * Log parsing error
   */
  logParsingFailure(website: string, url: string, error: string, category?: string): void {
    this.logFailure({
      website,
      url,
      failureType: 'parsing_error',
      errorMessage: error,
      category
    });
  }

  /*
   * Log network timeout
   */
  logTimeoutFailure(website: string, url: string, timeoutMs: number, category?: string): void {
    this.logFailure({
      website,
      url,
      failureType: 'timeout',
      errorMessage: `Request timed out after ${timeoutMs}ms`,
      category
    });
  }

  /*
   * Log network error
   */
  logNetworkFailure(website: string, url: string, error: string, category?: string): void {
    this.logFailure({
      website,
      url,
      failureType: 'network_error',
      errorMessage: error,
      category
    });
  }

  /*
   * Get failure summary
   */
  getSummary(): FailureSummary {
    const failuresByType: Record<string, number> = {};
    const failuresByWebsite: Record<string, number> = {};
    const failuresByCategory: Record<string, number> = {};
    const errorCounts: Record<string, number> = {};

    this.failures.forEach(failure => {
      // Count by type
      failuresByType[failure.failureType] = (failuresByType[failure.failureType] || 0) + 1;
      
      // Count by website
      failuresByWebsite[failure.website] = (failuresByWebsite[failure.website] || 0) + 1;
      
      // Count by category
      if (failure.category) {
        failuresByCategory[failure.category] = (failuresByCategory[failure.category] || 0) + 1;
      }
      
      // Count error messages
      errorCounts[failure.errorMessage] = (errorCounts[failure.errorMessage] || 0) + 1;
    });

    // Most common errors
    const mostCommonErrors = Object.entries(errorCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([error, count]) => ({ error, count }));

    // Problematic websites
    const problematicWebsites = Object.entries(failuresByWebsite)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([website, failures]) => {
        const lastFailure = this.failures
          .filter(f => f.website === website)
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
        
        return {
          website,
          failures,
          lastError: lastFailure?.errorMessage || 'Unknown error'
        };
      });

    return {
      totalFailures: this.failures.length,
      failuresByType,
      failuresByWebsite,
      failuresByCategory,
      mostCommonErrors,
      problematicWebsites
    };
  }

  /*
   * Print failure summary to console
   */
  printSummary(): void {
    const summary = this.getSummary();
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 FAILURE ANALYSIS SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total failures: ${summary.totalFailures}`);
    
    console.log('\n🔍 Failures by Type:');
    Object.entries(summary.failuresByType)
      .sort(([, a], [, b]) => b - a)
      .forEach(([type, count]) => {
        console.log(`   ${type}: ${count}`);
      });

    console.log('\n🌐 Most Problematic Websites:');
    summary.problematicWebsites.slice(0, 5).forEach((site, index) => {
      console.log(`   ${index + 1}. ${site.website}: ${site.failures} failures`);
      console.log(`      Last error: ${site.lastError.substring(0, 80)}...`);
    });

    console.log('\n📂 Failures by Category:');
    Object.entries(summary.failuresByCategory)
      .sort(([, a], [, b]) => b - a)
      .forEach(([category, count]) => {
        console.log(`   ${category}: ${count}`);
      });

    console.log('\n⚠️  Most Common Errors:');
    summary.mostCommonErrors.slice(0, 5).forEach((error, index) => {
      console.log(`   ${index + 1}. (${error.count}x) ${error.error.substring(0, 60)}...`);
    });

    console.log('='.repeat(60));
    console.log(`📁 Full log saved to: ${this.logFile}`);
  }

  /*
   * Write failures to file
   */
  private writeToFile(): void {
    const logData = {
      summary: this.getSummary(),
      failures: this.failures,
      generatedAt: new Date().toISOString()
    };

    try {
      fs.writeFileSync(this.logFile, JSON.stringify(logData, null, 2));
    } catch (error) {
      console.error('Failed to write failure log:', error);
    }
  }

  /*
   * Get all failures
   */
  getFailures(): FailureLog[] {
    return [...this.failures];
  }

  /*
   * Get failures for specific website
   */
  getFailuresForWebsite(website: string): FailureLog[] {
    return this.failures.filter(f => f.website === website);
  }

  /*
   * Get failures by type
   */
  getFailuresByType(type: FailureLog['failureType']): FailureLog[] {
    return this.failures.filter(f => f.failureType === type);
  }

  /*
   * Export failures to CSV
   */
  exportToCsv(outputPath?: string): string {
    const csvPath = outputPath || this.logFile.replace('.json', '.csv');
    
    const headers = ['Timestamp', 'Website', 'URL', 'Failure Type', 'Error Message', 'Status Code', 'Category'];
    const rows = this.failures.map(failure => [
      failure.timestamp,
      failure.website,
      failure.url,
      failure.failureType,
      `"${failure.errorMessage.replace(/"/g, '""')}"`, // Escape quotes
      failure.statusCode || '',
      failure.category || ''
    ]);

    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    
    fs.writeFileSync(csvPath, csvContent);
    console.log(`📄 CSV export saved to: ${csvPath}`);
    
    return csvPath;
  }

  /*
   * Clear all failures
   */
  clear(): void {
    this.failures = [];
    console.log('🧹 Failure log cleared');
  }
}
