import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  console.log('📱 [Next.js API] /api/playlists called from mobile');
  
  try {
    // For now, return empty array until we connect to the backend database
    const playlists = [];
    
    console.log('📱 [Next.js API] Returning playlists:', playlists.length);
    
    return NextResponse.json({
      data: playlists,
      success: true,
      message: 'Playlists API working - database connection coming in Phase 4'
    });
    
  } catch (error) {
    console.error('📱 [Next.js API] Playlists error:', error);
    
    return NextResponse.json({
      data: [],
      success: false,
      error: 'Failed to fetch playlists'
    }, { status: 500 });
  }
} 