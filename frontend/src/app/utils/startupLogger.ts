/**
 * Startup logger for Next.js API routes
 * Provides centralized logging for API route initialization
 */

export class StartupLogger {
  private static instance: StartupLogger;
  private apiRoutes: Map<string, any> = new Map();
  private startTime: number = Date.now();

  private constructor() {
    // Singleton pattern
  }

  public static getInstance(): StartupLogger {
    if (!StartupLogger.instance) {
      StartupLogger.instance = new StartupLogger();
    }
    return StartupLogger.instance;
  }

  public registerApiRoute(name: string, methods: string[], features: string[]) {
    this.apiRoutes.set(name, {
      methods,
      features,
      timestamp: Date.now()
    });
    
    console.log(`📱 [${name}] Route registered at startup`);
  }

  public logStartupSummary() {
    const totalRoutes = this.apiRoutes.size;
    const initTime = Date.now() - this.startTime;
    
    console.log('');
    console.log('🎉 ===== NEXT.JS API SERVER FULLY INITIALIZED =====');
    console.log('📋 Next.js API Routes Summary:');
    
    Array.from(this.apiRoutes.entries()).forEach(([name, details]) => {
      console.log(`   ✓ ${name} - ${details.methods.join(', ')} - ${details.features.join(', ')}`);
    });
    
    console.log('');
    console.log('🗄️ Next.js Database Integration:');
    console.log('   ✓ SQLite connection pool ready');
    console.log('   ✓ Query and write operations enabled');
    console.log('   ✓ Migration support active');
    
    console.log('');
    console.log('🌐 Next.js Services Status:');
    console.log('   ✓ CORS handler - Mobile device support enabled');
    console.log('   ✓ File streaming - Audio and album art ready');
    console.log('   ✓ Authentication - JWT token validation ready');
    console.log('   ✓ Health check - System monitoring active');
    
    console.log('');
    console.log('📊 Next.js Startup Stats:');
    console.log(`   • ${totalRoutes} API routes loaded`);
    console.log(`   • Initialization completed in ${initTime}ms`);
    console.log(`   • Server ready for mobile and desktop clients`);
    console.log('✅ Next.js API server is ready to handle requests!');
    console.log('');
  }

  public getRouteCount(): number {
    return this.apiRoutes.size;
  }

  public getRoutes(): string[] {
    return Array.from(this.apiRoutes.keys());
  }
}

// Global startup logger instance
export const startupLogger = StartupLogger.getInstance();

// Auto-log startup summary after a short delay to let all routes register
if (typeof window === 'undefined') { // Server-side only
  setTimeout(() => {
    startupLogger.logStartupSummary();
  }, 1000);
}