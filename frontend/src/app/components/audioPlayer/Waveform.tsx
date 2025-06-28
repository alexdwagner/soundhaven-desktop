import React, { useRef, useEffect, useState, useContext } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { PlaybackContext } from '@/contexts/PlaybackContext';

interface WaveformProps {
  url: string;
  isPlaying: boolean;
}

const Waveform: React.FC<WaveformProps> = ({ url, isPlaying }) => {
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

        const ws = WaveSurfer.create({
          container: waveformRef.current,
          waveColor: '#9370DB',
          progressColor: '#DA70D6',
        });
  
        ws.load(url);
        ws.on('ready', () => {
          if (isPlaying) {
            ws.play();
          }
        });
  
        ws.on('error', (err: Error) => {
          console.error('Waveform error:', err);
        });
  
        setWavesurfer(ws);
  
        return () => {
          try {
            if (ws.isPlaying()) {
              ws.pause();
            }
            ws.unAll();
            ws.destroy();
            console.log('✅ Waveform: Instance destroyed on cleanup');
          } catch (error) {
            console.error('❌ Waveform: Error during cleanup:', error);
          }
        };
      }
    }, [url]);
  
    useEffect(() => {
      if (wavesurfer) {
        isPlaying ? wavesurfer.play() : wavesurfer.pause();
      }
    }, [isPlaying, wavesurfer]);
  
    return <div ref={waveformRef} />;
  };

export default Waveform;
