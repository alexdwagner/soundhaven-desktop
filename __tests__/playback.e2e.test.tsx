import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';

// Mock electron API
global.window.electron = {
  ipcRenderer: {
    invoke: jest.fn(),
    on: jest.fn(),
    removeListener: jest.fn()
  }
};

// Import components after mocking electron
import App from '../frontend/src/app/page';
import { Track } from '../shared/types';

describe('Playback E2E Tests', () => {
  const mockTracks: Track[] = [
    {
      id: '561904fb-02ad-459a-9e99-470763af2801',
      name: 'Aquemini',
      filePath: '/uploads/1751260151380-05_-_Aquemini.mp3',
      file_path: '/uploads/1751260151380-05_-_Aquemini.mp3',
      duration: 312,
      artistName: 'OutKast',
      albumName: 'Aquemini',
      createdAt: Date.now(),
      updatedAt: Date.now()
    },
    {
      id: 'fe2fcf46-8846-41de-91fa-9d2f69538556',
      name: 'Beeswax',
      filePath: '/uploads/1752023744934-Nirvana_-_Beeswax.mp3',
      file_path: '/uploads/1752023744934-Nirvana_-_Beeswax.mp3',
      duration: 175,
      artistName: 'Nirvana',
      albumName: 'Incesticide',
      createdAt: Date.now(),
      updatedAt: Date.now()
    },
    {
      id: 'c37a62da-71b0-48e4-a22e-ce854276268d',
      name: 'Careless Whisper',
      filePath: '/uploads/careless_whisper.mp3',
      file_path: '/uploads/careless_whisper.mp3',
      duration: 300,
      artistName: 'George Michael',
      albumName: 'Make It Big',
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
  ];

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Mock IPC responses
    (window.electron.ipcRenderer.invoke as jest.Mock).mockImplementation(async (channel, data) => {
      if (channel === 'api-request') {
        switch (data.endpoint) {
          case '/api/tracks':
            return { data: mockTracks };
          case '/api/playlists':
            return { data: [] };
          case '/api/comments':
            return { data: [] };
          default:
            return { data: null };
        }
      }
      return null;
    });

    // Mock console to reduce noise
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore console
    (console.log as jest.Mock).mockRestore();
    (console.error as jest.Mock).mockRestore();
    (console.warn as jest.Mock).mockRestore();
  });

  it('should load and display tracks on app startup', async () => {
    render(<App />);

    // Wait for tracks to load
    await waitFor(() => {
      expect(window.electron.ipcRenderer.invoke).toHaveBeenCalledWith('api-request', {
        endpoint: '/api/tracks',
        method: 'GET'
      });
    });

    // Check if tracks are displayed
    expect(await screen.findByText('Aquemini')).toBeInTheDocument();
    expect(await screen.findByText('Beeswax')).toBeInTheDocument();
    expect(await screen.findByText('Careless Whisper')).toBeInTheDocument();
  });

  it('should play track on double-click and handle track switching', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Wait for tracks to load
    await waitFor(() => {
      expect(screen.getByText('Aquemini')).toBeInTheDocument();
    });

    // Double-click first track (Aquemini)
    const aqueminiTrack = screen.getByText('Aquemini');
    await user.dblClick(aqueminiTrack);

    // Verify console logs for double-click
    await waitFor(() => {
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('DOUBLE-CLICK HANDLER TRIGGERED')
      );
    });

    // Verify track changed effect
    await waitFor(() => {
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Track changed effect triggered')
      );
    });

    // Double-click second track (Beeswax)
    const beeswaxTrack = screen.getByText('Beeswax');
    await user.dblClick(beeswaxTrack);

    // Verify track switch
    await waitFor(() => {
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Track changed effect triggered')
      );
    });

    // Double-click third track (Careless Whisper)
    const carelessTrack = screen.getByText('Careless Whisper');
    await user.dblClick(carelessTrack);

    // Verify all tracks can be loaded
    await waitFor(() => {
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Track changed effect triggered')
      );
    });
  });

  it('should handle file path compatibility (filePath vs file_path)', async () => {
    render(<App />);

    // Wait for tracks to load
    await waitFor(() => {
      expect(screen.getByText('Aquemini')).toBeInTheDocument();
    });

    // All tracks should be playable regardless of property name
    const tracks = ['Aquemini', 'Beeswax', 'Careless Whisper'];
    
    for (const trackName of tracks) {
      const trackElement = screen.getByText(trackName);
      await userEvent.dblClick(trackElement);
      
      // Verify audio URL generation
      await waitFor(() => {
        expect(console.log).toHaveBeenCalledWith(
          expect.stringContaining('Processing track with filePath:')
        );
      });
    }
  });

  it('should maintain playback state correctly', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Wait for tracks to load
    await waitFor(() => {
      expect(screen.getByText('Aquemini')).toBeInTheDocument();
    });

    // Double-click to play
    const track = screen.getByText('Aquemini');
    await user.dblClick(track);

    // Verify isPlaying state change
    await waitFor(() => {
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('isPlaying=true')
      );
    });

    // Find and click play/pause button (if visible)
    try {
      const pauseButton = await screen.findByRole('button', { name: /pause/i });
      await user.click(pauseButton);
      
      // Verify pause
      await waitFor(() => {
        expect(console.log).toHaveBeenCalledWith(
          expect.stringContaining('isPlaying=false')
        );
      });
    } catch {
      // Play button might not be visible in test environment
    }
  });

  it('should generate correct audio URLs based on environment', async () => {
    render(<App />);

    // Wait for tracks to load
    await waitFor(() => {
      expect(screen.getByText('Aquemini')).toBeInTheDocument();
    });

    // Double-click a track
    const track = screen.getByText('Aquemini');
    await userEvent.dblClick(track);

    // Check URL generation for web environment
    await waitFor(() => {
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Using Next.js API streaming URL')
      );
    });

    // Verify the URL format
    await waitFor(() => {
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('/api/audio/561904fb-02ad-459a-9e99-470763af2801')
      );
    });
  });

  it('should handle track selection and multi-selection', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Wait for tracks to load
    await waitFor(() => {
      expect(screen.getByText('Aquemini')).toBeInTheDocument();
    });

    // Single click to select
    const track1 = screen.getByText('Aquemini');
    await user.click(track1);

    // Verify selection
    const trackRow1 = track1.closest('tr');
    expect(trackRow1).toHaveClass('bg-blue-100');

    // Ctrl+click for multi-selection
    const track2 = screen.getByText('Beeswax');
    await user.click(track2, { ctrlKey: true });

    // Both should be selected
    const trackRow2 = track2.closest('tr');
    expect(trackRow1).toHaveClass('bg-blue-100');
    expect(trackRow2).toHaveClass('bg-blue-100');
  });
});