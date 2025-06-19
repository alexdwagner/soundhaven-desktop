import { createContext, Dispatch, SetStateAction } from 'react';
import { Playlist, Track } from '../../../shared/types';

interface PlaylistsContextType {
  playlists: Playlist[];
  setPlaylists: Dispatch<SetStateAction<Playlist[]>>;
  fetchPlaylists: () => Promise<void>;
  fetchPlaylistById: (id: number) => Promise<Playlist | undefined>;
  createPlaylist: (playlistData: Partial<Playlist>) => Promise<Playlist>;
  deletePlaylist: (id: number) => Promise<void>;
  addTrackToPlaylist: (playlistId: number, trackId: number, force?: boolean) => Promise<Playlist | { status: 'DUPLICATE', message: string, playlistId: number, trackId: number }>;
  removeTrackFromPlaylist: (playlistId: number, trackId: number) => Promise<void>;
  clearPlaylists: () => void;
  currentPlaylistId: number | null;
  setCurrentPlaylistId: Dispatch<SetStateAction<number | null>>;
  currentPlaylistTracks: Track[];
  setCurrentPlaylistTracks: Dispatch<SetStateAction<Track[]>>;
  updatePlaylistMetadata: (playlistId: number, updateData: { name?: string; description?: string }) => Promise<Playlist>;
  updatePlaylistOrder: (playlistIds: number[]) => Promise<Playlist[]>;
  updatePlaylistTrackOrder: (playlistId: number, trackIds: number[]) => Promise<Playlist>;
}

const defaultContextValue: PlaylistsContextType = {
  playlists: [],
  setPlaylists: () => {},
  fetchPlaylists: async () => {},
  fetchPlaylistById: async () => undefined,
  createPlaylist: async () => ({} as Playlist),
  deletePlaylist: async () => {},
  addTrackToPlaylist: async () => ({ status: 'DUPLICATE', message: 'Default message', playlistId: 0, trackId: 0 }),
  removeTrackFromPlaylist: async () => {},
  clearPlaylists: () => {},
  currentPlaylistId: null,
  setCurrentPlaylistId: () => {},
  currentPlaylistTracks: [],
  setCurrentPlaylistTracks: () => {},
  updatePlaylistMetadata: async () => ({} as Playlist),
  updatePlaylistOrder: async () => [],
  updatePlaylistTrackOrder: async () => ({} as Playlist),
};

export const PlaylistsContext = createContext<PlaylistsContextType>(defaultContextValue);
