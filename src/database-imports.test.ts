import { describe, it, expect, vi } from 'vitest';
import { processAndSaveRecipe } from './database.js';
import { ComprehensiveEnrichment } from './enrichment/comprehensiveEnrichment.js';
import { createClient } from '@supabase/supabase-js';
import { RawScrapedRecipe } from './scrapers/websiteScraper.js';

describe('Database Imports Test', () => {
  it('should import modules successfully', () => {
    expect(typeof processAndSaveRecipe).toBe('function');
    expect(typeof ComprehensiveEnrichment).toBe('function');
    expect(typeof createClient).toBe('function');
  });
});
