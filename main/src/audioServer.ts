import express from 'express';
import path from 'path';
import fs from 'fs';
import { config } from './config';

  const app = express();
const PORT = config.audioServerPort;

// Add CORS headers for frontend requests
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:3001');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // Handle preflight requests
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
      return 'audio/mpeg'; // fallback
  }
}

// Serve audio files from main/uploads at /audio/:filename
// @ts-ignore - express 5 type definitions issue with handler overload
app.get('/audio/:filename', (req, res) => {
    try {
      const fileName = req.params.filename;
    
    // Serve files from uploads directory only
    const uploadsDir = path.join(process.cwd(), 'uploads');
    const filePath = path.join(uploadsDir, fileName);

    console.log('[AUDIO DEBUG] File paths:', {
      cwd: process.cwd(),
      uploadsDir,
      filePath,
        fileName,
      exists: fs.existsSync(filePath)
      });

      if (!fs.existsSync(filePath)) {
        console.log('[AUDIO DEBUG] File not found:', filePath);
        return res.status(404).send('File not found');
      }

    // Set appropriate content type based on file extension
    const contentType = getContentType(fileName);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Accept-Ranges', 'bytes');
    
    const stream = fs.createReadStream(filePath);
    console.log('[AUDIO DEBUG] Streaming file:', filePath, 'with content type:', contentType);

      stream.on('error', (err) => {
        console.error('[AUDIO DEBUG] Stream error:', err);
        if (!res.headersSent) {
          res.status(500).send('Internal Server Error');
        } else {
          res.end();
        }
      });

      stream.on('close', () => {
        console.log('[AUDIO DEBUG] Stream closed:', filePath);
      });

      stream.pipe(res);
    } catch (err) {
      console.error('[AUDIO DEBUG] Unexpected error:', err);
      if (!res.headersSent) {
        res.status(500).send('Internal Server Error');
      } else {
        res.end();
      }
    }
  });

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

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