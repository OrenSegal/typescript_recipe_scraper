/*
 * Social Media Recipe Scraper
 * 
 * Scrapes recipes from:
 * - Instagram Reels
 * - TikTok Posts
 * - YouTube Videos
 * 
 * All recipes are normalized to comply with the unified recipe structure
 */

import * as path from 'path';
import { RawScrapedRecipe } from "../shared/types.js";
import { VideoOCRProcessor, VideoOCROutput } from "../enrichment/videoOCRProcessor.js";

export interface SocialMediaConfig {
  enableTranscription: boolean;
  enableOCR: boolean;
  enableAdvancedOCR: boolean;
  maxRetries: number;
  timeoutMs: number;
  ocrFrameInterval: number;
  recipeDetectionThreshold: number;
}

export interface VideoMetadata {
  platform: 'instagram' | 'tiktok' | 'youtube';
  videoId: string;
  author: string;
  title: string;
  description: string;
  duration: number;
  viewCount?: number;
  likeCount?: number;
  publishedAt: string;
  thumbnailUrl: string;
}

export class SocialMediaScraper {
  private config: SocialMediaConfig;
  private ocrProcessor: VideoOCRProcessor | null = null;

  constructor(config: Partial<SocialMediaConfig> = {}) {
    this.config = {
      enableTranscription: true,
      enableOCR: true,
      enableAdvancedOCR: true,
      maxRetries: 3,
      timeoutMs: 30000,
      ocrFrameInterval: 1.0,
      recipeDetectionThreshold: 0.3,
      ...config
    };

    // Initialize OCR processor if enabled
    if (this.config.enableAdvancedOCR) {
      this.ocrProcessor = new VideoOCRProcessor({
        ffmpegPath: process.env.FFMPEG_PATH,
        tempDir: path.join(process.cwd(), 'temp', 'ocr'),
        googleVisionApiKey: process.env.GOOGLE_VISION_API_KEY
      });
    }
  }

  /**
   * Get multiple media URLs from account or hashtag
   * @param identifier Account handle (e.g., @username) or hashtag (e.g., #recipes)
   * @param platform Social media platform
   * @param limit Maximum number of URLs to retrieve
   * @returns Array of media URLs
   */
  async getMediaUrls(
    identifier: string, 
    platform: 'instagram' | 'tiktok' | 'youtube', 
    limit: number = 50
  ): Promise<string[]> {
    console.log(`🔍 Getting media URLs from ${platform} for ${identifier}...`);
    
    try {
      switch (platform) {
        case 'instagram':
          return await this.getInstagramMediaUrls(identifier, limit);
        case 'tiktok':
          return await this.getTikTokMediaUrls(identifier, limit);
        case 'youtube':
          return await this.getYouTubeMediaUrls(identifier, limit);
        default:
          console.warn(`⚠️ Unsupported platform: ${platform}`);
          return [];
      }
    } catch (error) {
      console.error(`❌ Failed to get media URLs from ${platform}:`, error);
      return [];
    }
  }

  /**
   * Scrape recipe from social media URL
   */
  async scrapeRecipe(url: string): Promise<RawScrapedRecipe | null> {
    try {
      const platform = this.detectPlatform(url);
      
      switch (platform) {
        case 'instagram':
          return await this.scrapeInstagramReel(url);
        case 'tiktok':
          return await this.scrapeTikTokPost(url);
        case 'youtube':
          return await this.scrapeYouTubeVideo(url);
        default:
          throw new Error(`Unsupported platform: ${platform}`);
      }
    } catch (error) {
      console.error(`❌ Failed to scrape ${url}:`, error);
      return null;
    }
  }

  /*
   * Scrape Instagram Reel
   */
  private async scrapeInstagramReel(url: string): Promise<RawScrapedRecipe | null> {
    console.log(`📱 Scraping Instagram Reel: ${url}`);
    
    try {
      // Extract video metadata
      const metadata = await this.extractInstagramMetadata(url);
      
      // Get video content through multiple methods
      const transcription = this.config.enableTranscription 
        ? await this.extractVideoTranscription(url, 'instagram')
        : null;
      
      const ocrText = this.config.enableOCR 
        ? await this.extractVideoOCR(url, 'instagram')
        : null;
      
      // Advanced OCR with frame extraction if enabled
      const advancedOCRData = this.config.enableAdvancedOCR && this.ocrProcessor
        ? await this.extractAdvancedVideoOCR(url, 'instagram')
        : null;
      
      // Combine all text sources
      const combinedText = [
        metadata.title,
        metadata.description,
        transcription,
        ocrText
      ].filter(Boolean).join('\n\n');
      
      // Parse recipe from combined text
      const recipe = await this.parseRecipeFromText(combinedText, metadata);
      
      return {
        title: recipe.title || metadata.title || 'Instagram Recipe',
        ingredients: recipe.ingredients || [],
        instructions: recipe.instructions || [],
        servings: typeof recipe.servings === 'number' ? Math.max(0, Math.floor(recipe.servings)) : undefined,
        prep_time: typeof recipe.prep_time === 'number' ? Math.max(0, Math.floor(recipe.prep_time)) : undefined,
        cook_time: typeof recipe.cook_time === 'number' ? Math.max(0, Math.floor(recipe.cook_time)) : undefined,
        total_time: typeof recipe.total_time === 'number' ? Math.max(0, Math.floor(recipe.total_time)) : (
          (typeof recipe.prep_time === 'number' ? recipe.prep_time : 0) + (typeof recipe.cook_time === 'number' ? recipe.cook_time : 0)
        ) || undefined,
        author: metadata.author,
        source_url: url,
        image_url: metadata.thumbnailUrl || undefined,
        description: metadata.description || undefined,
        tags: this.extractHashtags(metadata.description || '')
      };
      
    } catch (error) {
      console.error(`❌ Instagram scraping failed:`, error);
      return null;
    }
  }

  /*
   * Scrape TikTok Post
   */
  private async scrapeTikTokPost(url: string): Promise<RawScrapedRecipe | null> {
    console.log(`🎵 Scraping TikTok Post: ${url}`);
    
    try {
      // Extract video metadata
      const metadata = await this.extractTikTokMetadata(url);
      
      // Get video content through multiple methods
      const transcription = this.config.enableTranscription 
        ? await this.extractVideoTranscription(url, 'tiktok')
        : null;
      
      const ocrText = this.config.enableOCR 
        ? await this.extractVideoOCR(url, 'tiktok')
        : null;
      
      // Combine all text sources
      const combinedText = [
        metadata.title,
        metadata.description,
        transcription,
        ocrText
      ].filter(Boolean).join('\n\n');
      
      // Parse recipe from combined text
      const recipe = await this.parseRecipeFromText(combinedText, metadata);
      
      return {
        title: recipe.title || metadata.title || 'TikTok Recipe',
        ingredients: recipe.ingredients || [],
        instructions: recipe.instructions || [],
        servings: typeof recipe.servings === 'number' ? Math.max(0, Math.floor(recipe.servings)) : undefined,
        prep_time: typeof recipe.prep_time === 'number' ? Math.max(0, Math.floor(recipe.prep_time)) : undefined,
        cook_time: typeof recipe.cook_time === 'number' ? Math.max(0, Math.floor(recipe.cook_time)) : undefined,
        total_time: typeof recipe.total_time === 'number' ? Math.max(0, Math.floor(recipe.total_time)) : (
          (typeof recipe.prep_time === 'number' ? recipe.prep_time : 0) + (typeof recipe.cook_time === 'number' ? recipe.cook_time : 0)
        ) || undefined,
        tags: recipe.tags || this.extractHashtags(metadata.description || ''),
        author: metadata.author,
        source_url: url,
        image_url: metadata.thumbnailUrl || undefined,
        description: metadata.description || undefined
      };
      
    } catch (error) {
      console.error(`❌ TikTok scraping failed:`, error);
      return null;
    }
  }

  /*
   * Scrape YouTube Video
   */
  private async scrapeYouTubeVideo(url: string): Promise<RawScrapedRecipe | null> {
    console.log(`📺 Scraping YouTube Video: ${url}`);
    
    try {
      // Extract video metadata
      const metadata = await this.extractYouTubeMetadata(url);
      
      // Get video content through multiple methods
      const transcription = this.config.enableTranscription 
        ? await this.extractVideoTranscription(url, 'youtube')
        : null;
      
      const ocrText = this.config.enableOCR 
        ? await this.extractVideoOCR(url, 'youtube')
        : null;
      
      // Combine all text sources
      const combinedText = [
        metadata.title,
        metadata.description,
        transcription,
        ocrText
      ].filter(Boolean).join('\n\n');
      
      // Parse recipe from combined text
      const recipe = await this.parseRecipeFromText(combinedText, metadata);
      
      return {
        title: recipe.title || metadata.title || 'YouTube Recipe',
        ingredients: recipe.ingredients || [],
        instructions: recipe.instructions || [],
        servings: typeof recipe.servings === 'number' ? Math.max(0, Math.floor(recipe.servings)) : undefined,
        prep_time: typeof recipe.prep_time === 'number' ? Math.max(0, Math.floor(recipe.prep_time)) : undefined,
        cook_time: typeof recipe.cook_time === 'number' ? Math.max(0, Math.floor(recipe.cook_time)) : undefined,
        total_time: typeof recipe.total_time === 'number' ? Math.max(0, Math.floor(recipe.total_time)) : (
          (typeof recipe.prep_time === 'number' ? recipe.prep_time : 0) + (typeof recipe.cook_time === 'number' ? recipe.cook_time : 0)
        ) || undefined,
        tags: recipe.tags || this.extractHashtags(metadata.description || ''),
        author: metadata.author,
        source_url: url,
        image_url: metadata.thumbnailUrl || undefined,
        description: metadata.description || undefined
      };
      
    } catch (error) {
      console.error(`❌ YouTube scraping failed:`, error);
      return null;
    }
  }

  /*
   * Detect platform from URL
   */
  private detectPlatform(url: string): 'instagram' | 'tiktok' | 'youtube' | 'unknown' {
    if (url.includes('instagram.com') || url.includes('instagr.am')) {
      return 'instagram';
    }
    if (url.includes('tiktok.com') || url.includes('vm.tiktok.com')) {
      return 'tiktok';
    }
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      return 'youtube';
    }
    return 'unknown';
  }

  /*
   * Extract Instagram metadata
   */
  private async extractInstagramMetadata(url: string): Promise<VideoMetadata> {
    // Implementation would use Instagram API or web scraping
    // For now, return mock data structure
    return {
      platform: 'instagram',
      videoId: this.extractInstagramId(url),
      author: 'Instagram Chef',
      title: 'Instagram Recipe',
      description: '',
      duration: 60,
      publishedAt: new Date().toISOString(),
      thumbnailUrl: ''
    };
  }

  /*
   * Extract TikTok metadata
   */
  private async extractTikTokMetadata(url: string): Promise<VideoMetadata> {
    // Implementation would use TikTok API or web scraping
    // For now, return mock data structure
    return {
      platform: 'tiktok',
      videoId: this.extractTikTokId(url),
      author: 'TikTok Chef',
      title: 'TikTok Recipe',
      description: '',
      duration: 30,
      publishedAt: new Date().toISOString(),
      thumbnailUrl: ''
    };
  }

  /*
   * Extract YouTube metadata
   */
  private async extractYouTubeMetadata(url: string): Promise<VideoMetadata> {
    // Implementation would use YouTube API
    // For now, return mock data structure
    return {
      platform: 'youtube',
      videoId: this.extractYouTubeId(url),
      author: 'YouTube Chef',
      title: 'YouTube Recipe',
      description: '',
      duration: 300,
      publishedAt: new Date().toISOString(),
      thumbnailUrl: ''
    };
  }

  /*
   * Extract video transcription using speech-to-text
   */
  private async extractVideoTranscription(url: string, platform: string): Promise<string | null> {
    // Implementation would use services like:
    // - OpenAI Whisper
    // - Google Speech-to-Text
    // - Azure Speech Services
    console.log(`🎤 Extracting transcription from ${platform} video`);
    return null; // Placeholder
  }

  /*
   * Extract text from video using OCR
   */
  private async extractVideoOCR(url: string, platform: string): Promise<string | null> {
    // Implementation would use services like:
    // - Google Vision API
    // - Azure Computer Vision
    // - Tesseract.js
    console.log(`👁️ Extracting OCR text from ${platform} video`);
    return null; // Placeholder
  }

  /*
   * Parse recipe from combined text using NLP
   */
  private async parseRecipeFromText(text: string, metadata: VideoMetadata): Promise<Partial<RawScrapedRecipe>> {
    // Implementation would use:
    // - OpenAI GPT for recipe extraction
    // - Custom NLP models
    // - Pattern matching
    
    console.log(`🧠 Parsing recipe from text (${text.length} characters)`);
    
    // Basic pattern matching for demo
    const ingredients = this.extractIngredients(text);
    const instructions = this.extractInstructions(text);
    const title = this.extractTitle(text, metadata.title);
    
    const servings = this.extractServings(text);
    const prep = this.extractTime(text, 'prep');
    const cook = this.extractTime(text, 'cook');
    const total = this.extractTime(text, 'total');
    return {
      title,
      ingredients,
      instructions,
      servings: servings !== null && servings !== undefined ? Math.max(0, Math.floor(servings)) : undefined,
      prep_time: prep !== null && prep !== undefined ? Math.max(0, Math.floor(prep)) : undefined,
      cook_time: cook !== null && cook !== undefined ? Math.max(0, Math.floor(cook)) : undefined,
      total_time: total !== null && total !== undefined
        ? Math.max(0, Math.floor(total))
        : (prep != null || cook != null) ? Math.max(0, Math.floor((prep || 0) + (cook || 0))) : undefined
    };
  }

  /*
   * Extract ingredients from text
   */
  private extractIngredients(text: string): string[] {
    const ingredients: string[] = [];
    
    // Look for ingredient patterns
    const patterns = [
      /(?:ingredients?|you'?ll need|what you need):\s*([^.!?]*)/gi,
      /(?:^|\n)\s*[-•*]\s*([^.\n]+)/gm,
      /(?:^|\n)\s*\d+[^.\n]*(?:cup|tbsp|tsp|oz|lb|g|kg|ml|l)[^.\n]*/gm
    ];
    
    for (const pattern of patterns) {
      const matches = text.match(pattern);
      if (matches) {
        ingredients.push(...matches.map(m => m.trim()));
      }
    }
    
    return [...new Set(ingredients)].slice(0, 20); // Limit and dedupe
  }

  /*
   * Extract instructions from text
   */
  private extractInstructions(text: string): string[] {
    const instructions: string[] = [];
    
    // Look for instruction patterns
    const patterns = [
      /(?:instructions?|method|steps?):\s*([^.!?]*)/gi,
      /(?:^|\n)\s*\d+\.\s*([^.\n]+)/gm,
      /(?:first|then|next|finally)[^.!?]*[.!?]/gi
    ];
    
    for (const pattern of patterns) {
      const matches = text.match(pattern);
      if (matches) {
        instructions.push(...matches.map(m => m.trim()));
      }
    }
    
    return [...new Set(instructions)].slice(0, 15); // Limit and dedupe
  }

  /*
   * Extract title from text
   */
  private extractTitle(text: string, fallback: string): string {
    // Look for recipe title patterns
    const titlePatterns = [
      /(?:recipe for|how to make|making)\s+([^.\n!?]{5,50})/i,
      /^([^.\n!?]{10,60})\s*recipe/im,
      /^([A-Z][^.\n!?]{5,50})/m
    ];
    
    for (const pattern of titlePatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    
    return fallback || 'Social Media Recipe';
  }

  /*
   * Extract servings from text
   */
  private extractServings(text: string): number | null {
    // Handles: "serves 4", "servings: 6", "4 servings"
    const patterns = [
      /(?:serves?|servings?|portions?)\s*:?[\s-]*(\d{1,3})/i,
      /(\d{1,3})\s*(?:serves?|servings?|portions?)/i
    ];
    for (const p of patterns) {
      const m = text.match(p);
      if (m) return parseInt(m[1], 10);
    }
    return null;
  }

  /*
   * Extract time from text
   */
  private extractTime(text: string, type: 'prep' | 'cook' | 'total'): number | null {
    // Try multiple formats:
    // - "prep time: 15 min", "cook: 30 minutes"
    // - "prep time: 1:30" (hh:mm or mm:ss assumed minutes:seconds -> treat as minutes)
    // - "prep: 1 hr 20 min", "cook 2h"
    const sources = [
      new RegExp(`${type}\\s*time\\s*:?\\s*(\\d{1,3})\\s*(?:min|mins?|minutes?)`, 'i'),
      new RegExp(`${type}\\s*:?\\s*(\\d{1,3})\\s*(?:min|mins?|minutes?)`, 'i'),
      new RegExp(`${type}\\s*time\\s*:?\\s*(\\d{1,2}):(\\d{1,2})`, 'i'),
      new RegExp(`${type}\\s*:?\\s*(\\d{1,2}):(\\d{1,2})`, 'i'),
      new RegExp(`${type}\\s*time\\s*:?\\s*(\\d{1,3})\\s*(?:h|hr|hrs|hour|hours)\\s*(\\d{1,3})?\\s*(?:min|mins?|minutes?)?`, 'i'),
      new RegExp(`${type}\\s*:?\\s*(\\d{1,3})\\s*(?:h|hr|hrs|hour|hours)\\s*(\\d{1,3})?\\s*(?:min|mins?|minutes?)?`, 'i')
    ];
    for (const r of sources) {
      const m = text.match(r);
      if (!m) continue;
      if (m.length === 3 && m[2] !== undefined && r.source.includes(':')) {
        // hh:mm (or mm:ss) -> treat as hh:mm when first part >=1 hour else minutes:seconds
        const a = parseInt(m[1], 10);
        const b = parseInt(m[2], 10);
        // Assume hh:mm if a >= 2, else still hh:mm for simplicity
        return a * 60 + b;
      }
      if (r.source.includes('h') && (m[1] || m[2])) {
        const hours = parseInt(m[1] || '0', 10);
        const mins = m[2] ? parseInt(m[2], 10) : 0;
        return hours * 60 + mins;
      }
      return parseInt(m[1], 10);
    }
    return null;
  }

  /*
   * Extract hashtags from text
   */
  private extractHashtags(text: string): string[] {
    const hashtagPattern = /#[\w]+/g;
    const matches = text.match(hashtagPattern);
    return matches ? matches.map(tag => tag.substring(1)) : [];
  }

  /*
   * Extract Instagram video ID from URL
   */
  private extractInstagramId(url: string): string {
    const match = url.match(/\/(?:p|reel)\/([A-Za-z0-9_-]+)/);
    return match ? match[1] : '';
  }

  /*
   * Extract TikTok video ID from URL
   */
  private extractTikTokId(url: string): string {
    const match = url.match(/\/video\/(\d+)/);
    return match ? match[1] : '';
  }

  /*
   * Extract YouTube video ID from URL
   */
  private extractYouTubeId(url: string): string {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]+)/,
      /youtube\.com\/embed\/([A-Za-z0-9_-]+)/
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    
    return '';
  }

  /**
   * Advanced video OCR extraction using comprehensive frame analysis
   */
  private async extractAdvancedVideoOCR(url: string, platform: string): Promise<VideoOCROutput | null> {
    if (!this.ocrProcessor) {
      console.warn('⚠️  OCR processor not initialized');
      return null;
    }

    try {
      console.log(`🔍 Starting advanced OCR extraction for ${platform} video: ${url}`);
      
      // First, download the video to a temporary location
      const videoPath = await this.downloadVideoForOCR(url, platform);
      
      // Extract text using comprehensive OCR pipeline
      const ocrResult = await this.ocrProcessor.processVideo(videoPath);
      
      // Cleanup temporary video file
      await this.cleanupVideoFile(videoPath);
      
      console.log(`✅ Advanced OCR completed: ${ocrResult.extractedText.length} chars, ${ocrResult.frameCount} frames`);
      return ocrResult;
      
    } catch (error) {
      console.error(`❌ Advanced OCR failed for ${url}:`, error);
      return null;
    }
  }

  /**
   * Check if content contains recipe-related signals
   */
  private isRecipeContent(text: string, ocrData?: VideoOCROutput | null): boolean {
    const lowerText = text.toLowerCase();
    
    // Recipe signal keywords
    const recipeKeywords = [
      'recipe', 'ingredient', 'cook', 'bake', 'fry', 'boil', 'simmer', 'roast',
      'grill', 'sauté', 'mix', 'stir', 'chop', 'dice', 'slice', 'mince',
      'tablespoon', 'teaspoon', 'cup', 'ounce', 'pound', 'gram', 'liter',
      'temperature', 'degrees', 'minutes', 'hours', 'serve', 'garnish',
      'salt', 'pepper', 'oil', 'butter', 'onion', 'garlic', 'flour', 'sugar'
    ];
    
    // Count recipe-related keywords
    let keywordCount = 0;
    for (const keyword of recipeKeywords) {
      if (lowerText.includes(keyword)) {
        keywordCount++;
      }
    }
    
    // Calculate recipe relevance score
    const textScore = keywordCount / recipeKeywords.length;
    
    // Enhanced scoring with OCR data
    let ocrScore = 0;
    if (ocrData) {
      ocrScore = (
        (ocrData.ingredients.length * 0.3) +
        (ocrData.instructions.length * 0.2) +
        (ocrData.isRecipeContent ? 0.2 : 0) +
        (ocrData.extractedText.length > 100 ? 0.3 : 0)
      );
    }
    
    const finalScore = Math.max(textScore, ocrScore);
    
    console.log(`🎯 Recipe relevance score: ${finalScore.toFixed(2)} (text: ${textScore.toFixed(2)}, ocr: ${ocrScore.toFixed(2)})`);
    
    return finalScore >= this.config.recipeDetectionThreshold;
  }

  /**
   * Download video for OCR processing
   */
  private async downloadVideoForOCR(url: string, platform: string): Promise<string> {
    // This is a placeholder - in production, you'd use yt-dlp or similar
    // For now, return a mock path for testing
    console.log(`📥 Downloading ${platform} video for OCR: ${url}`);
    
    // In a real implementation, you would:
    // 1. Use yt-dlp or similar to download the video
    // 2. Save to a temporary directory
    // 3. Return the path to the downloaded video
    
    throw new Error('Video download not implemented yet - requires yt-dlp integration');
  }

  /**
   * Cleanup temporary video files
   */
  private async cleanupVideoFile(videoPath: string): Promise<void> {
    try {
      const fs = await import('fs');
      if (fs.existsSync(videoPath)) {
        fs.unlinkSync(videoPath);
        console.log(`🧹 Cleaned up video file: ${videoPath}`);
      }
    } catch (error) {
      console.warn(`⚠️  Failed to cleanup video file: ${videoPath}`);
    }
  }

  /**
   * Enhanced recipe parsing with OCR data integration
   */
  private async parseRecipeWithOCR(
    combinedText: string, 
    metadata: VideoMetadata, 
    ocrData?: VideoOCROutput | null
  ): Promise<any> {
    // Start with basic text parsing
    const baseRecipe = await this.parseRecipeFromText(combinedText, metadata);
    
    // Enhance with OCR data if available
    if (ocrData) {
      return {
        ...baseRecipe,
        // Merge OCR-extracted ingredients with parsed ones
        ingredients: this.mergeIngredients(baseRecipe.ingredients || [], ocrData.ingredients),
        // Merge OCR-extracted instructions with parsed ones
        instructions: this.mergeInstructions(baseRecipe.instructions || [], ocrData.instructions),
        // Add OCR processing metrics
        frameCount: ocrData.frameCount,
        processingTime: ocrData.processingTime
      };
    }
    
    return baseRecipe;
  }

  /**
   * Merge ingredients from different sources
   */
  private mergeIngredients(textIngredients: string[], ocrIngredients: string[]): string[] {
    const merged = [...textIngredients];
    
    for (const ocrIngredient of ocrIngredients) {
      // Only add if not already present (case-insensitive)
      if (!merged.some(ing => ing.toLowerCase().includes(ocrIngredient.toLowerCase()))) {
        merged.push(ocrIngredient);
      }
    }
    
    return merged;
  }

  /**
   * Merge instructions from different sources
   */
  private mergeInstructions(textInstructions: string[], ocrInstructions: string[]): string[] {
    const merged = [...textInstructions];
    
    for (const ocrInstruction of ocrInstructions) {
      // Only add if not already present and contains cooking verbs
      const hasAction = ['mix', 'stir', 'add', 'cook', 'bake', 'heat'].some(action => 
        ocrInstruction.toLowerCase().includes(action)
      );
      
      if (hasAction && !merged.some(inst => 
        inst.toLowerCase().includes(ocrInstruction.toLowerCase().slice(0, 20))
      )) {
        merged.push(ocrInstruction);
      }
    }
    
    return merged;
  }

  /**
   * Get Instagram media URLs from account or hashtag
   * @param identifier Account handle (e.g., @username) or hashtag (e.g., #recipes)
   * @param limit Maximum number of URLs to retrieve
   */
  private async getInstagramMediaUrls(identifier: string, limit: number): Promise<string[]> {
    console.log(`📸 Fetching Instagram URLs for ${identifier}...`);
    
    // For now, return a placeholder implementation
    // In production, this would integrate with Instagram's API or use web scraping
    const urls: string[] = [];
    
    try {
      // Placeholder logic - in production, would use Instagram Basic Display API
      // or web scraping to get recent posts from account/hashtag
      console.warn('⚠️ Instagram media URL extraction not yet implemented - returning empty array');
      console.log('💡 To implement: Use Instagram Basic Display API or web scraping');
      
      return urls.slice(0, limit);
    } catch (error) {
      console.error('❌ Failed to get Instagram URLs:', error);
      return [];
    }
  }

  /**
   * Get TikTok media URLs from account or hashtag
   * @param identifier Account handle (e.g., @username) or hashtag (e.g., #recipes)
   * @param limit Maximum number of URLs to retrieve
   */
  private async getTikTokMediaUrls(identifier: string, limit: number): Promise<string[]> {
    console.log(`🎵 Fetching TikTok URLs for ${identifier}...`);
    
    const urls: string[] = [];
    
    try {
      // Placeholder logic - in production, would use TikTok API or web scraping
      console.warn('⚠️ TikTok media URL extraction not yet implemented - returning empty array');
      console.log('💡 To implement: Use TikTok Research API or web scraping with proper headers');
      
      return urls.slice(0, limit);
    } catch (error) {
      console.error('❌ Failed to get TikTok URLs:', error);
      return [];
    }
  }

  /**
   * Get YouTube media URLs from channel or search query
   * @param identifier Channel handle (e.g., @channel) or search query (e.g., "recipe")
   * @param limit Maximum number of URLs to retrieve
   */
  private async getYouTubeMediaUrls(identifier: string, limit: number): Promise<string[]> {
    console.log(`📺 Fetching YouTube URLs for ${identifier}...`);
    
    const urls: string[] = [];
    
    try {
      // Placeholder logic - in production, would use YouTube Data API v3
      console.warn('⚠️ YouTube media URL extraction not yet implemented - returning empty array');
      console.log('💡 To implement: Use YouTube Data API v3 with proper API key');
      console.log(`💡 Example: search.list or channels.list for ${identifier}`);
      
      return urls.slice(0, limit);
    } catch (error) {
      console.error('❌ Failed to get YouTube URLs:', error);
      return [];
    }
  }

  /**
   * Cleanup resources when scraper is done
   */
  async destroy(): Promise<void> {
    if (this.ocrProcessor) {
      await this.ocrProcessor.destroy();
    }
  }
}
