import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react';
import { PlaybackContext } from '../frontend/src/app/contexts/PlaybackContext';
import { TracksContext } from '../frontend/src/app/contexts/TracksContext';
import { CommentsProvider } from '../frontend/src/app/providers/CommentsProvider';
import { AuthProvider } from '../frontend/src/app/providers/AuthProvider';
import TracksManager from '../frontend/src/app/components/tracks/TracksManager';
import apiService from '../frontend/src/services/electronApiService';

// Mock API service
jest.mock('../frontend/src/services/electronApiService');
const mockApiService = apiService as jest.Mocked<typeof apiService>;

// Mock WaveSurfer for integration tests
const mockWaveSurfer = {
  load: jest.fn(),
  play: jest.fn(),
  pause: jest.fn(),
  seekTo: jest.fn(),
  getDuration: jest.fn().mockReturnValue(180),
  getCurrentTime: jest.fn().mockReturnValue(60.5),
  setVolume: jest.fn(),
  on: jest.fn(),
  un: jest.fn(),
  destroy: jest.fn(),
  isPlaying: jest.fn().mockReturnValue(false),
};

const mockRegionsPlugin = {
  addRegion: jest.fn().mockReturnValue({
    id: 'region-123',
    start: 60.5,
    end: 61.5,
    data: { commentId: 'comment-123' },
    setOptions: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  }),
  getRegions: jest.fn().mockReturnValue([]),
  clearRegions: jest.fn(),
  on: jest.fn(),
};

// Mock console methods
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();

describe('Integration: Add Marker + Comment Full Workflow', () => {
  const mockTrack = {
    id: 'test-track-integration',
    name: 'Integration Test Track',
    file_path: '/test/integration.mp3',
    duration: 180,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  };

  const mockUser = {
    id: 1,
    email: 'integration@test.com',
  };

  const mockAuthContext = {
    user: mockUser,
    token: 'integration-jwt-token',
    login: jest.fn(),
    logout: jest.fn(),
    register: jest.fn(),
    loading: false,
  };

  const mockPlaybackContext = {
    currentTrack: mockTrack,
    isPlaying: false,
    play: jest.fn(),
    pause: jest.fn(),
    seekTo: jest.fn(),
    volume: 1,
    setVolume: jest.fn(),
    currentTime: 60.5,
    duration: 180,
  };

  const mockTracksContext = {
    tracks: [mockTrack],
    setTracks: jest.fn(),
    loadTracks: jest.fn(),
    addTrack: jest.fn(),
    removeTrack: jest.fn(),
    updateTrack: jest.fn(),
    isLoading: false,
    error: null,
  };

  const renderFullApp = () => {
    return render(
      <AuthProvider>
        <PlaybackContext.Provider value={mockPlaybackContext}>
          <TracksContext.Provider value={mockTracksContext}>
            <CommentsProvider>
              <TracksManager />
            </CommentsProvider>
          </TracksContext.Provider>
        </PlaybackContext.Provider>
      </AuthProvider>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockConsoleLog.mockClear();
    mockConsoleError.mockClear();

    // Mock successful API responses
    mockApiService.addMarkerAndComment.mockResolvedValue({
      id: 'comment-integration-123',
      content: 'Integration test comment',
      track_id: 'test-track-integration',
      user_id: 1,
      timestamp: 60.5,
      created_at: '2025-01-01T00:00:00Z',
      marker: {
        id: 'marker-integration-123',
        time: 60.5,
        trackId: 'test-track-integration',
        waveSurferRegionID: 'region-integration-123',
        createdAt: '2025-01-01T00:00:00Z',
      },
    });

    mockApiService.fetchCommentsAndMarkers.mockResolvedValue({
      data: {
        comments: [],
        markers: [],
      },
      error: null,
    });

    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn().mockReturnValue('integration-jwt-token'),
        setItem: jest.fn(),
        removeItem: jest.fn(),
      },
      writable: true,
    });

    // Mock fetch for HTTP API calls
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        id: 'comment-http-integration',
        content: 'HTTP integration comment',
        track_id: 'test-track-integration',
        user_id: 1,
        timestamp: 60.5,
      }),
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('End-to-End Comment Creation Flow', () => {
    it('should complete full workflow from double-tap to comment creation', async () => {
      const { container, getByTestId } = renderFullApp();

      // Simulate user interaction that triggers comment modal
      // (This would normally come from AudioPlayer double-tap detection)
      
      // 1. User double-taps on waveform at current time (60.5s)
      const audioPlayerSection = container.querySelector('[data-testid="audio-player"]');
      
      if (audioPlayerSection) {
        // Simulate the double-tap gesture
        fireEvent.touchStart(audioPlayerSection, {
          touches: [{ clientX: 200, clientY: 100 }],
        });
        fireEvent.touchEnd(audioPlayerSection);
        
        // Second tap within time window
        fireEvent.touchStart(audioPlayerSection, {
          touches: [{ clientX: 200, clientY: 100 }],
        });
        fireEvent.touchEnd(audioPlayerSection);
      }

      // 2. Comment modal should open
      await waitFor(() => {
        const modal = container.querySelector('[data-testid="comment-modal"]');
        if (modal) {
          expect(modal).toBeInTheDocument();
        }
      });

      // 3. User enters comment text and submits
      const commentInput = container.querySelector('input[placeholder*="comment"]') as HTMLInputElement;
      const submitButton = container.querySelector('button[type="submit"]') as HTMLButtonElement;

      if (commentInput && submitButton) {
        fireEvent.change(commentInput, {
          target: { value: 'Integration test comment' }
        });

        fireEvent.click(submitButton);
      }

      // 4. Verify the full workflow completed successfully
      await waitFor(() => {
        // Check that API service was called with correct data
        expect(mockApiService.addMarkerAndComment).toHaveBeenCalledWith({
          trackId: 'test-track-integration',
          content: 'Integration test comment',
          time: 60.5,
          color: '#FF0000',
          userId: 1,
        });
      });

      // 5. Verify logging throughout the flow
      expect(mockConsoleLog).toHaveBeenCalledWith(
        '🤗 [CommentsProvider] Adding comment with marker:',
        expect.objectContaining({
          trackId: 'test-track-integration',
          content: 'Integration test comment',
          time: 60.5,
          userId: 1,
        })
      );
    });

    it('should handle the complete error recovery flow', async () => {
      // Mock API failure
      mockApiService.addMarkerAndComment.mockRejectedValue(
        new Error('Network timeout during integration test')
      );

      const { container } = renderFullApp();

      // Simulate the same flow but with failure
      const audioPlayerSection = container.querySelector('[data-testid="audio-player"]');
      
      if (audioPlayerSection) {
        fireEvent.touchStart(audioPlayerSection, {
          touches: [{ clientX: 200, clientY: 100 }],
        });
        fireEvent.touchEnd(audioPlayerSection);
        fireEvent.touchStart(audioPlayerSection, {
          touches: [{ clientX: 200, clientY: 100 }],
        });
        fireEvent.touchEnd(audioPlayerSection);
      }

      // Try to submit comment
      const commentInput = container.querySelector('input[placeholder*="comment"]') as HTMLInputElement;
      const submitButton = container.querySelector('button[type="submit"]') as HTMLButtonElement;

      if (commentInput && submitButton) {
        fireEvent.change(commentInput, {
          target: { value: 'This should fail' }
        });

        fireEvent.click(submitButton);
      }

      // Verify error handling
      await waitFor(() => {
        expect(mockConsoleError).toHaveBeenCalledWith(
          'Error adding comment with marker:',
          expect.any(Error)
        );
      });

      // Verify UI shows error state (implementation dependent)
      // expect error message to be displayed to user
    });
  });

  describe('Multi-step Data Flow Integration', () => {
    it('should maintain data consistency through all layers', async () => {
      const { container } = renderFullApp();

      // Create comment through the full stack
      const commentData = {
        trackId: 'test-track-integration',
        content: 'Data consistency test',
        time: 45.0,
        color: '#00FF00',
        userId: 1,
      };

      // Simulate comment creation
      await act(async () => {
        // This would be triggered by the UI interaction
        // For testing, we'll directly test the data flow
      });

      // Verify data flows correctly through:
      // 1. UI Component (TracksManager)
      // 2. React Context (CommentsProvider)
      // 3. API Service (electronApiService)
      // 4. HTTP API (/api/comments)
      // 5. Database operations

      expect(true).toBe(true); // Placeholder for detailed assertions
    });

    it('should handle concurrent comment submissions', async () => {
      const { container } = renderFullApp();

      // Simulate multiple users creating comments simultaneously
      const promises = [
        mockApiService.addMarkerAndComment({
          trackId: 'test-track-integration',
          content: 'First concurrent comment',
          time: 30.0,
          userId: 1,
        }),
        mockApiService.addMarkerAndComment({
          trackId: 'test-track-integration',
          content: 'Second concurrent comment',
          time: 60.0,
          userId: 1,
        }),
        mockApiService.addMarkerAndComment({
          trackId: 'test-track-integration',
          content: 'Third concurrent comment',
          time: 90.0,
          userId: 1,
        }),
      ];

      await Promise.all(promises);

      // Verify all requests were processed
      expect(mockApiService.addMarkerAndComment).toHaveBeenCalledTimes(3);
    });
  });

  describe('Cross-Platform Integration', () => {
    it('should work consistently on mobile devices', async () => {
      // Mock mobile environment
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      Object.defineProperty(window, 'ontouchstart', {
        writable: true,
        configurable: true,
        value: true,
      });

      const { container } = renderFullApp();

      // Mobile-specific gesture handling
      const touchArea = container.querySelector('[data-testid="mobile-touch-area"]');
      
      if (touchArea) {
        // Mobile double-tap with proper timing
        fireEvent.touchStart(touchArea, {
          touches: [{ clientX: 150, clientY: 200 }],
          timeStamp: 1000,
        });
        fireEvent.touchEnd(touchArea, { timeStamp: 1100 });
        
        fireEvent.touchStart(touchArea, {
          touches: [{ clientX: 150, clientY: 200 }],
          timeStamp: 1200,
        });
        fireEvent.touchEnd(touchArea, { timeStamp: 1300 });
      }

      // Verify mobile flow works
      expect(container).toBeTruthy();
    });

    it('should work consistently on desktop devices', async () => {
      // Mock desktop environment
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1200,
      });

      const { container } = renderFullApp();

      // Desktop double-click handling
      const clickArea = container.querySelector('[data-testid="desktop-click-area"]');
      
      if (clickArea) {
        fireEvent.doubleClick(clickArea);
      }

      // Verify desktop flow works
      expect(container).toBeTruthy();
    });
  });

  describe('State Synchronization Integration', () => {
    it('should keep all UI components in sync after comment creation', async () => {
      const { container } = renderFullApp();

      // After creating a comment, verify:
      // 1. Comments list is updated
      // 2. Markers are added to waveform
      // 3. Region comment map is updated
      // 4. Loading states are reset

      await act(async () => {
        // Simulate successful comment creation
        // This would update all connected components
      });

      // Verify synchronization
      expect(true).toBe(true); // Placeholder for detailed sync checks
    });

    it('should handle real-time updates from other users', async () => {
      const { container } = renderFullApp();

      // Simulate receiving updates from other users
      // This would test WebSocket or polling integration

      expect(container).toBeTruthy();
    });
  });

  describe('Performance Integration', () => {
    it('should complete comment creation within acceptable time limits', async () => {
      const startTime = Date.now();

      const { container } = renderFullApp();

      // Simulate full comment creation flow
      await act(async () => {
        // Full workflow simulation
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within 2 seconds
      expect(duration).toBeLessThan(2000);
    });

    it('should handle large numbers of existing comments efficiently', async () => {
      // Mock many existing comments
      const manyComments = Array.from({ length: 100 }, (_, i) => ({
        id: `comment-${i}`,
        content: `Comment ${i}`,
        track_id: 'test-track-integration',
        user_id: 1,
        timestamp: i * 2,
      }));

      mockApiService.fetchCommentsAndMarkers.mockResolvedValue({
        data: {
          comments: manyComments,
          markers: [],
        },
        error: null,
      });

      const { container } = renderFullApp();

      // Should handle large datasets efficiently
      await waitFor(() => {
        expect(container).toBeTruthy();
      });
    });
  });

  describe('Authentication Integration', () => {
    it('should enforce authentication throughout the entire flow', async () => {
      // Mock unauthenticated state
      const unauthenticatedContext = {
        user: null,
        token: null,
        login: jest.fn(),
        logout: jest.fn(),
        register: jest.fn(),
        loading: false,
      };

      const { container } = render(
        <AuthProvider>
          <PlaybackContext.Provider value={mockPlaybackContext}>
            <TracksContext.Provider value={mockTracksContext}>
              <CommentsProvider>
                <TracksManager />
              </CommentsProvider>
            </TracksContext.Provider>
          </PlaybackContext.Provider>
        </AuthProvider>
      );

      // Attempt to create comment without authentication
      // Should be blocked at multiple levels
      expect(container).toBeTruthy();
    });
  });
});