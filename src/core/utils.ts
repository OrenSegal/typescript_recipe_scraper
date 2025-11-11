/**
 * UNIFIED UTILITIES
 * 
 * Reusable utility functions following SOLID principles
 * Each function has a single responsibility and is highly reusable
 */

import { ValidationError, ProcessingError } from './types.js';
import { VALIDATION_PATTERNS, TIME_CONSTANTS } from './constants.js';

// ===== VALIDATION UTILITIES (Single Responsibility) =====

export class ValidationUtils {
  static isValidUrl(url: string): boolean {
    return VALIDATION_PATTERNS.URL.test(url);
  }

  static isValidEmail(email: string): boolean {
    return VALIDATION_PATTERNS.EMAIL.test(email);
  }

  static isValidUuid(uuid: string): boolean {
    return VALIDATION_PATTERNS.UUID.test(uuid);
  }

  static isPositiveNumber(value: any): boolean {
    const num = Number(value);
    return !isNaN(num) && num > 0;
  }

  static isValidServings(servings: any): boolean {
    if (typeof servings === 'string') {
      const parsed = parseInt(servings);
      return !isNaN(parsed) && parsed > 0;
    }
    return typeof servings === 'number' && servings > 0;
  }

  static sanitizeString(str: string): string {
    return str.trim().replace(/\s+/g, ' ').replace(/[<>]/g, '');
  }

  static validateRequiredFields<T>(obj: T, requiredFields: (keyof T)[]): ValidationError[] {
    const errors: ValidationError[] = [];
    
    for (const field of requiredFields) {
      if (!obj[field]) {
        errors.push({
          field: String(field),
          message: `${String(field)} is required`,
          code: 'MISSING_REQUIRED_FIELD'
        });
      }
    }
    
    return errors;
  }
}

// ===== STRING UTILITIES (KISS - Simple and focused) =====

export class StringUtils {
  static normalize(str: string): string {
    return str.trim().replace(/\s+/g, ' ').toLowerCase();
  }

  static capitalizeWords(str: string): string {
    return str.replace(/\b\w/g, char => char.toUpperCase());
  }

  static removeHtmlTags(str: string): string {
    return str.replace(/<[^>]*>/g, '').trim();
  }

  static extractNumbers(str: string): number[] {
    const matches = str.match(/\d+\.?\d*/g);
    return matches ? matches.map(Number) : [];
  }

  static extractFractions(str: string): number[] {
    const fractionMatches = str.match(/\d+\/\d+/g);
    if (!fractionMatches) return [];
    
    return fractionMatches.map(frac => {
      const [num, den] = frac.split('/').map(Number);
      return num / den;
    });
  }

  static pluralize(word: string, count: number): string {
    if (count === 1) return word;
    
    const irregulars: Record<string, string> = {
      'leaf': 'leaves',
      'knife': 'knives',
      'child': 'children'
    };
    
    if (irregulars[word]) return irregulars[word];
    
    if (word.endsWith('s') || word.endsWith('sh') || word.endsWith('ch')) {
      return word + 'es';
    }
    
    return word + 's';
  }

  static similarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    return (longer.length - this.levenshteinDistance(longer, shorter)) / longer.length;
  }

  private static levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }
}

// ===== ARRAY UTILITIES (DRY - Reusable array operations) =====

export class ArrayUtils {
  static removeDuplicates<T>(array: T[]): T[] {
    return [...new Set(array)];
  }

  static removeEmpty<T>(array: (T | null | undefined)[]): T[] {
    return array.filter((item): item is T => item != null);
  }

  static chunk<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  static shuffle<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  static groupBy<T>(array: T[], keyFn: (item: T) => string | number): Record<string | number, T[]> {
    return array.reduce((groups, item) => {
      const key = keyFn(item);
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
      return groups;
    }, {} as Record<string | number, T[]>);
  }

  static findBest<T>(array: T[], scoreFn: (item: T) => number): T | null {
    if (array.length === 0) return null;
    
    let best = array[0];
    let bestScore = scoreFn(best);
    
    for (let i = 1; i < array.length; i++) {
      const score = scoreFn(array[i]);
      if (score > bestScore) {
        best = array[i];
        bestScore = score;
      }
    }
    
    return best;
  }
}

// ===== ASYNC UTILITIES (SOLID - Well-defined interfaces) =====

export class AsyncUtils {
  static async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  static async retry<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000
  ): Promise<T> {
    let lastError: Error;
    
    for (let i = 0; i <= maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        if (i < maxRetries) {
          await this.sleep(delay * Math.pow(2, i)); // Exponential backoff
        }
      }
    }
    
    throw lastError!;
  }

  static async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number = TIME_CONSTANTS.DEFAULT_TIMEOUT
  ): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs);
    });
    
    return Promise.race([promise, timeoutPromise]);
  }

  static async parallel<T>(
    tasks: (() => Promise<T>)[],
    concurrency: number = 5
  ): Promise<T[]> {
    const results: T[] = [];
    const executing: Promise<void>[] = [];
    
    for (const task of tasks) {
      const promise = task().then(result => {
        results.push(result);
      });
      
      executing.push(promise);
      
      if (executing.length >= concurrency) {
        await Promise.race(executing);
        executing.splice(executing.findIndex(p => p === promise), 1);
      }
    }
    
    await Promise.all(executing);
    return results;
  }
}

// ===== TIME UTILITIES (YAGNI - Only essential time functions) =====

export class TimeUtils {
  static formatDuration(minutes: number): string {
    if (minutes < 60) {
      return `${minutes}m`;
    }
    
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (remainingMinutes === 0) {
      return `${hours}h`;
    }
    
    return `${hours}h ${remainingMinutes}m`;
  }

  static parseDuration(str: string): number | null {
    const timeMatch = str.match(/(\d+)\s*(?:hours?|hrs?|h)\s*(?:(\d+)\s*(?:minutes?|mins?|m))?/i);
    if (timeMatch) {
      const hours = parseInt(timeMatch[1]);
      const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
      return hours * 60 + minutes;
    }
    
    const minuteMatch = str.match(/(\d+)\s*(?:minutes?|mins?|m)/i);
    if (minuteMatch) {
      return parseInt(minuteMatch[1]);
    }
    
    return null;
  }

  static getCurrentTimestamp(): string {
    return new Date().toISOString();
  }

  static isValidDate(dateStr: string): boolean {
    return !isNaN(Date.parse(dateStr));
  }
}

// ===== NUMBER UTILITIES =====

export class NumberUtils {
  static roundToDecimal(num: number, decimals: number = 2): number {
    return Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals);
  }

  static clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }

  static isInRange(value: number, min: number, max: number): boolean {
    return value >= min && value <= max;
  }

  static parseNumber(str: string): number | null {
    const cleaned = str.replace(/[^\d.-]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }

  static formatNumber(num: number): string {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  }
}

// ===== ERROR UTILITIES (SOLID - Single responsibility for error handling) =====

export class ErrorUtils {
  static createProcessingError(
    message: string,
    code: string,
    source: string,
    details?: any,
    recoverable: boolean = true
  ): ProcessingError {
    return {
      code,
      message,
      details,
      timestamp: TimeUtils.getCurrentTimestamp(),
      source,
      recoverable
    };
  }

  static isNetworkError(error: any): boolean {
    return error?.code === 'ENOTFOUND' || 
           error?.code === 'ECONNREFUSED' || 
           error?.code === 'ETIMEDOUT' ||
           error?.name === 'NetworkError';
  }

  static isTimeoutError(error: any): boolean {
    return error?.message?.includes('timeout') || 
           error?.code === 'ETIMEDOUT' ||
           error?.name === 'TimeoutError';
  }

  static extractErrorMessage(error: any): string {
    if (typeof error === 'string') return error;
    if (error?.message) return error.message;
    if (error?.error) return error.error;
    return 'Unknown error occurred';
  }

  static logError(error: any, context?: string): void {
    const message = this.extractErrorMessage(error);
    const timestamp = TimeUtils.getCurrentTimestamp();
    console.error(`[${timestamp}] ${context ? `${context}: ` : ''}${message}`, error);
  }
}

// ===== FILE UTILITIES (YAGNI - Basic file operations only) =====

export class FileUtils {
  static getFileExtension(filename: string): string {
    return filename.split('.').pop()?.toLowerCase() || '';
  }

  static isImageFile(filename: string): boolean {
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
    return imageExtensions.includes(this.getFileExtension(filename));
  }

  static isVideoFile(filename: string): boolean {
    const videoExtensions = ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm'];
    return videoExtensions.includes(this.getFileExtension(filename));
  }

  static sanitizeFilename(filename: string): string {
    return filename.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, '_');
  }

  static generateUniqueFilename(baseName: string, extension: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${baseName}_${timestamp}_${random}.${extension}`;
  }
}
