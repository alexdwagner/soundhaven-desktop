import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, queryDatabase } from '../../lib/database';
import { addCorsHeaders, handleOptionsRequest } from '../../utils/cors';

export async function OPTIONS(request: NextRequest) {
  return handleOptionsRequest(request.headers);
}

// API Route startup logging
console.log('📱 [Tracks API] Route loaded successfully');
console.log('📱 [Tracks API] Available methods: GET, OPTIONS');
console.log('📱 [Tracks API] Database integration: SQLite with metadata extraction');

export async function GET(request: NextRequest) {
  console.log('📱 [Next.js API] /api/tracks called from mobile');
  
  try {
    // Test database connection
    const dbConnection = await connectToDatabase();
    console.log('📱 [Next.js API] Database connection:', dbConnection);
    
    if (dbConnection.connected) {
      // Try to query tracks from the actual database
      const result = await queryDatabase(`
        SELECT 
          t.*,
          a.name as artist_name,
          al.name as album_name,
          al.album_art_path
        FROM tracks t
        LEFT JOIN artists a ON t.artist_id = a.id  
        LEFT JOIN albums al ON t.album_id = al.id
        ORDER BY t.created_at DESC LIMIT 10
      `);
      
      // console.log('📱 [Next.js API] Database query result:', result);
      
      // Map database fields to frontend expected format
      const mappedTracks = (result.data || []).map((track: any) => ({
        id: track.id,
        name: track.name,
        duration: track.duration,
        artistId: track.artist_id,
        artistName: track.artist_name || 'Unknown Artist',
        albumId: track.album_id, 
        albumName: track.album_name || 'Unknown Album',
        albumArtPath: track.album_art_path,
        filePath: track.file_path,  // Use original file path for desktop compatibility
        streamingUrl: `/audio/${track.id}`,  // Mobile streaming URL (not implemented yet)
        fileSize: track.file_size,
        format: track.format,
        bitrate: track.bitrate,
        sampleRate: track.sample_rate,
        channels: track.channels,
        year: track.year,
        genre: track.genre,
        trackNumber: track.track_number,
        userId: track.user_id,
        createdAt: track.created_at,
        updatedAt: track.updated_at
      }));
      
      console.log('📱 [Next.js API] Mapped tracks:', mappedTracks.length);
      console.log('📱 [Next.js API] First track sample:', mappedTracks[0]);
      
      const response = NextResponse.json({
        data: mappedTracks,
        success: result.success,
        message: result.message || 'Database query completed',
        debug: {
          dbPath: dbConnection.path,
          dbConnected: dbConnection.connected,
          queryAttempted: true,
          originalCount: result.data?.length || 0,
          mappedCount: mappedTracks.length
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
    console.error('📱 [Next.js API] Tracks error:', error);
    
    const errorResponse = NextResponse.json({
      data: [],
      success: false,
      error: 'Failed to fetch tracks',
      debug: {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    }, { status: 500 });
    
    return addCorsHeaders(errorResponse);
  }
} 