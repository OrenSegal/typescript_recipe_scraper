/**
 * Production Utilities
 * 
 * Centralized utility functions following DRY/KISS principles
 * Single source of truth for all reusable helper functions
 */

import * as fs from 'fs';
import * as path from 'path';
import { PATTERNS, ERROR_MESSAGES, SCRAPING_CONFIG } from './constants.js';

// ===== STRING UTILITIES =====
export class StringUtils {
  /**
   * Clean and normalize text content
   */
  static cleanText(text: string): string {
    if (!text) return '';
    
    return text
      .replace(PATTERNS.HTML_TAGS, '')
      .replace(PATTERNS.EXTRA_WHITESPACE, ' ')
      .replace(PATTERNS.MULTIPLE_NEWLINES, '\n')
      .trim();
  }

  /**
   * Extract numbers from text
   */
  static extractNumbers(text: string): number[] {
    const matches = text.match(/\d+\.?\d*/g);
    return matches ? matches.map(Number).filter(n => !isNaN(n)) : [];
  }

  /**
   * Capitalize first letter of each word
   */
  static titleCase(text: string): string {
    return text.toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
  }

  /**
   * Generate slug from text
   */
  static slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Truncate text to specified length
   */
  static truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 3) + '...';
  }

  /**
   * Check if text contains recipe keywords
   */
  static containsRecipeKeywords(text: string, threshold = 3): boolean {
    const lowerText = text.toLowerCase();
    const keywordCount = text.split(/\s+/).filter(word => 
      lowerText.includes(word.toLowerCase())
    ).length;
    return keywordCount >= threshold;
  }
}

// ===== VALIDATION UTILITIES =====
export class ValidationUtils {
  /**
   * Validate URL format
   */
  static isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return PATTERNS.HTTP_URL.test(url);
    } catch {
      return false;
    }
  }

  /**
   * Validate recipe data completeness
   */
  static validateRecipeData(recipe: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!recipe.title || recipe.title.length < SCRAPING_CONFIG.MIN_TITLE_LENGTH) {
      errors.push('Title is missing or too short');
    }

    if (!recipe.ingredients || recipe.ingredients.length < SCRAPING_CONFIG.MIN_INGREDIENT_COUNT) {
      errors.push('Insufficient ingredients');
    }

    if (!recipe.instructions || recipe.instructions.length < SCRAPING_CONFIG.MIN_INSTRUCTION_COUNT) {
      errors.push('Insufficient instructions');
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Validate email format
   */
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate numeric range
   */
  static isInRange(value: number, min: number, max: number): boolean {
    return value >= min && value <= max;
  }

  /**
   * Check if value is not null/undefined/empty
   */
  static hasValue(value: any): boolean {
    return value !== null && value !== undefined && value !== '';
  }
}

// ===== FILE UTILITIES =====
export class FileUtils {
  /**
   * Check if file exists
   */
  static fileExists(filePath: string): boolean {
    return fs.existsSync(filePath);
  }

  /**
   * Ensure directory exists, create if not
   */
  static ensureDirectory(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  /**
   * Write JSON data to file safely
   */
  static writeJsonFile(filePath: string, data: any): void {
    this.ensureDirectory(path.dirname(filePath));
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  /**
   * Read JSON file safely
   */
  static readJsonFile<T>(filePath: string): T | null {
    try {
      if (!fs.existsSync(filePath)) return null;
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content) as T;
    } catch (error) {
      console.error(`Error reading JSON file ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Delete file safely
   */
  static deleteFile(filePath: string): boolean {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return true;
      }
      return false;
    } catch (error) {
      console.error(`Error deleting file ${filePath}:`, error);
      return false;
    }
  }

  /**
   * Check if directory exists
   */
  static directoryExists(dirPath: string): boolean {
    try {
      return fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * Get files in directory matching pattern
   */
  static getFilesInDirectory(dirPath: string, pattern: string = '*'): string[] {
    try {
      if (!fs.existsSync(dirPath)) return [];
      const files = fs.readdirSync(dirPath);
      if (pattern === '*') return files;
      
      // Simple pattern matching (supports basic wildcards)
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      return files.filter(file => regex.test(file));
    } catch {
      return [];
    }
  }

  /**
   * Get file size in bytes
   */
  static getFileSize(filePath: string): number {
    try {
      return fs.statSync(filePath).size;
    } catch {
      return 0;
    }
  }

  /**
   * Clean up temporary files older than specified time
   */
  static cleanupTempFiles(directory: string, maxAgeMs: number = 24 * 60 * 60 * 1000): number {
    let cleanedCount = 0;
    
    try {
      if (!fs.existsSync(directory)) return 0;
      
      const files = fs.readdirSync(directory);
      const now = Date.now();
      
      for (const file of files) {
        const filePath = path.join(directory, file);
        const stats = fs.statSync(filePath);
        
        if (now - stats.mtime.getTime() > maxAgeMs) {
          if (stats.isDirectory()) {
            fs.rmSync(filePath, { recursive: true, force: true });
          } else {
            fs.unlinkSync(filePath);
          }
          cleanedCount++;
        }
      }
    } catch (error) {
      console.error('Error cleaning up temp files:', error);
    }
    
    return cleanedCount;
  }
}

// ===== ASYNC UTILITIES =====
export class AsyncUtils {
  /**
   * Sleep for specified milliseconds
   */
  static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Retry async operation with exponential backoff
   */
  static async retry<T>(
    operation: () => Promise<T>,
    maxAttempts: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === maxAttempts) {
          throw lastError;
        }
        
        const delay = baseDelay * Math.pow(2, attempt - 1);
        await this.sleep(delay);
      }
    }
    
    throw lastError!;
  }

  /**
   * Execute operations in batches with concurrency control
   */
  static async processBatches<T, R>(
    items: T[],
    batchSize: number,
    processor: (batch: T[]) => Promise<R[]>
  ): Promise<R[]> {
    const results: R[] = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchResults = await processor(batch);
      results.push(...batchResults);
    }
    
    return results;
  }

  /**
   * Timeout promise wrapper
   */
  static withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error(ERROR_MESSAGES.TIMEOUT_ERROR)), timeoutMs)
      )
    ]);
  }

  /**
   * Rate limited function executor
   */
  static createRateLimiter(maxRequests: number, windowMs: number) {
    const requests: number[] = [];
    
    return async <T>(fn: () => Promise<T>): Promise<T> => {
      const now = Date.now();
      
      // Remove old requests outside the window
      while (requests.length > 0 && requests[0] <= now - windowMs) {
        requests.shift();
      }
      
      // Wait if we've hit the limit
      if (requests.length >= maxRequests) {
        const oldestRequest = requests[0];
        const waitTime = windowMs - (now - oldestRequest);
        await this.sleep(waitTime);
        return this.createRateLimiter(maxRequests, windowMs)(fn);
      }
      
      // Execute the function
      requests.push(now);
      return await fn();
    };
  }
}

// ===== PARSING UTILITIES =====
export class ParsingUtils {
  /**
   * Parse cooking time from text
   */
  static parseTime(text: string): { minutes: number; hours: number } {
    const timeMatches = text.match(PATTERNS.TIME_DURATION) || [];
    let totalMinutes = 0;
    
    for (const match of timeMatches) {
      const [, value, unit] = match.match(/(\d+)\s*(min|minutes|hour|hours|hr|h)/i) || [];
      if (value && unit) {
        const num = parseInt(value);
        if (unit.toLowerCase().startsWith('h')) {
          totalMinutes += num * 60;
        } else {
          totalMinutes += num;
        }
      }
    }
    
    return {
      minutes: totalMinutes % 60,
      hours: Math.floor(totalMinutes / 60)
    };
  }

  /**
   * Parse temperature from text
   */
  static parseTemperature(text: string): { value: number; unit: 'F' | 'C' } | null {
    const match = text.match(PATTERNS.TEMPERATURE);
    if (!match) return null;
    
    const [, value, unit] = match;
    return {
      value: parseInt(value),
      unit: unit.toLowerCase().startsWith('c') ? 'C' : 'F'
    };
  }

  /**
   * Parse quantity from ingredient text
   */
  static parseQuantity(text: string): { amount: number | null; unit: string | null } {
    const match = text.match(PATTERNS.QUANTITY);
    if (!match) return { amount: null, unit: null };
    
    const [, amount, unit] = match;
    return {
      amount: amount ? parseFloat(amount) : null,
      unit: unit || null
    };
  }

  /**
   * Extract fractions and convert to decimal
   */
  static parseFraction(text: string): number {
    // Handle common fractions like 1/2, 3/4, 1/3, etc.
    const fractionMatch = text.match(/(\d+)\/(\d+)/);
    if (fractionMatch) {
      const [, numerator, denominator] = fractionMatch;
      return parseInt(numerator) / parseInt(denominator);
    }
    
    // Handle mixed numbers like 1 1/2
    const mixedMatch = text.match(/(\d+)\s+(\d+)\/(\d+)/);
    if (mixedMatch) {
      const [, whole, numerator, denominator] = mixedMatch;
      return parseInt(whole) + (parseInt(numerator) / parseInt(denominator));
    }
    
    return parseFloat(text) || 0;
  }
}

// ===== LOGGING UTILITIES =====
export class LoggingUtils {
  private static formatTimestamp(): string {
    return new Date().toISOString();
  }

  /**
   * Log with timestamp and level
   */
  static log(level: 'info' | 'warn' | 'error', message: string, data?: any): void {
    const timestamp = this.formatTimestamp();
    const logEntry = `[${timestamp}] ${level.toUpperCase()}: ${message}`;
    
    if (level === 'error') {
      console.error(logEntry, data || '');
    } else if (level === 'warn') {
      console.warn(logEntry, data || '');
    } else {
      console.log(logEntry, data || '');
    }
  }

  /**
   * Log to file
   */
  static logToFile(filePath: string, level: string, message: string, data?: any): void {
    const timestamp = this.formatTimestamp();
    const logEntry = `[${timestamp}] ${level.toUpperCase()}: ${message} ${data ? JSON.stringify(data) : ''}\n`;
    
    FileUtils.ensureDirectory(path.dirname(filePath));
    fs.appendFileSync(filePath, logEntry);
  }

  /**
   * Create progress logger
   */
  static createProgressLogger(total: number, description: string) {
    let completed = 0;
    let lastReported = 0;
    
    return {
      increment(): void {
        completed++;
        const percentage = Math.floor((completed / total) * 100);
        
        if (percentage >= lastReported + 10) {
          console.log(`${description}: ${percentage}% (${completed}/${total})`);
          lastReported = percentage;
        }
      },
      
      finish(): void {
        console.log(`${description}: Complete! (${completed}/${total})`);
      }
    };
  }
}

// ===== PERFORMANCE UTILITIES =====
export class PerformanceUtils {
  private static timers = new Map<string, number>();

  /**
   * Start performance timer
   */
  static startTimer(name: string): void {
    this.timers.set(name, Date.now());
  }

  /**
   * End performance timer and return duration
   */
  static endTimer(name: string): number {
    const startTime = this.timers.get(name);
    if (!startTime) return 0;
    
    const duration = Date.now() - startTime;
    this.timers.delete(name);
    return duration;
  }

  /**
   * Measure function execution time
   */
  static async measureAsync<T>(fn: () => Promise<T>, name?: string): Promise<{ result: T; duration: number }> {
    const startTime = Date.now();
    const result = await fn();
    const duration = Date.now() - startTime;
    
    if (name) {
      console.log(`${name} completed in ${duration}ms`);
    }
    
    return { result, duration };
  }

  /**
   * Memory usage statistics
   */
  static getMemoryUsage(): NodeJS.MemoryUsage {
    return process.memoryUsage();
  }

  /**
   * Format bytes to human readable
   */
  static formatBytes(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }
}

// ===== EXPORT ALL UTILITIES =====
export const Utils = {
  String: StringUtils,
  Validation: ValidationUtils,
  File: FileUtils,
  Async: AsyncUtils,
  Parsing: ParsingUtils,
  Logging: LoggingUtils,
  Performance: PerformanceUtils
};
