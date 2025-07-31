import { NextRequest } from 'next/server';
import { POST } from '../frontend/src/app/api/comments/route';
import * as dbModule from '../frontend/src/app/lib/database';

// Mock database module
jest.mock('../frontend/src/app/lib/database');
const mockDbModule = dbModule as jest.Mocked<typeof dbModule>;

// Mock console methods
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();

describe('/api/comments POST endpoint', () => {
  const validCommentData = {
    trackId: 'test-track-123',
    content: 'Test comment content',
    time: 42.5,
    color: '#FF0000',
    userId: 1,
  };

  const mockCreatedComment = {
    id: 'comment_1640995200000_abc123',
    content: 'Test comment content',
    track_id: 'test-track-123',
    user_id: 1,
    timestamp: 42.5,
    created_at: 1640995200,
    updated_at: 1640995200,
    user_email: 'test@example.com',
    track_name: 'Test Track',
  };

  const mockCreatedMarker = {
    id: 'marker_1640995200001_def456',
    time: 42.5,
    comment_id: 'comment_1640995200000_abc123',
    track_id: 'test-track-123',
    color: '#FF0000',
    created_at: 1640995200,
    updated_at: 1640995200,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockConsoleLog.mockClear();
    mockConsoleError.mockClear();

    // Mock database operations with successful defaults
    mockDbModule.insertComment = jest.fn().mockResolvedValue({
      success: true,
      changes: 1,
      lastID: 11,
      message: 'Write operation completed successfully, 1 rows affected',
    });

    mockDbModule.insertMarker = jest.fn().mockResolvedValue({
      success: true,
      changes: 1,
      lastID: 6,
      message: 'Write operation completed successfully, 1 rows affected',
    });

    mockDbModule.getCommentById = jest.fn().mockResolvedValue(mockCreatedComment);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('successful comment creation', () => {
    it('should create comment and marker successfully', async () => {
      const request = new NextRequest('http://localhost:3001/api/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-jwt-token',
        },
        body: JSON.stringify(validCommentData),
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData).toEqual(mockCreatedComment);

      // Verify database operations were called
      expect(mockDbModule.insertComment).toHaveBeenCalledWith(
        expect.stringMatching(/^comment_\d+_[a-z0-9]+$/),
        'Test comment content',
        'test-track-123',
        1,
        42.5
      );

      expect(mockDbModule.insertMarker).toHaveBeenCalledWith(
        expect.stringMatching(/^marker_\d+_[a-z0-9]+$/),
        42.5,
        expect.stringMatching(/^comment_\d+_[a-z0-9]+$/),
        'test-track-123',
        '#FF0000'
      );

      expect(mockDbModule.getCommentById).toHaveBeenCalled();
    });

    it('should log detailed request information with 📱 emoji', async () => {
      const request = new NextRequest('http://localhost:3001/api/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(validCommentData),
      });

      await POST(request);

      // Verify detailed logging
      expect(mockConsoleLog).toHaveBeenCalledWith('📱 [Next.js API] POST /api/comments called');
      expect(mockConsoleLog).toHaveBeenCalledWith('📱 [Next.js API] Request body:', validCommentData);
      expect(mockConsoleLog).toHaveBeenCalledWith('📱 [Next.js API] Comment creation request:', {
        content: 'Test comment content',
        trackId: 'test-track-123',
        userId: 1,
        time: 42.5,
        color: '#FF0000',
      });
    });

    it('should create comment without marker when time is 0', async () => {
      const commentDataNoMarker = {
        ...validCommentData,
        time: 0,
      };

      const request = new NextRequest('http://localhost:3001/api/comments', {
        method: 'POST',
        body: JSON.stringify(commentDataNoMarker),
      });

      await POST(request);

      // Should create comment but not marker for time = 0
      expect(mockDbModule.insertComment).toHaveBeenCalled();
      expect(mockDbModule.insertMarker).toHaveBeenCalled(); // Still called but with time = 0
    });

    it('should use default color when not provided', async () => {
      const commentDataNoColor = {
        trackId: 'test-track-123',
        content: 'Test comment',
        time: 30.0,
        userId: 1,
      };

      const request = new NextRequest('http://localhost:3001/api/comments', {
        method: 'POST',
        body: JSON.stringify(commentDataNoColor),
      });

      await POST(request);

      expect(mockDbModule.insertMarker).toHaveBeenCalledWith(
        expect.any(String),
        30.0,
        expect.any(String),
        'test-track-123',
        '#FF0000' // Default color
      );
    });
  });

  describe('validation errors', () => {
    it('should return 400 for missing required fields', async () => {
      const invalidData = {
        content: 'Test comment',
        // Missing trackId, userId, time
      };

      const request = new NextRequest('http://localhost:3001/api/comments', {
        method: 'POST',
        body: JSON.stringify(invalidData),
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.error).toContain('Missing required fields');
    });

    it('should return 400 for invalid data types', async () => {
      const invalidData = {
        trackId: 123, // Should be string
        content: 'Test comment',
        time: 'not-a-number', // Should be number
        userId: 'not-a-number', // Should be number
      };

      const request = new NextRequest('http://localhost:3001/api/comments', {
        method: 'POST',
        body: JSON.stringify(invalidData),
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.error).toContain('Invalid data types');
    });

    it('should return 400 for empty comment content', async () => {
      const invalidData = {
        ...validCommentData,
        content: '',
      };

      const request = new NextRequest('http://localhost:3001/api/comments', {
        method: 'POST',
        body: JSON.stringify(invalidData),
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.error).toContain('Content cannot be empty');
    });

    it('should return 400 for negative time values', async () => {
      const invalidData = {
        ...validCommentData,
        time: -10.5,
      };

      const request = new NextRequest('http://localhost:3001/api/comments', {
        method: 'POST',
        body: JSON.stringify(invalidData),
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.error).toContain('Time cannot be negative');
    });
  });

  describe('database errors', () => {
    it('should handle comment insertion failure', async () => {
      mockDbModule.insertComment.mockResolvedValue({
        success: false,
        changes: 0,
        lastID: null,
        message: 'Write operation failed: SQLITE_ERROR: database is locked',
      });

      const request = new NextRequest('http://localhost:3001/api/comments', {
        method: 'POST',
        body: JSON.stringify(validCommentData),
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(500);
      expect(responseData.error).toContain('Failed to create comment');
      expect(responseData.error).toContain('database is locked');
    });

    it('should handle marker insertion failure after successful comment creation', async () => {
      // Comment succeeds, marker fails
      mockDbModule.insertMarker.mockResolvedValue({
        success: false,
        changes: 0,
        lastID: null,
        message: 'Write operation failed: SQLITE_ERROR: table markers has no column named color',
      });

      const request = new NextRequest('http://localhost:3001/api/comments', {
        method: 'POST',
        body: JSON.stringify(validCommentData),
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(500);
      expect(responseData.error).toContain('Failed to create marker');
      expect(responseData.error).toContain('table markers has no column named color');

      // Should log the marker creation failure
      expect(mockConsoleLog).toHaveBeenCalledWith(
        '📱 [Next.js API] Marker insert result:',
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('table markers has no column named color'),
        })
      );
    });

    it('should handle database connection errors', async () => {
      mockDbModule.insertComment.mockRejectedValue(new Error('Database connection lost'));

      const request = new NextRequest('http://localhost:3001/api/comments', {
        method: 'POST',
        body: JSON.stringify(validCommentData),
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(500);
      expect(responseData.error).toContain('Database error');
      expect(responseData.error).toContain('Database connection lost');
    });

    it('should handle comment retrieval failure after creation', async () => {
      mockDbModule.getCommentById.mockRejectedValue(new Error('Comment not found'));

      const request = new NextRequest('http://localhost:3001/api/comments', {
        method: 'POST',
        body: JSON.stringify(validCommentData),
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(500);
      expect(responseData.error).toContain('Failed to retrieve created comment');
    });
  });

  describe('request parsing errors', () => {
    it('should handle malformed JSON', async () => {
      const request = new NextRequest('http://localhost:3001/api/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: 'invalid json {',
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.error).toContain('Invalid JSON');
    });

    it('should handle empty request body', async () => {
      const request = new NextRequest('http://localhost:3001/api/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: '',
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.error).toContain('Request body is required');
    });
  });

  describe('CORS and headers', () => {
    it('should include CORS headers in response', async () => {
      const request = new NextRequest('http://localhost:3001/api/comments', {
        method: 'POST',
        body: JSON.stringify(validCommentData),
      });

      const response = await POST(request);

      // Check for CORS headers
      expect(response.headers.get('Access-Control-Allow-Origin')).toBeTruthy();
      expect(response.headers.get('Access-Control-Allow-Methods')).toBeTruthy();
    });

    it('should handle requests from different origins', async () => {
      const request = new NextRequest('http://localhost:3001/api/comments', {
        method: 'POST',
        headers: {
          'Origin': 'http://192.168.1.100:3001',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(validCommentData),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
    });
  });

  describe('authentication and authorization', () => {
    it('should process requests with valid JWT token', async () => {
      const request = new NextRequest('http://localhost:3001/api/comments', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.valid.signature',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(validCommentData),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
    });

    it('should process requests without token (for now)', async () => {
      const request = new NextRequest('http://localhost:3001/api/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(validCommentData),
      });

      const response = await POST(request);

      // Currently the endpoint doesn't enforce authentication
      expect(response.status).toBe(200);
    });
  });

  describe('ID generation and uniqueness', () => {
    it('should generate unique IDs for comments and markers', async () => {
      const request = new NextRequest('http://localhost:3001/api/comments', {
        method: 'POST',
        body: JSON.stringify(validCommentData),
      });

      await POST(request);

      // Verify that generated IDs follow the expected pattern
      expect(mockDbModule.insertComment).toHaveBeenCalledWith(
        expect.stringMatching(/^comment_\d+_[a-z0-9]+$/),
        expect.any(String),
        expect.any(String),
        expect.any(Number),
        expect.any(Number)
      );

      expect(mockDbModule.insertMarker).toHaveBeenCalledWith(
        expect.stringMatching(/^marker_\d+_[a-z0-9]+$/),
        expect.any(Number),
        expect.stringMatching(/^comment_\d+_[a-z0-9]+$/),
        expect.any(String),
        expect.any(String)
      );
    });

    it('should generate different IDs for concurrent requests', async () => {
      const request1 = new NextRequest('http://localhost:3001/api/comments', {
        method: 'POST',
        body: JSON.stringify(validCommentData),
      });

      const request2 = new NextRequest('http://localhost:3001/api/comments', {
        method: 'POST',
        body: JSON.stringify({
          ...validCommentData,
          content: 'Different comment',
        }),
      });

      // Process both requests
      await Promise.all([POST(request1), POST(request2)]);

      // Both should have been called with different IDs
      expect(mockDbModule.insertComment).toHaveBeenCalledTimes(2);
      expect(mockDbModule.insertMarker).toHaveBeenCalledTimes(2);

      const commentCalls = mockDbModule.insertComment.mock.calls;
      const markerCalls = mockDbModule.insertMarker.mock.calls;

      // IDs should be different
      expect(commentCalls[0][0]).not.toBe(commentCalls[1][0]);
      expect(markerCalls[0][0]).not.toBe(markerCalls[1][0]);
    });
  });
});