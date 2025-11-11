import { RawScrapedRecipe } from "../scrapers/websiteScraper.js";
import { InstructionStep, Recipe, RecipeIngredient } from "../types.js";

// Multimedia processing interfaces
export interface MultimediaContent {
  audio?: string; // Audio URL or base64
  video?: string; // Video URL or file path
  transcript?: string; // Existing transcript text
  captions?: string[]; // Video captions/subtitles
}

export interface VoiceToTextResult {
  text: string;
  confidence: number;
  timestamp?: number[];
}

export interface VideoToTextResult {
  extractedText: string[];
  textOverlays: { text: string; timestamp: number }[];
  confidence: number;
}

export interface MultimediaEnrichedRecipe extends Recipe {
  extracted_audio_text?: string;
  extracted_video_text?: string;
  transcript_analysis?: string;
  multimedia_completeness_score: number;
}

/*
 * Enhanced recipe enrichment with multimedia processing for social media content
 * Supports voice-to-text, video-to-text, and transcript analysis
 */
export class MultimediaRecipeEnrichment {
  
  /*
   * Initialize multimedia processing capabilities
   */
  static async initialize(): Promise<void> {
    console.log('🎥 Initializing multimedia recipe enrichment...');
    // Initialize speech recognition, OCR, and video processing libraries
    return Promise.resolve();
  }
  
  /*
   * Main enrichment method with multimedia processing
   */
  static async enrichRecipeWithMultimedia(
    rawRecipeData: RawScrapedRecipe, 
    multimediaContent?: MultimediaContent,
    options: any = {}
  ): Promise<MultimediaEnrichedRecipe> {
    console.log(`🎬 Starting multimedia enrichment for: ${rawRecipeData.title}`);
    
    try {
      // Step 1: Basic recipe enrichment
      const enrichedRecipe = await MultimediaRecipeEnrichment.enrichRecipeBasic(rawRecipeData);
      
      // Step 2: Process multimedia content if available
      let extractedAudioText = '';
      let extractedVideoText = '';
      let transcriptAnalysis = '';
      
      if (multimediaContent) {
        console.log('🔊 Processing multimedia content...');
        
        // Process audio content (TikTok, Instagram Reels)
        if (multimediaContent.audio) {
          const audioResult = await MultimediaRecipeEnrichment.processAudioToText(multimediaContent.audio);
          extractedAudioText = audioResult.text;
          console.log(`🎤 Extracted audio: ${extractedAudioText.substring(0, 100)}...`);
        }
        
        // Process video content for text overlays (all platforms)
        if (multimediaContent.video) {
          const videoResult = await MultimediaRecipeEnrichment.processVideoToText(multimediaContent.video);
          extractedVideoText = videoResult.extractedText.join(' ');
          console.log(`📹 Extracted video text: ${extractedVideoText.substring(0, 100)}...`);
        }
        
        // Process existing transcripts (YouTube)
        if (multimediaContent.transcript) {
          transcriptAnalysis = await MultimediaRecipeEnrichment.analyzeTranscript(multimediaContent.transcript);
          console.log(`📝 Analyzed transcript: ${transcriptAnalysis.substring(0, 100)}...`);
        }
        
        // Enhance recipe with multimedia-extracted data
        MultimediaRecipeEnrichment.enhanceRecipeWithMultimediaData(
          enrichedRecipe,
          extractedAudioText,
          extractedVideoText,
          transcriptAnalysis
        );
      }
      
      // Step 3: Calculate multimedia completeness score
      const multimediaCompleteness = MultimediaRecipeEnrichment.calculateMultimediaCompleteness(
        enrichedRecipe,
        extractedAudioText,
        extractedVideoText,
        transcriptAnalysis
      );
      
      // Return multimedia-enriched recipe
      const multimediaEnrichedRecipe: MultimediaEnrichedRecipe = {
        ...enrichedRecipe,
        extracted_audio_text: extractedAudioText || undefined,
        extracted_video_text: extractedVideoText || undefined,
        transcript_analysis: transcriptAnalysis || undefined,
        multimedia_completeness_score: multimediaCompleteness
      };
      
      console.log(`✅ Multimedia enrichment completed with ${multimediaCompleteness}% multimedia completeness`);
      return multimediaEnrichedRecipe;
      
    } catch (error: any) {
      console.error('❌ Multimedia enrichment failed:', error);
      throw new Error(`Multimedia enrichment failed: ${error.message}`);
    }
  }
  
  /*
   * Process audio content to extract recipe information
   */
  static async processAudioToText(audioG: string): Promise<VoiceToTextResult> {
    console.log('🎤 Processing audio content...');
    
    try {
      // Mock implementation - in production, use services like:
      // - Google Cloud Speech-to-Text API
      // - Amazon Transcribe  
      // - Azure Speech Services
      // - OpenAI Whisper API
      
      // Simulate audio processing
      const mockTranscription = MultimediaRecipeEnrichment.simulateAudioTranscription(audioG);
      
      return {
        text: mockTranscription,
        confidence: 0.85,
        timestamp: [0, 30] // Start and end timestamps
      };
      
    } catch (error) {
      console.error('🚫 Audio processing failed:', error);
      return { text: '', confidence: 0 };
    }
  }
  
  /*
   * Process video content to extract text overlays and visual information
   */
  static async processVideoToText(videoG: string): Promise<VideoToTextResult> {
    console.log('📹 Processing video content...');
    
    try {
      // Mock implementation - in production, use services like:
      // - Google Cloud Vision API (OCR)
      // - Amazon Textract
      // - Azure Computer Vision
      // - Tesseract.js for client-side OCR
      
      // Simulate video text extraction
      const mockExtractedText = MultimediaRecipeEnrichment.simulateVideoTextExtraction(videoG);
      
      return {
        extractedText: mockExtractedText,
        textOverlays: mockExtractedText.map((text, index) => ({
          text,
          timestamp: index * 5 // Every 5 seconds
        })),
        confidence: 0.80
      };
      
    } catch (error) {
      console.error('🚫 Video processing failed:', error);
      return { extractedText: [], textOverlays: [], confidence: 0 };
    }
  }
  
  /*
   * Analyze existing transcript content for recipe information
   */
  static async analyzeTranscript(transcript: string): Promise<string> {
    console.log('📝 Analyzing transcript content...');
    
    // Extract recipe-relevant information from transcript
    const recipeKeywords = ['ingredient', 'recipe', 'cook', 'bake', 'mix', 'add', 'step', 'minute', 'cup', 'tablespoon'];
    const relevantSentences = transcript.split('. ').filter(sentence => 
      recipeKeywords.some(keyword => sentence.toLowerCase().includes(keyword))
    );
    
    return relevantSentences.join('. ');
  }
  
  /*
   * Enhance recipe data with multimedia-extracted information
   */
  static enhanceRecipeWithMultimediaData(
    recipe: Recipe,
    audioText: string,
    videoText: string,
    transcriptText: string
  ): void {
    const allExtractedText = `${audioText} ${videoText} ${transcriptText}`.trim();
    
    if (allExtractedText) {
      // Enhance ingredients if missing or incomplete
      if (!recipe.ingredients || recipe.ingredients.length === 0) {
        recipe.ingredients = MultimediaRecipeEnrichment.extractIngredientsFromText(allExtractedText);
      }
      
      // Enhance instructions if missing or incomplete
      if (!recipe.instructions || recipe.instructions.length === 0) {
        recipe.instructions = MultimediaRecipeEnrichment.extractInstructionsFromText(allExtractedText);
      }
      
      // Enhance description
      if (!recipe.description && allExtractedText.length > 50) {
        recipe.description = allExtractedText.substring(0, 200) + (allExtractedText.length > 200 ? '...' : '');
      }
      
      // Extract timing information
      const extractedTimes = MultimediaRecipeEnrichment.extractTimingFromText(allExtractedText);
      if (extractedTimes.prep && !recipe.prep_time_minutes) {
        recipe.prep_time_minutes = extractedTimes.prep;
      }
      if (extractedTimes.cook && !recipe.cook_time_minutes) {
        recipe.cook_time_minutes = extractedTimes.cook;
      }
      
      // Enhance servings information
      const extractedServings = MultimediaRecipeEnrichment.extractServingsFromText(allExtractedText);
      if (extractedServings && !recipe.servings) {
        recipe.servings = extractedServings;
      }
    }
  }
  
  /*
   * Calculate multimedia completeness score
   */
  static calculateMultimediaCompleteness(
    recipe: Recipe,
    audioText: string,
    videoText: string,
    transcriptText: string
  ): number {
    let score = 0;
    let maxScore = 0;
    
    // Base recipe completeness (70% of total)
    const baseFields = ['title', 'ingredients', 'instructions', 'source_url'];
    baseFields.forEach(field => {
      maxScore += 17.5; // 70% / 4 fields
      if (recipe[field as keyof Recipe] && 
          (Array.isArray(recipe[field as keyof Recipe]) ? 
           (recipe[field as keyof Recipe] as any[]).length > 0 : true)) {
        score += 17.5;
      }
    });
    
    // Multimedia content bonus (30% of total)
    maxScore += 10; // Audio processing
    if (audioText && audioText.length > 10) score += 10;
    
    maxScore += 10; // Video text extraction
    if (videoText && videoText.length > 10) score += 10;
    
    maxScore += 10; // Transcript analysis
    if (transcriptText && transcriptText.length > 10) score += 10;
    
    return Math.round((score / maxScore) * 100);
  }
  
  // Basic recipe enrichment (simplified version)
  static async enrichRecipeBasic(rawRecipeData: RawScrapedRecipe): Promise<Recipe> {
    return {
      title: rawRecipeData.title,
      description: rawRecipeData.description || null,
      source_url: rawRecipeData.source_url,
      image_url: rawRecipeData.image_url || null,
      servings: rawRecipeData.servings || null,
      prep_time_minutes: rawRecipeData.prep_time_minutes || null,
      cook_time_minutes: rawRecipeData.cook_time_minutes || null,
      total_time_minutes: (rawRecipeData.prep_time_minutes || 0) + (rawRecipeData.cook_time_minutes || 0) || null,
      
      ingredients: MultimediaRecipeEnrichment.enrichIngredients(rawRecipeData.ingredients),
      instructions: MultimediaRecipeEnrichment.enrichInstructions(rawRecipeData.instructions),
      
      author: rawRecipeData.author || undefined,
      effort_level: 3, // Medium difficulty as default
      dietary_restrictions: [],
      parsing_confidence: 80,
      completeness_score: 85,
      
      // Required EnrichedRecipe properties
      cuisines: [],
      meal_types: [],
      cooking_method: ['Mixed'],
      suitable_for_diet: [],
      is_public: true,
      
      tags: [],
    };
  }
  
  // Helper methods for multimedia text extraction
  static simulateAudioTranscription(audioG: string): string {
    // Simulate realistic recipe audio transcription
    const mockTranscriptions = [
      "Okay so today we're making this super easy pasta dish. You'll need two cups of pasta, one cup of tomato sauce, and half a cup of parmesan cheese. First, boil the pasta for about ten minutes until it's al dente.",
      "Hey everyone, welcome back to my channel! Today's recipe is a healthy smoothie bowl. Start with one banana, half a cup of blueberries, quarter cup of granola, and a tablespoon of honey. Blend the banana and berries first.",
      "This chocolate cake recipe is absolutely amazing. You'll need two cups of flour, one cup of sugar, three eggs, half a cup of butter, and a quarter cup of cocoa powder. Mix the dry ingredients in one bowl."
    ];
    
    return mockTranscriptions[Math.floor(Math.random() * mockTranscriptions.length)];
  }
  
  static simulateVideoTextExtraction(videoG: string): string[] {
    // Simulate text overlays commonly found in recipe videos
    const mockTextOverlays = [
      ["2 cups pasta", "1 cup tomato sauce", "1/2 cup parmesan", "10 min cook time"],
      ["1 banana", "1/2 cup blueberries", "1/4 cup granola", "Perfect for breakfast"],
      ["2 cups flour", "1 cup sugar", "3 eggs", "350°F oven", "30 minutes"]
    ];
    
    return mockTextOverlays[Math.floor(Math.random() * mockTextOverlays.length)];
  }
  
  static extractIngredientsFromText(text: string): RecipeIngredient[] {
    const ingredientLines = text.match(/(?:\d+(?:\.\d+)?\s*(?:cups?|tbsp|tsp|pounds?|lbs?|oz|ounces?)\s+[a-zA-Z\s]+)|(?:[a-zA-Z\s]+\s+\d+(?:\.\d+)?\s*(?:cups?|tbsp|tsp|pounds?|lbs?|oz|ounces?))/gi) || [];
    
    return ingredientLines.slice(0, 10).map((line, index) => ({
      text: line, // Original scraped text
      name: line.replace(/^\d+(?:\.\d+)?\s*\w+\s*/, '').trim(),
      quantity: MultimediaRecipeEnrichment.extractQuantityFromText(line) ?? undefined,
      unit: MultimediaRecipeEnrichment.extractUnitFromText(line) ?? undefined,
      notes: undefined,
      category: undefined,
      order_index: index
    }));
  }
  
  static extractInstructionsFromText(text: string): InstructionStep[] {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
    const instructions = sentences.filter(sentence => 
      sentence.toLowerCase().match(/\b(mix|add|cook|bake|heat|boil|stir|blend|combine|place)\b/)
    );
    
    return instructions.slice(0, 8).map((instruction, index) => ({
      step_number: index + 1,
      text: instruction.trim(),
      action: null,
      timer_min: [],
      equipment: [],
      mentioned_ingredients: []
    }));
  }
  
  static extractTimingFromText(text: string): { prep?: number; cook?: number } {
    const prepMatch = text.match(/prep(?:\s+time)?[:\s]*(\d+)\s*(?:minutes?|mins?)/i);
    const cookMatch = text.match(/cook(?:\s+time)?[:\s]*(\d+)\s*(?:minutes?|mins?)/i);
    
    return {
      prep: prepMatch ? parseInt(prepMatch[1]) : undefined,
      cook: cookMatch ? parseInt(cookMatch[1]) : undefined
    };
  }
  
  static extractServingsFromText(text: string): number | null {
    const servingsMatch = text.match(/(?:serves?|servings?)[:\s]*(\d+)/i);
    return servingsMatch ? parseInt(servingsMatch[1]) : null;
  }
  
  static enrichIngredients(ingredients: string[]): RecipeIngredient[] {
    return ingredients.map((ingredient, index) => ({
      text: ingredient, // Original scraped text
      name: ingredient.replace(/^\d+\s*\w*\s*/, '').trim(),
      quantity: MultimediaRecipeEnrichment.extractQuantityFromText(ingredient) ?? undefined,
      unit: MultimediaRecipeEnrichment.extractUnitFromText(ingredient) ?? undefined,
      notes: undefined,
      category: undefined,
      order_index: index
    }));
  }
  
  static enrichInstructions(instructions: string[]): InstructionStep[] {
    return instructions.map((instruction, index) => ({
      step_number: index + 1,
      text: instruction,
      action: null,
      timer_min: [],
      equipment: [],
      mentioned_ingredients: []
    }));
  }
  
  static extractQuantityFromText(text: string): number | null {
    const match = text.match(/(\d+(?:\.\d+)?)/);
    return match ? parseFloat(match[1]) : null;
  }
  
  static extractUnitFromText(text: string): string | null {
    const match = text.match(/\d+(?:\.\d+)?\s*(\w+)/);
    return match ? match[1] : null;
  }
}

export default MultimediaRecipeEnrichment;
