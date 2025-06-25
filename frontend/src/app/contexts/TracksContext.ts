import { createContext, Dispatch, SetStateAction } from 'react';
import { Track } from '../../../../shared/types';

// Updated TracksContextType to match TracksProvider
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
  clearTracks: () => void;
}

// Providing initial values for the context
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
  clearTracks: () => {},
};

// Creating the context with the default value
export const TracksContext = createContext<TracksContextType>(defaultContextValue);
