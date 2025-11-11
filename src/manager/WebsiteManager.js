/*
 * WebsiteManager.ts
 * Manages website information from CSV files for recipe scraping
 */
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { z } from 'zod';
// Schema for website data from CSV
const WebsiteSchema = z.object({
    Category: z.string(),
    'Website Name': z.string(),
    'Main URL': z.string().url(),
    'Main Sitemap URL': z.string().url(),
    'Sub-sitemap URLs': z.string()
});
export class WebsiteManager {
    websites = [];
    categories = new Map();
    /*
     * Load website data from a CSV file
     * @param filePath Path to the CSV file
     */
    async loadFromCSV(filePath) {
        try {
            const fileContent = await fs.promises.readFile(path.resolve(filePath), 'utf-8');
            const records = parse(fileContent, {
                columns: true,
                skip_empty_lines: true
            });
            console.log(`📊 Parsing ${records.length} websites from CSV...`);
            for (const record of records) {
                try {
                    // Validate record against schema
                    const validatedRecord = WebsiteSchema.parse(record);
                    // Calculate priority (higher for major sites)
                    const priority = this.calculatePriority(validatedRecord);
                    // Parse sub-sitemaps
                    const subSitemaps = validatedRecord['Sub-sitemap URLs'].split(';')
                        .map(url => url.trim())
                        .filter(url => url.length > 0);
                    // Create website object
                    const website = {
                        ...validatedRecord,
                        priority,
                        subSitemaps
                    };
                    // Add to internal collections
                    this.websites.push(website);
                    // Organize by category
                    if (!this.categories.has(website.Category)) {
                        this.categories.set(website.Category, []);
                    }
                    this.categories.get(website.Category)?.push(website);
                }
                catch (err) {
                    console.error(`❌ Error processing website record: ${JSON.stringify(record)}`, err);
                }
            }
            console.log(`✅ Successfully loaded ${this.websites.length} websites across ${this.categories.size} categories`);
        }
        catch (err) {
            console.error(`❌ Error loading CSV file ${filePath}:`, err);
            throw err;
        }
    }
    /*
     * Calculate priority for a website (higher values = higher priority)
     */
    calculatePriority(website) {
        // Priority logic - customize as needed
        if (website.Category === 'Major Recipe Sites') {
            return 10; // Highest priority
        }
        else if (website.Category === 'Specialty & Diet-Focused' ||
            website.Category === 'Baking & Dessert Sites') {
            return 8;
        }
        else if (website['Website Name'].toLowerCase().includes('bbc') ||
            website['Website Name'].toLowerCase().includes('nyt')) {
            return 9; // High priority for major publications
        }
        return 5; // Default priority
    }
    /*
     * Get all websites
     */
    getAllWebsites() {
        return this.websites;
    }
    /*
     * Get websites by category
     */
    getWebsitesByCategory(category) {
        return this.categories.get(category) || [];
    }
    /*
     * Get all categories
     */
    getCategories() {
        return Array.from(this.categories.keys());
    }
    /*
     * Get high priority websites
     * @param minPriority Minimum priority threshold (default: 8)
     */
    getHighPriorityWebsites(minPriority = 8) {
        return this.websites.filter(site => site.priority >= minPriority);
    }
    /*
     * Export website data to JSON (useful for analysis or backup)
     * @param outputPath Path to save the JSON file
     */
    async exportToJSON(outputPath) {
        try {
            const data = {
                websites: this.websites,
                categories: Object.fromEntries(this.categories),
                stats: {
                    totalWebsites: this.websites.length,
                    totalCategories: this.categories.size,
                    websitesByCategory: Array.from(this.categories.entries())
                        .map(([category, sites]) => ({ category, count: sites.length }))
                }
            };
            await fs.promises.writeFile(path.resolve(outputPath), JSON.stringify(data, null, 2));
            console.log(`✅ Successfully exported website data to ${outputPath}`);
        }
        catch (err) {
            console.error(`❌ Error exporting to JSON:`, err);
            throw err;
        }
    }
}
// Example usage:
/*
const manager = new WebsiteManager();
await manager.loadFromCSV('./data/Data.csv');
const highPrioritySites = manager.getHighPriorityWebsites();
console.log(`Found ${highPrioritySites.length} high priority sites`);
*/
