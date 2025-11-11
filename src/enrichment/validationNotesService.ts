/*
 * Centralized Validation Notes Service
 * 
 * Provides comprehensive validation notes tracking throughout the enrichment pipeline
 * to help with debugging, quality assurance, and data integrity monitoring.
 * 
 * Features:
 * - Centralized validation notes collection
 * - Categorized validation issues (errors, warnings, info)
 * - Performance and quality metrics tracking
 * - Debugging and troubleshooting support
 * - Export capabilities for analysis
 */

export interface ValidationNote {
  timestamp: string;
  category: 'error' | 'warning' | 'info' | 'success';
  component: string; // e.g., 'ingredient-parser', 'nutrition-enrichment', 'ocr-processor'
  message: string;
  context?: Record<string, any>; // Additional context data
  severity?: 'low' | 'medium' | 'high' | 'critical';
}

export interface ValidationSummary {
  total_notes: number;
  errors: number;
  warnings: number;
  info: number;
  success: number;
  components: Record<string, number>;
  severity_distribution: Record<string, number>;
  recent_issues: ValidationNote[];
}

export interface EnrichmentValidationResult {
  success: boolean;
  validation_notes: ValidationNote[];
  quality_score: number;
  completeness_score: number;
  confidence_score: number;
  processing_time_ms: number;
  components_processed: string[];
}

export class ValidationNotesService {
  private static instance: ValidationNotesService;
  private notes: ValidationNote[] = [];
  private componentMetrics: Map<string, {
    total: number;
    errors: number;
    warnings: number;
    success: number;
    average_processing_time: number;
  }> = new Map();

  private constructor() {}

  /**
   * Singleton pattern for centralized validation tracking
   */
  public static getInstance(): ValidationNotesService {
    if (!ValidationNotesService.instance) {
      ValidationNotesService.instance = new ValidationNotesService();
    }
    return ValidationNotesService.instance;
  }

  /**
   * Add a validation note
   */
  public addNote(
    category: ValidationNote['category'],
    component: string,
    message: string,
    context?: Record<string, any>,
    severity: ValidationNote['severity'] = 'medium'
  ): void {
    const note: ValidationNote = {
      timestamp: new Date().toISOString(),
      category,
      component,
      message,
      context,
      severity
    };

    this.notes.push(note);
    this.updateComponentMetrics(component, category);

    // Log important issues immediately
    if (category === 'error' || severity === 'critical') {
      console.error(`🚨 [${component}] ${message}`, context || '');
    } else if (category === 'warning' || severity === 'high') {
      console.warn(`⚠️ [${component}] ${message}`, context || '');
    } else if (category === 'success') {
      console.log(`✅ [${component}] ${message}`, context || '');
    } else {
      console.info(`ℹ️ [${component}] ${message}`, context || '');
    }

    // Keep only recent notes to prevent memory issues
    if (this.notes.length > 10000) {
      this.notes = this.notes.slice(-5000);
    }
  }

  /**
   * Add multiple validation notes from enrichment results
   */
  public addNotesFromResults(
    component: string,
    results: {
      success: boolean;
      validation_notes?: string[];
      confidence_score?: number;
      processing_time?: number;
      errors?: string[];
      warnings?: string[];
    }
  ): void {
    const startTime = Date.now();

    // Add success/failure note
    if (results.success) {
      this.addNote('success', component, 'Processing completed successfully', {
        confidence_score: results.confidence_score,
        processing_time: results.processing_time
      });
    } else {
      this.addNote('error', component, 'Processing failed', {
        confidence_score: results.confidence_score,
        processing_time: results.processing_time
      }, 'high');
    }

    // Add specific validation notes
    if (results.validation_notes) {
      results.validation_notes.forEach(note => {
        this.addNote('info', component, note);
      });
    }

    // Add errors
    if (results.errors) {
      results.errors.forEach(error => {
        this.addNote('error', component, error, undefined, 'high');
      });
    }

    // Add warnings
    if (results.warnings) {
      results.warnings.forEach(warning => {
        this.addNote('warning', component, warning);
      });
    }

    // Add performance note if processing was slow
    if (results.processing_time && results.processing_time > 1000) {
      this.addNote('warning', component, `Slow processing detected: ${results.processing_time}ms`, {
        processing_time: results.processing_time
      }, 'medium');
    }

    // Add confidence score note if low
    if (results.confidence_score !== undefined && results.confidence_score < 0.7) {
      this.addNote('warning', component, `Low confidence score: ${results.confidence_score.toFixed(2)}`, {
        confidence_score: results.confidence_score
      }, results.confidence_score < 0.5 ? 'high' : 'medium');
    }
  }

  /**
   * Validate ingredient parsing results
   */
  public validateIngredientParsing(
    ingredient: any,
    originalText: string,
    component: string = 'ingredient-parser'
  ): void {
    if (!ingredient) {
      this.addNote('error', component, `Failed to parse ingredient: "${originalText}"`, { originalText }, 'high');
      return;
    }

    // Check required fields
    if (!ingredient.name || ingredient.name.trim().length === 0) {
      this.addNote('error', component, `Ingredient missing name: "${originalText}"`, { ingredient }, 'high');
    }

    if (!ingredient.text) {
      this.addNote('warning', component, `Ingredient missing original text: "${originalText}"`, { ingredient });
    }

    // Check data quality
    if (ingredient.quantity === null && ingredient.unit) {
      this.addNote('warning', component, `Ingredient has unit but no quantity: "${originalText}"`, { ingredient });
    }

    if (ingredient.quantity && !ingredient.unit) {
      this.addNote('info', component, `Ingredient has quantity but no unit: "${originalText}"`, { ingredient });
    }

    if (!ingredient.category) {
      this.addNote('info', component, `Ingredient missing category: "${originalText}"`, { ingredient });
    }

    if (ingredient.grams === null && ingredient.quantity && ingredient.unit) {
      this.addNote('warning', component, `Failed to calculate grams for ingredient: "${originalText}"`, { ingredient });
    }

    // Check for ingredient linking
    if (!ingredient.id) {
      this.addNote('info', component, `Ingredient not linked to master table: "${originalText}"`, { ingredient });
    }

    this.addNote('success', component, `Successfully parsed ingredient: "${ingredient.name}"`, { 
      originalText,
      hasQuantity: !!ingredient.quantity,
      hasUnit: !!ingredient.unit,
      hasCategory: !!ingredient.category,
      hasGrams: !!ingredient.grams,
      isLinked: !!ingredient.id
    });
  }

  /**
   * Validate nutrition enrichment results
   */
  public validateNutritionEnrichment(
    nutrition: any,
    ingredientsCount: number,
    component: string = 'nutrition-enrichment'
  ): void {
    if (!nutrition) {
      this.addNote('warning', component, 'No nutrition data generated', { ingredientsCount }, 'medium');
      return;
    }

    const requiredFields = ['calories', 'proteinG', 'fatG', 'carbohydratesG'];
    const missingFields = requiredFields.filter(field => nutrition[field] === undefined || nutrition[field] === null);

    if (missingFields.length > 0) {
      this.addNote('warning', component, `Missing nutrition fields: ${missingFields.join(', ')}`, { 
        nutrition, missingFields, ingredientsCount 
      });
    }

    // Check for reasonable values
    if (nutrition.calories && nutrition.calories < 10) {
      this.addNote('warning', component, `Unusually low calories: ${nutrition.calories}`, { nutrition });
    }

    if (nutrition.calories && nutrition.calories > 2000) {
      this.addNote('info', component, `High calorie recipe: ${nutrition.calories} calories`, { nutrition });
    }

    // Check macronutrient balance
    const totalMacros = (nutrition.proteinG || 0) + (nutrition.fatG || 0) + (nutrition.carbohydratesG || 0);
    if (totalMacros === 0) {
      this.addNote('error', component, 'No macronutrient data calculated', { nutrition }, 'high');
    } else if (totalMacros < 5) {
      this.addNote('warning', component, `Very low total macronutrients: ${totalMacros}g`, { nutrition });
    }

    this.addNote('success', component, `Nutrition enrichment completed with ${requiredFields.length - missingFields.length}/${requiredFields.length} fields`, {
      nutrition,
      completeness: (requiredFields.length - missingFields.length) / requiredFields.length
    });
  }

  /**
   * Validate OCR processing results
   */
  public validateOCRProcessing(
    ocrResult: any,
    component: string = 'ocr-processor'
  ): void {
    if (!ocrResult) {
      this.addNote('error', component, 'OCR processing returned no results', undefined, 'high');
      return;
    }

    if (!ocrResult.extractedText || ocrResult.extractedText.length < 10) {
      this.addNote('warning', component, 'Insufficient text extracted from OCR', { 
        textLength: ocrResult.extractedText?.length || 0 
      }, 'medium');
    }

    if (!ocrResult.ingredients || ocrResult.ingredients.length === 0) {
      this.addNote('warning', component, 'No ingredients detected in OCR text', { ocrResult });
    }

    if (!ocrResult.instructions || ocrResult.instructions.length === 0) {
      this.addNote('warning', component, 'No instructions detected in OCR text', { ocrResult });
    }

    if (ocrResult.confidence !== undefined && ocrResult.confidence < 0.7) {
      this.addNote('warning', component, `Low OCR confidence: ${ocrResult.confidence.toFixed(2)}`, { 
        ocrResult 
      }, ocrResult.confidence < 0.5 ? 'high' : 'medium');
    }

    this.addNote('info', component, `OCR processing completed`, {
      textLength: ocrResult.extractedText?.length || 0,
      ingredientsCount: ocrResult.ingredients?.length || 0,
      instructionsCount: ocrResult.instructions?.length || 0,
      confidence: ocrResult.confidence
    });
  }

  /**
   * Validate recipe completeness and quality
   */
  public validateRecipeQuality(
    recipe: any,
    component: string = 'recipe-validator'
  ): EnrichmentValidationResult {
    const startTime = Date.now();
    const validationNotes: ValidationNote[] = [];
    let qualityScore = 0;
    let completenessScore = 0;
    const componentsProcessed: string[] = [component];

    // Required fields validation
    const requiredFields = ['title', 'ingredients', 'instructions'];
    const missingRequired = requiredFields.filter(field => !recipe[field] || 
      (Array.isArray(recipe[field]) && recipe[field].length === 0));

    if (missingRequired.length === 0) {
      completenessScore += 30;
      qualityScore += 20;
    } else {
      this.addNote('error', component, `Missing required fields: ${missingRequired.join(', ')}`, {
        recipe: { title: recipe.title, ingredientsCount: recipe.ingredients?.length, instructionsCount: recipe.instructions?.length }
      }, 'critical');
    }

    // Optional but important fields
    const importantFields = ['description', 'prep_time_minutes', 'cook_time_minutes', 'servings'];
    const hasImportant = importantFields.filter(field => recipe[field] !== undefined && recipe[field] !== null).length;
    completenessScore += (hasImportant / importantFields.length) * 25;
    qualityScore += (hasImportant / importantFields.length) * 15;

    // Enhanced fields
    const enhancedFields = ['nutrition', 'health_score', 'cooking_method', 'tags', 'cuisines'];
    const hasEnhanced = enhancedFields.filter(field => recipe[field] !== undefined && recipe[field] !== null).length;
    completenessScore += (hasEnhanced / enhancedFields.length) * 25;
    qualityScore += (hasEnhanced / enhancedFields.length) * 20;

    // Advanced fields
    const advancedFields = ['dietary_restrictions', 'meal_types', 'effort_level'];
    const hasAdvanced = advancedFields.filter(field => recipe[field] !== undefined && recipe[field] !== null).length;
    completenessScore += (hasAdvanced / advancedFields.length) * 20;
    qualityScore += (hasAdvanced / advancedFields.length) * 15;

    // Quality checks
    if (recipe.ingredients && recipe.ingredients.length > 0) {
      const avgIngredientLength = recipe.ingredients.reduce((sum: number, ing: any) => 
        sum + ((ing.name || ing.text || '').length), 0) / recipe.ingredients.length;
      
      if (avgIngredientLength > 5) qualityScore += 10;
      if (avgIngredientLength > 10) qualityScore += 5;
    }

    if (recipe.instructions && recipe.instructions.length > 0) {
      const avgInstructionLength = recipe.instructions.reduce((sum: number, inst: any) => 
        sum + ((inst.text || inst.instruction || '').length), 0) / recipe.instructions.length;
      
      if (avgInstructionLength > 20) qualityScore += 10;
      if (avgInstructionLength > 50) qualityScore += 5;
    }

    const processingTime = Date.now() - startTime;
    const confidenceScore = Math.min(qualityScore / 100, 1);

    this.addNote('info', component, `Recipe quality validation completed`, {
      qualityScore: qualityScore.toFixed(1),
      completenessScore: completenessScore.toFixed(1),
      confidenceScore: confidenceScore.toFixed(2),
      processingTime,
      hasRequiredFields: missingRequired.length === 0,
      importantFieldsCount: hasImportant,
      enhancedFieldsCount: hasEnhanced
    });

    return {
      success: missingRequired.length === 0,
      validation_notes: validationNotes,
      quality_score: Math.round(qualityScore),
      completeness_score: Math.round(completenessScore),
      confidence_score: confidenceScore,
      processing_time_ms: processingTime,
      components_processed: componentsProcessed
    };
  }

  /**
   * Get validation summary for monitoring
   */
  public getValidationSummary(componentFilter?: string): ValidationSummary {
    const filteredNotes = componentFilter ? 
      this.notes.filter(note => note.component === componentFilter) :
      this.notes;

    const summary: ValidationSummary = {
      total_notes: filteredNotes.length,
      errors: filteredNotes.filter(note => note.category === 'error').length,
      warnings: filteredNotes.filter(note => note.category === 'warning').length,
      info: filteredNotes.filter(note => note.category === 'info').length,
      success: filteredNotes.filter(note => note.category === 'success').length,
      components: {},
      severity_distribution: {},
      recent_issues: filteredNotes.slice(-20)
    };

    // Count by component
    filteredNotes.forEach(note => {
      summary.components[note.component] = (summary.components[note.component] || 0) + 1;
    });

    // Count by severity
    filteredNotes.forEach(note => {
      if (note.severity) {
        summary.severity_distribution[note.severity] = (summary.severity_distribution[note.severity] || 0) + 1;
      }
    });

    return summary;
  }

  /**
   * Update component metrics
   */
  private updateComponentMetrics(component: string, category: ValidationNote['category']): void {
    if (!this.componentMetrics.has(component)) {
      this.componentMetrics.set(component, {
        total: 0,
        errors: 0,
        warnings: 0,
        success: 0,
        average_processing_time: 0
      });
    }

    const metrics = this.componentMetrics.get(component)!;
    metrics.total++;
    
    if (category === 'error') metrics.errors++;
    else if (category === 'warning') metrics.warnings++;
    else if (category === 'success') metrics.success++;
  }

  /**
   * Export validation notes for analysis
   */
  public exportNotes(
    componentFilter?: string,
    categoryFilter?: ValidationNote['category'],
    limit?: number
  ): ValidationNote[] {
    let filtered = this.notes;

    if (componentFilter) {
      filtered = filtered.filter(note => note.component === componentFilter);
    }

    if (categoryFilter) {
      filtered = filtered.filter(note => note.category === categoryFilter);
    }

    return limit ? filtered.slice(-limit) : filtered;
  }

  /**
   * Clear old validation notes to free memory
   */
  public clearOldNotes(olderThanHours: number = 24): void {
    const cutoffTime = new Date(Date.now() - olderThanHours * 60 * 60 * 1000).toISOString();
    const initialCount = this.notes.length;
    
    this.notes = this.notes.filter(note => note.timestamp > cutoffTime);
    
    const removedCount = initialCount - this.notes.length;
    if (removedCount > 0) {
      console.log(`🧹 Cleared ${removedCount} validation notes older than ${olderThanHours} hours`);
    }
  }

  /**
   * Get component performance metrics
   */
  public getComponentMetrics(component?: string): Map<string, any> | any {
    if (component) {
      return this.componentMetrics.get(component) || null;
    }
    return this.componentMetrics;
  }
}

// Export singleton instance
export const validationNotesService = ValidationNotesService.getInstance();
