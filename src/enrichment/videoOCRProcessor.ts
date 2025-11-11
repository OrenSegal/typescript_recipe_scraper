/**
 * Production-Ready Video OCR Processor
 * 
 * SOLID/DRY/KISS implementation for video text extraction:
 * - Google Vision API for high-accuracy OCR
 * - Tesseract.js as fallback OCR
 * - Smart frame extraction focusing on text/equipment
 * - Recipe detection and content filtering
 */

import * as fs from 'fs';
import * as path from 'path';
import { createWorker } from 'tesseract.js';
import vision from '@google-cloud/vision';
import sharp from 'sharp';
import { spawn } from 'child_process';

// Production constants (centralized for DRY principle)
const CONFIG = {
  FRAME_EXTRACTION_INTERVAL: 1, // Extract frame every 1 second
  MAX_FRAMES_TO_PROCESS: 30, // Limit for performance
  OCR_CONFIDENCE_THRESHOLD: 0.5,
  RECIPE_KEYWORD_THRESHOLD: 3,
  MAX_VIDEO_DURATION: 300, // 5 minutes max
  TEMP_DIR_PREFIX: 'video_ocr_',
  FRAME_FORMAT: 'png',
  IMAGE_QUALITY: 90
} as const;

// Recipe detection keywords (centralized constants)
const RECIPE_KEYWORDS = [
  'recipe', 'ingredient', 'cook', 'bake', 'mix', 'stir', 'heat', 'add',
  'cup', 'tablespoon', 'teaspoon', 'ounce', 'pound', 'gram', 'liter',
  'minutes', 'hours', 'temperature', 'oven', 'pan', 'bowl', 'whisk'
] as const;

const EQUIPMENT_KEYWORDS = [
  'oven', 'stove', 'pan', 'pot', 'bowl', 'whisk', 'spatula', 'knife',
  'cutting board', 'mixer', 'blender', 'food processor', 'measuring cup'
] as const;

// Type definitions
interface OCRFrame {
  framePath: string;
  timestamp: number;
  hasText: boolean;
  confidence: number;
}

interface OCRResult {
  text: string;
  confidence: number;
  timestamp: number;
  source: 'google' | 'tesseract';
}

export interface VideoOCROutput {
  extractedText: string;
  ingredients: string[];
  instructions: string[];
  equipment: string[];
  isRecipeContent: boolean;
  confidence: number;
  processingTime: number;
  frameCount: number;
}

/**
 * Production-ready Video OCR Processor
 * Follows SOLID principles with single responsibility and dependency injection
 */
export class VideoOCRProcessor {
  private readonly ffmpegPath: string;
  private readonly tempDir: string;
  private readonly googleVisionClient: vision.ImageAnnotatorClient | null;
  
  constructor(config: {
    ffmpegPath?: string;
    tempDir?: string;
    googleVisionApiKey?: string;
  } = {}) {
    this.ffmpegPath = config.ffmpegPath || 'ffmpeg';
    this.tempDir = config.tempDir || path.join(process.cwd(), 'temp');
    
    // Initialize Google Vision API if key provided
    this.googleVisionClient = config.googleVisionApiKey ? 
      new vision.ImageAnnotatorClient() : null;
      
    this.ensureTempDirectory();
  }

  /**
   * Main entry point - process video and extract recipe text
   */
  async processVideo(videoPath: string): Promise<VideoOCROutput> {
    const startTime = Date.now();
    const sessionId = `${CONFIG.TEMP_DIR_PREFIX}${Date.now()}`;
    const frameDir = path.join(this.tempDir, sessionId);
    
    try {
      this.createSessionDirectory(frameDir);
      
      const frames = await this.extractFrames(videoPath, frameDir);
      const textFrames = await this.filterTextFrames(frames);
      const ocrResults = await this.performOCROnFrames(textFrames);
      const combinedText = this.combineOCRResults(ocrResults);
      const recipeData = this.extractRecipeInformation(combinedText);
      
      return {
        ...recipeData,
        processingTime: Date.now() - startTime,
        frameCount: frames.length
      };
    } finally {
      await this.cleanup(frameDir);
    }
  }

  /**
   * Extract frames from video at specified intervals
   */
  private async extractFrames(videoPath: string, outputDir: string): Promise<OCRFrame[]> {
    return new Promise((resolve, reject) => {
      const frames: OCRFrame[] = [];
      const framePattern = path.join(outputDir, 'frame_%03d.png');
      
      const ffmpegArgs = [
        '-i', videoPath,
        '-vf', `fps=1/${CONFIG.FRAME_EXTRACTION_INTERVAL}`,
        '-q:v', CONFIG.IMAGE_QUALITY.toString(),
        '-f', 'image2',
        framePattern
      ];

      const process = spawn(this.ffmpegPath, ffmpegArgs);
      
      process.on('close', (code) => {
        if (code === 0) {
          // Collect generated frame files
          const frameFiles = fs.readdirSync(outputDir)
            .filter(file => file.startsWith('frame_') && file.endsWith('.png'))
            .sort()
            .slice(0, CONFIG.MAX_FRAMES_TO_PROCESS);

          frameFiles.forEach((file, index) => {
            frames.push({
              framePath: path.join(outputDir, file),
              timestamp: index * CONFIG.FRAME_EXTRACTION_INTERVAL,
              hasText: false, // Will be determined later
              confidence: 0
            });
          });
          
          resolve(frames);
        } else {
          reject(new Error(`FFmpeg failed with code ${code}`));
        }
      });

      process.on('error', (error) => {
        reject(new Error(`FFmpeg error: ${error.message}`));
      });
    });
  }

  /**
   * Filter frames to identify those likely containing text
   */
  private async filterTextFrames(frames: OCRFrame[]): Promise<OCRFrame[]> {
    const textFrames: OCRFrame[] = [];
    
    for (const frame of frames) {
      try {
        const hasText = await this.detectTextInFrame(frame.framePath);
        if (hasText) {
          frame.hasText = true;
          textFrames.push(frame);
        }
      } catch (error) {
        console.warn(`Failed to analyze frame ${frame.framePath}:`, error);
      }
    }
    
    return textFrames;
  }

  /**
   * Detect if frame likely contains text using edge detection
   */
  private async detectTextInFrame(imagePath: string): Promise<boolean> {
    try {
      const image = sharp(imagePath);
      const { width, height } = await image.metadata();
      
      if (!width || !height) return false;
      
      // Apply edge detection to find text-like features
      const edges = await image
        .greyscale()
        .convolve({
          width: 3,
          height: 3,
          kernel: [-1, -1, -1, -1, 8, -1, -1, -1, -1]
        })
        .raw()
        .toBuffer();
      
      // Calculate edge density (simple heuristic for text detection)
      const edgePixels = edges.filter(pixel => pixel > 100).length;
      const edgeDensity = edgePixels / (width * height);
      
      return edgeDensity > 0.01; // Threshold for text presence
    } catch (error) {
      console.warn(`Edge detection failed for ${imagePath}:`, error);
      return true; // Default to processing the frame
    }
  }

  /**
   * Perform OCR on filtered frames
   */
  private async performOCROnFrames(frames: OCRFrame[]): Promise<OCRResult[]> {
    const results: OCRResult[] = [];
    
    for (const frame of frames) {
      try {
        let ocrResult: OCRResult;
        
        // Try Google Vision API first if available
        if (this.googleVisionClient) {
          ocrResult = await this.performGoogleVisionOCR(frame);
        } else {
          ocrResult = await this.performTesseractOCR(frame);
        }
        
        if (ocrResult.confidence > CONFIG.OCR_CONFIDENCE_THRESHOLD) {
          results.push(ocrResult);
        }
      } catch (error) {
        console.warn(`OCR failed for frame ${frame.framePath}:`, error);
      }
    }
    
    return results;
  }

  /**
   * Perform OCR using Google Vision API
   */
  private async performGoogleVisionOCR(frame: OCRFrame): Promise<OCRResult> {
    if (!this.googleVisionClient) {
      throw new Error('Google Vision client not initialized');
    }
    
    const [result] = await this.googleVisionClient.textDetection(frame.framePath);
    const detections = result.textAnnotations || [];
    
    if (detections.length === 0) {
      return {
        text: '',
        confidence: 0,
        timestamp: frame.timestamp,
        source: 'google'
      };
    }
    
    const fullText = detections[0]?.description || '';
    const confidence = detections[0]?.confidence || 0.5;
    
    return {
      text: fullText,
      confidence,
      timestamp: frame.timestamp,
      source: 'google'
    };
  }

  /**
   * Perform OCR using Tesseract.js
   */
  private async performTesseractOCR(frame: OCRFrame): Promise<OCRResult> {
    const worker = await createWorker('eng');
    
    try {
      const { data } = await worker.recognize(frame.framePath);
      
      return {
        text: data.text,
        confidence: data.confidence / 100, // Normalize to 0-1
        timestamp: frame.timestamp,
        source: 'tesseract'
      };
    } finally {
      await worker.terminate();
    }
  }

  /**
   * Combine OCR results from multiple frames
   */
  private combineOCRResults(results: OCRResult[]): string {
    if (results.length === 0) return '';
    
    // Sort by timestamp and combine text
    const sortedResults = results.sort((a, b) => a.timestamp - b.timestamp);
    const combinedText = sortedResults.map(r => r.text).join('\n').trim();
    
    // Remove duplicate lines that often occur across frames
    const lines = combinedText.split('\n');
    const uniqueLines = Array.from(new Set(lines.filter(line => line.trim().length > 0)));
    
    return uniqueLines.join('\n');
  }

  /**
   * Extract recipe information from combined OCR text
   */
  private extractRecipeInformation(text: string): Omit<VideoOCROutput, 'processingTime' | 'frameCount'> {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    const ingredients = this.extractIngredients(lines);
    const instructions = this.extractInstructions(lines);
    const isRecipeContent = this.isRecipeContent(text);
    const equipment = this.extractEquipment(lines);
    const confidence = this.calculateRecipeConfidence(text, ingredients, instructions);
    
    return {
      extractedText: text,
      ingredients,
      instructions,
      equipment,
      isRecipeContent,
      confidence
    };
  }

  /**
   * Extract ingredients from OCR text lines
   */
  private extractIngredients(lines: string[]): string[] {
    const ingredients: string[] = [];
    
    for (const line of lines) {
      if (this.looksLikeIngredient(line)) {
        ingredients.push(line);
      }
    }
    
    return ingredients;
  }

  /**
   * Extract instructions from OCR text lines
   */
  private extractInstructions(lines: string[]): string[] {
    const instructions: string[] = [];
    
    for (const line of lines) {
      if (this.looksLikeInstruction(line)) {
        instructions.push(line);
      }
    }
    
    return instructions;
  }

  /**
   * Determine if line looks like an ingredient
   */
  private looksLikeIngredient(line: string): boolean {
    const lowerLine = line.toLowerCase();
    
    // Look for quantity patterns and common ingredient words
    const hasQuantity = /\d+\s*(cup|tbsp|tsp|oz|lb|g|ml|l)\b/.test(lowerLine);
    const hasIngredientWords = RECIPE_KEYWORDS.some(keyword => lowerLine.includes(keyword));
    
    return hasQuantity || hasIngredientWords;
  }

  /**
   * Determine if line looks like an instruction
   */
  private looksLikeInstruction(line: string): boolean {
    const lowerLine = line.toLowerCase();
    
    // Look for action words and instruction patterns
    const actionWords = ['add', 'mix', 'stir', 'cook', 'bake', 'heat', 'combine', 'whisk'];
    const hasActionWords = actionWords.some(word => lowerLine.includes(word));
    const hasStepPattern = /^\d+\./.test(line.trim()); // Numbered steps
    
    return hasActionWords || hasStepPattern;
  }

  /**
   * Extract cooking equipment from OCR text lines
   */
  private extractEquipment(lines: string[]): string[] {
    const equipment = new Set<string>();
    const equipmentKeywords = ['pan', 'pot', 'bowl', 'whisk', 'spatula', 'knife', 'cutting board', 'mixer', 'blender', 'oven', 'stove', 'skillet', 'saucepan', 'baking sheet', 'measuring cup', 'spoon', 'fork'];
    
    for (const line of lines) {
      const lowerLine = line.toLowerCase();
      for (const keyword of equipmentKeywords) {
        if (lowerLine.includes(keyword)) {
          equipment.add(keyword);
        }
      }
    }
    
    return Array.from(equipment);
  }

  /**
   * Determine if text contains recipe content
   */
  private isRecipeContent(text: string): boolean {
    const lowerText = text.toLowerCase();
    const recipeKeywordCount = RECIPE_KEYWORDS.filter(keyword => 
      lowerText.includes(keyword)
    ).length;
    
    return recipeKeywordCount >= CONFIG.RECIPE_KEYWORD_THRESHOLD;
  }

  /**
   * Calculate confidence score for recipe content
   */
  private calculateRecipeConfidence(text: string, ingredients: string[], instructions: string[]): number {
    let score = 0;
    
    // Base score from recipe keywords
    const lowerText = text.toLowerCase();
    const keywordMatches = RECIPE_KEYWORDS.filter(keyword => lowerText.includes(keyword)).length;
    score += Math.min(keywordMatches * 0.1, 0.4);
    
    // Boost for extracted ingredients and instructions
    score += Math.min(ingredients.length * 0.05, 0.3);
    score += Math.min(instructions.length * 0.05, 0.3);
    
    return Math.min(score, 1.0);
  }

  /**
   * Utility methods following DRY principle
   */
  private ensureTempDirectory(): void {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  private createSessionDirectory(dir: string): void {
    fs.mkdirSync(dir, { recursive: true });
  }

  /**
   * Cleanup temporary files
   */
  private async cleanup(frameDir: string): Promise<void> {
    try {
      if (fs.existsSync(frameDir)) {
        const files = fs.readdirSync(frameDir);
        for (const file of files) {
          fs.unlinkSync(path.join(frameDir, file));
        }
        fs.rmdirSync(frameDir);
      }
    } catch (error) {
      console.warn(`Cleanup failed for ${frameDir}:`, error);
    }
  }

  /**
   * Destroy processor and cleanup all resources
   */
  async destroy(): Promise<void> {
    try {
      // Cleanup any remaining temp directories
      if (fs.existsSync(this.tempDir)) {
        const sessionDirs = fs.readdirSync(this.tempDir)
          .filter(dir => dir.startsWith(CONFIG.TEMP_DIR_PREFIX))
          .map(dir => path.join(this.tempDir, dir));
        
        for (const dir of sessionDirs) {
          await this.cleanup(dir);
        }
      }
    } catch (error) {
      console.warn('Failed to destroy VideoOCRProcessor:', error);
    }
  }
}
