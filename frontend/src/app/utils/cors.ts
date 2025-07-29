import { NextResponse } from 'next/server';

/**
 * Determines if an origin is allowed for CORS requests
 * Allows localhost:3001, 127.0.0.1:3001 and any IP in the private network ranges on port 3001
 */
function isAllowedOrigin(origin: string): boolean {
  const allowedPatterns = [
    'http://localhost:3001',
    'https://localhost:3001',
    'http://127.0.0.1:3001',
    'https://127.0.0.1:3001',
    /^https?:\/\/192\.168\.\d{1,3}\.\d{1,3}:3001$/,
    /^https?:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}:3001$/,
    /^https?:\/\/172\.(1[6-9]|2[0-9]|3[01])\.\d{1,3}\.\d{1,3}:3001$/
  ];

  return allowedPatterns.some(pattern => {
    if (typeof pattern === 'string') {
      return origin === pattern;
    }
    return pattern.test(origin);
  });
}

/**
 * Add CORS headers to a NextResponse for mobile device compatibility
 * Supports localhost and private network IP ranges on port 3001
 */
export function addCorsHeaders(response: NextResponse, requestOrigin?: string): NextResponse {
  // In development, allow any origin that matches our patterns
  const origin = requestOrigin || 'http://localhost:3001';
  
  if (isAllowedOrigin(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
  } else {
    // Fallback to 127.0.0.1 for backwards compatibility (since browsers often resolve to this)
    response.headers.set('Access-Control-Allow-Origin', 'http://127.0.0.1:3001');
  }
  
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  
  return response;
}

/**
 * Create a CORS-enabled response with proper headers
 * Automatically detects the request origin from the request headers
 */
export function createCorsResponse(data: any, init?: ResponseInit, requestHeaders?: Headers): NextResponse {
  const response = NextResponse.json(data, init);
  const origin = requestHeaders?.get('origin') || undefined;
  return addCorsHeaders(response, origin);
}

/**
 * Handle OPTIONS requests for CORS preflight
 */
export function handleOptionsRequest(requestHeaders?: Headers): NextResponse {
  const response = new NextResponse(null, { status: 200 });
  const origin = requestHeaders?.get('origin') || undefined;
  return addCorsHeaders(response, origin);
}