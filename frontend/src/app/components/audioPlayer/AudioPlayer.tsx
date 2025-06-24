import React, { useCallback, useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import type { WaveSurfer as WaveSurferType } from 'wavesurfer.js';
import type { Region } from 'wavesurfer.js/dist/plugins/regions';
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions";
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
  
  // Get markers from comments context
  const { markers, setSelectedCommentId, regionCommentMap, setRegionCommentMap } = useComments(waveSurferRef as any, regionsRef as any);

  // Debug markers in AudioPlayer
  useEffect(() => {
    console.log('=== AUDIOPLAYER MARKERS DEBUG ===');
    console.log('markers from useComments:', markers);
    console.log('markers length:', markers?.length);
    console.log('markers type:', typeof markers);
  }, [markers]);

  // Initialize WaveSurfer
  useEffect(() => {
    // Early return if no track is provided
    if (!track) {
      console.log('AudioPlayer: No track provided, skipping WaveSurfer initialization');
      return;
    }
    
    console.log('AudioPlayer: Initializing WaveSurfer with track:', track);
    console.log('AudioPlayer: filePath:', track?.filePath);
    
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
    
    // Check if the file path is accessible
    if (!track.filePath.startsWith('http') && !track.filePath.startsWith('file://') && !track.filePath.startsWith('/')) {
      console.error('AudioPlayer: Invalid file path format:', track.filePath);
      return;
    }
    
    // Validate container element
    if (!waveformRef.current || !waveformRef.current.offsetWidth || !waveformRef.current.offsetHeight) {
      console.error('AudioPlayer: Container element is not properly initialized');
      return;
    }
    
    try {
      // Create WaveSurfer instance without regions plugin first
      console.log('AudioPlayer: About to create WaveSurfer with config:', {
        container: waveformRef.current,
        waveColor: '#e5e7eb',
        progressColor: '#3b82f6',
        height: 120,
        normalize: true,
        url: track.filePath,
      });
      
      let ws;
      try {
        ws = WaveSurfer.create({
          container: waveformRef.current,
          waveColor: '#e5e7eb',
          progressColor: '#3b82f6',
          height: 120,
          normalize: true,
          url: track.filePath,
        }) as any;
        console.log('AudioPlayer: WaveSurfer.create() completed successfully');
      } catch (createError) {
        console.error('AudioPlayer: Error in WaveSurfer.create():', createError);
        throw createError; // Re-throw to be caught by outer try-catch
      }

      console.log('AudioPlayer: WaveSurfer instance created successfully:', ws);

      // Set up event listeners
      (ws as any).on('error', (error: any) => {
        console.error('AudioPlayer: WaveSurfer error:', error);
        // Set a fallback state if WaveSurfer fails
        setIsReady(false);
        setDuration(0);
        setCurrentTime(0);
      });

      (ws as any).on('ready', () => {
        console.log('AudioPlayer: WaveSurfer is ready!');
        waveSurferRef.current = ws;
        setDuration(ws.getDuration());
        setIsReady(true);
        
        // Set initial volume and playback rate
        ws.setVolume(volume);
        ws.setPlaybackRate(playbackSpeed);

        // Now create and initialize the regions plugin manually
        try {
          console.log('AudioPlayer: Creating regions plugin...');
          // Create regions plugin
          const regionsPlugin = RegionsPlugin.create();
          console.log('AudioPlayer: Regions plugin created successfully');
          
          // Add plugin to wavesurfer
          console.log('AudioPlayer: Registering regions plugin...');
          ws.registerPlugin(regionsPlugin);
          console.log('AudioPlayer: Regions plugin registered successfully');
          
          // Store reference to regions plugin
          regionsRef.current = regionsPlugin;
          
          console.log('Regions plugin initialized successfully');
          
          // Add event listeners for regions
          regionsPlugin.on('region-clicked', (region: any, e: MouseEvent) => {
            e.stopPropagation();
            console.log('Region clicked:', region);
          });
          
          // Don't create regions here - they will be created in the markers effect
          console.log('Regions plugin ready - regions will be created when markers are available');
          
        } catch (error) {
          console.error('Error initializing regions plugin:', error);
          // Don't fail the entire initialization if regions plugin fails
          regionsRef.current = null;
        }
      });

      (ws as any).on('audioprocess', () => {
        if ((ws as any).isPlaying()) {
          const currentTime = (ws as any).getCurrentTime();
          setCurrentTime(currentTime);
          onSeek(currentTime);
        }
      });

      (ws as any).on('seek', (time: number) => {
        setCurrentTime(time);
        onSeek(time);
      });

      // Cleanup
      return () => {
        console.log('AudioPlayer: Cleaning up WaveSurfer instance');
        if (ws) {
          try {
            // Prevent AbortError by removing all event listeners first
            try {
              (ws as any).unAll(); // Remove all event listeners
            } catch (error) {
              console.error('Error removing event listeners:', error);
            }
            
            // Don't use setTimeout as it's still causing issues
            // Just set the reference to null and let garbage collection handle it
            waveSurferRef.current = null;
          } catch (error) {
            console.error('Error during WaveSurfer cleanup:', error);
          }
        }
      };
    } catch (error) {
      console.error('Error creating WaveSurfer instance:', error);
    }
  }, [track?.filePath, volume, playbackSpeed]);

  // Handle play/pause
  useEffect(() => {
    if (!waveSurferRef.current || !isReady) return;

    if (isPlaying) {
      // @ts-ignore - The play method exists
      waveSurferRef.current.play().catch(console.error);
    } else {
      // @ts-ignore - The pause method exists
      waveSurferRef.current.pause();
    }
  }, [isPlaying, isReady]);

  // Handle seek
  const handleSeek = useCallback((time: number) => {
    if (waveSurferRef.current) {
      const seekTime = Math.min(Math.max(0, time), duration || 0);
      waveSurferRef.current.setTime(seekTime);
      setCurrentTime(seekTime);
      onSeek(seekTime);
    }
  }, [duration, onSeek]);

  // Handle volume change
  useEffect(() => {
    if (waveSurferRef.current) {
      waveSurferRef.current.setVolume(volume);
    }
  }, [volume]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (waveSurferRef.current) {
        waveSurferRef.current.destroy();
        waveSurferRef.current = null;
      }
    };
  }, []);

  // Handle playback speed change
  useEffect(() => {
    if (waveSurferRef.current) {
      waveSurferRef.current.setPlaybackRate(playbackSpeed);
    }
  }, [playbackSpeed]);

  // Add regions for markers from comments context
  useEffect(() => {
    console.log('🎯 MARKERS EFFECT TRIGGERED - markers:', markers?.length || 0);
    console.log('🎯 Dependencies - markers:', markers);
    console.log('🎯 Dependencies - markers?.length:', markers?.length);
    console.log('🎯 Dependencies - setRegionCommentMap:', !!setRegionCommentMap);
    console.log('🎯 Dependencies - isReady:', isReady);
    
    // Check if we have a valid track loaded
    if (!track) {
      console.log('❌ No track loaded, skipping marker regions');
      return;
    }
    
    console.log('=== MARKERS EFFECT TRIGGERED ===');
    console.log('waveSurferRef.current:', !!waveSurferRef.current);
    console.log('regionsRef.current:', !!regionsRef.current);
    console.log('markers:', markers);
    console.log('markers length:', markers?.length);
    console.log('markers type:', typeof markers);
    console.log('markers is array:', Array.isArray(markers));
    console.log('isReady:', isReady);
    
    // More robust check for WaveSurfer initialization
    if (!waveSurferRef.current || typeof waveSurferRef.current.getDuration !== 'function') {
      console.log('❌ waveSurferRef.current is null or not properly initialized, skipping marker regions');
      return;
    }
    
    if (!regionsRef.current || typeof regionsRef.current.addRegion !== 'function') {
      console.log('❌ regionsRef.current is null or not properly initialized, skipping marker regions');
      console.log('This is normal if regions plugin failed to initialize - markers will not be shown');
      return;
    }
    
    if (!isReady) {
      console.log('❌ WaveSurfer not ready yet, skipping marker regions');
      return;
    }
    
    // if (!markers?.length) {
    //   console.log('❌ No markers available, skipping marker regions');
    //   console.log('markers value:', markers);
    //   return;
    // }
    
    console.log('✅ All conditions met, adding marker regions to waveform');
    console.log('Markers to add:', markers);
    
    try {
      // Clear existing regions
      console.log('Clearing existing regions');
      regionsRef.current.clearRegions();
      
      // Verify regions plugin is working by adding a test region
      console.log('Adding test region at 20 seconds');
      try {
        const testRegion = regionsRef.current.addRegion({
          id: 'test-region-' + Date.now(),
          start: 20,
          end: 20.5,
          color: 'rgba(0, 0, 255, 0.7)', // Blue for visibility
          drag: false,
          resize: false,
        });
        console.log('✅ Test region created successfully:', testRegion);
      } catch (testError) {
        console.error('❌ Error creating test region:', testError);
      }
      
      // Add new regions for each marker
      markers.forEach((marker: any, index: number) => {
        console.log(`Adding region for marker ${index + 1}:`, marker);
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
            end: marker.time + 2.0, // Make markers wider (2 seconds instead of 1)
            color: marker.data?.customColor || 'rgba(255, 0, 0, 0.8)', // More opaque for visibility
            drag: false,
            resize: false,
            data: {
              commentId: marker.commentId,
            },
          });
          
          // Add custom styling to make the region more visible
          const regionElement = document.querySelector(`[data-id="${regionId}"]`) as HTMLElement;
          if (regionElement) {
            regionElement.style.border = '2px solid #ff0000';
            regionElement.style.borderRadius = '4px';
            regionElement.style.cursor = 'pointer';
            regionElement.style.minHeight = '20px';
            regionElement.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
          } else {
            // If element not found immediately, try again after a short delay
            setTimeout(() => {
              const delayedElement = document.querySelector(`[data-id="${regionId}"]`) as HTMLElement;
              if (delayedElement) {
                delayedElement.style.border = '2px solid #ff0000';
                delayedElement.style.borderRadius = '4px';
                delayedElement.style.cursor = 'pointer';
                delayedElement.style.minHeight = '20px';
                delayedElement.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
                console.log(`✅ Applied custom styling to region ${regionId}`);
              }
            }, 100);
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
      
      // Log all regions after creation
      const allRegions = regionsRef.current.getRegions();
      console.log('All regions after creation:', allRegions);
      console.log('Number of regions:', allRegions.length);
      
      // Check if the regions are visible
      console.log('WaveSurfer current time:', waveSurferRef.current.getCurrentTime());
      console.log('WaveSurfer duration:', waveSurferRef.current.getDuration());
    } catch (error) {
      console.error('❌ Error handling marker regions:', error);
    }
  }, [markers, setRegionCommentMap, markers?.length, isReady]);

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

  if (!track) {
    return (
      <div className="flex items-center justify-center h-32 bg-gray-100 rounded-lg">
        <p>No track selected</p>
      </div>
    );
  }

  // Debug markers
  console.log('AudioPlayer render - markers:', markers);

  return (
    <div className="flex flex-col space-y-4">
      {/* Debug info */}
      {/* <div className="p-2 bg-yellow-100 rounded-lg text-xs">
        <p>Debug: {markers?.length || 0} markers available</p>
        <ul>
          {markers?.map((marker: any) => (
            <li key={marker.id || Math.random()}>
              Marker at {marker.time}s (ID: {marker.waveSurferRegionID || 'unknown'})
            </li>
          ))}
        </ul>
      </div> */}

      {/* Waveform */}
      <div 
        ref={waveformRef} 
        className="w-full h-32 bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden cursor-pointer"
        style={{ 
          minHeight: '120px',
          position: 'relative',
          // Add CSS to make regions more visible
          "--region-color": "rgba(255, 0, 0, 0.3)",
          "--region-border-color": "rgb(255, 0, 0)",
          "--region-handle-color": "rgb(255, 0, 0)",
        } as React.CSSProperties}
        onDoubleClick={(e) => {
          if (!waveSurferRef.current) return;
          
          // Get click position relative to the waveform container
          const rect = e.currentTarget.getBoundingClientRect();
          const clickX = e.clientX - rect.left;
          const clickPercent = clickX / rect.width;
          
          // Convert to time based on duration
          const clickTime = clickPercent * duration;
          
          console.log('Double-click at time:', clickTime, 'seconds');
          
          // Trigger comment creation
          if (onAddComment) {
            onAddComment(clickTime);
          }
        }}
        title="Double-click to add a comment"
      />

      {/* Controls */}
      <div className="p-6 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-gray-500 font-medium">
            {formatTime(currentTime)}
          </span>
          <span className="text-sm text-gray-500 font-medium">
            {formatTime(duration)}
          </span>
        </div>

        <div className="flex items-center justify-center space-x-6">
          <button
            onClick={onPrevious}
            className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
            aria-label="Previous track"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
            </svg>
          </button>
          
          <button
            onClick={onPlayPause}
            className="p-3 text-white bg-gray-800 rounded-full hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z"/>
              </svg>
            )}
          </button>
          
          <button
            onClick={onNext}
            className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
            aria-label="Next track"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
            </svg>
          </button>
        </div>

        {/* Track info - fixed height to prevent layout shifts */}
        <div className="mt-4 text-center h-12 flex flex-col justify-center">
          <h2 className="text-lg font-semibold text-gray-900 truncate">
            {track?.name || 'No track selected'}
          </h2>
          <p className="text-sm text-gray-600 truncate">
            {track?.artist?.name || 'Unknown artist'}
          </p>
        </div>

        {/* Volume and speed controls */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
          <div className="flex items-center space-x-3">
            <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
            </svg>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
              className="w-20 h-1 bg-gray-300 rounded-lg appearance-none cursor-pointer slider"
            />
          </div>
          
          <div className="flex items-center space-x-3">
            <span className="text-sm text-gray-500 font-medium">Speed:</span>
            <select
              value={playbackSpeed}
              onChange={(e) => onPlaybackSpeedChange(parseFloat(e.target.value))}
              className="text-sm border border-gray-300 rounded px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent"
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
