import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  console.log('📱 [Next.js API] /api/comments called from mobile');
  
  try {
    // Get trackId from query params if provided
    const { searchParams } = new URL(request.url);
    const trackId = searchParams.get('trackId');
    
    // For now, return empty array until we connect to the backend database
    const comments = [];
    
    console.log('📱 [Next.js API] Returning comments:', comments.length, trackId ? `for track ${trackId}` : 'for all tracks');
    
    // Return format expected by CommentsProvider - data should BE the comments object
    return NextResponse.json({
      data: {
        comments: comments,  // Array of comments
        markers: [],         // Array of markers  
        pagination: {
          page: 1,
          limit: 100,
          total: 0,
          totalPages: 1
        }
      },
      success: true,
      message: 'Comments API working - database connection coming in Phase 4'
    });
    
  } catch (error) {
    console.error('📱 [Next.js API] Comments error:', error);
    
    return NextResponse.json({
      data: [],
      success: false,
      error: 'Failed to fetch comments'
    }, { status: 500 });
  }
} 