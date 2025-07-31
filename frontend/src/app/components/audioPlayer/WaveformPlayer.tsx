"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { Track } from "../../../../../shared/types";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.js";

interface WaveformPlayerProps {
  track: Track | null;
  isPlaying: boolean;
  onSeek: (time: number) => void;
  onAddComment: (time: number) => void;
  onTimeUpdate?: (time: number) => void;
  onDurationChange?: (duration: number) => void;
  waveSurferRef?: React.MutableRefObject<WaveSurfer | null>;
  regionsRef?: React.MutableRefObject<any>;
}

const WaveformPlayer: React.FC<WaveformPlayerProps> = ({
  track,
  isPlaying,
  onSeek,
  onAddComment,
  onTimeUpdate,
  onDurationChange,
  waveSurferRef: externalWaveSurferRef,
  regionsRef: externalRegionsRef,
}) => {
  const waveformRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string>('');

  // Internal refs if external ones aren't provided
  const internalWaveSurferRef = useRef<WaveSurfer | null>(null);
  const internalRegionsRef = useRef<any>(null);
  
  const waveSurferRef = externalWaveSurferRef || internalWaveSurferRef;
  const regionsRef = externalRegionsRef || internalRegionsRef;

  // Get file URL function
  const getFileUrl = useCallback(async (filePath: string): Promise<string> => {
    try {
      // Detect environment
      const isElectron = typeof window !== 'undefined' && !!window.electron?.ipcRenderer;
      
      if (isElectron) {
        // Desktop: Use Electron audio server
        const fileName = filePath.replace('/uploads/', '');
        const audioServerUrl = `http://localhost:3002/audio/${fileName}`;
        console.log('🎵 WaveformPlayer: Using Electron audio server URL:', audioServerUrl);
        return audioServerUrl;
      } else {
        // Mobile: Use Next.js API streaming
        const response = await fetch('/api/tracks');
        const tracks = await response.json();
        const trackData = tracks.find((t: any) => t.filePath === filePath);
        
        if (trackData) {
          const streamingUrl = `/api/audio/${trackData.id}`;
          console.log('🎵 WaveformPlayer: Using Next.js API streaming URL for mobile:', {
            trackId: trackData.id,
            streamingUrl,
            note: 'Using Next.js /api/audio/[trackId] endpoint'
          });
          return streamingUrl;
        } else {
          throw new Error('Track not found in database');
        }
      }
    } catch (error) {
      console.error('❌ WaveformPlayer: Error getting file URL:', error);
      throw error;
    }
  }, []);

  // Set audio URL when track changes
  useEffect(() => {
    if (!track?.filePath) {
      setAudioUrl('');
      return;
    }

    const getAudioUrl = async () => {
      try {
        const audioServerUrl = await getFileUrl(track.filePath);
        console.log('🎵 WaveformPlayer: Setting audioUrl via getFileUrl:', audioServerUrl);
        setAudioUrl(audioServerUrl);
      } catch (error) {
        console.error('❌ WaveformPlayer: Error getting audio URL:', error);
      }
    };
    
    getAudioUrl();
  }, [track?.filePath, getFileUrl]);

  // Initialize WaveSurfer
  useEffect(() => {
    if (!audioUrl || !waveformRef.current) return;

    const initializeWaveSurfer = async () => {
      try {
        console.log('🎵 WaveformPlayer: Initializing WaveSurfer with URL:', audioUrl);
        
        // Destroy existing instance
        if (waveSurferRef.current) {
          waveSurferRef.current.destroy();
        }

        // Create new WaveSurfer instance
        const wavesurfer = WaveSurfer.create({
          container: waveformRef.current,
          waveColor: '#4B5563',
          progressColor: '#3B82F6',
          cursorColor: '#1F2937',
          barWidth: 2,
          barRadius: 3,
          cursorWidth: 1,
          height: 128,
          barGap: 1,
          responsive: true,
          normalize: true,
          backend: 'WebAudio',
          plugins: [RegionsPlugin.create()]
        });

        waveSurferRef.current = wavesurfer;
        regionsRef.current = wavesurfer;

        // Load audio
        await wavesurfer.load(audioUrl);
        
        // Set up event listeners
        wavesurfer.on('ready', () => {
          console.log('🎵 WaveformPlayer: WaveSurfer ready event - audio can play immediately');
          setIsReady(true);
          const duration = wavesurfer.getDuration();
          setDuration(duration);
          onDurationChange?.(duration);
        });

        wavesurfer.on('audioprocess', () => {
          const time = wavesurfer.getCurrentTime();
          setCurrentTime(time);
          onTimeUpdate?.(time);
        });

        wavesurfer.on('seek', (progress) => {
          const time = progress * wavesurfer.getDuration();
          setCurrentTime(time);
          onSeek(time);
        });

        // Set up regions for comments
        if (track?.markers && track.markers.length > 0) {
          console.log('🎯 WaveformPlayer: Setting up regions for markers:', track.markers.length);
          track.markers.forEach((marker) => {
            const region = wavesurfer.addRegion({
              start: marker.time,
              end: marker.time + 5, // 5 second region
              color: marker.color || 'rgba(59, 130, 246, 0.3)',
              drag: false,
              resize: false,
              data: { commentId: marker.commentId }
            });

            region.on('click', () => {
              console.log('🎯 WaveformPlayer: Region clicked:', marker.commentId);
              // Handle region click if needed
            });
          });
        } else {
          console.log('🎯 WaveformPlayer: No markers or empty markers array, clearing regions');
          if (wavesurfer.regions) {
            wavesurfer.regions.clearRegions();
          }
        }

        console.log('🎵 WaveformPlayer: WaveSurfer initialization completed successfully');
      } catch (error) {
        console.error('❌ WaveformPlayer: Error initializing WaveSurfer:', error);
      }
    };

    initializeWaveSurfer();

    // Cleanup
    return () => {
      if (waveSurferRef.current) {
        try {
          waveSurferRef.current.destroy();
        } catch (destroyError) {
          console.error('❌ WaveformPlayer: Error destroying WaveSurfer instance on unmount:', destroyError);
        }
      }
    };
  }, [audioUrl, track?.markers, onSeek]);

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
  useEffect(() => {
    if (!waveSurferRef.current || !isReady) return;
    
    const currentWaveSurferTime = waveSurferRef.current.getCurrentTime();
    if (Math.abs(currentWaveSurferTime - currentTime) > 0.1) {
      waveSurferRef.current.setTime(currentTime);
    }
  }, [currentTime, isReady]);

  return (
    <div className="w-full">
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
    </div>
  );
};

export default WaveformPlayer; 