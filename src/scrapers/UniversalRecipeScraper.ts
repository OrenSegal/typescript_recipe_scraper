/**
 * Universal Recipe Scraper
 * Handles ALL recipe content types:
 * - Websites (JSON-LD, Microdata, HTML)
 * - TikTok videos
 * - Instagram posts/reels
 * - YouTube videos
 * - Images (OCR)
 * - Plain text
 * - PDFs
 *
 * Automatic format detection and routing
 */

import { RobustMultiFallbackScraper, ScraperResult } from './RobustMultiFallbackScraper.js';
import { RawScrapedRecipe } from './websiteScraper.js';
import { getCachedRecipe, setCachedRecipe } from '../cache/CacheManager.js';
import { isWebsiteBlocked, recordScrapingFailure, recordScrapingSuccess } from '../registry/BlockedWebsitesRegistry.js';

export type ContentType =
  | 'website'
  | 'tiktok'
  | 'instagram'
  | 'youtube'
  | 'image'
  | 'text'
  | 'pdf'
  | 'twitter'
  | 'facebook';

export interface UniversalScraperResult extends ScraperResult {
  contentType: ContentType;
  extractionMethods: string[]; // Methods used (e.g., ['ocr', 'transcript', 'html'])
  mediaUrls?: {
    video?: string;
    audio?: string;
    images?: string[];
  };
}

export class UniversalRecipeScraper {

  /**
   * Main entry point - automatically detects content type and scrapes
   */
  static async scrape(input: string): Promise<UniversalScraperResult> {
    const startTime = Date.now();

    // Detect content type
    const contentType = this.detectContentType(input);
    console.log(`🔍 Detected content type: ${contentType}`);

    // Check cache first
    try {
      const cached = await getCachedRecipe(input);
      if (cached) {
        return {
          recipe: cached as any,
          method: 'cache',
          confidence: 100,
          processingTime: Date.now() - startTime,
          contentType,
          extractionMethods: ['cache']
        };
      }
    } catch (error) {
      console.warn('⚠️ Cache check failed:', error);
    }

    // Route to appropriate scraper
    let result: UniversalScraperResult;

    try {
      switch (contentType) {
        case 'website':
          result = await this.scrapeWebsite(input);
          break;

        case 'tiktok':
          result = await this.scrapeTikTok(input);
          break;

        case 'instagram':
          result = await this.scrapeInstagram(input);
          break;

        case 'youtube':
          result = await this.scrapeYouTube(input);
          break;

        case 'image':
          result = await this.scrapeImage(input);
          break;

        case 'text':
          result = await this.scrapeText(input);
          break;

        case 'pdf':
          result = await this.scrapePDF(input);
          break;

        case 'twitter':
          result = await this.scrapeTwitter(input);
          break;

        case 'facebook':
          result = await this.scrapeFacebook(input);
          break;

        default:
          throw new Error(`Unsupported content type: ${contentType}`);
      }

      // Cache successful result
      if (result.recipe && this.isValidRecipe(result.recipe)) {
        await setCachedRecipe(input, result.recipe as any);
        await recordScrapingSuccess(input);
      }

      return result;

    } catch (error: any) {
      await recordScrapingFailure(input, error.message);
      throw error;
    }
  }

  /**
   * Detect content type from input
   */
  private static detectContentType(input: string): ContentType {
    // Check if it's a URL
    if (this.isUrl(input)) {
      const url = input.toLowerCase();

      if (url.includes('tiktok.com')) return 'tiktok';
      if (url.includes('instagram.com')) return 'instagram';
      if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
      if (url.includes('twitter.com') || url.includes('x.com')) return 'twitter';
      if (url.includes('facebook.com')) return 'facebook';
      if (url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) return 'image';
      if (url.match(/\.pdf$/i)) return 'pdf';

      return 'website';
    }

    // Check if it's an image path
    if (input.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
      return 'image';
    }

    // Check if it's a PDF path
    if (input.match(/\.pdf$/i)) {
      return 'pdf';
    }

    // Default to text
    return 'text';
  }

  /**
   * Scrape regular website
   */
  private static async scrapeWebsite(url: string): Promise<UniversalScraperResult> {
    const result = await RobustMultiFallbackScraper.scrape(url);
    return {
      ...result,
      contentType: 'website',
      extractionMethods: [result.method]
    };
  }

  /**
   * Scrape TikTok video
   */
  private static async scrapeTikTok(url: string): Promise<UniversalScraperResult> {
    const startTime = Date.now();
    const extractionMethods: string[] = [];

    console.log('🎵 Scraping TikTok video...');

    try {
      // Method 1: Try to get video metadata from TikTok embed/API
      const metadata = await this.fetchTikTokMetadata(url);
      extractionMethods.push('tiktok-api');

      // Method 2: Extract video and perform OCR on frames
      let ocrText = '';
      try {
        ocrText = await this.extractTextFromVideo(url);
        extractionMethods.push('video-ocr');
      } catch (error) {
        console.warn('⚠️ Video OCR failed:', error);
      }

      // Method 3: Use audio transcription if available
      let transcript = '';
      try {
        transcript = await this.extractAudioTranscript(url);
        extractionMethods.push('audio-transcript');
      } catch (error) {
        console.warn('⚠️ Audio transcription failed:', error);
      }

      // Combine all text sources
      const combinedText = [
        metadata.description,
        ocrText,
        transcript
      ].filter(Boolean).join('\n\n');

      // Parse recipe from combined text
      const recipe = await this.parseRecipeFromText(combinedText, url);
      recipe.image_url = metadata.thumbnail;
      recipe.author = metadata.author;

      return {
        recipe,
        method: 'tiktok-multi',
        confidence: this.calculateConfidence(recipe, extractionMethods),
        processingTime: Date.now() - startTime,
        contentType: 'tiktok',
        extractionMethods,
        mediaUrls: {
          video: url,
          images: [metadata.thumbnail]
        }
      };

    } catch (error: any) {
      throw new Error(`TikTok scraping failed: ${error.message}`);
    }
  }

  /**
   * Scrape Instagram post/reel
   */
  private static async scrapeInstagram(url: string): Promise<UniversalScraperResult> {
    const startTime = Date.now();
    const extractionMethods: string[] = [];

    console.log('📸 Scraping Instagram post...');

    try {
      // Method 1: Get post metadata
      const metadata = await this.fetchInstagramMetadata(url);
      extractionMethods.push('instagram-api');

      // Method 2: OCR on images/video frames
      let ocrText = '';
      if (metadata.isVideo) {
        ocrText = await this.extractTextFromVideo(url);
        extractionMethods.push('video-ocr');
      } else if (metadata.images.length > 0) {
        ocrText = await this.extractTextFromImages(metadata.images);
        extractionMethods.push('image-ocr');
      }

      // Combine caption and OCR text
      const combinedText = [metadata.caption, ocrText].filter(Boolean).join('\n\n');

      // Parse recipe
      const recipe = await this.parseRecipeFromText(combinedText, url);
      recipe.image_url = metadata.images[0];
      recipe.author = metadata.author;

      return {
        recipe,
        method: 'instagram-multi',
        confidence: this.calculateConfidence(recipe, extractionMethods),
        processingTime: Date.now() - startTime,
        contentType: 'instagram',
        extractionMethods,
        mediaUrls: {
          video: metadata.isVideo ? url : undefined,
          images: metadata.images
        }
      };

    } catch (error: any) {
      throw new Error(`Instagram scraping failed: ${error.message}`);
    }
  }

  /**
   * Scrape YouTube video
   */
  private static async scrapeYouTube(url: string): Promise<UniversalScraperResult> {
    const startTime = Date.now();
    const extractionMethods: string[] = [];

    console.log('🎬 Scraping YouTube video...');

    try {
      // Method 1: Get video metadata
      const videoId = this.extractYouTubeVideoId(url);
      const metadata = await this.fetchYouTubeMetadata(videoId);
      extractionMethods.push('youtube-api');

      // Method 2: Get transcript/captions
      let transcript = '';
      try {
        transcript = await this.fetchYouTubeTranscript(videoId);
        extractionMethods.push('youtube-transcript');
      } catch (error) {
        console.warn('⚠️ Transcript extraction failed, trying description');
      }

      // Method 3: Parse description
      const descriptionText = metadata.description;
      extractionMethods.push('description-parsing');

      // Combine all text sources
      const combinedText = [transcript, descriptionText].filter(Boolean).join('\n\n');

      // Parse recipe
      const recipe = await this.parseRecipeFromText(combinedText, url);
      recipe.image_url = metadata.thumbnail;
      recipe.author = metadata.channelName;
      recipe.title = recipe.title || metadata.title;

      return {
        recipe,
        method: 'youtube-multi',
        confidence: this.calculateConfidence(recipe, extractionMethods),
        processingTime: Date.now() - startTime,
        contentType: 'youtube',
        extractionMethods,
        mediaUrls: {
          video: url,
          images: [metadata.thumbnail]
        }
      };

    } catch (error: any) {
      throw new Error(`YouTube scraping failed: ${error.message}`);
    }
  }

  /**
   * Scrape recipe from image using OCR
   */
  private static async scrapeImage(imagePath: string): Promise<UniversalScraperResult> {
    const startTime = Date.now();

    console.log('🖼️ Extracting recipe from image...');

    try {
      const ocrText = await this.extractTextFromImages([imagePath]);
      const recipe = await this.parseRecipeFromText(ocrText, imagePath);
      recipe.image_url = imagePath;

      return {
        recipe,
        method: 'ocr',
        confidence: this.calculateConfidence(recipe, ['image-ocr']),
        processingTime: Date.now() - startTime,
        contentType: 'image',
        extractionMethods: ['image-ocr'],
        mediaUrls: {
          images: [imagePath]
        }
      };

    } catch (error: any) {
      throw new Error(`Image OCR failed: ${error.message}`);
    }
  }

  /**
   * Scrape recipe from plain text
   */
  private static async scrapeText(text: string): Promise<UniversalScraperResult> {
    const startTime = Date.now();

    console.log('📝 Parsing recipe from text...');

    try {
      const recipe = await this.parseRecipeFromText(text, 'text-input');

      return {
        recipe,
        method: 'text-parsing',
        confidence: this.calculateConfidence(recipe, ['nlp-parsing']),
        processingTime: Date.now() - startTime,
        contentType: 'text',
        extractionMethods: ['nlp-parsing']
      };

    } catch (error: any) {
      throw new Error(`Text parsing failed: ${error.message}`);
    }
  }

  /**
   * Scrape recipe from PDF
   */
  private static async scrapePDF(pdfPath: string): Promise<UniversalScraperResult> {
    const startTime = Date.now();

    console.log('📄 Extracting recipe from PDF...');

    try {
      // Extract text from PDF
      const pdfText = await this.extractTextFromPDF(pdfPath);
      const recipe = await this.parseRecipeFromText(pdfText, pdfPath);

      return {
        recipe,
        method: 'pdf-extraction',
        confidence: this.calculateConfidence(recipe, ['pdf-text-extraction']),
        processingTime: Date.now() - startTime,
        contentType: 'pdf',
        extractionMethods: ['pdf-text-extraction']
      };

    } catch (error: any) {
      throw new Error(`PDF extraction failed: ${error.message}`);
    }
  }

  /**
   * Scrape Twitter post
   */
  private static async scrapeTwitter(url: string): Promise<UniversalScraperResult> {
    const startTime = Date.now();

    console.log('🐦 Scraping Twitter post...');

    try {
      const metadata = await this.fetchTwitterMetadata(url);
      const text = metadata.text + '\n' + metadata.images.map(() => '[image]').join('\n');

      // If has images, do OCR
      let ocrText = '';
      if (metadata.images.length > 0) {
        ocrText = await this.extractTextFromImages(metadata.images);
      }

      const combinedText = [text, ocrText].filter(Boolean).join('\n\n');
      const recipe = await this.parseRecipeFromText(combinedText, url);
      recipe.image_url = metadata.images[0];
      recipe.author = metadata.author;

      return {
        recipe,
        method: 'twitter-multi',
        confidence: this.calculateConfidence(recipe, ['twitter-api', 'image-ocr']),
        processingTime: Date.now() - startTime,
        contentType: 'twitter',
        extractionMethods: ['twitter-api', 'image-ocr'],
        mediaUrls: {
          images: metadata.images
        }
      };

    } catch (error: any) {
      throw new Error(`Twitter scraping failed: ${error.message}`);
    }
  }

  /**
   * Scrape Facebook post
   */
  private static async scrapeFacebook(url: string): Promise<UniversalScraperResult> {
    const startTime = Date.now();

    console.log('📘 Scraping Facebook post...');

    try {
      // Similar to Instagram/Twitter
      const metadata = await this.fetchFacebookMetadata(url);
      const recipe = await this.parseRecipeFromText(metadata.text, url);
      recipe.image_url = metadata.image;

      return {
        recipe,
        method: 'facebook',
        confidence: this.calculateConfidence(recipe, ['facebook-api']),
        processingTime: Date.now() - startTime,
        contentType: 'facebook',
        extractionMethods: ['facebook-api']
      };

    } catch (error: any) {
      throw new Error(`Facebook scraping failed: ${error.message}`);
    }
  }

  // ==================== Helper Methods ====================

  /**
   * Fetch TikTok metadata (uses oembed or scraping)
   */
  private static async fetchTikTokMetadata(url: string) {
    // Try TikTok oEmbed API first
    try {
      const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`;
      const response = await fetch(oembedUrl);
      const data = await response.json();

      return {
        title: data.title || '',
        description: data.title || '',
        author: data.author_name || 'Unknown',
        thumbnail: data.thumbnail_url || ''
      };
    } catch (error) {
      // Fallback: scrape page
      console.warn('⚠️ oEmbed failed, falling back to page scraping');
      return await this.scrapeTikTokPage(url);
    }
  }

  /**
   * Scrape TikTok page directly
   */
  private static async scrapeTikTokPage(url: string) {
    const { fetchText } = await import('../utils/robustFetch.js');
    const cheerio = await import('cheerio');

    const html = await fetchText(url, { timeout: 15000 });
    const $ = cheerio.load(html);

    // Extract from meta tags
    const title = $('meta[property="og:title"]').attr('content') || '';
    const description = $('meta[property="og:description"]').attr('content') || '';
    const thumbnail = $('meta[property="og:image"]').attr('content') || '';

    return {
      title,
      description,
      author: 'TikTok User',
      thumbnail
    };
  }

  /**
   * Fetch Instagram metadata
   */
  private static async fetchInstagramMetadata(url: string) {
    // Try Instagram oEmbed
    try {
      const oembedUrl = `https://api.instagram.com/oembed?url=${encodeURIComponent(url)}`;
      const response = await fetch(oembedUrl);
      const data = await response.json();

      return {
        caption: data.title || '',
        author: data.author_name || 'Unknown',
        images: [data.thumbnail_url],
        isVideo: false
      };
    } catch (error) {
      // Fallback: scrape page
      return await this.scrapeInstagramPage(url);
    }
  }

  /**
   * Scrape Instagram page
   */
  private static async scrapeInstagramPage(url: string) {
    const { fetchText } = await import('../utils/robustFetch.js');
    const cheerio = await import('cheerio');

    const html = await fetchText(url, { timeout: 15000 });
    const $ = cheerio.load(html);

    const caption = $('meta[property="og:title"]').attr('content') || '';
    const image = $('meta[property="og:image"]').attr('content') || '';
    const isVideo = $('meta[property="og:type"]').attr('content') === 'video';

    return {
      caption,
      author: 'Instagram User',
      images: [image],
      isVideo
    };
  }

  /**
   * Extract YouTube video ID from URL
   */
  private static extractYouTubeVideoId(url: string): string {
    const patterns = [
      /(?:youtube\.com\/watch\?v=)([^&]+)/,
      /(?:youtu\.be\/)([^?]+)/,
      /(?:youtube\.com\/embed\/)([^?]+)/
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }

    throw new Error('Could not extract YouTube video ID');
  }

  /**
   * Fetch YouTube metadata
   */
  private static async fetchYouTubeMetadata(videoId: string) {
    // Try oEmbed first (no API key needed)
    try {
      const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
      const response = await fetch(oembedUrl);
      const data = await response.json();

      return {
        title: data.title,
        channelName: data.author_name,
        thumbnail: data.thumbnail_url,
        description: '' // oEmbed doesn't include description
      };
    } catch (error) {
      throw new Error('Failed to fetch YouTube metadata');
    }
  }

  /**
   * Fetch YouTube transcript
   */
  private static async fetchYouTubeTranscript(videoId: string): Promise<string> {
    // Use youtube-transcript library or API
    try {
      // Import dynamically to avoid loading if not needed
      const { YoutubeTranscript } = await import('youtube-transcript');
      const transcript = await YoutubeTranscript.fetchTranscript(videoId);
      return transcript.map(item => item.text).join(' ');
    } catch (error) {
      console.warn('⚠️ YouTube transcript not available');
      return '';
    }
  }

  /**
   * Extract text from video frames using OCR
   */
  private static async extractTextFromVideo(videoUrl: string): Promise<string> {
    console.log('🎥 Extracting text from video frames...');

    // This would use ffmpeg to extract frames and Tesseract/Google Vision for OCR
    // Simplified implementation - expand based on needs
    try {
      const { VideoOCRProcessor } = await import('../enrichment/videoOCRProcessor.js');
      const processor = new VideoOCRProcessor();
      const result = await processor.processVideo(videoUrl);
      return result.extractedText;
    } catch (error) {
      console.warn('⚠️ Video OCR not available:', error);
      return '';
    }
  }

  /**
   * Extract audio transcript from video
   */
  private static async extractAudioTranscript(videoUrl: string): Promise<string> {
    console.log('🎤 Extracting audio transcript...');

    // Check if audio transcription is enabled (expensive feature)
    if (process.env.ENABLE_AUDIO_TRANSCRIPTION === 'false') {
      console.log('⚠️ Audio transcription disabled in config');
      return '';
    }

    try {
      const { audioTranscriptionProcessor } = await import('../enrichment/audioTranscriptionProcessor.js');
      return await audioTranscriptionProcessor.transcribe(videoUrl, {
        language: 'en-US',
        maxDuration: 300  // 5 minutes max
      });
    } catch (error: any) {
      console.warn('⚠️ Audio transcription failed:', error.message);
      return '';
    }
  }

  /**
   * Extract text from images using OCR
   */
  private static async extractTextFromImages(imageUrls: string[]): Promise<string> {
    console.log(`🔍 Performing OCR on ${imageUrls.length} image(s)...`);

    const texts: string[] = [];

    for (const imageUrl of imageUrls) {
      try {
        // Try Google Vision API first
        if (process.env.GOOGLE_VISION_API_KEY) {
          const text = await this.googleVisionOCR(imageUrl);
          texts.push(text);
        } else {
          // Fallback to Tesseract.js
          const text = await this.tesseractOCR(imageUrl);
          texts.push(text);
        }
      } catch (error) {
        console.warn(`⚠️ OCR failed for ${imageUrl}:`, error);
      }
    }

    return texts.join('\n\n');
  }

  /**
   * Google Vision OCR
   */
  private static async googleVisionOCR(imageUrl: string): Promise<string> {
    const vision = await import('@google-cloud/vision');
    const client = new vision.ImageAnnotatorClient();

    const [result] = await client.textDetection(imageUrl);
    const detections = result.textAnnotations;

    return detections && detections.length > 0 ? detections[0].description || '' : '';
  }

  /**
   * Tesseract.js OCR (fallback)
   */
  private static async tesseractOCR(imageUrl: string): Promise<string> {
    const Tesseract = await import('tesseract.js');
    const { data: { text } } = await Tesseract.default.recognize(imageUrl, 'eng', {
      logger: () => {} // Suppress logging
    });
    return text;
  }

  /**
   * Extract text from PDF
   */
  private static async extractTextFromPDF(pdfPath: string): Promise<string> {
    const { pdfExtractor } = await import('../utils/pdfExtractor.js');

    try {
      // Check if it's a URL or file path
      if (this.isUrl(pdfPath)) {
        return await pdfExtractor.extractFromUrl(pdfPath, { maxPages: 50 });
      } else {
        return await pdfExtractor.extractText(pdfPath, { maxPages: 50 });
      }
    } catch (error: any) {
      console.error('❌ PDF extraction failed:', error.message);
      throw new Error(`PDF extraction failed: ${error.message}`);
    }
  }

  /**
   * Fetch Twitter metadata
   */
  private static async fetchTwitterMetadata(url: string) {
    // Placeholder - would use Twitter API or scraping
    return {
      text: '',
      author: 'Twitter User',
      images: []
    };
  }

  /**
   * Fetch Facebook metadata
   */
  private static async fetchFacebookMetadata(url: string) {
    // Placeholder - would use Facebook Graph API
    return {
      text: '',
      image: ''
    };
  }

  /**
   * Parse recipe from combined text using NLP
   */
  private static async parseRecipeFromText(text: string, sourceUrl: string): Promise<RawScrapedRecipe> {
    console.log('🧠 Parsing recipe from text using NLP...');

    // Use NLP to extract recipe components
    const { parseRecipeFromNaturalLanguage } = await import('../enrichment/nlpRecipeParser.js');

    try {
      const parsed = await parseRecipeFromNaturalLanguage(text);

      return {
        title: parsed.title || 'Untitled Recipe',
        description: parsed.description || undefined,
        source_url: sourceUrl,
        ingredients: parsed.ingredients || [],
        instructions: parsed.instructions || [],
        prep_time_minutes: this.parseTimeStringToMinutes(parsed.prep_time),
        cook_time_minutes: this.parseTimeStringToMinutes(parsed.cook_time),
        servings: parsed.servings || 4
      };
    } catch (error) {
      // Fallback: basic extraction
      return this.basicTextParsing(text, sourceUrl);
    }
  }

  /**
   * Basic text parsing fallback
   */
  private static basicTextParsing(text: string, sourceUrl: string): RawScrapedRecipe {
    const lines = text.split('\n').filter(l => l.trim());

    // Try to find title (first non-empty line or line with "recipe" in it)
    const titleLine = lines.find(l => l.toLowerCase().includes('recipe')) || lines[0] || 'Recipe';

    // Extract ingredients (lines with quantities/measurements)
    const ingredients = lines.filter(line =>
      /\d+/.test(line) &&
      /cup|tbsp|tsp|oz|lb|gram|ml|liter/i.test(line)
    );

    // Extract instructions (longer lines, action verbs)
    const instructions = lines.filter(line =>
      line.length > 20 &&
      /mix|bake|cook|add|stir|heat|combine/i.test(line)
    );

    return {
      title: titleLine,
      description: lines[1] || undefined,
      source_url: sourceUrl,
      ingredients: ingredients.length > 0 ? ingredients : ['Ingredients not found'],
      instructions: instructions.length > 0 ? instructions : ['Instructions not found']
    };
  }

  /**
   * Calculate confidence based on extraction methods and recipe completeness
   */
  private static calculateConfidence(recipe: RawScrapedRecipe, methods: string[]): number {
    let confidence = 40; // Base

    // Method bonuses
    if (methods.includes('youtube-transcript')) confidence += 20;
    if (methods.includes('tiktok-api')) confidence += 15;
    if (methods.includes('instagram-api')) confidence += 15;
    if (methods.includes('video-ocr')) confidence += 10;
    if (methods.includes('image-ocr')) confidence += 10;
    if (methods.includes('audio-transcript')) confidence += 15;

    // Recipe completeness
    if (recipe.title) confidence += 5;
    if (recipe.ingredients.length >= 3) confidence += 10;
    if (recipe.instructions.length >= 2) confidence += 10;
    if (recipe.description) confidence += 5;
    if (recipe.image_url) confidence += 5;

    return Math.min(100, confidence);
  }

  /**
   * Validate recipe has minimum fields
   */
  private static isValidRecipe(recipe: RawScrapedRecipe): boolean {
    return !!(
      recipe.title &&
      recipe.ingredients &&
      recipe.ingredients.length >= 1 &&
      recipe.instructions &&
      recipe.instructions.length >= 1
    );
  }

  /**
   * Parse time string to minutes
   */
  private static parseTimeStringToMinutes(timeStr: string | null): number | undefined {
    if (!timeStr) return undefined;

    const hourMatch = timeStr.match(/(\d+)\s*(?:hour|hr)/i);
    const minMatch = timeStr.match(/(\d+)\s*(?:min|minute)/i);

    let total = 0;
    if (hourMatch) total += parseInt(hourMatch[1]) * 60;
    if (minMatch) total += parseInt(minMatch[1]);

    return total > 0 ? total : undefined;
  }

  /**
   * Check if string is a valid URL
   */
  private static isUrl(str: string): boolean {
    try {
      new URL(str);
      return true;
    } catch {
      return false;
    }
  }
}

export default UniversalRecipeScraper;
