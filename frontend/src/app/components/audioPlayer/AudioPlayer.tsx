import React, { useCallback, useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import type { WaveSurfer as WaveSurferType } from 'wavesurfer.js';
import type { Region } from 'wavesurfer.js/dist/plugins/regions';
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.js";
import { useComments } from "@/app/hooks/useComments";
import { Marker as MarkerType } from "../../../../../shared/types";

// Extend the WaveSurfer type to include our custom properties
declare module 'wavesurfer.js' {
  interface WaveSurfer {
    // Add the regions property to WaveSurfer instance
    regions?: {
      getRegions: () => Region[];
      addRegion: (options: RegionParams) => Region;
      clearRegions: () => void;
    };
    // Add any other missing methods that we use
    getDuration: () => number;
    getCurrentTime: () => number;
    isPlaying: () => boolean;
    play: (start?: number, end?: number) => Promise<void>;
    pause: () => void;
    setTime: (time: number) => void;
    setVolume: (volume: number) => void;
    setPlaybackRate: (rate: number) => void;
    load: (url: string) => Promise<void>;
    on: (event: string, callback: (...args: any[]) => void) => void;
    destroy: () => void;
  }

  // Add RegionParams type if not already defined
  interface RegionParams {
    id?: string;
    start: number;
    end: number;
    color?: string;
    drag?: boolean;
    resize?: boolean;
    channelIdx?: number;
    content?: string | HTMLElement;
    data?: {
      commentId: string;
      color?: string;
    };
  }
}

// Types
interface Marker {
  id: string;
  time: number;
  commentId: string;
  color?: string;
}

interface Track {
  id: number;
  name: string;
  artist?: { name: string };
  filePath: string;
  duration: number;
  markers?: Marker[];
}

// Type for our custom region data
interface CustomRegionData {
  commentId: string;
  color?: string;
}

// Type for WaveSurfer instance with our custom properties
type WaveSurferWithRegions = WaveSurferType;

// AudioPlayer props
interface AudioPlayerProps {
  track: Track | null;
  isPlaying: boolean;
  onPlayPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (volume: number) => void;
  onPlaybackSpeedChange: (speed: number) => void;
  onAddComment: (time: number) => void;
  volume: number;
  playbackSpeed: number;
  waveSurferRef?: React.MutableRefObject<WaveSurferWithRegions | null>;
  regionsRef?: React.MutableRefObject<any>;
}

// Define the region type
interface WaveSurferRegion extends Region {
  data?: {
    commentId: number;
    color?: string;
  };
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({
  track,
  isPlaying,
  onPlayPause,
  onNext,
  onPrevious,
  onSeek,
  onVolumeChange,
  onPlaybackSpeedChange,
  onAddComment,
  volume,
  playbackSpeed,
  waveSurferRef: externalWaveSurferRef,
  regionsRef: externalRegionsRef,
}) => {
  const waveformRef = useRef<HTMLDivElement>(null);
  const internalWaveSurferRef = useRef<WaveSurferWithRegions | null>(null);
  const internalRegionsRef = useRef<any>(null);
  
  // Use external refs if provided, otherwise use internal refs
  const waveSurferRef = externalWaveSurferRef || internalWaveSurferRef;
  const regionsRef = externalRegionsRef || internalRegionsRef;
  
  const [isReady, setIsReady] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string>('');
  const [isPlayingState, setIsPlaying] = useState(isPlaying);
  const [volumeState, setVolume] = useState(volume);
  const [playbackSpeedState, setPlaybackSpeed] = useState(playbackSpeed);
  const [error, setError] = useState<string | null>(null);

  // Sync internal isPlayingState with external isPlaying prop
  useEffect(() => {
    console.log('🎵 AudioPlayer: isPlaying prop changed:', isPlaying);
    setIsPlaying(isPlaying);
    
    // If we should be playing and WaveSurfer is ready, start playback
    if (isPlaying && waveSurferRef.current && isReady) {
      console.log('🎵 AudioPlayer: Auto-starting playback from prop change');
      try {
        waveSurferRef.current.play();
      } catch (error) {
        console.error('❌ AudioPlayer: Error auto-starting playback:', error);
      }
    } else if (!isPlaying && waveSurferRef.current) {
      console.log('🎵 AudioPlayer: Auto-pausing playback from prop change');
      try {
        waveSurferRef.current.pause();
      } catch (error) {
        console.error('❌ AudioPlayer: Error auto-pausing playback:', error);
      }
    }
  }, [isPlaying, isReady]);

  // Get markers from comments context
  const { markers, setSelectedCommentId, regionCommentMap, setRegionCommentMap } = useComments(waveSurferRef as any, regionsRef as any);

  // Debug markers in AudioPlayer
  useEffect(() => {
    console.log('=== AUDIOPLAYER MARKERS DEBUG ===');
    console.log('markers from useComments:', markers);
    console.log('markers length:', markers?.length);
    console.log('markers type:', typeof markers);
  }, [markers]);

  // Handle WaveSurfer errors with enhanced recovery
  const handleWaveSurferError = useCallback((error: any) => {
    console.log('🎵 AudioPlayer: WaveSurfer error occurred:', {
      errorType: error.constructor.name,
      message: error.message,
      stack: error.stack,
      url: track?.filePath,
      trackId: track?.id,
      audioUrl: audioUrl,
      isReady: isReady
    });
    
    // Handle specific error types
    if (error.message && error.message.includes('Empty src attribute')) {
      console.log('🔄 AudioPlayer: Empty src error detected - will retry on next track change...');
      setError(`Audio source cleared - please try selecting the track again`);
      return;
    }
    
    // For non-local files, we can't use fallback
    if (track?.filePath && !track.filePath.startsWith('http')) {
      console.log('❌ AudioPlayer: Non-local file error, cannot use fallback:', {
        error: error.constructor.name,
        url: track.filePath
      });
      setError(`Unable to load audio file: ${error.message}`);
      return;
    }
    
    setError(`Audio loading failed: ${error.message}`);
  }, [track, audioUrl, isReady]);

  // Enhanced getFileUrl function with better error handling
  const getFileUrl = useCallback(async (filePath: string): Promise<string> => {
    console.log('🎵 AudioPlayer: Getting file URL for:', filePath);
    
    try {
      // For Electron, always use audio server for better compatibility
      const fileName = filePath.replace('/uploads/', '');
      const audioServerUrl = `http://localhost:3000/audio/${fileName}`;
      
      console.log('🎵 AudioPlayer: Using audio server URL for better compatibility:', {
        originalPath: filePath,
        fileName: fileName,
        audioServerUrl: audioServerUrl
      });
      
      return audioServerUrl;
      
    } catch (error) {
      console.warn('⚠️ AudioPlayer: Error getting file URL, using fallback:', {
        error: error,
        filePath: filePath
      });
      
      // Fallback to audio server
      const fileName = filePath.replace('/uploads/', '');
      const audioServerUrl = `http://localhost:3000/audio/${fileName}`;
      
      console.log('🎵 AudioPlayer: Using audio server fallback:', {
        originalPath: filePath,
        fileName: fileName,
        fallbackUrl: audioServerUrl
      });
      
      return audioServerUrl;
    }
  }, []);

  // Function to add markers to waveform
  const addMarkersToWaveform = useCallback(() => {
    if (!regionsRef.current || !markers || markers.length === 0) {
      console.log('🎯 Cannot add markers - missing regions plugin or no markers');
      return;
    }

    console.log('🎯 Adding markers to waveform:', markers.length);
    
    try {
      // Clear existing regions
      regionsRef.current.clearRegions();
      
      // Add new regions for each marker
      markers.forEach((marker: any, index: number) => {
        console.log(`🎯 Adding region for marker ${index + 1}:`, marker);
        try {
          // Check if the marker has all required properties
          if (!marker.time && marker.time !== 0) {
            console.error('❌ Marker missing time property:', marker);
            return;
          }
          
          const regionId = marker.waveSurferRegionID || `marker-${marker.id}-${Date.now()}`;
          const region = regionsRef.current.addRegion({
            id: regionId,
            start: marker.time,
            end: marker.time + 1.0, // 1 second markers
            color: marker.data?.customColor || 'rgba(255, 0, 0, 0.8)', // More opaque for visibility
            drag: false,
            resize: false,
            data: {
              commentId: marker.commentId,
            },
          });

          // Add hover effects for this region
          if (region && region.element) {
            const originalColor = marker.data?.customColor || 'rgba(255, 0, 0, 0.8)';
            const hoverColor = 'rgba(255, 165, 0, 0.9)'; // Orange on hover
            
            // Set cursor and add hover listeners
            region.element.style.cursor = 'pointer';
            
            region.element.addEventListener('mouseenter', () => {
              region.setOptions({ color: hoverColor });
            });
            
            region.element.addEventListener('mouseleave', () => {
              region.setOptions({ color: originalColor });
            });
          }
          
          console.log(`✅ Region ${index + 1} created successfully:`, region);
          
          // Update the regionCommentMap
          setRegionCommentMap((prevMap: Record<string, number>) => ({
            ...prevMap,
            [regionId]: marker.commentId
          }));
          console.log(`✅ Updated regionCommentMap: ${regionId} -> ${marker.commentId}`);
        } catch (error) {
          console.error(`❌ Error creating region for marker ${index + 1}:`, marker, error);
        }
      });
      
      console.log('🎯 All markers added successfully');
    } catch (error) {
      console.error('❌ Error adding markers to waveform:', error);
    }
  }, [markers, setRegionCommentMap]);

  // PROACTIVE CLEANUP: Based on successful emergency cleanup function
  const proactiveAudioCleanup = useCallback(() => {
    console.log('🔥 [AUDIO-LOOP-DEBUG] 🧹 PROACTIVE CLEANUP STARTING...');
    console.log('🔥 [AUDIO-LOOP-DEBUG] Current track before cleanup:', track?.name);
    
    let cleanedItems = 0;
    
    // STEP 0: Initial state analysis
    const initialAudioElements = document.querySelectorAll('audio, video');
    const initialBlobElements = Array.from(document.getElementsByTagName('*')).filter(el => {
      return (el as any).src && (el as any).src.startsWith('blob:');
    });
    const initialState = {
      audioElements: initialAudioElements.length,
      blobElements: initialBlobElements.length,
      trackedContexts: ((window as any).audioContexts || []).length
    };
    console.log('🔥 [AUDIO-LOOP-DEBUG] Initial state:', 
      `audioElements: ${initialState.audioElements}, blobElements: ${initialState.blobElements}, trackedContexts: ${initialState.trackedContexts}`);
    
    // 1. Clean tracked audio contexts (same as emergency cleanup)
    console.log('🔥 [AUDIO-LOOP-DEBUG] STEP 1: Cleaning tracked audio contexts...');
    const globalContexts = (window as any).audioContexts || [];
    console.log('🔥 [AUDIO-LOOP-DEBUG] Found tracked contexts:', globalContexts.length);
    
    globalContexts.forEach((ctx: any, index: number) => {
      try {
        console.log(`🔥 [AUDIO-LOOP-DEBUG] Processing context ${index + 1}:`, {
          hasMedia: !!ctx.media,
          isPlaying: ctx.isPlaying ? ctx.isPlaying() : 'unknown',
          mediaInfo: ctx.media ? {
            src: ctx.media.src?.substring(0, 50) + '...',
            paused: ctx.media.paused,
            currentTime: ctx.media.currentTime
          } : null
        });
        
        if (ctx.isPlaying && ctx.isPlaying()) {
          console.log(`🔥 [AUDIO-LOOP-DEBUG] Pausing context ${index + 1}...`);
          ctx.pause();
        }
        
        if (ctx.media) {
          ctx.media.pause();
          ctx.media.currentTime = 0;
          
          if (ctx.media.src && ctx.media.src.startsWith('blob:')) {
            console.log(`🔥 [AUDIO-LOOP-DEBUG] 🗑️ Revoking blob from context ${index + 1}: ${ctx.media.src.substring(0, 50)}...`);
            URL.revokeObjectURL(ctx.media.src);
            cleanedItems++;
          }
          
          ctx.media.src = '';
          ctx.media.load();
          console.log(`🔥 [AUDIO-LOOP-DEBUG] ✅ Context ${index + 1} media cleaned`);
        }
      } catch (e) {
        console.log(`🔥 [AUDIO-LOOP-DEBUG] ❌ Error in context cleanup ${index + 1}:`, e);
      }
    });
    
    // 2. Clean all DOM audio elements (same as emergency cleanup)
    console.log('🔥 [AUDIO-LOOP-DEBUG] STEP 2: Cleaning DOM audio elements...');
    const allAudio = document.querySelectorAll('audio, video');
    console.log('🔥 [AUDIO-LOOP-DEBUG] Found DOM audio elements:', allAudio.length);
    
    allAudio.forEach((audio, index) => {
      const audioEl = audio as HTMLMediaElement;
      try {
        console.log(`🔥 [AUDIO-LOOP-DEBUG] Processing DOM audio ${index + 1}:`, {
          src: audioEl.src?.substring(0, 50) + '...',
          paused: audioEl.paused,
          currentTime: audioEl.currentTime,
          parentElement: audioEl.parentElement?.tagName || 'orphaned'
        });
        
        audioEl.pause();
        audioEl.currentTime = 0;
        
        if (audioEl.src && audioEl.src.startsWith('blob:')) {
          console.log(`🔥 [AUDIO-LOOP-DEBUG] 🗑️ Revoking DOM blob ${index + 1}: ${audioEl.src.substring(0, 50)}...`);
          URL.revokeObjectURL(audioEl.src);
          cleanedItems++;
        }
        
        audioEl.src = '';
        audioEl.load();
        console.log(`🔥 [AUDIO-LOOP-DEBUG] ✅ DOM audio ${index + 1} cleaned`);
      } catch (e) {
        console.log(`🔥 [AUDIO-LOOP-DEBUG] ❌ Error in DOM cleanup ${index + 1}:`, e);
      }
    });
    
    // 3. Clean current WaveSurfer media element directly
    if (waveSurferRef.current) {
      try {
        const ws = waveSurferRef.current;
        
        if (ws.isPlaying && ws.isPlaying()) {
          ws.pause();
        }
        
        if ((ws as any).media) {
          const media = (ws as any).media;
          if (media.src && media.src.startsWith('blob:')) {
            console.log(`🧹 Proactively revoking WaveSurfer blob: ${media.src.substring(0, 50)}...`);
            URL.revokeObjectURL(media.src);
            cleanedItems++;
          }
        }
      } catch (e) {
        console.log('🧹 Error in proactive WaveSurfer cleanup:', e);
      }
    }
    
    // FINAL STEP: Verification and summary
    console.log('🔥 [AUDIO-LOOP-DEBUG] STEP 4: Final verification...');
    const finalAudioElements = document.querySelectorAll('audio, video');
    const finalBlobElements = Array.from(document.getElementsByTagName('*')).filter(el => {
      return (el as any).src && (el as any).src.startsWith('blob:');
    });
    
    console.log('🔥 [AUDIO-LOOP-DEBUG] 🧹 PROACTIVE CLEANUP COMPLETED!');
    console.log('🔥 [AUDIO-LOOP-DEBUG] Cleanup summary:', {
      itemsCleaned: cleanedItems,
      audioElementsBefore: initialAudioElements.length,
      audioElementsAfter: finalAudioElements.length,
      blobElementsBefore: initialBlobElements.length,
      blobElementsAfter: finalBlobElements.length,
      currentTrack: track?.name
    });
    
    return cleanedItems;
  }, []);

  // Enhanced WaveSurfer initialization with better error handling and singleton enforcement
  const initializeWaveSurfer = useCallback(async () => {
    console.log('🔥 [AUDIO-LOOP-DEBUG] 🚀 initializeWaveSurfer STARTING');
    console.log('🔥 [AUDIO-LOOP-DEBUG] Track:', track?.name);
    console.log('🔥 [AUDIO-LOOP-DEBUG] AudioUrl:', audioUrl);
    console.log('🔥 [AUDIO-LOOP-DEBUG] Current waveSurferRef:', waveSurferRef.current ? 'EXISTS' : 'NULL');
    
    if (!track || !waveformRef.current) {
      console.log('🔥 [AUDIO-LOOP-DEBUG] ❌ Missing track or waveform container, aborting');
      return;
    }

    // STEP 1: Check state BEFORE any cleanup/destruction
    console.log('🔥 [AUDIO-LOOP-DEBUG] 📊 BEFORE DESTRUCTION:');
    const beforeAudio = document.querySelectorAll('audio, video');
    const beforeBlobs = Array.from(document.getElementsByTagName('*')).filter(el => {
      return (el as any).src && (el as any).src.startsWith('blob:');
    });
    console.log('🔥 [AUDIO-LOOP-DEBUG] Before state:', {
      audioElements: beforeAudio.length,
      blobElements: beforeBlobs.length,
      trackedContexts: ((window as any).audioContexts || []).length
    });

    // STEP 2: Run proactive cleanup
    console.log('🔥 [AUDIO-LOOP-DEBUG] 🧹 Running proactive cleanup during initializeWaveSurfer...');
    const cleanedItems = proactiveAudioCleanup();
    console.log(`🔥 [AUDIO-LOOP-DEBUG] Proactive cleanup completed: ${cleanedItems} items cleaned`);
    
    // Add a small delay to let cleanup complete
    await new Promise(resolve => setTimeout(resolve, 100));

    // Count existing WaveSurfer instances in the DOM
    const existingWaveforms = document.querySelectorAll('[data-wavesurfer]');
    console.log('🎵 [DEBUG] Existing WaveSurfer DOM elements:', existingWaveforms.length);
    
    // Check for existing audio elements
    const existingAudioElements = document.querySelectorAll('audio');
    console.log('🎵 [DEBUG] Existing audio elements:', existingAudioElements.length);
    
    // Check Web Audio API contexts
    console.log('🎵 [DEBUG] AudioContext state before cleanup:', 
      (window as any).audioContexts?.length || 'No global contexts tracked');

    // Destroy any existing instance before creating a new one
    if (waveSurferRef.current) {
      console.log('🎵 [DEBUG] Destroying existing WaveSurfer instance...');
      
      try {
        const oldInstance = waveSurferRef.current;
        waveSurferRef.current = null;
        setIsReady(false);
        
        // Log the instance state before destruction
        console.log('🎵 [DEBUG] Instance state before destruction:');
        console.log('  - Is playing:', oldInstance.isPlaying ? oldInstance.isPlaying() : 'unknown');
        console.log('  - Current time:', oldInstance.getCurrentTime ? oldInstance.getCurrentTime() : 'unknown');
        console.log('  - Duration:', oldInstance.getDuration ? oldInstance.getDuration() : 'unknown');
        
        // AGGRESSIVE CLEANUP: Stop all audio immediately
        try {
          if (oldInstance.isPlaying && oldInstance.isPlaying()) {
            console.log('🎵 [DEBUG] Force stopping audio...');
            oldInstance.pause();
          }
        } catch (e) {
          console.log('🎵 [DEBUG] Error stopping audio:', e);
        }
        
        // CRITICAL: Clean up blob URLs and orphaned media elements
        try {
          // ENHANCED: Get the media element directly from WaveSurfer (it might be orphaned)
          const mediaElement = (oldInstance as any).media;
          if (mediaElement) {
            console.log('🎵 [DEBUG] Found WaveSurfer media element:', {
              src: mediaElement.src,
              currentTime: mediaElement.currentTime,
              paused: mediaElement.paused,
              parentElement: mediaElement.parentElement?.tagName || 'ORPHANED',
              isConnected: mediaElement.isConnected,
              nodeType: mediaElement.nodeType
            });
            
            // CRITICAL: Force stop the orphaned media element
            console.log('🎵 [DEBUG] Force stopping orphaned media element...');
            mediaElement.pause();
            mediaElement.currentTime = 0;
            
            // If it's a blob URL, revoke it immediately to free memory
            if (mediaElement.src && mediaElement.src.startsWith('blob:')) {
              console.log('🎵 [DEBUG] Revoking orphaned blob URL:', mediaElement.src);
              URL.revokeObjectURL(mediaElement.src);
            }
            
            // CRITICAL: Clear the src and force reload to stop any buffered audio
            mediaElement.src = '';
            mediaElement.removeAttribute('src');
            
            // Force the media element to reload/reset
            try {
              mediaElement.load();
              console.log('🎵 [DEBUG] Media element reloaded successfully');
            } catch (loadError) {
              console.log('🎵 [DEBUG] Media element load() failed (expected for orphaned elements):', loadError);
            }
            
            // ENHANCED: If the element is orphaned but still connected, try to remove it
            if (mediaElement.parentElement) {
              try {
                mediaElement.parentElement.removeChild(mediaElement);
                console.log('🎵 [DEBUG] Removed media element from parent');
              } catch (removeError) {
                console.log('🎵 [DEBUG] Could not remove media element from parent:', removeError);
              }
            }
            
            // CRITICAL: Set all media properties to null/stopped state
            try {
              mediaElement.volume = 0;
              mediaElement.muted = true;
              mediaElement.autoplay = false;
              mediaElement.loop = false;
              console.log('🎵 [DEBUG] Media element properties reset');
            } catch (propError) {
              console.log('🎵 [DEBUG] Could not reset media properties:', propError);
            }
            
            // ENHANCED: Remove all event listeners to prevent memory leaks
            try {
              // Clone the node to remove all event listeners
              const cleanElement = mediaElement.cloneNode(false);
              if (mediaElement.parentElement) {
                mediaElement.parentElement.replaceChild(cleanElement, mediaElement);
                console.log('🎵 [DEBUG] Replaced media element to remove listeners');
              }
            } catch (replaceError) {
              console.log('🎵 [DEBUG] Could not replace media element:', replaceError);
            }
            
          } else {
            console.log('🎵 [DEBUG] No media element found in WaveSurfer instance');
          }
        } catch (e) {
          console.log('🎵 [DEBUG] Error cleaning up media element:', e);
        }
        
        // Properly clean up the old instance
        try {
          // Check if the instance has a backend with audio context
          if ((oldInstance as any).backend && (oldInstance as any).backend.ac) {
            const audioContext = (oldInstance as any).backend.ac;
            console.log('🎵 [DEBUG] Found audio context, state:', audioContext.state);
            
            // Disconnect all audio nodes
            try {
              if (audioContext.destination) {
                audioContext.destination.disconnect();
                console.log('🎵 [DEBUG] Disconnected audio destination');
              }
            } catch (e) {
              console.log('🎵 [DEBUG] Could not disconnect destination:', e);
            }
            
            // Close the audio context
            try {
              if (audioContext.close && audioContext.state !== 'closed') {
                await audioContext.close();
                console.log('🎵 [DEBUG] Audio context closed');
              }
            } catch (e) {
              console.log('🎵 [DEBUG] Could not close audio context:', e);
            }
          }
          
          // Destroy the WaveSurfer instance
          if (oldInstance.destroy) {
            oldInstance.destroy();
            console.log('🎵 [DEBUG] WaveSurfer instance destroyed');
          }
          
        } catch (error) {
          console.log('🎵 [DEBUG] Error during cleanup:', error);
        }
        
        // GLOBAL CLEANUP: Find and clean up any orphaned media elements
        try {
          console.log('🎵 [DEBUG] Searching for orphaned media elements...');
          
          // Check all audio/video elements globally
          const allMediaElements = document.querySelectorAll('audio, video');
          console.log('🎵 [DEBUG] Found media elements in DOM:', allMediaElements.length);
          
          // Also check for orphaned elements (not in DOM but still in memory)
          // This is harder to do directly, but we can track them via our global context
          if ((window as any).audioContexts) {
            (window as any).audioContexts.forEach((ctx: any, index: number) => {
              try {
                if (ctx !== oldInstance && ctx.media) {
                  const orphanedMedia = ctx.media;
                  console.log(`🎵 [DEBUG] Found orphaned media ${index + 1}:`, {
                    src: orphanedMedia.src,
                    paused: orphanedMedia.paused,
                    parentElement: orphanedMedia.parentElement?.tagName || 'orphaned'
                  });
                  
                  // Clean up orphaned media
                  orphanedMedia.pause();
                  orphanedMedia.currentTime = 0;
                  
                  if (orphanedMedia.src && orphanedMedia.src.startsWith('blob:')) {
                    URL.revokeObjectURL(orphanedMedia.src);
                    console.log('🎵 [DEBUG] Revoked orphaned blob URL');
                  }
                  
                  orphanedMedia.src = '';
                  orphanedMedia.load();
                }
              } catch (e) {
                console.log('🎵 [DEBUG] Error cleaning orphaned media:', e);
              }
            });
          }
          
        } catch (e) {
          console.log('🎵 [DEBUG] Error during global cleanup:', e);
        }
        
        // Wait longer for cleanup to complete
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (error) {
        console.error('🎵 [DEBUG] Error destroying WaveSurfer:', error);
      }
    }

    // Check cleanup results
    const postCleanupWaveforms = document.querySelectorAll('[data-wavesurfer]');
    const postCleanupAudio = document.querySelectorAll('audio');
    console.log('🎵 [DEBUG] After cleanup - WaveSurfer elements:', postCleanupWaveforms.length);
    console.log('🎵 [DEBUG] After cleanup - Audio elements:', postCleanupAudio.length);

    // Clear the container
    if (waveformRef.current) {
      console.log('🎵 [DEBUG] Clearing waveform container...');
      waveformRef.current.innerHTML = '';
    }

    try {
      console.log('🎵 [DEBUG] Creating new WaveSurfer instance...');
      
      // Create new WaveSurfer instance
      const newWaveSurfer = WaveSurfer.create({
        container: waveformRef.current,
        waveColor: '#4F46E5',
        progressColor: '#7C3AED',
        cursorColor: '#EC4899',
        barWidth: 2,
        barRadius: 2,
        normalize: true,
        height: 60,
        plugins: [
          RegionsPlugin.create({
            dragSelection: {
              slop: 5
            }
          })
        ]
      });

      console.log('🎵 [DEBUG] New WaveSurfer instance created');
      
      // Track the new instance globally for debugging
      if (!(window as any).audioContexts) {
        (window as any).audioContexts = [];
      }
      (window as any).audioContexts.push(newWaveSurfer);
      
      // Store the new instance
      waveSurferRef.current = newWaveSurfer;
      
      // Get the regions plugin
      const regions = newWaveSurfer.registerPlugin(RegionsPlugin.create({}));
      regionsRef.current = regions;
      
      console.log('🎵 [DEBUG] Regions plugin registered');

      // Set up event listeners
      newWaveSurfer.on('ready', () => {
        console.log('🎵 [DEBUG] WaveSurfer ready event fired');
        setIsReady(true);
        setDuration(newWaveSurfer.getDuration());
        
        // Add markers after waveform is ready
        if (markers && markers.length > 0) {
          console.log('🎵 [DEBUG] Adding markers after ready:', markers.length);
          setTimeout(() => addMarkersToWaveform(), 100);
        }
      });

             newWaveSurfer.on('play', () => {
         console.log('🎵 [DEBUG] WaveSurfer play event fired');
         setIsPlaying(true);
       });

       newWaveSurfer.on('pause', () => {
         console.log('🎵 [DEBUG] WaveSurfer pause event fired');
         setIsPlaying(false);
       });

       newWaveSurfer.on('finish', () => {
         console.log('🎵 [DEBUG] WaveSurfer finish event fired');
         setIsPlaying(false);
        if (onNext) {
          onNext();
        }
      });

      newWaveSurfer.on('timeupdate', (currentTime) => {
        setCurrentTime(currentTime);
      });

      newWaveSurfer.on('error', (error) => {
        console.error('🎵 [DEBUG] WaveSurfer error:', error);
        handleWaveSurferError(error);
      });

      console.log('🔥 [AUDIO-LOOP-DEBUG] 🎵 Loading audio file:', audioUrl);
      await newWaveSurfer.load(audioUrl);
      console.log('🔥 [AUDIO-LOOP-DEBUG] ✅ Audio file loaded successfully');
      
      // CRITICAL: Check for orphaned elements AFTER loading
      console.log('🔥 [AUDIO-LOOP-DEBUG] 📊 AFTER LOADING:');
      const afterLoadAudio = document.querySelectorAll('audio, video');
      const afterLoadBlobs = Array.from(document.getElementsByTagName('*')).filter(el => {
        return (el as any).src && (el as any).src.startsWith('blob:');
      });
      console.log('🔥 [AUDIO-LOOP-DEBUG] After load state:', {
        audioElements: afterLoadAudio.length,
        blobElements: afterLoadBlobs.length
      });
      
      // Check WaveSurfer's internal media element
      const wsMedia = (newWaveSurfer as any).media;
      if (wsMedia) {
        const parentTag = wsMedia.parentElement?.tagName || 'ORPHANED ⚠️';
        const isOrphaned = parentTag === 'ORPHANED ⚠️';
        
        console.log('🔥 [AUDIO-LOOP-DEBUG] 🎵 WaveSurfer media element:', {
          src: wsMedia.src?.substring(0, 50) + '...',
          paused: wsMedia.paused,
          parentElement: parentTag,
          isConnected: wsMedia.isConnected,
          currentTime: wsMedia.currentTime
        });
        
        if (isOrphaned) {
          console.log('🔥 [AUDIO-LOOP-DEBUG] ⚠️ ORPHANED ELEMENT DETECTED AFTER LOADING!');
          console.log('🔥 [AUDIO-LOOP-DEBUG] This is likely the source of looping audio!');
          
          // IMMEDIATE CLEANUP: Don't wait for the next track switch
          console.log('🔥 [AUDIO-LOOP-DEBUG] 🧹 IMMEDIATE CLEANUP of orphaned element...');
          try {
            wsMedia.pause();
            wsMedia.currentTime = 0;
            if (wsMedia.src && wsMedia.src.startsWith('blob:')) {
              console.log('🔥 [AUDIO-LOOP-DEBUG] 🗑️ Revoking orphaned blob immediately:', wsMedia.src.substring(0, 50) + '...');
              URL.revokeObjectURL(wsMedia.src);
            }
            wsMedia.src = '';
            wsMedia.load();
            console.log('🔥 [AUDIO-LOOP-DEBUG] ✅ Immediate cleanup completed');
          } catch (e) {
            console.log('🔥 [AUDIO-LOOP-DEBUG] ❌ Error in immediate cleanup:', e);
          }
        }
      }

    } catch (error) {
      console.error('🎵 [DEBUG] Error during WaveSurfer initialization:', error);
      handleWaveSurferError(error);
    }
  }, [track?.id, track?.filePath, getFileUrl, markers, addMarkersToWaveform, handleWaveSurferError]);

  // Initialize WaveSurfer - CONSOLIDATED EFFECT
  useEffect(() => {
    console.log('🔥 [AUDIO-LOOP-DEBUG] ⚡ useEffect triggered with track:', track?.name || 'undefined');
    
    // Early return if no track is provided
    if (!track) {
      console.log('🔥 [AUDIO-LOOP-DEBUG] ❌ No track provided, skipping WaveSurfer initialization');
      // Clear regions if no track
      if (regionsRef.current) {
        console.log('🔥 [AUDIO-LOOP-DEBUG] 🧹 Clearing regions - no track');
        regionsRef.current.clearRegions();
        setRegionCommentMap({});
      }
      
      // CRITICAL: Still run cleanup even when track is undefined to catch orphaned elements
      console.log('🔥 [AUDIO-LOOP-DEBUG] 🧹 Running cleanup even with undefined track (catch orphans)...');
      proactiveAudioCleanup();
      return;
    }
    
    // CRITICAL: Track switching detected - this is where orphaned audio might exist
    console.log('🔥 [AUDIO-LOOP-DEBUG] 🎯 TRACK SWITCH DETECTED!');
    console.log('🔥 [AUDIO-LOOP-DEBUG] Switching to track:', track.name);
    console.log('🔥 [AUDIO-LOOP-DEBUG] Running proactive cleanup BEFORE creating new WaveSurfer...');
    
    // Check for existing orphaned elements BEFORE cleanup
    const preCleanupAudio = document.querySelectorAll('audio, video');
    const preCleanupBlobs = Array.from(document.getElementsByTagName('*')).filter(el => {
      return (el as any).src && (el as any).src.startsWith('blob:');
    });
    const preCleanupState = {
      audioElements: preCleanupAudio.length,
      blobElements: preCleanupBlobs.length,
      currentWaveSurfer: waveSurferRef.current ? 'EXISTS' : 'NULL'
    };
    console.log('🔥 [AUDIO-LOOP-DEBUG] PRE-CLEANUP STATE:', 
      `audioElements: ${preCleanupState.audioElements}, blobElements: ${preCleanupState.blobElements}, currentWaveSurfer: ${preCleanupState.currentWaveSurfer}`);
    
    proactiveAudioCleanup();
    
    console.log('AudioPlayer: Initializing WaveSurfer with track:', track);
    console.log('AudioPlayer: filePath:', track?.filePath);
    
    // Clear existing regions immediately when track changes
    if (regionsRef.current) {
      console.log('AudioPlayer: Clearing existing regions for track change');
      regionsRef.current.clearRegions();
      setRegionCommentMap({});
    }
    
    if (!waveformRef.current || !track?.filePath) {
      console.log('AudioPlayer: Missing waveformRef or filePath, returning early');
      return;
    }

    console.log('AudioPlayer: Creating WaveSurfer instance...');
    
    // Validate the audio file path
    if (!track.filePath || typeof track.filePath !== 'string') {
      console.error('AudioPlayer: Invalid filePath:', track.filePath);
      return;
    }
    
    // Always use audio server URL for better compatibility
    const fileName = track.filePath.replace('/uploads/', '');
    const audioServerUrl = `http://localhost:3000/audio/${fileName}`;
    
    console.log('AudioPlayer: Setting audioUrl to audio server URL:', audioServerUrl);
    setAudioUrl(audioServerUrl);
  }, [track?.id, track?.filePath]); // Only depend on stable track properties

  // Create WaveSurfer when audioUrl is available
  useEffect(() => {
    if (audioUrl && waveformRef.current) {
      // Type check to ensure audioUrl is a string
      if (typeof audioUrl !== 'string') {
        console.error('AudioPlayer: audioUrl is not a string!', audioUrl);
        return;
      }
      
      console.log('AudioPlayer: Creating WaveSurfer with audioUrl string:', audioUrl);
      initializeWaveSurfer();
    }
  }, [audioUrl]);

  // Handle play/pause
  const handlePlayPause = useCallback(() => {
    if (!waveSurferRef.current) {
      console.warn('🎵 AudioPlayer: No WaveSurfer instance available for play/pause');
      return;
    }

    try {
      if (isPlayingState) {
        console.log('🎵 AudioPlayer: Pausing audio');
        waveSurferRef.current.pause();
      } else {
        console.log('🎵 AudioPlayer: Playing audio');
        waveSurferRef.current.play();
      }
    } catch (error) {
      console.error('❌ AudioPlayer: Error during play/pause:', error);
    }
  }, [isPlayingState]);

  // Handle seek
  const handleSeek = useCallback((time: number) => {
    if (!waveSurferRef.current) {
      console.warn('🎵 AudioPlayer: No WaveSurfer instance available for seek');
      return;
    }

    try {
      console.log('🎵 AudioPlayer: Seeking to time:', time);
      waveSurferRef.current.seekTo(time / duration);
    } catch (error) {
      console.error('❌ AudioPlayer: Error during seek:', error);
    }
  }, [duration]);

  // Handle volume change
  const handleVolumeChange = useCallback((newVolume: number) => {
    if (!waveSurferRef.current) {
      console.warn('🎵 AudioPlayer: No WaveSurfer instance available for volume change');
      return;
    }

    try {
      console.log('🎵 AudioPlayer: Setting volume to:', newVolume);
      waveSurferRef.current.setVolume(newVolume / 100);
      setVolume(newVolume);
    } catch (error) {
      console.error('❌ AudioPlayer: Error during volume change:', error);
    }
  }, []);

  // Handle playback speed change
  const handleSpeedChange = useCallback((newSpeed: number) => {
    if (!waveSurferRef.current) {
      console.warn('🎵 AudioPlayer: No WaveSurfer instance available for speed change');
      return;
    }

    try {
      console.log('🎵 AudioPlayer: Setting playback speed to:', newSpeed);
      waveSurferRef.current.setPlaybackRate(newSpeed);
      setPlaybackSpeed(newSpeed);
    } catch (error) {
      console.error('❌ AudioPlayer: Error during speed change:', error);
    }
  }, []);

  // Add click handler for regions
  useEffect(() => {
    if (!regionsRef.current) return;
    
    const handleRegionClick = (region: WaveSurferRegion) => {
      console.log('=== REGION CLICKED ===');
      console.log('Region object:', region);
      console.log('Region ID:', region.id);
      console.log('Region data:', region.data);
      console.log('Region start:', region.start);
      console.log('Region end:', region.end);
      
      // Find the comment ID associated with this region
      if (region.data?.commentId) {
        console.log('✅ Comment ID from region data:', region.data.commentId);
        console.log('Calling setSelectedCommentId with:', region.data.commentId);
        setSelectedCommentId(region.data.commentId);
      } else {
        // Fallback: try to find comment ID from regionCommentMap
        const commentId = regionCommentMap[region.id];
        if (commentId) {
          console.log('✅ Comment ID from regionCommentMap:', commentId);
          console.log('Calling setSelectedCommentId with:', commentId);
          setSelectedCommentId(commentId);
        } else {
          console.log('❌ No comment ID found for region:', region.id);
          console.log('Available regionCommentMap:', regionCommentMap);
        }
      }
    };
    
    // @ts-ignore - The events exist on the regions plugin
    regionsRef.current.on('region-clicked', handleRegionClick);
    
    return () => {
      // @ts-ignore - The events exist on the regions plugin
      regionsRef.current?.un('region-clicked', handleRegionClick);
    };
  }, [regionsRef.current, setSelectedCommentId, regionCommentMap]);

  // Handle markers updates when they change
  useEffect(() => {
    if (isReady && regionsRef.current) {
      if (markers && markers.length > 0) {
        console.log('🎯 Markers updated, refreshing regions:', markers.length);
        addMarkersToWaveform();
      } else {
        console.log('🎯 No markers or empty markers array, clearing regions');
        regionsRef.current.clearRegions();
        setRegionCommentMap({});
      }
    } else if (markers && markers.length > 0 && !regionsRef.current) {
      console.log('🎯 Markers available but regions plugin not ready, will add when ready');
    }
  }, [markers, isReady, addMarkersToWaveform]);

  // Add CSS for region cursor styling
  useEffect(() => {
    const styleId = 'wavesurfer-region-cursor-styles';
    
    // Remove existing style if it exists
    const existingStyle = document.getElementById(styleId);
    if (existingStyle) {
      existingStyle.remove();
    }
    
    // Create new style element
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      /* WaveSurfer region cursor styling - Multiple selectors for compatibility */
      [data-region],
      .wavesurfer [data-region],
      .region,
      .ws-region,
      [class*="region"],
      div[style*="position: absolute"][style*="background"],
      div[style*="position: absolute"][style*="rgba"],
      div[style*="z-index: 3"] {
        cursor: pointer !important;
      }
      
      /* Target WaveSurfer container regions more specifically */
      .wavesurfer > div > div[style*="position: absolute"] {
        cursor: pointer !important;
      }
      
      /* Ensure waveform itself keeps default cursor */
      .wavesurfer canvas {
        cursor: default !important;
      }
    `;
    
    document.head.appendChild(style);
    
    // Cleanup function
    return () => {
      const styleToRemove = document.getElementById(styleId);
      if (styleToRemove) {
        styleToRemove.remove();
      }
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (waveSurferRef.current) {
        try {
          console.log('🧹 AudioPlayer: Destroying WaveSurfer instance on unmount...');
          
          // Properly pause and stop the audio first
          if (waveSurferRef.current.isPlaying()) {
            waveSurferRef.current.pause();
          }
          
          // Clear all event listeners
          waveSurferRef.current.unAll();
          
          // Destroy the instance
          waveSurferRef.current.destroy();
          waveSurferRef.current = null;
          
          // Clear refs
          regionsRef.current = null;
          
          console.log('✅ AudioPlayer: WaveSurfer instance destroyed successfully');
        } catch (destroyError) {
          console.error('❌ AudioPlayer: Error destroying WaveSurfer instance on unmount:', destroyError);
        }
      }
    };
  }, []);

  // Global debugging function - accessible from browser console
  useEffect(() => {
    // Enhanced comprehensive debugging
    (window as any).debugAudioPlayer = () => {
      console.log('🔍 [AUDIO DEBUG] ===== COMPREHENSIVE AUDIO STATE =====');
      console.log('🔍 [AUDIO DEBUG] Current state:');
      console.log('  - Track:', track?.name);
      console.log('  - WaveSurfer instance:', waveSurferRef.current ? 'EXISTS' : 'NULL');
      console.log('  - Is playing:', isPlayingState);
      console.log('  - Is ready:', isReady);
      console.log('  - Audio URL:', audioUrl);
      
      // 1. DOM ANALYSIS
      console.log('🔍 [DOM ANALYSIS] ===== DOM ELEMENTS =====');
      const waveformElements = document.querySelectorAll('[data-wavesurfer]');
      const audioElements = document.querySelectorAll('audio');
      const canvasElements = document.querySelectorAll('canvas');
      
      console.log('  - WaveSurfer DOM elements:', waveformElements.length);
      console.log('  - Audio elements:', audioElements.length);
      console.log('  - Canvas elements:', canvasElements.length);
      
      // Analyze each audio element
      audioElements.forEach((audio, index) => {
        const audioEl = audio as HTMLAudioElement;
        console.log(`  - Audio ${index + 1}:`, {
          src: audioEl.src,
          currentTime: audioEl.currentTime,
          duration: audioEl.duration,
          paused: audioEl.paused,
          volume: audioEl.volume,
          readyState: audioEl.readyState,
          networkState: audioEl.networkState,
          parentElement: audioEl.parentElement?.tagName || 'orphaned'
        });
      });
      
      // 2. WEB AUDIO API ANALYSIS
      console.log('🔍 [WEB AUDIO API] ===== AUDIO CONTEXTS =====');
      
      // Check global audio contexts
      const globalContexts = (window as any).audioContexts || [];
      console.log('  - Tracked audio contexts:', globalContexts.length);
      
      globalContexts.forEach((ctx: any, index: number) => {
        console.log(`  - Context ${index + 1}:`, {
          state: ctx.state,
          currentTime: ctx.currentTime,
          isPlaying: ctx.isPlaying ? ctx.isPlaying() : 'unknown',
          hasMedia: !!ctx.media,
          mediaInfo: ctx.media ? {
            src: ctx.media.src,
            currentTime: ctx.media.currentTime,
            paused: ctx.media.paused,
            parentElement: ctx.media.parentElement?.tagName || 'orphaned'
          } : null
        });
      });
      
      // 3. WAVESURFER ANALYSIS
      console.log('🔍 [WAVESURFER] ===== WAVESURFER INSTANCE =====');
      if (waveSurferRef.current) {
        const ws = waveSurferRef.current;
        console.log('  - WaveSurfer direct inspection:');
        console.log('    - Is playing:', ws.isPlaying ? ws.isPlaying() : 'unknown');
        console.log('    - Current time:', ws.getCurrentTime ? ws.getCurrentTime() : 'unknown');
        console.log('    - Duration:', ws.getDuration ? ws.getDuration() : 'unknown');
        console.log('    - Backend info:', (ws as any).backend ? 'exists' : 'missing');
        console.log('    - Media element:', (ws as any).media ? 'exists' : 'missing');
        
        // Check for hidden media
        const hiddenMedia = (ws as any).media;
        if (hiddenMedia) {
          console.log('    - Hidden media:', {
            src: hiddenMedia.src,
            currentTime: hiddenMedia.currentTime,
            paused: hiddenMedia.paused,
            volume: hiddenMedia.volume,
            parentElement: hiddenMedia.parentElement?.tagName || 'orphaned'
          });
        }
      }
      
      // 4. BLOB URL ANALYSIS
      console.log('🔍 [BLOB URLS] ===== BLOB URL TRACKING =====');
      
      // Track all blob URLs in the page
      const allElements = document.getElementsByTagName('*');
      const blobElements = [];
      
      for (let element of allElements) {
        const el = element as any;
        if (el.src && el.src.startsWith('blob:')) {
          blobElements.push({
            tagName: el.tagName,
            src: el.src,
            currentTime: el.currentTime,
            duration: el.duration,
            paused: el.paused,
            parentElement: el.parentElement?.tagName || 'orphaned'
          });
        }
      }
      
      console.log('  - Elements with blob URLs:', blobElements.length);
      blobElements.forEach((blob, index) => {
        console.log(`  - Blob ${index + 1}:`, blob);
      });
      
             // 5. MEMORY ANALYSIS
       console.log('🔍 [MEMORY] ===== MEMORY USAGE =====');
       if (performance && (performance as any).memory) {
         const memory = (performance as any).memory;
         console.log('  - Memory usage:', {
           used: Math.round(memory.usedJSHeapSize / 1024 / 1024) + 'MB',
           total: Math.round(memory.totalJSHeapSize / 1024 / 1024) + 'MB',
           limit: Math.round(memory.jsHeapSizeLimit / 1024 / 1024) + 'MB'
         });
       }
      
      return {
        domElements: {
          waveform: waveformElements.length,
          audio: audioElements.length,
          canvas: canvasElements.length
        },
        audioContexts: globalContexts.length,
        waveSurfer: waveSurferRef.current ? 'exists' : 'null',
        blobUrls: blobElements.length,
        isPlaying: isPlayingState,
        isReady: isReady
      };
    };

    // Add comprehensive audio detection function
    (window as any).findAllAudio = () => {
      console.log('🎵 [FIND ALL AUDIO] ===== COMPREHENSIVE AUDIO SEARCH =====');
      
      // Method 1: All audio/video elements
      const allMedia = document.querySelectorAll('audio, video');
      console.log('🎵 Method 1 - All media elements:', allMedia.length);
      
      // Method 2: Search all elements for audio-related properties
      const allElements = document.getElementsByTagName('*');
      const audioLikeElements = [];
      
      for (let element of allElements) {
        const el = element as any;
        if (el.tagName === 'AUDIO' || 
            el.tagName === 'VIDEO' ||
            el.src ||
            el.currentTime !== undefined) {
          audioLikeElements.push(el);
        }
      }
      
      console.log('🎵 Method 2 - Audio-like elements:', audioLikeElements.length);
      
      // Method 3: Check Web Audio API
      console.log('🎵 Method 3 - Web Audio API:');
      console.log('  - AudioContext available:', !!window.AudioContext);
      
      // Method 4: Look for orphaned media elements
      console.log('🎵 Method 4 - Orphaned media search:');
      const orphanedElements = [];
      
      for (let element of allElements) {
        const el = element as any;
        if ((el.tagName === 'AUDIO' || el.tagName === 'VIDEO') && !el.parentElement) {
          orphanedElements.push(el);
        }
      }
      
      console.log('  - Orphaned media elements:', orphanedElements.length);
      
      // Method 5: Check for playing audio
      console.log('🎵 Method 5 - Currently playing audio:');
      const playingAudio = [];
      
      allMedia.forEach((media, index) => {
        const mediaEl = media as HTMLMediaElement;
        if (!mediaEl.paused) {
          playingAudio.push({
            index: index + 1,
            src: mediaEl.src,
            currentTime: mediaEl.currentTime,
            duration: mediaEl.duration,
            volume: mediaEl.volume
          });
        }
      });
      
      console.log('  - Currently playing:', playingAudio.length);
      playingAudio.forEach(audio => {
        console.log('    -', audio);
      });
      
      return {
        allMedia: allMedia.length,
        audioLikeElements: audioLikeElements.length,
        orphaned: orphanedElements.length,
        playing: playingAudio.length,
        elements: Array.from(allMedia)
      };
    };

    // Add lifecycle tracking
    (window as any).trackAudioLifecycle = () => {
      console.log('🔄 [LIFECYCLE] ===== AUDIO LIFECYCLE TRACKING =====');
      
      // Track current state
      const currentState = {
        timestamp: new Date().toISOString(),
        track: track?.name,
        audioUrl: audioUrl,
        waveSurfer: waveSurferRef.current ? 'exists' : 'null',
        isPlaying: isPlayingState,
        isReady: isReady
      };
      
      console.log('🔄 Current state:', currentState);
      
      // Store in global tracking
      if (!(window as any).audioLifecycleLog) {
        (window as any).audioLifecycleLog = [];
      }
      
      (window as any).audioLifecycleLog.push(currentState);
      
      // Show last 5 states
      console.log('🔄 Last 5 states:');
      const recent = (window as any).audioLifecycleLog.slice(-5);
      recent.forEach((state: any, index: number) => {
        console.log(`  ${index + 1}. ${state.timestamp}: ${state.track} (${state.isPlaying ? 'playing' : 'paused'})`);
      });
      
      return currentState;
    };

    // Enhanced emergency cleanup
    (window as any).emergencyAudioCleanup = () => {
      console.log('🚨 [EMERGENCY CLEANUP] ===== STARTING COMPREHENSIVE CLEANUP =====');
      
      let cleanedItems = 0;
      
      // 1. Clean tracked audio contexts
      console.log('🚨 Step 1: Cleaning tracked audio contexts...');
      const globalContexts = (window as any).audioContexts || [];
      
      globalContexts.forEach((ctx: any, index: number) => {
        console.log(`🚨 Cleaning context ${index + 1}...`);
        
        try {
          // Stop playback
          if (ctx.isPlaying && ctx.isPlaying()) {
            ctx.pause();
          }
          
          // Clean up media element
          if (ctx.media) {
            ctx.media.pause();
            ctx.media.currentTime = 0;
            
            if (ctx.media.src && ctx.media.src.startsWith('blob:')) {
              console.log(`🚨 Revoking blob: ${ctx.media.src.substring(0, 50)}...`);
              URL.revokeObjectURL(ctx.media.src);
              cleanedItems++;
            }
            
            ctx.media.src = '';
            ctx.media.load();
          }
          
          // Destroy if possible
          if (ctx.destroy) {
            ctx.destroy();
          }
          
        } catch (e) {
          console.log(`🚨 Error cleaning context ${index + 1}:`, e);
        }
      });
      
      // 2. Clean all DOM audio elements
      console.log('🚨 Step 2: Cleaning DOM audio elements...');
      const allAudio = document.querySelectorAll('audio, video');
      
      allAudio.forEach((audio, index) => {
        const audioEl = audio as HTMLMediaElement;
        console.log(`🚨 Cleaning DOM audio ${index + 1}...`);
        
        try {
          audioEl.pause();
          audioEl.currentTime = 0;
          
          if (audioEl.src && audioEl.src.startsWith('blob:')) {
            console.log(`🚨 Revoking DOM blob: ${audioEl.src.substring(0, 50)}...`);
            URL.revokeObjectURL(audioEl.src);
            cleanedItems++;
          }
          
          audioEl.src = '';
          audioEl.load();
          
        } catch (e) {
          console.log(`🚨 Error cleaning DOM audio ${index + 1}:`, e);
        }
      });
      
      // 3. Clean current WaveSurfer instance
      console.log('🚨 Step 3: Cleaning current WaveSurfer instance...');
      if (waveSurferRef.current) {
        try {
          const ws = waveSurferRef.current;
          
          if (ws.isPlaying && ws.isPlaying()) {
            ws.pause();
          }
          
          if ((ws as any).media) {
            const media = (ws as any).media;
            if (media.src && media.src.startsWith('blob:')) {
              console.log(`🚨 Revoking WaveSurfer blob: ${media.src.substring(0, 50)}...`);
              URL.revokeObjectURL(media.src);
              cleanedItems++;
            }
          }
          
          ws.destroy();
          waveSurferRef.current = null;
          
        } catch (e) {
          console.log('🚨 Error cleaning WaveSurfer:', e);
        }
      }
      
      // 4. Global AudioContext cleanup
      console.log('🚨 Step 4: Global AudioContext cleanup...');
      if (window.AudioContext) {
        console.log('🚨 AudioContext available, checking for instances...');
        
        // Clear tracked contexts
        (window as any).audioContexts = [];
      }
      
      // 5. Final verification
      console.log('🚨 Step 5: Final verification...');
      const remainingMedia = document.querySelectorAll('audio, video');
      
      console.log(`🚨 [EMERGENCY CLEANUP] Completed! Cleaned ${cleanedItems} audio items`);
      console.log(`🚨 Remaining media elements: ${remainingMedia.length}`);
      
      return {
        cleanedItems: cleanedItems,
        remainingMedia: remainingMedia.length
      };
    };

    // Cleanup function
    return () => {
      delete (window as any).debugAudioPlayer;
      delete (window as any).findAllAudio;
      delete (window as any).trackAudioLifecycle;
      delete (window as any).emergencyAudioCleanup;
    };
  }, [track, isPlayingState, isReady, audioUrl]);

  if (!track) {
    return (
      <div className="flex items-center justify-center h-32 bg-gray-100 rounded-lg">
        <p>No track selected</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Full Height Waveform */}
      <div 
        ref={waveformRef} 
        className="w-full h-32 bg-white rounded border border-gray-300 overflow-hidden"
        style={{ 
          position: 'relative',
          minHeight: '128px',
          maxHeight: '128px',
          cursor: 'default',
          "--region-color": "rgba(59, 130, 246, 0.3)",
          "--region-border-color": "rgb(59, 130, 246)",
          "--region-handle-color": "rgb(59, 130, 246)",
        } as React.CSSProperties}
        onDoubleClick={(e) => {
          if (!waveSurferRef.current) return;
          
          const rect = e.currentTarget.getBoundingClientRect();
          const clickX = e.clientX - rect.left;
          const clickPercent = clickX / rect.width;
          const clickTime = clickPercent * duration;
          
          console.log('Double-click at time:', clickTime, 'seconds');
          
          if (onAddComment) {
            onAddComment(clickTime);
          }
        }}
        title="Double-click to add a comment"
      />

      {/* Compact Transport Controls - Single Row */}
      <div className="flex items-center justify-between px-2 py-1 bg-gray-50 rounded border">
        {/* Left: Transport Controls */}
        <div className="flex items-center space-x-2">
          <button
            onClick={onPrevious}
            className="p-1 text-gray-600 hover:text-gray-800 transition-colors"
            aria-label="Previous track"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
            </svg>
          </button>
          
          <button
            onClick={handlePlayPause}
            className="p-1.5 text-white bg-gray-800 rounded hover:bg-gray-700 transition-colors"
            aria-label={isPlayingState ? 'Pause' : 'Play'}
          >
            {isPlayingState ? (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z"/>
              </svg>
            )}
          </button>
          
          <button
            onClick={onNext}
            className="p-1 text-gray-600 hover:text-gray-800 transition-colors"
            aria-label="Next track"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
            </svg>
          </button>

          {/* Time Display */}
          <div className="flex items-center space-x-1 text-xs text-gray-500 ml-2">
            <span>{formatTime(currentTime)}</span>
            <span>/</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Center: Track Info */}
        <div className="flex-1 mx-4 min-w-0">
          <div className="text-center">
            <div className="text-sm font-medium text-gray-900 truncate">
              {track?.name || 'No track selected'}
            </div>
            {track?.artist?.name && (
              <div className="text-xs text-gray-600 truncate">
                {track.artist.name}
              </div>
            )}
          </div>
        </div>

        {/* Right: Volume and Speed */}
        <div className="flex items-center space-x-3">
          {/* Volume */}
          <div className="flex items-center space-x-1">
            <svg className="w-3 h-3 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
            </svg>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={volumeState}
              onChange={(e) => handleVolumeChange(parseInt(e.target.value))}
              className="w-16 h-1 bg-gray-300 rounded appearance-none cursor-pointer"
            />
          </div>
          
          {/* Speed */}
          <select
            value={playbackSpeedState}
            onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
            className="text-xs border border-gray-300 rounded px-1 py-0.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="0.5">0.5x</option>
            <option value="0.75">0.75x</option>
            <option value="1">1x</option>
            <option value="1.25">1.25x</option>
            <option value="1.5">1.5x</option>
            <option value="2">2x</option>
          </select>
        </div>
      </div>
    </div>
  );
};

// Helper function to format time (seconds to MM:SS)
function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export default AudioPlayer;