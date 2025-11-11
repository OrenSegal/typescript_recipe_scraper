/**
 * Enterprise-Grade Configuration Management
 * Centralizes all configuration for scalable web scraping operations
 */

import { z } from 'zod';

// Environment-specific configuration schema
export const EnterpriseConfigSchema = z.object({
  // Core Application Settings
  nodeEnv: z.enum(['development', 'production', 'staging']).default('development'),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  
  // Crawling Configuration
  crawling: z.object({
    maxConcurrency: z.number().min(1).max(100).default(10),
    requestDelay: z.number().min(100).default(1000), // ms between requests
    maxRetries: z.number().min(0).max(10).default(3),
    requestTimeout: z.number().min(1000).default(30000), // 30 seconds
    userAgentRotation: z.boolean().default(true),
    respectRobotsTxt: z.boolean().default(true),
    enableProxyRotation: z.boolean().default(false),
    enableJavaScript: z.boolean().default(false), // Use Playwright when true
  }),
  
  // Rate Limiting
  rateLimiting: z.object({
    enabled: z.boolean().default(true),
    requestsPerSecond: z.number().min(0.1).max(100).default(2),
    burstSize: z.number().min(1).max(1000).default(10),
    adaptiveThrottling: z.boolean().default(true),
  }),
  
  // Anti-Bot Evasion
  evasion: z.object({
    randomizeHeaders: z.boolean().default(true),
    simulateHumanBehavior: z.boolean().default(true),
    useResidentialProxies: z.boolean().default(false),
    rotateSessions: z.boolean().default(true),
  }),
  
  // Storage Configuration
  storage: z.object({
    batchSize: z.number().min(1).max(10000).default(100),
    enableCompression: z.boolean().default(true),
    backupEnabled: z.boolean().default(true),
    retentionDays: z.number().min(1).default(365),
  }),
  
  // Quality Assurance
  quality: z.object({
    enableValidation: z.boolean().default(true),
    minDataCompleteness: z.number().min(0).max(1).default(0.7), // 70% completeness
    enableDatalineage: z.boolean().default(true),
    auditTrailEnabled: z.boolean().default(true),
  }),
  
  // Legal Compliance
  compliance: z.object({
    respectCopyrights: z.boolean().default(true),
    honorPaywalls: z.boolean().default(true),
    enableUsageLogging: z.boolean().default(true),
    dataRetentionCompliance: z.boolean().default(true),
  }),
  
  // Performance Monitoring
  monitoring: z.object({
    enableMetrics: z.boolean().default(true),
    enableHealthChecks: z.boolean().default(true),
    alertsEnabled: z.boolean().default(false),
    metricsRetentionHours: z.number().min(1).default(168), // 7 days
  }),
  
  // External Services
  external: z.object({
    redis: z.object({
      enabled: z.boolean().default(false),
      url: z.string().optional(),
      keyPrefix: z.string().default('enterprise_scraper:'),
    }),
    supabase: z.object({
      url: z.string().optional(),
      anonKey: z.string().optional(),
      enableRealtime: z.boolean().default(false),
    }),
  }),
});

export type EnterpriseConfig = z.infer<typeof EnterpriseConfigSchema>;

// Default configuration factory
export class EnterpriseConfigManager {
  private static instance: EnterpriseConfigManager;
  private config: EnterpriseConfig;

  private constructor() {
    this.config = this.loadConfiguration();
  }

  public static getInstance(): EnterpriseConfigManager {
    if (!EnterpriseConfigManager.instance) {
      EnterpriseConfigManager.instance = new EnterpriseConfigManager();
    }
    return EnterpriseConfigManager.instance;
  }

  private loadConfiguration(): EnterpriseConfig {
    const envConfig = {
      nodeEnv: process.env.NODE_ENV || 'development',
      logLevel: process.env.LOG_LEVEL || 'info',
      
      crawling: {
        maxConcurrency: parseInt(process.env.MAX_CONCURRENCY || '10'),
        requestDelay: parseInt(process.env.REQUEST_DELAY || '1000'),
        maxRetries: parseInt(process.env.MAX_RETRIES || '3'),
        requestTimeout: parseInt(process.env.REQUEST_TIMEOUT || '30000'),
        userAgentRotation: process.env.USER_AGENT_ROTATION !== 'false',
        respectRobotsTxt: process.env.RESPECT_ROBOTS_TXT !== 'false',
        enableProxyRotation: process.env.ENABLE_PROXY_ROTATION === 'true',
        enableJavaScript: process.env.ENABLE_JAVASCRIPT === 'true',
      },
      
      rateLimiting: {
        enabled: process.env.RATE_LIMITING_ENABLED !== 'false',
        requestsPerSecond: parseFloat(process.env.REQUESTS_PER_SECOND || '2'),
        burstSize: parseInt(process.env.BURST_SIZE || '10'),
        adaptiveThrottling: process.env.ADAPTIVE_THROTTLING !== 'false',
      },
      
      evasion: {
        randomizeHeaders: process.env.RANDOMIZE_HEADERS !== 'false',
        simulateHumanBehavior: process.env.SIMULATE_HUMAN_BEHAVIOR !== 'false',
        useResidentialProxies: process.env.USE_RESIDENTIAL_PROXIES === 'true',
        rotateSessions: process.env.ROTATE_SESSIONS !== 'false',
      },
      
      storage: {
        batchSize: parseInt(process.env.BATCH_SIZE || '100'),
        enableCompression: process.env.ENABLE_COMPRESSION !== 'false',
        backupEnabled: process.env.BACKUP_ENABLED !== 'false',
        retentionDays: parseInt(process.env.RETENTION_DAYS || '365'),
      },
      
      quality: {
        enableValidation: process.env.ENABLE_VALIDATION !== 'false',
        minDataCompleteness: parseFloat(process.env.MIN_DATA_COMPLETENESS || '0.7'),
        enableDatalineage: process.env.ENABLE_DATA_LINEAGE !== 'false',
        auditTrailEnabled: process.env.AUDIT_TRAIL_ENABLED !== 'false',
      },
      
      compliance: {
        respectCopyrights: process.env.RESPECT_COPYRIGHTS !== 'false',
        honorPaywalls: process.env.HONOR_PAYWALLS !== 'false',
        enableUsageLogging: process.env.ENABLE_USAGE_LOGGING !== 'false',
        dataRetentionCompliance: process.env.DATA_RETENTION_COMPLIANCE !== 'false',
      },
      
      monitoring: {
        enableMetrics: process.env.ENABLE_METRICS !== 'false',
        enableHealthChecks: process.env.ENABLE_HEALTH_CHECKS !== 'false',
        alertsEnabled: process.env.ALERTS_ENABLED === 'true',
        metricsRetentionHours: parseInt(process.env.METRICS_RETENTION_HOURS || '168'),
      },
      
      external: {
        redis: {
          enabled: process.env.REDIS_ENABLED === 'true',
          url: process.env.REDIS_URL,
          keyPrefix: process.env.REDIS_KEY_PREFIX || 'enterprise_scraper:',
        },
        supabase: {
          url: process.env.SUPABASE_URL,
          anonKey: process.env.SUPABASE_ANON_KEY,
          enableRealtime: process.env.SUPABASE_REALTIME === 'true',
        },
      },
    };

    return EnterpriseConfigSchema.parse(envConfig);
  }

  public getConfig(): EnterpriseConfig {
    return this.config;
  }

  public updateConfig(updates: Partial<EnterpriseConfig>): void {
    this.config = EnterpriseConfigSchema.parse({ ...this.config, ...updates });
  }

  // Scale configuration based on operation size
  public getScaledConfig(operationSize: 'small' | 'medium' | 'enterprise'): EnterpriseConfig {
    const baseConfig = { ...this.config };
    
    switch (operationSize) {
      case 'small': // < 10K recipes/day
        return {
          ...baseConfig,
          crawling: {
            ...baseConfig.crawling,
            maxConcurrency: Math.min(baseConfig.crawling.maxConcurrency, 5),
            requestDelay: Math.max(baseConfig.crawling.requestDelay, 2000),
            enableJavaScript: false,
          },
          rateLimiting: {
            ...baseConfig.rateLimiting,
            requestsPerSecond: Math.min(baseConfig.rateLimiting.requestsPerSecond, 1),
          },
        };
        
      case 'medium': // 10K-100K recipes/day
        return {
          ...baseConfig,
          crawling: {
            ...baseConfig.crawling,
            maxConcurrency: Math.min(baseConfig.crawling.maxConcurrency, 20),
            enableProxyRotation: true,
          },
          rateLimiting: {
            ...baseConfig.rateLimiting,
            requestsPerSecond: Math.min(baseConfig.rateLimiting.requestsPerSecond, 10),
          },
          external: {
            ...baseConfig.external,
            redis: { ...baseConfig.external.redis, enabled: true },
          },
        };
        
      case 'enterprise': // 100K+ recipes/day
        return {
          ...baseConfig,
          crawling: {
            ...baseConfig.crawling,
            maxConcurrency: baseConfig.crawling.maxConcurrency,
            enableProxyRotation: true,
            enableJavaScript: true,
          },
          evasion: {
            ...baseConfig.evasion,
            useResidentialProxies: true,
          },
          monitoring: {
            ...baseConfig.monitoring,
            alertsEnabled: true,
          },
          external: {
            ...baseConfig.external,
            redis: { ...baseConfig.external.redis, enabled: true },
          },
        };
        
      default:
        return baseConfig;
    }
  }
}

// Export singleton instance
export const enterpriseConfig = EnterpriseConfigManager.getInstance();
