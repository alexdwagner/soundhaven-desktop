import React, { useCallback, useEffect, useRef, useState, useMemo } from "react";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.js";
import { useComments } from "@/app/hooks/useComments";

// Performance optimizations cache
const waveformCache = new Map<string, {
  waveform: ArrayBuffer;
  duration: number;
  timestamp: number;
}>();

const audioUrlCache = new Map<string, string>();

// Cache cleanup interval (clean cache every 5 minutes)
const CACHE_CLEANUP_INTERVAL = 5 * 60 * 1000;
const CACHE_MAX_AGE = 30 * 60 * 1000; // 30 minutes
const CACHE_MAX_SIZE = 50; // Maximum cached waveforms

// Performance monitoring
const performanceMetrics = {
  trackSwitches: 0,
  cacheHits: 0,
  cacheMisses: 0,
  averageLoadTime: 0,
  loadTimes: [] as number[]
};

// Optimized types
interface OptimizedTrack {
  id: string;
  filePath: string;
  name: string;
  duration?: number;
}

interface AudioPlayerPerformanceProps {
  track: OptimizedTrack | null;
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
  debugMode?: boolean;
}

// Utility functions
const logger = {
  log: (message: string, ...args: any[]) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`🎵 [AudioPlayer]: ${message}`, ...args);
    }
  },
  error: (message: string, ...args: any[]) => {
    console.error(`❌ [AudioPlayer]: ${message}`, ...args);
  },
  perf: (message: string, ...args: any[]) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`⚡ [Performance]: ${message}`, ...args);
    }
  }
};

// Cache management
const cleanupCache = () => {
  const now = Date.now();
  const keysToDelete: string[] = [];
  
  waveformCache.forEach((value, key) => {
    if (now - value.timestamp > CACHE_MAX_AGE) {
      keysToDelete.push(key);
    }
  });
  
  keysToDelete.forEach(key => waveformCache.delete(key));
  
  // If still over size limit, remove oldest entries
  if (waveformCache.size > CACHE_MAX_SIZE) {
    const sortedEntries = Array.from(waveformCache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    const toRemove = sortedEntries.slice(0, waveformCache.size - CACHE_MAX_SIZE);
    toRemove.forEach(([key]) => waveformCache.delete(key));
  }
  
  logger.perf(`Cache cleaned: ${keysToDelete.length} expired entries removed`);
};

// Set up cache cleanup interval
setInterval(cleanupCache, CACHE_CLEANUP_INTERVAL);

const AudioPlayerPerformance: React.FC<AudioPlayerPerformanceProps> = ({
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
  debugMode = false
}) => {
  const waveformRef = useRef<HTMLDivElement>(null);
  const waveSurferRef = useRef<WaveSurfer | null>(null);
  const regionsRef = useRef<any>(null);
  const currentTrackRef = useRef<string | null>(null);
  const loadingTimeRef = useRef<number>(0);
  
  const [isReady, setIsReady] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);

  // Performance-optimized file URL generation
  const getOptimizedFileUrl = useCallback(async (filePath: string): Promise<string> => {
    // Check cache first
    const cached = audioUrlCache.get(filePath);
    if (cached) {
      logger.perf('Audio URL cache hit');
      return cached;
    }

    // Generate optimized URL
    const fileName = filePath.replace('/uploads/', '');
    const audioServerUrl = `http://localhost:3000/audio/${fileName}`;
    
    // Cache the result
    audioUrlCache.set(filePath, audioServerUrl);
    
    logger.perf('Audio URL generated and cached');
    return audioServerUrl;
  }, []);

  // Optimized WaveSurfer initialization with caching
  const initializeWaveSurfer = useCallback(async (trackToLoad: OptimizedTrack) => {
    if (!waveformRef.current) {
      logger.error('No waveform container available');
      return;
    }

    const startTime = performance.now();
    loadingTimeRef.current = startTime;
    setIsLoading(true);
    setLoadingProgress(0);

    try {
      // Check if we can reuse existing instance
      if (waveSurferRef.current && currentTrackRef.current === trackToLoad.id) {
        logger.perf('Reusing existing WaveSurfer instance');
        setIsLoading(false);
        return;
      }

      // Destroy previous instance only if necessary
      if (waveSurferRef.current) {
        logger.log('Destroying previous WaveSurfer instance');
        try {
          waveSurferRef.current.destroy();
        } catch (error) {
          logger.error('Error destroying previous instance:', error);
        }
        waveSurferRef.current = null;
      }

      // Check waveform cache
      const cacheKey = `${trackToLoad.id}-${trackToLoad.filePath}`;
      const cachedWaveform = waveformCache.get(cacheKey);
      
      if (cachedWaveform) {
        logger.perf('Waveform cache hit');
        performanceMetrics.cacheHits++;
        setDuration(cachedWaveform.duration);
      } else {
        logger.perf('Waveform cache miss');
        performanceMetrics.cacheMisses++;
      }

      // Create optimized WaveSurfer configuration
      const config = {
        container: waveformRef.current,
        waveColor: '#4F46E5',
        progressColor: '#7C3AED',
        cursorColor: '#1F2937',
        barWidth: 1, // Reduced for performance
        barRadius: 1,
        cursorWidth: 1,
        height: 128,
        barGap: 1, // Reduced for performance
        responsive: true,
        normalize: true,
        backend: 'WebAudio',
        // Performance optimizations
        partialRender: true,
        fillParent: false,
        scrollParent: false,
        hideScrollbar: true,
        pixelRatio: Math.min(window.devicePixelRatio, 2), // Limit pixel ratio for performance
        plugins: [
          RegionsPlugin.create({
            dragSelection: {
              slop: 5
            }
          })
        ]
      };

      logger.log('Creating optimized WaveSurfer instance');
      const wavesurfer = WaveSurfer.create(config);
      waveSurferRef.current = wavesurfer;
      currentTrackRef.current = trackToLoad.id;

      // Set up regions plugin
      regionsRef.current = wavesurfer.registerPlugin(RegionsPlugin.create());

      // Optimized event listeners
      wavesurfer.on('ready', () => {
        const endTime = performance.now();
        const loadTime = endTime - startTime;
        
        logger.perf(`WaveSurfer ready in ${loadTime.toFixed(2)}ms`);
        
        // Update performance metrics
        performanceMetrics.loadTimes.push(loadTime);
        if (performanceMetrics.loadTimes.length > 10) {
          performanceMetrics.loadTimes.shift();
        }
        performanceMetrics.averageLoadTime = 
          performanceMetrics.loadTimes.reduce((a, b) => a + b, 0) / performanceMetrics.loadTimes.length;

        setIsReady(true);
        setIsLoading(false);
        setLoadingProgress(100);
        
        const actualDuration = wavesurfer.getDuration();
        setDuration(actualDuration);
        
        // Cache the waveform data
        if (!cachedWaveform) {
          waveformCache.set(cacheKey, {
            waveform: new ArrayBuffer(0), // Placeholder - in real implementation would cache actual waveform data
            duration: actualDuration,
            timestamp: Date.now()
          });
          logger.perf('Waveform cached');
        }
      });

      wavesurfer.on('loading', (progress: number) => {
        setLoadingProgress(progress);
      });

      wavesurfer.on('timeupdate', (time: number) => {
        setCurrentTime(time);
      });

      wavesurfer.on('play', () => {
        logger.log('Playback started');
      });

      wavesurfer.on('pause', () => {
        logger.log('Playback paused');
      });

      wavesurfer.on('finish', () => {
        logger.log('Playback finished');
        onNext();
      });

      wavesurfer.on('error', (error: any) => {
        logger.error('WaveSurfer error:', error);
        setIsLoading(false);
      });

      // Load audio with optimized URL
      const fileUrl = await getOptimizedFileUrl(trackToLoad.filePath);
      logger.log('Loading audio file:', fileUrl);
      
      await wavesurfer.load(fileUrl);
      
      performanceMetrics.trackSwitches++;
      
    } catch (error) {
      logger.error('Failed to initialize WaveSurfer:', error);
      setIsLoading(false);
    }
  }, [getOptimizedFileUrl, onNext]);

  // Optimized track change handling
  useEffect(() => {
    if (!track) {
      if (waveSurferRef.current) {
        waveSurferRef.current.pause();
      }
      setIsReady(false);
      setCurrentTime(0);
      setDuration(0);
      currentTrackRef.current = null;
      return;
    }

    // Only reinitialize if track actually changed
    if (currentTrackRef.current !== track.id) {
      logger.log('Track changed, initializing WaveSurfer');
      initializeWaveSurfer(track);
    }
  }, [track?.id, track?.filePath, initializeWaveSurfer]);

  // Optimized play/pause handling
  useEffect(() => {
    if (!waveSurferRef.current || !isReady) return;

    try {
      if (isPlaying) {
        waveSurferRef.current.play();
      } else {
        waveSurferRef.current.pause();
      }
    } catch (error) {
      logger.error('Error during play/pause:', error);
    }
  }, [isPlaying, isReady]);

  // Optimized volume and speed handling
  useEffect(() => {
    if (!waveSurferRef.current || !isReady) return;
    
    try {
      waveSurferRef.current.setVolume(volume / 100);
    } catch (error) {
      logger.error('Error setting volume:', error);
    }
  }, [volume, isReady]);

  useEffect(() => {
    if (!waveSurferRef.current || !isReady) return;
    
    try {
      waveSurferRef.current.setPlaybackRate(playbackSpeed);
    } catch (error) {
      logger.error('Error setting playback speed:', error);
    }
  }, [playbackSpeed, isReady]);

  // Optimized seek handling
  const handleSeek = useCallback((time: number) => {
    if (!waveSurferRef.current || !isReady) return;
    
    try {
      waveSurferRef.current.seekTo(time / duration);
    } catch (error) {
      logger.error('Error seeking:', error);
    }
  }, [duration, isReady]);

  // Performance monitoring (development only)
  useEffect(() => {
    if (debugMode && process.env.NODE_ENV === 'development') {
      const interval = setInterval(() => {
        logger.perf('Performance metrics:', {
          trackSwitches: performanceMetrics.trackSwitches,
          cacheHits: performanceMetrics.cacheHits,
          cacheMisses: performanceMetrics.cacheMisses,
          cacheHitRate: (performanceMetrics.cacheHits / (performanceMetrics.cacheHits + performanceMetrics.cacheMisses) * 100).toFixed(1) + '%',
          averageLoadTime: performanceMetrics.averageLoadTime.toFixed(2) + 'ms',
          cacheSize: waveformCache.size
        });
      }, 10000);

      return () => clearInterval(interval);
    }
  }, [debugMode]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (waveSurferRef.current) {
        try {
          waveSurferRef.current.destroy();
        } catch (error) {
          logger.error('Error destroying WaveSurfer on cleanup:', error);
        }
      }
    };
  }, []);

  // Memoized loading indicator
  const loadingIndicator = useMemo(() => {
    if (!isLoading) return null;
    
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 rounded">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-sm text-gray-600">Loading audio... {loadingProgress}%</p>
        </div>
      </div>
    );
  }, [isLoading, loadingProgress]);

  // Memoized controls
  const transportControls = useMemo(() => (
    <div className="flex items-center justify-center space-x-4 p-4 bg-gray-50 rounded-lg">
      <button
        onClick={onPrevious}
        className="p-2 rounded-full bg-white shadow hover:shadow-md transition-shadow"
        disabled={!isReady}
      >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M15.707 15.707a1 1 0 01-1.414 0l-5-5a1 1 0 010-1.414l5-5a1 1 0 111.414 1.414L11.414 9H17a1 1 0 110 2h-5.586l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
        </svg>
      </button>
      
      <button
        onClick={onPlayPause}
        className="p-3 rounded-full bg-blue-500 text-white shadow hover:shadow-md transition-shadow"
        disabled={!isReady || isLoading}
      >
        {isPlaying ? (
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
          </svg>
        )}
      </button>
      
      <button
        onClick={onNext}
        className="p-2 rounded-full bg-white shadow hover:shadow-md transition-shadow"
        disabled={!isReady}
      >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414-1.414L8.586 11H3a1 1 0 110-2h5.586L4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>
    </div>
  ), [onPrevious, onPlayPause, onNext, isReady, isLoading, isPlaying]);

  if (!track) {
    return (
      <div className="flex items-center justify-center h-32 bg-gray-100 rounded-lg">
        <p className="text-gray-600">No track selected</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Track Info */}
      <div className="p-4 bg-white rounded-lg shadow">
        <h3 className="font-semibold text-lg">{track.name}</h3>
        <div className="flex justify-between text-sm text-gray-600 mt-1">
          <span>{Math.floor(currentTime)}s</span>
          <span>{Math.floor(duration)}s</span>
        </div>
      </div>

      {/* Waveform Container */}
      <div className="relative">
        <div 
          ref={waveformRef} 
          className="w-full h-32 bg-white rounded-lg border border-gray-200 overflow-hidden cursor-pointer"
          onDoubleClick={(e) => {
            if (!waveSurferRef.current || !isReady) return;
            
            const rect = e.currentTarget.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const clickPercent = clickX / rect.width;
            const clickTime = clickPercent * duration;
            
            onAddComment(clickTime);
          }}
        />
        {loadingIndicator}
      </div>

      {/* Controls */}
      {transportControls}
      
      {/* Performance Debug Info */}
      {debugMode && process.env.NODE_ENV === 'development' && (
        <div className="p-2 bg-gray-100 rounded text-xs">
          <p>Cache: {performanceMetrics.cacheHits}H / {performanceMetrics.cacheMisses}M</p>
          <p>Avg Load: {performanceMetrics.averageLoadTime.toFixed(1)}ms</p>
          <p>Switches: {performanceMetrics.trackSwitches}</p>
        </div>
      )}
    </div>
  );
};

export default AudioPlayerPerformance; 