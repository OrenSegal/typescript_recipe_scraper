// import { calculateGrams } from './ingredientParser.js';
/*
 * Production-ready NER-based ingredient parser
 * Simplified implementation for stability and performance
 */
export class ProductionNERParser {
    static metrics = {
        totalProcessed: 0,
        successfulParses: 0,
        averageProcessingTime: 0,
        totalProcessingTime: 0
    };
    /*
     * Initialize the ProductionNERParser
     */
    static async initialize() {
        // Initialization complete - using simplified approach for stability
    }
    /*
     * Parse an ingredient string into structured data
     */
    static async parseIngredient(text) {
        const startTime = Date.now();
        try {
            // Simple but robust parsing approach
            const quantity = this.extractQuantity(text);
            const unit = this.extractUnit(text);
            const name = this.extractName(text);
            const category = this.categorizeIngredient(name);
            const notes = this.extractNotes(text);
            const grams = this.calculateGramsSimple(quantity, unit, name);
            const result = {
                text,
                quantity,
                unit,
                name,
                notes,
                category,
                grams
            };
            this.recordSuccess(startTime);
            return result;
        }
        catch (error) {
            console.warn(`Failed to parse ingredient: ${text}`, error);
            return this.createFallbackIngredient(text);
        }
    }
    /*
     * Parse multiple ingredients (batch processing)
     */
    static async parseIngredients(ingredients) {
        const results = [];
        for (const ingredient of ingredients) {
            const parsed = await this.parseIngredient(ingredient);
            results.push(parsed);
        }
        return results;
    }
    /*
     * Get parsing performance metrics
     */
    static getMetrics() {
        return {
            ...this.metrics,
            successRate: this.metrics.totalProcessed > 0 ?
                (this.metrics.successfulParses / this.metrics.totalProcessed) * 100 : 0
        };
    }
    /*
     * Reset performance metrics
     */
    static resetMetrics() {
        this.metrics = {
            totalProcessed: 0,
            successfulParses: 0,
            averageProcessingTime: 0,
            totalProcessingTime: 0
        };
    }
    /*
     * Extract quantity from text using enhanced regex patterns for complex ranges
     */
    static extractQuantity(text) {
        // Enhanced patterns for complex ranges like "1 to 1 1/2", "2-3", "1/2", etc.
        // Pattern 1: "X to Y Z/W" format (e.g., "1 to 1 1/2")
        const complexRangePattern = /(\d+(?:\.\d+)?)\s+to\s+(\d+(?:\.\d+)?)\s+(\d+\/\d+)/i;
        const complexMatch = text.match(complexRangePattern);
        if (complexMatch) {
            const start = parseFloat(complexMatch[1]);
            const wholeEnd = parseFloat(complexMatch[2]);
            const fractionEnd = this.parseFraction(complexMatch[3]);
            return [start, wholeEnd + fractionEnd];
        }
        // Pattern 2: "X to Y" format (e.g., "2 to 3", "1.5 to 2.5")
        const simpleRangePattern = /(\d+(?:\.\d+)?)\s+to\s+(\d+(?:\.\d+)?)/i;
        const simpleMatch = text.match(simpleRangePattern);
        if (simpleMatch) {
            return [parseFloat(simpleMatch[1]), parseFloat(simpleMatch[2])];
        }
        // Pattern 3: "X-Y" format (e.g., "2-3", "1.5-2.5")
        const dashRangePattern = /(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/;
        const dashMatch = text.match(dashRangePattern);
        if (dashMatch) {
            return [parseFloat(dashMatch[1]), parseFloat(dashMatch[2])];
        }
        // Pattern 4: Mixed numbers (e.g., "1 1/2", "2 3/4")
        const mixedNumberPattern = /(\d+)\s+(\d+\/\d+)/;
        const mixedMatch = text.match(mixedNumberPattern);
        if (mixedMatch) {
            const whole = parseInt(mixedMatch[1]);
            const fraction = this.parseFraction(mixedMatch[2]);
            return whole + fraction;
        }
        // Pattern 5: Simple fractions (e.g., "1/2", "3/4")
        const fractionPattern = /\b(\d+\/\d+)\b/;
        const fractionMatch = text.match(fractionPattern);
        if (fractionMatch) {
            return this.parseFraction(fractionMatch[1]);
        }
        // Pattern 6: Word numbers
        const wordPattern = /\b(one|two|three|four|five|six|seven|eight|nine|ten)\b/i;
        const wordMatch = text.match(wordPattern);
        if (wordMatch) {
            const wordToNumber = {
                'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
                'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10
            };
            return wordToNumber[wordMatch[1].toLowerCase()];
        }
        // Pattern 7: Simple numbers (e.g., "2", "1.5")
        const numberPattern = /\b(\d+(?:\.\d+)?)\b/;
        const numberMatch = text.match(numberPattern);
        if (numberMatch) {
            return parseFloat(numberMatch[1]);
        }
        return null;
    }
    /*
     * Parse a fraction string like "1/2" into a decimal number
     */
    static parseFraction(fractionStr) {
        const parts = fractionStr.split('/');
        if (parts.length === 2) {
            const numerator = parseInt(parts[0]);
            const denominator = parseInt(parts[1]);
            return denominator !== 0 ? numerator / denominator : 0;
        }
        return 0;
    }
    /*
     * Extract unit from text
     */
    static extractUnit(text) {
        const units = [
            'cup', 'cups', 'tablespoon', 'tablespoons', 'tbsp', 'teaspoon', 'teaspoons', 'tsp',
            'ounce', 'ounces', 'oz', 'pound', 'pounds', 'lb', 'lbs', 'gram', 'grams', 'g',
            'kilogram', 'kilograms', 'kg', 'liter', 'liters', 'l', 'milliliter', 'milliliters', 'ml',
            'pint', 'pints', 'quart', 'quarts', 'gallon', 'gallons', 'piece', 'pieces',
            'slice', 'slices', 'clove', 'cloves', 'head', 'heads', 'bunch', 'bunches',
            'sprig', 'sprigs', 'leaf', 'leaves', 'handful', 'handfuls', 'pinch', 'pinches',
            'dash', 'dashes', 'splash', 'leaves', 'leaf', 'handful', 'sprigs', 'sprig'
        ];
        const lowerText = text.toLowerCase();
        for (const unit of units) {
            if (lowerText.includes(unit)) {
                return unit;
            }
        }
        return null;
    }
    /*
     * Extract ingredient name
     */
    static extractName(text) {
        // Remove quantity and unit, clean up the remaining text
        let name = text
            .replace(/\b\d+(?:\.\d+)?(?:\s*-\s*\d+(?:\.\d+)?)?\b/g, '') // Remove numbers
            .replace(/\b(cup|cups|tablespoon|tablespoons|tbsp|teaspoon|teaspoons|tsp|ounce|ounces|oz|pound|pounds|lb|lbs)\b/gi, '') // Remove units
            .replace(/\b(chopped|diced|sliced|minced|grated|fresh|dried|cooked|optional|if needed|as needed)\b/gi, '') // Remove prep words
            .replace(/\s+/g, ' ') // Normalize spaces
            .trim();
        return name || text;
    }
    /*
     * Categorize ingredient based on name
     */
    static categorizeIngredient(name) {
        const lowerName = name.toLowerCase();
        if (/\b(beef|pork|lamb|veal|ground meat)\b/i.test(lowerName))
            return 'Meat';
        if (/\b(chicken|turkey|duck|poultry)\b/i.test(lowerName))
            return 'Poultry';
        if (/\b(fish|salmon|tuna|shrimp|crab|seafood)\b/i.test(lowerName))
            return 'Seafood';
        if (/\b(milk|cheese|butter|cream|yogurt|dairy)\b/i.test(lowerName))
            return 'Dairy';
        if (/\b(onion|garlic|tomato|carrot|celery|spinach|lettuce|cucumber|pepper|vegetable)\b/i.test(lowerName))
            return 'Vegetables';
        if (/\b(apple|banana|orange|lemon|lime|berry|fruit)\b/i.test(lowerName))
            return 'Fruits';
        if (/\b(rice|wheat|oats|quinoa|grain|flour|bread|pasta)\b/i.test(lowerName))
            return 'Grains';
        if (/\b(parsley|basil|oregano|thyme|rosemary|herb|cilantro)\b/i.test(lowerName))
            return 'Herbs & Spices';
        if (/\b(salt|pepper|cumin|paprika|ginger|spice|cinnamon)\b/i.test(lowerName))
            return 'Herbs & Spices';
        if (/\b(oil|vinegar|sugar|vanilla|baking)\b/i.test(lowerName))
            return 'Pantry Staples';
        return 'Other';
    }
    /*
     * Extract preparation notes from text
     */
    static extractNotes(text) {
        const prepMethods = [];
        const lowerText = text.toLowerCase();
        if (lowerText.includes('chopped'))
            prepMethods.push('chopped');
        if (lowerText.includes('diced'))
            prepMethods.push('diced');
        if (lowerText.includes('sliced'))
            prepMethods.push('sliced');
        if (lowerText.includes('minced'))
            prepMethods.push('minced');
        if (lowerText.includes('grated'))
            prepMethods.push('grated');
        if (lowerText.includes('fresh'))
            prepMethods.push('fresh');
        if (lowerText.includes('dried'))
            prepMethods.push('dried');
        if (lowerText.includes('cooked'))
            prepMethods.push('cooked');
        if (lowerText.includes('optional'))
            prepMethods.push('optional');
        if (lowerText.includes('if needed'))
            prepMethods.push('if needed');
        if (lowerText.includes('as needed'))
            prepMethods.push('as needed');
        return prepMethods.length > 0 ? prepMethods.join(', ') : null;
    }
    /*
     * Create fallback ingredient when parsing fails
     */
    static createFallbackIngredient(text) {
        return {
            text,
            quantity: null,
            unit: null,
            name: text,
            notes: null,
            category: null,
            grams: null
        };
    }
    /*
     * Record successful parsing metrics
     */
    static recordSuccess(startTime) {
        const processingTime = Date.now() - startTime;
        this.metrics.totalProcessed++;
        this.metrics.successfulParses++;
        this.metrics.totalProcessingTime += processingTime;
        this.metrics.averageProcessingTime = this.metrics.totalProcessingTime / this.metrics.totalProcessed;
    }
    /*
     * Simple gram calculation for ingredient quantities
     */
    static calculateGramsSimple(quantity, unit, ingredient) {
        if (!quantity || !unit)
            return null;
        const qty = Array.isArray(quantity) ? quantity[0] : quantity;
        // Common unit conversions to grams
        const unitConversions = {
            'g': 1, 'gram': 1, 'grams': 1,
            'kg': 1000, 'kilogram': 1000, 'kilograms': 1000,
            'oz': 28.35, 'ounce': 28.35, 'ounces': 28.35,
            'lb': 453.59, 'pound': 453.59, 'pounds': 453.59,
            'cup': 240, 'cups': 240,
            'tbsp': 15, 'tablespoon': 15, 'tablespoons': 15,
            'tsp': 5, 'teaspoon': 5, 'teaspoons': 5,
            'ml': 1, 'milliliter': 1, 'milliliters': 1,
            'l': 1000, 'liter': 1000, 'liters': 1000,
            'handful': 80, 'handfuls': 80,
            'pinch': 1, 'pinches': 1,
            'dash': 1, 'dashes': 1,
            'leaves': 1, 'leaf': 1,
            'clove': 3, 'cloves': 3,
            'piece': 50, 'pieces': 50
        };
        const conversion = unitConversions[unit.toLowerCase()];
        return conversion ? Math.round(qty * conversion) : null;
    }
}
