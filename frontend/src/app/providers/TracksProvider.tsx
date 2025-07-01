"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Track } from '../../../../shared/types';
import { useAuth } from '../hooks/UseAuth';
import { apiService } from '../../services/electronApiService';

// Define the API service interface to ensure type safety
interface ApiService {
  getTrackById: (id: number) => Promise<Track>;
  getTracks: () => Promise<Track[]>;
  updateTrackMetadata: (id: number, updates: Partial<Track>) => Promise<Track>;
  deleteTrack: (id: number) => Promise<void>;
  uploadTrack: (formData: FormData) => Promise<Track>;
}

interface TracksContextType {
  tracks: Track[];
  currentTrackIndex: number | null;
  currentPlaylistId: string | null;
  showDeleteModal: boolean;
  doNotAskAgain: boolean;
  isLoading: boolean;
  error: string | null;
  currentTrack: Track | null;
  setCurrentTrackIndex: (index: number | null) => void;
  setCurrentPlaylistId: (id: string | null) => void;
  setShowDeleteModal: (show: boolean) => void;
  setDoNotAskAgain: (value: boolean) => void;
  fetchTracks: () => Promise<void>;
  updateTrackMetadata: (trackId: string, metadata: Partial<Track>) => Promise<void>;
  deleteTrack: (trackId: string) => Promise<void>;
  uploadTrack: (formData: FormData) => Promise<Track | undefined>;
  uploadBatchTracks: (files: File[]) => Promise<{ uploaded: Track[], failed: any[], total: number, successful: number, failedCount: number } | undefined>;
  syncMetadata: () => Promise<{ summary: { processed: number, updated: number, errors: number, skipped: number }, results: any[] } | undefined>;
}

export const TracksContext = createContext<TracksContextType | undefined>(undefined);

interface TracksProviderProps {
  children: React.ReactNode;
}

// Default context value to prevent null checks everywhere
const defaultContextValue: TracksContextType = {
  tracks: [],
  currentTrackIndex: null,
  currentPlaylistId: null,
  showDeleteModal: false,
  doNotAskAgain: false,
  isLoading: false,
  error: null,
  currentTrack: null,
  setCurrentTrackIndex: () => {},
  setCurrentPlaylistId: () => {},
  setShowDeleteModal: () => {},
  setDoNotAskAgain: () => {},
  fetchTracks: async () => {},
  updateTrackMetadata: async () => {},
  deleteTrack: async () => {},
  uploadTrack: async () => undefined,
  uploadBatchTracks: async () => undefined,
  syncMetadata: async () => undefined,
};

export const TracksProvider: React.FC<TracksProviderProps> = ({ children }) => {
  // console.log('🎯 TracksProvider component rendering...');
  console.log('🎯 TracksProvider component mounted/rendered at:', new Date().toISOString());
  
  // TEST: Simple test to see if component is mounting
  console.log('🎯 TracksProvider: Component is mounting...');
  
  // State
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number | null>(null);
  const [currentPlaylistId, setCurrentPlaylistId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [doNotAskAgain, setDoNotAskAgain] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // TEST: Simple test state to see if state changes work
  const [testState, setTestState] = useState<number>(0);
  
  // Auth (optional for local-first app)
  const { token, refreshToken, setToken } = useAuth();
  
  console.log('🎯 TracksProvider state:', { 
    tracksLength: tracks.length, 
    isLoading, 
    error,
    token: token ? 'present' : 'null',
    tracks: tracks.map(t => ({ id: t.id, name: t.name })),
    testState
  });
  
  // Derived state
  const currentTrack = useMemo(() => 
    currentTrackIndex !== null && tracks[currentTrackIndex] ? tracks[currentTrackIndex] : null,
    [currentTrackIndex, tracks]
  );
  
  // FIXED: Use a ref to track if the component is mounted
  const isMountedRef = useRef(false);
  
  useEffect(() => {
    // Set mounted flag
    isMountedRef.current = true;
    
    console.log('🎯 TracksProvider: Initial useEffect FIRED at:', new Date().toISOString());
    
    const loadTracks = async () => {
      if (!isMountedRef.current) return;
      
      try {
        console.log('🎯 TracksProvider: Starting to load tracks...');
        setIsLoading(true);
        
        const response = await apiService.getTracks();
        console.log('🎯 TracksProvider: API response:', response);
        
        if (!isMountedRef.current) return;
        
        if (response.data && Array.isArray(response.data)) {
          console.log('🎯 TracksProvider: Setting tracks:', response.data);
          setTracks(response.data);
          
          // Removed auto-select to prevent auto-playing audio on app start
          
          console.log('🎯 TracksProvider: Tracks loaded successfully!');
        } else {
          console.log('🎯 TracksProvider: No tracks found in response or invalid format');
          setTracks([]);
        }
      } catch (error) {
        if (!isMountedRef.current) return;
        console.error('🎯 TracksProvider: Error loading tracks:', error);
        setError('Failed to load tracks');
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      }
    };
    
    // Load tracks immediately
    loadTracks();
    
    // Cleanup function
    return () => {
      isMountedRef.current = false;
    };
  }, []);  // Empty dependency array - run once on mount

  // TEST: Simple useEffect to see if any useEffect fires
  useEffect(() => {
    console.log('🎯 TracksProvider: TEST useEffect FIRED at:', new Date().toISOString());
    setTestState(prev => prev + 1);
  }, []);

  // Fetch a single track by ID
  const fetchTrack = useCallback(async (id: number): Promise<Track | undefined> => {
    try {
      setIsLoading(true);
      const track = await apiService.getTrackById(id);
      return track;
    } catch (error) {
      console.error("Error fetching track:", error);
      setError(`Failed to fetch track: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return undefined;
    } finally {
      setIsLoading(false);
    }
  }, []); // Remove token dependency for local-first app
  
  // Fetch all tracks with retry logic
  const fetchTracks = useCallback(async () => {
    console.log('🎯 TracksProvider fetchTracks called...');
    try {
      setIsLoading(true);
      console.log('🎯 TracksProvider calling apiService.getTracks()...');
      const response = await apiService.getTracks();
      console.log('🎯 TracksProvider getTracks response:', response);
      
      if (response.error) {
        console.error('🎯 TracksProvider API returned error:', response.error);
        throw new Error(response.error);
      }
      
      const tracksToSet = response.data || [];
      console.log('🎯 TracksProvider setting tracks:', tracksToSet.length, 'tracks');
      
      // Log detailed info about first few tracks
      if (tracksToSet.length > 0) {
        console.log('🎯 TracksProvider first 3 tracks structure:');
        tracksToSet.slice(0, 3).forEach((track, index) => {
          console.log(`🎯 TracksProvider Track ${index + 1}:`, {
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
      } else {
        console.log('🎯 TracksProvider No tracks to set!');
      }
      
      setTracks(tracksToSet);
      console.log('🎯 TracksProvider tracks set successfully, new length should be:', tracksToSet.length);
    } catch (error) {
      console.error('🎯 TracksProvider Error fetching tracks:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch tracks');
    } finally {
      setIsLoading(false);
      console.log('🎯 TracksProvider fetchTracks completed');
    }
  }, []);
  
  // Update a track
  const updateTrack = useCallback(async (
    trackId: number, 
    updates: Partial<Omit<Track, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<Track | undefined> => {
    try {
      setIsLoading(true);
      const updatedTrack = await apiService.updateTrackMetadata(trackId, updates);
      
      // Update local state
      setTracks(prevTracks => 
        prevTracks.map(track => 
          track.id === String(trackId) ? { ...track, ...updatedTrack } : track
        )
      );
      
      return updatedTrack;
    } catch (error) {
      console.error("Error updating track:", error);
      setError(`Failed to update track: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return undefined;
    } finally {
      setIsLoading(false);
    }
  }, []); // Remove token dependency for local-first app
  
  // Update a single field of a track
  const updateTrackField = useCallback(async (
    trackId: number, 
    field: keyof Track, 
    value: string | number | boolean | null
  ): Promise<Track | undefined> => {
    return updateTrack(trackId, { [field]: value } as Partial<Track>);
  }, [updateTrack]);
  
  // Update track metadata
  const updateTrackMetadata = useCallback(async (trackId: string, metadata: Partial<Track>) => {
    try {
      setIsLoading(true);
      const updatedTrack = await apiService.updateTrackMetadata(Number(trackId), metadata);
      setTracks(prevTracks => 
        prevTracks.map(track => 
          track.id === trackId ? updatedTrack : track
        )
      );
    } catch (error) {
      console.error('Error updating track metadata:', error);
      setError(error instanceof Error ? error.message : 'Failed to update track metadata');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Delete a track
  const deleteTrack = useCallback(async (trackId: string) => {
    try {
      setIsLoading(true);
      const response = await apiService.deleteTrack(Number(trackId));
      if (response.error) {
        throw new Error(response.error);
      }
      setTracks(prevTracks => prevTracks.filter(track => track.id !== trackId));
      if (currentTrackIndex !== null && tracks[currentTrackIndex]?.id === trackId) {
        setCurrentTrackIndex(null);
      }
    } catch (error) {
      console.error('Error deleting track:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete track');
    } finally {
      setIsLoading(false);
    }
  }, [currentTrackIndex, tracks]);

  // Upload a new track
  const uploadTrack = useCallback(async (formData: FormData) => {
    try {
      setIsLoading(true);
      const response = await apiService.uploadTrack(formData);
      if (response.error) {
        throw new Error(response.error);
      }
      if (response.data) {
        setTracks(prevTracks => response.data ? [...prevTracks, response.data] : prevTracks);
        return response.data;
      }
      return undefined;
    } catch (error) {
      console.error('Error uploading track:', error);
      setError(error instanceof Error ? error.message : 'Failed to upload track');
      return undefined;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Sync metadata for existing tracks
  const syncMetadata = useCallback(async () => {
    try {
      setIsLoading(true);
      console.log('[TRACKS PROVIDER] Starting metadata sync...');
      
      const response = await apiService.syncMetadata();
      if (response.error) {
        throw new Error(response.error);
      }
      
      console.log('[TRACKS PROVIDER] Metadata sync completed:', response.data);
      
      // Refresh tracks list to show updated metadata
      await fetchTracks();
      
      return response.data;
    } catch (error) {
      console.error('[TRACKS PROVIDER] Error syncing metadata:', error);
      setError(error instanceof Error ? error.message : 'Failed to sync metadata');
      return undefined;
    } finally {
      setIsLoading(false);
    }
  }, [fetchTracks]);

  // Upload multiple tracks
  const uploadBatchTracks = useCallback(async (files: File[]) => {
    try {
      setIsLoading(true);
      const response = await apiService.uploadBatchTracks(files);
      if (response.error) {
        throw new Error(response.error);
      }
      if (response.data) {
        // Add successfully uploaded tracks to the list
        setTracks(prevTracks => [...prevTracks, ...response.data!.uploaded]);
        return {
          uploaded: response.data.uploaded,
          failed: response.data.failed,
          total: response.data.total,
          successful: response.data.successful,
          failedCount: response.data.failed.length
        };
      }
      return undefined;
    } catch (error) {
      console.error('Error uploading batch tracks:', error);
      setError(error instanceof Error ? error.message : 'Failed to upload batch tracks');
      return undefined;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const value = useMemo(() => ({
    tracks,
    currentTrackIndex,
    currentPlaylistId,
    showDeleteModal,
    doNotAskAgain,
    isLoading,
    error,
    currentTrack,
    setCurrentTrackIndex,
    setCurrentPlaylistId,
    setShowDeleteModal,
    setDoNotAskAgain,
    fetchTracks,
    updateTrackMetadata,
    deleteTrack,
    uploadTrack,
    uploadBatchTracks,
    syncMetadata
  }), [
    tracks,
    currentTrackIndex,
    currentPlaylistId,
    showDeleteModal,
    doNotAskAgain,
    isLoading,
    error,
    currentTrack,
    setCurrentTrackIndex,
    setCurrentPlaylistId,
    setShowDeleteModal,
    setDoNotAskAgain,
    fetchTracks,
    updateTrackMetadata,
    deleteTrack,
    uploadTrack,
    uploadBatchTracks,
    syncMetadata
  ]);

  return (
    <TracksContext.Provider value={value}>
      {children}
    </TracksContext.Provider>
  );
};

export function useTracks(): TracksContextType {
  const context = useContext(TracksContext);
  if (context === undefined) {
    console.warn('useTracks must be used within a TracksProvider');
    return defaultContextValue;
  }
  return context;
};

export default TracksProvider;
