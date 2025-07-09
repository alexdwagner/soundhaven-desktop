import { EventEmitter } from 'events';

export class PerformanceMonitor {
  private metrics = {
    initialLoadTimes: [] as number[],
    chunkLoadTimes: [] as number[],
    bufferUnderrunCount: 0,
    cacheHits: 0,
    cacheMisses: 0,
    memoryUsage: [] as number[]
  };

  /**
   * Track initial load time for a track
   */
  public trackInitialLoad(startTime: number): void {
    const loadTime = Date.now() - startTime;
    this.metrics.initialLoadTimes.push(loadTime);
    console.log(`[PERF] Initial load time: ${loadTime}ms`);
  }

  /**
   * Track chunk load time
   */
  public trackChunkLoad(loadTime: number): void {
    this.metrics.chunkLoadTimes.push(loadTime);
    console.log(`[PERF] Chunk load time: ${loadTime}ms`);
  }

  /**
   * Track buffer underrun events
   */
  public trackBufferUnderrun(): void {
    this.metrics.bufferUnderrunCount++;
    console.log(`[PERF] Buffer underrun detected (total: ${this.metrics.bufferUnderrunCount})`);
  }

  /**
   * Track cache access
   */
  public trackCacheAccess(isHit: boolean): void {
    if (isHit) {
      this.metrics.cacheHits++;
    } else {
      this.metrics.cacheMisses++;
    }
    const hitRate = this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses);
    console.log(`[PERF] Cache hit rate: ${(hitRate * 100).toFixed(2)}%`);
  }

  /**
   * Track memory usage
   */
  public trackMemoryUsage(): void {
    const usage = process.memoryUsage();
    this.metrics.memoryUsage.push(usage.heapUsed);
    console.log(`[PERF] Memory usage: ${(usage.heapUsed / 1024 / 1024).toFixed(2)}MB`);
  }

  /**
   * Get performance metrics summary
   */
  public getMetrics(): {
    avgInitialLoadTime: number;
    avgChunkLoadTime: number;
    bufferUnderrunCount: number;
    cacheHitRate: number;
    avgMemoryUsage: number;
  } {
    const avgInitialLoadTime = this.average(this.metrics.initialLoadTimes);
    const avgChunkLoadTime = this.average(this.metrics.chunkLoadTimes);
    const cacheHitRate = this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses);
    const avgMemoryUsage = this.average(this.metrics.memoryUsage);

    return {
      avgInitialLoadTime,
      avgChunkLoadTime,
      bufferUnderrunCount: this.metrics.bufferUnderrunCount,
      cacheHitRate,
      avgMemoryUsage
    };
  }

  /**
   * Reset all metrics
   */
  public resetMetrics(): void {
    this.metrics = {
      initialLoadTimes: [],
      chunkLoadTimes: [],
      bufferUnderrunCount: 0,
      cacheHits: 0,
      cacheMisses: 0,
      memoryUsage: []
    };
  }

  /**
   * Calculate average of an array of numbers
   */
  private average(arr: number[]): number {
    if (arr.length === 0) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }
} 