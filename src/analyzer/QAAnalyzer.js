/*
 * QAAnalyzer.ts
 * Analyzes QA logs to identify common scraping errors and patterns
 */
import fs from 'fs';
import path from 'path';
export class QAAnalyzer {
    logEntries = [];
    /*
     * Load QA log data from a file
     * @param filePath Path to the QA log file
     */
    async loadLogFile(filePath) {
        try {
            const fileContent = await fs.promises.readFile(path.resolve(filePath), 'utf-8');
            this.logEntries = fileContent
                .split('\n')
                .filter(line => line.trim() !== '')
                .map(line => JSON.parse(line));
            console.log(`📊 Loaded ${this.logEntries.length} entries from QA log`);
        }
        catch (err) {
            console.error(`❌ Error loading QA log file ${filePath}:`, err);
            throw err;
        }
    }
    /*
     * Analyze the loaded QA log data
     */
    analyze() {
        const errorCounts = {};
        const errorUrls = {};
        const commonErrorPatterns = {};
        const sitesWithMostErrors = {};
        for (const entry of this.logEntries) {
            // Count errors by type
            errorCounts[entry.error] = (errorCounts[entry.error] || 0) + 1;
            // Group URLs by error
            if (!errorUrls[entry.error]) {
                errorUrls[entry.error] = [];
            }
            errorUrls[entry.error].push(entry.url);
            // Identify common error patterns (e.g., timeouts, validation failures)
            const pattern = this.getErrorPattern(entry.error);
            commonErrorPatterns[pattern] = (commonErrorPatterns[pattern] || 0) + 1;
            // Identify sites with the most errors
            try {
                const domain = new URL(entry.url).hostname;
                sitesWithMostErrors[domain] = (sitesWithMostErrors[domain] || 0) + 1;
            }
            catch (e) {
                // Ignore invalid URLs
            }
        }
        return {
            totalErrors: this.logEntries.length,
            errorCounts,
            errorUrls,
            commonErrorPatterns,
            sitesWithMostErrors
        };
    }
    /*
     * Get a simplified error pattern from a detailed error message
     */
    getErrorPattern(errorMessage) {
        if (/timeout/i.test(errorMessage))
            return 'Network Timeout';
        if (/failed to fetch/i.test(errorMessage))
            return 'Fetch Error';
        if (/JSON-LD/i.test(errorMessage))
            return 'JSON-LD Parsing Error';
        if (/validation failed/i.test(errorMessage))
            return 'QA Validation Failed';
        if (/selector/i.test(errorMessage))
            return 'HTML Selector Error';
        if (/404/i.test(errorMessage))
            return '404 Not Found';
        if (/50/i.test(errorMessage))
            return 'Server Error (5xx)';
        return 'Unknown Error';
    }
    /*
     * Print a summary of the analysis
     */
    printAnalysis(analysis) {
        console.log('\n--- QA Analysis Report ---');
        console.log(`Total Errors: ${analysis.totalErrors}`);
        console.log('\nTop 5 Error Messages:');
        this.printTopN(analysis.errorCounts);
        console.log('\nTop 5 Error Patterns:');
        this.printTopN(analysis.commonErrorPatterns);
        console.log('\nTop 5 Sites with Most Errors:');
        this.printTopN(analysis.sitesWithMostErrors);
        console.log('\n--- End of Report ---');
    }
    printTopN(data, n = 5) {
        Object.entries(data)
            .sort(([, a], [, b]) => b - a)
            .slice(0, n)
            .forEach(([key, value]) => {
            console.log(`- ${key}: ${value} occurrences`);
        });
    }
}
// Example usage:
/*
const analyzer = new QAAnalyzer();
await analyzer.loadLogFile('./qa_log.json');
const analysis = analyzer.analyze();
analyzer.printAnalysis(analysis);
*/
