/**
 * PDF Text Extractor
 * Extracts text from PDF files for recipe parsing
 */

import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

interface PDFExtractionOptions {
  maxPages?: number;          // Maximum pages to process (default: 50)
  includeMetadata?: boolean;  // Include PDF metadata (default: true)
}

interface PDFExtractionResult {
  text: string;
  pageCount: number;
  metadata?: {
    title?: string;
    author?: string;
    subject?: string;
    creationDate?: string;
  };
}

/**
 * PDF Text Extractor
 */
export class PDFExtractor {

  /**
   * Extract text from PDF file
   */
  static async extractText(
    pdfPath: string,
    options: PDFExtractionOptions = {}
  ): Promise<string> {
    const {
      maxPages = 50,
      includeMetadata = true
    } = options;

    console.log(`📄 Extracting text from PDF: ${path.basename(pdfPath)}`);

    try {
      // Check if file exists
      await fs.access(pdfPath);

      // Try pdf-parse library (most reliable)
      const result = await this.extractWithPdfParse(pdfPath, maxPages);

      console.log(`✅ Extracted ${result.text.length} characters from ${result.pageCount} pages`);

      return result.text;

    } catch (error: any) {
      console.error(`❌ PDF extraction failed: ${error.message}`);

      // Fallback to pdftotext command-line tool
      try {
        console.log('   Trying pdftotext fallback...');
        return await this.extractWithPdfToText(pdfPath, maxPages);
      } catch (fallbackError: any) {
        console.error(`❌ Fallback failed: ${fallbackError.message}`);
        throw new Error(`PDF extraction failed: ${error.message}`);
      }
    }
  }

  /**
   * Extract text using pdf-parse library
   */
  private static async extractWithPdfParse(
    pdfPath: string,
    maxPages: number
  ): Promise<PDFExtractionResult> {
    // Lazy load pdf-parse (large dependency)
    let pdfParse: any;
    try {
      // @ts-ignore - pdf-parse doesn't have type declarations
      pdfParse = (await import('pdf-parse')).default;
    } catch (error) {
      throw new Error('pdf-parse not installed. Run: npm install pdf-parse');
    }

    // Read PDF file
    const dataBuffer = await fs.readFile(pdfPath);

    // Parse PDF
    const data = await pdfParse(dataBuffer, {
      max: maxPages
    });

    return {
      text: data.text,
      pageCount: data.numpages,
      metadata: {
        title: data.info?.Title,
        author: data.info?.Author,
        subject: data.info?.Subject,
        creationDate: data.info?.CreationDate
      }
    };
  }

  /**
   * Extract text using pdftotext command-line tool (fallback)
   */
  private static async extractWithPdfToText(
    pdfPath: string,
    maxPages: number
  ): Promise<string> {
    const { execSync } = await import('child_process');

    try {
      // Check if pdftotext is available
      execSync('which pdftotext', { stdio: 'pipe' });
    } catch (error) {
      throw new Error('pdftotext not found. Install: brew install poppler OR apt-get install poppler-utils');
    }

    // Create temp file for output
    const tmpDir = os.tmpdir();
    const outputPath = path.join(tmpDir, `pdf-text-${Date.now()}.txt`);

    try {
      // Extract text
      const command = `pdftotext -l ${maxPages} "${pdfPath}" "${outputPath}"`;
      execSync(command, { stdio: 'pipe', timeout: 60000 });

      // Read extracted text
      const text = await fs.readFile(outputPath, 'utf-8');

      return text;

    } finally {
      // Cleanup temp file
      try {
        await fs.unlink(outputPath);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Download PDF from URL
   */
  static async downloadPDF(url: string): Promise<string> {
    console.log(`📥 Downloading PDF from URL...`);

    const tmpDir = os.tmpdir();
    const pdfPath = path.join(tmpDir, `downloaded-pdf-${Date.now()}.pdf`);

    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to download PDF: ${response.statusText}`);
      }

      const buffer = await response.arrayBuffer();
      await fs.writeFile(pdfPath, Buffer.from(buffer));

      console.log(`✅ Downloaded PDF: ${pdfPath}`);

      return pdfPath;

    } catch (error: any) {
      throw new Error(`PDF download failed: ${error.message}`);
    }
  }

  /**
   * Extract text from PDF URL
   */
  static async extractFromUrl(
    url: string,
    options: PDFExtractionOptions = {}
  ): Promise<string> {
    let pdfPath: string | null = null;

    try {
      // Download PDF
      pdfPath = await this.downloadPDF(url);

      // Extract text
      return await this.extractText(pdfPath, options);

    } finally {
      // Cleanup downloaded file
      if (pdfPath) {
        try {
          await fs.unlink(pdfPath);
        } catch (error) {
          console.warn(`⚠️ Failed to cleanup ${pdfPath}`);
        }
      }
    }
  }

  /**
   * Check if file is a PDF
   */
  static async isPDF(filePath: string): Promise<boolean> {
    try {
      const buffer = await fs.readFile(filePath);

      // Check PDF magic number (first 4 bytes: %PDF)
      return buffer.toString('utf-8', 0, 4) === '%PDF';

    } catch (error) {
      return false;
    }
  }

  /**
   * Get PDF page count
   */
  static async getPageCount(pdfPath: string): Promise<number> {
    try {
      const result = await this.extractWithPdfParse(pdfPath, 1);
      return result.pageCount;
    } catch (error) {
      return 0;
    }
  }
}

// Export convenience functions
export const pdfExtractor = {
  extractText: (path: string, options?: PDFExtractionOptions) =>
    PDFExtractor.extractText(path, options),

  extractFromUrl: (url: string, options?: PDFExtractionOptions) =>
    PDFExtractor.extractFromUrl(url, options),

  isPDF: (path: string) =>
    PDFExtractor.isPDF(path),

  getPageCount: (path: string) =>
    PDFExtractor.getPageCount(path)
};
