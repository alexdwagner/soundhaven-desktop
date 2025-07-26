import React, { useCallback, useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import type { WaveSurfer as WaveSurferType } from 'wavesurfer.js';
import type { Region } from 'wavesurfer.js/dist/plugins/regions';
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.js";
import { useComments } from "@/app/hooks/useComments";
import { useEnvironment } from "@/app/hooks/useEnvironment";
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
  
  // Mobile HTML5 audio element
  const mobileAudioRef = useRef<HTMLAudioElement>(null);
  
  // Use external refs if provided, otherwise use internal refs
  const waveSurferRef = externalWaveSurferRef || internalWaveSurferRef;
  const regionsRef = externalRegionsRef || internalRegionsRef;
  
  const [isReady, setIsReady] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string>('');
  const [isPlayingState, setIsPlaying] = useState(isPlaying);
  // Convert volume from 0-1 range to 0-100 range for the slider
  const [volumeState, setVolume] = useState(Math.round(volume * 100));
  const [playbackSpeedState, setPlaybackSpeed] = useState(playbackSpeed);

  // Track if WaveSurfer is loaded and ready to play audio
  const [isAudioLoaded, setIsAudioLoaded] = useState(false);
  
  // Track if we should auto-play once audio is loaded
  const [shouldAutoPlay, setShouldAutoPlay] = useState(false);

  // Environment detection for mobile/desktop behavior
  const { isMobile } = useEnvironment();
  
  // Touch tracking for mobile waveform seeking
  const [touchStartTime, setTouchStartTime] = useState<number | null>(null);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  // Sync internal volume state with external volume prop
  useEffect(() => {
    const newVolumeState = Math.round(volume * 100);
    if (newVolumeState !== volumeState) {
      setVolume(newVolumeState);
    }
  }, [volume]);

  // Sync internal playback speed state with external playback speed prop
  useEffect(() => {
    if (playbackSpeed !== playbackSpeedState) {
      setPlaybackSpeed(playbackSpeed);
    }
  }, [playbackSpeed]);

  // Sync internal isPlayingState with external isPlaying prop
  useEffect(() => {
    console.log('😺 [ISPLAYING EFFECT] === isPlaying prop changed ===');
    console.log('😺 [ISPLAYING EFFECT] New isPlaying value:', isPlaying);
    console.log('😺 [ISPLAYING EFFECT] Current isAudioLoaded:', isAudioLoaded);
    console.log('😺 [ISPLAYING EFFECT] Environment check:', {
      isElectron: typeof window !== 'undefined' && !!(window as any).electronAPI,
      isMobileBrowser: typeof window !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
      hasWaveSurfer: !!waveSurferRef.current,
      hasMobileAudio: !!mobileAudioRef.current
    });
    
    setIsPlaying(isPlaying);
    
    // Detect environment for proper audio handling
    const isElectron = typeof window !== 'undefined' && !!(window as any).electronAPI;
    const isMobileBrowser = typeof window !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (isPlaying) {
      console.log('😺 [ISPLAYING EFFECT] isPlaying=true, checking audio playback options...');
      
      // Mobile browser: Use HTML5 audio
      if (isMobileBrowser && mobileAudioRef.current) {
        console.log('😺 [ISPLAYING EFFECT] Mobile detected - using HTML5 audio for autoplay');
        console.log('😺 [ISPLAYING EFFECT] Mobile audio src:', mobileAudioRef.current.src);
        console.log('😺 [ISPLAYING EFFECT] Mobile audio readyState:', mobileAudioRef.current.readyState);
        
        try {
          const playPromise = mobileAudioRef.current.play();
          console.log('😺 [ISPLAYING EFFECT] Mobile audio play() called, promise:', !!playPromise);
          
          if (playPromise && typeof playPromise.catch === 'function') {
            playPromise.then(() => {
              console.log('😺 [ISPLAYING EFFECT] Mobile audio autoplay successful!');
            }).catch(error => {
              console.error('😺 [ISPLAYING EFFECT] Mobile audio autoplay failed:', error);
            });
          }
        } catch (error) {
          console.error('😺 [ISPLAYING EFFECT] Error starting mobile audio autoplay:', error);
        }
      } 
      // Desktop/Electron: Use WaveSurfer
      else if (waveSurferRef.current && isAudioLoaded) {
        console.log('😺 [ISPLAYING EFFECT] Desktop detected - using WaveSurfer for autoplay');
        const playPromise = waveSurferRef.current.play();
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.then(() => {
            console.log('😺 [ISPLAYING EFFECT] WaveSurfer autoplay successful!');
          }).catch(error => {
            // Ignore AbortError - it's expected when play() is interrupted
            if (error.name !== 'AbortError') {
              console.error('😺 [ISPLAYING EFFECT] WaveSurfer autoplay failed:', error);
            }
          });
        }
      } 
      // Audio not ready yet
      else if (!isAudioLoaded) {
        console.log('😺 [ISPLAYING EFFECT] Audio not loaded yet, setting shouldAutoPlay flag');
        setShouldAutoPlay(true);
      } else {
        console.warn('😺 [ISPLAYING EFFECT] No audio element available for autoplay!');
      }
    } else {
      console.log('😺 [ISPLAYING EFFECT] isPlaying=false, pausing audio...');
      
      // Pause mobile audio
      if (isMobileBrowser && mobileAudioRef.current) {
        console.log('😺 [ISPLAYING EFFECT] Pausing mobile audio');
        try {
          mobileAudioRef.current.pause();
        } catch (error) {
          console.error('😺 [ISPLAYING EFFECT] Error pausing mobile audio:', error);
        }
      }
      
      // Pause WaveSurfer
      if (waveSurferRef.current) {
        console.log('😺 [ISPLAYING EFFECT] Pausing WaveSurfer audio');
        try {
          waveSurferRef.current.pause();
        } catch (error) {
          console.error('😺 [ISPLAYING EFFECT] Error pausing WaveSurfer audio:', error);
        }
      }
    }
    
    console.log('😺 [ISPLAYING EFFECT] === isPlaying effect completed ===');
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

  // Enhanced getFileUrl function with mobile browser support
  const getFileUrl = useCallback(async (filePath: string): Promise<string> => {
    console.log('🎵 AudioPlayer: Getting file URL for track:', track?.id, 'filePath:', filePath);
    
    // Detect if we're in mobile browser (no Electron APIs) - use consistent detection
    const isElectron = typeof window !== 'undefined' && !!window.electron?.ipcRenderer;
    const isMobileBrowser = !isElectron;
    
    console.log('🎵 AudioPlayer: Environment detection:', { isElectron, isMobileBrowser });
    
    try {
      if (isMobileBrowser) {
        // Mobile browser: use Next.js API streaming endpoint
        const streamingUrl = `/api/audio/${track?.id}`;
        console.log('🎵 AudioPlayer: Using Next.js API streaming URL for mobile:', {
          trackId: track?.id,
          streamingUrl: streamingUrl,
          note: 'Using Next.js /api/audio/[trackId] endpoint'
        });
        return streamingUrl;
      } else {
        // Electron: use audio server with actual filename
        const fileName = filePath.replace('/uploads/', '');
        const audioServerUrl = `http://localhost:3000/audio/${fileName}`;
        
        console.log('🎵 AudioPlayer: Using audio server URL for Electron:', {
          originalPath: filePath,
          fileName: fileName,
          audioServerUrl: audioServerUrl
        });
        
        return audioServerUrl;
      }
      
    } catch (error) {
      console.warn('⚠️ AudioPlayer: Error getting file URL, using fallback:', {
        error: error,
        filePath: filePath
      });
      
      // Fallback based on environment
      if (isMobileBrowser) {
        const fallbackUrl = `/api/audio/${track?.id || 'unknown'}`;
        console.log('🎵 AudioPlayer: Using mobile fallback:', fallbackUrl);
        return fallbackUrl;
      } else {
        const fileName = filePath.replace('/uploads/', '');
        const audioServerUrl = `http://localhost:3000/audio/${fileName}`;
        console.log('🎵 AudioPlayer: Using Electron fallback:', audioServerUrl);
        return audioServerUrl;
      }
    }
  }, [track?.id]);

  // Enhanced WaveSurfer initialization with mobile browser detection
  const initializeWaveSurfer = useCallback(async () => {
    if (!track || !waveformRef.current) {
      console.log('🎵 AudioPlayer: Cannot initialize WaveSurfer - missing track or container');
      return;
    }

    // Detect mobile browser and handle gracefully - use consistent detection
    const isElectron = typeof window !== 'undefined' && !!window.electron?.ipcRenderer;
    const isMobileBrowser = !isElectron;
    
    console.log('🎵 AudioPlayer: Environment detection:', { isElectron, isMobileBrowser, hasElectron: !!window.electron, hasIpcRenderer: !!window.electron?.ipcRenderer });
    
    // WaveSurfer works on mobile browsers too! No need to skip it
    console.log('🎵 AudioPlayer: Initializing WaveSurfer for environment:', { isElectron, isMobileBrowser });

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
        
        // Check if we should auto-play now that audio is loaded
        if (shouldAutoPlay) {
          console.log('🎵 AudioPlayer: Auto-playing because shouldAutoPlay flag is set');
          setShouldAutoPlay(false); // Reset flag
          const playPromise = wavesurfer.play();
          if (playPromise && typeof playPromise.catch === 'function') {
            playPromise.catch(error => {
              if (error.name !== 'AbortError') {
                console.error('❌ AudioPlayer: Error auto-playing on ready:', error);
              }
            });
          }
        }
        
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

  // Set audio URL based on track file path
  useEffect(() => {
    console.log('🎵 AudioPlayer: Track changed effect triggered');
    console.log('🎵 AudioPlayer: Track object:', track);
    console.log('🎵 AudioPlayer: Track filePath:', track?.filePath);
    console.log('🎵 AudioPlayer: Track filePath type:', typeof track?.filePath);
    console.log('🎵 AudioPlayer: Track keys:', track ? Object.keys(track) : 'null');
    
    if (!track) {
      console.log('AudioPlayer: No track provided, clearing audio');
      setAudioUrl('');
      setIsReady(false);
      setIsAudioLoaded(false);
      setCurrentTime(0);
      setDuration(0);
      
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
      console.log('AudioPlayer: waveformRef.current:', !!waveformRef.current);
      console.log('AudioPlayer: track?.filePath:', track?.filePath);
      return;
    }

    console.log('AudioPlayer: Creating WaveSurfer instance...');
    
    // Validate the audio file path
    if (!track.filePath || typeof track.filePath !== 'string') {
      console.error('AudioPlayer: Invalid filePath:', track.filePath);
        return;
      }
      
    // Use environment-aware URL (mobile API vs desktop audio server)
    const getAudioUrl = async () => {
      try {
        const audioServerUrl = await getFileUrl(track.filePath);
        console.log('🎵 AudioPlayer: Setting audioUrl via getFileUrl:', audioServerUrl);
        setAudioUrl(audioServerUrl);
      } catch (error) {
        console.error('❌ AudioPlayer: Error getting audio URL:', error);
      }
    };
    
    getAudioUrl();
  }, [track?.filePath, getFileUrl]);

  // Reset states when audioUrl changes
  useEffect(() => {
    if (audioUrl) {
      console.log('🎵 AudioPlayer: Audio URL changed, resetting states');
      setIsAudioLoaded(false);
      // DON'T reset shouldAutoPlay flag - it needs to survive track changes
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

  // Handle play/pause - Works for both WaveSurfer (desktop) and HTML5 audio (mobile)
  const handlePlayPause = useCallback(() => {
    console.log('😺 [MAIN AUDIO CONTROLS] handlePlayPause called in AudioPlayer');
    
    // NOTE: Let's try calling onPlayPause AFTER audio control to avoid conflicts
    console.log('😺 [MAIN AUDIO CONTROLS] First handling low-level audio control, then calling onPlayPause prop');
    
    // Detect environment for audio control
    const isElectron = typeof window !== 'undefined' && !!window.electron?.ipcRenderer;
    const isMobileBrowser = !isElectron;
    
    console.log('😺 [AUDIO STATE] Current audio state when handlePlayPause called:', { 
      isElectron, 
      isMobileBrowser, 
      hasMobileAudioRef: !!mobileAudioRef.current,
      hasWaveSurferRef: !!waveSurferRef.current,
      audioUrl: audioUrl,
      isPlayingState: isPlayingState,
      isAudioLoaded: isAudioLoaded,
      isReady: isReady
    });
    
    if (isMobileBrowser) {
      // Mobile: Use HTML5 audio for playback, WaveSurfer for visualization only
      console.log('😺 [MOBILE AUDIO] Attempting mobile audio control');
      if (mobileAudioRef.current) {
        console.log('😺 [MOBILE AUDIO] Mobile audio element exists');
        try {
          if (isPlayingState) {
            console.log('😺 [MOBILE AUDIO] Pausing mobile audio (isPlayingState=true)');
            mobileAudioRef.current.pause();
            // Also pause WaveSurfer visualization if it exists
            if (waveSurferRef.current) {
              waveSurferRef.current.pause();
            }
            setIsPlaying(false);
          } else {
            console.log('😺 [MOBILE AUDIO] Attempting to play mobile audio (isPlayingState=false)');
            console.log('😺 [MOBILE AUDIO] Mobile audio src:', mobileAudioRef.current.src);
            console.log('😺 [MOBILE AUDIO] Mobile audio readyState:', mobileAudioRef.current.readyState);
            const playPromise = mobileAudioRef.current.play();
            console.log('😺 [MOBILE AUDIO] Play promise created:', !!playPromise);
            if (playPromise) {
              playPromise
                .then(() => {
                  console.log('✅ Mobile audio play succeeded');
                  setIsPlaying(true);
                  // Sync WaveSurfer visualization if it exists
                  if (waveSurferRef.current && mobileAudioRef.current) {
                    waveSurferRef.current.seekTo(mobileAudioRef.current.currentTime / mobileAudioRef.current.duration);
                  }
                })
                .catch(error => {
                  console.error('❌ Mobile audio play failed:', error);
                  console.log('🔄 Attempting to unlock audio context...');
                  // Try to enable audio context
                  mobileAudioRef.current?.load();
                });
            } else {
              setIsPlaying(true);
            }
          }
        } catch (error) {
          console.error('❌ AudioPlayer: Error during mobile audio play/pause:', error);
        }
      } else {
        console.error('😺 [MOBILE AUDIO] Mobile audio element not available!');
      }
      return;
    }
    
    // Desktop: Use WaveSurfer
    console.log('😺 [DESKTOP AUDIO] Attempting desktop WaveSurfer control');
    if (!waveSurferRef.current) {
      console.warn('😺 [DESKTOP AUDIO] No WaveSurfer instance available for play/pause');
      return;
    }

    if (!isAudioLoaded) {
      console.warn('😺 [DESKTOP AUDIO] WaveSurfer audio not yet loaded, cannot play/pause');
      console.warn('😺 [DESKTOP AUDIO] This might be why audio doesn\'t start on track load!');
        return;
      }
      
    try {
      console.log('😺 [DESKTOP AUDIO] WaveSurfer ready, proceeding with play/pause');
      if (isPlayingState) {
        console.log('😺 [DESKTOP AUDIO] Pausing WaveSurfer audio (isPlayingState=true)');
        waveSurferRef.current.pause();
            } else {
        console.log('😺 [DESKTOP AUDIO] Playing WaveSurfer audio (isPlayingState=false)');
        const playPromise = waveSurferRef.current.play();
        console.log('😺 [DESKTOP AUDIO] WaveSurfer play promise created:', !!playPromise);
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
    
    // Finally, call the onPlayPause prop to sync with higher-level state
    console.log('😺 [MAIN AUDIO CONTROLS] About to call onPlayPause prop after audio control');
    onPlayPause();
    console.log('😺 [MAIN AUDIO CONTROLS] onPlayPause prop called successfully');
  }, [isPlayingState, isAudioLoaded, onPlayPause]);

  // Handle seek - Works for both WaveSurfer (desktop) and HTML5 audio (mobile)
  const handleSeek = useCallback((time: number) => {
    // Detect environment
    const isElectron = typeof window !== 'undefined' && !!window.electron?.ipcRenderer;
    const isMobileBrowser = !isElectron;
    
    console.log('🎵 AudioPlayer: Seeking to time:', time, 'seconds - Environment:', { isElectron, isMobileBrowser });
    
    if (isMobileBrowser) {
      // Mobile: Use HTML5 audio for seeking
      if (mobileAudioRef.current) {
        try {
          mobileAudioRef.current.currentTime = time;
          console.log('✅ Mobile audio seeked to:', time);
          
          // Sync WaveSurfer visualization if it exists
          if (waveSurferRef.current && duration > 0) {
            const seekPercent = time / duration;
            waveSurferRef.current.seekTo(seekPercent);
            console.log('✅ WaveSurfer visualization synced to:', seekPercent);
          }
        } catch (error) {
          console.error('❌ AudioPlayer: Error during mobile audio seek:', error);
        }
      } else {
        console.error('❌ AudioPlayer: Mobile audio element not available for seek');
      }
      return;
    }
    
    // Desktop: Use WaveSurfer for seeking
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

  // Handle mobile waveform touch/click for seeking
  const handleWaveformTouch = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    
    // Get touch/click position
    let clientX: number;
    if ('touches' in e) {
      // Touch event
      if (e.touches.length === 0) return;
      clientX = e.touches[0].clientX;
      setTouchStartTime(Date.now());
      setTouchStartX(clientX);
    } else {
      // Mouse event
      clientX = e.clientX;
    }
    
    if (!waveformRef.current || duration === 0) return;
    
    const rect = waveformRef.current.getBoundingClientRect();
    const clickX = clientX - rect.left;
    const clickPercent = Math.max(0, Math.min(1, clickX / rect.width));
    const clickTime = clickPercent * duration;
    
    console.log('🎵 [WAVEFORM SEEK] Touch/click detected:', {
      isMobile,
      clickX,
      clickPercent: clickPercent.toFixed(3),
      clickTime: clickTime.toFixed(2),
      duration,
      rect: { left: rect.left, width: rect.width }
    });
    
    // Seek to the clicked/touched position
    handleSeek(clickTime);
  }, [duration, handleSeek, isMobile]);

  // Handle touch end for mobile (to distinguish from swipe gestures)
  const handleWaveformTouchEnd = useCallback((e: React.TouchEvent) => {
    const touchEndTime = Date.now();
    
    // Only proceed if we have touch start data
    if (touchStartTime === null || touchStartX === null) return;
    
    const touchDuration = touchEndTime - touchStartTime;
    const touch = e.changedTouches[0];
    const touchEndX = touch.clientX;
    const touchDistance = Math.abs(touchEndX - touchStartX);
    
    console.log('🎵 [TOUCH END] Touch analysis:', {
      duration: touchDuration,
      distance: touchDistance,
      isQuickTap: touchDuration < 200 && touchDistance < 10
    });
    
    // Reset touch tracking
    setTouchStartTime(null);
    setTouchStartX(null);
    
    // If it was a quick tap (not a swipe), we already handled the seek in touchstart
    // This is just cleanup - the actual seeking happens in handleWaveformTouch
  }, [touchStartTime, touchStartX]);

  // Handle volume change
  const handleVolumeChange = useCallback((newVolume: number) => {
    if (!waveSurferRef.current) {
      console.warn('🎵 AudioPlayer: No WaveSurfer instance available for volume change');
      return;
    }

    try {
      console.log('🎵 AudioPlayer: Setting volume to:', newVolume);
      waveSurferRef.current.setVolume(newVolume / 100);
      onVolumeChange(newVolume / 100); // Sync with prop
    } catch (error) {
      console.error('❌ AudioPlayer: Error during volume change:', error);
    }
  }, [onVolumeChange]);

  // Handle playback speed change
  const handleSpeedChange = useCallback((newSpeed: number) => {
    if (!waveSurferRef.current) {
      console.warn('🎵 AudioPlayer: No WaveSurfer instance available for speed change');
      return;
    }

    try {
      console.log('🎵 AudioPlayer: Setting playback speed to:', newSpeed);
      waveSurferRef.current.setPlaybackRate(newSpeed);
      onPlaybackSpeedChange(newSpeed); // Sync with prop
    } catch (error) {
      console.error('❌ AudioPlayer: Error during speed change:', error);
    }
  }, [onPlaybackSpeedChange]);

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

  // Debug markers
  // console.log('AudioPlayer render - markers:', markers);

  return (
    <div className="space-y-2">
      {/* Hidden HTML5 audio element for mobile - only render if audioUrl exists */}
      {audioUrl && (
        <audio
          ref={mobileAudioRef}
          src={audioUrl}
          onLoadedData={() => {
            console.log('🎵 Mobile audio loaded');
            setIsAudioLoaded(true);
            setIsReady(true);
            // Set volume for mobile
            if (mobileAudioRef.current) {
              mobileAudioRef.current.volume = volume;
              console.log('🎵 Mobile audio volume set to:', volume);
            }
          }}
          onPlay={() => {
            console.log('🎵 Mobile audio playing');
            setIsPlaying(true);
          }}
          onPause={() => {
            console.log('🎵 Mobile audio paused');
            setIsPlaying(false);
          }}
          onTimeUpdate={(e) => {
            const target = e.target as HTMLAudioElement;
            setCurrentTime(target.currentTime);
            // Sync WaveSurfer visualization with mobile audio progress
            if (waveSurferRef.current && target.duration > 0) {
              const progress = target.currentTime / target.duration;
              waveSurferRef.current.seekTo(progress);
            }
          }}
          onDurationChange={(e) => {
            const target = e.target as HTMLAudioElement;
            setDuration(target.duration);
          }}
          preload="metadata"
          style={{ display: 'none' }}
        />
      )}
      
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
      onTouchStart={handleWaveformTouch}
      onTouchEnd={handleWaveformTouchEnd}
      onClick={(e) => {
        // Only handle click on desktop (not mobile) to avoid interference with touch
        if (!isMobile) {
          handleWaveformTouch(e);
        }
      }}
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
      title={isMobile ? "Tap to seek, double-tap to add comment" : "Click to seek, double-click to add comment"}
    />

      {/* Compact Transport Controls - Single Row */}
      <div className="flex items-center justify-between px-2 py-1 bg-gray-50 rounded border">
        {/* Left: Transport Controls */}
        <div className="flex items-center space-x-2">
          <button
            onClick={onPrevious}
            disabled={!track}
            className={`p-1 transition-colors ${
              track 
                ? 'text-gray-600 hover:text-gray-800' 
                : 'text-gray-300 cursor-not-allowed'
            }`}
            aria-label="Previous track"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
            </svg>
          </button>
          
          <button
            onClick={handlePlayPause}
            disabled={!track}
            className={`p-1.5 rounded transition-colors ${
              track 
                ? 'text-white bg-gray-800 hover:bg-gray-700' 
                : 'text-gray-400 bg-gray-200 cursor-not-allowed'
            }`}
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
            disabled={!track}
            className={`p-1 transition-colors ${
              track 
                ? 'text-gray-600 hover:text-gray-800' 
                : 'text-gray-300 cursor-not-allowed'
            }`}
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
