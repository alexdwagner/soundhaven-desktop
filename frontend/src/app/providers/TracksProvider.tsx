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
  const fetchTracks = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await apiService.getTracks();
      if (response.error) {
        throw new Error(response.error);
      }
      setTracks(response.data || []);
    } catch (error) {
      console.error('Error fetching tracks:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch tracks');
    } finally {
      setIsLoading(false);
    }
  }, []);
  
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
  
  // Update track metadata
  const updateTrackMetadata = useCallback(async (trackId: string, metadata: Partial<Track>) => {
    try {
      setIsLoading(true);
      const updatedTrack = await apiService.updateTrackMetadata(Number(trackId), metadata);
      setTracks(prevTracks => 
        prevTracks.map(track => 
          track.id === Number(trackId) ? updatedTrack : track
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
      setTracks(prevTracks => prevTracks.filter(track => track.id !== Number(trackId)));
      if (currentTrackIndex !== null && tracks[currentTrackIndex]?.id === Number(trackId)) {
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
    uploadTrack
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
    uploadTrack
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
