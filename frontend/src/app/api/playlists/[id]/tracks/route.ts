import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, queryDatabase, writeDatabase } from '../../../../lib/database';
import { addCorsHeaders, handleOptionsRequest } from '../../../../utils/cors';

export async function OPTIONS(request: NextRequest) {
  return handleOptionsRequest(request.headers);
}

// Add track to playlist
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: playlistId } = await params;
  console.log('📱 [Next.js API] /api/playlists/[id]/tracks POST called with playlist ID:', playlistId);
  
  try {
    const body = await request.json();
    const { trackId } = body;
    
    console.log('📱 [Next.js API] Adding track to playlist:', { playlistId, trackId });
    
    // Validate input
    if (!trackId) {
      const errorResponse = NextResponse.json({
        error: 'Track ID is required'
      }, { status: 400 });
      return addCorsHeaders(errorResponse, request.headers.get('origin') || undefined);
    }
    
    // Connect to database
    const dbConnection = await connectToDatabase();
    
    if (!dbConnection.connected) {
      const errorResponse = NextResponse.json({
        error: 'Database not accessible',
        message: dbConnection.message
      }, { status: 500 });
      return addCorsHeaders(errorResponse, request.headers.get('origin') || undefined);
    }
    
    // Check if playlist exists
    const playlistCheck = await queryDatabase(`
      SELECT id FROM playlists WHERE id = ?
    `, [playlistId]);
    
    if (!playlistCheck.data || playlistCheck.data.length === 0) {
      const errorResponse = NextResponse.json({
        error: 'Playlist not found'
      }, { status: 404 });
      return addCorsHeaders(errorResponse, request.headers.get('origin') || undefined);
    }
    
    // Check if track exists
    const trackCheck = await queryDatabase(`
      SELECT id FROM tracks WHERE id = ?
    `, [trackId]);
    
    if (!trackCheck.data || trackCheck.data.length === 0) {
      const errorResponse = NextResponse.json({
        error: 'Track not found'
      }, { status: 404 });
      return addCorsHeaders(errorResponse, request.headers.get('origin') || undefined);
    }
    
    // Get the next order value
    const orderResult = await queryDatabase(`
      SELECT MAX("order") as max_order FROM playlist_tracks WHERE playlist_id = ?
    `, [playlistId]);
    
    const nextOrder = ((orderResult.data as any[])[0]?.max_order ?? -1) + 1;
    
    // Insert the track into the playlist
    const insertResult = await writeDatabase(
      'INSERT INTO playlist_tracks (track_id, playlist_id, "order") VALUES (?, ?, ?)',
      [trackId, playlistId, nextOrder]
    );
    
    console.log('📱 [Next.js API] Insert result:', insertResult);
    
    const response = NextResponse.json({
      success: true,
      message: 'Track added to playlist successfully',
      data: {
        trackId,
        playlistId,
        order: nextOrder
      }
    });
    
    return addCorsHeaders(response, request.headers.get('origin') || undefined);
    
  } catch (error) {
    console.error('📱 [Next.js API] Add track to playlist error:', error);
    
    const errorResponse = NextResponse.json({
      error: 'Failed to add track to playlist',
      debug: {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        playlistId
      }
    }, { status: 500 });
    
    return addCorsHeaders(errorResponse, request.headers.get('origin') || undefined);
  }
}

// Remove track from playlist
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: playlistId } = await params;
  console.log('📱 [Next.js API] /api/playlists/[id]/tracks DELETE called with playlist ID:', playlistId);
  
  try {
    const body = await request.json();
    const { trackId, playlistTrackId } = body;
    
    console.log('📱 [Next.js API] Removing track from playlist:', { playlistId, trackId, playlistTrackId });
    
    // Connect to database
    const dbConnection = await connectToDatabase();
    
    if (!dbConnection.connected) {
      const errorResponse = NextResponse.json({
        error: 'Database not accessible',
        message: dbConnection.message
      }, { status: 500 });
      return addCorsHeaders(errorResponse, request.headers.get('origin') || undefined);
    }
    
    let deleteResult;
    
    if (playlistTrackId) {
      // Delete by playlist_track_id (for duplicate support)
      deleteResult = await writeDatabase(
        'DELETE FROM playlist_tracks WHERE playlist_id = ? AND id = ?',
        [playlistId, playlistTrackId]
      );
    } else if (trackId) {
      // Delete by track_id (will remove first occurrence using rowid)
      deleteResult = await writeDatabase(
        'DELETE FROM playlist_tracks WHERE rowid = (SELECT rowid FROM playlist_tracks WHERE playlist_id = ? AND track_id = ? LIMIT 1)',
        [playlistId, trackId]
      );
    } else {
      const errorResponse = NextResponse.json({
        error: 'Either trackId or playlistTrackId is required'
      }, { status: 400 });
      return addCorsHeaders(errorResponse, request.headers.get('origin') || undefined);
    }
    
    console.log('📱 [Next.js API] Delete result:', deleteResult);
    
    if ((deleteResult as any).changes === 0) {
      const errorResponse = NextResponse.json({
        error: 'Track not found in playlist'
      }, { status: 404 });
      return addCorsHeaders(errorResponse, request.headers.get('origin') || undefined);
    }
    
    // Reorder remaining tracks
    const remainingTracks = await queryDatabase(`
      SELECT * FROM playlist_tracks WHERE playlist_id = ? ORDER BY "order"
    `, [playlistId]);
    
    // Update order for each remaining track
    const reorderPromises = ((remainingTracks.data as any[]) || []).map((track, index) => 
      writeDatabase(
        'UPDATE playlist_tracks SET "order" = ? WHERE playlist_id = ? AND id = ?',
        [index, playlistId, track.id]
      )
    );
    
    await Promise.all(reorderPromises);
    
    const response = NextResponse.json({
      success: true,
      message: 'Track removed from playlist successfully'
    });
    
    return addCorsHeaders(response, request.headers.get('origin') || undefined);
    
  } catch (error) {
    console.error('📱 [Next.js API] Remove track from playlist error:', error);
    
    const errorResponse = NextResponse.json({
      error: 'Failed to remove track from playlist',
      debug: {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        playlistId
      }
    }, { status: 500 });
    
    return addCorsHeaders(errorResponse, request.headers.get('origin') || undefined);
  }
}