import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, queryDatabase, writeDatabase } from '../../lib/database';
import { addCorsHeaders, handleOptionsRequest } from '../../utils/cors';

// API Route startup logging
console.log('📱 [Comments API] Route loaded successfully');
console.log('📱 [Comments API] Available methods: GET, POST, OPTIONS');
console.log('📱 [Comments API] Features: Comments, markers, pagination, CORS support');

export async function OPTIONS(request: NextRequest) {
  return handleOptionsRequest(request.headers);
}

export async function GET(request: NextRequest) {
  console.log('📱 [Next.js API] /api/comments called from mobile');
  
  try {
    // Get trackId from query params if provided
    const { searchParams } = new URL(request.url);
    const trackId = searchParams.get('trackId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '100');
    
    // Connect to database and fetch real comments
    const dbConnection = await connectToDatabase();
    console.log('📱 [Next.js API] Database connection:', dbConnection);
    
    if (dbConnection.connected) {
      // Build query based on whether trackId is provided
      let query = `
        SELECT 
          c.*,
          u.email as user_email,
          t.name as track_name
        FROM comments c
        LEFT JOIN users u ON c.user_id = u.id  
        LEFT JOIN tracks t ON c.track_id = t.id
      `;
      let params: any[] = [];
      
      if (trackId) {
        query += ` WHERE c.track_id = ?`;
        params.push(trackId);
      }
      
      query += ` ORDER BY c.created_at DESC LIMIT ? OFFSET ?`;
      params.push(limit, (page - 1) * limit);
      
      const result = await queryDatabase(query, params);
      console.log('📱 [Next.js API] Comments query result:', result);
      
      // Also fetch markers for the same tracks
      let markersQuery = `
        SELECT 
          m.*,
          t.name as track_name
        FROM markers m
        LEFT JOIN tracks t ON m.track_id = t.id
      `;
      let markersParams: any[] = [];
      
      if (trackId) {
        markersQuery += ` WHERE m.track_id = ?`;
        markersParams.push(trackId);
      }
      
      markersQuery += ` ORDER BY m.time ASC`;
      
      const markersResult = await queryDatabase(markersQuery, markersParams);
      console.log('📱 [Next.js API] Markers query result:', markersResult);
      
      // Map database fields to frontend expected format
      const mappedComments = (result.data || []).map((comment: any) => ({
        id: comment.id,
        content: comment.content,
        timePosition: comment.timestamp, // Fixed: database uses 'timestamp' not 'time_position'
        trackId: comment.track_id,
        trackName: comment.track_name,
        userId: comment.user_id,
        userEmail: comment.user_email,
        createdAt: comment.created_at,
        updatedAt: comment.updated_at
      }));
      
      const mappedMarkers = (markersResult.data || []).map((marker: any) => ({
        id: marker.id,
        label: marker.wave_surfer_region_id, // Using wave_surfer_region_id as label since there's no label field
        timePosition: marker.time, // Fixed: database uses 'time' not 'time_position'
        duration: marker.duration,
        commentId: marker.comment_id,
        trackId: marker.track_id,
        trackName: marker.track_name,
        createdAt: marker.created_at
      }));
      
      console.log('📱 [Next.js API] Mapped comments:', mappedComments.length);
      console.log('📱 [Next.js API] Mapped markers:', mappedMarkers.length);
    
      // Calculate total count for pagination
      const totalQuery = trackId 
        ? `SELECT COUNT(*) as total FROM comments WHERE track_id = ?`
        : `SELECT COUNT(*) as total FROM comments`;
      const totalParams = trackId ? [trackId] : [];
      const totalResult = await queryDatabase(totalQuery, totalParams);
      const total = totalResult.data?.[0]?.total || 0;
      
      // Return format expected by CommentsProvider
      const response = NextResponse.json({
        data: {
          comments: mappedComments,
          markers: mappedMarkers,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
          }
        },
        success: result.success && markersResult.success,
        message: result.message || 'Database query completed',
        debug: {
          dbPath: dbConnection.path,
          dbConnected: dbConnection.connected,
          queryAttempted: true,
          commentsCount: mappedComments.length,
          markersCount: mappedMarkers.length,
          trackId: trackId || 'all'
        }
      });
      
      return addCorsHeaders(response, request.headers.get('origin') || undefined);
    } else {
      // Database not accessible, return empty arrays
      console.log('📱 [Next.js API] Database not accessible:', dbConnection.message);
      
      const errorResponse = NextResponse.json({
        data: {
          comments: [],
          markers: [],
          pagination: {
            page: 1,
            limit: 100,
            total: 0,
            totalPages: 1
          }
        },
        success: false,
        message: `Database not accessible: ${dbConnection.message}`,
        debug: {
          dbPath: dbConnection.path,
          dbConnected: false,
          cwd: process.cwd()
        }
      });
      
      return addCorsHeaders(errorResponse, request.headers.get('origin') || undefined);
    }
    
  } catch (error) {
    console.error('📱 [Next.js API] Comments error:', error);
    
    const errorResponse = NextResponse.json({
      data: [],
      success: false,
      error: 'Failed to fetch comments'
    }, { status: 500 });
    
    return addCorsHeaders(errorResponse);
  }
}

export async function POST(request: NextRequest) {
  console.log('📱 [Next.js API] POST /api/comments called');
  
  try {
    const body = await request.json();
    const { content, trackId, userId, timestamp } = body;
    
    console.log('📱 [Next.js API] Comment creation request:', { content, trackId, userId, timestamp });
    
    // Validate required fields
    if (!content || !trackId || !userId || timestamp === undefined) {
      const errorResponse = NextResponse.json({
        success: false,
        error: 'Missing required fields: content, trackId, userId, timestamp'
      }, { status: 400 });
      
      return addCorsHeaders(errorResponse, request.headers.get('origin') || undefined);
    }
    
    // Connect to database
    const dbConnection = await connectToDatabase();
    console.log('📱 [Next.js API] Database connection for POST:', dbConnection);
    
    if (dbConnection.connected) {
      // Generate a unique ID for the comment
      const commentId = `comment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Insert the new comment
      const insertResult = await writeDatabase(
        `INSERT INTO comments (id, content, track_id, user_id, timestamp, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, unixepoch(), unixepoch())`,
        [commentId, content, trackId, userId, timestamp]
      );
      
      console.log('📱 [Next.js API] Comment insert result:', insertResult);
      
      if (insertResult.success) {
        // Fetch the created comment with user and track info
        const createdCommentResult = await queryDatabase(
          `SELECT 
            c.*,
            u.email as user_email,
            t.name as track_name
           FROM comments c
           LEFT JOIN users u ON c.user_id = u.id  
           LEFT JOIN tracks t ON c.track_id = t.id
           WHERE c.id = ?`,
          [commentId]
        );
        
        if (createdCommentResult.success && createdCommentResult.data.length > 0) {
          const comment = createdCommentResult.data[0];
          const mappedComment = {
            id: comment.id,
            content: comment.content,
            timePosition: comment.timestamp,
            trackId: comment.track_id,
            trackName: comment.track_name,
            userId: comment.user_id,
            userEmail: comment.user_email,
            createdAt: comment.created_at,
            updatedAt: comment.updated_at
          };
          
          const response = NextResponse.json({
            data: mappedComment,
            success: true,
            message: 'Comment created successfully'
          });
          
          return addCorsHeaders(response, request.headers.get('origin') || undefined);
        } else {
          const errorResponse = NextResponse.json({
            success: false,
            error: 'Failed to fetch created comment'
          }, { status: 500 });
          
          return addCorsHeaders(errorResponse, request.headers.get('origin') || undefined);
        }
      } else {
        const errorResponse = NextResponse.json({
          success: false,
          error: `Failed to create comment: ${insertResult.message}`
        }, { status: 500 });
        
        return addCorsHeaders(errorResponse, request.headers.get('origin') || undefined);
      }
    } else {
      const errorResponse = NextResponse.json({
        success: false,
        error: `Database not accessible: ${dbConnection.message}`
      }, { status: 500 });
      
      return addCorsHeaders(errorResponse, request.headers.get('origin') || undefined);
    }
    
  } catch (error) {
    console.error('📱 [Next.js API] POST Comments error:', error);
    
    const errorResponse = NextResponse.json({
      success: false,
      error: 'Failed to create comment'
    }, { status: 500 });
    
    return addCorsHeaders(errorResponse);
  }
} 