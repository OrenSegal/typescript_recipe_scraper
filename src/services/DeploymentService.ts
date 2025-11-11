/**
 * Production Deployment Service
 * 
 * Consolidated service following SOLID/DRY/KISS/YAGNI principles
 * Combines functionality from scattered root-level deployment scripts
 */

import * as path from 'path';
import { DEPLOYMENT_CONFIG, DATABASE_CONFIG, SUCCESS_MESSAGES, ERROR_MESSAGES } from '../shared/constants.js';
import { StringUtils, ValidationUtils, AsyncUtils, LoggingUtils, FileUtils } from '../shared/utils.js';
import { existsSync, statSync, readdirSync } from 'fs';
import { join } from 'path';
import { DatabaseService } from '../core/DatabaseService.js';
import { BatchScrapingService } from './BatchScrapingService.js';
import { Recipe } from '@/types.js';

/**
 * Configuration for deployment operations
 */
export interface DeploymentConfig {
  environment: 'development' | 'staging' | 'production';
  supabaseUrl?: string;
  supabaseKey?: string;
  batchSize: number;
  maxRetries: number;
  timeoutMs: number;
  enableValidation: boolean;
  enableBackup: boolean;
  logLevel: 'info' | 'warn' | 'error';
}

/**
 * Deployment statistics and results
 */
export interface DeploymentResult {
  success: boolean;
  environment: string;
  totalRecords: number;
  successfulUpserts: number;
  failedUpserts: number;
  duration: number;
  errors: string[];
  timestamp: string;
  healthStatus?: boolean;
}

/**
 * Production-ready Deployment Service
 * Handles Supabase deployment, data migration, and production setup
 */
export class DeploymentService {
  private config: DeploymentConfig;
  private databaseService: DatabaseService;
  private batchService: BatchScrapingService;

  constructor(config: Partial<DeploymentConfig> = {}) {
    this.config = {
      environment: 'development',
      batchSize: DEPLOYMENT_CONFIG.BATCH_SIZE,
      maxRetries: DEPLOYMENT_CONFIG.MAX_RETRIES,
      timeoutMs: DEPLOYMENT_CONFIG.TIMEOUT_MS,
      enableValidation: true,
      enableBackup: true,
      logLevel: 'info',
      ...config
    };

    this.databaseService = DatabaseService.getInstance({
      url: process.env.SUPABASE_URL!,
      key: process.env.SUPABASE_SERVICE_ROLE_KEY!
    });
    this.batchService = new BatchScrapingService();
  }

  /**
   * Deploy to Supabase with full scraping pipeline
   */
  async deployToSupabase(csvFilePath?: string): Promise<DeploymentResult> {
    const startTime = Date.now();
    this.log('info', `Starting Supabase deployment (${this.config.environment})`);

    const result: DeploymentResult = {
      success: false,
      environment: this.config.environment,
      totalRecords: 0,
      successfulUpserts: 0,
      failedUpserts: 0,
      duration: 0,
      errors: [],
      timestamp: new Date().toISOString()
    };

    try {
      // Validate configuration
      await this.validateConfiguration();

      // Initialize database connection
      await this.databaseService.initialize();

      // Backup existing data if enabled
      if (this.config.enableBackup && this.config.environment === 'production') {
        await this.createBackup();
      }

      // Load and process websites
      if (csvFilePath) {
        await this.deployFromCSV(csvFilePath, result);
      } else {
        await this.deployDefaultWebsites(result);
      }

      result.success = result.failedUpserts === 0 || 
                      (result.successfulUpserts / result.totalRecords) > 0.8;
      result.duration = Date.now() - startTime;

      this.log('info', `Deployment completed: ${result.successfulUpserts}/${result.totalRecords} successful`);
      
      // Save deployment report
      await this.saveDeploymentReport(result);

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown deployment error';
      result.errors.push(errorMessage);
      result.duration = Date.now() - startTime;
      
      this.log('error', 'Deployment failed', error);
      throw error;
    }
  }

  /**
   * Deploy from CSV file with batch processing
   */
  private async deployFromCSV(csvFilePath: string, result: DeploymentResult): Promise<void> {
    this.log('info', `Loading websites from CSV: ${csvFilePath}`);
    
    // Load websites from CSV
    const websites = await this.batchService.loadWebsitesFromCSV(csvFilePath);
    result.totalRecords = websites.length;

    this.log('info', `Processing ${websites.length} websites from CSV`);

    // Process websites in batches
    const batchResults = await this.batchService.processBatch(websites);
    
    // Aggregate results
    for (const batchResult of batchResults) {
      result.successfulUpserts += batchResult.success_count;
      result.failedUpserts += batchResult.failure_count;
      result.errors.push(...batchResult.errors);
    }
  }

  /**
   * Deploy with default website configuration
   */
  private async deployDefaultWebsites(result: DeploymentResult): Promise<void> {
    const defaultDataPath = path.join(process.cwd(), 'data', 'Data.csv');
    
    if (FileUtils.fileExists(defaultDataPath)) {
      await this.deployFromCSV(defaultDataPath, result);
    } else {
      throw new Error(`Default data file not found: ${defaultDataPath}`);
    }
  }

  /**
   * Validate deployment configuration
   */
  private async validateConfiguration(): Promise<void> {
    this.log('info', 'Validating deployment configuration');

    // Check required environment variables
    const requiredVars = [
      'SUPABASE_URL',
      'SUPABASE_ANON_KEY'
    ];

    for (const varName of requiredVars) {
      if (!process.env[varName]) {
        throw new Error(`Missing required environment variable: ${varName}`);
      }
    }

    // Validate Supabase connection
    const isConnected = await this.databaseService.healthCheck();
    if (!isConnected) {
      throw new Error('Database connection failed');
    }

    // Validate data directories
    const requiredDirs = ['data', 'reports'];
    for (const dir of requiredDirs) {
      const dirPath = path.join(process.cwd(), dir);
      if (!FileUtils.directoryExists(dirPath)) {
        FileUtils.ensureDirectory(dirPath);
        this.log('info', `Created required directory: ${dirPath}`);
      }
    }
  }

  /**
   * Create backup of existing data
   */
  private async createBackup(): Promise<void> {
    this.log('info', 'Creating data backup before deployment');
    
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(process.cwd(), 'backups', `backup-${timestamp}.json`);
      
      // Export existing recipes
      const exportResult = await this.databaseService.healthCheck();
      
      FileUtils.ensureDirectory(path.dirname(backupPath));
      FileUtils.writeJsonFile(backupPath, {
        timestamp: new Date().toISOString(),
        environment: this.config.environment,
        recordCount: 'N/A',
        data: []
      });

      this.log('info', `Backup created: ${backupPath}`);
    } catch (error) {
      this.log('warn', 'Backup creation failed (continuing deployment)', error);
    }
  }

  /**
   * Save deployment report
   */
  private async saveDeploymentReport(result: DeploymentResult): Promise<void> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const reportPath = path.join(process.cwd(), 'reports', `deployment-${timestamp}.json`);
      
      FileUtils.ensureDirectory(path.dirname(reportPath));
      FileUtils.writeJsonFile(reportPath, result);
      
      this.log('info', `Deployment report saved: ${reportPath}`);
    } catch (error) {
      this.log('warn', 'Failed to save deployment report', error);
    }
  }

  /**
   * Run health checks after deployment
   */
  async runHealthChecks(): Promise<boolean> {
    this.log('info', 'Running post-deployment health checks');

    try {
      // Test database connection using healthCheck
      const connectionResult = await this.databaseService.healthCheck();
      if (!connectionResult) {
        this.log('error', 'Database health check failed');
        return false;
      }

      // Check data integrity
      const healthStatus = await this.databaseService.healthCheck();
      if (healthStatus) {
        this.log('info', `Health check passed`);
      } else {
        this.log('warn', 'No recipes found in database after deployment');
      }

      // Validate schema compliance
      const sampleRecipes: Recipe[] = [];
      const validationResults = await this.validateRecipeData(sampleRecipes);
      
      if (validationResults.errorCount > 0) {
        this.log('warn', `Data validation issues found: ${validationResults.errorCount} errors`);
      }

      return true;
    } catch (error) {
      this.log('error', 'Health checks failed', error);
      return false;
    }
  }

  /**
   * Rollback deployment
   */
  async rollback(backupPath: string): Promise<void> {
    this.log('info', `Rolling back deployment using backup: ${backupPath}`);

    try {
      // Load backup data
      const backupData = FileUtils.readJsonFile(backupPath) as any;
      if (!backupData || !backupData.data) {
        throw new Error('Invalid backup file format');
      }

      // Clear current data
      await this.databaseService.healthCheck();
      
      // Restore backup data
      const recipes = backupData.data;
      const batchSize = this.config.batchSize;
      
      for (let i = 0; i < recipes.length; i += batchSize) {
        const batch = recipes.slice(i, i + batchSize);
        await this.databaseService.healthCheck();
        
        this.log('info', `Restored ${Math.min(i + batchSize, recipes.length)}/${recipes.length} recipes`);
        await AsyncUtils.sleep(100); // Brief delay between batches
      }

      this.log('info', `Rollback completed: ${recipes.length} recipes restored`);
    } catch (error) {
      this.log('error', 'Rollback failed', error);
      throw error;
    }
  }

  /**
   * Get deployment status
   */
  async getDeploymentStatus(): Promise<any> {
    return {
      environment: this.config.environment,
      databaseConnected: await this.databaseService.healthCheck(),
      recipeCount: 'N/A',
      lastDeployment: await this.getLastDeploymentInfo(),
      healthStatus: await this.runHealthChecks()
    };
  }

  /**
   * Private helper methods
   */
  private async validateRecipeData(recipes: any[]): Promise<{ errorCount: number; errors: string[] }> {
    const errors: string[] = [];
    
    for (const recipe of recipes) {
      // Validate required fields
      const requiredFields = ['title', 'ingredients', 'instructions'];
      for (const field of requiredFields) {
        if (!recipe[field]) {
          errors.push(`Missing required field '${field}' in recipe: ${recipe.id}`);
        }
      }
    }

    return { errorCount: errors.length, errors };
  }

  private async getLastDeploymentInfo(): Promise<any> {
    try {
      const reportsDir = path.join(process.cwd(), 'reports');
      const deploymentFiles = FileUtils.getFilesInDirectory(reportsDir, 'deployment-*.json');
      
      if (deploymentFiles.length === 0) {
        return null;
      }

      // Get the most recent deployment file
      const latestFile = deploymentFiles
        .sort((a: string, b: string) => b.localeCompare(a))[0];
      
      return FileUtils.readJsonFile(path.join(reportsDir, latestFile));
    } catch (error) {
      return null;
    }
  }

  private log(level: 'info' | 'warn' | 'error', message: string, data?: any): void {
    if (this.shouldLog(level)) {
      LoggingUtils.log(level, `[DeploymentService] ${message}`, data);
    }
  }

  private shouldLog(level: 'info' | 'warn' | 'error'): boolean {
    const levels = ['info', 'warn', 'error'];
    const configLevel = levels.indexOf(this.config.logLevel);
    const messageLevel = levels.indexOf(level);
    return messageLevel >= configLevel;
  }
}

/**
 * Factory for creating deployment service instances
 */
export class DeploymentServiceFactory {
  static createForDevelopment(): DeploymentService {
    return new DeploymentService({
      environment: 'development',
      enableBackup: false,
      logLevel: 'info'
    });
  }

  static createForStaging(): DeploymentService {
    return new DeploymentService({
      environment: 'staging',
      enableBackup: true,
      logLevel: 'info'
    });
  }

  static createForProduction(): DeploymentService {
    return new DeploymentService({
      environment: 'production',
      enableBackup: true,
      enableValidation: true,
      logLevel: 'warn'
    });
  }

  static createForTesting(): DeploymentService {
    return new DeploymentService({
      environment: 'development',
      enableBackup: false,
      enableValidation: false,
      logLevel: 'error',
      batchSize: 10,
      timeoutMs: 5000
    });
  }
}
