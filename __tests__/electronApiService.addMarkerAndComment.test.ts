import apiService from '../frontend/src/services/electronApiService';

// Mock console methods to capture logs
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();

describe('ElectronApiService - addMarkerAndComment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConsoleLog.mockClear();
    mockConsoleError.mockClear();
    
    // Mock localStorage token
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn().mockReturnValue('mock-jwt-token'),
        setItem: jest.fn(),
        removeItem: jest.fn(),
      },
      writable: true,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('HTTP mode', () => {
    const mockCommentData = {
      trackId: 'test-track-id',
      content: 'Test comment content',
      time: 42.5,
      color: '#FF0000',
      userId: 1,
    };

    const mockSuccessResponse = {
      id: 'comment-123',
      content: 'Test comment content',
      track_id: 'test-track-id',
      user_id: 1,
      timestamp: 42.5,
      marker: {
        id: 'marker-123',
        time: 42.5,
        trackId: 'test-track-id',
        waveSurferRegionID: 'region-123',
        createdAt: '2025-01-01T00:00:00Z',
      },
    };

    it('should successfully add marker and comment via HTTP API', async () => {
      // Mock successful fetch response
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue(mockSuccessResponse),
      });

      const result = await apiService.addMarkerAndComment(mockCommentData);

      // Verify fetch was called with correct parameters
      expect(fetch).toHaveBeenCalledWith('/api/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer mock-jwt-token',
        },
        body: JSON.stringify({
          trackId: 'test-track-id',
          content: 'Test comment content',
          time: 42.5,
          color: '#FF0000',
          userId: 1,
        }),
      });

      // Verify 🤗 emoji logs were created
      expect(mockConsoleLog).toHaveBeenCalledWith(
        '🤗 [ApiService] Adding marker and comment:',
        mockCommentData
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        '🤗 [ApiService] Token available:',
        true
      );

      // Verify successful result
      expect(result).toEqual(mockSuccessResponse);
    });

    it('should handle HTTP 400 error response', async () => {
      const errorResponse = {
        error: 'Invalid request data',
        details: 'Missing required field: content',
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: jest.fn().mockResolvedValue(errorResponse),
      });

      const result = await apiService.addMarkerAndComment(mockCommentData);

      expect(result).toEqual({
        error: 'HTTP 400: Invalid request data',
        data: null,
      });

      expect(mockConsoleError).toHaveBeenCalledWith(
        '🤗 [ApiService] HTTP Error 400:',
        errorResponse
      );
    });

    it('should handle HTTP 500 server error', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: jest.fn().mockResolvedValue({ error: 'Database connection failed' }),
      });

      const result = await apiService.addMarkerAndComment(mockCommentData);

      expect(result).toEqual({
        error: 'HTTP 500: Database connection failed',
        data: null,
      });
    });

    it('should handle network errors', async () => {
      const networkError = new Error('Network request failed');
      global.fetch = jest.fn().mockRejectedValue(networkError);

      const result = await apiService.addMarkerAndComment(mockCommentData);

      expect(result).toEqual({
        error: 'Network error: Network request failed',
        data: null,
      });

      expect(mockConsoleError).toHaveBeenCalledWith(
        '🤗 [ApiService] Network error:',
        networkError
      );
    });

    it('should handle missing authentication token', async () => {
      // Mock missing token
      window.localStorage.getItem = jest.fn().mockReturnValue(null);

      const result = await apiService.addMarkerAndComment(mockCommentData);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        '🤗 [ApiService] Token available:',
        false
      );

      // Should still attempt the request without token
      expect(fetch).toHaveBeenCalledWith('/api/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer null',
        },
        body: JSON.stringify(mockCommentData),
      });
    });

    it('should handle invalid JSON response', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockRejectedValue(new Error('Invalid JSON')),
      });

      const result = await apiService.addMarkerAndComment(mockCommentData);

      expect(result).toEqual({
        error: 'Failed to parse response: Invalid JSON',
        data: null,
      });
    });

    it('should validate required comment data fields', async () => {
      const invalidData = {
        trackId: '',
        content: '',
        time: -1,
        userId: 0,
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: jest.fn().mockResolvedValue({ error: 'Validation failed' }),
      });

      const result = await apiService.addMarkerAndComment(invalidData);

      expect(result.error).toContain('HTTP 400');
    });

    it('should log detailed request information', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue(mockSuccessResponse),
      });

      await apiService.addMarkerAndComment(mockCommentData);

      // Verify detailed logging
      expect(mockConsoleLog).toHaveBeenCalledWith(
        '🤗 [ApiService] Adding marker and comment:',
        mockCommentData
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        '🤗 [ApiService] Token available:',
        true
      );
    });
  });

  describe('Electron IPC mode', () => {
    beforeEach(() => {
      // Mock Electron environment
      window.electron = {
        ipcRenderer: {
          invoke: jest.fn(),
          on: jest.fn(),
          removeAllListeners: jest.fn(),
        },
      };
    });

    it('should fallback to IPC when HTTP fails', async () => {
      const mockCommentData = {
        trackId: 'test-track-id',
        content: 'Test comment',
        time: 30.0,
        userId: 1,
      };

      // Mock HTTP failure
      global.fetch = jest.fn().mockRejectedValue(new Error('Network unavailable'));

      // Mock successful IPC response
      const ipcResponse = { id: 'comment-ipc-123', content: 'Test comment' };
      window.electron.ipcRenderer.invoke = jest.fn().mockResolvedValue(ipcResponse);

      const result = await apiService.addMarkerAndComment(mockCommentData);

      // Should attempt HTTP first, then fallback to IPC
      expect(fetch).toHaveBeenCalled();
      expect(window.electron.ipcRenderer.invoke).toHaveBeenCalledWith(
        'comments:addMarkerAndComment',
        mockCommentData
      );
      
      expect(result).toEqual(ipcResponse);
    });
  });
});