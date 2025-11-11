/**
 * Shared types for recipe scrapers
 */

import type { RawScrapedRecipe } from '../shared/types.js';

// Re-export for convenience
export type { RawScrapedRecipe };

export interface ScraperResult {
  recipe: RawScrapedRecipe;
  method: string;
  confidence: number;
  processingTime: number;
  errors?: string[];
}
