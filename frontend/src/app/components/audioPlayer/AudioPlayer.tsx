import React, { useCallback, useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import type { WaveSurfer as WaveSurferType } from 'wavesurfer.js';
import type { Region } from 'wavesurfer.js/dist/plugins/regions';
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.js";
import { useComments } from "@/app/hooks/useComments";
import { useEnvironment } from "@/app/hooks/useEnvironment";
import { Marker as MarkerType, _Comment } from "../../../../../shared/types";
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
  
  // Log markers for debugging
  // console.log('🎯 AudioPlayer using markers from context');
  
  // Use external refs if provided, otherwise use internal refs
  const waveSurferRef = externalWaveSurferRef || internalWaveSurferRef;
  const regionsRef = externalRegionsRef || internalRegionsRef;
  
  const [isReady, setIsReady] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string>('');
  // Convert volume from 0-1 range to 0-100 range for the slider
  const [volumeState, setVolume] = useState(Math.round(volume * 100));
  const [playbackSpeedState, setPlaybackSpeed] = useState(playbackSpeed);

  // Track if WaveSurfer is loaded and ready to play audio
  const [isAudioLoaded, setIsAudioLoaded] = useState(false);

  // Environment detection for mobile/desktop behavior
  const { isMobile } = useEnvironment();
  
  // Debug environment detection
  useEffect(() => {
    console.log('🌍 [AUDIO PLAYER] Environment detection:', { 
      isMobile, 
      userAgent: typeof window !== 'undefined' ? navigator.userAgent : 'N/A',
      screenWidth: typeof window !== 'undefined' ? window.innerWidth : 'N/A'
    });
  }, [isMobile]);
  
  // Touch tracking for mobile waveform seeking
  const [touchStartTime, setTouchStartTime] = useState<number | null>(null);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  
  // Double-tap detection for mobile
  const [lastTapTime, setLastTapTime] = useState<number>(0);
  const [lastTapPosition, setLastTapPosition] = useState<number | null>(null);
  const DOUBLE_TAP_DELAY = 300; // milliseconds

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


  // Handle playback state changes from PlaybackProvider - Unified WaveSurfer approach
  useEffect(() => {
    console.log('🎵 [UNIFIED PLAYBACK] isPlaying changed:', isPlaying, 'isAudioLoaded:', isAudioLoaded);
    
    if (isPlaying) {
      // Use WaveSurfer for all platforms
      if (waveSurferRef.current && isAudioLoaded) {
        console.log('🎵 [UNIFIED PLAYBACK] Playing via WaveSurfer');
        
        if (!waveSurferRef.current.isPlaying()) {
          const playPromise = waveSurferRef.current.play();
          if (playPromise && typeof playPromise.catch === 'function') {
            playPromise.then(() => {
              console.log('🎵 [UNIFIED PLAYBACK] WaveSurfer play successful!');
            }).catch(error => {
              // Ignore AbortError - it's expected when play() is interrupted
              if (error.name !== 'AbortError') {
                console.error('🎵 [UNIFIED PLAYBACK] WaveSurfer play failed:', error);
              }
            });
          }
        }
      } else if (!isAudioLoaded) {
        console.log('🎵 [UNIFIED PLAYBACK] Audio not loaded yet, skipping play attempt');
      } else {
        console.warn('🎵 [UNIFIED PLAYBACK] No WaveSurfer available for playback!');
      }
    } else {
      // Pause WaveSurfer
      if (waveSurferRef.current) {
        console.log('🎵 [UNIFIED PLAYBACK] Pausing WaveSurfer');
        try {
          waveSurferRef.current.pause();
        } catch (error) {
          console.error('🎵 [UNIFIED PLAYBACK] Error pausing WaveSurfer:', error);
        }
      }
    }
  }, [isPlaying, isAudioLoaded]);


  // Get markers and comments from context via useComments hook
  const { 
    markers: activeMarkers = [], 
    comments = [],
    regionCommentMap,
    setRegionCommentMap,
    setSelectedCommentId = () => {}
  } = useComments(waveSurferRef, regionsRef);
  
  // Ensure comments is always an array for safe operations - handle undefined/null cases
  const safeComments: _Comment[] = comments && Array.isArray(comments) ? comments : [];

  // Debug markers and comments in AudioPlayer
  useEffect(() => {
    console.log('=== AUDIOPLAYER MARKERS & COMMENTS DEBUG ===');
    console.log('activeMarkers from context:', activeMarkers);
    console.log('activeMarkers length:', activeMarkers?.length);
    console.log('comments from context:', comments);
    console.log('comments length:', comments?.length);
    console.log('safeComments length:', safeComments.length);
  }, [activeMarkers, comments]);

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
      // console.log('🔄 AudioPlayer: Local file access failed, attempting audio server fallback...');
      
      // Convert file:// URL to audio server URL
      const fileName = url.split('/').pop();
      const audioServerUrl = `http://localhost:3002/audio/${fileName}`;
      
      // console.log('🔄 AudioPlayer: Fallback URL:', {
      //   originalUrl: url,
      //   fallbackUrl: audioServerUrl,
      //   fileName: fileName
      // });
      
      // Try loading with audio server URL
      if (waveSurferRef.current) {
        try {
          // console.log('🔄 AudioPlayer: Loading audio with fallback URL...');
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
    console.log('🎵 AudioPlayer: Getting file URL for track:', track?.id, track?.name, 'filePath:', filePath);
    
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
          trackName: track?.name,
          streamingUrl: streamingUrl,
          note: 'Using Next.js /api/audio/[trackId] endpoint'
        });
        return streamingUrl;
      } else {
        // Electron: use audio server with actual filename
        const fileName = filePath.replace('/uploads/', '');
        const audioServerUrl = `http://localhost:3002/audio/${fileName}`;
        
        console.log('🎵 AudioPlayer: Using audio server URL for Electron:', {
          trackId: track?.id,
          trackName: track?.name,
          originalPath: filePath,
          fileName: fileName,
          audioServerUrl: audioServerUrl
        });
        
        return audioServerUrl;
      }
      
    } catch (error) {
      console.warn('⚠️ AudioPlayer: Error getting file URL, using fallback:', {
        trackId: track?.id,
        trackName: track?.name,
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
        const audioServerUrl = `http://localhost:3002/audio/${fileName}`;
        console.log('🎵 AudioPlayer: Using Electron fallback:', audioServerUrl);
        return audioServerUrl;
      }
    }
  }, [track?.id, track?.name]);

  // Track current initialization to prevent race conditions
  const currentTrackRef = useRef<string | null>(null);
  
  // Track component mount state
  const isMountedRef = useRef(true);
  
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Proper WaveSurfer destruction with completion promise
  const destroyWaveSurfer = useCallback((): Promise<void> => {
    return new Promise((resolve) => {
      if (!waveSurferRef.current) {
        console.log('🧹 AudioPlayer: No WaveSurfer instance to destroy');
        resolve();
        return;
      }

      console.log('🧹 AudioPlayer: Starting proper WaveSurfer destruction...');
      const oldInstance = waveSurferRef.current;
      
      // Clear reference immediately to prevent new operations
      waveSurferRef.current = null;
      setIsReady(false);
      setIsAudioLoaded(false);

      try {
        // Step 1: Pause and stop any ongoing operations
        if (typeof oldInstance.isPlaying === 'function' && oldInstance.isPlaying()) {
          oldInstance.pause();
        }
        
        // Step 2: Remove all event listeners
        if (typeof (oldInstance as any).unAll === 'function') {
          (oldInstance as any).unAll();
        }
        
        // Step 3: Destroy the instance
        if (typeof oldInstance.destroy === 'function') {
          oldInstance.destroy();
        }
        
        console.log('✅ AudioPlayer: WaveSurfer destruction completed');
        resolve();
        
      } catch (error) {
        console.error('❌ AudioPlayer: Error during destruction:', error);
        // Still resolve to not block the process
        resolve();
      }
    });
  }, []);

  // Proper audio loading with completion promise
  const loadAudioWithPromise = useCallback((wavesurfer: any, url: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      console.log('🎵 AudioPlayer: Starting audio load with promise...');
      
      const handleReady = () => {
        console.log('✅ AudioPlayer: Audio actually loaded and ready');
        wavesurfer.un('ready', handleReady);
        wavesurfer.un('error', handleError);
        
        // Set state after actual completion
        setIsReady(true);
        setIsAudioLoaded(true);
        setDuration(wavesurfer.getDuration());
        
        resolve();
      };
      
      const handleError = (error: any) => {
        console.error('❌ AudioPlayer: Audio load failed:', error);
        wavesurfer.un('ready', handleReady);
        wavesurfer.un('error', handleError);
        reject(error);
      };
      
      // Set up event listeners
      wavesurfer.on('ready', handleReady);
      wavesurfer.on('error', handleError);
      
      // Start loading
      try {
        wavesurfer.load(url);
      } catch (loadError) {
        wavesurfer.un('ready', handleReady);
        wavesurfer.un('error', handleError);
        reject(loadError);
      }
    });
  }, []);

  // Function to add markers to waveform with enhanced styling and tooltips
  const addMarkersToWaveform = useCallback(() => {
    try {
      if (!regionsRef.current || !activeMarkers || activeMarkers.length === 0) {
        console.log('🎯 Cannot add markers - missing regions plugin or no markers');
        return;
      }

      console.log('🎯 Adding markers to waveform:', activeMarkers.length);
      
      // Clear existing regions
      regionsRef.current.clearRegions();
      
      // Add new regions for each marker
      activeMarkers.forEach((marker: any, index: number) => {
        console.log(`🎯 Adding region for marker ${index + 1}:`, marker);
        try {
          // Check if the marker has all required properties
          if (typeof marker.time !== 'number' || marker.time < 0) {
            console.error('❌ Marker missing or invalid time property:', marker);
            return;
          }
          
          // Ensure marker has required IDs
          if (!marker.id || !marker.commentId) {
            console.error('❌ Marker missing required ID properties:', marker);
            return;
          }
          
          const regionId = marker.waveSurferRegionID || `marker-${marker.id}-${Date.now()}`;
          
          // Enhanced marker styling with better visibility
          const defaultColor = 'rgba(59, 130, 246, 0.7)'; // Blue with transparency
          const markerColor = marker.data?.customColor || defaultColor;
          
          const region = regionsRef.current.addRegion({
            id: regionId,
            start: marker.time,
            end: marker.time + 0.5, // Shorter 0.5 second markers for less intrusion
            color: markerColor,
            drag: false,
            resize: false,
            data: {
              commentId: marker.commentId,
              markerData: marker,
            },
          });

          // Enhanced styling and interaction for markers
          if (region && region.element) {
            const originalColor = markerColor;
            const hoverColor = 'rgba(249, 115, 22, 0.8)'; // Orange on hover
            const selectedColor = 'rgba(34, 197, 94, 0.8)'; // Green when selected
            
            // Enhanced styling
            region.element.style.cursor = 'pointer';
            region.element.style.borderLeft = '2px solid rgba(59, 130, 246, 1)';
            region.element.style.borderRadius = '2px';
            region.element.style.zIndex = '10';
            
            // Create tooltip element
            const tooltip = document.createElement('div');
            tooltip.className = 'marker-tooltip';
            tooltip.style.cssText = `
              position: absolute;
              background: rgba(0, 0, 0, 0.9);
              color: white;
              padding: 8px 12px;
              border-radius: 6px;
              font-size: 12px;
              max-width: 200px;
              z-index: 1000;
              pointer-events: none;
              transform: translateX(-50%);
              white-space: pre-wrap;
              word-break: break-word;
              box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
              display: none;
            `;
            
            // Find the associated comment for tooltip content with error handling
            const associatedComment = safeComments.find(c => c.id === marker.commentId);
            let tooltipContent = `Time: ${formatTime(marker.time)}\nComment marker`;
            
            if (associatedComment && typeof associatedComment.content === 'string') {
              try {
                const contentPreview = associatedComment.content.length > 100 
                  ? associatedComment.content.substring(0, 100) + '...' 
                  : associatedComment.content;
                tooltipContent = `Time: ${formatTime(marker.time)}\n"${contentPreview}"`;
              } catch (error) {
                console.warn('⚠️ Error formatting comment content for tooltip:', error);
                // Fallback to default tooltip content
              }
            }
            
            tooltip.textContent = tooltipContent;
            document.body.appendChild(tooltip);
            
            // Enhanced hover effects with tooltip
            region.element.addEventListener('mouseenter', (e) => {
              region.setOptions({ color: hoverColor });
              
              // Position and show tooltip
              const rect = region.element.getBoundingClientRect();
              tooltip.style.left = `${rect.left + rect.width / 2}px`;
              tooltip.style.top = `${rect.top - 10}px`;
              tooltip.style.transform = 'translateX(-50%) translateY(-100%)';
              tooltip.style.display = 'block';
            });
            
            region.element.addEventListener('mouseleave', () => {
              region.setOptions({ color: originalColor });
              tooltip.style.display = 'none';
            });
            
            // Store tooltip reference for cleanup
            (region as any).tooltip = tooltip;
          }
          
          console.log(`✅ Enhanced region ${index + 1} created successfully:`, region);
          
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
      
      console.log('🎯 All enhanced markers added successfully');
    } catch (error) {
      console.error('❌ Error adding markers to waveform:', error);
    }
  }, [activeMarkers, setRegionCommentMap, comments]);

  // Enhanced WaveSurfer initialization with race condition protection
  const initializeWaveSurfer = useCallback(async () => {
    if (!track || !waveformRef.current) {
      console.log('🎵 AudioPlayer: Cannot initialize WaveSurfer - missing track or container');
      return;
    }

    const trackId = `${track.id}-${track.filePath}`;
    currentTrackRef.current = trackId;
    console.log('🎵 AudioPlayer: Starting initialization for track:', trackId);

    try {
      // Step 1: Proper cleanup with real completion check
      await destroyWaveSurfer();
      
      // Check if still current after cleanup
      if (currentTrackRef.current !== trackId || !isMountedRef.current) {
        console.log('🎵 AudioPlayer: Track changed or component unmounted during cleanup');
        return;
      }

      // Step 2: Get file URL
      const fileUrl = await getFileUrl(track.filePath);
      
      // Check if still current after URL resolution
      if (currentTrackRef.current !== trackId || !isMountedRef.current) {
        console.log('🎵 AudioPlayer: Track changed or component unmounted during URL resolution');
        return;
      }
      
      // Type check
      if (typeof fileUrl !== 'string') {
        throw new Error(`Invalid file URL type: ${typeof fileUrl}, expected string`);
      }

      console.log('🎵 AudioPlayer: File URL resolved:', fileUrl);

      // Step 3: Create new WaveSurfer instance
      console.log('🎵 AudioPlayer: Creating new WaveSurfer instance...');
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
        minPxPerSec: 1,
        maxCanvasWidth: 4000,
        progressiveLoad: true,
        xhr: {
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

      // Set reference immediately after creation
      waveSurferRef.current = wavesurfer;

      // Check if still current after instance creation
      if (currentTrackRef.current !== trackId || !isMountedRef.current) {
        console.log('🎵 AudioPlayer: Track changed or component unmounted during instance creation');
        await destroyWaveSurfer();
        return;
      }

      // Step 4: Set up regions plugin
      let regionsPlugin = null;
      try {
        if (wavesurfer.regions) {
          regionsPlugin = wavesurfer.regions;
          regionsRef.current = regionsPlugin;
          console.log('✅ Regions plugin found via wavesurfer.regions');
        }
      } catch (error) {
        console.error('❌ Error accessing regions plugin:', error);
      }

      // Step 5: Set up core event listeners (not including ready - handled by loadAudioWithPromise)
      wavesurfer.on('play', () => {
        console.log('🎵 AudioPlayer: WaveSurfer play event');
      });
      
      wavesurfer.on('pause', () => {
        console.log('🎵 AudioPlayer: WaveSurfer pause event');
      });
      
      wavesurfer.on('finish', () => {
        console.log('🎵 AudioPlayer: WaveSurfer finish event');
        onNext();
      });
      
      wavesurfer.on('timeupdate', (currentTime: number) => {
        setCurrentTime(currentTime);
      });

      // Step 6: Load audio with proper completion check
      console.log('🎵 AudioPlayer: Loading audio...');
      await loadAudioWithPromise(wavesurfer, fileUrl);

      // Final check - ensure we're still current after loading
      if (currentTrackRef.current === trackId && isMountedRef.current) {
        console.log('✅ AudioPlayer: Initialization completed successfully for track:', trackId);
        
        // Add markers if they exist
        if (activeMarkers && activeMarkers.length > 0) {
          console.log('🎯 Adding markers after successful initialization:', activeMarkers.length);
          addMarkersToWaveform();
        }
      } else {
        console.log('🚫 AudioPlayer: Track changed during loading, cleaning up');
        await destroyWaveSurfer();
      }

    } catch (error) {
      console.error('❌ AudioPlayer: Initialization failed:', error);
      // Cleanup on failure
      await destroyWaveSurfer();
    }
  }, [track?.id, track?.filePath, destroyWaveSurfer, loadAudioWithPromise, getFileUrl, onNext, activeMarkers, addMarkersToWaveform]);


  // Set audio URL based on track file path
  useEffect(() => {
    console.log('🦇 AudioPlayer: Track changed effect triggered');
    console.log('🦇 AudioPlayer: Track object:', JSON.stringify(track, null, 2));
    console.log('🦇 AudioPlayer: Track id:', track?.id);
    console.log('🦇 AudioPlayer: Track name:', track?.name);
    console.log('🦇 AudioPlayer: Track filePath:', track?.filePath);
    console.log('🦇 AudioPlayer: Track file_path:', track?.file_path);
    console.log('🦇 AudioPlayer: Track filePath type:', typeof track?.filePath);
    console.log('🦇 AudioPlayer: Track keys:', track ? Object.keys(track) : 'null');
    
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
    
    // Handle both filePath and file_path for compatibility
    const trackFilePath = track?.filePath || (track as any)?.file_path;
    
    if (!waveformRef.current || !trackFilePath) {
      console.log('🦇 AudioPlayer: Missing waveformRef or filePath, returning early');
      console.log('🦇 AudioPlayer: waveformRef.current:', !!waveformRef.current);
      console.log('🦇 AudioPlayer: track?.filePath:', track?.filePath);
      console.log('🦇 AudioPlayer: track?.file_path:', (track as any)?.file_path);
      console.log('🦇 AudioPlayer: trackFilePath:', trackFilePath);
      return;
    }

    console.log('🦇 AudioPlayer: Processing track with filePath:', trackFilePath);
    
    // Validate the audio file path
    if (!trackFilePath || typeof trackFilePath !== 'string') {
      console.error('🦇 AudioPlayer: Invalid filePath:', trackFilePath);
        return;
      }
      
    // Use environment-aware URL (mobile API vs desktop audio server)
    const getAudioUrl = async () => {
      try {
        const audioServerUrl = await getFileUrl(trackFilePath);
        console.log('🦇 AudioPlayer: Setting audioUrl via getFileUrl:', audioServerUrl);
        setAudioUrl(audioServerUrl);
      } catch (error) {
        console.error('❌ AudioPlayer: Error getting audio URL:', error);
      }
    };
    
    getAudioUrl();
  }, [track?.filePath, (track as any)?.file_path, track?.id, getFileUrl]);

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

  // Handle play/pause - Unified WaveSurfer approach for all platforms
  const handlePlayPause = useCallback(() => {
    console.log('🎵 [UNIFIED PLAYBACK] handlePlayPause called - using WaveSurfer for all platforms');
    
    // Use WaveSurfer for all platforms
    if (!waveSurferRef.current || !isAudioLoaded) {
      console.warn('🎵 [UNIFIED PLAYBACK] WaveSurfer not ready for play/pause');
      onPlayPause(); // Still call prop for state sync
      return;
    }
      
    try {
      console.log('🎵 [UNIFIED PLAYBACK] WaveSurfer ready, proceeding with play/pause');
      if (isPlaying && !waveSurferRef.current.isPlaying()) {
        console.log('🎵 [UNIFIED PLAYBACK] Playing WaveSurfer audio');
        const playPromise = waveSurferRef.current.play();
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch(error => {
            // Ignore AbortError - it's expected when play() is interrupted
            if (error.name !== 'AbortError') {
              console.error('❌ AudioPlayer: Error during WaveSurfer audio play:', error);
            }
          });
        }
      } else if (!isPlaying && waveSurferRef.current.isPlaying()) {
        console.log('🎵 [UNIFIED PLAYBACK] Pausing WaveSurfer audio');
        waveSurferRef.current.pause();
      }
    } catch (error) {
      console.error('❌ AudioPlayer: Error during WaveSurfer audio play/pause:', error);
    }
    
    // Finally, call the onPlayPause prop to sync with higher-level state
    onPlayPause();
  }, [isPlaying, isAudioLoaded, onPlayPause]);

  // Handle seek - Unified WaveSurfer approach for all platforms
  const handleSeek = useCallback((time: number) => {
    console.log('🎵 [UNIFIED SEEK] Seeking to time:', time, 'seconds');
    
    if (!waveSurferRef.current) {
      console.warn('🎵 [UNIFIED SEEK] No WaveSurfer instance available for seek');
      return;
    }

    try {
      console.log('🎵 [UNIFIED SEEK] Seeking WaveSurfer to time:', time);
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
      // Touch event - only handle on mobile
      if (!isMobile) {
        console.log('🎵 [DESKTOP] Touch start handler disabled on desktop');
        return;
      }
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
    // Only handle touch events on mobile
    if (!isMobile) {
      console.log('🎵 [DESKTOP] Touch end handler disabled on desktop');
      return;
    }
    
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
    
    // Check for double-tap on mobile
    if (touchDuration < 200 && touchDistance < 10) {
      const currentTime = Date.now();
      const tapX = touch.clientX;
      
      // Check if this tap is close in time and position to the last tap
      if (lastTapTime && currentTime - lastTapTime < DOUBLE_TAP_DELAY) {
        if (lastTapPosition !== null && Math.abs(tapX - lastTapPosition) < 30) {
          // Double-tap detected!
          console.log('🎵 [DOUBLE TAP] Detected at position:', tapX);
          
          // Calculate time position for the comment
          if (waveformRef.current && duration > 0) {
            const rect = waveformRef.current.getBoundingClientRect();
            const clickX = tapX - rect.left;
            const clickPercent = Math.max(0, Math.min(1, clickX / rect.width));
            const clickTime = clickPercent * duration;
            
            console.log('🎵 [DOUBLE TAP] Adding comment at time:', clickTime, 'seconds');
            
            if (onAddComment) {
              onAddComment(clickTime);
            }
          }
          
          // Reset double-tap tracking
          setLastTapTime(0);
          setLastTapPosition(null);
        }
      } else {
        // First tap - record it
        setLastTapTime(currentTime);
        setLastTapPosition(tapX);
      }
    }
    
    // Reset touch tracking
    setTouchStartTime(null);
    setTouchStartX(null);
    
    // If it was a quick tap (not a swipe), we already handled the seek in touchstart
    // This is just cleanup - the actual seeking happens in handleWaveformTouch
  }, [touchStartTime, touchStartX, lastTapTime, lastTapPosition, DOUBLE_TAP_DELAY, duration, onAddComment]);

  // Handle volume change
  const handleVolumeChange = useCallback((newVolume: number) => {
    if (!waveSurferRef.current) {
      // console.warn('🎵 AudioPlayer: No WaveSurfer instance available for volume change');
      return;
    }

    try {
      // console.log('🎵 AudioPlayer: Setting volume to:', newVolume);
      waveSurferRef.current.setVolume(newVolume / 100);
      onVolumeChange(newVolume / 100); // Sync with prop
    } catch (error) {
      console.error('❌ AudioPlayer: Error during volume change:', error);
    }
  }, [onVolumeChange]);

  // Handle playback speed change
  const handleSpeedChange = useCallback((newSpeed: number) => {
    if (!waveSurferRef.current) {
      // console.warn('🎵 AudioPlayer: No WaveSurfer instance available for speed change');
      return;
    }

    try {
      // console.log('🎵 AudioPlayer: Setting playback speed to:', newSpeed);
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
  }, [setSelectedCommentId, regionCommentMap]);

  // Handle markers updates when they change
  useEffect(() => {
    if (isReady && regionsRef.current) {
      if (activeMarkers && activeMarkers.length > 0) {
        console.log('🎯 Markers updated, refreshing regions:', activeMarkers.length);
        addMarkersToWaveform();
      } else {
        console.log('🎯 No markers or empty markers array, clearing regions');
        regionsRef.current.clearRegions();
        setRegionCommentMap({});
      }
    } else if (activeMarkers && activeMarkers.length > 0 && !regionsRef.current) {
      console.log('🎯 Markers available but regions plugin not ready, will add when ready');
    }
  }, [activeMarkers, isReady, addMarkersToWaveform]);

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
      {...(isMobile ? {
        onTouchStart: handleWaveformTouch,
        onTouchEnd: handleWaveformTouchEnd
      } : {})}
      onClick={(e) => {
        // Only handle click on desktop (not mobile) to avoid interference with touch
        if (!isMobile) {
          handleWaveformTouch(e);
        }
      }}
      onDoubleClick={(e) => {
        // Only enable waveform double-click to add comments on mobile
        if (isMobile && waveSurferRef.current) {
          const rect = e.currentTarget.getBoundingClientRect();
          const clickX = e.clientX - rect.left;
          const clickPercent = clickX / rect.width;
          const clickTime = clickPercent * duration;
          
          console.log('🎵 [MOBILE] Waveform double-click at time:', clickTime, 'seconds');
          
          if (onAddComment) {
            onAddComment(clickTime);
          }
        } else {
          console.log('🎵 [DESKTOP] Waveform double-click disabled - use track double-click instead');
        }
      }}
      title={isMobile ? "Tap to seek, double-tap to add comment" : "Click to seek, double-click track in list to show comments"}
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
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
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
