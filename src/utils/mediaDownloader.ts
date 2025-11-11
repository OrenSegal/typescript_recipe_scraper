/**
 * Media Downloader Utility
 * Downloads videos and extracts metadata from social media platforms
 * Uses yt-dlp (modern youtube-dl fork) for maximum compatibility
 *
 * Supports: TikTok, Instagram, YouTube, Twitter, Facebook, and 1000+ sites
 */

import { execSync, spawn } from 'child_process';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface MediaDownloadOptions {
  outputDir?: string;
  format?: 'mp4' | 'webm' | 'best';
  maxFileSize?: number; // MB
  maxDuration?: number; // seconds
  extractAudio?: boolean;
  extractThumbnail?: boolean;
  preferredQuality?: '144' | '240' | '360' | '480' | '720' | '1080';
}

export interface MediaMetadata {
  id: string;
  title: string;
  description: string;
  author: string;
  authorId?: string;
  duration: number;
  viewCount?: number;
  likeCount?: number;
  uploadDate?: string;
  thumbnailUrl?: string;
  platform: 'tiktok' | 'instagram' | 'youtube' | 'twitter' | 'facebook' | 'other';
}

export interface DownloadedMedia {
  videoPath: string;
  audioPath?: string;
  thumbnailPath?: string;
  metadata: MediaMetadata;
  fileSize: number;
}

/**
 * Media Downloader Class
 * Production-ready implementation with error handling and cleanup
 */
export class MediaDownloader {
  private static ytDlpPath: string | null = null;
  private static tmpDir = os.tmpdir();

  /**
   * Check if yt-dlp is installed and get path
   */
  private static async getYtDlpPath(): Promise<string> {
    if (this.ytDlpPath) return this.ytDlpPath;

    // Try common locations
    const possiblePaths = [
      'yt-dlp',
      '/usr/local/bin/yt-dlp',
      '/opt/homebrew/bin/yt-dlp',
      path.join(process.cwd(), 'node_modules', '.bin', 'yt-dlp')
    ];

    for (const ytdlpPath of possiblePaths) {
      try {
        execSync(`"${ytdlpPath}" --version`, { stdio: 'pipe' });
        this.ytDlpPath = ytdlpPath;
        console.log(`✅ Found yt-dlp at: ${ytdlpPath}`);
        return ytdlpPath;
      } catch (error) {
        continue;
      }
    }

    throw new Error(
      'yt-dlp not found. Install with:\n' +
      '  macOS: brew install yt-dlp\n' +
      '  Linux: sudo apt install yt-dlp OR pip install yt-dlp\n' +
      '  Windows: pip install yt-dlp\n' +
      '  Node: npm install -g yt-dlp-exec'
    );
  }

  /**
   * Get metadata for media URL without downloading
   */
  static async getMetadata(url: string): Promise<MediaMetadata> {
    const ytdlp = await this.getYtDlpPath();

    try {
      // Use yt-dlp to extract JSON metadata
      const output = execSync(
        `"${ytdlp}" --dump-json --no-download "${url}"`,
        {
          stdio: 'pipe',
          maxBuffer: 10 * 1024 * 1024, // 10MB buffer
          timeout: 30000
        }
      ).toString();

      const data = JSON.parse(output);

      return {
        id: data.id || data.display_id || 'unknown',
        title: data.title || 'Untitled',
        description: data.description || '',
        author: data.uploader || data.channel || data.creator || 'Unknown',
        authorId: data.uploader_id || data.channel_id,
        duration: data.duration || 0,
        viewCount: data.view_count,
        likeCount: data.like_count,
        uploadDate: data.upload_date,
        thumbnailUrl: data.thumbnail,
        platform: this.detectPlatform(url)
      };
    } catch (error: any) {
      throw new Error(`Failed to extract metadata: ${error.message}`);
    }
  }

  /**
   * Download media from URL
   */
  static async download(
    url: string,
    options: MediaDownloadOptions = {}
  ): Promise<DownloadedMedia> {
    const ytdlp = await this.getYtDlpPath();

    const {
      outputDir = await this.createTempDirectory(),
      format = 'mp4',
      maxFileSize = 500, // 500MB default
      maxDuration = 600, // 10 minutes default
      extractAudio = false,
      extractThumbnail = false,
      preferredQuality = '720'
    } = options;

    console.log(`📥 Downloading media from: ${url}`);

    try {
      // Get metadata first
      const metadata = await this.getMetadata(url);

      // Check duration
      if (metadata.duration > maxDuration) {
        throw new Error(
          `Video too long (${metadata.duration}s > ${maxDuration}s max)`
        );
      }

      // Prepare output paths
      const videoFilename = `video_${metadata.id}.${format}`;
      const videoPath = path.join(outputDir, videoFilename);

      // Build yt-dlp command
      const args = [
        '--no-playlist', // Don't download playlists
        '--no-warnings',
        '--quiet',
        '--progress',
        // Format selection
        '-f', `bestvideo[height<=${preferredQuality}][ext=${format}]+bestaudio/best[height<=${preferredQuality}]/best`,
        '--merge-output-format', format,
        // Output path
        '-o', videoPath,
        // Metadata
        '--write-info-json',
        // Rate limiting (be respectful)
        '--sleep-requests', '1',
        '--socket-timeout', '30',
        url
      ];

      // Add thumbnail extraction if requested
      if (extractThumbnail) {
        args.push('--write-thumbnail');
      }

      // Execute download
      console.log(`   Running: yt-dlp ${args.join(' ')}`);

      execSync(`"${ytdlp}" ${args.join(' ')}`, {
        stdio: 'inherit',
        timeout: 180000, // 3 minutes max
        maxBuffer: 50 * 1024 * 1024 // 50MB buffer
      });

      // Check if file was created
      if (!await this.fileExists(videoPath)) {
        throw new Error('Download completed but video file not found');
      }

      // Get file size
      const stats = await fs.stat(videoPath);
      const fileSizeMB = stats.size / (1024 * 1024);

      // Check file size
      if (fileSizeMB > maxFileSize) {
        await fs.unlink(videoPath);
        throw new Error(
          `File too large (${fileSizeMB.toFixed(2)}MB > ${maxFileSize}MB max)`
        );
      }

      const result: DownloadedMedia = {
        videoPath,
        metadata,
        fileSize: stats.size
      };

      // Extract audio if requested
      if (extractAudio) {
        result.audioPath = await this.extractAudio(videoPath, outputDir);
      }

      // Find thumbnail if extracted
      if (extractThumbnail) {
        result.thumbnailPath = await this.findThumbnail(outputDir, metadata.id);
      }

      console.log(`✅ Download complete: ${videoPath} (${fileSizeMB.toFixed(2)}MB)`);
      return result;

    } catch (error: any) {
      console.error(`❌ Download failed:`, error.message);
      throw error;
    }
  }

  /**
   * Extract audio from video file
   */
  private static async extractAudio(
    videoPath: string,
    outputDir: string
  ): Promise<string> {
    const audioPath = videoPath.replace(/\.[^.]+$/, '.wav');

    // Check if ffmpeg is available
    try {
      execSync('ffmpeg -version', { stdio: 'pipe' });
    } catch (error) {
      console.warn('⚠️ ffmpeg not found, skipping audio extraction');
      return '';
    }

    // Extract audio as mono WAV at 16kHz (optimal for speech recognition)
    const command = `ffmpeg -i "${videoPath}" -vn -acodec pcm_s16le -ar 16000 -ac 1 "${audioPath}" -y`;

    try {
      execSync(command, { stdio: 'pipe', timeout: 120000 });
      console.log(`   Extracted audio: ${audioPath}`);
      return audioPath;
    } catch (error) {
      console.warn('⚠️ Audio extraction failed');
      return '';
    }
  }

  /**
   * Find thumbnail file
   */
  private static async findThumbnail(
    outputDir: string,
    videoId: string
  ): Promise<string | undefined> {
    const files = await fs.readdir(outputDir);

    const thumbnailPatterns = [
      `video_${videoId}.jpg`,
      `video_${videoId}.webp`,
      `video_${videoId}.png`
    ];

    for (const pattern of thumbnailPatterns) {
      if (files.includes(pattern)) {
        return path.join(outputDir, pattern);
      }
    }

    return undefined;
  }

  /**
   * Detect platform from URL
   */
  private static detectPlatform(
    url: string
  ): 'tiktok' | 'instagram' | 'youtube' | 'twitter' | 'facebook' | 'other' {
    const lowerUrl = url.toLowerCase();

    if (lowerUrl.includes('tiktok.com')) return 'tiktok';
    if (lowerUrl.includes('instagram.com')) return 'instagram';
    if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be'))
      return 'youtube';
    if (lowerUrl.includes('twitter.com') || lowerUrl.includes('x.com'))
      return 'twitter';
    if (lowerUrl.includes('facebook.com')) return 'facebook';

    return 'other';
  }

  /**
   * Create temporary directory for downloads
   */
  private static async createTempDirectory(): Promise<string> {
    const tmpDir = path.join(this.tmpDir, `media-download-${Date.now()}`);
    await fs.mkdir(tmpDir, { recursive: true });
    return tmpDir;
  }

  /**
   * Check if file exists
   */
  private static async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Cleanup downloaded files
   */
  static async cleanup(downloadResult: DownloadedMedia): Promise<void> {
    try {
      const dir = path.dirname(downloadResult.videoPath);

      // Delete all files in the directory
      const files = await fs.readdir(dir);
      for (const file of files) {
        await fs.unlink(path.join(dir, file));
      }

      // Delete the directory
      await fs.rmdir(dir);

      console.log(`🧹 Cleaned up: ${dir}`);
    } catch (error) {
      console.warn(`⚠️ Cleanup failed:`, error);
    }
  }
}

/**
 * Convenience function for quick downloads
 */
export async function downloadMedia(
  url: string,
  options?: MediaDownloadOptions
): Promise<DownloadedMedia> {
  return MediaDownloader.download(url, options);
}

/**
 * Convenience function for metadata extraction
 */
export async function getMediaMetadata(url: string): Promise<MediaMetadata> {
  return MediaDownloader.getMetadata(url);
}
