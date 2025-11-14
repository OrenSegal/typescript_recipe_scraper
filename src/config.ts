/**
 * Centralized Configuration Service
 *
 * Single source of truth for all API keys, URLs, and environment configuration
 * Follows DRY principle - eliminates scattered process.env calls throughout codebase
 */

import 'dotenv/config';

/**
 * Centralized application configuration
 * All environment variables accessed in one place
 */
export const config = {
  // ==========================================================================
  // DATABASE & STORAGE
  // ==========================================================================
  database: {
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
    supabaseEnableRealtime: process.env.SUPABASE_REALTIME === 'true',
    databaseUrl: process.env.DATABASE_URL,
  },

  // ==========================================================================
  // CACHING
  // ==========================================================================
  cache: {
    enabled: process.env.CACHE_ENABLED !== 'false',
    ttl: parseInt(process.env.CACHE_TTL || '3600'),
    enableMemoryCache: process.env.ENABLE_MEMORY_CACHE !== 'false',
    enableRedisCache: process.env.ENABLE_REDIS_CACHE !== 'false',
    enableDbCache: process.env.ENABLE_DB_CACHE === 'true',
    redisUrl: process.env.UPSTASH_REDIS_REST_URL || process.env.REDIS_URL,
    redisToken: process.env.UPSTASH_REDIS_REST_TOKEN,
    redisKeyPrefix: process.env.REDIS_KEY_PREFIX || 'recipe_scraper:',
    noFileCache: process.env.NO_FILE_CACHE === 'true',
  },

  // ==========================================================================
  // AI & NLP SERVICES
  // ==========================================================================
  ai: {
    // Google AI
    googleApiKey: process.env.GOOGLE_API_KEY,
    googleAiApiKey: process.env.GOOGLE_AI_API_KEY,
    googleVisionApiKey: process.env.GOOGLE_VISION_API_KEY,
    googleVisionKeyFile: process.env.GOOGLE_VISION_KEY_FILE,
    googleCloudSpeechApiKey: process.env.GOOGLE_CLOUD_SPEECH_API_KEY,

    // OpenAI
    openaiApiKey: process.env.OPENAI_API_KEY,

    // Anthropic
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,

    // Model selection
    liteModel: process.env.LITE_MODEL || 'gemini-1.5-flash-latest',
  },

  // ==========================================================================
  // RECIPE DATA APIS
  // ==========================================================================
  recipeApis: {
    // Nutrition
    usdaApiKey: process.env.USDA_API_KEY,

    // Recipe APIs
    spoonacularApiKey: process.env.SPOONACULAR_API_KEY,
    edamamAppId: process.env.EDAMAM_APP_ID,
    edamamAppKey: process.env.EDAMAM_APP_KEY,
  },

  // ==========================================================================
  // MEDIA & IMAGE PROCESSING
  // ==========================================================================
  media: {
    imgurClientId: process.env.IMGUR_CLIENT_ID,
    ytDlpMicroserviceUrl: process.env.YT_DLP_MICROSERVICE_URL,
  },

  // ==========================================================================
  // PERFORMANCE & FEATURES
  // ==========================================================================
  performance: {
    maxRetries: parseInt(process.env.MAX_RETRIES || '3'),
    timeoutMs: parseInt(process.env.TIMEOUT_MS || '30000'),
    maxConcurrentRequests: parseInt(process.env.MAX_CONCURRENT_REQUESTS || '5'),
    batchSize: parseInt(process.env.BATCH_SIZE || '50'),
  },

  // ==========================================================================
  // FEATURE FLAGS
  // ==========================================================================
  features: {
    enableNutrition: process.env.ENABLE_NUTRITION !== 'false',
    enableEmbedding: process.env.ENABLE_EMBEDDING === 'true',
    enableAiEnrichment: process.env.ENABLE_AI_ENRICHMENT === 'true',
    enableAudioTranscription: process.env.ENABLE_AUDIO_TRANSCRIPTION === 'true',
  },

  // ==========================================================================
  // CIRCUIT BREAKER & RESILIENCE
  // ==========================================================================
  resilience: {
    circuitBreakerFailureThreshold: parseInt(process.env.CIRCUIT_BREAKER_FAILURE_THRESHOLD || '5'),
    circuitBreakerTimeout: parseInt(process.env.CIRCUIT_BREAKER_TIMEOUT || '60000'),
    circuitBreakerSuccessThreshold: parseInt(process.env.CIRCUIT_BREAKER_SUCCESS_THRESHOLD || '2'),
    blockThreshold: parseInt(process.env.BLOCK_THRESHOLD || '5'),
    permanentBlockThreshold: parseInt(process.env.PERMANENT_BLOCK_THRESHOLD || '20'),
    cooldownPeriodMs: parseInt(process.env.COOLDOWN_PERIOD_MS || '3600000'),
  },

  // ==========================================================================
  // DEPLOYMENT & ENVIRONMENT
  // ==========================================================================
  environment: {
    nodeEnv: process.env.NODE_ENV || 'development',
    isDevelopment: process.env.NODE_ENV !== 'production',
    isProduction: process.env.NODE_ENV === 'production',
    logLevel: process.env.LOG_LEVEL || 'info',
    port: parseInt(process.env.PORT || '3000'),
  },

  // ==========================================================================
  // MONITORING & NOTIFICATIONS
  // ==========================================================================
  monitoring: {
    sentryDsn: process.env.SENTRY_DSN,
    jaegerEndpoint: process.env.JAEGER_ENDPOINT,
    emailUsername: process.env.EMAIL_USERNAME,
    emailPassword: process.env.EMAIL_PASSWORD,
    notificationEmail: process.env.NOTIFICATION_EMAIL,
  },
};

/**
 * Configuration Validator
 * Validates required environment variables are present
 */
class ConfigValidator {
  private static errors: string[] = [];

  static validate(): void {
    this.errors = [];

    // Required: Database
    this.requireField(config.database.supabaseUrl, 'SUPABASE_URL');
    this.requireField(config.database.supabaseServiceKey, 'SUPABASE_SERVICE_ROLE_KEY');

    // Throw if there are errors
    if (this.errors.length > 0) {
      throw new Error(
        `Configuration Validation Failed:\n${this.errors.map(e => `  - ${e}`).join('\n')}`
      );
    }
  }

  private static requireField(value: any, name: string): void {
    if (!value) {
      this.errors.push(`${name} is required but not set`);
    }
  }

  static warnMissing(): void {
    const warnings: string[] = [];

    // Optional but recommended
    if (!config.recipeApis.usdaApiKey) {
      warnings.push('USDA_API_KEY not set - nutrition enrichment disabled');
    }
    if (!config.ai.googleApiKey && !config.ai.googleAiApiKey) {
      warnings.push('Google API keys not set - AI features disabled');
    }
    if (!config.cache.redisUrl) {
      warnings.push('Redis not configured - using memory cache only');
    }

    if (warnings.length > 0 && config.environment.isDevelopment) {
      console.warn('\nConfiguration Warnings:');
      warnings.forEach(w => console.warn(`  ⚠️  ${w}`));
      console.warn('');
    }
  }
}

// Validate configuration on startup
ConfigValidator.validate();
ConfigValidator.warnMissing();

/**
 * Helper functions for common config checks
 */
export const configHelpers = {
  hasGoogleVision: () => !!(config.ai.googleVisionApiKey || config.ai.googleVisionKeyFile),
  hasOpenAI: () => !!config.ai.openaiApiKey,
  hasUSDA: () => !!config.recipeApis.usdaApiKey,
  hasSpoonacular: () => !!config.recipeApis.spoonacularApiKey,
  hasEdamam: () => !!(config.recipeApis.edamamAppId && config.recipeApis.edamamAppKey),
  hasRedis: () => !!config.cache.redisUrl,
  isNutritionEnabled: () => config.features.enableNutrition && configHelpers.hasUSDA(),
  isAiEnabled: () => config.features.enableAiEnrichment && (configHelpers.hasGoogleVision() || configHelpers.hasOpenAI()),
};