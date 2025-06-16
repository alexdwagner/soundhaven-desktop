import { app, BrowserWindow, ipcMain } from "electron";
import nodePath from "path";
import { verify } from "jsonwebtoken";
import { db } from "./db";
import { users, tracks, playlists, artists, albums, refreshTokens } from "./schema";
import { 
  generateJWT, 
  generateRefreshToken, 
  verifyPassword, 
  hashPassword, 
  refreshAccessToken, 
  invalidateRefreshToken 
} from "./utils/auth";
import { 
  eq, 
  and, 
  or, 
  desc, 
  asc, 
  like, 
  sql, 
  notInArray, 
  inArray, 
  gt, 
  lt, 
  gte, 
  lte, 
  isNull, 
  isNotNull,
  count
} from "drizzle-orm";
import { config } from "./config";
import dotenv from 'dotenv';

dotenv.config();

let mainWindow: BrowserWindow | null = null;

async function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: nodePath.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  console.log("mainWindow started");

  const isDev = !app.isPackaged; // Check if we're in dev mode

  await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait to ensure Next.js is ready

  const port = 3000;
  
  if (isDev) {
    await mainWindow.loadURL(`http://localhost:${port}`);
  } else {
    await mainWindow.loadFile(nodePath.join(__dirname, '../frontend/out/index.html'));
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

app.whenReady().then(createMainWindow);

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  console.log("App is quitting...");
  mainWindow = null;
});

// ✅ IPC communication test
ipcMain.on("ping", (event, message) => {
  console.log("Received message from frontend:", message);
  event.reply("pong", "Hello from Electron!");
});

ipcMain.handle("getUsers", async () => {
  try {
    const result = await db.select().from(users);
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
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email));
      
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
    await db.transaction(async (tx) => {
      // Invalidate any existing refresh tokens for this user
      await tx
        .delete(refreshTokens)
        .where(eq(refreshTokens.userId, user.id));
      
      // Store new refresh token
      await tx.insert(refreshTokens).values({
        token: refreshToken,
        userId: user.id,
        expiresIn: expiresIn
      });
      
      // Update user's updatedAt timestamp
      await tx
        .update(users)
        .set({ updatedAt: Math.floor(Date.now() / 1000) })
        .where(eq(users.id, user.id));
    });

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
    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.email, email));
      
    if (existing) {
      throw new Error('Email already registered');
    }
    
    // Hash password
    const hashedPassword = await hashPassword(password);
    const now = Math.floor(Date.now() / 1000);
    
    // Start transaction
    const result = await db.transaction(async (tx) => {
      // Create user
      const [newUser] = await tx
        .insert(users)
        .values({
          name,
          email,
          password: hashedPassword,
          createdAt: now,
          updatedAt: now
        })
        .returning();
      
      // Generate tokens
      const accessToken = generateJWT(newUser.id);
      const refreshToken = generateRefreshToken(newUser.id);
      const expiresIn = Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60); // 7 days from now
      
      // Store refresh token
      await tx.insert(refreshTokens).values({
        token: refreshToken,
        userId: newUser.id,
        expiresIn: expiresIn
      });
      
      return { user: newUser, accessToken, refreshToken };
    });

    // Return user data (excluding password)
    const { password: pwd, ...userData } = result.user;
    
    return {
      user: userData,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken
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
      const [existing] = await db
        .select()
        .from(users)
        .where(eq(users.email, email));
        
      if (existing) {
        throw new Error('Email already registered');
      }
      
      // Hash password
      const hashedPassword = await hashPassword(password);
      const now = Math.floor(Date.now() / 1000);
      
      // Start transaction
      const result = await db.transaction(async (tx) => {
        // Create user
        const [newUser] = await tx
          .insert(users)
          .values({
            name,
            email,
            password: hashedPassword,
            createdAt: now,
            updatedAt: now
          })
          .returning();
        
        // Generate tokens
        const accessToken = generateJWT(newUser.id);
        const refreshToken = generateRefreshToken(newUser.id);
        const expiresIn = Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60); // 7 days from now
        
        // Store refresh token
        await tx.insert(refreshTokens).values({
          token: refreshToken,
          userId: newUser.id,
          expiresIn: expiresIn
        });
        
        return { user: newUser, accessToken, refreshToken };
      });

      // Return user data (excluding password)
      const { password: pwd, ...userData } = result.user;
      
      return {
        user: userData,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken
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
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, email));
        
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
      await db.transaction(async (tx) => {
        // Invalidate any existing refresh tokens for this user
        await tx
          .delete(refreshTokens)
          .where(eq(refreshTokens.userId, user.id));
        
        // Store new refresh token
        await tx.insert(refreshTokens).values({
          token: refreshToken,
          userId: user.id,
          expiresIn: expiresIn
        });
        
        // Update user's updatedAt timestamp
        await tx
          .update(users)
          .set({ updatedAt: Math.floor(Date.now() / 1000) })
          .where(eq(users.id, user.id));
      });

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
      const [token] = await db
        .select()
        .from(refreshTokens)
        .where(
          and(
            eq(refreshTokens.token, refreshToken),
            gte(refreshTokens.expiresIn, Math.floor(Date.now() / 1000))
          )
        );
      
      if (!token) {
        throw new Error('Invalid or expired refresh token');
      }
      
      // Generate new tokens
      const newAccessToken = generateJWT(payload.userId);
      const newRefreshToken = generateRefreshToken(payload.userId);
      const expiresIn = Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60); // 7 days from now
      
      // Update the refresh token in the database
      await db.transaction(async (tx) => {
        await tx
          .delete(refreshTokens)
          .where(eq(refreshTokens.token, refreshToken));
          
        await tx.insert(refreshTokens).values({
          token: newRefreshToken,
          userId: payload.userId,
          expiresIn: expiresIn
        });
      });
      
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
      await db
        .delete(refreshTokens)
        .where(eq(refreshTokens.token, refreshToken));
      
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
    const url = new URL(endpoint, 'http://localhost:3000');
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
      const result = await ipcMain.handle('getTracks', () => []);
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
    const result = await db.select().from(tracks);
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
      [user] = await db.select().from(users).where(eq(users.id, userId));
    } else {
      // If no userId provided, get the first user (for demo purposes)
      // In a real app, you'd get the currently logged-in user
      [user] = await db.select().from(users).limit(1);
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
  return db.select().from(artists);
});

ipcMain.handle('music:create-artist', async (_, artistData) => {
  const [artist] = await db.insert(artists).values(artistData).returning();
  return artist;
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
    
    tokenStore.accessToken = result.accessToken;
    tokenStore.refreshToken = result.refreshToken;
    
    return {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken
    };
  } catch (error) {
    console.error('Error refreshing token:', error);
    // Clear tokens on error
    tokenStore.accessToken = null;
    tokenStore.refreshToken = null;
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
  } finally {
    // Always clear tokens
    tokenStore.accessToken = null;
    tokenStore.refreshToken = null;
  }
  return { success: true };
});

