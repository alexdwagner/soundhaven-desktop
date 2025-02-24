import { useContext } from'react';
import { PlaybackContext } from '@/contexts/PlaybackContext';
import { Track } from '../../types/types';
import { PlaybackContextValue } from '@/contexts/PlaybackContext';

export const usePlayback = (): PlaybackContextValue => {
    const context = useContext(PlaybackContext);
    if (!context) {
        throw new Error('usePlayback must be used within a PlaybackProvider');
    }
    return context;
};