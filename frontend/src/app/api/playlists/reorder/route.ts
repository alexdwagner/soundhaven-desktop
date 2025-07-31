import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, queryDatabase, writeDatabase } from '../../../lib/database';
import { addCorsHeaders, handleOptionsRequest } from '../../../utils/cors';

export async function OPTIONS(request: NextRequest) {
  return handleOptionsRequest(request.headers);
}

export async function PATCH(request: NextRequest) {
  console.log('📱 [Next.js API] /api/playlists/reorder PATCH called');
  
  try {
    const body = await request.json();
    const { playlistIds } = body;
    
    console.log('📱 [Next.js API] Playlist reorder request:', { playlistIds });
    
    // Validate request
    if (!Array.isArray(playlistIds)) {
      const errorResponse = NextResponse.json({
        error: 'playlistIds must be an array'
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
    
    // Update the order for each playlist
    console.log('📱 [Next.js API] Updating playlist order...');
    
    const updatePromises = playlistIds.map(async (playlistId: string, index: number) => {
      console.log(`📱 [Next.js API] Updating playlist ${playlistId} to order ${index}`);
      
      const updateResult = await writeDatabase(
        'UPDATE playlists SET "order" = ?, updated_at = datetime(\'now\') WHERE id = ?',
        [index, playlistId]
      );
      
      console.log(`📱 [Next.js API] Update result for playlist ${playlistId}:`, updateResult);
      
      // Check if the update actually affected any rows
      if ((updateResult as any).changes === 0) {
        console.error(`📱 [Next.js API] WARNING: No rows updated for playlist ${playlistId}`);
        throw new Error(`Failed to update order for playlist ${playlistId}`);
      }
      
      return updateResult;
    });
    
    // Execute all updates
    await Promise.all(updatePromises);
    
    // Fetch the updated playlists to return
    const updatedPlaylistsResult = await queryDatabase(`
      SELECT 
        p.*,
        u.email as user_email,
        COUNT(pt.track_id) as track_count
      FROM playlists p
      LEFT JOIN users u ON p.user_id = u.id  
      LEFT JOIN playlist_tracks pt ON p.id = pt.playlist_id
      GROUP BY p.id, u.email
      ORDER BY p."order" ASC
    `);
    
    // Map playlists to frontend expected format
    const mappedPlaylists = ((updatedPlaylistsResult.data as any[]) || []).map((playlist: any) => ({
      id: playlist.id,
      name: playlist.name,
      description: playlist.description,
      userId: playlist.user_id,
      userEmail: playlist.user_email,
      trackCount: playlist.track_count || 0,
      createdAt: playlist.created_at,
      updatedAt: playlist.updated_at
    }));
    
    console.log('📱 [Next.js API] Playlist order updated successfully. Updated count:', mappedPlaylists.length);
    
    const response = NextResponse.json({
      data: mappedPlaylists,
      success: true,
      message: 'Playlist order updated successfully',
      debug: {
        playlistOrderUpdated: playlistIds.length,
        finalPlaylistCount: mappedPlaylists.length
      }
    });
    
    return addCorsHeaders(response, request.headers.get('origin') || undefined);
    
  } catch (error) {
    console.error('📱 [Next.js API] Playlist reorder error:', error);
    
    const errorResponse = NextResponse.json({
      error: 'Failed to reorder playlists',
      debug: {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    }, { status: 500 });
    
    return addCorsHeaders(errorResponse, request.headers.get('origin') || undefined);
  }
}