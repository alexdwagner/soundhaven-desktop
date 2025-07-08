import * as mm from 'music-metadata';
import * as path from 'path';
import * as fs from 'fs';

export interface AudioMetadata {
  title?: string;
  artist?: string;
  album?: string;
  year?: number;
  trackNumber?: number;
  genre?: string[];
  duration?: number;
  bitrate?: number;
  sampleRate?: number;
  channels?: number;
  format?: string;
  lossless?: boolean;
  fileSize?: number;
}

export class MetadataService {
  // List of supported audio file extensions
  private static readonly SUPPORTED_EXTENSIONS = [
    '.mp3',
    '.m4a',
    '.flac',
    '.wav',
    '.ogg',
    '.aac',
    '.wma',
    '.aiff'
  ];

  /**
   * Extract metadata from an audio file
   */
  static async extractFromFile(filePath: string): Promise<AudioMetadata> {
    try {
      // Validate file extension
      if (!this.isValidAudioFile(filePath)) {
        throw new Error('Unsupported file format');
      }

      // Parse metadata
      const metadata = await mm.parseFile(filePath);
      
      // Get file stats
      const stats = await fs.promises.stat(filePath);

      return {
        title: metadata.common.title,
        artist: metadata.common.artist,
        album: metadata.common.album,
        year: metadata.common.year || undefined,
        trackNumber: metadata.common.track?.no || undefined,
        genre: metadata.common.genre,
        duration: metadata.format.duration,
        bitrate: metadata.format.bitrate,
        sampleRate: metadata.format.sampleRate,
        channels: metadata.format.numberOfChannels,
        format: metadata.format.container,
        lossless: metadata.format.lossless,
        fileSize: stats.size
      };
    } catch (error) {
      console.error('❌ Error extracting metadata:', error);
      throw error;
    }
  }

  /**
   * Check if a file is a supported audio format
   */
  static isValidAudioFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return this.SUPPORTED_EXTENSIONS.includes(ext);
  }

  /**
   * Batch extract metadata from multiple files
   */
  static async extractFromFiles(filePaths: string[]): Promise<Map<string, AudioMetadata>> {
    const results = new Map<string, AudioMetadata>();
    
    for (const filePath of filePaths) {
      try {
        const metadata = await this.extractFromFile(filePath);
        results.set(filePath, metadata);
      } catch (error) {
        console.error(`❌ Error extracting metadata from ${filePath}:`, error);
        // Continue with next file
      }
    }
    
    return results;
  }

  /**
   * Get a human-readable duration string
   */
  static formatDuration(seconds?: number): string {
    if (!seconds) return '0:00';
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  /**
   * Get a human-readable file size string
   */
  static formatFileSize(bytes?: number): string {
    if (!bytes) return '0 B';
    
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  /**
   * Get a human-readable bitrate string
   */
  static formatBitrate(bps?: number): string {
    if (!bps) return '0 kbps';
    return `${Math.round(bps / 1000)} kbps`;
  }

  /**
   * Validate metadata completeness
   */
  static validateMetadata(metadata: AudioMetadata): string[] {
    const issues: string[] = [];
    
    if (!metadata.title) issues.push('Missing title');
    if (!metadata.artist) issues.push('Missing artist');
    if (!metadata.album) issues.push('Missing album');
    if (!metadata.year) issues.push('Missing year');
    if (!metadata.trackNumber) issues.push('Missing track number');
    if (!metadata.genre || metadata.genre.length === 0) issues.push('Missing genre');
    
    return issues;
  }

  /**
   * Check if metadata is complete enough for organization
   */
  static isOrganizable(metadata: AudioMetadata): boolean {
    return !!(metadata.artist && metadata.album);
  }
} 