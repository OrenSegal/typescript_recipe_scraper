/**
 * Ingredient Validation Module
 *
 * Handles ingredient text validation
 * Single Responsibility: Validate ingredient strings
 */

/**
 * Check if text represents a valid ingredient
 * @param text - Text to validate
 * @returns True if valid ingredient, false otherwise
 */
export function isValidIngredient(text: string): boolean {
  if (!text || typeof text !== 'string') return false;

  const cleaned = text.trim().toLowerCase();

  // Must have minimum length
  if (cleaned.length < 2) return false;

  // Invalid patterns (noise, metadata, non-ingredients)
  const invalidPatterns = [
    /^(for|to|the|and|or|in|on|at|by|with)\s/i, // Common prepositions/conjunctions
    /^(step|note|tip|optional|garnish)\s/i, // Recipe instructions
    /^(serves?|yield|makes?|prep|cook)\s/i, // Recipe metadata
    /^https?:\/\//i, // URLs
    /^[0-9\s°F°C-]+$/i, // Just numbers and temperature symbols
    /^[\s.,;:!?-]+$/, // Just punctuation
  ];

  for (const pattern of invalidPatterns) {
    if (pattern.test(cleaned)) {
      return false;
    }
  }

  // Must contain at least one letter
  if (!/[a-z]/i.test(cleaned)) {
    return false;
  }

  // Suspiciously long (likely a sentence or instruction)
  if (cleaned.length > 200) {
    return false;
  }

  return true;
}

/**
 * Validate ingredient has required fields
 * @param ingredient - Ingredient object to validate
 * @returns True if valid, false otherwise
 */
export function hasRequiredFields(ingredient: any): boolean {
  if (!ingredient || typeof ingredient !== 'object') return false;

  // Must have a name
  if (!ingredient.name || typeof ingredient.name !== 'string') return false;
  if (ingredient.name.trim().length === 0) return false;

  return true;
}

/**
 * Check if quantity is valid
 * @param quantity - Quantity to check
 * @returns True if valid, false otherwise
 */
export function isValidQuantity(quantity: any): boolean {
  if (quantity === null || quantity === undefined) return true; // Optional

  // Can be number or array of numbers
  if (typeof quantity === 'number') {
    return isFinite(quantity) && quantity > 0;
  }

  if (Array.isArray(quantity)) {
    return quantity.length > 0 && quantity.every(q =>
      typeof q === 'number' && isFinite(q) && q > 0
    );
  }

  return false;
}
