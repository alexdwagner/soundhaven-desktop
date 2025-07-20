import { NextRequest, NextResponse } from 'next/server';
import { join } from 'path';
import { createReadStream, statSync, existsSync } from 'fs';

// Import database helper
import { queryDatabase } from '../../../lib/database';

export async function GET(
  request: NextRequest,
  { params }: { params: { trackId: string } }
) {
  const trackId = params.trackId;
  
  console.log('🎵 [Audio Streaming API] Request for track:', trackId);
  
  try {
    // Get track from database to find file path
    const result = await queryDatabase('SELECT * FROM tracks WHERE id = ?', [trackId]);
    
    if (!result.success || !result.data || result.data.length === 0) {
      console.log('🎵 [Audio Streaming API] Track not found:', trackId);
      console.log('🎵 [Audio Streaming API] Database result:', result);
      return NextResponse.json({ error: 'Track not found' }, { status: 404 });
    }
    
    const track = result.data[0];
    const filePath = track.file_path;
    console.log('🎵 [Audio Streaming API] Track file path:', filePath);
    
    // Construct absolute path to audio file
    let absolutePath: string;
    if (filePath.startsWith('/uploads/')) {
      absolutePath = join(process.cwd(), '..', 'main', filePath.substring(1));
    } else {
      absolutePath = join(process.cwd(), '..', 'main', 'uploads', filePath.replace('/uploads/', ''));
    }
    
    console.log('🎵 [Audio Streaming API] Looking for file at:', absolutePath);
    
    if (!existsSync(absolutePath)) {
      console.log('🎵 [Audio Streaming API] Audio file not found:', absolutePath);
      return NextResponse.json({ error: 'Audio file not found' }, { status: 404 });
    }
    
    const stat = statSync(absolutePath);
    const fileSize = stat.size;
    
    // Handle range requests for streaming
    const range = request.headers.get('range');
    
    if (range) {
      console.log('🎵 [Audio Streaming API] Range request:', range);
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      
      const fileStream = createReadStream(absolutePath, { start, end });
      
      return new NextResponse(fileStream as any, {
        status: 206,
        headers: {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize.toString(),
          'Content-Type': 'audio/mpeg',
          'Cache-Control': 'public, max-age=3600'
        }
      });
    } else {
      // Serve entire file
      console.log('🎵 [Audio Streaming API] Serving complete file, size:', fileSize);
      const fileStream = createReadStream(absolutePath);
      
      return new NextResponse(fileStream as any, {
        status: 200,
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Length': fileSize.toString(),
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=3600'
        }
      });
    }
    
  } catch (error) {
    console.error('🎵 [Audio Streaming API] Error:', error);
    return NextResponse.json(
      { error: 'Audio streaming error' },
      { status: 500 }
    );
  }
} 