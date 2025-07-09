import path from 'path';
import fs from 'fs/promises';
import { Stats } from 'fs';
import { MetadataService } from './metadataService';

export class FileManagementService {
  private readonly uploadsDir: string;

  constructor() {
    this.uploadsDir = path.join(process.cwd(), 'uploads');
  }

  /**
   * Get absolute path for a file in the uploads directory
   */
  public getAbsolutePath(relativePath: string): string {
    return path.join(this.uploadsDir, relativePath);
  }

  /**
   * Get relative path for a file from the uploads directory
   */
  public getRelativePath(absolutePath: string): string {
    return path.relative(this.uploadsDir, absolutePath);
  }

  /**
   * Check if a file exists
   */
  public async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Delete a file
   */
  public async deleteFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
    } catch (error) {
      console.error(`Error deleting file ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Move a file to a new location
   */
  public async moveFile(sourcePath: string, destPath: string): Promise<void> {
    try {
      // Create destination directory if it doesn't exist
      await fs.mkdir(path.dirname(destPath), { recursive: true });
      await fs.rename(sourcePath, destPath);
    } catch (error) {
      console.error(`Error moving file from ${sourcePath} to ${destPath}:`, error);
      throw error;
    }
  }

  /**
   * Copy a file to a new location
   */
  public async copyFile(sourcePath: string, destPath: string): Promise<void> {
    try {
      // Create destination directory if it doesn't exist
      await fs.mkdir(path.dirname(destPath), { recursive: true });
      await fs.copyFile(sourcePath, destPath);
    } catch (error) {
      console.error(`Error copying file from ${sourcePath} to ${destPath}:`, error);
      throw error;
    }
  }

  /**
   * Get all audio files in a directory
   */
  public async getAudioFiles(dirPath: string): Promise<string[]> {
    try {
      const files = await fs.readdir(dirPath);
      const audioFiles = files.filter(file => {
        const ext = path.extname(file).toLowerCase();
        return ['.mp3', '.wav', '.flac', '.m4a', '.aac', '.ogg'].includes(ext);
      });
      return audioFiles.map(file => path.join(dirPath, file));
    } catch (error) {
      console.error(`Error getting audio files from ${dirPath}:`, error);
      throw error;
    }
  }

  /**
   * Create a directory
   */
  public async createDirectory(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      console.error(`Error creating directory ${dirPath}:`, error);
      throw error;
    }
  }

  /**
   * Delete a directory and its contents
   */
  public async deleteDirectory(dirPath: string): Promise<void> {
    try {
      await fs.rm(dirPath, { recursive: true, force: true });
    } catch (error) {
      console.error(`Error deleting directory ${dirPath}:`, error);
      throw error;
    }
  }

  /**
   * Get file stats
   */
  public async getFileStats(filePath: string): Promise<Stats> {
    try {
      return await fs.stat(filePath);
    } catch (error) {
      console.error(`Error getting stats for ${filePath}:`, error);
      throw error;
    }
  }
} 