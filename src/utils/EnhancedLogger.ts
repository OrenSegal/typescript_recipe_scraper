/**
 * Enhanced Logger for Recipe Scraping
 * Provides detailed, structured logging with timestamps and color coding
 */

import * as fs from 'fs/promises';
import * as path from 'path';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'success';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  component: string;
  message: string;
  data?: any;
  duration?: number;
}

export class EnhancedLogger {
  private static logs: LogEntry[] = [];
  private static logFile: string = 'logs/scraper.log';
  private static enableConsole: boolean = true;
  private static enableFile: boolean = true;
  private static minLevel: LogLevel = 'info';

  private static levels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
    success: 1,
  };

  private static icons: Record<LogLevel, string> = {
    debug: '🔍',
    info: 'ℹ️ ',
    warn: '⚠️ ',
    error: '❌',
    success: '✅',
  };

  /**
   * Configure logger
   */
  static configure(options: {
    logFile?: string;
    enableConsole?: boolean;
    enableFile?: boolean;
    minLevel?: LogLevel;
  }) {
    if (options.logFile) this.logFile = options.logFile;
    if (options.enableConsole !== undefined) this.enableConsole = options.enableConsole;
    if (options.enableFile !== undefined) this.enableFile = options.enableFile;
    if (options.minLevel) this.minLevel = options.minLevel;
  }

  /**
   * Log a message
   */
  static log(
    level: LogLevel,
    component: string,
    message: string,
    data?: any,
    duration?: number
  ): void {
    // Check if we should log this level
    if (this.levels[level] < this.levels[this.minLevel]) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      component,
      message,
      data,
      duration,
    };

    this.logs.push(entry);

    // Console output
    if (this.enableConsole) {
      this.logToConsole(entry);
    }

    // File output (async, fire and forget)
    if (this.enableFile) {
      this.logToFile(entry).catch(() => {
        // Silently ignore file write errors
      });
    }
  }

  /**
   * Convenience methods
   */
  static debug(component: string, message: string, data?: any): void {
    this.log('debug', component, message, data);
  }

  static info(component: string, message: string, data?: any): void {
    this.log('info', component, message, data);
  }

  static warn(component: string, message: string, data?: any): void {
    this.log('warn', component, message, data);
  }

  static error(component: string, message: string, data?: any): void {
    this.log('error', component, message, data);
  }

  static success(component: string, message: string, data?: any): void {
    this.log('success', component, message, data);
  }

  /**
   * Log with timing
   */
  static timed<T>(
    component: string,
    operation: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const startTime = Date.now();
    this.info(component, `Starting: ${operation}`);

    return fn()
      .then((result) => {
        const duration = Date.now() - startTime;
        this.success(component, `Completed: ${operation}`, { duration: `${duration}ms` });
        return result;
      })
      .catch((error) => {
        const duration = Date.now() - startTime;
        this.error(component, `Failed: ${operation}`, {
          error: error.message,
          duration: `${duration}ms`,
        });
        throw error;
      });
  }

  /**
   * Get all logs
   */
  static getLogs(): LogEntry[] {
    return [...this.logs];
  }

  /**
   * Clear logs
   */
  static clear(): void {
    this.logs = [];
  }

  /**
   * Save logs to file
   */
  static async saveLogs(filename?: string): Promise<void> {
    const file = filename || `logs/scraper-${Date.now()}.json`;
    const dir = path.dirname(file);

    try {
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(file, JSON.stringify(this.logs, null, 2));
      console.log(`📝 Logs saved to: ${file}`);
    } catch (error) {
      console.error('Failed to save logs:', error);
    }
  }

  /**
   * Private: Log to console
   */
  private static logToConsole(entry: LogEntry): void {
    const icon = this.icons[entry.level];
    const timestamp = new Date(entry.timestamp).toLocaleTimeString();
    const component = `[${entry.component}]`;
    const message = entry.message;

    let output = `${icon} ${timestamp} ${component} ${message}`;

    if (entry.duration) {
      output += ` (${entry.duration}ms)`;
    }

    console.log(output);

    if (entry.data) {
      console.log('   Data:', entry.data);
    }
  }

  /**
   * Private: Log to file
   */
  private static async logToFile(entry: LogEntry): Promise<void> {
    try {
      const dir = path.dirname(this.logFile);
      await fs.mkdir(dir, { recursive: true });

      const line = JSON.stringify(entry) + '\n';
      await fs.appendFile(this.logFile, line);
    } catch (error) {
      // Silently ignore
    }
  }

  /**
   * Create a scoped logger for a specific component
   */
  static scope(component: string) {
    return {
      debug: (msg: string, data?: any) => this.debug(component, msg, data),
      info: (msg: string, data?: any) => this.info(component, msg, data),
      warn: (msg: string, data?: any) => this.warn(component, msg, data),
      error: (msg: string, data?: any) => this.error(component, msg, data),
      success: (msg: string, data?: any) => this.success(component, msg, data),
      timed: <T>(operation: string, fn: () => Promise<T>) =>
        this.timed(component, operation, fn),
    };
  }
}

// Create default loggers for common components
export const videoLogger = EnhancedLogger.scope('VideoScraper');
export const nutritionLogger = EnhancedLogger.scope('Nutrition');
export const mcpLogger = EnhancedLogger.scope('MCP');
export const webLogger = EnhancedLogger.scope('WebScraper');
