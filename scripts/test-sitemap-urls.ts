import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';

interface SitemapTestResult {
  website: string;
  url: string;
  status: number;
  error?: string;
  working: boolean;
}

async function testSitemapUrl(url: string): Promise<{ status: number; error?: string; working: boolean }> {
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      signal: AbortSignal.timeout(10000)
    });
    
    return {
      status: response.status,
      working: response.status >= 200 && response.status < 400
    };
  } catch (error) {
    return {
      status: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
      working: false
    };
  }
}

async function testAllSitemaps() {
  const csvContent = readFileSync('/Users/orensegal/Documents/GitHub/typescript_scraper_service/data/Data.csv', 'utf-8');
  const records = parse(csvContent, { 
    columns: true, 
    skip_empty_lines: true 
  });

  const results: SitemapTestResult[] = [];
  const problematicSites: string[] = [];

  console.log('Testing sitemap URLs...\n');

  for (const record of records as any) {
    const websiteName = record['Website Name'];
    const mainSitemapUrl = record['Main Sitemap URL'];
    
    if (!mainSitemapUrl || mainSitemapUrl.trim() === '') continue;

    console.log(`Testing ${websiteName}: ${mainSitemapUrl}`);
    
    const result = await testSitemapUrl(mainSitemapUrl);
    
    const testResult: SitemapTestResult = {
      website: websiteName,
      url: mainSitemapUrl,
      status: result.status,
      error: result.error,
      working: result.working
    };
    
    results.push(testResult);
    
    if (!result.working) {
      problematicSites.push(websiteName);
      console.log(`❌ FAILED: ${websiteName} (${result.status}) ${result.error || ''}`);
    } else {
      console.log(`✅ OK: ${websiteName} (${result.status})`);
    }
    
    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n=== SUMMARY ===');
  console.log(`Total sites tested: ${results.length}`);
  console.log(`Working sitemaps: ${results.filter(r => r.working).length}`);
  console.log(`Problematic sitemaps: ${results.filter(r => !r.working).length}`);
  
  if (problematicSites.length > 0) {
    console.log('\n=== PROBLEMATIC SITES ===');
    problematicSites.forEach(site => {
      const result = results.find(r => r.website === site);
      console.log(`${site}: ${result?.url} (Status: ${result?.status}) ${result?.error || ''}`);
    });
  }

  return results;
}

// Run the test
testAllSitemaps().catch(console.error);
