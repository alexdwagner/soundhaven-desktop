import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  console.log('📱 [Login Route] Direct login route accessed from mobile - redirecting to home');
  
  // Redirect to main app instead of showing JSON
  return NextResponse.redirect(new URL('/', request.url));
} 