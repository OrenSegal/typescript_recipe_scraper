import nlp from 'compromise';
import { CookingActionSchema } from '../../recipe-parsing-specification.js';
import { equipmentMatcher } from './comprehensiveEquipmentDatabase.js';
import { ingredientMatcher } from './comprehensiveIngredientDatabase.js';
/*
 * Atomic Instruction Parser
 * Breaks down compound instructions into atomic steps with comprehensive NLP extraction
 * of actions, ingredients, equipment, and timers per step.
 */
export class AtomicInstructionParser {
    static initialized = false;
    static cookingActions = new Set();
    static kitchenEquipment = new Set();
    static sentenceBreakers = /[.!?]+(?:\s|$)/g;
    /*
     * Initialize the parser with cooking actions and equipment databases
     */
    static async initialize() {
        if (this.initialized)
            return;
        // Initialize cooking actions
        const actions = [
            'heat', 'cook', 'bake', 'roast', 'grill', 'fry', 'saute', 'boil', 'simmer',
            'mix', 'stir', 'whisk', 'beat', 'fold', 'combine', 'blend',
            'chop', 'dice', 'mince', 'slice', 'grate', 'peel', 'cut',
            'add', 'pour', 'place', 'transfer', 'remove', 'set aside',
            'season', 'garnish', 'serve', 'arrange', 'spread',
            'preheat', 'cool', 'chill', 'warm', 'rest', 'marinate',
            'cover', 'uncover', 'wrap', 'drain', 'rinse', 'wash'
        ];
        actions.forEach(action => this.cookingActions.add(action));
        // Initialize kitchen equipment
        const equipment = [
            'pan', 'saucepan', 'skillet', 'pot', 'oven', 'stove', 'bowl', 'plate',
            'knife', 'scissors', 'chopping board', 'cutting board', 'spoon', 'fork',
            'whisk', 'spatula', 'tongs', 'ladle', 'measuring cup', 'measuring spoon',
            'baking sheet', 'roasting tin', 'casserole dish', 'mixer', 'blender',
            'food processor', 'grater', 'peeler', 'colander', 'strainer'
        ];
        equipment.forEach(equip => this.kitchenEquipment.add(equip));
        this.initialized = true;
    }
    /*
     * Break compound instruction text into atomic sentences (single or max 2 actions)
     * Example: "Preheat the oven to 350f, remove the trays" →
     * Action: "preheat", Equipment: ["oven", "tray"], Ingredients: null
     */
    static breakIntoAtomicSteps(instructionText) {
        // Clean and normalize text
        const cleanText = instructionText
            .replace(/\s+/g, ' ')
            .trim();
        // Split by sentence boundaries, but preserve important conjunctions
        const sentences = cleanText.split(this.sentenceBreakers)
            .map(s => s.trim())
            .filter(s => s.length > 0);
        const atomicSteps = [];
        for (const sentence of sentences) {
            // Further split by coordinating conjunctions that indicate separate actions
            const subSteps = this.splitByCoordinatingConjunctions(sentence);
            atomicSteps.push(...subSteps);
        }
        // Filter out very short or incomplete steps, but be more lenient with filtering
        return atomicSteps.filter(step => step && step.length > 5);
    }
    /*
     * Split sentences by coordinating conjunctions that indicate separate actions
     */
    static splitByCoordinatingConjunctions(sentence) {
        // Patterns that indicate separate actions
        const separatorPatterns = [
            /\,?\s*and\s+(?=\w+(?:\s+\w+)*(?:\s+(?:in|with|on|to|for|until|while)))/gi, // "and cook" type patterns
            /\,?\s*then\s+/gi, // "then add" type patterns
            /\,?\s*or\s+(?=use|add|cook|heat)/gi, // Alternative actions
        ];
        let steps = [sentence];
        for (const pattern of separatorPatterns) {
            const newSteps = [];
            for (const step of steps) {
                const parts = step.split(pattern);
                if (parts.length > 1) {
                    // Add the first part
                    newSteps.push(parts[0].trim());
                    // Add remaining parts, but only if they have actions
                    for (let i = 1; i < parts.length; i++) {
                        const part = parts[i].trim();
                        if (this.hasAction(part)) {
                            newSteps.push(part);
                        }
                        else {
                            // If no action, combine with previous step
                            if (newSteps.length > 0) {
                                newSteps[newSteps.length - 1] += ' ' + part;
                            }
                        }
                    }
                }
                else {
                    newSteps.push(step);
                }
            }
            steps = newSteps;
        }
        return steps.filter(step => step.trim().length > 0);
    }
    /*
     * Check if a text contains a cooking action
     */
    static hasAction(text) {
        const doc = nlp(text.toLowerCase());
        const verbs = doc.verbs().out('array');
        // Check if any verb is a cooking action
        for (const verb of verbs) {
            if (this.cookingActions.has(verb)) {
                return true;
            }
        }
        // Fallback: check for cooking action words directly
        const words = text.toLowerCase().split(/\s+/);
        return words.some(word => this.cookingActions.has(word));
    }
    /*
     * Extract main cooking action from atomic step using NLP
     */
    static extractMainAction(stepText) {
        const doc = nlp(stepText.toLowerCase());
        const verbs = doc.verbs().out('array');
        // Use Zod schema for robust validation instead of hardcoded casting
        const isValidCookingAction = (action) => {
            return CookingActionSchema.safeParse(action).success;
        };
        // Find the first cooking action verb
        for (const verb of verbs) {
            if (isValidCookingAction(verb)) {
                return verb;
            }
        }
        // Fallback: look for cooking action words in the text
        const words = stepText.toLowerCase().split(/\s+/);
        for (const word of words) {
            if (isValidCookingAction(word)) {
                return word;
            }
        }
        return null;
    }
    /*
     * Extract mentioned ingredients using comprehensive NLP analysis
     */
    static extractMentionedIngredients(stepText, availableIngredients) {
        const mentionedIngredients = [];
        const lowerStepText = stepText.toLowerCase();
        // Create a comprehensive ingredient dictionary from available ingredients
        const ingredientDict = new Map();
        for (const ingredient of availableIngredients) {
            // Use type guard to ensure ingredient has valid name field
            const isValidIngredient = (ing) => {
                return typeof ing === 'object' && ing !== null &&
                    'name' in ing && typeof ing.name === 'string' &&
                    ing.name.length > 0;
            };
            if (!isValidIngredient(ingredient)) {
                continue; // Skip invalid ingredients gracefully
            }
            const cleanName = ingredient.name.toLowerCase();
            const originalName = ingredient.name.toLowerCase();
            // Add various forms of the ingredient name
            ingredientDict.set(cleanName, ingredient.name);
            ingredientDict.set(originalName, ingredient.name);
            // Add plurals and common variations
            ingredientDict.set(cleanName + 's', ingredient.name);
            ingredientDict.set(cleanName + 'es', ingredient.name);
            // Add partial matches for compound ingredients
            const words = cleanName.split(/\s+/);
            for (const word of words) {
                if (word.length > 3) { // Avoid short words like "of", "the"
                    ingredientDict.set(word, ingredient.name);
                }
            }
        }
        // Use NLP to extract nouns and noun phrases
        const doc = nlp(stepText);
        const nouns = doc.nouns().out('array');
        const nounPhrases = doc.chunks().out('array');
        // Check nouns and noun phrases against ingredient dictionary
        const candidates = [...nouns, ...nounPhrases];
        for (const candidate of candidates) {
            const lowerCandidate = candidate.toLowerCase();
            // Direct match
            if (ingredientDict.has(lowerCandidate)) {
                const ingredientName = ingredientDict.get(lowerCandidate);
                if (!mentionedIngredients.includes(ingredientName)) {
                    mentionedIngredients.push(ingredientName);
                }
            }
            // Partial match for compound ingredients
            for (const [key, value] of ingredientDict.entries()) {
                if (lowerStepText.includes(key) && key.length > 3) {
                    if (!mentionedIngredients.includes(value)) {
                        mentionedIngredients.push(value);
                    }
                }
            }
        }
        // Enhanced matching using the comprehensive ingredient matcher
        try {
            // Extract individual words and phrases to check against ingredient database
            const words = stepText.toLowerCase().split(/\s+/);
            for (const word of words) {
                if (word.length > 3) {
                    const ingredientMatch = ingredientMatcher.findIngredient(word);
                    if (ingredientMatch) {
                        const canonicalName = ingredientMatch.canonical_name;
                        if (!mentionedIngredients.includes(canonicalName)) {
                            mentionedIngredients.push(canonicalName);
                        }
                    }
                }
            }
        }
        catch (error) {
            console.warn('Ingredient matcher failed:', error);
        }
        return mentionedIngredients;
    }
    /*
     * Extract mentioned kitchen equipment using comprehensive NLP analysis
     */
    static extractMentionedEquipment(stepText) {
        const mentionedEquipment = [];
        const lowerStepText = stepText.toLowerCase();
        // Use NLP to extract nouns
        const doc = nlp(stepText);
        const nouns = doc.nouns().out('array');
        const nounPhrases = doc.chunks().out('array');
        // Check against comprehensive kitchen equipment database
        const candidates = [...nouns, ...nounPhrases];
        for (const candidate of candidates) {
            const lowerCandidate = candidate.toLowerCase().trim();
            // Use comprehensive equipment database for validation
            if (equipmentMatcher.isKitchenEquipment(lowerCandidate)) {
                // Get canonical name for consistency
                const canonicalName = equipmentMatcher.getCanonicalName(lowerCandidate);
                if (!mentionedEquipment.includes(canonicalName)) {
                    mentionedEquipment.push(canonicalName);
                }
            }
        }
        // Enhanced matching using the comprehensive equipment matcher
        try {
            // Extract individual words and phrases to check against equipment database
            const words = stepText.toLowerCase().split(/\s+/);
            const phrases = [];
            // Create 2-3 word phrases for compound equipment detection
            for (let i = 0; i < words.length - 1; i++) {
                phrases.push(`${words[i]} ${words[i + 1]}`);
                if (i < words.length - 2) {
                    phrases.push(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
                }
            }
            // Check both individual words and phrases
            const allCandidates = [...words, ...phrases];
            for (const candidate of allCandidates) {
                if (candidate.length > 2) {
                    const equipmentMatch = equipmentMatcher.findEquipment(candidate);
                    if (equipmentMatch) {
                        const canonicalName = equipmentMatch.canonical_name;
                        if (!mentionedEquipment.includes(canonicalName)) {
                            mentionedEquipment.push(canonicalName);
                        }
                    }
                }
            }
        }
        catch (error) {
            console.warn('Equipment matcher failed:', error);
        }
        return mentionedEquipment;
    }
    /*
     * Extract timer information from atomic step
     */
    static extractTimerInfo(stepText) {
        const timers = [];
        // Enhanced time patterns
        const timePatterns = [
            // "for X minutes" or "for X-Y minutes"
            /for\s+(\d+)(?:\s*-\s*(\d+))?\s*(?:minutes?|mins?)/gi,
            // "X to Y minutes" or "X-Y minutes"
            /(\d+)(?:\s*(?:to|-)\s*(\d+))?\s*(?:minutes?|mins?)/gi,
            // "about X minutes" or "approximately X minutes"
            /(?:about|approximately|around)\s+(\d+)\s*(?:minutes?|mins?)/gi,
            // "until X minutes" or "after X minutes"
            /(?:until|after)\s+(\d+)\s*(?:minutes?|mins?)/gi,
            // Just "X mins" or "X minutes"
            /(\d+)\s*(?:minutes?|mins?)(?!\s*(?:degrees?|°))/gi
        ];
        for (const pattern of timePatterns) {
            let match;
            while ((match = pattern.exec(stepText)) !== null) {
                const time1 = parseInt(match[1]);
                const time2 = match[2] ? parseInt(match[2]) : null;
                if (time1 && !timers.includes(time1)) {
                    timers.push(time1);
                }
                if (time2 && !timers.includes(time2)) {
                    timers.push(time2);
                }
            }
        }
        return timers.sort((a, b) => a - b);
    }
    /*
     * Process compound instruction into atomic steps
     */
    static processCompoundInstruction(instructionText, startingStepNumber, availableIngredients = []) {
        // Ensure initialization
        if (!this.initialized) {
            throw new Error('AtomicInstructionParser must be initialized before use');
        }
        // Break into atomic steps
        const atomicTexts = this.breakIntoAtomicSteps(instructionText);
        const steps = [];
        for (let i = 0; i < atomicTexts.length; i++) {
            const stepText = atomicTexts[i];
            const stepNumber = startingStepNumber + i;
            // Extract all components using NLP
            const mainAction = this.extractMainAction(stepText);
            const mentionedIngredients = this.extractMentionedIngredients(stepText, availableIngredients);
            const mentionedEquipment = this.extractMentionedEquipment(stepText);
            const timers = this.extractTimerInfo(stepText);
            const step = {
                step_number: stepNumber,
                text: stepText,
                action: mainAction,
                mentioned_ingredients: mentionedIngredients,
                equipment: mentionedEquipment,
                timer_min: timers,
                temperature_f: null // Temperature extraction can be added separately
            };
            steps.push(step);
        }
        return steps;
    }
    /*
     * Process multiple compound instructions into atomic steps
     */
    static processMultipleInstructions(instructions, availableIngredients = []) {
        let currentStepNumber = 1;
        const allSteps = [];
        for (const instruction of instructions) {
            const atomicSteps = this.processCompoundInstruction(instruction, currentStepNumber, availableIngredients);
            allSteps.push(...atomicSteps);
            currentStepNumber += atomicSteps.length;
        }
        return allSteps;
    }
}
