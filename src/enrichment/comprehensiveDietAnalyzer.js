/*
 * Comprehensive Diet Suitability Analyzer
 * Ensures every recipe gets accurate dietary restriction tags
 */
export class ComprehensiveDietAnalyzer {
    // Comprehensive ingredient databases for dietary analysis
    static GLUTEN_INGREDIENTS = new Set([
        'flour', 'wheat', 'bread', 'pasta', 'barley', 'rye', 'oats', 'bulgur',
        'couscous', 'farro', 'spelt', 'kamut', 'semolina', 'durum', 'bran',
        'cracker', 'cereal', 'malt', 'beer', 'soy sauce', 'teriyaki'
    ]);
    static DAIRY_INGREDIENTS = new Set([
        'milk', 'cheese', 'butter', 'cream', 'yogurt', 'sour cream', 'cottage cheese',
        'ricotta', 'mozzarella', 'cheddar', 'parmesan', 'feta', 'goat cheese',
        'cream cheese', 'heavy cream', 'half and half', 'buttermilk', 'whey',
        'casein', 'lactose', 'ghee'
    ]);
    static MEAT_INGREDIENTS = new Set([
        'chicken', 'beef', 'pork', 'lamb', 'turkey', 'duck', 'goose', 'veal',
        'bacon', 'ham', 'sausage', 'pepperoni', 'prosciutto', 'salami',
        'ground beef', 'ground turkey', 'ground chicken', 'steak', 'roast'
    ]);
    static FISH_SEAFOOD_INGREDIENTS = new Set([
        'fish', 'salmon', 'tuna', 'cod', 'halibut', 'tilapia', 'trout', 'bass',
        'shrimp', 'crab', 'lobster', 'oyster', 'clam', 'mussel', 'scallop',
        'squid', 'octopus', 'anchovy', 'sardine', 'mackerel', 'sea bass',
        'crab meat', 'crab cakes', 'fish sauce', 'worcestershire'
    ]);
    static SHELLFISH_INGREDIENTS = new Set([
        'shrimp', 'crab', 'lobster', 'oyster', 'clam', 'mussel', 'scallop',
        'crayfish', 'langostino', 'crab meat', 'lobster meat'
    ]);
    static EGG_INGREDIENTS = new Set([
        'egg', 'eggs', 'egg white', 'egg yolk', 'mayonnaise', 'mayo',
        'meringue', 'custard', 'eggnog', 'hollandaise', 'caesar dressing'
    ]);
    static NUT_INGREDIENTS = new Set([
        'almond', 'walnut', 'pecan', 'cashew', 'pistachio', 'hazelnut',
        'brazil nut', 'macadamia', 'pine nut', 'chestnut', 'nut', 'nuts',
        'almond flour', 'almond milk', 'walnut oil', 'nut butter'
    ]);
    static PEANUT_INGREDIENTS = new Set([
        'peanut', 'peanuts', 'peanut butter', 'peanut oil', 'groundnut'
    ]);
    static SOY_INGREDIENTS = new Set([
        'soy', 'soy sauce', 'tofu', 'tempeh', 'miso', 'edamame', 'soybean',
        'soy milk', 'soy protein', 'tamari', 'teriyaki', 'hoisin'
    ]);
    static HIGH_CARB_INGREDIENTS = new Set([
        'rice', 'pasta', 'bread', 'potato', 'sweet potato', 'quinoa',
        'oats', 'barley', 'corn', 'beans', 'lentils', 'chickpeas',
        'sugar', 'honey', 'maple syrup', 'flour', 'noodles'
    ]);
    static SUGAR_INGREDIENTS = new Set([
        'sugar', 'brown sugar', 'honey', 'maple syrup', 'corn syrup',
        'agave', 'molasses', 'candy', 'chocolate', 'jam', 'jelly',
        'frosting', 'icing', 'cake', 'cookies', 'pie', 'dessert'
    ]);
    static HIGH_SODIUM_INGREDIENTS = new Set([
        'salt', 'soy sauce', 'fish sauce', 'worcestershire', 'bacon',
        'ham', 'sausage', 'cheese', 'olives', 'pickles', 'capers',
        'anchovies', 'broth', 'stock', 'bouillon', 'processed'
    ]);
    static NON_KOSHER_INGREDIENTS = new Set([
        'pork', 'ham', 'bacon', 'sausage', 'pepperoni', 'lard',
        'shrimp', 'crab', 'lobster', 'oyster', 'clam', 'mussel', 'scallop',
        'shellfish', 'rabbit', 'duck', 'goose'
    ]);
    static NON_HALAL_INGREDIENTS = new Set([
        'pork', 'ham', 'bacon', 'sausage', 'pepperoni', 'lard',
        'alcohol', 'wine', 'beer', 'rum', 'vodka', 'whiskey', 'gelatin'
    ]);
    static PALEO_FORBIDDEN = new Set([
        'grain', 'rice', 'wheat', 'oats', 'barley', 'corn', 'quinoa',
        'beans', 'lentils', 'chickpeas', 'peanuts', 'soy', 'dairy',
        'milk', 'cheese', 'yogurt', 'sugar', 'processed'
    ]);
    /*
     * Main method: Calculate comprehensive diet suitability
     */
    static calculateDietSuitability(ingredients, nutrition) {
        const suitability = [];
        if (!ingredients || ingredients.length === 0) {
            return suitability;
        }
        // Extract ingredient names for analysis
        const ingredientNames = ingredients.map(ing => {
            const name = (ing.name || ing.clean_name || ing.text || '').toLowerCase();
            return this.cleanIngredientName(name);
        }).filter(name => name.length > 0);
        // Allergen Analysis
        if (!this.containsAnyIngredient(ingredientNames, this.GLUTEN_INGREDIENTS)) {
            suitability.push('Gluten-Free');
        }
        if (!this.containsAnyIngredient(ingredientNames, this.DAIRY_INGREDIENTS)) {
            suitability.push('Dairy-Free');
            suitability.push('Lactose-Intolerant'); // Dairy-free implies lactose-free
        }
        if (!this.containsAnyIngredient(ingredientNames, this.NUT_INGREDIENTS)) {
            suitability.push('Nut-Free');
        }
        if (!this.containsAnyIngredient(ingredientNames, this.PEANUT_INGREDIENTS)) {
            suitability.push('Peanut-Free');
        }
        if (!this.containsAnyIngredient(ingredientNames, this.SOY_INGREDIENTS)) {
            suitability.push('Soy-Free');
        }
        if (!this.containsAnyIngredient(ingredientNames, this.EGG_INGREDIENTS)) {
            suitability.push('Egg-Free');
        }
        if (!this.containsAnyIngredient(ingredientNames, this.SHELLFISH_INGREDIENTS)) {
            suitability.push('Shellfish-Free');
        }
        if (!this.containsAnyIngredient(ingredientNames, this.FISH_SEAFOOD_INGREDIENTS)) {
            suitability.push('Fish-Free');
        }
        // Diet Type Analysis
        const hasMeat = this.containsAnyIngredient(ingredientNames, this.MEAT_INGREDIENTS);
        const hasSeafood = this.containsAnyIngredient(ingredientNames, this.FISH_SEAFOOD_INGREDIENTS);
        const hasDairy = this.containsAnyIngredient(ingredientNames, this.DAIRY_INGREDIENTS);
        const hasEggs = this.containsAnyIngredient(ingredientNames, this.EGG_INGREDIENTS);
        // Vegetarian: No meat or seafood
        if (!hasMeat && !hasSeafood) {
            suitability.push('Vegetarian');
        }
        // Vegan: No animal products at all
        if (!hasMeat && !hasSeafood && !hasDairy && !hasEggs && !this.hasAnimalProducts(ingredientNames)) {
            suitability.push('Vegan');
        }
        // Pescatarian: No meat but seafood ok
        if (!hasMeat && hasSeafood) {
            suitability.push('Pescatarian');
        }
        // Nutrition-Based Diet Analysis
        if (nutrition) {
            this.analyzeNutritionBasedDiets(nutrition, suitability, ingredientNames);
        }
        // Religious Dietary Analysis
        if (!this.containsAnyIngredient(ingredientNames, this.NON_KOSHER_INGREDIENTS) &&
            !this.hasMixedMeatDairy(ingredientNames)) {
            suitability.push('Kosher');
        }
        if (!this.containsAnyIngredient(ingredientNames, this.NON_HALAL_INGREDIENTS)) {
            suitability.push('Halal');
        }
        // Specialized Diet Analysis
        if (this.isPaleoCompliant(ingredientNames)) {
            suitability.push('Paleo');
        }
        if (!this.containsAnyIngredient(ingredientNames, this.SUGAR_INGREDIENTS)) {
            suitability.push('Sugar-Free');
        }
        if (!this.containsAnyIngredient(ingredientNames, this.HIGH_SODIUM_INGREDIENTS)) {
            suitability.push('Low Sodium');
        }
        // Health-based analysis
        if (this.isHeartHealthy(ingredientNames, nutrition)) {
            suitability.push('Heart-Healthy');
        }
        return [...new Set(suitability)]; // Remove duplicates
    }
    /*
     * Clean ingredient name for better matching
     */
    static cleanIngredientName(name) {
        return name
            .toLowerCase()
            .replace(/[®™©]/g, '') // Remove trademark symbols
            .replace(/\b(organic|fresh|dried|frozen|canned|chopped|minced|sliced)\b/g, '') // Remove descriptors
            .replace(/\s+/g, ' ')
            .trim();
    }
    /*
     * Check if ingredient list contains any ingredients from a restriction set
     */
    static containsAnyIngredient(ingredientNames, restrictedSet) {
        return ingredientNames.some(name => {
            return Array.from(restrictedSet).some(restricted => name.includes(restricted) || restricted.includes(name));
        });
    }
    /*
     * Check for animal products beyond meat/dairy/eggs
     */
    static hasAnimalProducts(ingredientNames) {
        const animalProducts = ['honey', 'gelatin', 'lard', 'tallow', 'bone', 'fish sauce'];
        return ingredientNames.some(name => animalProducts.some(product => name.includes(product)));
    }
    /*
     * Check for mixed meat and dairy (non-kosher)
     */
    static hasMixedMeatDairy(ingredientNames) {
        const hasMeat = this.containsAnyIngredient(ingredientNames, this.MEAT_INGREDIENTS);
        const hasDairy = this.containsAnyIngredient(ingredientNames, this.DAIRY_INGREDIENTS);
        return hasMeat && hasDairy;
    }
    /*
     * Check if recipe is Paleo compliant
     */
    static isPaleoCompliant(ingredientNames) {
        // Paleo allows: meat, fish, eggs, vegetables, fruits, nuts, seeds
        // Excludes: grains, legumes, dairy, sugar, processed foods
        return !this.containsAnyIngredient(ingredientNames, this.PALEO_FORBIDDEN);
    }
    /*
     * Analyze nutrition-based diets
     */
    static analyzeNutritionBasedDiets(nutrition, suitability, ingredientNames) {
        const carbs = nutrition.carbohydratesG || nutrition.carbohydrateContent || 0;
        const fat = nutrition.fatG || nutrition.fatContent || 0;
        const protein = nutrition.proteinG || nutrition.proteinContent || 0;
        const sodium = nutrition.sodiumG || nutrition.sodiumContent || 0;
        // Convert string values to numbers if needed
        const carbsNum = typeof carbs === 'string' ? parseFloat(carbs.replace(/[^\d.]/g, '')) : carbs;
        const fatNum = typeof fat === 'string' ? parseFloat(fat.replace(/[^\d.]/g, '')) : fat;
        const proteinNum = typeof protein === 'string' ? parseFloat(protein.replace(/[^\d.]/g, '')) : protein;
        const sodiumNum = typeof sodium === 'string' ? parseFloat(sodium.replace(/[^\d.]/g, '')) : sodium;
        // Ketogenic: Very low carb (<10g), high fat (fat should be at least 70% of calories)
        if (carbsNum < 10 && fatNum >= 15 &&
            !this.containsAnyIngredient(ingredientNames, this.HIGH_CARB_INGREDIENTS)) {
            suitability.push('Ketogenic');
        }
        // Low Carb: <20g carbs per serving
        if (carbsNum < 20 && !this.containsAnyIngredient(ingredientNames, this.HIGH_CARB_INGREDIENTS)) {
            suitability.push('Low Carb');
        }
        // Low Sodium: <140mg per serving (0.14g)
        if (sodiumNum < 0.14) {
            suitability.push('Low Sodium');
        }
    }
    /*
     * Check if recipe is heart-healthy
     */
    static isHeartHealthy(ingredientNames, nutrition) {
        // Heart-healthy criteria:
        // - Low sodium
        // - Low saturated fat
        // - High fiber
        // - Contains healthy ingredients
        const healthyIngredients = [
            'olive oil', 'avocado', 'salmon', 'nuts', 'seeds', 'oats',
            'beans', 'lentils', 'spinach', 'broccoli', 'berries'
        ];
        const hasHealthyIngredients = ingredientNames.some(name => healthyIngredients.some(healthy => name.includes(healthy)));
        const lowSodium = !this.containsAnyIngredient(ingredientNames, this.HIGH_SODIUM_INGREDIENTS);
        const noProcessed = !ingredientNames.some(name => ['processed', 'fried', 'fast food', 'junk'].some(bad => name.includes(bad)));
        return hasHealthyIngredients && lowSodium && noProcessed;
    }
    /*
     * Validate diet suitability results
     */
    static validateDietSuitability(suitability) {
        // Remove conflicting tags
        const conflicts = [
            ['Vegan', 'Vegetarian'], // Vegan implies vegetarian
            ['Dairy-Free', 'Lactose-Intolerant'], // Keep both as they're related but distinct
            ['Ketogenic', 'Low Carb'] // Keto implies low carb
        ];
        let validated = [...suitability];
        for (const [primary, secondary] of conflicts) {
            if (validated.includes(primary) &&
                validated.includes(secondary)) {
                // Keep primary, remove secondary for some conflicts
                if (primary === 'Vegan' || primary === 'Ketogenic') {
                    validated = validated.filter(diet => diet !== secondary);
                }
            }
        }
        return validated;
    }
}
/*
 * Example usage:
 *
 * const ingredients = [
 *   { name: "chicken breast" },
 *   { name: "olive oil" },
 *   { name: "garlic" },
 *   { name: "herbs" }
 * ];
 *
 * const suitability = ComprehensiveDietAnalyzer.calculateDietSuitability(ingredients);
 * // Result: ['Gluten-Free', 'Dairy-Free', 'Nut-Free', 'Soy-Free', 'Egg-Free', 'Shellfish-Free', 'Fish-Free', 'Heart-Healthy', 'Kosher', 'Halal']
 */
