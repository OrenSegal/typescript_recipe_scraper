import type { Recipe as SharedRecipe } from './models.js';
import type { Recipe as DbRecipe } from './models.js';

/*
 * Maps a shared Recipe type to the database Recipe type
 */
export function mapToDbRecipe(sharedRecipe: SharedRecipe): DbRecipe {
  return {
    ...sharedRecipe,
    sourceUrl: sharedRecipe.sourceUrl, // Map source_url to sourceUrl
    // Add any other necessary field mappings here
    // For example, if there are other field name differences or required fields
    // that need transformation
  } as unknown as DbRecipe; // Type assertion as a last resort if types are incompatible
}

/*
 * Maps a database Recipe type to the shared Recipe type
 */
export function mapToSharedRecipe(dbRecipe: DbRecipe): SharedRecipe {
  return {
    ...dbRecipe,
    source_url: dbRecipe.sourceUrl, // Map sourceUrl back to source_url
    // Add any other necessary field mappings here
  } as unknown as SharedRecipe; // Type assertion as a last resort if types are incompatible
}
