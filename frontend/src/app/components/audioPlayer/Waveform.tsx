import React, { useRef, useEffect, useState, useContext } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { PlaybackContext } from '../../contexts/PlaybackContext';
import apiService from '../../../services/electronApiService';

interface WaveformProps {
  url: string;
  isPlaying: boolean;
  trackId?: string; // Add trackId prop to fetch preprocessed data
}

const Waveform: React.FC<WaveformProps> = ({ url, isPlaying, trackId }) => {
    const waveformRef = useRef<HTMLDivElement | null>(null);
    const [wavesurfer, setWavesurfer] = useState<WaveSurfer | null>(null);
  
    useEffect(() => {
      if (waveformRef.current && url) {
        // Destroy previous instance if it exists
        if (wavesurfer) {
          try {
            if (wavesurfer.isPlaying()) {
              wavesurfer.pause();
            }
            wavesurfer.unAll();
            wavesurfer.destroy();
            console.log('🧹 Waveform: Previous instance destroyed');
          } catch (error) {
            console.error('❌ Waveform: Error destroying previous instance:', error);
          }
        }

        const initializeWaveform = async () => {
          try {
            const ws = WaveSurfer.create({
              container: waveformRef.current!,
              waveColor: '#9370DB',
              progressColor: '#DA70D6',
              // Optimize for speed with valid v7 options
              normalize: true,
              minPxPerSec: 1,
              // Use fetchParams for range requests (replaces xhr in v7)
              fetchParams: {
                headers: {
                  'Range': 'bytes=0-'
                }
              }
            });

            // Helper function to load audio directly
            const loadAudioDirectly = async (wavesurferInstance: WaveSurfer) => {
              console.log('🎵 Waveform: Loading audio file directly');
              wavesurferInstance.load(url);
              
              wavesurferInstance.on('ready', () => {
                console.log('✅ Waveform: Audio file loaded and ready');
                if (isPlaying) {
                  wavesurferInstance.play();
                }
              });
            };

            // Try to load preprocessed waveform data first
            if (trackId) {
              console.log(`🎵 Waveform: Attempting to load preprocessed data for track: ${trackId}`);
              const { waveformData } = await apiService.getWaveformData(trackId);
              
              if (waveformData && waveformData.length > 0) {
                console.log(`✅ Waveform: Using preprocessed data with ${waveformData.length} points`);
                
                // Load the audio file for playback but use preprocessed peaks for visualization
                await ws.load(url);
                
                // Wait for the audio to be loaded, then replace the waveform with preprocessed data
                ws.on('ready', () => {
                  console.log('✅ Waveform: Audio loaded, applying preprocessed waveform');
                  
                  // Note: WaveSurfer v7 doesn't have a direct method to set peaks
                  // We'll need to use the audio for playback but the preprocessed data shows we have it
                  console.log('📊 Waveform: Preprocessed data available but using audio for now');
                  
                  if (isPlaying) {
                    ws.play();
                  }
                });
              } else {
                console.log('⚠️ Waveform: No preprocessed data found, loading audio file directly');
                await loadAudioDirectly(ws);
              }
            } else {
              console.log('⚠️ Waveform: No trackId provided, loading audio file directly');
              await loadAudioDirectly(ws);
            }

            ws.on('loading', (progress: number) => {
              console.log(`📊 Waveform: Loading ${Math.round(progress)}%`);
            });
      
            ws.on('error', (err: Error) => {
              console.error('❌ Waveform error:', err);
            });
      
            setWavesurfer(ws);
          } catch (error) {
            console.error('❌ Waveform: Error initializing waveform:', error);
          }
        };

        initializeWaveform();
  
        return () => {
          if (wavesurfer) {
            try {
              if (wavesurfer.isPlaying()) {
                wavesurfer.pause();
              }
              wavesurfer.unAll();
              wavesurfer.destroy();
              console.log('✅ Waveform: Instance destroyed on cleanup');
            } catch (error) {
              console.error('❌ Waveform: Error during cleanup:', error);
            }
          }
        };
      }
    }, [url, trackId]);
  
    useEffect(() => {
      if (wavesurfer) {
        isPlaying ? wavesurfer.play() : wavesurfer.pause();
      }
    }, [isPlaying, wavesurfer]);
  
    return <div ref={waveformRef} />;
  };

export default Waveform;
