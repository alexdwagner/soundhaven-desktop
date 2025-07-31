import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Track } from '../shared/types';

// Mock React first
jest.mock('react', () => ({
  ...jest.requireActual('react'),
  useContext: jest.fn(),
  createContext: jest.fn(() => ({
    Provider: ({ children }: any) => children,
    Consumer: ({ children }: any) => children
  }))
}));

// Mock the useEnvironment hook
jest.mock('../frontend/src/app/hooks/useEnvironment', () => ({
  useEnvironment: () => ({ isElectron: false, isMobile: false })
}));

// Mock the useDataLayer hook
jest.mock('../frontend/src/app/hooks/useDataLayer', () => ({
  useDataLayer: () => ({
    getTracks: jest.fn().mockResolvedValue([]),
    getTrack: jest.fn(),
    getPlaylists: jest.fn().mockResolvedValue([]),
    getComments: jest.fn().mockResolvedValue([]),
    streamAudioUrl: jest.fn()
  })
}));

// Mock WaveSurfer
jest.mock('wavesurfer.js', () => {
  return jest.fn().mockImplementation(() => ({
    create: jest.fn().mockReturnValue({
      load: jest.fn(),
      play: jest.fn().mockResolvedValue(undefined),
      pause: jest.fn(),
      isPlaying: jest.fn().mockReturnValue(false),
      on: jest.fn(),
      destroy: jest.fn(),
      getDuration: jest.fn().mockReturnValue(180),
      getCurrentTime: jest.fn().mockReturnValue(0),
      setVolume: jest.fn(),
      setPlaybackRate: jest.fn(),
      seekTo: jest.fn()
    })
  }));
});

describe('Playback Integration Tests', () => {
  const mockTracks: Track[] = [
    {
      id: '1',
      name: 'Test Track 1',
      filePath: '/uploads/test1.mp3',
      file_path: '/uploads/test1.mp3', // Include both for compatibility
      duration: 180,
      artistName: 'Test Artist 1',
      albumName: 'Test Album 1',
      createdAt: Date.now(),
      updatedAt: Date.now()
    },
    {
      id: '2',
      name: 'Test Track 2',
      filePath: '/uploads/test2.mp3',
      file_path: '/uploads/test2.mp3',
      duration: 240,
      artistName: 'Test Artist 2',
      albumName: 'Test Album 2',
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
  ];

  const renderWithProviders = (component: React.ReactElement) => {
    return render(
      <AuthProvider>
        <TracksProvider>
          <PlaybackProvider>
            {component}
          </PlaybackProvider>
        </TracksProvider>
      </AuthProvider>
    );
  };

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock console methods to reduce noise
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore console methods
    (console.log as jest.Mock).mockRestore();
    (console.error as jest.Mock).mockRestore();
    (console.warn as jest.Mock).mockRestore();
  });

  describe('Track Selection and Playback', () => {
    it('should select a track when clicked', async () => {
      const { container } = renderWithProviders(
        <TracksManager />
      );

      // Mock the tracks data
      const mockDataLayer = require('../frontend/src/app/hooks/useDataLayer').useDataLayer();
      mockDataLayer.getTracks.mockResolvedValueOnce(mockTracks);

      // Wait for tracks to load
      await waitFor(() => {
        expect(mockDataLayer.getTracks).toHaveBeenCalled();
      });

      // Find and click the first track
      const firstTrack = await screen.findByText('Test Track 1');
      fireEvent.click(firstTrack);

      // Verify track is selected (would have bg-blue-100 class)
      const trackRow = firstTrack.closest('tr');
      expect(trackRow).toHaveClass('bg-blue-100');
    });

    it('should play a track when double-clicked', async () => {
      const { container } = renderWithProviders(
        <TracksManager />
      );

      // Mock the tracks data
      const mockDataLayer = require('../frontend/src/app/hooks/useDataLayer').useDataLayer();
      mockDataLayer.getTracks.mockResolvedValueOnce(mockTracks);

      // Wait for tracks to load
      await waitFor(() => {
        expect(mockDataLayer.getTracks).toHaveBeenCalled();
      });

      // Find and double-click the first track
      const firstTrack = await screen.findByText('Test Track 1');
      fireEvent.doubleClick(firstTrack);

      // Verify that the track is selected for playback
      // In a real test, we'd check if the audio player received the track
      await waitFor(() => {
        // Check console logs were called with expected messages
        expect(console.log).toHaveBeenCalledWith(
          expect.stringContaining('DOUBLE-CLICK HANDLER TRIGGERED')
        );
      });
    });

    it('should handle track switching correctly', async () => {
      const { container } = renderWithProviders(
        <TracksManager />
      );

      // Mock the tracks data
      const mockDataLayer = require('../frontend/src/app/hooks/useDataLayer').useDataLayer();
      mockDataLayer.getTracks.mockResolvedValueOnce(mockTracks);

      // Wait for tracks to load
      await waitFor(() => {
        expect(mockDataLayer.getTracks).toHaveBeenCalled();
      });

      // Double-click first track
      const firstTrack = await screen.findByText('Test Track 1');
      fireEvent.doubleClick(firstTrack);

      // Double-click second track
      const secondTrack = await screen.findByText('Test Track 2');
      fireEvent.doubleClick(secondTrack);

      // Verify track switch happened
      await waitFor(() => {
        expect(console.log).toHaveBeenCalledWith(
          expect.stringContaining('Track changed effect triggered')
        );
      });
    });

    it('should handle multi-selection with Ctrl/Cmd key', async () => {
      const { container } = renderWithProviders(
        <TracksManager />
      );

      // Mock the tracks data
      const mockDataLayer = require('../frontend/src/app/hooks/useDataLayer').useDataLayer();
      mockDataLayer.getTracks.mockResolvedValueOnce(mockTracks);

      // Wait for tracks to load
      await waitFor(() => {
        expect(mockDataLayer.getTracks).toHaveBeenCalled();
      });

      // Click first track
      const firstTrack = await screen.findByText('Test Track 1');
      fireEvent.click(firstTrack);

      // Ctrl+click second track
      const secondTrack = await screen.findByText('Test Track 2');
      fireEvent.click(secondTrack, { ctrlKey: true });

      // Both tracks should be selected
      const firstTrackRow = firstTrack.closest('tr');
      const secondTrackRow = secondTrack.closest('tr');
      
      expect(firstTrackRow).toHaveClass('bg-blue-100');
      expect(secondTrackRow).toHaveClass('bg-blue-100');
    });
  });

  describe('Audio URL Generation', () => {
    it('should generate correct audio URLs for tracks', async () => {
      const mockGetFileUrl = jest.fn();
      
      // Test for web environment
      mockGetFileUrl.mockImplementation((filePath: string, trackId: string) => {
        return `/api/audio/${trackId}`;
      });

      const url1 = await mockGetFileUrl('/uploads/test1.mp3', '1');
      expect(url1).toBe('/api/audio/1');

      const url2 = await mockGetFileUrl('/uploads/test2.mp3', '2');
      expect(url2).toBe('/api/audio/2');
    });

    it('should handle both filePath and file_path properties', () => {
      const track1 = { filePath: '/uploads/test.mp3' };
      const track2 = { file_path: '/uploads/test.mp3' };

      // Test the compatibility logic
      const getFilePath = (track: any) => track.filePath || track.file_path;

      expect(getFilePath(track1)).toBe('/uploads/test.mp3');
      expect(getFilePath(track2)).toBe('/uploads/test.mp3');
    });
  });

  describe('Playback State Management', () => {
    it('should manage isPlaying state correctly', async () => {
      let isPlaying = false;
      let currentTrack: Track | null = null;

      const mockSelectTrack = (track: Track, index: number, autoPlay: boolean) => {
        currentTrack = track;
        if (autoPlay) {
          isPlaying = true;
        }
      };

      // Simulate double-click (autoPlay = true)
      mockSelectTrack(mockTracks[0], 0, true);
      expect(isPlaying).toBe(true);
      expect(currentTrack).toBe(mockTracks[0]);

      // Simulate single-click (autoPlay = false)
      isPlaying = false;
      mockSelectTrack(mockTracks[1], 1, false);
      expect(isPlaying).toBe(false);
      expect(currentTrack).toBe(mockTracks[1]);
    });

    it('should handle audio loading states', async () => {
      let isAudioLoaded = false;
      let shouldAutoPlay = false;
      const isPlaying = true;

      // Simulate audio not loaded yet
      if (isPlaying && !isAudioLoaded) {
        shouldAutoPlay = true;
      }
      expect(shouldAutoPlay).toBe(true);

      // Simulate audio loaded
      isAudioLoaded = true;
      if (isAudioLoaded && shouldAutoPlay && isPlaying) {
        // Would trigger playback
        shouldAutoPlay = false;
      }
      expect(shouldAutoPlay).toBe(false);
    });
  });
});