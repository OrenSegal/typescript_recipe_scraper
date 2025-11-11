/*
 * Extracts primary cooking method based on major actions by time of use
 */
export class CookingMethodExtractor {
    static COOKING_METHODS = {
        // Heat-based methods (by cooking time priority)
        'bake': ['bake', 'baking', 'baked', 'oven', 'roast', 'roasting', 'roasted'],
        'fry': ['fry', 'frying', 'fried', 'pan-fry', 'deep-fry', 'sauté', 'sautéing', 'sautéed'],
        'grill': ['grill', 'grilling', 'grilled', 'barbecue', 'bbq', 'char', 'charring'],
        'boil': ['boil', 'boiling', 'boiled', 'simmer', 'simmering', 'poach', 'poaching'],
        'steam': ['steam', 'steaming', 'steamed'],
        'braise': ['braise', 'braising', 'braised', 'slow cook', 'slow-cook'],
        'broil': ['broil', 'broiling', 'broiled'],
        'smoke': ['smoke', 'smoking', 'smoked'],
        // Preparation methods
        'mix': ['mix', 'mixing', 'mixed', 'combine', 'combining', 'stir', 'stirring'],
        'chop': ['chop', 'chopping', 'chopped', 'dice', 'dicing', 'mince', 'mincing'],
        'blend': ['blend', 'blending', 'blended', 'puree', 'process'],
        'marinate': ['marinate', 'marinating', 'marinated'],
        'chill': ['chill', 'chilling', 'chilled', 'refrigerate', 'cool'],
        'freeze': ['freeze', 'freezing', 'frozen']
    };
    static ACTION_TIME_WEIGHTS = {
        // Cooking actions get higher weight (more time consuming)
        'bake': 25, 'roast': 25, 'braise': 30, 'slow-cook': 35,
        'fry': 10, 'sauté': 8, 'grill': 15, 'broil': 12,
        'boil': 15, 'simmer': 20, 'steam': 12, 'poach': 10,
        'smoke': 40,
        // Preparation actions get lower weight
        'mix': 2, 'stir': 1, 'combine': 2, 'blend': 3,
        'chop': 5, 'dice': 5, 'mince': 8,
        'marinate': 15, 'chill': 10, 'freeze': 5
    };
    /*
     * Extract primary cooking method from instruction steps
     * Prioritizes heat-based methods over preparation methods
     */
    static extractCookingMethod(instructions) {
        if (!instructions || instructions.length === 0)
            return 'No Method';
        const methodScores = {};
        const heatBasedMethods = ['bake', 'fry', 'grill', 'boil', 'steam', 'braise', 'broil', 'smoke'];
        const preparationMethods = ['mix', 'chop', 'blend', 'marinate', 'chill', 'freeze'];
        // Analyze each instruction step
        for (let i = 0; i < instructions.length; i++) {
            const instruction = instructions[i];
            const text = instruction.text?.toLowerCase() || '';
            const stepWeight = this.calculateStepWeight(instruction, i, instructions.length);
            // Check for cooking method keywords
            for (const [method, keywords] of Object.entries(this.COOKING_METHODS)) {
                for (const keyword of keywords) {
                    if (text.includes(keyword)) {
                        const actionWeight = this.ACTION_TIME_WEIGHTS[method] || 5;
                        let score = stepWeight * actionWeight;
                        // Apply heat-based priority boost
                        if (heatBasedMethods.includes(method)) {
                            score *= 2.5; // Significantly boost heat-based methods
                        }
                        methodScores[method] = (methodScores[method] || 0) + score;
                    }
                }
            }
        }
        // Return the method with highest score, prioritizing heat-based methods
        if (Object.keys(methodScores).length === 0)
            return 'Mixed';
        const sortedMethods = Object.entries(methodScores)
            .sort(([, a], [, b]) => b - a);
        // If top method is preparation-based, check if there's a heat-based alternative
        const topMethod = sortedMethods[0][0];
        if (preparationMethods.includes(topMethod)) {
            const heatBasedAlternative = sortedMethods.find(([method]) => heatBasedMethods.includes(method));
            if (heatBasedAlternative && heatBasedAlternative[1] > (sortedMethods[0][1] * 0.3)) {
                // Use heat-based method if its score is at least 30% of the top prep method
                return this.capitalizeMethod(heatBasedAlternative[0]);
            }
        }
        return this.capitalizeMethod(topMethod);
    }
    /*
     * Calculate weight for instruction step based on position and content
     */
    static calculateStepWeight(instruction, index, totalSteps) {
        let weight = 1;
        // Later steps (actual cooking) get higher weight
        const positionWeight = 1 + (index / totalSteps) * 2;
        weight *= positionWeight;
        // Steps with time/temperature get higher weight (actual cooking steps)
        const text = instruction.text?.toLowerCase() || '';
        if (text.includes('minutes') || text.includes('hours') || text.includes('°') || text.includes('degrees')) {
            weight *= 2;
        }
        // Steps with equipment get higher weight
        if (instruction.equipment && instruction.equipment.length > 0) {
            weight *= 1.5;
        }
        return weight;
    }
    /*
     * Capitalize cooking method for display
     */
    static capitalizeMethod(method) {
        const methodMap = {
            'bake': 'Baking',
            'fry': 'Frying',
            'grill': 'Grilling',
            'boil': 'Boiling',
            'steam': 'Steaming',
            'braise': 'Braising',
            'broil': 'Broiling',
            'smoke': 'Smoking',
            'mix': 'Mixing',
            'chop': 'Preparation',
            'blend': 'Blending',
            'marinate': 'Marinating',
            'chill': 'Chilling',
            'freeze': 'Freezing'
        };
        return methodMap[method] || 'Mixed';
    }
    /*
     * Extract detailed cooking methods for analytics
     */
    static extractDetailedMethods(instructions) {
        if (!instructions || instructions.length === 0)
            return [];
        const methods = new Set();
        for (const instruction of instructions) {
            const text = instruction.text?.toLowerCase() || '';
            for (const [method, keywords] of Object.entries(this.COOKING_METHODS)) {
                for (const keyword of keywords) {
                    if (text.includes(keyword)) {
                        methods.add(this.capitalizeMethod(method));
                        break;
                    }
                }
            }
        }
        return Array.from(methods);
    }
}
/*
 * Example usage:
 *
 * const instructions = [
 *   { instruction: "Preheat oven to 350°F" },
 *   { instruction: "Mix flour and sugar in bowl" },
 *   { instruction: "Bake for 25 minutes until golden" }
 * ];
 *
 * const method = CookingMethodExtractor.extractCookingMethod(instructions);
 * // Result: "Baking" (based on highest time-weighted score)
 */
