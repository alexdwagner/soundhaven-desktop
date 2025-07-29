import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, queryDatabase, writeDatabase } from '../../../../lib/database';
import { addCorsHeaders, handleOptionsRequest } from '../../../../utils/cors';

export async function OPTIONS(request: NextRequest) {
  return handleOptionsRequest(request.headers);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: playlistId } = await params;
  console.log('📱 [Next.js API] /api/playlists/[id]/track-order PATCH called with ID:', playlistId);
  
  try {
    // Parse request body
    const body = await request.json();
    const { trackIds } = body;
    
    console.log('📱 [Next.js API] Track order update request body:', { trackIds });
    
    // Validate request
    if (!playlistId) {
      const errorResponse = NextResponse.json({
        error: 'Invalid playlist ID'
      }, { status: 400 });
      return addCorsHeaders(errorResponse, request.headers.get('origin') || undefined);
    }
    
    if (!Array.isArray(trackIds)) {
      const errorResponse = NextResponse.json({
        error: 'trackIds must be an array'
      }, { status: 400 });
      return addCorsHeaders(errorResponse, request.headers.get('origin') || undefined);
    }
    
    // Connect to database
    const dbConnection = await connectToDatabase();
    console.log('📱 [Next.js API] Database connection:', dbConnection);
    
    if (!dbConnection.connected) {
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
    
    // First, verify that the playlist exists
    const playlistCheck = await queryDatabase(`
      SELECT id FROM playlists WHERE id = ?
    `, [playlistId]);
    
    if (!playlistCheck.data || (playlistCheck.data as any[]).length === 0) {
      const errorResponse = NextResponse.json({
        error: 'Playlist not found'
      }, { status: 404 });
      return addCorsHeaders(errorResponse, request.headers.get('origin') || undefined);
    }
    
    // Get current tracks in the playlist to verify the provided track IDs exist
    const currentTracksResult = await queryDatabase(`
      SELECT id, track_id, "order" FROM playlist_tracks 
      WHERE playlist_id = ? 
      ORDER BY "order" ASC
    `, [playlistId]);
    
    console.log('📱 [Next.js API] Current tracks in database:', currentTracksResult.data);
    
    if (!currentTracksResult.data || (currentTracksResult.data as any[]).length === 0) {
      const errorResponse = NextResponse.json({
        error: 'No tracks found in playlist'
      }, { status: 404 });
      return addCorsHeaders(errorResponse, request.headers.get('origin') || undefined);
    }
    
    const currentTracks = currentTracksResult.data as any[];
    const existingTrackIds = currentTracks.map(track => track.id.toString());
    
    // Validate that all provided trackIds exist in the playlist
    const invalidTrackIds = trackIds.filter(id => !existingTrackIds.includes(id.toString()));
    if (invalidTrackIds.length > 0) {
      const errorResponse = NextResponse.json({
        error: 'Some track IDs do not exist in this playlist',
        invalidTrackIds
      }, { status: 400 });
      return addCorsHeaders(errorResponse, request.headers.get('origin') || undefined);
    }
    
    // Update the order for each track
    console.log('📱 [Next.js API] Updating playlist track order for playlist:', playlistId);
    console.log('📱 [Next.js API] Received trackIds (playlist_track_ids):', trackIds);
    
    const updatePromises = trackIds.map(async (playlistTrackId: string, index: number) => {
      // Convert to integer to ensure proper database matching
      const playlistTrackIdInt = parseInt(playlistTrackId, 10);
      console.log(`📱 [Next.js API] Updating playlist_track_id ${playlistTrackId} (${playlistTrackIdInt}) to order ${index}`);
      
      const updateResult = await writeDatabase(
        'UPDATE playlist_tracks SET "order" = ? WHERE playlist_id = ? AND id = ?',
        [index, playlistId, playlistTrackIdInt]
      );
      
      console.log(`📱 [Next.js API] Update result for playlist_track_id ${playlistTrackIdInt}:`, updateResult);
      
      // Check if the update actually affected any rows
      if ((updateResult as any).changes === 0) {
        console.error(`📱 [Next.js API] WARNING: No rows updated for playlist_track_id ${playlistTrackIdInt}`);
        throw new Error(`Failed to update track order for playlist_track_id ${playlistTrackIdInt}`);
      }
      
      return updateResult;
    });
    
    // Execute all updates
    await Promise.all(updatePromises);
    
    // Fetch the updated playlist with tracks to return
    const updatedPlaylistResult = await queryDatabase(`
      SELECT 
        p.*,
        u.email as user_email
      FROM playlists p
      LEFT JOIN users u ON p.user_id = u.id  
      WHERE p.id = ?
    `, [playlistId]);
    
    const updatedTracksResult = await queryDatabase(`
      SELECT 
        t.*,
        a.name as artist_name,
        al.name as album_name,
        al.album_art_path,
        pt."order" as playlist_position,
        pt.id as playlist_track_id
      FROM playlist_tracks pt
      JOIN tracks t ON pt.track_id = t.id
      LEFT JOIN artists a ON t.artist_id = a.id  
      LEFT JOIN albums al ON t.album_id = al.id
      WHERE pt.playlist_id = ?
      ORDER BY pt."order" ASC
    `, [playlistId]);
    
    // Map tracks to frontend expected format
    const mappedTracks = ((updatedTracksResult.data as any[]) || []).map((track: any) => ({
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
      playlistPosition: track.playlist_position,
      playlistTrackId: track.playlist_track_id
    }));
    
    // Map playlist to frontend expected format
    const playlist = (updatedPlaylistResult.data as any[])[0];
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
    
    console.log('📱 [Next.js API] Track order updated successfully. New track count:', mappedTracks.length);
    
    const response = NextResponse.json({
      data: mappedPlaylist,
      success: true,
      message: 'Track order updated successfully',
      debug: {
        playlistId,
        trackOrderUpdated: trackIds.length,
        finalTrackCount: mappedTracks.length
      }
    });
    
    return addCorsHeaders(response, request.headers.get('origin') || undefined);
    
  } catch (error) {
    console.error('📱 [Next.js API] Track order update error:', error);
    
    const errorResponse = NextResponse.json({
      error: 'Failed to update track order',
      debug: {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        playlistId
      }
    }, { status: 500 });
    
    return addCorsHeaders(errorResponse, request.headers.get('origin') || undefined);
  }
}