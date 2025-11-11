/**
 * Robust fetch utility with retry logic, rate limiting, and better headers
 */

import { promisify } from 'util';
import ErrorTracker from './errorTracker.js';

const sleep = promisify(setTimeout);

export interface FetchOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  headers?: Record<string, string>;
  timeout?: number;
}

interface SiteConfig {
  maxConcurrency: number;
  minDelay: number;
  maxDelay: number;
  userAgents: string[];
}

// Site-specific configurations to avoid rate limiting
const SITE_CONFIGS: Record<string, SiteConfig> = {
  'pinchofyum.com': {
    maxConcurrency: 1,  // Very conservative
    minDelay: 5000,     // 5 seconds minimum
    maxDelay: 15000,    // 15 seconds max
    userAgents: [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ]
  },
  'www.tasteofhome.com': {
    maxConcurrency: 1,  // Single request at a time
    minDelay: 8000,     // 8 seconds minimum between requests
    maxDelay: 20000,    // 20 seconds max delay
    userAgents: [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15'
    ]
  },
  'tasteofhome.com': {
    maxConcurrency: 1,  // Single request at a time
    minDelay: 8000,     // 8 seconds minimum between requests
    maxDelay: 20000,    // 20 seconds max delay
    userAgents: [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ]
  },
  'food52.com': {
    maxConcurrency: 3,
    minDelay: 2500,
    maxDelay: 6000,
    userAgents: [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0'
    ]
  },
  'www.simplyrecipes.com': {
    maxConcurrency: 3,
    minDelay: 2000,
    maxDelay: 5000,
    userAgents: [
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ]
  },
  'www.seriouseats.com': {
    maxConcurrency: 3,
    minDelay: 2000,
    maxDelay: 5000,
    userAgents: [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
    ]
  },
  'default': {
    maxConcurrency: 5,
    minDelay: 1000,
    maxDelay: 3000,
    userAgents: [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0'
    ]
  }
};

// Track last request time per domain for rate limiting
const lastRequestTime: Map<string, number> = new Map();

/**
 * Get site configuration for a given URL
 */
export function getSiteConfig(url: string): SiteConfig {
  try {
    const hostname = new URL(url).hostname;
    const domain = hostname.replace('www.', '');
    return SITE_CONFIGS[hostname] || SITE_CONFIGS[domain] || SITE_CONFIGS.default;
  } catch {
    return SITE_CONFIGS.default;
  }
}

/**
 * Get a random user agent for the site
 */
function getRandomUserAgent(siteConfig: SiteConfig): string {
  const agents = siteConfig.userAgents;
  return agents[Math.floor(Math.random() * agents.length)];
}

/**
 * Calculate delay with jitter
 */
function calculateDelay(attempt: number, siteConfig: SiteConfig): number {
  const exponentialDelay = Math.min(
    siteConfig.minDelay * Math.pow(2, attempt),
    siteConfig.maxDelay
  );
  // Add random jitter (±20%)
  const jitter = exponentialDelay * (0.8 + Math.random() * 0.4);
  return Math.floor(jitter);
}

/**
 * Apply rate limiting for a domain
 */
async function applyRateLimit(url: string, siteConfig: SiteConfig): Promise<void> {
  try {
    const hostname = new URL(url).hostname;
    const lastTime = lastRequestTime.get(hostname);
    
    if (lastTime) {
      const timeSinceLastRequest = Date.now() - lastTime;
      const minDelay = siteConfig.minDelay;
      
      if (timeSinceLastRequest < minDelay) {
        const waitTime = minDelay - timeSinceLastRequest;
        console.log(`⏳ Rate limiting for ${hostname}: waiting ${waitTime}ms`);
        await sleep(waitTime);
      }
    }
    
    lastRequestTime.set(hostname, Date.now());
  } catch (error) {
    console.warn('Error in rate limiting:', error);
  }
}

/**
 * Robust fetch with retry logic and better headers
 */
export async function robustFetch(
  url: string,
  options: FetchOptions = {}
): Promise<Response> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    timeout = 30000
  } = options;

  const errorTracker = ErrorTracker.getInstance();
  
  // Check if domain is blocked
  if (errorTracker.isDomainBlocked(url)) {
    const domain = new URL(url).hostname;
    throw new Error(`Domain ${domain} is blocked due to excessive errors. Skipping.`);
  }

  const siteConfig = getSiteConfig(url);
  
  // Apply initial rate limiting
  await applyRateLimit(url, siteConfig);
  
  let lastError: Error | null = null;
  let lastStatusCode = 0;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Prepare headers with rotating user agents
      const headers: Record<string, string> = {
        'User-Agent': getRandomUserAgent(siteConfig),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"macOS"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
        ...options.headers
      };

      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(url, {
          headers,
          signal: controller.signal,
          redirect: 'follow'
        });

        clearTimeout(timeoutId);

        // Success!
        if (response.ok) {
          console.log(`✅ Successfully fetched ${url} (attempt ${attempt + 1})`);
          errorTracker.recordSuccess(url);
          return response;
        }

        lastStatusCode = response.status;

        // Handle specific error codes
        if (response.status === 429) {
          // Rate limited - use exponential backoff
          const delay = calculateDelay(attempt, siteConfig);
          console.warn(`⚠️ Rate limited (429) for ${url}, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries + 1})`);
          
          if (attempt < maxRetries) {
            await sleep(delay);
            // Apply additional rate limiting after 429
            await applyRateLimit(url, siteConfig);
            continue;
          }
        } else if (response.status === 403) {
          // Forbidden - might be blocking our user agent
          console.warn(`⚠️ Forbidden (403) for ${url}, trying different headers (attempt ${attempt + 1}/${maxRetries + 1})`);
          
          if (attempt < maxRetries) {
            // Wait with backoff and try with different user agent
            const delay = calculateDelay(attempt, siteConfig);
            await sleep(delay);
            continue;
          }
        } else if (response.status >= 500) {
          // Server error - retry with backoff
          const delay = calculateDelay(attempt, siteConfig);
          console.warn(`⚠️ Server error (${response.status}) for ${url}, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries + 1})`);
          
          if (attempt < maxRetries) {
            await sleep(delay);
            continue;
          }
        }

        // Other non-OK status
        throw new Error(`Failed to fetch URL (${response.status}): ${response.statusText}`);
        
      } catch (error: any) {
        clearTimeout(timeoutId);
        
        if (error.name === 'AbortError') {
          lastError = new Error(`Request timeout after ${timeout}ms`);
          console.error(`⏱️ Timeout fetching ${url} (attempt ${attempt + 1}/${maxRetries + 1})`);
        } else {
          lastError = error;
          console.error(`❌ Error fetching ${url} (attempt ${attempt + 1}/${maxRetries + 1}):`, error.message);
        }

        if (attempt < maxRetries) {
          const delay = calculateDelay(attempt, siteConfig);
          console.log(`🔄 Retrying in ${delay}ms...`);
          await sleep(delay);
          // Apply rate limiting before retry
          await applyRateLimit(url, siteConfig);
        }
      }
    } catch (error: any) {
      lastError = error;
      console.error(`❌ Unexpected error fetching ${url}:`, error.message);
      
      if (attempt < maxRetries) {
        const delay = calculateDelay(attempt, siteConfig);
        await sleep(delay);
      }
    }
  }

  // All retries exhausted - record final failure
  if (lastStatusCode > 0) {
    errorTracker.recordError(url, lastStatusCode, lastError?.message || 'Unknown error');
  }
  throw lastError || new Error(`Failed to fetch ${url} after ${maxRetries + 1} attempts`);
}

/**
 * Fetch with automatic text response
 */
export async function fetchText(url: string, options?: FetchOptions): Promise<string> {
  const response = await robustFetch(url, options);
  return response.text();
}

/**
 * Fetch with automatic JSON response
 */
export async function fetchJson<T = any>(url: string, options?: FetchOptions): Promise<T> {
  const response = await robustFetch(url, options);
  return response.json();
}

/**
 * Add or update site-specific configuration
 */
export function addSiteConfig(domain: string, config: Partial<SiteConfig>): void {
  const existingConfig = SITE_CONFIGS[domain] || {
    maxConcurrency: 3,
    minDelay: 2000,
    maxDelay: 5000,
    userAgents: [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    ]
  };
  
  SITE_CONFIGS[domain] = { ...existingConfig, ...config };
  console.log(`🔧 Updated config for ${domain}:`, SITE_CONFIGS[domain]);
}

/**
 * Get current site configuration
 */
export function getSiteConfiguration(domain: string): SiteConfig | undefined {
  return SITE_CONFIGS[domain];
}
