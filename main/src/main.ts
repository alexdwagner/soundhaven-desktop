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
  const port = 3001;
  
  if (isDev) {
    // Wait for Next.js to be ready
    await waitForNextJS(port);
    await mainWindow.loadURL(`http://localhost:${port}`);
  } else {
    await mainWindow.loadFile(path.join(__dirname, '../frontend/dist/index.html'));
  }
  console.log(`Window loading URL: ${isDev ? 'Dev' : 'Production'} mode, port: ${port}`);

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

app.whenReady().then(async () => {
  try {
    // Start audio HTTP server
    startAudioServer();
    
    // Initialize database
    await setupDatabase();
    
    // Create test user
    await ensureTestUser();
    
    // Create main window
    createMainWindow();
  } catch (error) {
    console.error('Error during app initialization:', error);
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
  try {
    const url = new URL(endpoint, 'http://localhost:3001');
    const requestPath = url.pathname;
    
    console.log('API Request:', { endpoint, method, requestPath });
    
    // Handle authentication routes
    if (requestPath === '/api/auth/register' && method === 'POST') {
      const { name, email, password } = body;
      if (!name || !email || !password) {
        throw new Error('Name, email, and password are required');
      }
      return await authHandlers.register({ name, email, password });
    }
    
    if (requestPath === '/api/auth/login' && method === 'POST') {
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
    
    if (requestPath === '/api/auth/refresh' && method === 'POST') {
      const { refreshToken } = body;
      if (!refreshToken) {
        throw new Error('Refresh token is required');
      }
      return await authHandlers.refreshToken({ refreshToken });
    }
    
    if (requestPath === '/api/auth/logout' && method === 'POST') {
      const { refreshToken } = body;
      if (!refreshToken) {
        throw new Error('Refresh token is required');
      }
      return await authHandlers.logout({ refreshToken });
    }
    
    // Normalize path to handle both /api/ and / paths for other API requests
    let normalizedPath = requestPath;
    if (!normalizedPath.startsWith('/api/') && normalizedPath.startsWith('/')) {
      normalizedPath = `/api${normalizedPath}`;
    }
    
    // Route the request to the appropriate handler
    if (normalizedPath.startsWith('/api/auth/')) {
      const action = normalizedPath.split('/').pop();
      
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
    } else if (normalizedPath.startsWith('/api/tracks') && method === 'GET') {
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
    } else if (normalizedPath.startsWith('/api/playlists') && method === 'GET') {
      const result = await dbAsync.all('SELECT * FROM playlists');
      return { data: result };
    } else if (normalizedPath.startsWith('/api/users') && method === 'GET') {
      const result = await ipcMain.handle('getUsers', () => []);
      return { data: result };
    } else if (normalizedPath.startsWith('/api/user') && method === 'GET') {
      const userId = url.searchParams.get('id');
      const result = await ipcMain.handle('getUser', () => ({}));
      return { data: result };
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

// Function to start audio HTTP server
function startAudioServer() {
  const port = 3000;
  
  audioServer = http.createServer((req, res) => {
    if (req.url?.startsWith('/audio/')) {
      const fileName = req.url.replace('/audio/', '');
      const filePath = path.join(process.cwd(), '..', 'public', fileName);
      
      console.log('Audio request:', {
        url: req.url,
        fileName,
        filePath,
        exists: fs.existsSync(filePath)
      });
      
      if (fs.existsSync(filePath)) {
        const stat = fs.statSync(filePath);
        const fileStream = fs.createReadStream(filePath);
        
        res.writeHead(200, {
          'Content-Type': 'audio/mpeg',
          'Content-Length': stat.size,
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD',
          'Access-Control-Allow-Headers': 'Range'
        });
        
        fileStream.pipe(res);
      } else {
        console.log('Audio file not found:', filePath);
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('File not found');
      }
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
    }
  });
  
  audioServer.listen(port, () => {
    console.log(`✅ Audio server running on port ${port}`);
  });
  
  audioServer.on('error', (error) => {
    console.error('Audio server error:', error);
  });
}

// Function to stop audio HTTP server
function stopAudioServer() {
  if (audioServer) {
    audioServer.close();
    audioServer = null;
    console.log('Audio server stopped');
  }
}

