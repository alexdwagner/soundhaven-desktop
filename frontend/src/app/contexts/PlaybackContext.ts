import { createContext } from 'react';
import { Track } from '../../types/types';

export interface PlaybackContextValue {
    isPlaying: boolean;
    currentTrack: Track | null;
    currentTrackIndex: number;
    togglePlayback: () => void;
    selectTrack: (track: Track, index: number) => void;
    nextTrack: (tracks: Track[]) => void;
    previousTrack: (tracks: Track[]) => void;
    spacebarPlaybackEnabled: boolean;
    toggleSpacebarPlayback: () => void;
    isCommentInputFocused: boolean;
    setIsCommentInputFocused: (isFocused: boolean) => void;
    playbackSpeed: number;
    setPlaybackSpeed: (speed: number) => void;
    volume: number;
    setVolume: (volume: number) => void;
}

const initialPlaybackContextValue: PlaybackContextValue = {
    isPlaying: false,
    currentTrack: null,
    currentTrackIndex: -1,
    togglePlayback: () => {},
    selectTrack: () => {},
    nextTrack: () => {},
    previousTrack: () => {},
    spacebarPlaybackEnabled: true,
    toggleSpacebarPlayback: () => {},
    isCommentInputFocused: false,   
    setIsCommentInputFocused: () => {},
    playbackSpeed: 1.0,
    setPlaybackSpeed: () => {},
    volume: 1.0,
    setVolume: () => {},
};

export const PlaybackContext = createContext<PlaybackContextValue>(initialPlaybackContextValue);


