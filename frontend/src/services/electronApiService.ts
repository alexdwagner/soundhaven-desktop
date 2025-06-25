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

const isElectron = typeof window !== 'undefined' && window.electron?.ipcRenderer;

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
  if (isElectron) {
    // Use Electron IPC
    try {
      // Parse the request body if it exists
      let parsedBody = null;
      if (options.body) {
        try {
          parsedBody = JSON.parse(options.body as string);
        } catch (e) {
          console.warn('Failed to parse request body as JSON:', e);
          parsedBody = options.body;
        }
      }
      
      console.log('Making IPC request:', {
        endpoint,
        method: options.method || 'GET',
        body: parsedBody
      });

      const response = await window.electron!.ipcRenderer.invoke('api-request', {
        endpoint,
        method: options.method || 'GET',
        headers: options.headers || {},
        body: parsedBody,
      });

      console.log('IPC response:', response);

      // Handle the response structure
      if (response?.error) {
        return {
          error: response.error,
          status: response.status || 500
        };
      }

      // If the response is already in the correct format, return it
      if (response?.data) {
        return {
          data: response.data,
          status: 200
        };
      }

      // Otherwise, wrap the response in a data property
      return {
        data: response,
        status: 200
      };
    } catch (error) {
      console.error('Electron API request failed:', error);
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
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
      const response = await makeRequest<Track[]>('/tracks');
      if (response.error) {
        return { error: response.error, status: response.status };
      }
      // Ensure the response data matches the Track interface
      const tracks = response.data.map(track => ({
        id: track.id,
        name: track.name,
        duration: track.duration,
        artistId: track.artistId,
        artist: track.artist,
        albumId: track.albumId,
        album: track.album,
        createdAt: track.createdAt,
        updatedAt: track.updatedAt,
        playlists: track.playlists || [],
        genres: track.genres || [],
        filePath: track.filePath
      }));
      return { data: tracks, error: null, status: 200 };
    } catch (error) {
      console.error('Error fetching tracks:', error);
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
    const { data, error } = await makeRequest<Array<{ id: number; name: string }>>('/playlists');
    if (error) throw new Error(error);
    return data || [];
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
      
      // If in Electron, notify the main process
      if (isElectron) {
        try {
          await window.electron!.ipcRenderer.invoke('auth:logout');
        } catch (error) {
          console.error('Error during Electron logout:', error);
        }
      } else if (refreshToken) {
        // For web, call the logout endpoint if we have a refresh token
        try {
          await makeRequest('/auth/logout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken })
          });
        } catch (error) {
          console.error('Error during API logout:', error);
        }
      }
      
      // Clear any stored data
      localStorage.removeItem('user');
      sessionStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      
      // Redirect to login page
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      
      return { success: true };
    } catch (error) {
      console.error('Logout failed:', error);
      // Even if logout fails, we should still clear local state
      this.setUser(null);
      this.setToken(null);
      this.setRefreshToken(null);
      
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Logout failed' 
      };
    }
  },

  // Track Management
  async updateTrackMetadata(id: number, updates: Partial<Track>): Promise<Track> {
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

  async deleteTrack(id: number): Promise<ApiResponse<void>> {
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
    console.log('Fetching comments and markers for track:', trackId);
    try {
      const response = await makeRequest<Comment[]>(`/api/comments?trackId=${trackId}&page=${page}&limit=${limit}`);
      
      console.log('Comments API response:', response);
      return response;
    } catch (error) {
      console.error('Error fetching comments and markers:', error);
      return { 
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 500
      };
    }
  },
};

export default apiService;
