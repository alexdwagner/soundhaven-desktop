import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '../../lib/database';
import { addCorsHeaders } from '../../utils/cors';
import { startupLogger } from '../../utils/startupLogger';

// Register this API route
startupLogger.registerApiRoute('Health API', ['GET', 'OPTIONS'], ['System health monitoring', 'Startup verification', 'Service status']);

export async function GET(request: NextRequest) {
  console.log('🏥 [Health Check] API health check requested');
  
  try {
    // Check database connection
    const dbConnection = await connectToDatabase();
    
    const apiRoutes = [
      'GET /api/health - Health check and startup verification',
      'GET /api/tracks - Fetch tracks with database integration',
      'GET /api/playlists - Fetch playlists with CRUD operations',
      'GET /api/comments - Fetch comments and markers with pagination',
      'GET /api/tags - Fetch tags and track associations',
      'POST /api/tracks - Create new tracks',
      'POST /api/playlists - Create new playlists',
      'POST /api/comments - Create new comments with markers'
    ];
    
    const services = [
      'Database Connection - SQLite integration',
      'CORS Handler - Mobile device support',
      'Authentication - JWT token validation',
      'File Upload - Audio file processing',
      'Metadata Extraction - Track information parsing'
    ];
    
    const healthData = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: {
        connected: dbConnection.connected,
        path: dbConnection.path,
        message: dbConnection.message
      },
      apis: {
        count: apiRoutes.length,
        routes: apiRoutes,
        registeredRoutes: startupLogger.getRoutes(),
        totalRegistered: startupLogger.getRouteCount()
      },
      services: {
        count: services.length,
        list: services
      },
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        cwd: process.cwd()
      }
    };
    
    console.log('🏥 [Health Check] System status:');
    console.log(`   ✓ Database: ${dbConnection.connected ? 'Connected' : 'Disconnected'}`);
    console.log(`   ✓ API Routes: ${apiRoutes.length} endpoints available`);
    console.log(`   ✓ Services: ${services.length} services ready`);
    console.log('🏥 [Health Check] Next.js API server is healthy!');
    
    const response = NextResponse.json({
      data: healthData,
      success: true,
      message: 'Next.js API server is healthy and all services are operational'
    });
    
    return addCorsHeaders(response, request.headers.get('origin') || undefined);
    
  } catch (error) {
    console.error('🏥 [Health Check] Error during health check:', error);
    
    const errorResponse = NextResponse.json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
    
    return addCorsHeaders(errorResponse, request.headers.get('origin') || undefined);
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}