/*
 * Text Sanitizer for removing symbols and cleaning ingredient/recipe text
 */
export class TextSanitizer {
  
  // Common trademark and special symbols to remove
  private static readonly SYMBOLS_TO_REMOVE = [
    '®', '™', '©', '℠', // Trademark symbols
    '°', '∞', '‰', '§', // Special symbols
    '…', '•', '◦', '▪', '▫', // Bullet points and ellipsis
    '"', '"', "'", // Smart quotes
    '–', '—', // Em/en dashes
    '¼', '½', '¾', '⅓', '⅔', '⅛', '⅜', '⅝', '⅞', // Fractions (will convert to text)
    '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹', '⁰', // Superscripts
    '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉', '₀', // Subscripts
  ];

  // Fraction replacements
  private static readonly FRACTION_REPLACEMENTS: Record<string, string> = {
    '¼': '1/4',
    '½': '1/2', 
    '¾': '3/4',
    '⅓': '1/3',
    '⅔': '2/3',
    '⅛': '1/8',
    '⅜': '3/8',
    '⅝': '5/8',
    '⅞': '7/8',
    '⅕': '1/5',
    '⅖': '2/5',
    '⅗': '3/5',
    '⅘': '4/5',
    '⅙': '1/6',
    '⅚': '5/6'
  };

  // Superscript replacements
  private static readonly SUPERSCRIPT_REPLACEMENTS: Record<string, string> = {
    '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5',
    '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁰': '0'
  };

  /*
   * Clean ingredient name/text by removing symbols and normalizing
   */
  static cleanIngredientText(text: string): string {
    if (!text) return '';

    let cleaned = text;

    // Replace fractions with text equivalents
    for (const [symbol, replacement] of Object.entries(this.FRACTION_REPLACEMENTS)) {
      cleaned = cleaned.replace(new RegExp(symbol, 'g'), replacement);
    }

    // Replace superscripts with regular numbers
    for (const [symbol, replacement] of Object.entries(this.SUPERSCRIPT_REPLACEMENTS)) {
      cleaned = cleaned.replace(new RegExp(symbol, 'g'), replacement);
    }

    // Remove trademark and special symbols
    for (const symbol of this.SYMBOLS_TO_REMOVE) {
      cleaned = cleaned.replace(new RegExp(symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '');
    }

    // Clean up common brand indicators
    cleaned = cleaned
      .replace(/\b(brand|®|™)\b/gi, '') // Remove brand indicators
      .replace(/\s+/g, ' ') // Normalize spaces
      .replace(/^\s+|\s+$/g, '') // Trim
      .replace(/\s*,\s*$/, '') // Remove trailing commas
      .replace(/\s*-\s*$/, ''); // Remove trailing dashes

    return cleaned;
  }

  /*
   * Clean recipe title by removing symbols and normalizing
   */
  static cleanRecipeTitle(title: string): string {
    if (!title) return '';

    let cleaned = title;

    // Replace fractions in titles
    for (const [symbol, replacement] of Object.entries(this.FRACTION_REPLACEMENTS)) {
      cleaned = cleaned.replace(new RegExp(symbol, 'g'), replacement);
    }

    // Remove trademark symbols from titles
    const titleSymbolsToRemove = ['®', '™', '©', '℠'];
    for (const symbol of titleSymbolsToRemove) {
      cleaned = cleaned.replace(new RegExp(symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '');
    }

    // Convert smart quotes to regular quotes
    cleaned = cleaned
      .replace(/[""]/g, '"')
      .replace(/['']/g, "'")
      .replace(/–/g, '-')
      .replace(/—/g, '-')
      .replace(/\s+/g, ' ')
      .trim();

    return cleaned;
  }

  /*
   * Clean instruction text while preserving important symbols like degrees
   */
  static cleanInstructionText(instruction: string): string {
    if (!instruction) return '';

    let cleaned = instruction;

    // Replace fractions with text equivalents (important for measurements)
    for (const [symbol, replacement] of Object.entries(this.FRACTION_REPLACEMENTS)) {
      cleaned = cleaned.replace(new RegExp(symbol, 'g'), replacement);
    }

    // Replace superscripts with regular numbers
    for (const [symbol, replacement] of Object.entries(this.SUPERSCRIPT_REPLACEMENTS)) {
      cleaned = cleaned.replace(new RegExp(symbol, 'g'), replacement);
    }

    // Remove trademark symbols but keep degree symbols for temperature
    const instructionSymbolsToRemove = ['®', '™', '©', '℠'];
    for (const symbol of instructionSymbolsToRemove) {
      cleaned = cleaned.replace(new RegExp(symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '');
    }

    // Convert smart quotes to regular quotes
    cleaned = cleaned
      .replace(/[""]/g, '"')
      .replace(/['']/g, "'")
      .replace(/–/g, '-')
      .replace(/—/g, '-')
      .replace(/\s+/g, ' ')
      .trim();

    return cleaned;
  }

  /*
   * Clean description text
   */
  static cleanDescriptionText(description: string): string {
    if (!description) return '';

    return this.cleanRecipeTitle(description); // Similar cleaning as title
  }

  /*
   * Remove HTML entities and decode common ones
   */
  static decodeHtmlEntities(text: string): string {
    if (!text) return '';

    const htmlEntities: Record<string, string> = {
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&apos;': "'",
      '&#39;': "'",
      '&nbsp;': ' ',
      '&copy;': '©',
      '&reg;': '®',
      '&trade;': '™',
      '&deg;': '°',
      '&frac14;': '¼',
      '&frac12;': '½',
      '&frac34;': '¾'
    };

    let decoded = text;
    for (const [entity, replacement] of Object.entries(htmlEntities)) {
      decoded = decoded.replace(new RegExp(entity, 'gi'), replacement);
    }

    // Handle numeric HTML entities
    decoded = decoded.replace(/&#(\d+);/g, (match, num) => {
      return String.fromCharCode(parseInt(num, 10));
    });

    // Handle hex HTML entities
    decoded = decoded.replace(/&#x([0-9a-f]+);/gi, (match, hex) => {
      return String.fromCharCode(parseInt(hex, 16));
    });

    return decoded;
  }

  /*
   * Full sanitization pipeline for any recipe text
   */
  static sanitizeRecipeText(text: string, type: 'ingredient' | 'title' | 'instruction' | 'description' = 'ingredient'): string {
    if (!text) return '';

    // First decode HTML entities
    let sanitized = this.decodeHtmlEntities(text);

    // Apply specific cleaning based on type
    switch (type) {
      case 'ingredient':
        sanitized = this.cleanIngredientText(sanitized);
        break;
      case 'title':
        sanitized = this.cleanRecipeTitle(sanitized);
        break;
      case 'instruction':
        sanitized = this.cleanInstructionText(sanitized);
        break;
      case 'description':
        sanitized = this.cleanDescriptionText(sanitized);
        break;
    }

    return sanitized;
  }
}

/*
 * Example usage:
 * 
 * const ingredientText = "McCormick® Gourmet™ Organic Basil Leaves";
 * const cleaned = TextSanitizer.cleanIngredientText(ingredientText);
 * // Result: "McCormick Gourmet Organic Basil Leaves"
 * 
 * const titleText = "Easy ¼ Cup Chocolate Chip Cookies™";
 * const cleanTitle = TextSanitizer.cleanRecipeTitle(titleText);
 * // Result: "Easy 1/4 Cup Chocolate Chip Cookies"
 */
