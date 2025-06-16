"use client";

import React, { createContext, useState, useCallback, useEffect, useMemo, useContext } from 'react';
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
  // State
  tracks: Track[];
  currentTrackIndex: number | null;
  currentPlaylistId: string | null;
  showDeleteModal: boolean;
  doNotAskAgain: boolean;
  isLoading: boolean;
  error: string | null;
  currentTrack: Track | null;
  
  // Actions
  setTracks: (tracks: Track[]) => void;
  fetchTrack: (id: number) => Promise<Track | undefined>;
  updateTrack: (trackId: number, updates: Partial<Omit<Track, 'id' | 'createdAt' | 'updatedAt'>>) => Promise<Track | undefined>;
  updateTrackField: (trackId: number, field: keyof Track, value: string | number | boolean | null) => Promise<Track | undefined>;
  fetchTracks: () => Promise<Track[]>;
  deleteTrack: (id: number) => Promise<boolean>;
  clearTracks: () => void;
  setCurrentTrackIndex: (index: number | null) => void;
  setCurrentPlaylistId: (id: string | null) => void;
  setShowDeleteModal: (show: boolean) => void;
  setDoNotAskAgain: (value: boolean) => void;
  uploadTrack: (formData: FormData) => Promise<Track | undefined>;
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
  setTracks: () => {},
  fetchTrack: async () => undefined,
  updateTrack: async () => undefined,
  updateTrackField: async () => undefined,
  fetchTracks: async () => [],
  deleteTrack: async () => false,
  clearTracks: () => {},
  setCurrentTrackIndex: () => {},
  setCurrentPlaylistId: () => {},
  setShowDeleteModal: () => {},
  setDoNotAskAgain: () => {},
  uploadTrack: async () => undefined,
};

export const TracksProvider: React.FC<TracksProviderProps> = ({ children }) => {
  // State
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number | null>(null);
  const [currentPlaylistId, setCurrentPlaylistId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [doNotAskAgain, setDoNotAskAgain] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // Auth
  const { token, refreshToken, setToken } = useAuth();
  
  // Derived state
  const currentTrack = useMemo(() => 
    currentTrackIndex !== null && tracks[currentTrackIndex] ? tracks[currentTrackIndex] : null,
    [currentTrackIndex, tracks]
  );
  
  // Fetch tracks when token is available
  useEffect(() => {
    if (token) {
      fetchTracks().catch(err => {
        console.error("Error in fetchTracks effect:", err);
        setError("Failed to load tracks");
      });
    }
  }, [token]);
  
  // Fetch a single track by ID
  const fetchTrack = useCallback(async (id: number): Promise<Track | undefined> => {
    if (!token) {
      setError("Authentication required");
      return undefined;
    }

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
  }, [token]);
  
  // Fetch all tracks with retry logic
  const fetchTracks = useCallback(async (retryCount = 0): Promise<Track[]> => {
    if (!token) {
      setError("Authentication required");
      return [];
    }

    try {
      setIsLoading(true);
      const tracks = await apiService.getTracks();
      setTracks(tracks);
      setError(null);
      return tracks;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch tracks';
      console.error("Error fetching tracks:", error);
      setError(errorMessage);
      
      // Implement retry logic if needed
      if (retryCount < 3) {
        console.log(`Retrying fetchTracks (${retryCount + 1}/3)`);
        return new Promise(resolve => {
          setTimeout(() => {
            resolve(fetchTracks(retryCount + 1));
          }, 1000 * Math.pow(2, retryCount)); // Exponential backoff
        });
      }
      
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [token]);
  
  // Update a track
  const updateTrack = useCallback(async (
    trackId: number, 
    updates: Partial<Omit<Track, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<Track | undefined> => {
    if (!token) {
      setError("Authentication required");
      return undefined;
    }

    try {
      setIsLoading(true);
      const updatedTrack = await apiService.updateTrackMetadata(trackId, updates);
      
      // Update local state
      setTracks(prevTracks => 
        prevTracks.map(track => 
          track.id === trackId ? { ...track, ...updatedTrack } : track
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
  }, [token]);
  
  // Update a single field of a track
  const updateTrackField = useCallback(async (
    trackId: number, 
    field: keyof Track, 
    value: string | number | boolean | null
  ): Promise<Track | undefined> => {
    return updateTrack(trackId, { [field]: value } as Partial<Track>);
  }, [updateTrack]);
  
  // Delete a track
  const deleteTrack = useCallback(async (id: number): Promise<boolean> => {
    if (!token) {
      setError("Authentication required");
      return false;
    }

    try {
      setIsLoading(true);
      await apiService.deleteTrack(id);
      
      // Update local state
      setTracks(prevTracks => prevTracks.filter(track => track.id !== id));
      
      // Reset current track if it was deleted
      if (currentTrackIndex !== null && tracks[currentTrackIndex]?.id === id) {
        setCurrentTrackIndex(null);
      }
      
      return true;
    } catch (error) {
      console.error("Error deleting track:", error);
      setError(`Failed to delete track: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [token, currentTrackIndex, tracks]);
  
  // Upload a new track
  const uploadTrack = useCallback(async (formData: FormData): Promise<Track | undefined> => {
    if (!token) {
      setError("Authentication required");
      return undefined;
    }

    try {
      setIsLoading(true);
      const newTrack = await apiService.uploadTrack(formData);
      
      // Add new track to local state
      setTracks(prevTracks => [...prevTracks, newTrack]);
      
      return newTrack;
    } catch (error) {
      console.error("Error uploading track:", error);
      setError(`Failed to upload track: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return undefined;
    } finally {
      setIsLoading(false);
    }
  }, [token]);
  
  // Clear all tracks
  const clearTracks = useCallback((): void => {
    setTracks([]);
    setCurrentTrackIndex(null);
    setCurrentPlaylistId(null);
  }, []);
  
  // Context value
  const contextValue: TracksContextType = useMemo(() => ({
    tracks,
    currentTrackIndex,
    currentPlaylistId,
    showDeleteModal,
    doNotAskAgain,
    isLoading,
    error,
    currentTrack,
    setTracks,
    fetchTrack,
    updateTrack,
    updateTrackField,
    fetchTracks,
    deleteTrack,
    clearTracks,
    setCurrentTrackIndex,
    setCurrentPlaylistId,
    setShowDeleteModal,
    setDoNotAskAgain,
    uploadTrack,
  }), [
    tracks, 
    currentTrackIndex, 
    currentPlaylistId, 
    showDeleteModal, 
    doNotAskAgain, 
    isLoading, 
    error, 
    currentTrack,
    setTracks,
    fetchTrack,
    updateTrack,
    updateTrackField,
    fetchTracks,
    deleteTrack,
    clearTracks,
    setCurrentTrackIndex,
    setCurrentPlaylistId,
    setShowDeleteModal,
    setDoNotAskAgain,
    uploadTrack,
  ]);

  return (
    <TracksContext.Provider value={contextValue}>
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
