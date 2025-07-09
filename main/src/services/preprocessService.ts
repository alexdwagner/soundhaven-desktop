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
        '-filter_complex', 'aformat=channel_layouts=mono,showwavespic=s=1000x200:colors=white',
        '-frames:v', '1',
        '-f', 'data',
        'pipe:1'
      ]);

      let waveformData: number[] = [];
      let dataBuffer = Buffer.alloc(0);

      ffmpeg.stdout.on('data', (chunk: Buffer) => {
        dataBuffer = Buffer.concat([dataBuffer, chunk]);
      });

      ffmpeg.stderr.on('data', (data: Buffer) => {
        console.log('ffmpeg stderr:', data.toString());
      });

      ffmpeg.on('close', (code: number) => {
        if (code !== 0) {
          reject(new Error(`ffmpeg process exited with code ${code}`));
          return;
        }

        // Process the raw waveform data
        const samples = new Float32Array(dataBuffer.buffer);
        waveformData = Array.from(samples);
        resolve(waveformData);
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

    // Create a read stream
    const readStream = createReadStream(filePath);
    let chunkIndex = 0;
    let currentChunkSize = 0;
    let currentChunk = createWriteStream(path.join(chunkDir, `chunk_${chunkIndex}.mp3`));

    // Create transform stream to handle chunking
    const chunkSize = this.chunkSize; // Capture chunkSize in closure
    const chunker = new Transform({
      transform(chunk: Buffer, encoding: string, callback: Function) {
        if (currentChunkSize + chunk.length > chunkSize) {
          // Calculate how much of the chunk fits in current file
          const remainingSpace = chunkSize - currentChunkSize;
          const firstPart = chunk.slice(0, remainingSpace);
          const secondPart = chunk.slice(remainingSpace);

          // Write the first part to current chunk
          currentChunk.write(firstPart);
          currentChunk.end();

          // Start new chunk with remaining data
          chunkIndex++;
          currentChunkSize = secondPart.length;
          currentChunk = createWriteStream(path.join(chunkDir, `chunk_${chunkIndex}.mp3`));
          currentChunk.write(secondPart);

          chunks.push(`chunks/${path.parse(fileName).name}/chunk_${chunkIndex}.mp3`);
        } else {
          currentChunkSize += chunk.length;
          currentChunk.write(chunk);
        }

        callback();
      }
    });

    // Pipe the streams
    return new Promise((resolve, reject) => {
      pipeline(readStream, chunker, new PassThrough())
        .then(() => {
          currentChunk.end();
          resolve(chunks);
        })
        .catch(reject);
    });
  }
} 