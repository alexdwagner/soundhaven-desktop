import React, { useCallback, useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import type { WaveSurfer as WaveSurferType } from 'wavesurfer.js';
import type { Region } from 'wavesurfer.js/dist/plugins/regions';
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.js";
import { useComments } from "@/app/hooks/useComments";
import { Marker as MarkerType } from "../../../../../shared/types";
import apiService from "../../../services/electronApiService";

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

  // Track if WaveSurfer is loaded and ready to play audio
  const [isAudioLoaded, setIsAudioLoaded] = useState(false);

  // Sync internal isPlayingState with external isPlaying prop
  useEffect(() => {
    console.log('🎵 AudioPlayer: isPlaying prop changed:', isPlaying);
    setIsPlaying(isPlaying);
    
    // OPTIMIZED: Use WaveSurfer for immediate audio playback
    if (isPlaying && waveSurferRef.current && isAudioLoaded) {
      console.log('🎵 AudioPlayer: Auto-starting WaveSurfer audio playback (immediate)');
      const playPromise = waveSurferRef.current.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(error => {
          // Ignore AbortError - it's expected when play() is interrupted
          if (error.name !== 'AbortError') {
            console.error('❌ AudioPlayer: Error auto-starting WaveSurfer audio:', error);
          }
        });
      }
    } else if (!isPlaying && waveSurferRef.current) {
      console.log('🎵 AudioPlayer: Auto-pausing WaveSurfer audio playback');
      try {
        waveSurferRef.current.pause();
      } catch (error) {
        console.error('❌ AudioPlayer: Error auto-pausing WaveSurfer audio:', error);
      }
    }
  }, [isPlaying, isAudioLoaded]);

  // Get markers from comments context
  const { markers, setSelectedCommentId, regionCommentMap, setRegionCommentMap } = useComments(waveSurferRef as any, regionsRef as any);

  // Debug markers in AudioPlayer
  useEffect(() => {
    console.log('=== AUDIOPLAYER MARKERS DEBUG ===');
    console.log('markers from useComments:', markers);
    console.log('markers length:', markers?.length);
    console.log('markers type:', typeof markers);
  }, [markers]);

  // Enhanced error handling and logging for WaveSurfer
  const handleWaveSurferError = useCallback((error: any, url: string) => {
    console.error('🎵 AudioPlayer: WaveSurfer error occurred:', {
      errorType: error.constructor.name,
      message: error.message,
      stack: error.stack,
      url: url,
      trackId: track?.id,
      trackName: track?.name,
      timestamp: new Date().toISOString()
    });

    // Check if it's a local file access error
    if (url.startsWith('file://') && error.message.includes('Failed to fetch')) {
      console.log('🔄 AudioPlayer: Local file access failed, attempting audio server fallback...');
      
      // Convert file:// URL to audio server URL
      const fileName = url.split('/').pop();
      const audioServerUrl = `http://localhost:3000/audio/${fileName}`;
      
      console.log('🔄 AudioPlayer: Fallback URL:', {
        originalUrl: url,
        fallbackUrl: audioServerUrl,
        fileName: fileName
      });
      
      // Try loading with audio server URL
      if (waveSurferRef.current) {
        try {
          console.log('🔄 AudioPlayer: Loading audio with fallback URL...');
          waveSurferRef.current.load(audioServerUrl);
        } catch (fallbackError) {
          console.error('❌ AudioPlayer: Fallback loading also failed:', {
            error: fallbackError,
            fallbackUrl: audioServerUrl
          });
        }
      }
    } else {
      console.error('❌ AudioPlayer: Non-local file error, cannot use fallback:', {
        error: error,
        url: url
      });
    }
  }, [track]);

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

  // Enhanced WaveSurfer initialization with better error handling and singleton enforcement
  const initializeWaveSurfer = useCallback(async () => {
    if (!track || !waveformRef.current) {
      console.log('🎵 AudioPlayer: Cannot initialize WaveSurfer - missing track or container');
      return;
    }

    // Destroy any existing instance before creating a new one
    if (waveSurferRef.current) {
      try {
        console.log('🧹 AudioPlayer: Destroying previous WaveSurfer instance...');
        
        const oldInstance = waveSurferRef.current;
        waveSurferRef.current = null; // Clear reference immediately to prevent race conditions
        setIsReady(false);
        setIsAudioLoaded(false); // Reset audio loaded state
        
        // Safely destroy the old instance
        try {
          // Try to pause and stop any ongoing operations first
          if (typeof oldInstance.isPlaying === 'function' && oldInstance.isPlaying()) {
            oldInstance.pause();
          }
          
          // Try to unsubscribe from events to prevent further callbacks
          if (typeof (oldInstance as any).unAll === 'function') {
            (oldInstance as any).unAll();
          }
        } catch (pauseError) {
          // Ignore pause/cleanup errors, instance might be in invalid state
          console.log('🧹 AudioPlayer: Could not pause/cleanup old instance, continuing with destroy...');
        }
        
        // Add a micro-delay to let any pending operations settle
        await new Promise(resolve => setTimeout(resolve, 10));
        
        // Destroy with maximum error suppression
        const originalConsoleError = console.error;
        const originalConsoleWarn = console.warn;
        const originalConsoleLog = console.log;
        
        // Track if we handled the destroy to prevent multiple calls
        let destroyAttempted = false;
        
        try {
          // Aggressively suppress ALL console output during destroy
          console.error = () => {}; // Suppress all errors
          console.warn = () => {};  // Suppress all warnings  
          console.log = () => {};   // Suppress all logs
          
          // Set up a global error handler to catch unhandled errors
          const handleGlobalError = (event: ErrorEvent) => {
            event.preventDefault();
            event.stopPropagation();
            return true; // Prevent default handling
          };
          
          const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
            event.preventDefault();
            event.stopPropagation();
          };
          
          // Add global error handlers
          window.addEventListener('error', handleGlobalError, true);
          window.addEventListener('unhandledrejection', handleUnhandledRejection, true);
          
          // Destroy the instance
          if (!destroyAttempted && oldInstance && typeof oldInstance.destroy === 'function') {
            destroyAttempted = true;
            oldInstance.destroy();
          }
          
          // Clean up global error handlers
          setTimeout(() => {
            window.removeEventListener('error', handleGlobalError, true);
            window.removeEventListener('unhandledrejection', handleUnhandledRejection, true);
          }, 100);
          
        } catch (destroyError: any) {
          // Silently ignore ALL errors during destroy
          // AbortError is expected when destroying during audio loading
        } finally {
          // Always restore console methods after a delay
          setTimeout(() => {
            console.error = originalConsoleError;
            console.warn = originalConsoleWarn;
            console.log = originalConsoleLog;
          }, 100);
        }
        
        // Add a small delay to ensure proper cleanup
        await new Promise(resolve => setTimeout(resolve, 20));
      } catch (destroyError) {
        console.error('❌ AudioPlayer: Error destroying previous instance:', destroyError);
      }
    }

    try {
      console.log('🎵 AudioPlayer: Creating new WaveSurfer instance...');
      
      // Get the file URL
      const fileUrl = await getFileUrl(track.filePath);
      
      // Type check to ensure we have a string URL
      if (typeof fileUrl !== 'string') {
        throw new Error(`Invalid file URL type: ${typeof fileUrl}, expected string`);
      }
      
      console.log('🎵 AudioPlayer: File URL resolved:', {
        originalPath: track.filePath,
        resolvedUrl: fileUrl,
        urlType: typeof fileUrl
      });

      // Create WaveSurfer instance - OPTIMIZED for immediate audio playback
      console.log('🎵 AudioPlayer: Creating WaveSurfer instance for immediate audio playback...');
      const wavesurfer = WaveSurfer.create({
        container: waveformRef.current,
        waveColor: '#4F46E5',
        progressColor: '#7C3AED',
        cursorColor: '#1F2937',
        barWidth: 2,
        barRadius: 3,
        cursorWidth: 1,
        height: 128,
        barGap: 3,
        responsive: true,
        normalize: true,
        backend: 'WebAudio',
        // Ensure we see the full waveform
        minPxPerSec: 1, // Allow very zoomed out view to see entire track
        maxCanvasWidth: 4000, // Allow wide canvas for full track view
        // OPTIMIZATION: Enable immediate playback
        progressiveLoad: true, // Allow playback to start before full file is loaded
        xhr: {
          // Enable range requests for progressive loading
          requestHeaders: [
            {
              key: 'Range',
              value: 'bytes=0-'
            }
          ]
        },
        plugins: [
          RegionsPlugin.create({
            dragSelection: {
              slop: 5
            }
          })
        ]
      });

      waveSurferRef.current = wavesurfer;
      
      // Get the regions plugin instance - use the correct API for WaveSurfer v7
      let regionsPlugin = null;
      try {
        // Try multiple ways to access the regions plugin
        console.log('🔍 Debugging regions plugin access...');
        console.log('wavesurfer object keys:', Object.keys(wavesurfer));
        console.log('wavesurfer.regions:', wavesurfer.regions);
        
        if (wavesurfer.regions) {
          regionsPlugin = wavesurfer.regions;
          regionsRef.current = regionsPlugin;
          console.log('✅ Regions plugin found via wavesurfer.regions');
        } else if (wavesurfer.plugins && Array.isArray(wavesurfer.plugins)) {
          regionsPlugin = wavesurfer.plugins.find(plugin => 
            plugin && typeof plugin === 'object' && 'addRegion' in plugin
          );
          if (regionsPlugin) {
            regionsRef.current = regionsPlugin;
            console.log('✅ Regions plugin found via wavesurfer.plugins array');
          }
        }
        
        if (regionsPlugin) {
          // Add markers if they exist
          if (markers && markers.length > 0) {
            console.log('🎯 Adding markers after regions plugin ready:', markers.length);
            addMarkersToWaveform();
          }
        } else {
          console.warn('⚠️ Regions plugin not found, trying delayed access');
          // Try again after a short delay
          setTimeout(() => {
            if (wavesurfer.regions) {
              regionsRef.current = wavesurfer.regions;
              console.log('✅ Regions plugin found via delayed access');
              
              if (markers && markers.length > 0) {
                console.log('🎯 Adding markers after delayed regions plugin ready:', markers.length);
                addMarkersToWaveform();
              }
            } else {
              console.warn('⚠️ Regions plugin still not found after delay');
            }
          }, 200);
        }
      } catch (error) {
        console.error('❌ Error accessing regions plugin:', error);
      }
      
      console.log('🎵 AudioPlayer: WaveSurfer instance created successfully:', {
        container: waveformRef.current,
        hasRegions: !!wavesurfer.regions,
        regionsPlugin: !!regionsPlugin
      });

      // Set up event listeners
      wavesurfer.on('ready', () => {
        console.log('🎵 AudioPlayer: WaveSurfer ready event - audio can play immediately');
        setIsReady(true);
        setIsAudioLoaded(true); // Audio is loaded and ready to play
        setDuration(wavesurfer.getDuration());
        
        // Add markers after WaveSurfer is ready
        if (markers && markers.length > 0) {
          console.log('🎯 Adding markers after WaveSurfer ready:', markers.length);
          addMarkersToWaveform();
        }
      });

      // WaveSurfer events handle audio playback
      wavesurfer.on('play', () => {
        console.log('🎵 AudioPlayer: WaveSurfer play event');
        setIsPlaying(true);
      });

      wavesurfer.on('pause', () => {
        console.log('🎵 AudioPlayer: WaveSurfer pause event');
        setIsPlaying(false);
      });

      wavesurfer.on('finish', () => {
        console.log('🎵 AudioPlayer: WaveSurfer finish event');
        setIsPlaying(false);
        onNext();
      });

      wavesurfer.on('timeupdate', (currentTime: number) => {
        setCurrentTime(currentTime);
      });

      wavesurfer.on('loading', (progress: number) => {
        // console.log('🎵 AudioPlayer: WaveSurfer loading progress:', {
        //   progress: progress,
        //   trackId: track.id
        // });
      });

      wavesurfer.on('error', (error: any) => {
        console.error('🎵 AudioPlayer: WaveSurfer error event triggered:', error);
      });

      // Try to load preprocessed waveform data first
      console.log('🎵 AudioPlayer: Attempting to load preprocessed waveform data...');
      const startTime = performance.now();
      
      // TEMPORARY: Add flag to test direct loading vs preprocessing
      const DISABLE_PREPROCESSING = false; // Set to true to test direct loading
      
      try {
        if (DISABLE_PREPROCESSING) {
          console.log('🧪 AudioPlayer: Preprocessing disabled for testing - loading directly');
          await wavesurfer.load(fileUrl);
          const endTime = performance.now();
          console.log(`🧪 AudioPlayer: DIRECT TEST load completed in ${(endTime - startTime).toFixed(2)}ms`);
          console.log('🎵 AudioPlayer: Audio file loaded successfully (direct test)');
        } else {
          const preprocessStartTime = performance.now();
          const { waveformData } = await apiService.getWaveformData(track.id.toString());
          const preprocessEndTime = performance.now();
          
          console.log(`📊 AudioPlayer: Preprocessing data fetch took ${(preprocessEndTime - preprocessStartTime).toFixed(2)}ms`);
          
          if (waveformData && waveformData.length > 0) {
            console.log(`✅ AudioPlayer: Using preprocessed waveform data with ${waveformData.length} points`);
            console.log(`📊 AudioPlayer: Peaks data size: ${JSON.stringify(waveformData).length} bytes`);
            console.log(`📊 AudioPlayer: Expected benefit: Using ${waveformData.length} peaks instead of full audio decode`);
            
            // Load with the audio URL and preprocessed peaks data
            const loadStartTime = performance.now();
            await wavesurfer.load(fileUrl, waveformData);
            const loadEndTime = performance.now();
            const endTime = performance.now();
            
            console.log(`🚀 AudioPlayer: PREPROCESSED load completed in ${(endTime - startTime).toFixed(2)}ms`);
            console.log(`   └── Data fetch: ${(preprocessEndTime - preprocessStartTime).toFixed(2)}ms`);
            console.log(`   └── WaveSurfer load: ${(loadEndTime - loadStartTime).toFixed(2)}ms`);
            console.log('🎵 AudioPlayer: WaveSurfer loaded with preprocessed peaks data');
            
          } else {
            console.log('⚠️ AudioPlayer: No preprocessed waveform data found, loading audio file directly');
            await wavesurfer.load(fileUrl);
            const endTime = performance.now();
            console.log(`🐌 AudioPlayer: DIRECT load completed in ${(endTime - startTime).toFixed(2)}ms`);
            console.log('🎵 AudioPlayer: Audio file loaded successfully (direct)');
          }
        }
      } catch (preprocessError) {
        console.error('❌ AudioPlayer: Error loading preprocessed data, falling back to audio file:', preprocessError);
        try {
          await wavesurfer.load(fileUrl);
          const endTime = performance.now();
          console.log(`🐌 AudioPlayer: FALLBACK load completed in ${(endTime - startTime).toFixed(2)}ms`);
          console.log('🎵 AudioPlayer: Audio file loaded successfully (fallback)');
        } catch (loadError) {
          console.error('❌ AudioPlayer: Failed to load audio file:', loadError);
          throw loadError;
        }
      }

      console.log('🎵 AudioPlayer: WaveSurfer initialization completed successfully');

    } catch (error) {
      console.error('🎵 AudioPlayer: WaveSurfer error occurred:', error);
      
      // Check if it's a CORS or network error
      if (error.message && error.message.includes('CORS')) {
        console.error('❌ AudioPlayer: CORS error detected, cannot use fallback');
      } else if (error.message && error.message.includes('fetch')) {
        console.error('❌ AudioPlayer: Network error detected');
      } else {
        console.error('❌ AudioPlayer: Non-local file error, cannot use fallback:', error);
      }
      
      console.error('❌ AudioPlayer: Failed to load audio file:', error);
    }
  }, [track?.id, track?.filePath]);

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

  // Initialize WaveSurfer
  useEffect(() => {
    // Early return if no track is provided
    if (!track) {
      console.log('AudioPlayer: No track provided, skipping WaveSurfer initialization');
      // Clear regions if no track
      if (regionsRef.current) {
        console.log('AudioPlayer: Clearing regions - no track');
        regionsRef.current.clearRegions();
        setRegionCommentMap({});
      }
      return;
    }
    
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
  }, [track?.filePath]);

  // Reset states when audioUrl changes
  useEffect(() => {
    if (audioUrl) {
      console.log('🎵 AudioPlayer: Audio URL changed, resetting states');
      setIsAudioLoaded(false);
      setCurrentTime(0);
      setDuration(0);
    }
  }, [audioUrl]);

  // Create WaveSurfer when audioUrl is available (for visualization only)
  useEffect(() => {
    if (audioUrl && waveformRef.current) {
      // Type check to ensure audioUrl is a string
      if (typeof audioUrl !== 'string') {
        console.error('AudioPlayer: audioUrl is not a string!', audioUrl);
              return;
            }
            
      console.log('AudioPlayer: Creating WaveSurfer for visualization:', audioUrl);
      initializeWaveSurfer();
    }
  }, [audioUrl]);

  // Handle play/pause - OPTIMIZED: Use WaveSurfer for immediate response
  const handlePlayPause = useCallback(() => {
    if (!waveSurferRef.current) {
      console.warn('🎵 AudioPlayer: No WaveSurfer instance available for play/pause');
      return;
    }

    if (!isAudioLoaded) {
      console.warn('🎵 AudioPlayer: WaveSurfer audio not yet loaded, cannot play/pause');
      return;
    }

    try {
      if (isPlayingState) {
        console.log('🎵 AudioPlayer: Pausing WaveSurfer audio');
        waveSurferRef.current.pause();
      } else {
        console.log('🎵 AudioPlayer: Playing WaveSurfer audio');
        const playPromise = waveSurferRef.current.play();
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch(error => {
            // Ignore AbortError - it's expected when play() is interrupted
            if (error.name !== 'AbortError') {
              console.error('❌ AudioPlayer: Error during WaveSurfer audio play:', error);
            }
          });
        }
      }
    } catch (error) {
      console.error('❌ AudioPlayer: Error during WaveSurfer audio play/pause:', error);
    }
  }, [isPlayingState, isAudioLoaded]);

  // Handle seek - OPTIMIZED: Use WaveSurfer for immediate seeking
  const handleSeek = useCallback((time: number) => {
    if (!waveSurferRef.current) {
      console.warn('🎵 AudioPlayer: No WaveSurfer instance available for seek');
      return;
    }

    try {
      console.log('🎵 AudioPlayer: Seeking WaveSurfer to time:', time);
      waveSurferRef.current.seekTo(time / duration);
    } catch (error) {
      console.error('❌ AudioPlayer: Error during WaveSurfer seek:', error);
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

  if (!track) {
    return (
      <div className="flex items-center justify-center h-32 bg-gray-100 rounded-lg">
        <p>No track selected</p>
      </div>
    );
  }

  // Debug markers
  // console.log('AudioPlayer render - markers:', markers);

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
