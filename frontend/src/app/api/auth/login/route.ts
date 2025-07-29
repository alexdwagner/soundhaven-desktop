import { NextRequest, NextResponse } from 'next/server';

// API Route startup logging
console.log('📱 [Auth Login API] Route loaded successfully');
console.log('📱 [Auth Login API] Available methods: POST');
console.log('📱 [Auth Login API] Features: User authentication, JWT tokens');

export async function POST(request: NextRequest) {
  console.log('📱 [Auth] Login request from mobile');
  
  try {
    const body = await request.json();
    console.log('📱 [Auth] Login request body:', body);
    
    // For now, return a proper error explaining auth is not implemented
    return NextResponse.json({
      error: 'Authentication not yet implemented in mobile PWA',
      message: 'User authentication will be implemented in Phase 6 - Mobile Auth',
      suggestedAction: 'Use desktop app for full authentication'
    }, { status: 501 });
    
  } catch (error) {
    console.error('📱 [Auth] Login error:', error);
    return NextResponse.json({
      error: 'Login error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  console.log('📱 [Auth] Login GET request from mobile - redirecting to main app');
  
  // Instead of JSON, redirect to main app page
  return NextResponse.redirect(new URL('/', request.url));
} 