import { z } from 'zod';
import { Recipe, RecipeSchema, RecipeIngredient, InstructionStep } from '../types.js';
import { RawScrapedRecipe } from '../scrapers/websiteScraper.js';

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  completenessScore: number;
  missingRequiredFields: string[];
  fixedFields: FixedField[];
}

export interface ValidationError {
  field: string;
  message: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  originalValue?: any;
  suggestedFix?: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
  originalValue?: any;
  suggestedValue?: any;
}

export interface FixedField {
  field: string;
  originalValue: any;
  fixedValue: any;
  fixMethod: string;
}

/*
 * Comprehensive recipe validation and field completion system
 */
export class RecipeValidator {
  
  /*
   * Validate and fix a complete recipe object
   */
  static async validateAndFixRecipe(recipe: Partial<Recipe>, sourceUrl?: string): Promise<ValidationResult> {
    console.log(`🔍 Validating recipe: ${recipe.title || 'Unknown'}`);
    
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      completenessScore: 0,
      missingRequiredFields: [],
      fixedFields: []
    };
    
    // Create a working copy of the recipe
    const workingRecipe = { ...recipe };
    
    // 1. Validate and fix basic information
    await this.validateBasicInfo(workingRecipe, result, sourceUrl);
    
    // 2. Validate and fix timing fields
    await this.validateTiming(workingRecipe, result);
    
    // 3. Validate and fix ingredients
    await this.validateIngredients(workingRecipe, result);
    
    // 4. Validate and fix instructions
    await this.validateInstructions(workingRecipe, result);
    
    // 5. Validate and fix metadata
    await this.validateMetadata(workingRecipe, result);
    
    // 6. Calculate final completeness score
    result.completenessScore = this.calculateCompletenessScore(workingRecipe);
    
    // 7. Final schema validation
    try {
      RecipeSchema.parse(workingRecipe);
      console.log(`✅ Recipe validation passed with ${result.completenessScore}% completeness`);
    } catch (error) {
      if (error instanceof z.ZodError) {
        error.issues.forEach(issue => {
          result.errors.push({
            field: issue.path.join('.'),
            message: issue.message,
            severity: 'critical',
            originalValue: 'input' in issue ? issue.input : undefined
          });
        });
        result.isValid = false;
      }
    }
    
    return result;
  }
  
  /*
   * Validate and fix basic recipe information
   */
  private static async validateBasicInfo(
    recipe: Partial<Recipe>, 
    result: ValidationResult, 
    sourceUrl?: string
  ): Promise<void> {
    
    // Title validation and fixing
    if (!recipe.title || recipe.title.trim().length === 0) {
      result.errors.push({
        field: 'title',
        message: 'Recipe title is required',
        severity: 'critical',
        suggestedFix: 'Generate title from ingredients or source URL'
      });
      result.missingRequiredFields.push('title');
      
      // Attempt to generate title
      if (recipe.ingredients && Array.isArray(recipe.ingredients)) {
        const mainIngredient = recipe.ingredients[0]?.name || recipe.ingredients[0]?.text;
        if (mainIngredient) {
          recipe.title = `Recipe with ${mainIngredient}`;
          result.fixedFields.push({
            field: 'title',
            originalValue: undefined,
            fixedValue: recipe.title,
            fixMethod: 'Generated from main ingredient'
          });
        }
      }
    } else if (recipe.title.length > 200) {
      const truncated = recipe.title.substring(0, 197) + '...';
      result.warnings.push({
        field: 'title',
        message: 'Title too long, truncating to 200 characters',
        originalValue: recipe.title,
        suggestedValue: truncated
      });
      recipe.title = truncated;
    }
    
    // Source URL validation
    if (!recipe.source_url && sourceUrl) {
      recipe.source_url = sourceUrl;
      result.fixedFields.push({
        field: 'source_url',
        originalValue: undefined,
        fixedValue: sourceUrl,
        fixMethod: 'Added from function parameter'
      });
    }
    
    if (!recipe.source_url) {
      result.errors.push({
        field: 'source_url',
        message: 'Source URL is required',
        severity: 'critical'
      });
      result.missingRequiredFields.push('source_url');
    }
    
    // Author validation and fixing
    if (!recipe.author || recipe.author.trim().length === 0) {
      result.missingRequiredFields.push('author');
      
      // Generate author from source URL
      if (recipe.source_url) {
        try {
          const domain = new URL(recipe.source_url).hostname.replace('www.', '');
          const capitalizedDomain = domain.split('.')[0]
            .split(/[-_]/)
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
          recipe.author = `${capitalizedDomain} Recipe`;
          
          result.fixedFields.push({
            field: 'author',
            originalValue: undefined,
            fixedValue: recipe.author,
            fixMethod: 'Generated from source domain'
          });
        } catch (error) {
          recipe.author = 'Recipe Author';
          result.fixedFields.push({
            field: 'author',
            originalValue: undefined,
            fixedValue: recipe.author,
            fixMethod: 'Default fallback'
          });
        }
      } else {
        recipe.author = 'Recipe Author';
      }
    }
    
    // Description validation
    if (recipe.description && recipe.description.length > 1000) {
      const truncated = recipe.description.substring(0, 997) + '...';
      result.warnings.push({
        field: 'description',
        message: 'Description too long, truncating to 1000 characters',
        originalValue: recipe.description,
        suggestedValue: truncated
      });
      recipe.description = truncated;
    }
  }
  
  /*
   * Validate and fix timing fields
   */
  private static async validateTiming(recipe: Partial<Recipe>, result: ValidationResult): Promise<void> {
    
    // Prep time validation and fixing
    if (!recipe.prep_time_minutes || recipe.prep_time_minutes <= 0) {
      result.missingRequiredFields.push('prep_time_minutes');
      
      // Estimate from instructions
      if (recipe.instructions && Array.isArray(recipe.instructions)) {
        const estimated = this.estimatePrepTime(recipe.instructions);
        recipe.prep_time_minutes = estimated;
        
        result.fixedFields.push({
          field: 'prep_time_minutes',
          originalValue: recipe.prep_time_minutes,
          fixedValue: estimated,
          fixMethod: 'Estimated from instruction analysis'
        });
      } else {
        recipe.prep_time_minutes = 15; // Default fallback
        result.fixedFields.push({
          field: 'prep_time_minutes',
          originalValue: undefined,
          fixedValue: 15,
          fixMethod: 'Default fallback'
        });
      }
    }
    
    // Cook time validation and fixing
    if (!recipe.cook_time_minutes || recipe.cook_time_minutes <= 0) {
      result.missingRequiredFields.push('cook_time_minutes');
      
      // Estimate from instructions
      if (recipe.instructions && Array.isArray(recipe.instructions)) {
        const estimated = this.estimateCookTime(recipe.instructions);
        recipe.cook_time_minutes = estimated;
        
        result.fixedFields.push({
          field: 'cook_time_minutes',
          originalValue: recipe.cook_time_minutes,
          fixedValue: estimated,
          fixMethod: 'Estimated from instruction analysis'
        });
      } else {
        recipe.cook_time_minutes = 30; // Default fallback
        result.fixedFields.push({
          field: 'cook_time_minutes',
          originalValue: undefined,
          fixedValue: 30,
          fixMethod: 'Default fallback'
        });
      }
    }
    
    // Total time calculation
    if (!recipe.total_time_minutes) {
      const total = (recipe.prep_time_minutes || 0) + (recipe.cook_time_minutes || 0);
      recipe.total_time_minutes = total;
      
      result.fixedFields.push({
        field: 'total_time_minutes',
        originalValue: undefined,
        fixedValue: total,
        fixMethod: 'Calculated from prep + cook time'
      });
    }
    
    // Validate timing bounds
    if (recipe.prep_time_minutes && recipe.prep_time_minutes > 1440) {
      result.warnings.push({
        field: 'prep_time_minutes',
        message: 'Prep time exceeds 24 hours, capping at 1440 minutes',
        originalValue: recipe.prep_time_minutes,
        suggestedValue: 1440
      });
      recipe.prep_time_minutes = 1440;
    }
    
    if (recipe.cook_time_minutes && recipe.cook_time_minutes > 1440) {
      result.warnings.push({
        field: 'cook_time_minutes',
        message: 'Cook time exceeds 24 hours, capping at 1440 minutes',
        originalValue: recipe.cook_time_minutes,
        suggestedValue: 1440
      });
      recipe.cook_time_minutes = 1440;
    }
  }
  
  /*
   * Validate ingredients array
   */
  private static async validateIngredients(recipe: Partial<Recipe>, result: ValidationResult): Promise<void> {
    if (!recipe.ingredients || !Array.isArray(recipe.ingredients) || recipe.ingredients.length === 0) {
      result.errors.push({
        field: 'ingredients',
        message: 'Recipe must have at least one ingredient',
        severity: 'critical'
      });
      result.missingRequiredFields.push('ingredients');
      return;
    }
    
    // Validate each ingredient
    recipe.ingredients.forEach((ingredient: any, index: number) => {
      if (typeof ingredient === 'string') {
        result.warnings.push({
          field: `ingredients[${index}]`,
          message: 'Ingredient is still a string, needs parsing',
          originalValue: ingredient
        });
      } else {
        // Validate required ingredient fields
        if (!ingredient.name || ingredient.name.trim().length === 0) {
          if (ingredient.text) {
            ingredient.name = ingredient.text.split(' ').slice(-2).join(' '); // Use last two words as name
            result.fixedFields.push({
              field: `ingredients[${index}].name`,
              originalValue: undefined,
              fixedValue: ingredient.name,
              fixMethod: 'Extracted from ingredient text'
            });
          }
        }
        
        if (!ingredient.text || ingredient.text.trim().length === 0) {
          ingredient.text = ingredient.name || 'Unknown ingredient';
          result.fixedFields.push({
            field: `ingredients[${index}].text`,
            originalValue: undefined,
            fixedValue: ingredient.text,
            fixMethod: 'Copied from ingredient name'
          });
        }
      }
    });
    
    if (recipe.ingredients.length > 50) {
      result.warnings.push({
        field: 'ingredients',
        message: 'Recipe has more than 50 ingredients, this may be excessive',
        originalValue: recipe.ingredients.length
      });
    }
  }
  
  /*
   * Validate instructions array
   */
  private static async validateInstructions(recipe: Partial<Recipe>, result: ValidationResult): Promise<void> {
    if (!recipe.instructions || !Array.isArray(recipe.instructions) || recipe.instructions.length === 0) {
      result.errors.push({
        field: 'instructions',
        message: 'Recipe must have at least one instruction',
        severity: 'critical'
      });
      result.missingRequiredFields.push('instructions');
      return;
    }
    
    // Validate and fix each instruction
    recipe.instructions.forEach((instruction: any, index: number) => {
      if (typeof instruction === 'string') {
        // Convert string to instruction object
        const newInstruction = {
          step_number: index + 1,
          text: instruction,
          action: null,
          timer_min: [],
          temperature_f: null,
          equipment: [],
          mentioned_ingredients: []
        };
        recipe.instructions![index] = newInstruction;
        
        result.fixedFields.push({
          field: `instructions[${index}]`,
          originalValue: instruction,
          fixedValue: newInstruction,
          fixMethod: 'Converted string to instruction object'
        });
      } else {
        // Ensure required fields exist
        if (!instruction.step_number) {
          instruction.step_number = index + 1;
          result.fixedFields.push({
            field: `instructions[${index}].step_number`,
            originalValue: undefined,
            fixedValue: index + 1,
            fixMethod: 'Generated from array index'
          });
        }
        
        if (!instruction.text || instruction.text.trim().length === 0) {
          result.errors.push({
            field: `instructions[${index}].text`,
            message: 'Instruction text cannot be empty',
            severity: 'high'
          });
        }
        
        // Initialize missing arrays
        if (!instruction.timer_min) instruction.timer_min = [];
        if (!instruction.equipment) instruction.equipment = [];
        if (!instruction.mentioned_ingredients) instruction.mentioned_ingredients = [];
      }
    });
    
    if (recipe.instructions.length > 30) {
      result.warnings.push({
        field: 'instructions',
        message: 'Recipe has more than 30 instructions, this may be excessive',
        originalValue: recipe.instructions.length
      });
    }
  }
  
  /*
   * Validate and fix metadata fields
   */
  private static async validateMetadata(recipe: Partial<Recipe>, result: ValidationResult): Promise<void> {
    // Servings validation
    if (!recipe.servings) {
      recipe.servings = 4; // Default servings
      result.fixedFields.push({
        field: 'servings',
        originalValue: undefined,
        fixedValue: 4,
        fixMethod: 'Default fallback'
      });
    }
    
    // Initialize arrays if missing
    if (!recipe.cuisines) recipe.cuisines = [];
    if (!recipe.meal_types) recipe.meal_types = [];
    if (!recipe.tags) recipe.tags = [];
    if (!recipe.cooking_method) recipe.cooking_method = [];
    if (!recipe.suitable_for_diet) recipe.suitable_for_diet = [];
    
    // Default boolean fields
    if (recipe.is_public === undefined) recipe.is_public = true;
  }
  
  /*
   * Calculate recipe completeness score
   */
  private static calculateCompletenessScore(recipe: Partial<Recipe>): number {
    const requiredFields = [
      'title', 'source_url', 'ingredients', 'instructions', 'author',
      'prep_time_minutes', 'cook_time_minutes', 'total_time_minutes', 'servings'
    ];
    
    const optionalFields = [
      'description', 'image_url', 'cuisines', 'meal_types', 'tags',
      'cooking_method', 'suitable_for_diet', 'nutrition', 'effort_level'
    ];
    
    let score = 0;
    let totalFields = requiredFields.length + optionalFields.length;
    
    // Required fields are worth more points
    requiredFields.forEach(field => {
      if (recipe[field as keyof Recipe] && 
          (Array.isArray(recipe[field as keyof Recipe]) ? 
           (recipe[field as keyof Recipe] as any[]).length > 0 : 
           recipe[field as keyof Recipe] !== null && 
           recipe[field as keyof Recipe] !== undefined &&
           String(recipe[field as keyof Recipe]).trim().length > 0)) {
        score += 2; // Required fields worth 2 points
      }
    });
    
    // Optional fields are worth 1 point each
    optionalFields.forEach(field => {
      if (recipe[field as keyof Recipe] && 
          (Array.isArray(recipe[field as keyof Recipe]) ? 
           (recipe[field as keyof Recipe] as any[]).length > 0 : 
           recipe[field as keyof Recipe] !== null && 
           recipe[field as keyof Recipe] !== undefined &&
           String(recipe[field as keyof Recipe]).trim().length > 0)) {
        score += 1;
      }
    });
    
    // Calculate percentage (required fields count double)
    const maxScore = (requiredFields.length * 2) + optionalFields.length;
    return Math.round((score / maxScore) * 100);
  }
  
  /*
   * Estimate prep time from instructions
   */
  private static estimatePrepTime(instructions: any[]): number {
    let prepTime = 0;
    
    instructions.forEach(instruction => {
      const text = typeof instruction === 'string' ? instruction : instruction.text || '';
      const lowerText = text.toLowerCase();
      
      // Count prep activities
      if (lowerText.includes('prep') || lowerText.includes('prepare')) prepTime += 5;
      if (lowerText.includes('chop') || lowerText.includes('dice') || lowerText.includes('mince')) prepTime += 3;
      if (lowerText.includes('mix') || lowerText.includes('combine') || lowerText.includes('stir')) prepTime += 2;
      if (lowerText.includes('wash') || lowerText.includes('rinse') || lowerText.includes('clean')) prepTime += 2;
      if (lowerText.includes('peel') || lowerText.includes('trim')) prepTime += 3;
      if (lowerText.includes('slice') || lowerText.includes('cut')) prepTime += 3;
    });
    
    return Math.max(prepTime, 10);
  }
  
  /*
   * Estimate cook time from instructions
   */
  private static estimateCookTime(instructions: any[]): number {
    let cookTime = 0;
    let hasTimingInfo = false;
    
    instructions.forEach(instruction => {
      const text = typeof instruction === 'string' ? instruction : instruction.text || '';
      const lowerText = text.toLowerCase();
      
      // Look for explicit timing
      const timeMatches = text.match(/(\d+)\s*(minute|min|hour|hr)s?/g);
      if (timeMatches) {
        timeMatches.forEach((match: string) => {
          const numMatch = match.match(/\d+/);
          if (numMatch) {
            const time = parseInt(numMatch[0]);
            if (match.includes('hour') || match.includes('hr')) {
              cookTime += time * 60;
            } else {
              cookTime += time;
            }
            hasTimingInfo = true;
          }
        });
      }
      
      // Estimate from cooking methods if no explicit timing
      if (!hasTimingInfo) {
        if (lowerText.includes('bake') || lowerText.includes('roast')) cookTime += 30;
        else if (lowerText.includes('simmer') || lowerText.includes('boil')) cookTime += 15;
        else if (lowerText.includes('fry') || lowerText.includes('saute')) cookTime += 8;
        else if (lowerText.includes('grill')) cookTime += 10;
      }
    });
    
    return Math.max(cookTime, 5);
  }
  
  /*
   * Generate validation report
   */
  static generateValidationReport(result: ValidationResult): string {
    const lines: string[] = [];
    
    lines.push('📋 RECIPE VALIDATION REPORT');
    lines.push('=' .repeat(50));
    lines.push(`Overall Status: ${result.isValid ? '✅ VALID' : '❌ INVALID'}`);
    lines.push(`Completeness Score: ${result.completenessScore}%`);
    lines.push('');
    
    if (result.errors.length > 0) {
      lines.push('🚨 ERRORS:');
      result.errors.forEach(error => {
        lines.push(`  • ${error.field}: ${error.message} (${error.severity})`);
        if (error.suggestedFix) {
          lines.push(`    💡 Suggestion: ${error.suggestedFix}`);
        }
      });
      lines.push('');
    }
    
    if (result.warnings.length > 0) {
      lines.push('⚠️  WARNINGS:');
      result.warnings.forEach(warning => {
        lines.push(`  • ${warning.field}: ${warning.message}`);
      });
      lines.push('');
    }
    
    if (result.fixedFields.length > 0) {
      lines.push('🔧 FIXED FIELDS:');
      result.fixedFields.forEach(fix => {
        lines.push(`  • ${fix.field}: ${fix.fixMethod}`);
        lines.push(`    ${fix.originalValue} → ${fix.fixedValue}`);
      });
      lines.push('');
    }
    
    if (result.missingRequiredFields.length > 0) {
      lines.push('❌ MISSING REQUIRED FIELDS:');
      result.missingRequiredFields.forEach(field => {
        lines.push(`  • ${field}`);
      });
    }
    
    return lines.join('\n');
  }
}

export default RecipeValidator;
