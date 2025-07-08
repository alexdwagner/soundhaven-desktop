import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { MetadataService } from './metadataService';
import sanitize from 'sanitize-filename';

const mkdir = promisify(fs.mkdir);
const rename = promisify(fs.rename);
const access = promisify(fs.access);

export interface FileOrganizationResult {
  success: boolean;
  oldPath: string;
  newPath: string;
  error?: string;
}

export class FileManagementService {
  private static readonly MUSIC_DIR = path.join(process.cwd(), 'Music');
  private static readonly UNORGANIZED_DIR = path.join(process.cwd(), 'uploads');

  /**
   * Initialize the music directory structure
   */
  static async initialize(): Promise<void> {
    try {
      // Create main music directory if it doesn't exist
      await mkdir(this.MUSIC_DIR, { recursive: true });
      
      // Create unorganized directory if it doesn't exist
      await mkdir(this.UNORGANIZED_DIR, { recursive: true });
      
      console.log('✅ File management system initialized');
    } catch (error) {
      console.error('❌ Error initializing file management system:', error);
      throw error;
    }
  }

  /**
   * Organize a single file by its metadata
   */
  static async organizeFile(filePath: string): Promise<FileOrganizationResult> {
    try {
      // Extract metadata
      const metadata = await MetadataService.extractFromFile(filePath);
      
      // Get artist and album names
      const artistName = metadata.artist || 'Unknown Artist';
      const albumName = metadata.album || 'Unknown Album';
      
      // Create sanitized directory names
      const safeArtistName = sanitize(artistName);
      const safeAlbumName = sanitize(albumName);
      
      // Create directory structure
      const artistDir = path.join(this.MUSIC_DIR, safeArtistName);
      const albumDir = path.join(artistDir, safeAlbumName);
      
      // Create directories if they don't exist
      await mkdir(artistDir, { recursive: true });
      await mkdir(albumDir, { recursive: true });
      
      // Generate new file name with track number if available
      const fileName = path.basename(filePath);
      const trackNum = metadata.trackNumber ? 
        String(metadata.trackNumber).padStart(2, '0') + ' - ' : 
        '';
      const newFileName = trackNum + fileName;
      
      // Generate new file path
      const newFilePath = path.join(albumDir, newFileName);
      
      // Move the file
      await rename(filePath, newFilePath);
      
      console.log('✅ File organized successfully:', {
        from: filePath,
        to: newFilePath
      });
      
      return {
        success: true,
        oldPath: filePath,
        newPath: newFilePath
      };
    } catch (error) {
      console.error('❌ Error organizing file:', error);
      return {
        success: false,
        oldPath: filePath,
        newPath: '',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Organize all files in the unorganized directory
   */
  static async organizeAllFiles(): Promise<FileOrganizationResult[]> {
    try {
      const files = await fs.promises.readdir(this.UNORGANIZED_DIR);
      const results: FileOrganizationResult[] = [];
      
      for (const file of files) {
        // Skip non-audio files
        if (!MetadataService.isValidAudioFile(file)) continue;
        
        const filePath = path.join(this.UNORGANIZED_DIR, file);
        const result = await this.organizeFile(filePath);
        results.push(result);
      }
      
      return results;
    } catch (error) {
      console.error('❌ Error organizing files:', error);
      throw error;
    }
  }

  /**
   * Move a file to the unorganized directory
   */
  static async moveToUnorganized(filePath: string): Promise<string> {
    try {
      const fileName = path.basename(filePath);
      const newPath = path.join(this.UNORGANIZED_DIR, fileName);
      
      await rename(filePath, newPath);
      return newPath;
    } catch (error) {
      console.error('❌ Error moving file to unorganized:', error);
      throw error;
    }
  }

  /**
   * Check if a file exists in the organized structure
   */
  static async fileExists(artistName: string, albumName: string, fileName: string): Promise<boolean> {
    try {
      const filePath = path.join(
        this.MUSIC_DIR,
        sanitize(artistName),
        sanitize(albumName),
        fileName
      );
      
      await access(filePath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the full path for a file in the organized structure
   */
  static getOrganizedPath(artistName: string, albumName: string, fileName: string): string {
    return path.join(
      this.MUSIC_DIR,
      sanitize(artistName),
      sanitize(albumName),
      fileName
    );
  }

  /**
   * Get all artists in the music directory
   */
  static async getArtists(): Promise<string[]> {
    try {
      const artists = await fs.promises.readdir(this.MUSIC_DIR);
      return artists.filter(artist => 
        fs.statSync(path.join(this.MUSIC_DIR, artist)).isDirectory()
      );
    } catch (error) {
      console.error('❌ Error getting artists:', error);
      throw error;
    }
  }

  /**
   * Get all albums for an artist
   */
  static async getAlbums(artistName: string): Promise<string[]> {
    try {
      const artistDir = path.join(this.MUSIC_DIR, sanitize(artistName));
      const albums = await fs.promises.readdir(artistDir);
      return albums.filter(album => 
        fs.statSync(path.join(artistDir, album)).isDirectory()
      );
    } catch (error) {
      console.error('❌ Error getting albums:', error);
      throw error;
    }
  }

  /**
   * Get all tracks in an album
   */
  static async getTracks(artistName: string, albumName: string): Promise<string[]> {
    try {
      const albumDir = path.join(
        this.MUSIC_DIR,
        sanitize(artistName),
        sanitize(albumName)
      );
      
      const tracks = await fs.promises.readdir(albumDir);
      return tracks.filter(track => MetadataService.isValidAudioFile(track));
    } catch (error) {
      console.error('❌ Error getting tracks:', error);
      throw error;
    }
  }
} 