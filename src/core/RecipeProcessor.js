/*
 * Core Recipe Processor - Modular, SOLID-compliant recipe processing
 * Follows KISS, DRY, YAGNI principles for maintainable code
 */
import { ComprehensiveEnrichment } from '../enrichment/comprehensiveEnrichment.js';
/*
 * Single Responsibility: Process raw recipe data into enriched Recipe objects
 * Open/Closed: Extensible for new processing strategies without modification
 * Liskov Substitution: Can be substituted with other processors
 * Interface Segregation: Clean, focused interface
 * Dependency Inversion: Depends on abstractions, not concretions
 */
export class RecipeProcessor {
    static instance;
    constructor() { }
    /*
     * Singleton pattern for resource efficiency (YAGNI - only create when needed)
     */
    static getInstance() {
        if (!RecipeProcessor.instance) {
            RecipeProcessor.instance = new RecipeProcessor();
        }
        return RecipeProcessor.instance;
    }
    /*
     * Main processing method - KISS principle: simple, clear interface
     */
    async processRecipe(rawRecipe, sourceUrl, include_ai = true, include_nutrition = true, generate_embedding = true) {
        const startTime = Date.now();
        try {
            // Initialize enrichment system
            await ComprehensiveEnrichment.initialize();
            // Process recipe with comprehensive enrichment
            const enrichedRecipe = await ComprehensiveEnrichment.enrichRecipe({
                title: rawRecipe.title,
                description: rawRecipe.description,
                source_url: sourceUrl,
                image_url: rawRecipe.image_url,
                servings: typeof rawRecipe.servings === 'number' ? rawRecipe.servings : undefined,
                prep_time_minutes: rawRecipe.prep_time_minutes,
                cook_time_minutes: rawRecipe.cook_time_minutes,
                ingredients: rawRecipe.ingredients,
                instructions: rawRecipe.instructions,
                author: rawRecipe.author
            });
            // Convert to Recipe format
            const recipe = this.mapToRecipeSchema(enrichedRecipe, rawRecipe);
            // Calculate metrics
            const processingTime = Date.now() - startTime;
            const completenessScore = this.calculateCompletenessScore(recipe);
            const parsingConfidence = this.calculateParsingConfidence(recipe);
            return {
                recipe,
                processingTime,
                completenessScore,
                parsingConfidence
            };
        }
        catch (error) {
            console.error('[RecipeProcessor] Processing failed:', error);
            throw new Error(`Recipe processing failed: ${error}`);
        }
    }
    /*
     * DRY principle: Centralized recipe mapping logic
     */
    mapToRecipeSchema(enrichedRecipe, rawRecipe) {
        return {
            title: enrichedRecipe.title,
            description: enrichedRecipe.description,
            ingredients: enrichedRecipe.ingredients || [],
            instructions: enrichedRecipe.instructions || [],
            servings: typeof rawRecipe.servings === 'number' ? rawRecipe.servings : 4,
            prep_time_minutes: rawRecipe.prep_time_minutes || null,
            cook_time_minutes: rawRecipe.cook_time_minutes || null,
            total_time_minutes: rawRecipe.total_time_minutes || null,
            effort_level: enrichedRecipe.effort_level || 1,
            dietary_restrictions: enrichedRecipe.dietaryRestrictions || null,
            tags: enrichedRecipe.tags || [],
            cuisines: enrichedRecipe.cuisines || [],
            meal_types: enrichedRecipe.meal_types || [],
            cooking_method: enrichedRecipe.cooking_method || [],
            suitable_for_diet: enrichedRecipe.suitable_for_diet || [],
            source_url: rawRecipe.source_url,
            image_url: rawRecipe.image_url || null,
            author: rawRecipe.author || undefined,
            created_by: null,
            is_public: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            // Enrichment scores
            completeness_score: enrichedRecipe.completenessScore || 75,
            parsing_confidence: enrichedRecipe.parsingConfidence || 80
        };
    }
    /*
     * KISS principle: Simple completeness calculation
     */
    calculateCompletenessScore(recipe) {
        let score = 0;
        const maxScore = 100;
        // Basic fields (40 points)
        if (recipe.title)
            score += 10;
        if (recipe.description)
            score += 10;
        if (recipe.ingredients.length > 0)
            score += 10;
        if (recipe.instructions.length > 0)
            score += 10;
        // Timing information (20 points)
        if (recipe.prep_time_minutes)
            score += 10;
        if (recipe.cook_time_minutes)
            score += 10;
        // Metadata (20 points)
        if (recipe.servings)
            score += 5;
        if (recipe.effort_level)
            score += 5;
        if (recipe.cuisines && recipe.cuisines.length > 0)
            score += 5;
        if (recipe.author)
            score += 5;
        // Additional details (20 points)
        if (recipe.image_url)
            score += 10;
        if (recipe.dietary_restrictions && recipe.dietary_restrictions.length > 0)
            score += 5;
        if (recipe.tags.length > 0)
            score += 5;
        return Math.min(score, maxScore);
    }
    /*
     * KISS principle: Simple confidence calculation
     */
    calculateParsingConfidence(recipe) {
        let confidence = 50; // Base confidence
        // Ingredient parsing quality
        if (recipe.ingredients.length > 0) {
            const avgIngredientLength = recipe.ingredients.reduce((sum, ing) => sum + (ing.name?.length || 0), 0) / recipe.ingredients.length;
            if (avgIngredientLength > 3)
                confidence += 15;
        }
        // Instruction parsing quality
        if (recipe.instructions.length > 0) {
            const avgInstructionLength = recipe.instructions.reduce((sum, inst) => sum + (inst.text?.length || 0), 0) / recipe.instructions.length;
            if (avgInstructionLength > 20)
                confidence += 15;
        }
        // Metadata completeness
        if (recipe.servings && recipe.prep_time_minutes)
            confidence += 10;
        if (recipe.cuisines && recipe.cuisines.length > 0)
            confidence += 5;
        if (recipe.effort_level && recipe.effort_level !== 3)
            confidence += 5; // Non-default value
        return Math.min(confidence, 100);
    }
    /*
     * Simple ID generation - YAGNI principle
     */
    generateId() {
        return `recipe_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}
/*
 * Factory pattern for creating processors - SOLID compliance
 */
export class ProcessorFactory {
    static createProcessor() {
        return RecipeProcessor.getInstance();
    }
}
/*
 * Utility functions - DRY principle
 */
export class ProcessingUtils {
    static validateProcessingOptions(options) {
        return typeof options.include_ai === 'boolean' &&
            typeof options.include_nutrition === 'boolean' &&
            typeof options.generate_embedding === 'boolean';
    }
    static getDefaultOptions() {
        return {
            include_ai: false,
            include_nutrition: true,
            generate_embedding: false
        };
    }
}
