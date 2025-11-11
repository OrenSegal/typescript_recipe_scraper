#!/usr/bin/env npx tsx

/**
 * Reset blocked sites to give them a fresh chance with improved rate limiting
 */

import ErrorTracker from './src/utils/errorTracker.js';

const errorTracker = ErrorTracker.getInstance();

console.log('🔄 Resetting blocked sites...\n');

// Get current blocked domains
const blocked = errorTracker.getBlockedDomains();
console.log(`Currently blocked domains: ${blocked.length}`);
blocked.forEach(domain => {
  console.log(`  • ${domain}`);
});

// Reset all error tracking
errorTracker.resetAll();

console.log('\n✅ All site statistics reset!');
console.log('🎯 Sites will be retried with improved rate limiting\n');
