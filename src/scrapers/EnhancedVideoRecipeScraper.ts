/**
 * Enhanced Video Recipe Scraper
 *
 * Unified scraper for YouTube, TikTok, and Instagram
 * - Transcript extraction (audio + captions)
 * - OCR from video frames
 * - NLP-based recipe parsing
 * - Automatic nutrition enrichment
 * - Robust error handling with fallbacks
 *
 * Consolidates SocialMediaScraper with enhanced capabilities
 */

import axios from 'axios';
import { Recipe, RecipeIngredient, InstructionStep } from '../shared/types.js';
import { parseRecipeFromNaturalLanguage } from '../enrichment/nlpRecipeParser.js';
import { enrichRecipeWithNutrition } from '../enrichment/UnifiedNutritionEnrichment.js';
import { VideoOCRProcessor } from '../enrichment/videoOCRProcessor.js';
import { AudioTranscriptionProcessor } from '../enrichment/audioTranscriptionProcessor.js';

// =============================================================================
// Types
// =============================================================================

export interface VideoRecipeConfig {
  enableTranscription: boolean;
  enableOCR: boolean;
  enableNutrition: boolean;
  maxRetries: number;
  timeout: number;
}

export interface VideoMetadata {
  platform: 'youtube' | 'tiktok' | 'instagram';
  videoId: string;
  title: string;
  description: string;
  author: string;
  duration: number;
  thumbnailUrl: string;
  publishedAt?: string;
  viewCount?: number;
}

export interface ExtractedContent {
  transcript?: string;
  captions?: string;
  ocrText?: string;
  description: string;
  title: string;
}

// =============================================================================
// Configuration
// =============================================================================

const defaultConfig: VideoRecipeConfig = {
  enableTranscription: true,
  enableOCR: true,
  enableNutrition: true,
  maxRetries: 2,
  timeout: 30000,
};

// =============================================================================
// Enhanced Video Recipe Scraper
// =============================================================================

export class EnhancedVideoRecipeScraper {
  private config: VideoRecipeConfig;
  private ocrProcessor: VideoOCRProcessor | null = null;

  constructor(config: Partial<VideoRecipeConfig> = {}) {
    this.config = { ...defaultConfig, ...config };

    // Initialize OCR processor
    if (this.config.enableOCR) {
      this.ocrProcessor = new VideoOCRProcessor({
        ffmpegPath: process.env.FFMPEG_PATH,
        tempDir: './temp/ocr',
        googleVisionApiKey: process.env.GOOGLE_VISION_API_KEY,
      });
    }

    // Note: AudioTranscriptionProcessor uses static methods, no initialization needed
  }

  // ===========================================================================
  // Main Public API
  // ===========================================================================

  /**
   * Scrape recipe from video URL (YouTube, TikTok, Instagram)
   */
  public async scrapeRecipe(url: string): Promise<Recipe | null> {
    console.log(`\n🎥 Scraping video recipe: ${url}`);

    try {
      // Step 1: Detect platform and extract metadata
      const platform = this.detectPlatform(url);
      console.log(`📍 Platform: ${platform}`);

      const metadata = await this.extractMetadata(url, platform);
      if (!metadata) {
        throw new Error('Failed to extract video metadata');
      }

      console.log(`📋 Video: ${metadata.title} by ${metadata.author}`);

      // Step 2: Extract content (transcript, OCR, captions)
      const content = await this.extractAllContent(url, platform, metadata);

      // Step 3: Parse recipe using NLP
      const parsedRecipe = await this.parseRecipeFromContent(content, metadata);

      // Step 4: Enrich with nutrition (optional)
      const enrichedRecipe = this.config.enableNutrition
        ? await enrichRecipeWithNutrition(parsedRecipe)
        : parsedRecipe;

      console.log(`✅ Successfully scraped recipe: ${enrichedRecipe.title}`);
      return enrichedRecipe;
    } catch (error: any) {
      console.error(`❌ Failed to scrape video recipe:`, error.message);
      return null;
    }
  }

  /**
   * Batch scrape recipes from multiple video URLs
   */
  public async scrapeMultiple(urls: string[]): Promise<Recipe[]> {
    console.log(`\n📦 Batch scraping ${urls.length} videos...`);

    const recipes = await Promise.all(
      urls.map((url) => this.scrapeRecipe(url))
    );

    const successful = recipes.filter((r): r is Recipe => r !== null);
    console.log(`✅ Successfully scraped ${successful.length}/${urls.length} recipes`);

    return successful;
  }

  // ===========================================================================
  // Platform Detection
  // ===========================================================================

  private detectPlatform(url: string): 'youtube' | 'tiktok' | 'instagram' {
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      return 'youtube';
    } else if (url.includes('tiktok.com')) {
      return 'tiktok';
    } else if (url.includes('instagram.com')) {
      return 'instagram';
    }

    throw new Error(`Unsupported platform for URL: ${url}`);
  }

  // ===========================================================================
  // Metadata Extraction
  // ===========================================================================

  private async extractMetadata(
    url: string,
    platform: 'youtube' | 'tiktok' | 'instagram'
  ): Promise<VideoMetadata | null> {
    switch (platform) {
      case 'youtube':
        return this.extractYouTubeMetadata(url);
      case 'tiktok':
        return this.extractTikTokMetadata(url);
      case 'instagram':
        return this.extractInstagramMetadata(url);
    }
  }

  private async extractYouTubeMetadata(url: string): Promise<VideoMetadata | null> {
    try {
      // Extract video ID
      const videoIdMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
      const videoId = videoIdMatch?.[1];

      if (!videoId) {
        throw new Error('Invalid YouTube URL');
      }

      // Use oEmbed API (no key required)
      const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
      const response = await axios.get(oembedUrl, { timeout: this.config.timeout });

      return {
        platform: 'youtube',
        videoId,
        title: response.data.title || 'YouTube Recipe',
        description: '',
        author: response.data.author_name || 'Unknown',
        duration: 0,
        thumbnailUrl: response.data.thumbnail_url || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      };
    } catch (error: any) {
      console.error('❌ YouTube metadata extraction failed:', error.message);
      return null;
    }
  }

  private async extractTikTokMetadata(url: string): Promise<VideoMetadata | null> {
    try {
      // Use oEmbed for TikTok
      const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`;
      const response = await axios.get(oembedUrl, { timeout: this.config.timeout });

      const videoIdMatch = url.match(/video\/(\d+)/);
      const videoId = videoIdMatch?.[1] || 'unknown';

      return {
        platform: 'tiktok',
        videoId,
        title: response.data.title || 'TikTok Recipe',
        description: '',
        author: response.data.author_name || 'Unknown',
        duration: 0,
        thumbnailUrl: response.data.thumbnail_url || '',
      };
    } catch (error: any) {
      console.error('❌ TikTok metadata extraction failed:', error.message);
      return null;
    }
  }

  private async extractInstagramMetadata(url: string): Promise<VideoMetadata | null> {
    try {
      // Use oEmbed for Instagram
      const oembedUrl = `https://graph.facebook.com/v12.0/instagram_oembed?url=${encodeURIComponent(url)}&access_token=${process.env.INSTAGRAM_ACCESS_TOKEN}`;

      const response = await axios.get(oembedUrl, { timeout: this.config.timeout });

      const postIdMatch = url.match(/\/p\/([^/]+)/);
      const videoId = postIdMatch?.[1] || 'unknown';

      return {
        platform: 'instagram',
        videoId,
        title: response.data.title || 'Instagram Recipe',
        description: '',
        author: response.data.author_name || 'Unknown',
        duration: 0,
        thumbnailUrl: response.data.thumbnail_url || '',
      };
    } catch (error: any) {
      console.error('❌ Instagram metadata extraction failed:', error.message);
      // Fallback without API
      return {
        platform: 'instagram',
        videoId: 'unknown',
        title: 'Instagram Recipe',
        description: '',
        author: 'Unknown',
        duration: 0,
        thumbnailUrl: '',
      };
    }
  }

  // ===========================================================================
  // Content Extraction (Transcript, OCR, Captions)
  // ===========================================================================

  private async extractAllContent(
    url: string,
    platform: string,
    metadata: VideoMetadata
  ): Promise<ExtractedContent> {
    console.log(`📝 Extracting content from ${platform} video...`);

    const content: ExtractedContent = {
      title: metadata.title,
      description: metadata.description,
    };

    // Extract transcript/captions
    if (this.config.enableTranscription) {
      try {
        console.log('🎤 Extracting audio transcript...');
        const transcript = await this.extractTranscript(url, platform);
        if (transcript) {
          content.transcript = transcript;
          console.log(`✅ Transcript: ${transcript.length} characters`);
        }
      } catch (error: any) {
        console.warn('⚠️  Transcript extraction failed:', error.message);
      }
    }

    // Extract text from video frames using OCR
    if (this.config.enableOCR && this.ocrProcessor) {
      try {
        console.log('👁️  Extracting text from video frames (OCR)...');
        const ocrResult = await this.ocrProcessor.processVideo(url);
        if (ocrResult && ocrResult.extractedText) {
          content.ocrText = ocrResult.extractedText; // Already a string
          console.log(`✅ OCR text: ${content.ocrText.length} characters`);
        }
      } catch (error: any) {
        console.warn('⚠️  OCR extraction failed:', error.message);
      }
    }

    return content;
  }

  private async extractTranscript(
    url: string,
    platform: string
  ): Promise<string | null> {
    try {
      // For YouTube, try to get captions first (faster)
      if (platform === 'youtube') {
        const captions = await this.getYouTubeCaptions(url);
        if (captions) return captions;
      }

      // Fall back to audio transcription using static method
      const transcript = await AudioTranscriptionProcessor.transcribe(url, {
        language: 'en-US',
        maxDuration: 300,
      });
      return transcript || null;
    } catch (error: any) {
      console.error('❌ Transcript extraction error:', error.message);
      return null;
    }
  }

  private async getYouTubeCaptions(url: string): Promise<string | null> {
    // This would require youtube-dl or similar tool
    // For now, return null and rely on audio transcription
    console.log('ℹ️  YouTube caption extraction not implemented, using audio transcription');
    return null;
  }

  // ===========================================================================
  // Recipe Parsing
  // ===========================================================================

  private async parseRecipeFromContent(
    content: ExtractedContent,
    metadata: VideoMetadata
  ): Promise<Recipe> {
    console.log('🧠 Parsing recipe from extracted content...');

    // Combine all text sources (filter out undefined/null/empty strings)
    const combinedText = [
      content.title,
      content.description,
      content.transcript,
      content.captions,
      content.ocrText,
    ]
      .filter((text): text is string => typeof text === 'string' && text.length > 0)
      .join('\n\n');

    console.log(`📄 Combined text: ${combinedText.length} characters`);

    // Use NLP parser
    const parsed = await parseRecipeFromNaturalLanguage(combinedText);

    // Generate platform-specific URL
    let sourceUrl = '';
    if (metadata.platform === 'youtube') {
      sourceUrl = `https://www.youtube.com/watch?v=${metadata.videoId}`;
    } else if (metadata.platform === 'tiktok') {
      sourceUrl = `https://www.tiktok.com/@user/video/${metadata.videoId}`;
    } else if (metadata.platform === 'instagram') {
      sourceUrl = `https://www.instagram.com/p/${metadata.videoId}`;
    }

    // Convert to Recipe format
    const recipe: Recipe = {
      title: parsed.title || metadata.title || 'Video Recipe',
      description: parsed.description || metadata.description,
      ingredients: this.convertToRecipeIngredients(parsed.ingredients),
      instructions: this.convertToInstructionSteps(parsed.instructions),
      servings: parsed.servings || undefined,
      prep_time: this.parseTimeToMinutes(parsed.prep_time),
      cook_time: this.parseTimeToMinutes(parsed.cook_time),
      total_time: this.parseTimeToMinutes(parsed.total_time),
      source_url: sourceUrl,
      image_url: metadata.thumbnailUrl,
      author: metadata.author,
      tags: this.extractHashtags(combinedText),
    };

    return recipe;
  }

  private convertToRecipeIngredients(ingredients: string[]): RecipeIngredient[] {
    return ingredients.map((text, index) => ({
      name: text,
      text,
      order_index: index,
    }));
  }

  private convertToInstructionSteps(instructions: string[]): InstructionStep[] {
    return instructions.map((text, index) => ({
      step_number: index + 1,
      text,
    }));
  }

  private parseTimeToMinutes(timeStr: string | null): number | undefined {
    if (!timeStr) return undefined;

    const hourMatch = timeStr.match(/(\d+)\s*(?:hour|hr|h)/i);
    const minMatch = timeStr.match(/(\d+)\s*(?:minute|min|m)/i);

    let total = 0;
    if (hourMatch) total += parseInt(hourMatch[1]) * 60;
    if (minMatch) total += parseInt(minMatch[1]);

    return total > 0 ? total : undefined;
  }

  private extractHashtags(text: string): string[] {
    const hashtags = text.match(/#[\w]+/g) || [];
    return hashtags.map((tag) => tag.substring(1));
  }
}

// =============================================================================
// Export Singleton Instance
// =============================================================================

export const enhancedVideoScraper = new EnhancedVideoRecipeScraper();
