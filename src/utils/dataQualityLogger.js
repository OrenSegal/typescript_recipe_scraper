import * as fs from 'fs';
import * as path from 'path';
export class DataQualityLogger {
    static instance;
    issues = [];
    logFilePath;
    initialized = false;
    constructor(logDirectory = 'logs') {
        this.logFilePath = path.resolve(process.cwd(), logDirectory, 'data-quality-log.json');
    }
    async initialize() {
        if (this.initialized)
            return;
        try {
            const logDir = path.dirname(this.logFilePath);
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }
            this.initialized = true;
        }
        catch (error) {
            console.error('Failed to initialize DataQualityLogger:', error);
            throw new Error('Failed to initialize DataQualityLogger');
        }
    }
    static getInstance() {
        if (!DataQualityLogger.instance) {
            DataQualityLogger.instance = new DataQualityLogger();
        }
        return DataQualityLogger.instance;
    }
    logIssue(sourceUrl, field, issue, context) {
        const newIssue = {
            timestamp: new Date().toISOString(),
            sourceUrl,
            field,
            issue,
            context,
        };
        this.issues.push(newIssue);
        console.log(`[Data Quality Issue] URL: ${sourceUrl}, Field: ${field}, Issue: ${issue}`);
    }
    saveLog() {
        if (this.issues.length === 0)
            return;
        let existingIssues = [];
        if (fs.existsSync(this.logFilePath)) {
            try {
                const fileContent = fs.readFileSync(this.logFilePath, 'utf-8');
                existingIssues = JSON.parse(fileContent);
            }
            catch (error) {
                console.error('Error reading existing data quality log:', error);
            }
        }
        const allIssues = [...existingIssues, ...this.issues];
        try {
            fs.writeFileSync(this.logFilePath, JSON.stringify(allIssues, null, 2));
            console.log(`Data quality log saved to ${this.logFilePath}`);
            this.issues = []; // Clear issues after saving
        }
        catch (error) {
            console.error('Error writing to data quality log:', error);
        }
    }
    getIssues() {
        return this.issues;
    }
    clearIssues() {
        this.issues = [];
    }
}
