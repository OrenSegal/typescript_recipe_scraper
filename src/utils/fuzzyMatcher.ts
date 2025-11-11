/**
 * Advanced Fuzzy Matching for Recipe Names
 * Uses Levenshtein distance, phonetic matching, and synonym database
 */

/**
 * Calculate Levenshtein distance between two strings
 * Returns the minimum number of single-character edits needed to transform str1 into str2
 */
export function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;

  // Create a 2D array for dynamic programming
  const matrix: number[][] = Array(len1 + 1)
    .fill(null)
    .map(() => Array(len2 + 1).fill(0));

  // Initialize first column and row
  for (let i = 0; i <= len1; i++) {
    matrix[i][0] = i;
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  // Fill the matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;

      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return matrix[len1][len2];
}

/**
 * Calculate similarity score (0-1) based on Levenshtein distance
 * 1 = identical, 0 = completely different
 */
export function similarityScore(str1: string, str2: string): number {
  const distance = levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
  const maxLen = Math.max(str1.length, str2.length);

  if (maxLen === 0) return 1;

  return 1 - distance / maxLen;
}

/**
 * Soundex algorithm for phonetic matching
 * Converts words to phonetic codes for matching similar-sounding words
 */
export function soundex(word: string): string {
  if (!word) return '';

  word = word.toUpperCase();
  const firstLetter = word[0];

  // Mapping of letters to codes
  const codes: Record<string, string> = {
    B: '1', F: '1', P: '1', V: '1',
    C: '2', G: '2', J: '2', K: '2', Q: '2', S: '2', X: '2', Z: '2',
    D: '3', T: '3',
    L: '4',
    M: '5', N: '5',
    R: '6'
  };

  // Convert to soundex code
  let code = firstLetter;
  let prevCode = codes[firstLetter] || '0';

  for (let i = 1; i < word.length && code.length < 4; i++) {
    const letter = word[i];
    const currentCode = codes[letter] || '0';

    // Skip vowels and duplicates
    if (currentCode !== '0' && currentCode !== prevCode) {
      code += currentCode;
      prevCode = currentCode;
    } else if (currentCode !== '0') {
      prevCode = currentCode;
    }
  }

  // Pad with zeros
  return (code + '000').substring(0, 4);
}

/**
 * Check if two words sound similar using soundex
 */
export function soundsSimilar(word1: string, word2: string): boolean {
  return soundex(word1) === soundex(word2);
}

/**
 * Find best matching string from a list of candidates
 */
export function findBestMatch(
  target: string,
  candidates: string[],
  threshold: number = 0.6
): { match: string; score: number } | null {
  let bestMatch: string | null = null;
  let bestScore = 0;

  const normalizedTarget = target.toLowerCase().trim();

  for (const candidate of candidates) {
    const normalizedCandidate = candidate.toLowerCase().trim();

    // Calculate similarity score
    const score = similarityScore(normalizedTarget, normalizedCandidate);

    // Boost score if words sound similar
    const targetWords = normalizedTarget.split(' ');
    const candidateWords = normalizedCandidate.split(' ');
    const phoneticMatches = targetWords.filter(tw =>
      candidateWords.some(cw => soundsSimilar(tw, cw))
    ).length;
    const phoneticBoost = phoneticMatches / Math.max(targetWords.length, candidateWords.length) * 0.2;

    const finalScore = Math.min(score + phoneticBoost, 1);

    if (finalScore > bestScore && finalScore >= threshold) {
      bestScore = finalScore;
      bestMatch = candidate;
    }
  }

  return bestMatch ? { match: bestMatch, score: bestScore } : null;
}

/**
 * Spell-check a recipe name against known recipes
 * Returns corrected name if close match found
 */
export function spellCheckRecipeName(
  recipeName: string,
  knownRecipes: string[],
  threshold: number = 0.75
): { corrected: string; confidence: number } | null {
  const result = findBestMatch(recipeName, knownRecipes, threshold);

  if (!result) return null;

  return {
    corrected: result.match,
    confidence: result.score
  };
}

/**
 * Check if a recipe name is a close match (handles typos)
 */
export function isCloseMatch(name1: string, name2: string, threshold: number = 0.7): boolean {
  const score = similarityScore(name1, name2);

  // Also check phonetic similarity
  const words1 = name1.toLowerCase().split(' ');
  const words2 = name2.toLowerCase().split(' ');
  const phoneticMatch = words1.some(w1 => words2.some(w2 => soundsSimilar(w1, w2)));

  return score >= threshold || (score >= 0.5 && phoneticMatch);
}

/**
 * Normalize recipe name for better matching
 * Removes common descriptors and punctuation
 */
export function normalizeRecipeName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    // Remove common descriptors
    .replace(/\b(best|perfect|easy|simple|quick|homemade|classic|authentic|traditional)\b/gi, '')
    // Remove "recipe" word
    .replace(/\b(recipe|recipes)\b/gi, '')
    // Remove special characters
    .replace(/[^a-z0-9\s-]/g, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();
}
