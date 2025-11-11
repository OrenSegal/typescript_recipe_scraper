import { BrowserManager } from '../utils/BrowserManager.js';
import { XMLParser } from 'fast-xml-parser';
import pLimit from 'p-limit';
import { gunzipSync } from 'zlib';
import { Website } from '../shared/types.js';

const xmlParser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
});

interface SitemapEntry {
    loc: string;
    lastmod?: string;
}

interface SitemapIndexEntry {
    loc: string;
}

export interface CrawlResult {
    website: Website;
    recipeUrls: string[];
    errors: Error[];
    length: number;
    stats: {
        totalUrls: number;
        filteredUrls: number;
        errorCount: number;
        processingTimeMs: number;
    };
}

export class SitemapCrawler {
    private concurrency: number;
    private limit: any; // pLimit's return type is any
    private recipeUrlPattern: RegExp;
    private requestTimeout: number;

    constructor({
        concurrency = 10,
        // More precise pattern that matches actual recipe pages, not category/index pages
        // Matches: /recipe/name, /recipes/name, /food/recipes/name, /cooking/name
        // Excludes: /recipes/, /recipe/, /recipes/category/, etc.
        recipeUrlPattern = /\/(recipe|recipes|food\/recipes|cooking)\/[a-z0-9\-_]+(?:\/|\?|#|$)/i,
        requestTimeout = 30000, // 30 seconds
    }) {
        this.concurrency = concurrency;
        this.limit = pLimit(this.concurrency);
        this.recipeUrlPattern = recipeUrlPattern;
        this.requestTimeout = requestTimeout;
    }

    private async fetchSitemap(url: string, retries = 3): Promise<string> {
        const fallbackUrls = this.generateFallbackUrls(url);
        const browserManager = BrowserManager.getInstance();

        for (const attemptUrl of [url, ...fallbackUrls]) {
            for (let i = 0; i < retries; i++) {
                console.log(`🔍 Attempting sitemap fetch with Puppeteer: ${attemptUrl} (attempt ${i + 1})`);
                const page = await browserManager.newPage();
                await page.setCacheEnabled(false);
                await page.setExtraHTTPHeaders({
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
                    'Sec-Ch-Ua-Mobile': '?0',
                    'Sec-Ch-Ua-Platform': '"macOS"',
                    'Sec-Fetch-Dest': 'document',
                    'Sec-Fetch-Mode': 'navigate',
                    'Sec-Fetch-Site': 'none',
                    'Sec-Fetch-User': '?1',
                    'Upgrade-Insecure-Requests': '1',
                });
                try {
                    const response = await page.goto(attemptUrl, {
                        waitUntil: 'networkidle2',
                        timeout: this.requestTimeout,
                    });

                    if (!response) {
                        throw new Error('No response received from page.goto()');
                    }

                    if (!response.ok()) {
                        console.warn(`❌ HTTP ${response.status()} for ${attemptUrl}`);
                        if (response.status() === 404) {
                            console.log(`🔄 404 detected, breaking to try next fallback URL...`);
                            break; // Break from retries, try next fallback
                        }
                        if (response.status() === 304) {
                            console.log(`🔄 304 detected, continuing to retry...`);
                            throw new Error(`HTTP 304: Not Modified`); // Throw to trigger retry logic
                        }
                        throw new Error(`HTTP ${response.status()}: ${response.statusText()}`);
                    }

                    let sitemapContent: string;
                    if (attemptUrl.endsWith('.gz')) {
                        const buffer = await response.buffer();
                        const decompressed = gunzipSync(buffer);
                        sitemapContent = decompressed.toString('utf-8');
                    } else {
                        sitemapContent = await response.text();
                    }

                    if (sitemapContent && sitemapContent.length > 10) {
                        console.log(`📄 Content retrieved via Puppeteer (${sitemapContent.length} chars)`);
                        return sitemapContent;
                    } else {
                        console.warn('⚠️ Empty or too short XML content');
                    }
                } catch (error: any) {
                    console.error(`💀 Puppeteer error fetching ${attemptUrl} on attempt ${i + 1}: ${error.message}`);
                    if (i < retries - 1) {
                        const waitTime = 2000 * (i + 1) + Math.random() * 1000;
                        console.log(`⏳ Waiting ${Math.round(waitTime)}ms before next retry...`);
                        await new Promise(res => setTimeout(res, waitTime));
                    } else {
                        console.error(`💀 All Puppeteer retries failed for ${attemptUrl}`);
                        break;
                    }
                } finally {
                    if (page && !page.isClosed()) {
                        await page.close();
                    }
                }
            }
        }

        console.error(`💀 All sitemap fetch attempts failed for original URL: ${url}`);
        return '';
    }

    private generateFallbackUrls(originalUrl: string): string[] {
        const fallbacks: string[] = [];
        try {
            const url = new URL(originalUrl);
            const domain = `${url.protocol}//${url.hostname}`;
            
            // Add compressed/uncompressed variants of the original URL
            if (originalUrl.endsWith('.gz')) {
                fallbacks.push(originalUrl.replace(/\.gz$/, ''));
            } else if (originalUrl.endsWith('.xml')) {
                fallbacks.push(originalUrl + '.gz');
            }
            const commonPaths = [
                '/sitemap.xml', '/sitemap_index.xml', '/sitemaps/sitemap.xml', '/wp-sitemap.xml', '/sitemap-index.xml',
                '/recipes-sitemap.xml', '/recipe-sitemap.xml', '/post-sitemap.xml',
                '/sitemap_food_index.xml', '/news-sitemap.xml', '/sitemap_food_index.xml',
                // Food Network specific patterns
                '/sitemaps/sitemap_food_index.xml', '/fn-dish/news-sitemap.xml', '/healthyeats/news-sitemap.xml',
                // Common .gz compressed variants
                '/sitemap.xml.gz', '/sitemap_index.xml.gz', '/sitemaps/sitemap.xml.gz',
                '/recipes-sitemap.xml.gz', '/recipe-sitemap.xml.gz', '/post-sitemap.xml.gz',
                '/sitemap_food_index.xml.gz', '/news-sitemap.xml.gz',
                // Additional common patterns
                '/sitemap-recipes.xml', '/sitemap-posts.xml', '/sitemap-pages.xml',
                '/wp-sitemap-posts-post-1.xml', '/wp-sitemap-posts-recipe-1.xml'
            ];
            commonPaths.forEach(path => fallbacks.push(`${domain}${path}`));
            return [...new Set(fallbacks)].filter(u => u !== originalUrl);
        } catch (error) {
            console.error(`Error generating fallback URLs for ${originalUrl}:`, error);
            return [];
        }
    }

    private parseSitemap(xml: string): (SitemapEntry | SitemapIndexEntry)[] {
        if (!xml || xml.length < 10) {
            return [];
        }
        try {
            const cleanedXml = this.preprocessXmlContent(xml);
            if (!cleanedXml) return [];
            const parsed = xmlParser.parse(cleanedXml);
            if (parsed && typeof parsed === 'object') {
                if (parsed.sitemapindex && parsed.sitemapindex.sitemap) {
                    const sitemaps = Array.isArray(parsed.sitemapindex.sitemap) ? parsed.sitemapindex.sitemap : [parsed.sitemapindex.sitemap];
                    return sitemaps.map((s: any) => ({ loc: this.cleanUrl(s.loc) })).filter((e: any) => e.loc);
                }
                if (parsed.urlset && parsed.urlset.url) {
                    const urls = Array.isArray(parsed.urlset.url) ? parsed.urlset.url : [parsed.urlset.url];
                    return urls.map((u: any) => ({ loc: this.cleanUrl(u.loc), lastmod: u.lastmod })).filter((e: any) => e.loc);
                }
            }
            return this.fallbackXmlParsing(xml);
        } catch (error) {
            console.error('❌ XML parsing failed:', error instanceof Error ? error.message : String(error));
            return this.fallbackXmlParsing(xml);
        }
    }

    private preprocessXmlContent(xml: string): string {
        let cleaned = xml.trim();
        if (cleaned.charCodeAt(0) === 0xFEFF) {
            cleaned = cleaned.substring(1);
        }
        cleaned = cleaned.replace(/^[\x00-\x1F\x7F-\x9F]+/, '');
        const xmlStart = cleaned.search(/<\?xml|<urlset|<sitemapindex/);
        if (xmlStart > 0) {
            cleaned = cleaned.substring(xmlStart);
        }
        return cleaned;
    }

    private fallbackXmlParsing(xml: string): SitemapEntry[] {
        const results: SitemapEntry[] = [];
        const urlMatches = xml.match(/<loc>([^<]+)<\/loc>/gi);
        if (urlMatches) {
            for (const match of urlMatches) {
                const url = match.match(/<loc>([^<]+)<\/loc>/i)?.[1];
                const cleanedUrl = this.cleanUrl(url || '');
                if (cleanedUrl) {
                    results.push({ loc: cleanedUrl });
                }
            }
        }
        return results;
    }

    private cleanUrl(url: string): string {
        if (!url || typeof url !== 'string') return '';
        try {
            const cleaned = url.trim();
            if (cleaned.startsWith('http://') || cleaned.startsWith('https://')) {
                new URL(cleaned);
                return cleaned;
            }
            return '';
        } catch (error) {
            return '';
        }
    }

    public async crawl(sitemapUrl: string, urlLimit?: number): Promise<string[]> {
        const allRecipeUrls = new Set<string>();
        const allErrors: Error[] = []; // Although we don't return them, _crawlRecursive needs it
        const visitedSitemaps = new Set<string>();
    
        await this._crawlRecursive(sitemapUrl, allRecipeUrls, allErrors, visitedSitemaps, urlLimit);
    
        let finalRecipeUrls = Array.from(allRecipeUrls);
        if (urlLimit) {
            finalRecipeUrls = finalRecipeUrls.slice(0, urlLimit);
        }
        return finalRecipeUrls;
    }

    public async crawlWebsite(website: Website, urlLimit?: number): Promise<CrawlResult> {
        console.log(`[CrawlWebsite] Starting crawl for ${website.name} with sitemap ${website.sitemap_url}`);
        const startTime = Date.now();
        const allRecipeUrls = new Set<string>();
        const allErrors: Error[] = [];
        const visitedSitemaps = new Set<string>();

        try {
            await this._crawlRecursive(website.sitemap_url, allRecipeUrls, allErrors, visitedSitemaps, urlLimit);
            console.log(`[CrawlWebsite] Recursive crawl finished for ${website.name}. Found ${allRecipeUrls.size} URLs.`);
        } catch (error) {
            console.error(`[CrawlWebsite] A critical error occurred during _crawlRecursive for ${website.name}:`, error);
            allErrors.push(error instanceof Error ? error : new Error(String(error)));
            // Re-throwing the error to ensure the caller knows the crawl failed catastrophically.
            throw error;
        }

        const processingTimeMs = Date.now() - startTime;
        let finalRecipeUrls = Array.from(allRecipeUrls);

        if (urlLimit) {
            finalRecipeUrls = finalRecipeUrls.slice(0, urlLimit);
        }

        return {
            website,
            recipeUrls: finalRecipeUrls,
            errors: allErrors,
            length: finalRecipeUrls.length,
            stats: {
                totalUrls: finalRecipeUrls.length,
                filteredUrls: finalRecipeUrls.length,
                errorCount: allErrors.length,
                processingTimeMs,
            },
        };
    }

    private async _crawlRecursive(
        sitemapUrl: string,
        allRecipeUrls: Set<string>,
        allErrors: Error[],
        visitedSitemaps: Set<string>,
        urlLimit?: number
    ): Promise<void> {
        if ((urlLimit && allRecipeUrls.size >= urlLimit) || visitedSitemaps.has(sitemapUrl)) {
            return;
        }

        console.log(`
Crawling sitemap: ${sitemapUrl}`);
        visitedSitemaps.add(sitemapUrl);

        const sitemapContent = await this.fetchSitemap(sitemapUrl);
        if (!sitemapContent) {
            const error = new Error(`Could not fetch sitemap content from ${sitemapUrl}`);
            allErrors.push(error);
            return;
        }

        const parsedEntries = this.parseSitemap(sitemapContent);
        const sitemapIndexEntries: SitemapIndexEntry[] = [];

        for (const entry of parsedEntries) {
            if (urlLimit && allRecipeUrls.size >= urlLimit) {
                break;
            }
            if (!entry || !entry.loc) continue;

            const cleanedUrl = this.cleanUrl(entry.loc);
            if (!cleanedUrl) continue;

            if (cleanedUrl.endsWith('.xml') || cleanedUrl.endsWith('.xml.gz')) {
                sitemapIndexEntries.push({ loc: cleanedUrl });
            } else if (this.recipeUrlPattern.test(cleanedUrl)) {
                allRecipeUrls.add(cleanedUrl);
            }
        }

        if (sitemapIndexEntries.length > 0 && (!urlLimit || allRecipeUrls.size < urlLimit)) {
            console.log(`Found ${sitemapIndexEntries.length} sub-sitemaps. Crawling recursively...`);
            const crawlPromises = sitemapIndexEntries.map(entry =>
                this.limit(() => this._crawlRecursive(entry.loc, allRecipeUrls, allErrors, visitedSitemaps, urlLimit))
            );
            await Promise.all(crawlPromises);
        }
    }
}
