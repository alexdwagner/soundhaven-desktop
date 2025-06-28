import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  // JWT
  jwtSecret: process.env.JWT_SECRET || 'your-super-secret-jwt-key',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
  refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
  
  // Database
  database: {
    // Use app.getPath('userData') in production, or main directory in development
    path: process.env.DATABASE_PATH || path.resolve(process.cwd(), 'db.sqlite')
  },
  
  // Server Ports
  frontendPort: parseInt(process.env.FRONTEND_PORT || '3001'),
  audioServerPort: parseInt(process.env.AUDIO_SERVER_PORT || '3000'),
  
  // Legacy port config (for backward compatibility)
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // App
  appName: 'SoundHaven',
  appVersion: process.env.npm_package_version || '1.0.0'
};

export default config;
