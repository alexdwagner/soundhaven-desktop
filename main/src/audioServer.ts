import express, { Request, Response, RequestHandler } from 'express';
import path from 'path';
import fs from 'fs';
import { config } from './config';
import { promisify } from 'util';
import { stat } from 'fs/promises';
import crypto from 'crypto';

const app = express();
const PORT = config.audioServerPort;

// Add CORS headers for frontend requests
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:3001');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Range');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Helper function to get content type based on file extension
function getContentType(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  switch (ext) {
    case '.mp3':
      return 'audio/mpeg';
    case '.wav':
      return 'audio/wav';
    case '.flac':
      return 'audio/flac';
    case '.m4a':
      return 'audio/mp4';
    case '.aac':
      return 'audio/aac';
    case '.ogg':
      return 'audio/ogg';
    default:
      return 'audio/mpeg';
  }
}

interface AudioRequestParams {
  filename: string;
}

// Cache configuration
const CACHE_DIR = path.join(process.cwd(), 'cache');
const CHUNK_SIZE = 1024 * 1024; // 1MB chunks
const MAX_CACHE_SIZE = 1024 * 1024 * 1024; // 1GB cache
const CACHE_CLEANUP_INTERVAL = 1000 * 60 * 60; // 1 hour

// Cache management
interface CacheEntry {
  filePath: string;
  lastAccessed: number;
  size: number;
}

let currentCacheSize = 0;
const cacheEntries = new Map<string, CacheEntry>();

// Create cache directory if it doesn't exist
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// Cache cleanup function
const cleanupCache = () => {
  console.log('[CACHE] Starting cache cleanup');
  if (currentCacheSize <= MAX_CACHE_SIZE) return;

  const entries = Array.from(cacheEntries.entries())
    .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);

  for (const [key, entry] of entries) {
    if (currentCacheSize <= MAX_CACHE_SIZE * 0.8) break; // Clean until we're at 80%

    try {
      fs.unlinkSync(entry.filePath);
      currentCacheSize -= entry.size;
      cacheEntries.delete(key);
      console.log(`[CACHE] Removed ${key} from cache`);
    } catch (err) {
      console.error(`[CACHE] Error removing ${key} from cache:`, err);
    }
  }
};

// Start periodic cache cleanup
setInterval(cleanupCache, CACHE_CLEANUP_INTERVAL);

// Helper function to get cache key
const getCacheKey = (filePath: string, start: number, end: number): string => {
  const hash = crypto.createHash('md5')
    .update(`${filePath}-${start}-${end}`)
    .digest('hex');
  return hash;
};

// Helper function to get cached chunk path
const getCachedChunkPath = (cacheKey: string): string => {
  return path.join(CACHE_DIR, `${cacheKey}.chunk`);
};

// Enhanced audio streaming with caching
const streamAudioHandler: RequestHandler<AudioRequestParams> = async (req, res) => {
  try {
    const fileName = req.params.filename;
    const uploadsDir = path.join(process.cwd(), 'uploads');
    const filePath = path.join(uploadsDir, fileName);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.log('[AUDIO DEBUG] File not found:', filePath);
      res.status(404).send('File not found');
      return;
    }

    // Get file stats
    const stats = await stat(filePath);
    const fileSize = stats.size;
    const contentType = getContentType(fileName);

    // Parse Range header
    const range = req.headers.range;
    
    if (range) {
      // Handle range request
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;
      
      // Validate range
      if (start >= fileSize || end >= fileSize) {
        res.status(416).send('Requested range not satisfiable');
        return;
      }

      // Check cache
      const cacheKey = getCacheKey(filePath, start, end);
      const cachedChunkPath = getCachedChunkPath(cacheKey);

      // Set headers for range response
      res.status(206);
      res.header({
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
      });

      if (fs.existsSync(cachedChunkPath)) {
        // Serve from cache
        console.log(`[CACHE] Serving chunk ${cacheKey} from cache`);
        const cacheEntry = cacheEntries.get(cacheKey);
        if (cacheEntry) {
          cacheEntry.lastAccessed = Date.now();
        }
        const cacheStream = fs.createReadStream(cachedChunkPath);
        cacheStream.pipe(res);
      } else {
        // Cache miss - create new cached chunk
        console.log(`[CACHE] Cache miss for chunk ${cacheKey}`);
        const writeStream = fs.createWriteStream(cachedChunkPath);
        const readStream = fs.createReadStream(filePath, { start, end });

        // Pipe to both cache and response
        readStream.pipe(writeStream);
        readStream.pipe(res);

        // Update cache metadata
        readStream.on('end', () => {
          const chunkStats = fs.statSync(cachedChunkPath);
          currentCacheSize += chunkStats.size;
          cacheEntries.set(cacheKey, {
            filePath: cachedChunkPath,
            lastAccessed: Date.now(),
            size: chunkStats.size
          });

          // Trigger cleanup if needed
          if (currentCacheSize > MAX_CACHE_SIZE) {
            cleanupCache();
          }
        });
      }
    } else {
      // Handle full file request
      res.header({
        'Content-Length': fileSize,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=3600',
      });

      // Stream full file
      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
    }
  } catch (err) {
    console.error('[AUDIO DEBUG] Streaming error:', err);
    res.status(500).send('Internal Server Error');
  }
};

// Preload endpoint for next track
const preloadAudioHandler: RequestHandler<AudioRequestParams> = async (req, res) => {
  try {
    const fileName = req.params.filename;
    const uploadsDir = path.join(process.cwd(), 'uploads');
    const filePath = path.join(uploadsDir, fileName);

    if (!fs.existsSync(filePath)) {
      res.status(404).send();
      return;
    }

    const stats = await stat(filePath);
    const contentType = getContentType(fileName);

    res.header({
      'Content-Length': stats.size,
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=3600',
    });

    res.status(200).send();
  } catch (err) {
    console.error('[AUDIO DEBUG] Preload check error:', err);
    res.status(500).send();
  }
};

// Health check endpoint
const healthCheckHandler: RequestHandler = (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
};

// Register routes
app.get('/audio/:filename', streamAudioHandler);
app.head('/audio/:filename', preloadAudioHandler);
app.get('/health', healthCheckHandler);

export function startAudioServer() {
  app.listen(PORT, () => {
    console.log('🎵 Audio server started');
    console.log(`[AUDIO DEBUG] Audio server running on port ${PORT}`);
  });
}

export function stopAudioServer() {
  // This would need to be implemented with the actual server instance
  console.log('🎵 Audio server stopped');
} 