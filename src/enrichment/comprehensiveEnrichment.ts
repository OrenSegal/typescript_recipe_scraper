import { Recipe, RecipeIngredient, InstructionStep, DietaryRestriction } from '../types.js';
import { RawScrapedRecipe } from '../scrapers/websiteScraper.js';
import { ProductionNERParser } from './productionNERParser.js';
import { AtomicInstructionParser } from './atomicInstructionParser.js';
import { ComprehensiveDietAnalyzer } from './comprehensiveDietAnalyzer.js';
import { processIngredient } from './ingredientParser.js';

// Missing enrichment modules - systematic integration
import { CookingMethodExtractor } from './cookingMethodExtractor.js';
import { detectMealTypes } from './smartCategorization.js';
import { getNutritionEnrichment } from './nutritionEnrichment.js';
import { generateRecipeEmbedding } from './alternativeEmbeddingGenerator.js';
import { validationNotesService } from './validationNotesService.js';

// Interfaces for enriched data structures
export interface EnrichedIngredient extends RecipeIngredient {
  // No additional fields - using base RecipeIngredient interface
}

export interface EnrichedInstruction extends InstructionStep {
  cooking_method?: string;
}

export interface EnrichedRecipe extends Recipe {
  completeness_score: number;
  parsing_confidence: number;
  nutrition_data_source: 'estimated' | 'api' | 'manual';
  last_enriched: Date;
  schema_version: string;
}

export interface QualityMetrics {
  completeness_score: number;
  parsing_confidence: number;
  data_quality_score: number;
}

/*
 * Comprehensive enrichment service for recipe data
 * Provides 100% completeness for social media recipes
 */
export class ComprehensiveEnrichment {
  
  /*
   * Initialize the enrichment system (placeholder for any required setup)
   */
  static async initialize(): Promise<void> {
    // Placeholder for initialization logic
    // Could initialize NLP models, API connections, etc.
    return Promise.resolve();
  }
  
  /*
   * Main enrichment method - enriches raw recipe data to achieve 100% completeness
   */
  static async enrichRecipe(rawRecipeData: RawScrapedRecipe, options: any = {}): Promise<EnrichedRecipe> {
    const enrichmentStartTime = Date.now();
    
    try {
      console.log(`🔄 Starting comprehensive enrichment for: ${rawRecipeData.title}`);
      
      // VALIDATION NOTES: Track enrichment start
      validationNotesService.addNote('info', 'comprehensive-enrichment', 
        `Starting enrichment for recipe: "${rawRecipeData.title}"`, {
          ingredients_count: rawRecipeData.ingredients?.length || 0,
          instructions_count: rawRecipeData.instructions?.length || 0,
          has_description: !!rawRecipeData.description,
          source_url: rawRecipeData.source_url
        });
      
      // Step 1: Enrich ingredients with validation tracking
      validationNotesService.addNote('info', 'comprehensive-enrichment', 'Starting ingredient enrichment');
      const enrichedIngredients = await ComprehensiveEnrichment.enrichIngredients(rawRecipeData.ingredients);
      
      // Validate ingredient enrichment results
      if (enrichedIngredients.length === 0 && rawRecipeData.ingredients?.length > 0) {
        validationNotesService.addNote('error', 'comprehensive-enrichment', 
          'All ingredients failed to enrich', {
            original_count: rawRecipeData.ingredients.length
          }, 'critical');
      } else if (enrichedIngredients.length < (rawRecipeData.ingredients?.length || 0)) {
        const lostIngredients = (rawRecipeData.ingredients?.length || 0) - enrichedIngredients.length;
        validationNotesService.addNote('warning', 'comprehensive-enrichment', 
          `${lostIngredients} ingredients lost during enrichment`, {
            original_count: rawRecipeData.ingredients?.length || 0,
            enriched_count: enrichedIngredients.length,
            loss_rate: (lostIngredients / (rawRecipeData.ingredients?.length || 1) * 100).toFixed(1) + '%'
          });
      } else {
        validationNotesService.addNote('success', 'comprehensive-enrichment', 
          `Successfully enriched ${enrichedIngredients.length} ingredients`);
      }
      
      // Step 2: Enrich instructions with validation tracking
      validationNotesService.addNote('info', 'comprehensive-enrichment', 'Starting instruction enrichment');
      const enrichedInstructions = await ComprehensiveEnrichment.enrichInstructions(rawRecipeData.instructions);
      
      // Step 3: Extract metadata
      const metadata = ComprehensiveEnrichment.extractComprehensiveMetadata(rawRecipeData);
      
      // Step 4: Estimate missing time data
      let prepTime = rawRecipeData.prep_time_minutes;
      let cookTime = rawRecipeData.cook_time_minutes;
      
      if (!prepTime) {
        prepTime = ComprehensiveEnrichment.estimatePrepTimeFromInstructions(enrichedInstructions);
      }
      if (!cookTime) {
        cookTime = ComprehensiveEnrichment.estimateCookTimeFromInstructions(enrichedInstructions);
      }
      
      // Step 5: Infer missing fields for social media recipes  
      const recipeData = rawRecipeData as any;
      let inferredCuisineType: string[] = recipeData.cuisines || [];
      let inferredTags: string[] = recipeData.tags || [];
      let inferredEffortLevel: number = recipeData.effort_level || 3;
      let inferredDietaryRestrictions: string[] = recipeData.dietary_restrictions || [];
      
      // Infer cuisine type if needed
      if (!recipeData.cuisines || recipeData.cuisines.length === 0) {
        inferredCuisineType = ComprehensiveEnrichment.inferCuisineFromIngredients(enrichedIngredients);
      }
      
      // Generate tags if needed
      if (!recipeData.tags || recipeData.tags.length === 0) {
        inferredTags = ComprehensiveEnrichment.generateTagsFromRecipe(rawRecipeData.title, rawRecipeData.description || '', enrichedIngredients);
      }
      
      // Estimate difficulty level if needed
      if (!recipeData.effort_level) {
        inferredEffortLevel = ComprehensiveEnrichment.inferEffortLevel(enrichedInstructions, enrichedIngredients);
      }
      
      // Analyze dietary restrictions if needed
      if (!recipeData.dietary_restrictions || recipeData.dietary_restrictions.length === 0) {
        inferredDietaryRestrictions = ComprehensiveEnrichment.analyzeDietaryRestrictions(enrichedIngredients);
      }
      
      // Build final recipe data with inferred fields
      const finalRecipeData = {
        ...rawRecipeData,
        ingredients: enrichedIngredients,
        instructions: enrichedInstructions,
        cuisines: inferredCuisineType || [],
        tags: inferredTags || [],
        effort_level: inferredEffortLevel,
        dietary_restrictions: inferredDietaryRestrictions,
        prep_time_minutes: prepTime,
        cook_time_minutes: cookTime,
        meal_types: recipeData.meal_types || []
      };
      
      // Step 6: Systematic enrichment using imported modules
        
        // Extract cooking method using CookingMethodExtractor
        const cookingMethod = CookingMethodExtractor.extractCookingMethod(enrichedInstructions);
        console.log(`🔥 Cooking method detected: ${cookingMethod}`);
        
        // Detect meal types using smartCategorization
        const detectedMealTypes = detectMealTypes(
          rawRecipeData.title,
          rawRecipeData.description || '',
          enrichedIngredients,
          enrichedInstructions,
          prepTime || 0,
          cookTime || 0
        );
        console.log(`🍽️ Meal types detected: ${detectedMealTypes.join(', ')}`);
        
        // Enrich nutrition data
        let nutritionData = recipeData.nutrition || null;
        let nutritionEnrichedIngredients = enrichedIngredients;
        try {
          const nutritionResult = await getNutritionEnrichment({
            ingredients: rawRecipeData.ingredients,
            servings: typeof rawRecipeData.servings === 'number' ? rawRecipeData.servings : 
                     typeof rawRecipeData.servings === 'string' ? parseInt(rawRecipeData.servings, 10) : null
          });
          if (nutritionResult.nutrition) {
            nutritionData = nutritionResult.nutrition;
            console.log(`🥗 Nutrition data enriched`);
          }
          if (nutritionResult.ingredients) {
            nutritionEnrichedIngredients = nutritionResult.ingredients as EnrichedIngredient[];
          }
        } catch (error) {
          console.warn('Failed to enrich nutrition data:', error);
        }
        
        // Generate recipe embedding using a properly structured Recipe object
        let embeddingData = recipeData.embedding || null;
        try {
          const tempRecipeForEmbedding = {
            title: rawRecipeData.title,
            source_url: rawRecipeData.source_url || '',
            description: rawRecipeData.description || '',
            ingredients: nutritionEnrichedIngredients,
            instructions: enrichedInstructions,
            cooking_method: [cookingMethod], // Add the required cooking_method field
            cuisines: finalRecipeData.cuisines || [],
            meal_types: detectedMealTypes,
            tags: finalRecipeData.tags || [],
            prep_time_minutes: prepTime,
            cook_time_minutes: cookTime,
            total_time_minutes: ComprehensiveEnrichment.calculateTotalTime(prepTime, cookTime),
            servings: rawRecipeData.servings,
            effort_level: inferredEffortLevel,
            health_score: null, // Will be calculated after embedding
            nutrition: nutritionData,
            image_url: rawRecipeData.image_url,
            is_public: true,
            suitable_for_diet: [],
            author: rawRecipeData.author
          } as Recipe;
          
          embeddingData = generateRecipeEmbedding(tempRecipeForEmbedding);
          console.log(`🧠 Recipe embedding generated (${embeddingData?.length || 0} dimensions)`);
        } catch (error) {
          console.warn('Failed to generate embedding:', error);
        }
        
        // Calculate health score (basic implementation using ingredient analysis)
        const healthScore = ComprehensiveEnrichment.calculateBasicHealthScore(nutritionEnrichedIngredients, nutritionData);
        console.log(`💚 Health score calculated: ${healthScore}`);
        
        // Step 7: Calculate quality metrics
        const qualityMetrics = ComprehensiveEnrichment.calculateQualityMetrics(
          nutritionEnrichedIngredients,
          enrichedInstructions,
          finalRecipeData
        );
        
        // Step 8: Build enriched recipe with all systematic enrichments
        const { effort_level: rawEffortLevel, ...cleanFinalRecipeData } = finalRecipeData;
        const enrichedRecipe: EnrichedRecipe = {
          ...cleanFinalRecipeData,
          created_at: recipeData.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
          created_by: rawRecipeData.created_by || undefined,
          author: ComprehensiveEnrichment.extractAuthor(rawRecipeData.author, rawRecipeData.source_url),
          servings: rawRecipeData.servings || 4,
          total_time_minutes: ComprehensiveEnrichment.calculateTotalTime(prepTime, cookTime),
          
          // Systematic enrichments - all missing fields now completed
          ingredients: nutritionEnrichedIngredients,
          meal_types: detectedMealTypes,
          cooking_method: ComprehensiveEnrichment.inferCookingMethod(enrichedInstructions),
          nutrition: nutritionData,
          embedding: embeddingData,
          health_score: typeof healthScore === 'number' ? healthScore : null,
          
          // Quality metrics
          completeness_score: qualityMetrics.completeness_score,
          parsing_confidence: qualityMetrics.parsing_confidence,
          nutrition_data_source: nutritionData ? 'api' as const : 'estimated' as const,
          last_enriched: new Date(),
          schema_version: '2.0',
          
          // Additional required fields
        
        suitable_for_diet: ComprehensiveEnrichment.calculateDietSuitability(nutritionEnrichedIngredients),
          is_public: true,
          
          // Type-corrected effort_level (convert string to number if needed)
          effort_level: typeof rawEffortLevel === 'string' ? 3 : rawEffortLevel
      };
      
      console.log(`✅ Recipe enriched successfully with ${qualityMetrics.completeness_score}% completeness`);
      return enrichedRecipe;
      
    } catch (error: any) {
      console.error('Error in comprehensive enrichment:', error);
      throw new Error(`Enrichment failed: ${error.message}`);
    }
  }
  
  /*
   * Enriches ingredients using NER parsing and nutrition data
   */
  static async enrichIngredients(ingredients: string[]): Promise<EnrichedIngredient[]> {
    const enriched: EnrichedIngredient[] = [];
    
    for (const ingredient of ingredients) {
      try {
        // Use the robust ingredient parser for proper atomicization
        const parsed = await processIngredient({ name: ingredient });
        
        if (parsed) {
          enriched.push({
            text: ingredient,
            name: parsed.name, // Clean ingredient name from robust parser
            quantity: parsed.quantity,
            unit: parsed.unit,
            notes: parsed.notes,
            category: parsed.category,
            grams: parsed.grams,
            order_index: enriched.length
          });
        }
      } catch (error) {
        console.warn(`Failed to parse ingredient "${ingredient}":`, error);
        // Fallback for parsing errors
        enriched.push({
          text: ingredient,
          name: ingredient,
          quantity: undefined,
          unit: undefined,
          notes: undefined,
          category: undefined,
          grams: undefined,
          order_index: enriched.length
        });
      }
    }
    
    return enriched;
  }
  
  /*
   * Enriches instructions with atomic parsing and comprehensive NLP extraction
   * Breaks compound instructions into atomic steps with full ingredient and equipment extraction
   */
  static async enrichInstructions(instructions: string[], availableIngredients: EnrichedIngredient[] = []): Promise<EnrichedInstruction[]> {
    try {
      // Initialize atomic instruction parser
      await AtomicInstructionParser.initialize();
      
      // Convert enriched ingredients to RecipeIngredient format for reference
      const ingredientReferences: RecipeIngredient[] = availableIngredients.map((ing, index) => ({
        text: ing.text || ing.name, // Use original text or fallback to name
        name: ing.name,
        quantity: ing.quantity,
        unit: ing.unit,
        notes: ing.notes,
        category: ing.category,
        grams: ing.grams,
        order_index: index
      }));
      
      // Process each instruction with atomic parsing
      const atomicSteps = AtomicInstructionParser.processMultipleInstructions(
        instructions,
        ingredientReferences
      );
      
      // Convert atomic steps to EnrichedInstruction format
      const enriched: EnrichedInstruction[] = atomicSteps.map(step => {
        // Extract cooking method from action or text
        const cookingMethod = step.action || ComprehensiveEnrichment.extractCookingMethod(step.text);
        
        return {
          step_number: step.step_number,
          text: step.text,
          action: step.action,
          timer_min: step.timer_min,
          temperature_f: step.temperature_f,
          equipment: step.equipment,
          mentioned_ingredients: step.mentioned_ingredients,
          cooking_method: cookingMethod
        };
      });
      
      console.log(`✅ Processed ${instructions.length} compound instructions into ${enriched.length} atomic steps`);
      return enriched;
      
    } catch (error) {
      console.warn('Atomic instruction parsing failed, falling back to basic parsing:', error);
      
      // Fallback to basic parsing if atomic parsing fails
      const enriched: EnrichedInstruction[] = [];
      
      instructions.forEach((instruction, index) => {
        // Handle both string and object instruction formats
        const instructionText = typeof instruction === 'string' ? instruction : instruction || '';
        
        const equipment = ComprehensiveEnrichment.extractEquipment(instructionText);
        const cookingMethod = ComprehensiveEnrichment.extractCookingMethod(instructionText);
        const temperature = ComprehensiveEnrichment.extractTemperature(instructionText);
        const timing = ComprehensiveEnrichment.extractTiming(instructionText);
        
        enriched.push({
          step_number: index + 1,
          text: instructionText,
          action: null,
          timer_min: timing ? [timing] : [],
          temperature_f: temperature,
          equipment: [],
          mentioned_ingredients: [],
          cooking_method: cookingMethod
        });
      });
      
      return enriched;
    }
  }
  
  /*
   * Extracts comprehensive metadata from raw recipe data
   */
  static extractComprehensiveMetadata(rawRecipeData: RawScrapedRecipe): any {
    return {
      cuisineTypes: [],
      dietaryRestrictions: [],
      difficultyLevel: 'Medium',
      equipmentNeeded: []
    };
  }
  
  /*
   * Simple ingredient parsing fallback
   */
  static parseIngredientFallback(ingredient: string): any {
    // Simple parsing logic as fallback
    const parts = ingredient.split(' ');
    const quantity = parts.find(part => /^\d/.test(part));
    const unit = parts.find(part => ['cup', 'cups', 'tbsp', 'tsp', 'oz', 'lb', 'g', 'kg'].includes(part.toLowerCase()));
    
    return {
      name: parts.slice(-2).join(' '), // Last two words as name
      quantity: quantity ? parseFloat(quantity) : null,
      unit: unit || null,
      notes: null,
      category: null,
      grams: null,
      confidence: 0.6
    };
  }
  
  /*
   * Estimate prep time from instructions
   */
  static estimatePrepTimeFromInstructions(instructions: EnrichedInstruction[]): number {
    let prepTime = 0;
    
    instructions.forEach(inst => {
      const text = inst.text.toLowerCase();
      if (text.includes('prep') || text.includes('chop') || text.includes('dice') || text.includes('mix')) {
        prepTime += 5; // 5 minutes per prep step
      }
    });
    
    return Math.max(prepTime, 10); // Minimum 10 minutes prep time
  }
  
  /*
   * Estimate cook time from instructions
   */
  static estimateCookTimeFromInstructions(instructions: EnrichedInstruction[]): number {
    let cookTime = 0;
    
    instructions.forEach(inst => {
      const text = inst.text.toLowerCase();
      
      if (inst.timer_min && inst.timer_min.length > 0) {
        cookTime += Math.max(...inst.timer_min);
      } else {
        // Estimate based on cooking methods
        if (text.includes('bake') || text.includes('roast')) {
          cookTime += 30;
        } else if (text.includes('simmer') || text.includes('boil')) {
          cookTime += 15;
        } else if (text.includes('fry') || text.includes('saute')) {
          cookTime += 8;
        }
      }
    });
    
    return Math.max(cookTime, 5); // Minimum 5 minutes cook time
  }
  
  /*
   * Infer cuisine type from ingredients
   */
  static inferCuisineFromIngredients(ingredients: EnrichedIngredient[]): string[] {
    const ingredientNames = ingredients.map(i => i.name.toLowerCase() || i.name.toLowerCase());
    
    // Italian cuisine indicators
    if (ingredientNames.some(name => 
      ['pasta', 'parmesan', 'mozzarella', 'basil', 'oregano', 'tomato'].some(italian => name.includes(italian))
    )) {
      return ['Italian'];
    }
    
    // Asian cuisine indicators
    if (ingredientNames.some(name => 
      ['soy sauce', 'ginger', 'garlic', 'sesame', 'rice', 'noodles'].some(asian => name.includes(asian))
    )) {
      return ['Asian'];
    }
    
    // Mexican cuisine indicators
    if (ingredientNames.some(name => 
      ['cumin', 'chili', 'cilantro', 'lime', 'avocado', 'beans'].some(mexican => name.includes(mexican))
    )) {
      return ['Mexican'];
    }
    
    return ['International'];
  }
  
  /*
   * Generate tags from recipe content
   */
  static generateTagsFromRecipe(title: string, description: string, ingredients: EnrichedIngredient[]): string[] {
    const tags: string[] = [];
    const text = `${title} ${description}`.toLowerCase();
    
    // Meal type tags
    if (text.includes('breakfast') || text.includes('morning')) tags.push('breakfast');
    if (text.includes('lunch')) tags.push('lunch');
    if (text.includes('dinner') || text.includes('supper')) tags.push('dinner');
    if (text.includes('dessert') || text.includes('sweet')) tags.push('dessert');
    if (text.includes('snack')) tags.push('snack');
    
    // Cooking method tags
    if (text.includes('bake') || text.includes('oven')) tags.push('baked');
    if (text.includes('grill')) tags.push('grilled');
    if (text.includes('fry')) tags.push('fried');
    if (text.includes('no-cook') || text.includes('raw')) tags.push('no-cook');
    
    // Add ingredient-based tags
    if (ingredients.some(i => i.category === 'Vegetables')) tags.push('vegetable-based');
    if (ingredients.some(i => i.category === 'Meat')) tags.push('meat');
    
    return tags.length > 0 ? tags : ['homemade'];
  }
  
  /*
   * Infer difficulty level from complexity
   */
  static inferEffortLevel(instructions: EnrichedInstruction[], ingredients: EnrichedIngredient[]): number {
    const complexity = instructions.length + ingredients.length;
    if (complexity <= 6) return 1; // Easy
    if (complexity <= 9) return 2; // Medium-Easy
    if (complexity <= 12) return 3; // Medium
    if (complexity <= 15) return 4; // Medium-Hard
    return 5; // Hard
  }
  
  /*
   * Analyze dietary restrictions from ingredients
   */
  static analyzeDietaryRestrictions(ingredients: EnrichedIngredient[]): string[] {
    const restrictions: string[] = [];
    const ingredientNames = ingredients.map(i => i.name.toLowerCase() || i.name.toLowerCase());
    
    // Check for common dietary restrictions
    const hasMeat = ingredientNames.some(name => 
      ['chicken', 'beef', 'pork', 'lamb', 'turkey', 'fish', 'salmon', 'tuna'].some(meat => name.includes(meat))
    );
    
    const hasDairy = ingredientNames.some(name => 
      ['milk', 'cheese', 'butter', 'cream', 'yogurt'].some(dairy => name.includes(dairy))
    );
    
    const hasGluten = ingredientNames.some(name => 
      ['flour', 'wheat', 'bread', 'pasta'].some(gluten => name.includes(gluten))
    );
    
    if (!hasMeat) restrictions.push('vegetarian');
    if (!hasMeat && !hasDairy) restrictions.push('vegan');
    if (!hasGluten) restrictions.push('gluten-free');
    if (!hasDairy) restrictions.push('dairy-free');
    
    return restrictions;
  }
  
  /*
   * Calculate quality metrics for enriched recipe
   */
  static calculateQualityMetrics(
    ingredients: EnrichedIngredient[], 
    instructions: EnrichedInstruction[], 
    recipeData: any
  ): QualityMetrics {
    let completenessScore = 0;
    const totalFields = 15; // Total number of important fields
    
    // Check required fields
    if (recipeData.title) completenessScore++;
    if (recipeData.description) completenessScore++;
    if (recipeData.ingredients && recipeData.ingredients.length > 0) completenessScore++;
    if (recipeData.instructions && recipeData.instructions.length > 0) completenessScore++;
    if (recipeData.prep_time_minutes) completenessScore++;
    if (recipeData.cook_time_minutes) completenessScore++;
    if (recipeData.servings) completenessScore++;
    if (recipeData.cuisines && recipeData.cuisines.length > 0) completenessScore++;
    if (recipeData.effort_level) completenessScore++;
    if (recipeData.dietary_restrictions && recipeData.dietary_restrictions.length > 0) completenessScore++;
    if (recipeData.tags && recipeData.tags.length > 0) completenessScore++;
    if (recipeData.author) completenessScore++;
    if (recipeData.image_url) completenessScore++;
    if (recipeData.source_url) completenessScore++;
    if (ingredients.length >= 3) completenessScore++; // At least 3 ingredients
    
    const completenessPercentage = Math.round((completenessScore / totalFields) * 100);
    
    return {
      completeness_score: completenessPercentage,
      parsing_confidence: Math.min(95, 70 + (ingredients.length * 2) + (instructions.length * 3)),
      data_quality_score: Math.min(100, completenessPercentage + 10)
    };
  }
  
  /*
   * Calculate total time from prep and cook times
   */
  static calculateTotalTime(prepTime?: number | null, cookTime?: number | null): number | null {
    if (!prepTime && !cookTime) return null;
    return (prepTime || 0) + (cookTime || 0);
  }
  
  /*
   * Extract author information
   */
  static extractAuthor(author?: string | null, sourceUrl?: string): string | undefined {
    if (author) return author;
    
    // Extract from URL if possible
    if (sourceUrl) {
      if (sourceUrl.includes('tiktok.com/@')) {
        const match = sourceUrl.match(/@([^/]+)/);
        return match ? match[1] : undefined;
      }
      if (sourceUrl.includes('instagram.com/')) {
        const match = sourceUrl.match(/instagram\.com\/([^/]+)/);
        return match ? match[1] : undefined;
      }
    }
    
    return undefined;
  }
  
  /*
   * Helper methods for instruction enrichment
   */
  static extractEquipment(instruction: string | any): string[] {
    const equipment: string[] = [];
    // Handle both string and object formats
    const instructionText = typeof instruction === 'string' ? instruction : instruction.text || '';
    const text = instructionText.toLowerCase();
    
    const equipmentTerms = [
      'oven', 'pan', 'pot', 'skillet', 'bowl', 'whisk', 'spatula', 
      'knife', 'cutting board', 'mixer', 'blender', 'grill'
    ];
    
    equipmentTerms.forEach(term => {
      if (text.includes(term)) {
        equipment.push(term);
      }
    });
    
    return equipment;
  }
  
  static extractCookingMethod(instruction: string | any): string | undefined {
    // Handle both string and object formats
    const instructionText = typeof instruction === 'string' ? instruction : instruction.text || '';
    const text = instructionText.toLowerCase();
    const methods = ['bake', 'fry', 'boil', 'simmer', 'grill', 'roast', 'saute', 'steam'];
    
    for (const method of methods) {
      if (text.includes(method)) {
        return method;
      }
    }
    
    return undefined;
  }
  
  static extractTemperature(instruction: string): number | undefined {
    const tempMatch = instruction.match(/(\d+)\s*°?[CF]/i);
    return tempMatch ? parseInt(tempMatch[1]) : undefined;
  }
  
  static extractTiming(instruction: string): number | undefined {
    const timeMatch = instruction.match(/(\d+)\s*(minute|min|hour|hr)/i);
    if (timeMatch) {
      const value = parseInt(timeMatch[1]);
      const unit = timeMatch[2].toLowerCase();
      return unit.startsWith('h') ? value * 60 : value;
    }
    return undefined;
  }

  /*
   * Infer cooking method from instructions
   */
  static inferCookingMethod(instructions: InstructionStep[]): string[] {
    const methods = ['baking', 'frying', 'grilling', 'roasting', 'sautéing', 'boiling', 'steaming'];
    const instructionText = instructions.map(step => step.text.toLowerCase()).join(' ');
    const foundMethods: string[] = [];
    
    for (const method of methods) {
      if (instructionText.includes(method) || instructionText.includes(method.slice(0, -3))) {
        foundMethods.push(method.charAt(0).toUpperCase() + method.slice(1));
      }
    }
    
    return foundMethods.length > 0 ? foundMethods : ['Mixed'];
  }

  /*
   * Calculate basic health score using ingredient analysis and nutrition data
   */
  static calculateBasicHealthScore(ingredients: EnrichedIngredient[], nutrition: any): number {
    let healthScore = 50; // Base score
    
    // Positive points for healthy ingredients
    const healthyCategories = ['Vegetables', 'Fruits', 'Herbs & Spices', 'Legumes & Pulses'];
    const healthyCount = ingredients.filter(ing => 
      healthyCategories.includes(ing.category || '')
    ).length;
    healthScore += Math.min(healthyCount * 5, 25); // Max 25 points
    
    // Negative points for less healthy ingredients
    const unhealthyCategories = ['Fats & Oils', 'Sugars & Sweeteners'];
    const unhealthyCount = ingredients.filter(ing => 
      unhealthyCategories.includes(ing.category || '')
    ).length;
    healthScore -= Math.min(unhealthyCount * 3, 15); // Max -15 points
    
    // Nutrition-based scoring
    if (nutrition) {
      // Positive for high fiber, protein
      if (nutrition.fiber_g && nutrition.fiber_g > 5) healthScore += 10;
      if (nutrition.protein_g && nutrition.protein_g > 15) healthScore += 10;
      
      // Negative for high sodium, saturated fat
      if (nutrition.sodium_mg && nutrition.sodium_mg > 1000) healthScore -= 10;
      if (nutrition.saturated_fat_g && nutrition.saturated_fat_g > 10) healthScore -= 10;
    }
    
    // Ensure score is between 0-100
    return Math.max(0, Math.min(100, healthScore));
  }

  /*
   * Calculate comprehensive diet suitability based on ingredients and nutrition
   */
  static calculateDietSuitability(
    ingredients: RecipeIngredient[], 
    nutrition?: any
  ): DietaryRestriction[] {
    // Comprehensive analyzer is now imported at the top of the file.
    return ComprehensiveDietAnalyzer.calculateDietSuitability(ingredients, nutrition);
  }
}

export default ComprehensiveEnrichment;
