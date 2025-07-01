import { createContext, Dispatch, SetStateAction } from 'react';
import { Playlist, Track } from '../../../shared/types';

interface PlaylistsContextType {
  playlists: Playlist[];
  setPlaylists: Dispatch<SetStateAction<Playlist[]>>;
  fetchPlaylists: () => Promise<void>;
  fetchPlaylistById: (id: string) => Promise<Playlist | undefined>;
  createPlaylist: (playlistData: Partial<Playlist>) => Promise<Playlist>;
  deletePlaylist: (id: string) => Promise<void>;
  addTrackToPlaylist: (playlistId: string, trackId: string, force?: boolean) => Promise<Playlist | { status: 'DUPLICATE', message: string, playlistId: string, trackId: string }>;
  removeTrackFromPlaylist: (playlistId: string, trackId: string) => Promise<void>;
  clearPlaylists: () => void;
  currentPlaylistId: string | null;
  setCurrentPlaylistId: Dispatch<SetStateAction<string | null>>;
  currentPlaylistTracks: Track[];
  setCurrentPlaylistTracks: Dispatch<SetStateAction<Track[]>>;
  updatePlaylistMetadata: (playlistId: string, updateData: { name?: string; description?: string }) => Promise<Playlist>;
  updatePlaylistOrder: (playlistIds: string[]) => Promise<Playlist[]>;
  updatePlaylistTrackOrder: (playlistId: string, trackIds: string[]) => Promise<Playlist>;
}

const defaultContextValue: PlaylistsContextType = {
  playlists: [],
  setPlaylists: () => {},
  fetchPlaylists: async () => {},
  fetchPlaylistById: async () => undefined,
  createPlaylist: async () => ({} as Playlist),
  deletePlaylist: async () => {},
  addTrackToPlaylist: async () => ({ status: 'DUPLICATE', message: 'Default message', playlistId: '', trackId: '' }),
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
