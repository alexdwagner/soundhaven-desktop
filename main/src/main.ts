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
      const testTrackPath = '/audio/careless_whisper.mp3';
      
      // Check if the file exists in the public directory
      const publicDir = path.join(process.cwd(), 'public');
      const filePath = path.join(publicDir, 'careless_whisper.mp3');
      
      if (!fs.existsSync(filePath)) {
        console.error(`Test track file not found at ${filePath}`);
        return;
      }
      
      await dbAsync.run(
        'INSERT INTO tracks (name, duration, user_id, file_path, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        ['Careless Whisper', 300, testUser.id, testTrackPath, Math.floor(Date.now() / 1000), Math.floor(Date.now() / 1000)]
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
  console.log('[API DEBUG] Incoming:', { endpoint, method, body });
  try {
    const url = new URL(endpoint, `http://localhost:${config.audioServerPort}`);
    const normalizedPath = url.pathname;
    
    console.log('API Request:', { endpoint, method, normalizedPath });
    
    // Handle authentication routes
    if (normalizedPath === '/api/auth/register' && method === 'POST') {
      const { name, email, password } = body;
      if (!name || !email || !password) {
        throw new Error('Name, email, and password are required');
      }
      return await authHandlers.register({ name, email, password });
    }
    
    if (normalizedPath === '/api/auth/login' && method === 'POST') {
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
      const result = await dbAsync.all('SELECT * FROM tracks');
      console.log('Raw tracks from database:', result);
      // Map snake_case to camelCase
      const mapped = result.map(track => ({
        id: track.id,
        name: track.name,
        duration: track.duration,
        artistId: track.artist_id,
        albumId: track.album_id,
        userId: track.user_id,
        filePath: track.file_path,
        createdAt: track.created_at,
        updatedAt: track.updated_at
      }));
      console.log('Mapped tracks:', mapped);
      return { data: mapped };
    } else if (apiPath.startsWith('/api/playlists') && method === 'GET') {
      const result = await dbAsync.all('SELECT * FROM playlists');
      return { data: result };
    } else if (apiPath.startsWith('/api/users') && method === 'GET') {
      const result = await ipcMain.handle('getUsers', () => []);
      return { data: result };
    } else if (apiPath.startsWith('/api/user') && method === 'GET') {
      const userId = url.searchParams.get('id');
      const result = await ipcMain.handle('getUser', () => ({}));
      return { data: result };
    } else if (apiPath.startsWith('/api/comments') && method === 'GET' && !apiPath.includes('/with-marker')) {
      console.log('[API DEBUG] Matched /api/comments GET');
      const trackId = url.searchParams.get('trackId');
      const page = parseInt(url.searchParams.get('page') || '1', 10);
      const limit = parseInt(url.searchParams.get('limit') || '10', 10);
      
      if (!trackId) {
        console.error('[API DEBUG] Missing trackId query parameter');
        return { error: 'Missing trackId parameter', status: 400 };
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
        const commentResult = await dbAsync.run(
          'INSERT INTO comments (content, track_id, user_id, created_at) VALUES (?, ?, ?, ?)',
          [content, trackId, userId, now]
        );
        
        if (!commentResult || !commentResult.lastID) {
          console.error('[API DEBUG] Failed to insert comment, no lastID returned');
          return { error: 'Failed to create comment', status: 500 };
        }
        
        const commentId = commentResult.lastID;
        console.log('[API DEBUG] Comment created with ID:', commentId);
        
        // Insert marker
        const regionId = `region_${commentId}_${Date.now()}`;
        console.log('[API DEBUG] Inserting marker:', { regionId, time, commentId, trackId });
        const markerResult = await dbAsync.run(
          'INSERT INTO markers (wave_surfer_region_id, time, duration, comment_id, track_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
          [regionId, time, 0.5, commentId, trackId, now]
        );
        
        if (!markerResult || !markerResult.lastID) {
          console.error('[API DEBUG] Failed to insert marker, no lastID returned');
          // Attempt to rollback the comment
          try {
            await dbAsync.run('DELETE FROM comments WHERE id = ?', [commentId]);
            console.log('[API DEBUG] Rolled back comment:', commentId);
          } catch (rollbackError) {
            console.error('[API DEBUG] Failed to rollback comment:', rollbackError);
          }
          return { error: 'Failed to create marker', status: 500 };
        }
        
        const markerId = markerResult.lastID;
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
    }
    
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
    
    // Extract metadata
    let metadata = {
      duration: 0,
      artist: null,
      album: null,
      title: fileName.replace(/\.[^/.]+$/, ''), // Remove extension for title
      bitrate: 0,
      sampleRate: 0,
      channels: 0
    };
    
    // TODO: Add music-metadata extraction when package is installed
    // For now, use basic filename parsing
    console.log(`[UPLOAD] Using basic metadata extraction for ${fileName}`);
    console.log(`[UPLOAD] Extracted title: ${metadata.title}`);
    
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
    const trackResult = await dbAsync.run(
      `INSERT INTO tracks (
        name, duration, artist_id, album_id, user_id, file_path, 
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        metadata.title,
        metadata.duration,
        artistId,
        albumId,
        userId,
        `/uploads/${uniqueFileName}`,
        Math.floor(Date.now() / 1000),
        Math.floor(Date.now() / 1000)
      ]
    );
    
    const trackId = trackResult.lastID;
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
    const uploadsDir = path.join(process.cwd(), 'uploads');
    const absolutePath = path.resolve(uploadsDir, filePath.replace('uploads/', ''));
    const fileUrl = `file://${absolutePath}`;
    console.log('[IPC] Converted filePath to file URL:', { filePath, fileUrl });
    return fileUrl;
  } catch (error) {
    console.error('[IPC] Error converting file path to URL:', error);
    throw error;
  }
});

