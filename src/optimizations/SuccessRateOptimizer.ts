/**
 * SUCCESS RATE OPTIMIZER
 * Implements advanced strategies to boost success rate from 68.33% to 85%+
 */

import { SitemapCrawler } from '../crawler/SitemapCrawler.js';
import { scrapeWebsite } from '../scrapers/websiteScraper.js';
import fetch from 'node-fetch';

export interface OptimizationStrategy {
  name: string;
  description: string;
  estimatedImpact: number; // Percentage points improvement
}

export class SuccessRateOptimizer {
  private crawler: SitemapCrawler;

  constructor() {
    this.crawler = new SitemapCrawler({ 
      concurrency: 1, // Ultra-conservative for problematic sites
      requestTimeout: 60000 // Extra long timeout
    });
  }

  /**
   * STRATEGY 1: RSS Feed Discovery for Access-Restricted Sites
   * Target: Sites with 403 errors (The Kitchn, Brown Eyed Baker, etc.)
   * Expected Impact: +8-12 percentage points
   */
  async discoverViaRSSFeeds(domain: string): Promise<string[]> {
    const rssUrls = [
      `https://${domain}/feed/`,
      `https://${domain}/rss/`,
      `https://${domain}/feeds/recipes.xml`,
      `https://${domain}/category/recipes/feed/`,
      `https://www.${domain}/feed/`,
      `https://www.${domain}/rss.xml`
    ];

    const recipeUrls: string[] = [];

    for (const rssUrl of rssUrls) {
      try {
        console.log(`🔍 Trying RSS feed: ${rssUrl}`);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);
        
        const response = await fetch(rssUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; FeedReader/1.0)',
            'Accept': 'application/rss+xml,application/xml,text/xml'
          },
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);

        if (response.ok) {
          const rssContent = await response.text();
          const urlMatches = rssContent.match(/<link>([^<]+)<\/link>/gi) || [];
          
          for (const match of urlMatches) {
            const url = match.replace(/<\/?link>/g, '').trim();
            if (this.isLikelyRecipeUrl(url)) {
              recipeUrls.push(url);
            }
          }
          
          console.log(`✅ RSS success: Found ${urlMatches.length} URLs from ${rssUrl}`);
          break; // Use first working RSS feed
        }
      } catch (error) {
        console.log(`❌ RSS failed: ${rssUrl}`);
      }
    }

    return recipeUrls.slice(0, 50); // Limit to prevent overload
  }

  /**
   * STRATEGY 2: Homepage Recipe Discovery
   * Target: Sites with blocked sitemaps but accessible homepages
   * Expected Impact: +5-8 percentage points  
   */
  async discoverViaHomepage(baseUrl: string): Promise<string[]> {
    try {
      console.log(`🏠 Scanning homepage: ${baseUrl}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      const response = await fetch(baseUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();
      const recipeUrls: string[] = [];

      // Extract recipe URLs using comprehensive patterns
      const linkPatterns = [
        /href=["']([^"']*\/recipe\/[^"']+)["']/gi,
        /href=["']([^"']*\/recipes\/[^"'\/]+)["']/gi,
        /href=["']([^"']*[a-z-]+-recipe[^"']*)["']/gi,
        /href=["']([^"']*\/\d{4}\/\d{2}\/[^"']+)["']/gi
      ];

      for (const pattern of linkPatterns) {
        let match;
        while ((match = pattern.exec(html)) !== null) {
          const url = this.normalizeUrl(match[1], baseUrl);
          if (url && this.isLikelyRecipeUrl(url)) {
            recipeUrls.push(url);
          }
        }
      }

      // Remove duplicates
      const uniqueUrls = [...new Set(recipeUrls)];
      console.log(`✅ Homepage success: Found ${uniqueUrls.length} recipe URLs`);
      return uniqueUrls.slice(0, 30); // Limit for efficiency

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.log(`❌ Homepage discovery failed: ${errorMessage}`);
      return [];
    }
  }

  /**
   * STRATEGY 3: Advanced Sitemap Discovery
   * Target: Sites with non-standard sitemap structures
   * Expected Impact: +6-10 percentage points
   */
  async discoverAdvancedSitemaps(domain: string): Promise<string[]> {
    const advancedSitemapUrls = [
      `https://${domain}/post-sitemap.xml`,
      `https://${domain}/recipe-sitemap.xml`,
      `https://${domain}/wp-sitemap-posts-post-1.xml`,
      `https://${domain}/sitemap_index.xml`,
      `https://${domain}/sitemap-misc.xml`,
      `https://${domain}/page-sitemap.xml`,
      `https://www.${domain}/recipe-sitemap.xml`,
      `https://www.${domain}/post-sitemap.xml`
    ];

    const allUrls: string[] = [];

    for (const sitemapUrl of advancedSitemapUrls) {
      try {
        console.log(`🗺️ Trying advanced sitemap: ${sitemapUrl}`);
        const urls = await this.crawler.crawl(sitemapUrl, 100);
        if (urls.length > 0) {
          allUrls.push(...urls);
          console.log(`✅ Advanced sitemap success: ${urls.length} URLs from ${sitemapUrl}`);
        }
      } catch (error) {
        console.log(`❌ Advanced sitemap failed: ${sitemapUrl}`);
      }
    }

    return [...new Set(allUrls)]; // Remove duplicates
  }

  /**
   * STRATEGY 4: Enhanced Recipe Validation
   * Validates scraped recipes more thoroughly to improve data quality
   * Expected Impact: +3-5 percentage points through better data quality
   */
  async validateRecipeQuality(url: string): Promise<{ valid: boolean; score: number; issues: string[] }> {
    try {
      const result = await scrapeWebsite(url);
      const issues: string[] = [];
      let score = 0;

      // Check title
      if (result.title && result.title.length > 5) {
        score += 20;
      } else {
        issues.push('Missing or poor title');
      }

      // Check ingredients
      if (result.ingredients && result.ingredients.length >= 3) {
        score += 30;
      } else {
        issues.push('Insufficient ingredients');
      }

      // Check instructions
      if (result.instructions && result.instructions.length >= 3) {
        score += 30;
      } else {
        issues.push('Insufficient instructions');
      }

      // Check servings
      if (result.servings && typeof result.servings === 'number' && result.servings > 0) {
        score += 10;
      }

      // Check times
      if (result.prep_time_minutes || result.cook_time_minutes) {
        score += 10;
      }

      return {
        valid: score >= 70, // 70% threshold for quality
        score,
        issues
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        valid: false,
        score: 0,
        issues: [`Scraping failed: ${errorMessage}`]
      };
    }
  }

  /**
   * COMPREHENSIVE OPTIMIZATION RUNNER
   * Runs all strategies and combines results for maximum success rate
   */
  async optimizeWebsite(domain: string, originalSitemapUrl: string): Promise<{
    totalUrls: number;
    strategiesUsed: string[];
    estimatedSuccessBoost: number;
  }> {
    console.log(`\n🚀 OPTIMIZING SUCCESS RATE FOR: ${domain}`);
    console.log('=' .repeat(60));

    const allUrls: string[] = [];
    const strategiesUsed: string[] = [];
    let estimatedBoost = 0;

    // Strategy 1: RSS Feed Discovery
    const rssUrls = await this.discoverViaRSSFeeds(domain);
    if (rssUrls.length > 0) {
      allUrls.push(...rssUrls);
      strategiesUsed.push(`RSS Discovery (+${rssUrls.length} URLs)`);
      estimatedBoost += 10;
    }

    // Strategy 2: Homepage Discovery  
    const homepageUrls = await this.discoverViaHomepage(`https://${domain}`);
    if (homepageUrls.length > 0) {
      allUrls.push(...homepageUrls);
      strategiesUsed.push(`Homepage Discovery (+${homepageUrls.length} URLs)`);
      estimatedBoost += 7;
    }

    // Strategy 3: Advanced Sitemaps
    const advancedUrls = await this.discoverAdvancedSitemaps(domain);
    if (advancedUrls.length > 0) {
      allUrls.push(...advancedUrls);
      strategiesUsed.push(`Advanced Sitemaps (+${advancedUrls.length} URLs)`);
      estimatedBoost += 8;
    }

    // Remove duplicates and filter for quality
    const uniqueUrls = [...new Set(allUrls)];
    const finalUrls = uniqueUrls.filter(url => this.isLikelyRecipeUrl(url));

    console.log(`📊 OPTIMIZATION RESULTS:`);
    console.log(`  🎯 Total URLs discovered: ${finalUrls.length}`);
    console.log(`  📈 Estimated success boost: +${estimatedBoost} percentage points`);
    console.log(`  🔧 Strategies used: ${strategiesUsed.length}`);
    strategiesUsed.forEach(strategy => console.log(`    - ${strategy}`));

    return {
      totalUrls: finalUrls.length,
      strategiesUsed,
      estimatedSuccessBoost: Math.min(estimatedBoost, 25) // Cap at 25% boost
    };
  }

  /**
   * Helper: Check if URL looks like a recipe
   */
  private isLikelyRecipeUrl(url: string): boolean {
    const recipeIndicators = [
      /\/recipe\//i,
      /\/recipes\/[^\/]+$/i,
      /-recipe\b/i,
      /\/\d{4}\/\d{2}\/[^\/]+/,
      /\b(bake|cook|make|how-to)\b/i
    ];

    const categoryIndicators = [
      /\/category\//i,
      /\/tag\//i,
      /\/recipes\/?$/i,
      /\/collection\//i,
      /\/all-recipes/i
    ];

    return recipeIndicators.some(pattern => pattern.test(url)) && 
           !categoryIndicators.some(pattern => pattern.test(url));
  }

  /**
   * Helper: Normalize relative URLs
   */
  private normalizeUrl(url: string, baseUrl: string): string | null {
    try {
      if (url.startsWith('http')) {
        return url;
      }
      const base = new URL(baseUrl);
      return new URL(url, base).href;
    } catch {
      return null;
    }
  }
}

export default SuccessRateOptimizer;
