import { useContext } from 'react';
import { PlaylistsContext } from '@/contexts/PlaylistsContext';

export function usePlaylists() {
  const context = useContext(PlaylistsContext);

  if (!context) {
    throw new Error('usePlaylists must be used within a PlaylistsProvider');
  }

  return context;
}
