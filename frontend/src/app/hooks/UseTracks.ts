import { useContext } from 'react';
import { TracksContext } from '@/contexts/TracksContext';

// Custom hook to use tracks context
export function useTracks() {
  const context = useContext(TracksContext);

  if (!context) {
    throw new Error('useTracks must be used within a TracksProvider');
  }

  // Ensure clearTracks always exists, even if it's a no-op function
  const clearTracks = context.clearTracks || (() => {});

  return {
    ...context,
    clearTracks,
  };
}