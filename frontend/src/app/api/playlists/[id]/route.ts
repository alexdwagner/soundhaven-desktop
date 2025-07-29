import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, queryDatabase } from '../../../lib/database';
import { addCorsHeaders, handleOptionsRequest } from '../../../utils/cors';

export async function OPTIONS(request: NextRequest) {
  return handleOptionsRequest(request.headers);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  console.log('📱 [Next.js API] /api/playlists/[id] called with ID:', id);
  
  try {
    // Connect to database and fetch playlist with tracks
    const dbConnection = await connectToDatabase();
    console.log('📱 [Next.js API] Database connection:', dbConnection);
    
    if (dbConnection.connected) {
      // First get the playlist metadata
      const playlistResult = await queryDatabase(`
        SELECT 
          p.*,
          u.email as user_email
        FROM playlists p
        LEFT JOIN users u ON p.user_id = u.id  
        WHERE p.id = ?
      `, [id]);
      
      console.log('📱 [Next.js API] Playlist query result:', playlistResult);
      
      if (!playlistResult.data || playlistResult.data.length === 0) {
        const notFoundResponse = NextResponse.json({
          error: 'Playlist not found'
        }, { status: 404 });
        return addCorsHeaders(notFoundResponse, request.headers.get('origin') || undefined);
      }
      
      const playlist = playlistResult.data[0];
      
      // Get tracks in this playlist with proper ordering
      const tracksResult = await queryDatabase(`
        SELECT 
          t.*,
          a.name as artist_name,
          al.name as album_name,
          al.album_art_path,
          pt."order" as playlist_position
        FROM playlist_tracks pt
        JOIN tracks t ON pt.track_id = t.id
        LEFT JOIN artists a ON t.artist_id = a.id  
        LEFT JOIN albums al ON t.album_id = al.id
        WHERE pt.playlist_id = ?
        ORDER BY pt."order" ASC
      `, [id]);
      
      console.log('📱 [Next.js API] Tracks query result:', tracksResult);
      
      // Map tracks to frontend expected format
      const mappedTracks = (tracksResult.data || []).map((track: any) => ({
        id: track.id,
        name: track.name,
        duration: track.duration,
        artistId: track.artist_id,
        artistName: track.artist_name || 'Unknown Artist',
        albumId: track.album_id, 
        albumName: track.album_name || 'Unknown Album',
        albumArtPath: track.album_art_path,
        filePath: track.file_path,
        streamingUrl: `/audio/${track.id}`,
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
        updatedAt: track.updated_at,
        playlistPosition: track.playlist_position
      }));
      
      // Map playlist to frontend expected format
      const mappedPlaylist = {
        id: playlist.id,
        name: playlist.name,
        description: playlist.description,
        userId: playlist.user_id,
        userEmail: playlist.user_email,
        tracks: mappedTracks,
        trackCount: mappedTracks.length,
        createdAt: playlist.created_at,
        updatedAt: playlist.updated_at
      };
      
      console.log('📱 [Next.js API] Mapped playlist:', mappedPlaylist.name);
      console.log('📱 [Next.js API] Mapped tracks count:', mappedTracks.length);
      
      const response = NextResponse.json({
        data: mappedPlaylist,
        success: true,
        message: 'Playlist fetched successfully',
        debug: {
          dbPath: dbConnection.path,
          dbConnected: dbConnection.connected,
          playlistId: id,
          tracksCount: mappedTracks.length
        }
      });
      
      return addCorsHeaders(response, request.headers.get('origin') || undefined);
    } else {
      // Database not accessible
      console.log('📱 [Next.js API] Database not accessible:', dbConnection.message);
      
      const errorResponse = NextResponse.json({
        error: 'Database not accessible',
        message: dbConnection.message,
        debug: {
          dbPath: dbConnection.path,
          dbConnected: false,
          cwd: process.cwd()
        }
      }, { status: 500 });
      
      return addCorsHeaders(errorResponse, request.headers.get('origin') || undefined);
    }
    
  } catch (error) {
    console.error('📱 [Next.js API] Playlist by ID error:', error);
    
    const errorResponse = NextResponse.json({
      error: 'Failed to fetch playlist',
      debug: {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        playlistId: id
      }
    }, { status: 500 });
    
    return addCorsHeaders(errorResponse);
  }
}