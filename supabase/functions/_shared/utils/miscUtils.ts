/*
 * Converts various input types to an array of strings.
 * Handles string (comma-separated), array, or null/undefined inputs.
 */
export function toListOfStrings(
  input: string | string[] | null | undefined
): string[] {
  if (!input) return [];
  if (Array.isArray(input)) return input.filter(Boolean) as string[];
  if (typeof input === 'string') return input.split(',').map(s => s.trim()).filter(Boolean);
  return [];
}

/*
 * Safely converts any input to a string or empty string.
 */
export function toStringOrEmpty(input: unknown): string {
  if (input === null || input === undefined) return '';
  if (typeof input === 'string') return input;
  return String(input);
}

/*
 * Calculates an effort level (1-5) based on recipe metrics.
 */
export function calculateEffortLevel(
  totalTimeMinutes: number,
  ingredientCount: number,
  instructionStepCount: number
): number {
  let score = 1; // Base score
  
  // Time component (up to 3 points)
  if (totalTimeMinutes) {
    if (totalTimeMinutes > 120) score += 2;
    else if (totalTimeMinutes > 60) score += 1;
  }
  
  // Ingredient count component (up to 1 point)
  if (ingredientCount > 15) score += 1;
  
  // Instruction steps component (up to 1 point)
  if (instructionStepCount > 10) score += 1;
  
  // Ensure score is between 1 and 5
  return Math.min(Math.max(score, 1), 5);
}
