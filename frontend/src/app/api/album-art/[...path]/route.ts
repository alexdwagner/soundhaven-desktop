import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const filename = params.path?.join('/') || '';
  
  console.log('📱 [Album Art API] ===============================');
  console.log('📱 [Album Art API] NEW REQUEST RECEIVED');
  console.log('📱 [Album Art API] Request for:', filename);
  console.log('📱 [Album Art API] Full URL:', request.url);
  console.log('📱 [Album Art API] Method:', request.method);
  console.log('📱 [Album Art API] Headers:', Object.fromEntries(request.headers.entries()));
  console.log('📱 [Album Art API] Params:', params);
  console.log('📱 [Album Art API] ===============================');
  
  try {
    // Construct the full path to the album art file
    const albumArtPath = join(process.cwd(), '..', 'main', 'uploads', 'album-art', filename);
    
    console.log('📱 [Album Art API] Looking for file at:', albumArtPath);
    console.log('📱 [Album Art API] File exists:', existsSync(albumArtPath));
    
    if (!existsSync(albumArtPath)) {
      console.log('📱 [Album Art API] File not found, returning transparent PNG');
      
      // Return a 1x1 transparent PNG as fallback
      const transparentPng = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
        'base64'
      );
      
      return new NextResponse(transparentPng, {
        status: 200,
        headers: {
          'Content-Type': 'image/png',
          'Content-Length': transparentPng.length.toString(),
          'Cache-Control': 'public, max-age=3600'
        }
      });
    }
    
    // Read and serve the actual album art file
    const fileBuffer = await readFile(albumArtPath);
    const fileExtension = filename.split('.').pop()?.toLowerCase() || 'jpg';
    
    let contentType = 'image/jpeg';
    if (fileExtension === 'png') contentType = 'image/png';
    else if (fileExtension === 'gif') contentType = 'image/gif';
    else if (fileExtension === 'webp') contentType = 'image/webp';
    
    console.log('📱 [Album Art API] Serving file:', filename, 'Type:', contentType, 'Size:', fileBuffer.length);
    
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': fileBuffer.length.toString(),
        'Cache-Control': 'public, max-age=3600'
      }
    });
    
  } catch (error) {
    console.error('📱 [Album Art API] Error serving album art:', error);
    
    // Return transparent PNG on error
    const transparentPng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      'base64'
    );
    
    return new NextResponse(transparentPng, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Content-Length': transparentPng.length.toString(),
        'Cache-Control': 'public, max-age=3600'
      }
    });
  }
} 