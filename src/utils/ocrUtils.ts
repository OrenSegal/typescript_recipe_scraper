/**
 * Production OCR Utilities
 * Reusable utility functions following SOLID/DRY principles
 */

import * as fs from 'fs';
import * as path from 'path';
import { OCR_CONSTANTS, RECIPE_KEYWORDS, EQUIPMENT_KEYWORDS, COOKING_ACTIONS } from '../constants/ocrConstants.js';

/**
 * File system utilities
 */
export class FileSystemUtils {
  static ensureDirectoryExists(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  static safeDeleteFile(filePath: string): boolean {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return true;
      }
      return false;
    } catch (error) {
      console.warn(`⚠️  Failed to delete file: ${filePath}`);
      return false;
    }
  }

  static cleanupDirectory(dirPath: string, filePattern?: string): number {
    let deletedCount = 0;
    try {
      if (!fs.existsSync(dirPath)) return 0;
      
      const files = fs.readdirSync(dirPath);
      for (const file of files) {
        if (!filePattern || file.match(filePattern)) {
          const filePath = path.join(dirPath, file);
          if (this.safeDeleteFile(filePath)) {
            deletedCount++;
          }
        }
      }
    } catch (error) {
      console.warn(`⚠️  Failed to cleanup directory: ${dirPath}`);
    }
    return deletedCount;
  }
}

/**
 * Text analysis utilities
 */
export class TextAnalysisUtils {
  /**
   * Calculate recipe relevance score based on keyword analysis
   */
  static calculateRecipeRelevance(text: string): number {
    if (!text) return 0;
    
    const lowerText = text.toLowerCase();
    let keywordCount = 0;
    
    for (const keyword of RECIPE_KEYWORDS) {
      if (lowerText.includes(keyword)) {
        keywordCount++;
      }
    }
    
    return keywordCount / RECIPE_KEYWORDS.length;
  }

  /**
   * Extract equipment mentions from text
   */
  static extractEquipment(text: string): string[] {
    if (!text) return [];
    
    const lowerText = text.toLowerCase();
    const foundEquipment: string[] = [];
    
    for (const equipment of EQUIPMENT_KEYWORDS) {
      if (lowerText.includes(equipment)) {
        foundEquipment.push(equipment);
      }
    }
    
    return [...new Set(foundEquipment)]; // Remove duplicates
  }

  /**
   * Check if text line contains cooking actions
   */
  static containsCookingAction(text: string): boolean {
    if (!text) return false;
    
    const lowerText = text.toLowerCase();
    return COOKING_ACTIONS.some(action => lowerText.includes(action));
  }

  /**
   * Check if text line looks like an ingredient with measurements
   */
  static isIngredientLine(text: string): boolean {
    if (!text) return false;
    
    const measurementRegex = /\b\d+(?:\.\d+)?\s*(cup|cups|tbsp|tsp|tablespoon|teaspoon|oz|ounce|lb|pound|g|gram|ml|liter|inch|inches)\b/i;
    return measurementRegex.test(text);
  }

  /**
   * Clean and normalize text content
   */
  static normalizeText(text: string): string {
    if (!text) return '';
    
    return text
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s.,!?()-]/g, '')
      .toLowerCase();
  }
}

/**
 * Video processing utilities
 */
export class VideoProcessingUtils {
  /**
   * Generate FFMPEG arguments for frame extraction
   */
  static generateFFMPEGArgs(inputPath: string, outputPattern: string, frameInterval: number): string[] {
    return [
      ...OCR_CONSTANTS.FFMPEG_ARGS_TEMPLATE.INPUT, inputPath,
      ...OCR_CONSTANTS.FFMPEG_ARGS_TEMPLATE.VIDEO_FILTER, 
      OCR_CONSTANTS.FFMPEG_ARGS_TEMPLATE.FPS_FILTER(frameInterval),
      ...OCR_CONSTANTS.FFMPEG_ARGS_TEMPLATE.OVERWRITE,
      outputPattern
    ];
  }

  /**
   * Calculate edge density for text detection
   */
  static calculateEdgeDensity(edgeBuffer: Buffer): number {
    if (!edgeBuffer || edgeBuffer.length === 0) return 0;
    
    let edgeCount = 0;
    for (let i = 0; i < edgeBuffer.length; i++) {
      if (edgeBuffer[i] > 50) { // Edge threshold
        edgeCount++;
      }
    }
    
    return edgeCount / edgeBuffer.length;
  }
}

/**
 * Data merging utilities
 */
export class DataMergingUtils {
  /**
   * Merge ingredients from multiple sources with deduplication
   */
  static mergeIngredients(textIngredients: string[], ocrIngredients: string[]): string[] {
    const merged = [...textIngredients];
    
    for (const ocrIngredient of ocrIngredients) {
      const normalized = TextAnalysisUtils.normalizeText(ocrIngredient);
      const isDuplicate = merged.some(existing => 
        TextAnalysisUtils.normalizeText(existing).includes(normalized) ||
        normalized.includes(TextAnalysisUtils.normalizeText(existing))
      );
      
      if (!isDuplicate) {
        merged.push(ocrIngredient);
      }
    }
    
    return merged;
  }

  /**
   * Merge instructions from multiple sources with cooking action validation
   */
  static mergeInstructions(textInstructions: string[], ocrInstructions: string[]): string[] {
    const merged = [...textInstructions];
    
    for (const ocrInstruction of ocrInstructions) {
      if (!TextAnalysisUtils.containsCookingAction(ocrInstruction)) {
        continue; // Skip non-cooking instructions
      }
      
      const normalized = TextAnalysisUtils.normalizeText(ocrInstruction);
      const isDuplicate = merged.some(existing => 
        TextAnalysisUtils.normalizeText(existing).slice(0, 30).includes(normalized.slice(0, 30))
      );
      
      if (!isDuplicate) {
        merged.push(ocrInstruction);
      }
    }
    
    return merged;
  }

  /**
   * Combine text from multiple sources with priorities
   */
  static combineTextSources(sources: Array<{ text: string; priority: number }>): string {
    return sources
      .filter(source => source.text && source.text.trim().length > 0)
      .sort((a, b) => b.priority - a.priority)
      .map(source => source.text)
      .join('\n\n');
  }
}

/**
 * Validation utilities
 */
export class ValidationUtils {
  /**
   * Validate OCR result completeness
   */
  static validateOCRCompleteness(result: {
    extractedText: string;
    ingredients: string[];
    instructions: string[];
    confidence: number;
  }): { isValid: boolean; score: number; issues: string[] } {
    const issues: string[] = [];
    let score = 0;

    // Check text extraction
    if (result.extractedText && result.extractedText.length > 10) {
      score += 0.2;
    } else {
      issues.push('Insufficient text extracted');
    }

    // Check ingredients
    if (result.ingredients.length >= OCR_CONSTANTS.MIN_RECIPE_INGREDIENTS) {
      score += 0.3;
    } else {
      issues.push(`Need at least ${OCR_CONSTANTS.MIN_RECIPE_INGREDIENTS} ingredients`);
    }

    // Check instructions
    if (result.instructions.length >= OCR_CONSTANTS.MIN_RECIPE_INSTRUCTIONS) {
      score += 0.3;
    } else {
      issues.push(`Need at least ${OCR_CONSTANTS.MIN_RECIPE_INSTRUCTIONS} instructions`);
    }

    // Check confidence
    if (result.confidence >= OCR_CONSTANTS.MIN_TEXT_CONFIDENCE) {
      score += 0.2;
    } else {
      issues.push(`Confidence too low: ${result.confidence}`);
    }

    return {
      isValid: score >= 0.7,
      score,
      issues
    };
  }

  /**
   * Validate recipe content signals
   */
  static isRecipeContent(text: string, threshold: number = OCR_CONSTANTS.RECIPE_DETECTION_THRESHOLD): boolean {
    const score = TextAnalysisUtils.calculateRecipeRelevance(text);
    return score >= threshold;
  }
}

/**
 * Error handling utilities
 */
export class ErrorHandlingUtils {
  /**
   * Safe async operation with retry logic
   */
  static async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = OCR_CONSTANTS.MAX_RETRIES,
    delay: number = 1000
  ): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === maxRetries) {
          break;
        }
        
        console.warn(`⚠️  Attempt ${attempt} failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
      }
    }
    
    throw lastError;
  }

  /**
   * Safe error message extraction
   */
  static getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }
}
