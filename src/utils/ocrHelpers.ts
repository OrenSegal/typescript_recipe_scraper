/**
 * OCR Helper Functions
 * 
 * Supporting utilities for video text extraction using Google Vision API and Tesseract.js
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Google Vision API client (optional dependency)
let visionClient: any = null;
try {
  const vision = require('@google-cloud/vision');
  visionClient = new vision.ImageAnnotatorClient({
    keyFilename: process.env.GOOGLE_VISION_KEY_FILE,
    apiKey: process.env.GOOGLE_VISION_API_KEY
  });
} catch (error) {
  console.log('ℹ️ Google Vision API not available, will use Tesseract.js fallback');
}

/**
 * Download video for OCR processing
 */
export async function downloadVideoForOCR(url: string, platform: string): Promise<string | null> {
  try {
    console.log(`📥 Downloading video from ${platform}...`);
    
    const tempDir = path.join(__dirname, '../../temp');
    await fs.mkdir(tempDir, { recursive: true });
    
    const videoPath = path.join(tempDir, `video_${Date.now()}.mp4`);
    
    // Use yt-dlp to download video
    const command = `yt-dlp -f "best[height<=720]" --no-playlist -o "${videoPath}" "${url}"`;
    
    try {
      await execAsync(command, { timeout: 60000 }); // 1 minute timeout
      
      // Verify file exists and has content
      const stats = await fs.stat(videoPath);
      if (stats.size > 0) {
        console.log(`✅ Video downloaded: ${stats.size} bytes`);
        return videoPath;
      } else {
        console.log('❌ Downloaded video file is empty');
        await fs.unlink(videoPath).catch(() => {});
        return null;
      }
    } catch (error) {
      console.log(`⚠️ yt-dlp failed, trying fallback method:`, error);
      
      // Fallback: try basic curl for direct video URLs
      if (url.includes('.mp4') || url.includes('.webm') || url.includes('.mov')) {
        const curlCommand = `curl -L --max-time 30 -o "${videoPath}" "${url}"`;
        await execAsync(curlCommand);
        
        const stats = await fs.stat(videoPath);
        if (stats.size > 0) {
          console.log(`✅ Video downloaded via fallback: ${stats.size} bytes`);
          return videoPath;
        }
      }
      
      return null;
    }
  } catch (error) {
    console.error('❌ Video download failed:', error);
    return null;
  }
}

/**
 * Extract frames from video at regular intervals
 */
export async function extractVideoFrames(videoPath: string): Promise<string[]> {
  try {
    console.log('🎬 Extracting video frames...');
    
    const framesDir = path.join(path.dirname(videoPath), 'frames');
    await fs.mkdir(framesDir, { recursive: true });
    
    // Extract frames every 3 seconds, up to 10 frames
    const framePattern = path.join(framesDir, 'frame_%03d.jpg');
    const command = `ffmpeg -i "${videoPath}" -vf fps=1/3 -frames:v 10 -y "${framePattern}"`;
    
    await execAsync(command, { timeout: 30000 }); // 30 second timeout
    
    // Get list of extracted frames
    const frameFiles = await fs.readdir(framesDir);
    const framePaths = frameFiles
      .filter(file => file.endsWith('.jpg'))
      .map(file => path.join(framesDir, file))
      .sort();
    
    console.log(`✅ Extracted ${framePaths.length} frames`);
    return framePaths;
  } catch (error) {
    console.error('❌ Frame extraction failed:', error);
    return [];
  }
}

/**
 * Extract text using Google Vision API
 */
export async function extractTextWithGoogleVision(imagePath: string): Promise<string | null> {
  if (!visionClient) {
    console.log('⚠️ Google Vision API client not available');
    return null;
  }
  
  try {
    const [result] = await visionClient.textDetection(imagePath);
    const detections = result.textAnnotations;
    
    if (detections && detections.length > 0) {
      const text = detections[0].description;
      console.log(`✅ Google Vision extracted ${text.length} characters`);
      return text;
    } else {
      console.log('ℹ️ No text detected in image');
      return null;
    }
  } catch (error) {
    console.error('❌ Google Vision API error:', error);
    return null;
  }
}

/**
 * Clean up temporary files
 */
export async function cleanupTempFiles(filePaths: string[]): Promise<void> {
  console.log('🧹 Cleaning up temporary files...');
  
  for (const filePath of filePaths) {
    try {
      const stats = await fs.stat(filePath);
      if (stats.isDirectory()) {
        // Remove directory and all contents
        await fs.rm(filePath, { recursive: true, force: true });
      } else {
        // Remove single file
        await fs.unlink(filePath);
      }
    } catch (error) {
      // Ignore errors - file might already be deleted
      console.log(`⚠️ Could not delete ${filePath}:`, error instanceof Error ? error.message : String(error));
    }
  }
  
  console.log('✅ Cleanup completed');
}

/**
 * Deduplicate and combine extracted text
 */
export function deduplicateAndCombineText(texts: string[]): string {
  if (texts.length === 0) return '';
  
  // Remove duplicates and empty strings
  const uniqueTexts = [...new Set(texts.filter(text => text.trim().length > 0))];
  
  // Combine with line breaks
  const combined = uniqueTexts.join('\n\n');
  
  // Clean up the text
  return combined
    .replace(/\n{3,}/g, '\n\n') // Replace multiple newlines
    .replace(/\s{2,}/g, ' ')    // Replace multiple spaces
    .trim();
}

/**
 * Check if required OCR dependencies are available
 */
export async function checkOCRDependencies(): Promise<{
  hasFFmpeg: boolean;
  hasYtDlp: boolean;
  hasGoogleVision: boolean;
  hasTesseract: boolean;
}> {
  const checks = {
    hasFFmpeg: false,
    hasYtDlp: false,
    hasGoogleVision: !!visionClient,
    hasTesseract: false
  };
  
  // Check ffmpeg
  try {
    await execAsync('ffmpeg -version');
    checks.hasFFmpeg = true;
  } catch (error) {
    console.log('⚠️ ffmpeg not found - video frame extraction will not work');
  }
  
  // Check yt-dlp
  try {
    await execAsync('yt-dlp --version');
    checks.hasYtDlp = true;
  } catch (error) {
    console.log('⚠️ yt-dlp not found - video download may be limited');
  }
  
  // Check Tesseract.js (dynamic import)
  try {
    await import('tesseract.js');
    checks.hasTesseract = true;
  } catch (error) {
    console.log('⚠️ tesseract.js not available - OCR fallback will not work');
  }
  
  return checks;
}
