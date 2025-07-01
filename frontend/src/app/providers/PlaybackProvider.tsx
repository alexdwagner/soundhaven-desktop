"use client";

import React, { useState, FC, useCallback } from 'react';
import { PlaybackContext, PlaybackMode } from '../contexts/PlaybackContext';
import { Track } from '../../../../shared/types';

interface PlaybackProviderProps {
    children: React.ReactNode;
}

export const PlaybackProvider: FC<PlaybackProviderProps> = ({ children }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
    const [currentTrackIndex, setCurrentTrackIndex] = useState<number | null>(null);
    const [playbackMode, setPlaybackMode] = useState<PlaybackMode>('normal');
    const [shuffleQueue, setShuffleQueue] = useState<number[]>([]);
    const [spacebarPlaybackEnabled, setSpacebarPlaybackEnabled] = useState(true);
    const [isCommentInputFocused, setIsCommentInputFocused] = useState(false); 
    const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
    const [volume, setVolume] = useState(1.0);

    // Utility function to create shuffled queue
    const createShuffleQueue = useCallback((tracks: Track[], currentIndex?: number) => {
        const indices = tracks.map((_, index) => index);
        
        // Remove current track from indices if provided
        if (currentIndex !== undefined && currentIndex !== null) {
            indices.splice(currentIndex, 1);
        }
        
        // Fisher-Yates shuffle
        for (let i = indices.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [indices[i], indices[j]] = [indices[j], indices[i]];
        }
        
        // Add current track at the beginning if provided
        if (currentIndex !== undefined && currentIndex !== null) {
            indices.unshift(currentIndex);
        }
        
        return indices;
    }, []);

    const toggleSpacebarPlayback = useCallback(() => {
        setSpacebarPlaybackEnabled(prevEnabled => !prevEnabled);
    }, []);

    const togglePlayback = useCallback(() => {
        setIsPlaying(prevIsPlaying => !prevIsPlaying);
    }, []);

    const selectTrack = useCallback((track: Track | null, index: number | null, autoPlay: boolean = false) => {
        console.log("🎵 [PLAYBACK] Selecting track:", track?.name, "autoPlay:", autoPlay);
        if (track === null) {
            setCurrentTrack(null);
            setCurrentTrackIndex(null);
            setIsPlaying(false);
        } else if (currentTrack?.id === track.id && isPlaying) {
            setIsPlaying(false);
        } else {
            setCurrentTrack(track);
            setCurrentTrackIndex(index);
            // Auto-play if requested (used for sequential playback)
            setIsPlaying(autoPlay);
        }
    }, [currentTrack?.id, isPlaying]);

    const nextTrack = useCallback((tracks: Track[], autoPlay: boolean = false) => {
        console.log("🎵 [PLAYBACK] nextTrack called, mode:", playbackMode, "autoPlay:", autoPlay);
        
        if (tracks.length === 0) return; // No tracks to play
        
        let nextIndex: number;
        
        switch (playbackMode) {
            case 'repeat-one':
                // Repeat the same track
                nextIndex = currentTrackIndex !== null ? currentTrackIndex : 0;
                break;
                
            case 'shuffle':
                // Use shuffle queue
                if (shuffleQueue.length === 0) {
                    // Create new shuffle queue
                    const newQueue = createShuffleQueue(tracks, currentTrackIndex);
                    setShuffleQueue(newQueue);
                    nextIndex = newQueue.length > 1 ? newQueue[1] : 0;
                } else {
                    // Find current position in shuffle queue and get next
                    const currentPos = shuffleQueue.findIndex(idx => idx === currentTrackIndex);
                    if (currentPos >= 0 && currentPos < shuffleQueue.length - 1) {
                        nextIndex = shuffleQueue[currentPos + 1];
                    } else {
                        // End of queue - create new one or stop
                        if (playbackMode === 'repeat-all') {
                            const newQueue = createShuffleQueue(tracks);
                            setShuffleQueue(newQueue);
                            nextIndex = newQueue[0];
                        } else {
                            return; // Stop playing
                        }
                    }
                }
                break;
                
            case 'repeat-all':
            case 'normal':
            default:
                // Normal sequential playback
                if (currentTrackIndex !== null) {
                    if (currentTrackIndex + 1 < tracks.length) {
                        nextIndex = currentTrackIndex + 1;
                    } else if (playbackMode === 'repeat-all') {
                        nextIndex = 0; // Loop back to start
                    } else {
                        console.log("🎵 [PLAYBACK] End of playlist reached");
                        return; // Stop playing
                    }
                } else {
                    nextIndex = 0; // Start from beginning
                }
                break;
        }
        
        console.log("🎵 [PLAYBACK] Next track index:", nextIndex);
        selectTrack(tracks[nextIndex], nextIndex, autoPlay);
    }, [currentTrackIndex, playbackMode, shuffleQueue, selectTrack, createShuffleQueue]);
      
    const previousTrack = useCallback((tracks: Track[], autoPlay: boolean = false) => {
        console.log("🎵 [PLAYBACK] previousTrack called, mode:", playbackMode, "autoPlay:", autoPlay);
        
        if (tracks.length === 0) return; // No tracks to play
        
        let prevIndex: number;
        
        switch (playbackMode) {
            case 'repeat-one':
                // Repeat the same track
                prevIndex = currentTrackIndex !== null ? currentTrackIndex : 0;
                break;
                
            case 'shuffle':
                // Use shuffle queue in reverse
                if (shuffleQueue.length === 0) {
                    // Create new shuffle queue
                    const newQueue = createShuffleQueue(tracks, currentTrackIndex);
                    setShuffleQueue(newQueue);
                    prevIndex = newQueue[0];
                } else {
                    // Find current position in shuffle queue and get previous
                    const currentPos = shuffleQueue.findIndex(idx => idx === currentTrackIndex);
                    if (currentPos > 0) {
                        prevIndex = shuffleQueue[currentPos - 1];
                    } else {
                        // Beginning of queue - wrap around or stop
                        if (playbackMode === 'repeat-all') {
                            prevIndex = shuffleQueue[shuffleQueue.length - 1];
                        } else {
                            return; // Stop
                        }
                    }
                }
                break;
                
            case 'repeat-all':
            case 'normal':
            default:
                // Normal sequential playback
                if (currentTrackIndex !== null) {
                    if (currentTrackIndex > 0) {
                        prevIndex = currentTrackIndex - 1;
                    } else if (playbackMode === 'repeat-all') {
                        prevIndex = tracks.length - 1; // Loop to end
                    } else {
                        return; // Stop playing
                    }
                } else {
                    prevIndex = tracks.length - 1; // Start from end
                }
                break;
        }
        
        console.log("🎵 [PLAYBACK] Previous track index:", prevIndex);
        selectTrack(tracks[prevIndex], prevIndex, autoPlay);
    }, [currentTrackIndex, playbackMode, shuffleQueue, selectTrack, createShuffleQueue]);

    // Function to change playback mode
    const handleSetPlaybackMode = useCallback((mode: PlaybackMode) => {
        console.log("🎵 [PLAYBACK] Setting playback mode to:", mode);
        setPlaybackMode(mode);
        
        // Clear shuffle queue when changing modes
        if (mode !== 'shuffle') {
            setShuffleQueue([]);
        }
    }, []);

    return (
        <PlaybackContext.Provider value={
            { 
              isPlaying,
              currentTrack, 
              currentTrackIndex,
              playbackMode,
              shuffleQueue,
              togglePlayback, 
              selectTrack, 
              nextTrack, 
              previousTrack,
              setPlaybackMode: handleSetPlaybackMode,
              spacebarPlaybackEnabled, 
              toggleSpacebarPlayback,
              isCommentInputFocused, 
              setIsCommentInputFocused,
              playbackSpeed,
              setPlaybackSpeed,
              volume,
              setVolume,
              }
            }
        >
            {children}
        </PlaybackContext.Provider>
    );
};
