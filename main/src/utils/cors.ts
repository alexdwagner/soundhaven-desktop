/**
 * CORS utility for SoundHaven Electron main process
 * Handles Cross-Origin Resource Sharing for mobile and local network access
 */

export interface CorsOptions {
  allowCredentials?: boolean;
  maxAge?: string;
  additionalHeaders?: string[];
}

/**
 * Allowed origins for CORS requests
 * Includes localhost, 127.0.0.1, and private network ranges (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
 * Supports both HTTP and HTTPS, and allows common development ports
 */
export const ALLOWED_ORIGINS = [
  // Localhost variants - HTTP
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:8080',
  'http://localhost:8081',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:8080',
  'http://127.0.0.1:8081',
  
  // Localhost variants - HTTPS
  'https://localhost:3000',
  'https://localhost:3001',
  'https://localhost:8080',
  'https://localhost:8081',
  'https://127.0.0.1:3000',
  'https://127.0.0.1:3001',
  'https://127.0.0.1:8080',
  'https://127.0.0.1:8081',
  
  // Private network ranges (RFC 1918) - HTTP with extended port range
  /^https?:\/\/192\.168\.\d+\.\d+:(3000|3001|8080|8081|\d{4,5})$/,           // 192.168.0.0/16
  /^https?:\/\/10\.\d+\.\d+\.\d+:(3000|3001|8080|8081|\d{4,5})$/,            // 10.0.0.0/8
  /^https?:\/\/172\.(1[6-9]|2\d|3[01])\.\d+\.\d+:(3000|3001|8080|8081|\d{4,5})$/ // 172.16.0.0/12
];

/**
 * Determine if an origin is allowed based on CORS policy
 */
export function isOriginAllowed(origin: string): boolean {
  return ALLOWED_ORIGINS.some(allowed => {
    if (typeof allowed === 'string') {
      return origin === allowed;
    } else {
      return allowed.test(origin);
    }
  });
}

/**
 * Get appropriate CORS origin header value based on request origin
 */
export function getCorsOrigin(requestOrigin?: string): string {
  if (!requestOrigin) {
    return '*';
  }

  return isOriginAllowed(requestOrigin) ? requestOrigin : '*';
}

/**
 * Generate CORS headers for HTTP responses
 */
export function getCorsHeaders(requestOrigin?: string, options: CorsOptions = {}): Record<string, string> {
  const {
    allowCredentials = true,
    maxAge = '86400',
    additionalHeaders = []
  } = options;

  const corsOrigin = getCorsOrigin(requestOrigin);
  const baseHeaders = ['Content-Type', 'Range', 'Authorization'];
  const allowedHeaders = [...baseHeaders, ...additionalHeaders].join(', ');

  const headers: Record<string, string> = {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': allowedHeaders,
    'Access-Control-Max-Age': maxAge,
  };

  if (allowCredentials && corsOrigin !== '*') {
    headers['Access-Control-Allow-Credentials'] = 'true';
  }

  return headers;
}

/**
 * Handle CORS preflight (OPTIONS) requests
 */
export function handleCorsPrelight(res: any, requestOrigin?: string, options?: CorsOptions): void {
  const headers = getCorsHeaders(requestOrigin, options);
  
  res.writeHead(200, headers);
  res.end();
}

/**
 * Apply CORS headers to an HTTP response
 */
export function applyCorsHeaders(res: any, requestOrigin?: string, options?: CorsOptions): void {
  const headers = getCorsHeaders(requestOrigin, options);
  
  Object.entries(headers).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
}

/**
 * Log CORS information for debugging
 */
export function logCorsRequest(requestOrigin?: string, userAgent?: string): void {
  const corsOrigin = getCorsOrigin(requestOrigin);
  const isAllowed = requestOrigin ? isOriginAllowed(requestOrigin) : false;
  
  console.log(`[CORS] Request from origin: ${requestOrigin || 'none'}`);
  console.log(`[CORS] Origin allowed: ${isAllowed}`);
  console.log(`[CORS] CORS origin header: ${corsOrigin}`);
  
  if (userAgent) {
    console.log(`[CORS] User agent: ${userAgent}`);
    // Enhanced mobile device detection
    const isMobile = /Mobile|Android|iPhone|iPad|webOS|BlackBerry|Windows Phone/i.test(userAgent);
    if (isMobile) {
      console.log(`[CORS] Mobile device detected`);
    }
  }
  
  // Additional debugging for IP-based requests
  if (requestOrigin && /192\.168|10\.|172\./.test(requestOrigin)) {
    console.log(`[CORS] Local network request detected from: ${requestOrigin}`);
  }
  
  if (!isAllowed && requestOrigin) {
    console.warn(`[CORS] ⚠️  Request REJECTED from origin: ${requestOrigin}`);
    console.warn(`[CORS] ⚠️  If this is a mobile device on your local network, ensure the IP and port are correct`);
  }
}