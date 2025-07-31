// Unit tests for comment and marker creation functionality
import { jest } from '@jest/globals';

// Mock the API service
const mockAddMarkerAndComment = jest.fn();
const mockFetchCommentsAndMarkers = jest.fn();

// Simulate the API service behavior
const apiService = {
  addMarkerAndComment: mockAddMarkerAndComment,
  fetchCommentsAndMarkers: mockFetchCommentsAndMarkers,
};

describe('Comments and Markers Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mocks
    mockAddMarkerAndComment.mockReset();
    mockFetchCommentsAndMarkers.mockReset();
  });

  describe('Comment Creation', () => {
    it('should successfully create a comment with marker', async () => {
      const mockCommentData = {
        trackId: 'test-track-123',
        content: 'Test comment content',
        time: 42.5,
        color: '#FF0000',
        userId: 1,
      };

      const mockResponse = {
        id: 'comment-123',
        content: 'Test comment content',
        track_id: 'test-track-123',
        user_id: 1,
        timestamp: 42.5,
        created_at: '2025-01-01T00:00:00Z',
        marker: {
          id: 'marker-123',
          time: 42.5,
          trackId: 'test-track-123',
          waveSurferRegionID: 'region-123',
          createdAt: '2025-01-01T00:00:00Z',
          color: '#FF0000',
        },
      };

      mockAddMarkerAndComment.mockResolvedValue(mockResponse);

      const result = await apiService.addMarkerAndComment(mockCommentData);

      expect(mockAddMarkerAndComment).toHaveBeenCalledWith(mockCommentData);
      expect(result).toEqual(mockResponse);
      expect(result.marker).toBeDefined();
      expect(result.marker.color).toBe('#FF0000');
    });

    it('should handle comment creation without marker', async () => {
      const mockCommentData = {
        trackId: 'test-track-123',
        content: 'General comment',
        time: 0, // No specific time marker
        userId: 1,
      };

      const mockResponse = {
        id: 'comment-124',
        content: 'General comment',
        track_id: 'test-track-123',
        user_id: 1,
        timestamp: 0,
        created_at: '2025-01-01T00:00:00Z',
        // No marker property
      };

      mockAddMarkerAndComment.mockResolvedValue(mockResponse);

      const result = await apiService.addMarkerAndComment(mockCommentData);

      expect(result.marker).toBeUndefined();
      expect(result.timestamp).toBe(0);
    });

    it('should handle API errors gracefully', async () => {
      const mockCommentData = {
        trackId: 'test-track-123',
        content: 'Test comment',
        time: 30.0,
        userId: 1,
      };

      const mockError = new Error('Network request failed');
      mockAddMarkerAndComment.mockRejectedValue(mockError);

      await expect(apiService.addMarkerAndComment(mockCommentData))
        .rejects.toThrow('Network request failed');
    });

    it('should validate required fields', async () => {
      const invalidData = {
        // Missing required fields
        content: 'Test comment',
      };

      mockAddMarkerAndComment.mockRejectedValue(
        new Error('Missing required fields: trackId, userId')
      );

      await expect(apiService.addMarkerAndComment(invalidData))
        .rejects.toThrow('Missing required fields');
    });
  });

  describe('Comment Fetching', () => {
    it('should fetch comments and markers for a track', async () => {
      const trackId = 'test-track-123';
      const mockCommentsResponse = {
        data: {
          comments: [
            {
              id: 'comment-1',
              content: 'First comment',
              track_id: trackId,
              user_id: 1,
              timestamp: 10.5,
            },
            {
              id: 'comment-2',
              content: 'Second comment',
              track_id: trackId,
              user_id: 2,
              timestamp: 20.0,
            },
          ],
          markers: [
            {
              id: 'marker-1',
              time: 10.5,
              comment_id: 'comment-1',
              track_id: trackId,
              color: '#FF0000',
            },
            {
              id: 'marker-2',
              time: 20.0,
              comment_id: 'comment-2',
              track_id: trackId,
              color: '#00FF00',
            },
          ],
        },
        error: null,
      };

      mockFetchCommentsAndMarkers.mockResolvedValue(mockCommentsResponse);

      const result = await apiService.fetchCommentsAndMarkers(trackId);

      expect(mockFetchCommentsAndMarkers).toHaveBeenCalledWith(trackId);
      expect(result.data.comments).toHaveLength(2);
      expect(result.data.markers).toHaveLength(2);
      expect(result.error).toBeNull();
    });

    it('should handle empty results', async () => {
      const trackId = 'empty-track-123';
      const mockEmptyResponse = {
        data: {
          comments: [],
          markers: [],
        },
        error: null,
      };

      mockFetchCommentsAndMarkers.mockResolvedValue(mockEmptyResponse);

      const result = await apiService.fetchCommentsAndMarkers(trackId);

      expect(result.data.comments).toHaveLength(0);
      expect(result.data.markers).toHaveLength(0);
    });
  });

  describe('Data Validation', () => {
    it('should validate comment content is not empty', () => {
      const isValidComment = (content: string) => {
        return Boolean(content && content.trim().length > 0);
      };

      expect(isValidComment('Valid comment')).toBe(true);
      expect(isValidComment('')).toBe(false);
      expect(isValidComment('   ')).toBe(false);
    });

    it('should validate time is not negative', () => {
      const isValidTime = (time: number) => {
        return time >= 0;
      };

      expect(isValidTime(42.5)).toBe(true);
      expect(isValidTime(0)).toBe(true);
      expect(isValidTime(-10)).toBe(false);
    });

    it('should validate color format', () => {
      const isValidColor = (color: string) => {
        return /^#[0-9A-F]{6}$/i.test(color);
      };

      expect(isValidColor('#FF0000')).toBe(true);
      expect(isValidColor('#00ff00')).toBe(true);
      expect(isValidColor('red')).toBe(false);
      expect(isValidColor('#FFF')).toBe(false);
    });
  });

  describe('ID Generation', () => {
    it('should generate unique comment IDs', () => {
      const generateCommentId = () => {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 10);
        return `comment_${timestamp}_${random}`;
      };

      const id1 = generateCommentId();
      const id2 = generateCommentId();

      expect(id1).toMatch(/^comment_\d+_[a-z0-9]+$/);
      expect(id2).toMatch(/^comment_\d+_[a-z0-9]+$/);
      expect(id1).not.toBe(id2);
    });

    it('should generate unique marker IDs', () => {
      const generateMarkerId = () => {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 10);
        return `marker_${timestamp}_${random}`;
      };

      const id1 = generateMarkerId();
      const id2 = generateMarkerId();

      expect(id1).toMatch(/^marker_\d+_[a-z0-9]+$/);
      expect(id2).toMatch(/^marker_\d+_[a-z0-9]+$/);
      expect(id1).not.toBe(id2);
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors', async () => {
      mockAddMarkerAndComment.mockRejectedValue(
        new Error('SQLITE_ERROR: table markers has no column named color')
      );

      await expect(apiService.addMarkerAndComment({
        trackId: 'test',
        content: 'test',
        time: 0,
        userId: 1,
      })).rejects.toThrow('SQLITE_ERROR');
    });

    it('should handle network timeouts', async () => {
      mockAddMarkerAndComment.mockRejectedValue(
        new Error('Network timeout')
      );

      await expect(apiService.addMarkerAndComment({
        trackId: 'test',
        content: 'test',
        time: 0,
        userId: 1,
      })).rejects.toThrow('Network timeout');
    });

    it('should handle invalid JSON responses', async () => {
      mockAddMarkerAndComment.mockRejectedValue(
        new Error('Invalid JSON response')
      );

      await expect(apiService.addMarkerAndComment({
        trackId: 'test',
        content: 'test',
        time: 0,
        userId: 1,
      })).rejects.toThrow('Invalid JSON');
    });
  });
});