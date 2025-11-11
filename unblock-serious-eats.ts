#!/usr/bin/env npx tsx

/**
 * Unblock Serious Eats and other temporary blocks to retry with improved rate limiting
 */

import { BlockedWebsitesRegistry } from './src/registry/BlockedWebsitesRegistry.js';

const registry = BlockedWebsitesRegistry.getInstance();

console.log('🔓 Unblocking websites for retry with improved rate limiting...\n');

// Get current stats
const stats = registry.getStats();
console.log(`Current Status:`);
console.log(`  • Total Blocked: ${stats.total}`);
console.log(`  • Temporary: ${stats.temporary}`);
console.log(`  • Permanent: ${stats.permanent}\n`);

// List all blocked
const blocked = registry.getAllBlocked();
console.log('Currently blocked domains:');
blocked.forEach(site => {
  console.log(`  • ${site.domain} (${site.errorType}, ${site.attemptCount} failures, ${site.isTemporary ? 'temporary' : 'permanent'})`);
});

// Unblock specific domains that should be retried with new rate limiting
const toUnblock = [
  'www.seriouseats.com',
  'seriouseats.com',
  'www.bonappetit.com',
  'bonappetit.com'
];

console.log('\n🔄 Unblocking domains with improved rate limiting:');
for (const domain of toUnblock) {
  await registry.unblock(domain);
}

// Show updated stats
const newStats = registry.getStats();
console.log(`\n✅ Updated Status:`);
console.log(`  • Total Blocked: ${newStats.total}`);
console.log(`  • Unblocked: ${stats.total - newStats.total} domains\n`);

console.log('🎯 Ready to retry with:');
console.log('  • Serious Eats: 6s minimum delay, single concurrent request');
console.log('  • Bon Appétit: 3s minimum delay, 2 concurrent requests\n');
