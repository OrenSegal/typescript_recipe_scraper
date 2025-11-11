/**
 * Audio Transcription Processor
 * Extracts speech-to-text from video/audio files
 * Supports: Google Cloud Speech API, OpenAI Whisper API
 */

import { execSync } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

interface TranscriptionOptions {
  language?: string;           // Language code (default: 'en-US')
  maxDuration?: number;        // Max audio duration in seconds (default: 300)
  provider?: 'google' | 'whisper';  // API provider
}

interface TranscriptionResult {
  text: string;
  confidence: number;
  duration: number;
  provider: string;
}

/**
 * Audio Transcription Processor
 */
export class AudioTranscriptionProcessor {
  private static tmpDir = os.tmpdir();

  /**
   * Transcribe audio from video/audio file
   */
  static async transcribe(
    mediaUrl: string,
    options: TranscriptionOptions = {}
  ): Promise<string> {
    const startTime = Date.now();

    const {
      language = 'en-US',
      maxDuration = 300,
      provider = process.env.GOOGLE_CLOUD_SPEECH_API_KEY ? 'google' : 'whisper'
    } = options;

    console.log(`🎤 Transcribing audio...`);
    console.log(`   Provider: ${provider}`);
    console.log(`   Language: ${language}`);

    // Check if transcription is enabled
    if (process.env.ENABLE_AUDIO_TRANSCRIPTION === 'false') {
      console.log('⚠️ Audio transcription disabled in config');
      return '';
    }

    // Create temp directory
    const workDir = await this.createTempDirectory();

    try {
      // Step 1: Download media if URL
      let mediaPath = mediaUrl;
      if (this.isUrl(mediaUrl)) {
        console.log('   Downloading media...');
        mediaPath = await this.downloadMedia(mediaUrl, workDir);
      }

      // Step 2: Extract audio from video
      console.log('   Extracting audio...');
      const audioPath = await this.extractAudio(mediaPath, workDir);

      // Step 3: Check audio duration
      const duration = await this.getAudioDuration(audioPath);
      if (duration > maxDuration) {
        console.log(`⚠️ Audio too long (${duration}s > ${maxDuration}s), truncating`);
        await this.truncateAudio(audioPath, maxDuration);
      }

      // Step 4: Transcribe based on provider
      let result: TranscriptionResult;

      if (provider === 'google' && process.env.GOOGLE_CLOUD_SPEECH_API_KEY) {
        result = await this.transcribeWithGoogle(audioPath, language);
      } else if (provider === 'whisper' && process.env.OPENAI_API_KEY) {
        result = await this.transcribeWithWhisper(audioPath, language);
      } else {
        console.log('⚠️ No transcription API configured, skipping');
        return '';
      }

      const processingTime = Date.now() - startTime;
      console.log(`✅ Transcription complete: ${result.text.length} chars in ${processingTime}ms`);

      return result.text;

    } finally {
      // Cleanup
      await this.cleanupDirectory(workDir);
    }
  }

  /**
   * Download media from URL
   */
  private static async downloadMedia(url: string, workDir: string): Promise<string> {
    const mediaPath = path.join(workDir, 'media.mp4');

    try {
      // Use curl for better compatibility
      execSync(`curl -L "${url}" -o "${mediaPath}"`, {
        stdio: 'pipe',
        timeout: 60000
      });
    } catch (error) {
      // Fallback to fetch
      const response = await fetch(url);
      const buffer = await response.arrayBuffer();
      await fs.writeFile(mediaPath, Buffer.from(buffer));
    }

    return mediaPath;
  }

  /**
   * Extract audio from video using ffmpeg
   */
  private static async extractAudio(mediaPath: string, workDir: string): Promise<string> {
    const audioPath = path.join(workDir, 'audio.wav');
    const ffmpegPath = this.getFfmpegPath();

    // Extract audio as mono WAV at 16kHz (optimal for speech recognition)
    const command = `"${ffmpegPath}" -i "${mediaPath}" -vn -acodec pcm_s16le -ar 16000 -ac 1 "${audioPath}" -y`;

    execSync(command, {
      stdio: 'pipe',
      timeout: 120000
    });

    return audioPath;
  }

  /**
   * Get audio duration in seconds
   */
  private static async getAudioDuration(audioPath: string): Promise<number> {
    const ffmpegPath = this.getFfmpegPath();

    try {
      const output = execSync(
        `"${ffmpegPath}" -i "${audioPath}" 2>&1 | grep "Duration"`,
        { stdio: 'pipe' }
      ).toString();

      // Parse duration from ffmpeg output: "Duration: 00:05:23.45"
      const match = output.match(/Duration: (\d{2}):(\d{2}):(\d{2})/);
      if (match) {
        const hours = parseInt(match[1], 10);
        const minutes = parseInt(match[2], 10);
        const seconds = parseInt(match[3], 10);
        return hours * 3600 + minutes * 60 + seconds;
      }
    } catch (error) {
      console.warn('⚠️ Failed to get audio duration:', error);
    }

    return 0;
  }

  /**
   * Truncate audio to max duration
   */
  private static async truncateAudio(audioPath: string, maxDuration: number): Promise<void> {
    const ffmpegPath = this.getFfmpegPath();
    const tempPath = audioPath + '.tmp';

    const command = `"${ffmpegPath}" -i "${audioPath}" -t ${maxDuration} -c copy "${tempPath}" -y`;

    execSync(command, { stdio: 'pipe' });

    // Replace original with truncated version
    await fs.unlink(audioPath);
    await fs.rename(tempPath, audioPath);
  }

  /**
   * Transcribe using Google Cloud Speech API
   */
  private static async transcribeWithGoogle(
    audioPath: string,
    language: string
  ): Promise<TranscriptionResult> {
    console.log('   Using Google Cloud Speech API...');

    // Lazy load Google Speech client
    const speech = await import('@google-cloud/speech');
    const client = new speech.SpeechClient();

    // Read audio file
    const audioBytes = await fs.readFile(audioPath);

    const audio = {
      content: audioBytes.toString('base64'),
    };

    const config = {
      encoding: 'LINEAR16' as const,
      sampleRateHertz: 16000,
      languageCode: language,
      enableAutomaticPunctuation: true,
      model: 'default',
    };

    const request = {
      audio,
      config,
    };

    try {
      const [response] = await client.recognize(request);
      const transcription = response.results
        ?.map(result => result.alternatives?.[0]?.transcript || '')
        .join(' ')
        .trim() || '';

      const confidence = response.results?.[0]?.alternatives?.[0]?.confidence || 0.5;

      return {
        text: transcription,
        confidence,
        duration: 0,
        provider: 'google'
      };

    } catch (error: any) {
      console.error('❌ Google Speech API failed:', error.message);
      throw error;
    }
  }

  /**
   * Transcribe using OpenAI Whisper API
   */
  private static async transcribeWithWhisper(
    audioPath: string,
    language: string
  ): Promise<TranscriptionResult> {
    console.log('   Using OpenAI Whisper API...');

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    // Read audio file
    const audioBuffer = await fs.readFile(audioPath);

    // Create form data
    const formData = new FormData();
    const blob = new Blob([audioBuffer], { type: 'audio/wav' });
    formData.append('file', blob, 'audio.wav');
    formData.append('model', 'whisper-1');
    formData.append('language', language.split('-')[0]); // 'en-US' -> 'en'
    formData.append('response_format', 'json');

    try {
      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Whisper API error: ${response.statusText}`);
      }

      const result = await response.json();

      return {
        text: result.text || '',
        confidence: 0.9, // Whisper doesn't provide confidence
        duration: result.duration || 0,
        provider: 'whisper'
      };

    } catch (error: any) {
      console.error('❌ Whisper API failed:', error.message);
      throw error;
    }
  }

  /**
   * Get ffmpeg path
   */
  private static getFfmpegPath(): string {
    // Try ffmpeg-static (npm package)
    try {
      const ffmpegStatic = require('ffmpeg-static');
      if (ffmpegStatic) return ffmpegStatic;
    } catch (error) {
      // Not installed
    }

    // Try system ffmpeg
    try {
      execSync('which ffmpeg', { stdio: 'pipe' });
      return 'ffmpeg';
    } catch (error) {
      // Not found
    }

    throw new Error('ffmpeg not found. Install: npm install ffmpeg-static OR brew install ffmpeg');
  }

  /**
   * Create temporary directory
   */
  private static async createTempDirectory(): Promise<string> {
    const tmpDir = path.join(this.tmpDir, `audio-transcription-${Date.now()}`);
    await fs.mkdir(tmpDir, { recursive: true });
    return tmpDir;
  }

  /**
   * Cleanup directory
   */
  private static async cleanupDirectory(dir: string): Promise<void> {
    try {
      await fs.rm(dir, { recursive: true, force: true });
    } catch (error) {
      console.warn(`⚠️ Failed to cleanup ${dir}:`, error);
    }
  }

  /**
   * Check if string is URL
   */
  private static isUrl(str: string): boolean {
    try {
      new URL(str);
      return true;
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const audioTranscriptionProcessor = {
  transcribe: (url: string, options?: TranscriptionOptions) =>
    AudioTranscriptionProcessor.transcribe(url, options)
};
