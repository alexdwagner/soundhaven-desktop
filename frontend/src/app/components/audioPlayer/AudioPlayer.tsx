import React, { useCallback, useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import type { WaveSurfer as WaveSurferType } from 'wavesurfer.js';
import type { Region } from 'wavesurfer.js/dist/plugins/regions';
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions";

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
}) => {
  const waveformRef = useRef<HTMLDivElement>(null);
  const waveSurferRef = useRef<WaveSurferWithRegions | null>(null);
  const regionsRef = useRef<any>(null);
  const [isReady, setIsReady] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Initialize WaveSurfer
  useEffect(() => {
    console.log('AudioPlayer: Initializing WaveSurfer with track:', track);
    console.log('AudioPlayer: filePath:', track?.filePath);
    
    if (!waveformRef.current || !track?.filePath) {
      console.log('AudioPlayer: Missing waveformRef or filePath, returning early');
      return;
    }

    console.log('AudioPlayer: Creating WaveSurfer instance...');
    const ws = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: '#4a5568',
      progressColor: '#4299e1',
      cursorColor: '#4299e1',
      barWidth: 2,
      barRadius: 3,
      cursorWidth: 2,
      height: 100,
      barGap: 2,
      normalize: true,
      url: track.filePath,
      // Initialize with regions plugin
      plugins: [
        // @ts-ignore - The create method exists on the plugin
        RegionsPlugin.create()
      ]
    }) as WaveSurferWithRegions;

    console.log('AudioPlayer: WaveSurfer instance created, setting up event listeners...');

    // Get the regions plugin from the instance (optional)
    // @ts-ignore - The regions plugin is added to the instance
    if (ws.regions) {
      regionsRef.current = ws.regions;
      console.log('Regions plugin initialized successfully');
    } else {
      console.log('Regions plugin not available, continuing without regions');
    }

    // Set up event listeners
    ws.on('ready', () => {
      console.log('AudioPlayer: WaveSurfer is ready!');
      waveSurferRef.current = ws;
      setDuration(ws.getDuration());
      setIsReady(true);
      
      // Set initial volume and playback rate
      ws.setVolume(volume);
      ws.setPlaybackRate(playbackSpeed);

      // Set up region events after WaveSurfer is ready
      if (regionsRef.current) {
        // @ts-ignore - The events exist on the regions plugin
        regionsRef.current.on('region-created', (region: Region) => {
          // Handle region created
          console.log('Region created:', region);
        });

        // @ts-ignore - The events exist on the regions plugin
        regionsRef.current.on('region-clicked', (region: Region, e: MouseEvent) => {
          // Handle region click
          e.stopPropagation();
          console.log('Region clicked:', region);
        });
      }
    });

    ws.on('error', (error) => {
      console.error('AudioPlayer: WaveSurfer error:', error);
    });

    ws.on('audioprocess', () => {
      if (ws.isPlaying()) {
        const currentTime = ws.getCurrentTime();
        setCurrentTime(currentTime);
        onSeek(currentTime);
      }
    });

    ws.on('seek', (time: number) => {
      setCurrentTime(time);
      onSeek(time);
    });

    // Cleanup
    return () => {
      console.log('AudioPlayer: Cleaning up WaveSurfer instance');
      if (ws) {
        ws.destroy();
      }
    };
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

  // Add regions for markers
  useEffect(() => {
    if (!waveSurferRef.current || !track?.markers?.length) return;

    // Clear existing regions
    if (waveSurferRef.current.regions) {
      waveSurferRef.current.regions.clearRegions();
    }

    // Add new regions for each marker
    track.markers.forEach((marker) => {
      if (waveSurferRef.current?.regions) {
        waveSurferRef.current.regions.addRegion({
          id: marker.id,
          start: marker.time,
          end: marker.time + 0.5, // Small region for marker
          color: marker.color || 'rgba(255, 165, 0, 0.5)',
          drag: false,
          resize: false,
          data: {
            commentId: marker.commentId,
          },
        });
      }
    });
  }, [track?.markers]);

  if (!track) {
    return (
      <div className="flex items-center justify-center h-32 bg-gray-100 rounded-lg">
        <p>No track selected</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-4">
      {/* Track info */}
      <div className="p-4 bg-white rounded-lg shadow">
        <h2 className="text-xl font-bold">{track.name}</h2>
        <p className="text-gray-600">{track.artist?.name}</p>
      </div>

      {/* Waveform */}
      <div 
        ref={waveformRef} 
        className="w-full h-32 bg-gray-100 rounded-lg overflow-hidden cursor-pointer"
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
      <div className="p-4 bg-white rounded-lg shadow">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-600">
            {formatTime(currentTime)}
          </span>
          <span className="text-sm text-gray-600">
            {formatTime(duration)}
          </span>
        </div>

        <div className="flex items-center justify-center space-x-4">
          <button
            onClick={onPrevious}
            className="p-2 text-gray-700 hover:text-blue-600"
            aria-label="Previous track"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.333 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" />
            </svg>
          </button>
          
          <button
            onClick={onPlayPause}
            className="p-4 text-white bg-blue-600 rounded-full hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </button>
          
          <button
            onClick={onNext}
            className="p-2 text-gray-700 hover:text-blue-600"
            aria-label="Next track"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.934 12.8a1 1 0 000-1.6L6.6 7.2A1 1 0 005 8v8a1 1 0 001.6.8l5.333-4zM19.934 12.8a1 1 0 000-1.6l-5.333-4A1 1 0 0013 8v8a1 1 0 001.6.8l5.334-4z" />
            </svg>
          </button>
        </div>

        {/* Volume and speed controls */}
        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center space-x-2">
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            </svg>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
              className="w-24 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
          </div>
          
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">Speed:</span>
            <select
              value={playbackSpeed}
              onChange={(e) => onPlaybackSpeedChange(parseFloat(e.target.value))}
              className="text-sm border rounded p-1"
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
