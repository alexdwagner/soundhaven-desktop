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
import { startAudioServer } from './audioServer';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

let mainWindow: BrowserWindow | null = null;
let audioServer: http.Server | null = null;

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
      // Verify the refresh token
      const payload = verify(refreshToken, process.env.JWT_SECRET!) as { userId: number };
      if (!payload || !payload.userId) {
        throw new Error('Invalid refresh token');
      }
      
      // Check if the refresh token exists in the database
      const token = await dbAsync.get(
        'SELECT * FROM refresh_tokens WHERE token = ? AND expires_in >= ?',
        [refreshToken, Math.floor(Date.now() / 1000)]
      );
      
      if (!token) {
        throw new Error('Invalid or expired refresh token');
      }
      
      // Generate new tokens
      const newAccessToken = generateJWT(payload.userId);
      const newRefreshToken = generateRefreshToken(payload.userId);
      const expiresIn = Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60); // 7 days from now
      
      // Update the refresh token in the database
      await dbAsync.run(
        'DELETE FROM refresh_tokens WHERE token = ?',
        [refreshToken]
      );
      
      await dbAsync.run(
        'INSERT INTO refresh_tokens (token, user_id, expires_in) VALUES (?, ?, ?)',
        [newRefreshToken, payload.userId, expiresIn]
      );
      
      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken
      };
    } catch (error) {
      console.error('Token refresh error:', error);
      throw new Error('Failed to refresh token');
    }
  },
  
  async logout(credentials: { refreshToken: string }) {
    const { refreshToken } = credentials;
    
    try {
      // Remove the refresh token from the database
      await dbAsync.run(
        'DELETE FROM refresh_tokens WHERE token = ?',
        [refreshToken]
      );
      
      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      throw new Error('Failed to logout');
    }
  }
};

// API Request Handler
ipcMain.handle('api-request', async (event, { endpoint, method = 'GET', body = null, headers = {} }) => {
  console.log('🔥 [IPC HANDLER] api-request called!');
  console.log('🔥 [IPC HANDLER] endpoint:', endpoint);
  console.log('🔥 [IPC HANDLER] method:', method);
  console.log('🔥 [IPC HANDLER] body:', body);
  console.log('🔥 [IPC HANDLER] headers:', headers);
  
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
      const filePath = path.join(process.cwd(), 'public', fileName);
      console.log('[AUDIO DEBUG] Requested:', filePath);
      if (!fs.existsSync(filePath)) {
        console.log('[AUDIO DEBUG] File not found:', filePath);
        return { status: 404, error: 'File not found' };
      }
      const fileBuffer = fs.readFileSync(filePath);
      return {
        headers: {
          'Content-Type': 'audio/mpeg', // You may want to use mime-types for other formats
          'Content-Length': fileBuffer.length,
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
    console.log('API Request:', { endpoint, method, apiPath });
    console.log('[DRAG N DROP] 🔍 Backend: All incoming request debug');
    console.log('[DRAG N DROP] 🔍 Backend: endpoint:', endpoint);
    console.log('[DRAG N DROP] 🔍 Backend: method:', method);
    console.log('[DRAG N DROP] 🔍 Backend: apiPath:', apiPath);
    console.log('[DRAG N DROP] 🔍 Backend: normalizedPath:', normalizedPath);
    if (apiPath.startsWith('/api/auth/')) {
      const action = apiPath.split('/').pop();
      
      if (action === 'login' && method === 'POST') {
        const result = await ipcMain.handle('auth:login', () => body);
        return { data: result };
      } else if (action === 'register' && method === 'POST') {
        const result = await ipcMain.handle('auth:register', () => body);
        return { data: result };
      } else if (action === 'refresh' && method === 'POST') {
        const result = await ipcMain.handle('auth:refresh', () => body);
        return { data: result };
      }
    } else if (apiPath.startsWith('/api/tracks') && method === 'GET') {
      console.log('Tracks API request received');
      console.log('[TRACKS DEBUG] Database path:', config.database.path);
      console.log('[TRACKS DEBUG] Database connection status:', dbAsync ? 'connected' : 'not connected');
      
      try {
        // For local desktop app, return all tracks since authentication is simpler
        // We can add user filtering later if needed
        console.log('🔥 [TRACKS DEBUG] About to query database...');
        console.log('🔥 [TRACKS DEBUG] Database path:', config.database.path);
        
        const result = await dbAsync.all(`
          SELECT t.*, 
                 a.name as artist_name,
                 al.name as album_name
          FROM tracks t
          LEFT JOIN artists a ON t.artist_id = a.id
          LEFT JOIN albums al ON t.album_id = al.id
        `);
        
        console.log('🔥 [TRACKS DEBUG] Query completed successfully');
        console.log('🔥 [TRACKS DEBUG] Raw result from database:');
        console.log('🔥 [TRACKS DEBUG] Number of tracks found:', result.length);
        
        // Log first few tracks with all details
        result.slice(0, 3).forEach((track, index) => {
          console.log(`🔥 [TRACKS DEBUG] Track ${index + 1}:`, {
            id: track.id,
            name: track.name,
            artist_id: track.artist_id,
            artist_name: track.artist_name,
            album_id: track.album_id,
            album_name: track.album_name,
            year: track.year,
            genre: track.genre,
            bitrate: track.bitrate,
            duration: track.duration
          });
        });
        
        // Map snake_case to camelCase and include artist/album names
        console.log('🔥 [TRACKS DEBUG] Starting mapping process...');
        const mapped = result.map((track, index) => {
          const mappedTrack = {
            id: track.id,
            name: track.name,
            duration: track.duration,
            artistId: track.artist_id,
            artistName: track.artist_name || null,
            albumId: track.album_id,
            albumName: track.album_name || null,
            userId: track.user_id,
            filePath: track.file_path,
            bitrate: track.bitrate,
            sampleRate: track.sample_rate,
            channels: track.channels,
            year: track.year,
            genre: track.genre,
            trackNumber: track.track_number,
            createdAt: track.created_at,
            updatedAt: track.updated_at
          };
          
          // Log first few mapped tracks
          if (index < 3) {
            console.log(`🔥 [TRACKS DEBUG] Mapped Track ${index + 1}:`, {
              name: mappedTrack.name,
              artistName: mappedTrack.artistName,
              albumName: mappedTrack.albumName,
              year: mappedTrack.year,
              artistId: mappedTrack.artistId
            });
          }
          
          return mappedTrack;
        });
        
        console.log('🔥 [TRACKS DEBUG] Mapping completed. Total mapped tracks:', mapped.length);
        console.log('🔥 [TRACKS DEBUG] Final response data structure:');
        console.log('🔥 [TRACKS DEBUG] Sample response (first track):', mapped[0] ? {
          name: mapped[0].name,
          artistName: mapped[0].artistName,
          albumName: mapped[0].albumName,
          year: mapped[0].year
        } : 'No tracks');
        
        const response = { data: mapped };
        console.log('🔥 [TRACKS DEBUG] About to return response with keys:', Object.keys(response));
        return response;
      } catch (error) {
        console.error('[TRACKS DEBUG] Database query failed:', error);
        return { error: 'Database query failed', status: 500 };
      }
    } else if (apiPath === '/api/playlists' && method === 'GET') {
      console.log('[API DEBUG] Matched GET /api/playlists');
      console.log('🔥 LINE 2');
      console.log('🔥 LINE 3');
      console.log('🎵 [PLAYLISTS DEBUG] Starting playlist fetch...');
      console.log('🔥 LINE 5');
      console.log('🎵 [PLAYLISTS DEBUG] Database path:', path.join(process.cwd(), 'db.sqlite'));
      console.log('🔥 LINE 7');
      
      try {
        console.log('🎵 [PLAYLISTS DEBUG] About to query playlists from database...');
        const playlists = await dbAsync.all(`
          SELECT p.*, u.name as user_name 
          FROM playlists p 
          LEFT JOIN users u ON p.user_id = u.id 
          ORDER BY p."order" ASC
        `);
        
        console.log('🎵 [PLAYLISTS DEBUG] Raw playlists from database:', playlists);
        console.log('🎵 [PLAYLISTS DEBUG] Number of playlists found:', playlists?.length || 0);
        
        if (!playlists || playlists.length === 0) {
          console.log('🎵 [PLAYLISTS DEBUG] No playlists found in database');
          return { data: [] };
        }
        
        console.log('🎵 [PLAYLISTS DEBUG] About to fetch tracks for each playlist...');
        
        const playlistsWithTracks = await Promise.all(playlists.map(async (playlist) => {
          console.log(`🎵 [PLAYLISTS DEBUG] Fetching tracks for playlist ${playlist.id}...`);
          
          const tracks = await dbAsync.all(`
            SELECT t.*, pt."order" as playlist_order,
                   a.name as artist_name,
                   al.name as album_name
            FROM tracks t
            JOIN playlist_tracks pt ON t.id = pt.track_id
            LEFT JOIN artists a ON t.artist_id = a.id
            LEFT JOIN albums al ON t.album_id = al.id
            WHERE pt.playlist_id = ?
            ORDER BY pt."order" ASC
          `, [playlist.id]);
          
          console.log(`🎵 [PLAYLISTS DEBUG] Found ${tracks?.length || 0} tracks for playlist ${playlist.id}`);
          
          const result = {
            id: playlist.id,
            name: playlist.name,
            description: playlist.description,
            userId: String(playlist.user_id),
            user: {
              id: String(playlist.user_id),
              name: playlist.user_name || 'Unknown User'
            },
            tracks: tracks.map(track => ({
              id: track.id,
              name: track.name,
              duration: track.duration,
              artistId: track.artist_id,
              artistName: track.artist_name || null,
              albumId: track.album_id,
              albumName: track.album_name || null,
              userId: track.user_id,
              filePath: track.file_path,
              bitrate: track.bitrate,
              sampleRate: track.sample_rate,
              channels: track.channels,
              year: track.year,
              genre: track.genre,
              trackNumber: track.track_number,
              createdAt: track.created_at,
              updatedAt: track.updated_at
            })),
            createdAt: playlist.created_at,
            updatedAt: playlist.updated_at
          };
          
          console.log(`🎵 [PLAYLISTS DEBUG] Processed playlist ${playlist.id}:`, result);
          return result;
        }));
        
        console.log('🎵 [PLAYLISTS DEBUG] Final playlists response:', playlistsWithTracks?.length || 0, 'playlists');
        console.log('🎵 [PLAYLISTS DEBUG] About to return data...');
        
        const response = { data: playlistsWithTracks };
        console.log('🎵 [PLAYLISTS DEBUG] Final response object:', response);
        
        return response;
      } catch (error) {
        console.error('🎵 [PLAYLISTS DEBUG] Error fetching playlists:', error);
        console.error('🎵 [PLAYLISTS DEBUG] Error stack:', (error as Error)?.stack);
        return { error: 'Failed to fetch playlists', status: 500 };
      }
    } else if (apiPath.match(/^\/api\/playlists\/[\w\d_-]+$/) && method === 'GET') {
      console.log('[API DEBUG] Matched GET /api/playlists/{id}');
      const playlistId = apiPath.split('/')[3];
      
      if (!playlistId) {
        return { error: 'Invalid playlist ID', status: 400 };
      }
      
      try {
        const playlist = await dbAsync.get(`
          SELECT p.*, u.name as user_name 
          FROM playlists p 
          LEFT JOIN users u ON p.user_id = u.id 
          WHERE p.id = ?
        `, [playlistId]);
        
        if (!playlist) {
          return { error: 'Playlist not found', status: 404 };
        }
        
        const tracks = await dbAsync.all(`
          SELECT t.*, pt."order" as playlist_order,
                 a.name as artist_name,
                 al.name as album_name
          FROM tracks t
          JOIN playlist_tracks pt ON t.id = pt.track_id
          LEFT JOIN artists a ON t.artist_id = a.id
          LEFT JOIN albums al ON t.album_id = al.id
          WHERE pt.playlist_id = ?
          ORDER BY pt."order" ASC
        `, [playlistId]);
        
        const result = {
          id: playlist.id,
          name: playlist.name,
          description: playlist.description,
          userId: String(playlist.user_id),
          user: {
            id: String(playlist.user_id),
            name: playlist.user_name || 'Unknown User'
          },
          tracks: tracks.map(track => ({
            id: track.id,
            name: track.name,
            duration: track.duration,
            artistId: track.artist_id,
            artistName: track.artist_name || null,
            albumId: track.album_id,
            albumName: track.album_name || null,
            userId: track.user_id,
            filePath: track.file_path,
            bitrate: track.bitrate,
            sampleRate: track.sample_rate,
            channels: track.channels,
            year: track.year,
            genre: track.genre,
            trackNumber: track.track_number,
            createdAt: track.created_at,
            updatedAt: track.updated_at
          })),
          createdAt: playlist.created_at,
          updatedAt: playlist.updated_at
        };
        
        return { data: result };
      } catch (error) {
        console.error('[API DEBUG] Error fetching playlist:', error);
        return { error: 'Failed to fetch playlist', status: 500 };
      }
    } else if (apiPath === '/api/playlists' && method === 'POST') {
      console.log('[IPC HANDLER] Received POST /api/playlists request');
      console.log('[API DEBUG] Matched POST /api/playlists');
      console.log('[API DEBUG] Request body:', body);
      const { name, description } = body as { name: string; description?: string };
      
      if (!name) {
        console.log('[API DEBUG] Playlist name is required');
        return { error: 'Playlist name is required', status: 400 };
      }
      
      // For now, use a default user ID (1) - you might want to get this from token
      const userId = 1;
      const now = Math.floor(Date.now() / 1000);
      const playlistId = uuidv4();
      
      console.log('[API DEBUG] Creating playlist with data:', { playlistId, name, description, userId });
      
      try {
        const result = await dbAsync.run(
          'INSERT INTO playlists (id, name, description, user_id, "order") VALUES (?, ?, ?, ?, ?)',
          [playlistId, name, description || '', userId, 0]
        );
        
        console.log('[API DEBUG] INSERT result:', result);
        
        if (result.changes === 0) {
          console.log('[API DEBUG] Failed to create playlist - no changes');
          return { error: 'Failed to create playlist', status: 500 };
        }
        
        const newPlaylist = await dbAsync.get('SELECT * FROM playlists WHERE id = ?', [playlistId]);
        console.log('[API DEBUG] Retrieved new playlist:', newPlaylist);
        
        if (!newPlaylist) {
          console.log('[API DEBUG] Failed to retrieve created playlist');
          return { error: 'Failed to retrieve created playlist', status: 500 };
        }
        
        // Return with proper structure
        const playlistData = {
          id: newPlaylist.id,
          name: newPlaylist.name,
          description: newPlaylist.description,
          userId: String(newPlaylist.user_id),
          user: {
            id: String(newPlaylist.user_id),
            name: 'Test User' // TODO: Get actual user name
          },
          tracks: [],
          createdAt: now,
          updatedAt: now
        };
        
        console.log('[API DEBUG] Returning playlist data:', playlistData);
        const response = { data: playlistData };
        console.log('[API DEBUG] Final response:', response);
        return response;
      } catch (error) {
        console.error('[API DEBUG] Error creating playlist:', error);
        return { error: 'Failed to create playlist', status: 500 };
      }
    } else if (apiPath.match(/^\/api\/playlists\/[\w\d_-]+$/) && method === 'DELETE') {
      console.log('[API DEBUG] Matched DELETE /api/playlists/{id}');
      const playlistId = apiPath.split('/')[3];
      
      try {
        // Delete playlist tracks first
        await dbAsync.run('DELETE FROM playlist_tracks WHERE playlist_id = ?', [playlistId]);
        
        // Delete playlist
        const result = await dbAsync.run('DELETE FROM playlists WHERE id = ?', [playlistId]);
        
        if (result.changes === 0) {
          return { error: 'Playlist not found', status: 404 };
        }
        
        return { data: { success: true } };
      } catch (error) {
        console.error('[API DEBUG] Error deleting playlist:', error);
        return { error: 'Failed to delete playlist', status: 500 };
      }
    } else if (apiPath.match(/^\/api\/playlists\/[\w\d_-]+\/tracks\/[\w\d_-]+$/) && method === 'POST') {
      console.log('[API DEBUG] Matched POST /api/playlists/{id}/tracks/{trackId}');
      console.log('[DRAG N DROP] 🔥 Backend: Add track to playlist endpoint hit');
      console.log('[DRAG N DROP] 🔥 Backend: apiPath:', apiPath);
      console.log('[DRAG N DROP] 🔥 Backend: method:', method);
      console.log('[DRAG N DROP] 🔥 Backend: url.searchParams:', url.searchParams.toString());
      
      const pathParts = apiPath.split('/');
      const playlistId = pathParts[3];
      const trackId = pathParts[5];
      const force = url.searchParams.get('force') === 'true';
      
      console.log('[DRAG N DROP] 🔥 Backend: Extracted playlistId:', playlistId);
      console.log('[DRAG N DROP] 🔥 Backend: Extracted trackId:', trackId);
      console.log('[DRAG N DROP] 🔥 Backend: Force flag:', force);
      
      try {
        // Check if track already exists in playlist
        const existing = await dbAsync.get(
          'SELECT * FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?',
          [playlistId, trackId]
        );
        
        if (existing && !force) {
          return { 
            error: 'Track already exists in playlist', 
            status: 409,
            data: { status: 'DUPLICATE', message: 'Track already exists in playlist', playlistId, trackId }
          };
        }
        
        if (!existing) {
          // Get the highest order number for this playlist
          const maxOrder = await dbAsync.get(
            'SELECT MAX("order") as max_order FROM playlist_tracks WHERE playlist_id = ?',
            [playlistId]
          );
          
          const nextOrder = (maxOrder?.max_order || 0) + 1;
          
          await dbAsync.run(
            'INSERT INTO playlist_tracks (playlist_id, track_id, "order") VALUES (?, ?, ?)',
            [playlistId, trackId, nextOrder]
          );
        }
        
        return { data: { success: true } };
      } catch (error) {
        console.error('[API DEBUG] Error adding track to playlist:', error);
        return { error: 'Failed to add track to playlist', status: 500 };
      }
    } else if (apiPath === '/api/tracks/sync-metadata' && method === 'POST') {
      console.log('[API DEBUG] Matched POST /api/tracks/sync-metadata');
      
      try {
        console.log('🎵 [METADATA SYNC] Starting metadata sync process...');
        
        // Get all tracks from database
        const tracks = await dbAsync.all('SELECT * FROM tracks');
        console.log(`🎵 [METADATA SYNC] Found ${tracks.length} tracks to process`);
        
        let processed = 0;
        let updated = 0;
        let errors = 0;
        const results = [];
        
        for (const track of tracks) {
          processed++;
          console.log(`🎵 [METADATA SYNC] Processing ${processed}/${tracks.length}: ${track.name}`);
          
          try {
            // Check if track already has metadata
            if (track.bitrate !== null && track.duration > 0) {
              console.log(`🎵 [METADATA SYNC] Track already has metadata, skipping...`);
              results.push({ trackId: track.id, status: 'skipped', reason: 'Already has metadata' });
              continue;
            }
            
            // Construct full file path
            const fullPath = path.join(process.cwd(), track.file_path.replace(/^\/uploads\//, 'uploads/'));
            console.log(`🎵 [METADATA SYNC] Processing file: ${fullPath}`);
            
            // Check if file exists
            try {
              await fs.promises.access(fullPath);
            } catch (error) {
              console.log(`❌ [METADATA SYNC] File not found: ${fullPath}`);
              errors++;
              results.push({ trackId: track.id, status: 'error', reason: 'File not found' });
              continue;
            }
            
            // Extract metadata from file
            const { MetadataService } = await import('./services/metadataService');
            const metadata = await MetadataService.extractFromFile(fullPath);
            console.log(`🎵 [METADATA SYNC] Extracted metadata for ${track.name}:`, metadata);
            
            // Update database with extracted metadata
            await dbAsync.run(`
              UPDATE tracks 
              SET 
                name = ?,
                duration = ?,
                bitrate = ?,
                sample_rate = ?,
                channels = ?,
                year = ?,
                genre = ?,
                track_number = ?,
                updated_at = ?
              WHERE id = ?
            `, [
              metadata.title,
              metadata.duration,
              metadata.bitrate,
              metadata.sampleRate,
              metadata.channels,
              metadata.year,
              metadata.genre,
              metadata.trackNumber,
              Math.floor(Date.now() / 1000),
              track.id
            ]);
            
            // Process artists and albums if available
            let artistId = null;
            let albumId = null;
            
            if (metadata.artist) {
              // Find or create artist
              let artist = await dbAsync.get('SELECT id FROM artists WHERE name = ?', [metadata.artist]);
              
              if (!artist) {
                const result = await dbAsync.run(
                  'INSERT INTO artists (name, created_at, updated_at) VALUES (?, ?, ?)',
                  [metadata.artist, Math.floor(Date.now() / 1000), Math.floor(Date.now() / 1000)]
                );
                artistId = result.lastID;
                console.log(`✅ [METADATA SYNC] Created new artist: ${metadata.artist} (ID: ${artistId})`);
              } else {
                artistId = artist.id;
                console.log(`✅ [METADATA SYNC] Found existing artist: ${metadata.artist} (ID: ${artistId})`);
              }
              
              // Process album if available
              if (metadata.album) {
                let album = await dbAsync.get(
                  'SELECT id FROM albums WHERE name = ? AND artist_id = ?',
                  [metadata.album, artistId]
                );
                
                if (!album) {
                  const result = await dbAsync.run(
                    'INSERT INTO albums (name, release_date, artist_id) VALUES (?, ?, ?)',
                    [metadata.album, metadata.year || Math.floor(Date.now() / 1000), artistId]
                  );
                  albumId = result.lastID;
                  console.log(`✅ [METADATA SYNC] Created new album: ${metadata.album} (ID: ${albumId})`);
                } else {
                  albumId = album.id;
                  console.log(`✅ [METADATA SYNC] Found existing album: ${metadata.album} (ID: ${albumId})`);
                }
              }
              
              // Update track with artist and album IDs
              await dbAsync.run(
                'UPDATE tracks SET artist_id = ?, album_id = ? WHERE id = ?',
                [artistId, albumId, track.id]
              );
            }
            
            console.log(`✅ [METADATA SYNC] Updated track ${track.name} with metadata`);
            updated++;
            results.push({ 
              trackId: track.id, 
              status: 'updated', 
              metadata: {
                title: metadata.title,
                artist: metadata.artist,
                album: metadata.album,
                duration: metadata.duration,
                year: metadata.year
              }
            });
            
          } catch (error) {
            console.error(`❌ [METADATA SYNC] Error processing track ${track.name}:`, error);
            errors++;
            results.push({ 
              trackId: track.id, 
              status: 'error', 
              reason: error instanceof Error ? error.message : 'Unknown error' 
            });
          }
        }
        
        const summary = {
          processed,
          updated,
          errors,
          skipped: processed - updated - errors
        };
        
        console.log(`🎉 [METADATA SYNC] Metadata sync completed!`, summary);
        
        return { 
          data: { 
            summary,
            results 
          } 
        };
        
      } catch (error) {
        console.error('❌ [METADATA SYNC] Fatal error:', error);
        return { error: 'Metadata sync failed', status: 500 };
      }
    } else if (apiPath.match(/^\/api\/playlists\/[\w\d_-]+\/tracks\/[\w\d_-]+$/) && method === 'DELETE') {
      console.log('[API DEBUG] Matched DELETE /api/playlists/{id}/tracks/{trackId}');
      const pathParts = apiPath.split('/');
      const playlistId = pathParts[3];
      const trackId = pathParts[5];
      
      try {
        const result = await dbAsync.run(
          'DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?',
          [playlistId, trackId]
        );
        
        if (result.changes === 0) {
          return { error: 'Track not found in playlist', status: 404 };
        }
        
        return { data: { success: true } };
      } catch (error) {
        console.error('[API DEBUG] Error removing track from playlist:', error);
        return { error: 'Failed to remove track from playlist', status: 500 };
      }
    } else if (apiPath.match(/^\/api\/playlists\/[\w\d_-]+\/metadata$/) && method === 'PATCH') {
      console.log('[API DEBUG] Matched PATCH /api/playlists/{id}/metadata');
      const playlistId = apiPath.split('/')[3];
      const { name, description } = body as { name?: string; description?: string };
      
      try {
        const updates: string[] = [];
        const values: any[] = [];
        
        if (name !== undefined) {
          updates.push('name = ?');
          values.push(name);
        }
        
        if (description !== undefined) {
          updates.push('description = ?');
          values.push(description);
        }
        
        if (updates.length === 0) {
          return { error: 'No updates provided', status: 400 };
        }
        
        values.push(playlistId);
        
        await dbAsync.run(
          `UPDATE playlists SET ${updates.join(', ')} WHERE id = ?`,
          values
        );
        
        const updatedPlaylist = await dbAsync.get('SELECT * FROM playlists WHERE id = ?', [playlistId]);
        return { data: updatedPlaylist };
      } catch (error) {
        console.error('[API DEBUG] Error updating playlist metadata:', error);
        return { error: 'Failed to update playlist metadata', status: 500 };
      }
    } else if (apiPath === '/api/playlists/reorder' && method === 'PATCH') {
      console.log('[API DEBUG] Matched PATCH /api/playlists/reorder');
      const { playlistIds } = body as { playlistIds: string[] };
      
      if (!Array.isArray(playlistIds)) {
        return { error: 'playlistIds must be an array', status: 400 };
      }
      
      try {
        // Update order for each playlist
        await Promise.all(playlistIds.map((id, index) => 
          dbAsync.run('UPDATE playlists SET "order" = ? WHERE id = ?', [index, id])
        ));
        
        // Return updated playlists
        const updatedPlaylists = await dbAsync.all(`
          SELECT p.*, u.name as user_name 
          FROM playlists p 
          LEFT JOIN users u ON p.user_id = u.id 
          ORDER BY p."order" ASC
        `);
        
        return { data: updatedPlaylists };
      } catch (error) {
        console.error('[API DEBUG] Error reordering playlists:', error);
        return { error: 'Failed to reorder playlists', status: 500 };
      }
    } else if (apiPath.match(/^\/api\/playlists\/[\w\d_-]+\/track-order$/) && method === 'PATCH') {
      console.log('[API DEBUG] Matched PATCH /api/playlists/{id}/track-order');
      const playlistId = apiPath.split('/')[3];
      const { trackIds } = body as { trackIds: string[] };
      
      if (!Array.isArray(trackIds)) {
        return { error: 'trackIds must be an array', status: 400 };
      }
      
      try {
        // Update order for each track in the playlist
        await Promise.all(trackIds.map((trackId, index) => 
          dbAsync.run(
            'UPDATE playlist_tracks SET "order" = ? WHERE playlist_id = ? AND track_id = ?',
            [index, playlistId, trackId]
          )
        ));
        
        // Return updated playlist
        const playlist = await dbAsync.get('SELECT * FROM playlists WHERE id = ?', [playlistId]);
        return { data: playlist };
      } catch (error) {
        console.error('[API DEBUG] Error updating playlist track order:', error);
        return { error: 'Failed to update playlist track order', status: 500 };
      }
    } else if (apiPath.startsWith('/api/users') && method === 'GET') {
      const result = await ipcMain.handle('getUsers', () => []);
      return { data: result };
    } else if (apiPath.startsWith('/api/user') && method === 'GET') {
      const userId = url.searchParams.get('id');
      const result = await ipcMain.handle('getUser', () => ({}));
      return { data: result };
    } else if (apiPath.startsWith('/api/comments') && method === 'GET' && !apiPath.includes('/with-marker')) {
      console.log('[API DEBUG] Matched /api/comments GET');
      const trackIdParam = url.searchParams.get('trackId');
      const page = parseInt(url.searchParams.get('page') || '1', 10);
      const limit = parseInt(url.searchParams.get('limit') || '10', 10);
      
      if (!trackIdParam) {
        console.error('[API DEBUG] Missing trackId query parameter');
        return { error: 'Missing trackId parameter', status: 400 };
      }
      
      const trackId = trackIdParam;
      if (!trackId) {
        console.error('[API DEBUG] Invalid trackId parameter:', trackIdParam);
        return { error: 'Invalid trackId parameter', status: 400 };
      }
      
      try {
        console.log('[API DEBUG] Fetching comments for track:', trackId);
        
        // First get all comments for the track
        const comments = await dbAsync.all(
          'SELECT c.*, u.name as user_name FROM comments c LEFT JOIN users u ON c.user_id = u.id WHERE c.track_id = ? ORDER BY c.created_at DESC LIMIT ? OFFSET ?',
          [trackId, limit, (page - 1) * limit]
        );
        
        console.log('[API DEBUG] Found comments:', comments.length);
        
        // For each comment, check if it has an associated marker
        const commentsWithMarkers = await Promise.all(comments.map(async (comment) => {
          const marker = await dbAsync.get(
            'SELECT * FROM markers WHERE comment_id = ?',
            [comment.id]
          );
          
          return {
            id: comment.id,
            content: comment.content,
            trackId: comment.track_id,
            userId: comment.user_id,
            userName: comment.user_name || 'Unknown User',
            createdAt: comment.created_at,
            marker: marker ? {
              id: marker.id,
              time: marker.time,
              end: marker.time + (marker.duration || 0.5),
              duration: marker.duration || 0.5,
              trackId: marker.track_id,
              commentId: marker.comment_id,
              createdAt: marker.created_at,
              waveSurferRegionID: marker.wave_surfer_region_id,
              data: {
                customColor: "#FF0000", // Default color
                isVisible: true,
                isDraggable: true,
                isResizable: false
              }
            } : null
          };
        }));
        
        console.log('[API DEBUG] Processed comments with markers:', commentsWithMarkers.length);
        return { data: commentsWithMarkers };
      } catch (error) {
        console.error('[API DEBUG] Error fetching comments:', error);
        return { error: 'Failed to fetch comments', status: 500 };
      }
    } else if (apiPath.includes('/api/comments/with-marker') && method === 'POST') {
      console.log('[API DEBUG] Matched /api/comments/with-marker POST', { body });
      const { trackId, userId, content, time, color } = body as CreateCommentDto;
      
      // Validate required fields
      if (!trackId) {
        console.error('[API DEBUG] Missing trackId in request body');
        return { error: 'Missing trackId', status: 400 };
      }
      if (!userId) {
        console.error('[API DEBUG] Missing userId in request body');
        return { error: 'Missing userId', status: 400 };
      }
      if (!content) {
        console.error('[API DEBUG] Missing content in request body');
        return { error: 'Missing content', status: 400 };
      }
      if (typeof time !== 'number') {
        console.error('[API DEBUG] Missing or invalid time in request body:', time);
        return { error: 'Missing or invalid time', status: 400 };
      }
      
      const now = Math.floor(Date.now() / 1000);
      
      try {
      // Insert comment
        console.log('[API DEBUG] Inserting comment:', { content, trackId, userId, now });
      const commentId = uuidv4();
      const commentResult = await dbAsync.run(
        'INSERT INTO comments (id, content, track_id, user_id, created_at) VALUES (?, ?, ?, ?, ?)',
        [commentId, content, trackId, userId, now]
      );
        
        if (!commentResult || commentResult.changes === 0) {
          console.error('[API DEBUG] Failed to insert comment');
          return { error: 'Failed to create comment', status: 500 };
        }
        console.log('[API DEBUG] Comment created with ID:', commentId);
        
      // Insert marker
      const regionId = `region_${commentId}_${Date.now()}`;
        console.log('[API DEBUG] Inserting marker:', { regionId, time, commentId, trackId });
      const markerId = uuidv4();
      const markerResult = await dbAsync.run(
        'INSERT INTO markers (id, wave_surfer_region_id, time, duration, comment_id, track_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [markerId, regionId, time, 0.5, commentId, trackId, now]
      );
        
        if (!markerResult || markerResult.changes === 0) {
          console.error('[API DEBUG] Failed to insert marker');
          // Attempt to rollback the comment
          try {
            await dbAsync.run('DELETE FROM comments WHERE id = ?', [commentId]);
            console.log('[API DEBUG] Rolled back comment:', commentId);
          } catch (rollbackError) {
            console.error('[API DEBUG] Failed to rollback comment:', rollbackError);
          }
          return { error: 'Failed to create marker', status: 500 };
        }
        console.log('[API DEBUG] Marker created with ID:', markerId);
        
        // Fetch the new comment
      const comment = await dbAsync.get('SELECT * FROM comments WHERE id = ?', [commentId]);
        if (!comment) {
          console.error('[API DEBUG] Failed to fetch created comment with ID:', commentId);
          return { error: 'Failed to retrieve created comment', status: 500 };
        }
        
        // Fetch the new marker
      const marker = await dbAsync.get('SELECT * FROM markers WHERE id = ?', [markerId]);
        if (!marker) {
          console.error('[API DEBUG] Failed to fetch created marker with ID:', markerId);
          return { error: 'Failed to retrieve created marker', status: 500 };
        }
        
        // Get user info
        const user = await dbAsync.get('SELECT name FROM users WHERE id = ?', [userId]);
        const userName = user ? user.name : 'Unknown User';
        
        console.log('[API DEBUG] Created comment and marker:', { comment, marker });
        
        // Return in the format expected by the frontend
      return {
        data: {
          comment: {
            id: comment.id,
            content: comment.content,
            trackId: comment.track_id,
            userId: comment.user_id,
              userName: userName,
            createdAt: comment.created_at,
            marker: {
              id: marker.id,
              time: marker.time,
                end: marker.time + marker.duration,
                duration: marker.duration,
              trackId: marker.track_id,
              commentId: marker.comment_id,
              createdAt: marker.created_at,
              waveSurferRegionID: marker.wave_surfer_region_id,
                data: {
                  customColor: color || "#FF0000",
                  isVisible: true,
                  isDraggable: true,
                  isResizable: false
                }
            }
          }
        }
      };
      } catch (error) {
        console.error('[API DEBUG] Error creating comment with marker:', error);
        return { error: 'Failed to create comment with marker', status: 500 };
      }
    } else if (apiPath.match(/^\/api\/comments\/[\w\d_-]+$/) && method === 'DELETE') {
      console.log('[API DEBUG] Matched DELETE /api/comments/{id}');
      const commentId = apiPath.split('/')[3];
      
      if (!commentId) {
        console.error('[API DEBUG] Invalid comment ID in URL:', apiPath);
        return { error: 'Invalid comment ID', status: 400 };
      }
      
      try {
        console.log('[API DEBUG] Deleting comment with ID:', commentId);
        
        // First, delete the associated marker if it exists
        await dbAsync.run('DELETE FROM markers WHERE comment_id = ?', [commentId]);
        console.log('[API DEBUG] Deleted associated marker for comment ID:', commentId);
        
        // Then delete the comment
        const result = await dbAsync.run('DELETE FROM comments WHERE id = ?', [commentId]);
        console.log('[API DEBUG] Delete comment result:', result);
        
        if (result.changes === 0) {
          console.error('[API DEBUG] Comment not found with ID:', commentId);
          return { error: 'Comment not found', status: 404 };
        }
        
        console.log('[API DEBUG] Successfully deleted comment and marker:', commentId);
        return { data: null, status: 200 };
      } catch (error) {
        console.error('[API DEBUG] Error deleting comment:', error);
        return { error: 'Failed to delete comment', status: 500 };
      }
    } else if (apiPath.match(/^\/api\/comments\/[\w\d_-]+$/) && method === 'PUT') {
      console.log('[API DEBUG] Matched PUT /api/comments/{id}');
      const commentId = apiPath.split('/')[3];
      const { content } = body as { content: string };
      
      if (!commentId) {
        console.error('[API DEBUG] Invalid comment ID in URL:', apiPath);
        return { error: 'Invalid comment ID', status: 400 };
      }
      
      if (!content) {
        console.error('[API DEBUG] Missing content in request body');
        return { error: 'Missing content', status: 400 };
      }
      
      try {
        console.log('[API DEBUG] Updating comment with ID:', commentId, 'content:', content);
        
        // Update the comment
        const result = await dbAsync.run(
          'UPDATE comments SET content = ? WHERE id = ?',
          [content, commentId]
        );
        
        if (result.changes === 0) {
          console.error('[API DEBUG] Comment not found with ID:', commentId);
          return { error: 'Comment not found', status: 404 };
        }
        
        // Fetch the updated comment with user info
        const updatedComment = await dbAsync.get(
          'SELECT c.*, u.name as user_name FROM comments c LEFT JOIN users u ON c.user_id = u.id WHERE c.id = ?',
          [commentId]
        );
        
        if (!updatedComment) {
          console.error('[API DEBUG] Failed to fetch updated comment with ID:', commentId);
          return { error: 'Failed to retrieve updated comment', status: 500 };
        }
        
        // Also fetch associated marker if exists
        const marker = await dbAsync.get('SELECT * FROM markers WHERE comment_id = ?', [commentId]);
        
        const response = {
          id: updatedComment.id,
          content: updatedComment.content,
          trackId: updatedComment.track_id,
          userId: updatedComment.user_id,
          userName: updatedComment.user_name || 'Unknown User',
          createdAt: updatedComment.created_at,
          marker: marker ? {
            id: marker.id,
            time: marker.time,
            end: marker.time + (marker.duration || 0.5),
            duration: marker.duration || 0.5,
            trackId: marker.track_id,
            commentId: marker.comment_id,
            createdAt: marker.created_at,
            waveSurferRegionID: marker.wave_surfer_region_id,
            data: {
              customColor: "#FF0000",
              isVisible: true,
              isDraggable: true,
              isResizable: false
            }
          } : null
        };
        
        console.log('[API DEBUG] Successfully updated comment:', response);
        return { data: response, status: 200 };
      } catch (error) {
        console.error('[API DEBUG] Error updating comment:', error);
        return { error: 'Failed to update comment', status: 500 };
      }
    }
    
    console.log('[IPC HANDLER] No matching handler found for:', { method, endpoint, apiPath: apiPath || 'not set' });
    throw new Error(`No handler for ${method} ${endpoint}`);
  } catch (error) {
    console.error('API request error:', error);
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
    const { MetadataService } = await import('./services/metadataService');
    const metadata = await MetadataService.extractFromBuffer(fileBuffer, fileName);
    
    console.log(`[UPLOAD] Extracted metadata:`, metadata);
    
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
      } else {
        const albumResult = await dbAsync.run(
          'INSERT INTO albums (name, release_date, artist_id) VALUES (?, ?, ?)',
          [metadata.album, Math.floor(Date.now() / 1000), artistId]
        );
        albumId = albumResult.lastID;
        console.log(`[UPLOAD] Created new album with ID: ${albumId}`);
      }
    }
    
    console.log(`[UPLOAD] Inserting track into database...`);
    // Insert track into database
    const trackId = uuidv4();
    const trackResult = await dbAsync.run(
      `INSERT INTO tracks (
        id, name, duration, artist_id, album_id, user_id, file_path, 
        bitrate, sample_rate, channels, year, genre, track_number,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        Math.floor(Date.now() / 1000),
        Math.floor(Date.now() / 1000)
      ]
    );
    console.log(`[UPLOAD] Track saved with ID: ${trackId}`);
    
    // Fetch the complete track data
    const track = await dbAsync.get(
      `SELECT t.*, a.name as artist_name, al.name as album_name 
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
    
    console.log('🗄️ Tracks found in database:', tracksInDb.length);
    console.log('🗄️ Database tracks:', tracksInDb.map(t => ({ id: t.id, name: t.name, filePath: t.file_path })));
    
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

