"use client";

import * as React from 'react';
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuth } from "../hooks/UseAuth";
import { apiService } from "../../services/electronApiService";
import { useDataLayer } from '../hooks/useDataLayer';

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
  addTrackToPlaylist: (playlistId: string, trackId: string) => Promise<boolean>;
  addTracksToPlaylist: (playlistId: string, trackIds: string[]) => Promise<{ successful: number; failed: number; errors: string[] }>;
  removeTrackFromPlaylist: (playlistId: string, trackId: string, skipRefresh?: boolean) => Promise<boolean>;
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
  
  // Use the new data layer
  const dataLayer = useDataLayer();
  
  console.log("🔥 PlaylistsProvider: State initialized. Playlists count:", playlists.length);

  const fetchPlaylists = useCallback(async () => {
    console.log("🎵 [PLAYLISTS PROVIDER] fetchPlaylists called");
    setLoading(true);
    setError(null);
    
    try {
      console.log("🎵 [PLAYLISTS PROVIDER] About to call dataLayer.getPlaylists()");
      const playlistsData = await dataLayer.getPlaylists();
      console.log("🎵 [PLAYLISTS PROVIDER] Raw playlists from data layer:", playlistsData);
      console.log("🎵 [PLAYLISTS PROVIDER] Playlists count:", Array.isArray(playlistsData) ? playlistsData.length : 0);
      
      // Ensure we have an array
      const playlists = Array.isArray(playlistsData) ? playlistsData : [];
      console.log("🎵 [PLAYLISTS PROVIDER] Playlists array confirmed:", playlists.length);
      
      if (playlists && playlists.length > 0) {
        console.log("🎵 [PLAYLISTS PROVIDER] First playlist structure:", playlists[0]);
        console.log("🎵 [PLAYLISTS PROVIDER] First playlist keys:", Object.keys(playlists[0]));
      }
      
      // Transform and validate playlists
      const validPlaylists = playlists.map((playlist: any): ExtendedPlaylist => {
        // Transform the playlist to match the expected interface
        const transformedPlaylist: ExtendedPlaylist = {
          ...playlist,
          userId: playlist.userId || playlist.user_id?.toString() || '1', // Handle both userId and user_id
          tracks: playlist.tracks || [], // Default to empty array if not provided
          user: playlist.user || {
            id: playlist.user_id || 1,
            name: playlist.user_name || 'Unknown User',
            email: playlist.user_email || 'unknown@example.com'
          }
        };
        
        console.log("🎵 [PLAYLISTS PROVIDER] Transformed playlist:", transformedPlaylist);
        return transformedPlaylist;
      }).filter((playlist): playlist is ExtendedPlaylist => {
        const isValid = (
          !!playlist && 
          typeof playlist.id === 'string' && 
          typeof playlist.name === 'string' &&
          !!playlist.user &&
          Array.isArray(playlist.tracks)
        );
        
        if (!isValid) {
          console.log("🎵 [PLAYLISTS PROVIDER] Invalid playlist filtered out:", playlist);
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
  }, []); // dataLayer is stable now

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
    console.log(`📓 [PLAYLIST PROVIDER] fetchPlaylistById called with id: ${id}`);
    
    try {
      console.log(`📓 [PLAYLIST PROVIDER] Calling apiService.getPlaylistById...`);
      const playlist = await apiService.getPlaylistById(id) as ExtendedPlaylist;
      console.log(`📓 [PLAYLIST PROVIDER] apiService.getPlaylistById raw result:`, playlist);
      
      if (playlist) {
        console.log(`📓 [PLAYLIST PROVIDER] Playlist found: ${playlist.name}`);
        console.log(`📓 [PLAYLIST PROVIDER] Playlist tracks count: ${playlist.tracks?.length || 0}`);
        console.log(`📓 [PLAYLIST PROVIDER] Playlist tracks:`, playlist.tracks?.map(t => ({ id: t.id, name: t.name })));
        console.log(`📓 [PLAYLIST PROVIDER] Playlist structure keys:`, Object.keys(playlist));
      } else {
        console.log(`📓 [PLAYLIST PROVIDER] ❌ No playlist returned from API`);
      }
      
      return playlist;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error(`📓 [PLAYLIST PROVIDER] ❌ Error fetching playlist ${id}:`, errorMessage);
      console.error(`📓 [PLAYLIST PROVIDER] ❌ Full error:`, error);
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
      
      const newPlaylist = await apiService.createPlaylist({ name, description }) as any;
      
      console.log("🎯 API returned new playlist:", newPlaylist);
      console.log("🎯 Playlist type:", typeof newPlaylist);
      console.log("🎯 Playlist keys:", newPlaylist ? Object.keys(newPlaylist) : 'null/undefined');
      
      if (newPlaylist && typeof newPlaylist === 'object' && Object.keys(newPlaylist).length > 0) {
        setPlaylists(prev => {
          console.log("🎯 Updating playlists state, previous count:", prev.length);
          // Transform the new playlist to match ExtendedPlaylist interface
          const extendedPlaylist: ExtendedPlaylist = {
            ...newPlaylist,
            userId: newPlaylist.userId || newPlaylist.user_id?.toString() || '1',
            tracks: newPlaylist.tracks || [],
            user: newPlaylist.user || {
              id: newPlaylist.user_id || 1,
              name: 'Unknown User',
              email: 'unknown@example.com'
            }
          };
          const updated = [...prev, extendedPlaylist];
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
    async (playlistId: string, trackId: string): Promise<boolean> => {
      console.log(`📓 [PLAYLIST PROVIDER] addTrackToPlaylist called`);
      console.log(`📓 [PLAYLIST PROVIDER] playlistId="${playlistId}", trackId="${trackId}"`);
      console.log(`📓 [PLAYLIST PROVIDER] currentPlaylistId="${currentPlaylistId}"`);
      console.log(`📓 [PLAYLIST PROVIDER] currentPlaylistTracks.length=${currentPlaylistTracks.length}`);
      
      try {
        console.log(`📓 [PLAYLIST PROVIDER] Calling apiService.addTrackToPlaylist`);
        const result = await apiService.addTrackToPlaylist(playlistId, trackId);
        console.log(`📓 [PLAYLIST PROVIDER] apiService.addTrackToPlaylist result:`, result);
        
        // Always refresh playlists to get fresh data
        console.log(`📓 [PLAYLIST PROVIDER] Refreshing main playlists array...`);
        await fetchPlaylists();
        console.log(`📓 [PLAYLIST PROVIDER] Main playlists array refreshed`);
        
        // Also refresh current playlist tracks if we're viewing this playlist
        if (currentPlaylistId === playlistId) {
          console.log(`📓 [PLAYLIST PROVIDER] Refreshing current playlist tracks for playlist ${playlistId}...`);
          const updatedPlaylist = await fetchPlaylistById(playlistId);
          console.log(`📓 [PLAYLIST PROVIDER] fetchPlaylistById result:`, updatedPlaylist);
          
          if (updatedPlaylist) {
            console.log(`📓 [PLAYLIST PROVIDER] Updated playlist tracks count: ${updatedPlaylist.tracks?.length || 0}`);
            console.log(`📓 [PLAYLIST PROVIDER] Updated playlist tracks:`, updatedPlaylist.tracks?.map(t => ({ id: t.id, name: t.name })));
            setCurrentPlaylistTracks(updatedPlaylist.tracks || []);
            console.log(`📓 [PLAYLIST PROVIDER] currentPlaylistTracks updated to length: ${updatedPlaylist.tracks?.length || 0}`);
          } else {
            console.log(`📓 [PLAYLIST PROVIDER] ❌ fetchPlaylistById returned null/undefined`);
          }
        } else {
          console.log(`📓 [PLAYLIST PROVIDER] Not refreshing tracks - different playlist (current: ${currentPlaylistId}, target: ${playlistId})`);
        }
        
        return true;
      } catch (error) {
        console.error(`📓 [PLAYLIST PROVIDER] ❌ Error adding track ${trackId} to playlist ${playlistId}:`, error);
        return false;
      }
    },
    [apiService, fetchPlaylists, fetchPlaylistById, currentPlaylistId, currentPlaylistTracks.length]
  );

  const addTracksToPlaylist = useCallback(
    async (playlistId: string, trackIds: string[]): Promise<{ successful: number; failed: number; errors: string[] }> => {
      console.log(`📓 [PLAYLIST PROVIDER] addTracksToPlaylist called`);
      console.log(`📓 [PLAYLIST PROVIDER] playlistId="${playlistId}", trackIds.length=${trackIds.length}`);
      console.log(`📓 [PLAYLIST PROVIDER] currentPlaylistId="${currentPlaylistId}"`);
      console.log(`📓 [PLAYLIST PROVIDER] currentPlaylistTracks.length=${currentPlaylistTracks.length}`);
      
      const results = { successful: 0, failed: 0, errors: [] as string[] };
      
      for (const trackId of trackIds) {
        try {
          console.log(`📓 [PLAYLIST PROVIDER] Adding track ${trackId} to playlist ${playlistId}...`);
          await apiService.addTrackToPlaylist(playlistId, trackId);
          results.successful++;
          console.log(`📓 [PLAYLIST PROVIDER] ✅ Successfully added track ${trackId}`);
        } catch (error) {
          results.failed++;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          results.errors.push(`${trackId}: ${errorMessage}`);
          console.error(`📓 [PLAYLIST PROVIDER] ❌ Error adding track ${trackId} to playlist ${playlistId}:`, errorMessage);
          console.error(`📓 [PLAYLIST PROVIDER] ❌ Full error object:`, error);
        }
      }
      
      // Always refresh playlists to get fresh data
      console.log(`📓 [PLAYLIST PROVIDER] Refreshing main playlists array after batch add...`);
      await fetchPlaylists();
      console.log(`📓 [PLAYLIST PROVIDER] Main playlists array refreshed after batch add`);
      
      // Also refresh current playlist tracks if we're viewing this playlist
      if (currentPlaylistId === playlistId) {
        console.log(`📓 [PLAYLIST PROVIDER] Refreshing current playlist tracks for playlist ${playlistId} after batch add...`);
        const updatedPlaylist = await fetchPlaylistById(playlistId);
        console.log(`📓 [PLAYLIST PROVIDER] fetchPlaylistById result after batch add:`, updatedPlaylist);
        
        if (updatedPlaylist) {
          console.log(`📓 [PLAYLIST PROVIDER] Updated playlist tracks count after batch add: ${updatedPlaylist.tracks?.length || 0}`);
          console.log(`📓 [PLAYLIST PROVIDER] Updated playlist tracks after batch add:`, updatedPlaylist.tracks?.map(t => ({ id: t.id, name: t.name })));
          setCurrentPlaylistTracks(updatedPlaylist.tracks || []);
          console.log(`📓 [PLAYLIST PROVIDER] currentPlaylistTracks updated after batch add to length: ${updatedPlaylist.tracks?.length || 0}`);
        } else {
          console.log(`📓 [PLAYLIST PROVIDER] ❌ fetchPlaylistById returned null/undefined after batch add`);
        }
      } else {
        console.log(`📓 [PLAYLIST PROVIDER] Not refreshing tracks after batch add - different playlist (current: ${currentPlaylistId}, target: ${playlistId})`);
      }
      
      console.log(`📓 [PLAYLIST PROVIDER] ✅ Batch add tracks to playlist completed. Successful: ${results.successful}, Failed: ${results.failed}`);
      return results;
    },
    [apiService, fetchPlaylists, fetchPlaylistById, currentPlaylistId, currentPlaylistTracks.length]
  );

  const removeTrackFromPlaylist = useCallback(async (playlistId: string, trackId: string, skipRefresh?: boolean): Promise<boolean> => {
    // Remove token requirement for local-first app
    try {
      await apiService.removeTrackFromPlaylist(playlistId, trackId);

      // Only refresh if not skipping (for optimistic updates)
      if (!skipRefresh && currentPlaylistId === playlistId) {
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
    console.log(`🎯 [PLAYLISTS PROVIDER] updatePlaylistOrder called`);
    console.log(`🎯 [PLAYLISTS PROVIDER] New playlist order:`, playlistIds);
    
    try {
      // Optimistically update the playlist order
      setPlaylists(prevPlaylists => {
        const reorderedPlaylists = [...prevPlaylists];
        reorderedPlaylists.sort((a, b) => {
          const aIndex = playlistIds.indexOf(a.id);
          const bIndex = playlistIds.indexOf(b.id);
          return aIndex - bIndex;
        });
        console.log(`🎯 [PLAYLISTS PROVIDER] Optimistic playlist reorder applied`);
        return reorderedPlaylists;
      });
      
      console.log(`🎯 [PLAYLISTS PROVIDER] Calling apiService.reorderPlaylists...`);
      const updatedPlaylists = await apiService.reorderPlaylists(playlistIds) as any[];
      console.log(`🎯 [PLAYLISTS PROVIDER] ✅ API call successful - playlist order updated in backend`);
      
      // DON'T set playlists again - trust the optimistic update
      // The optimistic update has already applied the correct order
      
      console.log(`🎯 [PLAYLISTS PROVIDER] ✅ Playlist order update completed successfully`);
      return updatedPlaylists;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error(`🎯 [PLAYLISTS PROVIDER] ❌ Error updating playlist order:`, errorMessage);
      setError(errorMessage);
      
      // Revert optimistic update by refetching
      console.log(`🎯 [PLAYLISTS PROVIDER] Reverting optimistic update by refetching playlists...`);
      await fetchPlaylists();
      
      return [];
    }
  }, [fetchPlaylists]);

  const updatePlaylistTrackOrder = useCallback(async (playlistId: string, trackIds: string[]): Promise<boolean> => {
    console.log(`🎯 [PLAYLISTS PROVIDER] updatePlaylistTrackOrder called for playlist ${playlistId}`);
    console.log(`🎯 [PLAYLISTS PROVIDER] New track order:`, trackIds);
    
    try {
      console.log(`🎯 [PLAYLISTS PROVIDER] Calling apiService.reorderPlaylistTracks...`);
      await apiService.reorderPlaylistTracks(playlistId, trackIds);
      console.log(`🎯 [PLAYLISTS PROVIDER] ✅ API call successful - track order updated in backend`);
      
      // Refetch the playlist to ensure UI stays in sync with backend
      if (currentPlaylistId === playlistId) {
        console.log(`🎯 [PLAYLISTS PROVIDER] Refetching playlist ${playlistId} to sync with backend...`);
        const updatedPlaylist = await fetchPlaylistById(playlistId);
        if (updatedPlaylist) {
          console.log(`🎯 [PLAYLISTS PROVIDER] Setting fresh playlist tracks from backend:`, updatedPlaylist.tracks?.length || 0);
          setCurrentPlaylistTracks(updatedPlaylist.tracks || []);
        }
      }
      
      console.log(`🎯 [PLAYLISTS PROVIDER] ✅ Track order update completed successfully`);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error(`🎯 [PLAYLISTS PROVIDER] ❌ Error updating track order for playlist ${playlistId}:`, errorMessage);
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
    addTracksToPlaylist,
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