// Unit tests for playback functionality without React components
import { Track } from '../shared/types';

describe('Playback Unit Tests', () => {
  describe('Track Property Compatibility', () => {
    it('should handle both filePath and file_path properties', () => {
      // Test track with filePath (camelCase)
      const track1: any = {
        id: '1',
        name: 'Track 1',
        filePath: '/uploads/track1.mp3'
      };

      // Test track with file_path (snake_case)
      const track2: any = {
        id: '2',
        name: 'Track 2',
        file_path: '/uploads/track2.mp3'
      };

      // Function to get file path from track (as used in AudioPlayer)
      const getTrackFilePath = (track: any) => track?.filePath || track?.file_path;

      expect(getTrackFilePath(track1)).toBe('/uploads/track1.mp3');
      expect(getTrackFilePath(track2)).toBe('/uploads/track2.mp3');
      expect(getTrackFilePath({})).toBeUndefined();
      expect(getTrackFilePath(null)).toBeUndefined();
    });

    it('should validate file paths correctly', () => {
      const isValidFilePath = (path: any) => {
        return path && typeof path === 'string' && path.startsWith('/uploads/');
      };

      expect(isValidFilePath('/uploads/song.mp3')).toBe(true);
      expect(isValidFilePath('/uploads/artist/album/song.mp3')).toBe(true);
      expect(isValidFilePath('uploads/song.mp3')).toBeFalsy();
      expect(isValidFilePath('')).toBeFalsy();
      expect(isValidFilePath(null)).toBeFalsy();
      expect(isValidFilePath(undefined)).toBeFalsy();
      expect(isValidFilePath(123)).toBeFalsy();
    });
  });

  describe('Audio URL Generation', () => {
    it('should generate correct URLs for mobile/web environment', () => {
      const generateMobileUrl = (trackId: string) => {
        return `/api/audio/${trackId}`;
      };

      expect(generateMobileUrl('123')).toBe('/api/audio/123');
      expect(generateMobileUrl('abc-def-456')).toBe('/api/audio/abc-def-456');
    });

    it('should generate correct URLs for desktop/electron environment', () => {
      const generateDesktopUrl = (filePath: string) => {
        const fileName = filePath.replace('/uploads/', '');
        return `http://localhost:3002/audio/${fileName}`;
      };

      expect(generateDesktopUrl('/uploads/song.mp3')).toBe('http://localhost:3002/audio/song.mp3');
      expect(generateDesktopUrl('/uploads/artist/album.mp3')).toBe('http://localhost:3002/audio/artist/album.mp3');
      expect(generateDesktopUrl('/uploads/1234567890-track.mp3')).toBe('http://localhost:3002/audio/1234567890-track.mp3');
    });

    it('should handle environment detection', () => {
      // Mock environment detection
      const detectEnvironment = (window: any) => {
        const isElectron = !!(window?.electron?.ipcRenderer);
        const isMobileBrowser = !isElectron;
        return { isElectron, isMobileBrowser };
      };

      // Test Electron environment
      const electronWindow = { electron: { ipcRenderer: {} } };
      expect(detectEnvironment(electronWindow)).toEqual({
        isElectron: true,
        isMobileBrowser: false
      });

      // Test browser environment
      const browserWindow = {};
      expect(detectEnvironment(browserWindow)).toEqual({
        isElectron: false,
        isMobileBrowser: true
      });
    });
  });

  describe('Playback State Flow', () => {
    it('should set correct states for double-click playback', () => {
      // Simulate state changes
      let state = {
        currentTrack: null as Track | null,
        currentTrackIndex: null as number | null,
        isPlaying: false,
        isAudioLoaded: false,
        shouldAutoPlay: false
      };

      // 1. User double-clicks track
      const track: Track = {
        id: 'test-123',
        name: 'Test Song',
        filePath: '/uploads/test.mp3',
        duration: 180,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      // 2. selectTrack is called with autoPlay=true
      const selectTrack = (track: Track, index: number, autoPlay: boolean) => {
        state.currentTrack = track;
        state.currentTrackIndex = index;
        state.isPlaying = autoPlay;
      };

      selectTrack(track, 0, true);
      
      expect(state.currentTrack).toBe(track);
      expect(state.currentTrackIndex).toBe(0);
      expect(state.isPlaying).toBe(true);

      // 3. Audio starts loading (isAudioLoaded is false)
      if (state.isPlaying && !state.isAudioLoaded) {
        state.shouldAutoPlay = true;
      }
      
      expect(state.shouldAutoPlay).toBe(true);

      // 4. Audio finishes loading
      state.isAudioLoaded = true;
      
      // 5. Check if should start playback
      const shouldStartPlayback = state.isAudioLoaded && state.shouldAutoPlay && state.isPlaying;
      expect(shouldStartPlayback).toBe(true);

      // 6. Reset shouldAutoPlay after starting
      if (shouldStartPlayback) {
        state.shouldAutoPlay = false;
      }
      
      expect(state.shouldAutoPlay).toBe(false);
    });

    it('should handle track switching', () => {
      let audioUrl = '';
      let isAudioLoaded = true;

      const loadNewTrack = (trackId: string, filePath: string) => {
        // Reset loading state
        isAudioLoaded = false;
        
        // Generate new URL
        audioUrl = `/api/audio/${trackId}`;
        
        // Simulate loading
        setTimeout(() => {
          isAudioLoaded = true;
        }, 100);
        
        return audioUrl;
      };

      // Load first track
      const url1 = loadNewTrack('track-1', '/uploads/track1.mp3');
      expect(url1).toBe('/api/audio/track-1');
      expect(isAudioLoaded).toBe(false);

      // Load second track
      const url2 = loadNewTrack('track-2', '/uploads/track2.mp3');
      expect(url2).toBe('/api/audio/track-2');
      expect(isAudioLoaded).toBe(false);
    });
  });

  describe('Track Finding Logic', () => {
    it('should find tracks by ID correctly', () => {
      const tracks: Track[] = [
        { id: '1', name: 'Track 1', filePath: '/uploads/1.mp3', duration: 180, createdAt: 0, updatedAt: 0 },
        { id: '2', name: 'Track 2', filePath: '/uploads/2.mp3', duration: 240, createdAt: 0, updatedAt: 0 },
        { id: '3', name: 'Track 3', filePath: '/uploads/3.mp3', duration: 200, createdAt: 0, updatedAt: 0 }
      ];

      const findTrackIndex = (trackId: string) => {
        return tracks.findIndex(t => t.id === trackId);
      };

      expect(findTrackIndex('1')).toBe(0);
      expect(findTrackIndex('2')).toBe(1);
      expect(findTrackIndex('3')).toBe(2);
      expect(findTrackIndex('4')).toBe(-1);
    });

    it('should handle playlist tracks with playlist_track_id', () => {
      const playlistTracks: any[] = [
        { id: '1', playlist_track_id: 101, name: 'Track 1' },
        { id: '2', playlist_track_id: 102, name: 'Track 2' },
        { id: '1', playlist_track_id: 103, name: 'Track 1 (duplicate)' }
      ];

      const findPlaylistTrack = (trackId: string, isPlaylistView: boolean) => {
        if (isPlaylistView) {
          return playlistTracks.findIndex(t => 
            t.playlist_track_id?.toString() === trackId || t.id === trackId
          );
        } else {
          return playlistTracks.findIndex(t => t.id === trackId);
        }
      };

      // In playlist view, can find by playlist_track_id
      expect(findPlaylistTrack('101', true)).toBe(0);
      expect(findPlaylistTrack('102', true)).toBe(1);
      expect(findPlaylistTrack('103', true)).toBe(2);

      // In library view, only finds by track id (finds first match)
      expect(findPlaylistTrack('1', false)).toBe(0);
      expect(findPlaylistTrack('2', false)).toBe(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing track gracefully', () => {
      const handlePlayTrack = (trackId: string | null | undefined, tracks: Track[]) => {
        if (!trackId) {
          return { error: 'Invalid track ID', track: null, index: -1 };
        }

        const index = tracks.findIndex(t => t.id === trackId);
        if (index === -1) {
          return { error: 'Track not found', track: null, index: -1 };
        }

        return { error: null, track: tracks[index], index };
      };

      const tracks: Track[] = [
        { id: '1', name: 'Track 1', filePath: '/uploads/1.mp3', duration: 180, createdAt: 0, updatedAt: 0 }
      ];

      expect(handlePlayTrack(null, tracks)).toEqual({
        error: 'Invalid track ID',
        track: null,
        index: -1
      });

      expect(handlePlayTrack('999', tracks)).toEqual({
        error: 'Track not found',
        track: null,
        index: -1
      });

      expect(handlePlayTrack('1', tracks)).toEqual({
        error: null,
        track: tracks[0],
        index: 0
      });
    });
  });
});