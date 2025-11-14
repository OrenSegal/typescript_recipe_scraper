/*
 * Essential Recipe Parsing Specification
 * Core types and enums needed by enrichment modules
 */
import { z } from 'zod';
// Zod Schemas for type validation
export const IngredientCategorySchema = z.enum([
    'Pantry Staples',
    'Meat',
    'Poultry',
    'Seafood',
    'Dairy',
    'Vegetables',
    'Fruits',
    'Grains',
    'Legumes',
    'Nuts & Seeds',
    'Herbs & Spices',
    'Oils & Fats',
    'Condiments',
    'Condiments & Sauces',
    'Baking',
    'Baking Essentials', // Additional category used by enrichment modules
    'Beverages',
    'Frozen',
    'Frozen Foods',
    'Canned',
    'Canned Goods',
    'Other'
]);
export const MeasurementUnitSchema = z.enum([
    'cup', 'cups',
    'tbsp', 'tablespoon', 'tablespoons',
    'tsp', 'teaspoon', 'teaspoons',
    'oz', 'ounce', 'ounces',
    'lb', 'pound', 'pounds',
    'g', 'gram', 'grams',
    'kg', 'kilogram', 'kilograms',
    'ml', 'milliliter', 'milliliters',
    'l', 'liter', 'liters',
    'qt', 'quart', 'quarts',
    'pt', 'pint', 'pints',
    'gal', 'gallon', 'gallons',
    'piece', 'pieces',
    'slice', 'slices',
    'clove', 'cloves',
    'pinch', 'dash',
    'to taste'
]);
export const CookingActionSchema = z.enum([
    'mix', 'stir', 'whisk', 'beat',
    'chop', 'dice', 'slice', 'mince',
    'bake', 'roast', 'broil', 'grill',
    'sauté', 'fry', 'pan-fry', 'deep-fry',
    'boil', 'simmer', 'steam', 'poach',
    'season', 'marinate', 'coat',
    'preheat', 'heat', 'cool', 'chill',
    'combine', 'fold', 'toss', 'blend',
    'strain', 'drain', 'rinse', 'wash',
    'serve', 'garnish', 'plate', 'arrange',
    'spread', 'pour', 'place', 'transfer',
    'remove', 'set aside', 'cut', 'peel',
    'cut', 'peel', 'slice', 'dice', 'mince',
    'chop', 'grate'
]);
export const KitchenEquipmentSchema = z.enum([
    'oven', 'stovetop', 'microwave',
    'pan', 'skillet', 'pot', 'saucepan',
    'baking sheet', 'baking dish', 'casserole',
    'bowl', 'mixing bowl', 'serving bowl',
    'knife', 'cutting board', 'whisk',
    'spatula', 'spoon', 'ladle',
    'blender', 'food processor', 'mixer',
    'measuring cups', 'measuring spoons',
    'colander', 'strainer', 'grater'
]);
// Core schemas expected by enrichment modules
export const IngredientSchema = z.object({
    text: z.string(),
    quantity: z.union([z.number(), z.array(z.number())]).nullable(),
    unit: z.string().nullable(),
    name: z.string(),
    notes: z.string().nullable(),
    category: IngredientCategorySchema.nullable(),
    grams: z.union([z.number(), z.array(z.number())]).optional()
});
export const InstructionSchema = z.object({
    text: z.string(),
    action: CookingActionSchema.nullable().optional(),
    timer: z.number().nullable().optional(),
    equipment: z.array(KitchenEquipmentSchema).optional(),
    mentioned_ingredients: z.array(z.string()).optional()
});
// Simple ingredient parser class
export class IngredientParser {
    static parseQuantity(text) {
        // Basic quantity parsing logic
        const quantityMatch = text.match(/^(\d+(?:\.\d+)?(?:\/\d+)?)\s*([a-zA-Z]+)?/);
        if (quantityMatch) {
            const quantity = parseFloat(quantityMatch[1]);
            const unit = quantityMatch[2] || null;
            return { quantity, unit };
        }
        return { quantity: null, unit: null };
    }
    static categorizeIngredient(name) {
        const lowerName = name.toLowerCase();
        // Simple categorization logic
        if (lowerName.includes('chicken') || lowerName.includes('beef') || lowerName.includes('pork')) {
            return 'Meat';
        }
        if (lowerName.includes('fish') || lowerName.includes('salmon') || lowerName.includes('tuna')) {
            return 'Seafood';
        }
        if (lowerName.includes('milk') || lowerName.includes('cheese') || lowerName.includes('butter')) {
            return 'Dairy';
        }
        if (lowerName.includes('flour') || lowerName.includes('sugar') || lowerName.includes('salt')) {
            return 'Pantry Staples';
        }
        if (lowerName.includes('onion') || lowerName.includes('garlic') || lowerName.includes('carrot')) {
            return 'Vegetables';
        }
        return 'Other';
    }
}
// Re-export Zod schema types for backward compatibility
export { IngredientCategorySchema as IngredientCategory };
export { CookingActionSchema as CookingAction };
export { KitchenEquipmentSchema as KitchenEquipmentType };
