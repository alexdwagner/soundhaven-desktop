import { spawn } from 'child_process';
import { createReadStream, createWriteStream, existsSync } from 'fs';
import path from 'path';
import { PassThrough, Transform } from 'stream';
import { promisify } from 'util';
import { pipeline } from 'stream/promises';

interface PreprocessedData {
  waveformData: number[];
  chunks: string[];
}

export class PreprocessService {
  private readonly chunkSize = 1024 * 1024; // 1MB chunks
  private readonly uploadsDir: string;

  constructor() {
    this.uploadsDir = path.join(process.cwd(), 'uploads');
  }

  /**
   * Preprocess an audio file by generating waveform data and splitting into chunks
   */
  public async preprocessAudio(filePath: string): Promise<PreprocessedData> {
    try {
      // Ensure file path is absolute and exists
      const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(this.uploadsDir, filePath);
      
      if (!existsSync(absolutePath)) {
        throw new Error(`Audio file not found: ${absolutePath}`);
      }

      console.log(`Preprocessing audio file: ${absolutePath}`);

      // Generate waveform data
      const waveformData = await this.generateWaveform(absolutePath);

      // Split into chunks
      const chunks = await this.splitIntoChunks(absolutePath);

      return {
        waveformData,
        chunks
      };
    } catch (error) {
      console.error('Error preprocessing audio:', error);
      throw error;
    }
  }

  /**
   * Generate waveform data using ffmpeg
   */
  private async generateWaveform(filePath: string): Promise<number[]> {
    return new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-i', filePath,
        '-ac', '1', // Convert to mono
        '-ar', '8000', // Lower sample rate for faster processing
        '-f', 'f32le', // Output as 32-bit float little-endian
        '-'
      ]);

      let waveformData: number[] = [];
      let dataBuffer = Buffer.alloc(0);

      ffmpeg.stdout.on('data', (chunk: Buffer) => {
        dataBuffer = Buffer.concat([dataBuffer, chunk]);
      });

      ffmpeg.stderr.on('data', (data: Buffer) => {
        // Only log actual errors, not info messages
        const message = data.toString();
        if (message.includes('Error') || message.includes('error')) {
          console.log('ffmpeg stderr:', message);
        }
      });

      ffmpeg.on('close', (code: number) => {
        if (code !== 0) {
          reject(new Error(`ffmpeg process exited with code ${code}`));
          return;
        }

        try {
          // Convert buffer to float32 array
          const samples = new Float32Array(dataBuffer.buffer, dataBuffer.byteOffset, dataBuffer.byteLength / 4);
          
          // Downsample for waveform visualization (take every 100th sample)
          const downsampledData: number[] = [];
          const step = Math.max(1, Math.floor(samples.length / 1000)); // Target ~1000 points
          
          for (let i = 0; i < samples.length; i += step) {
            downsampledData.push(samples[i]);
          }
          
          waveformData = downsampledData;
          console.log(`✅ Generated waveform with ${waveformData.length} data points`);
          resolve(waveformData);
        } catch (error) {
          reject(new Error(`Error processing waveform data: ${error}`));
        }
      });

      ffmpeg.on('error', (err: Error) => {
        reject(err);
      });
    });
  }

  /**
   * Split audio file into chunks
   */
  private async splitIntoChunks(filePath: string): Promise<string[]> {
    const chunks: string[] = [];
    const fileName = path.basename(filePath);
    const chunkDir = path.join(this.uploadsDir, 'chunks', path.parse(fileName).name);

    // Create chunk directory if it doesn't exist
    const fs = require('fs');
    if (!fs.existsSync(chunkDir)) {
      fs.mkdirSync(chunkDir, { recursive: true });
    }

    // For now, return the original file as a single "chunk" 
    // This is simpler and still allows the system to work
    // We can implement proper chunking later if needed
    const relativePath = path.relative(this.uploadsDir, filePath);
    chunks.push(relativePath);
    
    console.log(`✅ Created chunk reference for: ${fileName}`);
    return chunks;
  }
} 