import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

export interface AudioMetadata {
  format: string;
  duration: number;
  bitrate: number;
  sampleRate: number;
  channels: number;
  title?: string;
  artist?: string;
  album?: string;
  year?: number;
  genre?: string;
  trackNumber?: number;
  albumArt?: {
    path: string;
    format: string;
    size: number;
  };
}

export class MetadataService {
  private static readonly ALBUM_ART_DIR = path.join(process.cwd(), 'uploads', 'album-art');

  /**
   * Ensure album art directory exists
   */
  private static async ensureAlbumArtDir(): Promise<void> {
    if (!fs.existsSync(this.ALBUM_ART_DIR)) {
      fs.mkdirSync(this.ALBUM_ART_DIR, { recursive: true });
    }
  }

  /**
   * Extract metadata from an audio file
   */
  public static async extractFromFile(filePath: string): Promise<AudioMetadata> {
    return new Promise((resolve, reject) => {
      const ffprobe = spawn('ffprobe', [
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_format',
        '-show_streams',
        filePath
      ]);

      let output = '';

      ffprobe.stdout.on('data', (data) => {
        output += data;
      });

      ffprobe.stderr.on('data', (data) => {
        console.error('ffprobe stderr:', data.toString());
      });

      ffprobe.on('close', async (code) => {
        if (code !== 0) {
          reject(new Error(`ffprobe process exited with code ${code}`));
          return;
        }

        try {
          const data = JSON.parse(output);
          const audioStream = data.streams.find((s: any) => s.codec_type === 'audio');
          const tags = data.format.tags || {};

          if (!audioStream) {
            reject(new Error('No audio stream found'));
            return;
          }

          // Check for embedded album art
          const videoStream = data.streams.find((s: any) => 
            s.codec_type === 'video' && s.disposition?.attached_pic === 1
          );

          let albumArt;
          if (videoStream) {
            try {
              albumArt = await this.extractAlbumArt(filePath, tags.artist, tags.album);
    } catch (error) {
              console.warn('Failed to extract album art:', error);
              // Continue without album art
            }
          }

          resolve({
            format: data.format.format_name,
            duration: parseFloat(data.format.duration),
            bitrate: parseInt(data.format.bit_rate),
            sampleRate: parseInt(audioStream.sample_rate),
            channels: audioStream.channels,
            title: tags.title,
            artist: tags.artist,
            album: tags.album,
            year: tags.date ? parseInt(tags.date) : undefined,
            genre: tags.genre,
            trackNumber: tags.track ? parseInt(tags.track) : undefined,
            albumArt
          });
        } catch (error) {
          reject(error);
        }
      });

      ffprobe.on('error', (err) => {
        reject(err);
      });
    });
  }

  /**
   * Extract album art from audio file
   */
  private static async extractAlbumArt(
    filePath: string, 
    artist?: string, 
    album?: string
  ): Promise<{ path: string; format: string; size: number }> {
    await this.ensureAlbumArtDir();

    // Generate filename for album art
    const fileName = this.generateAlbumArtFileName(artist, album, filePath);
    const outputPath = path.join(this.ALBUM_ART_DIR, fileName);

    // Skip if album art already exists
    if (fs.existsSync(outputPath)) {
      const stats = fs.statSync(outputPath);
      return {
        path: `/uploads/album-art/${fileName}`,
        format: path.extname(fileName).slice(1),
        size: stats.size
      };
    }

    return new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-i', filePath,
        '-an', // no audio
        '-vcodec', 'copy',
        '-f', 'image2',
        '-y', // overwrite
        outputPath
      ]);

      ffmpeg.stderr.on('data', (data) => {
        // FFmpeg outputs progress info to stderr, which is normal
        const output = data.toString();
        if (output.includes('Error') || output.includes('error')) {
          console.error('ffmpeg stderr:', output);
        }
      });

      ffmpeg.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`ffmpeg process exited with code ${code}`));
          return;
        }

        // Verify the file was created
        if (!fs.existsSync(outputPath)) {
          reject(new Error('Album art file was not created'));
          return;
        }

        const stats = fs.statSync(outputPath);
        resolve({
          path: `/uploads/album-art/${fileName}`,
          format: path.extname(fileName).slice(1),
          size: stats.size
        });
      });

      ffmpeg.on('error', (err) => {
        reject(err);
      });
    });
  }

  /**
   * Generate filename for album art
   */
  private static generateAlbumArtFileName(artist?: string, album?: string, filePath?: string): string {
    let baseName = '';
    
    if (artist && album) {
      // Use artist-album as base name
      baseName = `${this.sanitizeFileName(artist)}-${this.sanitizeFileName(album)}`;
    } else if (filePath) {
      // Use original file name as fallback
      baseName = path.parse(filePath).name;
    } else {
      // Generate unique name
      baseName = `unknown-${Date.now()}`;
    }

    return `${baseName}.jpg`;
  }

  /**
   * Sanitize filename for cross-platform compatibility
   */
  private static sanitizeFileName(name: string): string {
    return name
      .replace(/[<>:"/\\|?*]/g, '') // Remove invalid characters
      .replace(/\s+/g, '_') // Replace spaces with underscores
      .substring(0, 50); // Limit length
  }

  /**
   * Get album art path for a track or album
   */
  public static getAlbumArtPath(artist?: string, album?: string): string | null {
    if (!artist || !album) return null;
    
    const fileName = this.generateAlbumArtFileName(artist, album);
    const fullPath = path.join(this.ALBUM_ART_DIR, fileName);
    
    return fs.existsSync(fullPath) ? `/uploads/album-art/${fileName}` : null;
  }
} 