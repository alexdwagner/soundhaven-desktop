import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, queryDatabase } from '../../lib/database';
import { addCorsHeaders, handleOptionsRequest } from '../../utils/cors';

// API Route startup logging
console.log('📱 [Playlists API] Route loaded successfully');
console.log('📱 [Playlists API] Available methods: GET, POST, OPTIONS');
console.log('📱 [Playlists API] Features: CRUD operations, track associations, mobile support');

export async function OPTIONS(request: NextRequest) {
  return handleOptionsRequest(request.headers);
}

export async function GET(request: NextRequest) {
  console.log('📱 [Next.js API] /api/playlists called from mobile');
  
  try {
    // Connect to database and fetch real playlists
    const dbConnection = await connectToDatabase();
    console.log('📱 [Next.js API] Database connection:', dbConnection);
    
    if (dbConnection.connected) {
      // Query playlists from the actual database
      const result = await queryDatabase(`
        SELECT 
          p.*,
          u.email as user_email,
          COUNT(pt.track_id) as track_count
        FROM playlists p
        LEFT JOIN users u ON p.user_id = u.id  
        LEFT JOIN playlist_tracks pt ON p.id = pt.playlist_id
        GROUP BY p.id, u.email
        ORDER BY p.created_at DESC
      `);
      
      console.log('📱 [Next.js API] Database query result:', result);
      
      // Map database fields to frontend expected format
      const mappedPlaylists = (result.data || []).map((playlist: any) => ({
        id: playlist.id,
        name: playlist.name,
        description: playlist.description,
        userId: playlist.user_id,
        userEmail: playlist.user_email,
        trackCount: playlist.track_count || 0,
        createdAt: playlist.created_at,
        updatedAt: playlist.updated_at
      }));
      
      console.log('📱 [Next.js API] Mapped playlists:', mappedPlaylists.length);
    
      const response = NextResponse.json({
        data: mappedPlaylists,
        success: result.success,
        message: result.message || 'Database query completed',
        debug: {
          dbPath: dbConnection.path,
          dbConnected: dbConnection.connected,
          queryAttempted: true,
          originalCount: result.data?.length || 0,
          mappedCount: mappedPlaylists.length
        }
      });
      
      return addCorsHeaders(response, request.headers.get('origin') || undefined);
    } else {
      // Database not accessible, return empty array
      console.log('📱 [Next.js API] Database not accessible:', dbConnection.message);
      
      const errorResponse = NextResponse.json({
        data: [],
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
    console.error('📱 [Next.js API] Playlists error:', error);
    
    const errorResponse = NextResponse.json({
      data: [],
      success: false,
      error: 'Failed to fetch playlists'
    }, { status: 500 });
    
    return addCorsHeaders(errorResponse);
  }
} 