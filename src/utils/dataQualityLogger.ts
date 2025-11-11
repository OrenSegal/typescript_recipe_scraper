import * as fs from 'fs';
import * as path from 'path';

interface QualityIssue {
  timestamp: string;
  sourceUrl: string;
  field: string;
  issue: string;
  context?: Record<string, any>;
}

export class DataQualityLogger {
  [x: string]: any;
  private static instance: DataQualityLogger;
  private issues: QualityIssue[] = [];
  private logFilePath: string;
  private initialized = false;

  private constructor(logDirectory: string = 'logs') {
    this.logFilePath = path.resolve(process.cwd(), logDirectory, 'data-quality-log.json');
  }

  public async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const logDir = path.dirname(this.logFilePath);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize DataQualityLogger:', error);
      throw new Error('Failed to initialize DataQualityLogger');
    }
  }

  public static getInstance(): DataQualityLogger {
    if (!DataQualityLogger.instance) {
      DataQualityLogger.instance = new DataQualityLogger();
    }
    return DataQualityLogger.instance;
  }

  public logIssue(sourceUrl: string, field: string, issue: string, context?: Record<string, any>): void {
    const newIssue: QualityIssue = {
      timestamp: new Date().toISOString(),
      sourceUrl,
      field,
      issue,
      context,
    };
    this.issues.push(newIssue);
    console.log(`[Data Quality Issue] URL: ${sourceUrl}, Field: ${field}, Issue: ${issue}`);
  }

  public saveLog(): void {
    if (this.issues.length === 0) return;

    let existingIssues: QualityIssue[] = [];
    if (fs.existsSync(this.logFilePath)) {
      try {
        const fileContent = fs.readFileSync(this.logFilePath, 'utf-8');
        existingIssues = JSON.parse(fileContent);
      } catch (error) {
        console.error('Error reading existing data quality log:', error);
      }
    }

    const allIssues = [...existingIssues, ...this.issues];

    try {
      fs.writeFileSync(this.logFilePath, JSON.stringify(allIssues, null, 2));
      console.log(`Data quality log saved to ${this.logFilePath}`);
      this.issues = []; // Clear issues after saving
    } catch (error) {
      console.error('Error writing to data quality log:', error);
    }
  }

  public getIssues(): QualityIssue[] {
    return this.issues;
  }

  public clearIssues(): void {
    this.issues = [];
  }
}
