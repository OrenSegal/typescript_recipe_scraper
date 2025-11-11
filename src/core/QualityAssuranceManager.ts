/**
 * Enterprise Quality Assurance Pipeline for Recipe Data
 * Implements comprehensive validation, scoring, and data lineage tracking
 */

import { z } from 'zod';
import { Recipe } from '../types.js';
import { EnterpriseConfig } from '../infrastructure/EnterpriseConfig.js';

export interface QualityMetrics {
  score: number; // 0-1 scale
  issues: string[];
  completeness: {
    title: boolean;
    ingredients: boolean;
    instructions: boolean;
    timing: boolean;
    servings: boolean;
    nutrition: boolean;
  };
  validation: {
    dataTypes: boolean;
    requiredFields: boolean;
    logicalConsistency: boolean;
    contentQuality: boolean;
  };
  lineage: {
    sourceUrl: string;
    scrapedAt: Date;
    processingSteps: string[];
    validationVersion: string;
  };
}

export interface DataLineageRecord {
  id: string;
  sourceUrl: string;
  scrapedAt: Date;
  processingSteps: Array<{
    step: string;
    timestamp: Date;
    success: boolean;
    metadata?: Record<string, any>;
  }>;
  qualityScore: number;
  issues: string[];
  version: string;
}

/**
 * Recipe-specific validation schemas for enterprise quality assurance
 */
const RecipeQualitySchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().max(2000).optional(),
  ingredients: z.array(z.string().min(1)).min(2).max(50),
  instructions: z.array(z.string().min(5)).min(1).max(50),
  prep_time_minutes: z.number().min(0).max(1440).nullable().optional(), // Max 24 hours
  cook_time_minutes: z.number().min(0).max(1440).nullable().optional(),
  total_time_minutes: z.number().min(0).max(1440).nullable().optional(),
  servings: z.union([z.number().min(1).max(100), z.string().max(50)]).nullable().optional(),
  image_url: z.string().url().nullable().optional(),
  source_url: z.string().url(),
  nutrition: z.object({
    calories: z.number().min(0).max(10000).nullable().optional(),
    protein: z.number().min(0).max(1000).nullable().optional(),
    carbohydrates: z.number().min(0).max(1000).nullable().optional(),
    fat: z.number().min(0).max(1000).nullable().optional(),
    fiber: z.number().min(0).max(200).nullable().optional(),
    sugar: z.number().min(0).max(1000).nullable().optional(),
    sodium: z.number().min(0).max(100000).nullable().optional(),
  }).optional(),
});

/**
 * Enterprise-grade quality assurance manager for recipe data validation
 */
export class QualityAssuranceManager {
  private config: EnterpriseConfig;
  private lineageRecords: Map<string, DataLineageRecord> = new Map();
  private validationVersion = '1.0.0';

  // Recipe content quality patterns
  private qualityPatterns = {
    // Good quality indicators
    goodIngredients: [
      /\d+\s*(cup|tablespoon|teaspoon|pound|ounce|gram|kilogram|ml|liter)/i,
      /\d+\/\d+/,  // fractions
      /\d+\s*-\s*\d+/, // ranges
    ],
    goodInstructions: [
      /\b(preheat|heat|cook|bake|sauté|simmer|boil|mix|stir|add|remove)\b/i,
      /\d+\s*(minute|hour|second)/i,
      /\d+°[CF]/i, // temperatures
    ],
    
    // Poor quality indicators
    poorContent: [
      /lorem ipsum/i,
      /placeholder/i,
      /\[.*\]/,  // bracketed placeholders
      /xxx+/i,
      /test/i,
    ],
    
    // Spam indicators
    spamIndicators: [
      /buy now/i,
      /click here/i,
      /special offer/i,
      /limited time/i,
      /(viagra|casino|poker|lottery)/i,
    ]
  };

  constructor(config: EnterpriseConfig) {
    this.config = config;
  }

  /**
   * Comprehensive recipe validation with quality scoring
   */
  async validateRecipe(recipe: Recipe): Promise<QualityMetrics> {
    const lineageId = this.generateLineageId(recipe.source_url);
    const processingSteps: Array<{ step: string; timestamp: Date; success: boolean; metadata?: any }> = [];

    try {
      // Step 1: Schema validation
      const schemaValidation = this.validateSchema(recipe);
      processingSteps.push({
        step: 'schema_validation',
        timestamp: new Date(),
        success: schemaValidation.success,
        metadata: { errors: schemaValidation.errors }
      });

      // Step 2: Content completeness assessment
      const completeness = this.assessCompleteness(recipe);
      processingSteps.push({
        step: 'completeness_assessment',
        timestamp: new Date(),
        success: true,
        metadata: completeness
      });

      // Step 3: Content quality analysis
      const contentQuality = this.analyzeContentQuality(recipe);
      processingSteps.push({
        step: 'content_quality_analysis',
        timestamp: new Date(),
        success: true,
        metadata: contentQuality
      });

      // Step 4: Logical consistency checks
      const logicalConsistency = this.checkLogicalConsistency(recipe);
      processingSteps.push({
        step: 'logical_consistency_check',
        timestamp: new Date(),
        success: logicalConsistency.valid,
        metadata: logicalConsistency
      });

      // Step 5: Calculate overall quality score
      const qualityScore = this.calculateQualityScore(
        schemaValidation,
        completeness,
        contentQuality,
        logicalConsistency
      );

      // Compile quality metrics
      const issues: string[] = [
        ...schemaValidation.errors,
        ...contentQuality.issues,
        ...logicalConsistency.issues
      ];

      const metrics: QualityMetrics = {
        score: qualityScore,
        issues,
        completeness,
        validation: {
          dataTypes: schemaValidation.success,
          requiredFields: completeness.title && completeness.ingredients && completeness.instructions,
          logicalConsistency: logicalConsistency.valid,
          contentQuality: contentQuality.score > 0.6
        },
        lineage: {
          sourceUrl: recipe.source_url,
          scrapedAt: new Date(),
          processingSteps: processingSteps.map(step => step.step),
          validationVersion: this.validationVersion
        }
      };

      // Store lineage record if data lineage is enabled
      if (this.config.quality.enableDatalineage) {
        this.storeLineageRecord(lineageId, recipe, processingSteps, qualityScore, issues);
      }

      return metrics;

    } catch (error) {
      processingSteps.push({
        step: 'validation_error',
        timestamp: new Date(),
        success: false,
        metadata: { error: error }
      });

      return {
        score: 0,
        issues: [`Validation failed: ${error}`],
        completeness: {
          title: false,
          ingredients: false,
          instructions: false,
          timing: false,
          servings: false,
          nutrition: false
        },
        validation: {
          dataTypes: false,
          requiredFields: false,
          logicalConsistency: false,
          contentQuality: false
        },
        lineage: {
          sourceUrl: recipe.source_url || 'unknown',
          scrapedAt: new Date(),
          processingSteps: processingSteps.map(step => step.step),
          validationVersion: this.validationVersion
        }
      };
    }
  }

  /**
   * Validate recipe against schema
   */
  private validateSchema(recipe: Recipe): { success: boolean; errors: string[] } {
    try {
      RecipeQualitySchema.parse(recipe);
      return { success: true, errors: [] };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.errors.map(err => 
          `${err.path.join('.')}: ${err.message}`
        );
        return { success: false, errors };
      }
      return { success: false, errors: [error as string] };
    }
  }

  /**
   * Assess data completeness
   */
  private assessCompleteness(recipe: Recipe) {
    return {
      title: Boolean(recipe.title && recipe.title.trim().length > 0),
      ingredients: Boolean(recipe.ingredients && recipe.ingredients.length >= 2),
      instructions: Boolean(recipe.instructions && recipe.instructions.length >= 1),
      timing: Boolean(
        recipe.prep_time_minutes || 
        recipe.cook_time_minutes   || 
        recipe.total_time_minutes
      ),
      servings: Boolean(recipe.servings),
      nutrition: Boolean(
        recipe.nutrition && 
        (recipe.nutrition.calories || recipe.nutrition.proteinG || recipe.nutrition.carbohydratesG)
      )
    };
  }

  /**
   * Analyze content quality using pattern matching
   */
  private analyzeContentQuality(recipe: Recipe): { score: number; issues: string[] } {
    const issues: string[] = [];
    let score = 1.0;

    // Check for spam content
    const allText = [
      recipe.title,
      recipe.description,
      ...(recipe.ingredients || []),
      ...(recipe.instructions || [])
    ].join(' ').toLowerCase();

    // Spam detection
    for (const pattern of this.qualityPatterns.spamIndicators) {
      if (pattern.test(allText)) {
        issues.push('Content contains spam indicators');
        score -= 0.5;
        break;
      }
    }

    // Poor content detection
    for (const pattern of this.qualityPatterns.poorContent) {
      if (pattern.test(allText)) {
        issues.push('Content contains placeholder or test text');
        score -= 0.3;
        break;
      }
    }

    // Ingredient quality check
    const ingredientScore = this.assessIngredientQuality(recipe.ingredients.map((ingredient) => ingredient.text) || []);
    if (ingredientScore < 0.5) {
      issues.push('Ingredients lack proper measurements or formatting');
      score -= 0.2;
    }

    // Instruction quality check
    const instructionScore = this.assessInstructionQuality(recipe.instructions.map((step) => step.text) || []);
    if (instructionScore < 0.5) {
      issues.push('Instructions lack proper cooking actions or details');
      score -= 0.2;
    }

    // Title quality check
    if (recipe.title && recipe.title.length < 10) {
      issues.push('Recipe title is too short');
      score -= 0.1;
    }

    return { score: Math.max(0, score), issues };
  }

  /**
   * Assess ingredient quality based on formatting and content
   */
  private assessIngredientQuality(ingredients: string[]): number {
    if (ingredients.length === 0) return 0;

    let qualityPoints = 0;
    const totalIngredients = ingredients.length;

    for (const ingredient of ingredients) {
      // Check if ingredient has measurements
      const hasMeasurement = this.qualityPatterns.goodIngredients.some(pattern => 
        pattern.test(ingredient)
      );
      
      if (hasMeasurement) qualityPoints++;
      
      // Check minimum length
      if (ingredient.trim().length > 3) qualityPoints += 0.5;
    }

    return qualityPoints / (totalIngredients * 1.5); // Max possible score per ingredient
  }

  /**
   * Assess instruction quality based on cooking actions and details
   */
  private assessInstructionQuality(instructions: string[]): number {
    if (instructions.length === 0) return 0;

    let qualityPoints = 0;
    const totalInstructions = instructions.length;

    for (const instruction of instructions) {
      // Check for cooking actions
      const hasCookingAction = this.qualityPatterns.goodInstructions.some(pattern => 
        pattern.test(instruction)
      );
      
      if (hasCookingAction) qualityPoints++;
      
      // Check for reasonable length
      if (instruction.trim().length > 10) qualityPoints += 0.5;
      
      // Check for time/temperature details
      if (/\d+\s*(minute|hour|°[CF])/i.test(instruction)) qualityPoints += 0.3;
    }

    return qualityPoints / (totalInstructions * 1.8); // Max possible score per instruction
  }

  /**
   * Check logical consistency in recipe data
   */
  private checkLogicalConsistency(recipe: Recipe): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    // Time consistency checks
    if (recipe.prep_time_minutes && recipe.cook_time_minutes && recipe.total_time_minutes) {
      const expectedTotal = recipe.prep_time_minutes + recipe.cook_time_minutes;
      const actualTotal = recipe.total_time_minutes;
      
      // Allow for some variance (±20%)
      if (Math.abs(expectedTotal - actualTotal) > expectedTotal * 0.2) {
        issues.push('Total time does not match sum of prep and cook times');
      }
    }

    // Servings consistency
    if (typeof recipe.servings === 'number' && recipe.servings > 50) {
      issues.push('Serving size seems unreasonably large');
    }

    // Ingredient count vs servings
    if (recipe.ingredients && recipe.servings && typeof recipe.servings === 'number') {
      if (recipe.ingredients.length < 2 && recipe.servings > 10) {
        issues.push('Too few ingredients for the number of servings');
      }
    }

    // Nutrition reasonableness
    if (recipe.nutrition) {
      if (recipe.nutrition.calories && recipe.nutrition.calories > 5000) {
        issues.push('Calorie count seems unreasonably high');
      }
      
      if (recipe.nutrition.proteinG && recipe.nutrition.proteinG > 200) {
        issues.push('Protein content seems unreasonably high');
      }
    }

    return { valid: issues.length === 0, issues };
  }

  /**
   * Calculate overall quality score
   */
  private calculateQualityScore(
    schema: { success: boolean },
    completeness: any,
    contentQuality: { score: number },
    consistency: { valid: boolean }
  ): number {
    let score = 0;

    // Schema validation (25% weight)
    if (schema.success) score += 0.25;

    // Completeness (35% weight)
    const completenessFields = Object.values(completeness);
    const completenessScore = completenessFields.filter(Boolean).length / completenessFields.length;
    score += completenessScore * 0.35;

    // Content quality (30% weight)
    score += contentQuality.score * 0.30;

    // Logical consistency (10% weight)
    if (consistency.valid) score += 0.10;

    return Math.min(1, Math.max(0, score));
  }

  /**
   * Store data lineage record for audit trail
   */
  private storeLineageRecord(
    id: string,
    recipe: Recipe,
    processingSteps: any[],
    qualityScore: number,
    issues: string[]
  ): void {
    const record: DataLineageRecord = {
      id,
      sourceUrl: recipe.source_url,
      scrapedAt: new Date(),
      processingSteps,
      qualityScore,
      issues,
      version: this.validationVersion
    };

    this.lineageRecords.set(id, record);

    // In production, this would be persisted to a database
    if (this.config.quality.auditTrailEnabled) {
      console.log(`[DATA-LINEAGE] ${id}:`, {
        sourceUrl: record.sourceUrl,
        qualityScore: record.qualityScore,
        stepsCount: record.processingSteps.length
      });
    }
  }

  /**
   * Generate unique lineage ID
   */
  private generateLineageId(sourceUrl: string): string {
    const timestamp = Date.now();
    const urlHash = this.simpleHash(sourceUrl);
    return `lineage_${urlHash}_${timestamp}`;
  }

  /**
   * Simple hash function for URLs
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Batch validate multiple recipes
   */
  async validateBatch(recipes: Recipe[]): Promise<QualityMetrics[]> {
    const results: QualityMetrics[] = [];
    
    for (const recipe of recipes) {
      try {
        const metrics = await this.validateRecipe(recipe);
        results.push(metrics);
      } catch (error) {
        results.push({
          score: 0,
          issues: [`Batch validation failed: ${error}`],
          completeness: {
            title: false,
            ingredients: false,
            instructions: false,
            timing: false,
            servings: false,
            nutrition: false
          },
          validation: {
            dataTypes: false,
            requiredFields: false,
            logicalConsistency: false,
            contentQuality: false
          },
          lineage: {
            sourceUrl: recipe.source_url || 'unknown',
            scrapedAt: new Date(),
            processingSteps: ['batch_validation_error'],
            validationVersion: this.validationVersion
          }
        });
      }
    }

    return results;
  }

  /**
   * Get lineage record by ID
   */
  getLineageRecord(id: string): DataLineageRecord | null {
    return this.lineageRecords.get(id) || null;
  }

  /**
   * Generate quality assurance report
   */
  generateQualityReport(metrics: QualityMetrics[]): string {
    const totalRecipes = metrics.length;
    const highQuality = metrics.filter(m => m.score >= 0.8).length;
    const mediumQuality = metrics.filter(m => m.score >= 0.5 && m.score < 0.8).length;
    const lowQuality = metrics.filter(m => m.score < 0.5).length;

    const averageScore = totalRecipes > 0 
      ? metrics.reduce((sum, m) => sum + m.score, 0) / totalRecipes 
      : 0;

    const commonIssues = this.getCommonIssues(metrics);

    return `
ENTERPRISE QUALITY ASSURANCE REPORT
===================================
Total Recipes Validated: ${totalRecipes}
Average Quality Score: ${(averageScore * 100).toFixed(1)}%

QUALITY DISTRIBUTION:
- High Quality (≥80%): ${highQuality} recipes (${((highQuality/totalRecipes)*100).toFixed(1)}%)
- Medium Quality (50-79%): ${mediumQuality} recipes (${((mediumQuality/totalRecipes)*100).toFixed(1)}%)
- Low Quality (<50%): ${lowQuality} recipes (${((lowQuality/totalRecipes)*100).toFixed(1)}%)

MOST COMMON ISSUES:
${commonIssues.map((issue, i) => `${i+1}. ${issue.issue} (${issue.count} occurrences)`).join('\n')}

VALIDATION SETTINGS:
- Minimum Data Completeness: ${(this.config.quality.minDataCompleteness * 100).toFixed(0)}%
- Data Lineage Enabled: ${this.config.quality.enableDatalineage}
- Audit Trail Enabled: ${this.config.quality.auditTrailEnabled}
- Validation Version: ${this.validationVersion}

Generated: ${new Date().toISOString()}
    `.trim();
  }

  /**
   * Analyze common issues across recipes
   */
  private getCommonIssues(metrics: QualityMetrics[]): Array<{ issue: string; count: number }> {
    const issueCounts = new Map<string, number>();

    for (const metric of metrics) {
      for (const issue of metric.issues) {
        issueCounts.set(issue, (issueCounts.get(issue) || 0) + 1);
      }
    }

    return Array.from(issueCounts.entries())
      .map(([issue, count]) => ({ issue, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10 issues
  }

  /**
   * Clear old lineage records to manage memory
   */
  clearOldLineageRecords(daysOld = 7): void {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    for (const [id, record] of this.lineageRecords.entries()) {
      if (record.scrapedAt < cutoffDate) {
        this.lineageRecords.delete(id);
      }
    }
  }
}
