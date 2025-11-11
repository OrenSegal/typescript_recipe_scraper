import { parseIngredient as parse } from 'parse-ingredient';
import Qty from 'js-quantities';
import { ingredientMatcher } from './comprehensiveIngredientDatabase.js';
// Import NLP libraries for scalable ingredient name extraction
import nlp from 'compromise';
// Density look-up table (g/mL). Essential for converting volume to weight.
const DENSITY_MAP = {
    'flour': 0.53, 'all-purpose flour': 0.53, 'bread flour': 0.53, 'whole wheat flour': 0.53,
    'sugar': 0.84, 'granulated sugar': 0.84, 'brown sugar': 0.93, 'powdered sugar': 0.56,
    'butter': 0.91,
    'water': 1.0, 'milk': 1.03, 'oil': 0.92, 'vegetable oil': 0.92, 'olive oil': 0.92,
    'salt': 1.2, 'baking soda': 0.69, 'baking powder': 0.69,
    'egg': 0.98,
};
// Enhanced ingredient category mapping
const CATEGORY_MAPPING = {
    // Proteins
    'chicken': 'Poultry', 'turkey': 'Poultry', 'duck': 'Poultry',
    'beef': 'Meat', 'pork': 'Meat', 'lamb': 'Meat', 'veal': 'Meat',
    'salmon': 'Seafood', 'tuna': 'Seafood', 'shrimp': 'Seafood', 'fish': 'Seafood',
    // Dairy
    'milk': 'Dairy', 'cheese': 'Dairy', 'butter': 'Dairy', 'cream': 'Dairy', 'yogurt': 'Dairy',
    // Vegetables
    'onion': 'Vegetables', 'garlic': 'Vegetables', 'tomato': 'Vegetables', 'carrot': 'Vegetables',
    'celery': 'Vegetables', 'bell pepper': 'Vegetables', 'mushroom': 'Vegetables',
    'zucchini': 'Vegetables', 'squash': 'Vegetables', 'cucumber': 'Vegetables', 'lettuce': 'Vegetables',
    'spinach': 'Vegetables', 'kale': 'Vegetables', 'broccoli': 'Vegetables', 'cauliflower': 'Vegetables',
    // Fruits
    'apple': 'Fruits', 'lemon': 'Fruits', 'lime': 'Fruits', 'orange': 'Fruits',
    'banana': 'Fruits', 'strawberry': 'Fruits', 'blueberry': 'Fruits', 'raspberry': 'Fruits',
    // Pantry staples
    'flour': 'Pantry Staples', 'sugar': 'Pantry Staples', 'salt': 'Pantry Staples',
    'oil': 'Pantry Staples', 'vinegar': 'Pantry Staples', 'stock': 'Pantry Staples',
    'broth': 'Pantry Staples', 'wine': 'Pantry Staples', 'honey': 'Pantry Staples',
    'maple syrup': 'Pantry Staples', 'vanilla': 'Pantry Staples', 'baking soda': 'Pantry Staples',
    // Herbs & Spices
    'basil': 'Herbs & Spices', 'oregano': 'Herbs & Spices', 'thyme': 'Herbs & Spices',
    'rosemary': 'Herbs & Spices', 'parsley': 'Herbs & Spices', 'cilantro': 'Herbs & Spices',
    'pepper': 'Herbs & Spices', 'paprika': 'Herbs & Spices', 'cumin': 'Herbs & Spices',
    'aleppo pepper': 'Herbs & Spices', 'red pepper flakes': 'Herbs & Spices', 'chili flakes': 'Herbs & Spices',
    'cayenne': 'Herbs & Spices', 'chili powder': 'Herbs & Spices', 'garlic powder': 'Herbs & Spices',
};
function getGrams(quantity, unit, ingredient) {
    if (quantity === null || unit === null)
        return null;
    // Handle quantity arrays by using the first value (robust type handling)
    const quantityValue = Array.isArray(quantity) ? quantity[0] : quantity;
    // Type guard to ensure we have a valid number
    if (typeof quantityValue !== 'number' || !isFinite(quantityValue) || quantityValue <= 0) {
        return null;
    }
    try {
        const qty = Qty(quantityValue, unit);
        if (qty.kind() === 'mass') {
            return qty.to('g').scalar;
        }
        if (qty.kind() === 'volume') {
            const density = DENSITY_MAP[ingredient.toLowerCase()];
            return density ? qty.to('ml').scalar * density : null;
        }
        return null;
    }
    catch (e) {
        if (ingredient.toLowerCase().includes('egg') && typeof quantity === 'number')
            return quantity * 50; // Approx. 50g per large egg
        return null;
    }
}
/*
 * Determine ingredient category using comprehensive database
 */
function categorizeIngredient(cleanName) {
    const lowerName = cleanName.toLowerCase();
    // Priority categorization for specific ingredients that need precise classification
    const priorityCategories = {
        // Beverages
        'wine': 'Beverages',
        'white wine': 'Beverages',
        'red wine': 'Beverages',
        'beer': 'Beverages',
        'champagne': 'Beverages',
        // Baking Essentials
        'all-purpose flour': 'Baking Essentials',
        'bread flour': 'Baking Essentials',
        'cake flour': 'Baking Essentials',
        'self-rising flour': 'Baking Essentials',
        'baking powder': 'Baking Essentials',
        'baking soda': 'Baking Essentials',
        'vanilla extract': 'Baking Essentials'
    };
    // Check priority categories first
    for (const [ingredient, category] of Object.entries(priorityCategories)) {
        if (lowerName === ingredient || lowerName.includes(ingredient)) {
            return category;
        }
    }
    // First check local mapping for priority ingredients (highest accuracy)
    for (const [key, categoryName] of Object.entries(CATEGORY_MAPPING)) {
        if (lowerName.includes(key)) {
            return categoryName;
        }
    }
    // Then try the comprehensive database
    const category = ingredientMatcher.getCategory(cleanName);
    if (category !== 'Other') {
        return category;
    }
    // Fallback categorization based on common patterns
    if (lowerName.includes('flour') || lowerName.includes('sugar') ||
        lowerName.includes('salt') || lowerName.includes('oil')) {
        return 'Pantry Staples';
    }
    if (lowerName.includes('herb') || lowerName.includes('spice') ||
        lowerName.includes('seasoning')) {
        return 'Herbs & Spices';
    }
    return 'Other';
}
/*
 * Ensure category is a valid IngredientCategory type
 */
function validateCategory(category) {
    const validCategories = [
        'Pantry Staples', 'Meat', 'Poultry', 'Seafood', 'Dairy', 'Vegetables',
        'Fruits', 'Herbs & Spices', 'Grains & Cereals', 'Legumes', 'Nuts & Seeds',
        'Oils & Fats', 'Condiments & Sauces', 'Beverages', 'Baking Essentials',
        'Frozen Foods', 'Canned Goods', 'Other'
    ];
    return validCategories.includes(category) ? category : 'Other';
}
/*
 * Extract comprehensive notes from the original ingredient text
 * Captures ALL descriptive information including comma-separated descriptions
 */
function extractNotes(originalText, cleanName) {
    const notes = [];
    // First, remove gram parentheticals to avoid including them in notes
    const textWithoutGrams = removeGramParentheticals(originalText);
    // COMPREHENSIVE: Extract everything after the main ingredient name that appears after commas
    // This captures phrases like "seeds removed and cut into chunks", "cut in half", etc.
    const commaBasedDescriptions = extractCommaBasedDescriptions(textWithoutGrams, cleanName);
    if (commaBasedDescriptions.length > 0) {
        notes.push(...commaBasedDescriptions);
    }
    // Extract parenthetical descriptions (but not pure measurements)
    const parentheticalDescriptions = extractParentheticalDescriptions(originalText);
    if (parentheticalDescriptions.length > 0) {
        notes.push(...parentheticalDescriptions);
    }
    // Extract conditional phrases like "if needed", "as needed", "optional"
    const conditionalMatch = originalText.match(/\b(if needed|as needed|optional|to taste)\b/i);
    if (conditionalMatch) {
        notes.push(conditionalMatch[1].toLowerCase());
    }
    // Extract "or" alternatives (like "homemade or store-bought")
    const orAlternatives = extractOrAlternatives(originalText, cleanName);
    if (orAlternatives.length > 0) {
        notes.push(...orAlternatives);
    }
    // Extract brand references from "such as" phrases
    const brandMatch = originalText.match(/,?\s*such as ([^,)]+)/i);
    if (brandMatch) {
        notes.push(`such as ${brandMatch[1].trim()}`);
    }
    // Extract preparation methods and descriptors (prioritize longer/more specific terms)
    const preparations = extractPreparationMethods(originalText, cleanName);
    if (preparations.length > 0) {
        notes.push(...preparations);
    }
    // Extract quality descriptors that aren't part of the ingredient name
    const qualities = extractQualityDescriptors(originalText, cleanName);
    if (qualities.length > 0) {
        notes.push(...qualities);
    }
    // Remove duplicates, clean up, and return
    const uniqueNotes = [...new Set(notes)]
        .map(note => note.trim())
        .filter(note => note.length > 0)
        .filter(note => !note.startsWith(', ')) // Remove leading commas
        .map(note => note.replace(/^, /, '')); // Clean any remaining leading commas
    return uniqueNotes.length > 0 ? uniqueNotes.join(', ') : null;
}
/*
 * Extract comma-based descriptions - the main source of missing descriptive info
 * Examples: "1 red pepper, seeds removed and cut into chunks" -> "seeds removed and cut into chunks"
 */
function extractCommaBasedDescriptions(text, cleanName) {
    const descriptions = [];
    // Find the position where the clean ingredient name ends
    const lowerText = text.toLowerCase();
    const lowerCleanName = cleanName.toLowerCase();
    // Look for the clean name in the text and extract everything after it that follows a comma
    const cleanNameIndex = lowerText.indexOf(lowerCleanName);
    if (cleanNameIndex !== -1) {
        const afterCleanName = text.substring(cleanNameIndex + cleanName.length);
        // Extract comma-separated descriptions
        const commaMatch = afterCleanName.match(/^[^,]*,\s*(.+?)(?:\s*\([^)]*\))?$/i);
        if (commaMatch) {
            const description = commaMatch[1].trim();
            if (description && description.length > 2) {
                descriptions.push(description);
            }
        }
    }
    // Alternative approach: Split by commas and extract non-ingredient parts
    const parts = text.split(',').map(part => part.trim());
    if (parts.length > 1) {
        for (let i = 1; i < parts.length; i++) {
            const part = parts[i];
            // Skip if it's just measurements or parentheticals
            if (!part.match(/^\s*\([^)]*\)\s*$/) &&
                !part.match(/^\s*\d+/) &&
                part.length > 2) {
                // Check if this part contains descriptive information
                if (part.match(/\b(seeds?|removed?|cut|chopped|diced|sliced|peeled|half|halves|chunks?|pieces?)\b/i)) {
                    descriptions.push(part.trim());
                }
            }
        }
    }
    return descriptions;
}
/*
 * Extract parenthetical descriptions (excluding pure measurements)
 */
function extractParentheticalDescriptions(text) {
    const descriptions = [];
    // Extract weight/measurement descriptors in parentheses (excluding pure gram/ml notations)
    const measurementMatch = text.match(/\(([^)]*(?:ounce|oz|lb|pound|about|approximately)[^)]*)\)/i);
    if (measurementMatch) {
        const measurement = measurementMatch[1].replace(/;/g, ',').trim();
        descriptions.push(measurement);
    }
    return descriptions;
}
/*
 * Extract "or" alternatives
 */
function extractOrAlternatives(text, cleanName) {
    const alternatives = [];
    const orMatch = text.match(/\b(\w+(?:\s+\w+)*)\s+or\s+(\w+(?:\s+\w+)*)\b/i);
    if (orMatch) {
        const alternative = `${orMatch[1]} or ${orMatch[2]}`;
        // Only include if it's not part of the main ingredient name
        if (!cleanName.toLowerCase().includes(alternative.toLowerCase())) {
            alternatives.push(alternative.toLowerCase());
        }
    }
    return alternatives;
}
/*
 * Extract preparation methods
 */
function extractPreparationMethods(text, cleanName) {
    const preparations = ['finely minced', 'finely diced', 'finely chopped', 'finely grated',
        'roughly chopped', 'coarsely chopped', 'thinly sliced', 'thickly sliced',
        'seeds removed', 'cut into chunks', 'cut in half', 'cut into pieces',
        'minced', 'diced', 'chopped', 'sliced', 'grated', 'peeled',
        'crushed', 'ground', 'shredded', 'julienned', 'divided', 'torn'];
    const foundPreparations = [];
    const lowerText = text.toLowerCase();
    const lowerCleanName = cleanName.toLowerCase();
    // Find all matching preparations, prioritizing longer/more specific terms
    for (const prep of preparations) {
        if (lowerText.includes(prep) && !lowerCleanName.includes(prep)) {
            // Check if this is a subset of an already found preparation
            const isSubset = foundPreparations.some(found => found.includes(prep) && found !== prep);
            if (!isSubset) {
                // Remove any existing preparations that are subsets of this one
                const filteredPreps = foundPreparations.filter(found => !prep.includes(found) || found === prep);
                foundPreparations.length = 0;
                foundPreparations.push(...filteredPreps, prep);
            }
        }
    }
    return [...new Set(foundPreparations)];
}
/*
 * Extract quality descriptors
 */
function extractQualityDescriptors(text, cleanName) {
    const qualityDescriptors = ['large', 'medium', 'small', 'extra-large', 'jumbo', 'mini', 'tiny',
        'white', 'red', 'green', 'yellow', 'black', 'dry', 'sweet',
        'fresh', 'frozen', 'canned', 'organic', 'raw', 'cooked', 'smoked',
        'salted', 'unsalted', 'whole', 'skim', 'low-fat', 'fat-free',
        'extra-virgin', 'powdered', 'ground', 'crushed', 'dried', 'dehydrated',
        'instant', 'homemade', 'store-bought', 'low-sodium'];
    const foundQualities = [];
    for (const quality of qualityDescriptors) {
        // Use word boundary matching to avoid substring false positives
        const wordBoundaryRegex = new RegExp(`\\b${quality}\\b`, 'i');
        if (wordBoundaryRegex.test(text) &&
            !wordBoundaryRegex.test(cleanName)) {
            foundQualities.push(quality);
        }
    }
    return foundQualities;
}
/*
 * Enhanced ingredient processing using robust parsing
 * @param rawIngredient - An object containing the raw ingredient string
 * @returns A structured RecipeIngredient object in the exact format specified
 */
/*
 * Validate if ingredient text is actually a valid ingredient
 */
function isValidIngredient(text) {
    if (!text || text.trim().length === 0)
        return false;
    const trimmed = text.trim();
    // Filter out single letters or very short nonsensical entries
    if (trimmed.length <= 2 && !trimmed.match(/^(oz|lb|ml|qt|pt|tsp|cup|bay)$/i)) {
        return false;
    }
    // Enhanced pattern filtering for 100% quality
    const invalidPatterns = [
        /^[A-Z]{1,3}$/, // Single letters: "MP", "Q", "V", "W"
        /^[a-z]{1,2}$/, // Single lowercase letters: "a", "m", "x" 
        /^\d+$/, // Pure numbers: "1", "42"
        /^[\s\-\.\,\;\:]+$/, // Just punctuation/whitespace
        /^[\(\)\[\]\{\}]+$/, // Just brackets/parentheses
        /^(and|or|with|plus|also|see|note|tips?|add|use)$/i,
        /^(step|method|recipe|cooking|preparation|instructions?)$/i,
        /^(serves?|servings?|yield|makes?)$/i,
        /^(minutes?|hours?|mins?|hrs?|time|cook|prep)$/i,
        /^(degrees?|°|f|c|fahrenheit|celsius)$/i,
        /^(page|pages?|recipe|ingredients?)$/i,
        /^(kitchen|equipment|tools?)$/i,
        /^[\*\#\@\%\&]+$/, // Special characters only
        /^(www|http|https|com|org|net)\.?/i, // URL fragments
        /^(copyright|©|®|™|all|rights|reserved)$/i
    ];
    // Check invalid patterns
    for (const pattern of invalidPatterns) {
        if (pattern.test(trimmed)) {
            return false;
        }
    }
    // Additional quality checks
    // Must contain at least one alphabetic character
    if (!/[a-zA-Z]/.test(trimmed)) {
        return false;
    }
    // Filter out entries that are mostly punctuation
    const alphaNumericChars = trimmed.replace(/[^a-zA-Z0-9]/g, '').length;
    const totalChars = trimmed.length;
    if (alphaNumericChars / totalChars < 0.5) {
        return false;
    }
    // Filter out entries with excessive repetition (e.g., "aaaa", "1111")
    const uniqueChars = new Set(trimmed.toLowerCase().replace(/\s/g, '')).size;
    if (trimmed.length > 3 && uniqueChars <= 2) {
        return false;
    }
    return true;
}
export async function processIngredient(rawIngredient) {
    // Handle both string and object formats
    const ingredientText = typeof rawIngredient === 'string' ? rawIngredient : rawIngredient.name;
    if (!ingredientText?.trim()) {
        return null;
    }
    // Validate ingredient before processing
    if (!isValidIngredient(ingredientText)) {
        console.log(`🚫 Filtering out invalid ingredient: "${ingredientText}"`);
        return null;
    }
    try {
        const originalText = ingredientText.trim();
        if (!originalText)
            return null;
        console.log(`🔍 Processing ingredient: "${originalText}"`);
        // Parse using the external parse-ingredient library first
        const parsed = parse(originalText);
        console.log(`📊 Parse-ingredient result:`, JSON.stringify(parsed, null, 2));
        // Advanced quantity and unit extraction with parenthetical unit prioritization
        let quantity = null; // Support both single values and ranges [min, max]
        let unit = null;
        // First, check for parenthetical units like "1 package (8 ounces)" → quantity: 8, unit: ounces
        const parentheticalUnitMatch = originalText.match(/\((\d+(?:\.\d+)?)\s*(ounces?|oz\.?|pounds?|lbs?\.?|grams?|g\.?|cups?|tablespoons?|tbsp\.?|teaspoons?|tsp\.?)\)/i);
        if (parentheticalUnitMatch) {
            quantity = parseFloat(parentheticalUnitMatch[1]);
            unit = parentheticalUnitMatch[2].replace(/\.$/, ''); // Remove trailing period
            console.log(`🎯 Found parenthetical unit: quantity=${quantity}, unit=${unit}`);
        }
        else {
            // Standard quantity extraction - handle ranges properly
            const parsedItem = parsed[0]; // parse-ingredient returns an array
            if (parsedItem.quantity !== null && parsedItem.quantity !== undefined) {
                if (parsedItem.quantity2 !== null && parsedItem.quantity2 !== undefined) {
                    // Range quantity like "1/4 to 1/3" → [0.25, 0.333]
                    quantity = [parsedItem.quantity, parsedItem.quantity2]; // Type assertion for range
                    console.log(`📊 Found range quantity: [${parsedItem.quantity}, ${parsedItem.quantity2}]`);
                }
                else {
                    // Single quantity
                    quantity = Array.isArray(parsedItem.quantity) ? parsedItem.quantity[0] : parsedItem.quantity;
                }
            }
            // If no quantity from parser, extract manually with improved regex
            if (quantity === null) {
                // Handle fractions, decimals, and ranges like "1/2", "0.5", "1-2", etc.
                const quantityMatch = originalText.match(/^([\d\u00BC-\u00BE\u2150-\u215E\.\/\-]+)/);
                if (quantityMatch) {
                    const qStr = quantityMatch[1].trim();
                    const qNum = parseFraction(qStr);
                    if (!isNaN(qNum) && qNum > 0) {
                        quantity = qNum;
                    }
                }
            }
            // Standard unit extraction if no parenthetical unit found
            unit = parsedItem.unitOfMeasure || null;
        }
        // Unit normalization and cleanup
        if (unit) {
            unit = normalizeUnit(unit);
        }
        // Manual unit extraction for cases the parser missed (only if no unit from parenthetical)
        if (!unit) {
            unit = extractUnitFromText(originalText);
        }
        // Fix common unit extraction issues - don't use size descriptors as units
        if (unit && ['large', 'medium', 'small', 'extra', 'whole', 'half'].includes(unit.toLowerCase())) {
            unit = null;
        }
        // Extract clean name using the enhanced extraction function with lemmatization
        // For ranges, use the higher value for pluralization logic
        const quantityForLemmatization = Array.isArray(quantity) ? quantity[1] : quantity;
        const parsedDescription = parsed.length > 0 ? parsed[0].description : null;
        const cleanName = extractCoreIngredientWithLemmatization(parsedDescription || originalText, quantityForLemmatization);
        // Categorize ingredient using comprehensive database
        const rawCategory = categorizeIngredient(cleanName);
        const category = validateCategory(rawCategory);
        // Extract notes (descriptors, preparation methods)
        const notes = extractNotes(originalText, cleanName);
        // Calculate grams using density * unit * quantity formula
        let grams = null;
        if (quantity && unit) {
            const density = getIngredientDensity(cleanName);
            try {
                const qty = Qty(`${quantity} ${unit}`);
                if (qty.kind() === 'volume') {
                    // For volume units: density * volume = grams
                    const volumeInMl = qty.to('ml').scalar;
                    grams = Math.round(density * volumeInMl);
                }
                else if (qty.kind() === 'mass') {
                    // For mass units, convert directly to grams
                    grams = Math.round(qty.to('g').scalar);
                }
                else {
                    // For dimensionless units, use estimation
                    // For ranges, use the higher value for calculations
                    const quantityForCalc = Array.isArray(quantity) ? quantity[1] : quantity;
                    grams = quantityForCalc ? Math.round(density * quantityForCalc * 100) : null; // Approximate conversion
                }
            }
            catch (qtyError) {
                // Fallback calculation - handle ranges
                const quantityForCalc = Array.isArray(quantity) ? quantity[1] : quantity;
                grams = calculateGrams(quantityForCalc, unit, cleanName);
            }
        }
        // Return in the EXACT format specified by the user
        const result = {
            text: originalText, // "1 quart (1L) homemade or store-bought low-sodium chicken stock"
            name: cleanName, // "chicken stock"
            quantity: quantity, // 1
            unit: unit, // "quart"
            grams: grams, // density * unit * quantity
            category: category === 'Grains & Cereals' ? 'Grains' : category, // Normalize to canonical category names
            notes: notes // "homemade or store, homemade, store-bought, low-sodium"
        };
        console.log(`✅ Parsed ingredient in specified format:`, result);
        return result;
    }
    catch (error) {
        console.error(`❌ Error processing ingredient "${ingredientText}":`, error);
        return null;
    }
}
/*
 * Parse fraction strings like "1 1/2" or "3/4" to decimal
 */
function parseFraction(str) {
    str = str.trim();
    // Handle mixed numbers like "1 1/2"
    const mixedMatch = str.match(/^(\d+)\s+(\d+)\/(\d+)$/);
    if (mixedMatch) {
        const whole = parseInt(mixedMatch[1]);
        const num = parseInt(mixedMatch[2]);
        const den = parseInt(mixedMatch[3]);
        return whole + (num / den);
    }
    // Handle simple fractions like "3/4"
    const fractionMatch = str.match(/^(\d+)\/(\d+)$/);
    if (fractionMatch) {
        const num = parseInt(fractionMatch[1]);
        const den = parseInt(fractionMatch[2]);
        return num / den;
    }
    // Handle decimals
    const decimal = parseFloat(str);
    return isNaN(decimal) ? 0 : decimal;
}
/*
 * Remove duplicate words from ingredient name
 */
function deduplicateWords(text) {
    if (!text)
        return text;
    const words = text.trim().toLowerCase().split(/\s+/);
    const uniqueWords = [];
    const seen = new Set();
    for (const word of words) {
        if (!seen.has(word)) {
            seen.add(word);
            uniqueWords.push(word);
        }
    }
    return uniqueWords.join(' ');
}
/*
 * Scalable NLP-based ingredient name extraction
 * Uses noun/adjective analysis to separate descriptors from core ingredient names
 */
function extractCoreIngredientWithNLP(text) {
    if (!text || text.trim().length === 0) {
        return 'unknown ingredient';
    }
    let clean = text.trim();
    // Remove parenthetical notes and common phrases
    clean = clean.replace(/\([^)]*\)/g, '').trim();
    clean = clean.split(',')[0].trim();
    clean = clean.replace(/\b(if needed|as needed|optional|to taste)\b/gi, '').trim();
    clean = clean.replace(/^(a\s+)?(splash|pinch|dash|hint|touch|bit|drop|drizzle|glug|handful)\s+of\s+/i, '').trim();
    // More precise removal of quantity and unit prefixes
    // Handle patterns like "1 Tbsp.", "½ cup", "6 garlic cloves", "12 oz."
    clean = clean.replace(/^[\d\/\-\s\u00BC-\u00BE\u2150-\u215E\.]+(\s*"?\s*)?(tablespoons?|tbsp\.?|teaspoons?|tsp\.?|cups?|ounces?|oz\.?|pounds?|lbs?\.?|grams?|g\.?|kilograms?|kg\.?|liters?|l\.?|milliliters?|ml\.?|pints?|pt\.?|quarts?|qt\.?|gallons?|gal\.?|pieces?|piece|cloves?|clove|large|medium|small|whole|half)\s+/i, '').trim();
    // Remove standalone numbers, fractions, decimals, and measurements at the beginning
    clean = clean.replace(/^[\d\/\-\s\u00BC-\u00BE\u2150-\u215E\.]+"?\s*/, '').trim();
    // Remove any remaining decimal patterns like "0.5", ".75", "1.25" at start
    clean = clean.replace(/^\d*\.\d+\s+/, '').trim();
    // Remove size descriptors that might remain
    clean = clean.replace(/^(large|medium|small|whole|half)\s+/i, '').trim();
    // Use compromise.js for grammatical analysis
    const doc = nlp(clean);
    // Extract nouns and adjectives
    const nouns = doc.nouns().out('array');
    const adjectives = doc.adjectives().out('array');
    const words = clean.toLowerCase().split(/\s+/);
    // Define food-related compound terms that should stay together
    const compoundFoodTerms = [
        'black pepper', 'white pepper', 'kosher salt', 'sea salt', 'table salt',
        'olive oil', 'coconut oil', 'vegetable oil', 'canola oil',
        'whole milk', 'skim milk', 'heavy cream', 'sour cream',
        'chicken stock', 'beef stock', 'vegetable stock', 'chicken broth',
        'all-purpose flour', 'bread flour', 'whole wheat flour',
        'panko bread crumbs', 'fresh bread crumbs', 'dry bread crumbs',
        'parmesan cheese', 'mozzarella cheese', 'ricotta cheese', 'cheddar cheese',
        'parsley leaves', 'sage leaves', 'bay leaves', 'basil leaves',
        'soy sauce', 'fish sauce', 'hot sauce', 'worcestershire sauce',
        'baking powder', 'baking soda', 'vanilla extract', 'lemon juice',
        'tomato paste', 'tomato sauce', 'crushed tomatoes', 'diced tomatoes'
    ];
    // Check if the clean text contains any known compound terms
    for (const compound of compoundFoodTerms) {
        if (clean.toLowerCase().includes(compound)) {
            return compound;
        }
    }
    // Use NLP to determine essential vs. descriptive parts
    if (nouns.length > 0) {
        // If we have multiple nouns, keep compound ingredient names
        if (nouns.length >= 2) {
            // Check if this is a known food compound
            const nounPhrase = nouns.join(' ').toLowerCase();
            // Common food compound patterns
            const isFoodCompound = nounPhrase.includes('pepper') || nounPhrase.includes('salt') ||
                nounPhrase.includes('oil') || nounPhrase.includes('milk') ||
                nounPhrase.includes('cream') || nounPhrase.includes('stock') ||
                nounPhrase.includes('flour') || nounPhrase.includes('cheese') ||
                nounPhrase.includes('sauce') || nounPhrase.includes('leaves') ||
                nounPhrase.includes('crumbs') || nounPhrase.includes('powder');
            if (isFoodCompound && nouns.length <= 3) {
                const combined = nouns.join(' ');
                return deduplicateWords(combined);
            }
        }
        // For single nouns or non-compound cases, decide based on context
        const mainNoun = nouns[nouns.length - 1]; // Usually the core ingredient
        // Include essential adjectives that are part of the ingredient identity
        const essentialAdjectives = adjectives.filter(adj => {
            const adjLower = adj.toLowerCase();
            return ['black', 'white', 'kosher', 'sea', 'olive', 'whole', 'heavy',
                'fresh', 'dried', 'panko', 'all-purpose', 'extra', 'virgin'].includes(adjLower);
        });
        if (essentialAdjectives.length > 0 && essentialAdjectives.length <= 2) {
            const combined = `${essentialAdjectives.join(' ')} ${mainNoun}`.trim();
            return deduplicateWords(combined);
        }
        return mainNoun;
    }
    // Fallback: use traditional word filtering
    return extractCoreIngredientFallback(clean);
}
/*
 * Fallback method for ingredient extraction when NLP doesn't identify nouns
 */
function extractCoreIngredientFallback(text) {
    const preparationDescriptors = [
        'chopped', 'diced', 'minced', 'sliced', 'grated',
        'finely', 'coarsely', 'roughly', 'thinly', 'thickly',
        'peeled', 'seeded', 'boneless', 'skinless',
        'raw', 'cooked', 'roasted', 'grilled', 'steamed', 'boiled'
    ];
    const words = text.split(/\s+/);
    const filteredWords = words.filter(word => {
        const lowerWord = word.toLowerCase();
        return !preparationDescriptors.includes(lowerWord) &&
            word.length > 1 &&
            !/^\d/.test(word);
    });
    if (filteredWords.length === 0) {
        const fallback = text.replace(/^[\d\s\-\/]+/, '').replace(/\b(and|or|with|plus)\b/gi, '').trim();
        return fallback || 'unknown ingredient';
    }
    return filteredWords.length === 1 ? filteredWords[0] : filteredWords.join(' ');
}
/*
 * Extract the core ingredient name by removing descriptors
 * Now uses NLP-based analysis as the primary method
 */
function extractCoreIngredient(text) {
    try {
        return extractCoreIngredientWithNLP(text);
    }
    catch (error) {
        console.warn('NLP extraction failed, using fallback:', error);
        return extractCoreIngredientFallback(text);
    }
}
/*
 * Remove gram parentheticals from text to avoid duplication in notes
 * Examples: "(225g)", "(about 25g)", "(8 ounces; 225g)", "(235ml)"
 */
function removeGramParentheticals(text) {
    return text
        // Remove gram notations: (225g), (about 25g), (approximately 50g)
        .replace(/\((?:about\s+|approximately\s+)?\d+(?:\.\d+)?\s*g\)/gi, '')
        // Remove gram notations with other units: (8 ounces; 225g)
        .replace(/\([^)]*;\s*\d+(?:\.\d+)?\s*g\)/gi, '')
        // Remove ml notations: (235ml), (475ml)
        .replace(/\(\d+(?:\.\d+)?\s*ml\)/gi, '')
        // Remove ml notations with other units: (1 cup; 235ml)
        .replace(/\([^)]*;\s*\d+(?:\.\d+)?\s*ml\)/gi, '')
        // Clean up extra spaces
        .replace(/\s+/g, ' ')
        .trim();
}
/*
 * Extract explicit gram values from parenthetical notations
 * Examples: "(225g)", "(about 25g)", "(8 ounces; 225g)", "(235ml)"
 */
function extractExplicitGrams(text) {
    // Look for gram values in parentheses
    const gramMatches = [
        // Direct gram notation: (225g), (about 25g), (approximately 50g)
        /\((?:about\s+|approximately\s+)?(\d+(?:\.\d+)?)\s*g\)/i,
        // Gram notation with other units: (8 ounces; 225g), (1 cup; 235g)
        /\([^)]*;\s*(\d+(?:\.\d+)?)\s*g\)/i,
        // Standalone gram notation at end: (225g)
        /\((\d+(?:\.\d+)?)g\)$/i
    ];
    for (const pattern of gramMatches) {
        const match = text.match(pattern);
        if (match) {
            const grams = parseFloat(match[1]);
            if (!isNaN(grams)) {
                return grams;
            }
        }
    }
    // Look for milliliter values and convert to grams (assuming density ≈ 1 for liquids)
    const mlMatches = [
        // Direct ml notation: (235ml), (475ml)
        /\((\d+(?:\.\d+)?)\s*ml\)/i,
        // ml notation with other units: (1 cup; 235ml)
        /\([^)]*;\s*(\d+(?:\.\d+)?)\s*ml\)/i
    ];
    for (const pattern of mlMatches) {
        const match = text.match(pattern);
        if (match) {
            const ml = parseFloat(match[1]);
            if (!isNaN(ml)) {
                // For liquids, ml ≈ grams (density ≈ 1)
                // For wine, milk, cream, etc., this is a good approximation
                return ml;
            }
        }
    }
    return null;
}
/*
 * Get ingredient density for accurate unit-to-gram conversion
 * Based on USDA and culinary density data
 */
function getIngredientDensity(ingredient) {
    const ingredientLower = ingredient.toLowerCase();
    // Comprehensive density mapping (grams per ml)
    const densityMap = {
        // Liquids
        'water': 1.0,
        'milk': 1.03,
        'whole milk': 1.03,
        'skim milk': 1.035,
        'heavy cream': 0.994,
        'cream': 0.994,
        'wine': 0.99,
        'white wine': 0.99,
        'red wine': 0.99,
        'beer': 1.005,
        'broth': 1.0,
        'stock': 1.0,
        'chicken stock': 1.0,
        'beef stock': 1.0,
        'vegetable stock': 1.0,
        // Oils and fats
        'oil': 0.92,
        'olive oil': 0.915,
        'vegetable oil': 0.92,
        'coconut oil': 0.924,
        'butter': 0.911,
        // Vinegars and sauces
        'vinegar': 1.01,
        'soy sauce': 1.15,
        'fish sauce': 1.1,
        'worcestershire sauce': 1.12,
        // Sweeteners
        'honey': 1.42,
        'maple syrup': 1.37,
        'corn syrup': 1.48,
        'molasses': 1.4,
        // Dry ingredients (approximate when mixed with liquid)
        'flour': 0.593, // all-purpose flour
        'all-purpose flour': 0.593,
        'bread flour': 0.602,
        'cake flour': 0.514,
        'sugar': 0.845,
        'granulated sugar': 0.845,
        'brown sugar': 0.9,
        'powdered sugar': 0.56,
        'salt': 1.217,
        'baking powder': 0.9,
        'baking soda': 2.2,
        // Nuts and seeds (chopped/ground)
        'almonds': 0.64,
        'walnuts': 0.52,
        'pecans': 0.41,
        'pine nuts': 0.68,
        'sesame seeds': 0.61,
        // Grains and cereals
        'rice': 0.75,
        'quinoa': 0.85,
        'oats': 0.41,
        'breadcrumbs': 0.43,
        // Cheese (grated)
        'parmesan': 0.42,
        'parmesan cheese': 0.42,
        'cheddar': 0.45,
        'mozzarella': 0.48,
        'ricotta': 1.04,
        // Vegetables (chopped)
        'onion': 0.64,
        'onions': 0.64,
        'garlic': 0.64,
        'celery': 0.64,
        'carrots': 0.64,
        'tomatoes': 0.95,
        'bell pepper': 0.52,
        'mushrooms': 0.35,
        // Herbs and spices (fresh, chopped)
        'parsley': 0.64,
        'parsley leaves': 0.64,
        'sage': 0.64,
        'sage leaves': 0.64,
        'basil': 0.64,
        'basil leaves': 0.64,
        'cilantro': 0.64,
        'thyme': 0.64,
        'rosemary': 0.64,
        // Proteins (cooked, chopped)
        'chicken': 1.0,
        'beef': 1.0,
        'pork': 1.0,
        'fish': 1.0,
        'shrimp': 0.85,
        // Beans and legumes (cooked)
        'beans': 0.77,
        'chickpeas': 0.82,
        'lentils': 0.85,
        // Fruits
        'lemon juice': 1.02,
        'lime juice': 1.02,
        'orange juice': 1.05,
        'apple': 0.64, // chopped
        'berries': 0.65,
        // Pasta and noodles (dry)
        'pasta': 0.67,
        'noodles': 0.67,
        'spaghetti': 0.67
    };
    // Try exact match first
    if (densityMap[ingredientLower]) {
        return densityMap[ingredientLower];
    }
    // Try partial matches for compound ingredients
    for (const [key, density] of Object.entries(densityMap)) {
        if (ingredientLower.includes(key) || key.includes(ingredientLower)) {
            return density;
        }
    }
    // Default density for unknown ingredients (water-like)
    return 1.0;
}
/*
 * Calculate grams from quantity and unit with proper density conversion
 */
export function calculateGrams(quantity, unit, ingredient) {
    if (quantity === null || unit === null)
        return null;
    // Use average for ranges
    const qty = Array.isArray(quantity) ? (quantity[0] + quantity[1]) / 2 : quantity;
    // Handle non-standard units with estimated weights
    const nonStandardUnits = {
        'egg': 50, // 1 large egg ≈ 50g
        'eggs': 50,
        'clove': 3, // 1 garlic clove ≈ 3g
        'cloves': 3,
        'head': 200, // 1 head garlic ≈ 200g
        'bulb': 150, // 1 fennel bulb ≈ 150g
        'bunch': 30, // 1 bunch herbs ≈ 30g
        'sprig': 2, // 1 sprig ≈ 2g
        'sprigs': 2,
        'leaf': 1, // 1 bay leaf ≈ 1g
        'leaves': 1,
        'bay': 1,
        'handful': 80, // 1 handful ≈ 1/3 cup ≈ 80ml
        'piece': 50, // Generic piece ≈ 50g
        'pieces': 50,
        'carrot': 60, // 1 medium carrot ≈ 60g
        'carrots': 60,
        'onion': 150, // 1 medium onion ≈ 150g
        'onions': 150,
        'lemon': 60, // 1 lemon ≈ 60g
        'lemons': 60,
        'lime': 30, // 1 lime ≈ 30g
        'limes': 30,
        'rib': 10, // 1 celery rib ≈ 10g
        'ribs': 10,
        'stalk': 10, // 1 celery stalk ≈ 10g
        'stalks': 10
    };
    // Check if it's a non-standard unit
    const unitLower = unit.toLowerCase();
    if (nonStandardUnits[unitLower]) {
        return qty * nonStandardUnits[unitLower];
    }
    try {
        // Get enhanced density for the ingredient
        const density = getIngredientDensity(ingredient);
        // Convert to grams using js-quantities
        const qtyObj = Qty(`${qty} ${unit}`);
        // Convert volume to weight using density
        if (unit.match(/cups?|tbsp|tsp|ml|l|liters?|tablespoons?|teaspoons?|pints?|pt|quarts?|qt|gallons?|gal/i)) {
            // Volume units - convert to ml first, then to grams using density
            const ml = qtyObj.to('ml').scalar;
            const finalGrams = ml * density;
            return Math.round(finalGrams * 100) / 100;
        }
        else if (unit.match(/oz|lb|g|kg|grams?|kilograms?|ounces?|pounds?/i)) {
            // Weight units - convert directly to grams
            return Math.round(qtyObj.to('g').scalar * 100) / 100; // Round to 2 decimal places
        }
        return null;
    }
    catch (error) {
        // Silently return null for unrecognized units instead of logging warnings
        return null;
    }
}
/*
 * Normalize and standardize unit names for consistent parsing
 * Examples: "oz." → "ounces", "tbsp" → "tablespoons", "lbs" → "pounds"
 */
function normalizeUnit(unit) {
    if (!unit)
        return unit;
    const normalized = unit.toLowerCase().replace(/\.$/, '');
    // Unit normalization mappings
    const unitMappings = {
        // Weight units
        'oz': 'ounces',
        'lb': 'pounds',
        'lbs': 'pounds',
        'g': 'grams',
        'kg': 'kilograms',
        // Volume units
        'tbsp': 'tablespoons',
        'tsp': 'teaspoons',
        'c': 'cups',
        'pt': 'pints',
        'qt': 'quarts',
        'gal': 'gallons',
        'ml': 'milliliters',
        'l': 'liters',
        // Count units
        'clove': 'cloves',
        'leaf': 'leaves',
        'piece': 'pieces',
        'slice': 'slices',
        'strip': 'strips',
        'sprig': 'sprigs'
    };
    return unitMappings[normalized] || normalized;
}
/*
 * Extract unit from ingredient text using pattern matching
 * Handles specific ingredient patterns and common unit formats
 */
function extractUnitFromText(text) {
    const lowerText = text.toLowerCase();
    // Handle specific ingredient patterns
    if (lowerText.includes('cloves'))
        return 'cloves';
    if (lowerText.includes('bay leaf') || lowerText.includes('bay leaves'))
        return 'leaves';
    if (lowerText.includes('piece'))
        return 'pieces';
    if (lowerText.includes('slice'))
        return 'slices';
    if (lowerText.includes('sprig'))
        return 'sprigs';
    if (lowerText.includes('strip'))
        return 'strips';
    // Try to extract unit with improved pattern matching
    const unitPatterns = [
        /[\d\u00BC-\u00BE\u2150-\u215E\/\-\s]+(cups?|tbsp\.?|tsp\.?|tablespoons?|teaspoons?|oz\.?|ounces?|lbs?\.?|pounds?|grams?|g\.?)/i,
        /[\d\u00BC-\u00BE\u2150-\u215E\/\-\s]+(cloves?|leaves?|pieces?|slices?|sprigs?|strips?)/i
    ];
    for (const pattern of unitPatterns) {
        const unitMatch = text.match(pattern);
        if (unitMatch) {
            return normalizeUnit(unitMatch[1]);
        }
    }
    return null;
}
/*
 * Advanced ingredient name extraction with lemmatization and pluralization handling
 * Examples: "2 plums chopped" → "plum", "3 tomatoes diced" → "tomato"
 */
function extractCoreIngredientWithLemmatization(text, quantity) {
    if (!text || text.trim().length === 0) {
        return 'unknown ingredient';
    }
    let clean = text.trim();
    // Remove parenthetical notes and common phrases
    clean = clean.replace(/\([^)]*\)/g, '').trim();
    clean = clean.split(',')[0].trim();
    clean = clean.replace(/\b(if needed|as needed|optional|to taste)\b/gi, '').trim();
    clean = clean.replace(/^(a\s+)?(splash|pinch|dash|hint|touch|bit|drop|drizzle|glug|handful)\s+of\s+/i, '').trim();
    // Enhanced removal of quantity and unit prefixes including decimals
    clean = clean.replace(/^[\d\/\-\s\u00BC-\u00BE\u2150-\u215E\.]+\s*"?\s*(tablespoons?|tbsp\.?|teaspoons?|tsp\.?|cups?|ounces?|oz\.?|pounds?|lbs?\.?|grams?|g\.?|kilograms?|kg\.?|liters?|l\.?|milliliters?|ml\.?|pints?|pt\.?|quarts?|qt\.?|gallons?|gal\.?|pieces?|piece|cloves?|clove|large|medium|small|whole|half)\s+/i, '').trim();
    // Remove standalone numbers, fractions, decimals, and measurements
    clean = clean.replace(/^[\d\/\-\s\u00BC-\u00BE\u2150-\u215E\.]+"?\s*/, '').trim();
    clean = clean.replace(/^\d*\.\d+\s+/, '').trim();
    // Remove size descriptors that might remain
    clean = clean.replace(/^(large|medium|small|whole|half)\s+/i, '').trim();
    // Use compromise.js for grammatical analysis
    const doc = nlp(clean);
    // Extract nouns and identify potential ingredient names
    const nouns = doc.nouns().out('array');
    const words = clean.toLowerCase().split(/\s+/);
    // Enhanced compound food terms database
    const compoundFoodTerms = [
        'black pepper', 'white pepper', 'kosher salt', 'sea salt', 'table salt',
        'olive oil', 'coconut oil', 'vegetable oil', 'canola oil', 'sesame oil',
        'whole milk', 'skim milk', 'heavy cream', 'sour cream', 'cream cheese',
        'chicken stock', 'beef stock', 'vegetable stock', 'chicken broth', 'beef broth',
        'all-purpose flour', 'bread flour', 'whole wheat flour', 'cake flour',
        'panko bread crumbs', 'fresh bread crumbs', 'dry bread crumbs',
        'parmesan cheese', 'mozzarella cheese', 'ricotta cheese', 'cheddar cheese', 'feta cheese',
        'parsley leaves', 'sage leaves', 'bay leaves', 'basil leaves', 'mint leaves',
        'soy sauce', 'fish sauce', 'hot sauce', 'worcestershire sauce', 'oyster sauce',
        'baking powder', 'baking soda', 'vanilla extract', 'lemon juice', 'lime juice',
        'tomato paste', 'tomato sauce', 'crushed tomatoes', 'diced tomatoes', 'cherry tomatoes',
        'green onions', 'red onions', 'sweet onions', 'yellow onions',
        'bell peppers', 'red peppers', 'green peppers', 'jalapeño peppers'
    ];
    // Check for compound terms first
    for (const compound of compoundFoodTerms) {
        if (clean.toLowerCase().includes(compound)) {
            return compound;
        }
    }
    // Advanced lemmatization using pluralization rules
    let bestIngredient = '';
    if (nouns.length > 0) {
        // Find the most likely ingredient noun
        let ingredientNoun = nouns[0];
        // Apply lemmatization rules for common ingredient plurals
        ingredientNoun = lemmatizeIngredient(ingredientNoun, quantity);
        // Look for food-specific nouns
        const foodNouns = nouns.filter(noun => !['package', 'container', 'box', 'bag', 'can', 'jar', 'bottle'].includes(noun.toLowerCase()));
        if (foodNouns.length > 0) {
            ingredientNoun = lemmatizeIngredient(foodNouns[0], quantity);
        }
        bestIngredient = ingredientNoun;
    }
    else {
        // Fallback: Use the first significant word
        const significantWords = words.filter(word => word.length > 2 &&
            !['the', 'and', 'or', 'of', 'in', 'on', 'at', 'to', 'for', 'with'].includes(word));
        if (significantWords.length > 0) {
            bestIngredient = lemmatizeIngredient(significantWords[0], quantity);
        }
    }
    // Clean up and return
    bestIngredient = bestIngredient.trim();
    if (!bestIngredient || bestIngredient.length < 2) {
        return extractCoreIngredientFallback(clean);
    }
    return bestIngredient;
}
/*
 * Lemmatize ingredient names to handle pluralization correctly
 * Examples: "tomatoes" → "tomato", "cherries" → "cherry", "potatoes" → "potato"
 */
function lemmatizeIngredient(word, quantity) {
    if (!word)
        return word;
    const lowerWord = word.toLowerCase();
    // If quantity is 1 or null, prefer singular form
    // If quantity is > 1, convert plural to singular for consistency
    // Common ingredient pluralization rules
    const pluralToSingular = {
        // Standard -s plurals
        'tomatoes': 'tomato',
        'potatoes': 'potato',
        'avocados': 'avocado',
        'mangoes': 'mango',
        'heroes': 'hero',
        // -ies to -y
        'cherries': 'cherry',
        'berries': 'berry',
        'strawberries': 'strawberry',
        'blueberries': 'blueberry',
        'raspberries': 'raspberry',
        'blackberries': 'blackberry',
        // -ves to -f
        'leaves': 'leaf',
        'halves': 'half',
        'loaves': 'loaf',
        // Irregular plurals
        'children': 'child',
        'feet': 'foot',
        'teeth': 'tooth',
        'geese': 'goose',
        // Common cooking terms
        'cloves': 'clove',
        'pieces': 'piece',
        'slices': 'slice',
        'strips': 'strip',
        'sprigs': 'sprig',
        'stalks': 'stalk',
        'ribs': 'rib'
    };
    // Check for exact matches first
    if (pluralToSingular[lowerWord]) {
        return pluralToSingular[lowerWord];
    }
    // Apply general pluralization rules
    if (quantity !== null && quantity > 1) {
        // Convert plural to singular
        if (lowerWord.endsWith('ies') && lowerWord.length > 4) {
            return lowerWord.slice(0, -3) + 'y';
        }
        if (lowerWord.endsWith('ves') && lowerWord.length > 4) {
            return lowerWord.slice(0, -3) + 'f';
        }
        if (lowerWord.endsWith('ses') && lowerWord.length > 4) {
            return lowerWord.slice(0, -2);
        }
        if (lowerWord.endsWith('s') && lowerWord.length > 3 && !lowerWord.endsWith('ss')) {
            return lowerWord.slice(0, -1);
        }
    }
    return word; // Return original if no transformation needed
}
