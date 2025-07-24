"use client";

import React, { useState, FC, useCallback, useEffect } from 'react';
import { PlaybackContext, PlaybackMode } from '../contexts/PlaybackContext';
import { Track } from '../../../../shared/types';

interface PlaybackProviderProps {
    children: React.ReactNode;
}

export const PlaybackProvider: FC<PlaybackProviderProps> = ({ children }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
    const [currentTrackIndex, setCurrentTrackIndex] = useState<number | null>(null);
    const [currentPlaylistContext, setCurrentPlaylistContext] = useState<{ isPlaylistView: boolean; playlistId: string | null }>({ isPlaylistView: false, playlistId: null });
    const [playbackMode, setPlaybackMode] = useState<PlaybackMode>('normal');
    const [shuffleQueue, setShuffleQueue] = useState<number[]>([]);
    const [spacebarPlaybackEnabled, setSpacebarPlaybackEnabled] = useState(true);
    const [isCommentInputFocused, setIsCommentInputFocused] = useState(false); 
    
    // Initialize volume from localStorage or default to 75%
    const [volume, setVolume] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('soundhaven-volume');
            const savedVolume = saved ? parseFloat(saved) : 0.75;
            console.log('🔊 [PLAYBACK PROVIDER] Loading volume from localStorage:', savedVolume);
            return savedVolume;
        }
        return 0.75;
    });

    // Initialize playback speed from localStorage or default to 1.0
    const [playbackSpeed, setPlaybackSpeed] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('soundhaven-playback-speed');
            const savedSpeed = saved ? parseFloat(saved) : 1.0;
            console.log('⚡ [PLAYBACK PROVIDER] Loading playback speed from localStorage:', savedSpeed);
            return savedSpeed;
        }
        return 1.0;
    });

    // Save volume to localStorage whenever it changes
    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('soundhaven-volume', volume.toString());
            console.log('🔊 [PLAYBACK PROVIDER] Saved volume to localStorage:', volume);
        }
    }, [volume]);

    // Save playback speed to localStorage whenever it changes
    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('soundhaven-playback-speed', playbackSpeed.toString());
            console.log('⚡ [PLAYBACK PROVIDER] Saved playback speed to localStorage:', playbackSpeed);
        }
    }, [playbackSpeed]);

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
        console.log("😺 [TOGGLE PLAYBACK] === togglePlayback called ===");
        console.log("😺 [TOGGLE PLAYBACK] Current isPlaying before toggle:", isPlaying);
        setIsPlaying(prevIsPlaying => {
            const newIsPlaying = !prevIsPlaying;
            console.log(`😺 [TOGGLE PLAYBACK] Toggling isPlaying: ${prevIsPlaying} → ${newIsPlaying}`);
            return newIsPlaying;
        });
        console.log("😺 [TOGGLE PLAYBACK] === togglePlayback end ===");
    }, [isPlaying]);

    const selectTrack = useCallback((track: Track | null, index: number | null, autoPlay: boolean = false, context?: { isPlaylistView?: boolean; playlistId?: string | null }) => {
        console.log("😺 [SELECT TRACK] === selectTrack START ===");
        console.log("😺 [SELECT TRACK] Selecting track:", track?.name, "at index:", index, "autoPlay:", autoPlay, "context:", context);
        console.log("😺 [SELECT TRACK] Current track:", currentTrack?.name, "at index:", currentTrackIndex);
        console.log("😺 [SELECT TRACK] Current isPlaying:", isPlaying);
        
        if (track === null) {
            console.log("😺 [SELECT TRACK] Setting track to null");
            setCurrentTrack(null);
            setCurrentTrackIndex(null);
            setCurrentPlaylistContext({ isPlaylistView: false, playlistId: null });
            setIsPlaying(false);
        } else {
            // For playlist tracks, we need to compare both track ID and index to handle duplicates
            const currentTrackId = currentTrack?.id;
            const newTrackId = track.id;
            const currentIndex = currentTrackIndex;
            const newIndex = index;
            
            // Check if this is the same track AND same position (for duplicates)
            const isSameTrackAndIndex = currentTrackId === newTrackId && currentIndex === newIndex;
            
            console.log("😺 [SELECT TRACK] Comparison:", {
                currentTrackId,
                newTrackId,
                currentIndex,
                newIndex,
                isSameTrackAndIndex,
                isPlaying
            });
            
            if (isSameTrackAndIndex && isPlaying && !autoPlay) {
                console.log("😺 [SELECT TRACK] Same track and index already playing - pausing");
                setIsPlaying(false);
            } else {
                console.log("😺 [SELECT TRACK] Setting new track:", {
                    trackName: track.name,
                    trackId: track.id,
                    index: index,
                    willAutoPlay: autoPlay,
                    context: context
                });
                
                console.log("😺 [SELECT TRACK] About to call setCurrentTrack, setCurrentTrackIndex, setCurrentPlaylistContext");
                setCurrentTrack(track);
                setCurrentTrackIndex(index);
                setCurrentPlaylistContext(context || { isPlaylistView: false, playlistId: null });
                
                console.log(`😺 [SELECT TRACK] About to call setIsPlaying(${autoPlay}) - THIS SHOULD TRIGGER AUDIO`);
                setIsPlaying(autoPlay);
                console.log(`😺 [SELECT TRACK] setIsPlaying(${autoPlay}) called - if autoPlay=true, audio should start playing`);
            }
        }
        
        console.log("😺 [SELECT TRACK] === selectTrack END ===");
    }, [currentTrack, currentTrackIndex, isPlaying]);

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
        // Keep the same context when advancing tracks
        selectTrack(tracks[nextIndex], nextIndex, autoPlay, currentPlaylistContext);
    }, [currentTrackIndex, playbackMode, shuffleQueue, selectTrack, createShuffleQueue, currentPlaylistContext]);
      
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
        // Keep the same context when going to previous tracks
        selectTrack(tracks[prevIndex], prevIndex, autoPlay, currentPlaylistContext);
    }, [currentTrackIndex, playbackMode, shuffleQueue, selectTrack, createShuffleQueue, currentPlaylistContext]);

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
              currentPlaylistContext,
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
