import { z } from 'zod';
import { RecipeIngredientSchema, InstructionStepSchema } from '../types.js';

/*
 * Comprehensive Data Integrity and Schema Consistency Validator
 * Ensures scalability, data wholeness, and robustness for all recipe formats
 */

export interface ValidationResult {
  isValid: boolean;
  score: number; // 0-100 completeness score
  errors: string[];
  warnings: string[];
  metrics: {
    ingredientCompleteness: number;
    instructionCompleteness: number;
    nutritionCompleteness: number;
    metadataCompleteness: number;
    schemaCompliance: number;
  };
}

export interface RecipeValidationInput {
  title: string;
  description?: string;
  ingredients: any[];
  instructions: any[];
  servings?: number;
  prep_time_minutes?: number;
  cook_time_minutes?: number;
  total_time_minutes?: number;
  author?: string;
  source_url?: string;
  image_url?: string;
  nutrition?: any;
  dietary_restrictions?: string[];
  cuisines?: string[];
}

export class DataIntegrityValidator {
  private static readonly REQUIRED_FIELDS = [
    'title',
    'ingredients',
    'instructions'
  ];

  private static readonly RECOMMENDED_FIELDS = [
    'description',
    'servings',
    'prep_time_minutes',
    'cook_time_minutes',
    'author',
    'source_url'
  ];

  private static readonly NUTRITION_FIELDS = [
    'calories_per_serving',
    'protein_g',
    'fat_g',
    'carbs_g',
    'fiber_g',
    'sodium_mg'
  ];

  /*
   * Comprehensive validation for recipe data before processing
   */
  static validateRecipeData(recipe: RecipeValidationInput): ValidationResult {
    console.log(`🔍 Validating recipe: "${recipe.title}"`);
    
    const result: ValidationResult = {
      isValid: true,
      score: 0,
      errors: [],
      warnings: [],
      metrics: {
        ingredientCompleteness: 0,
        instructionCompleteness: 0,
        nutritionCompleteness: 0,
        metadataCompleteness: 0,
        schemaCompliance: 0
      }
    };

    // 1. Required Fields Validation
    this.validateRequiredFields(recipe, result);

    // 2. Ingredient Validation
    this.validateIngredients(recipe.ingredients, result);

    // 3. Instruction Validation
    this.validateInstructions(recipe.instructions, result);

    // 4. Metadata Completeness
    this.validateMetadata(recipe, result);

    // 5. Nutrition Data Validation
    this.validateNutrition(recipe.nutrition, result);

    // 6. Schema Compliance Check
    this.validateSchemaCompliance(recipe, result);

    // 7. Data Consistency Checks
    this.validateDataConsistency(recipe, result);

    // Calculate overall score
    result.score = this.calculateOverallScore(result.metrics);
    result.isValid = result.errors.length === 0 && result.score >= 70;

    console.log(`${result.isValid ? '✅' : '❌'} Validation complete: ${result.score}% score`);
    return result;
  }

  /*
   * Validate required fields are present and non-empty
   */
  private static validateRequiredFields(recipe: RecipeValidationInput, result: ValidationResult): void {
    for (const field of this.REQUIRED_FIELDS) {
      const value = (recipe as any)[field];
      if (!value || (Array.isArray(value) && value.length === 0)) {
        result.errors.push(`Required field '${field}' is missing or empty`);
      }
    }

    // Title specific validation
    if (recipe.title && recipe.title.length < 3) {
      result.errors.push('Title must be at least 3 characters long');
    }
    if (recipe.title && recipe.title.length > 200) {
      result.warnings.push('Title is unusually long (>200 characters)');
    }
  }

  /*
   * Validate ingredient data structure and completeness
   */
  private static validateIngredients(ingredients: any[], result: ValidationResult): void {
    if (!Array.isArray(ingredients)) {
      result.errors.push('Ingredients must be an array');
      return;
    }

    if (ingredients.length === 0) {
      result.errors.push('Recipe must have at least one ingredient');
      return;
    }

    if (ingredients.length > 50) {
      result.warnings.push(`Recipe has many ingredients (${ingredients.length}), consider breaking into sub-recipes`);
    }

    let validIngredients = 0;
    let completeIngredients = 0;

    for (let i = 0; i < ingredients.length; i++) {
      const ingredient = ingredients[i];
      
      // Check if it's a string (raw format) or object (parsed format)
      if (typeof ingredient === 'string') {
        if (ingredient.trim().length === 0) {
          result.errors.push(`Ingredient ${i + 1} is empty`);
        } else {
          validIngredients++;
          // Basic completeness check for string ingredients
          if (this.hasQuantityAndUnit(ingredient)) {
            completeIngredients++;
          }
        }
      } else if (typeof ingredient === 'object' && ingredient !== null) {
        // Validate structured ingredient
        try {
          RecipeIngredientSchema.parse(ingredient);
          validIngredients++;
          
          // Check completeness
          if (ingredient.name && ingredient.name && ingredient.quantity !== null && ingredient.unit) {
            completeIngredients++;
          }
        } catch (error) {
          result.errors.push(`Ingredient ${i + 1} schema validation failed: ${error}`);
        }
      } else {
        result.errors.push(`Ingredient ${i + 1} has invalid format`);
      }
    }

    result.metrics.ingredientCompleteness = Math.round((completeIngredients / ingredients.length) * 100);
    
    if (validIngredients / ingredients.length < 0.8) {
      result.errors.push('More than 20% of ingredients are invalid');
    }
  }

  /*
   * Validate instruction data structure and completeness
   */
  private static validateInstructions(instructions: any[], result: ValidationResult): void {
    if (!Array.isArray(instructions)) {
      result.errors.push('Instructions must be an array');
      return;
    }

    if (instructions.length === 0) {
      result.errors.push('Recipe must have at least one instruction');
      return;
    }

    if (instructions.length > 30) {
      result.warnings.push(`Recipe has many steps (${instructions.length}), consider simplifying`);
    }

    let validInstructions = 0;
    let completeInstructions = 0;

    for (let i = 0; i < instructions.length; i++) {
      const instruction = instructions[i];
      
      if (typeof instruction === 'string') {
        if (instruction.trim().length === 0) {
          result.errors.push(`Instruction ${i + 1} is empty`);
        } else if (instruction.trim().length < 10) {
          result.warnings.push(`Instruction ${i + 1} is very short (${instruction.length} chars)`);
          validInstructions++;
        } else {
          validInstructions++;
          completeInstructions++;
        }
      } else if (typeof instruction === 'object' && instruction !== null) {
        // Validate structured instruction
        try {
          InstructionStepSchema.parse(instruction);
          validInstructions++;
          
          // Check completeness
          if (instruction.text && instruction.text.length >= 10) {
            completeInstructions++;
          }
        } catch (error) {
          result.errors.push(`Instruction ${i + 1} schema validation failed: ${error}`);
        }
      } else {
        result.errors.push(`Instruction ${i + 1} has invalid format`);
      }
    }

    result.metrics.instructionCompleteness = Math.round((completeInstructions / instructions.length) * 100);
    
    if (validInstructions / instructions.length < 0.8) {
      result.errors.push('More than 20% of instructions are invalid');
    }
  }

  /*
   * Validate metadata completeness
   */
  private static validateMetadata(recipe: RecipeValidationInput, result: ValidationResult): void {
    let presentFields = 0;
    
    for (const field of this.RECOMMENDED_FIELDS) {
      const value = (recipe as any)[field];
      if (value !== undefined && value !== null && value !== '') {
        presentFields++;
      }
    }

    result.metrics.metadataCompleteness = Math.round((presentFields / this.RECOMMENDED_FIELDS.length) * 100);

    // Specific metadata validations
    if (recipe.servings && (recipe.servings < 1 || recipe.servings > 50)) {
      result.warnings.push('Servings count seems unusual (should be 1-50)');
    }

    if (recipe.prep_time_minutes && recipe.prep_time_minutes < 0) {
      result.errors.push('Prep time cannot be negative');
    }

    if (recipe.cook_time_minutes && recipe.cook_time_minutes < 0) {
      result.errors.push('Cook time cannot be negative');
    }

    if (recipe.total_time_minutes && recipe.prep_time_minutes && recipe.cook_time_minutes) {
      const expectedTotal = recipe.prep_time_minutes + recipe.cook_time_minutes;
      if (Math.abs(recipe.total_time_minutes - expectedTotal) > 15) {
        result.warnings.push('Total time does not match prep + cook time');
      }
    }

    if (recipe.source_url && !this.isValidUrl(recipe.source_url)) {
      result.errors.push('Source URL is not valid');
    }

    if (recipe.image_url && !this.isValidUrl(recipe.image_url)) {
      result.warnings.push('Image URL is not valid');
    }
  }

  /*
   * Validate nutrition data completeness
   */
  private static validateNutrition(nutrition: any, result: ValidationResult): void {
    if (!nutrition) {
      result.metrics.nutritionCompleteness = 0;
      result.warnings.push('No nutrition data provided');
      return;
    }

    let presentNutrients = 0;
    
    for (const field of this.NUTRITION_FIELDS) {
      const value = nutrition[field];
      if (typeof value === 'number' && value >= 0) {
        presentNutrients++;
      }
    }

    result.metrics.nutritionCompleteness = Math.round((presentNutrients / this.NUTRITION_FIELDS.length) * 100);

    // Validate nutrition value ranges
    if (nutrition.calories_per_serving && (nutrition.calories_per_serving < 10 || nutrition.calories_per_serving > 3000)) {
      result.warnings.push('Calories per serving seems unusual (10-3000 expected)');
    }

    if (nutrition.protein_g && nutrition.protein_g < 0) {
      result.errors.push('Protein cannot be negative');
    }

    if (nutrition.sodium_mg && nutrition.sodium_mg > 5000) {
      result.warnings.push('Sodium content is very high (>5000mg)');
    }
  }

  /*
   * Validate schema compliance
   */
  private static validateSchemaCompliance(recipe: RecipeValidationInput, result: ValidationResult): void {
    let complianceScore = 100;

    // Check for unknown fields that might indicate schema drift
    const knownFields = [
      'title', 'description', 'ingredients', 'instructions', 'servings',
      'prep_time_minutes', 'cook_time_minutes', 'total_time_minutes',
      'author', 'source_url', 'image_url', 'nutrition', 'dietary_restrictions',
      'cuisines', 'tags', 'effort_level'
    ];

    const recipeFields = Object.keys(recipe);
    const unknownFields = recipeFields.filter(field => !knownFields.includes(field));
    
    if (unknownFields.length > 0) {
      result.warnings.push(`Unknown fields detected: ${unknownFields.join(', ')}`);
      complianceScore -= unknownFields.length * 5;
    }

    // Check data types
    if (recipe.servings && typeof recipe.servings !== 'number') {
      result.errors.push('Servings must be a number');
      complianceScore -= 10;
    }

    if (recipe.dietary_restrictions && !Array.isArray(recipe.dietary_restrictions)) {
      result.errors.push('Dietary restrictions must be an array');
      complianceScore -= 10;
    }

    if (recipe.cuisines && !Array.isArray(recipe.cuisines)) {
      result.errors.push('Cuisine type must be an array');
      complianceScore -= 10;
    }

    result.metrics.schemaCompliance = Math.max(0, complianceScore);
  }

  /*
   * Validate data consistency across fields
   */
  private static validateDataConsistency(recipe: RecipeValidationInput, result: ValidationResult): void {
    // Check ingredient-instruction consistency
    if (recipe.ingredients && recipe.instructions) {
      const ingredientNames = this.extractIngredientNames(recipe.ingredients);
      const instructionText = this.extractInstructionText(recipe.instructions);
      
      const mentionedIngredients = ingredientNames.filter(name => 
        instructionText.toLowerCase().includes(name.toLowerCase())
      );

      const mentionRate = mentionedIngredients.length / ingredientNames.length;
      if (mentionRate < 0.3) {
        result.warnings.push('Many ingredients are not mentioned in instructions');
      }
    }

    // Check time consistency
    if (recipe.prep_time_minutes && recipe.cook_time_minutes && recipe.total_time_minutes) {
      const calculatedTotal = recipe.prep_time_minutes + recipe.cook_time_minutes;
      if (recipe.total_time_minutes < calculatedTotal) {
        result.warnings.push('Total time is less than prep + cook time');
      }
    }

    // Check serving size consistency
    if (recipe.servings && recipe.nutrition?.calories_per_serving) {
      if (recipe.servings > 20 && recipe.nutrition.calories_per_serving < 100) {
        result.warnings.push('Low calories per serving for high serving count');
      }
    }
  }

  /*
   * Calculate overall completeness score
   */
  private static calculateOverallScore(metrics: ValidationResult['metrics']): number {
    const weights = {
      ingredientCompleteness: 0.25,
      instructionCompleteness: 0.25,
      nutritionCompleteness: 0.15,
      metadataCompleteness: 0.15,
      schemaCompliance: 0.20
    };

    return Math.round(
      metrics.ingredientCompleteness * weights.ingredientCompleteness +
      metrics.instructionCompleteness * weights.instructionCompleteness +
      metrics.nutritionCompleteness * weights.nutritionCompleteness +
      metrics.metadataCompleteness * weights.metadataCompleteness +
      metrics.schemaCompliance * weights.schemaCompliance
    );
  }

  /*
   * Helper methods
   */
  private static hasQuantityAndUnit(ingredient: string): boolean {
    const hasNumber = /\d/.test(ingredient);
    const hasUnit = /\b(cup|cups|tablespoon|tablespoons|teaspoon|teaspoons|pound|pounds|ounce|ounces|gram|grams|kilogram|kilograms|liter|liters|milliliter|milliliters|piece|pieces|clove|cloves)\b/i.test(ingredient);
    return hasNumber && hasUnit;
  }

  private static isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  private static extractIngredientNames(ingredients: any[]): string[] {
    return ingredients.map(ing => {
      if (typeof ing === 'string') {
        // Extract ingredient name from string (remove quantities, units, etc.)
        return ing.replace(/^\d+[\d\s\/\-\.]*\s*\w+\s+/, '').trim();
      } else if (ing.name) {
        return ing.name;
      } else if (ing.name) {
        return ing.name;
      }
      return '';
    }).filter(name => name.length > 0);
  }

  private static extractInstructionText(instructions: any[]): string {
    return instructions.map(inst => {
      if (typeof inst === 'string') {
        return inst;
      } else if (inst.text) {
        return inst.text;
      }
      return '';
    }).join(' ');
  }

  /*
   * Validate recipe format compatibility across different input sources
   */
  static validateFormatCompatibility(recipe: any): {
    format: 'raw' | 'parsed' | 'mixed' | 'unknown';
    compatibility: number; // 0-100
    recommendations: string[];
  } {
    const result: {
      format: 'raw' | 'parsed' | 'mixed' | 'unknown';
      compatibility: number;
      recommendations: string[];
    } = {
      format: 'unknown',
      compatibility: 0,
      recommendations: []
    };

    // Determine format based on ingredient and instruction structure
    const ingredientFormats = this.analyzeArrayFormat(recipe.ingredients);
    const instructionFormats = this.analyzeArrayFormat(recipe.instructions);

    if (ingredientFormats.string > 0.8 && instructionFormats.string > 0.8) {
      result.format = 'raw';
      result.compatibility = 95;
    } else if (ingredientFormats.object > 0.8 && instructionFormats.object > 0.8) {
      result.format = 'parsed';
      result.compatibility = 90;
    } else if (ingredientFormats.mixed || instructionFormats.mixed) {
      result.format = 'mixed';
      result.compatibility = 60;
      result.recommendations.push('Convert to consistent format (all strings or all objects)');
    } else {
      result.format = 'unknown';
      result.compatibility = 30;
      result.recommendations.push('Recipe format is not recognized');
    }

    return result;
  }

  private static analyzeArrayFormat(arr: any[]): {
    string: number;
    object: number;
    mixed: boolean;
  } {
    if (!Array.isArray(arr) || arr.length === 0) {
      return { string: 0, object: 0, mixed: false };
    }

    let stringCount = 0;
    let objectCount = 0;

    for (const item of arr) {
      if (typeof item === 'string') {
        stringCount++;
      } else if (typeof item === 'object' && item !== null) {
        objectCount++;
      }
    }

    const total = arr.length;
    const stringRatio = stringCount / total;
    const objectRatio = objectCount / total;
    const mixed = stringCount > 0 && objectCount > 0;

    return {
      string: stringRatio,
      object: objectRatio,
      mixed
    };
  }
}
