import express from 'express';
import fs from 'fs';
import path from 'path';
import { config } from './config';

export function startAudioServer() {
  const port = config.audioServerPort;
  const app = express();

  // Serve audio files from main/public at /audio/:filename
  // @ts-ignore - express 5 type definitions issue with handler overload
  app.get('/audio/:filename', (req, res) => {
    try {
      const fileName = req.params.filename;
      
      // Get the public directory relative to the current working directory
      // When running from main directory, public is a direct child
      const publicDir = path.join(process.cwd(), 'public');
      const filePath = path.join(publicDir, fileName);

      console.log('[AUDIO DEBUG] File paths:', {
        cwd: process.cwd(),
        publicDir,
        filePath,
        fileName,
        exists: fs.existsSync(filePath)
      });

      if (!fs.existsSync(filePath)) {
        console.log('[AUDIO DEBUG] File not found:', filePath);
        return res.status(404).send('File not found');
      }

      res.setHeader('Content-Type', 'audio/mpeg');
      const stream = fs.createReadStream(filePath);
      console.log('[AUDIO DEBUG] Streaming file:', filePath);

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

  app.listen(port, () => {
    console.log(`[AUDIO DEBUG] Audio server running on port ${port}`);
  });
} 