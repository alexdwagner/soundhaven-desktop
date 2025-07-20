import { useCallback, useMemo } from 'react';
import { useEnvironment } from './useEnvironment';
import type { Track, Playlist, _Comment as Comment } from '../../../../shared/types';

interface DataLayer {
  getTracks: () => Promise<Track[]>;
  getTrack: (id: string) => Promise<Track | null>;
  getPlaylists: () => Promise<Playlist[]>;
  getComments: (trackId?: string) => Promise<Comment[]>;
  streamAudioUrl: (trackId: string) => string;
}

export function useDataLayer(): DataLayer {
  const { isElectron } = useEnvironment();

  // Stable functions using useCallback
  const getTracks = useCallback(async () => {
    if (isElectron) {
      try {
        const response = await (window as any).electronAPI.invoke('api-request', {
          endpoint: '/api/tracks',
          method: 'GET'
        });
        return response.data || response;
      } catch (error) {
        console.error('Error fetching tracks via IPC:', error);
        return [];
      }
    } else {
      try {
        const response = await fetch('/api/tracks');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        return data.data || data;
      } catch (error) {
        console.warn('📱 [DataLayer] Tracks API not yet implemented:', error);
        return [];
      }
    }
  }, [isElectron]);

  const getTrack = useCallback(async (id: string) => {
    if (isElectron) {
      try {
        const response = await (window as any).electronAPI.invoke('api-request', {
          endpoint: `/api/tracks/${id}`,
          method: 'GET'
        });
        return response.data || response;
      } catch (error) {
        console.error('Error fetching track via IPC:', error);
        return null;
      }
    } else {
      try {
        const response = await fetch(`/api/tracks/${id}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        return data.data || data;
      } catch (error) {
        console.warn('📱 [DataLayer] Track API not yet implemented:', error);
        return null;
      }
    }
  }, [isElectron]);

  const getPlaylists = useCallback(async () => {
    if (isElectron) {
      try {
        const response = await (window as any).electronAPI.invoke('api-request', {
          endpoint: '/api/playlists',
          method: 'GET'
        });
        return response.data || response;
      } catch (error) {
        console.error('Error fetching playlists via IPC:', error);
        return [];
      }
    } else {
      try {
        const response = await fetch('/api/playlists');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        return data.data || data;
      } catch (error) {
        console.warn('📱 [DataLayer] Playlists API not yet implemented:', error);
        return [];
      }
    }
  }, [isElectron]);

  const getComments = useCallback(async (trackId?: string) => {
    if (isElectron) {
      try {
        const response = await (window as any).electronAPI.invoke('api-request', {
          endpoint: `/api/comments${trackId ? `?trackId=${trackId}` : ''}`,
          method: 'GET'
        });
        return response.data || response;
      } catch (error) {
        console.error('Error fetching comments via IPC:', error);
        return [];
      }
    } else {
      try {
        const response = await fetch(`/api/comments${trackId ? `?trackId=${trackId}` : ''}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        return data.data || data;
      } catch (error) {
        console.warn('📱 [DataLayer] Comments API not yet implemented:', error);
        return [];
      }
    }
  }, [isElectron]);

  const streamAudioUrl = useCallback((trackId: string) => {
    return isElectron ? `/audio/${trackId}` : `/api/stream/${trackId}`;
  }, [isElectron]);

  // Memoize the entire data layer object
  return useMemo(() => {
    console.log(isElectron ? '🖥️ [DataLayer] Using Electron IPC mode' : '📱 [DataLayer] Using HTTP API mode');
    return {
      getTracks,
      getTrack,
      getPlaylists,
      getComments,
      streamAudioUrl
    };
  }, [getTracks, getTrack, getPlaylists, getComments, streamAudioUrl]);
} 