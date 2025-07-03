// Audio Performance Service
// Handles audio preprocessing, caching, and streaming optimizations

interface AudioPreprocessingConfig {
  enableWaveformCaching: boolean;
  enableAudioStreaming: boolean;
  enableBackgroundProcessing: boolean;
  maxCacheSize: number;
  compressionQuality: number;
}

interface CachedAudioData {
  waveformData: Float32Array;
  duration: number;
  sampleRate: number;
  peaks: number[];
  timestamp: number;
  size: number;
}

interface StreamingConfig {
  chunkSize: number;
  bufferAhead: number;
  maxConcurrentStreams: number;
}

class AudioPerformanceService {
  private waveformCache = new Map<string, CachedAudioData>();
  private audioBufferCache = new Map<string, AudioBuffer>();
  private streamingQueue = new Map<string, Promise<AudioBuffer>>();
  private worker: Worker | null = null;
  private audioContext: AudioContext | null = null;
  
  private config: AudioPreprocessingConfig = {
    enableWaveformCaching: true,
    enableAudioStreaming: true,
    enableBackgroundProcessing: true,
    maxCacheSize: 100 * 1024 * 1024, // 100MB
    compressionQuality: 0.8
  };

  private streamingConfig: StreamingConfig = {
    chunkSize: 64 * 1024, // 64KB chunks
    bufferAhead: 3, // Buffer 3 chunks ahead
    maxConcurrentStreams: 3
  };

  constructor() {
    this.initializeWorker();
    this.initializeAudioContext();
    this.setupCacheCleanup();
  }

  private initializeWorker() {
    if (typeof Worker !== 'undefined' && this.config.enableBackgroundProcessing) {
      try {
        // Create web worker for heavy audio processing
        const workerBlob = new Blob([`
          // Web Worker for audio processing
          let audioContext = null;
          
          self.onmessage = function(e) {
            const { type, data, id } = e.data;
            
            switch (type) {
              case 'INIT_AUDIO_CONTEXT':
                audioContext = new (self.AudioContext || self.webkitAudioContext)();
                self.postMessage({ type: 'AUDIO_CONTEXT_READY', id });
                break;
                
              case 'PROCESS_AUDIO_BUFFER':
                try {
                  const { arrayBuffer, sampleRate } = data;
                  
                  // Decode audio data
                  if (audioContext) {
                    audioContext.decodeAudioData(arrayBuffer)
                      .then(audioBuffer => {
                        // Generate waveform peaks
                        const peaks = generateWaveformPeaks(audioBuffer, 1000);
                        
                        self.postMessage({
                          type: 'AUDIO_PROCESSED',
                          id,
                          data: {
                            duration: audioBuffer.duration,
                            sampleRate: audioBuffer.sampleRate,
                            peaks,
                            channels: audioBuffer.numberOfChannels
                          }
                        });
                      })
                      .catch(error => {
                        self.postMessage({
                          type: 'AUDIO_PROCESS_ERROR',
                          id,
                          error: error.message
                        });
                      });
                  }
                } catch (error) {
                  self.postMessage({
                    type: 'AUDIO_PROCESS_ERROR',
                    id,
                    error: error.message
                  });
                }
                break;
                
              case 'GENERATE_WAVEFORM_PEAKS':
                try {
                  const { audioBuffer, resolution } = data;
                  const peaks = generateWaveformPeaks(audioBuffer, resolution);
                  
                  self.postMessage({
                    type: 'WAVEFORM_PEAKS_GENERATED',
                    id,
                    data: { peaks }
                  });
                } catch (error) {
                  self.postMessage({
                    type: 'WAVEFORM_GENERATION_ERROR',
                    id,
                    error: error.message
                  });
                }
                break;
            }
          };
          
          function generateWaveformPeaks(audioBuffer, resolution = 1000) {
            const peaks = [];
            const channelData = audioBuffer.getChannelData(0);
            const samplesPerPeak = Math.floor(channelData.length / resolution);
            
            for (let i = 0; i < resolution; i++) {
              const start = i * samplesPerPeak;
              const end = Math.min(start + samplesPerPeak, channelData.length);
              
              let peak = 0;
              for (let j = start; j < end; j++) {
                const sample = Math.abs(channelData[j]);
                if (sample > peak) {
                  peak = sample;
                }
              }
              
              peaks.push(peak);
            }
            
            return peaks;
          }
        `], { type: 'application/javascript' });
        
        this.worker = new Worker(URL.createObjectURL(workerBlob));
        this.worker.postMessage({ type: 'INIT_AUDIO_CONTEXT' });
        
        console.log('⚡ AudioPerformanceService: Web Worker initialized');
      } catch (error) {
        console.warn('⚠️ AudioPerformanceService: Web Worker not available:', error);
      }
    }
  }

  private initializeAudioContext() {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      console.log('🎵 AudioPerformanceService: AudioContext initialized');
    } catch (error) {
      console.error('❌ AudioPerformanceService: Failed to initialize AudioContext:', error);
    }
  }

  private setupCacheCleanup() {
    // Clean up cache every 5 minutes
    setInterval(() => {
      this.cleanupCache();
    }, 5 * 60 * 1000);
  }

  private cleanupCache() {
    const now = Date.now();
    const maxAge = 30 * 60 * 1000; // 30 minutes
    let totalSize = 0;
    
    // Calculate total cache size
    this.waveformCache.forEach(data => {
      totalSize += data.size;
    });

    // Remove old entries
    const toDelete: string[] = [];
    this.waveformCache.forEach((data, key) => {
      if (now - data.timestamp > maxAge) {
        toDelete.push(key);
      }
    });

    toDelete.forEach(key => {
      const data = this.waveformCache.get(key);
      if (data) {
        totalSize -= data.size;
        this.waveformCache.delete(key);
      }
    });

    // If still over size limit, remove oldest entries
    if (totalSize > this.config.maxCacheSize) {
      const entries = Array.from(this.waveformCache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      for (const [key, data] of entries) {
        if (totalSize <= this.config.maxCacheSize) break;
        
        totalSize -= data.size;
        this.waveformCache.delete(key);
      }
    }

    console.log(`🧹 AudioPerformanceService: Cache cleaned, size: ${(totalSize / 1024 / 1024).toFixed(2)}MB`);
  }

  async preprocessAudio(url: string, trackId: string): Promise<CachedAudioData | null> {
    try {
      // Check cache first
      const cached = this.waveformCache.get(trackId);
      if (cached) {
        console.log('⚡ AudioPerformanceService: Cache hit for track:', trackId);
        return cached;
      }

      console.log('⚡ AudioPerformanceService: Preprocessing audio:', url);
      
      // Fetch audio data
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      
      if (this.worker && this.config.enableBackgroundProcessing) {
        // Process in web worker
        return new Promise((resolve, reject) => {
          const id = Math.random().toString(36).substring(7);
          
          const handleMessage = (e: MessageEvent) => {
            if (e.data.id === id) {
              this.worker?.removeEventListener('message', handleMessage);
              
              if (e.data.type === 'AUDIO_PROCESSED') {
                const processedData: CachedAudioData = {
                  waveformData: new Float32Array(e.data.data.peaks),
                  duration: e.data.data.duration,
                  sampleRate: e.data.data.sampleRate,
                  peaks: e.data.data.peaks,
                  timestamp: Date.now(),
                  size: e.data.data.peaks.length * 4 // Approximate size
                };
                
                this.waveformCache.set(trackId, processedData);
                resolve(processedData);
              } else if (e.data.type === 'AUDIO_PROCESS_ERROR') {
                reject(new Error(e.data.error));
              }
            }
          };
          
          this.worker?.addEventListener('message', handleMessage);
          this.worker?.postMessage({
            type: 'PROCESS_AUDIO_BUFFER',
            id,
            data: { arrayBuffer, sampleRate: 44100 }
          });
        });
      } else {
        // Process in main thread (fallback)
        return this.processAudioInMainThread(arrayBuffer, trackId);
      }
    } catch (error) {
      console.error('❌ AudioPerformanceService: Error preprocessing audio:', error);
      return null;
    }
  }

  private async processAudioInMainThread(arrayBuffer: ArrayBuffer, trackId: string): Promise<CachedAudioData | null> {
    if (!this.audioContext) {
      console.error('❌ AudioPerformanceService: No AudioContext available');
      return null;
    }

    try {
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      const peaks = this.generateWaveformPeaks(audioBuffer, 1000);
      
      const processedData: CachedAudioData = {
        waveformData: new Float32Array(peaks),
        duration: audioBuffer.duration,
        sampleRate: audioBuffer.sampleRate,
        peaks,
        timestamp: Date.now(),
        size: peaks.length * 4
      };
      
      this.waveformCache.set(trackId, processedData);
      return processedData;
    } catch (error) {
      console.error('❌ AudioPerformanceService: Error processing audio in main thread:', error);
      return null;
    }
  }

  private generateWaveformPeaks(audioBuffer: AudioBuffer, resolution: number = 1000): number[] {
    const peaks: number[] = [];
    const channelData = audioBuffer.getChannelData(0);
    const samplesPerPeak = Math.floor(channelData.length / resolution);
    
    for (let i = 0; i < resolution; i++) {
      const start = i * samplesPerPeak;
      const end = Math.min(start + samplesPerPeak, channelData.length);
      
      let peak = 0;
      for (let j = start; j < end; j++) {
        const sample = Math.abs(channelData[j]);
        if (sample > peak) {
          peak = sample;
        }
      }
      
      peaks.push(peak);
    }
    
    return peaks;
  }

  async optimizeAudioUrl(filePath: string): Promise<string> {
    // Generate optimized audio URL with streaming support
    const fileName = filePath.replace('/uploads/', '');
    const baseUrl = `http://localhost:3000/audio/${fileName}`;
    
    if (this.config.enableAudioStreaming) {
      return `${baseUrl}?stream=true&chunk_size=${this.streamingConfig.chunkSize}`;
    }
    
    return baseUrl;
  }

  async preloadAudio(trackId: string, url: string): Promise<void> {
    if (this.streamingQueue.has(trackId)) {
      return; // Already preloading
    }

    const preloadPromise = this.preprocessAudio(url, trackId);
    this.streamingQueue.set(trackId, preloadPromise as any);
    
    try {
      await preloadPromise;
      console.log('⚡ AudioPerformanceService: Audio preloaded:', trackId);
    } catch (error) {
      console.error('❌ AudioPerformanceService: Error preloading audio:', error);
    } finally {
      this.streamingQueue.delete(trackId);
    }
  }

  getCachedAudioData(trackId: string): CachedAudioData | null {
    return this.waveformCache.get(trackId) || null;
  }

  getPerformanceMetrics() {
    return {
      cacheSize: this.waveformCache.size,
      totalCacheMemory: Array.from(this.waveformCache.values())
        .reduce((total, data) => total + data.size, 0),
      queueSize: this.streamingQueue.size,
      workerAvailable: !!this.worker,
      audioContextState: this.audioContext?.state || 'unavailable'
    };
  }

  updateConfig(newConfig: Partial<AudioPreprocessingConfig>) {
    this.config = { ...this.config, ...newConfig };
    console.log('⚡ AudioPerformanceService: Config updated:', this.config);
  }

  dispose() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
    
    this.waveformCache.clear();
    this.audioBufferCache.clear();
    this.streamingQueue.clear();
    
    console.log('🧹 AudioPerformanceService: Disposed');
  }
}

// Singleton instance
export const audioPerformanceService = new AudioPerformanceService();
export default audioPerformanceService; 