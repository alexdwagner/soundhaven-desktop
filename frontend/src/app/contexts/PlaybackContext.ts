import { createContext } from 'react';
import { Track } from '../../../shared/types';

export type PlaybackMode = 'normal' | 'repeat-one' | 'repeat-all' | 'shuffle';

export interface PlaybackContextValue {
    isPlaying: boolean;
    currentTrack: Track | null;
    currentTrackIndex: number;
    playbackMode: PlaybackMode;
    shuffleQueue: number[]; // Array of shuffled track indices
    togglePlayback: () => void;
    selectTrack: (track: Track, index: number, autoPlay?: boolean) => void;
    nextTrack: (tracks: Track[], autoPlay?: boolean) => void;
    previousTrack: (tracks: Track[], autoPlay?: boolean) => void;
    setPlaybackMode: (mode: PlaybackMode) => void;
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
    playbackMode: 'normal',
    shuffleQueue: [],
    togglePlayback: () => {},
    selectTrack: () => {},
    nextTrack: () => {},
    previousTrack: () => {},
    setPlaybackMode: () => {},
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


