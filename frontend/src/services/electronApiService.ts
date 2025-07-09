// This service handles all API and Electron IPC communication
// It automatically detects the environment and uses the appropriate method

import { 
  User, 
  RefreshToken, 
  Album, 
  Artist, 
  Track, 
  Marker, 
  Playlist 
} from '../../../shared/types';
import type { CreateCommentDto } from '@shared/dtos/create-comment.dto';
import type { Comment } from '@shared/types/comment';

// Define extended playlist type for API responses
interface ExtendedPlaylist extends Playlist {
  id: string;
  userId: string;
  user: User;
  tracks: Track[];
}

// Define types for API responses
interface ApiResponse<T> {
  data?: T;
  error?: string;
  status: number;
}

// Check if we're running in Electron
declare global {
  interface Window {
    electron?: {
      // Direct API methods
      getTracks: () => Promise<any>;
      getUser: () => Promise<any>;
      
      // IPC Renderer methods
      ipcRenderer: {
        invoke: (channel: string, ...args: any[]) => Promise<any>;
        on: (channel: string, func: (...args: any[]) => void) => void;
        removeListener: (channel: string, func: (...args: any[]) => void) => void;
      };
    };
  }
}

// Fix for SSR: Check if we're in browser and if electron is available
const isElectron = typeof window !== 'undefined' && !!window.electron?.ipcRenderer;

// Debug Electron detection
if (typeof window !== 'undefined') {
  console.log('🔍 [ELECTRON DETECTION] Running in browser');
  console.log('🔍 [ELECTRON DETECTION] window.electron exists:', !!window.electron);
  console.log('🔍 [ELECTRON DETECTION] window.electron.ipcRenderer exists:', !!window.electron?.ipcRenderer);
  console.log('🔍 [ELECTRON DETECTION] isElectron:', isElectron);
  
  // Additional debugging to understand the window.electron structure
  if (window.electron) {
    console.log('🔍 [ELECTRON DETECTION] window.electron keys:', Object.keys(window.electron));
    console.log('🔍 [ELECTRON DETECTION] window.electron.ipcRenderer type:', typeof window.electron.ipcRenderer);
  }
} else {
  console.log('🔍 [ELECTRON DETECTION] Running on server (SSR)');
}

// Base URL for API requests (only used in web mode)
const getBaseUrl = () => {
  if (isElectron) return ''; // In Electron, we use IPC
  return process.env.NEXT_PUBLIC_BACKEND_URL || '';
};

// Make an API request using the appropriate method based on the environment
const makeRequest = async <T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> => {
  // Special logging for drag and drop operations
  const isDragDropRequest = endpoint.includes('/playlists/') && endpoint.includes('/tracks/') && options.method === 'POST';
  if (isDragDropRequest) {
    console.log(`[DRAG N DROP] 🔌 NETWORK: makeRequest for drag and drop operation`);
    console.log(`[DRAG N DROP] 🔌 NETWORK: endpoint="${endpoint}", method="${options.method}"`);
  }
  
  console.log('🔌 [MAKE REQUEST] Starting makeRequest with:', { endpoint, method: options.method, isElectron });
  console.log('🔌 [MAKE REQUEST] window.electron available:', !!window.electron);
  console.log('🔌 [MAKE REQUEST] window.electron.ipcRenderer available:', !!window.electron?.ipcRenderer);
  
  if (isElectron) {
    // Use Electron IPC
    try {
      console.log('[MAKE REQUEST] Entering Electron IPC branch');
      // Parse the request body if it exists
      let parsedBody = null;
      if (options.body) {
        try {
          parsedBody = JSON.parse(options.body as string);
          console.log('[MAKE REQUEST] Parsed body:', parsedBody);
        } catch (e) {
          console.warn('Failed to parse request body as JSON:', e);
          parsedBody = options.body;
        }
      }
      
      const ipcRequestData = {
        endpoint,
        method: options.method || 'GET',
        headers: options.headers || {},
        body: parsedBody,
      };
      
      console.log('🔌 [MAKE REQUEST] Making IPC request:', ipcRequestData);
      console.log('🔌 [MAKE REQUEST] About to call window.electron.ipcRenderer.invoke...');
      
      if (!window.electron?.ipcRenderer) {
        console.error('🔌 [MAKE REQUEST] ERROR: window.electron.ipcRenderer is not available!');
        console.error('🔌 [MAKE REQUEST] window object keys:', typeof window !== 'undefined' ? Object.keys(window) : 'window undefined');
        return {
          error: 'Electron IPC not available',
          status: 500
        };
      }

      console.log('🔌 [MAKE REQUEST] Making IPC call with data:', ipcRequestData);
      
      let response;
      try {
        response = await window.electron!.ipcRenderer.invoke('api-request', ipcRequestData);
        console.log('[MAKE REQUEST] IPC call successful');
      } catch (ipcError) {
        console.error('[MAKE REQUEST] IPC call failed:', ipcError);
        console.error('[MAKE REQUEST] IPC error type:', typeof ipcError);
        console.error('[MAKE REQUEST] IPC error message:', ipcError instanceof Error ? ipcError.message : String(ipcError));
        return {
          error: `IPC call failed: ${ipcError instanceof Error ? ipcError.message : String(ipcError)}`,
          status: 500
        };
      }
      
      console.log('[MAKE REQUEST] Raw IPC response received:', response);
      console.log('[MAKE REQUEST] Response type:', typeof response);
      console.log('[MAKE REQUEST] Response keys:', response && typeof response === 'object' ? Object.keys(response) : 'not an object');

      console.log('IPC response:', response);

      // Handle the response structure
      if (response?.error) {
        console.log('IPC response has error:', response.error);
        return {
          error: response.error,
          status: response.status || 500
        };
      }

      // If the response is already in the correct format, return it
      if (response?.data !== undefined) {
        console.log('IPC response has data property:', response.data);
        console.log('Data type:', typeof response.data);
        console.log('Data keys:', response.data && typeof response.data === 'object' ? Object.keys(response.data) : 'not an object');
        return {
          data: response.data,
          status: 200
        };
      }

      // Otherwise, wrap the response in a data property
      console.log('IPC response does not have data property, wrapping response:', response);
      return {
        data: response,
        status: 200
      };
    } catch (error) {
      console.error('[MAKE REQUEST] Error in Electron IPC branch:', error);
      console.error('[MAKE REQUEST] Error type:', typeof error);
      console.error('[MAKE REQUEST] Error message:', error instanceof Error ? error.message : String(error));
      console.error('[MAKE REQUEST] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      return {
        error: error instanceof Error ? error.message : 'Unknown error in IPC communication',
        status: 500
      };
    }
  } else {
    // Use fetch for web
    try {
      const response = await fetch(`${getBaseUrl()}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {}),
        },
        credentials: 'include',
      });

      const data = await response.json().catch(() => ({}));
      
      if (!response.ok) {
        return {
          error: data.message || 'Request failed',
          status: response.status,
        };
      }

      return { data, status: response.status };
    } catch (error) {
      console.error('API request failed:', error);
      return {
        error: error instanceof Error ? error.message : 'Network error',
        status: 0
      };
    }
  }
};

// Main service object
export const apiService = {
  // Debug function to test IPC communication
  async debugTest(data: any) {
    if (isElectron) {
      console.log('[DEBUG] Testing IPC communication...');
      try {
        const response = await window.electron!.ipcRenderer.invoke('debug:test', data);
        console.log('[DEBUG] IPC test response:', response);
        return response;
      } catch (error) {
        console.error('[DEBUG] IPC test error:', error);
        throw error;
      }
    } else {
      console.log('[DEBUG] Not in Electron environment');
      return { success: false, message: 'Not in Electron environment' };
    }
  },

  // ===== Auth Methods =====
  async login(credentials: { email: string; password: string }) {
    const { data, error } = await makeRequest<{ user: User; accessToken: string; refreshToken: string }>(
      '/api/auth/login',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      }
    );
    console.log('Login response:', { data, error });
    console.log('Login response data structure:', JSON.stringify(data, null, 2));

    if (error) {
      throw new Error(error);
    }

    if (!data?.user || !data.accessToken) {
      console.error('Invalid response structure:', {
        hasUser: !!data?.user,
        hasAccessToken: !!data?.accessToken,
        dataKeys: data ? Object.keys(data) : []
      });
      throw new Error('Invalid response from server');
    }

    await Promise.all([
      this.setUser(data.user),
      this.setToken(data.accessToken),
      data.refreshToken ? this.setRefreshToken(data.refreshToken) : Promise.resolve()
    ]);

    return { data, error: null };
  },

  async register(userData: { name: string; email: string; password: string }) {
    const { data, error } = await makeRequest<{ user: User; accessToken: string; refreshToken: string }>(
      '/auth/register',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      }
    );

    if (data?.user && data.accessToken) {
      this.setUser(data.user);
      this.setToken(data.accessToken);
      this.setRefreshToken(data.refreshToken);
    }

    return { data, error };
  },

  async refreshToken() {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      if (isElectron) {
        // Use Electron IPC for token refresh
        const result = await window.electron!.ipcRenderer.invoke('auth:refresh-token');
        if (result?.accessToken) {
          this.setToken(result.accessToken);
          if (result.refreshToken) {
            this.setRefreshToken(result.refreshToken);
          }
          return { data: result, error: null };
        }
      } else {
        // Fallback to HTTP for web
        const { data, error } = await makeRequest<{ accessToken: string; refreshToken: string }>(
          '/auth/refresh',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
          }
        );

        if (data?.accessToken) {
          this.setToken(data.accessToken);
          if (data.refreshToken) {
            this.setRefreshToken(data.refreshToken);
          }
          return { data, error: null };
        }
        return { data: null, error };
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
      // Clear tokens on refresh failure
      this.logout();
      return { data: null, error: error instanceof Error ? error.message : 'Token refresh failed' };
    }
    return { data: null, error: 'Token refresh failed' };
  },

  // ===== User Management =====
  async getUsers() {
    const { data, error } = await makeRequest<User[]>('/users');
    if (error) throw new Error(error);
    return data || [];
  },

  async getUserById(id: number) {
    const { data, error } = await makeRequest<User>(`/users/${id}`);
    if (error) throw new Error(error);
    return data;
  },

  // ===== Track Management =====
  async getTracks(): Promise<ApiResponse<Track[]>> {
    try {
      console.log('📡 [API SERVICE] Fetching tracks...');
      
      const user = this.getStoredUser();
      const headers: Record<string, string> = {};
      if (user?.id) {
        headers['x-user-id'] = user.id.toString();
      }
      
      const response = await makeRequest<Track[]>('/api/tracks', {
        method: 'GET',
        headers
      });
      
      console.log('📡 [API SERVICE] Raw API response:', response);
      
      if (response.error) {
        console.error('📡 [API SERVICE] API returned error:', response.error);
        return { error: response.error, status: response.status };
      }
      
      if (response.data && response.data.length > 0) {
        console.log('📡 [API SERVICE] First 3 tracks from API before mapping:');
        response.data.slice(0, 3).forEach((track, index) => {
          console.log(`📡 [API SERVICE] Track ${index + 1}:`, {
            id: track.id,
            name: track.name,
            artistName: track.artistName,
            artistId: track.artistId,
            albumName: track.albumName,
            year: track.year,
            hasArtistName: !!track.artistName,
            hasArtistId: !!track.artistId,
            allKeys: Object.keys(track)
          });
        });
      }
      
      // Ensure the response data matches the Track interface and includes new metadata fields
      const tracks = response.data?.map((track: any) => ({
        id: track.id,
        name: track.name,
        duration: track.duration,
        artistId: track.artist_id || track.artistId,
        artistName: track.artist_name || track.artistName, // Map artist_name to artistName
        artist: track.artist,
        albumId: track.album_id || track.albumId,
        albumName: track.album_name || track.albumName, // Map album_name to albumName
        album: track.album,
        albumArtPath: track.album_album_art_path || track.album_art_path || track.albumArtPath || undefined, // Album art support
        userId: track.user_id || track.userId,
        createdAt: track.created_at || track.createdAt,
        updatedAt: track.updated_at || track.updatedAt,
        playlists: track.playlists || [],
        genres: track.genres || [],
        filePath: track.file_path || track.filePath,
        // Include new metadata fields
        bitrate: track.bitrate,
        sampleRate: track.sample_rate || track.sampleRate,
        channels: track.channels,
        year: track.year,
        genre: track.genre,
        trackNumber: track.track_number || track.trackNumber
      })) || [];
      
      console.log('📡 [API SERVICE] Tracks after mapping:', tracks.length, 'tracks');
      if (tracks.length > 0) {
        console.log('📡 [API SERVICE] First mapped track:', {
          name: tracks[0].name,
          artistName: tracks[0].artistName,
          year: tracks[0].year
        });
      }
      
      return { data: tracks, error: null, status: 200 };
    } catch (error) {
      console.error('📡 [API SERVICE] Error fetching tracks:', error);
      return { error: 'Failed to fetch tracks', status: 500 };
    }
  },

  async getTrackById(id: number) {
    const { data, error } = await makeRequest<Track>(`/tracks/${id}`);
    if (error) throw new Error(error);
    return data;
  },

  // ===== Playlist Management =====
  async getPlaylists() {
    console.log('🎵 [ELECTRON API] getPlaylists method called');
    const { data, error } = await makeRequest<ExtendedPlaylist[]>('/api/playlists');
    console.log('🎵 [ELECTRON API] getPlaylists response:', { data: data?.length, error });
    
    if (error) {
      console.error('🎵 [ELECTRON API] Error in getPlaylists:', error);
      throw new Error(error);
    }
    
    console.log('🎵 [ELECTRON API] Returning playlists:', data?.length || 0);
    return data || [];
  },

  async getPlaylistById(id: string) {
    const { data, error } = await makeRequest<Playlist>(`/api/playlists/${id}`);
    if (error) throw new Error(error);
    return data;
  },

  async createPlaylist(playlistData: { name: string; description?: string }) {
    console.log('[ELECTRON API] createPlaylist method called');
    console.log('[ELECTRON API] Creating playlist with data:', playlistData);
    console.log('[ELECTRON API] isElectron:', isElectron);
    console.log('[ELECTRON API] window.electron available:', !!window.electron);
    
    try {
      const { data, error } = await makeRequest<Playlist>('/api/playlists', {
        method: 'POST',
        body: JSON.stringify(playlistData),
      });
      console.log('[ELECTRON API] createPlaylist response:', { data, error });
      console.log('[ELECTRON API] Response data type:', typeof data);
      console.log('[ELECTRON API] Response data keys:', data ? Object.keys(data) : 'null/undefined');
      
      if (error) {
        console.error('[ELECTRON API] Error in createPlaylist:', error);
        throw new Error(error);
      }
      
      console.log('[ELECTRON API] Returning data:', data);
      return data;
    } catch (catchError) {
      console.error('[ELECTRON API] Exception in createPlaylist:', catchError);
      console.error('[ELECTRON API] Exception type:', typeof catchError);
      console.error('[ELECTRON API] Exception message:', catchError instanceof Error ? catchError.message : String(catchError));
      throw catchError;
    }
  },

  async deletePlaylist(id: string) {
    const { error } = await makeRequest(`/api/playlists/${id}`, {
      method: 'DELETE',
    });
    if (error) throw new Error(error);
  },

  async addTrackToPlaylist(playlistId: string, trackId: string, force: boolean = false) {
    console.log(`[DRAG N DROP] 🌐 ElectronAPI: addTrackToPlaylist called`);
    console.log(`[DRAG N DROP] 🌐 ElectronAPI: playlistId="${playlistId}", trackId="${trackId}", force=${force}`);
    
    const endpoint = `/api/playlists/${playlistId}/tracks/${trackId}${force ? '?force=true' : ''}`;
    console.log(`[DRAG N DROP] 🌐 ElectronAPI: Making request to endpoint: ${endpoint}`);
    
    try {
      const { data, error } = await makeRequest<any>(endpoint, {
        method: 'POST',
      });
      
      console.log(`[DRAG N DROP] 🌐 ElectronAPI: makeRequest response:`, { 
        data, 
        error, 
        dataType: typeof data,
        hasData: !!data 
      });
      
      if (error) {
        console.error(`[DRAG N DROP] ❌ ElectronAPI: Request error: ${error}`);
        throw new Error(error);
      }
      
      console.log(`[DRAG N DROP] ✅ ElectronAPI: Successfully added track to playlist`);
      return data;
    } catch (error) {
      console.error(`[DRAG N DROP] ❌ ElectronAPI: Exception in addTrackToPlaylist:`, error);
      throw error;
    }
  },

  async removeTrackFromPlaylist(playlistId: string, trackId: string) {
    const { error } = await makeRequest(`/api/playlists/${playlistId}/tracks/${trackId}`, {
      method: 'DELETE',
    });
    if (error) throw new Error(error);
  },

  async updatePlaylistMetadata(playlistId: string, updates: { name?: string; description?: string }): Promise<Playlist> {
    console.log(`[EDIT PLAYLIST] Step 3: updatePlaylistMetadata in apiService called for playlist ID: ${playlistId} with updates:`, updates);
    const { data, error } = await makeRequest<Playlist>(`/api/playlists/${playlistId}/metadata`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });

    if (error) {
      console.error(`[EDIT PLAYLIST] Step 3 Failure: API error for playlist ${playlistId}:`, error);
      throw new Error(error);
    }
    
    console.log(`[EDIT PLAYLIST] Step 3 Success: API returned data for playlist ${playlistId}:`, data);
    return data as Playlist;
  },

  async reorderPlaylists(playlistIds: string[]) {
    const { data, error } = await makeRequest<Playlist[]>('/api/playlists/reorder', {
      method: 'PATCH',
      body: JSON.stringify({ playlistIds }),
    });
    if (error) throw new Error(error);
    return data;
  },

  async reorderPlaylistTracks(playlistId: string, trackIds: string[]) {
    const { data, error } = await makeRequest<Playlist>(`/api/playlists/${playlistId}/track-order`, {
      method: 'PATCH',
      body: JSON.stringify({ trackIds }),
    });
    if (error) throw new Error(error);
    return data;
  },

  // ===== Marker Management =====
  async createMarker(markerData: Omit<Marker, 'id' | 'createdAt'>) {
    const { data, error } = await makeRequest<Marker>('/markers', {
      method: 'POST',
      body: JSON.stringify(markerData),
    });
    if (error) throw new Error(error);
    return data;
  },

  async getMarkersByTrackId(trackId: number) {
    const { data, error } = await makeRequest<Marker[]>(`/markers?trackId=${trackId}`);
    if (error) throw new Error(error);
    return data || [];
  },

  async deleteMarker(markerId: number) {
    const { error } = await makeRequest(`/markers/${markerId}`, {
      method: 'DELETE',
    });
    if (error) throw new Error(error);
  },

  // ===== Local Storage Methods =====
  // These methods are safe to use in both Electron and web environments
  getStoredUser(): User | null {
    if (typeof window === 'undefined') return null;
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  },

  setUser(user: User | null) {
    if (typeof window !== 'undefined') {
      if (user) {
        localStorage.setItem('user', JSON.stringify(user));
      } else {
        localStorage.removeItem('user');
      }
    }
  },

  getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('token');
  },

  setToken(token: string | null) {
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('token', token);
      } else {
        localStorage.removeItem('token');
      }
    }
  },

  getRefreshToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('refreshToken');
  },

  setRefreshToken(refreshToken: string | null) {
    if (typeof window !== 'undefined') {
      if (refreshToken) {
        localStorage.setItem('refreshToken', refreshToken);
      } else {
        localStorage.removeItem('refreshToken');
      }
    }
  },
  


  async logout() {
    try {
      // Get refresh token before clearing it
      const refreshToken = this.getRefreshToken();
      
      // Clear tokens from storage first to prevent race conditions
      this.setUser(null);
      this.setToken(null);
      this.setRefreshToken(null);
      
      // Call logout endpoint if we have a refresh token
      if (refreshToken) {
        try {
          await makeRequest('/api/auth/logout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken })
          });
        } catch (error) {
          console.error('Error during logout API call:', error);
          // Continue with logout even if API call fails
        }
      }
      
      // Clear any stored data
      localStorage.removeItem('user');
      sessionStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      
      // Don't redirect in Electron app - just let the AuthProvider handle the state
      if (typeof window !== 'undefined' && !isElectron) {
        window.location.href = '/login';
      }
      
      return { success: true };
    } catch (error) {
      console.error('Logout failed:', error);
      // Even if logout fails, we should still clear local state
      this.setUser(null);
      this.setToken(null);
      this.setRefreshToken(null);
      
      if (typeof window !== 'undefined' && !isElectron) {
        window.location.href = '/login';
      }
      
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Logout failed' 
      };
    }
  },

  // Track Management
  async updateTrackMetadata(id: string, updates: Partial<Track>): Promise<Track> {
    const response = await makeRequest<Track>(`/tracks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates)
    });
    if (response.error || !response.data) {
      throw new Error(response.error || 'No data returned');
    }
    // Ensure the response data matches the Track interface
    return {
      id: response.data.id,
      name: response.data.name,
      duration: response.data.duration,
      artistId: response.data.artistId,
      artist: response.data.artist,
      albumId: response.data.albumId,
      album: response.data.album,
      createdAt: response.data.createdAt,
      updatedAt: response.data.updatedAt,
      playlists: response.data.playlists || [],
      genres: response.data.genres || [],
      filePath: response.data.filePath
    };
  },

  async deleteTrack(id: string): Promise<ApiResponse<void>> {
    try {
      const response = await makeRequest<void>(`/tracks/${id}`, {
        method: 'DELETE'
      });
      return { ...response, status: response.status || 200 };
    } catch (error) {
      console.error('Error deleting track:', error);
      return { error: 'Failed to delete track', status: 500 };
    }
  },

  async uploadTrack(formData: FormData): Promise<ApiResponse<Track>> {
    try {
      console.log('[UPLOAD] uploadTrack called');
      
      // Check if we're in Electron environment
      if (isElectron) {
        console.log('[UPLOAD] Running in Electron environment');
        
        // Get the file from FormData
        const file = formData.get('file') as File;
        const name = formData.get('name') as string;
        
        console.log('[UPLOAD] File from FormData:', { 
          fileName: file?.name, 
          fileSize: file?.size, 
          fileType: file?.type,
          name 
        });
        
        if (!file) {
          console.error('[UPLOAD] No file provided');
          return { error: 'No file provided', status: 400 };
        }
        
        // Convert file to buffer
        console.log('[UPLOAD] Converting file to buffer...');
        const arrayBuffer = await file.arrayBuffer();
        const fileBuffer = Array.from(new Uint8Array(arrayBuffer));
        console.log('[UPLOAD] File converted to buffer, length:', fileBuffer.length);
        
        // Get current user ID (for now, use 1 as default test user)
        const userId = 1; // TODO: Get from auth context
        
        console.log(`[UPLOAD] Uploading file: ${file.name} (${file.size} bytes) to user ${userId}`);
        
        // Use IPC for single file upload
        console.log('[UPLOAD] Calling IPC upload:single-track...');
        const response = await window.electron!.ipcRenderer.invoke('upload:single-track', {
          fileBuffer,
          fileName: file.name,
          userId
        });
        
        console.log('[UPLOAD] IPC response:', response);
        
        if (response.success) {
          console.log('[UPLOAD] Upload successful, returning data');
          return { data: response.data, status: 200 };
        } else {
          console.error('[UPLOAD] Upload failed:', response.error);
          return { error: response.error, status: 500 };
        }
      } else {
        console.log('[UPLOAD] Running in web environment, using fallback API');
        // Fallback to web API
      const response = await makeRequest<Track>('/tracks', {
        method: 'POST',
        body: formData
      });
      if (response.error) {
        return { error: response.error, status: response.status };
      }
      // Ensure the response data matches the Track interface
      const track = {
        id: response.data.id,
        name: response.data.name,
        duration: response.data.duration,
        artistId: response.data.artistId,
        artist: response.data.artist,
        albumId: response.data.albumId,
        album: response.data.album,
        createdAt: response.data.createdAt,
        updatedAt: response.data.updatedAt,
        playlists: response.data.playlists || [],
        genres: response.data.genres || [],
        filePath: response.data.filePath
      };
      return { data: track, error: null, status: 200 };
      }
    } catch (error) {
      console.error('[UPLOAD] Error uploading track:', error);
      console.error('[UPLOAD] Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack trace'
      });
      return { error: 'Failed to upload track', status: 500 };
    }
  },

  async uploadBatchTracks(files: File[]): Promise<ApiResponse<{ uploaded: Track[], failed: any[], total: number, successful: number, failed: number }>> {
    try {
      console.log('[BATCH UPLOAD] uploadBatchTracks called with', files.length, 'files');
      console.log('[BATCH UPLOAD] File names:', files.map(f => f.name));
      
      if (isElectron) {
        console.log('[BATCH UPLOAD] Running in Electron environment');
        
        // Get current user ID (for now, use 1 as default test user)
        const userId = 1; // TODO: Get from auth context
        
        console.log(`[BATCH UPLOAD] Processing ${files.length} files for user ${userId}`);
        
        // Convert files to buffers
        console.log('[BATCH UPLOAD] Converting files to buffers...');
        const fileData = await Promise.all(
          files.map(async (file, index) => {
            console.log(`[BATCH UPLOAD] Converting file ${index + 1}/${files.length}: ${file.name}`);
            const arrayBuffer = await file.arrayBuffer();
            const fileBuffer = Array.from(new Uint8Array(arrayBuffer));
            console.log(`[BATCH UPLOAD] File ${file.name} converted, buffer length: ${fileBuffer.length}`);
            return {
              fileBuffer,
              fileName: file.name
            };
          })
        );
        
        console.log('[BATCH UPLOAD] All files converted, calling IPC...');
        
        // Use IPC for batch upload
        const response = await window.electron!.ipcRenderer.invoke('upload:batch-tracks', {
          files: fileData,
          userId
        });
        
        console.log('[BATCH UPLOAD] IPC response:', response);
        
        if (response.success) {
          console.log('[BATCH UPLOAD] Batch upload successful');
          return { data: response.data, status: 200 };
        } else {
          console.error('[BATCH UPLOAD] Batch upload failed:', response.error);
          return { error: response.error, status: 500 };
        }
      } else {
        console.log('[BATCH UPLOAD] Running in web environment, using fallback API');
        // Fallback to web API - upload files one by one
        const results = [];
        const errors = [];
        
        for (const file of files) {
          try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('name', file.name.replace(/\.[^/.]+$/, ''));
            
            const response = await makeRequest<Track>('/tracks', {
              method: 'POST',
              body: formData
            });
            
            if (response.error) {
              errors.push({ fileName: file.name, error: response.error });
            } else {
              results.push(response.data);
            }
          } catch (error) {
            errors.push({ fileName: file.name, error: error instanceof Error ? error.message : 'Upload failed' });
          }
        }
        
        return {
          data: {
            uploaded: results,
            failed: errors,
            total: files.length,
            successful: results.length,
            failed: errors.length
          },
          status: 200
        };
      }
    } catch (error) {
      console.error('[BATCH UPLOAD] Error uploading batch tracks:', error);
      console.error('[BATCH UPLOAD] Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack trace'
      });
      return { error: 'Failed to upload batch tracks', status: 500 };
    }
  },

  async syncMetadata(): Promise<ApiResponse<{ summary: { processed: number, updated: number, errors: number, skipped: number }, results: any[] }>> {
    try {
      console.log('[METADATA SYNC] Starting metadata sync...');
      
      const response = await makeRequest<{ summary: { processed: number, updated: number, errors: number, skipped: number }, results: any[] }>('/api/tracks/sync-metadata', {
        method: 'POST'
      });
      
      console.log('[METADATA SYNC] Sync completed:', response);
      return response;
    } catch (error) {
      console.error('[METADATA SYNC] Error syncing metadata:', error);
      return { error: 'Failed to sync metadata', status: 500 };
    }
  },

  async addMarkerAndComment(dto: CreateCommentDto): Promise<Comment> {
    console.log('Adding marker and comment:', dto);
    try {
      const response = await makeRequest<{ comment: Comment }>('/api/comments/with-marker', {
      method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.getToken()}`
        },
      body: JSON.stringify(dto),
    });
      
      console.log('Add marker and comment response:', response);
      
      if (response.error || !response.data) {
        console.error('Failed to add comment with marker:', response.error || 'No data returned');
        throw new Error(response.error || 'Failed to add comment with marker');
      }
      
      return response.data.comment;
    } catch (error) {
      console.error('Error in addMarkerAndComment:', error);
      throw error;
    }
  },

  async fetchCommentsAndMarkers(trackId: number, page: number = 1, limit: number = 10): Promise<ApiResponse<Comment[]>> {
    console.log('🌐 [ApiService] Fetching comments and markers for track:', trackId);
    try {
      const url = `/api/comments?trackId=${trackId}&page=${page}&limit=${limit}`;
      console.log('🌐 [ApiService] Request URL:', url);
      
      const response = await makeRequest<Comment[]>(url);
      
      console.log('🌐 [ApiService] Raw API response:', response);
      console.log('🌐 [ApiService] Response data type:', typeof response.data);
      console.log('🌐 [ApiService] Response data length:', response.data?.length);
      
      if (response.data && Array.isArray(response.data)) {
        response.data.forEach((comment, index) => {
          console.log(`🌐 [ApiService] Comment ${index + 1}:`, {
            id: comment.id,
            content: comment.content?.substring(0, 20) + '...',
            hasMarker: !!comment.marker,
            markerData: comment.marker
          });
        });
      }
      
      return response;
    } catch (error) {
      console.error('❌ [ApiService] Error fetching comments and markers:', error);
      return { 
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 500
      };
    }
  },

  async editComment(commentId: number, content: string): Promise<ApiResponse<Comment>> {
    console.log('🌐 [ApiService] Editing comment:', commentId, content);
    try {
      const response = await makeRequest<Comment>(`/api/comments/${commentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.getToken()}`
        },
        body: JSON.stringify({ content }),
      });

      if (response.error) {
        console.error('❌ [ApiService] Failed to edit comment:', response.error);
        throw new Error(response.error);
      }

      console.log('✅ [ApiService] Comment edited successfully:', response.data);
      return response;
    } catch (error) {
      console.error('❌ [ApiService] Error editing comment:', error);
      return { 
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 500
      };
    }
  },

  async deleteComment(commentId: number): Promise<ApiResponse<void>> {
    const { error } = await makeRequest<void>(`/api/comments/${commentId}`, {
      method: 'DELETE',
    });
    if (error) throw new Error(error);
    return { status: 200 };
  },

  // Debug function to test Electron detection and IPC
  async testElectronDetection() {
    console.log('🧪 [TEST] Testing Electron detection...');
    console.log('🧪 [TEST] typeof window:', typeof window);
    console.log('🧪 [TEST] window.electron:', window?.electron);
    console.log('🧪 [TEST] window.electron?.ipcRenderer:', window?.electron?.ipcRenderer);
    console.log('🧪 [TEST] isElectron:', isElectron);
    
    if (isElectron) {
      console.log('🧪 [TEST] Electron detected, testing IPC...');
      try {
        const response = await window.electron!.ipcRenderer.invoke('debug:test', { test: 'playlists debug' });
        console.log('🧪 [TEST] IPC test successful:', response);
        return { success: true, response };
      } catch (error) {
        console.error('🧪 [TEST] IPC test failed:', error);
        return { success: false, error };
      }
    } else {
      console.log('🧪 [TEST] Electron not detected, would use fetch');
      return { success: false, error: 'Not in Electron environment' };
    }
  },

  // Test playlists API specifically
  async testPlaylistsAPI() {
    console.log('🧪 [TEST] Testing playlists API...');
    try {
      const result = await this.getPlaylists();
      console.log('🧪 [TEST] Playlists API test result:', result);
      return { success: true, result };
    } catch (error) {
      console.error('🧪 [TEST] Playlists API test failed:', error);
      return { success: false, error };
    }
  },

  /**
   * Get preprocessed waveform data for a track
   */
  async getWaveformData(trackId: string): Promise<{ waveformData: number[] | null; chunks: string[] | null }> {
    try {
      if (isElectron) {
        const result = await window.electron.ipcRenderer.invoke('get-waveform-data', trackId);
        return result;
      } else {
        // For web fallback, return null to use regular audio loading
        return { waveformData: null, chunks: null };
      }
    } catch (error) {
      console.error('Error fetching waveform data:', error);
      return { waveformData: null, chunks: null };
    }
  }
};

export default apiService;
