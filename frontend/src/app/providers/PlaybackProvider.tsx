"use client";

import React, { useState, FC, useCallback } from 'react';
import { PlaybackContext } from '../contexts/PlaybackContext';
import { Track } from '../../../../shared/types';

interface PlaybackProviderProps {
    children: React.ReactNode;
}

export const PlaybackProvider: FC<PlaybackProviderProps> = ({ children }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
    const [currentTrackIndex, setCurrentTrackIndex] = useState<number | null>(null);
    const [spacebarPlaybackEnabled, setSpacebarPlaybackEnabled] = useState(true);
    const [isCommentInputFocused, setIsCommentInputFocused] = useState(false); 
    const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
    const [volume, setVolume] = useState(1.0);

    const toggleSpacebarPlayback = useCallback(() => {
        setSpacebarPlaybackEnabled(prevEnabled => !prevEnabled);
    }, []);

    const togglePlayback = useCallback(() => {
        setIsPlaying(prevIsPlaying => !prevIsPlaying);
    }, []);

    const selectTrack = useCallback((track: Track | null, index: number | null) => {
        console.log("Selecting track:", track);
        if (track === null) {
            setCurrentTrack(null);
            setCurrentTrackIndex(null);
            setIsPlaying(false);
        } else if (currentTrack?.id === track.id && isPlaying) {
            setIsPlaying(false);
        } else {
            setCurrentTrack(track);
            setCurrentTrackIndex(index);
            setIsPlaying(true);
        }
    }, [currentTrack?.id, isPlaying]);

    const nextTrack = useCallback((tracks: Track[]) => {
        if (tracks.length === 0) return; // No tracks to play
        
        const nextIndex = currentTrackIndex !== null 
          ? (currentTrackIndex + 1) % tracks.length 
          : 0; // If no track is currently selected, start from the beginning
        
        selectTrack(tracks[nextIndex], nextIndex);
      }, [currentTrackIndex, selectTrack]);
      
      const previousTrack = useCallback((tracks: Track[]) => {
        if (tracks.length === 0) return; // No tracks to play
        
        const prevIndex = currentTrackIndex !== null 
          ? (currentTrackIndex - 1 + tracks.length) % tracks.length 
          : tracks.length - 1; // If no track is currently selected, start from the end
        
        selectTrack(tracks[prevIndex], prevIndex);
      }, [currentTrackIndex, selectTrack]);

    return (
        <PlaybackContext.Provider value={
            { 
              isPlaying,
              currentTrack, 
              currentTrackIndex, 
              togglePlayback, 
              selectTrack, 
              nextTrack, 
              previousTrack, 
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
