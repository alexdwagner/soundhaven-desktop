import { createServer, Server } from 'http';
import { PreprocessService } from './services/preprocessService';
import { PerformanceMonitor } from './services/performanceMonitor';
import path from 'path';
import { createReadStream } from 'fs';

interface StreamRequest {
  filePath: string;
  start?: number;
  end?: number;
}

export class AudioServer {
  private server: Server;
  private preprocessService: PreprocessService;
  private performanceMonitor: PerformanceMonitor;
  private readonly chunkSize = 1024 * 1024; // 1MB chunks

  constructor() {
    this.preprocessService = new PreprocessService();
    this.performanceMonitor = new PerformanceMonitor();
    this.server = createServer(this.handleRequest.bind(this));
  }

  /**
   * Start the audio streaming server
   */
  public start(port: number): void {
    this.server.listen(port, () => {
      console.log(`Audio streaming server running on port ${port}`);
    });
  }

  /**
   * Handle incoming streaming requests
   */
  private async handleRequest(req: any, res: any): Promise<void> {
    try {
      // Handle CORS preflight requests
      if (req.method === 'OPTIONS') {
        res.writeHead(200, {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Range',
          'Access-Control-Max-Age': '86400',
        });
        res.end();
        return;
      }

      // Parse request
      const request = this.parseRequest(req);
      if (!request) {
        res.writeHead(400, {
          'Access-Control-Allow-Origin': '*',
        });
        res.end('Invalid request');
        return;
      }

      // Check if file exists
      if (!require('fs').existsSync(request.filePath)) {
        console.error(`Audio file not found: ${request.filePath}`);
        res.writeHead(404, {
          'Access-Control-Allow-Origin': '*',
        });
        res.end('Audio file not found');
        return;
      }

      // Get file stats for range requests
      const fs = require('fs');
      const stat = fs.statSync(request.filePath);
      const fileSize = stat.size;
      
      // Handle range requests
      const range = req.headers.range;
      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = (end - start) + 1;
        
        const file = fs.createReadStream(request.filePath, { start, end });
        
        // Read a small portion to determine content type
        const sampleBuffer = Buffer.alloc(Math.min(fileSize, 100));
        const fd = fs.openSync(request.filePath, 'r');
        fs.readSync(fd, sampleBuffer, 0, sampleBuffer.length, 0);
        fs.closeSync(fd);
        const contentType = this.getContentType(request.filePath, sampleBuffer);
        
        console.log(`[AUDIO SERVER] Range request - Content type: ${contentType}`);
        
        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize,
          'Content-Type': contentType,
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Range',
        });
        
        file.pipe(res);
      } else {
        // Serve entire file
        const filePath = request.filePath;
        // Serve the file with proper headers
        const fileBuffer = fs.readFileSync(filePath);
        const contentType = this.getContentType(filePath, fileBuffer);
        
        console.log(`[AUDIO SERVER] Serving file: ${filePath}`);
        console.log(`[AUDIO SERVER] Content type: ${contentType}`);
        console.log(`[AUDIO SERVER] File size: ${fileBuffer.length} bytes`);

        res.writeHead(200, {
          'Content-Type': contentType,
          'Content-Length': fileBuffer.length,
          'Accept-Ranges': 'bytes',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Range',
        });

        res.end(fileBuffer);
      }

    } catch (error) {
      console.error('Error handling stream request:', error);
      res.writeHead(500, {
        'Access-Control-Allow-Origin': '*',
      });
      res.end('Internal server error');
    }
  }

  /**
   * Parse streaming request parameters
   */
  private parseRequest(req: any): StreamRequest | null {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      let filePath = decodeURIComponent(url.pathname.slice(1));
      const range = req.headers.range;

      console.log(`[AUDIO SERVER] Raw request URL: ${req.url}`);
      console.log(`[AUDIO SERVER] Parsed pathname: ${url.pathname}`);
      console.log(`[AUDIO SERVER] Decoded filePath: ${filePath}`);

      if (!filePath) {
        console.log(`[AUDIO SERVER] No filePath found`);
        return null;
      }

      // Handle different path formats
      if (filePath.startsWith('audio/')) {
        // Remove the 'audio/' prefix and construct full path
        const fileName = filePath.substring(6); // Remove 'audio/'
        filePath = path.join(process.cwd(), 'uploads', fileName);
        console.log(`[AUDIO SERVER] Converted audio/ path to: ${filePath}`);
      } else if (filePath.startsWith('uploads/')) {
        // Already has uploads prefix, just make it absolute from process.cwd()
        filePath = path.join(process.cwd(), filePath);
        console.log(`[AUDIO SERVER] Converted uploads/ path to: ${filePath}`);
      } else if (!path.isAbsolute(filePath)) {
        // For relative paths that don't start with uploads/, add uploads prefix
        filePath = path.join(process.cwd(), 'uploads', filePath);
        console.log(`[AUDIO SERVER] Converted relative path to: ${filePath}`);
      }

      console.log(`[AUDIO SERVER] Final filePath: ${filePath}`);
      console.log(`[AUDIO SERVER] File exists: ${require('fs').existsSync(filePath)}`);

      const request: StreamRequest = { filePath };

      if (range) {
        const [start, end] = range.replace('bytes=', '').split('-');
        request.start = parseInt(start);
        request.end = end ? parseInt(end) : undefined;
        console.log(`[AUDIO SERVER] Range request: ${request.start}-${request.end}`);
      }

      return request;
    } catch (error) {
      console.error('[AUDIO SERVER] Error parsing request:', error);
      return null;
    }
  }

  /**
   * Stream audio data for the requested range
   */
  private async streamAudioRange(
    request: StreamRequest,
    chunks: string[],
    res: any
  ): Promise<void> {
    try {
      // Find relevant chunks
      const relevantChunks = chunks.filter((chunk: string) => {
        const chunkIndex = parseInt(chunk.match(/chunk_(\d+)\.mp3/)?.[1] || '0');
        const chunkStart = chunkIndex * this.chunkSize;
        const chunkEnd = chunkStart + this.chunkSize;
        return (!request.start || chunkEnd > request.start) &&
               (!request.end || chunkStart < request.end);
      });

      // Stream each chunk
      for (const chunk of relevantChunks) {
        const chunkPath = path.join(process.cwd(), 'uploads', chunk);
        const chunkStartTime = Date.now();

        await new Promise<void>((resolve, reject) => {
          const stream = createReadStream(chunkPath);
          
          stream.on('end', () => {
            this.performanceMonitor.trackChunkLoad(Date.now() - chunkStartTime);
            resolve();
          });
          
          stream.on('error', (error) => {
            console.error(`Error streaming chunk ${chunk}:`, error);
            reject(error);
          });

          stream.pipe(res, { end: false });
        });
      }

      res.end();
    } catch (error) {
      console.error('Error streaming audio range:', error);
      throw error;
    }
  }

  /**
   * Determine content type based on file content and extension
   */
  private getContentType(filePath: string, fileBuffer: Buffer): string {
    // Check file signature (magic bytes) first
    if (fileBuffer.length >= 4) {
      // PNG signature
      if (fileBuffer[0] === 0x89 && fileBuffer[1] === 0x50 && fileBuffer[2] === 0x4E && fileBuffer[3] === 0x47) {
        return 'image/png';
      }
      // JPEG signature
      if (fileBuffer[0] === 0xFF && fileBuffer[1] === 0xD8) {
        return 'image/jpeg';
      }
      // GIF signature
      if (fileBuffer[0] === 0x47 && fileBuffer[1] === 0x49 && fileBuffer[2] === 0x46) {
        return 'image/gif';
      }
      // WebP signature
      if (fileBuffer.length >= 12 && 
          fileBuffer[0] === 0x52 && fileBuffer[1] === 0x49 && fileBuffer[2] === 0x46 && fileBuffer[3] === 0x46 &&
          fileBuffer[8] === 0x57 && fileBuffer[9] === 0x45 && fileBuffer[10] === 0x42 && fileBuffer[11] === 0x50) {
        return 'image/webp';
      }
    }
    
    // Fall back to extension-based detection
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.png') return 'image/png';
    if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
    if (ext === '.gif') return 'image/gif';
    if (ext === '.webp') return 'image/webp';
    
    // Default for unknown image types
    return 'image/jpeg';
  }
} 