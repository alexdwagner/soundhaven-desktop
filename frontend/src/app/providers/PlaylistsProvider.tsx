"use client";

import * as React from 'react';
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuth } from "../hooks/UseAuth";
import { apiService } from "../../services/electronApiService";

// Import types
import { Playlist, Track, User } from "../../../../shared/types";

// Extend the base Playlist type to include required properties
interface ExtendedPlaylist extends Playlist {
  id: number;
  userId: number;
  user: User;
  tracks: Track[];
}

interface PlaylistsContextType {
  playlists: ExtendedPlaylist[];
  currentPlaylistId: number | null;
  currentPlaylistTracks: Track[];
  loading: boolean;
  error: string | null;
  fetchPlaylists: () => Promise<void>;
  fetchPlaylistById: (id: number) => Promise<ExtendedPlaylist | null>;
  createPlaylist: (name: string, description?: string) => Promise<Playlist | null>;
  deletePlaylist: (id: number) => Promise<boolean>;
  addTrackToPlaylist: (playlistId: number, trackId: number, force?: boolean) => Promise<boolean>;
  removeTrackFromPlaylist: (playlistId: number, trackId: number) => Promise<boolean>;
  updatePlaylistMetadata: (playlistId: number, updates: { name?: string; description?: string }) => Promise<boolean>;
  updatePlaylistOrder: (playlistIds: number[]) => Promise<Playlist[]>;
  updatePlaylistTrackOrder: (playlistId: number, trackIds: number[]) => Promise<boolean>;
  setCurrentPlaylistId: (id: number | null) => void;
  setCurrentPlaylistTracks: (tracks: Track[]) => void;
  clearPlaylists: () => void;
  setPlaylists: React.Dispatch<React.SetStateAction<ExtendedPlaylist[]>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
}

const PlaylistsContext = createContext<PlaylistsContextType | null>(null);

interface PlaylistsProviderProps {
  children: React.ReactNode;
}

export const PlaylistsProvider: React.FC<PlaylistsProviderProps> = ({ children }) => {
  const [playlists, setPlaylists] = useState<ExtendedPlaylist[]>([]);
  const { token, refreshToken, setToken } = useAuth();
  const [currentPlaylistId, setCurrentPlaylistId] = useState<number | null>(null);
  const [currentPlaylistTracks, setCurrentPlaylistTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      fetchPlaylists();
    }
    // Don't log error here as it's normal during initial load
  }, [token]);

  const fetchPlaylists = useCallback(async () => {
    if (!token) return;

    try {
      const playlists = await apiService.getPlaylists() as ExtendedPlaylist[];
      // Filter out any invalid playlists and ensure required fields exist
      const validPlaylists = playlists.filter((playlist): playlist is ExtendedPlaylist => {
        return (
          !!playlist && 
          typeof playlist.id === 'number' && 
          typeof playlist.name === 'string' &&
          typeof playlist.userId === 'number' &&
          !!playlist.user &&
          Array.isArray(playlist.tracks)
        );
      });
      
      setPlaylists(validPlaylists);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error("Error fetching playlists:", errorMessage);
      setError(errorMessage);
    }
  }, [token]);

  const fetchPlaylistById = useCallback(async (id: number): Promise<ExtendedPlaylist | null> => {
    if (!token) return null;

    try {
      const playlist = await apiService.getPlaylistById(id) as ExtendedPlaylist;
      return playlist;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error(`Error fetching playlist ${id}:`, errorMessage);
      setError(errorMessage);
      return null;
    }
  }, [token]);

  const createPlaylist = useCallback(async (name: string, description?: string): Promise<Playlist | null> => {
    if (!token) return null;

    try {
      const newPlaylist = await apiService.createPlaylist({ name, description }) as Playlist;
      setPlaylists(prev => [...prev, newPlaylist]);
      return newPlaylist;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error("Error creating playlist:", errorMessage);
      setError(errorMessage);
      return null;
    }
  }, [token]);

  const deletePlaylist = useCallback(async (id: number): Promise<boolean> => {
    if (!token) return false;

    try {
      await apiService.deletePlaylist(id);
      setPlaylists(prev => prev.filter(playlist => playlist.id !== id));
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error(`Error deleting playlist ${id}:`, errorMessage);
      setError(errorMessage);
      return false;
    }
  }, [token]);

  const addTrackToPlaylist = useCallback(
    async (playlistId: number, trackId: number, force: boolean = false): Promise<boolean> => {
      if (!token) return false;

      try {
        await apiService.addTrackToPlaylist(playlistId, trackId, force);

        // Refresh the current playlist tracks if this is the current playlist
        if (currentPlaylistId === playlistId) {
          const updatedPlaylist = await fetchPlaylistById(playlistId);
          if (updatedPlaylist) {
            setCurrentPlaylistTracks(updatedPlaylist.tracks || []);
          }
        }

        return true;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        console.error(
          `Error adding track ${trackId} to playlist ${playlistId}:`,
          errorMessage
        );
        setError(errorMessage);
        return false;
      }
    },
    [token, currentPlaylistId, fetchPlaylistById]
  );

  const removeTrackFromPlaylist = useCallback(async (playlistId: number, trackId: number): Promise<boolean> => {
    if (!token) return false;

    try {
      await apiService.removeTrackFromPlaylist(playlistId, trackId);

      // Refresh the current playlist tracks if this is the current playlist
      if (currentPlaylistId === playlistId) {
        const updatedPlaylist = await fetchPlaylistById(playlistId);
        if (updatedPlaylist) {
          setCurrentPlaylistTracks(updatedPlaylist.tracks || []);
        }
      }

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error(
        `Error removing track ${trackId} from playlist ${playlistId}:`,
        errorMessage
      );
      setError(errorMessage);
      return false;
    }
  }, [token, currentPlaylistId, fetchPlaylistById]);

  const clearPlaylists = useCallback(() => {
    setPlaylists([]);
  }, []);

  // Clear playlists when token changes
  useEffect(() => {
    if (!token) {
      clearPlaylists();
    }
  }, [token, clearPlaylists]);

  const updatePlaylistMetadata = useCallback(
    async (playlistId: number, updates: { name?: string; description?: string }): Promise<boolean> => {
      if (!token) return false;

      try {
        await apiService.updatePlaylistMetadata(playlistId, updates);
        
        // Update the local state with the new metadata
        setPlaylists(prev =>
          prev.map(playlist =>
            playlist.id === playlistId
              ? { ...playlist, ...updates, updatedAt: new Date().toISOString() }
              : playlist
          )
        );

        return true;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        console.error(`Error updating playlist ${playlistId} metadata:`, errorMessage);
        setError(errorMessage);
        return false;
      }
    },
    [token]
  );

  const updatePlaylistOrder = useCallback(async (playlistIds: number[]): Promise<Playlist[]> => {
    if (!token) return [];

    try {
      const updatedPlaylists = await apiService.reorderPlaylists(playlistIds) as Playlist[];
      setPlaylists(updatedPlaylists);
      return updatedPlaylists;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('Error updating playlist order:', errorMessage);
      setError(errorMessage);
      return [];
    }
  }, [token]);

  const updatePlaylistTrackOrder = useCallback(async (playlistId: number, trackIds: number[]): Promise<boolean> => {
    if (!token) return false;

    try {
      await apiService.reorderPlaylistTracks(playlistId, trackIds);
      
      // Update local state if this is the current playlist
      if (currentPlaylistId === playlistId) {
        const updatedPlaylist = await fetchPlaylistById(playlistId);
        if (updatedPlaylist) {
          setCurrentPlaylistTracks(updatedPlaylist.tracks || []);
        }
      }

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error(`Error updating track order for playlist ${playlistId}:`, errorMessage);
      setError(errorMessage);
      return false;
    }
  }, [token, currentPlaylistId, fetchPlaylistById]);

  const contextValue: PlaylistsContextType = {
    playlists,
    setPlaylists,
    fetchPlaylists,
    fetchPlaylistById,
    createPlaylist,
    deletePlaylist,
    addTrackToPlaylist,
    removeTrackFromPlaylist,
    updatePlaylistMetadata,
    updatePlaylistOrder,
    updatePlaylistTrackOrder,
    currentPlaylistId,
    currentPlaylistTracks,
    setCurrentPlaylistId,
    setCurrentPlaylistTracks,
    clearPlaylists,
    loading,
    error,
    setError,
  };

  return (
    <PlaylistsContext.Provider value={contextValue}>
      {children}
    </PlaylistsContext.Provider>
  );
};

export const usePlaylists = (): PlaylistsContextType => {
  const context = useContext(PlaylistsContext);
  if (!context) {
    throw new Error('usePlaylists must be used within a PlaylistsProvider');
  }
  return context;
};
