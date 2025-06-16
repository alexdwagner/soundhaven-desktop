import React, { useCallback, useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions";

// Types
interface Marker {
  id: string;
  time: number;
  commentId: string;
  color?: string;
}

interface Track {
  id: string;
  title: string;
  artist: string;
  filePath: string;
  duration: number;
  markers?: Marker[];
}

interface WaveSurferRegion {
  id: string;
  start: number;
  end: number;
  data?: {
    commentId: string;
    color?: string;
  };
  remove: () => void;
  update: (options: WaveSurferRegionParams) => void;
  on: (event: string, callback: (region: WaveSurferRegion) => void) => void;
  off: (event: string, callback: (region: WaveSurferRegion) => void) => void;
}

interface WaveSurferRegionParams {
  id?: string;
  start: number;
  end: number;
  color?: string;
  drag?: boolean;
  resize?: boolean;
  data?: {
    commentId: string;
    color?: string;
  };
}

interface WaveSurferWithRegions extends WaveSurfer {
  regions: {
    list: Record<string, WaveSurferRegion>;
    add: (options: WaveSurferRegionParams) => WaveSurferRegion;
    clearRegions: () => void;
  };
}

// Extend WaveSurfer types
declare module 'wavesurfer.js' {
  interface WaveSurfer {
    regions?: {
      list: Record<string, WaveSurferRegion>;
      add: (options: WaveSurferRegionParams) => WaveSurferRegion;
      clearRegions: () => void;
    };
  }
}

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
  volume,
  playbackSpeed,
}) => {
  const waveformRef = useRef<HTMLDivElement>(null);
  const waveSurferRef = useRef<WaveSurferWithRegions | null>(null);
  const regionsRef = useRef<RegionsPlugin | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Initialize WaveSurfer
  useEffect(() => {
    if (!waveformRef.current || !track?.filePath) return;

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
      partialRender: true,
      url: track.filePath,
    }) as WaveSurferWithRegions;

    // Initialize regions plugin
    const regions = ws.registerPlugin(RegionsPlugin.create()) as unknown as RegionsPlugin;
    regionsRef.current = regions;

    // Set up event listeners
    ws.on('ready', () => {
      waveSurferRef.current = ws;
      setDuration(ws.getDuration());
      setIsReady(true);
      
      // Set initial volume and playback rate
      ws.setVolume(volume);
      ws.setPlaybackRate(playbackSpeed);
    });

    ws.on('audioprocess', () => {
      if (ws.isPlaying()) {
        setCurrentTime(ws.getCurrentTime());
      }
    });

    ws.on('seek', () => {
      setCurrentTime(ws.getCurrentTime());
    });

    // Cleanup
    return () => {
      if (ws) {
        ws.destroy();
      }
    };
  }, [track?.filePath, volume, playbackSpeed]);

  // Handle play/pause
  useEffect(() => {
    if (!waveSurferRef.current || !isReady) return;

    if (isPlaying) {
      waveSurferRef.current.play();
    } else {
      waveSurferRef.current.pause();
    }
  }, [isPlaying, isReady]);

  // Handle seek
  const handleSeek = useCallback((time: number) => {
    if (waveSurferRef.current) {
      waveSurferRef.current.seekTo(time);
      setCurrentTime(time * (duration || 1));
    }
  }, [duration]);

  // Handle volume change
  useEffect(() => {
    if (waveSurferRef.current) {
      waveSurferRef.current.setVolume(volume);
    }
  }, [volume]);

  // Handle playback speed change
  useEffect(() => {
    if (waveSurferRef.current) {
      waveSurferRef.current.setPlaybackRate(playbackSpeed);
    }
  }, [playbackSpeed]);

  // Add regions for markers
  useEffect(() => {
    if (!regionsRef.current || !track?.markers?.length) return;

    // Clear existing regions
    regionsRef.current.clearRegions();

    // Add new regions for each marker
    track.markers.forEach((marker) => {
      regionsRef.current?.addRegion({
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
        <h2 className="text-xl font-bold">{track.title}</h2>
        <p className="text-gray-600">{track.artist}</p>
      </div>

      {/* Waveform */}
      <div 
        ref={waveformRef} 
        className="w-full h-32 bg-gray-100 rounded-lg overflow-hidden"
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
