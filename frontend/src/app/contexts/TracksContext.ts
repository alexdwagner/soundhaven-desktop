import { createContext, Dispatch, SetStateAction } from 'react';
import { Track } from '../../types/types';

// Updated TracksContextType with new function types
interface TracksContextType {
  tracks: Track[];
  setTracks: Dispatch<SetStateAction<Track[]>>;
  fetchTrack: (id: number) => Promise<Track | undefined>;
  fetchTracks: (retryCount?: number) => Promise<Track[]>;
  updateTrack: (trackId: number, field: keyof Track, value: any) => void;
  uploadTrack: (formData: FormData) => Promise<any>; // Specify a more precise type for the response if known
  deleteTrack: (id: number) => Promise<void>;
  updateTrackMetadata: (trackId: number, updatedData: Partial<Track>) => Promise<any>; // Specify a more precise type for the response if known
  clearTracks: () => void;
  showDeleteModal: boolean;
  setShowDeleteModal: React.Dispatch<React.SetStateAction<boolean>>;
  doNotAskAgain: boolean;
  setDoNotAskAgain: React.Dispatch<React.SetStateAction<boolean>>;
}

// Providing initial values for the context
const defaultContextValue: TracksContextType = {
  tracks: [],
  setTracks: () => {},
  updateTrack: () => {},
  fetchTrack: async () => undefined,
  fetchTracks: async () => [],  
  uploadTrack: async () => {},
  deleteTrack: async () => {},
  updateTrackMetadata: async () => {},
  clearTracks: () => {},
  showDeleteModal: false,
  setShowDeleteModal: () => {},
  doNotAskAgain: false,
  setDoNotAskAgain: () => {},
};

// Creating the context with the default value
export const TracksContext = createContext<TracksContextType>(defaultContextValue);
