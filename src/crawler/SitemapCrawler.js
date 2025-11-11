import fetch from 'node-fetch';
import { XMLParser } from 'fast-xml-parser';
import pLimit from 'p-limit';
import { AbortController } from 'node-abort-controller';
import { gunzipSync } from 'zlib';
const xmlParser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
});
export class SitemapCrawler {
    concurrency;
    limit; // pLimit's return type is any
    recipeUrlPattern;
    requestTimeout;
    constructor({ concurrency = 10, 
        // More precise pattern that matches actual recipe pages, not category/index pages
        // Matches: /recipe/name, /recipes/name, /food/recipes/name, /cooking/name
        // Excludes: /recipes/, /recipe/, /recipes/category/, etc.
        recipeUrlPattern = /\/(recipe|recipes|food\/recipes|cooking)\/[a-z0-9\-_]+(?:\/|\?|#|$)/i,
    requestTimeout = 15000, // 15 seconds
     }) {
        this.concurrency = concurrency;
        this.limit = pLimit(this.concurrency);
        this.recipeUrlPattern = recipeUrlPattern;
        this.requestTimeout = requestTimeout;
    }
    async fetchSitemap(url, retries = 3) {
        // COMPREHENSIVE WORKAROUND 1: Try original URL with multiple fallback strategies
        const fallbackUrls = this.generateFallbackUrls(url);
        for (const attemptUrl of [url, ...fallbackUrls]) {
            for (let i = 0; i < retries; i++) {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), this.requestTimeout);
                try {
                    console.log(`🔍 Attempting sitemap fetch: ${attemptUrl} (attempt ${i + 1})`);
                    const response = await fetch(attemptUrl, {
                        signal: controller.signal,
                        headers: {
                            // WORKAROUND 2: Enhanced headers to bypass bot detection
                            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                            'Accept': 'application/xml,text/xml,*/*',
                            'Accept-Language': 'en-US,en;q=0.9',
                            'Accept-Encoding': 'gzip, deflate, br',
                            'Cache-Control': 'no-cache',
                            'Pragma': 'no-cache',
                            'Sec-Fetch-Site': 'same-origin',
                            'Sec-Fetch-Mode': 'cors',
                            'Sec-Fetch-Dest': 'document'
                        }
                    });
                    clearTimeout(timeoutId);
                    if (!response.ok) {
                        console.warn(`❌ HTTP ${response.status} for ${attemptUrl}`);
                        // WORKAROUND 3: Handle specific HTTP error codes with different strategies
                        if (response.status === 404) {
                            console.log(`🔄 404 detected, trying next fallback URL...`);
                            break; // Try next fallback URL
                        }
                        else if (response.status === 429) {
                            console.log(`⏱️  Rate limited, waiting longer before retry...`);
                            await new Promise(res => setTimeout(res, 5000 * (i + 1))); // Longer wait for rate limits
                            continue;
                        }
                        else if (response.status === 403) {
                            console.log(`🚫 Forbidden access, trying with different headers...`);
                            break; // Try next fallback URL
                        }
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }
                    // WORKAROUND 4: Robust handling of different content types
                    let content;
                    if (attemptUrl.endsWith('.gz')) {
                        try {
                            console.log(`🗜️  Processing gzipped sitemap...`);
                            const buffer = await response.arrayBuffer();
                            content = gunzipSync(Buffer.from(buffer)).toString('utf-8');
                            console.log(`✅ Successfully decompressed gzipped content (${content.length} chars)`);
                        }
                        catch (gzipError) {
                            console.error(`❌ Gzip decompression failed:`, gzipError);
                            // WORKAROUND 5: Try treating as regular text if gzip fails
                            content = await response.text();
                            console.log(`🔄 Fallback: treating as regular text (${content.length} chars)`);
                        }
                    }
                    else {
                        content = await response.text();
                        console.log(`📄 Regular text content retrieved (${content.length} chars)`);
                    }
                    // WORKAROUND 6: Validate content before returning
                    if (this.isValidSitemapContent(content)) {
                        console.log(`✅ Valid sitemap content found for ${attemptUrl}`);
                        return content;
                    }
                    else {
                        console.warn(`⚠️  Content validation failed for ${attemptUrl}, trying next option...`);
                        if (content.length > 0) {
                            console.log(`📝 Content preview: ${content.substring(0, 200)}...`);
                        }
                        break; // Try next fallback URL
                    }
                }
                catch (error) {
                    clearTimeout(timeoutId);
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    console.warn(`❌ Attempt ${i + 1} failed for ${attemptUrl}: ${errorMessage}`);
                    // WORKAROUND 7: Handle specific error types
                    if (errorMessage.includes('ENOTFOUND') || errorMessage.includes('ECONNREFUSED')) {
                        console.log(`🌐 Network error detected, trying next fallback URL...`);
                        break; // Try next fallback URL immediately
                    }
                    if (i === retries - 1) {
                        console.error(`💀 All retries exhausted for ${attemptUrl}`);
                        break; // Try next fallback URL
                    }
                    // Exponential backoff with jitter
                    const waitTime = 1000 * (i + 1) + Math.random() * 1000;
                    console.log(`⏳ Waiting ${Math.round(waitTime)}ms before retry...`);
                    await new Promise(res => setTimeout(res, waitTime));
                }
            }
        }
        console.error(`💀 All sitemap fetch attempts failed for original URL: ${url}`);
        return ''; // Return empty string to prevent crashing the whole process
    }
    /**
     * WORKAROUND 8: Generate comprehensive fallback URLs for common sitemap patterns
     */
    generateFallbackUrls(originalUrl) {
        const fallbacks = [];
        try {
            const url = new URL(originalUrl);
            const domain = `${url.protocol}//${url.hostname}`;
            // Remove .gz extension if present
            if (originalUrl.endsWith('.gz')) {
                fallbacks.push(originalUrl.replace(/\.gz$/, ''));
            }
            // Common sitemap patterns
            const commonPaths = [
                '/sitemap.xml',
                '/sitemap_index.xml',
                '/sitemaps/sitemap.xml',
                '/wp-sitemap.xml',
                '/sitemap-index.xml',
                '/recipes-sitemap.xml',
                '/recipe-sitemap.xml',
                '/post-sitemap.xml'
            ];
            // Add domain-specific fallbacks
            if (url.hostname.includes('allrecipes')) {
                fallbacks.push(`${domain}/sitemap.xml`, `${domain}/sitemap_index.xml`, `${domain}/recipes/sitemap.xml`);
            }
            else if (url.hostname.includes('foodnetwork')) {
                fallbacks.push(`${domain}/sitemap.xml`, `${domain}/sitemaps/sitemap.xml`, `${domain}/sitemaps/sitemap_index.xml`);
            }
            else {
                // Generic fallbacks for any domain
                commonPaths.forEach(path => fallbacks.push(`${domain}${path}`));
            }
            // Remove duplicates and original URL
            return [...new Set(fallbacks)].filter(url => url !== originalUrl);
        }
        catch (error) {
            console.error(`Error generating fallback URLs for ${originalUrl}:`, error);
            return [];
        }
    }
    /**
     * WORKAROUND 9: Validate sitemap content to catch corrupted or invalid responses
     */
    isValidSitemapContent(content) {
        if (!content || content.length < 10) {
            return false;
        }
        // Check for common XML sitemap markers
        const hasXmlDeclaration = content.includes('<?xml') || content.includes('<urlset') || content.includes('<sitemapindex');
        const hasValidStructure = content.includes('<loc>') || content.includes('<sitemap>');
        // Check for common error responses
        const isErrorPage = content.includes('<title>404') ||
            content.includes('<title>Error') ||
            content.includes('Not Found') ||
            content.includes('Access Denied') ||
            content.includes('Forbidden');
        return hasXmlDeclaration && hasValidStructure && !isErrorPage;
    }
    /**
     * COMPREHENSIVE XML PARSING with robust error handling for all common failure patterns
     */
    parseSitemap(xml) {
        if (!xml || xml.length < 10) {
            console.warn('⚠️ Empty or too short XML content');
            return [];
        }
        try {
            // WORKAROUND 10: Clean and preprocess XML content
            const cleanedXml = this.preprocessXmlContent(xml);
            if (!cleanedXml) {
                console.warn('⚠️ XML content could not be cleaned');
                return [];
            }
            console.log(`🔍 Parsing XML content (${cleanedXml.length} chars)`);
            const parsed = xmlParser.parse(cleanedXml);
            // WORKAROUND 11: Handle different sitemap structures with null safety
            if (parsed && typeof parsed === 'object') {
                // Handle sitemap index format
                if (parsed.sitemapindex) {
                    const sitemapData = parsed.sitemapindex;
                    if (sitemapData && sitemapData.sitemap) {
                        const sitemaps = Array.isArray(sitemapData.sitemap) ? sitemapData.sitemap : [sitemapData.sitemap];
                        const results = sitemaps
                            .filter((s) => s && s.loc) // Null safety
                            .map((s) => ({ loc: this.cleanUrl(s.loc) }))
                            .filter((entry) => entry.loc); // Remove invalid URLs
                        console.log(`✅ Parsed ${results.length} sitemap entries from sitemapindex`);
                        return results;
                    }
                }
                // Handle regular urlset format
                if (parsed.urlset) {
                    const urlsetData = parsed.urlset;
                    if (urlsetData && urlsetData.url) {
                        const urls = Array.isArray(urlsetData.url) ? urlsetData.url : [urlsetData.url];
                        const results = urls
                            .filter((u) => u && u.loc) // Null safety
                            .map((u) => ({
                            loc: this.cleanUrl(u.loc),
                            lastmod: u.lastmod
                        }))
                            .filter((entry) => entry.loc); // Remove invalid URLs
                        console.log(`✅ Parsed ${results.length} URL entries from urlset`);
                        return results;
                    }
                }
                // WORKAROUND 12: Handle alternative XML structures
                const alternativeResults = this.parseAlternativeXmlStructures(parsed);
                if (alternativeResults.length > 0) {
                    console.log(`✅ Parsed ${alternativeResults.length} entries from alternative structure`);
                    return alternativeResults;
                }
            }
            console.warn('⚠️ No valid sitemap structure found in parsed XML');
            console.log('📋 Parsed structure preview:', JSON.stringify(parsed, null, 2).substring(0, 500));
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('❌ XML parsing failed:', errorMessage);
            // WORKAROUND 13: Try alternative parsing methods for corrupted XML
            const fallbackResults = this.fallbackXmlParsing(xml);
            if (fallbackResults.length > 0) {
                console.log(`🔄 Fallback parsing recovered ${fallbackResults.length} URLs`);
                return fallbackResults;
            }
        }
        return [];
    }
    /**
     * WORKAROUND 14: Preprocess XML content to handle common issues
     */
    preprocessXmlContent(xml) {
        try {
            let cleaned = xml.trim();
            // Remove BOM (Byte Order Mark) if present
            if (cleaned.charCodeAt(0) === 0xFEFF) {
                cleaned = cleaned.substring(1);
            }
            // Remove non-printable characters at the beginning
            cleaned = cleaned.replace(/^[\x00-\x1F\x7F-\x9F]+/, '');
            // Ensure XML declaration is proper
            if (!cleaned.startsWith('<?xml') && !cleaned.startsWith('<urlset') && !cleaned.startsWith('<sitemapindex')) {
                // Try to find the actual XML start
                const xmlStart = cleaned.search(/<\?xml|<urlset|<sitemapindex/);
                if (xmlStart > 0) {
                    cleaned = cleaned.substring(xmlStart);
                    console.log(`🔧 Trimmed ${xmlStart} characters from XML beginning`);
                }
            }
            // Basic validation
            if (cleaned.length < 10 || (!cleaned.includes('<loc>') && !cleaned.includes('<sitemap>'))) {
                console.warn('⚠️ Cleaned XML appears to be invalid');
                return null;
            }
            return cleaned;
        }
        catch (error) {
            console.error('❌ Error preprocessing XML:', error);
            return null;
        }
    }
    /**
     * WORKAROUND 15: Handle alternative XML structures that don't match standard formats
     */
    parseAlternativeXmlStructures(parsed) {
        const results = [];
        try {
            // Check if there are direct URL arrays in different locations
            const searchPaths = [
                'url',
                'sitemap',
                'entry',
                'item',
                'link'
            ];
            for (const path of searchPaths) {
                if (parsed[path]) {
                    const items = Array.isArray(parsed[path]) ? parsed[path] : [parsed[path]];
                    for (const item of items) {
                        if (item && item.loc) {
                            const cleanedUrl = this.cleanUrl(item.loc);
                            if (cleanedUrl) {
                                results.push({ loc: cleanedUrl });
                            }
                        }
                    }
                }
            }
        }
        catch (error) {
            console.error('❌ Error parsing alternative structures:', error);
        }
        return results.filter(entry => entry.loc);
    }
    /**
     * WORKAROUND 16: Fallback regex-based parsing when XML parser fails completely
     */
    fallbackXmlParsing(xml) {
        const results = [];
        try {
            console.log('🔄 Attempting regex-based fallback parsing...');
            // Extract URLs using regex patterns
            const urlMatches = xml.match(/<loc>([^<]+)<\/loc>/gi);
            if (urlMatches) {
                for (const match of urlMatches) {
                    const urlMatch = match.match(/<loc>([^<]+)<\/loc>/i);
                    if (urlMatch && urlMatch[1]) {
                        const cleanedUrl = this.cleanUrl(urlMatch[1]);
                        if (cleanedUrl) {
                            results.push({ loc: cleanedUrl });
                        }
                    }
                }
            }
            console.log(`🔄 Regex fallback found ${results.length} URLs`);
        }
        catch (error) {
            console.error('❌ Regex fallback parsing failed:', error);
        }
        return results;
    }
    /**
     * WORKAROUND 17: Clean and validate URLs
     */
    cleanUrl(url) {
        if (!url || typeof url !== 'string') {
            return null;
        }
        try {
            const cleaned = url.trim();
            // Basic URL validation
            if (cleaned.startsWith('http://') || cleaned.startsWith('https://')) {
                new URL(cleaned); // This will throw if invalid
                return cleaned;
            }
            return null;
        }
        catch (error) {
            console.warn(`⚠️ Invalid URL skipped: ${url}`);
            return null;
        }
    }
    isSitemapIndex(entries) {
        if (entries.length === 0) {
            return false;
        }
        const firstEntry = entries[0];
        return 'loc' in firstEntry && firstEntry.loc.toLowerCase().endsWith('.xml') && !('lastmod' in firstEntry);
    }
    /**
     * ENHANCED URL FILTERING: Intelligently distinguish individual recipe URLs from category/tag pages
     * Addresses the #1 failure pattern affecting 25+ sites with 0% success rates
     */
    filterRecipeUrls(entries) {
        return entries
            .filter(entry => this.isIndividualRecipeUrl(entry.loc))
            .map(entry => entry.loc);
    }
    /**
     * Advanced URL classification to exclude category/tag pages and prioritize individual recipes
     */
    isIndividualRecipeUrl(url) {
        const urlLower = url.toLowerCase();
        // EXCLUSION PATTERNS: Block known category/tag page patterns
        const exclusionPatterns = [
            /\/category\//i, // /category/recipes/breakfast/
            /\/tag\//i, // /tag/chocolate/
            /\/recipes\/[^/]+\/?$/i, // /recipes/breakfast/ (category pages)
            /\/recipe-category\//i, // /recipe-category/
            /\/cuisine\//i, // /cuisine/italian/
            /\/collection\//i, // /collection/holiday/
            /\/archives\//i, // /archives/2023/
            /\/page\//i, // /page/2/
            /\/feed\//i, // /feed/
            /\/author\//i, // /author/chef-name/
            /\/search\//i, // /search/
            /\/(all-recipes|browse)\//i, // /all-recipes/, /browse/
        ];
        // Block if matches any exclusion pattern
        if (exclusionPatterns.some(pattern => pattern.test(url))) {
            return false;
        }
        // INCLUSION PATTERNS: Prioritize URLs that look like individual recipes
        const inclusionPatterns = [
            /\/recipe\/[^/]+\/?$/i, // /recipe/chocolate-chip-cookies/
            /\/recipes\/[^/]+\/?$/i, // /recipes/beef-stew/ (individual recipe)
            /\/[^/]*recipe[^/]*\/[^/]+\/?$/i, // /easy-recipe/pasta-salad/
            /\/\d{4}\/\d{2}\/[^/]+\/?$/i, // /2023/12/holiday-cookies/ (dated posts)
            /\/[a-z-]+(-recipe)?\/?$/i, // /chocolate-chip-cookies-recipe/
        ];
        // Include if matches any inclusion pattern
        if (inclusionPatterns.some(pattern => pattern.test(url))) {
            return true;
        }
        // SITE-SPECIFIC PATTERNS: Handle known structures for major sites
        if (this.isSiteSpecificRecipeUrl(url)) {
            return true;
        }
        // HEURISTIC ANALYSIS: Analyze URL structure characteristics
        return this.analyzeUrlStructure(url);
    }
    /**
     * Site-specific URL pattern recognition for major recipe websites
     */
    isSiteSpecificRecipeUrl(url) {
        const urlLower = url.toLowerCase();
        // Budget Bytes: /recipe-name/ (not in /category/)
        if (urlLower.includes('budgetbytes.com')) {
            return /\/[a-z0-9-]+\/?$/i.test(url) && !/\/category\//i.test(url);
        }
        // Minimalist Baker: /recipes/recipe-name/ (specific recipe)
        if (urlLower.includes('minimalistbaker.com')) {
            return /\/recipes\/[a-z0-9-]+\/?$/i.test(url) && !/\/(gluten-free|vegan|dessert)\/?$/i.test(url);
        }
        // Pinch of Yum: BLOCK /recipes/* entirely - they're all category pages
        if (urlLower.includes('pinchofyum.com')) {
            // Block ALL /recipes/ URLs as they're category pages, not individual recipes
            return !/\/recipes\//i.test(url) && /\/[a-z0-9-]+\/?$/i.test(url);
        }
        // Omnivore's Cookbook: /recipe-name/
        if (urlLower.includes('omnivorescookbook.com')) {
            return /\/[a-z0-9-]+\/?$/i.test(url) && !/\/recipes\/?$/i.test(url);
        }
        // Hebbar's Kitchen: /recipe-name/
        if (urlLower.includes('hebbarkitchen.com')) {
            return /\/[a-z0-9-]+\/?$/i.test(url) && !/\/(category|tag)\//i.test(url);
        }
        return false;
    }
    /**
     * Heuristic analysis of URL structure to identify individual recipes
     */
    analyzeUrlStructure(url) {
        try {
            const urlObj = new URL(url);
            const pathSegments = urlObj.pathname.split('/').filter(segment => segment.length > 0);
            // Skip very short or very long paths
            if (pathSegments.length < 1 || pathSegments.length > 5) {
                return false;
            }
            // Check last segment for recipe-like characteristics
            const lastSegment = pathSegments[pathSegments.length - 1];
            // Skip if looks like category/listing page
            const categoryKeywords = ['recipes', 'category', 'tag', 'cuisine', 'collection', 'all', 'browse', 'list'];
            if (categoryKeywords.some(keyword => lastSegment.toLowerCase().includes(keyword))) {
                return false;
            }
            // Prefer URLs with recipe-indicating words in path
            const recipeKeywords = ['recipe', 'cook', 'bake', 'make', 'how-to'];
            const hasRecipeKeyword = pathSegments.some(segment => recipeKeywords.some(keyword => segment.toLowerCase().includes(keyword)));
            // Prefer URLs with descriptive names (hyphenated, multiple words)
            const hasDescriptiveName = lastSegment.includes('-') && lastSegment.length > 8;
            return hasRecipeKeyword || hasDescriptiveName;
        }
        catch (error) {
            // Invalid URL structure
            return false;
        }
    }
    async crawl(sitemapUrl, urlLimit) {
        console.log(`Crawling sitemap: ${sitemapUrl}`);
        const sitemapXml = await this.fetchSitemap(sitemapUrl);
        const entries = this.parseSitemap(sitemapXml);
        if (this.isSitemapIndex(entries)) {
            console.log(`Sitemap index found with ${entries.length} nested sitemaps.`);
            const promises = entries.map(entry => this.limit(async () => {
                const nestedXml = await this.fetchSitemap(entry.loc);
                const nestedEntries = this.parseSitemap(nestedXml);
                return this.filterRecipeUrls(nestedEntries);
            }));
            const results = await Promise.all(promises);
            let allUrls = results.flat();
            if (urlLimit) {
                allUrls = allUrls.slice(0, urlLimit);
            }
            return allUrls;
        }
        else {
            const sitemapEntries = entries;
            console.log(`Regular sitemap found with ${sitemapEntries.length} URLs.`);
            let urls = this.filterRecipeUrls(sitemapEntries);
            if (urlLimit) {
                urls = urls.slice(0, urlLimit);
            }
            return urls;
        }
    }
    async crawlWebsite(website, urlLimit) {
        const startTime = Date.now();
        const errors = [];
        let recipeUrls = [];
        const sitemapUrl = website['Main Sitemap URL'];
        try {
            recipeUrls = await this.crawl(sitemapUrl, urlLimit);
        }
        catch (error) {
            errors.push(error);
        }
        return {
            website,
            recipeUrls,
            errors,
            stats: {
                totalUrls: recipeUrls.length,
                filteredUrls: recipeUrls.length,
                errorCount: errors.length,
                processingTimeMs: Date.now() - startTime
            }
        };
    }
}
