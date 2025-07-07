"use client";

import * as React from 'react';
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuth } from "../hooks/UseAuth";
import { apiService } from "../../services/electronApiService";

// Import types
import { Playlist, Track, User } from "../../../../shared/types";

// Extend the base Playlist type to include required properties
interface ExtendedPlaylist extends Playlist {
  id: string;
  userId: string;
  user: User;
  tracks: Track[];
}

interface PlaylistsContextType {
  playlists: ExtendedPlaylist[];
  currentPlaylistId: string | null;
  currentPlaylistTracks: Track[];
  loading: boolean;
  error: string | null;
  fetchPlaylists: () => Promise<void>;
  fetchPlaylistById: (id: string) => Promise<ExtendedPlaylist | null>;
  createPlaylist: (name: string, description?: string) => Promise<Playlist | null>;
  deletePlaylist: (id: string) => Promise<boolean>;
  addTrackToPlaylist: (playlistId: string, trackId: string, force?: boolean) => Promise<boolean>;
  removeTrackFromPlaylist: (playlistId: string, trackId: string) => Promise<boolean>;
  updatePlaylistMetadata: (playlistId: string, updates: { name?: string; description?: string }) => Promise<boolean>;
  updatePlaylistOrder: (playlistIds: string[]) => Promise<Playlist[]>;
  updatePlaylistTrackOrder: (playlistId: string, trackIds: string[]) => Promise<boolean>;
  setCurrentPlaylistId: (id: string | null) => void;
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
  console.log("🔥 PlaylistsProvider: Component initializing...");
  const { token } = useAuth();
  console.log("🔥 PlaylistsProvider: Token available:", !!token);
  
  const [playlists, setPlaylists] = useState<ExtendedPlaylist[]>([]);
  const [currentPlaylistId, setCurrentPlaylistId] = useState<string | null>(null);
  const [currentPlaylistTracks, setCurrentPlaylistTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  console.log("🔥 PlaylistsProvider: State initialized. Playlists count:", playlists.length);

  const fetchPlaylists = useCallback(async () => {
    console.log("🎵 [PLAYLISTS PROVIDER] fetchPlaylists called");
    setLoading(true);
    setError(null);
    
    try {
      console.log("🎵 [PLAYLISTS PROVIDER] About to call apiService.getPlaylists()");
      const playlists = await apiService.getPlaylists() as ExtendedPlaylist[];
      console.log("🎵 [PLAYLISTS PROVIDER] Raw playlists from API:", playlists);
      console.log("🎵 [PLAYLISTS PROVIDER] Playlists count:", playlists?.length || 0);
      
      if (playlists && playlists.length > 0) {
        console.log("🎵 [PLAYLISTS PROVIDER] First playlist structure:", playlists[0]);
        console.log("🎵 [PLAYLISTS PROVIDER] First playlist keys:", Object.keys(playlists[0]));
      }
      
      // Filter out any invalid playlists and ensure required fields exist
      const validPlaylists = playlists.filter((playlist): playlist is ExtendedPlaylist => {
        const isValid = (
          !!playlist && 
          typeof playlist.id === 'string' && 
          typeof playlist.name === 'string' &&
          (typeof playlist.userId === 'string' || typeof playlist.userId === 'number') &&
          !!playlist.user &&
          Array.isArray(playlist.tracks)
        );
        
        if (!isValid) {
          console.log("🎵 [PLAYLISTS PROVIDER] Invalid playlist filtered out:", playlist);
          console.log("🎵 [PLAYLISTS PROVIDER] Validation details:", {
            hasPlaylist: !!playlist,
            hasId: !!playlist?.id,
            idType: typeof playlist?.id,
            hasName: !!playlist?.name,
            nameType: typeof playlist?.name,
            hasUserId: !!playlist?.userId,
            userIdType: typeof playlist?.userId,
            hasUser: !!playlist?.user,
            userObject: playlist?.user,
            hasTracks: !!playlist?.tracks,
            tracksType: typeof playlist?.tracks,
            tracksIsArray: Array.isArray(playlist?.tracks)
          });
        }
        
        return isValid;
      });
      
      console.log("🎵 [PLAYLISTS PROVIDER] Valid playlists count:", validPlaylists.length);
      console.log("🎵 [PLAYLISTS PROVIDER] Setting playlists state...");
      setPlaylists(validPlaylists);
      console.log("🎵 [PLAYLISTS PROVIDER] Playlists state updated");
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error("🎵 [PLAYLISTS PROVIDER] Error fetching playlists:", errorMessage);
      console.error("🎵 [PLAYLISTS PROVIDER] Full error:", error);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  // Effect to fetch playlists on mount
  useEffect(() => {
    console.log("🎵 [PLAYLISTS PROVIDER] useEffect triggered in provider");
    console.log("🎵 [PLAYLISTS PROVIDER] About to call fetchPlaylists from provider useEffect");
    // For local-first app, always fetch playlists regardless of token  
    fetchPlaylists();
  }, [fetchPlaylists]);

  // Manual test - call fetchPlaylists immediately to test if it works
  useEffect(() => {
    console.log("🧪 [PLAYLISTS PROVIDER] MANUAL TEST: Calling fetchPlaylists immediately");
    setTimeout(() => {
      console.log("🧪 [PLAYLISTS PROVIDER] MANUAL TEST: About to call fetchPlaylists after 1 second");
      fetchPlaylists();
    }, 1000);
  }, []);

  const fetchPlaylistById = useCallback(async (id: string): Promise<ExtendedPlaylist | null> => {
    // Remove token requirement for local-first app
    try {
      const playlist = await apiService.getPlaylistById(id) as ExtendedPlaylist;
      return playlist;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error(`Error fetching playlist ${id}:`, errorMessage);
      setError(errorMessage);
      return null;
    }
  }, []);

  const createPlaylist = useCallback(async (name: string, description?: string): Promise<Playlist | null> => {
    console.log("🎯 PlaylistsProvider.createPlaylist called with:", { name, description });
    console.log("🎯 Token available:", !!token);
    console.log("🎯 apiService available:", !!apiService);
    console.log("🎯 apiService.createPlaylist available:", !!apiService?.createPlaylist);
    
    // Remove token requirement for local-first app
    console.log("🎯 Proceeding without token for local-first app");

    try {
      console.log("🎯 About to call apiService.createPlaylist...");
      console.log("🎯 Request data:", { name, description });
      
      const newPlaylist = await apiService.createPlaylist({ name, description }) as Playlist;
      
      console.log("🎯 API returned new playlist:", newPlaylist);
      console.log("🎯 Playlist type:", typeof newPlaylist);
      console.log("🎯 Playlist keys:", newPlaylist ? Object.keys(newPlaylist) : 'null/undefined');
      
      if (newPlaylist && typeof newPlaylist === 'object' && Object.keys(newPlaylist).length > 0) {
        setPlaylists(prev => {
          console.log("🎯 Updating playlists state, previous count:", prev.length);
          const updated = [...prev, newPlaylist];
          console.log("🎯 New playlists count:", updated.length);
          return updated;
        });
        return newPlaylist;
      } else {
        console.error("❌ CreatePlaylist returned empty/invalid object:", newPlaylist);
        setError("Failed to create playlist - invalid response from server");
        return null;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error("❌ Error creating playlist in provider:", errorMessage);
      console.error("❌ Full error object:", error);
      console.error("❌ Error stack:", error instanceof Error ? error.stack : 'No stack trace');
      setError(errorMessage);
      return null;
    }
  }, [token]);

  const deletePlaylist = useCallback(async (id: string): Promise<boolean> => {
    // Remove token requirement for local-first app
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
  }, []);

  const addTrackToPlaylist = useCallback(
    async (playlistId: string, trackId: string, force: boolean = false): Promise<boolean> => {
      console.log(`[DRAG N DROP] 🎯 PlaylistsProvider: addTrackToPlaylist called`);
      console.log(`[DRAG N DROP] 🎯 PlaylistsProvider: playlistId="${playlistId}", trackId="${trackId}", force=${force}`);
      console.log(`[DRAG N DROP] 🎯 PlaylistsProvider: currentPlaylistId="${currentPlaylistId}"`);
      console.log(`[DRAG N DROP] 🎯 PlaylistsProvider: apiService type:`, typeof apiService);
      console.log(`[DRAG N DROP] 🎯 PlaylistsProvider: apiService.addTrackToPlaylist type:`, typeof apiService.addTrackToPlaylist);
      
      try {
        console.log(`[DRAG N DROP] 🎯 PlaylistsProvider: Calling apiService.addTrackToPlaylist...`);
        const result = await apiService.addTrackToPlaylist(playlistId, trackId, force);
        console.log(`[DRAG N DROP] 🎯 PlaylistsProvider: apiService.addTrackToPlaylist returned:`, result);

        // Refresh the current playlist tracks if this is the current playlist
        if (currentPlaylistId === playlistId) {
          console.log(`[DRAG N DROP] 🎯 PlaylistsProvider: Refreshing current playlist tracks...`);
          const updatedPlaylist = await fetchPlaylistById(playlistId);
          if (updatedPlaylist) {
            console.log(`[DRAG N DROP] 🎯 PlaylistsProvider: Updated playlist fetched, tracks count:`, updatedPlaylist.tracks?.length || 0);
            setCurrentPlaylistTracks(updatedPlaylist.tracks || []);
          } else {
            console.log(`[DRAG N DROP] 🎯 PlaylistsProvider: Failed to fetch updated playlist`);
          }
        } else {
          console.log(`[DRAG N DROP] 🎯 PlaylistsProvider: Not refreshing tracks - different playlist`);
        }

        console.log(`[DRAG N DROP] ✅ PlaylistsProvider: Successfully added track to playlist`);
        return true;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        console.error(`[DRAG N DROP] ❌ PlaylistsProvider: Error adding track ${trackId} to playlist ${playlistId}:`, errorMessage);
        console.error(`[DRAG N DROP] ❌ PlaylistsProvider: Full error object:`, error);
        console.error(`[DRAG N DROP] ❌ PlaylistsProvider: Error stack:`, error instanceof Error ? error.stack : 'No stack trace');
        setError(errorMessage);
        return false;
      }
    },
    [currentPlaylistId, fetchPlaylistById]
  );

  const removeTrackFromPlaylist = useCallback(async (playlistId: string, trackId: string): Promise<boolean> => {
    // Remove token requirement for local-first app
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
  }, [currentPlaylistId, fetchPlaylistById]);

  const clearPlaylists = useCallback(() => {
    setPlaylists([]);
  }, []);

  const updatePlaylistMetadata = useCallback(
    async (playlistId: string, updates: { name?: string; description?: string }): Promise<boolean> => {
      console.log(`[EDIT PLAYLIST] Step 2: updatePlaylistMetadata in provider called for playlist ID: ${playlistId} with updates:`, updates);
      try {
        console.log(`[EDIT PLAYLIST] Step 2.1: Calling apiService.updatePlaylistMetadata...`);
        await apiService.updatePlaylistMetadata(playlistId, updates);
        console.log(`[EDIT PLAYLIST] Step 2.2: apiService.updatePlaylistMetadata finished. Calling fetchPlaylists...`);
        await fetchPlaylists();
        console.log(`[EDIT PLAYLIST] Step 2.3: fetchPlaylists finished.`);
        return true;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        console.error(`[EDIT PLAYLIST] Step 2 Failure: Error updating playlist ${playlistId} metadata:`, errorMessage);
        setError(errorMessage);
        return false;
      }
    },
    [fetchPlaylists]
  );

  const updatePlaylistOrder = useCallback(async (playlistIds: string[]): Promise<Playlist[]> => {
    // Remove token requirement for local-first app
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
  }, []);

  const updatePlaylistTrackOrder = useCallback(async (playlistId: string, trackIds: string[]): Promise<boolean> => {
    // Remove token requirement for local-first app
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
  }, [currentPlaylistId, fetchPlaylistById]);

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