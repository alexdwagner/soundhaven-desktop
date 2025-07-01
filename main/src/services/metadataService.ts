import * as mm from 'music-metadata';
import * as fs from 'fs';
import * as path from 'path';

export interface ExtractedMetadata {
  title: string;
  artist: string | null;
  album: string | null;
  year: number | null;
  genre: string | null;
  trackNumber: number | null;
  duration: number; // in seconds
  bitrate: number | null;
  sampleRate: number | null;
  channels: number | null;
}

export class MetadataService {
  /**
   * Extract metadata from an audio file buffer
   */
  static async extractFromBuffer(fileBuffer: Buffer, fileName: string): Promise<ExtractedMetadata> {
    console.log(`[METADATA] Extracting metadata from buffer for file: ${fileName}`);
    
    try {
      // Parse metadata from buffer
      const metadata = await mm.parseBuffer(fileBuffer, undefined, {
        duration: true,
        skipCovers: true, // Skip cover art to improve performance
        skipPostHeaders: true
      });

      console.log(`[METADATA] Raw metadata extracted:`, {
        title: metadata.common.title,
        artist: metadata.common.artist,
        album: metadata.common.album,
        year: metadata.common.year,
        genre: metadata.common.genre?.[0],
        trackNo: metadata.common.track?.no,
        duration: metadata.format.duration,
        bitrate: metadata.format.bitrate,
        sampleRate: metadata.format.sampleRate,
        numberOfChannels: metadata.format.numberOfChannels
      });

      // Extract and clean the metadata
      const result: ExtractedMetadata = {
        title: this.cleanString(metadata.common.title) || this.extractTitleFromFilename(fileName),
        artist: this.cleanString(metadata.common.artist) || null,
        album: this.cleanString(metadata.common.album) || null,
        year: metadata.common.year || null,
        genre: metadata.common.genre?.[0] ? this.cleanString(metadata.common.genre[0]) : null,
        trackNumber: metadata.common.track?.no || null,
        duration: Math.round(metadata.format.duration || 0),
        bitrate: metadata.format.bitrate || null,
        sampleRate: metadata.format.sampleRate || null,
        channels: metadata.format.numberOfChannels || null
      };

      console.log(`[METADATA] Processed metadata:`, result);
      return result;

    } catch (error) {
      console.error(`[METADATA] Error extracting metadata from ${fileName}:`, error);
      
      // Fallback to filename-based extraction
      return this.extractFromFilename(fileName);
    }
  }

  /**
   * Extract metadata from a file path
   */
  static async extractFromFile(filePath: string): Promise<ExtractedMetadata> {
    console.log(`[METADATA] Extracting metadata from file: ${filePath}`);
    
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error(`File does not exist: ${filePath}`);
      }

      const metadata = await mm.parseFile(filePath, {
        duration: true,
        skipCovers: true,
        skipPostHeaders: true
      });

      const fileName = path.basename(filePath);
      
      const result: ExtractedMetadata = {
        title: this.cleanString(metadata.common.title) || this.extractTitleFromFilename(fileName),
        artist: this.cleanString(metadata.common.artist) || null,
        album: this.cleanString(metadata.common.album) || null,
        year: metadata.common.year || null,
        genre: metadata.common.genre?.[0] ? this.cleanString(metadata.common.genre[0]) : null,
        trackNumber: metadata.common.track?.no || null,
        duration: Math.round(metadata.format.duration || 0),
        bitrate: metadata.format.bitrate || null,
        sampleRate: metadata.format.sampleRate || null,
        channels: metadata.format.numberOfChannels || null
      };

      console.log(`[METADATA] Extracted metadata from file:`, result);
      return result;

    } catch (error) {
      console.error(`[METADATA] Error extracting metadata from file ${filePath}:`, error);
      
      // Fallback to filename-based extraction
      const fileName = path.basename(filePath);
      return this.extractFromFilename(fileName);
    }
  }

  /**
   * Fallback: Extract basic info from filename
   */
  private static extractFromFilename(fileName: string): ExtractedMetadata {
    console.log(`[METADATA] Using fallback filename extraction for: ${fileName}`);
    
    const title = this.extractTitleFromFilename(fileName);
    
    // Try to parse artist and title from common patterns
    let artist: string | null = null;
    let cleanTitle = title;
    
    // Pattern: "Artist - Title"
    const artistTitleMatch = title.match(/^(.+?)\s*-\s*(.+)$/);
    if (artistTitleMatch && artistTitleMatch[1] && artistTitleMatch[2]) {
      artist = this.cleanString(artistTitleMatch[1]);
      const parsedTitle = this.cleanString(artistTitleMatch[2]);
      if (parsedTitle) {
        cleanTitle = parsedTitle;
      }
    }
    
    // Pattern: "01. Title" or "01 Title" (remove track numbers)
    cleanTitle = cleanTitle.replace(/^\d+\.?\s*/, '');
    
    return {
      title: cleanTitle,
      artist,
      album: null,
      year: null,
      genre: null,
      trackNumber: null,
      duration: 0, // Will need to be calculated elsewhere if needed
      bitrate: null,
      sampleRate: null,
      channels: null
    };
  }

  /**
   * Extract title from filename by removing extension and cleaning
   */
  private static extractTitleFromFilename(fileName: string): string {
    return fileName
      .replace(/\.[^/.]+$/, '') // Remove extension
      .replace(/^\d+-/, '') // Remove leading numbers like "01-"
      .replace(/[_]/g, ' ') // Replace underscores with spaces
      .trim();
  }

  /**
   * Clean and normalize strings
   */
  private static cleanString(str: string | undefined): string | null {
    if (!str) return null;
    
    return str
      .trim()
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
      || null;
  }

  /**
   * Validate audio file format
   */
  static isValidAudioFile(fileName: string): boolean {
    const validExtensions = ['.mp3', '.wav', '.flac', '.m4a', '.aac', '.ogg', '.wma'];
    const extension = path.extname(fileName).toLowerCase();
    return validExtensions.includes(extension);
  }

  /**
   * Get file format from filename
   */
  static getFileFormat(fileName: string): string | null {
    const extension = path.extname(fileName).toLowerCase();
    const formatMap: Record<string, string> = {
      '.mp3': 'MP3',
      '.wav': 'WAV',
      '.flac': 'FLAC',
      '.m4a': 'M4A',
      '.aac': 'AAC',
      '.ogg': 'OGG',
      '.wma': 'WMA'
    };
    
    return formatMap[extension] || null;
  }
} 