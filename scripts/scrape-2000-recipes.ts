/**
 * Batch Scrape 2000 Recipes to Supabase
 * Uses the BatchScrapingService to crawl websites and save recipes to database
 */

import './src/config.js'; // Load environment variables
import { BatchScrapingService } from './src/services/BatchScrapingService.js';
import { SitemapCrawler } from './src/crawler/SitemapCrawler.js';
import { Website } from './src/shared/types.js';
import * as fs from 'fs';
import * as path from 'path';

const TARGET_RECIPE_COUNT = 2000;
const RECIPES_PER_WEBSITE = 50; // Limit per website to get variety

// Top websites to scrape from
const WEBSITES: Website[] = [
  {
    id: 1,
    name: 'Allrecipes',
    base_url: 'https://www.allrecipes.com',
    sitemap_url: 'https://www.allrecipes.com/sitemap.xml',
    category: 'Popular',
    priority: 10,
    active: true
  },
  {
    id: 2,
    name: 'Simply Recipes',
    base_url: 'https://www.simplyrecipes.com',
    sitemap_url: 'https://www.simplyrecipes.com/sitemap.xml',
    category: 'Popular',
    priority: 9,
    active: true
  },
  {
    id: 3,
    name: 'Serious Eats',
    base_url: 'https://www.seriouseats.com',
    sitemap_url: 'https://www.seriouseats.com/sitemap.xml',
    category: 'Popular',
    priority: 9,
    active: true
  },
  {
    id: 4,
    name: 'BBC Good Food',
    base_url: 'https://www.bbc.co.uk/food',
    sitemap_url: 'https://www.bbc.co.uk/food/sitemap.xml',
    category: 'Popular',
    priority: 8,
    active: true
  },
  {
    id: 5,
    name: 'Food Network',
    base_url: 'https://www.foodnetwork.com',
    sitemap_url: 'https://www.foodnetwork.com/sitemap.xml',
    category: 'Popular',
    priority: 10,
    active: true
  },
  {
    id: 6,
    name: 'Minimalist Baker',
    base_url: 'https://minimalistbaker.com',
    sitemap_url: 'https://minimalistbaker.com/sitemap.xml',
    category: 'Blogs',
    priority: 7,
    active: true
  },
  {
    id: 7,
    name: 'Budget Bytes',
    base_url: 'https://www.budgetbytes.com',
    sitemap_url: 'https://www.budgetbytes.com/sitemap.xml',
    category: 'Blogs',
    priority: 7,
    active: true
  },
  {
    id: 8,
    name: 'Pinch of Yum',
    base_url: 'https://pinchofyum.com',
    sitemap_url: 'https://pinchofyum.com/sitemap.xml',
    category: 'Blogs',
    priority: 6,
    active: true
  },
  {
    id: 9,
    name: 'Love and Lemons',
    base_url: 'https://www.loveandlemons.com',
    sitemap_url: 'https://www.loveandlemons.com/sitemap.xml',
    category: 'Blogs',
    priority: 6,
    active: true
  },
  {
    id: 10,
    name: 'King Arthur Baking',
    base_url: 'https://www.kingarthurbaking.com',
    sitemap_url: 'https://www.kingarthurbaking.com/sitemap.xml',
    category: 'Baking',
    priority: 8,
    active: true
  },
  {
    id: 11,
    name: 'The Kitchn',
    base_url: 'https://www.thekitchn.com',
    sitemap_url: 'https://www.thekitchn.com/sitemap.xml',
    category: 'Specialty',
    priority: 7,
    active: true
  },
  {
    id: 12,
    name: 'Cookie and Kate',
    base_url: 'https://cookieandkate.com',
    sitemap_url: 'https://cookieandkate.com/sitemap.xml',
    category: 'Blogs',
    priority: 7,
    active: true
  },
  {
    id: 13,
    name: 'Once Upon a Chef',
    base_url: 'https://www.onceuponachef.com',
    sitemap_url: 'https://www.onceuponachef.com/sitemap.xml',
    category: 'Blogs',
    priority: 7,
    active: true
  },
  {
    id: 14,
    name: 'Gimme Some Oven',
    base_url: 'https://www.gimmesomeoven.com',
    sitemap_url: 'https://www.gimmesomeoven.com/sitemap.xml',
    category: 'Blogs',
    priority: 6,
    active: true
  },
  {
    id: 15,
    name: 'Cafe Delites',
    base_url: 'https://cafedelites.com',
    sitemap_url: 'https://cafedelites.com/sitemap.xml',
    category: 'Blogs',
    priority: 6,
    active: true
  },
  {
    id: 16,
    name: 'RecipeTin Eats',
    base_url: 'https://www.recipetineats.com',
    sitemap_url: 'https://www.recipetineats.com/sitemap.xml',
    category: 'International',
    priority: 7,
    active: true
  },
  {
    id: 17,
    name: 'Just One Cookbook',
    base_url: 'https://www.justonecookbook.com',
    sitemap_url: 'https://www.justonecookbook.com/sitemap.xml',
    category: 'International',
    priority: 7,
    active: true
  },
  {
    id: 18,
    name: 'Woks of Life',
    base_url: 'https://thewoksoflife.com',
    sitemap_url: 'https://thewoksoflife.com/sitemap.xml',
    category: 'International',
    priority: 7,
    active: true
  },
  {
    id: 19,
    name: 'Well Plated',
    base_url: 'https://www.wellplated.com',
    sitemap_url: 'https://www.wellplated.com/sitemap.xml',
    category: 'Healthy',
    priority: 6,
    active: true
  },
  {
    id: 20,
    name: 'Ambitious Kitchen',
    base_url: 'https://www.ambitiouskitchen.com',
    sitemap_url: 'https://www.ambitiouskitchen.com/sitemap.xml',
    category: 'Healthy',
    priority: 6,
    active: true
  }
];

async function main() {
  console.log('🚀 BATCH RECIPE SCRAPING TO SUPABASE');
  console.log('=' .repeat(100));
  console.log(`Target: ${TARGET_RECIPE_COUNT} recipes`);
  console.log(`Websites: ${WEBSITES.length}`);
  console.log(`Recipes per website: ~${RECIPES_PER_WEBSITE}\n`);

  const batchService = new BatchScrapingService({
    maxConcurrency: 3, // Conservative concurrency
    saveResults: true, // Save to Supabase
    enableHealthCheck: true,
    logLevel: 'info'
  });

  let totalRecipesScraped = 0;
  const stats = {
    websitesProcessed: 0,
    successfulRecipes: 0,
    failedRecipes: 0,
    startTime: new Date()
  };

  console.log('Starting batch scraping...\n');

  // Process websites one at a time to manage load
  for (const website of WEBSITES) {
    if (totalRecipesScraped >= TARGET_RECIPE_COUNT) {
      console.log(`\n✅ Target of ${TARGET_RECIPE_COUNT} recipes reached!`);
      break;
    }

    console.log(`\n${'='.repeat(100)}`);
    console.log(`Processing: ${website.name} (${website.category})`);
    console.log(`Progress: ${totalRecipesScraped}/${TARGET_RECIPE_COUNT} recipes scraped`);
    console.log(`${'='.repeat(100)}\n`);

    try {
      // Create a limited batch for this website
      const limitedWebsite: Website = {
        ...website,
        notes: `Limited to ${RECIPES_PER_WEBSITE} recipes`
      };

      // Crawl website for recipe URLs (limited)
      const crawler = new SitemapCrawler({
        concurrency: 2,
        requestTimeout: 30000
      });

      console.log(`📡 Crawling sitemap: ${website.sitemap_url}`);
      const crawlResult = await crawler.crawlWebsite(limitedWebsite);

      // Limit the URLs to process
      const urlsToProcess = crawlResult.recipeUrls.slice(0, RECIPES_PER_WEBSITE);
      console.log(`   Found ${crawlResult.recipeUrls.length} URLs, processing ${urlsToProcess.length}`);

      if (urlsToProcess.length === 0) {
        console.log(`   ⚠️  No recipe URLs found, skipping...`);
        continue;
      }

      // Process this batch
      const websiteBatch: Website = {
        ...limitedWebsite,
        sub_sitemaps: urlsToProcess
      };

      const result = await batchService.processWebsite(websiteBatch);

      // Update statistics
      stats.websitesProcessed++;
      stats.successfulRecipes += result.success_count;
      stats.failedRecipes += result.failure_count;
      totalRecipesScraped += result.success_count;

      console.log(`\n✅ ${website.name} complete:`);
      console.log(`   Successfully scraped: ${result.success_count} recipes`);
      console.log(`   Failed: ${result.failure_count} recipes`);
      console.log(`   Success rate: ${(result.success_rate * 100).toFixed(1)}%`);
      console.log(`   Time taken: ${(result.total_time / 1000).toFixed(1)}s`);
      console.log(`   Total recipes so far: ${totalRecipesScraped}/${TARGET_RECIPE_COUNT}`);

    } catch (error) {
      console.error(`\n❌ Error processing ${website.name}:`, error);
      stats.websitesProcessed++;
    }

    // Add delay between websites
    if (totalRecipesScraped < TARGET_RECIPE_COUNT) {
      console.log(`\n⏱️  Waiting 5 seconds before next website...`);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  // Final statistics
  const endTime = new Date();
  const totalTime = (endTime.getTime() - stats.startTime.getTime()) / 1000;

  console.log('\n\n' + '='.repeat(100));
  console.log('📊 FINAL STATISTICS');
  console.log('='.repeat(100));
  console.log(`\nWebsites processed: ${stats.websitesProcessed}/${WEBSITES.length}`);
  console.log(`Total recipes scraped: ${totalRecipesScraped}`);
  console.log(`   ✅ Successful: ${stats.successfulRecipes}`);
  console.log(`   ❌ Failed: ${stats.failedRecipes}`);
  console.log(`Overall success rate: ${((stats.successfulRecipes / (stats.successfulRecipes + stats.failedRecipes)) * 100).toFixed(1)}%`);
  console.log(`\nTotal time: ${(totalTime / 60).toFixed(1)} minutes`);
  console.log(`Average time per recipe: ${(totalTime / stats.successfulRecipes).toFixed(1)}s`);
  console.log('\n✨ All recipes have been saved to Supabase!\n');

  // Save final report
  const reportPath = path.join(process.cwd(), 'batch-scraping-report.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    ...stats,
    totalRecipesScraped,
    endTime,
    totalTimeSeconds: totalTime
  }, null, 2));

  console.log(`📝 Report saved to: ${reportPath}\n`);
}

main()
  .then(() => {
    console.log('🎉 Batch scraping completed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n💥 Batch scraping failed:', error);
    process.exit(1);
  });
