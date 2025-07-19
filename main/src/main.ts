import { app, BrowserWindow, ipcMain } from "electron";
import * as path from "path";
import { verify } from "jsonwebtoken";
import { dbAsync } from "./db";
import { 
  hashPassword, 
  verifyPassword, 
  generateJWT, 
  generateRefreshToken,
  verifyToken,
  refreshAccessToken,
  invalidateRefreshToken
} from "./utils/auth";
import { setupDatabase } from './setupDb';
import { config } from "./config";
import dotenv from 'dotenv';
import * as http from 'http';
import * as fs from 'fs';
import type { CreateCommentDto } from '@shared/dtos/create-comment.dto';
import { AudioServer } from './audioServer';
import { MetadataService } from './services/metadataService';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

let mainWindow: BrowserWindow | null = null;
let audioServer: http.Server | null = null;

// Function to start audio server
function startAudioServer() {
  const server = new AudioServer();
  server.start(config.audioServerPort);
  return server;
}

// Function to check if Next.js server is ready
async function waitForNextJS(port: number, maxAttempts: number = 30): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await new Promise<void>((resolve, reject) => {
        const req = http.get(`http://localhost:${port}`, (res) => {
          if (res.statusCode === 200 || res.statusCode === 404) {
            // Server is responding (404 is expected for root path in dev)
            resolve();
          } else {
            reject(new Error(`Server responded with status: ${res.statusCode}`));
          }
        });
        
        req.on('error', () => {
          reject(new Error('Connection failed'));
        });
        
        req.setTimeout(1000, () => {
          req.destroy();
          reject(new Error('Request timeout'));
        });
      });
      
      console.log(`✅ Next.js server is ready on port ${port}`);
      return;
    } catch (error) {
      console.log(`⏳ Waiting for Next.js server... (attempt ${attempt}/${maxAttempts})`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  throw new Error(`Next.js server did not become ready within ${maxAttempts} seconds`);
}

async function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  console.log("mainWindow started");

  const isDev = !app.isPackaged; // Check if we're in dev mode
  const frontendPort = config.frontendPort;
  
  if (isDev) {
    // Wait for Next.js to be ready
    await waitForNextJS(frontendPort);
    await mainWindow.loadURL(`http://localhost:${frontendPort}`);
  } else {
    await mainWindow.loadFile(path.join(__dirname, '../frontend/dist/index.html'));
  }
  console.log(`Window loading URL: ${isDev ? 'Dev' : 'Production'} mode, port: ${frontendPort}`);

  mainWindow.webContents.once("did-finish-load", () => {
    console.log("Main window loaded!");
    mainWindow?.webContents.reloadIgnoringCache(); // ✅ Force reload to bypass cache
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

async function ensureTestUser() {
  try {
    // Check if test user already exists
    const existingUser = await dbAsync.get(
      'SELECT * FROM users WHERE email = ?',
      ['test@example.com']
    );

    if (!existingUser) {
      // Hash the test password
      const hashedPassword = await hashPassword('testpassword');
      
      // Insert test user
      await dbAsync.run(
        'INSERT INTO users (email, password, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
        ['test@example.com', hashedPassword, 'Test User', Math.floor(Date.now() / 1000), Math.floor(Date.now() / 1000)]
      );
      
      console.log('Test user created successfully');
    } else {
      console.log('Test user already exists');
    }
  } catch (error) {
    console.error('Error ensuring test user exists:', error);
  }
}

async function ensureTestTrack() {
  try {
    // Check if test track already exists
    const existingTrack = await dbAsync.get(
      'SELECT * FROM tracks WHERE name = ?',
      ['Careless Whisper']
    );

    if (!existingTrack) {
      // Get the test user ID
      const testUser = await dbAsync.get(
        'SELECT id FROM users WHERE email = ?',
        ['test@example.com']
      );

      if (!testUser) {
        console.error('Test user not found. Cannot create test track.');
        return;
      }

      // Create a test track using the careless whisper file
      const testTrackPath = '/uploads/careless_whisper.mp3';
      
      // Check if the file exists in the uploads directory
      const uploadsDir = path.join(process.cwd(), 'uploads');
      const filePath = path.join(uploadsDir, 'careless_whisper.mp3');
      
      if (!fs.existsSync(filePath)) {
        console.error(`Test track file not found at ${filePath}`);
        return;
      }
      
      await dbAsync.run(
        'INSERT INTO tracks (id, name, duration, user_id, file_path, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [uuidv4(), 'Careless Whisper', 300, testUser.id, testTrackPath, Math.floor(Date.now() / 1000), Math.floor(Date.now() / 1000)]
      );
      
      console.log('Test track "Careless Whisper" created successfully');
      console.log('File path:', testTrackPath);
    } else {
      console.log('Test track already exists');
    }
  } catch (error) {
    console.error('Error ensuring test track exists:', error);
  }
}

async function ensureTestTags() {
  console.log('🏷️ Ensuring test tags exist...');
  
  const testTags = [
    { name: 'Rock', color: '#EF4444', type: 'manual' },
    { name: 'Upbeat', color: '#F59E0B', type: 'auto', confidence: 0.85 },
    { name: 'Guitar', color: '#8B5CF6', type: 'auto', confidence: 0.92 },
    { name: 'Energetic', color: '#10B981', type: 'auto', confidence: 0.78 },
    { name: 'Favorite', color: '#3B82F6', type: 'manual' },
    { name: 'Vocals', color: '#EC4899', type: 'auto', confidence: 0.88 },
    { name: '2000s', color: '#6B7280', type: 'system' },
    { name: 'Pop', color: '#14B8A6', type: 'manual' },
  ];

  for (const tagData of testTags) {
    try {
      // Check if tag already exists
      const existingTag = await dbAsync.get('SELECT id FROM tags WHERE name = ?', [tagData.name]);
      
      if (!existingTag) {
        const tagId = uuidv4();
        const now = Math.floor(Date.now() / 1000);
        
        await dbAsync.run(
          'INSERT INTO tags (id, name, color, type, confidence, created_at) VALUES (?, ?, ?, ?, ?, ?)',
          [tagId, tagData.name, tagData.color, tagData.type, tagData.confidence || null, now]
        );
        
        console.log(`🏷️ Created test tag: ${tagData.name} (${tagData.type})`);
      }
    } catch (error) {
      console.error(`🏷️ Error creating test tag ${tagData.name}:`, error);
    }
  }
}

async function assignSampleTagsToTestTrack() {
  console.log('🔗 Assigning sample tags to test track...');
  
  try {
    // Get the test track
    const testTrack = await dbAsync.get('SELECT id FROM tracks WHERE name = ?', ['Careless Whisper']);
    if (!testTrack) {
      console.log('🔗 No test track found, skipping tag assignment');
      return;
    }
    
    // Get some sample tags
    const sampleTags = await dbAsync.all('SELECT id FROM tags LIMIT 4');
    
    for (const tag of sampleTags) {
      try {
        // Check if association already exists
        const existing = await dbAsync.get(
          'SELECT * FROM track_tags WHERE track_id = ? AND tag_id = ?',
          [testTrack.id, tag.id]
        );
        
        if (!existing) {
          const now = Math.floor(Date.now() / 1000);
          await dbAsync.run(
            'INSERT INTO track_tags (track_id, tag_id, created_at) VALUES (?, ?, ?)',
            [testTrack.id, tag.id, now]
          );
          
          console.log(`🔗 Assigned tag ${tag.id} to test track`);
        }
      } catch (error) {
        console.error(`🔗 Error assigning tag ${tag.id} to test track:`, error);
      }
    }
  } catch (error) {
    console.error('🔗 Error assigning sample tags:', error);
  }
}

// Auth handler functions
const authHandlers = {
  async register(credentials: { name: string; email: string; password: string }) {
    const { name, email, password } = credentials;
    
    try {
      // Check if user already exists
      const existing = await dbAsync.get(
        'SELECT * FROM users WHERE email = ?',
        [email]
      );
        
      if (existing) {
        throw new Error('Email already registered');
      }
        
      // Hash password
      const hashedPassword = await hashPassword(password);
      const now = Math.floor(Date.now() / 1000);
        
      // Start transaction
      await dbAsync.run(
        'INSERT INTO users (name, email, password, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
        [name, email, hashedPassword, now, now]
      );
        
      const newUser = await dbAsync.get(
        'SELECT * FROM users WHERE email = ?',
        [email]
      );
        
      // Generate tokens
      const accessToken = generateJWT(newUser.id);
      const refreshToken = generateRefreshToken(newUser.id);
      const expiresIn = Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60); // 7 days from now
        
      // Store refresh token
      await dbAsync.run(
        'INSERT INTO refresh_tokens (token, user_id, expires_in) VALUES (?, ?, ?)',
        [refreshToken, newUser.id, expiresIn]
      );
        
      // Update user's updatedAt timestamp
      await dbAsync.run(
        'UPDATE users SET updated_at = ? WHERE id = ?',
        [Math.floor(Date.now() / 1000), newUser.id]
      );

      // Return user data (excluding password)
      const { password: pwd, ...userData } = newUser;
        
      return {
        user: userData,
        accessToken,
        refreshToken
      };
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  },
  
  async login(credentials: { email: string; password: string }) {
    const { email, password } = credentials;
    
    try {
      // Find user by email
      const user = await dbAsync.get(
        'SELECT * FROM users WHERE email = ?',
        [email]
      );
        
      if (!user) {
        throw new Error('Invalid email or password');
      }
        
      // Verify password
      const isPasswordValid = await verifyPassword(password, user.password);
      if (!isPasswordValid) {
        throw new Error('Invalid email or password');
      }
        
      // Generate tokens
      const accessToken = generateJWT(user.id);
      const refreshToken = generateRefreshToken(user.id);
      const expiresIn = Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60); // 7 days from now

      // Store refresh token in the refresh_tokens table within a transaction
      await dbAsync.run(
        'DELETE FROM refresh_tokens WHERE user_id = ?',
        [user.id]
      );
      
      await dbAsync.run(
        'INSERT INTO refresh_tokens (token, user_id, expires_in) VALUES (?, ?, ?)',
        [refreshToken, user.id, expiresIn]
      );
      
      // Update user's updatedAt timestamp
      await dbAsync.run(
        'UPDATE users SET updated_at = ? WHERE id = ?',
        [Math.floor(Date.now() / 1000), user.id]
      );

      // Return user data (excluding password)
      const { password: _, ...userData } = user;
        
      return {
        user: userData,
        accessToken,
        refreshToken
      };
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  },
  
  async refreshToken(credentials: { refreshToken: string }) {
    const { refreshToken } = credentials;
    
    try {
      // Find the refresh token in the database
      const storedToken = await dbAsync.get(
        'SELECT * FROM refresh_tokens WHERE token = ?',
        [refreshToken]
      );
      
      if (!storedToken) {
        throw new Error('Invalid refresh token');
      }
      
      // Check if token is expired
      const now = Math.floor(Date.now() / 1000);
      if (storedToken.expires_in < now) {
        // Clean up expired token
      await dbAsync.run(
        'DELETE FROM refresh_tokens WHERE token = ?',
        [refreshToken]
      );
        throw new Error('Refresh token expired');
      }
      
      // Get user data
      const user = await dbAsync.get(
        'SELECT * FROM users WHERE id = ?',
        [storedToken.user_id]
      );
      
      if (!user) {
        throw new Error('User not found');
      }
      
      // Generate new access token
      const accessToken = generateJWT(user.id);
      
      // Return user data (excluding password)
      const { password: _, ...userData } = user;
      
      return {
        user: userData,
        accessToken,
        refreshToken // Return the same refresh token
      };
    } catch (error) {
      console.error('Token refresh error:', error);
      throw error;
    }
  },
  
  async logout(credentials: { refreshToken: string }) {
    const { refreshToken } = credentials;
    
    try {
      // Delete the refresh token from the database
      await dbAsync.run(
        'DELETE FROM refresh_tokens WHERE token = ?',
        [refreshToken]
      );
      
      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  }
};

// API Request Handler - Register at module level
ipcMain.handle('api-request', async (_, { endpoint, method, body, headers }) => {
  try {
    const url = new URL(endpoint, 'http://localhost:3000');
    const normalizedPath = url.pathname;
    
    console.log('API Request:', { endpoint, method, normalizedPath });
    
    // Handle authentication routes
    if (normalizedPath === '/api/auth/register' && method === 'POST') {
      console.log('[IPC HANDLER] Handling register request');
      const { name, email, password } = body;
      if (!name || !email || !password) {
        throw new Error('Name, email, and password are required');
      }
      return await authHandlers.register({ name, email, password });
    }
    
    if (normalizedPath === '/api/auth/login' && method === 'POST') {
      console.log('[IPC HANDLER] Handling login request');
      const { email, password } = body;
      console.log('Login request received:', { email });
      if (!email || !password) {
        throw new Error('Email and password are required');
      }
      try {
        const result = await authHandlers.login({ email, password });
        return { data: result };
      } catch (error) {
        console.error('Login error in handler:', error);
        throw error;
      }
    }
    
    if (normalizedPath === '/api/auth/refresh' && method === 'POST') {
      const { refreshToken } = body;
      if (!refreshToken) {
        throw new Error('Refresh token is required');
      }
      return await authHandlers.refreshToken({ refreshToken });
    }
    
    if (normalizedPath === '/api/auth/logout' && method === 'POST') {
      const { refreshToken } = body;
      if (!refreshToken) {
        throw new Error('Refresh token is required');
      }
      return await authHandlers.logout({ refreshToken });
    }
    
    if (normalizedPath.startsWith('/audio/')) {
      const fileName = normalizedPath.replace('/audio/', '');
      // Check both uploads and public directories
      let filePath = path.join(process.cwd(), 'uploads', fileName);
      if (!fs.existsSync(filePath)) {
        filePath = path.join(process.cwd(), 'public', fileName);
      }
      console.log('[AUDIO DEBUG] Requested:', filePath);
      if (!fs.existsSync(filePath)) {
        console.log('[AUDIO DEBUG] File not found:', filePath);
        return { status: 404, error: 'File not found' };
      }
      const fileBuffer = fs.readFileSync(filePath);
      return {
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Length': fileBuffer.length,
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Range',
        },
        data: fileBuffer,
      };
    }

    // Handle album art requests
    if (normalizedPath.startsWith('/uploads/album-art/')) {
      const fileName = normalizedPath.replace('/uploads/album-art/', '');
      const filePath = path.join(process.cwd(), 'uploads', 'album-art', fileName);
      console.log('[ALBUM ART DEBUG] Requested:', filePath);
      if (!fs.existsSync(filePath)) {
        console.log('[ALBUM ART DEBUG] File not found:', filePath);
        return { status: 404, error: 'Album art not found' };
      }
      const fileBuffer = fs.readFileSync(filePath);
      
      // Determine content type based on file content and extension
      let contentType = 'image/jpeg'; // default
      
      // Check file signature (magic bytes) first
      if (fileBuffer.length >= 4) {
        // PNG signature
        if (fileBuffer[0] === 0x89 && fileBuffer[1] === 0x50 && fileBuffer[2] === 0x4E && fileBuffer[3] === 0x47) {
          contentType = 'image/png';
        }
        // JPEG signature
        else if (fileBuffer[0] === 0xFF && fileBuffer[1] === 0xD8) {
          contentType = 'image/jpeg';
        }
        // GIF signature
        else if (fileBuffer[0] === 0x47 && fileBuffer[1] === 0x49 && fileBuffer[2] === 0x46) {
          contentType = 'image/gif';
        }
        // WebP signature
        else if (fileBuffer.length >= 12 && 
                 fileBuffer[0] === 0x52 && fileBuffer[1] === 0x49 && fileBuffer[2] === 0x46 && fileBuffer[3] === 0x46 &&
                 fileBuffer[8] === 0x57 && fileBuffer[9] === 0x45 && fileBuffer[10] === 0x42 && fileBuffer[11] === 0x50) {
          contentType = 'image/webp';
        }
      }
      
      // Fall back to extension-based detection if signature check failed
      if (contentType === 'image/jpeg') {
        const ext = path.extname(fileName).toLowerCase();
        if (ext === '.png') contentType = 'image/png';
        else if (ext === '.gif') contentType = 'image/gif';
        else if (ext === '.webp') contentType = 'image/webp';
      }
      
      console.log('[ALBUM ART DEBUG] Content type:', contentType);
      console.log('[ALBUM ART DEBUG] File size:', fileBuffer.length);
      
      return {
        headers: {
          'Content-Type': contentType,
          'Content-Length': fileBuffer.length,
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Cache-Control': 'public, max-age=86400' // Cache for 24 hours
        },
        data: fileBuffer,
      };
    }
    
    // Normalize path to handle both /api/ and / paths for other API requests
    let apiPath = normalizedPath;
    if (!apiPath.startsWith('/api/') && apiPath.startsWith('/')) {
      apiPath = `/api${apiPath}`;
    }
    
    // Route the request to the appropriate handler
    console.log('🌐 [API REQUEST]', { 
      endpoint, 
      method, 
      apiPath, 
      originalPath: normalizedPath,
      searchParams: Object.fromEntries(url.searchParams.entries()),
      hasBody: !!body 
    });
    console.log('[API DEBUG] About to check playlist handlers, apiPath:', apiPath);
    
    // Handle track endpoints
    if (apiPath.startsWith('/api/tracks')) {
      if (method === 'GET') {
      console.log('Tracks API request received');
      console.log('[TRACKS DEBUG] Database path:', config.database.path);
      console.log('[TRACKS DEBUG] Database connection status:', dbAsync ? 'connected' : 'not connected');
      
      try {
        const result = await dbAsync.all(`
          SELECT t.*, 
                 a.name as artist_name,
                   al.name as album_name,
                   al.album_art_path as album_album_art_path,
                   GROUP_CONCAT(DISTINCT pt.playlist_id) as playlist_ids,
                   GROUP_CONCAT(DISTINCT c.id) as comment_ids,
                   COUNT(DISTINCT c.id) as comment_count
          FROM tracks t
          LEFT JOIN artists a ON t.artist_id = a.id
          LEFT JOIN albums al ON t.album_id = al.id
            LEFT JOIN playlist_tracks pt ON t.id = pt.track_id
            LEFT JOIN comments c ON t.id = c.track_id
            GROUP BY t.id
          `);
          
          // Fetch tags for each track
          const tracksWithTags = await Promise.all(result.map(async (track) => {
            const tags = await dbAsync.all(`
              SELECT t.*, tt.created_at as assigned_at
              FROM tags t
              JOIN track_tags tt ON t.id = tt.tag_id
              WHERE tt.track_id = ?
              ORDER BY t.name
            `, [track.id]);
            
            return {
              ...track,
              tags: tags
            };
          }));
          
          return { data: tracksWithTags };
        } catch (error) {
          console.error('[TRACKS DEBUG] Error fetching tracks:', error);
          throw error;
        }
      }

      // Update track metadata
      if (method === 'PATCH' && apiPath.match(/^\/api\/tracks\/[^/]+$/)) {
        const [, , , trackId] = apiPath.split('/');
        if (!trackId) {
          return { error: 'Invalid track ID', status: 400 };
        }

        try {
          // Check if track exists
          const existingTrack = await dbAsync.get('SELECT * FROM tracks WHERE id = ?', [trackId]);
          if (!existingTrack) {
            return { error: 'Track not found', status: 404 };
          }

          // Extract updateable fields from body
          const { name, artistName, albumName, year, genre, trackNumber } = body;
          const updates: string[] = [];
          const values: any[] = [];

          // Handle basic track fields
          if (name !== undefined) {
            updates.push('name = ?');
            values.push(name);
          }
          if (year !== undefined) {
            updates.push('year = ?');
            values.push(year);
          }
          if (genre !== undefined) {
            updates.push('genre = ?');
            values.push(genre);
          }
          if (trackNumber !== undefined) {
            updates.push('track_number = ?');
            values.push(trackNumber);
          }

          // Handle artist updates
          let artistId = existingTrack.artist_id;
          if (artistName !== undefined && artistName !== existingTrack.artist_name) {
            if (artistName) {
              // Find or create artist
              const existingArtist = await dbAsync.get('SELECT id FROM artists WHERE name = ?', [artistName]);
              if (existingArtist) {
                artistId = existingArtist.id;
              } else {
                const artistResult = await dbAsync.run(
                  'INSERT INTO artists (name, created_at) VALUES (?, ?)',
                  [artistName, Math.floor(Date.now() / 1000)]
                );
                artistId = artistResult.lastID;
              }
            } else {
              artistId = null;
            }
            updates.push('artist_id = ?');
            values.push(artistId);
          }

          // Handle album updates
          let albumId = existingTrack.album_id;
          if (albumName !== undefined && albumName !== existingTrack.album_name) {
            if (albumName && artistId) {
              // Find or create album
              const existingAlbum = await dbAsync.get(
                'SELECT id FROM albums WHERE name = ? AND artist_id = ?',
                [albumName, artistId]
              );
              if (existingAlbum) {
                albumId = existingAlbum.id;
              } else {
                const albumResult = await dbAsync.run(
                  'INSERT INTO albums (name, artist_id, created_at) VALUES (?, ?, ?)',
                  [albumName, artistId, Math.floor(Date.now() / 1000)]
                );
                albumId = albumResult.lastID;
              }
            } else {
              albumId = null;
            }
            updates.push('album_id = ?');
            values.push(albumId);
          }

          // Always update the updated_at timestamp
          updates.push('updated_at = ?');
          values.push(Math.floor(Date.now() / 1000));

          if (updates.length === 1) { // Only updated_at was added
            return { error: 'No valid fields to update', status: 400 };
          }

          // Build and execute update query
          values.push(trackId); // Add trackId for WHERE clause
          const updateQuery = `UPDATE tracks SET ${updates.join(', ')} WHERE id = ?`;
          
          console.log('[TRACK UPDATE] Executing query:', updateQuery);
          console.log('[TRACK UPDATE] With values:', values);
          
          await dbAsync.run(updateQuery, values);

          // Fetch updated track with related data
          const updatedTrack = await dbAsync.get(`
            SELECT t.*, 
                   a.name as artist_name,
                   al.name as album_name,
                   al.album_art_path as album_album_art_path
            FROM tracks t
            LEFT JOIN artists a ON t.artist_id = a.id
            LEFT JOIN albums al ON t.album_id = al.id
            WHERE t.id = ?
          `, [trackId]);

          console.log('[TRACK UPDATE] Updated track:', updatedTrack);
          return { data: updatedTrack };

        } catch (error) {
          console.error('[TRACK UPDATE] Error updating track:', error);
          return { error: 'Failed to update track', status: 500 };
        }
      }

      // Delete track
      if (method === 'DELETE' && apiPath.match(/^\/api\/tracks\/[^/]+$/)) {
        const [, , , trackId] = apiPath.split('/');
        if (!trackId) {
          return { error: 'Invalid track ID', status: 400 };
        }

        try {
          // Check if track exists
          const existingTrack = await dbAsync.get('SELECT * FROM tracks WHERE id = ?', [trackId]);
          if (!existingTrack) {
            return { error: 'Track not found', status: 404 };
          }

          // Delete track (this will cascade to related tables due to foreign key constraints)
          await dbAsync.run('DELETE FROM tracks WHERE id = ?', [trackId]);

          console.log('[TRACK DELETE] Deleted track:', trackId);
          return { data: { success: true, deletedTrackId: trackId } };

        } catch (error) {
          console.error('[TRACK DELETE] Error deleting track:', error);
          return { error: 'Failed to delete track', status: 500 };
        }
      }
      
      // Handle track metadata sync
      if (apiPath === '/api/tracks/sync-metadata' && method === 'POST') {
        const { trackIds } = body;
        if (!Array.isArray(trackIds)) {
          return { error: 'trackIds must be an array', status: 400 };
        }
        
        try {
          const results = await Promise.all(trackIds.map(async (trackId) => {
            const track = await dbAsync.get('SELECT * FROM tracks WHERE id = ?', [trackId]);
            if (!track) return { trackId, success: false, error: 'Track not found' };
            
            try {
              const metadata = await MetadataService.extractFromFile(track.file_path);
              await dbAsync.run(
                'UPDATE tracks SET duration = ?, bitrate = ?, sample_rate = ? WHERE id = ?',
                [metadata.duration, metadata.bitrate, metadata.sampleRate, trackId]
              );
              return { trackId, success: true, metadata };
            } catch (error) {
              return { trackId, success: false, error: String(error) };
            }
          }));
          
          return { data: results };
      } catch (error) {
          console.error('[API DEBUG] Error syncing metadata:', error);
          return { error: 'Failed to sync metadata', status: 500 };
        }
      }
    }
    
    // Handle playlist endpoints
    if (apiPath.startsWith('/api/playlists')) {
      console.log('[API DEBUG] Playlist block reached! apiPath:', apiPath, 'method:', method);
      // Get all playlists
      if (method === 'GET' && apiPath === '/api/playlists') {
        try {
        const playlists = await dbAsync.all(`
            SELECT p.*,
                   u.name as user_name,
                   u.email as user_email,
                   GROUP_CONCAT(pt.track_id) as track_ids,
                   COUNT(DISTINCT pt.track_id) as track_count
          FROM playlists p 
          LEFT JOIN users u ON p.user_id = u.id 
            LEFT JOIN playlist_tracks pt ON p.id = pt.playlist_id
            GROUP BY p.id
            ORDER BY p."order", p.created_at
          `);
          
          // Transform playlists to include user object and proper structure
          const transformedPlaylists = playlists.map(playlist => ({
            ...playlist,
            user: {
              id: playlist.user_id,
              name: playlist.user_name,
              email: playlist.user_email
            },
            tracks: [] // Will be populated when fetching specific playlist
          }));
          
          return { data: transformedPlaylists };
      } catch (error) {
          console.error('[API DEBUG] Error fetching playlists:', error);
        return { error: 'Failed to fetch playlists', status: 500 };
      }
      }
      
      // Get specific playlist by ID with tracks
      if (method === 'GET' && apiPath.match(/^\/api\/playlists\/[^/]+$/)) {
        const [, , , playlistId] = apiPath.split('/');
      if (!playlistId) {
        return { error: 'Invalid playlist ID', status: 400 };
      }
      
      try {
          // Get playlist details
        const playlist = await dbAsync.get(`
            SELECT p.*,
                   u.name as user_name,
                   u.email as user_email
          FROM playlists p 
          LEFT JOIN users u ON p.user_id = u.id 
          WHERE p.id = ?
        `, [playlistId]);
        
        if (!playlist) {
          return { error: 'Playlist not found', status: 404 };
        }
        
          // Get playlist tracks with full track information
        const tracks = await dbAsync.all(`
            SELECT t.*, 
                 a.name as artist_name,
                   al.name as album_name,
                   al.album_art_path as album_album_art_path,
                   pt."order" as playlist_order,
                   pt.id as playlist_track_id
            FROM playlist_tracks pt
            JOIN tracks t ON pt.track_id = t.id
          LEFT JOIN artists a ON t.artist_id = a.id
          LEFT JOIN albums al ON t.album_id = al.id
          WHERE pt.playlist_id = ?
            ORDER BY pt."order"
        `, [playlistId]);
        
          // Transform the response
          const transformedPlaylist = {
            ...playlist,
          user: {
              id: playlist.user_id,
              name: playlist.user_name,
              email: playlist.user_email
            },
            tracks: tracks
          };

          return { data: transformedPlaylist };
      } catch (error) {
          console.error('[API DEBUG] Error fetching playlist by ID:', error);
        return { error: 'Failed to fetch playlist', status: 500 };
      }
      }
      
      // Create new playlist
      if (method === 'POST' && apiPath === '/api/playlists') {
        const { name, description } = body;
      if (!name) {
          return { error: 'Name is required', status: 400 };
      }
      
      // For now, use a default user ID (1) - you might want to get this from token
      const userId = 1;
      const now = Math.floor(Date.now() / 1000);
      const playlistId = uuidv4();
      
      try {
          await dbAsync.run(
          'INSERT INTO playlists (id, name, description, user_id, "order") VALUES (?, ?, ?, ?, ?)',
          [playlistId, name, description || '', userId, 0]
        );
        
          const playlist = await dbAsync.get('SELECT * FROM playlists WHERE id = ?', [playlistId]);
          return { data: playlist };
      } catch (error) {
        console.error('[API DEBUG] Error creating playlist:', error);
        return { error: 'Failed to create playlist', status: 500 };
      }
      }
      
      // Add track to playlist
      if (method === 'POST' && apiPath.match(/^\/api\/playlists\/[^/]+\/tracks\/[^/]+$/)) {
        const [, , , playlistId, , trackId] = apiPath.split('/');
        if (!playlistId || !trackId) {
          return { error: 'Invalid playlist or track ID', status: 400 };
        }
        
        console.log(`[API DEBUG] Adding track ${trackId} to playlist ${playlistId}`);
        
        try {
          // Get the current highest order
          const result = await dbAsync.get(
            'SELECT MAX("order") as max_order FROM playlist_tracks WHERE playlist_id = ?',
            [playlistId]
          );
          const nextOrder = (result?.max_order || 0) + 1;
          
          // Insert the track into the playlist (duplicates are now allowed)
          await dbAsync.run(
            'INSERT INTO playlist_tracks (track_id, playlist_id, "order") VALUES (?, ?, ?)',
            [trackId, playlistId, nextOrder]
          );
        
          console.log(`[API DEBUG] Successfully added track ${trackId} to playlist ${playlistId} at order ${nextOrder}`);
          return { success: true, order: nextOrder };
      } catch (error) {
          console.error(`[API DEBUG] Error adding track to playlist:`, error);
        return { error: 'Failed to add track to playlist', status: 500 };
      }
      }
      
      // Remove track from playlist
      if (method === 'DELETE' && apiPath.match(/^\/api\/playlists\/[^/]+\/tracks\/[^/]+$/)) {
        const [, , , playlistId, , playlistTrackId] = apiPath.split('/');
        if (!playlistId || !playlistTrackId) {
          return { error: 'Invalid playlist or playlist track ID', status: 400 };
        }
        
        console.log(`[API DEBUG] Removing playlist_track_id ${playlistTrackId} from playlist ${playlistId}`);
        
        try {
          // Delete by playlist_track_id (the auto-incrementing ID)
          const result = await dbAsync.run(
            'DELETE FROM playlist_tracks WHERE playlist_id = ? AND id = ?',
            [playlistId, playlistTrackId]
          );
          
          console.log(`[API DEBUG] Delete result:`, result);
          
          if (result.changes === 0) {
            console.log(`[API DEBUG] No rows were deleted - playlist_track_id ${playlistTrackId} not found in playlist ${playlistId}`);
            return { error: 'Track not found in playlist', status: 404 };
          }
        
          // Reorder remaining tracks
          const tracks = await dbAsync.all(
            'SELECT * FROM playlist_tracks WHERE playlist_id = ? ORDER BY "order"',
            [playlistId]
          );
          
          console.log(`[API DEBUG] Reordering ${tracks.length} remaining tracks`);
          
          await Promise.all(tracks.map((track, index) => 
            dbAsync.run(
              'UPDATE playlist_tracks SET "order" = ? WHERE playlist_id = ? AND id = ?',
              [index, playlistId, track.id]
            )
          ));
        
        return { data: { success: true } };
          } catch (error) {
        console.error('[API DEBUG] Error removing track from playlist:', error);
        return { error: 'Failed to remove track from playlist', status: 500 };
      }
      }
      
      // Update playlist metadata (name, description)
      if (method === 'PATCH' && apiPath.match(/^\/api\/playlists\/[^/]+\/metadata$/)) {
        const [, , , playlistId] = apiPath.split('/');
        const { name, description } = body;
        
        if (!playlistId) {
          return { error: 'Invalid playlist ID', status: 400 };
        }
        
        try {
          // Build update query dynamically based on provided fields
          const updates = [];
          const values = [];
        
        if (name !== undefined) {
          updates.push('name = ?');
          values.push(name);
        }
        
        if (description !== undefined) {
          updates.push('description = ?');
          values.push(description);
        }
        
        if (updates.length === 0) {
            return { error: 'No valid fields to update', status: 400 };
        }
        
          // Add playlist ID to values array
        values.push(playlistId);
        
          // Execute update
        await dbAsync.run(
          `UPDATE playlists SET ${updates.join(', ')} WHERE id = ?`,
          values
        );
        
          // Return updated playlist
        const updatedPlaylist = await dbAsync.get('SELECT * FROM playlists WHERE id = ?', [playlistId]);
        return { data: updatedPlaylist };
      } catch (error) {
        console.error('[API DEBUG] Error updating playlist metadata:', error);
        return { error: 'Failed to update playlist metadata', status: 500 };
      }
      }

      // Update playlist track order
      if (method === 'PATCH' && apiPath.match(/^\/api\/playlists\/[^/]+\/track-order$/)) {
        console.log('[API DEBUG] Track order handler reached! apiPath:', apiPath);
        console.log('[API DEBUG] Request body:', JSON.stringify(body, null, 2));
        
        const [, , , playlistId] = apiPath.split('/');
        const { trackIds } = body;
        
        console.log('[API DEBUG] Extracted playlistId:', playlistId);
        console.log('[API DEBUG] Extracted trackIds:', trackIds);
        
        if (!playlistId) {
          console.error('[API DEBUG] ERROR: Invalid playlist ID');
          return { error: 'Invalid playlist ID', status: 400 };
        }
        if (!Array.isArray(trackIds)) {
          console.error('[API DEBUG] ERROR: trackIds is not an array:', typeof trackIds, trackIds);
          return { error: 'trackIds must be an array', status: 400 };
      }
      
      try {
          // Update order for each track using playlist_track_id (for duplicates support)
          console.log('[API DEBUG] Updating playlist track order for playlist:', playlistId);
          console.log('[API DEBUG] Received trackIds (playlist_track_ids):', trackIds);
          
          // First, let's check what's currently in the database
          const currentTracks = await dbAsync.all(
            'SELECT id, track_id, "order" FROM playlist_tracks WHERE playlist_id = ? ORDER BY "order"',
            [playlistId]
          );
          console.log('[API DEBUG] Current tracks in database:', currentTracks);
          
          const updatePromises = trackIds.map(async (playlistTrackId, index) => {
            // Convert to integer to ensure proper database matching
            const playlistTrackIdInt = parseInt(playlistTrackId, 10);
            console.log(`[API DEBUG] Updating playlist_track_id ${playlistTrackId} (${playlistTrackIdInt}) to order ${index}`);
            
            const result = await dbAsync.run(
              'UPDATE playlist_tracks SET "order" = ? WHERE playlist_id = ? AND id = ?',
              [index, playlistId, playlistTrackIdInt]
            );
            console.log(`[API DEBUG] Update result for playlist_track_id ${playlistTrackIdInt}:`, result);
            
            // Check if the update actually affected any rows
            if (result.changes === 0) {
              console.error(`[API DEBUG] WARNING: No rows updated for playlist_track_id ${playlistTrackIdInt}`);
            }
            
            return result;
          });
          
          const results = await Promise.all(updatePromises);
          console.log('[API DEBUG] All update results:', results);
          
          // Verify the updates by checking the database
          const verifyQuery = await dbAsync.all(
            'SELECT id, track_id, "order" FROM playlist_tracks WHERE playlist_id = ? ORDER BY "order"',
            [playlistId]
          );
          console.log('[API DEBUG] Verification query results:', verifyQuery);
          
          return { data: { success: true, updatedCount: results.length } };
      } catch (error) {
          console.error('[API DEBUG] Error updating playlist track order:', error);
          console.error('[API DEBUG] Error stack:', error instanceof Error ? error.stack : 'No stack trace available');
          return { error: 'Failed to update playlist track order', status: 500 };
        }
      }
      
      // Update playlist order (reorder playlists themselves)
      if (method === 'PATCH' && apiPath === '/api/playlists/reorder') {
        const { playlistIds } = body;
        
        if (!Array.isArray(playlistIds)) {
          return { error: 'playlistIds must be an array', status: 400 };
      }
      
      try {
          // Update order for each playlist
          await Promise.all(playlistIds.map((playlistId, index) => 
          dbAsync.run(
              'UPDATE playlists SET "order" = ? WHERE id = ?',
              [index, playlistId]
            )
          ));
          
          // Return the updated playlists in their new order
          const updatedPlaylists = await dbAsync.all(`
            SELECT p.*,
                   u.name as user_name,
                   u.email as user_email,
                   GROUP_CONCAT(pt.track_id) as track_ids,
                   COUNT(DISTINCT pt.track_id) as track_count
            FROM playlists p 
            LEFT JOIN users u ON p.user_id = u.id 
            LEFT JOIN playlist_tracks pt ON p.id = pt.playlist_id
            GROUP BY p.id
            ORDER BY p."order", p.created_at
          `);
          
          // Transform playlists to include user object and proper structure
          const transformedPlaylists = updatedPlaylists.map(playlist => ({
            ...playlist,
            user: {
              id: playlist.user_id,
              name: playlist.user_name,
              email: playlist.user_email
            },
            tracks: [] // Will be populated when fetching specific playlist
          }));
          
          return { data: transformedPlaylists };
      } catch (error) {
          console.error('[API DEBUG] Error updating playlist order:', error);
          return { error: 'Failed to update playlist order', status: 500 };
        }
      }
    }
    
    console.log('[API DEBUG] About to check comment endpoints for path:', apiPath);
    console.log('[API DEBUG] Checking if', apiPath, 'starts with "/api/comments":', apiPath.startsWith('/api/comments'));
    // Handle comment endpoints
    if (apiPath.startsWith('/api/comments')) {
      console.log('[COMMENTS DEBUG] Comment endpoint hit:', { 
        method, 
        apiPath, 
        fullUrl: url.toString(),
        searchParams: Object.fromEntries(url.searchParams.entries()),
        trackId: url.searchParams.get('trackId') 
      });
      
      // Get all comments (for search) or comments for a specific track
      if (method === 'GET') {
        console.log('[COMMENTS DEBUG] Entering GET handler');
        const trackId = url.searchParams.get('trackId');
        const page = parseInt(url.searchParams.get('page') || '1', 10);
        const limit = parseInt(url.searchParams.get('limit') || '100', 10);
        
        console.log('[COMMENTS DEBUG] GET request params:', { trackId, page, limit });
        
        try {
          if (!trackId) {
            console.log('[COMMENTS DEBUG] Fetching all comments for search');
            // Get all comments for search functionality with markers
            const commentsRaw = await dbAsync.all(
              `SELECT c.*, u.name as user_name,
                      m.id as marker_id, m.wave_surfer_region_id, m.time as marker_time, 
                      m.duration as marker_duration, m.created_at as marker_created_at
               FROM comments c 
               LEFT JOIN users u ON c.user_id = u.id 
               LEFT JOIN markers m ON c.id = m.comment_id 
               ORDER BY c.created_at DESC 
               LIMIT ? OFFSET ?`,
              [limit, (page - 1) * limit]
            );
            
            // Convert Unix timestamps to ISO date strings and fix field names, include markers
            const comments = commentsRaw.map((comment: any) => {
              const processedComment: any = {
                ...comment,
                trackId: comment.track_id, // Map track_id to trackId for frontend
                userId: comment.user_id, // Map user_id to userId for frontend  
                userName: comment.user_name, // Map user_name to userName for frontend
                createdAt: comment.created_at ? new Date(comment.created_at * 1000).toISOString() : null,
                timestamp: comment.timestamp || 0
              };
              
              // Add marker if it exists
              if (comment.marker_id) {
                processedComment.marker = {
                  id: comment.marker_id,
                  waveSurferRegionID: comment.wave_surfer_region_id,
                  time: comment.marker_time,
                  duration: comment.marker_duration || 0.1,
                  commentId: comment.id,
                  trackId: comment.track_id,
                  createdAt: comment.marker_created_at ? new Date(comment.marker_created_at * 1000).toISOString() : null,
                  data: {
                    customColor: "#FF0000",
                    isVisible: true,
                    isDraggable: true,
                    isResizable: false
                  }
                };
              }
              
              return processedComment;
            });
            
            const total = await dbAsync.get(
              'SELECT COUNT(*) as count FROM comments'
            );
            
            const result = {
              data: {
                comments,
                pagination: {
                  total: total.count,
                  page,
                  limit,
                  pages: Math.ceil(total.count / limit)
                }
              }
            };
            
            console.log('[COMMENTS DEBUG] Returning all comments result:', { 
              commentsCount: comments.length, 
              total: total.count 
            });
            
            return result;
          } else {
            // Get comments for a specific track with markers
            const commentsRaw = await dbAsync.all(
              `SELECT c.*, u.name as user_name,
                      m.id as marker_id, m.wave_surfer_region_id, m.time as marker_time, 
                      m.duration as marker_duration, m.created_at as marker_created_at
               FROM comments c 
               LEFT JOIN users u ON c.user_id = u.id 
               LEFT JOIN markers m ON c.id = m.comment_id 
               WHERE c.track_id = ? 
               ORDER BY c.created_at DESC 
               LIMIT ? OFFSET ?`,
              [trackId, limit, (page - 1) * limit]
            );
            
            // Convert Unix timestamps to ISO date strings and fix field names, include markers
            const comments = commentsRaw.map((comment: any) => {
              const processedComment: any = {
                ...comment,
                trackId: comment.track_id, // Map track_id to trackId for frontend
                userId: comment.user_id, // Map user_id to userId for frontend  
                userName: comment.user_name, // Map user_name to userName for frontend
                createdAt: comment.created_at ? new Date(comment.created_at * 1000).toISOString() : null,
                timestamp: comment.timestamp || 0
              };
              
              // Add marker if it exists
              if (comment.marker_id) {
                processedComment.marker = {
                  id: comment.marker_id,
                  waveSurferRegionID: comment.wave_surfer_region_id,
                  time: comment.marker_time,
                  duration: comment.marker_duration || 0.1,
                  commentId: comment.id,
                  trackId: comment.track_id,
                  createdAt: comment.marker_created_at ? new Date(comment.marker_created_at * 1000).toISOString() : null,
                  data: {
                    customColor: "#FF0000",
                    isVisible: true,
                    isDraggable: true,
                    isResizable: false
                  }
                };
              }
              
              return processedComment;
            });
            
            const total = await dbAsync.get(
              'SELECT COUNT(*) as count FROM comments WHERE track_id = ?',
              [trackId]
            );
            
            return {
              data: {
                comments,
                pagination: {
                  total: total.count,
                  page,
                  limit,
                  pages: Math.ceil(total.count / limit)
                }
              }
            };
          }
        } catch (error) {
          console.error('[COMMENTS DEBUG] Error fetching comments:', error);
          console.error('[COMMENTS DEBUG] Error details:', {
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined
          });
          return { error: 'Failed to fetch comments', status: 500 };
        }
      }
      
      // Create new comment
      if (method === 'POST') {
        console.log('[COMMENTS DEBUG] Entering POST handler');
        const { trackId, userId, content, time } = body;
        
        console.log('[COMMENTS DEBUG] POST request body:', { trackId, userId, content, time });
        console.log('[COMMENTS DEBUG] Full body object:', body);
        
        if (!trackId) {
          console.log('[COMMENTS DEBUG] trackId is missing from body');
          return { error: 'Missing trackId', status: 400 };
        }
        if (!userId) {
          return { error: 'Missing userId', status: 400 };
        }
        if (!content) {
          return { error: 'Missing content', status: 400 };
        }
        if (typeof time !== 'number') {
          return { error: 'Missing or invalid time', status: 400 };
        }
        
        try {
          const commentId = uuidv4();
          const now = Math.floor(Date.now() / 1000);
          
          await dbAsync.run(
            'INSERT INTO comments (id, content, track_id, user_id, created_at, timestamp) VALUES (?, ?, ?, ?, ?, ?)',
            [commentId, content, trackId, userId, now, time]
          );
          
          // Create marker if time is provided
          let marker = null;
          if (typeof time === 'number') {
            const markerId = uuidv4();
            const waveSurferRegionId = `region-${markerId}`;
            
            await dbAsync.run(
              'INSERT INTO markers (id, wave_surfer_region_id, time, duration, comment_id, track_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
              [markerId, waveSurferRegionId, time, 0.1, commentId, trackId, now]
            );
            
            marker = {
              id: markerId,
              waveSurferRegionID: waveSurferRegionId,
              time: time,
              duration: 0.1,
              commentId: commentId,
              trackId: trackId,
              createdAt: new Date(now * 1000).toISOString(),
              data: {
                customColor: "#FF0000",
                isVisible: true,
                isDraggable: true,
                isResizable: false
              }
            };
          }
          
          const commentRaw = await dbAsync.get(
            'SELECT c.*, u.name as user_name FROM comments c LEFT JOIN users u ON c.user_id = u.id WHERE c.id = ?',
            [commentId]
          );
          
          console.log('[COMMENTS DEBUG] Raw comment from DB:', commentRaw);
          console.log('[COMMENTS DEBUG] Created marker:', marker);
          
          // Convert Unix timestamp to ISO date string and fix field name
          const comment = {
            ...commentRaw,
            createdAt: commentRaw.created_at ? new Date(commentRaw.created_at * 1000).toISOString() : null,
            timestamp: commentRaw.timestamp || 0
          };
          
          // Add marker to comment if it was created
          const commentWithMarker = {
            ...comment,
            ...(marker && { marker })
          };
          
          console.log('[COMMENTS DEBUG] Final comment with marker:', commentWithMarker);
          
          return { data: commentWithMarker };
        } catch (error) {
          console.error('[API DEBUG] Error creating comment:', error);
          return { error: 'Failed to create comment', status: 500 };
        }
      }
    }

    // Handle tag endpoints
    if (apiPath.startsWith('/api/tags')) {
      // Get all tags
      if (method === 'GET' && apiPath === '/api/tags') {
        try {
          const tags = await dbAsync.all(`
            SELECT t.*, 
                   COUNT(tt.track_id) as usage_count
            FROM tags t
            LEFT JOIN track_tags tt ON t.id = tt.tag_id
            GROUP BY t.id
            ORDER BY t.name
          `);
          
          return { data: tags };
        } catch (error) {
          console.error('[API DEBUG] Error fetching tags:', error);
          return { error: 'Failed to fetch tags', status: 500 };
        }
      }

      // Create new tag
      if (method === 'POST' && apiPath === '/api/tags') {
        const { name, color, type = 'manual', confidence } = body;
        
        if (!name) {
          return { error: 'Tag name is required', status: 400 };
        }
        
        if (!['manual', 'auto', 'system'].includes(type)) {
          return { error: 'Invalid tag type', status: 400 };
        }
        
        try {
          const tagId = uuidv4();
          const now = Math.floor(Date.now() / 1000);
          
          await dbAsync.run(
            'INSERT INTO tags (id, name, color, type, confidence, created_at) VALUES (?, ?, ?, ?, ?, ?)',
            [tagId, name, color || '#6B7280', type, confidence, now]
          );
          
          const tag = await dbAsync.get('SELECT * FROM tags WHERE id = ?', [tagId]);
          return { data: tag };
        } catch (error) {
          if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
            return { error: 'Tag name already exists', status: 409 };
          }
          console.error('[API DEBUG] Error creating tag:', error);
          return { error: 'Failed to create tag', status: 500 };
        }
      }

      // Update tag
      if (method === 'PATCH' && apiPath.match(/^\/api\/tags\/[^/]+$/)) {
        const [, , , tagId] = apiPath.split('/');
        const { name, color, type, confidence } = body;
        
        if (!tagId) {
          return { error: 'Invalid tag ID', status: 400 };
        }
        
        try {
          const existingTag = await dbAsync.get('SELECT * FROM tags WHERE id = ?', [tagId]);
          if (!existingTag) {
            return { error: 'Tag not found', status: 404 };
          }
          
          const updates: string[] = [];
          const values: any[] = [];
          
          if (name !== undefined) {
            updates.push('name = ?');
            values.push(name);
          }
          if (color !== undefined) {
            updates.push('color = ?');
            values.push(color);
          }
          if (type !== undefined) {
            if (!['manual', 'auto', 'system'].includes(type)) {
              return { error: 'Invalid tag type', status: 400 };
            }
            updates.push('type = ?');
            values.push(type);
          }
          if (confidence !== undefined) {
            updates.push('confidence = ?');
            values.push(confidence);
          }
          
          if (updates.length === 0) {
            return { error: 'No valid fields to update', status: 400 };
          }
          
          values.push(tagId);
          await dbAsync.run(
            `UPDATE tags SET ${updates.join(', ')} WHERE id = ?`,
            values
          );
          
          const updatedTag = await dbAsync.get('SELECT * FROM tags WHERE id = ?', [tagId]);
          return { data: updatedTag };
        } catch (error) {
          if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
            return { error: 'Tag name already exists', status: 409 };
          }
          console.error('[API DEBUG] Error updating tag:', error);
          return { error: 'Failed to update tag', status: 500 };
        }
      }

      // Delete tag
      if (method === 'DELETE' && apiPath.match(/^\/api\/tags\/[^/]+$/)) {
        const [, , , tagId] = apiPath.split('/');
        
        if (!tagId) {
          return { error: 'Invalid tag ID', status: 400 };
        }
        
        try {
          const existingTag = await dbAsync.get('SELECT * FROM tags WHERE id = ?', [tagId]);
          if (!existingTag) {
            return { error: 'Tag not found', status: 404 };
          }
          
          // Delete tag (this will cascade to track_tags due to foreign key constraints)
          await dbAsync.run('DELETE FROM tags WHERE id = ?', [tagId]);
          
          return { data: { success: true, deletedTagId: tagId } };
        } catch (error) {
          console.error('[API DEBUG] Error deleting tag:', error);
          return { error: 'Failed to delete tag', status: 500 };
        }
      }

      // Get tags for a specific track
      if (method === 'GET' && apiPath.match(/^\/api\/tags\/track\/[^/]+$/)) {
        const [, , , , trackId] = apiPath.split('/');
        
        if (!trackId) {
          return { error: 'Invalid track ID', status: 400 };
        }
        
        try {
          const tags = await dbAsync.all(`
            SELECT t.*, tt.created_at as assigned_at
            FROM tags t
            JOIN track_tags tt ON t.id = tt.tag_id
            WHERE tt.track_id = ?
            ORDER BY t.name
          `, [trackId]);
          
          return { data: tags };
        } catch (error) {
          console.error('[API DEBUG] Error fetching track tags:', error);
          return { error: 'Failed to fetch track tags', status: 500 };
        }
      }

      // Add tag to track
      if (method === 'POST' && apiPath.match(/^\/api\/tags\/track\/[^/]+$/)) {
        const [, , , , trackId] = apiPath.split('/');
        const { tagId } = body;
        
        if (!trackId || !tagId) {
          return { error: 'Track ID and tag ID are required', status: 400 };
        }
        
        try {
          // Check if track exists
          const track = await dbAsync.get('SELECT id FROM tracks WHERE id = ?', [trackId]);
          if (!track) {
            return { error: 'Track not found', status: 404 };
          }
          
          // Check if tag exists
          const tag = await dbAsync.get('SELECT id FROM tags WHERE id = ?', [tagId]);
          if (!tag) {
            return { error: 'Tag not found', status: 404 };
          }
          
          // Check if association already exists
          const existing = await dbAsync.get(
            'SELECT * FROM track_tags WHERE track_id = ? AND tag_id = ?',
            [trackId, tagId]
          );
          if (existing) {
            return { error: 'Tag already assigned to track', status: 409 };
          }
          
          // Create association
          const now = Math.floor(Date.now() / 1000);
          await dbAsync.run(
            'INSERT INTO track_tags (track_id, tag_id, created_at) VALUES (?, ?, ?)',
            [trackId, tagId, now]
          );
          
          // Return the tag with assignment info
          const assignedTag = await dbAsync.get(`
            SELECT t.*, tt.created_at as assigned_at
            FROM tags t
            JOIN track_tags tt ON t.id = tt.tag_id
            WHERE tt.track_id = ? AND tt.tag_id = ?
          `, [trackId, tagId]);
          
          return { data: assignedTag };
        } catch (error) {
          console.error('[API DEBUG] Error adding tag to track:', error);
          return { error: 'Failed to add tag to track', status: 500 };
        }
      }

      // Remove tag from track
      if (method === 'DELETE' && apiPath.match(/^\/api\/tags\/track\/[^/]+\/[^/]+$/)) {
        const [, , , , trackId, tagId] = apiPath.split('/');
        
        if (!trackId || !tagId) {
          return { error: 'Track ID and tag ID are required', status: 400 };
        }
        
        try {
          const result = await dbAsync.run(
            'DELETE FROM track_tags WHERE track_id = ? AND tag_id = ?',
            [trackId, tagId]
          );
          
          if (result.changes === 0) {
            return { error: 'Tag not found on track', status: 404 };
          }
          
          return { data: { success: true, removedTagId: tagId } };
        } catch (error) {
          console.error('[API DEBUG] Error removing tag from track:', error);
          return { error: 'Failed to remove tag from track', status: 500 };
        }
      }
    }
    
    console.log('[IPC HANDLER] No matching handler found for:', { method, endpoint, apiPath: apiPath || 'not set' });
    throw new Error(`No handler for ${method} ${endpoint}`);
  } catch (error) {
    console.error('API request error:', error);
    throw error;
  }
});

app.whenReady().then(async () => {
  try {
    console.log('🚀 Electron app starting...');
    
    // Start audio HTTP server
    startAudioServer();
    console.log('🎵 Audio server started');
    
    // Initialize database
    await setupDatabase();
    console.log('🗄️ Database initialized');
    
    // Create test user
    await ensureTestUser();
    console.log('👤 Test user ensured');
    
    // Create test track
    await ensureTestTrack();
    console.log('🎵 Test track ensured');
    
    // Create test tags
    await ensureTestTags();
    console.log('🏷️ Test tags ensured');
    
    // Assign sample tags to test track
    await assignSampleTagsToTestTrack();
    console.log('🔗 Sample tags assigned');
    
    // Run database integrity check
    await checkDatabaseIntegrity();
    console.log('🔍 Database integrity check completed');
    
    // Create main window
    createMainWindow();
    console.log('🪟 Main window created');
    
    // Log registered IPC handlers
    console.log('📡 Registered IPC handlers:');
    console.log('  - debug:test');
    console.log('  - upload:single-track');
    console.log('  - upload:batch-tracks');
    console.log('  - getTracks');
    console.log('  - get-waveform-data');
    console.log('  - getUser');
    console.log('  - auth:login');
    console.log('  - auth:register');
    console.log('  - auth:refresh-token');
    console.log('  - auth:logout');
    console.log('  - api-request');
    
    console.log('✅ Electron app startup complete!');
  } catch (error) {
    console.error('❌ Error during app initialization:', error);
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  console.log("App is quitting...");
  stopAudioServer();
  mainWindow = null;
});

// ✅ IPC communication test
ipcMain.on("ping", (event, message) => {
  console.log("Received message from frontend:", message);
  event.reply("pong", "Hello from Electron!");
});

ipcMain.handle("getUsers", async () => {
  try {
    const result = await dbAsync.all('SELECT * FROM users');
    return Array.isArray(result) ? result : []; // Ensure it's an array
  } catch (error) {
    if (error instanceof Error) {
      console.error("Error fetching users:", error.message);
    } else {
      console.error("Unknown error fetching users:", error);
    }
    return []; // Always return an empty array on failure
  }
});

// Auth utility functions will be imported from ./utils/auth

// Auth Handlers
ipcMain.handle('auth:login', async (_, credentials) => {
  if (!credentials || !credentials.email || !credentials.password) {
    throw new Error('Email and password are required');
  }
  
  const { email, password } = credentials;
  
  try {
    // Find user by email
    const user = await dbAsync.get(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );
      
    if (!user) {
      throw new Error('Invalid email or password');
    }
    
    // Verify password
    const isPasswordValid = await verifyPassword(password, user.password);
    if (!isPasswordValid) {
      throw new Error('Invalid email or password');
    }
    
    // Generate tokens
    const accessToken = generateJWT(user.id);
    const refreshToken = generateRefreshToken(user.id);
    const expiresIn = Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60); // 7 days from now

    // Store refresh token in the refresh_tokens table within a transaction
    await dbAsync.run(
      'DELETE FROM refresh_tokens WHERE user_id = ?',
      [user.id]
    );
    
    await dbAsync.run(
      'INSERT INTO refresh_tokens (token, user_id, expires_in) VALUES (?, ?, ?)',
      [refreshToken, user.id, expiresIn]
    );
    
    // Update user's updatedAt timestamp
    await dbAsync.run(
      'UPDATE users SET updated_at = ? WHERE id = ?',
      [Math.floor(Date.now() / 1000), user.id]
    );

    // Return user data (excluding password)
    const { password: _, ...userData } = user;
    
    return {
      user: userData,
      accessToken,
      refreshToken
    };
      } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
});

ipcMain.handle('auth:register', async (_, userData) => {
  if (!userData || !userData.email || !userData.password || !userData.name) {
    throw new Error('Name, email, and password are required');
  }
  
  const { name, email, password } = userData;
  
  try {
    // Check if user already exists
    const existing = await dbAsync.get(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );
      
    if (existing) {
      throw new Error('Email already registered');
    }
    
    // Hash password
    const hashedPassword = await hashPassword(password);
    const now = Math.floor(Date.now() / 1000);
    
    // Start transaction
    await dbAsync.run(
      'INSERT INTO users (name, email, password, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      [name, email, hashedPassword, now, now]
    );
    
    const newUser = await dbAsync.get(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );
    
    // Generate tokens
    const accessToken = generateJWT(newUser.id);
    const refreshToken = generateRefreshToken(newUser.id);
    const expiresIn = Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60); // 7 days from now
    
    // Store refresh token
    await dbAsync.run(
      'INSERT INTO refresh_tokens (token, user_id, expires_in) VALUES (?, ?, ?)',
      [refreshToken, newUser.id, expiresIn]
    );
    
    // Update user's updatedAt timestamp
    await dbAsync.run(
      'UPDATE users SET updated_at = ? WHERE id = ?',
      [Math.floor(Date.now() / 1000), newUser.id]
    );

    // Return user data (excluding password)
    const { password: pwd, ...userData } = newUser;
    
    return {
      user: userData,
      accessToken,
      refreshToken
    };
  } catch (error) {
    console.error('Registration error:', error);
    throw error;
  }
});

// Music Data Handlers
ipcMain.handle('getTracks', async () => {
  try {
    console.log('getTracks IPC handler called');
    const result = await dbAsync.all('SELECT * FROM tracks');
    console.log('getTracks result:', result);
    return { data: result };
  } catch (error) {
    console.error('Error fetching tracks:', error);
    return { error: 'Failed to fetch tracks', data: [] };
  }
});

// Handler for fetching preprocessed waveform data
ipcMain.handle('get-waveform-data', async (_, trackId: string) => {
  try {
    console.log(`📊 [WAVEFORM] Fetching preprocessed data for track: ${trackId}`);
    
    const track = await dbAsync.get(
      'SELECT waveform_data, preprocessed_chunks FROM tracks WHERE id = ?',
      [trackId]
    );
    
    if (!track) {
      console.log(`📊 [WAVEFORM] Track not found: ${trackId}`);
      return { waveformData: null, chunks: null };
    }
    
    let waveformData = null;
    let chunks = null;
    
    // Parse waveform data if it exists
    if (track.waveform_data) {
      try {
        waveformData = JSON.parse(track.waveform_data);
        console.log(`📊 [WAVEFORM] Parsed waveform data: ${waveformData.length} points`);
      } catch (error) {
        console.error(`📊 [WAVEFORM] Error parsing waveform data:`, error);
      }
    }
    
    // Parse chunks data if it exists
    if (track.preprocessed_chunks) {
      try {
        chunks = JSON.parse(track.preprocessed_chunks);
        console.log(`📊 [WAVEFORM] Parsed chunks data: ${chunks.length} chunks`);
      } catch (error) {
        console.error(`📊 [WAVEFORM] Error parsing chunks data:`, error);
      }
    }
    
    return { waveformData, chunks };
  } catch (error) {
    console.error('📊 [WAVEFORM] Error fetching waveform data:', error);
    return { waveformData: null, chunks: null };
  }
});

ipcMain.handle('getUser', async (_, userId?: number) => {
  try {
    let user;
    if (userId) {
      user = await dbAsync.get(
        'SELECT * FROM users WHERE id = ?',
        [userId]
      );
    } else {
      // If no userId provided, get the first user (for demo purposes)
      // In a real app, you'd get the currently logged-in user
      user = await dbAsync.get(
        'SELECT * FROM users LIMIT 1'
      );
    }
    
    if (!user) {
      return { error: 'User not found', data: null };
    }
    
    // Don't send password hash back to client
    const { password, ...userData } = user;
    return { data: userData };
  } catch (error) {
    console.error('Error fetching user:', error);
    return { error: 'Failed to fetch user', data: null };
  }
});

ipcMain.handle('music:fetch-artists', async () => {
  return dbAsync.all('SELECT * FROM artists');
});

ipcMain.handle('music:create-artist', async (_, artistData) => {
  const result = await dbAsync.run(
    'INSERT INTO artists (name, created_at, updated_at) VALUES (?, ?, ?) RETURNING *',
    [artistData.name, Math.floor(Date.now() / 1000), Math.floor(Date.now() / 1000)]
  );
  return result;
});

// ... similar handlers for albums, markers, etc ...

// Token storage
const tokenStore = {
  accessToken: null as string | null,
  refreshToken: null as string | null
};

ipcMain.handle('auth:set-token', (_, { accessToken, refreshToken }: { accessToken: string, refreshToken: string }) => {
  tokenStore.accessToken = accessToken;
  if (refreshToken) {
    tokenStore.refreshToken = refreshToken;
  }
  return { success: true };
});

ipcMain.handle('auth:get-token', () => {
  return tokenStore.accessToken;
});

ipcMain.handle('auth:refresh-token', async () => {
  if (!tokenStore.refreshToken) {
    throw new Error('No refresh token available');
  }
  
  try {
    const result = await refreshAccessToken(tokenStore.refreshToken);
    if (!result) {
      throw new Error('Failed to refresh token');
    }
    // Update the token store with new tokens
    tokenStore.accessToken = result.accessToken;
    tokenStore.refreshToken = result.refreshToken;
    return result;
  } catch (error) {
    console.error('Error refreshing token:', error);
    throw error;
  }
});

ipcMain.handle('auth:logout', async () => {
  try {
    if (tokenStore.refreshToken) {
      await invalidateRefreshToken(tokenStore.refreshToken);
    }
  } catch (error) {
    console.error('Error during logout:', error);
  }
  // Clear the token store
  tokenStore.accessToken = null;
  tokenStore.refreshToken = null;
  return { success: true };
});

// File Upload Handlers
async function processSingleTrackUpload(fileBuffer: Buffer, fileName: string, userId: number) {
  try {
    console.log(`[UPLOAD] Processing single track: ${fileName}`);
    console.log(`[UPLOAD] File buffer length: ${fileBuffer.length}`);
    console.log(`[UPLOAD] User ID: ${userId}`);
    
    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(process.cwd(), 'uploads');
    console.log(`[UPLOAD] Uploads directory: ${uploadsDir}`);
    await fs.promises.mkdir(uploadsDir, { recursive: true });
    
    // Generate unique filename
    const timestamp = Date.now();
    const safeFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const uniqueFileName = `${timestamp}-${safeFileName}`;
    const filePath = path.join(uploadsDir, uniqueFileName);
    
    console.log(`[UPLOAD] Writing file to: ${filePath}`);
    // Write file to disk
    await fs.promises.writeFile(filePath, Buffer.from(fileBuffer));
    console.log(`[UPLOAD] File saved successfully to: ${filePath}`);
    
    // Extract metadata using music-metadata
    console.log(`[UPLOAD] Extracting metadata for ${fileName}`);
    const metadata = await MetadataService.extractFromFile(filePath);
    
    console.log(`[UPLOAD] Extracted metadata:`, metadata);
    console.log(`[UPLOAD] Album art info:`, metadata.albumArt);
    
    // Find or create artist
    let artistId = null;
    if (metadata.artist) {
      console.log(`[UPLOAD] Processing artist: ${metadata.artist}`);
      const existingArtist = await dbAsync.get(
        'SELECT id FROM artists WHERE name = ?',
        [metadata.artist]
      );
      
      if (existingArtist) {
        artistId = existingArtist.id;
        console.log(`[UPLOAD] Found existing artist with ID: ${artistId}`);
      } else {
        const artistResult = await dbAsync.run(
          'INSERT INTO artists (name, created_at, updated_at) VALUES (?, ?, ?)',
          [metadata.artist, Math.floor(Date.now() / 1000), Math.floor(Date.now() / 1000)]
        );
        artistId = artistResult.lastID;
        console.log(`[UPLOAD] Created new artist with ID: ${artistId}`);
      }
    }
    
    // Find or create album
    let albumId = null;
    if (metadata.album && artistId) {
      console.log(`[UPLOAD] Processing album: ${metadata.album}`);
      const existingAlbum = await dbAsync.get(
        'SELECT id FROM albums WHERE name = ? AND artist_id = ?',
        [metadata.album, artistId]
      );
      
      if (existingAlbum) {
        albumId = existingAlbum.id;
        console.log(`[UPLOAD] Found existing album with ID: ${albumId}`);
        
        // Update album art if we have it and the album doesn't
        if (metadata.albumArt && !existingAlbum.album_art_path) {
          await dbAsync.run(
            'UPDATE albums SET album_art_path = ? WHERE id = ?',
            [metadata.albumArt.path, albumId]
          );
          console.log(`[UPLOAD] Updated album art for existing album ${albumId}`);
        }
      } else {
        const albumResult = await dbAsync.run(
          'INSERT INTO albums (name, release_date, artist_id, album_art_path) VALUES (?, ?, ?, ?)',
          [metadata.album, Math.floor(Date.now() / 1000), artistId, metadata.albumArt?.path || null]
        );
        albumId = albumResult.lastID;
        console.log(`[UPLOAD] Created new album with ID: ${albumId}, album art: ${metadata.albumArt?.path || 'none'}`);
      }
    }
    
    console.log(`[UPLOAD] Inserting track into database...`);
    // Insert track into database
    const trackId = uuidv4();
    const trackResult = await dbAsync.run(
      `INSERT INTO tracks (
        id, name, duration, artist_id, album_id, user_id, file_path, 
        bitrate, sample_rate, channels, year, genre, track_number,
        album_art_path, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        trackId,
        metadata.title,
        metadata.duration,
        artistId,
        albumId,
        userId,
        `/uploads/${uniqueFileName}`,
        metadata.bitrate,
        metadata.sampleRate,
        metadata.channels,
        metadata.year,
        metadata.genre,
        metadata.trackNumber,
        metadata.albumArt?.path || null, // Track-level album art fallback
        Math.floor(Date.now() / 1000),
        Math.floor(Date.now() / 1000)
      ]
    );
    console.log(`[UPLOAD] Track saved with ID: ${trackId}`);
    
    // Fetch the complete track data
    const track = await dbAsync.get(
      `SELECT t.*, a.name as artist_name, al.name as album_name, al.album_art_path as album_album_art_path
       FROM tracks t 
       LEFT JOIN artists a ON t.artist_id = a.id 
       LEFT JOIN albums al ON t.album_id = al.id 
       WHERE t.id = ?`,
      [trackId]
    );
    
    console.log(`[UPLOAD] Fetched track data:`, track);
    
    return {
      success: true,
      data: {
        id: track.id,
        name: track.name,
        duration: track.duration,
        artistId: track.artist_id,
        artist: track.artist_name ? { name: track.artist_name } : null,
        albumId: track.album_id,
        album: track.album_name ? { name: track.album_name } : null,
        userId: track.user_id,
        filePath: track.file_path,
        albumArtPath: track.album_album_art_path || track.album_art_path || null, // Album art from album or track
        bitrate: track.bitrate,
        sampleRate: track.sample_rate,
        channels: track.channels,
        year: track.year,
        genre: track.genre,
        trackNumber: track.track_number,
        createdAt: track.created_at,
        updatedAt: track.updated_at
      }
    };
    
  } catch (error) {
    console.error(`[UPLOAD] Error uploading track ${fileName}:`, error);
    console.error(`[UPLOAD] Error stack:`, error instanceof Error ? error.stack : 'No stack trace');
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed'
    };
  }
}

// Debug IPC handler to test communication
ipcMain.handle('debug:test', async (event, data) => {
  console.log('[DEBUG] Test IPC handler called with data:', data);
  return { success: true, message: 'IPC communication working', data };
});

ipcMain.handle('upload:single-track', async (event, { fileBuffer, fileName, userId }) => {
  console.log('[IPC] upload:single-track handler called');
  console.log('[IPC] Parameters:', { fileName, userId, bufferLength: fileBuffer?.length });
  
  try {
    const result = await processSingleTrackUpload(fileBuffer, fileName, userId);
    console.log('[IPC] upload:single-track result:', result);
    return result;
  } catch (error) {
    console.error('[IPC] upload:single-track error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'IPC handler error'
    };
  }
});

ipcMain.handle('upload:batch-tracks', async (event, { files, userId }) => {
  console.log('[IPC] upload:batch-tracks handler called');
  console.log('[IPC] Parameters:', { 
    filesCount: files?.length, 
    userId,
    fileNames: files?.map((f: { fileName: string }) => f.fileName)
  });
  
  try {
    console.log(`[BATCH UPLOAD] Processing ${files.length} files`);
    
    const results = [];
    const errors = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      console.log(`[BATCH UPLOAD] Processing file ${i + 1}/${files.length}: ${file.fileName}`);
      
      try {
        const result = await processSingleTrackUpload(file.fileBuffer, file.fileName, userId);
        
        if (result.success) {
          results.push(result.data);
          console.log(`[BATCH UPLOAD] File ${file.fileName} uploaded successfully`);
        } else {
          errors.push({ fileName: file.fileName, error: result.error });
          console.log(`[BATCH UPLOAD] File ${file.fileName} failed: ${result.error}`);
        }
      } catch (uploadError) {
        const errorMessage = uploadError instanceof Error ? uploadError.message : 'Unknown error';
        errors.push({ fileName: file.fileName, error: errorMessage });
        console.error(`[BATCH UPLOAD] File ${file.fileName} error:`, uploadError);
      }
    }
    
    const response = {
      success: true,
      data: {
        uploaded: results,
        failed: errors,
        total: files.length,
        successful: results.length,
        failedCount: errors.length
      }
    };
    
    console.log('[BATCH UPLOAD] Final response:', response);
    return response;
    
  } catch (error) {
    console.error('[BATCH UPLOAD] Error processing batch:', error);
    console.error('[BATCH UPLOAD] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Batch upload failed'
    };
  }
});

// Function to stop audio HTTP server
function stopAudioServer() {
  if (audioServer) {
    audioServer.close();
    audioServer = null;
    console.log('Audio server stopped');
  }
}

// Log IPC handler registration
console.log('📡 Registering IPC handlers...');
console.log('✅ IPC handlers registered successfully');

// IPC handlers for file operations
ipcMain.handle('get-file-url', async (_, filePath: string) => {
  try {
    const path = require('path');
    const fs = require('fs');
    const uploadsDir = path.join(process.cwd(), 'uploads');
    
    // Remove the leading slash and 'uploads/' prefix if present
    let fileName = filePath;
    if (fileName.startsWith('/uploads/')) {
      fileName = fileName.substring(9); // Remove '/uploads/'
    } else if (fileName.startsWith('uploads/')) {
      fileName = fileName.substring(8); // Remove 'uploads/'
    }
    
    const absolutePath = path.join(uploadsDir, fileName);
    
    // Check if file exists
    if (!fs.existsSync(absolutePath)) {
      console.error('[IPC] File not found:', {
        originalPath: filePath,
        fileName: fileName,
        absolutePath: absolutePath,
        uploadsDir: uploadsDir
      });
      return { 
        success: false, 
        error: `File not found: ${fileName}`,
        details: {
          originalPath: filePath,
          fileName: fileName,
          absolutePath: absolutePath,
          uploadsDir: uploadsDir
        }
      };
    }
    
    const fileUrl = `file://${absolutePath}`;
    console.log('[IPC] Converted filePath to file URL:', { 
      originalPath: filePath, 
      fileName, 
      uploadsDir, 
      absolutePath, 
      fileUrl,
      fileExists: true
    });
    return { success: true, data: fileUrl };
  } catch (error) {
    console.error('[IPC] Error converting file path to URL:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error',
      details: { originalPath: filePath }
    };
  }
});

// Database integrity check function
async function checkDatabaseIntegrity() {
  console.log('🔍 Starting database integrity check...');
  
  try {
    const fs = require('fs');
    const path = require('path');
    
    // Get uploads directory path
    const uploadsDir = path.join(process.cwd(), 'uploads');
    
    // Check if uploads directory exists
    if (!fs.existsSync(uploadsDir)) {
      console.log('❌ Uploads directory does not exist:', uploadsDir);
      return;
    }
    
    // Get all files in uploads directory
    const filesInUploads = fs.readdirSync(uploadsDir)
      .filter((file: string) => file.endsWith('.mp3') || file.endsWith('.wav') || file.endsWith('.m4a'))
      .map((file: string) => file);
    
    console.log('📁 Files found in uploads directory:', filesInUploads.length);
    console.log('📁 Files:', filesInUploads);
    
    // Get all tracks from database
    const tracksInDb = await dbAsync.all('SELECT id, name, file_path FROM tracks');
    
    // console.log('🗄️ Tracks found in database:', tracksInDb.length);
    // console.log('🗄️ Database tracks:', tracksInDb.map(t => ({ id: t.id, name: t.name, filePath: t.file_path })));
    
    // Check for orphaned files (files in uploads but not in database)
    const orphanedFiles = [];
    for (const file of filesInUploads) {
      const filePath = `/uploads/${file}`;
      const existsInDb = tracksInDb.some(track => track.file_path === filePath);
      
      if (!existsInDb) {
        orphanedFiles.push(file);
        console.log(`⚠️  Orphaned file found: ${file} (not in database)`);
      }
    }
    
    // Check for missing files (tracks in database but files don't exist)
    const missingFiles = [];
    for (const track of tracksInDb) {
      if (track.file_path && track.file_path.startsWith('/uploads/')) {
        const fileName = track.file_path.replace('/uploads/', '');
        const filePath = path.join(uploadsDir, fileName);
        
        if (!fs.existsSync(filePath)) {
          missingFiles.push({ track, fileName });
          console.log(`❌ Missing file for track "${track.name}" (ID: ${track.id}): ${fileName}`);
        }
      }
    }
    
    // Check for invalid file paths (not starting with /uploads/)
    const invalidPaths = tracksInDb.filter(track => 
      track.file_path && !track.file_path.startsWith('/uploads/')
    );
    
    if (invalidPaths.length > 0) {
      console.log('⚠️  Tracks with invalid file paths (not in uploads directory):');
      invalidPaths.forEach(track => {
        console.log(`   - Track "${track.name}" (ID: ${track.id}): ${track.file_path}`);
      });
    }
    
    // Summary
    console.log('\n📊 Database Integrity Check Summary:');
    console.log(`   ✅ Files in uploads directory: ${filesInUploads.length}`);
    console.log(`   ✅ Tracks in database: ${tracksInDb.length}`);
    console.log(`   ⚠️  Orphaned files: ${orphanedFiles.length}`);
    console.log(`   ❌ Missing files: ${missingFiles.length}`);
    console.log(`   ⚠️  Invalid file paths: ${invalidPaths.length}`);
    
    if (orphanedFiles.length > 0) {
      console.log('\n🗑️  Orphaned files (can be safely deleted):');
      orphanedFiles.forEach(file => console.log(`   - ${file}`));
    }
    
    if (missingFiles.length > 0) {
      console.log('\n❌ Missing files (database references non-existent files):');
      missingFiles.forEach(({ track, fileName }) => {
        console.log(`   - Track "${track.name}" (ID: ${track.id}): ${fileName}`);
      });
    }
    
    // Return results for potential cleanup operations
    return {
      filesInUploads,
      tracksInDb,
      orphanedFiles,
      missingFiles,
      invalidPaths,
      isHealthy: orphanedFiles.length === 0 && missingFiles.length === 0 && invalidPaths.length === 0
    };
    
  } catch (error) {
    console.error('❌ Error during database integrity check:', error);
    throw error;
  }
}

// Function to clean up orphaned files
async function cleanupOrphanedFiles() {
  console.log('🧹 Starting orphaned files cleanup...');
  
  try {
    const integrity = await checkDatabaseIntegrity();
    
    if (!integrity || integrity.orphanedFiles.length === 0) {
      console.log('✅ No orphaned files to clean up');
      return;
    }
    
    const fs = require('fs');
    const path = require('path');
    const uploadsDir = path.join(process.cwd(), 'uploads');
    
    let deletedCount = 0;
    for (const file of integrity.orphanedFiles) {
      const filePath = path.join(uploadsDir, file);
      try {
        fs.unlinkSync(filePath);
        console.log(`🗑️  Deleted orphaned file: ${file}`);
        deletedCount++;
      } catch (error) {
        console.error(`❌ Failed to delete ${file}:`, error);
      }
    }
    
    console.log(`✅ Cleanup complete: ${deletedCount} files deleted`);
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    throw error;
  }
}

// Function to fix invalid file paths
async function fixInvalidFilePaths() {
  console.log('🔧 Starting file path fixes...');
  
  try {
    const integrity = await checkDatabaseIntegrity();
    
    if (!integrity || integrity.invalidPaths.length === 0) {
      console.log('✅ No invalid file paths to fix');
      return;
    }
    
    let fixedCount = 0;
    for (const track of integrity.invalidPaths) {
      // Try to find the file in uploads directory
      const fs = require('fs');
      const path = require('path');
      const uploadsDir = path.join(process.cwd(), 'uploads');
      
      // Extract filename from the old path
      const oldFileName = track.file_path.split('/').pop();
      if (oldFileName) {
        const newPath = `/uploads/${oldFileName}`;
        const filePath = path.join(uploadsDir, oldFileName);
        
        if (fs.existsSync(filePath)) {
          // Update the database
          await dbAsync.run(
            'UPDATE tracks SET file_path = ? WHERE id = ?',
            [newPath, track.id]
          );
          console.log(`🔧 Fixed path for track "${track.name}" (ID: ${track.id}): ${track.file_path} → ${newPath}`);
          fixedCount++;
        } else {
          console.log(`⚠️  Could not fix path for track "${track.name}" (ID: ${track.id}): file not found in uploads`);
        }
      }
    }
    
    console.log(`✅ Path fixes complete: ${fixedCount} tracks updated`);
    
  } catch (error) {
    console.error('❌ Error during path fixes:', error);
    throw error;
  }
}

// IPC handlers for database integrity
ipcMain.handle('db:check-integrity', async () => {
  try {
    const result = await checkDatabaseIntegrity();
    return { success: true, data: result };
  } catch (error) {
    console.error('[IPC] Database integrity check error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

ipcMain.handle('db:cleanup-orphaned', async () => {
  try {
    await cleanupOrphanedFiles();
    return { success: true, message: 'Cleanup completed successfully' };
  } catch (error) {
    console.error('[IPC] Cleanup error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

ipcMain.handle('db:fix-paths', async () => {
  try {
    await fixInvalidFilePaths();
    return { success: true, message: 'Path fixes completed successfully' };
  } catch (error) {
    console.error('[IPC] Path fix error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

// IPC handler for database sync operations
ipcMain.handle('db:sync', async (_, actions: {
  deleteOrphaned: boolean;
  fixPaths: boolean;
  addMissing: boolean;
}) => {
  try {
    console.log('[IPC] Database sync requested with actions:', actions);
    
    const results = {
      deletedFiles: 0,
      fixedPaths: 0,
      addedTracks: 0,
      errors: [] as string[]
    };
    
    // Get current integrity status
    const integrity = await checkDatabaseIntegrity();
    if (!integrity) {
      throw new Error('Failed to get database integrity status');
    }
    
    // Delete orphaned files
    if (actions.deleteOrphaned && integrity.orphanedFiles.length > 0) {
      console.log('[SYNC] Deleting orphaned files:', integrity.orphanedFiles);
      const fs = require('fs');
      const path = require('path');
      const uploadsDir = path.join(process.cwd(), 'uploads');
      
      for (const file of integrity.orphanedFiles) {
        try {
          const filePath = path.join(uploadsDir, file);
          fs.unlinkSync(filePath);
          console.log(`[SYNC] Deleted orphaned file: ${file}`);
          results.deletedFiles++;
        } catch (error) {
          const errorMsg = `Failed to delete ${file}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          console.error(`[SYNC] ${errorMsg}`);
          results.errors.push(errorMsg);
        }
      }
    }
    
    // Fix invalid paths
    if (actions.fixPaths && integrity.invalidPaths.length > 0) {
      console.log('[SYNC] Fixing invalid paths:', integrity.invalidPaths);
      
      for (const track of integrity.invalidPaths) {
        try {
          const oldFileName = track.file_path.split('/').pop();
          if (oldFileName) {
            const newPath = `/uploads/${oldFileName}`;
            const fs = require('fs');
            const path = require('path');
            const uploadsDir = path.join(process.cwd(), 'uploads');
            const filePath = path.join(uploadsDir, oldFileName);
            
            if (fs.existsSync(filePath)) {
              await dbAsync.run(
                'UPDATE tracks SET file_path = ? WHERE id = ?',
                [newPath, track.id]
              );
              console.log(`[SYNC] Fixed path for track "${track.name}" (ID: ${track.id}): ${track.file_path} → ${newPath}`);
              results.fixedPaths++;
            } else {
              const errorMsg = `Could not fix path for track "${track.name}": file not found`;
              console.warn(`[SYNC] ${errorMsg}`);
              results.errors.push(errorMsg);
            }
          }
        } catch (error) {
          const errorMsg = `Failed to fix path for track "${track.name}": ${error instanceof Error ? error.message : 'Unknown error'}`;
          console.error(`[SYNC] ${errorMsg}`);
          results.errors.push(errorMsg);
        }
      }
    }
    
    // Add missing tracks to database
    if (actions.addMissing && integrity.missingFiles.length > 0) {
      console.log('[SYNC] Adding missing tracks to database:', integrity.missingFiles);
      
      for (const item of integrity.missingFiles) {
        try {
          // Extract basic metadata from filename
          const fileName = item.fileName;
          const name = fileName.replace(/\.(mp3|wav|m4a)$/i, '').replace(/^\d+-/, '');
          
          // Get test user ID
          const testUser = await dbAsync.get(
            'SELECT id FROM users WHERE email = ?',
            ['test@example.com']
          );
          
          if (!testUser) {
            throw new Error('Test user not found');
          }
          
          // Add track to database
          await dbAsync.run(
            'INSERT INTO tracks (id, name, duration, user_id, file_path, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [uuidv4(), name, 0, testUser.id, `/uploads/${fileName}`, Math.floor(Date.now() / 1000), Math.floor(Date.now() / 1000)]
          );
          
          console.log(`[SYNC] Added missing track to database: ${name} (${fileName})`);
          results.addedTracks++;
        } catch (error) {
          const errorMsg = `Failed to add missing track "${item.track.name}": ${error instanceof Error ? error.message : 'Unknown error'}`;
          console.error(`[SYNC] ${errorMsg}`);
          results.errors.push(errorMsg);
        }
      }
    }
    
    console.log('[SYNC] Sync completed with results:', results);
    return {
      success: true,
      data: results
    };
    
  } catch (error) {
    console.error('[IPC] Database sync error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
});

